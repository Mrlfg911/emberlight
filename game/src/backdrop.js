// The horizon. Each region gets its own silhouette layers, pre-rendered once into offscreen
// canvases and scrolled at different speeds as the camera moves, so the wood has depth instead of
// being a flat dark field. Nothing here is an image file; every shape is drawn with paths.

const TILE = 1400;

function rng(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

function makeCanvas(width, height) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

/** A soft ridge of treetops, for the far distance. */
function drawCanopy(context, rand, colour, width, height, baseY, scale) {
  context.fillStyle = colour;
  context.beginPath();
  context.moveTo(0, height);
  let x = 0;
  while (x < width) {
    const w = 90 + rand() * 150;
    const h = (60 + rand() * 120) * scale;
    context.quadraticCurveTo(x + w * 0.5, baseY - h, x + w, baseY - h * 0.22);
    x += w;
  }
  context.lineTo(width, height);
  context.closePath();
  context.fill();
}

function drawTrunks(context, rand, colour, width, height, options) {
  const { count, minWidth, maxWidth, lean, brokenChance = 0 } = options;
  context.fillStyle = colour;
  for (let index = 0; index < count; index += 1) {
    const x = (index / count) * width + rand() * (width / count) * 0.8;
    const w = minWidth + rand() * (maxWidth - minWidth);
    const top = height * (0.05 + rand() * 0.3);
    const tilt = (rand() - 0.5) * lean;
    const broken = rand() < brokenChance;
    context.save();
    context.translate(x, 0);
    context.rotate(tilt);
    context.beginPath();
    context.moveTo(-w / 2, height);
    context.lineTo(-w / 2 + w * 0.16, top);
    context.lineTo(w / 2 - w * 0.16, top);
    context.lineTo(w / 2, height);
    context.closePath();
    context.fill();
    if (broken) {
      // A snapped bough, so a dead region reads as dead rather than merely dark.
      context.beginPath();
      context.moveTo(0, top + 60);
      context.lineTo(w * 1.9, top + 20);
      context.lineTo(w * 1.7, top + 44);
      context.closePath();
      context.fill();
    }
    context.restore();
  }
}

function drawPines(context, rand, colour, width, height) {
  context.fillStyle = colour;
  const count = 26;
  for (let index = 0; index < count; index += 1) {
    const x = (index / count) * width + rand() * 30;
    const top = height * (0.02 + rand() * 0.18);
    const base = height * (0.62 + rand() * 0.2);
    const half = 34 + rand() * 26;
    context.beginPath();
    context.moveTo(x, top);
    context.lineTo(x + half, base);
    context.lineTo(x - half, base);
    context.closePath();
    context.fill();
    // Three tiers of boughs, narrowing upward.
    for (let tier = 1; tier <= 3; tier += 1) {
      const y = top + (base - top) * (tier / 3.4);
      const spread = half * (0.5 + tier * 0.22);
      context.beginPath();
      context.moveTo(x, y - 40);
      context.lineTo(x + spread, y + 26);
      context.lineTo(x - spread, y + 26);
      context.closePath();
      context.fill();
    }
  }
}

function drawSpires(context, rand, colour, width, height) {
  context.fillStyle = colour;
  const count = 16;
  for (let index = 0; index < count; index += 1) {
    const x = (index / count) * width + rand() * 60;
    const top = height * (0.05 + rand() * 0.4);
    const half = 20 + rand() * 46;
    context.beginPath();
    context.moveTo(x, top);
    context.lineTo(x + half, height);
    context.lineTo(x - half, height);
    context.closePath();
    context.fill();
  }
}

function drawFogBank(context, rand, colour, width, height) {
  context.fillStyle = colour;
  for (let band = 0; band < 3; band += 1) {
    const y = height * (0.55 + band * 0.13);
    context.globalAlpha = 0.1 + band * 0.05;
    context.beginPath();
    context.moveTo(0, height);
    let x = 0;
    while (x < width) {
      const w = 200 + rand() * 260;
      context.quadraticCurveTo(x + w * 0.5, y - 26 - rand() * 30, x + w, y + 10);
      x += w;
    }
    context.lineTo(width, height);
    context.closePath();
    context.fill();
  }
  context.globalAlpha = 1;
}

const LAYERS = {
  clearing: {
    far: (ctx, rand, colour, w, h) => drawCanopy(ctx, rand, colour, w, h, h * 0.52, 1.15),
    mid: (ctx, rand, colour, w, h) => drawTrunks(ctx, rand, colour, w, h, { count: 12, minWidth: 26, maxWidth: 60, lean: 0.06 }),
  },
  ashfen: {
    far: (ctx, rand, colour, w, h) => drawCanopy(ctx, rand, colour, w, h, h * 0.66, 0.7),
    mid: (ctx, rand, colour, w, h) => drawTrunks(ctx, rand, colour, w, h, { count: 11, minWidth: 18, maxWidth: 44, lean: 0.5, brokenChance: 0.55 }),
    fog: (ctx, rand, colour, w, h) => drawFogBank(ctx, rand, colour, w, h),
  },
  hollowpines: {
    far: (ctx, rand, colour, w, h) => drawPines(ctx, rand, colour, w, h),
    mid: (ctx, rand, colour, w, h) => drawTrunks(ctx, rand, colour, w, h, { count: 16, minWidth: 12, maxWidth: 26, lean: 0.03 }),
  },
  longdark: {
    far: (ctx, rand, colour, w, h) => drawSpires(ctx, rand, colour, w, h),
    mid: (ctx, rand, colour, w, h) => drawTrunks(ctx, rand, colour, w, h, { count: 9, minWidth: 14, maxWidth: 34, lean: 0.22, brokenChance: 0.3 }),
  },
};

export function createBackdrop(region, height) {
  const recipe = LAYERS[region.id] || LAYERS.clearing;
  const rand = rng(region.id.length * 7919 + 13);
  const far = makeCanvas(TILE, height);
  const mid = makeCanvas(TILE, height);
  const fog = makeCanvas(TILE, height);

  const farCtx = far.getContext('2d');
  const midCtx = mid.getContext('2d');
  const fogCtx = fog.getContext('2d');

  const farColour = region.palette.haze;
  const midColour = region.palette.trunk;

  recipe.far(farCtx, rand, farColour, TILE, height);
  recipe.mid(midCtx, rand, midColour, TILE, height);
  if (recipe.fog) recipe.fog(fogCtx, rand, region.palette.haze, TILE, height);

  return {
    /** Draw the layers behind the ground, wrapped so they never run out. */
    draw(context, camera, width) {
      const offsets = [
        { canvas: far, factor: 0.18, alpha: 0.85 },
        { canvas: mid, factor: 0.42, alpha: 0.95 },
        { canvas: fog, factor: 0.62, alpha: 0.8 },
      ];
      for (const layer of offsets) {
        const shift = -((camera.x * layer.factor) % TILE);
        context.globalAlpha = layer.alpha;
        for (let x = shift - TILE; x < width + TILE; x += TILE) {
          context.drawImage(layer.canvas, Math.round(x), Math.round(-camera.y * layer.factor * 0.35));
        }
      }
      context.globalAlpha = 1;
    },
  };
}
