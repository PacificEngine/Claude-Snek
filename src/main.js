import { createState, queueDirection, tick, togglePause } from './core/game.js';
import { bpm, activeLayers, placementBudgetMs } from './core/pacing.js';
import { createLayerGate } from './core/layer-gate.js';
import { loadBest, saveBest, loadDifficulty, saveDifficulty, loadCustom, saveCustom, loadMusic, saveMusic, loadMusicRandom, saveMusicRandom, loadTrack, saveTrack, loadTrackRandom, saveTrackRandom, SCORED } from './storage.js';
import { settingsFor, withMusic, musicForGame, trackForGame } from './core/difficulty.js';
import { createMenu, difficultyLabel } from './menu.js';
import { actionForKey, actionForButton } from './input.js';
import { createSynth } from './synth.js';
import { createConductor } from './conductor.js';
import { render } from './renderer.js';

const canvas = document.getElementById('board');
const ctx = canvas.getContext('2d');
const scoreEl = document.getElementById('score');
const bestEl = document.getElementById('best');
const messageEl = document.getElementById('message');
const muteBtn = document.getElementById('mute');
const bestWrap = document.getElementById('best-wrap');
const difficultyBtn = document.getElementById('difficulty-open');

const synth = createSynth();
let difficulty = loadDifficulty();
let custom = loadCustom();
let music = loadMusic();
let musicRandom = loadMusicRandom();
// The soundtrack: the player's pick, or (with "Randomize Track Every Game") a fresh draw per game that never replaces the pick.
let track = loadTrack();
let trackRandom = loadTrackRandom();
let gameTrack = trackForGame(track, trackRandom, Math.random);
// The settings for the next run: the difficulty's (Random re-rolls here, but never the music) plus the global music triggers.
// "Randomize Triggers Every Game" swaps in a fresh music roll for that game only; `music` (the player's own) is never replaced by it.
const nextSettings = (gameMusic = musicForGame(music, musicRandom, Math.random), base = settingsFor(difficulty, custom, Math.random)) =>
  withMusic(base, gameMusic);
let settings = nextSettings();
let best = loadBest(difficulty);
let state = createState(Math.random, settings);
let started = false;
// Bumped whenever the beat stops, so steps already scheduled ahead are dropped.
let epoch = 0;
// New layers enter on the next bar line, not the moment an apple is eaten.
const layerGate = createLayerGate(() => activeLayers(state.score, state.settings));

const conductor = createConductor({
  now: () => synth.now(),
  getBpm: () => bpm(state.score, state.settings),
  onStep(step, time, dt) {
    synth.playStep(step, time, dt, layerGate.layersFor(step), gameTrack);
    const scheduledIn = epoch;
    setTimeout(() => {
      if (scheduledIn === epoch) advance();
    }, Math.max(0, (time - synth.now()) * 1000));
  },
});

const runInProgress = () => started && state.status !== 'gameOver';

function updateHud() {
  scoreEl.textContent = String(state.score);
  bestEl.textContent = String(best);
  bestWrap.hidden = !SCORED.includes(difficulty);
  difficultyBtn.textContent = `Difficulty: ${difficultyLabel(difficulty)}`;
  difficultyBtn.setAttribute('aria-label', `Difficulty: ${difficultyLabel(difficulty)}, choose difficulty`);
  difficultyBtn.disabled = runInProgress();
  muteBtn.setAttribute('aria-pressed', String(synth.isMuted()));
  if (state.status === 'gameOver') messageEl.textContent = 'Game over — press Enter or tap Restart';
  else if (state.status === 'paused') messageEl.textContent = 'Paused — press P or tap Pause to resume';
  else messageEl.textContent = started ? '' : 'Press an arrow key or WASD, or tap a direction, to start';
}

const reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');

function draw() {
  render(ctx, state, { reducedMotion: reducedMotionQuery.matches });
  updateHud();
}

function stopBeat() {
  epoch += 1;
  conductor.pause();
  synth.silence();
}

