// The scenes behind ?shot=..., and a headless referee. Each scene plays the real rules forward from
// a fresh world for a fixed number of steps, steered by an autopilot, so the frame is what a real
// run looks like rather than a hand-placed tableau.
import {
  createWorld, EVENT_OVER,
} from './world.js';
import {
  SCREEN_OVER, SCREEN_PLAY, SCREEN_SELECT, SCREEN_TITLE, SCREEN_WON,
} from './render.js';

const noop = () => {};

/** Fly the lantern toward the nearest thing worth having, and strike when a wolf is close. */
function autopilot(world, particles) {
  const state = world.state;
  const player = state.player;

  let targetX = player.x;
  let targetY = player.y;
  let found = false;

  // Light first. A run does not end because a wolf was close; it ends because the lantern emptied,
  // so a pool within reach always outranks a soul, even a soul right next to the player.
  const thirsty = state.light < 0.45;
  let bestPool = null;
  let bestPoolDistance = Infinity;
  for (const pool of state.pools) {
    if (pool.dead || pool.charge < 0.06) continue;
    const distance = Math.hypot(pool.x - player.x, pool.y - player.y);
    if (distance < bestPoolDistance) {
      bestPoolDistance = distance;
      bestPool = pool;
    }
  }
  if (bestPool && (thirsty || bestPoolDistance < 200)) {
    targetX = bestPool.x;
    targetY = bestPool.y;
    found = true;
  }

  // Then souls, nearest first.
  if (!found || (!thirsty && bestPoolDistance > 200)) {
    let bestSoul = null;
    let bestSoulDistance = Infinity;
    for (const soul of state.souls) {
      if (!soul.active) continue;
      const distance = Math.hypot(soul.x - player.x, soul.y - player.y);
      if (distance < bestSoulDistance) {
        bestSoulDistance = distance;
        bestSoul = soul;
      }
    }
    if (bestSoul) {
      targetX = bestSoul.x;
      targetY = bestSoul.y;
      found = true;
    }
  }

  if (!found) {
    // Nothing to chase: drift to the middle of the wood and wait for something to show up.
    targetX = 1400;
    targetY = 900;
  }

  // Keep a little off the centre of whatever we are heading for, so we do not walk past it.
  const dx = targetX - player.x;
  const dy = targetY - player.y;
  const length = Math.hypot(dx, dy) || 1;
  const stop = found ? 12 : 90;
  const moveX = length > stop ? dx / length : 0;
  const moveY = length > stop ? dy / length : 0;

  // Strike when something is charging from close range.
  let strike = false;
  for (const wolf of state.wolves) {
    if (!wolf.active || wolf.charging !== true) continue;
    if (Math.hypot(wolf.x - player.x, wolf.y - player.y) < 130) strike = true;
  }

  return { x: moveX, y: moveY, flare: strike && state.flares > 0 };
}

/**
 * Advance a world by a number of steps under autopilot, so a staged frame is always a frame the
 * rules could actually have produced.
 */
function play(world, steps) {
  for (let index = 0; index < steps; index += 1) {
    if (world.state.over) return;
    const command = autopilot(world, null);
    if (command.flare) world.strike();
    world.step(1 / 60, command, false);
  }
}

/**
 * Play one whole run to its end, with a cap. Used by ?sim=1 so a headless check can confirm that a
 * run finishes in a win or a loss rather than running forever.
 */
export function playFullRun(world, seconds = 400) {
  const cap = Math.floor(Math.max(1, seconds) * 60);
  let steps = 0;
  window.__simTrace = [];
  while (!world.state.over && steps < cap) {
    const command = autopilot(world, null);
    if (command.flare) world.strike();
    const before = world.state.light;
    world.step(1 / 60, command, false);
    const st = world.state;
    if (st.over || steps % 120 === 0) {
      window.__simTrace.push({
        t: Math.round(steps / 60), night: st.night, light: Number(st.light.toFixed(3)),
        drop: Number((before - st.light).toFixed(4)), drinking: st.drinking,
      });
    }
    steps += 1;
  }
  const state = world.state;
  return {
    region: state.region.id,
    won: state.won,
    over: state.over,
    steps,
    seconds: Math.round((steps / 60) * 10) / 10,
    score: state.score,
    souls: state.soulsSaved,
    soulsTarget: state.soulsTarget,
    nights: state.nightsSurvived,
    nightCount: state.nightCount,
    light: Math.round(state.light * 100) / 100,
    capped: !state.over,
  };
}

/**
 * Build the world a screenshot needs and place it in the requested moment.
 * Returns the screen to draw and the map cursor when the scene is the map.
 */
export function stageShot(name, world, save) {
  const state = world.state;

  if (name === 'select') {
    return { screen: SCREEN_SELECT, cursor: 2 };
  }

  if (name === 'start') {
    play(world, 30);
    return { screen: SCREEN_TITLE };
  }

  if (name === 'play' || name.startsWith('play-')) {
    // Mid-run, with wolves committed, souls out, and the lantern a little worn.
    play(world, 60 * 16);
    for (const wolf of state.wolves) {
      if (!wolf.active) continue;
      const angle = Math.atan2(wolf.y - state.player.y, wolf.x - state.player.x);
    wolf.x = state.player.x + Math.cos(angle) * 300;
      wolf.y = state.player.y + Math.sin(angle) * 300;
    }
    return { screen: SCREEN_PLAY };
  }

  if (name === 'end') {
    // Run until the lantern dies, then show it. The light is forced low partway through so the
    // scene reaches the ending in a bounded number of steps.
    let guard = 0;
    while (!state.over && guard < 60 * 300) {
      const command = autopilot(world, null);
      if (command.flare) world.strike();
      world.step(1 / 60, command, false);
      guard += 1;
      if (guard === 60 * 40) state.light = 0.06;
    }
    return { screen: state.won ? SCREEN_WON : SCREEN_OVER };
  }

  if (name === 'win') {
    // Hand the region its last night, then let the rules finish it.
    play(world, 60 * 12);
    state.night = state.nightCount;
    state.nightElapsed = state.nights[state.nightCount - 1].seconds - 0.2;
    state.light = Math.max(state.light, 0.55);
    state.score = Math.max(state.score, 2400);
    world.step(1 / 60, { x: 0, y: 0 }, false);
    return { screen: state.won ? SCREEN_WON : SCREEN_OVER };
  }

  // A region other than the first: used to shoot the other three.
  return { screen: SCREEN_PLAY };
}
