// Everything you see: the forest floor, the lantern's cone of light and the darkness pressing in on
// it, the souls, the firefly pools, the wolves and the HUD. Drawing only reads state; it never
// changes a rule. The world is larger than the window, so the camera keeps the lantern near the
// centre and everything in the clearing is drawn through one translate.
import {
  FONT, FONT_DISPLAY, LIGHT, PALETTE, PLAYER, POOLS, VIEW, WOLF, WORLD,
} from './config.js';
import { REGIONS, isUnlocked } from './regions.js';
import { createBackdrop } from './backdrop.js';

/** The palette in force: PALETTE with the current region's colours folded over it. */
let palette = { ...PALETTE };

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';
export const SCREEN_WON = 'won';
export const SCREEN_SELECT = 'select';

const TAU = Math.PI * 2;

/** Deterministic scatter, so the same seed draws the same clearing. */
function scatter(seed, count) {
  const points = [];
  let value = seed >>> 0 || 7;
  for (let index = 0; index < count; index += 1) {
    value = (Math.imul(value, 1664525) + 1013904223) >>> 0;
    const x = (value % 100000) / 100000;
    value = (Math.imul(value, 1664525) + 1013904223) >>> 0;
    const y = (value % 100000) / 100000;
    value = (Math.imul(value, 1664525) + 1013904223) >>> 0;
    const r = (value % 1000) / 1000;
    points.push({ x: x * WORLD.width, y: y * WORLD.height, r });
  }
  return points;
}

// ?only=ground,wolves limits drawing to those layers, so a visual defect can be bisected
// without editing code. ?shadow=nodarkness / nowarm / noflare drops one part of the light pass.
const params = new URLSearchParams(typeof location !== 'undefined' ? location.search : '');
const debugLayers = params.get('only') ? new Set(params.get('only').split(',')) : null;
const shadowSkip = new Set((params.get('shadow') || '').split(',').filter(Boolean));

