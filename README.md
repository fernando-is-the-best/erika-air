# Erika Air

A browser flight simulator built with three.js: streamed procedural terrain, real-world airfields, 6-DOF physics and interactive 3D cockpits.

**Play:** https://fernando-is-the-best.github.io/erika-air/

Controls are listed in the game under the Controls tab. Press C to cycle cameras; in the cockpit, click switches and levers, scroll to zoom, double-click to recentre.

![Cockpit](screenshot.png)

## Access codes
The game is locked behind one-person access codes. The admin makes codes at `admin.html`. Setup steps are in [SETUP.md](SETUP.md).

## Erika Moto
`moto.html` (Erika Moto, the Grand Prix bikes) is generated from `gp.html` (Erika Racing): they share one engine, and `gp.html` switches to the bikes-only menus when `window.ERIKA_MOTO` is set. After changing `gp.html`, run `python3 tools/make-moto.py` to rebuild `moto.html`.
