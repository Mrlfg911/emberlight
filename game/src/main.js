// Boot and the one loop: input is read every frame, the world advances in fixed 1/60 s steps
// (several in a slow frame, none in a fast one), and the renderer paints what is there. The game
// moves between six screens: title, the map of the wood, play, paused, and the two endings.
//
// ?seed=N fixes the scatter. ?region=id starts on that region. ?shot=... stages a frame for a
// screenshot and sets window.__shotReady; ?sim=seconds plays a whole run headlessly and leaves the
// result on window.__simResult, so the game can be checked without a human at the keyboard.
import { STEP } from './config.js';
import { createRandom } from './random.js';
import {
  createWorld, EVENT_BITE, EVENT_DRINK, EVENT_FLARE, EVENT_NIGHT, EVENT_OVER, EVENT_SOUL,
} from './world.js';
import { ACTION_CONFIRM, ACTION_FLARE, ACTION_PAUSE, createInput } from './input.js';
import {
  createRenderer, SCREEN_OVER, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_SELECT, SCREEN_TITLE, SCREEN_WON,
} from './render.js';
import { REGIONS, isUnlocked } from './regions.js';
import { loadSave, recordRun } from './save.js';
import { createAudio } from './audio.js';
import { createParticles } from './particles.js';
import { playFullRun, stageShot } from './shots.js';

/** The longest frame the loop catches up on; a longer stall (a hidden tab) is dropped, not replayed. */
const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);
const startRegion = REGIONS.find((entry) => entry.id === params.get('region')) || REGIONS[0];

const canvas = document.getElementById('game');
const status = document.getElementById('status');

const save = loadSave();
const world = createWorld(createRandom(seed), startRegion);
const renderer = createRenderer(canvas);
const audio = createAudio();
const particles = createParticles();


