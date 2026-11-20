/* ------------------------------------------------------------------ *
 * Roof Rider — track terrain
 *
 * A track is a heightfield built out of motocross features arranged as a
 * street of rooftops. The rhythm sections are chains of roofs whose landing
 * slope is a descending backside: carrying speed means touching down on that
 * slope instead of the flat between roofs or the next takeoff face.
 * ------------------------------------------------------------------ */

const STEP = 0.35;
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

class TrackBuilder {
  constructor() {
    this.points = [
      { x: -30, y: 0 },
      { x: 0, y: 0 },
    ];
    this.features = [];
    this.sections = [];
    this.checkpoints = [];
    this.x = 0;
    this.y = 0;
    this.finishX = 0;
    this.startX = 10;
  }

  push(x, y) {
    const last = this.points[this.points.length - 1];
    if (x <= last.x) return;
    this.points.push({ x, y });
    this.x = x;
    this.y = y;
  }

  flat(len) {
    this.line(len, 0);
  }

  line(len, dy) {
    const n = Math.max(1, Math.round(len / STEP));
    const x0 = this.x;
    const y0 = this.y;
    for (let i = 1; i <= n; i += 1) {
      this.push(x0 + (len * i) / n, y0 + (dy * i) / n);
    }
  }

  /* Ramp face that starts shallow and steepens toward the lip. */
  ease(len, dy, power = 2) {
    const n = Math.max(2, Math.round(len / STEP));
    const x0 = this.x;
    const y0 = this.y;
    for (let i = 1; i <= n; i += 1) {
      const t = i / n;
      this.push(x0 + len * t, y0 + dy * t ** power);
    }
  }

  /* Convex landing slope: steep just under the crest, flattening out. */
  backside(len, drop, power = 1.55) {
    const n = Math.max(2, Math.round(len / STEP));
    const x0 = this.x;
    const y0 = this.y;
    for (let i = 1; i <= n; i += 1) {
      const t = i / n;
      this.push(x0 + len * t, y0 - drop * (1 - (1 - t) ** power));
    }
  }

  rollers(count, spacing, height) {
    for (let r = 0; r < count; r += 1) {
      const n = Math.max(6, Math.round(spacing / STEP));
      const x0 = this.x;
      const y0 = this.y;
      for (let i = 1; i <= n; i += 1) {
        const t = i / n;
        this.push(x0 + spacing * t, y0 + height * 0.5 * (1 - Math.cos(2 * Math.PI * t)));
      }
    }
  }

  /* A double: takeoff, pit, landing crest, then the long backside. */
  jump(opts = {}) {
    const face = opts.face ?? 4.6;
    const lip = opts.lip ?? 1.05;
    const pit = opts.pit ?? 2.4;
    const pitDepth = opts.pitDepth ?? 1.5;
    const back = opts.back ?? 6;
    const backDrop = opts.backDrop ?? 0.65;
    const crestRise = backDrop - (lip - pitDepth);

    const startX = this.x;
    this.ease(face, lip, 1.8);
    const lipX = this.x;
    const lipY = this.y;
    this.line(1.1, -pitDepth - 0.0);
    this.flat(pit);
    this.line(2.0, crestRise);
    const crestX = this.x;
    this.backside(back, backDrop, 1.5);

    this.features.push({
      kind: opts.kind ?? 'double',
      x: startX,
      lipX,
      lipY,
      landingX: crestX,
      sequence: opts.sequence ?? 0,
      total: opts.total ?? 0,
      section: opts.section ?? null,
    });
  }

  tabletop(opts = {}) {
    const face = opts.face ?? 4.6;
    const lip = opts.lip ?? 1.0;
    const top = opts.top ?? 5;
    const back = opts.back ?? 6;

    const startX = this.x;
    this.ease(face, lip, 2);
    const lipX = this.x;
    const lipY = this.y;
    this.flat(top);
    const crestX = this.x;
    this.backside(back, lip, 1.45);

    this.features.push({
      kind: 'tabletop',
      x: startX,
      lipX,
      lipY,
      landingX: crestX,
      sequence: opts.sequence ?? 0,
      total: opts.total ?? 0,
      section: opts.section ?? null,
    });
  }

  rhythm(count, opts, sectionName) {
    for (let i = 0; i < count; i += 1) {
      this.jump({
        ...opts,
        sequence: i + 1,
        total: count,
        section: sectionName,
      });
      /* A short valley between jumps lets the suspenders settle. */
      if (i < count - 1) this.flat(2.4);
    }
  }

  section(name, meta = {}) {
    this.sections.push({ name, x: Math.max(0, this.x - 5), ...meta });
  }

  checkpoint(name) {
    this.checkpoints.push({ name, x: this.x + 2 });
  }

  finish() {
    this.finishX = this.x;
    this.flat(30);
  }
}

