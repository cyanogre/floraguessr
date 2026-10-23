/** Helecho de Barnsley (sistema de funciones iteradas) dibujado a tinta en un canvas. */
export function drawFern(canvas: HTMLCanvasElement, color: string, points = 60_000): void {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  if (!w || !h) return;
  canvas.width = w * dpr;
  canvas.height = h * dpr;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.scale(dpr, dpr);
  ctx.fillStyle = color;
  const scale = Math.min(w / 6, h / 10.4);
  const ox = w / 2;
  const oy = h - 4;
  let x = 0;
  let y = 0;
  for (let i = 0; i < points; i++) {
    const r = Math.random();
    let nx: number;
    let ny: number;
    if (r < 0.01) [nx, ny] = [0, 0.16 * y];
    else if (r < 0.86) [nx, ny] = [0.85 * x + 0.04 * y, -0.04 * x + 0.85 * y + 1.6];
    else if (r < 0.93) [nx, ny] = [0.2 * x - 0.26 * y, 0.23 * x + 0.22 * y + 1.6];
    else [nx, ny] = [-0.15 * x + 0.28 * y, 0.26 * x + 0.24 * y + 0.44];
    x = nx;
    y = ny;
    // Ligera inclinación, como una fronda prensada.
    const px = ox + (x * Math.cos(-0.12) - y * Math.sin(-0.12) * 0.3) * scale;
    const py = oy - y * scale;
    ctx.globalAlpha = 0.55 + Math.random() * 0.45;
    ctx.fillRect(px, py, 0.9, 0.9);
  }
}
