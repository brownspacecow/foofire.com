/* -------------------------------------------------------------------------
 * Phrase Pad — keys, scales, and the mapping from the touch pad to notes.
 *
 * The pad covers two octaves. The X axis is divided into equal steps, one
 * per scale note, so every position plays a note that belongs to the chosen
 * scale. That is the trick that makes a Kaossilator-style pad hard to get
 * wrong: there are no bad notes to land on.
 * ---------------------------------------------------------------------- */

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

export const KEY_NAMES = NOTE_NAMES;

export const SCALES = [
  { id: 'minor-pentatonic', name: 'Minor Pentatonic', intervals: [0, 3, 5, 7, 10] },
  { id: 'major-pentatonic', name: 'Major Pentatonic', intervals: [0, 2, 4, 7, 9] },
  { id: 'major', name: 'Major', intervals: [0, 2, 4, 5, 7, 9, 11] },
  { id: 'minor', name: 'Natural Minor', intervals: [0, 2, 3, 5, 7, 8, 10] },
  { id: 'dorian', name: 'Dorian', intervals: [0, 2, 3, 5, 7, 9, 10] },
  { id: 'mixolydian', name: 'Mixolydian', intervals: [0, 2, 4, 5, 7, 9, 10] },
  { id: 'phrygian', name: 'Phrygian', intervals: [0, 1, 3, 5, 7, 8, 10] },
  { id: 'blues', name: 'Blues', intervals: [0, 3, 5, 6, 7, 10] },
  { id: 'hirajoshi', name: 'Hirajoshi', intervals: [0, 2, 3, 7, 8] },
  { id: 'egyptian', name: 'Egyptian', intervals: [0, 2, 5, 7, 10] },
  { id: 'chromatic', name: 'Chromatic', intervals: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11] },
];

const PAD_OCTAVES = 2;
const ROOT_MIDI = 48; // C3 at the left edge of the pad.

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

/** Scientific pitch name for a MIDI note, e.g. 60 → C4. */
export function midiName(midi) {
  const pitch = ((Math.round(midi) % 12) + 12) % 12;
  const octave = Math.floor(Math.round(midi) / 12) - 1;
  return `${NOTE_NAMES[pitch]}${octave}`;
}

/**
 * All the pad positions for a scale, low to high, ending on the octave root.
 * `octaveShift` lets a bright preset sit an octave up and a bass preset an
 * octave down without changing the labels on the pad.
 */
export function buildPadNotes(scale, keyIndex, octaveShift = 0) {
  const intervals = scale && scale.intervals.length ? scale.intervals : [0];
  const root = ROOT_MIDI + clamp(Number(keyIndex) || 0, 0, 11) + octaveShift;
  const notes = [];

  for (let octave = 0; octave <= PAD_OCTAVES; octave += 1) {
    for (const interval of intervals) {
      if (octave === PAD_OCTAVES && interval !== 0) continue;
      const midi = root + octave * 12 + interval;
      notes.push({ midi, name: midiName(midi) });
    }
  }

  return notes;
}

/** Index into a pad-note list for an X position between 0 and 1. */
export function padIndex(x, count) {
  if (!count || count < 1) return 0;
  return Math.round(clamp(Number(x) || 0, 0, 1) * (count - 1));
}
