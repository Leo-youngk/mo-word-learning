const SOUND_ENABLED_KEY = 'mo:sound-enabled';
const SOUND_PACK_KEY = 'mo:sound-pack';
const SAMPLE_RATE = 22050;

let soundEnabled = true;
let currentPack: SoundPackName = 'duolingo';
let masteredAudio: HTMLAudioElement | null = null;
let fuzzyAudio: HTMLAudioElement | null = null;
let soundsReady = false;

export type SoundPackName = 'duolingo' | 'classic' | 'minimal' | 'game';

interface SoundPack {
  name: string;
  mastered: { freq: number; durationMs: number; delayMs?: number; volume: number }[];
  fuzzy: { freq: number; durationMs: number; delayMs?: number; volume: number }[];
}

const SOUND_PACKS: Record<SoundPackName, SoundPack> = {
  duolingo: {
    name: '多邻国',
    mastered: [
      { freq: 880, durationMs: 50, volume: 0.45 },
      { freq: 1109, durationMs: 50, delayMs: 40, volume: 0.50 },
      { freq: 1319, durationMs: 120, delayMs: 80, volume: 0.40 },
    ],
    fuzzy: [
      { freq: 440, durationMs: 140, volume: 0.35 },
      { freq: 370, durationMs: 160, delayMs: 80, volume: 0.30 },
    ],
  },
  classic: {
    name: '经典',
    mastered: [
      { freq: 523, durationMs: 90, volume: 0.5 },
      { freq: 659, durationMs: 90, delayMs: 70, volume: 0.55 },
      { freq: 784, durationMs: 160, delayMs: 140, volume: 0.45 },
    ],
    fuzzy: [
      { freq: 392, durationMs: 120, volume: 0.4 },
      { freq: 330, durationMs: 160, delayMs: 70, volume: 0.35 },
    ],
  },
  minimal: {
    name: '极简',
    mastered: [
      { freq: 1047, durationMs: 80, volume: 0.4 },
    ],
    fuzzy: [
      { freq: 330, durationMs: 120, volume: 0.35 },
    ],
  },
  game: {
    name: '游戏',
    mastered: [
      { freq: 784, durationMs: 60, volume: 0.45 },
      { freq: 988, durationMs: 60, delayMs: 30, volume: 0.50 },
      { freq: 1175, durationMs: 60, delayMs: 60, volume: 0.45 },
      { freq: 1397, durationMs: 180, delayMs: 90, volume: 0.40 },
    ],
    fuzzy: [
      { freq: 330, durationMs: 100, volume: 0.35 },
      { freq: 294, durationMs: 120, delayMs: 60, volume: 0.30 },
      { freq: 262, durationMs: 160, delayMs: 120, volume: 0.25 },
    ],
  },
};

function readStored() {
  if (typeof window === 'undefined') return { enabled: true, pack: 'duolingo' as SoundPackName };
  const enabled = window.localStorage.getItem(SOUND_ENABLED_KEY);
  const pack = window.localStorage.getItem(SOUND_PACK_KEY);
  return {
    enabled: enabled === null ? true : enabled === 'true',
    pack: (pack as SoundPackName) || 'duolingo',
  };
}

function writeStr(view: DataView, offset: number, str: string) {
  for (let i = 0; i < str.length; i++) {
    view.setUint8(offset + i, str.charCodeAt(i));
  }
}

function generateWavBlob(
  tones: { freq: number; durationMs: number; delayMs?: number; volume: number }[],
): Blob {
  const totalDurationMs = tones.reduce((max, t) => Math.max(max, (t.delayMs ?? 0) + t.durationMs), 0);
  const totalSamples = Math.ceil((SAMPLE_RATE * totalDurationMs) / 1000);
  const bufferSize = 44 + totalSamples * 2;
  const buffer = new ArrayBuffer(bufferSize);
  const view = new DataView(buffer);

  writeStr(view, 0, 'RIFF');
  view.setUint32(4, 36 + totalSamples * 2, true);
  writeStr(view, 8, 'WAVE');
  writeStr(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, SAMPLE_RATE, true);
  view.setUint32(28, SAMPLE_RATE * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeStr(view, 36, 'data');
  view.setUint32(40, totalSamples * 2, true);

  for (let i = 0; i < totalSamples; i++) {
    const t = i / SAMPLE_RATE;
    let sample = 0;

    for (const tone of tones) {
      const toneStart = (tone.delayMs ?? 0) / 1000;
      const toneEnd = toneStart + tone.durationMs / 1000;
      if (t < toneStart || t >= toneEnd) continue;

      const localT = t - toneStart;
      const progress = localT / (tone.durationMs / 1000);
      const envelope = Math.exp(-progress * 5) * (1 - Math.pow(progress, 3));
      sample += Math.sin(2 * Math.PI * tone.freq * localT) * tone.volume * envelope;
    }

    const clamped = Math.max(-1, Math.min(1, sample));
    view.setInt16(44 + i * 2, clamped * 32767, true);
  }

  return new Blob([buffer], { type: 'audio/wav' });
}

function ensureSounds() {
  if (soundsReady) return;

  try {
    const pack = SOUND_PACKS[currentPack];
    const masteredBlob = generateWavBlob(pack.mastered);
    masteredAudio = new Audio(URL.createObjectURL(masteredBlob));

    const fuzzyBlob = generateWavBlob(pack.fuzzy);
    fuzzyAudio = new Audio(URL.createObjectURL(fuzzyBlob));

    soundsReady = true;
  } catch {
  }
}

function rebuildSounds() {
  if (masteredAudio) {
    URL.revokeObjectURL(masteredAudio.src);
    masteredAudio = null;
  }
  if (fuzzyAudio) {
    URL.revokeObjectURL(fuzzyAudio.src);
    fuzzyAudio = null;
  }
  soundsReady = false;
  ensureSounds();
}

export function getSoundPacks(): { id: SoundPackName; name: string }[] {
  return Object.entries(SOUND_PACKS).map(([id, pack]) => ({ id: id as SoundPackName, name: pack.name }));
}

export function getCurrentSoundPack(): SoundPackName {
  return currentPack;
}

export function setSoundPack(pack: SoundPackName) {
  currentPack = pack;
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(SOUND_PACK_KEY, pack);
  }
  rebuildSounds();
}

export function primeSound() {
  ensureSounds();
  if (masteredAudio) masteredAudio.load();
  if (fuzzyAudio) fuzzyAudio.load();
}

export function playMasteredSound() {
  if (!soundEnabled) return;
  ensureSounds();
  if (!masteredAudio) return;

  try {
    const audio = masteredAudio;
    audio.currentTime = 0;
    const p = audio.play();
    if (p && typeof p.catch === 'function') {
      p.catch(() => {});
    }
  } catch {
  }
}

export function playFuzzySound() {
  if (!soundEnabled) return;
  ensureSounds();
  if (!fuzzyAudio) return;

  try {
    const audio = fuzzyAudio;
    audio.currentTime = 0;
    const p = audio.play();
    if (p && typeof p.catch === 'function') {
      p.catch(() => {});
    }
  } catch {
  }
}

export function isSoundEnabled() {
  return soundEnabled;
}

export function setSoundEnabled(enabled: boolean) {
  soundEnabled = enabled;
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(SOUND_ENABLED_KEY, String(enabled));
  }
}

export function initSoundPreferences() {
  const stored = readStored();
  soundEnabled = stored.enabled;
  currentPack = stored.pack;
}

initSoundPreferences();
