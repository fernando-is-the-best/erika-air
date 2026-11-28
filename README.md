# Erika Air

A website full of browser games built with three.js. No download needed: open the page and play.

**Play:** https://fernando-is-the-best.github.io/erika-air/

![Cockpit](screenshot.png)

## The games

The home page (`index.html`) shows every game as a big card. Tap one to play.

| Game | Page | What you do |
| --- | --- | --- |
| **Erika Air** | `air.html` | Fly planes over real airports, with 3D cockpits you can click |
| **Erika Racing** | `gp.html` | Race cars on a track |
| **Erika Moto** | `moto.html` | Race Grand Prix bikes |
| **Erika Boats** | `boat.html` | Race boats on the water |
| **Erika Karts** | `kart.html` | Race go-karts |
| **Erika Trains** | `train.html` | Drive real trains |
| **Erika Rockets** | `rocket.html` | Launch real rockets to space, orbit and the Moon, and land the booster |

Each game has an "All games" link back to the home page, and the top bar links to the other games. Each game lists its controls in a Controls tab. In Erika Air, press C to change camera; in the cockpit, click switches and levers, scroll to zoom and double-click to look straight ahead again.


## Access codes

Every game is locked. To play, you need an access code from the admin.

- The admin makes codes on `admin.html`.
- **One code can open more than one game.** When the admin makes a code, they tap each game it should open. The player types the code once, and the other games on that code open by themselves in the same browser.
- The admin can add or remove games on a code later (the code's first game always stays).
- There are two kinds of code:
  - **35-character code:** the first person to type it owns it. Anyone else who tries it is blocked.
  - **10-digit one-time code:** opens the game for one visit, then it is used up.

The one-time Firebase setup is in [SETUP.md](SETUP.md).

## Admin page

`admin.html` is where the admin makes codes, frees up codes, gives or takes credits and items, reads messages from players, and sees alerts when someone tries a code that belongs to another player. "My own games" lets the admin play every game without a code.

## For developers: Erika Moto

`moto.html` is made from `gp.html`: they share one engine, and `gp.html` switches to the bikes-only menus when `window.ERIKA_MOTO` is set. After changing `gp.html`, run `python3 tools/make-moto.py` to rebuild `moto.html`.