function runShot(name) {
  const scene = stageShot(name, world, save);
  renderer.useRegion(world.state.region, particles);
  let painted = 0;
  function paint() {
    renderer.draw(world.state, scene.screen, 0, save, scene.cursor ?? 0);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  let screen = SCREEN_TITLE;
  let cursor = Math.max(0, REGIONS.findIndex((entry) => entry.id === save.lastRegion));
  if (!isUnlocked(save, cursor)) cursor = 0;
  let lastRun = null;
  let accumulator = 0;
  let last = performance.now();

  // Screen readers (and anyone reading the page's text) hear the run change around them.
  function announce(message) {
    status.textContent = message;
  }

  function enterRegion(index) {
    const entry = REGIONS[index];
    if (!isUnlocked(save, index)) {
      audio.play('deny');
      announce(`${entry.name} is still shut. Clear the region before it.`);
      return;
    }
    audio.play('ui');
    world.state.region = entry;
    renderer.useRegion(entry, particles);
    world.reset();
    particles.clear();
    accumulator = 0;
    lastRun = null;
    screen = SCREEN_PLAY;
    announce(`${entry.name}. Night 1 of ${entry.nights}. ${entry.soulsTarget} souls to gather.`);
  }

  function endGame() {
    const state = world.state;
    const entry = state.region;
    const times = REGIONS.filter((region) => isUnlocked(save, REGIONS.indexOf(region))).length;
    lastRun = recordRun(save, entry, {
      score: state.score,
      souls: state.soulsSaved,
      won: state.won,
      embers: Math.round(state.score / 40),
    });
    screen = state.won ? SCREEN_WON : SCREEN_OVER;
    audio.play(state.won ? 'win' : 'over');
    announce(state.won
      ? `${entry.name} is clear. ${state.soulsSaved} souls, score ${state.score}. ${times} of ${REGIONS.length} regions open.`
      : `The lantern died on night ${state.night}. ${state.soulsSaved} souls, score ${state.score}.`);
  }

  function handleActions() {
    const actions = input.takeActions();
    if (actions & ACTION_CONFIRM) {
      audio.unlock();
      if (screen === SCREEN_TITLE) {
        audio.play('ui');
        screen = SCREEN_SELECT;
        announce('The wood. Choose a region.');
      } else if (screen === SCREEN_SELECT) {
        enterRegion(cursor);
      } else if (screen === SCREEN_OVER || screen === SCREEN_WON) {
        audio.play('ui');
        screen = SCREEN_SELECT;
      } else if (screen === SCREEN_PAUSED) {
        screen = SCREEN_PLAY;
        announce('Playing.');
      }
    }
    if (actions & ACTION_PAUSE) {
      if (screen === SCREEN_PLAY) {
        screen = SCREEN_PAUSED;
        announce('Paused.');
      } else if (screen === SCREEN_PAUSED) {
        screen = SCREEN_PLAY;
        announce('Playing.');
      }
    }
    if (actions & ACTION_FLARE && screen === SCREEN_PLAY) {
      if (world.strike()) {
        audio.play('flare');
        particles.ring(world.state.player.x, world.state.player.y, '#ffd9a0', 30);
        announce('Flare struck. The wolves scatter.');
      }
    }
  }

  function step() {
    if (screen === SCREEN_TITLE || screen === SCREEN_SELECT) {
      world.step(STEP, { x: 0, y: 0 }, true);
      return;
    }
    const events = world.step(STEP, input.direction(), false);
    const player = world.state.player;
    if (events & EVENT_OVER) {
      endRunEffects();
      endGame();
      return;
    }
    if (events & EVENT_SOUL) {
      audio.play('soul');
      particles.emit(player.x, player.y, 16, {
        colour: '#bfefff', speed: 120, ttl: 0.7, size: 2.4, drag: 0.86,
      });
      announce(`Soul rescued. ${world.state.soulsSaved} of ${world.state.soulsTarget}.`);
    }
    if (events & EVENT_BITE) {
      audio.play('bite');
      particles.emit(player.x, player.y, 18, {
        colour: '#ff8a5c', speed: 190, ttl: 0.5, size: 2.6, gravity: 180,
      });
      announce(`Bitten. Light at ${Math.round(world.state.light * 100)} percent.`);
    }
    if (events & EVENT_DRINK) {
      audio.play('drink');
      particles.emit(player.x, player.y, 3, {
        colour: '#b8ff8a', speed: 60, ttl: 0.6, size: 2, angle: -Math.PI / 2, spread: 1.2, gravity: -30,
      });
    }
    if (events & EVENT_NIGHT) {
      audio.play('night');
      announce(`Night ${world.state.night}. ${world.state.flares} flares left.`);
    }
    if (events & EVENT_FLARE) {
      particles.ring(player.x, player.y, '#ffe3b8', 24);
    }
    // Embers off the lantern, so the light has a source it looks like.
    if (Math.random() < 0.35) {
      particles.emit(player.x + (Math.random() - 0.5) * 14, player.y + 2, 1, {
        colour: '#ffbb72', speed: 26, ttl: 1.1, size: 1.5, angle: -Math.PI / 2, spread: 0.8, gravity: -14,
      });
    }
  }

  function endRunEffects() {
    const player = world.state.player;
    particles.ring(player.x, player.y, world.state.won ? '#ffd98a' : '#ff7a52', 40);
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    handleActions();
    if (screen === SCREEN_TITLE || screen === SCREEN_SELECT || screen === SCREEN_PLAY) {
      while (accumulator >= STEP && (screen === SCREEN_PLAY || screen === SCREEN_TITLE || screen === SCREEN_SELECT)) {
        step();
        accumulator -= STEP;
      }
    } else {
      accumulator = 0;
    }
    particles.update(STEP);
    renderer.draw(world.state, screen, save.best[world.state.region.id] || 0, save, cursor);
  }

  // Left and right move the map cursor without touching the world's rules.
  function moveCursor(delta) {
    if (screen !== SCREEN_SELECT) return;
    // The cursor only ever rests on a region you can enter, so the loudest thing on the map is
    // never a door that is shut.
    let next = cursor;
    for (let attempt = 0; attempt < REGIONS.length; attempt += 1) {
      next = Math.max(0, Math.min(REGIONS.length - 1, next + delta));
      if (isUnlocked(save, next)) break;
      if ((delta > 0 && next >= REGIONS.length - 1) || (delta < 0 && next <= 0)) break;
    }
    cursor = next;
    audio.play('ui');
    announce(REGIONS[cursor].name + (isUnlocked(save, cursor) ? '' : ', still shut'));
  }

  window.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowLeft' || event.key === 'a' || event.key === 'A') moveCursor(-1);
    if (event.key === 'ArrowRight' || event.key === 'd' || event.key === 'D') moveCursor(1);
    if (screen === SCREEN_SELECT && (event.key === 'r' || event.key === 'R')) {
      // A deliberate, noisy reset: the save is the only thing in the game that outlives a run.
      save.cleared = {};
      save.best = {};
      save.souls = {};
      save.embers = 0;
      save.runs = 0;
      cursor = 0;
      announce('Everything saved is forgotten.');
    }
    audio.unlock();
  });

  // Leaving the tab pauses a running run rather than letting the wolves feed unseen.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    }
  });

  announce('Emberlight. Press Space or click to light the lantern.');
  requestAnimationFrame(frame);
}

// A headless check can play a whole run and read the result: ?sim=1
if (params.get('sim')) {
  window.__simResult = playFullRun(world, Number.parseFloat(params.get('sim')) > 1 ? Number.parseFloat(params.get('sim')) : 400);
  window.__shotReady = true;
} else if (shot) runShot(shot);
else runGame();
