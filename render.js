// Renders a captured tab image into a browser-window mockup on a canvas.

export const BACKGROUNDS = {
  grape:    ['#a18cd1', '#fbc2eb'],
  ocean:    ['#4facfe', '#00f2fe'],
  sunset:   ['#ff9a9e', '#fecfef'],
  peach:    ['#f6d365', '#fda085'],
  mint:     ['#84fab0', '#8fd3f4'],
  midnight: ['#0f2027', '#2c5364'],
  white:    ['#ffffff', '#ffffff'],
  none:     null,
};

const PADDING = { s: 0.04, m: 0.08, l: 0.12 };

const THEMES = {
  light: {
    barTop: '#f7f7f8', barBottom: '#e9e9ec', divider: '#d4d4d8',
    pill: '#ffffff', pillBorder: 'rgba(0,0,0,0.08)',
    text: '#1f2937', muted: '#6b7280', icon: '#9ca3af',
    outline: 'rgba(0,0,0,0.14)',
  },
  dark: {
    barTop: '#323236', barBottom: '#28282c', divider: '#18181b',
    pill: '#1c1c1f', pillBorder: 'rgba(255,255,255,0.06)',
    text: '#f3f4f6', muted: '#9ca3af', icon: '#71717a',
    outline: 'rgba(255,255,255,0.10)',
  },
};

const FONT = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';

function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

function fitText(ctx, text, maxW) {
  if (ctx.measureText(text).width <= maxW) return text;
  let lo = 0, hi = text.length;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (ctx.measureText(text.slice(0, mid) + '…').width <= maxW) lo = mid;
    else hi = mid - 1;
  }
  return text.slice(0, lo) + '…';
}

function splitUrl(raw) {
  try {
    const u = new URL(raw);
    if (u.protocol === 'http:' || u.protocol === 'https:') {
      const rest = u.pathname + u.search + u.hash;
      return { secure: u.protocol === 'https:', host: u.host, rest: rest === '/' ? '' : rest };
    }
  } catch { /* fall through */ }
  return { secure: false, host: raw || '', rest: '' };
}

function drawLock(ctx, x, cy, u, color) {
  const w = 9 * u, h = 7 * u;
  ctx.fillStyle = color;
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.6 * u;
  ctx.beginPath();
  ctx.arc(x + w / 2, cy - 1 * u, 3 * u, Math.PI, 0);
  ctx.lineTo(x + w / 2 + 3 * u, cy + 1 * u);
  ctx.moveTo(x + w / 2 - 3 * u, cy - 1 * u);
  ctx.lineTo(x + w / 2 - 3 * u, cy + 1 * u);
  ctx.stroke();
  ctx.beginPath();
  ctx.roundRect(x, cy, w, h, 1.5 * u);
  ctx.fill();
  return w;
}

function drawChevron(ctx, cx, cy, u, dir, color) {
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.8 * u;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(cx + 3 * u * dir, cy - 6 * u);
  ctx.lineTo(cx - 3 * u * dir, cy);
  ctx.lineTo(cx + 3 * u * dir, cy + 6 * u);
  ctx.stroke();
}

function drawReload(ctx, cx, cy, u, color) {
  const r = 6 * u;
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.8 * u;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.arc(cx, cy, r, -Math.PI * 0.35, Math.PI * 1.45);
  ctx.stroke();
  const a = -Math.PI * 0.35;
  const ex = cx + r * Math.cos(a), ey = cy + r * Math.sin(a);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(ex + 3.5 * u, ey - 2.5 * u);
  ctx.lineTo(ex - 0.5 * u, ey + 3.5 * u);
  ctx.lineTo(ex - 3 * u, ey - 3 * u);
  ctx.closePath();
  ctx.fill();
}

/**
 * @param {HTMLImageElement} img  captured tab
 * @param {string} url            page URL for the location bar
 * @param {{scale:number, theme:'light'|'dark', background:string, padding:'s'|'m'|'l'}} opts
 *   scale = image pixels per CSS pixel, so the frame matches a real browser at that viewport
 */