/* ------------------------------------------------------------------ *
 * The three tracks
 * ------------------------------------------------------------------ */

function buildSunsetStreet(b) {
  b.flat(34);
  b.checkpoint('Sunset gate');
  b.flat(8);
  b.rollers(4, 7, 0.7);
  b.flat(18);
  b.checkpoint('Rollers');
  b.flat(6);

  b.jump({ face: 5, lip: 1.1, pit: 3, pitDepth: 1.6, back: 7, backDrop: 0.7 });
  b.flat(20);
  b.checkpoint('First double');
  b.flat(6);

  b.tabletop({ face: 5, lip: 1.0, top: 5, back: 5.5 });
  b.flat(20);
  b.checkpoint('Tabletop');
  b.flat(6);

  b.section('RHYTHM 1');
  b.rhythm(3, { face: 4.6, lip: 1.0, pit: 2.4, pitDepth: 1.5, back: 6, backDrop: 0.65 }, 'RHYTHM 1');
  b.flat(22);
  b.checkpoint('Rhythm 1');

  b.rollers(6, 2.8, 0.42);
  b.flat(20);
  b.checkpoint('Whoops');
  b.flat(8);

  b.jump({ face: 4.8, lip: 1.2, pit: 3.2, pitDepth: 1.7, back: 7, backDrop: 0.8, kind: 'booter' });
  b.flat(26);
  b.checkpoint('Last double');
  b.flat(20);

  b.finish();
}

function buildRidgeRow(b) {
  b.flat(30);
  b.checkpoint('Ridge Row gate');
  b.flat(10);

  b.rollers(5, 6, 0.8);
  b.flat(16);
  b.checkpoint('Rollers');
  b.flat(6);

  b.section('RHYTHM 1');
  b.rhythm(6, { face: 4.7, lip: 1.05, pit: 2.2, pitDepth: 1.55, back: 6, backDrop: 0.7 }, 'RHYTHM 1');
  b.flat(20);
  b.checkpoint('Rhythm 1');
  b.flat(8);

  b.tabletop({ face: 5, lip: 1.15, top: 4.5, back: 6 });
  b.flat(18);
  b.checkpoint('Tabletop');
  b.flat(6);

  b.section('RHYTHM 2');
  b.rhythm(6, { face: 4.6, lip: 1.1, pit: 1.9, pitDepth: 1.6, back: 5.6, backDrop: 0.75 }, 'RHYTHM 2');
  b.flat(20);
  b.checkpoint('Rhythm 2');
  b.flat(8);

  b.rollers(8, 2.6, 0.45);
  b.flat(18);
  b.checkpoint('Whoops');
  b.flat(6);

  b.jump({ face: 5.2, lip: 1.3, pit: 3.6, pitDepth: 1.9, back: 8, backDrop: 0.9, kind: 'booter' });
  b.flat(30);
  b.checkpoint('Big double');
  b.flat(26);

  b.finish();
}

function buildBacksideLane(b) {
  b.flat(26);
  b.checkpoint('Backside Lane gate');
  b.flat(8);

  b.section('RHYTHM 1');
  b.rhythm(4, { face: 4.6, lip: 1.1, pit: 2.1, pitDepth: 1.6, back: 5.8, backDrop: 0.7 }, 'RHYTHM 1');
  b.flat(18);
  b.checkpoint('Rhythm 1');
  b.flat(6);

  b.rollers(6, 4.8, 0.85);
  b.flat(14);
  b.checkpoint('Rollers');
  b.flat(6);

  b.section('RHYTHM 2');
  b.rhythm(7, { face: 4.8, lip: 1.2, pit: 1.8, pitDepth: 1.7, back: 5.4, backDrop: 0.8 }, 'RHYTHM 2');
  b.flat(18);
  b.checkpoint('Rhythm 2');
  b.flat(8);

  b.tabletop({ face: 5, lip: 1.2, top: 4, back: 5 });
  b.flat(16);
  b.checkpoint('Tabletop');
  b.flat(6);

  b.section('RHYTHM 3');
  b.rhythm(5, { face: 4.7, lip: 1.15, pit: 1.8, pitDepth: 1.65, back: 5.2, backDrop: 0.75 }, 'RHYTHM 3');
  b.flat(18);
  b.checkpoint('Rhythm 3');
  b.flat(8);

  b.rollers(9, 2.5, 0.5);
  b.flat(18);
  b.checkpoint('Whoops');
  b.flat(6);

  b.jump({ face: 5.4, lip: 1.4, pit: 3.8, pitDepth: 2.0, back: 8, backDrop: 1.0, kind: 'booter' });
  b.flat(28);
  b.checkpoint('Final booter');
  b.flat(24);

  b.finish();
}

