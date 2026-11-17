// The rules of EMBERLIGHT, with no drawing and no browser in them: the lantern's light, the
// souls to rescue, the firefly pools to drink from, the wolves that hunt the dark, and the nights
// that pass. step() advances one fixed step and returns what happened as bit flags, so the caller
// plays sound and shows messages without the world knowing about screens or audio.
import {
  FLARE, LIGHT, NIGHTS, PLAYER, POOLS, SOULS, WOLF, WORLD,
} from './config.js';

export const EVENT_SOUL = 1;
export const EVENT_DRINK = 2;
export const EVENT_BITE = 4;
export const EVENT_OVER = 8;
export const EVENT_NIGHT = 16;
export const EVENT_FLARE = 32;

const WOLF_ORBIT = 0;
const WOLF_STALK = 1;
const WOLF_CHARGE = 2;
const WOLF_FLEE = 3;

function clamp(value, low, high) {
  return value < low ? low : value > high ? high : value;
}

export function createWorld(random) {
  const player = { x: WORLD.width / 2, y: WORLD.height / 2, vx: 0, vy: 0, facing: 1 };

  const souls = [];
  for (let index = 0; index < SOULS.maxAlive; index += 1) {
    souls.push({ active: false, x: 0, y: 0, phase: 0, life: 0 });
  }

  const pools = [];
  for (let index = 0; index < POOLS.count; index += 1) {
    pools.push({ x: 0, y: 0, charge: 1 });
  }

  const wolves = [];
  for (let index = 0; index < 12; index += 1) {
    wolves.push({
      active: false, x: 0, y: 0, vx: 0, vy: 0, angle: 0, orbit: 0, state: WOLF_ORBIT,
      timer: 0, bite: 0, targetX: 0, targetY: 0, phase: 0,
    });
  }

  const state = {
    player, souls, pools, wolves,
    light: LIGHT.start,
    night: 1,
    nightElapsed: 0,
    elapsed: 0,
    score: 0,
    soulsSaved: 0,
    nightsSurvived: 0,
    flares: FLARE.charges,
    flareCooldown: 0,
    flareGlow: 0,
    soulTimer: SOULS.firstDelay,
    drinking: 0,
    over: false,
    won: false,
  };

  function lightRadius() {
    const t = clamp(state.light, 0, 1);
    return LIGHT.radiusMin + (LIGHT.radiusMax - LIGHT.radiusMin) * (t * t * (3 - 2 * t));
  }

  function nightPlan() {
    return NIGHTS[Math.min(state.night - 1, NIGHTS.length - 1)];
  }

  function spawnSoul() {
    const free = souls.find((soul) => !soul.active);
    if (!free) return;
    const angle = random() * Math.PI * 2;
    const distance = random.between(SOULS.minDistance, SOULS.maxDistance);
    free.active = true;
    free.x = clamp(player.x + Math.cos(angle) * distance, 60, WORLD.width - 60);
    free.y = clamp(player.y + Math.sin(angle) * distance, 60, WORLD.height - 60);
    free.phase = random() * Math.PI * 2;
    free.life = 0;
  }

  function placePools() {
    for (let index = 0; index < pools.length; index += 1) {
      const pool = pools[index];
      const angle = (index / pools.length) * Math.PI * 2 + random() * 0.6;
      const distance = random.between(POOLS.minDistance, POOLS.maxDistance);
      pool.x = clamp(WORLD.width / 2 + Math.cos(angle) * distance, 140, WORLD.width - 140);
      pool.y = clamp(WORLD.height / 2 + Math.sin(angle) * distance, 140, WORLD.height - 140);
      pool.charge = 1;
    }
  }

  function addWolves(count) {
    for (const wolf of wolves) wolf.active = false;
    for (let index = 0; index < count && index < wolves.length; index += 1) {
      const wolf = wolves[index];
      const angle = (index / count) * Math.PI * 2 + random() * 0.5;
      wolf.active = true;
      wolf.state = WOLF_ORBIT;
      wolf.angle = angle;
      wolf.orbit = lightRadius() + WOLF.orbitGap + random() * WOLF.orbitGapJitter;
      wolf.timer = random.between(WOLF.patienceMin, WOLF.patienceMax);
      wolf.bite = 0;
      wolf.phase = random() * Math.PI * 2;
      wolf.x = player.x + Math.cos(angle) * wolf.orbit;
      wolf.y = player.y + Math.sin(angle) * wolf.orbit;
    }
  }

  function reset() {
    player.x = WORLD.width / 2;
    player.y = WORLD.height / 2;
    player.vx = 0;
    player.vy = 0;
    for (const soul of souls) soul.active = false;
    state.light = LIGHT.start;
    state.grace = 0;
    state.night = 1;
    state.nightElapsed = 0;
    state.elapsed = 0;
    state.score = 0;
    state.soulsSaved = 0;
    state.nightsSurvived = 0;
    state.flares = FLARE.charges;
    state.flareCooldown = 0;
    state.flareGlow = 0;
    state.soulTimer = SOULS.firstDelay;
    state.drinking = 0;
    state.over = false;
    state.won = false;
    placePools();
    addWolves(nightPlan().wolves);
  }

  function strike() {
    if (state.over || state.flares <= 0 || state.flareCooldown > 0) return 0;
    state.flares -= 1;
    state.flareCooldown = FLARE.cooldown;
    state.flareGlow = 1;
    state.light = clamp(state.light - FLARE.lightCost, 0, 1);
    for (const wolf of state.wolves) {
      if (!wolf.active) continue;
      const dx = wolf.x - player.x;
      const dy = wolf.y - player.y;
      if (dx * dx + dy * dy > FLARE.radius * FLARE.radius) continue;
      wolf.state = WOLF_FLEE;
      wolf.timer = FLARE.stun;
      const length = Math.hypot(dx, dy) || 1;
      wolf.vx = (dx / length) * WOLF.chargeSpeed * 1.4;
      wolf.vy = (dy / length) * WOLF.chargeSpeed * 1.4;
    }
    return EVENT_FLARE;
  }

  function endRun(won) {
    if (state.over) return 0;
    state.over = true;
    state.won = won;
    return EVENT_OVER;
  }

  /**
   * One fixed step. `input` is { x, y } in -1..1 (not normalised), `harmless` runs the title
   * screen's backdrop: souls drift and the lantern breathes, but nothing can hurt or be scored.
   */
  function step(dt, input, harmless) {
    let events = 0;
    if (state.over) {
      state.flareGlow = Math.max(0, state.flareGlow - dt * 2);
      return events;
    }

    state.elapsed += dt;
    state.nightElapsed += dt;
    state.flareCooldown = Math.max(0, state.flareCooldown - dt);
    state.flareGlow = Math.max(0, state.flareGlow - dt * 2.2);

    const plan = nightPlan();
    if (state.nightElapsed >= plan.seconds && !harmless) {
      if (state.night >= NIGHTS.length) {
        state.nightsSurvived = NIGHTS.length;
        state.score += 500;
        return endRun(true);
      }
      state.nightsSurvived = state.night;
      state.night += 1;
      state.nightElapsed = 0;
      state.score += 120 * state.nightsSurvived;
      state.flares = Math.min(FLARE.max, state.flares + FLARE.refillPerNight);
      state.light = clamp(state.light + 0.14, 0, 1);
      for (const soul of souls) soul.active = false;
      state.soulTimer = SOULS.firstDelay;
      addWolves(nightPlan().wolves);
      events |= EVENT_NIGHT;
    }

    // Movement: velocity chases the input, so the lantern has weight without feeling late.
    const inputLength = Math.hypot(input.x, input.y);
    const normalised = inputLength > 1 ? { x: input.x / inputLength, y: input.y / inputLength } : input;
    const targetVx = normalised.x * PLAYER.speed;
    const targetVy = normalised.y * PLAYER.speed;
    const chase = Math.min(1, PLAYER.response * dt);
    player.vx += (targetVx - player.vx) * chase;
    player.vy += (targetVy - player.vy) * chase;
    player.x = clamp(player.x + player.vx * dt, PLAYER.radius + 8, WORLD.width - PLAYER.radius - 8);
    player.y = clamp(player.y + player.vy * dt, PLAYER.radius + 8, WORLD.height - PLAYER.radius - 8);
    if (Math.abs(player.vx) > 6) player.facing = player.vx > 0 ? 1 : -1;

    // The lantern burns faster while you run, and each night burns hotter.
    const speed = Math.hypot(player.vx, player.vy) / PLAYER.speed;
    const drain = LIGHT.drainIdle + (LIGHT.drainMoving - LIGHT.drainIdle) * speed
      + LIGHT.drainPerNight * (state.night - 1);
    if (!harmless) state.light = clamp(state.light - drain * dt, 0, 1);

    // Firefly pools: standing in one refills the lantern and keeps the wolves at bay.
    state.drinking = 0;
    for (const pool of pools) {
      if (pool.charge <= 0) {
        pool.charge = Math.min(1, pool.charge + dt / POOLS.refillSeconds);
        continue;
      }
      const dx = player.x - pool.x;
      const dy = player.y - pool.y;
      if (dx * dx + dy * dy > (POOLS.radius - 8) * (POOLS.radius - 8)) continue;
      const sip = Math.min(pool.charge, LIGHT.poolGainPerSecond * dt);
      state.light = clamp(state.light + sip, 0, 1);
      pool.charge -= sip;
      state.drinking = pool.charge > 0 ? 1 : 0;
      if (!harmless) events |= EVENT_DRINK;
    }

    // Souls: they appear in the dark and are lost if the lantern goes out near them.
    if (!harmless) {
      state.soulTimer -= dt;
      if (state.soulTimer <= 0) {
        spawnSoul();
        state.soulTimer = SOULS.interval + random() * SOULS.intervalJitter;
      }
    }
    const radius = lightRadius();
    for (const soul of souls) {
      if (!soul.active) continue;
      soul.life += dt;
      soul.phase += dt * 2.1;
      const dx = player.x - soul.x;
      const dy = player.y - soul.y;
      const distance = Math.hypot(dx, dy);
      if (distance > radius * 2.6) {
        soul.active = false;
        continue;
      }
      if (distance < PLAYER.radius + SOULS.radius + 8 && !harmless) {
        soul.active = false;
        state.soulsSaved += 1;
        state.score += SOULS.points * state.night;
        state.light = clamp(state.light + LIGHT.soulGain, 0, 1);
        events |= EVENT_SOUL;
      }
    }

    // Wolves: they circle outside the light, then commit to a run when it dims.
    state.grace = Math.max(0, (state.grace || 0) - dt);
    for (const wolf of state.wolves) {
      if (!wolf.active) continue;
      wolf.phase += dt * 3.4;
      wolf.bite = Math.max(0, wolf.bite - dt);
      const dx = player.x - wolf.x;
      const dy = player.y - wolf.y;
      const distance = Math.hypot(dx, dy) || 1;

      if (wolf.state === WOLF_FLEE) {
        wolf.timer -= dt;
        wolf.x = clamp(wolf.x + wolf.vx * dt, -40, WORLD.width + 40);
        wolf.y = clamp(wolf.y + wolf.vy * dt, -40, WORLD.height + 40);
        if (wolf.timer <= 0) {
          wolf.state = WOLF_ORBIT;
          wolf.orbit = radius + WOLF.orbitGap + random() * WOLF.orbitGapJitter;
          wolf.timer = random.between(WOLF.patienceMin, WOLF.patienceMax);
        }
        continue;
      }

      if (wolf.state === WOLF_CHARGE) {
        const speed = WOLF.chargeSpeed + WOLF.chargeSpeedPerNight * (state.night - 1);
        wolf.x += wolf.vx * dt;
        wolf.y += wolf.vy * dt;
        wolf.x = clamp(wolf.x, -40, WORLD.width + 40);
        wolf.y = clamp(wolf.y, -40, WORLD.height + 40);
        if (distance < PLAYER.radius + WOLF.radius + 2 && !harmless && wolf.bite === 0 && state.grace <= 0) {
          wolf.bite = WOLF.biteCooldown;
          // A grace window after a bite: without it a pack surrounds the lantern and drains it in
          // one second, which reads as a broken game rather than a hard one.
          state.grace = LIGHT.graceAfterBite;
          state.light = clamp(state.light - LIGHT.hitLoss, 0, 1);
          wolf.state = WOLF_ORBIT;
          wolf.orbit = radius + WOLF.orbitGap;
          wolf.timer = random.between(WOLF.patienceMin, WOLF.patienceMax);
          events |= EVENT_BITE;
          if (state.light <= 0) return endRun(false) | events;
          continue;
        }
        wolf.timer -= dt;
        if (wolf.timer <= 0) {
          wolf.state = WOLF_ORBIT;
          wolf.orbit = radius + WOLF.orbitGap + random() * WOLF.orbitGapJitter;
          wolf.timer = random.between(WOLF.patienceMin, WOLF.patienceMax);
        }
        continue;
      }

      if (wolf.state === WOLF_STALK) {
        wolf.timer -= dt;
        // Sneak in, keeping just outside the light until it commits.
        const wantX = player.x + (dx / distance) * (radius + WOLF.radius + 6);
        const wantY = player.y + (dy / distance) * (radius + WOLF.radius + 6);
        wolf.x += (wantX - wolf.x) * Math.min(1, 1.7 * dt);
        wolf.y += (wantY - wolf.y) * Math.min(1, 1.7 * dt);
        if (wolf.timer <= 0) {
          const length = Math.hypot(dx, dy) || 1;
          const speed = WOLF.chargeSpeed + WOLF.chargeSpeedPerNight * (state.night - 1);
          wolf.vx = (-dx / length) * speed;
          wolf.vy = (-dy / length) * speed;
          // Aim through the player, so a straight run can be side-stepped but a lazy one cannot.
          wolf.targetX = player.x;
          wolf.targetY = player.y;
          wolf.timer = (distance + WOLF.chargeOvershoot) / speed;
          wolf.state = WOLF_CHARGE;
        }
        continue;
      }

      // Orbit: circle at a distance the light barely reaches and look for an opening.
      const orbitSpeed = WOLF.orbitSpeed + WOLF.orbitSpeedPerNight * (state.night - 1);
      wolf.angle += (orbitSpeed / Math.max(60, wolf.orbit)) * dt;
      const wantX = player.x + Math.cos(wolf.angle) * wolf.orbit;
      const wantY = player.y + Math.sin(wolf.angle) * wolf.orbit;
      wolf.x += (wantX - wolf.x) * Math.min(1, 2.4 * dt);
      wolf.y += (wantY - wolf.y) * Math.min(1, 2.4 * dt);
      wolf.timer -= dt;
      const dim = radius < wolf.orbit + 10;
      if (!harmless && wolf.timer <= 0 && (dim || state.light < WOLF.fearThreshold)) {
        wolf.state = WOLF_STALK;
        wolf.timer = random.between(0.5, 1.1);
      }
    }

    if (state.light <= 0 && !harmless) return endRun(false) | events;
    return events;
  }

  reset();
  return { state, reset, step, strike, lightRadius };
}
