// Erika Rockets: the flight core (rockets, launch sites, missions, physics and autopilots). No DOM: rocket.html loads
// this file, and tools/rocket-test.js runs it in Node to check that every career mission can be flown by the autopilot.
// The flight is in the plane of the launch: x, y in metres from the Earth's centre (an inertial frame), the Earth turning
// under it at the launch site's speed. Numbers marked GUESS are not published or were filled in to make the rocket fly right.
(function (root) {
'use strict';
const RE = 6371000, MU = 3.986004418e14, G0 = 9.80665, OMEGA = 7.2921159e-5;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const wrapPi = (a) => { a = (a + Math.PI) % (2 * Math.PI); if (a < 0) a += 2 * Math.PI; return a - Math.PI; };

// ------------------------------------------------------------------ the air: a 1976 standard atmosphere, simplified
function atmos(h) {
  if (h > 140000) return { rho: 0, p: 0, a: 290, T: 200 };
  let T;
  if (h < 11000) T = 288.15 - .0065 * h; else if (h < 20000) T = 216.65; else if (h < 32000) T = 216.65 + .001 * (h - 20000);
  else if (h < 47000) T = 228.65 + .0028 * (h - 32000); else if (h < 51000) T = 270.65; else if (h < 71000) T = 270.65 - .0028 * (h - 51000);
  else T = Math.max(186.9, 214.65 - .002 * (h - 71000));
  const hh = Math.max(h, -500);
  // density: a scale height that grows a little with height gives the real curve within about 15% up to 100 km
  const rho = 1.225 * Math.exp(-hh / 8500 - Math.max(0, hh - 25000) * hh * 2.4e-11) * (h > 100000 ? Math.exp(-(h - 100000) / 6000) : 1);
  return { rho, p: rho * 287.05 * T, a: Math.sqrt(1.4 * 287.05 * T), T };
}
// drag coefficient of a slender rocket going nose first, by Mach number
function cdMach(M) {
  if (M < .8) return .3; if (M < 1.1) return .3 + (M - .8) / .3 * .25; if (M < 2) return .55 - (M - 1.1) / .9 * .17; if (M < 5) return .38 - (M - 2) / 3 * .1; return .28;
}

// ------------------------------------------------------------------ launch sites
// lat: degrees (sets how fast the ground turns under you). coast: metres downrange where the land ends (Infinity inland).
// land / sea: ground colours. heading: the direction you launch. All launches go east except the V-2's test shots.
const SITES = {
  peene: { name: 'Peenemünde', place: 'Germany, 1944', lat: 54.1, coast: 1500, land: '#5d6b45', sea: '#2a4a5c', sand: '#c9b98a' },
  wtx: { name: 'Launch Site One', place: 'West Texas, USA', lat: 31.4, coast: Infinity, land: '#a8885c', sea: '#a8885c', sand: '#c4a575' },
  mahia: { name: 'Launch Complex 1', place: 'Mahia Peninsula, New Zealand', lat: -39.3, coast: 1200, land: '#4f7a3c', sea: '#1f4f6e', sand: '#cdbb8e' },
  baik: { name: 'Baikonur Cosmodrome', place: 'Kazakhstan', lat: 45.9, coast: Infinity, land: '#9a9468', sea: '#9a9468', sand: '#b8ae7e' },
  cape: { name: 'Cape Canaveral', place: 'Florida, USA', lat: 28.5, coast: 4000, land: '#5f7f45', sea: '#1d5d7a', sand: '#e0d3a8' },
  kourou: { name: 'Guiana Space Centre', place: 'Kourou, French Guiana', lat: 5.2, coast: 6000, land: '#2f6a32', sea: '#2a5f6a', sand: '#cfc08f' },
  starbase: { name: 'Starbase', place: 'Boca Chica, Texas, USA', lat: 26.0, coast: 2500, land: '#8f8a62', sea: '#2b5d72', sand: '#dacb9c' },
};

// ------------------------------------------------------------------ rockets
// Each stage: n (how many units, for the picture), dia / len (m), dry / prop (kg, all units together), tSL / tVac (N, all engines),
// ispSL / ispVac (s), eng (engine count), minThr (lowest throttle per engine), solid (cannot throttle or stop), side (strap-on boosters
// that burn with the next stage from liftoff), coreThr (this stage runs at that throttle while side boosters are still on),
// rec: what happens to it after it drops: 'land' (powered landing), 'catch' (caught by the tower), 'chute' (parachutes, picked up
// from the sea), 'none'. fuel: the colour of the flame. look: the shape.
// Payload is in the top stage's dry mass. fair: the fairing or escape tower, dropped at 110 km.
const R = {};
R.v2 = { name: 'V-2', maker: 'Peenemünde Army Research Centre', year: 1944, country: 'Germany', site: 'peene', price: 0, rank: 0, ang: 6,
  blurb: 'The first rocket to reach space: a 1944 test shot, MW 18014, went straight up to 176 km. One alcohol and liquid-oxygen engine, 65 seconds of thrust, steered by vanes in the flame',
  fact: 'On 20 June 1944 MW 18014 reached 176 km, the first human-made object in space.',
  stages: [{ name: 'A4', dia: 1.65, len: 14, dry: 3900, prop: 8600, tSL: 270e3, tVac: 312e3, ispSL: 210, ispVac: 239, eng: 1, minThr: 1, fuel: 'alc', rec: 'none',
    look: { col: '#f2f2ec', col2: '#141414', pat: 'check', nose: 'v2', fins: 4 } }],
  fair: 0, cdMul: 1.1 };
R.ns = { name: 'New Shepard', maker: 'Blue Origin', year: 2015, country: 'USA', site: 'wtx', price: 2000, rank: 0, ang: 9,
  blurb: 'Blue Origin\'s space tourist rocket: one hydrogen BE-3 engine, six seats in a capsule with the biggest windows in space, and a booster that lands on its own pad. About 11 minutes from liftoff to touchdown',
  fact: 'New Shepard\'s booster was the first to fly to space and land vertically, in November 2015.',
  // GUESS: Blue Origin does not publish the masses; these give the real flight (MECO about 2:20, apogee about 107 km)
  stages: [{ name: 'Propulsion module', dia: 3.7, len: 15, dry: 9000, prop: 20500, tSL: 490e3, tVac: 530e3, ispSL: 305, ispVac: 350, eng: 1, minThr: .2, fuel: 'hydro', rec: 'land',
    land: [1], look: { col: '#f4f4f0', col2: '#1d3a8c', nose: 'flat', ring: true, fins: 4, legs: true, feather: true } },
    { name: 'Crew capsule', dia: 3.7, len: 3.6, dry: 4600, prop: 0, tSL: 0, tVac: 0, ispSL: 1, ispVac: 1, eng: 0, minThr: 1, fuel: 'none', rec: 'chute',
      look: { col: '#f4f4f0', col2: '#1d3a8c', nose: 'capsule', windows: true } }],
  fair: 0 };
R.electron = { name: 'Electron', maker: 'Rocket Lab', year: 2017, country: 'New Zealand / USA', site: 'mahia', price: 3000, rank: 1, ang: 14,
  blurb: 'A small black carbon-fibre rocket for small satellites: nine 3D-printed Rutherford engines whose pumps are driven by electric motors and batteries',
  fact: 'Rutherford is the first engine with battery-powered electric pumps to fly to orbit.',
  stages: [{ name: 'First stage', dia: 1.2, len: 12.1, dry: 900, prop: 9400, tSL: 224e3, tVac: 232e3, ispSL: 311, ispVac: 323, eng: 9, minThr: 1, fuel: 'kero', rec: 'chute',
    look: { col: '#18191c', col2: '#e8e8e8', nose: 'flat' } },
    { name: 'Second stage + Curie kick stage', dia: 1.2, len: 2.4, dry: 470, prop: 2300, tSL: 20e3, tVac: 25.8e3, ispSL: 280, ispVac: 343, eng: 1, minThr: 1, fuel: 'kero', rec: 'none',
      look: { col: '#18191c', col2: '#e8e8e8', nose: 'fairing', fairLen: 2.5, fairDia: 1.2 } }],
  fair: 50 };
R.soyuz = { name: 'Soyuz', maker: 'RSC Progress', year: 1966, country: 'Russia / USSR', site: 'baik', price: 6000, rank: 1, ang: 3,
  blurb: 'The most-flown rocket ever: the R-7 family launched Sputnik and Gagarin and still flies crews. Four strap-on boosters fall away in the famous Korolev cross',
  fact: 'Over 1,900 R-7 family rockets have flown since 1957.',
  stages: [{ name: '4 boosters (Blocks B, V, G, D)', n: 4, side: true, dia: 2.68, len: 19.6, dry: 15200, prop: 158400, tSL: 3354e3, tVac: 4084e3, ispSL: 263, ispVac: 320, eng: 4, minThr: 1, fuel: 'kero', rec: 'none',
    look: { col: '#e7e5dc', col2: '#ff6a1a', nose: 'cone' } },
    { name: 'Core (Block A)', dia: 2.95, len: 27.1, dry: 6500, prop: 90100, tSL: 792.5e3, tVac: 990e3, ispSL: 255, ispVac: 319, eng: 1, minThr: 1, fuel: 'kero', rec: 'none',
      look: { col: '#e7e5dc', col2: '#7a7a6e', waist: true } },
    { name: 'Third stage (Block I) + Soyuz MS', dia: 2.66, len: 6.7, dry: 9500, prop: 25400, tSL: 240e3, tVac: 298e3, ispSL: 260, ispVac: 326, eng: 1, minThr: 1, fuel: 'kero', rec: 'none',
      look: { col: '#e7e5dc', col2: '#8a9a6a', nose: 'soyuz', fairLen: 10, fairDia: 3 } }],
  fair: 4500, gmax: 4.3 };
R.f9 = { name: 'Falcon 9', maker: 'SpaceX', year: 2010, country: 'USA', site: 'cape', price: 9000, rank: 2, ang: 8,
  blurb: 'The workhorse: nine Merlin engines, and a first stage that flies back and lands on a drone ship or a pad so it can fly again. Some boosters have flown more than 25 times',
  fact: 'In December 2015 a Falcon 9 first stage landed after an orbital launch for the first time, at Landing Zone 1.',
  stages: [{ name: 'First stage', dia: 3.66, len: 47.7, dry: 25600, prop: 395700, tSL: 7607e3, tVac: 8227e3, ispSL: 282, ispVac: 311, eng: 9, minThr: .4, fuel: 'kero', rec: 'land',
    land: [3, 1], look: { col: '#f4f5f6', col2: '#202226', legs: true, gridfins: true, soot: true, logo: 'SpaceX' } },
    { name: 'Second stage + payload', dia: 3.66, len: 13.8, dry: 19600, prop: 107500, tSL: 420e3, tVac: 981e3, ispSL: 180, ispVac: 348, eng: 1, minThr: .4, fuel: 'kero', rec: 'none',
      look: { col: '#f4f5f6', col2: '#202226', nose: 'fairing', fairLen: 13.1, fairDia: 5.2 } }],
  fair: 1900, qmax: 32000 };
R.fh = { name: 'Falcon Heavy', maker: 'SpaceX', year: 2018, country: 'USA', site: 'cape', price: 22000, rank: 3, ang: 7,
  blurb: 'Three Falcon 9 cores side by side, 27 engines. The two side boosters fly home and land together at the Cape, and the centre core goes for the drone ship far out at sea',
  fact: 'On its first flight in 2018 Falcon Heavy sent Elon Musk\'s red Tesla Roadster past Mars, and both side boosters landed side by side.',
  stages: [{ name: '2 side boosters', n: 2, side: true, dia: 3.66, len: 44.6, dry: 53000, prop: 791400, tSL: 15214e3, tVac: 16454e3, ispSL: 282, ispVac: 311, eng: 18, minThr: .4, fuel: 'kero', rec: 'land',
    land: [6, 2], look: { col: '#f4f5f6', col2: '#202226', nose: 'cone', legs: true, gridfins: true, soot: true } },
    { name: 'Centre core', dia: 3.66, len: 47.7, dry: 28000, prop: 395700, tSL: 7607e3, tVac: 8227e3, ispSL: 282, ispVac: 311, eng: 9, minThr: .4, fuel: 'kero', rec: 'land', coreThr: .6,
      land: [3, 1], look: { col: '#f4f5f6', col2: '#202226', legs: true, gridfins: true, soot: true, logo: 'SpaceX' } },
    { name: 'Second stage + payload', dia: 3.66, len: 13.8, dry: 10500, prop: 107500, tSL: 420e3, tVac: 981e3, ispSL: 180, ispVac: 348, eng: 1, minThr: .4, fuel: 'kero', rec: 'none',
      look: { col: '#f4f5f6', col2: '#202226', nose: 'fairing', fairLen: 13.1, fairDia: 5.2 } }],
  fair: 1900, qmax: 32000 };
R.ariane5 = { name: 'Ariane 5', maker: 'ArianeGroup / ESA', year: 1996, country: 'Europe', site: 'kourou', price: 12000, rank: 2, ang: 4,
  blurb: 'Europe\'s heavy lifter, launched near the equator from French Guiana: two giant solid boosters and a hydrogen core. It launched the James Webb Space Telescope in 2021',
  fact: 'Ariane 5 flew 117 times. Its launch of the James Webb Space Telescope was so precise that Webb kept fuel for over 20 years of life.',
  stages: [{ name: '2 solid boosters (EAP)', n: 2, side: true, solid: true, dia: 3.05, len: 31.6, dry: 74000, prop: 480000, tSL: 9050e3, tVac: 10000e3, ispSL: 250, ispVac: 275, eng: 2, minThr: 1, fuel: 'solid', rec: 'none',
    look: { col: '#eceae4', col2: '#9aa0a6', nose: 'cone' } },
    { name: 'Main stage (EPC)', dia: 5.4, len: 30.5, dry: 14700, prop: 170000, tSL: 960e3, tVac: 1390e3, ispSL: 310, ispVac: 432, eng: 1, minThr: 1, fuel: 'hydro', rec: 'none',
      look: { col: '#eceae4', col2: '#3a5f9e', logo: 'ESA' } },
    { name: 'Upper stage (ESC-A) + 2 satellites', dia: 5.4, len: 4.7, dry: 12500, prop: 14900, tSL: 40e3, tVac: 67e3, ispSL: 300, ispVac: 446, eng: 1, minThr: 1, fuel: 'hydro', rec: 'none',
      look: { col: '#eceae4', col2: '#3a5f9e', nose: 'fairing', fairLen: 17, fairDia: 5.4 } }],
  fair: 2400 };
R.shuttle = { name: 'Space Shuttle', maker: 'NASA / Rockwell', year: 1981, country: 'USA', site: 'cape', price: 18000, rank: 3, ang: 2.5,
  blurb: 'A winged spaceplane on the side of a huge orange tank, with two solid boosters. The boosters parachute into the sea, the tank burns up and the orbiter flies to orbit on its three main engines',
  fact: 'The Shuttle flew 135 missions from 1981 to 2011 and built most of the International Space Station.',
  stages: [{ name: '2 solid rocket boosters', n: 2, side: true, solid: true, dia: 3.71, len: 45.5, dry: 180000, prop: 1000000, tSL: 20000e3, tVac: 22200e3, ispSL: 248, ispVac: 275, eng: 2, minThr: 1, fuel: 'solid', rec: 'chute',
    look: { col: '#efefe9', col2: '#24262a', nose: 'cone' } },
    { name: 'External tank (3 RS-25 engines on the orbiter)', dia: 8.4, len: 46.9, dry: 26500, prop: 735000, tSL: 5580e3, tVac: 6837e3, ispSL: 366, ispVac: 452, eng: 3, minThr: .67, fuel: 'hydro', rec: 'none', dropAtCut: true,
      look: { col: '#c8692c', col2: '#a8531f', nose: 'ogive', tank: true } },
    { name: 'Orbiter (OMS engines)', side2: true, dia: 5, len: 37.2, dry: 102000, prop: 10000, tSL: 40e3, tVac: 53.4e3, ispSL: 250, ispVac: 316, eng: 2, minThr: 1, fuel: 'mono', rec: 'none',
      look: { col: '#f2f2ee', col2: '#1a1a1c', nose: 'orbiter' } }],
  fair: 0, gmax: 3 };
R.saturn5 = { name: 'Saturn V', maker: 'NASA / Boeing, North American, Douglas', year: 1967, country: 'USA', site: 'cape', price: 30000, rank: 4, ang: 2,
  blurb: 'The Moon rocket: 111 m tall, five F-1 engines on the first stage burning 13 tonnes of propellant a second. It sent 24 people to the Moon',
  fact: 'Saturn V is still the only rocket that has launched people beyond low Earth orbit (Apollo 8 to 17).',
  stages: [{ name: 'S-IC first stage', dia: 10.1, len: 42, dry: 131000, prop: 2077000, tSL: 34020e3, tVac: 38700e3, ispSL: 263, ispVac: 304, eng: 5, minThr: 1, fuel: 'kero', rec: 'none',
    look: { col: '#f3f3ee', col2: '#121212', pat: 'saturn', fins: 4 } },
    { name: 'S-II second stage', dia: 10.1, len: 24.9, dry: 40000, prop: 444000, tSL: 2430e3, tVac: 5141e3, ispSL: 200, ispVac: 421, eng: 5, minThr: 1, fuel: 'hydro', rec: 'none',
      look: { col: '#f3f3ee', col2: '#121212', band: true } },
    { name: 'S-IVB + Apollo', dia: 6.6, len: 17.8, dry: 58500, prop: 109000, tSL: 500e3, tVac: 1033e3, ispSL: 200, ispVac: 421, eng: 1, minThr: 1, fuel: 'hydro', rec: 'none',
      look: { col: '#f3f3ee', col2: '#121212', nose: 'apollo', taper: 6.6 } }],
  fair: 4000, gmax: 4.5 };
R.sls = { name: 'SLS', maker: 'NASA / Boeing, Northrop Grumman', year: 2022, country: 'USA', site: 'cape', price: 38000, rank: 4, ang: 2.2,
  blurb: 'NASA\'s Space Launch System for Artemis: an orange core with four Shuttle engines and two five-segment solid boosters. It sent Orion around the Moon in 2022',
  fact: 'At liftoff SLS makes 39 MN of thrust, 15% more than the Saturn V.',
  stages: [{ name: '2 five-segment solid boosters', n: 2, side: true, solid: true, dia: 3.71, len: 54, dry: 198000, prop: 1262000, tSL: 23800e3, tVac: 26400e3, ispSL: 242, ispVac: 269, eng: 2, minThr: 1, fuel: 'solid', rec: 'none',
    look: { col: '#efefe9', col2: '#24262a', nose: 'cone' } },
    { name: 'Core stage (4 RS-25)', dia: 8.4, len: 64.6, dry: 85000, prop: 987000, tSL: 7440e3, tVac: 9116e3, ispSL: 366, ispVac: 452, eng: 4, minThr: .67, fuel: 'hydro', rec: 'none',
      look: { col: '#d06a2a', col2: '#a8531f', logo: 'NASA' } },
    { name: 'ICPS + Orion', dia: 5, len: 13.7, dry: 30000, prop: 28500, tSL: 60e3, tVac: 110e3, ispSL: 300, ispVac: 462, eng: 1, minThr: 1, fuel: 'hydro', rec: 'none',
      look: { col: '#e9e9e4', col2: '#d06a2a', nose: 'orion', taper: 5 } }],
  fair: 7400, gmax: 4 };
R.starship = { name: 'Starship', maker: 'SpaceX', year: 2023, country: 'USA', site: 'starbase', price: 50000, rank: 5, ang: 1.6,
  blurb: 'The biggest rocket ever flown: 33 Raptor engines on the Super Heavy booster, which flies back and is caught out of the air by the arms of the launch tower. All of it is meant to be reused',
  fact: 'On Flight 5, in October 2024, the launch tower\'s arms caught a returning Super Heavy booster for the first time.',
  // GUESS: rough Starship V2 numbers. SpaceX changes them flight to flight
  stages: [{ name: 'Super Heavy booster', dia: 9, len: 71, dry: 200000, prop: 3400000, tSL: 74400e3, tVac: 83500e3, ispSL: 327, ispVac: 347, eng: 33, minThr: .4, fuel: 'meth', rec: 'catch',
    land: [13, 3], look: { col: '#c9ccd0', col2: '#8a8f96', gridfins: true, hotring: true, steel: true } },
    { name: 'Ship', dia: 9, len: 52, dry: 120000, prop: 1500000, tSL: 7000e3, tVac: 14700e3, ispSL: 327, ispVac: 365, eng: 6, minThr: .4, fuel: 'meth', rec: 'none',
      look: { col: '#c9ccd0', col2: '#1c1c1e', nose: 'ship', steel: true } }],
  fair: 0, qmax: 36000 };
R.erika = { name: 'Erika Star', maker: 'Erika Air', year: 2026, country: 'Erika', site: 'cape', price: 0, rank: 0, fun: true, music: true, ang: 30,
  blurb: 'A gold rocket that flies to orbit in one stage, and it is free. It plays the Erika song while you fly. Its launches pay no prizes',
  fact: 'The Erika Star needs no staging: just point it up and go.',
  stages: [{ name: 'Erika Star', dia: 5, len: 50, dry: 60000, prop: 540000, tSL: 16000e3, tVac: 17000e3, ispSL: 420, ispVac: 470, eng: 7, minThr: .1, fuel: 'meth', rec: 'none',
    look: { col: '#d4af37', col2: '#10161c', nose: 'ogive', fins: 4, gold: true } }],
  fair: 0, qmax: 35000, gmax: 4 };
const ROCKET_ORDER = ['v2', 'ns', 'electron', 'soyuz', 'f9', 'ariane5', 'shuttle', 'fh', 'saturn5', 'sls', 'starship', 'erika'];
for (const id of ROCKET_ORDER) { const r = R[id]; r.id = id; r.height = 0; r.stages.forEach((s) => { if (!s.side && !s.side2) r.height += s.len; s.n = s.n || 1; }); r.gross = r.stages.reduce((a, s) => a + s.dry + s.prop, 0) + r.fair; r.liftT = r.stages.filter((s, i) => i === 0 || r.stages[i - 1].side).reduce((a, s) => a + s.tSL, 0); }
R.saturn5.height = 110.6; R.sls.height = 98.1; R.shuttle.height = 56.1; R.soyuz.height = 46.3; R.ariane5.height = 52; R.fh.height = 70; R.f9.height = 70; R.electron.height = 18; R.ns.height = 18.6; R.starship.height = 123;

// ------------------------------------------------------------------ missions
// type: 'alt' (reach a height), 'orbit' (a circular orbit at alt km: periapsis at least 0.9 alt), 'gto' (apoapsis 35,786 km),
// 'tli' (park in orbit, then burn for the Moon: apoapsis past 370,000 km), 'test' (Starship flight test: 150 km and 7.2 km/s).
// land: for each stage that comes back, where it lands: 'lz' (a pad near the launch site, s metres downrange), 'ship' (a drone ship
// s metres downrange), 'tower' (caught by the launch tower). reserve: share of the stage's propellant kept for landing.
const MISSIONS = [
  { id: 'v2space', name: 'Reach space', rocket: 'v2', type: 'alt', alt: 100, pay: 600, rank: 0, desc: 'Fly the V-2 straight up past the Kármán line at 100 km.' },
  { id: 'mw18014', name: 'MW 18014', rocket: 'v2', type: 'alt', alt: 170, pay: 900, rank: 0, desc: 'Beat the 1944 record shot: 170 km or higher. Fly straight up and do not waste speed.' },
  { id: 'nsfly', name: 'Tourists to space', rocket: 'ns', type: 'alt', alt: 100, pay: 1400, rank: 0, land: [{ tgt: 'lz', s: 600, entryV: 99999 }], desc: 'Take six people past 100 km, then land the booster on its pad. The capsule comes down on parachutes.' },
  { id: 'elec', name: 'Smallsat to orbit', rocket: 'electron', type: 'orbit', alt: 300, pay: 2000, rank: 1, desc: 'Put a small satellite in a 300 km orbit. The first stage comes down on a parachute.' },
  { id: 'soyuzms', name: 'Crew to the Space Station', rocket: 'soyuz', type: 'orbit', alt: 250, pay: 2600, rank: 1, desc: 'Launch a Soyuz MS crew into a 250 km orbit to chase the ISS. Keep it under 4.3 g for the crew.' },
  { id: 'f9rtls', name: 'Return to launch site', rocket: 'f9', type: 'orbit', alt: 250, pay: 3200, rank: 2, payload: -11000, land: [{ tgt: 'lz', s: 9000, reserve: .19 }], desc: 'A light payload to 250 km, then fly the booster back and land it at Landing Zone 1.' },
  { id: 'f9ship', name: 'Starlink and the drone ship', rocket: 'f9', type: 'orbit', alt: 300, pay: 3800, rank: 2, land: [{ tgt: 'ship', s: 600000, reserve: .08 }], desc: '22 Starlink satellites to 300 km, then land the booster on the drone ship 600 km out in the Atlantic.' },
  { id: 'arianegto', name: 'Two satellites to GTO', rocket: 'ariane5', type: 'gto', alt: 250, pay: 4200, rank: 2, desc: 'Send two big satellites into geostationary transfer orbit: up to 35,786 km at the high point.' },
  { id: 'sts', name: 'Shuttle to orbit', rocket: 'shuttle', type: 'orbit', alt: 300, pay: 5200, rank: 3, desc: 'Fly the orbiter to a 300 km orbit. Keep it under 3 g. The tank drops off before orbit and the OMS engines finish the job.' },
  { id: 'fharabsat', name: 'Three boosters home', rocket: 'fh', type: 'gto', alt: 220, pay: 7000, rank: 3, payload: -2000, land: [{ tgt: 'lz', s: 9000, reserve: .15 }, { tgt: 'ship', s: 1200000, reserve: .2 }], desc: 'A satellite to GTO, both side boosters back to the Cape and the centre core onto the drone ship 1,200 km out.' },
  { id: 'apollo', name: 'Apollo 11', rocket: 'saturn5', type: 'tli', alt: 185, pay: 9000, rank: 4, desc: 'A 185 km parking orbit, then relight the S-IVB and send Apollo to the Moon.' },
  { id: 'artemis', name: 'Artemis I', rocket: 'sls', type: 'tli', alt: 200, pay: 10500, rank: 4, desc: 'Orion to orbit on SLS, then the ICPS burns for the Moon.' },
  { id: 'ift5', name: 'Catch the booster', rocket: 'starship', type: 'test', alt: 150, pay: 13000, rank: 5, land: [{ tgt: 'tower', s: 0, reserve: .13, entryV: 99999 }], desc: 'A Starship flight test: the Ship to 150 km at 7.2 km/s, and the Super Heavy booster back to the tower to be caught by its arms.' },
  { id: 'ssorbit', name: 'Starship to orbit', rocket: 'starship', type: 'orbit', alt: 250, pay: 15000, rank: 5, land: [{ tgt: 'tower', s: 0, reserve: .13, entryV: 99999 }], desc: 'Starship into a full 250 km orbit, and catch the booster.' },
  { id: 'erikafun', name: 'Erika to orbit', rocket: 'erika', type: 'orbit', alt: 400, pay: 0, rank: 0, fun: true, desc: 'The gold Erika Star to a 400 km orbit in one stage. For fun.' },
];
const RANKS = [['Trainee', 0], ['Flight Controller', 600], ['Launch Engineer', 2200], ['Flight Director', 5500], ['Mission Commander', 11000], ['Rocket Legend', 20000]];
// a free launch (not a career mission) for a rocket: the same target as its first mission
function freeMission(rid, target, land) {
  const base = MISSIONS.find((m) => m.rocket === rid) || MISSIONS[0];
  const m = Object.assign({}, base, { id: 'free', name: 'Free launch', pay: 0, free: true });
  if (target) { m.type = target.type; m.alt = target.alt; }
  if (!land) delete m.land;
  return m;
}

// ------------------------------------------------------------------ the flight
// A flight holds every vehicle in the air. The stack starts as one vehicle with all the stages; staging splits it.
function newFlight(rid, mission, opt) {
  opt = opt || {};
  const rk = R[rid], site = SITES[rk.site], lat = site.lat * Math.PI / 180;
  const F = { rk, rid, site, m: mission, t: 0, met: -1, launched: false, wE: OMEGA * Math.cos(lat), th0: Math.PI / 2, vehicles: [], ev: [], nextId: 1,
    prop: rk.stages.map((s) => s.prop), extraDry: rk.stages.map(() => 0), fair: rk.fair > 0, maxQ: 0, maxQAt: 0, maxG: 0, apex: 0, res: null, stats: { landed: [], lost: [] } };
  // a mission can change the payload (lighter for a return-to-launch-site landing)
  if (mission.payload) F.extraDry[rk.stages.length - 1] = mission.payload;
  const v = mkVeh(F, rk.stages.map((s, i) => i), 'stack');
  const up = F.th0; v.x = RE * Math.cos(up); v.y = RE * Math.sin(up); const gv = groundVel(F, v.x, v.y); v.vx = gv[0]; v.vy = gv[1]; v.phi = up; v.onPad = true;
  v.ctrl = true; v.auto = !!opt.auto; F.ctrl = v;
  F.land = {}; (mission.land || []).forEach((l, k) => { const si = landStageIndex(rk, k); if (si >= 0) F.land[si] = l; });
  F.vehicles.push(v);
  return F;
}
// which stage the k-th landing entry is for: the stages that can land, in order
function landStageIndex(rk, k) { let n = -1; for (let i = 0; i < rk.stages.length; i++) if (rk.stages[i].rec === 'land' || rk.stages[i].rec === 'catch') { n++; if (n === k) return i; } return -1; }
function mkVeh(F, stages, role) {
  return { id: F.nextId++, stages, role, x: 0, y: 0, vx: 0, vy: 0, phi: 0, om: 0, thr: 0, eng: false, alive: true, done: null, heat: 0, sas: 'hold', inRot: 0, inThr: 0,
    auto: false, ap: { ph: 'go' }, nEng: 0, legs: false, fins: false, trail: [], q: 0, mach: 0, acc: 0, ign: 0, chute: false, lastBurn: -99 };
}
const S = (F, i) => F.rk.stages[i];
const isBooster = (F, v) => v.role === 'booster';
// the stages that burn now: the bottom stage, plus the next one while the bottom one is strap-on boosters
function burning(F, v) {
  const out = []; if (!v.stages.length) return out;
  let k = 0; out.push(v.stages[0]);
  while (S(F, v.stages[k]).side && k + 1 < v.stages.length) { k++; out.push(v.stages[k]); }
  return out;
}
function mass(F, v) {
  let m = 0; for (const i of v.stages) m += S(F, i).dry + F.extraDry[i] + Math.max(0, F.prop[i]);
  if (F.fair && v.role !== 'booster' && v.stages.indexOf(F.rk.stages.length - 1) >= 0) m += F.rk.fair;
  return m;
}
function groundVel(F, x, y) { return [-F.wE * y, F.wE * x]; }
function alt(v) { return Math.hypot(v.x, v.y) - RE; }
// the launch pad's angle now (the Earth turns), and the downrange distance of a vehicle along the ground from the pad
function padAng(F) { return F.th0 + F.wE * F.t; }
function downrange(F, v) { return wrapPi(Math.atan2(v.y, v.x) - padAng(F)) * RE; }
// orbit from position and velocity: apoapsis / periapsis heights, eccentricity, time to apoapsis
function orbit(x, y, vx, vy) {
  const r = Math.hypot(x, y), v2 = vx * vx + vy * vy, en = v2 / 2 - MU / r, h = x * vy - y * vx;
  const e = Math.sqrt(Math.max(0, 1 + 2 * en * h * h / (MU * MU)));
  const a = -MU / (2 * en), rp = h * h / MU / (1 + e);
  const ra = en < 0 ? a * (1 + e) : Infinity;
  const vr = (x * vx + y * vy) / r;
  let tta = 0;
  if (en < 0 && e > 1e-6) {
    const cosE = clamp((1 - r / a) / e, -1, 1); let E = Math.acos(cosE); if (vr < 0) E = 2 * Math.PI - E;
    const M = E - e * Math.sin(E), n = Math.sqrt(MU / (a * a * a)); tta = (Math.PI - M) / n; if (tta < 0) tta += 2 * Math.PI / n;
  }
  return { apo: ra - RE, peri: rp - RE, e, a, vr, h, tta, period: en < 0 ? 2 * Math.PI * Math.sqrt(a * a * a / MU) : Infinity, en };
}
// engines of a stage in use: a booster coming home can run fewer engines (F9: 3 for boostback and entry, 1 to land)
function stageThrust(F, v, i, u, p) {
  const s = S(F, i); if (F.prop[i] <= 0 || u <= 0) return [0, 0];
  let frac = 1; if (isBooster(F, v) && s.land) frac = (v.nEng || s.eng) / s.eng;
  const T = frac * u * (s.tVac - (s.tVac - s.tSL) * Math.min(1, p / 101325));
  const md = frac * u * s.tVac / (s.ispVac * G0);
  return [Math.max(0, T), md];
}
// the throttle each burning stage actually runs at
function stageThrottle(F, v, i, list) {
  const s = S(F, i);
  if (s.solid) return v.ign ? 1 : 0;
  if (!v.eng || v.thr <= 0) return 0;
  let u = Math.max(s.minThr, v.thr);
  if (s.coreThr && list.length > 1 && list[0] !== i) u *= s.coreThr;
  return u;
}
function thrustInfo(F, v, p) {
  let T = 0, md = 0; const list = burning(F, v), per = [];
  for (const i of list) { const u = stageThrottle(F, v, i, list), r = stageThrust(F, v, i, u, p); T += r[0]; md += r[1]; per.push([i, r[1]]); }
  return { T, md, per, list };
}
function frontArea(F, v) { let a = 0, top = 0; for (const i of v.stages) { const s = S(F, i); if (s.side || s.side2) a += s.n * Math.PI * s.dia * s.dia / 4; else top = Math.max(top, s.dia); } return a + Math.PI * top * top / 4; }
function vehLen(F, v) { let l = 0; for (const i of v.stages) { const s = S(F, i); if (!s.side && !s.side2) l += s.len; } if (!l) l = S(F, v.stages[0]).len; return l; }
function vehDia(F, v) { let d = 0; for (const i of v.stages) d = Math.max(d, S(F, i).dia * (S(F, i).side ? 2 : 1)); return d; }

// forces on a vehicle: gravity, thrust, drag (along the body and across it: tilting a falling booster steers it)
function accel(F, v, x, y, vx, vy, m, T) {
  const r = Math.hypot(x, y), h = r - RE, g = MU / (r * r * r);
  let ax = -g * x, ay = -g * y;
  const dx = Math.cos(v.phi), dy = Math.sin(v.phi);
  ax += T / m * dx; ay += T / m * dy;
  if (h < 140000) {
    const A = atmos(h), gv = groundVel(F, x, y), rx = vx - gv[0], ry = vy - gv[1], sp = Math.hypot(rx, ry);
    if (sp > .01 && A.rho > 0) {
      const M = sp / A.a, ax_ = rx * dx + ry * dy, nx = rx - ax_ * dx, ny = ry - ax_ * dy, nn = Math.hypot(nx, ny);
      const Af = frontArea(F, v), As = vehLen(F, v) * vehDia(F, v) * .8;
      let cda = cdMach(M) * (F.rk.cdMul || 1); if (ax_ < 0) cda = .9 + (v.fins ? .3 : 0); if (v.chute) cda = 1.5;   // tail first: blunt engines (and grid fins); parachutes
      const chA = v.chute ? Math.max(Af * 30, 300, m / 30) : Af;   // big boosters carry big parachutes
      const k = .5 * A.rho / m;
      if (v.chute) { ax -= k * cda * chA * sp * rx; ay -= k * cda * chA * sp * ry; }   // a parachute pulls straight against the airflow
      else { ax -= k * cda * chA * Math.abs(ax_) * ax_ * dx; ay -= k * cda * chA * Math.abs(ax_) * ax_ * dy; }
      ax -= k * 1.1 * As * nn * nx; ay -= k * 1.1 * As * nn * ny;
      const cna = v.chute ? 0 : 2 + (v.fins ? 2.5 : 0);   // slender-body lift (and grid fins): a small tilt gives a sideways push
      ax -= k * cna * Af * sp * nx; ay -= k * cna * Af * sp * ny;
    }
  }
  return [ax, ay];
}

// one physics step for one vehicle
function stepVeh(F, v, dt) {
  if (!v.alive || v.done) return;
  const h = alt(v), A = atmos(Math.max(0, h));
  if (v.onPad) {   // held on the pad (or on a landing pad, or in the tower arms): moves with the ground
    const up = Math.atan2(v.y, v.x) + F.wE * dt, r = Math.hypot(v.x, v.y); v.x = r * Math.cos(up); v.y = r * Math.sin(up); const gv = groundVel(F, v.x, v.y); v.vx = gv[0]; v.vy = gv[1]; v.phi += F.wE * dt;
    const ti = thrustInfo(F, v, A.p), m = mass(F, v);
    if (!F.launched || v.done) return;
    if (ti.T > m * G0 * 1.0 && v.role === 'stack') { v.onPad = false; F.met = 0; F.liftoff = F.t; event(F, 'Liftoff', 'big'); }
    else { burnProp(F, ti, dt); return; }
  }
  rotate(F, v, dt);
  const ti = thrustInfo(F, v, A.p), m = mass(F, v);
  // integrate (semi-implicit Euler: stable and cheap at small steps)
  const a = accel(F, v, v.x, v.y, v.vx, v.vy, m, ti.T);
  v.vx += a[0] * dt; v.vy += a[1] * dt; v.x += v.vx * dt; v.y += v.vy * dt;
  burnProp(F, ti, dt);
  if (ti.T > 0) v.lastBurn = F.t;
  // what the crew feels
  const gr = MU / Math.pow(Math.hypot(v.x, v.y), 3);
  v.acc = Math.hypot(a[0] + gr * v.x, a[1] + gr * v.y) / G0;
  const gv = groundVel(F, v.x, v.y), rx = v.vx - gv[0], ry = v.vy - gv[1], sp = Math.hypot(rx, ry);
  v.q = .5 * A.rho * sp * sp; v.mach = sp / A.a; v.spd = sp;
  if (v.role === 'stack' || v.role === 'upper') { if (v.q > F.maxQ) { F.maxQ = v.q; F.maxQAt = F.met; } if (v.acc > F.maxG && F.met > 1) F.maxG = v.acc; }
  // flying sideways through thick air breaks a rocket up; coming in too fast burns it
  let aoa = 0;
  if (sp > 30) { const c = (rx * Math.cos(v.phi) + ry * Math.sin(v.phi)) / sp; aoa = Math.acos(clamp(Math.abs(c), 0, 1)) * 180 / Math.PI; }
  v.aoa = aoa;
  if (!v.chute && (v.role !== 'booster' || F.land[v.stages[0]] !== undefined) && v.q > 9000 && aoa > 14 && v.q * aoa > 2.2e5) return destroy(F, v, 'Broke up: it turned too far from its flight path in thick air (' + Math.round(v.q / 1000) + ' kPa)');
  const landing = v.role === 'booster' && F.land[v.stages[0]] !== undefined;
  if (h < 90000 && sp > 400 && !v.chute && (rx * v.x + ry * v.y) < 0) {
    const rate = .8e-9 * Math.sqrt(A.rho) * sp * sp * sp;
    v.heat = Math.max(0, v.heat + (rate - .5) * dt);
    if (v.heat > 4 && landing) return destroy(F, v, 'Burned up on the way down: too fast in the air. Do an entry burn to slow down first');
  } else v.heat = Math.max(0, v.heat - .35 * dt);
  // parachutes: boosters and capsules that use them open below 6 km on the way down
  const s0 = S(F, v.stages[0]);
  const chuter = (v.role === 'booster' && s0.rec === 'chute') || (v.role === 'capsule');
  if (chuter && !v.chute && h < 6000 && (v.x * v.vx + v.y * v.vy) < 0) { v.chute = true; if (v.role === 'capsule') event(F, 'Parachutes out', 'info', v); }
  if (h > F.apex && v.role !== 'booster') F.apex = h;
  if (h <= 0 && (rx * v.x + ry * v.y) < 0) touchdown(F, v, rx, ry);
  else if (h < 0) { const k = RE / Math.hypot(v.x, v.y); v.x *= k; v.y *= k; }
}
function burnProp(F, ti, dt) { for (const [i, md] of ti.per) F.prop[i] = Math.max(0, F.prop[i] - md * dt); }
// turning: the player's stick, or the holding / pointing modes (SAS) and the autopilot
function rotate(F, v, dt) {
  const len = vehLen(F, v), wmax = (isBooster(F, v) ? 9 : clamp(F.rk.ang || 5, 1, 30)) * Math.PI / 180 * (v.chute ? 0 : 1);
  let target = null;
  if (v.inRot) { v.sas = v.sas === 'hold' ? 'hold' : v.sas; v.holdPhi = null; }
  if (v.apPhi != null && v.auto) target = v.apPhi;
  else if (!v.inRot) {
    const gv = groundVel(F, v.x, v.y), h = alt(v), rx = v.vx - (h < 60000 ? gv[0] : 0), ry = v.vy - (h < 60000 ? gv[1] : 0), sp = Math.hypot(rx, ry);
    if (v.sas === 'pro' && sp > 5) target = Math.atan2(ry, rx);
    else if (v.sas === 'retro' && sp > 5) target = Math.atan2(-ry, -rx);
    else if (v.sas === 'up') target = Math.atan2(v.y, v.x);
    else if (v.sas === 'hold') { if (v.holdPhi == null) v.holdPhi = v.phi; target = v.holdPhi; }
  }
  let wcmd;
  if (v.inRot && !(v.auto && v.apPhi != null)) wcmd = -v.inRot * wmax;   // right turns the nose clockwise (downrange, with the camera on the north side)
  else if (target != null) { const d = wrapPi(target - v.phi); wcmd = clamp(d * 1.6, -wmax, wmax); if (Math.abs(d) < .0005) wcmd = d / Math.max(dt, .001) * .5; }
  else wcmd = 0;
  const amax = wmax * 2.2; v.om += clamp(wcmd - v.om, -amax * dt, amax * dt);
  v.phi += v.om * dt;
  if (v.inRot) v.holdPhi = v.phi;
}
function destroy(F, v, why) { v.alive = false; v.done = 'lost'; v.why = why; event(F, vname(F, v) + ': ' + why, 'bad', v); F.stats.lost.push(v.id); }
function vname(F, v) {
  if (v.role === 'stack') return F.rk.name; if (v.role === 'capsule') return 'Capsule';
  const s = S(F, v.stages[0]); if (v.role === 'booster') return s.name.replace(/^2 /, '').replace(/^4 /, ''); return s.name.split(' + ')[0];
}
// hitting the ground: a landing, a catch, a splashdown or a crash
function touchdown(F, v, rx, ry) {
  const r = Math.hypot(v.x, v.y), ux = v.x / r, uy = v.y / r, vr = rx * ux + ry * uy, vh = -rx * uy + ry * ux;
  const tilt = Math.abs(wrapPi(v.phi - Math.atan2(v.y, v.x))) * 180 / Math.PI;
  const s = downrange(F, v), si = v.stages[0], L = F.land[si];
  const site = F.site, onLand = s < site.coast;
  v.x = ux * RE; v.y = uy * RE;
  const gentle = Math.abs(vr) < 6 && Math.abs(vh) < 3 && tilt < 10, soft = Math.abs(vr) < 12;
  v.touch = { vr, vh, tilt, s };
  const stick = () => { v.onPad = true; v.eng = false; v.thr = 0; v.om = 0; };
  if (v.chute || v.role === 'capsule') {
    if (Math.abs(vr) < (onLand ? 15 : 30)) { v.done = onLand && v.role === 'capsule' ? 'landed' : 'recovered'; stick(); event(F, vname(F, v) + (v.role === 'capsule' ? ' landed in the desert under parachutes' : ' splashed down under parachutes: recovered from the sea'), 'good', v); if (v.role !== 'capsule') F.stats.landed.push(v.id); return; }
    return destroy(F, v, 'Hit the ground too fast');
  }
  if (v.role === 'booster' && L && (S(F, si).rec === 'land' || S(F, si).rec === 'catch')) {
    const d = s - L.s, padR = L.tgt === 'ship' ? 26 : L.tgt === 'tower' ? 20 : 45;   // GUESS: the tower arms can swing about 20 m to meet the booster
    if (Math.abs(d) <= padR && gentle) {
      v.done = 'landed'; stick(); v.landErr = d; F.stats.landed.push(v.id);
      if (L.tgt === 'tower') { const a = Math.atan2(v.y, v.x) - d / RE, r = Math.hypot(v.x, v.y); v.x = r * Math.cos(a); v.y = r * Math.sin(a); }   // the arms pull it in
      event(F, L.tgt === 'tower' ? 'Booster caught by the tower arms!' : L.tgt === 'ship' ? vname(F, v) + ' landed on the drone ship!' : vname(F, v) + ' landed at the landing zone!', 'good', v);
      return;
    }
    if (L.tgt === 'tower' && Math.abs(d) <= 60 && gentle) { return destroy(F, v, 'Missed the tower arms by ' + Math.round(Math.abs(d)) + ' m'); }
    if (gentle && onLand && L.tgt !== 'ship') { v.done = 'off'; stick(); event(F, vname(F, v) + ' landed, but ' + Math.round(Math.abs(d)) + ' m from the pad', 'info', v); return; }
    if (L.tgt === 'ship' && Math.abs(d) <= 60 && gentle) return destroy(F, v, 'Landed in the sea, ' + Math.round(Math.abs(d)) + ' m from the drone ship');
    if (!onLand && soft) return destroy(F, v, 'Came down in the sea, ' + fmtKm(Math.abs(d)) + ' from the ' + (L.tgt === 'ship' ? 'drone ship' : 'pad'));
    return destroy(F, v, 'Hit the ' + (onLand ? 'ground' : 'sea') + ' at ' + Math.round(Math.hypot(vr, vh)) + ' m/s' + (Math.abs(d) < 2000 ? '' : ', ' + fmtKm(Math.abs(d)) + ' from the pad'));
  }
  if (v.role === 'booster' && !onLand) { v.alive = false; v.done = 'sea'; event(F, vname(F, v) + ' fell into the sea, as planned', 'info', v); return; }
  if (v.role === 'booster') { v.alive = false; v.done = 'ground'; event(F, vname(F, v) + ' hit the ground downrange', 'info', v); return; }
  if (gentle && F.met > 5) { v.done = 'landed'; stick(); event(F, vname(F, v) + ' landed', 'good', v); return; }
  destroy(F, v, F.met < 3 ? 'Fell back onto the pad' : 'Hit the ' + (onLand ? 'ground' : 'sea'));
}
const fmtKm = (m) => m >= 1000 ? (m / 1000).toFixed(m < 10000 ? 1 : 0) + ' km' : Math.round(m) + ' m';
function event(F, text, kind, v) { F.ev.push({ t: F.met, text, kind: kind || 'info', vid: v ? v.id : 0 }); if (F.onEvent) F.onEvent(F.ev[F.ev.length - 1]); }

// staging: drop the bottom stage of a vehicle (strap-on boosters first). Returns the dropped vehicle.
function stage(F, v) {
  if (!v || !v.alive || v.done || v.stages.length < 2) return null;
  const i = v.stages[0], s = S(F, i);
  if (s.solid && F.prop[i] > s.prop * .02) { event(F, 'Wait: the solid boosters are still burning. Solids cannot be stopped', 'warn', v); return null; }
  const dropped = mkVeh(F, [i], 'booster');
  Object.assign(dropped, { x: v.x, y: v.y, vx: v.vx, vy: v.vy, phi: v.phi, om: 0, eng: false, thr: 0 });
  v.stages = v.stages.slice(1);
  const nx = -Math.sin(v.phi), ny = Math.cos(v.phi);
  if (s.side) { dropped.vx += nx * 4; dropped.vy += ny * 4; dropped.om = .05; }
  else { dropped.vx -= Math.cos(v.phi) * 2; dropped.vy -= Math.sin(v.phi) * 2; v.vx += Math.cos(v.phi) * 1; v.vy += Math.sin(v.phi) * 1; }
  if (s.rec === 'land' || s.rec === 'catch') { dropped.nEng = (s.land && s.land[0]) || 1; dropped.fins = true; }
  dropped.sepAt = F.t;
  // what is left: the upper stage lights now (a strap-on drop leaves the core running)
  if (!s.side) { v.ign = 1; v.eng = true; if (v.thr <= 0) v.thr = 1; }
  // the capsule of New Shepard has no engine
  const top = S(F, v.stages[0]);
  if (v.stages.length === 1 && top.tVac === 0) v.role = 'capsule';
  else v.role = v.stages.length === 1 ? 'upper' : v.role === 'stack' && !s.side ? 'upper' : v.role;
  F.vehicles.push(dropped);
  event(F, s.side ? (s.n === 4 ? 'Booster separation: the Korolev cross' : 'Booster separation') : 'Stage separation', 'big', v);
  if (!s.side && S(F, v.stages[0]).tVac > 0) event(F, S(F, v.stages[0]).name.split(' + ')[0] + ' ignition', 'info', v);
  if (F.land[i]) dropped.auto = true;   // until the player takes it over, a booster that can land flies itself home
  return dropped;
}
function jettisonFairing(F) { if (!F.fair) return; F.fair = false; event(F, F.rk.id === 'soyuz' || F.rk.id === 'saturn5' || F.rk.id === 'sls' ? 'Escape tower and fairing jettisoned' : 'Fairing separation', 'info'); }

// ------------------------------------------------------------------ prediction: where a falling vehicle hits the ground
function predictImpact(F, v, maxT, opt) {
  opt = opt || {}; const off = opt.off || 0, entry = !!opt.entry, landB = !!opt.land;
  maxT = maxT || 900; const o = { x: v.x, y: v.y, vx: v.vx, vy: v.vy, phi: v.phi, stages: v.stages, role: v.role, fins: v.fins, chute: v.chute, nEng: v.nEng };
  let t = 0, m = mass(F, v), p = F.prop[v.stages[0]], burnt = !entry, lit = !!opt.sp0, landing = false, sp0 = opt.sp0 || 0;
  const s = S(F, v.stages[0]), L = F.land[v.stages[0]] || {}, eV = L.entryV || 650;
  const thr = (n, h, u) => { const save = F.prop[v.stages[0]]; F.prop[v.stages[0]] = Math.max(1, p); const ti = thrustInfo(F, Object.assign({}, v, { eng: true, thr: u, nEng: n }), atmos(Math.max(0, h)).p); F.prop[v.stages[0]] = save; return ti; };
  // boosters fall retrograde (engines first); with entry, it also flies the planned entry burn and landing burn
  while (t < maxT) {
    const r = Math.hypot(o.x, o.y), h = r - RE; if (h <= 0) break;
    const gv = groundVel(F, o.x, o.y), rx = o.vx - gv[0], ry = o.vy - gv[1], sp = Math.hypot(rx, ry), vr = (rx * o.x + ry * o.y) / r;
    if (landing && vr > -2) break;   // the landing burn has stopped it: this is where it lands
    o.phi = Math.atan2(-ry, -rx) + (h < 45000 && (opt.offAll || !landing) ? off : 0);
    let T = 0, dt = h > 100000 ? 2 : h > 30000 ? .8 : h > 3000 ? .4 : .15;
    if (!burnt && vr < 0 && h < (sp > 1800 ? 85000 : 70000) && h > 20000 && sp > Math.max(eV, lit ? sp0 - 1100 : 0) && p > m * .14) {
      if (!lit) sp0 = sp; dt = .2; lit = true; const ti = thr((s.land && s.land[0]) || 1, h, 1); T = ti.T; m -= ti.md * dt; p -= ti.md * dt;
    } else if (!burnt && ((lit && sp < Math.max(eV - 200, sp0 - 1100)) || h < 20000) && vr < 0) burnt = true;
    if (landB && s.land && vr < 0 && h < 40000) {
      const n = s.land[1] || 1, ti = thr(n, h, 1), A = atmos(h), aMax = ti.T / m, g = MU / (r * r);
      const aDrag = .5 * A.rho * sp * sp * 1.2 * frontArea(F, o) / m * .7, vv = -vr;
      if (landing || vv * vv / (2 * Math.max(.5, aMax * .8 - g + aDrag)) + vv * .5 + 10 > h) { landing = true; dt = .15; const t2 = thr(n, h, .8); T = t2.T; m -= t2.md * dt; p -= t2.md * dt; }
    }
    const a = accel(F, o, o.x, o.y, o.vx, o.vy, m, T);
    o.vx += a[0] * dt; o.vy += a[1] * dt; o.x += o.vx * dt; o.y += o.vy * dt; t += dt;
  }
  const th = Math.atan2(o.y, o.x), pad = F.th0 + F.wE * (F.t + t);
  return { s: wrapPi(th - pad) * RE, t, hit: t < maxT };
}

// ------------------------------------------------------------------ autopilots
// Ascent: straight up, a gentle pitch-over that follows the flight path while the air is thick, then an altitude-holding
// guidance that builds orbital speed. It stages when a stage is empty and keeps landing propellant in boosters that come back.
function apAscent(F, v, dt) {
  const M = F.m, h = alt(v), r = Math.hypot(v.x, v.y), th = Math.atan2(v.y, v.x);
  const gv = groundVel(F, v.x, v.y), rx = v.vx - gv[0], ry = v.vy - gv[1], sp = Math.hypot(rx, ry);
  const o = orbit(v.x, v.y, v.vx, v.vy), ap = v.ap;
  const pitchToPhi = (p) => th + Math.PI / 2 - p * Math.PI / 180;
  const ti = thrustInfo(F, v, atmos(Math.max(0, h)).p), m = mass(F, v);
  if (!F.launched) return;
  v.eng = true; v.ign = 1;
  let thr = 1, pitch = 90;
  const tgt = (M.alt || 200) * 1000;
  const list = burning(F, v), bot = list[0], s0 = S(F, bot);
  // throttle: keep under the g limit and Max Q limit
  const gmax = F.rk.gmax || 6;
  if (ti.T > 0) { const amax = gmax * G0 * m; if (ti.T > amax) thr = clamp(v.thr * amax / ti.T, 0, 1); else if (v.thr < 1) thr = Math.min(1, v.thr * 1.02 + .01); }
  if (F.rk.qmax && v.q > F.rk.qmax * .9 && h < 20000) thr = Math.min(thr, .72);
  const fpa = Math.atan2(rx * Math.cos(th) + ry * Math.sin(th), -rx * Math.sin(th) + ry * Math.cos(th)) * 180 / Math.PI;   // surface flight path angle
  if (M.type === 'alt') {
    pitch = F.rid === 'v2' ? 89.6 : 89.93;
    if (o.apo > tgt * 1.08 + 3000 && F.land[v.stages[0]] !== undefined) thr = 0;   // New Shepard: cut, keep the rest to land
    if (v.stages.length > 1 && thr === 0) { v.eng = false; v.thr = 0; if (!ap.sepT) ap.sepT = F.t + 3; if (F.t > ap.sepT) stage(F, v); }
  } else {
    const turnH = F.rk.turnH || 110000;
    // hold a height and build speed: the pitch that gives the vertical acceleration we want
    const hold = (hp) => {
      const vr = o.vr, vh = Math.abs(o.h / r), aT = ti.T / m;
      const vrDes = clamp((hp - h) / 60, -150, 400), arDes = (vrDes - vr) / 12, need = arDes + MU / (r * r) - vh * vh / r;
      return aT > .05 ? Math.max(-8, Math.min(60, Math.asin(clamp(need / aT, -.25, .95)) * 180 / Math.PI)) : 0;
    };
    const park = M.type === 'gto' || M.type === 'tli' ? (M.alt || 200) * 1000 : tgt;
    const horiz = () => 90 - wrapPi(Math.atan2(v.vy, v.vx) - th) * 180 / Math.PI;   // along the orbit (prograde)
    if (!ap.ph || ap.ph === 'go') ap.ph = 'asc';
    if (h < 400 || sp < 50) pitch = 90;
    else {
      const prof = 90 - 88 * Math.pow(clamp((h - 400) / turnH, 0, 1), .5);
      const allow = v.q > 15000 ? 1.5 : v.q > 4000 ? 3 : 8;
      pitch = clamp(prof, fpa - allow, fpa + allow);
      if (h > 35000 && v.q < 2000) { pitch = Math.min(Math.max(prof, 45), hold(park)); if (v.q > 1500) pitch = clamp(pitch, fpa - 6, fpa + 6); }
    }
    const inOrbit = o.peri >= Math.min(park * .96, o.apo - 3000) && o.peri > 140000;
    if (ap.ph === 'asc') {
      if (M.type === 'test' && o.apo >= 145000 && Math.hypot(v.vx, v.vy) >= 7300) { thr = 0; ap.ph = 'done'; }
      else if ((M.type === 'gto') && inOrbit) ap.ph = 'raise';
      else if (inOrbit) { thr = 0; ap.ph = M.type === 'tli' ? 'park' : 'done'; }
      else if (o.apo >= park && h > 70000 && h < park - 15000 && o.vr > 0 && M.type !== 'test') {
        const ra = o.apo + RE, dvc = Math.max(0, Math.sqrt(MU / ra) - Math.abs(o.h) / ra), drop = !!S(F, bot).dropAtCut && v.stages.length > 1;
        if (dvc < dvLeft(F, v, drop) * .8) { thr = 0; ap.ph = 'coast'; ap.cutDrop = drop; }
      }
    }
    if (ap.ph === 'coast') {
      thr = 0; pitch = horiz();
      if (ap.cutDrop && v.stages.length > 1) { ap.cutDrop = false; stage(F, v); return; }
      const ra = o.apo + RE, vAp = Math.abs(o.h) / ra, dv = Math.max(0, Math.sqrt(MU / ra) - vAp);
      const aT = thrustInfo(F, Object.assign({}, v, { eng: true, thr: 1 }), 0).T / m, tb = dv / Math.max(aT, .01);
      if (o.tta < tb / 2 + 2 || o.vr < 0) ap.ph = 'circ';
    }
    if (ap.ph === 'circ') {
      pitch = clamp(horiz() + clamp(-o.vr * .25, -12, 25), -15, 40);
      if (inOrbit || (o.peri > 150000 && o.apo > park * 1.25)) { thr = 0; ap.ph = M.type === 'tli' ? 'park' : M.type === 'gto' ? 'raise' : 'done'; }
    }
    if (ap.ph === 'raise') { pitch = hold(park); if (o.apo >= 35786e3) { thr = 0; ap.ph = 'done'; } }
    if (ap.ph === 'park') { thr = 0; pitch = horiz(); ap.ph = 'parkc'; ap.coastT = F.t + (F.fast ? 300 : 900); event(F, 'Parking orbit: coast, then the burn for the Moon', 'info', v); }
    if (ap.ph === 'parkc') { thr = 0; pitch = horiz(); if (F.t > ap.coastT) { ap.ph = 'tli'; event(F, 'Trans-lunar injection burn', 'big', v); } }
    if (ap.ph === 'tli') { pitch = horiz(); if (o.apo >= 380e6 || o.en > 0) { thr = 0; ap.ph = 'done'; } }
    if (ap.ph === 'done') thr = 0;
    // a booster that lands keeps its reserve: cut, then separate
    const L = F.land[bot];
    if (L && !s0.side && F.prop[bot] <= s0.prop * (L.reserve || .1) && v.stages.length > 1 && !ap.meco && !ap.mecoDone) { ap.meco = F.t; ap.mecoDone = true; event(F, 'MECO: main engine cut-off', 'big', v); }
    if (L && s0.side && F.prop[bot] <= s0.prop * (L.reserve || .1) && v.stages.length > 1) { event(F, 'BECO: booster engine cut-off', 'big', v); stage(F, v); return; }
    if (ap.meco) { thr = 0; if (F.t - ap.meco > (F.rid === 'starship' ? .5 : 2.5)) { ap.meco = 0; stage(F, v); return; } }
  }
  // empty stage: separate (hot staging on Starship: no gap)
  if (v.stages.length > 1 && F.prop[bot] <= 1 && !ap.meco && (thr > 0 || ap.ph === 'asc' || ap.ph === 'raise' || ap.ph === 'circ' || ap.ph === 'tli')) { stage(F, v); return; }
  if (F.fair && h > 110000) jettisonFairing(F);
  v.apPhi = pitchToPhi(pitch);
  v.thr = thr; if (thr <= 0) v.eng = false;
}
// how much speed the vehicle can still gain (rocket equation, stage by stage). skipBottom: the bottom stage is dropped first
function dvLeft(F, v, skipBottom) {
  let m = mass(F, v), dv = 0;
  v.stages.forEach((i, k) => {
    const s = S(F, i);
    if (k === 0 && skipBottom) { m -= s.dry + F.extraDry[i] + F.prop[i]; return; }
    if (s.side) { m -= s.dry + F.prop[i]; return; }
    if (s.tVac > 0 && F.prop[i] > 0) dv += s.ispVac * G0 * Math.log(m / (m - F.prop[i]));
    m -= F.prop[i] + s.dry + F.extraDry[i];
  });
  return dv;
}
// Booster coming home: flip, boostback burn, entry burn, steer with the fins, landing burn (a "hoverslam")
function apBooster(F, v, dt) {
  const L = F.land[v.stages[0]]; if (!L) { v.apPhi = null; return; }
  const s = S(F, v.stages[0]), ap = v.ap, h = alt(v), r = Math.hypot(v.x, v.y), th = Math.atan2(v.y, v.x);
  const gv = groundVel(F, v.x, v.y), rx = v.vx - gv[0], ry = v.vy - gv[1], sp = Math.hypot(rx, ry);
  const ux = v.x / r, uy = v.y / r, vr = rx * ux + ry * uy, vh = -rx * uy + ry * ux, retro = Math.atan2(-ry, -rx);
  const sNow = downrange(F, v);
  if (!ap.pt || F.t - ap.pt > .3) {
    const po = { entry: !ap.entryDone, sp0: ap.ph === 'entry' ? ap.sp0 : 0, land: true };
    ap.pred = predictImpact(F, v, 1200, po); ap.pt = F.t;
    // below 45 km: how much does leaning off retrograde move the landing point? (the air and the engine push opposite ways)
    if ((ap.ph === 'glide' || ap.ph === 'land') && alt(v) < 45000 && alt(v) > 150) { const d = .04, p1 = predictImpact(F, v, 1200, Object.assign({ off: d, offAll: ap.ph === 'land' }, po)); ap.gain = (p1.s - ap.pred.s) / d; } else ap.gain = 0;
  }
  const err = ap.pred.s - L.s;   // + : going to land beyond the pad
  const A = atmos(Math.max(0, h)), m = mass(F, v);
  if (F.t - (v.sepAt || 0) < 3) { v.eng = false; v.thr = 0; v.apPhi = v.phi; return; }
  if (!ap.ph || ap.ph === 'go') ap.ph = (Math.abs(err) > 1500 && vr > -300 && h > 30000) ? 'flip' : 'coast';
  const engs = (n) => { v.nEng = Math.min(n, s.eng); };
  if (ap.ph === 'flip' || ap.ph === 'boost') {
    // point along the ground towards the pad (a little up), burn until the impact point is on the pad
    const dir = err > 0 ? -1 : 1, want = th + Math.PI / 2 * dir + (dir > 0 ? -.12 : .12);
    v.apPhi = want; engs(s.land[0]);
    const aligned = Math.abs(wrapPi(v.phi - want)) < .1;
    if (aligned) { ap.ph = 'boost'; v.eng = true; v.thr = Math.abs(err) < 3000 ? .45 : 1; }
    if (ap.ph === 'boost' && (Math.abs(err) < 60 || (ap.lastErr != null && Math.sign(err) !== Math.sign(ap.lastErr)))) { v.eng = false; v.thr = 0; ap.ph = 'coast'; event(F, vname(F, v) + ': boostback burn done', 'info', v); }
    ap.lastErr = err;
    if (F.prop[v.stages[0]] < s.dry * (F.rid === 'starship' ? .45 : .35)) { v.eng = false; v.thr = 0; ap.ph = 'coast'; }
    return;
  }
  // tail first from here on: engines point down the flight path
  const desc = vr < 0;
  if (ap.ph === 'coast' && h > 72000 && Math.abs(err) > 250 && F.prop[v.stages[0]] > s.dry * .3 && F.t - (ap.trimEnd || 0) > 2) ap.ph = 'trim';
  if (ap.ph === 'trim') {
    // a small correction in space: one engine at low throttle, along the ground towards the target
    const dir = err > 0 ? -1 : 1, want = th + Math.PI / 2 * dir; v.apPhi = want; engs(1);
    if (Math.abs(wrapPi(v.phi - want)) < .08) { v.eng = true; v.thr = s.minThr; } else { v.eng = false; v.thr = 0; }
    if (Math.abs(err) < 60 || h < 72000 || F.prop[v.stages[0]] < s.dry * .25 || (ap.lastErr != null && Math.sign(err) !== Math.sign(ap.lastErr) && v.eng)) { v.eng = false; v.thr = 0; ap.ph = 'coast'; ap.trimEnd = F.t; }
    ap.lastErr = err;
    return;
  }
  if (ap.ph === 'coast') {
    v.eng = false; v.thr = 0; v.apPhi = desc || sp > 50 ? retro : th; engs(s.land[0]);
    if (desc && h < (sp > 1800 ? 85000 : 70000) && h > 25000 && sp > (L.entryV || 650) && !ap.entryDone && F.prop[v.stages[0]] > m * .14) { ap.ph = 'entry'; ap.sp0 = sp; event(F, vname(F, v) + ': entry burn', 'info', v); }
    else if (desc && h < 40000) { ap.ph = 'glide'; v.legs = false; }
    return;
  }
  if (ap.ph === 'entry') {
    v.apPhi = retro; engs(s.land[0]); v.eng = true; v.thr = 1;
    if (sp < Math.max((L.entryV || 650) - 200, (ap.sp0 || 0) - 750) || h < 20000 || F.prop[v.stages[0]] < m * .12) { v.eng = false; v.thr = 0; ap.ph = 'glide'; ap.entryDone = true; }
    return;
  }
  // glide: steer with the body (and grid fins), then light the landing engines at the last moment
  const nL = s.land[1] || 1; engs(nL);
  const ti = (function () { const save = v.thr, se = v.eng; v.thr = 1; v.eng = true; const t = thrustInfo(F, v, A.p); v.thr = save; v.eng = se; return t; })();
  const g = MU / (r * r), aMax = ti.T / m;
  const dPos = sNow - L.s;
  if (ap.ph === 'glide') {
    v.eng = false; v.thr = 0;
    // aero steering: lean the nose away from retrograde towards where we would overshoot; the cross-flow pushes the other way
    const lim = Math.min(h > 8000 ? .14 : h > 2000 ? .1 : .04, Math.min(10, 1.2e5 / Math.max(v.q, 1)) * Math.PI / 180);
    v.apPhi = retro + (Math.abs(ap.gain) > 50 ? clamp(-err / ap.gain, -lim, lim) : clamp(err / 600, -1, 1) * lim);
    if (h < 3000) v.legs = true;
    // light the engines when a burn at 80% would just stop us at the ground
    const hIgn = ap.igT && F.t - ap.igT < .15 ? ap.hIgnLast : (ap.igT = F.t, ap.hIgnLast = burnMargin(F, v, .8));
    if (hIgn < 25 || h < 40) { ap.ph = 'land'; event(F, vname(F, v) + ': landing burn', 'info', v); }
    return;
  }
  if (ap.ph === 'land') {
    v.legs = true;
    const vv = -vr, hEff = Math.max(.3, h - .3);
    const aV = (vv * vv - 1.0) / (2 * hEff) + g;   // vertical: arrive at about 1 m/s
    const tgo = clamp(2 * hEff / Math.max(vv, 1), .8, 40);
    // sideways: zero-effort-miss guidance onto the pad, with the tilt limited near the ground
    let tiltMax = h > 400 ? .25 : h > 80 ? .18 : h > 15 ? .09 : .03;
    if (sp > 60) tiltMax = Math.min(tiltMax, Math.min(10, 1.2e5 / Math.max(v.q, 1)) * Math.PI / 180);
    const aHmax = Math.abs(aV) * Math.tan(tiltMax), dPosC = clamp(dPos, -.3 * aHmax * tgo * tgo, .3 * aHmax * tgo * tgo);
    let aH = h < 50 ? (-3 * dPosC - 3 * vh * tgo) / (tgo * tgo) : (-6 * dPosC - 4 * vh * tgo) / (tgo * tgo);
    aH = clamp(aH, -Math.abs(aV) * Math.tan(tiltMax), Math.abs(aV) * Math.tan(tiltMax));
    const tilt = Math.atan2(aH, Math.max(aV, .1));
    // far from vertical speed is still big: keep the nose near retrograde so the air does not break it
    // thick air: stay within a few degrees of retrograde or it breaks up
    let want = th + tilt;
    if (sp > 40) { const amax = Math.min(10, 1.2e5 / Math.max(v.q, 1)) * Math.PI / 180, d = wrapPi(want - retro); want = retro + clamp(d, -amax, amax); }
    // high up: steer by the predicted landing point (it flies the rest of the burn in the prediction), leaning the thrust off retrograde
    if (h > 3000 && sp > 25 && Math.abs(ap.gain) > 20) { const amax = Math.min(12, 1.4e5 / Math.max(v.q, 1)) * Math.PI / 180; want = retro + clamp(-err / ap.gain, -amax, amax); }
    v.apPhi = want;
    const tw = Math.hypot(aV, aH) / Math.max(aMax, .1);
    v.eng = true; v.thr = clamp(tw, 0, 1);
    if (tw < s.minThr * .85 && vv < 2.5 && h < 3) { v.eng = false; v.thr = 0; }
    if (vv < -.5) { v.eng = false; v.thr = 0; }   // going up again (the lowest throttle is more than the weight): drop back
  }
}
// If the landing engines lit now at this throttle (pointing retrograde), how high would the booster be when it stops falling?
// Negative: it would hit the ground still falling. Used to light the landing burn at the last moment.
function burnMargin(F, v, frac) {
  const o = { x: v.x, y: v.y, vx: v.vx, vy: v.vy, phi: v.phi, stages: v.stages, role: v.role, fins: v.fins, chute: false, nEng: v.nEng };
  let m = mass(F, v), t = 0; const p0 = F.prop[v.stages[0]]; let p = p0;
  while (t < 120) {
    const r = Math.hypot(o.x, o.y), h = r - RE, A = atmos(Math.max(0, h));
    const gv = groundVel(F, o.x, o.y), rx = o.vx - gv[0], ry = o.vy - gv[1], vr = (rx * o.x + ry * o.y) / r;
    if (vr >= 0) return h;
    if (h <= 0) return h - (-vr) * 2;
    o.phi = Math.atan2(-ry, -rx);
    const save = F.prop[v.stages[0]]; F.prop[v.stages[0]] = Math.max(1, p);
    const ve = Object.assign({}, v, { eng: true, thr: frac }), ti = thrustInfo(F, ve, A.p); F.prop[v.stages[0]] = save;
    const dt = .1, a = accel(F, o, o.x, o.y, o.vx, o.vy, m, ti.T);
    o.vx += a[0] * dt; o.vy += a[1] * dt; o.x += o.vx * dt; o.y += o.vy * dt; t += dt; m -= ti.md * dt; p -= ti.md * dt;
  }
  return 9999;
}
// all autopilots
function autopilot(F, v, dt) {
  if (!v.alive || v.done || !v.auto) { v.apPhi = null; return; }
  if (v.role === 'booster') apBooster(F, v, dt);
  else if (v.role === 'capsule') { v.apPhi = null; v.eng = false; }
  else apAscent(F, v, dt);
}

// ------------------------------------------------------------------ the whole flight, one step
function step(F, dt) {
  F.t += dt; if (F.met >= 0) F.met += dt;
  for (const v of F.vehicles) {
    if (v.alive && v.done && v.onPad) {   // a stage that has landed rides along with the turning Earth
      const up = Math.atan2(v.y, v.x) + F.wE * dt, r = Math.hypot(v.x, v.y); v.x = r * Math.cos(up); v.y = r * Math.sin(up); const gv = groundVel(F, v.x, v.y); v.vx = gv[0]; v.vy = gv[1]; v.phi += F.wE * dt;
    }
    if (!v.alive || v.done) continue;
    if (v.auto) autopilot(F, v, dt);
    else if (!v.ctrl && v.role === 'upper') { v.auto = true; autopilot(F, v, dt); }   // an upper stage you leave keeps flying to orbit on its own
    else v.apPhi = null;
    stepVeh(F, v, dt);
  }
  // the fairing comes off at 110 km
  const stack = F.vehicles.find((v) => v.role !== 'booster' && v.alive);
  if (stack && F.fair && alt(stack) > 110000) jettisonFairing(F);
  // milestones
  if (stack && !F.ev.some((e) => e.text === 'Max Q') && F.maxQ > 5000 && stack.q < F.maxQ * .97 && F.met > 20 && stack.role !== 'capsule') event(F, 'Max Q', 'info', stack);
  if (stack && !F.kar && alt(stack) > 100000) { F.kar = true; event(F, 'Space! Past the Kármán line, 100 km up', 'big', stack); }
}
// is the mission done? returns null while flying, or a result object
function judge(F) {
  if (F.res) return F.res;
  const M = F.m, up = F.vehicles.filter((v) => v.role !== 'booster'), live = up.find((v) => v.alive && !v.done) || up.find((v) => v.alive);
  const boosters = F.vehicles.filter((v) => v.role === 'booster' && F.land[v.stages[0]]);
  const boostersDone = boosters.every((b) => b.done) && Object.keys(F.land).every((si) => F.vehicles.some((v) => v.role === 'booster' && v.stages[0] === +si) || false);
  let goal = false, failed = false, why = '';
  if (!live || live.done === 'lost') { failed = true; why = (up.find((v) => v.why) || {}).why || 'The rocket was lost'; }
  else {
    const o = orbit(live.x, live.y, live.vx, live.vy), h = alt(live), tgt = (M.alt || 100) * 1000;
    if (M.type === 'alt') {
      goal = F.apex >= tgt;
      const falling = o.vr < 0 && F.met > 30;
      if (falling && !goal) { failed = true; why = 'Topped out at ' + Math.round(F.apex / 1000) + ' km, short of ' + M.alt + ' km'; }
      if (goal && !(live.done || (live.role === 'capsule' && h < 1000 && live.chute))) goal = goal && false;
      if (F.apex >= tgt && (live.done === 'landed' || live.done === 'recovered' || live.done === 'lost')) goal = live.done !== 'lost';
      if (F.apex >= tgt && live.role === 'stack' && o.vr < 0 && F.rid === 'v2') goal = true;
    } else {
      const thrusting = thrustInfo(F, live, 0).T > 0;
      if (M.type === 'orbit') goal = o.peri >= Math.min(tgt * .9, 150000) && o.peri > 140000 && !thrusting;
      if (M.type === 'test') goal = o.apo >= 140000 && Math.hypot(live.vx, live.vy) >= 7200 && !thrusting;
      if (M.type === 'gto') goal = o.apo >= 35000e3 && o.peri > 140000 && !thrusting;
      if (M.type === 'tli') goal = (o.apo >= 370e6 || o.en > 0) && o.peri > 100000 && !thrusting;
      const fuelLeft = live.stages.reduce((a, i) => a + F.prop[i], 0);
      if (!goal && F.met > 30 && ((o.vr < 0 && h < 80000 && o.peri < 0 && (!thrusting || fuelLeft < 1)) || (fuelLeft < 1 && o.peri < 0 && live.stages.length === 1))) { failed = true; why = fuelLeft < 1 ? 'Out of fuel before reaching orbit (apoapsis ' + Math.round(o.apo / 1000) + ' km, periapsis ' + Math.round(o.peri / 1000) + ' km)' : 'Falling back: not fast enough for orbit'; }
    }
  }
  if (failed) return (F.res = { ok: false, why, at: F.met });
  if (goal && boostersDone) return (F.res = { ok: true, at: F.met });
  return null;
}
// pay: the mission pay, a bonus for how close to the target, and a big bonus for each booster brought back
function payout(F) {
  const M = F.m, res = F.res; if (!res) return null;
  const up = F.vehicles.find((v) => v.role !== 'booster' && v.alive) || {}, o = up.x ? orbit(up.x, up.y, up.vx, up.vy) : null;
  let acc = 0, accTxt = '';
  if (res.ok && o) {
    if (M.type === 'orbit') { const e1 = Math.abs(o.peri / 1000 - M.alt) / M.alt, e2 = Math.abs(o.apo / 1000 - M.alt) / M.alt; acc = clamp(1 - (e1 + e2) * 1.5, 0, 1); accTxt = Math.round(o.apo / 1000) + ' x ' + Math.round(o.peri / 1000) + ' km for ' + M.alt + ' km'; }
    else if (M.type === 'alt') { acc = clamp(F.apex / 1000 / M.alt - .9, 0, 1); accTxt = 'Top: ' + Math.round(F.apex / 1000) + ' km'; }
    else if (M.type === 'gto') { acc = clamp(1 - Math.abs(o.apo / 1000 - 35786) / 6000, 0, 1); accTxt = 'Apoapsis ' + Math.round(o.apo / 1000).toLocaleString('en-US') + ' km'; }
    else if (M.type === 'tli') { acc = 1; accTxt = 'On the way to the Moon'; }
    else { acc = 1; accTxt = Math.round(o.apo / 1000) + ' km, ' + (Math.hypot(up.vx, up.vy) / 1000).toFixed(2) + ' km/s'; }
  }
  const lines = [];
  let total = 0;
  if (res.ok) { lines.push(['Mission complete', M.pay]); total += M.pay; const b = Math.round(M.pay * .3 * acc); if (b) { lines.push(['On target (' + accTxt + ')', b]); total += b; } }
  else { const part = Math.round(M.pay * .1 * clamp(F.apex / 100000, 0, 1)); if (part) { lines.push(['Flight data', part]); total += part; } }
  const landed = F.vehicles.filter((v) => v.role === 'booster' && v.done === 'landed').length, off = F.vehicles.filter((v) => v.role === 'booster' && v.done === 'off').length;
  if (landed) { const b = Math.round(M.pay * .45 * landed); lines.push([(landed > 1 ? landed + ' boosters' : 'Booster') + ' landed', b]); total += b; }
  if (off) { const b = Math.round(M.pay * .15 * off); lines.push(['Booster landed off the pad', b]); total += b; }
  if (M.fun || M.free) { total = 0; }
  const xp = Math.round((res.ok ? M.pay * .5 + 60 : 15) + landed * M.pay * .2) * (M.fun || M.free ? 0 : 1);
  const stars = res.ok ? 1 + (acc > .7 ? 1 : 0) + (Object.keys(F.land).length ? (landed >= Object.keys(F.land).length ? 1 : 0) : (acc > .9 ? 1 : 0)) : 0;
  return { lines, total, xp, stars, acc, accTxt, landed };
}

const API = { RE, MU, G0, OMEGA, atmos, cdMach, SITES, ROCKETS: R, ROCKET_ORDER, MISSIONS, RANKS, freeMission, newFlight, mass, burning, thrustInfo, orbit, alt, downrange, padAng, groundVel,
  stage, jettisonFairing, step, judge, payout, predictImpact, vname, vehLen, vehDia, S, event, clamp, wrapPi, fmtKm, landStageIndex };
if (typeof module !== 'undefined' && module.exports) module.exports = API; else root.RocketCore = API;
})(this);
