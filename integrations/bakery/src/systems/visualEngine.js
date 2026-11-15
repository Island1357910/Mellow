import { getMoldById } from '../data/molds';

/** 经典配方模具名 → 形状 */
const CLASSIC_MOLD_TO_SHAPE = {
  法棍: 'baguette', 吐司: 'loaf', 圆形: 'round', 卷形: 'round',
  牛角: 'round', 椭圆形: 'loaf', 玛芬: 'bun', 编花: 'braided',
  德国结: 'round', 恰巴塔: 'loaf', 佛卡夏: 'loaf', 三角: 'round', 和风: 'loaf', 贝果: 'round',
  碱水包: 'round', 盐面包: 'round', 长面包: 'baguette', 乡村面包: 'loaf', 大鼓: 'round', 欧包: 'round',
};

function parseHSL(c) {
  const m = c.match(/hsl\(([^,]+),\s*([^%]+)%,\s*([^%]+)%\)/);
  return m ? { h: +m[1], s: +m[2], l: +m[3] } : { h: 30, s: 50, l: 60 };
}

function lighten(c, amt) {
  if (c.startsWith('hsl')) { const { h, s, l } = parseHSL(c); return `hsl(${h}, ${s}%, ${Math.min(95, l + amt)}%)`; }
  if (c.startsWith('#')) {
    const [r, g, b] = [c.slice(1, 3), c.slice(3, 5), c.slice(5, 7)].map(x => parseInt(x, 16));
    return `rgb(${Math.min(255, r + amt * 3)},${Math.min(255, g + amt * 3)},${Math.min(255, b + amt * 3)})`;
  }
  return c;
}

function darken(c, amt) {
  if (c.startsWith('hsl')) { const { h, s, l } = parseHSL(c); return `hsl(${h}, ${s}%, ${Math.max(5, l - amt)}%)`; }
  if (c.startsWith('#')) {
    const [r, g, b] = [c.slice(1, 3), c.slice(3, 5), c.slice(5, 7)].map(x => parseInt(x, 16));
    return `rgb(${Math.max(0, r - amt * 3)},${Math.max(0, g - amt * 3)},${Math.max(0, b - amt * 3)})`;
  }
  return c;
}

function drawRound(ctx, cx, cy, r, vs) {
  const bc = vs.baseColor || 'hsl(30,50%,60%)';
  const g = ctx.createRadialGradient(cx - r * .3, cy - r * .3, 0, cx, cy, r);
  g.addColorStop(0, lighten(bc, 15)); g.addColorStop(0.7, bc); g.addColorStop(1, darken(bc, 10 + (vs.crustDarkness || 0)));
  ctx.beginPath(); ctx.ellipse(cx, cy + r * .05, r, r * .85, 0, 0, Math.PI * 2);
  ctx.fillStyle = g; ctx.fill();
  ctx.strokeStyle = darken(bc, 20); ctx.lineWidth = 1; ctx.stroke();
  ctx.beginPath(); ctx.moveTo(cx - r * .5, cy - r * .3);
  ctx.quadraticCurveTo(cx, cy - r * .5, cx + r * .5, cy - r * .3);
  ctx.strokeStyle = darken(bc, 15); ctx.lineWidth = 1.5; ctx.stroke();
}

function drawLoaf(ctx, cx, cy, r, vs) {
  const bc = vs.baseColor || 'hsl(30,50%,60%)';
  const g = ctx.createLinearGradient(cx - r, cy - r, cx + r * .5, cy + r);
  g.addColorStop(0, lighten(bc, 10)); g.addColorStop(0.5, bc); g.addColorStop(1, darken(bc, 10 + (vs.crustDarkness || 0)));
  const lw = r * 1.3, lh = r * .7;
  ctx.beginPath();
  ctx.moveTo(cx - lw, cy + lh * .3); ctx.quadraticCurveTo(cx - lw, cy - lh, cx, cy - lh);
  ctx.quadraticCurveTo(cx + lw, cy - lh, cx + lw, cy + lh * .3);
  ctx.lineTo(cx + lw, cy + lh * .5); ctx.lineTo(cx - lw, cy + lh * .5); ctx.closePath();
  ctx.fillStyle = g; ctx.fill(); ctx.strokeStyle = darken(bc, 20); ctx.lineWidth = 1; ctx.stroke();
  for (let i = 0; i < 3; i++) {
    ctx.beginPath(); ctx.moveTo(cx - r * .5 + i * r * .5, cy - lh * .6);
    ctx.lineTo(cx - r * .5 + i * r * .5 + r * .2, cy - lh * .1);
    ctx.strokeStyle = darken(bc, 12); ctx.lineWidth = 1.5; ctx.stroke();
  }
}