export function createRenderer(canvas) {
  const context = canvas.getContext('2d', { alpha: false });
  let region = REGIONS[0];
  let backdrop = createBackdrop(region, VIEW.height + 260);
  let particles = null;

  /** Point the renderer at a region: its palette, and its horizon. */
  function useRegion(next, particleSystem) {
    region = next;
    palette = { ...PALETTE, ...(next.palette || {}) };
    backdrop = createBackdrop(next, VIEW.height + 260);
    if (particleSystem) particles = particleSystem;
  }
  const grass = scatter(1201, 1400);
  const stones = scatter(9341, 150);
  const trunks = scatter(3313, 120);
  const motes = scatter(5521, 150);
  let scale = 1;
  let offsetX = 0;
  let offsetY = 0;
  const camera = { x: WORLD.width / 2, y: WORLD.height / 2 };

  function resize() {
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    const width = Math.max(320, Math.floor(canvas.clientWidth * ratio));
    const height = Math.max(180, Math.floor(canvas.clientHeight * ratio));
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
    scale = Math.min(width / VIEW.width, height / VIEW.height);
    offsetX = (width - VIEW.width * scale) / 2;
    offsetY = (height - VIEW.height * scale) / 2;
  }

  /** Follow the lantern, but never show past the clearing's edge. */
  function follow(state) {
    const halfW = VIEW.width / 2;
    const halfH = VIEW.height / 2;
    const targetX = WORLD.width > VIEW.width ? Math.max(halfW, Math.min(WORLD.width - halfW, state.player.x)) : WORLD.width / 2;
    const targetY = WORLD.height > VIEW.height ? Math.max(halfH, Math.min(WORLD.height - halfH, state.player.y)) : WORLD.height / 2;
    // Snap when the camera is far behind (a staged screenshot paints twice; a teleport would
    // otherwise leave the lantern off screen), then ease normally while playing.
    const gap = Math.hypot(targetX - camera.x, targetY - camera.y);
    const rate = gap > 160 ? 1 : 0.14;
    camera.x += (targetX - camera.x) * rate;
    camera.y += (targetY - camera.y) * rate;
  }

  function ground(state) {
    const left = camera.x - VIEW.width / 2;
    const top = camera.y - VIEW.height / 2;

    context.fillStyle = palette.void;
    context.fillRect(left, top, VIEW.width, VIEW.height);

    // The horizon, scrolled at its own rate, so the wood has depth behind the floor.
    context.save();
    context.translate(0, top);
    backdrop.draw(context, camera, VIEW.width);
    context.restore();

    // The clearing itself, so the forest reads as a place with an edge you can lose.
    const sky = context.createRadialGradient(WORLD.width / 2, WORLD.height / 2, 120, WORLD.width / 2, WORLD.height / 2, WORLD.width * 0.62);
    sky.addColorStop(0, palette.haze);
    sky.addColorStop(0.5, palette.night);
    sky.addColorStop(1, '#070b12');
    context.fillStyle = sky;
    context.fillRect(0, 0, WORLD.width, WORLD.height);

    context.strokeStyle = 'rgba(120,150,190,0.10)';
    context.lineWidth = 3;
    context.strokeRect(4, 4, WORLD.width - 8, WORLD.height - 8);

    for (const trunk of trunks) {
      const height = 26 + trunk.r * 44;
      const width = 7 + trunk.r * 13;
      context.fillStyle = palette.trunk;
      context.fillRect(trunk.x - width / 2, trunk.y - height / 2, width, height);
      context.strokeStyle = 'rgba(120,145,180,0.10)';
      context.lineWidth = 1.2;
      context.strokeRect(trunk.x - width / 2, trunk.y - height / 2, width, height);
    }

    for (const blade of grass) {
      const height = 7 + blade.r * 18;
      context.strokeStyle = blade.r > 0.72 ? 'rgba(38,62,52,0.85)' : 'rgba(14,24,20,0.9)';
      context.lineWidth = 1.5;
      context.beginPath();
      context.moveTo(blade.x, blade.y);
      context.quadraticCurveTo(blade.x - 3 + blade.r * 6, blade.y - height * 0.6, blade.x - 5 + blade.r * 10, blade.y - height);
      context.stroke();
    }

    for (const stone of stones) {
      context.fillStyle = stone.r > 0.6 ? '#161d29' : '#111721';
      context.beginPath();
      context.ellipse(stone.x, stone.y, 6 + stone.r * 12, 4 + stone.r * 7, stone.r * TAU, 0, TAU);
      context.fill();
    }
  }

  /** The darkness: everything outside the lantern's reach is crushed toward black. */
  function shadow(state) {
    const radius = lightRadius(state);
    const light = Math.max(0, Math.min(1, state.light));
    const flicker = 1 + Math.sin(state.elapsed * 7.3) * 0.02 + Math.sin(state.elapsed * 3.1) * 0.014;
    const reach = radius * flicker * (1 + state.flareGlow * 0.55);
    const px = state.player.x;
    const py = state.player.y;

    // A radial gradient is drawn in view space, so it is placed where the lantern is on screen.
    const sx = px - camera.x + VIEW.width / 2;
    const sy = py - camera.y + VIEW.height / 2;

    const darkness = context.createRadialGradient(sx, sy, reach * 0.34, sx, sy, reach * 2.6);
    darkness.addColorStop(0, 'rgba(4,7,14,0)');
    darkness.addColorStop(0.36, 'rgba(4,7,14,0.10)');
    darkness.addColorStop(0.6, 'rgba(4,6,12,0.30)');
    darkness.addColorStop(0.82, 'rgba(3,5,11,0.52)');
    darkness.addColorStop(1, 'rgba(3,5,11,0.66)');
    if (!shadowSkip.has('nodarkness')) {
      context.fillStyle = darkness;
      context.fillRect(0, 0, VIEW.width, VIEW.height);
    }

    const warm = context.createRadialGradient(sx, sy, 0, sx, sy, reach);
    warm.addColorStop(0, `rgba(255,200,134,${0.34 * light + 0.10})`);
    warm.addColorStop(0.34, `rgba(255,164,96,${0.17 * light})`);
    warm.addColorStop(0.7, `rgba(214,120,64,${0.06 * light})`);
    warm.addColorStop(1, 'rgba(120,60,30,0)');
    if (!shadowSkip.has('nowarm')) {
      context.fillStyle = warm;
      context.fillRect(0, 0, VIEW.width, VIEW.height);
    }

    if (state.flareGlow > 0.01) {
      const flash = context.createRadialGradient(sx, sy, 0, sx, sy, 560 * state.flareGlow);
      flash.addColorStop(0, `rgba(255,232,190,${0.5 * state.flareGlow})`);
      flash.addColorStop(1, 'rgba(255,150,80,0)');
      if (!shadowSkip.has('noflare')) {
        context.fillStyle = flash;
        context.fillRect(0, 0, VIEW.width, VIEW.height);
      }
    }
  }

  function pools(state) {
    for (const pool of state.pools) {
      if (pool.charge <= 0.02) continue;
      const pulse = 1 + Math.sin(state.elapsed * 2.1 + pool.x) * 0.05;
      const radius = POOLS.radius * pulse * (0.5 + pool.charge * 0.5);
      const glow = context.createRadialGradient(pool.x, pool.y, 0, pool.x, pool.y, radius);
      glow.addColorStop(0, `rgba(150,255,190,${0.36 * pool.charge})`);
      glow.addColorStop(0.5, `rgba(90,220,150,${0.15 * pool.charge})`);
      glow.addColorStop(1, 'rgba(60,180,120,0)');
      context.fillStyle = glow;
      context.beginPath();
      context.arc(pool.x, pool.y, radius, 0, TAU);
      context.fill();

      context.strokeStyle = `rgba(190,255,215,${0.28 * pool.charge})`;
      context.lineWidth = 1.8;
      context.beginPath();
      context.arc(pool.x, pool.y, radius * 0.44, 0, TAU);
      context.stroke();

      for (let index = 0; index < 11; index += 1) {
        const angle = (index / 11) * TAU + state.elapsed * 0.6;
        const distance = radius * (0.3 + ((index * 7) % 10) / 22);
        const px = pool.x + Math.cos(angle) * distance;
        const py = pool.y + Math.sin(angle) * distance * 0.82;
        context.fillStyle = `rgba(210,255,170,${0.9 * pool.charge})`;
        context.beginPath();
        context.arc(px, py, 2.1, 0, TAU);
        context.fill();
      }
    }
  }

  function souls(state) {
    const radius = lightRadius(state);
    for (const soul of state.souls) {
      if (!soul.active) continue;
      const distance = Math.hypot(soul.x - state.player.x, soul.y - state.player.y);
      const near = Math.max(0, 1 - distance / (radius * 2.2));
      const bob = Math.sin(soul.phase) * 5;
      const y = soul.y + bob;
      const halo = context.createRadialGradient(soul.x, y, 0, soul.x, y, 44);
      halo.addColorStop(0, `rgba(180,240,255,${0.5 + near * 0.4})`);
      halo.addColorStop(0.45, 'rgba(120,200,255,0.2)');
      halo.addColorStop(1, 'rgba(80,160,255,0)');
      context.fillStyle = halo;
      context.beginPath();
      context.arc(soul.x, y, 44, 0, TAU);
      context.fill();
      // A filled diamond, not a ring: three thin circles on one screen read as one language.
      const size = 7.4 + Math.sin(soul.phase * 1.9) * 0.9;
      context.fillStyle = palette.soulCore;
      context.beginPath();
      context.moveTo(soul.x, y - size);
      context.lineTo(soul.x + size * 0.74, y);
      context.lineTo(soul.x, y + size);
      context.lineTo(soul.x - size * 0.74, y);
      context.closePath();
      context.fill();
      context.fillStyle = `rgba(180,240,255,${0.35 + near * 0.4})`;
      context.beginPath();
      context.moveTo(soul.x, y - size * 1.7);
      context.lineTo(soul.x + size * 1.15, y);
      context.lineTo(soul.x, y + size * 1.7);
      context.lineTo(soul.x - size * 1.15, y);
      context.closePath();
      context.fill();
    }
  }

  function ctxFill(colour) {
    context.fillStyle = colour;
  }

  function wolves(state) {
    const radius = lightRadius(state);
    for (const wolf of state.wolves) {
      if (!wolf.active) continue;
      const distance = Math.hypot(wolf.x - state.player.x, wolf.y - state.player.y);
      const lit = Math.max(0, Math.min(1, 1 - distance / (radius * 1.8)));
      const charging = wolf.state === 2;

      // A wolf is read from distance by four things in order: four legs with gaps between them,
      // two ear triangles that break the skull line, a jaw notch that separates muzzle from chest,
      // and a thick tapered tail. Everything below exaggerates those four, because at 60 px the
      // rest of the anatomy is not worth drawing.
      const S = 1.42;
      const body = charging ? '#7a5f74' : '#6f8099';
      const edge = charging ? '#ff9ab4' : '#c8dafc';

      context.save();
      context.translate(wolf.x, wolf.y);
      // A soft shadow under the animal, offset away from the lantern, so it is standing on the
      // ground rather than pasted onto it.
      const shade = context.createRadialGradient(0, 6, 2, 0, 6, 22);
      shade.addColorStop(0, 'rgba(2,4,8,0.55)');
      shade.addColorStop(1, 'rgba(2,4,8,0)');
      context.fillStyle = shade;
      context.beginPath();
      context.ellipse(0, 6, 22, 11, 0, 0, TAU);
      context.fill();
      const heading = charging
        ? Math.atan2(wolf.vy, wolf.vx)
        : Math.atan2(state.player.y - wolf.y, state.player.x - wolf.x);
      context.rotate(heading);
      context.scale(S, S);

      ctxFill(body);

      // Legs first, and wide: each leg reaches well past the belly so the silhouette is broken
      // by real gaps of ground rather than reading as one solid slug. The body ellipse is 9.6
      // half-height, so a leg has to reach ~16 to show any limb at all.
      const gait = Math.sin(wolf.phase * 2.2);
      for (const leg of [
        [12, -1, 1], [12, 1, -1], [-11, -1, -1], [-11, 1, 1],
      ]) {
        const side = leg[1] < 0 ? -1 : 1;
        const foot = side * (16 + Math.abs(gait) * 1.8);
        // A dark under-stroke first, so two adjacent legs never merge into one shape.
        context.lineCap = 'round';
        context.strokeStyle = '#1b2230';
        context.lineWidth = 5.4;
        context.beginPath();
        context.moveTo(leg[0], side * 4);
        context.lineTo(leg[0] + gait * 3.2 * leg[2], foot);
        context.stroke();
        context.strokeStyle = body;
        context.lineWidth = 3.4;
        context.beginPath();
        context.moveTo(leg[0], side * 4);
        context.lineTo(leg[0] + gait * 3.2 * leg[2], foot);
        context.stroke();
        context.fillStyle = body;
        context.beginPath();
        context.arc(leg[0] + gait * 3.2 * leg[2], foot, 2.4, 0, TAU);
        context.fill();
      }
      context.lineCap = 'butt';

      // Tail: a thick plume, thick at the root and tapering, carried low and straight back.
      // A two-lobed fan at the tip is what made the first attempt read as a fish.
      context.fillStyle = body;
      context.beginPath();
      context.moveTo(-14, -6.2);
      context.quadraticCurveTo(-26, -7.5 + Math.sin(wolf.phase) * 2, -36, -2.5 + Math.sin(wolf.phase) * 3);
      context.quadraticCurveTo(-38, 0.5 + Math.sin(wolf.phase) * 3, -36, 3.5 + Math.sin(wolf.phase) * 3);
      context.quadraticCurveTo(-26, 2.5 + Math.sin(wolf.phase) * 2, -14, 6.2);
      context.closePath();
      context.fill();

      // Haunch and chest: two masses, the chest heavier, so there is a front and a back.
      context.beginPath();
      context.ellipse(-9, 0, 10, 8.6, 0, 0, TAU);
      context.fill();
      context.beginPath();
      context.ellipse(2, 0, 15.5, 8.4, 0, 0, TAU);
      context.fill();

      // Neck wedges into the skull; the notch under the jaw is left as ground.
      context.beginPath();
      context.moveTo(9, -8);
      context.lineTo(19, -5.2);
      context.lineTo(19, 5.2);
      context.lineTo(9, 8);
      context.closePath();
      context.fill();

      // Skull, then the muzzle as its own tapered wedge, with a jaw notch between them.
      context.beginPath();
      context.ellipse(20, 0, 7.2, 6.6, 0, 0, TAU);
      context.fill();
      context.beginPath();
      context.moveTo(24, -3.6);
      context.lineTo(33.5, 0.4);
      context.lineTo(24, 3.9);
      context.closePath();
      context.fill();

      // Ears: tall triangles sitting on the skull, clearly notched away from it.
      for (const side of [-1, 1]) {
        context.beginPath();
        context.moveTo(17.5, side * 4.2);
        context.lineTo(19.5, side * 14.5);
        context.lineTo(23.5, side * 5.2);
        context.closePath();
        context.fill();
      }

      // One rim, on the light side only, and the same rim on every wolf so the pack reads as one
      // species regardless of which side of the lantern it is standing on.
      context.strokeStyle = edge;
      context.globalAlpha = 0.4 + lit * 0.45;
      context.lineWidth = 1.6;
      context.beginPath();
      context.ellipse(2, 0, 15.5, 8.4, 0, Math.PI * 1.02, Math.PI * 1.98);
      context.stroke();
      context.beginPath();
      context.ellipse(20, 0, 7.2, 6.6, 0, Math.PI * 1.05, Math.PI * 1.95);
      context.stroke();
      context.globalAlpha = 1;

      // Eyes: two hot points set wide on the muzzle end.
      context.fillStyle = charging ? '#ffd0e0' : '#ff5f7a';
      for (const side of [-1, 1]) {
        context.beginPath();
        context.ellipse(23.5, side * 3.1, 1.9, 1.4, 0, 0, TAU);
        context.fill();
      }
      if (charging) {
        const glare = context.createRadialGradient(24, 0, 1, 24, 0, 19);
        glare.addColorStop(0, 'rgba(255,120,78,0.3)');
        glare.addColorStop(1, 'rgba(255,90,50,0)');
        context.fillStyle = glare;
        context.beginPath();
        context.arc(24, 0, 19, 0, TAU);
        context.fill();
      }
      context.restore();
    }
  }

  function lantern(state) {
    const radius = lightRadius(state);
    const x = state.player.x;
    const y = state.player.y;
    const facing = state.player.facing;
    const flicker = 1 + Math.sin(state.elapsed * 9.1) * 0.05;

    // The lamp hangs out to the side of the body, not over it. Put the brightest point under the
    // figure and the figure disappears: whatever is most lit reads as an object, not a person.
    const lampX = facing * 15;
    const lampY = 6;

    const halo = context.createRadialGradient(x + lampX, y + lampY, 0, x + lampX, y + lampY, radius * 0.62 * flicker);
    halo.addColorStop(0, 'rgba(255,238,200,0.40)');
    halo.addColorStop(0.2, 'rgba(255,196,120,0.32)');
    halo.addColorStop(0.55, 'rgba(255,150,70,0.12)');
    halo.addColorStop(1, 'rgba(255,120,40,0)');
    context.fillStyle = halo;
    context.beginPath();
    context.arc(x + lampX, y + lampY, radius * 0.55 * flicker, 0, TAU);
    context.fill();

    context.save();
    context.translate(x, y);
    // A dark pad under the figure, so the pale parts of it are read against darkness even when
    // the lantern is at its brightest.
    const pad = context.createRadialGradient(0, 10, 4, 0, 10, 30);
    pad.addColorStop(0, 'rgba(3,6,11,0.9)');
    pad.addColorStop(0.7, 'rgba(3,6,11,0.6)');
    pad.addColorStop(1, 'rgba(3,6,11,0)');
    context.fillStyle = pad;
    context.beginPath();
    context.ellipse(0, 10, 30, 22, 0, 0, TAU);
    context.fill();

    const stride = Math.sin(state.elapsed * 9) * (Math.hypot(state.player.vx, state.player.vy) > 30 ? 2.8 : 0.5);
    context.scale(1.5, 1.5);

    // Legs: two dark strokes with ground between them.
    context.strokeStyle = '#080d14';
    context.lineWidth = 4.4;
    context.lineCap = 'round';
    for (const side of [-1, 1]) {
      context.beginPath();
      context.moveTo(side * 4, 3);
      context.lineTo(side * 5 + stride * side, 14);
      context.stroke();
    }
    context.lineCap = 'butt';

    // The coat: near-black, so the body is the darkest solid on screen and the rim is what reads.
    context.fillStyle = '#0c141f';
    context.beginPath();
    context.moveTo(-7.5, -7);
    context.lineTo(7.5, -7);
    context.lineTo(9.5, 7);
    context.lineTo(-9.5, 7);
    context.closePath();
    context.fill();

    // A warm rim down the lit side and along the shoulders: this is the shape a viewer latches on.
    context.strokeStyle = 'rgba(255,214,158,0.95)';
    context.lineWidth = 2.1;
    context.beginPath();
    context.moveTo(-7.5, -7);
    context.lineTo(-9.5, 7);
    context.stroke();
    context.beginPath();
    context.moveTo(-7.5, -7);
    context.lineTo(7.5, -7);
    context.stroke();

    // The scarf, the one cool colour the player owns.
    context.fillStyle = '#b9d6ff';
    context.beginPath();
    context.ellipse(0, -7.2, 7.2, 2.4, 0, 0, TAU);
    context.fill();

    // Hood: filled, and sitting low enough to overlap the collar, so head and body are one
    // silhouette with a neck rather than a ring floating above a mass.
    context.fillStyle = '#16212f';
    context.beginPath();
    context.arc(0, -9.4, 6.6, 0, TAU);
    context.fill();
    // Shoulders, drawn after the head, welding the two masses together.
    context.fillStyle = '#0c141f';
    context.beginPath();
    context.moveTo(-8.4, -6.6);
    context.quadraticCurveTo(0, -12.4, 8.4, -6.6);
    context.lineTo(8.4, -4);
    context.lineTo(-8.4, -4);
    context.closePath();
    context.fill();
    // A warm rim over the crown, on the lamp side only, so the head turns with the light.
    context.strokeStyle = 'rgba(255,214,158,0.9)';
    context.lineWidth = 1.9;
    context.beginPath();
    context.arc(0, -9.4, 6.6, Math.PI * (facing > 0 ? 1.02 : 1.3), Math.PI * (facing > 0 ? 1.72 : 1.98));
    context.stroke();
    // The face, turned the way the player walks.
    context.fillStyle = 'rgba(255,231,196,0.92)';
    context.beginPath();
    context.ellipse(facing * 2.9, -9.4, 2.2, 2.6, 0, 0, TAU);
    context.fill();

    // The arm out to the lamp, and the lamp itself: small, hot, and clearly a held object.
    context.strokeStyle = '#101a27';
    context.lineWidth = 3.2;
    context.lineCap = 'round';
    context.beginPath();
    context.moveTo(facing * 5, -4);
    context.lineTo(lampX, lampY - 3);
    context.stroke();
    context.lineCap = 'butt';

    context.strokeStyle = 'rgba(255,214,160,0.8)';
    context.lineWidth = 1.3;
    context.beginPath();
    context.moveTo(lampX, lampY - 3);
    context.lineTo(lampX, lampY + 2);
    context.stroke();

    const lampGlow = context.createRadialGradient(lampX, lampY + 3, 0, lampX, lampY + 3, 22);
    lampGlow.addColorStop(0, 'rgba(255,248,224,0.95)');
    lampGlow.addColorStop(0.26, 'rgba(255,206,132,0.55)');
    lampGlow.addColorStop(1, 'rgba(255,150,70,0)');
    context.fillStyle = lampGlow;
    context.beginPath();
    context.arc(lampX, lampY + 3, 22, 0, TAU);
    context.fill();
    // A hard dark housing with a bright window: an object, not a glow stuck to the coat.
    context.fillStyle = '#0a0f16';
    context.beginPath();
    context.roundRect(lampX - 3.6, lampY - 0.4, 7.2, 8.4, 1.6);
    context.fill();
    context.fillStyle = palette.lanternCore;
    context.beginPath();
    context.arc(lampX, lampY + 3.2, 2.5, 0, TAU);
    context.fill();

    context.restore();
  }

  function motesDrift(state) {
    const radius = lightRadius(state);
    context.save();
    context.globalAlpha = 0.6;
    for (const mote of motes) {
      const x = (mote.x + state.elapsed * (6 + mote.r * 14)) % WORLD.width;
      const y = mote.y + Math.sin(state.elapsed * 0.9 + mote.r * 6) * 16;
      const distance = Math.hypot(x - state.player.x, y - state.player.y);
      const near = Math.max(0, 1 - distance / (radius * 1.15));
      if (near <= 0.02) continue;
      context.fillStyle = `rgba(255,214,160,${0.55 * near})`;
      context.beginPath();
      context.arc(x, y, 1.6, 0, TAU);
      context.fill();
    }
    context.restore();
  }

  function vignette() {
    const edge = context.createRadialGradient(VIEW.width / 2, VIEW.height / 2, VIEW.height * 0.46, VIEW.width / 2, VIEW.height / 2, VIEW.width * 0.78);
    edge.addColorStop(0, 'rgba(0,0,0,0)');
    edge.addColorStop(1, 'rgba(0,0,0,0.42)');
    context.fillStyle = edge;
    context.fillRect(0, 0, VIEW.width, VIEW.height);
  }

  /** The lantern meter, in the corner of the view rather than the world. */
  function meter(state) {
    const x = 96;
    const y = VIEW.height - 96;
    const light = Math.max(0, Math.min(1, state.light));
    context.save();
    context.strokeStyle = 'rgba(255,255,255,0.12)';
    context.lineWidth = 10;
    context.beginPath();
    context.arc(x, y, 44, 0, TAU);
    context.stroke();

    const grade = context.createLinearGradient(x - 44, y - 44, x + 44, y + 44);
    grade.addColorStop(0, light < 0.3 ? '#ff4e3a' : palette.gold);
    grade.addColorStop(1, light < 0.3 ? '#ff8a3d' : '#ffb257');
    context.strokeStyle = grade;
    context.lineCap = 'round';
    context.lineWidth = 10;
    context.beginPath();
    context.arc(x, y, 44, -Math.PI / 2, -Math.PI / 2 + TAU * light);
    context.stroke();
    context.lineCap = 'butt';

    context.fillStyle = palette.text;
    context.font = `700 24px ${FONT}`;
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText(`${Math.round(light * 100)}`, x, y - 3);
    context.font = `600 10px ${FONT}`;
    context.fillStyle = palette.muted;
    context.fillText('LIGHT %', x, y + 18);
    context.restore();
  }

  function hud(state) {
    context.save();
    // A scrim behind the top bar and the light dial. Wolves walk into the HUD otherwise, and a
    // wolf's silhouette over a night counter reads as neither.
    const scrim = context.createLinearGradient(0, 0, 0, 118);
    scrim.addColorStop(0, 'rgba(4,7,12,0.82)');
    scrim.addColorStop(0.72, 'rgba(4,7,12,0.36)');
    scrim.addColorStop(1, 'rgba(4,7,12,0)');
    context.fillStyle = scrim;
    context.fillRect(0, 0, VIEW.width, 118);
    const dial = context.createRadialGradient(96, VIEW.height - 66, 8, 96, VIEW.height - 66, 92);
    dial.addColorStop(0, 'rgba(4,7,12,0.72)');
    dial.addColorStop(1, 'rgba(4,7,12,0)');
    context.fillStyle = dial;
    context.fillRect(0, VIEW.height - 158, 200, 158);
    context.textBaseline = 'top';
    context.textAlign = 'left';
    context.fillStyle = palette.text;
    context.font = `700 24px ${FONT}`;
    context.fillText(String(state.score), 44, 34);
    context.font = `600 11px ${FONT}`;
    context.fillStyle = palette.muted;
    context.fillText('SCORE', 46, 74);

    // Night and its clock.
    const plan = state.nights[Math.min(state.night - 1, state.nights.length - 1)];
    const progress = Math.min(1, state.nightElapsed / plan.seconds);
    context.textAlign = 'center';
    context.fillStyle = palette.muted;
    context.font = `600 10px ${FONT}`;
    context.fillText(region.name.toUpperCase(), VIEW.width / 2, 14);
    context.fillStyle = palette.text;
    context.font = `700 21px ${FONT}`;
    context.fillText(`NIGHT ${state.night} OF ${state.nightCount}`, VIEW.width / 2, 30);
    context.fillStyle = 'rgba(255,255,255,0.14)';
    context.fillRect(VIEW.width / 2 - 120, 62, 240, 6);
    context.fillStyle = palette.lantern;
    context.fillRect(VIEW.width / 2 - 120, 62, 240 * progress, 6);
    context.fillStyle = palette.muted;
    context.font = `500 10px ${FONT}`;
    context.fillText(`${Math.max(0, Math.ceil(plan.seconds - state.nightElapsed))}s of dark left`, VIEW.width / 2, 74);

    // Souls and flares, top right.
    context.textAlign = 'right';
    context.fillStyle = palette.soul;
    context.font = `700 19px ${FONT}`;
    context.fillText(`◇ ${state.soulsSaved}/${state.soulsTarget}`, VIEW.width - 44, 32);
    context.fillStyle = palette.muted;
    context.font = `600 10px ${FONT}`;
    context.fillText('SOULS', VIEW.width - 44, 56);
    context.fillStyle = palette.gold;
    context.font = `700 19px ${FONT}`;
    context.fillText(`✦ ${state.flares}`, VIEW.width - 152, 32);
    context.fillStyle = palette.muted;
    context.font = `600 10px ${FONT}`;
    context.fillText('FLARES', VIEW.width - 152, 56);
    context.fillStyle = 'rgba(180,195,215,0.55)';
    context.font = `500 10px ${FONT}`;
    context.fillText('F flare · P pause', VIEW.width - 44, 78);
    context.restore();

    meter(state);
    warnRing(state);
  }

  /** A red pulse at the edge of the light when the lantern is nearly out. */
  function warnRing(state) {
    if (state.light > 0.26) return;
    const urgency = 1 - state.light / 0.26;
    const pulse = 0.5 + Math.sin(state.elapsed * (5 + urgency * 7)) * 0.5;
    const glow = context.createRadialGradient(VIEW.width / 2, VIEW.height / 2, VIEW.height * 0.28, VIEW.width / 2, VIEW.height / 2, VIEW.width * 0.7);
    glow.addColorStop(0, 'rgba(255,40,20,0)');
    glow.addColorStop(1, `rgba(255,40,20,${0.18 * urgency * (0.4 + pulse * 0.6)})`);
    context.fillStyle = glow;
    context.fillRect(0, 0, VIEW.width, VIEW.height);
  }

  function titleScreen(state, best) {
    context.save();
    context.fillStyle = 'rgba(4,6,11,0.76)';
    context.fillRect(0, 0, VIEW.width, VIEW.height);
    context.textAlign = 'center';
    context.fillStyle = palette.lanternCore;
    context.font = `700 92px ${FONT_DISPLAY}`;
    context.fillText('EMBERLIGHT', VIEW.width / 2, VIEW.height / 2 - 128);
    context.fillStyle = palette.lantern;
    context.font = `500 20px ${FONT}`;
    context.fillText('The dark is hungry. Your lantern is all you have.', VIEW.width / 2, VIEW.height / 2 - 68);
    context.fillStyle = palette.gold;
    context.font = `600 19px ${FONT}`;
    context.fillText('Light the lantern, cross four regions, gather the souls the dark left behind.', VIEW.width / 2, VIEW.height / 2 + 2);
    context.fillStyle = '#b9c4d4';
    context.font = `400 17px ${FONT}`;
    context.fillText('WASD or arrows to move · F strikes a flare and scatters the wolves · P pauses', VIEW.width / 2, VIEW.height / 2 + 36);
    context.fillStyle = palette.muted;
    context.font = `400 15px ${FONT}`;
    context.fillText('The lantern burns down as you move. Souls and pools are the only way back up.', VIEW.width / 2, VIEW.height / 2 + 68);
    const pulse = 0.55 + Math.sin(state.elapsed * 3.6) * 0.45;
    context.fillStyle = `rgba(255,232,190,${0.5 + pulse * 0.5})`;
    context.font = `700 23px ${FONT}`;
    context.fillText('PRESS SPACE OR CLICK TO LIGHT THE LANTERN', VIEW.width / 2, VIEW.height / 2 + 156);
    context.fillStyle = palette.muted;
    context.font = `500 14px ${FONT}`;
    context.fillText(best > 0 ? `Best run ${best}` : 'Four regions. One lantern.', VIEW.width / 2, VIEW.height / 2 + 200);
    context.restore();
  }

  function overScreen(state, best) {
    const won = state.won;
    context.save();
    context.fillStyle = `rgba(6,9,16,${won ? 0.86 : 0.9})`;
    context.fillRect(0, 0, VIEW.width, VIEW.height);
    context.textAlign = 'center';
    context.fillStyle = won ? palette.gold : palette.danger;
    context.font = `700 68px ${FONT_DISPLAY}`;
    context.fillText(won ? 'DAWN' : 'THE LANTERN DIES', VIEW.width / 2, VIEW.height / 2 - 150);
    if (won) {
      context.fillStyle = palette.gold;
      context.font = `600 16px ${FONT}`;
      context.fillText('EVERY NIGHT HELD', VIEW.width / 2, VIEW.height / 2 - 112);
    }
    context.fillStyle = '#c8d2e0';
    context.font = `400 18px ${FONT}`;
    context.fillText(won
      ? `${region.name} is quiet. Something past it is not.`
      : `The dark takes you on night ${state.night} of ${state.nightCount}.`, VIEW.width / 2, VIEW.height / 2 - 92);

    const rows = [
      ['Score', String(state.score)],
      ['Nights held', `${state.nightsSurvived} / ${state.nightCount}`],
      ['Souls rescued', String(state.soulsSaved)],
      ['Best', String(best)],
    ];
    const isNewBest = won && state.score >= best && state.score > 0;
    rows.forEach((row, index) => {
      const y = VIEW.height / 2 - 24 + index * 36;
      context.textAlign = 'right';
      context.fillStyle = palette.muted;
      context.font = `400 17px ${FONT}`;
      context.fillText(row[0], VIEW.width / 2 - 18, y);
      context.textAlign = 'left';
      context.fillStyle = palette.text;
      context.font = `700 18px ${FONT}`;
      context.fillText(row[1], VIEW.width / 2 + 18, y);
    });

    if (isNewBest) {
      context.textAlign = 'center';
      context.fillStyle = palette.gold;
      context.font = `700 15px ${FONT}`;
      context.fillText('NEW BEST', VIEW.width / 2, VIEW.height / 2 + 118);
    }
    const pulse = 0.55 + Math.sin(state.elapsed * 3.6) * 0.45;
    context.textAlign = 'center';
    context.fillStyle = `rgba(255,232,190,${0.5 + pulse * 0.5})`;
    context.font = `700 21px ${FONT}`;
    context.fillText('PRESS SPACE TO PLAY AGAIN', VIEW.width / 2, VIEW.height / 2 + 190);
    context.restore();
  }


  /** The map of the wood: four regions, the locked ones greyed, the cleared ones marked. */
  function selectScreen(state, save, cursor) {
    context.save();
    context.fillStyle = 'rgba(4,6,11,0.88)';
    context.fillRect(0, 0, VIEW.width, VIEW.height);
    context.textAlign = 'center';
    context.fillStyle = palette.lanternCore;
    context.font = `700 54px ${FONT_DISPLAY}`;
    context.fillText('THE WOOD', VIEW.width / 2, 66);
    context.fillStyle = palette.muted;
    context.font = `500 14px ${FONT}`;
    context.fillText(`${save.embers} embers carried out · ${save.runs} runs walked`, VIEW.width / 2, 96);
    context.fillStyle = 'rgba(150,170,200,0.72)';
    context.font = `400 12px ${FONT}`;
    context.fillText('A run ends when the lantern does. Souls gathered and embers carried out are kept.', VIEW.width / 2, 116);

    const cardW = 262;
    const cardH = 330;
    const gap = 26;
    const total = REGIONS.length * cardW + (REGIONS.length - 1) * gap;
    const startX = (VIEW.width - total) / 2;
    const top = 140;

    REGIONS.forEach((entry, index) => {
      const x = startX + index * (cardW + gap);
      const open = isUnlocked(save, index);
      const cleared = Boolean(save.cleared[entry.id]);
      const selected = index === cursor;

      // Card ground: the region's own colour, dimmed hard when locked.
      const tint = entry.palette.haze;
      context.globalAlpha = open ? 1 : 0.78;
      const ground = context.createLinearGradient(x, top, x, top + cardH);
      ground.addColorStop(0, tint);
      ground.addColorStop(1, '#0a0e16');
      context.fillStyle = ground;
      context.beginPath();
      context.roundRect(x, top, cardW, cardH, 10);
      context.fill();

      if (selected && open) {
        context.strokeStyle = palette.lantern;
        context.lineWidth = 2.6;
        context.setLineDash([]);
      } else if (selected) {
        // A locked card can still hold the cursor, so it needs its own ring rather than the
        // confident gold one that means "walk in".
        context.strokeStyle = 'rgba(190,205,230,0.55)';
        context.lineWidth = 2;
        context.setLineDash([4, 4]);
      } else if (open) {
        context.strokeStyle = 'rgba(170,190,220,0.3)';
        context.lineWidth = 1.3;
        context.setLineDash([]);
      } else {
        // Dashed, so a shut region never reads as merely unselected.
        context.strokeStyle = 'rgba(150,168,196,0.42)';
        context.lineWidth = 1.4;
        context.setLineDash([7, 6]);
      }
      context.stroke();
      context.setLineDash([]);
      context.globalAlpha = 1;

      // A skyline strip drawn from the region's own layer recipe would be heavy here; a band of
      // its accent colour plus its icon is enough to tell four places apart at a glance.
      context.save();
      context.beginPath();
      context.roundRect(x, top, cardW, cardH, 10);
      context.clip();
      context.fillStyle = entry.accent;
      context.globalAlpha = open ? 0.16 : 0.04;
      context.fillRect(x, top, cardW, 96);
      context.globalAlpha = 1;
      context.restore();

      context.textAlign = 'center';
      context.fillStyle = open ? palette.text : 'rgba(200,210,225,0.5)';
      context.font = `700 24px ${FONT_DISPLAY}`;
      context.fillText(entry.name, x + cardW / 2, top + 52);
      context.fillStyle = open ? entry.accent : 'rgba(180,195,215,0.45)';
      context.font = `500 12px ${FONT}`;
      context.fillText(entry.subtitle, x + cardW / 2, top + 76);

      context.fillStyle = open ? 'rgba(230,239,252,0.94)' : 'rgba(212,224,242,0.86)';
      context.font = `400 13px ${FONT}`;
      // Two lines only. A third line pushes the stats down and the footer collides, so the
      // blurb is clamped and the card grid keeps one rhythm.
      wrapText(entry.blurb, x + cardW / 2, top + 118, cardW - 40, 19, 2);

      // Bookkeeping: nights, souls asked for, best.
      const rows = [
        ['NIGHTS', String(entry.nights)],
        ['SOULS', String(entry.soulsTarget)],
        ['BEST', save.best[entry.id] ? String(save.best[entry.id]) : '—'],
      ];
      rows.forEach((row, r) => {
        const y = top + 196 + r * 32;
        context.textAlign = 'left';
        context.fillStyle = 'rgba(160,180,210,0.7)';
        context.font = `600 10px ${FONT}`;
        context.fillText(row[0], x + 24, y);
        context.textAlign = 'right';
        const empty = row[1] === '—';
        context.fillStyle = empty ? 'rgba(150,166,190,0.55)' : (open ? palette.text : 'rgba(200,214,234,0.7)');
        context.font = empty ? `400 15px ${FONT}` : `700 15px ${FONT}`;
        context.fillText(row[1], x + cardW - 24, y - 2);
      });

      if (cleared) {
        context.textAlign = 'center';
        context.fillStyle = palette.gold;
        context.font = `700 12px ${FONT}`;
        context.fillText('✦ CLEARED', x + cardW / 2, top + cardH - 26);
      } else if (!open) {
        // Say what would open it, not just that it is shut: a player should never have to guess.
        // The lock sits above the line rather than beside it, so a long region name never collides
        // with the glyph and nothing is clipped by the card's own width.
        const gate = index > 0 ? `Unlocks after ${REGIONS[index - 1].name}` : 'Unlocks after the wood before it';
        const lockX = x + cardW / 2;
        const lockY = top + cardH - 58;

        context.strokeStyle = 'rgba(226,236,250,0.72)';
        context.lineWidth = 1.5;
        context.beginPath();
        context.arc(lockX, lockY - 3, 3.2, Math.PI, 0);
        context.stroke();
        context.fillStyle = 'rgba(226,236,250,0.72)';
        context.beginPath();
        context.roundRect(lockX - 5, lockY - 3, 10, 7.5, 2);
        context.fill();

        context.textAlign = 'center';
        context.fillStyle = 'rgba(232,241,253,0.92)';
        context.font = `600 11px ${FONT}`;
        context.fillText(gate, x + cardW / 2, top + cardH - 34);
      }
    });

    const pulse = 0.55 + Math.sin(state.elapsed * 3.6) * 0.45;
    context.textAlign = 'center';
    context.fillStyle = `rgba(255,232,190,${0.45 + pulse * 0.55})`;
    context.font = `700 18px ${FONT}`;
    context.fillText('A / D or ← → to choose · SPACE to walk in', VIEW.width / 2, top + cardH + 46);
    context.fillStyle = palette.muted;
    context.font = `500 12px ${FONT}`;
    context.fillText('R forgets everything you have saved', VIEW.width / 2, top + cardH + 70);
    context.restore();
  }

  /** Break a sentence onto lines at a given width. */
  function wrapText(text, centreX, top, maxWidth, lineHeight, maxLines = Infinity) {
    const words = text.split(' ');
    let line = '';
    let y = top;
    for (const word of words) {
      const attempt = line ? `${line} ${word}` : word;
      if (context.measureText(attempt).width > maxWidth && line) {
        context.fillText(line, centreX, y);
        line = word;
        y += lineHeight;
        if (y > top + (maxLines - 1) * lineHeight) return;
      } else {
        line = attempt;
      }
    }
    if (line) context.fillText(line, centreX, y);
  }

  function pausedScreen() {
    context.save();
    context.fillStyle = 'rgba(4,6,11,0.62)';
    context.fillRect(0, 0, VIEW.width, VIEW.height);
    context.textAlign = 'center';
    context.fillStyle = palette.text;
    context.font = `700 52px ${FONT_DISPLAY}`;
    context.fillText('PAUSED', VIEW.width / 2, VIEW.height / 2 - 16);
    context.fillStyle = palette.muted;
    context.font = `400 16px ${FONT}`;
    context.fillText('P or SPACE to carry on', VIEW.width / 2, VIEW.height / 2 + 30);
    context.restore();
  }

  function lightRadius(state) {
    const t = Math.max(0, Math.min(1, state.light));
    return LIGHT.radiusMin + (LIGHT.radiusMax - LIGHT.radiusMin) * (t * t * (3 - 2 * t));
  }

  /** The one-time control hint, faded out after the first few seconds of a run. */
  function hint(state) {
    if (state.elapsed > 8) return;
    const fade = state.elapsed < 6 ? 1 : 1 - (state.elapsed - 6) / 2;
    context.save();
    context.globalAlpha = Math.max(0, fade) * 0.9;
    context.textAlign = 'center';
    context.fillStyle = palette.text;
    context.font = `600 15px ${FONT}`;
    context.fillText('WASD to move  ·  F flare  ·  stand in a pool to drink', VIEW.width / 2, 128);
    context.restore();
  }

  function draw(state, screen, best, save, cursor) {
    resize();
    if (screen === SCREEN_PLAY || screen === SCREEN_PAUSED || screen === SCREEN_TITLE
      || screen === SCREEN_OVER || screen === SCREEN_WON) {
      follow(state);
    }
    context.save();
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.fillStyle = palette.void;
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.setTransform(scale, 0, 0, scale, offsetX, offsetY);
    context.beginPath();
    context.rect(0, 0, VIEW.width, VIEW.height);
    context.clip();

    const on = (name) => !debugLayers || debugLayers.has(name);
    context.save();
    context.translate(VIEW.width / 2 - camera.x, VIEW.height / 2 - camera.y);
    if (on('ground')) ground(state);
    if (on('pools')) pools(state);
    if (on('souls')) souls(state);
    if (on('wolves')) wolves(state);
    if (on('lantern')) lantern(state);
    if (particles && on('particles')) particles.draw(context);
    context.restore();

    // Light and dust are drawn in view space: they belong to the eye, not the clearing.
    if (on('shadow')) shadow(state);
    context.save();
    context.translate(VIEW.width / 2 - camera.x, VIEW.height / 2 - camera.y);
    if (on('motes')) motesDrift(state);
    context.restore();
    if (on('vignette')) vignette();

    if (screen === SCREEN_PLAY || screen === SCREEN_PAUSED) hud(state);
    if (screen === SCREEN_TITLE) titleScreen(state, best);
    if (screen === SCREEN_SELECT) selectScreen(state, save, cursor);
    if (screen === SCREEN_PAUSED) pausedScreen();
    if (screen === SCREEN_OVER || screen === SCREEN_WON) overScreen(state, best);
    if (screen === SCREEN_PLAY) hint(state);

    context.restore();
  }

  return { draw, resize, camera, useRegion };
}
