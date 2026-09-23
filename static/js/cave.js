// Pixel-art cave backdrop: stalactites and stalagmites built from randomly stacked triangles,
// drawn at low resolution and scaled up with crisp pixels. A new cave is generated on every load.
(function () {
  const PIXEL = 4; // screen pixels per art pixel
  const canvas = document.getElementById('cave');
  const ctx = canvas.getContext('2d');
  const scene = document.createElement('canvas');
  const sceneCtx = scene.getContext('2d');
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Two depth layers: the far one is darker so the near one stands out.
  const LAYERS = [
    { base: '#1c1730', light: '#262040', dark: '#15111f', reach: 0.34, count: 1.2 },
    { base: '#2e2648', light: '#43396a', dark: '#1e1932', reach: 0.24, count: 0.8 },
  ];
  const VOID_TOP = '#0c0a16';
  const VOID_BOTTOM = '#1a1430';
  const CRYSTALS = ['#f2c14e', '#7fe3ff', '#c99bff'];
  const WATER = '#8fd3ff';

  const seed = Math.floor(Math.random() * 2 ** 31);
  let width = 0;
  let height = 0;
  let tips = [];
  let drops = [];

  // Small seeded PRNG so a resize redraws the same cave instead of a new one.
  function mulberry32(a) {
    return function () {
      a |= 0;
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // Fills a triangle one pixel row at a time so every edge lands on whole pixels.
  // dir = 1 points down (stalactite), dir = -1 points up (stalagmite).
  function triangle(c, cx, y0, w, h, dir, layer) {
    for (let r = 0; r < h; r++) {
      const half = Math.max(0.5, (w / 2) * (1 - r / h));
      const left = Math.round(cx - half);
      const right = Math.round(cx + half);
      const y = y0 + r * dir;
      c.fillStyle = layer.base;
      c.fillRect(left, y, right - left, 1);
      c.fillStyle = layer.light;
      c.fillRect(left, y, 1, 1);
      if (right - left > 2) {
        c.fillStyle = layer.dark;
        c.fillRect(right - 1, y, 1, 1);
      }
    }
  }

  // One formation: 1-3 triangles stacked, each narrower and starting partway down the last.
  function formation(c, rand, cx, rootY, dir, maxLen, layer, isNear) {
    let w = 5 + Math.floor(rand() * 12);
    if (rand() < 0.12) w += 8 + Math.floor(rand() * 10);
    let y = rootY;
    let total = 0;
    const segments = 1 + Math.floor(rand() * 3);
    for (let i = 0; i < segments && w >= 2; i++) {
      const h = Math.max(3, Math.floor(w * (0.8 + rand() * 1.4)));
      if (total + h > maxLen) break;
      triangle(c, cx, y, w, h, dir, layer);
      const step = Math.floor(h * (0.45 + rand() * 0.25));
      y += step * dir;
      total += step;
      w = Math.floor(w * (0.45 + rand() * 0.25));
    }
    const tipY = y + Math.max(1, Math.floor(w)) * dir;
    if (isNear && dir === 1) {
      tips.push({ x: Math.round(cx), y: tipY });
    }
  }

  // Bumpy band of rock along the ceiling or floor.
  function band(c, rand, dir, thickness, layer) {
    let h = thickness;
    for (let x = 0; x < width; x++) {
      if (rand() < 0.35) h = Math.max(1, Math.min(thickness + 3, h + (rand() < 0.5 ? -1 : 1)));
      c.fillStyle = layer.base;
      if (dir === 1) c.fillRect(x, 0, 1, h);
      else c.fillRect(x, height - h, 1, h);
    }
  }

  function build() {
    const rand = mulberry32(seed);
    width = Math.ceil(window.innerWidth / PIXEL);
    height = Math.ceil(window.innerHeight / PIXEL);
    canvas.width = scene.width = width;
    canvas.height = scene.height = height;
    tips = [];
    drops = [];

    const sky = sceneCtx.createLinearGradient(0, 0, 0, height);
    sky.addColorStop(0, VOID_TOP);
    sky.addColorStop(1, VOID_BOTTOM);
    sceneCtx.fillStyle = sky;
    sceneCtx.fillRect(0, 0, width, height);

    LAYERS.forEach((layer, index) => {
      const isNear = index === LAYERS.length - 1;
      const ceiling = 3 + index * 2;
      const floor = 2 + index * 2;
      band(sceneCtx, rand, 1, ceiling, layer);
      band(sceneCtx, rand, -1, floor, layer);

      // stalactites
      let x = Math.floor(rand() * 6);
      while (x < width) {
        formation(sceneCtx, rand, x, ceiling, 1, height * layer.reach, layer, isNear);
        x += Math.floor((4 + rand() * 14) / layer.count);
      }
      // stalagmites: fewer and shorter
      x = Math.floor(rand() * 10);
      while (x < width) {
        formation(sceneCtx, rand, x, height - floor - 1, -1, height * layer.reach * 0.6, layer, isNear);
        x += Math.floor((8 + rand() * 22) / layer.count);
      }
    });

    // glinting crystals in the ceiling rock
    for (let i = 0; i < width / 12; i++) {
      sceneCtx.fillStyle = CRYSTALS[Math.floor(rand() * CRYSTALS.length)];
      sceneCtx.fillRect(Math.floor(rand() * width), Math.floor(rand() * 5), 1, 1);
    }

    render();
  }

  function render() {
    ctx.drawImage(scene, 0, 0);
    ctx.fillStyle = WATER;
    for (const d of drops) {
      if (d.splash) {
        ctx.fillRect(d.x - 1, d.floorY - 1, 1, 1);
        ctx.fillRect(d.x + 1, d.floorY - 1, 1, 1);
      } else {
        ctx.fillRect(d.x, Math.round(d.y), 1, 2);
      }
    }
  }

  function tick() {
    if (tips.length && drops.length < 3 && Math.random() < 0.02) {
      const tip = tips[Math.floor(Math.random() * tips.length)];
      drops.push({ x: tip.x, y: tip.y, v: 0, floorY: height - 6, splash: 0 });
    }
    for (const d of drops) {
      if (d.splash) {
        d.splash++;
      } else {
        d.v += 0.04;
        d.y += d.v;
        if (d.y >= d.floorY) d.splash = 1;
      }
    }
    drops = drops.filter((d) => d.splash < 8);
    render();
    requestAnimationFrame(tick);
  }

  let resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(build, 150);
  });

  build();
  if (!reduceMotion) {
    requestAnimationFrame(tick);
  }
})();