function drawBaguette(ctx, cx, cy, r, vs) {
  const bc = vs.baseColor || 'hsl(30,50%,60%)';
  const lw = r * 1.6, lh = r * .35;
  const g = ctx.createLinearGradient(cx - lw, cy, cx + lw, cy);
  g.addColorStop(0, darken(bc, 8 + (vs.crustDarkness || 0)));
  g.addColorStop(0.3, lighten(bc, 5));
  g.addColorStop(0.7, bc);
  g.addColorStop(1, darken(bc, 12 + (vs.crustDarkness || 0)));
  ctx.beginPath();
  ctx.ellipse(cx, cy, lw, lh, 0, 0, Math.PI * 2);
  ctx.fillStyle = g;
  ctx.fill();
  ctx.strokeStyle = darken(bc, 18);
  ctx.lineWidth = 1;
  ctx.stroke();
  for (let i = -2; i <= 2; i++) {
    ctx.beginPath();
    ctx.moveTo(cx + i * r * .35, cy - lh * .5);
    ctx.quadraticCurveTo(cx + i * r * .35 + r * .1, cy, cx + i * r * .35, cy + lh * .5);
    ctx.strokeStyle = darken(bc, 10);
    ctx.lineWidth = 1;
    ctx.stroke();
  }
}

function drawBun(ctx, cx, cy, r, vs) {
  const bc = vs.baseColor || 'hsl(30,50%,60%)';
  for (let row = 0; row < 2; row++) {
    for (let col = 0; col < 3; col++) {
      const bx = cx + (col - 1) * r * .55, by = cy + (row - 0.5) * r * .45;
      const g = ctx.createRadialGradient(bx - r * .1, by - r * .1, 0, bx, by, r * .32);
      g.addColorStop(0, lighten(bc, 12));
      g.addColorStop(1, darken(bc, 5 + (vs.crustDarkness || 0)));
      ctx.beginPath();
      ctx.arc(bx, by, r * .3, 0, Math.PI * 2);
      ctx.fillStyle = g;
      ctx.fill();
      ctx.strokeStyle = darken(bc, 14);
      ctx.lineWidth = .8;
      ctx.stroke();
    }
  }
}

function drawBraided(ctx, cx, cy, r, vs) {
  const bc = vs.baseColor || 'hsl(30,50%,60%)';
  for (let s = 0; s < 3; s++) {
    const oy = (s - 1) * r * .3;
    for (let i = 0; i < 4; i++) {
      const x = cx - r + i * r * .6, y = cy + oy + (i % 2 === 0 ? -r * .1 : r * .1);
      const g = ctx.createRadialGradient(x, y, 0, x, y, r * .35);
      g.addColorStop(0, lighten(bc, 10)); g.addColorStop(1, darken(bc, 5 + (vs.crustDarkness || 0)));
      ctx.beginPath(); ctx.ellipse(x, y, r * .35, r * .22, (i % 2 === 0 ? 1 : -1) * .3, 0, Math.PI * 2);
      ctx.fillStyle = g; ctx.fill(); ctx.strokeStyle = darken(bc, 15); ctx.lineWidth = .5; ctx.stroke();
    }
  }
}

