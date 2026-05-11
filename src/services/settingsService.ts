import { backendPost } from '../lib/backend';
import type { BookId, ThemeMode, MotionLevel } from '../types';

const SOUND_ENABLED_STORAGE_KEY = 'mo:sound-enabled';

export interface AppSettings {
  currentBookId: BookId;
  dailyMinNewWords: number;
  currentWordIndexByBook: Record<string, number>;
  streakCount: number;
  lastStudyDate: string;
  themeMode: ThemeMode;
  motionLevel: MotionLevel;
  soundEnabled: boolean;
}

const DEFAULT_SETTINGS: AppSettings = {
  currentBookId: 'cet6',
  dailyMinNewWords: 25,
  currentWordIndexByBook: {},
  streakCount: 0,
  lastStudyDate: '',
  themeMode: 'zen',
  motionLevel: 'standard',
  soundEnabled: true,
};

function readStoredSoundEnabled(): boolean {
  if (typeof window === 'undefined') return true;
  const stored = window.localStorage.getItem(SOUND_ENABLED_STORAGE_KEY);
  if (stored === null) return true;
  return stored === 'true';
}

function persistSoundEnabled(enabled: boolean) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(SOUND_ENABLED_STORAGE_KEY, String(enabled));
}

export async function getSettings(): Promise<AppSettings> {
  const data = await backendPost<{ settings: AppSettings }>('/api/data', {
    scope: 'settings',
    action: 'get',
  });
  return {
    ...(data.settings ?? { ...DEFAULT_SETTINGS }),
    soundEnabled: readStoredSoundEnabled(),
  };
}

export async function saveSettings(settings: AppSettings): Promise<void> {
  persistSoundEnabled(settings.soundEnabled);
  const { soundEnabled: _soundEnabled, ...serverSettings } = settings;
  // TODO: move soundEnabled into momo_user_settings after adding a sound_enabled column.
  await backendPost<{ settings: AppSettings }>('/api/data', {
    scope: 'settings',
    action: 'save',
    payload: { settings: serverSettings },
  });
}

export async function updateSettingsPartial(partial: Partial<AppSettings>): Promise<AppSettings> {
  if (typeof partial.soundEnabled === 'boolean') {
    persistSoundEnabled(partial.soundEnabled);
  }

  const { soundEnabled, ...serverPartial } = partial;

  if (Object.keys(serverPartial).length === 0) {
    const current = await getSettings();
    return {
      ...current,
      ...(typeof soundEnabled === 'boolean' ? { soundEnabled } : {}),
    };
  }

  const data = await backendPost<{ settings: AppSettings }>('/api/data', {
    scope: 'settings',
    action: 'updatePartial',
    payload: { partial: serverPartial },
  });

  return {
    ...data.settings,
    soundEnabled: typeof soundEnabled === 'boolean' ? soundEnabled : readStoredSoundEnabled(),
  };
}

export { DEFAULT_SETTINGS };
