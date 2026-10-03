// A fake 2D context that records every call and every property assignment as one line of text.
const r = (v) => (typeof v === 'number' ? String(Math.round(v * 1e6) / 1e6) : JSON.stringify(v));

export function recordingContext(width = 400, height = 400) {
  const log = [];
  const target = { canvas: { width, height } };
  const ctx = new Proxy(target, {
    get(t, name) {
      if (name === 'canvas') return t.canvas;
      if (name in t) return t[name];
      return (...args) => { log.push(`${String(name)}(${args.map(r).join(',')})`); };
    },
    set(t, name, value) {
      t[name] = value;
      log.push(`${String(name)}=${r(value)}`);
      return true;
    },
  });
  return { ctx, log };
}

// A board with every kind of object. `ghosts` adds the not-yet-solid ones.
export function sampleState({ ghosts = false } = {}) {
  const solid = { age: 30, telegraph: 24 };
  const ghost = { age: 0, telegraph: 24 };
  return {
    snake: [{ x: 5, y: 5 }, { x: 4, y: 5 }, { x: 3, y: 5 }],
    food: { x: 10, y: 3 },
    status: 'playing',
    score: 0,
    hazards: {
      walls: [{ cells: [{ x: 8, y: 8 }, { x: 9, y: 8 }], ...solid }, ...(ghosts ? [{ cells: [{ x: 1, y: 8 }, { x: 2, y: 8 }], ...ghost }] : [])],
      bombs: [{ cells: [{ x: 12, y: 12 }], ...solid }, ...(ghosts ? [{ cells: [{ x: 14, y: 2 }], ...ghost }] : [])],
      enemies: [
        { cells: [{ x: 15, y: 15 }, { x: 15, y: 16 }], status: 'alive', age: 3 },
        { cells: [{ x: 2, y: 14 }, { x: 3, y: 14 }], status: 'dead', age: 9 },
        ...(ghosts ? [{ cells: [{ x: 17, y: 5 }, { x: 17, y: 6 }], status: 'ghost', age: 0, telegraph: 24 }] : []),
      ],
    },
  };
}
