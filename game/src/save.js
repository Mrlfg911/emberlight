// What the wood remembers between visits: which regions are open, the best run in each, and the
// souls carried out. localStorage is wrapped so a browser that refuses it (private mode, a locked
// profile) still plays: the save simply lives in memory for the session.

import { REGIONS } from './regions.js';

const KEY = 'emberlight.save.v2';

function blank() {
  return {
    cleared: {},
    best: {},
    souls: {},
    embers: 0,
    runs: 0,
    lastRegion: REGIONS[0].id,
  };
}

function storage() {
  try {
    const probe = '__emberlight_probe__';
    window.localStorage.setItem(probe, '1');
    window.localStorage.removeItem(probe);
    return window.localStorage;
  } catch (error) {
    return null;
  }
}

export function loadSave() {
  const store = storage();
  if (!store) return blank();
  try {
    const raw = store.getItem(KEY);
    if (!raw) return blank();
    const parsed = JSON.parse(raw);
    const fresh = blank();
    return {
      cleared: { ...fresh.cleared, ...(parsed.cleared || {}) },
      best: { ...fresh.best, ...(parsed.best || {}) },
      souls: { ...fresh.souls, ...(parsed.souls || {}) },
      embers: Number(parsed.embers) || 0,
      runs: Number(parsed.runs) || 0,
      lastRegion: parsed.lastRegion || fresh.lastRegion,
    };
  } catch (error) {
    return blank();
  }
}

export function writeSave(save) {
  const store = storage();
  if (!store) return false;
  try {
    store.setItem(KEY, JSON.stringify(save));
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Fold one finished run into the save. Returns the save, plus whether this run set a new best and
 * whether it opened the next region, so the results screen can say so.
 */
export function recordRun(save, region, run) {
  const before = { ...save.cleared };
  const previousBest = save.best[region.id] || 0;
  if (run.score > previousBest) save.best[region.id] = run.score;
  const carried = (save.souls[region.id] || 0) + run.souls;
  save.souls[region.id] = carried;
  if (run.won) save.cleared[region.id] = true;
  save.embers += run.embers || 0;
  save.runs += 1;
  save.lastRegion = region.id;
  writeSave(save);
  const opened = Object.keys(save.cleared).filter((id) => !before[id]);
  return {
    newBest: run.score > previousBest,
    opened: opened.map((id) => REGIONS.find((r) => r.id === id)).filter(Boolean),
    carried,
  };
}

export function resetSave() {
  const store = storage();
  if (!store) return;
  try {
    store.removeItem(KEY);
  } catch (error) {
    /* nothing to do: the session keeps playing from memory */
  }
}
