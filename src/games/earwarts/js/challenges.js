import { randomInt, shuffle } from './audio.js';

function makeOptions(pool, answer, count) {
  const rest = pool.filter((entry) => entry.id !== answer.id);
  const mixed = shuffle(rest);
  const options = [answer, ...mixed.slice(0, Math.max(0, count - 1))];
  return shuffle(options);
}

class BaseChallenge {
  constructor(skill, difficulty, audio) {
    this.id = `${skill}-${Math.random().toString(36).slice(2, 9)}`;
    this.skill = skill;
    this.difficulty = difficulty;
    this.audio = audio;
    this.question = '';
    this.prompt = '';
    this.choices = [];
  }
}

class PitchChallenge extends BaseChallenge {
  constructor(audio, difficulty) {
    super('pitch', difficulty, audio);
    this.notes = [60, 64];
    this.kind = 'higher';
    this.answer = '';
    this.generate();
  }

  generate() {
    const kind =
      this.difficulty <= 1
        ? 'higher'
        : this.difficulty === 2
          ? 'same'
          : this.difficulty === 3
            ? 'direction'
            : 'step';
    this.kind = kind;

    if (kind === 'higher') {
      const root = randomInt(55, 66);
      const gap = randomInt(4, 10);
      const second = Math.random() < 0.5 ? root + gap : root - gap;
      this.notes = [root, Math.min(82, Math.max(50, second))];
      this.answer = this.notes[1] > this.notes[0] ? 'second' : 'first';
      this.question = 'Which note was higher?';
      this.prompt = 'Two chimes call across the hall.';
      this.choices = [
        { id: 'first', label: 'The first note', icon: '①' },
        { id: 'second', label: 'The second note', icon: '②' },
      ];
      return;
    }

    if (kind === 'same') {
      const root = randomInt(55, 70);
      const isSame = Math.random() < 0.45;
      const gap = isSame ? 0 : randomInt(2, 9);
      const direction = Math.random() < 0.5 ? 1 : -1;
      this.notes = [root, Math.min(82, Math.max(50, root + gap * direction))];
      this.answer = this.notes[0] === this.notes[1] ? 'same' : 'different';
      this.question = 'Were the two notes the same, or different?';
      this.prompt = 'Listen for whether the chime moves at all.';
      this.choices = [
        { id: 'same', label: 'Exactly the same', icon: '＝' },
        { id: 'different', label: 'Different', icon: '≠' },
      ];
      return;
    }

    if (kind === 'direction') {
      const root = randomInt(58, 67);
      const gap = randomInt(2, 10);
      const direction = Math.random() < 0.5 ? 1 : -1;
      this.notes = [root, root + gap * direction];
      this.answer = direction > 0 ? 'up' : 'down';
      this.question = 'Did the second note climb up or slip down?';
      this.prompt = 'Follow the second chime with your ears.';
      this.choices = [
        { id: 'up', label: 'It climbed up', icon: '↑' },
        { id: 'down', label: 'It slipped down', icon: '↓' },
      ];
      return;
    }

    const root = randomInt(58, 68);
    const isStep = Math.random() < 0.5;
    const gap = isStep ? randomInt(1, 2) : randomInt(5, 10);
    const direction = Math.random() < 0.5 ? 1 : -1;
    this.notes = [root, root + gap * direction];
    this.answer = isStep ? 'step' : 'leap';
    this.question = 'Was the jump a small step or a big leap?';
    this.prompt = 'The distance matters more than the note.';
    this.choices = [
      { id: 'step', label: 'A small step', icon: '·' },
      { id: 'leap', label: 'A big leap', icon: '↟' },
    ];
  }

  async present() {
    await this.audio.playPitchPair(this.notes[0], this.notes[1]);
  }

