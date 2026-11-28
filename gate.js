// Erika access gate: a game only starts once this browser holds a valid access code for THAT game.
// window.ERIKA_GAME = 'air' (flight, the default), 'race' (Erika Racing), 'boat' (Erika Boats) and so on. A code is made for one
// or more games ('games' on the code, first one also kept as 'game' for older pages). The code's first game keeps its
// admin data in 'grants', 'blocked' and 'status' as before; each other game on the code uses 'grants_<game>' and so on.
// Two kinds of code: a 35-character code that the first person to enter it owns (anyone else is turned away),
// and a one-time 10-digit code that unlocks a single visit and is then spent.
// window.ERIKA_GATE_DEFER = true: the gate waits until window.__gateStart() is called (the game choice comes first).
(function () {
  let release;
  window.__gateReady = new Promise((r) => { release = r; });
  const GAMES = { air: { name: 'Erika Air', word: 'Air', verb: 'fly' }, race: { name: 'Erika Racing', word: 'Racing', verb: 'race', accent: '#3cc4ff', ink: '#04121d' },
    boat: { name: 'Erika Boats', word: 'Boats', verb: 'race boats', accent: '#2fd4c4', ink: '#022320' },
    kart: { name: 'Erika Karts', word: 'Karts', verb: 'race karts', accent: '#ff6b3d', ink: '#1f0a03' },
    moto: { name: 'Erika Moto', word: 'Moto', verb: 'race bikes', accent: '#ff3355', ink: '#22030a' },
    train: { name: 'Erika Trains', word: 'Trains', verb: 'drive trains', accent: '#a78bfa', ink: '#140a2e' },
    rocket: { name: 'Erika Rockets', word: 'Rockets', verb: 'launch rockets', accent: '#7d9cff', ink: '#070d26' } };
  const GAME = GAMES[window.ERIKA_GAME] ? window.ERIKA_GAME : 'air', G = GAMES[GAME], NAME = G.name;

  const keyOf = (g) => (g === 'air' ? 'erika.access.v1' : 'erika.access.' + g + '.v1'), KEY = keyOf(GAME);
  const store = {
    get(k) { try { return localStorage.getItem(k || KEY); } catch (e) { return null; } },
    set(v) { try { if (v) localStorage.setItem(KEY, v); else localStorage.removeItem(KEY); } catch (e) { /* storage unavailable */ } },
  };
  // the games a code works in (older codes only have 'game'), and where this game's admin data lives on it
  const gamesOf = (c) => { const l = (Array.isArray(c.games) ? c.games : []).filter((g) => GAMES[g]); return l.length ? l : [GAMES[c.game] ? c.game : 'air']; };
  const field = (c, base) => (gamesOf(c)[0] === GAME ? base : base + '_' + GAME);
  const namesOf = (c) => { const n = gamesOf(c).map((g) => GAMES[g].name); return n.length > 1 ? n.slice(0, -1).join(', ') + ' and ' + n[n.length - 1] : n[0]; };

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
    #gate .foot a{color:var(--dim,#8ea3b4)}
    #gate{background:radial-gradient(70% 60% at 50% -10%,rgba(255,255,255,.06),transparent 60%),#06080c;font-family:"Inter","Barlow",system-ui,sans-serif}
    #gate .card{width:min(440px,100%);background:linear-gradient(180deg,#141922,#0b0e13);border:1px solid rgba(255,255,255,.08);border-radius:18px;padding:32px 28px 24px;gap:12px;
      box-shadow:0 30px 80px rgba(0,0,0,.55),inset 0 1px 0 rgba(255,255,255,.05);position:relative;overflow:hidden}
    #gate .card::before{content:"";position:absolute;left:0;right:0;top:0;height:3px;background:var(--accent,#ffb52e)}
    #gate h1{font:700 40px/1 var(--f-display,'Saira Condensed','Arial Narrow',sans-serif);letter-spacing:.1em}
    #gate p{font-size:14px;color:#9aa6b3}
    #gate label{font:600 11px "Inter",system-ui,sans-serif;letter-spacing:.14em;color:#8d99a7;margin-top:6px}
    #gate input{border-radius:10px;border:1px solid rgba(255,255,255,.14);background:rgba(255,255,255,.03);padding:13px 14px;font-size:14px}
    #gate input:focus{outline:none;border-color:var(--accent,#ffb52e);box-shadow:0 0 0 3px rgba(255,255,255,.06)}
    #gate button{border-radius:10px;padding:13px 16px;font:700 16px var(--f-display,'Saira Condensed',sans-serif);letter-spacing:.18em;text-transform:uppercase;box-shadow:0 10px 26px rgba(0,0,0,.3)}
    #gate button:hover{filter:brightness(1.07)}
    #gate .foot{border-top:1px solid rgba(255,255,255,.08);padding-top:14px;margin-top:4px}
    #gate .foot a{text-decoration:none;color:#c9d3dd} #gate .foot a:hover{color:#fff}
    #gate #gateAsk{color:var(--accent,#ffb52e);font-weight:600}` + (G.accent ? '#gate{--accent:' + G.accent + ';--accent-ink:' + G.ink + '}' : '');
  const html = `
    <form class="card" id="gateForm" autocomplete="off">
      <h1>Erika <b>${G.word}</b></h1>
      <p>Enter your ${NAME} access code to ${G.verb}. Codes work for one game and one person only.</p>
      <label for="gateCode">Access code</label>
      <input id="gateCode" name="code" spellcheck="false" autocapitalize="off" maxlength="64" placeholder="35-character code, or 10-digit one-time code" required>
      <button id="gateGo" type="submit">Unlock</button>
      <div class="msg" id="gateMsg" role="status" aria-live="polite"></div>
      <div class="foot"><span>No code? <a href="#" id="gateAsk">Ask Fernando</a></span><a href="admin.html">Fernando's desk</a></div>
    </form>`;

  function run() {
  function mount() {
    const st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
    const g = document.createElement('div'); g.id = 'gate'; g.innerHTML = html; document.body.appendChild(g);
    // typing a code must not reach the game underneath (its menus listen for keys on the window)
    ['keydown', 'keyup', 'keypress'].forEach((t) => g.addEventListener(t, (e) => e.stopPropagation()));
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
    busy(true); say('The access system is not set up yet. Ask Fernando to finish the setup.', 'bad');
    return;
  }

  firebase.initializeApp(cfg);
  const auth = firebase.auth(), db = firebase.firestore();
  let uid = null, unwatch = null;

  // ---- messages to Fernando: anyone can ask for a code or send a note. They land on Fernando's desk (admin.html).
  // Only the name, an optional way to reply, the text, the game and this browser's anonymous id are stored.
  const MSG_CSS = `
    #erikaMsg{position:fixed;inset:0;z-index:1001;display:grid;place-items:center;padding:16px;background:rgba(4,8,12,.78);overflow:auto}
    #erikaMsg form{width:min(420px,100%);box-sizing:border-box;background:var(--panel-solid,#0d1620);border-radius:14px;padding:24px;display:grid;gap:12px;color:var(--text,#e8f0f6);
      font:15px/1.45 var(--f-body,system-ui,sans-serif);box-shadow:0 20px 60px rgba(0,0,0,.5);text-align:left;margin:auto}
    #erikaMsg h2{margin:0;font:600 26px/1.1 var(--f-display,'Arial Narrow',sans-serif);letter-spacing:.03em}
    #erikaMsg p{margin:0;color:var(--dim,#8ea3b4);font-size:14px}
    #erikaMsg label{display:grid;gap:5px;font-size:12px;letter-spacing:.1em;text-transform:uppercase;color:var(--dim,#8ea3b4)}
    #erikaMsg input,#erikaMsg textarea{width:100%;box-sizing:border-box;padding:10px 12px;border-radius:9px;border:1px solid rgba(160,190,215,.22);background:#070b10;color:var(--text,#e8f0f6);
      font:15px var(--f-body,system-ui,sans-serif);letter-spacing:0;text-transform:none;-webkit-user-select:text;user-select:text}
    #erikaMsg textarea{min-height:90px;resize:vertical}
    #erikaMsg input:focus-visible,#erikaMsg textarea:focus-visible,#erikaMsg button:focus-visible{outline:2px solid var(--accent,#ffb52e);outline-offset:2px}
    #erikaMsg .acts{display:flex;gap:8px}
    #erikaMsg .acts button{flex:1;padding:11px;border-radius:9px;border:0;font:600 15px var(--f-body,system-ui,sans-serif);cursor:pointer}
    #erikaMsg .send{background:var(--accent,#ffb52e);color:var(--accent-ink,#1a1203)} #erikaMsg .send[disabled]{opacity:.55;cursor:wait}
    #erikaMsg .close{background:rgba(255,255,255,.08);color:inherit}
    #erikaMsg .note{min-height:1.3em;font-size:14px;margin:0} #erikaMsg .note.bad{color:var(--bad,#ff5e5e)} #erikaMsg .note.ok{color:var(--ok,#46d98a)}
    #erikaMsg{background:rgba(3,5,8,.8);font-family:"Inter","Barlow",system-ui,sans-serif}
    #erikaMsg form{background:linear-gradient(180deg,#141922,#0b0e13);border:1px solid rgba(255,255,255,.08);border-radius:18px;padding:30px 26px 24px;position:relative;overflow:hidden;
      box-shadow:0 30px 80px rgba(0,0,0,.55),inset 0 1px 0 rgba(255,255,255,.05);font-family:inherit}
    #erikaMsg form::before{content:"";position:absolute;left:0;right:0;top:0;height:3px;background:var(--accent,#ffb52e)}
    #erikaMsg h2{font:700 30px/1.05 var(--f-display,'Saira Condensed',sans-serif);letter-spacing:.06em;text-transform:uppercase}
    #erikaMsg label{font:600 11px "Inter",system-ui,sans-serif;letter-spacing:.14em;color:#8d99a7}
    #erikaMsg input,#erikaMsg textarea{border-radius:10px;border:1px solid rgba(255,255,255,.14);background:rgba(255,255,255,.03);font-family:inherit;font-size:14px}
    #erikaMsg input:focus,#erikaMsg textarea:focus{outline:none;border-color:var(--accent,#ffb52e)}
    #erikaMsg .acts button{border-radius:10px;font:700 15px var(--f-display,'Saira Condensed',sans-serif);letter-spacing:.16em;text-transform:uppercase}
    #erikaMsg .close{background:transparent;border:1px solid rgba(255,255,255,.16)!important}
    #erikaMsg label{margin-top:4px}`;
  function openMessage(kind) {
    if (document.getElementById('erikaMsg')) return;
    if (!document.getElementById('erikaMsgCss')) { const st = document.createElement('style'); st.id = 'erikaMsgCss'; st.textContent = MSG_CSS + (G.accent ? '#erikaMsg{--accent:' + G.accent + ';--accent-ink:' + G.ink + '}' : ''); document.head.appendChild(st); }
    const w = document.createElement('div'); w.id = 'erikaMsg';
    w.innerHTML = `<form autocomplete="off" role="dialog" aria-modal="true" aria-labelledby="eMsgH">
      <h2 id="eMsgH">${kind === 'code' ? 'Ask Fernando for a code' : 'Message Fernando'}</h2>
      <p>${kind === 'code' ? 'Fernando makes the access codes for ' + NAME + '. Leave your name and a way to reach you.' : 'Send Fernando a note: a question, a problem or an idea.'}</p>
      <label>Your name<input data-f="name" maxlength="60" required></label>
      <label>How to reach you (optional)<input data-f="contact" maxlength="120" placeholder="Email, phone or username"></label>
      <label><span data-f="tl">Message</span><textarea data-f="text" maxlength="1000"></textarea></label>
      <p class="note" role="status" aria-live="polite"></p>
      <div class="acts"><button type="button" class="close">Close</button><button type="submit" class="send">Send</button></div></form>`;
    const f = w.querySelector('form'), q = (k) => f.querySelector('[data-f="' + k + '"]'), note = f.querySelector('.note'), send = f.querySelector('.send');
    const say2 = (t, k) => { note.textContent = t || ''; note.className = 'note' + (k ? ' ' + k : ''); };
    const k = kind === 'code' ? 'code' : 'msg';   // the code page asks for a code; the game pages send a message
    q('tl').textContent = k === 'code' ? 'Anything else (optional)' : 'Message';
    const close = () => { w.remove(); };
    f.querySelector('.close').addEventListener('click', close);
    w.addEventListener('click', (e) => { if (e.target === w) close(); });
    // typing here must not reach the game underneath; Escape closes
    ['keydown', 'keyup', 'keypress'].forEach((t) => w.addEventListener(t, (e) => { e.stopPropagation(); if (t === 'keydown' && e.key === 'Escape') close(); }));
    try { const last = JSON.parse(localStorage.getItem('erika.msg.me') || '{}'); if (last.name) q('name').value = last.name; if (last.contact) q('contact').value = last.contact; } catch (e) { /* storage unavailable */ }
    f.addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = q('name').value.trim(), contact = q('contact').value.trim(), text = q('text').value.trim();
      if (!name) { say2('Write your name so Fernando knows who it is.', 'bad'); q('name').focus(); return; }
      if (k === 'msg' && !text) { say2('Write a message first.', 'bad'); q('text').focus(); return; }
      let lastAt = 0; try { lastAt = +localStorage.getItem('erika.msg.at') || 0; } catch (err) { /* storage unavailable */ }
      if (Date.now() - lastAt < 60000) { say2('You just sent one. Wait a minute before sending another.', 'bad'); return; }
      send.disabled = true; say2('Sending…');
      try {
        const u = auth.currentUser || (await auth.signInAnonymously()).user;
        const msg = { kind: k, game: GAME, name, contact, text, by: u.uid, at: firebase.firestore.FieldValue.serverTimestamp(), seen: false };
        try { await db.collection('messages').add(msg); }
        catch (err0) {   // rules published before this game existed only know air, race and boat: send it as a Racing message, labelled
          if (!(err0 && err0.code === 'permission-denied') || ['air', 'race', 'boat'].includes(GAME)) throw err0;
          await db.collection('messages').add(Object.assign(msg, { game: 'race', text: ('[' + NAME + '] ' + text).slice(0, 1000), at: firebase.firestore.FieldValue.serverTimestamp() }));
        }
        try { localStorage.setItem('erika.msg.at', String(Date.now())); localStorage.setItem('erika.msg.me', JSON.stringify({ name, contact })); } catch (err) { /* storage unavailable */ }
        say2(k === 'code' ? 'Sent. Fernando will see your code request.' : 'Sent. Fernando will see your message.', 'ok');
        q('text').value = ''; setTimeout(close, 2600);
      } catch (err) {
        console.error('Erika message failed', err);
        say2(err && err.code === 'permission-denied' ? 'Messages are not switched on yet. Try again later.' : 'Could not send. Check your connection and try again.', 'bad');
        send.disabled = false;
      }
    });
    document.body.appendChild(w);
    (q('name').value ? (k === 'code' ? send : q('text')) : q('name')).focus();
  }
  if ($('gateAsk')) $('gateAsk').addEventListener('click', (e) => { e.preventDefault(); openMessage('code'); });

  // every flight started with a code adds one to that aircraft's count on the code (shown on the admin desk on request)
  let codeHash = null, statusField = 'status';
  window.ErikaAccess = {
    flew(name) {
      if (!codeHash || !name) return;
      const key = String(name).replace(/[.~*/\[\]`]/g, ' ').slice(0, 60);
      db.collection('codes').doc(codeHash).update(new firebase.firestore.FieldPath('fleet', key), firebase.firestore.FieldValue.increment(1)).catch(() => {});
    },
    // the game hands over its wallet (credits and what it owns) so the admin's grants can be applied to it
    attach(a) { adapter = a; syncControl(); },
    blocked(id) { return (ctl.blocked || []).indexOf(id) >= 0; },
    message() { openMessage('msg'); },   // the 'Message Fernando' links in the game menus
    sync() { syncControl(); },
  };

  // ---- admin control. On this code the admin desk keeps 'grants' (one-off changes: credits added, taken away or set,
  // items given or taken) and 'blocked' (items this player may not have or buy). Each grant is applied once in this browser,
  // and the game reports its wallet back ('status') so the desk can show what the player has.
  let ctl = { grants: {}, blocked: [] }, adapter = null, lastRep = '', repT = null;
  // the admin, signed in on this browser, plays without a code. Their own grants come from the admin desk's "My own games"
  // panel through this browser's storage (same site), and what they have is written back there for the desk to show
  let selfMode = false;
  const SELF = 'erika.self.' + GAME, SELF_DONE = 'erika.selfdone.' + GAME, SELF_STATUS = 'erika.selfstatus.' + GAME;
  const ls = { get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } }, set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* storage unavailable */ } } };
  window.addEventListener('storage', (e) => { if (selfMode && e.key === SELF) syncControl(); });
  const appliedKey = () => 'erika.applied.' + GAME + '.' + (codeHash || '').slice(0, 16);
  const getApplied = () => { try { return JSON.parse(localStorage.getItem(appliedKey()) || '[]'); } catch (e) { return []; } };
  const setApplied = (a) => { try { localStorage.setItem(appliedKey(), JSON.stringify(a.slice(-400))); } catch (e) { /* storage unavailable */ } };
  function toast(text) {
    let t = document.getElementById('erikaToast');
    if (!t) {
      const st = document.createElement('style');
      st.textContent = '#erikaToast{position:fixed;z-index:950;left:50%;top:calc(14px + env(safe-area-inset-top,0px));transform:translateX(-50%);max-width:min(560px,calc(100vw - 32px));padding:12px 18px;border-radius:12px;'
        + 'background:rgba(13,22,32,.94);border:1px solid rgba(255,181,46,.6);color:#e8f0f6;font:500 15px/1.4 system-ui,sans-serif;box-shadow:0 12px 40px rgba(0,0,0,.45);transition:opacity .4s}#erikaToast b{color:#ffb52e}';
      document.head.appendChild(st);
      t = document.createElement('div'); t.id = 'erikaToast'; t.setAttribute('role', 'status'); document.body.appendChild(t);
    }
    t.innerHTML = '<b>From Fernando</b><br>'; t.appendChild(document.createTextNode(text)); t.style.opacity = '1';
    clearTimeout(t._h); t._h = setTimeout(() => { t.style.opacity = '0'; }, 7000);
  }
  function syncControl() {
    if (!adapter || (!codeHash && !selfMode) || (adapter.ready && !adapter.ready())) return;
    const grants = selfMode ? (ls.get(SELF, {}).grants || {}) : (ctl.grants || {}), done = selfMode ? ls.get(SELF_DONE, []) : getApplied(), msgs = [], name = (id) => (adapter.name ? adapter.name(id) : id) || id;
    let changed = false;
    Object.entries(grants).filter(([gid, g]) => g && done.indexOf(gid) < 0).sort((a, b) => (a[1].at || 0) - (b[1].at || 0)).forEach(([gid, g]) => {
      if (typeof g.set === 'number') { adapter.setCredits(Math.max(0, Math.round(g.set))); msgs.push('your credits are now ' + Math.round(g.set).toLocaleString()); }
      if (typeof g.credits === 'number' && g.credits) { const was = adapter.credits(), now = Math.max(0, Math.round(was + g.credits)), d = now - was; adapter.setCredits(now); if (d) msgs.push((d > 0 ? '+' : '\u2212') + Math.abs(d).toLocaleString() + ' credits'); }   // the real change (a take stops at 0)
      (g.give || []).forEach((id) => { adapter.give(id); msgs.push('you now have the ' + name(id)); });
      (g.take || []).forEach((id) => { adapter.take(id); msgs.push('the ' + name(id) + ' was taken away'); });
      (g.career || []).forEach(([track, level]) => { const t = adapter.setCareer ? adapter.setCareer(track, level) : null; if (t) msgs.push(t); });   // a career rank or licence, set directly
      done.push(gid); changed = true;
    });
    // blocked items are taken away and stay unavailable
    if (!selfMode) (ctl.blocked || []).forEach((id) => { if (adapter.ownedIds().indexOf(id) >= 0) { adapter.take(id); changed = true; } });
    if (changed) { if (selfMode) ls.set(SELF_DONE, done.slice(-400)); else setApplied(done); if (adapter.save) adapter.save(); if (adapter.refresh) adapter.refresh(); }
    if (msgs.length) toast(msgs.join(' \u00B7 '));
    report();
  }
  // tell the desk what this player has (only when it changes, at most every 15 s)
  function report() {
    if (selfMode && adapter && !(adapter.ready && !adapter.ready())) {
      ls.set(SELF_STATUS, { credits: Math.round(adapter.credits() || 0), owned: adapter.ownedIds().slice(0, 400), career: adapter.career ? adapter.career() : null, at: Date.now() }); return; }
    if (!adapter || !codeHash || repT) return;
    repT = setTimeout(() => {
      repT = null; if (adapter.ready && !adapter.ready()) return;
      // applied: every grant still on the code that this browser has applied (the desk lists the rest as waiting), so
      // older grants don't show up as "waiting" again once there are many
      const live = ctl.grants || {}, st = { credits: Math.round(adapter.credits() || 0), owned: adapter.ownedIds().slice(0, 250), applied: getApplied().filter((g) => live[g]).slice(-300) }, key = JSON.stringify(st);
      if (key === lastRep) return; lastRep = key;
      st.at = firebase.firestore.FieldValue.serverTimestamp();
      db.collection('codes').doc(codeHash).update({ [statusField]: st }).catch(() => { lastRep = ''; });
    }, lastRep ? 15000 : 2000);
  }
  setInterval(() => syncControl(), 5000);   // picks up a save being opened, credits earned, and so on

  function unlock(hash, once) {
    if (!once) store.set(hash);   // a one-time code is good for this visit only
    codeHash = hash;
    gate.remove();
    release();
    // log this flight for the admin desk (last flew + flight count)
    db.collection('codes').doc(hash).update({ lastSeen: firebase.firestore.FieldValue.serverTimestamp(), plays: firebase.firestore.FieldValue.increment(1) }).catch(() => {});
    // if the admin turns the code off or hands it to someone else, lock the game again
    unwatch = db.collection('codes').doc(hash).onSnapshot((d) => {
      const c = d.exists ? d.data() : null;
      if (!c || c.revoked || c.claimedBy !== uid || !gamesOf(c).includes(GAME)) { store.set(null); location.reload(); return; }
      const b = c[field(c, 'blocked')];
      statusField = field(c, 'status');
      ctl = { grants: c[field(c, 'grants')] || {}, blocked: Array.isArray(b) ? b : [] };
      syncControl();
    }, () => {});
  }

  // a 10-digit one-time code may be typed with spaces or dashes ("12345 67890")
  const normal = (code) => (/^[\d\s-]+$/.test(code) ? code.replace(/\D/g, '') : code);
  async function check(code, quiet) {
    const hash = await sha256(normal(code));
    const ref = db.collection('codes').doc(hash);
    let snap = await ref.get();
    if (!snap.exists) return { ok: false, why: 'That code is not valid. Check it and try again.' };
    let c = snap.data();
    if (!gamesOf(c).includes(GAME)) return { ok: false, why: 'That code is not for ' + NAME + '. It only works in ' + namesOf(c) + '.' };
    if (c.revoked) return { ok: false, why: 'This code has been turned off by Fernando.' };
    if (c.once && c.claimedBy) { if (c.claimedBy !== uid) reportShared(hash); return { ok: false, why: 'This one-time code has already been used.' }; }
    if (c.claimedBy === uid) return { ok: true, hash };
    if (c.claimedBy) { reportShared(hash); return { ok: false, why: 'This code is already being used by someone else.' }; }
    if (quiet) return { ok: false, why: '' };
    try {
      await ref.update({ claimedBy: uid, claimedAt: firebase.firestore.FieldValue.serverTimestamp() });
      return { ok: true, hash, once: !!c.once };
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

  async function checkSaved(hash, quiet) {
    const snap = await db.collection('codes').doc(hash).get();
    const c = snap.exists ? snap.data() : null;
    if (c && !c.revoked && !c.once && gamesOf(c).includes(GAME) && c.claimedBy === uid) return true;
    if (quiet) return false;
    store.set(null);
    say(!c ? 'Your code no longer exists. Enter a new one.' : c.revoked ? 'Your code has been turned off by Fernando.' : 'Your code is now assigned to someone else.', 'bad');
    return false;
  }

  // turn Firebase errors into something the player (or admin) can act on, with the code for troubleshooting
  function explain(e, fallback) {
    const c = (e && e.code) || '';
    if (c === 'auth/admin-restricted-operation' || c === 'auth/operation-not-allowed') return 'Player sign-in is turned off. Fernando needs to enable Anonymous sign-in in Firebase. (' + c + ')';
    if (c === 'auth/unauthorized-domain') return 'This website is not on the Firebase authorized-domains list. (' + c + ')';
    if (c === 'auth/network-request-failed' || c === 'unavailable') return 'Could not reach the access server. Check your internet connection and reload. (' + c + ')';
    if (c === 'permission-denied') return 'The access server refused the request. Fernando should check the Firestore rules are published. (' + c + ')';
    if (c === 'failed-precondition' || c === 'not-found') return 'The code database is not set up. Fernando needs to create the Firestore database. (' + c + ')';
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
    a.id = 'adminJump'; a.href = 'admin.html'; a.title = 'Open Fernando\'s desk';
    a.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2l8 4v6c0 5-3.5 8.5-8 10-4.5-1.5-8-5-8-10V6z"/></svg>Desk<b id="adminBadge" hidden></b>';
    st.textContent += '#adminBadge{min-width:18px;height:18px;padding:0 5px;border-radius:9px;background:#ff5e5e;color:#fff;font:700 11px/18px system-ui,sans-serif;text-align:center;letter-spacing:0}';
    document.body.appendChild(a);
  }
  // unseen code-sharing alerts and messages: a red count on the desk button (readable only by the signed-in admin account)
  let alertOff = null, msgOff = null, alertSeen = null, nAlerts = 0, nMsgs = 0;
  function paintBadge(kind) {
    const b = document.getElementById('adminBadge'); if (!b) return;
    const n = nAlerts + nMsgs;
    b.hidden = n === 0; b.textContent = n > 9 ? '9+' : String(n);
    const btn = document.getElementById('adminJump');
    if (btn) btn.title = n ? [nMsgs ? nMsgs + ' new message' + (nMsgs > 1 ? 's' : '') : '', nAlerts ? nAlerts + ' code-sharing alert' + (nAlerts > 1 ? 's' : '') : ''].filter(Boolean).join(', ') + ": open Fernando's desk" : "Open Fernando's desk";
    if (alertSeen != null && n > alertSeen && window.Notification && Notification.permission === 'granted') {
      const msg = kind === 'msg';
      try { new Notification(msg ? 'Erika: new message' : 'Erika Air: shared code', { body: msg ? 'Someone sent you a message or asked for a code.' : 'Someone tried to use a code that belongs to another player.', tag: 'erika-' + (msg ? 'msg' : 'alert') }); } catch (e) { /* not supported here */ }
    }
    alertSeen = n;
  }
  function watchAlerts(on) {
    if (!on) { if (alertOff) { alertOff(); alertOff = null; } if (msgOff) { msgOff(); msgOff = null; } alertSeen = null; nAlerts = nMsgs = 0; return; }
    if (alertOff) return;
    alertOff = db.collection('alerts').where('seen', '==', false).onSnapshot((qs) => { nAlerts = qs.size; paintBadge('alert'); }, () => {});
    msgOff = db.collection('messages').where('seen', '==', false).onSnapshot((qs) => { nMsgs = qs.size; paintBadge('msg'); }, () => {});
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
    if (await isAdmin(u)) { selfMode = true; gate.remove(); release(); adminButton(); syncControl(); return null; }
    return u || (await auth.signInAnonymously()).user;
  }).then(async (user) => {
    if (!user) return;
    uid = user.uid;
    const saved = store.get();
    if (saved && await checkSaved(saved).catch(() => false)) { unlock(saved); return; }
    // no code saved for this game yet: a code already entered in another game may cover this one too
    if (!saved) {
      for (const g of Object.keys(GAMES)) {
        const h = g !== GAME && store.get(keyOf(g));
        if (h && await checkSaved(h, true).catch(() => false)) { unlock(h); return; }
      }
      say('');
    }
    busy(false); $('gateCode').focus();
  }).catch((e) => { say(explain(e, 'Could not reach the access server. Check your connection and reload.'), 'bad'); });

  $('gateForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const code = $('gateCode').value.trim();
    if (!code) return;
    busy(true); say('Checking code…');
    const done = (r) => { if (r.ok) { say(r.once ? 'Access granted for this visit.' : 'Access granted.', 'ok'); unlock(r.hash, r.once); } else { say(r.why, 'bad'); busy(false); $('gateCode').select(); } };
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
      console.error('Erika access check failed', err);
      say(explain(err, 'Could not reach the access server. Check your connection and try again.'), 'bad'); busy(false);
    }
  });
  }
  if (window.ERIKA_GATE_DEFER) { let started = false; window.__gateStart = () => { if (!started) { started = true; run(); } }; }
  else run();
})();