function drawGlaze(ctx, cx, cy, r, shape) {
  ctx.save(); ctx.globalAlpha = .4;
  const g = ctx.createLinearGradient(cx - r, cy - r, cx + r, cy);
  g.addColorStop(0, 'rgba(255,255,255,.8)'); g.addColorStop(.5, 'rgba(255,245,220,.6)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.beginPath();
  ctx.ellipse(cx, cy, shape === 'loaf' ? r * 1.1 : r * .8, shape === 'loaf' ? r * .4 : r * .5, -.2, 0, Math.PI * 2);
  ctx.fillStyle = g; ctx.fill(); ctx.restore();
}

function drawSprinkles(ctx, cx, cy, r) {
  const cols = ['#e74c3c', '#3498db', '#2ecc71', '#f1c40f', '#9b59b6', '#e67e22'];
  for (let i = 0; i < 20; i++) {
    const a = Math.random() * Math.PI * 2, d = Math.random() * r * .7;
    ctx.save(); ctx.translate(cx + Math.cos(a) * d, cy + Math.sin(a) * d * .6);
    ctx.rotate(Math.random() * Math.PI);
    ctx.fillStyle = cols[Math.floor(Math.random() * cols.length)];
    ctx.fillRect(-3, -1, 6, 2); ctx.restore();
  }
}

function drawSparkles(ctx, w, h) {
  const t = Date.now() * .002;
  for (let i = 0; i < 5; i++) {
    const x = w * .2 + (Math.sin(t + i * 1.5) * .5 + .5) * w * .6;
    const y = h * .2 + (Math.cos(t + i * 2) * .5 + .5) * h * .6;
    const sz = 2 + Math.sin(t * 2 + i) * 1.5;
    ctx.save(); ctx.globalAlpha = .5 + Math.sin(t * 3 + i) * .3; ctx.fillStyle = '#f1c40f';
    ctx.beginPath();
    for (let j = 0; j < 8; j++) {
      const angle = (j * Math.PI) / 4 - Math.PI / 2, rad = j % 2 === 0 ? sz : sz * .4;
      const px = x + Math.cos(angle) * rad, py = y + Math.sin(angle) * rad;
      j === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
    }
    ctx.closePath(); ctx.fill(); ctx.restore();
  }
}

export function drawBread(canvas, recipe, size) {
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const w = canvas.width, h = canvas.height;
  ctx.clearRect(0, 0, w, h);
  const vs = { ...(recipe.visualStyle || {}) };
  if (!vs.shape && recipe.bakeMeta?.moldId) {
    const mold = getMoldById(recipe.bakeMeta.moldId);
    vs.shape = mold.shape;
  }
  if (!vs.shape && recipe.模具) {
    vs.shape = CLASSIC_MOLD_TO_SHAPE[recipe.模具] || 'round';
  }
  if (!vs.shape) vs.shape = 'round';
  const cx = w / 2, cy = h / 2;
  const r = (size || Math.min(w, h) * .38) * (vs.size || 1);

  if (vs.hasGlow) {
    const glow = ctx.createRadialGradient(cx, cy, r * .5, cx, cy, r * 1.5);
    glow.addColorStop(0, 'rgba(255,200,100,.3)'); glow.addColorStop(1, 'rgba(255,200,100,0)');
    ctx.fillStyle = glow; ctx.fillRect(0, 0, w, h);
  }
  ctx.save();
  if (vs.shape === 'loaf') drawLoaf(ctx, cx, cy, r, vs);
  else if (vs.shape === 'braided') drawBraided(ctx, cx, cy, r, vs);
  else if (vs.shape === 'baguette') drawBaguette(ctx, cx, cy, r, vs);
  else if (vs.shape === 'bun') drawBun(ctx, cx, cy, r, vs);
  else drawRound(ctx, cx, cy, r, vs);
  ctx.restore();
  if (vs.hasGlaze) drawGlaze(ctx, cx, cy - r * .2, r, vs.shape);
  if (vs.hasSprinkles) drawSprinkles(ctx, cx, cy - r * .3, r);
  if (vs.hasSparkle) drawSparkles(ctx, w, h);
}

export function drawAvatar(canvas, customer) {
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const w = canvas.width, h = canvas.height;
  ctx.clearRect(0, 0, w, h);
  const type = customer.personality.type;
  const color = customer.personality.typeData.color;
  const cx = w / 2, cy = h / 2;

  ctx.beginPath(); ctx.arc(cx, cy, w * .45, 0, Math.PI * 2);
  ctx.fillStyle = lighten(color, 35); ctx.fill();

  ctx.fillStyle = '#ffdbb4'; ctx.beginPath(); ctx.arc(cx, cy - 2, w * .28, 0, Math.PI * 2); ctx.fill();

  const r = w * .28, eyeY = cy - 2 - r * .1, sp = r * .35;
  ctx.fillStyle = '#333';
  ctx.beginPath(); ctx.arc(cx - sp, eyeY, r * .08, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(cx + sp, eyeY, r * .08, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = 'white';
  ctx.beginPath(); ctx.arc(cx - sp - 1, eyeY - 1, r * .03, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(cx + sp - 1, eyeY - 1, r * .03, 0, Math.PI * 2); ctx.fill();

  if (type === '好奇小孩') {
    ctx.fillStyle = '#ffaaaa';
    ctx.beginPath(); ctx.arc(cx - sp - r * .2, eyeY + r * .25, r * .12, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(cx + sp + r * .2, eyeY + r * .25, r * .12, 0, Math.PI * 2); ctx.fill();
  }

  const my = cy - 2 + r * .3;
  ctx.strokeStyle = '#333'; ctx.lineWidth = 1.5; ctx.lineCap = 'round';
  const mood = customer.personality.mood;
  if (mood === '开心' || mood === '期待') { ctx.beginPath(); ctx.arc(cx, my - r * .1, r * .2, .1 * Math.PI, .9 * Math.PI); ctx.stroke(); }
  else if (mood === '焦急' || mood === '疲惫') { ctx.beginPath(); ctx.moveTo(cx - r * .15, my); ctx.lineTo(cx + r * .15, my); ctx.stroke(); }
  else { ctx.beginPath(); ctx.arc(cx, my - r * .05, r * .15, .1 * Math.PI, .9 * Math.PI); ctx.stroke(); }

  ctx.fillStyle = darken(color, 10);
  if (type === '好奇小孩') {
    ctx.beginPath(); ctx.arc(cx, cy - 2 - r * .7, r * .6, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(cx - r * .6, cy - 2 - r * .5, r * .25, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(cx + r * .6, cy - 2 - r * .5, r * .25, 0, Math.PI * 2); ctx.fill();
  } else if (type === '神秘老人') {
    ctx.fillStyle = '#c0c0c0';
    ctx.beginPath(); ctx.ellipse(cx, cy - 2 - r * .6, r * .9, r * .5, 0, Math.PI, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#d0d0d0';
    ctx.beginPath(); ctx.ellipse(cx, cy - 2 + r * .8, r * .4, r * .35, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#4a3728';
    ctx.beginPath(); ctx.ellipse(cx, cy - w * .35, w * .35, w * .08, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.moveTo(cx - w * .15, cy - w * .35); ctx.lineTo(cx, cy - w * .55); ctx.lineTo(cx + w * .15, cy - w * .35); ctx.closePath(); ctx.fill();
  } else {
    ctx.beginPath(); ctx.ellipse(cx, cy - 2 - r * .7, r * .8, r * .45, 0, 0, Math.PI * 2); ctx.fill();
  }

  if (type === '匆忙上班族') {
    ctx.fillStyle = '#2c3e50';
    ctx.fillRect(cx - w * .15, cy + w * .2, w * .3, w * .06);
    ctx.fillRect(cx - w * .03, cy + w * .15, w * .06, w * .18);
  } else if (type === '健康达人') {
    ctx.strokeStyle = '#27ae60'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(cx, cy - w * .05, w * .08, 0, Math.PI * 2); ctx.stroke();
  }
}
