import { GRID_SIZE } from './core/config.js';
import { emptyHazards, isSolid, isGhostVisible, fadeOpacity } from './core/hazards.js';

const SNAKE_COLOR = '#1f7a5c';
const HEAD_COLOR = '#14573f';
const FOOD_COLOR = '#c2410c';
const GRID_COLOR = '#eef1f4';
const WALL_COLOR = '#334155';
const BOMB_COLOR = '#111827';
const SPARK_COLOR = '#f59e0b';
const ENEMY_COLOR = '#7e22ce';
const ENEMY_HEAD_COLOR = '#581c87';
const DEAD_COLOR = '#9ca3af';
const GHOST_STROKE = '#475569';
const GHOST_FILL = 'rgba(100, 116, 139, 0.18)';

function drawGrid(ctx, size, count) {
  ctx.strokeStyle = GRID_COLOR;
  ctx.lineWidth = 1;
  for (let i = 1; i < count; i++) {
    ctx.beginPath();
    ctx.moveTo(i * size, 0); ctx.lineTo(i * size, ctx.canvas.height);
    ctx.moveTo(0, i * size); ctx.lineTo(ctx.canvas.width, i * size);
    ctx.stroke();
  }
}

function square(ctx, cell, size, pad) {
  ctx.beginPath();
  ctx.roundRect(cell.x * size + pad, cell.y * size + pad, size - pad * 2, size - pad * 2, size * 0.25);
}

function drawGhost(ctx, obj, size, pad, reducedMotion, stroke = GHOST_STROKE) {
  if (!isGhostVisible(obj.age, reducedMotion, obj.telegraph)) return;
  ctx.save();
  ctx.setLineDash([size * 0.18, size * 0.12]);
  ctx.lineWidth = 2;
  ctx.strokeStyle = stroke;
  ctx.fillStyle = GHOST_FILL;
  obj.cells.forEach((cell) => {
    square(ctx, cell, size, pad);
    ctx.fill();
    ctx.stroke();
  });
  ctx.restore();
}

function drawWalls(ctx, state, size, pad, reducedMotion) {
  state.hazards.walls.forEach((wall) => {
    if (!isSolid(wall, state.snake)) {
      drawGhost(ctx, wall, size, pad, reducedMotion);
      return;
    }
    const opacity = fadeOpacity(wall);
    if (opacity <= 0) return;
    ctx.save();
    ctx.globalAlpha = opacity;
    ctx.fillStyle = WALL_COLOR;
    wall.cells.forEach((cell) => {
      ctx.beginPath();
      ctx.rect(cell.x * size + pad / 2, cell.y * size + pad / 2, size - pad, size - pad);
      ctx.fill();
    });
    ctx.restore();
  });
}

function drawBombs(ctx, state, size, pad, reducedMotion) {
  state.hazards.bombs.forEach((bomb) => {
    if (!isSolid(bomb, state.snake)) {
      drawGhost(ctx, bomb, size, pad, reducedMotion);
      return;
    }
    const opacity = fadeOpacity(bomb);
    if (opacity <= 0) return;
    const { x, y } = bomb.cells[0];
    const cx = (x + 0.5) * size;
    const cy = (y + 0.5) * size;
    const r = size * 0.42;
    ctx.save();
    ctx.globalAlpha = opacity;
    ctx.fillStyle = BOMB_COLOR;
    ctx.beginPath();
    ctx.moveTo(cx, cy - r);
    ctx.lineTo(cx + r, cy);
    ctx.lineTo(cx, cy + r);
    ctx.lineTo(cx - r, cy);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = SPARK_COLOR;
    ctx.beginPath();
    ctx.arc(cx + r * 0.45, cy - r * 0.45, size * 0.1, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  });
}

function drawEnemies(ctx, state, size, pad, reducedMotion) {
  state.hazards.enemies.forEach((enemy) => drawEnemy(ctx, enemy, size, pad, reducedMotion));
}

function drawEnemy(ctx, enemy, size, pad, reducedMotion) {
  if (enemy.status === 'ghost') {
    drawGhost(ctx, enemy, size, pad, reducedMotion, ENEMY_COLOR);
    return;
  }
  enemy.cells.forEach((cell, i) => {
    ctx.fillStyle = enemy.status === 'dead' ? DEAD_COLOR : i === 0 ? ENEMY_HEAD_COLOR : ENEMY_COLOR;
    square(ctx, cell, size, pad);
    ctx.fill();
    if (enemy.status === 'dead') {
      ctx.strokeStyle = '#374151';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(cell.x * size + size * 0.3, cell.y * size + size * 0.3);
      ctx.lineTo(cell.x * size + size * 0.7, cell.y * size + size * 0.7);
      ctx.moveTo(cell.x * size + size * 0.7, cell.y * size + size * 0.3);
      ctx.lineTo(cell.x * size + size * 0.3, cell.y * size + size * 0.7);
      ctx.stroke();
    }
  });
}

export function render(ctx, state, options = {}) {
  const reducedMotion = options.reducedMotion ?? false;
  const count = state.settings?.gridSize ?? GRID_SIZE;
  const size = ctx.canvas.width / count;
  const pad = size * 0.08;
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  drawGrid(ctx, size, count);

  const view = { ...state, hazards: state.hazards ?? emptyHazards() };
  drawWalls(ctx, view, size, pad, reducedMotion);
  drawBombs(ctx, view, size, pad, reducedMotion);
  drawEnemies(ctx, view, size, pad, reducedMotion);

  state.snake.forEach((cell, i) => {
    ctx.fillStyle = i === 0 ? HEAD_COLOR : SNAKE_COLOR;
    square(ctx, cell, size, pad);
    ctx.fill();
  });

  if (state.food) {
    ctx.fillStyle = FOOD_COLOR;
    ctx.beginPath();
    ctx.arc((state.food.x + 0.5) * size, (state.food.y + 0.5) * size, size * 0.35, 0, Math.PI * 2);
    ctx.fill();
  }
}
