import { GRID_SIZE } from './core/config.js';
import { emptyHazards, isSolid, isGhostVisible, fadeOpacity } from './core/hazards.js';
import { DEFAULT_THEMES, DEFAULT_THEME_ID } from './core/theme.js';
import { traceShape } from './core/shapes.js';

const DEAD_CROSS_COLOR = '#374151';
const GHOST_ALPHA = 0.18;

// '#rrggbb' as an rgba() string, for the faint fill of a ghost.
function faint(hex) {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  return `rgba(${r}, ${g}, ${b}, ${GHOST_ALPHA})`;
}

// Where and how big each cell is drawn.
function metrics(ctx, count) {
  const size = ctx.canvas.width / count;
  return { size, pad: size * 0.08, radius: size * 0.25 };
}

const centre = (cell, size) => [(cell.x + 0.5) * size, (cell.y + 0.5) * size];

// Builds the path of `shape` in `cell`; `half` is the half-width of the shape inside the cell.
function trace(ctx, shape, cell, m, half) {
  const [cx, cy] = centre(cell, m.size);
  traceShape(ctx, shape, cx, cy, half, m.radius);
}

function drawGrid(ctx, size, count, color) {
  ctx.strokeStyle = color;
  ctx.lineWidth = 1;
  for (let i = 1; i < count; i++) {
    ctx.beginPath();
    ctx.moveTo(i * size, 0); ctx.lineTo(i * size, ctx.canvas.height);
    ctx.moveTo(0, i * size); ctx.lineTo(ctx.canvas.width, i * size);
    ctx.stroke();
  }
}

// An obstacle that is not solid yet: the dashed outline of its shape in its colour over a faint fill of the same colour.
function drawGhost(ctx, obj, m, look, reducedMotion) {
  if (!isGhostVisible(obj.age, reducedMotion, obj.telegraph)) return;
  ctx.save();
  ctx.setLineDash([m.size * 0.18, m.size * 0.12]);
  ctx.lineWidth = 2;
  ctx.strokeStyle = look.color;
  ctx.fillStyle = faint(look.color);
  obj.cells.forEach((cell) => {
    trace(ctx, look.shape, cell, m, look.half);
    ctx.fill();
    ctx.stroke();
  });
  ctx.restore();
}

function drawWalls(ctx, state, m, theme, reducedMotion) {
  const look = { shape: theme.shapes.wall, color: theme.colors.wall, half: m.size / 2 - m.pad / 2 };
  state.hazards.walls.forEach((wall) => {
    if (!isSolid(wall, state.snake)) {
      drawGhost(ctx, wall, m, look, reducedMotion);
      return;
    }
    const opacity = fadeOpacity(wall);
    if (opacity <= 0) return;
    ctx.save();
    ctx.globalAlpha = opacity;
    ctx.fillStyle = look.color;
    wall.cells.forEach((cell) => {
      trace(ctx, look.shape, cell, m, look.half);
      ctx.fill();
    });
    ctx.restore();
  });
}

function drawBombs(ctx, state, m, theme, reducedMotion) {
  const look = { shape: theme.shapes.bomb, color: theme.colors.bomb, half: m.size * 0.42 };
  state.hazards.bombs.forEach((bomb) => {
    if (!isSolid(bomb, state.snake)) {
      drawGhost(ctx, bomb, m, look, reducedMotion);
      return;
    }
    const opacity = fadeOpacity(bomb);
    if (opacity <= 0) return;
    const [cx, cy] = centre(bomb.cells[0], m.size);
    ctx.save();
    ctx.globalAlpha = opacity;
    ctx.fillStyle = look.color;
    trace(ctx, look.shape, bomb.cells[0], m, look.half);
    ctx.fill();
    ctx.fillStyle = theme.colors.spark;
    ctx.beginPath();
    ctx.arc(cx + look.half * 0.45, cy - look.half * 0.45, m.size * 0.1, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  });
}

function drawEnemy(ctx, enemy, m, theme, reducedMotion) {
  const half = m.size / 2 - m.pad;
  if (enemy.status === 'ghost') {
    drawGhost(ctx, enemy, m, { shape: theme.shapes.enemyBody, color: theme.colors.enemyBody, half }, reducedMotion);
    return;
  }
  const dead = enemy.status === 'dead';
  enemy.cells.forEach((cell, i) => {
    const part = i === 0 ? 'enemyHead' : 'enemyBody';
    ctx.fillStyle = dead ? theme.colors.dead : theme.colors[part];
    trace(ctx, dead ? theme.shapes.dead : theme.shapes[part], cell, m, half);
    ctx.fill();
    if (dead) {
      ctx.strokeStyle = DEAD_CROSS_COLOR;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(cell.x * m.size + m.size * 0.3, cell.y * m.size + m.size * 0.3);
      ctx.lineTo(cell.x * m.size + m.size * 0.7, cell.y * m.size + m.size * 0.7);
      ctx.moveTo(cell.x * m.size + m.size * 0.7, cell.y * m.size + m.size * 0.3);
      ctx.lineTo(cell.x * m.size + m.size * 0.3, cell.y * m.size + m.size * 0.7);
      ctx.stroke();
    }
  });
}

export function render(ctx, state, options = {}) {
  const reducedMotion = options.reducedMotion ?? false;
  const theme = options.theme ?? DEFAULT_THEMES[DEFAULT_THEME_ID];
  const count = state.settings?.gridSize ?? GRID_SIZE;
  const m = metrics(ctx, count);
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  ctx.fillStyle = theme.colors.board;
  ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  drawGrid(ctx, m.size, count, theme.colors.grid);

  const view = { ...state, hazards: state.hazards ?? emptyHazards() };
  drawWalls(ctx, view, m, theme, reducedMotion);
  drawBombs(ctx, view, m, theme, reducedMotion);
  view.hazards.enemies.forEach((enemy) => drawEnemy(ctx, enemy, m, theme, reducedMotion));

  const snakeHalf = m.size / 2 - m.pad;
  state.snake.forEach((cell, i) => {
    ctx.fillStyle = i === 0 ? theme.colors.head : theme.colors.body;
    trace(ctx, i === 0 ? theme.shapes.head : theme.shapes.body, cell, m, snakeHalf);
    ctx.fill();
  });

  if (state.food) {
    ctx.fillStyle = theme.colors.apple;
    trace(ctx, theme.shapes.apple, state.food, m, m.size * 0.35);
    ctx.fill();
  }
}