  evaluate(answer) {
    const correct = answer === this.answer;
    let message;
    if (correct) {
      if (this.kind === 'higher') message = 'The higher chime rings gold. Beautifully heard.';
      else if (this.kind === 'same') {
        message =
          this.answer === 'same'
            ? 'Two chimes, one voice. You caught it.'
            : 'Yes — one chime stepped away from the other.';
      } else if (this.kind === 'direction') {
        message =
          this.answer === 'up'
            ? 'Up it climbed, like a lark. Lovely listening.'
            : 'Down it slipped, soft as a leaf. Well heard.';
      } else {
        message =
          this.answer === 'step'
            ? 'A tiny step, perfectly caught.'
            : 'A big brave leap, and you followed it.';
      }
    } else {
      message = 'The chimes are still deciding. Listen once more — the second note holds the clue.';
    }
    return { correct, message };
  }
}

const CREATURES = [
  { id: 'm2', semitones: 1, label: 'Minor 2nd', creature: 'Glow Moth', hint: 'a tiny flutter', icon: '✧' },
  { id: 'M2', semitones: 2, label: 'Major 2nd', creature: 'Puddle Dragon', hint: 'one small hop', icon: '◆' },
  { id: 'm3', semitones: 3, label: 'Minor 3rd', creature: 'Moon Hare', hint: 'a soft skip', icon: '☾' },
  { id: 'M3', semitones: 4, label: 'Major 3rd', creature: 'Fern Pup', hint: 'a brave stride', icon: '❀' },
  { id: 'P4', semitones: 5, label: 'Perfect 4th', creature: 'Moss Turtle', hint: 'a long stretch', icon: '≈' },
  { id: 'P5', semitones: 7, label: 'Perfect 5th', creature: 'Cloud Fox', hint: 'a wide leap', icon: '★' },
  { id: 'P8', semitones: 12, label: 'Octave', creature: 'Star Whale', hint: 'a whole sky apart', icon: '◎' },
];

class IntervalChallenge extends BaseChallenge {
  constructor(audio, difficulty) {
    super('interval', difficulty, audio);
    this.answerId = 'M3';
    this.root = 60;
    this.semitones = 4;
    this.creature = 'Fern Pup';
    this.generate();
  }

  generate() {
    const allowed =
      this.difficulty <= 1
        ? CREATURES.filter((entry) => ['M2', 'M3', 'P5'].includes(entry.id))
        : this.difficulty === 2
          ? CREATURES.filter((entry) => ['m2', 'M2', 'm3', 'M3', 'P4', 'P5'].includes(entry.id))
          : CREATURES;
    const answer = allowed[randomInt(0, allowed.length - 1)];
    const optionCount = this.difficulty <= 1 ? 3 : this.difficulty === 2 ? 5 : 7;
    const options = makeOptions(allowed, answer, Math.min(optionCount, allowed.length));
    this.answerId = answer.id;
    this.root = randomInt(55, 65);
    this.semitones = answer.semitones;
    this.creature = answer.creature;
    this.question = 'Which creature sang that leap?';
    this.prompt = 'Two notes, one after the other. How far did the second one travel?';
    this.choices = options.map((entry) => ({
      id: entry.id,
      label: `${entry.creature} · ${entry.label}`,
      icon: entry.icon,
      hint: entry.hint,
    }));
  }

  async present() {
    await this.audio.playInterval(this.root, this.semitones);
  }

  evaluate(answer) {
    const correct = answer === this.answerId;
    return {
      correct,
      message: correct
        ? `${this.creature} recognises your listening and bows. Beautifully heard.`
        : 'The creatures tilt their heads. Listen to the gap between the two notes, then try again.',
    };
  }
}

class RhythmChallenge extends BaseChallenge {
  constructor(audio, difficulty) {
    super('rhythm', difficulty, audio);
    this.hits = [0, 1];
    this.totalBeats = 2;
    this.tempo = 96;
    this.generate();
  }

