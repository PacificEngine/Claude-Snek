import { createState, queueDirection, tick, togglePause } from './core/game.js';
import { bpm, musicTier } from './core/pacing.js';
import { createTierGate } from './core/tier-gate.js';
import { loadHighScore, saveHighScore } from './storage.js';
import { actionForKey } from './input.js';
import { createSynth } from './synth.js';
import { createConductor } from './conductor.js';
import { render } from './renderer.js';

const canvas = document.getElementById('board');
const ctx = canvas.getContext('2d');
const scoreEl = document.getElementById('score');
const bestEl = document.getElementById('best');
const messageEl = document.getElementById('message');
const muteBtn = document.getElementById('mute');

const synth = createSynth();
let best = loadHighScore();
let state = createState(Math.random);
let started = false;
// Bumped whenever the beat stops, so steps already scheduled ahead are dropped.
let epoch = 0;
// New layers enter on the next bar line, not the moment an apple is eaten.
const tierGate = createTierGate(() => musicTier(state.snake.length));

const conductor = createConductor({
  now: () => synth.now(),
  getBpm: () => bpm(state.snake.length),
  onStep(step, time, dt) {
    synth.playStep(step, time, dt, tierGate.tierFor(step));
    const scheduledIn = epoch;
    setTimeout(() => {
      if (scheduledIn === epoch) advance();
    }, Math.max(0, (time - synth.now()) * 1000));
  },
});

function updateHud() {
  scoreEl.textContent = String(state.score);
  bestEl.textContent = String(best);
  muteBtn.setAttribute('aria-pressed', String(synth.isMuted()));
  if (state.status === 'gameOver') messageEl.textContent = 'Game over — press Enter to restart';
  else if (state.status === 'paused') messageEl.textContent = 'Paused — press P to resume';
  else messageEl.textContent = started ? '' : 'Press an arrow key or WASD to start';
}

function draw() {
  render(ctx, state);
  updateHud();
}

function stopBeat() {
  epoch += 1;
  conductor.pause();
  synth.silence();
}

// One snake step, applied on the beat.
function advance() {
  state = tick(state, Math.random);
  if (state.score > best) {
    best = state.score;
    saveHighScore(best);
  }
  if (state.status === 'gameOver') stopBeat();
  draw();
}

function restart() {
  state = createState(Math.random);
  started = false;
  draw();
}

function toggleMute() {
  synth.setMuted(!synth.isMuted());
  updateHud();
}

document.addEventListener('keydown', (event) => {
  if (typeof event.key !== 'string') return;
  if (event.ctrlKey || event.metaKey || event.altKey) return;
  const action = actionForKey(event.key);
  if (!action) return;
  if (event.repeat && action.type !== 'direction') return;
  event.preventDefault();

  if (action.type === 'direction') {
    state = queueDirection(state, action.direction);
    if (!started) {
      started = true;
      synth.start();
      conductor.start();
      draw();
    }
  } else if (action.type === 'pause' && started) {
    state = togglePause(state);
    if (state.status === 'paused') stopBeat();
    else if (state.status === 'playing') conductor.resume();
    draw();
  } else if (action.type === 'restart' && state.status === 'gameOver') {
    restart();
  } else if (action.type === 'mute') {
    toggleMute();
  }
});

muteBtn.addEventListener('click', toggleMute);

draw();
