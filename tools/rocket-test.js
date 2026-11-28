// Flies every Erika Rockets career mission on the autopilot and prints the result. Run: node tools/rocket-test.js [missionId]
const C = require('../rocket-core.js');
const only = process.argv[2];
for (const M of C.MISSIONS) {
  if (only && M.id !== only) continue;
  const F = C.newFlight(M.rocket, M, { auto: true }); F.fast = true;
  const log = []; F.onEvent = (e) => log.push('T+' + e.t.toFixed(0) + ' ' + e.text);
  F.launched = true; F.ctrl.ign = 1; F.ctrl.eng = true; F.ctrl.thr = 1;
  let res = null, t = 0;
  while (t < 9000) {
    const low = F.vehicles.some((v) => v.alive && !v.done && C.alt(v) < 8000 && v.role === 'booster');
    const dt = low ? 1 / 60 : 1 / 20; C.step(F, dt); t += dt;
    res = C.judge(F); if (res) break;
  }
  const up = F.vehicles.find((v) => v.role !== 'booster' && v.alive);
  const o = up ? C.orbit(up.x, up.y, up.vx, up.vy) : null;
  const p = C.payout(F);
  console.log(M.id.padEnd(10), res ? (res.ok ? 'OK  ' : 'FAIL') : 'TIME', 'T+' + Math.round(F.met), o ? 'apo ' + Math.round(o.apo / 1000) + ' peri ' + Math.round(o.peri / 1000) : '', 'apex ' + Math.round(F.apex / 1000), 'maxG ' + F.maxG.toFixed(1), 'maxQ ' + Math.round(F.maxQ / 1000), res && !res.ok ? res.why : '', p ? 'pay ' + p.total + ' stars ' + p.stars : '');
  for (const v of F.vehicles.filter((v) => v.role === 'booster')) console.log('   booster', C.S(F, v.stages[0]).name, v.done, v.touch ? JSON.stringify({ vr: +v.touch.vr.toFixed(1), vh: +v.touch.vh.toFixed(1), tilt: +v.touch.tilt.toFixed(1), s: Math.round(v.touch.s) }) : '', 'fuel', Math.round(F.prop[v.stages[0]]), v.why || '');
  if (only) console.log(log.join('\n'));
}
