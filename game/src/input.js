// Keyboard and mouse, translated into a direction and a few actions. Nothing here knows what an
// action means: main.js decides. Held keys give a direction; Space starts, P pauses, F strikes a
// flare. Mouse or touch press also starts a run.
import { VIEW } from './config.js';

export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_FLARE = 4;

const LEFT = new Set(['ArrowLeft', 'KeyA']);
const RIGHT = new Set(['ArrowRight', 'KeyD']);
const UP = new Set(['ArrowUp', 'KeyW']);
const DOWN = new Set(['ArrowDown', 'KeyS']);

export function createInput(canvas) {
  const held = new Set();
  let pending = 0;

  function onKeyDown(event) {
    if (event.repeat) return;
    held.add(event.code);
    if (event.code === 'Space' || event.code === 'Enter') pending |= ACTION_CONFIRM;
    else if (event.code === 'KeyP' || event.code === 'Escape') pending |= ACTION_PAUSE;
    else if (event.code === 'KeyF' || event.code === 'ShiftLeft' || event.code === 'ShiftRight') pending |= ACTION_FLARE;
    if (event.code === 'Space' || event.code.startsWith('Arrow')) event.preventDefault();
  }

  function onKeyUp(event) {
    held.delete(event.code);
  }

  function onBlur() {
    held.clear();
  }

  function onPointerDown() {
    pending |= ACTION_CONFIRM;
  }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', onBlur);
  canvas.addEventListener('pointerdown', onPointerDown);

  function direction() {
    let x = 0;
    let y = 0;
    for (const code of held) {
      if (LEFT.has(code)) x -= 1;
      else if (RIGHT.has(code)) x += 1;
      else if (UP.has(code)) y -= 1;
      else if (DOWN.has(code)) y += 1;
    }
    return { x, y };
  }

  function takeActions() {
    const actions = pending;
    pending = 0;
    return actions;
  }

  return { direction, takeActions, dispose() {
    window.removeEventListener('keydown', onKeyDown);
    window.removeEventListener('keyup', onKeyUp);
    window.removeEventListener('blur', onBlur);
    canvas.removeEventListener('pointerdown', onPointerDown);
  } };
}

/** Screen coordinates to the fixed playfield, for pointer-aimed effects. */
export function fieldPoint(canvas, clientX, clientY) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: ((clientX - rect.left) / rect.width) * VIEW.width,
    y: ((clientY - rect.top) / rect.height) * VIEW.height,
  };
}
