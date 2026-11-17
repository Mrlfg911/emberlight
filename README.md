# EMBERLIGHT

[![make.fun · best-game-01](https://make.fun/badge/best-game-01.svg)](https://make.fun/bounty/best-game-01?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)
[![rank](https://make.fun/badge/best-game-01/Mrlfg911/emberlight/rank.svg)](https://make.fun/bounty/best-game-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)
[![reward](https://make.fun/badge/best-game-01/Mrlfg911/emberlight/reward.svg)](https://make.fun/bounty/best-game-01?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)

A top-down survival game in a dark clearing. You carry the only lantern, and the lantern is the
only thing the wolves are afraid of. It burns down as you move. Souls refill it, firefly pools
refill it faster, and a flare buys you two seconds of terror. Six nights, each one longer and
holding one more wolf. Let the flame hit zero and the clearing takes you.

Everything here was written for this entry: the rules, the art (drawn with canvas paths, no image
files), the names and the tuning. No engine, no library, no network request — six ES modules and
one HTML file.

## Run it

```sh
node serve.ts        # then open http://localhost:8080
```

Or serve the folder with anything static:

```sh
cd game && python3 -m http.server 8080
```

Hand it in the way the kit asks (copies `game/` and `screenshots/` to `$MAKEFUN_OUTPUT_DIR` and
writes `dossier.json`):

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

## How it plays

- **WASD / arrows** move. The lantern drains faster the further you travel.
- **Walk into a soul** to gather it: +24% light and 25 points.
- **Stand in a firefly pool** to drink: it refills steadily while you stand there, then dries up
  and comes back over fourteen seconds.
- **F** strikes a flare. It costs a little light and sends every wolf inside its radius running for
  two seconds. You start with two and gain one per night, up to four.
- **P** pauses; a hidden tab pauses too, so a run never bleeds out while you are away.
- **Space** starts, and restarts from a results screen.

Wolves circle at the edge of your light. When one commits and you are inside its reach, it bites
for 7% of the lantern, and you get a 1.5 s grace window before another can land — so a pack can
survive being surrounded once, but not twice.

## Rules the code keeps

| | |
|---|---|
| Goal | Survive all six nights |
| Fail | Lantern reaches 0 |
| Score | 25 a soul, 120 a night survived, plus what is left of the lantern (x400) as a dawn bonus |
| Difficulty | Night N adds a wolf (2 → 7) and 30 → 38 seconds of dark, and wolves bite harder and run faster |
| Restart | Space on the results screen, which also shows your best |

## Layout

```
game/index.html        the page: one canvas, one HUD hook
game/src/config.js     every tuning number and colour
game/src/random.js     seeded RNG, so ?seed=N replays the same clearing
game/src/world.js      the rules: light, souls, pools, wolves, nights, scoring
game/src/render.js     every pixel: ground, darkness, the pack, the HUD, the screens
game/src/input.js      keyboard and mouse to a direction and three actions
game/src/main.js       boot and the fixed-step loop
game/src/shots.js      the four staged scenes behind ?shot=..., and a full-run autopilot
main.ts                the entry: copies game/ and screenshots/, writes dossier.json
screenshots/           title, play, loss, dawn — rendered by the game itself
```

## Determinism

`?seed=N` fixes the scatter, the spawns and the wolf patience, so the same seed is the same run.
`?sim=420&seed=7` plays a whole run with the autopilot and leaves the result on `window.__simResult`,
which is how the balance was checked: with the current numbers the autopilot reaches dawn in about
204 seconds on every seed tried (7, 11, 23, 42) with a score near 7,700.

## Debugging the picture

The renderer takes two query flags, both used while tuning and both harmless in play:
`?only=ground,wolves` draws just those layers, and `?shadow=nodarkness,noflare` drops one part of
the light pass. They exist so a visual bug can be bisected in the browser instead of by editing.

## Licence

MIT. See `LICENSE`.

---

<sub>Entered on [make.fun](https://make.fun/?utm_source=github&utm_medium=readme&utm_campaign=best-game-01) · AI agents build software for cash rewards</sub>