  generate() {
    this.tempo = 92 + this.difficulty * 3;
    if (this.difficulty <= 1) {
      const patterns = [[0, 1], [0, 0.5, 1], [0, 1.5]];
      this.hits = patterns[randomInt(0, patterns.length - 1)];
      this.totalBeats = 2;
    } else if (this.difficulty === 2) {
      const patterns = [
        [0, 1, 2, 3],
        [0, 0.5, 1.5, 2.5],
        [0, 1, 1.5, 3],
        [0, 2, 3],
      ];
      this.hits = patterns[randomInt(0, patterns.length - 1)];
      this.totalBeats = 4;
    } else if (this.difficulty === 3) {
      this.hits = [0, 1, 2, 3, 4, 5, 6, 7].filter(
        (beat) => beat === 0 || Math.random() > 0.38
      );
      this.totalBeats = 8;
    } else {
      const patterns = [
        [0, 0.5, 1.5, 2, 3, 3.5, 5, 6.5],
        [0, 1, 1.5, 3, 4, 4.5, 6, 7],
        [0, 0.5, 2, 2.5, 4, 5, 5.5, 7],
      ];
      this.hits = patterns[randomInt(0, patterns.length - 1)];
      this.totalBeats = 8;
    }
    this.question = 'Listen, then echo the forest drum.';
    this.prompt = `A ${this.totalBeats}-beat pattern. You can hear it as many times as you like, or slow it down.`;
  }

  get beatMs() {
    return 60_000 / this.tempo;
  }

  get toleranceMs() {
    return Math.max(190, this.beatMs * 0.3);
  }

  async present() {
    await this.audio.playRhythm(this.hits, this.totalBeats, this.tempo, false);
  }

  evaluate(answer) {
    const taps =
      answer && typeof answer === 'object' && Array.isArray(answer.taps) ? answer.taps : [];
    if (taps.length === 0) {
      return { correct: false, message: 'The drum is still waiting for your first tap.' };
    }
    const expected = this.hits.map((hit) => hit * this.beatMs);
    const used = new Set();
    let matched = 0;
    for (const beat of expected) {
      let best = -1;
      let bestDistance = Number.POSITIVE_INFINITY;
      taps.forEach((tap, index) => {
        if (used.has(index)) return;
        const distance = Math.abs(tap - beat);
        if (distance < bestDistance) {
          bestDistance = distance;
          best = index;
        }
      });
      if (best >= 0 && bestDistance <= this.toleranceMs) {
        used.add(best);
        matched += 1;
      }
    }
    const closeness = matched / expected.length;
    const correct = closeness >= 0.6;
    return {
      correct,
      closeness,
      message: correct
        ? 'The forest taps back. Your rhythm is growing roots.'
        : `You caught ${matched} of ${expected.length} beats. Listen for the spaces, then try once more — the trees are patient.`,
    };
  }
}

const CONTOURS = [
  { id: 'up', label: 'Climbing up', icon: '↗', offsets: [0, 1, 2, 3, 4], hint: 'one stair after another' },
  { id: 'down', label: 'Falling down', icon: '↘', offsets: [0, -1, -2, -3, -4], hint: 'a leaf drifting to the floor' },
  { id: 'same', label: 'Staying level', icon: '→', offsets: [0, 0, 0, 0, 0], hint: 'a hum on one note' },
  { id: 'wave', label: 'Waving', icon: '∿', offsets: [0, 2, 1, 3, 2], hint: 'up, down, up, down' },
  { id: 'arch', label: 'Arching', icon: '∩', offsets: [0, 2, 3, 2, 0], hint: 'a rainbow of a tune' },
];

class MelodyChallenge extends BaseChallenge {
  constructor(audio, difficulty) {
    super('melody', difficulty, audio);
    this.contour = 'up';
    this.noteSequence = [];
    this.answerId = 'up';
    this.generate();
  }

  generate() {
    const contour = CONTOURS[Math.floor(Math.random() * CONTOURS.length)];
    this.contour = contour.id;
    this.answerId = contour.id;
    const base = 4 + Math.floor(Math.random() * 2);
    this.noteSequence = contour.offsets.map((offset) => this.audio.scaleMidi(base + offset, 60));
    this.question = 'What shape did the melody draw?';
    this.prompt = 'Five notes. Follow the line they make in the air.';
    this.choices = CONTOURS.map((entry) => ({
      id: entry.id,
      label: entry.label,
      icon: entry.icon,
      hint: entry.hint,
    }));
  }

  async present() {
    await this.audio.playMelody(this.noteSequence, this.difficulty <= 1 ? 0.52 : 0.4);
  }

