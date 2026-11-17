// Every tuning number and colour for EMBERLIGHT lives here, so the rules read the same
// however the window is scaled. The clearing is bigger than the view: the camera keeps the
// lantern centred and the forest edge is something you can find.

/** The clearing the player moves through, in world units. */
export const WORLD = { width: 2400, height: 1500 };

/** The slice of the clearing a frame shows; the camera moves over the rest. */
export const VIEW = { width: 1280, height: 720 };

/** The simulation's fixed step, in seconds: 60 updates a second whatever the display rate. */
export const STEP = 1 / 60;

export const PLAYER = {
  radius: 13,
  speed: 238,
  /** How quickly velocity chases the input direction, in units of 1/seconds. */
  response: 14,
  bump: 1.15,
};

/** The lantern: the whole game. `light` runs 0..1, and 0 is the end of the run. */
export const LIGHT = {
  start: 0.72,
  radiusMin: 250,
  radiusMax: 470,
  /** Light spent per second standing still, and per second at full speed. */
  drainIdle: 0.009,
  drainMoving: 0.017,
  /** Each night burns a little hotter than the one before it. */
  drainPerNight: 0.0016,
  /** What a rescued soul and a firefly pool give back. */
  soulGain: 0.24,
  poolGainPerSecond: 0.34,
  hitLoss: 0.07,
  /** Seconds of safety after a bite, so a pack cannot drain the lantern at once. */
  graceAfterBite: 1.5,
};

export const SOULS = {
  maxAlive: 5,
  firstDelay: 1.4,
  interval: 2.4,
  intervalJitter: 1.6,
  radius: 9,
  /** Where a soul may appear, measured from the player: close enough to see glow, far enough to cost. */
  minDistance: 210,
  maxDistance: 520,
  points: 25,
};

export const POOLS = {
  count: 4,
  radius: 74,
  /** A pool dims as it is drunk from, and comes back over this many seconds. */
  refillSeconds: 14,
  minDistance: 280,
  maxDistance: 620,
};

export const WOLF = {
  radius: 19,
  /** Orbit speed at night 1, and the extra it gains each night. */
  orbitSpeed: 92,
  orbitSpeedPerNight: 11,
  /** Distance beyond the player's light where a wolf circles, waiting. */
  orbitGap: 54,
  orbitGapJitter: 46,
  /** How long a wolf waits at the edge of the light before it commits to a run. */
  patienceMin: 2.4,
  patienceMax: 4.8,
  chargeSpeed: 236,
  chargeSpeedPerNight: 22,
  /** A wolf breaks off a charge this far past the player and orbits again. */
  chargeOvershoot: 120,
  biteCooldown: 1.7,
  /** Light past this keeps a wolf from starting a run at all. */
  fearThreshold: 0.82,
};

/** Night 1..N: how many wolves, and how long the night lasts in seconds. */
export const NIGHTS = [
  { wolves: 2, seconds: 30 },
  { wolves: 3, seconds: 32 },
  { wolves: 4, seconds: 34 },
  { wolves: 5, seconds: 34 },
  { wolves: 6, seconds: 36 },
  { wolves: 7, seconds: 38 },
];

export const FLARE = {
  charges: 2,
  refillPerNight: 1,
  max: 4,
  radius: 268,
  /** Seconds a scared wolf keeps running. */
  stun: 2.1,
  cooldown: 0.8,
  /** Flares cost a little light to strike. */
  lightCost: 0.03,
};

export const PALETTE = {
  void: '#080c14',
  night: '#16202f',
  haze: '#26354a',
  moss: '#2e4a3d',
  trunk: '#1a2634',
  lantern: '#ffb257',
  lanternCore: '#ffe6b8',
  ember: '#ff8a3d',
  soul: '#8fe9ff',
  soulCore: '#eafcff',
  firefly: '#b8ff8a',
  wolf: '#55637d',
  wolfRim: '#7d8fae',
  eye: '#ff5b3d',
  text: '#f2f5fa',
  muted: '#9aa6b9',
  danger: '#ff6b4a',
  gold: '#f5c972',
  pool: '#7ce0a0',
  edge: '#2c3a4f',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
export const FONT_DISPLAY = 'Georgia, "Times New Roman", serif';

export const BEST_KEY = 'emberlight.best';