// One snake step, applied on the beat. Obstacle placement after an apple may use half the step (placementBudgetMs);
// whatever does not fit carries over to the next steps, so a big apple step never stalls the beat.
function advance() {
  state = tick(state, Math.random, { now: () => performance.now(), budgetMs: placementBudgetMs(bpm(state.score, state.settings)) });
  if (SCORED.includes(difficulty) && state.score > best) {
    best = state.score;
    saveBest(difficulty, best);
  }
  if (state.status === 'gameOver') {
    stopBeat();
    // Random re-rolls for the next run now, so the menu shows what the next run will use.
    settings = nextSettings();
    gameTrack = trackForGame(track, trackRandom, Math.random);
  }
  draw();
}

function restart() {
  state = createState(Math.random, settings);
  started = false;
  draw();
}

// `roll` is the Random roll the dialog previewed, so what was shown is what runs.
// `nextTrackRoll` is the track the dialog previewed for the next game (used as is, like the music roll).
function applyDifficulty(nextDifficulty, nextCustom, roll, nextMusic, nextMusicRandom, musicRoll, nextTrack = track, nextTrackRandom = trackRandom, nextTrackRoll) {
  stopBeat();
  difficulty = nextDifficulty;
  custom = nextCustom;
  music = nextMusic;
  musicRandom = nextMusicRandom;
  track = nextTrack;
  trackRandom = nextTrackRandom;
  gameTrack = nextTrackRoll ?? trackForGame(track, trackRandom, Math.random);
  settings = nextSettings(musicRandom ? musicRoll : undefined, difficulty === 'random' ? roll : undefined);
  saveDifficulty(difficulty);
  saveCustom(custom);
  saveMusic(music);
  saveMusicRandom(musicRandom);
  saveTrack(track);
  saveTrackRandom(trackRandom);
  best = loadBest(difficulty);
  state = createState(Math.random, settings);
  started = false;
  draw();
}

createMenu({
  dialog: document.getElementById('difficulty-dialog'),
  select: document.getElementById('difficulty-select'),
  fieldsEl: document.getElementById('difficulty-fields'),
  noteEl: document.getElementById('difficulty-note'),
  openBtn: difficultyBtn,
  applyBtn: document.getElementById('difficulty-apply'),
  cancelBtn: document.getElementById('difficulty-cancel'),
  getCurrent: () => ({ difficulty, custom, music, musicRandom, track, trackRandom, gameTrack, settings }),
  rng: Math.random,
  canOpen: () => !runInProgress(),
  onApply: applyDifficulty,
});

function toggleMute() {
  synth.setMuted(!synth.isMuted());
  updateHud();
}

function dispatch(action) {
  if (!action) return;
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
}

document.addEventListener('keydown', (event) => {
  if (typeof event.key !== 'string') return;
  if (document.querySelector('dialog[open]')) return;
  if (event.ctrlKey || event.metaKey || event.altKey) return;
  // Enter on a focused control must press it, not restart the game.
  if (event.key === 'Enter' && event.target.closest?.('button, select, input')) return;
  const action = actionForKey(event.key);
  if (!action) return;
  if (event.repeat && action.type !== 'direction') return;
  event.preventDefault();
  synth.unlock();
  dispatch(action);
});

// On-screen buttons: respond on pointerdown (no tap delay); a keyboard- or
// assistive-tech-generated click (detail 0) also works. Real clicks are ignored
// here because pointerdown already handled them.
function onButton(event) {
  if (event.type === 'pointerdown' && (event.button !== 0 || !event.isPrimary)) return;
  const button = event.target.closest?.('button[data-action]');
  if (!button) return;
  event.preventDefault();
  synth.unlock();
  dispatch(actionForButton(button.dataset));
}
document.addEventListener('pointerdown', onButton);
document.addEventListener('click', (event) => {
  if (event.detail === 0) onButton(event);
});
document.addEventListener('pointerup', () => synth.unlock());

draw();
