import { GRID_SIZE } from './core/config.js';

const SNAKE_COLOR = '#1f7a5c';
const HEAD_COLOR = '#14573f';
const FOOD_COLOR = '#c2410c';
const GRID_COLOR = '#eef1f4';

export function render(ctx, state) {
  const size = ctx.canvas.width / GRID_SIZE;
  const pad = size * 0.08;
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);

  ctx.strokeStyle = GRID_COLOR;
  ctx.lineWidth = 1;
  for (let i = 1; i < GRID_SIZE; i++) {
    ctx.beginPath();
    ctx.moveTo(i * size, 0); ctx.lineTo(i * size, ctx.canvas.height);
    ctx.moveTo(0, i * size); ctx.lineTo(ctx.canvas.width, i * size);
    ctx.stroke();
  }

  state.snake.forEach((cell, i) => {
    ctx.fillStyle = i === 0 ? HEAD_COLOR : SNAKE_COLOR;
    ctx.beginPath();
    ctx.roundRect(cell.x * size + pad, cell.y * size + pad, size - pad * 2, size - pad * 2, size * 0.25);
    ctx.fill();
  });

  if (state.food) {
    ctx.fillStyle = FOOD_COLOR;
    ctx.beginPath();
    ctx.arc((state.food.x + 0.5) * size, (state.food.y + 0.5) * size, size * 0.35, 0, Math.PI * 2);
    ctx.fill();
  }
}
