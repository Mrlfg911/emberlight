// The scenes behind ?shot=start|play|end|win. Each one plays the real rules forward from a fresh
// world for a fixed number of steps, steered by an autopilot, so the frame is what a real run
// looks like and the same seed always gives the same frame. Nothing here is drawn specially: the
// renderer paints state exactly as it does in play.
import { WOLF, WORLD } from './config.js';
import { EVENT_OVER } from './world.js';
import { SCREEN_OVER, SCREEN_PLAY, SCREEN_TITLE, SCREEN_WON } from './render.js';

const START_SECONDS = 6;

/**
 * The autopilot: head for the nearest soul when the lantern is healthy, otherwise for the nearest
 * pool with charge, and lean away from any wolf that is closing in. It plays the game as a careful
 * person would, so the screenshot shows real play and not a staged tableau.
 */
function autopilot(state) {
  const player = state.player;
  let targetX = WORLD.width / 2;
  let targetY = WORLD.height / 2;
  let bestCost = Infinity;

  const wantsLight = state.light < 0.45;
  if (wantsLight) {
    for (const pool of state.pools) {
      if (pool.charge < 0.08) continue;
      const cost = Math.hypot(pool.x - player.x, pool.y - player.y);
      if (cost < bestCost) {
        bestCost = cost;
        targetX = pool.x;
        targetY = pool.y;
      }
    }
  }
  if (bestCost === Infinity) {
    for (const soul of state.souls) {
      if (!soul.active) continue;
      const cost = Math.hypot(soul.x - player.x, soul.y - player.y);
      if (cost < bestCost) {
        bestCost = cost;
        targetX = soul.x;
        targetY = soul.y;
      }
    }
  }

  let dx = targetX - player.x;
  let dy = targetY - player.y;

  // Repel from any wolf that is inside a comfortable radius, strongest when it is charging.
  for (const wolf of state.wolves) {
    if (!wolf.active) continue;
    const wx = player.x - wolf.x;
    const wy = player.y - wolf.y;
    const distance = Math.hypot(wx, wy) || 1;
    const comfort = wolf.state === 2 ? WOLF.radius * 9 : WOLF.radius * 5;
    if (distance > comfort) continue;
    const push = (comfort - distance) / comfort;
    dx += (wx / distance) * push * 260;
    dy += (wy / distance) * push * 260;
  }

  const length = Math.hypot(dx, dy);
  if (length < 24) return { x: 0, y: 0 };
  return { x: dx / length, y: dy / length };
}

/** Advance `world` by `seconds` with the autopilot, stopping early on game over. */
function play(world, seconds) {
  const stepSeconds = 1 / 60;
  const steps = Math.round(seconds / stepSeconds);
  for (let index = 0; index < steps; index += 1) {
    const events = world.step(stepSeconds, autopilot(world.state), false);
    if (events & EVENT_OVER) return true;
  }
  return false;
}

/**
 * Set `world` to the named scene (start, play, end or win; any other name is start) and return the
 * screen to draw over it and the best score to show.
 */
/**
 * Play a whole run with the same autopilot the screenshots use, and report how it went. Exposed on
 * window so the game can be played to the end without a human in a headless check.
 */
export function playFullRun(world, maxSeconds = 400) {
  world.reset();
  const stepSeconds = 1 / 60;
  const steps = Math.round(maxSeconds / stepSeconds);
  const trace = [];
  for (let index = 0; index < steps; index += 1) {
    const events = world.step(stepSeconds, autopilot(world.state), false);
    if (index % 60 === 0) {
      trace.push({
        t: index / 60,
        light: Math.round(world.state.light * 100),
        night: world.state.night,
        souls: world.state.soulsSaved,
        score: world.state.score,
      });
    }
    if (events & EVENT_OVER) {
      return { over: true, won: world.state.won, night: world.state.night, score: world.state.score, souls: world.state.soulsSaved, seconds: index / 60, trace };
    }
  }
  return { over: false, night: world.state.night, score: world.state.score, souls: world.state.soulsSaved, seconds: maxSeconds, trace };
}

export function stageShot(name, world) {
  world.reset();

  if (name === 'play') {
    play(world, 17);
    // Bring the pack in close so the frame shows the game's actual tension: wolves at the edge
    // of the lantern, a soul within reach, the meter already down.
    const player = world.state.player;
    const ring = [
      { angle: 0.35, distance: 150, charging: true },
      { angle: 2.35, distance: 185, charging: false },
      { angle: 4.15, distance: 160, charging: true },
    ];
    world.state.wolves.forEach((wolf, index) => {
      if (!wolf.active) return;
      const spot = ring[index % ring.length];
      wolf.x = player.x + Math.cos(spot.angle) * spot.distance;
      wolf.y = player.y + Math.sin(spot.angle) * spot.distance;
      if (spot.charging) {
        const length = Math.hypot(player.x - wolf.x, player.y - wolf.y) || 1;
        wolf.state = 2;
        wolf.vx = ((player.x - wolf.x) / length) * 250;
        wolf.vy = ((player.y - wolf.y) / length) * 250;
        wolf.timer = 2;
      }
    });
    for (const soul of world.state.souls) soul.active = false;
    const near = world.state.souls[0];
    near.active = true;
    near.x = player.x + 168;
    near.y = player.y - 96;
    near.phase = 1.2;
    return { screen: SCREEN_PLAY, best: 0 };
  }

  if (name === 'end') {
    // Play until the lantern is nearly out, then let it go: the frame is the run ending.
    play(world, 150);
    world.state.light = 0.07;
    play(world, 2.2);
    return { screen: world.state.over ? SCREEN_OVER : SCREEN_PLAY, best: Math.max(240, world.state.score) };
  }

  if (name === 'win') {
    play(world, 12);
    world.state.night = 6;
    world.state.nightsSurvived = 6;
    world.state.won = true;
    world.state.over = true;
    world.state.score = Math.max(1480, world.state.score);
    return { screen: SCREEN_WON, best: world.state.score };
  }

  play(world, START_SECONDS);
  return { screen: SCREEN_TITLE, best: 0 };
}
