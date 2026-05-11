const SOUND_ENABLED_STORAGE_KEY = 'mo:sound-enabled';
const SAMPLE_RATE = 22050;

let soundEnabled = true;
let masteredAudio: HTMLAudioElement | null = null;
let fuzzyAudio: HTMLAudioElement | null = null;
let soundsReady = false;

function readStoredSoundEnabled() {
  if (typeof window === 'undefined') return true;
  const stored = window.localStorage.getItem(SOUND_ENABLED_STORAGE_KEY);
  if (stored === null) return true;
  return stored === 'true';
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
    const masteredBlob = generateWavBlob([
      { freq: 523, durationMs: 90, volume: 0.5 },
      { freq: 659, durationMs: 90, delayMs: 70, volume: 0.55 },
      { freq: 784, durationMs: 160, delayMs: 140, volume: 0.45 },
    ]);
    masteredAudio = new Audio(URL.createObjectURL(masteredBlob));

    const fuzzyBlob = generateWavBlob([
      { freq: 392, durationMs: 120, volume: 0.4 },
      { freq: 330, durationMs: 160, delayMs: 70, volume: 0.35 },
    ]);
    fuzzyAudio = new Audio(URL.createObjectURL(fuzzyBlob));

    soundsReady = true;
  } catch {
  }
}

export function primeSound() {
  ensureSounds();
  if (masteredAudio) {
    masteredAudio.load();
  }
  if (fuzzyAudio) {
    fuzzyAudio.load();
  }
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
    window.localStorage.setItem(SOUND_ENABLED_STORAGE_KEY, String(enabled));
  }
}

export function initSoundPreferences() {
  soundEnabled = readStoredSoundEnabled();
}

initSoundPreferences();
