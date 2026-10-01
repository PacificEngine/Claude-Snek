import { createState, queueDirection, tick, togglePause } from './core/game.js';
import { ticksPerSecond, bpm } from './core/pacing.js';
import { loadHighScore, saveHighScore } from './storage.js';
import { actionForKey } from './input.js';
import { createMusic } from './audio.js';
import { render } from './renderer.js';

const canvas = document.getElementById('board');
const ctx = canvas.getContext('2d');
const scoreEl = document.getElementById('score');
const bestEl = document.getElementById('best');
const messageEl = document.getElementById('message');
const muteBtn = document.getElementById('mute');

const music = createMusic();
let best = loadHighScore();
let state = createState(Math.random);
let started = false;
let timer = null;

function updateHud() {
  scoreEl.textContent = String(state.score);
  bestEl.textContent = String(best);
  muteBtn.setAttribute('aria-pressed', String(music.isMuted()));
  if (state.status === 'gameOver') messageEl.textContent = 'Game over — press Enter to restart';
  else if (state.status === 'paused') messageEl.textContent = 'Paused — press P to resume';
  else messageEl.textContent = started ? '' : 'Press an arrow key or WASD to start';
}

function draw() {
  render(ctx, state);
  updateHud();
}

function scheduleNext() {
  clearTimeout(timer);
  if (state.status !== 'playing') return;
  timer = setTimeout(step, 1000 / ticksPerSecond(state.snake.length));
}

function step() {
  state = tick(state, Math.random);
  music.setBpm(bpm(state.snake.length));
  if (state.score > best) {
    best = state.score;
    saveHighScore(best);
  }
  draw();
  scheduleNext();
}

function restart() {
  state = createState(Math.random);
  started = false;
  music.setBpm(bpm(state.snake.length));
  clearTimeout(timer);
  draw();
}

function toggleMute() {
  music.setMuted(!music.isMuted());
  updateHud();
}

document.addEventListener('keydown', (event) => {
  if (typeof event.key !== 'string') return;
  if (event.ctrlKey || event.metaKey || event.altKey) return;
  const action = actionForKey(event.key);
  if (!action) return;
  if (event.repeat && action.type !== 'direction') return;
  event.preventDefault();
  music.start();

  if (action.type === 'direction') {
    state = queueDirection(state, action.direction);
    if (!started) {
      started = true;
      draw();
      scheduleNext();
    }
  } else if (action.type === 'pause' && started) {
    state = togglePause(state);
    draw();
    scheduleNext();
  } else if (action.type === 'restart' && state.status === 'gameOver') {
    restart();
  } else if (action.type === 'mute') {
    toggleMute();
  }
});

muteBtn.addEventListener('click', toggleMute);

draw();
