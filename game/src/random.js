// A seeded random source so a ?seed=N replay is identical, and so screenshot scenes are
// reproducible. mulberry32: small, fast, good enough for placement and jitter.

export function createRandom(seed) {
  let state = (seed >>> 0) || 1;
  function next() {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  next.between = (low, high) => low + next() * (high - low);
  next.int = (low, high) => Math.floor(low + next() * (high - low + 1));
  next.pick = (list) => list[Math.floor(next() * list.length) % list.length];
  return next;
}

/** Deterministic value in 0..1 from an integer pair, for stable per-cell decoration. */
export function hash2(x, y) {
  let h = Math.imul(x, 374761393) ^ Math.imul(y, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