export function renderMockup(img, url, opts) {
  const W = img.width;
  const H = img.height;
  const u = opts.scale || 1;
  const t = THEMES[opts.theme] || THEMES.light;
  const bg = BACKGROUNDS[opts.background];
  const pad = Math.round(W * (PADDING[opts.padding] ?? PADDING.m));
  const barH = Math.round(46 * u);
  const radius = 12 * u;

  const canvas = makeCanvas(W + pad * 2, H + barH + pad * 2);
  const ctx = canvas.getContext('2d');

  if (bg) {
    const g = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
    g.addColorStop(0, bg[0]);
    g.addColorStop(1, bg[1]);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  const x = pad, y = pad, winH = H + barH;
  const windowPath = () => {
    ctx.beginPath();
    ctx.roundRect(x, y, W, winH, radius);
  };

  // Soft layered shadow: a wide ambient one plus a tight contact one.
  const shadows = [
    { blur: 80 * u, oy: 40 * u, color: 'rgba(0,0,0,0.28)' },
    { blur: 24 * u, oy: 10 * u, color: 'rgba(0,0,0,0.18)' },
    { blur: 4 * u, oy: 1 * u, color: 'rgba(0,0,0,0.12)' },
  ];
  for (const s of shadows) {
    ctx.save();
    ctx.shadowColor = s.color;
    ctx.shadowBlur = s.blur;
    ctx.shadowOffsetY = s.oy;
    ctx.fillStyle = t.barBottom;
    windowPath();
    ctx.fill();
    ctx.restore();
  }

  ctx.save();
  windowPath();
  ctx.clip();

  const bar = ctx.createLinearGradient(0, y, 0, y + barH);
  bar.addColorStop(0, t.barTop);
  bar.addColorStop(1, t.barBottom);
  ctx.fillStyle = bar;
  ctx.fillRect(x, y, W, barH);
  ctx.fillStyle = t.divider;
  ctx.fillRect(x, y + barH - Math.max(1, u), W, Math.max(1, u));

  ctx.drawImage(img, x, y + barH, W, H);
  ctx.restore();

  const cy = y + barH / 2;

  // Traffic lights
  ['#ff5f57', '#febc2e', '#28c840'].forEach((c, i) => {
    ctx.beginPath();
    ctx.arc(x + 22 * u + i * 20 * u, cy, 6.5 * u, 0, Math.PI * 2);
    ctx.fillStyle = c;
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.12)';
    ctx.lineWidth = 0.8 * u;
    ctx.stroke();
  });

  // Navigation
  drawChevron(ctx, x + 98 * u, cy, u, 1, t.icon);
  drawChevron(ctx, x + 126 * u, cy, u, -1, t.icon);
  drawReload(ctx, x + 156 * u, cy, u, t.icon);

  // Location bar
  const pillH = 30 * u;
  const pillX = x + 190 * u;
  const pillW = W - 190 * u - 90 * u;
  ctx.beginPath();
  ctx.roundRect(pillX, cy - pillH / 2, pillW, pillH, pillH / 2);
  ctx.fillStyle = t.pill;
  ctx.fill();
  ctx.strokeStyle = t.pillBorder;
  ctx.lineWidth = Math.max(1, u);
  ctx.stroke();

  const { secure, host, rest } = splitUrl(url);
  const fontPx = 13.5 * u;
  let tx = pillX + 16 * u;
  if (secure) tx += drawLock(ctx, tx, cy - 2 * u, u, t.muted) + 8 * u;
  const maxTextW = pillX + pillW - 16 * u - tx;

  ctx.textBaseline = 'middle';
  ctx.font = `600 ${fontPx}px ${FONT}`;
  const hostText = fitText(ctx, host, maxTextW);
  ctx.fillStyle = t.text;
  ctx.fillText(hostText, tx, cy + 0.5 * u);
  const hostW = ctx.measureText(hostText).width;

  if (rest && hostText === host) {
    ctx.font = `400 ${fontPx}px ${FONT}`;
    ctx.fillStyle = t.muted;
    ctx.fillText(fitText(ctx, rest, maxTextW - hostW), tx + hostW, cy + 0.5 * u);
  }

  // Right-side menu dots
  for (let i = -1; i <= 1; i++) {
    ctx.beginPath();
    ctx.arc(x + W - 44 * u, cy + i * 5.5 * u, 1.8 * u, 0, Math.PI * 2);
    ctx.fillStyle = t.icon;
    ctx.fill();
  }

  // Hairline outline for crisp edges on any background
  ctx.save();
  windowPath();
  ctx.strokeStyle = t.outline;
  ctx.lineWidth = Math.max(1, u);
  ctx.stroke();
  ctx.restore();

  return canvas;
}
