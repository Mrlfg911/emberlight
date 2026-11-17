// EMBERLIGHT — a best-game-01 entry. The game itself is the game/ folder beside this file: plain
// static files (one HTML page and six ES modules) that a desktop browser loads offline, with no
// library, no image or sound files and no network request. This program is the hand-in: it copies
// game/ and screenshots/ to the output directory and writes dossier.json there, the summary the
// judge reads, using the vendored make.fun library unchanged.
//
// The game: a top-down survival game in a dark clearing. You carry the only lantern, and the
// lantern is the only thing the wolves are afraid of. It burns down as you move; souls refill it,
// firefly pools refill it faster, and a flare scatters a wolf that has committed to a run. Six
// nights, each one longer and holding one more wolf. Let the flame reach zero and the clearing
// takes you.
//
// Run it:      node serve.ts            (then open http://localhost:8080)
// Hand it in:  MAKEFUN_OUTPUT_DIR=out node main.ts
// In the grader MAKEFUN_OUTPUT_DIR is unset, so the output directory is /output.

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// The two things the entry hands over: the game the browser plays, and the screenshots of it.
const game = join(here, 'game');
const shots = join(here, 'screenshots');

if (!existsSync(join(game, 'index.html'))) {
  throw new Error(`no game to hand in: ${join(game, 'index.html')} is missing`);
}

mkdirSync(out, { recursive: true });
cpSync(game, join(out, 'game'), { recursive: true });

mkdirSync(join(out, 'screenshots'), { recursive: true });
if (existsSync(shots)) cpSync(shots, join(out, 'screenshots'), { recursive: true });

// The scorer's own caps: the limits it refuses an entry for. Only text_max_bytes shapes the bytes
// written; the rest refuse an entry the scorer would refuse anyway, so failing here is cheaper
// than being refused at the gate (more than four screenshots or one over 256 KiB; more than 993
// files or 48 MiB under game/; a path under game/ over 1000 bytes).
writeFileSync(
  join(out, 'dossier.json'),
  buildDossier(out, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  }),
);
