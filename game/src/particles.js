// Small, pooled particles: sparks off the lantern, souls that break apart when gathered, ash that
// falls through the dark, and the ring a flare throws out. A fixed pool keeps the frame cost flat
// however busy the screen gets.

const MAX = 420;

export function createParticles() {
  const items = [];
  for (let index = 0; index < MAX; index += 1) {
    items.push({
      live: false, x: 0, y: 0, vx: 0, vy: 0, life: 0, ttl: 1, size: 2, colour: '#fff', gravity: 0, drag: 0.9,
    });
  }
  let cursor = 0;

  function take() {
    for (let attempt = 0; attempt < MAX; attempt += 1) {
      const item = items[cursor];
      cursor = (cursor + 1) % MAX;
      if (!item.live) return item;
    }
    return items[cursor];
  }

  function emit(x, y, count, options = {}) {
    const {
      speed = 90, spread = Math.PI * 2, angle = 0, colour = '#ffb257',
      ttl = 0.8, size = 2.4, gravity = 0, drag = 0.9,
    } = options;
    for (let index = 0; index < count; index += 1) {
      const item = take();
      const direction = angle + (Math.random() - 0.5) * spread;
      const velocity = speed * (0.35 + Math.random() * 0.9);
      item.live = true;
      item.x = x;
      item.y = y;
      item.vx = Math.cos(direction) * velocity;
      item.vy = Math.sin(direction) * velocity;
      item.life = ttl * (0.6 + Math.random() * 0.7);
      item.ttl = item.life;
      item.size = size * (0.6 + Math.random() * 0.9);
      item.colour = colour;
      item.gravity = gravity;
      item.drag = drag;
    }
  }

  function ring(x, y, colour, count = 26) {
    emit(x, y, count, { speed: 260, colour, ttl: 0.55, size: 2.8 });
  }

  function update(dt) {
    for (const item of items) {
      if (!item.live) continue;
      item.life -= dt;
      if (item.life <= 0) {
        item.live = false;
        continue;
      }
      item.vy += item.gravity * dt;
      item.vx *= Math.pow(item.drag, dt * 60);
      item.vy *= Math.pow(item.drag, dt * 60);
      item.x += item.vx * dt;
      item.y += item.vy * dt;
    }
  }

  function draw(context) {
    context.save();
    context.globalCompositeOperation = 'lighter';
    for (const item of items) {
      if (!item.live) continue;
      const fade = item.life / item.ttl;
      context.globalAlpha = Math.max(0, Math.min(1, fade));
      context.fillStyle = item.colour;
      context.beginPath();
      context.arc(item.x, item.y, item.size * (0.4 + fade * 0.9), 0, Math.PI * 2);
      context.fill();
    }
    context.restore();
  }

  function clear() {
    for (const item of items) item.live = false;
  }

  return { emit, ring, update, draw, clear, items };
}
