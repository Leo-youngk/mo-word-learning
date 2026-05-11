const SOUND_ENABLED_STORAGE_KEY = 'mo:sound-enabled';
const DEFAULT_VOLUME = 0.24;
const RAMP_IN_SECONDS = 0.008;
const RAMP_OUT_PADDING_SECONDS = 0.02;

let soundEnabled = true;
let audioContext: AudioContext | null = null;
let audioUnlocked = false;

type ToneSpec = {
  frequency: number;
  durationMs: number;
  volume?: number;
  delayMs?: number;
  type?: OscillatorType;
};

function canUseAudio() {
  return typeof window !== 'undefined'
    && (typeof window.AudioContext !== 'undefined'
      || typeof (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext !== 'undefined');
}

function readStoredSoundEnabled() {
  if (typeof window === 'undefined') return true;
  const stored = window.localStorage.getItem(SOUND_ENABLED_STORAGE_KEY);
  if (stored === null) return true;
  return stored === 'true';
}

function createAudioContext() {
  const AudioContextCtor = window.AudioContext
    || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;

  if (!AudioContextCtor) return null;

  try {
    return new AudioContextCtor();
  } catch {
    return null;
  }
}

function getAudioContext() {
  if (!canUseAudio()) return null;
  if (audioContext && audioContext.state !== 'closed') {
    return audioContext;
  }

  audioContext = createAudioContext();
  return audioContext;
}

function warmUpAudioContext(ctx: AudioContext) {
  if (audioUnlocked) return;

  try {
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    const startAt = ctx.currentTime;
    const endAt = startAt + 0.01;

    gain.gain.setValueAtTime(0.00001, startAt);
    oscillator.frequency.setValueAtTime(440, startAt);
    oscillator.connect(gain);
    gain.connect(ctx.destination);
    oscillator.start(startAt);
    oscillator.stop(endAt);
    audioUnlocked = true;
  } catch {
  }
}

function tryResumeSync(ctx: AudioContext): boolean {
  if (ctx.state === 'running') {
    warmUpAudioContext(ctx);
    return true;
  }

  try {
    const result = ctx.resume();
    if (result && typeof result.then === 'function') {
      result.then(() => {
        warmUpAudioContext(ctx);
      }).catch(() => {});
    }
  } catch {
  }

  return (ctx as any).state === 'running';
}

export function primeSound() {
  const ctx = getAudioContext();
  if (!ctx) return;
  tryResumeSync(ctx);
}

function scheduleTone(ctx: AudioContext, tone: ToneSpec) {
  const oscillator = ctx.createOscillator();
  const gain = ctx.createGain();
  const startAt = ctx.currentTime + ((tone.delayMs ?? 0) / 1000);
  const endAt = startAt + (tone.durationMs / 1000);
  const volume = Math.min(tone.volume ?? DEFAULT_VOLUME, 0.35);

  oscillator.type = tone.type ?? 'triangle';
  oscillator.frequency.setValueAtTime(tone.frequency, startAt);

  gain.gain.setValueAtTime(0.0001, startAt);
  gain.gain.exponentialRampToValueAtTime(volume, startAt + RAMP_IN_SECONDS);
  gain.gain.exponentialRampToValueAtTime(0.0001, endAt);

  oscillator.connect(gain);
  gain.connect(ctx.destination);
  oscillator.start(startAt);
  oscillator.stop(endAt + RAMP_OUT_PADDING_SECONDS);
}

function playToneSequenceSync(tones: ToneSpec[]) {
  if (!soundEnabled) return;

  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    tryResumeSync(ctx);

    if (ctx.state === 'suspended') {
      void ctx.resume().then(() => {
        for (const tone of tones) {
          scheduleTone(ctx, tone);
        }
      }).catch(() => {});
      return;
    }

    for (const tone of tones) {
      scheduleTone(ctx, tone);
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

export function playMasteredSound() {
  playToneSequenceSync([
    { frequency: 523, durationMs: 80, volume: 0.28, type: 'sine' },
    { frequency: 659, durationMs: 80, volume: 0.30, delayMs: 60, type: 'sine' },
    { frequency: 784, durationMs: 140, volume: 0.22, delayMs: 120, type: 'sine' },
  ]);
}

export function playFuzzySound() {
  playToneSequenceSync([
    { frequency: 392, durationMs: 100, volume: 0.22, type: 'sine' },
    { frequency: 330, durationMs: 150, volume: 0.18, delayMs: 60, type: 'sine' },
  ]);
}

initSoundPreferences();
