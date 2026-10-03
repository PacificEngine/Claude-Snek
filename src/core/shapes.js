// Shape paths for the board. Pure geometry on a 2D context: each builds a path inside the box cx±half, cy±half
// and leaves filling or stroking to the caller.

const polygon = (ctx, points) => {
  points.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)));
  ctx.closePath();
};

// `count` points around the centre, starting at the top and going clockwise; radiusAt(i) is each point's distance.
const ring = (cx, cy, count, radiusAt) =>
  Array.from({ length: count }, (_, i) => {
    const angle = -Math.PI / 2 + (i * 2 * Math.PI) / count;
    return [cx + radiusAt(i) * Math.cos(angle), cy + radiusAt(i) * Math.sin(angle)];
  });

const PATHS = {
  square: (ctx, cx, cy, h) => ctx.rect(cx - h, cy - h, h * 2, h * 2),
  rounded: (ctx, cx, cy, h, radius) => ctx.roundRect(cx - h, cy - h, h * 2, h * 2, radius),
  circle: (ctx, cx, cy, h) => ctx.arc(cx, cy, h, 0, Math.PI * 2),
  diamond: (ctx, cx, cy, h) => polygon(ctx, [[cx, cy - h], [cx + h, cy], [cx, cy + h], [cx - h, cy]]),
  triangle: (ctx, cx, cy, h) => polygon(ctx, [[cx, cy - h], [cx + h, cy + h], [cx - h, cy + h]]),
  hexagon: (ctx, cx, cy, h) => polygon(ctx, ring(cx, cy, 6, () => h)),
  star: (ctx, cx, cy, h) => polygon(ctx, ring(cx, cy, 10, (i) => (i % 2 === 0 ? h : h * 0.45))),
  cross: (ctx, cx, cy, h) => {
    const a = h / 3;
    polygon(ctx, [[-a, -h], [a, -h], [a, -a], [h, -a], [h, a], [a, a], [a, h], [-a, h], [-a, a], [-h, a], [-h, -a], [-a, -a]].map(([x, y]) => [cx + x, cy + y]));
  },
};

// Starts a new path for `shape` centred on (cx, cy). Unknown shapes are the rounded square.
// `radius` is the corner radius of the rounded square (default: half of halfSize).
export function traceShape(ctx, shape, cx, cy, halfSize, radius = halfSize / 2) {
  ctx.beginPath();
  (PATHS[shape] ?? PATHS.rounded)(ctx, cx, cy, halfSize, radius);
}
