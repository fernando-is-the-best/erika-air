// Erika Air access gate: the game only starts once this browser holds a valid access code.
// The first person to enter a code owns it; anyone else who tries the same code is turned away.
(function () {
  let release;
  window.__gateReady = new Promise((r) => { release = r; });

  const KEY = 'erika.access.v1';
  const store = {
    get() { try { return localStorage.getItem(KEY); } catch (e) { return null; } },
    set(v) { try { if (v) localStorage.setItem(KEY, v); else localStorage.removeItem(KEY); } catch (e) { /* storage unavailable */ } },
  };

  const css = `
    #gate{position:fixed;inset:0;z-index:1000;display:grid;place-items:center;background:radial-gradient(ellipse at 50% 30%,#14273a 0%,#070b10 70%);color:var(--text,#e8f0f6);
      font-family:var(--f-body,system-ui,sans-serif);padding:max(16px,env(safe-area-inset-top,0px)) max(16px,env(safe-area-inset-right,0px)) max(16px,env(safe-area-inset-bottom,0px)) max(16px,env(safe-area-inset-left,0px))}
    #gate .card{width:min(420px,100%);background:var(--panel-solid,#0d1620);border:1px solid var(--line,rgba(160,190,215,.16));border-radius:14px;padding:28px 24px;display:grid;gap:14px;box-shadow:0 20px 60px rgba(0,0,0,.5)}
    #gate h1{margin:0;font-family:var(--f-display,'Arial Narrow',sans-serif);font-size:34px;letter-spacing:.02em;text-transform:uppercase}
    #gate h1 b{color:var(--accent,#ffb52e)}
    #gate p{margin:0;color:var(--dim,#8ea3b4);line-height:1.5}
    #gate label{font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:var(--dim,#8ea3b4)}
    #gate input{width:100%;box-sizing:border-box;padding:12px 14px;border-radius:9px;border:1px solid var(--line,rgba(160,190,215,.25));background:#070b10;color:inherit;
      font:15px var(--f-mono,ui-monospace,monospace);letter-spacing:.04em}
    #gate input:focus-visible,#gate button:focus-visible{outline:2px solid var(--accent,#ffb52e);outline-offset:2px}
    #gate button{padding:12px 16px;border:0;border-radius:9px;background:var(--accent,#ffb52e);color:var(--accent-ink,#1a1203);font:600 16px var(--f-body,system-ui,sans-serif);cursor:pointer}
    #gate button[disabled]{opacity:.55;cursor:wait}
    #gate .msg{min-height:1.4em;font-size:14px}
    #gate .msg.bad{color:var(--bad,#ff5e5e)} #gate .msg.ok{color:var(--ok,#46d98a)}
    #gate .foot{display:flex;justify-content:space-between;gap:12px;font-size:13px;color:var(--dim,#8ea3b4)}
    #gate .foot a{color:var(--dim,#8ea3b4)}`;
  const html = `
    <form class="card" id="gateForm" autocomplete="off">
      <h1>Erika <b>Air</b></h1>
      <p>Enter your access code to fly. Each code works for one person only.</p>
      <label for="gateCode">Access code</label>
      <input id="gateCode" name="code" spellcheck="false" autocapitalize="off" maxlength="64" placeholder="24-character code" required>
      <button id="gateGo" type="submit">Unlock</button>
      <div class="msg" id="gateMsg" role="status" aria-live="polite"></div>
      <div class="foot"><span>Ask the admin for a code.</span><a href="admin.html">Admin</a></div>
    </form>`;

  function mount() {
    const st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
    const g = document.createElement('div'); g.id = 'gate'; g.innerHTML = html; document.body.appendChild(g);
    return g;
  }
  const gate = document.body ? mount() : null;
  const $ = (id) => document.getElementById(id);
  const say = (t, kind) => { const m = $('gateMsg'); m.textContent = t || ''; m.className = 'msg' + (kind ? ' ' + kind : ''); };
  const busy = (b) => { $('gateGo').disabled = b; $('gateCode').disabled = b; };

  async function sha256(text) {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
    return [...new Uint8Array(buf)].map((x) => x.toString(16).padStart(2, '0')).join('');
  }

  const cfg = window.ERIKA_FIREBASE || {};
  if (!window.firebase || !cfg.apiKey || /PASTE_/.test(cfg.apiKey + cfg.projectId)) {
    busy(true); say('The access system is not set up yet. Ask the admin to finish the setup.', 'bad');
    return;
  }

  firebase.initializeApp(cfg);
  const auth = firebase.auth(), db = firebase.firestore();
  let uid = null, unwatch = null;

  function unlock(hash) {
    store.set(hash);
    gate.remove();
    release();
    // log this flight for the admin desk (last flew + flight count)
    db.collection('codes').doc(hash).update({ lastSeen: firebase.firestore.FieldValue.serverTimestamp(), plays: firebase.firestore.FieldValue.increment(1) }).catch(() => {});
    // if the admin turns the code off or hands it to someone else, lock the game again
    unwatch = db.collection('codes').doc(hash).onSnapshot((d) => {
      const c = d.exists ? d.data() : null;
      if (!c || c.revoked || c.claimedBy !== uid) { store.set(null); location.reload(); }
    }, () => {});
  }

  async function check(code, quiet) {
    const hash = await sha256(code);
    const ref = db.collection('codes').doc(hash);
    let snap = await ref.get();
    if (!snap.exists) return { ok: false, why: 'That code is not valid. Check it and try again.' };
    let c = snap.data();
    if (c.revoked) return { ok: false, why: 'This code has been turned off by the admin.' };
    if (c.claimedBy === uid) return { ok: true, hash };
    if (c.claimedBy) { reportShared(hash); return { ok: false, why: 'This code is already being used by someone else.' }; }
    if (quiet) return { ok: false, why: '' };
    try {
      await ref.update({ claimedBy: uid, claimedAt: firebase.firestore.FieldValue.serverTimestamp() });
      return { ok: true, hash };
    } catch (e) {
      if (e && e.code !== 'permission-denied') throw e;
      snap = await ref.get(); c = snap.exists ? snap.data() : {};
      if (c.claimedBy && c.claimedBy !== uid) reportShared(hash);
      return { ok: false, why: c.claimedBy && c.claimedBy !== uid ? 'This code is already being used by someone else.' : 'Could not use this code. Try again in a moment.' };
    }
  }

  // someone tried a code that belongs to another player: leave an alert for the admin desk (at most once per code every
  // 10 minutes from this browser). Only the code's id, this browser's anonymous id and the time are stored.
  function reportShared(hash) {
    const k = 'erika.alerted.' + hash.slice(0, 16);
    try { const t = +sessionStorage.getItem(k) || 0; if (Date.now() - t < 600000) return; sessionStorage.setItem(k, String(Date.now())); } catch (e) { /* storage unavailable */ }
    db.collection('alerts').add({ code: hash, by: uid, at: firebase.firestore.FieldValue.serverTimestamp(), seen: false }).catch(() => {});
  }

  async function checkSaved(hash) {
    const snap = await db.collection('codes').doc(hash).get();
    const c = snap.exists ? snap.data() : null;
    if (c && !c.revoked && c.claimedBy === uid) return true;
    store.set(null);
    say(!c ? 'Your code no longer exists. Enter a new one.' : c.revoked ? 'Your code has been turned off by the admin.' : 'Your code is now assigned to someone else.', 'bad');
    return false;
  }

  // turn Firebase errors into something the player (or admin) can act on, with the code for troubleshooting
  function explain(e, fallback) {
    const c = (e && e.code) || '';
    if (c === 'auth/admin-restricted-operation' || c === 'auth/operation-not-allowed') return 'Player sign-in is turned off. The admin needs to enable Anonymous sign-in in Firebase. (' + c + ')';
    if (c === 'auth/unauthorized-domain') return 'This website is not on the Firebase authorized-domains list. (' + c + ')';
    if (c === 'auth/network-request-failed' || c === 'unavailable') return 'Could not reach the access server. Check your internet connection and reload. (' + c + ')';
    if (c === 'permission-denied') return 'The access server refused the request. The admin should check the Firestore rules are published. (' + c + ')';
    if (c === 'failed-precondition' || c === 'not-found') return 'The code database is not set up. The admin needs to create the Firestore database. (' + c + ')';
    return fallback + (c ? ' (' + c + ')' : '');
  }

  // the admin, signed in on admin.html in this browser, can always fly: the database itself decides,
  // because only the admin's account is allowed to list the codes
  // a refusal from the rules means "not the admin"; a network hiccup is retried so the admin is not signed out by mistake
  async function isAdmin(user) {
    if (!user || user.isAnonymous) return false;
    for (let i = 0; i < 3; i++) {
      try { await db.collection('codes').limit(1).get({ source: 'server' }); return true; }
      catch (e) { if (e && e.code === 'permission-denied') return false; await new Promise((r) => setTimeout(r, 800 * (i + 1))); }
    }
    return false;
  }
  // a small shortcut back to the admin desk, shown only while the admin is signed in on this browser
  function adminButton() {
    if (document.getElementById('adminJump')) return;
    const st = document.createElement('style');
    st.textContent = '#adminJump{position:fixed;z-index:900;top:calc(10px + env(safe-area-inset-top,0px));right:calc(86px + env(safe-area-inset-right,0px));' +
      'display:inline-flex;align-items:center;gap:6px;padding:7px 12px;border-radius:8px;background:rgba(13,22,32,.88);border:1px solid rgba(255,181,46,.55);' +
      'color:#ffb52e;font:600 12px/1 "Barlow",system-ui,sans-serif;letter-spacing:.1em;text-transform:uppercase;text-decoration:none;backdrop-filter:blur(6px)}' +
      '#adminJump:hover{background:rgba(255,181,46,.16)}#adminJump:focus-visible{outline:2px solid #ffb52e;outline-offset:2px}' +
      '#adminJump svg{width:13px;height:13px;fill:none;stroke:currentColor;stroke-width:2.2}';
    document.head.appendChild(st);
    const a = document.createElement('a');
    a.id = 'adminJump'; a.href = 'admin.html'; a.title = 'Open the admin desk';
    a.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2l8 4v6c0 5-3.5 8.5-8 10-4.5-1.5-8-5-8-10V6z"/></svg>Admin<b id="adminBadge" hidden></b>';
    st.textContent += '#adminBadge{min-width:18px;height:18px;padding:0 5px;border-radius:9px;background:#ff5e5e;color:#fff;font:700 11px/18px system-ui,sans-serif;text-align:center;letter-spacing:0}';
    document.body.appendChild(a);
  }
  // unseen code-sharing alerts: a red count on the Admin button (readable only by the signed-in admin account)
  let alertOff = null, alertSeen = null;
  function watchAlerts(on) {
    if (!on) { if (alertOff) { alertOff(); alertOff = null; } alertSeen = null; return; }
    if (alertOff) return;
    alertOff = db.collection('alerts').where('seen', '==', false).onSnapshot((qs) => {
      const b = document.getElementById('adminBadge'); if (!b) return;
      b.hidden = qs.size === 0; b.textContent = qs.size > 9 ? '9+' : String(qs.size);
      const btn = document.getElementById('adminJump'); if (btn) btn.title = qs.size ? qs.size + ' code-sharing alert' + (qs.size > 1 ? 's' : '') + ': open the admin desk' : 'Open the admin desk';
      if (alertSeen != null && qs.size > alertSeen && window.Notification && Notification.permission === 'granted') {
        try { new Notification('Erika Air: shared code', { body: 'Someone tried to use a code that belongs to another player.', tag: 'erika-alert' }); } catch (e) { /* not supported here */ }
      }
      alertSeen = qs.size;
    }, () => {});
  }
  // keep the button in step with the sign-in: it appears whenever the admin account is signed in on this
  // browser (also if that happens in another tab while the game is open) and goes away on sign-out
  // also shown on a browser where the admin desk was opened, even while flying with a player code
  const adminDevice = () => { try { return localStorage.getItem('erika.admin.device') === '1'; } catch (e) { return false; } };
  const dropButton = () => { const b = document.getElementById('adminJump'); if (b) b.remove(); };
  if (adminDevice()) adminButton();
  window.addEventListener('storage', (e) => { if (e.key === 'erika.admin.device') { if (adminDevice()) adminButton(); else dropButton(); } });
  let adminSeq = 0;
  auth.onAuthStateChanged(async (usr) => {
    const n = ++adminSeq, ok = await isAdmin(usr);
    if (n !== adminSeq) return;
    if (ok || adminDevice()) adminButton(); else dropButton();
    watchAlerts(ok);
  });

  const firstUser = new Promise((r) => { const off = auth.onAuthStateChanged((u) => { off(); r(u); }); });

  busy(true); say('Checking access…');
  firstUser.then(async (u) => {
    if (await isAdmin(u)) { gate.remove(); release(); adminButton(); return null; }
    return u || (await auth.signInAnonymously()).user;
  }).then(async (user) => {
    if (!user) return;
    uid = user.uid;
    const saved = store.get();
    if (saved && await checkSaved(saved).catch(() => false)) { unlock(saved); return; }
    if (!saved) say('');
    busy(false); $('gateCode').focus();
  }).catch((e) => { say(explain(e, 'Could not reach the access server. Check your connection and reload.'), 'bad'); });

  $('gateForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const code = $('gateCode').value.trim();
    if (!code) return;
    busy(true); say('Checking code…');
    const done = (r) => { if (r.ok) { say('Access granted.', 'ok'); unlock(r.hash); } else { say(r.why, 'bad'); busy(false); $('gateCode').select(); } };
    try { done(await check(code)); }
    catch (err) {
      // a refusal here means this browser's player sign-in is no longer valid (for example the anonymous account was
      // removed in Firebase): start a fresh player session and try the code once more
      if (err && (err.code === 'permission-denied' || err.code === 'unauthenticated')) {
        try {
          say('Refreshing your player session…');
          await auth.signOut().catch(() => {});
          uid = (await auth.signInAnonymously()).user.uid; store.set(null);
          done(await check(code)); return;
        } catch (err2) { err = err2; }
      }
      console.error('Erika Air access check failed', err);
      say(explain(err, 'Could not reach the access server. Check your connection and try again.'), 'bad'); busy(false);
    }
  });
})();