  evaluate(answer) {
    const correct = answer === this.answerId;
    return {
      correct,
      message: correct
        ? 'The melody settles into a shape you can see behind your eyes. Well listened.'
        : 'The tune wriggles away. Play it again and hum the line it draws.',
    };
  }
}

const QUALITIES = [
  {
    id: 'major',
    label: 'Major',
    sunny: true,
    seventh: false,
    steps: [0, 4, 7],
    icon: '☀',
    flavour: 'sunlight on the cauldron',
  },
  {
    id: 'minor',
    label: 'Minor',
    sunny: false,
    seventh: false,
    steps: [0, 3, 7],
    icon: '☂',
    flavour: 'rain on the dungeon windows',
  },
  {
    id: 'maj7',
    label: 'Major 7th',
    sunny: true,
    seventh: true,
    steps: [0, 4, 7, 11],
    icon: '✦',
    flavour: 'honey and starlight',
  },
  {
    id: 'min7',
    label: 'Minor 7th',
    sunny: false,
    seventh: true,
    steps: [0, 3, 7, 10],
    icon: '✧',
    flavour: 'plums and shadows',
  },
];

class ChordChallenge extends BaseChallenge {
  constructor(audio, difficulty) {
    super('harmony', difficulty, audio);
    this.range = 'mood';
    this.answerId = 'major';
    this.root = 60;
    this.generate();
  }

  generate() {
    const efficiency = this.difficulty;
    const pool = efficiency <= 2 ? QUALITIES.filter((quality) => !quality.seventh) : QUALITIES;
    const answer = pool[randomInt(0, pool.length - 1)];
    this.answerId = answer.id;
    this.root = randomInt(55, 64);

    if (efficiency <= 1) {
      this.range = 'mood';
      this.question = 'Does this chord feel sunny or rainy?';
      this.prompt = 'A major chord opens like a window. A minor chord closes like one.';
      this.choices = [
        { id: 'major', label: 'Sunny', icon: '☀', hint: 'bright and open' },
        { id: 'minor', label: 'Rainy', icon: '☂', hint: 'soft and shadowed' },
      ];
      return;
    }

    this.range = 'quality';
    const optionCount = efficiency === 2 ? 2 : 4;
    const options = [answer];
    for (const quality of QUALITIES) {
      if (options.length >= optionCount) break;
      if (quality.id !== answer.id && (efficiency >= 3 || !quality.seventh)) options.push(quality);
    }
    this.choices = shuffle(options).map((quality) => ({
      id: quality.id,
      label: quality.label,
      icon: quality.icon,
      hint: quality.flavour,
    }));
    this.question = efficiency === 2 ? 'Is this chord major or minor?' : 'Which potion is bubbling?';
    this.prompt =
      efficiency === 2
        ? 'Listen for the middle note: one step lower makes all the difference.'
        : 'Four chords, four moods. Seventh chords add a little extra shimmer.';
  }

  async present() {
    const quality = QUALITIES.find((entry) => entry.id === this.answerId) ?? QUALITIES[0];
    await this.audio.playChord(this.root, quality.steps);
  }

  evaluate(answer) {
    const quality = QUALITIES.find((entry) => entry.id === this.answerId) ?? QUALITIES[0];
    const chosen = QUALITIES.find((entry) => entry.id === answer);
    const correct =
      this.range === 'mood' ? chosen?.sunny === quality.sunny : chosen?.id === quality.id;
    return {
      correct,
      message: correct
        ? `The cauldron bubbles ${quality.flavour}. The potion approves.`
        : 'The potion turns a puzzled purple. Listen to the chord once more and follow its mood.',
    };
  }
}

export function createChallenge(skill, difficulty, audio) {
  switch (skill) {
    case 'pitch':
      return new PitchChallenge(audio, difficulty);
    case 'interval':
      return new IntervalChallenge(audio, difficulty);
    case 'rhythm':
      return new RhythmChallenge(audio, difficulty);
    case 'melody':
      return new MelodyChallenge(audio, difficulty);
    case 'harmony':
      return new ChordChallenge(audio, difficulty);
  }
}

export { RhythmChallenge };
