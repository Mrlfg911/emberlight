// Everything you see: the forest floor, the lantern's cone of light and the darkness pressing in on
// it, the souls, the firefly pools, the wolves and the HUD. Drawing only reads state; it never
// changes a rule. The world is larger than the window, so the camera keeps the lantern near the
// centre and everything in the clearing is drawn through one translate.
import {
  FONT, FONT_DISPLAY, LIGHT, NIGHTS, PALETTE, PLAYER, POOLS, VIEW, WOLF, WORLD,
} from './config.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';
export const SCREEN_WON = 'won';

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

    context.fillStyle = PALETTE.void;
    context.fillRect(left, top, VIEW.width, VIEW.height);

    // The clearing itself, so the forest reads as a place with an edge you can lose.
    const sky = context.createRadialGradient(WORLD.width / 2, WORLD.height / 2, 120, WORLD.width / 2, WORLD.height / 2, WORLD.width * 0.62);
    sky.addColorStop(0, PALETTE.haze);
    sky.addColorStop(0.5, PALETTE.night);
    sky.addColorStop(1, '#070b12');
    context.fillStyle = sky;
    context.fillRect(0, 0, WORLD.width, WORLD.height);

    context.strokeStyle = 'rgba(120,150,190,0.10)';
    context.lineWidth = 3;
    context.strokeRect(4, 4, WORLD.width - 8, WORLD.height - 8);

    for (const trunk of trunks) {
      const height = 26 + trunk.r * 44;
      const width = 7 + trunk.r * 13;
      context.fillStyle = PALETTE.trunk;
      context.fillRect(trunk.x - width / 2, trunk.y - height / 2, width, height);
      context.strokeStyle = 'rgba(120,145,180,0.10)';
      context.lineWidth = 1.2;
      context.strokeRect(trunk.x - width / 2, trunk.y - height / 2, width, height);
    }

    for (const blade of grass) {
      const height = 7 + blade.r * 18;
      context.strokeStyle = blade.r > 0.72 ? PALETTE.moss : '#12201b';
      context.lineWidth = 1.5;
      context.beginPath();
      context.moveTo(blade.x, blade.y);
      context.quadraticCurveTo(blade.x - 3 + blade.r * 6, blade.y - height * 0.6, blade.x - 5 + blade.r * 10, blade.y - height);
      context.stroke();
    }

    for (const stone of stones) {
      context.fillStyle = stone.r > 0.6 ? '#212b3c' : '#18202d';
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
      context.fillStyle = PALETTE.soulCore;
      context.beginPath();
      context.arc(soul.x, y, 6.2, 0, TAU);
      context.fill();
      context.strokeStyle = `rgba(200,250,255,${0.55 + near * 0.3})`;
      context.lineWidth = 1.4;
      context.beginPath();
      context.arc(soul.x, y, 13 + Math.sin(soul.phase * 1.7) * 2.6, 0, TAU);
      context.stroke();
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
      const S = 1.22;
      const body = charging ? '#5b4a5c' : '#49566d';
      const edge = charging ? '#ff8663' : '#9db2d4';

      context.save();
      context.translate(wolf.x, wolf.y);
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
      context.fillStyle = charging ? '#ffd9b4' : '#ff9268';
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
    const flicker = 1 + Math.sin(state.elapsed * 9.1) * 0.05;
    const halo = context.createRadialGradient(x, y, 0, x, y, radius * 0.62 * flicker);
    halo.addColorStop(0, 'rgba(255,238,200,0.42)');
    halo.addColorStop(0.2, 'rgba(255,196,120,0.34)');
    halo.addColorStop(0.55, 'rgba(255,150,70,0.13)');
    halo.addColorStop(1, 'rgba(255,120,40,0)');
    context.fillStyle = halo;
    context.beginPath();
    context.arc(x, y, radius * 0.55 * flicker, 0, TAU);
    context.fill();

    // The lantern is a person: a body, a hood and the light they carry.
    context.save();
    context.translate(x, y);
    // A contact shadow, so the figure is grounded rather than floating in the glow.
    const shade = context.createRadialGradient(0, 18, 2, 0, 18, 34);
    shade.addColorStop(0, 'rgba(0,0,0,0.62)');
    shade.addColorStop(1, 'rgba(0,0,0,0)');
    context.fillStyle = shade;
    context.beginPath();
    context.ellipse(0, 18, 34, 16, 0, 0, TAU);
    context.fill();

    const facing = state.player.facing;
    const stride = Math.sin(state.elapsed * 9) * (Math.hypot(state.player.vx, state.player.vy) > 30 ? 2.6 : 0.5);

    // Two legs, slightly apart: four pixels of separation is what makes a shape read as a person.
    context.strokeStyle = '#0a0f16';
    context.lineWidth = 5;
    context.lineCap = 'round';
    for (const side of [-1, 1]) {
      context.beginPath();
      context.moveTo(side * 4, 4);
      context.lineTo(side * 5 + stride * side, 16);
      context.stroke();
    }
    context.lineCap = 'butt';

    // The coat: a tapered torso, narrower at the shoulders than the hem.
    context.fillStyle = '#111a26';
    context.beginPath();
    context.moveTo(-7.5, -6);
    context.lineTo(7.5, -6);
    context.lineTo(10, 8);
    context.lineTo(-10, 8);
    context.closePath();
    context.fill();
    context.strokeStyle = 'rgba(255,236,200,0.9)';
    context.lineWidth = 1.8;
    context.beginPath();
    context.moveTo(-7.5, -6);
    context.lineTo(-10, 8);
    context.lineTo(10, 8);
    context.lineTo(7.5, -6);
    context.stroke();

    // A pale scarf, the one cool colour the player owns, so they never read as a wolf.
    context.fillStyle = '#cfe4ff';
    context.beginPath();
    context.ellipse(0, -6.5, 7.5, 2.6, 0, 0, TAU);
    context.fill();

    // The hood and head.
    context.fillStyle = '#16212f';
    context.beginPath();
    context.arc(0, -11, 7.6, 0, TAU);
    context.fill();
    context.strokeStyle = 'rgba(200,222,250,0.85)';
    context.lineWidth = 1.6;
    context.beginPath();
    context.arc(0, -11, 7.6, 0, TAU);
    context.stroke();
    // A face turned the way the player is walking.
    context.fillStyle = 'rgba(255,225,185,0.85)';
    context.beginPath();
    context.ellipse(facing * 2.6, -10, 2.4, 2.8, 0, 0, TAU);
    context.fill();

    // The arm holding the lantern, and the lantern hanging from it on a short handle.
    const handX = facing * 11;
    context.strokeStyle = '#16212f';
    context.lineWidth = 3.4;
    context.lineCap = 'round';
    context.beginPath();
    context.moveTo(facing * 5, -4);
    context.lineTo(handX, 2);
    context.stroke();
    context.lineCap = 'butt';

    context.strokeStyle = 'rgba(255,220,170,0.7)';
    context.lineWidth = 1.4;
    context.beginPath();
    context.moveTo(handX, 2);
    context.lineTo(handX + facing * 2, 7);
    context.stroke();

    const lampX = handX + facing * 2;
    const lampY = 12;
    const lampGlow = context.createRadialGradient(lampX, lampY, 0, lampX, lampY, 30);
    lampGlow.addColorStop(0, 'rgba(255,248,224,1)');
    lampGlow.addColorStop(0.24, 'rgba(255,206,132,0.8)');
    lampGlow.addColorStop(1, 'rgba(255,150,70,0)');
    context.fillStyle = lampGlow;
    context.beginPath();
    context.arc(lampX, lampY, 30, 0, TAU);
    context.fill();
    context.fillStyle = PALETTE.lanternCore;
    context.beginPath();
    context.arc(lampX, lampY, 5.6, 0, TAU);
    context.fill();
    context.fillStyle = PALETTE.lantern;
    context.beginPath();
    context.arc(lampX, lampY, 3.1, 0, TAU);
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
    grade.addColorStop(0, light < 0.3 ? '#ff4e3a' : PALETTE.gold);
    grade.addColorStop(1, light < 0.3 ? '#ff8a3d' : '#ffb257');
    context.strokeStyle = grade;
    context.lineCap = 'round';
    context.lineWidth = 10;
    context.beginPath();
    context.arc(x, y, 44, -Math.PI / 2, -Math.PI / 2 + TAU * light);
    context.stroke();
    context.lineCap = 'butt';

    context.fillStyle = PALETTE.text;
    context.font = `700 24px ${FONT}`;
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText(`${Math.round(light * 100)}`, x, y - 3);
    context.font = `600 10px ${FONT}`;
    context.fillStyle = PALETTE.muted;
    context.fillText('LIGHT %', x, y + 18);
    context.restore();
  }

  function hud(state) {
    context.save();
    context.textBaseline = 'top';
    context.textAlign = 'left';
    context.fillStyle = PALETTE.text;
    context.font = `700 36px ${FONT}`;
    context.fillText(String(state.score), 44, 32);
    context.font = `600 11px ${FONT}`;
    context.fillStyle = PALETTE.muted;
    context.fillText('SCORE', 46, 74);

    // Night and its clock.
    const plan = NIGHTS[Math.min(state.night - 1, NIGHTS.length - 1)];
    const progress = Math.min(1, state.nightElapsed / plan.seconds);
    context.textAlign = 'center';
    context.fillStyle = PALETTE.text;
    context.font = `700 21px ${FONT}`;
    context.fillText(`NIGHT ${state.night} OF ${NIGHTS.length}`, VIEW.width / 2, 30);
    context.fillStyle = 'rgba(255,255,255,0.14)';
    context.fillRect(VIEW.width / 2 - 120, 62, 240, 6);
    context.fillStyle = PALETTE.lantern;
    context.fillRect(VIEW.width / 2 - 120, 62, 240 * progress, 6);
    context.fillStyle = PALETTE.muted;
    context.font = `500 10px ${FONT}`;
    context.fillText(`${Math.max(0, Math.ceil(plan.seconds - state.nightElapsed))}s of dark left`, VIEW.width / 2, 74);

    // Souls and flares, top right.
    context.textAlign = 'right';
    context.fillStyle = PALETTE.soul;
    context.font = `700 19px ${FONT}`;
    context.fillText(`◇ ${state.soulsSaved}`, VIEW.width - 44, 32);
    context.fillStyle = PALETTE.muted;
    context.font = `600 10px ${FONT}`;
    context.fillText('SOULS', VIEW.width - 44, 56);
    context.fillStyle = PALETTE.gold;
    context.font = `700 19px ${FONT}`;
    context.fillText(`✦ ${state.flares}`, VIEW.width - 152, 32);
    context.fillStyle = PALETTE.muted;
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
    context.fillStyle = PALETTE.lanternCore;
    context.font = `700 92px ${FONT_DISPLAY}`;
    context.fillText('EMBERLIGHT', VIEW.width / 2, VIEW.height / 2 - 128);
    context.fillStyle = PALETTE.lantern;
    context.font = `500 20px ${FONT}`;
    context.fillText('The dark is hungry. Your lantern is all you have.', VIEW.width / 2, VIEW.height / 2 - 68);
    context.fillStyle = PALETTE.gold;
    context.font = `600 19px ${FONT}`;
    context.fillText('Survive six nights. Walk into a soul to gather it; stand in a pool to drink.', VIEW.width / 2, VIEW.height / 2 + 2);
    context.fillStyle = '#b9c4d4';
    context.font = `400 17px ${FONT}`;
    context.fillText('WASD or arrows to move · F strikes a flare and scatters the wolves · P pauses', VIEW.width / 2, VIEW.height / 2 + 36);
    context.fillStyle = PALETTE.muted;
    context.font = `400 15px ${FONT}`;
    context.fillText('The lantern burns down as you move. Souls and pools are the only way back up.', VIEW.width / 2, VIEW.height / 2 + 68);
    const pulse = 0.55 + Math.sin(state.elapsed * 3.6) * 0.45;
    context.fillStyle = `rgba(255,232,190,${0.5 + pulse * 0.5})`;
    context.font = `700 23px ${FONT}`;
    context.fillText('PRESS SPACE OR CLICK TO LIGHT THE LANTERN', VIEW.width / 2, VIEW.height / 2 + 156);
    context.fillStyle = PALETTE.muted;
    context.font = `500 14px ${FONT}`;
    context.fillText(best > 0 ? `Best score ${best}` : 'Six nights. One lantern.', VIEW.width / 2, VIEW.height / 2 + 200);
    context.restore();
  }

  function overScreen(state, best) {
    const won = state.won;
    context.save();
    context.fillStyle = `rgba(6,9,16,${won ? 0.86 : 0.9})`;
    context.fillRect(0, 0, VIEW.width, VIEW.height);
    context.textAlign = 'center';
    context.fillStyle = won ? PALETTE.gold : PALETTE.danger;
    context.font = `700 68px ${FONT_DISPLAY}`;
    context.fillText(won ? 'DAWN' : 'THE LANTERN DIES', VIEW.width / 2, VIEW.height / 2 - 150);
    if (won) {
      context.fillStyle = PALETTE.gold;
      context.font = `600 16px ${FONT}`;
      context.fillText('SIX NIGHTS SURVIVED', VIEW.width / 2, VIEW.height / 2 - 112);
    }
    context.fillStyle = '#c8d2e0';
    context.font = `400 18px ${FONT}`;
    context.fillText(won
      ? 'Six nights held. The forest lets you go.'
      : `The dark takes the clearing on night ${state.night}.`, VIEW.width / 2, VIEW.height / 2 - 92);

    const rows = [
      ['Score', String(state.score)],
      ['Nights survived', `${state.nightsSurvived} / ${NIGHTS.length}`],
      ['Souls rescued', String(state.soulsSaved)],
      ['Best', String(best)],
    ];
    const isNewBest = won && state.score >= best && state.score > 0;
    rows.forEach((row, index) => {
      const y = VIEW.height / 2 - 24 + index * 36;
      context.textAlign = 'right';
      context.fillStyle = PALETTE.muted;
      context.font = `400 17px ${FONT}`;
      context.fillText(row[0], VIEW.width / 2 - 18, y);
      context.textAlign = 'left';
      context.fillStyle = PALETTE.text;
      context.font = `700 18px ${FONT}`;
      context.fillText(row[1], VIEW.width / 2 + 18, y);
    });

    if (isNewBest) {
      context.textAlign = 'center';
      context.fillStyle = PALETTE.gold;
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

  function pausedScreen() {
    context.save();
    context.fillStyle = 'rgba(4,6,11,0.62)';
    context.fillRect(0, 0, VIEW.width, VIEW.height);
    context.textAlign = 'center';
    context.fillStyle = PALETTE.text;
    context.font = `700 52px ${FONT_DISPLAY}`;
    context.fillText('PAUSED', VIEW.width / 2, VIEW.height / 2 - 16);
    context.fillStyle = PALETTE.muted;
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
    context.fillStyle = PALETTE.text;
    context.font = `600 15px ${FONT}`;
    context.fillText('WASD / arrows to move · F to strike a flare · drink where the fireflies gather', VIEW.width / 2, VIEW.height - 44);
    context.restore();
  }

  function draw(state, screen, best) {
    resize();
    if (screen === SCREEN_PLAY || screen === SCREEN_PAUSED || screen === SCREEN_TITLE
      || screen === SCREEN_OVER || screen === SCREEN_WON) {
      follow(state);
    }
    context.save();
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.fillStyle = PALETTE.void;
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
    if (screen === SCREEN_PAUSED) pausedScreen();
    if (screen === SCREEN_OVER || screen === SCREEN_WON) overScreen(state, best);
    if (screen === SCREEN_PLAY) hint(state);

    context.restore();
  }

  return { draw, resize, camera };
}