const TRACKS = [
  {
    id: 'sunset-street',
    name: 'Sunset Street',
    tagline: 'Low gables, friendly doubles, one long roofline.',
    difficulty: 'Green',
    par: 42,
    build: buildSunsetStreet,
    theme: {
      skyTop: '#ffd7a8',
      skyMid: '#ffab73',
      skyLow: '#ff7e5f',
      sun: '#fff1b8',
      haze: '#ffcba4',
      far: '#8d4f8f',
      near: '#5c3468',
      roof: '#b35236',
      roofDark: '#5e2a1c',
      roofLine: '#ef9a63',
      wall: '#e0a77d',
      wallDark: '#7a4636',
      window: '#3b2440',
      windowLit: '#ffd98a',
      trim: '#f4c28d',
      accent: '#ffd93d',
    },
  },
  {
    id: 'ridge-row',
    name: 'Ridge Row',
    tagline: 'Two six-roof rhythms and a long tabletop ridge.',
    difficulty: 'Blue',
    par: 58,
    build: buildRidgeRow,
    theme: {
      skyTop: '#8fc9f0',
      skyMid: '#f6c2cf',
      skyLow: '#ffb38f',
      sun: '#fff6dc',
      haze: '#ffd9d6',
      far: '#6c5aa8',
      near: '#423a72',
      roof: '#5b6b7c',
      roofDark: '#2b3542',
      roofLine: '#b4c6d0',
      wall: '#c58f78',
      wallDark: '#6f4a47',
      window: '#2c3447',
      windowLit: '#ffe3a1',
      trim: '#d7e3e6',
      accent: '#2ec4ff',
    },
  },
  {
    id: 'backside-lane',
    name: 'Backside Lane',
    tagline: 'Tight gables, big ridges, no room to be lazy.',
    difficulty: 'Red',
    par: 74,
    build: buildBacksideLane,
    theme: {
      skyTop: '#1b173d',
      skyMid: '#4f367f',
      skyLow: '#b44d7d',
      sun: '#ffe8b8',
      haze: '#8f5b8f',
      far: '#352a5e',
      near: '#1b1433',
      roof: '#49394f',
      roofDark: '#221a2b',
      roofLine: '#9d7f9f',
      wall: '#6f3d4b',
      wallDark: '#3a2030',
      window: '#241d33',
      windowLit: '#ffd27a',
      trim: '#c7a7b8',
      accent: '#ff2e63',
      night: true,
    },
  },
];

/* ------------------------------------------------------------------ *
 * Sampling
 * ------------------------------------------------------------------ */

function makeSampler(points) {
  const surfaceAt = (x) => {
    if (!Number.isFinite(x)) return 0;
    const first = points[0];
    const last = points[points.length - 1];
    if (x <= first.x) return first.y;
    if (x >= last.x) return last.y;

    let lo = 0;
    let hi = points.length - 1;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (points[mid].x <= x) lo = mid;
      else hi = mid;
    }
    const a = points[lo];
    const b = points[hi];
    const span = b.x - a.x;
    const t = span > 1e-6 ? (x - a.x) / span : 0;
    return a.y + (b.y - a.y) * t;
  };

  const slopeAt = (x) => (surfaceAt(x + 0.18) - surfaceAt(x - 0.18)) / 0.36;

  const angleAt = (x) => Math.atan(slopeAt(x));

  return { surfaceAt, slopeAt, angleAt };
}

export function buildTerrain(trackId) {
  const def = TRACKS.find((track) => track.id === trackId) ?? TRACKS[0];
  const builder = new TrackBuilder();
  def.build(builder);
  const finishX = builder.finishX;
  const points = builder.points;
  const sampler = makeSampler(points);
  const endX = points[points.length - 1].x;

  const start = {
    ...def,
    points,
    length: finishX,
    finishX,
    endX,
    startX: builder.startX,
    features: builder.features,
    sections: builder.sections,
    checkpoints: builder.checkpoints,
    ...sampler,
  };

  return start;
}

export function trackSummaries() {
  return TRACKS.map(({ build, theme, ...rest }) => ({ ...rest }));
}

export const DEFAULT_TRACK_ID = TRACKS[0].id;
export { TRACKS };

/* ------------------------------------------------------------------ *
 * Small helpers used by the renderer and the respawn logic
 * ------------------------------------------------------------------ */

/** A safe, upright spot a little past a checkpoint. */
export function respawnPoint(terrain, checkpoint) {
  const x = clamp(checkpoint.x + 4, terrain.startX + 1, terrain.finishX - 2);
  return { x, y: terrain.surfaceAt(x) + 0.8, angle: terrain.angleAt(x) };
}

/** The last checkpoint at or before x, or the track start. */
export function checkpointBefore(terrain, x) {
  let best = { name: 'Start', x: terrain.startX };
  for (const checkpoint of terrain.checkpoints) {
    if (checkpoint.x <= x + 0.5 && checkpoint.x >= best.x) best = checkpoint;
  }
  return best;
}
