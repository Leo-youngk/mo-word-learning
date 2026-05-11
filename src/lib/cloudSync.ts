import type {
  DailyLogRecord,
  ProgressRecord,
  SettingsRecord,
  SyncQueueRecord,
} from '../types';
import * as db from './db';

interface RemoteSyncItem {
  entity: SyncQueueRecord['entity'];
  entityId: string;
  operation: SyncQueueRecord['operation'];
  payload: unknown;
  updatedAt?: string;
  clientUpdatedAt?: string;
  deviceId?: string;
}

export interface CloudSyncResult {
  pushed: number;
  pulled: number;
}

function sanitizeSettings(settings: SettingsRecord): SettingsRecord {
  return {
    ...settings,
    deepseekApiKey: '',
    syncToken: '',
    lastSyncError: '',
  };
}

function sanitizePayload(item: SyncQueueRecord): unknown {
  if (item.entity === 'settings' && item.payload && typeof item.payload === 'object') {
    return sanitizeSettings(item.payload as SettingsRecord);
  }
  return item.payload;
}

function toRemoteItem(item: SyncQueueRecord, settings: SettingsRecord): RemoteSyncItem {
  return {
    entity: item.entity,
    entityId: item.entityId,
    operation: item.operation,
    payload: sanitizePayload(item),
    updatedAt: item.updatedAt,
    deviceId: settings.syncDeviceId,
  };
}

async function requestCloud<T>(
  settings: SettingsRecord,
  method: 'GET' | 'POST',
  body?: unknown,
): Promise<T> {
  if (!settings.syncToken) {
    throw new Error('缺少云同步令牌');
  }

  const response = await fetch('/api/sync', {
    method,
    headers: {
      Authorization: `Bearer ${settings.syncToken}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || `云同步失败：${response.status}`);
  }
  return data as T;
}

async function pushPending(settings: SettingsRecord): Promise<number> {
  const pending = await db.getPendingSyncItems();
  if (pending.length === 0) return 0;

  await requestCloud(settings, 'POST', {
    deviceId: settings.syncDeviceId,
    items: pending.map(item => toRemoteItem(item, settings)),
  });

  for (const item of pending) {
    await db.markSyncItemSynced(item.id);
  }
  await db.clearSyncedItems();
  return pending.length;
}

async function applyRemoteItem(item: RemoteSyncItem, localSettings: SettingsRecord): Promise<boolean> {
  if (item.operation === 'delete') return false;

  if (item.entity === 'settings') {
    const remote = item.payload as Partial<SettingsRecord> | null;
    if (!remote) return false;
    await db.saveSettings({
      ...localSettings,
      ...remote,
      key: 'settings',
      deepseekApiKey: localSettings.deepseekApiKey ?? '',
      syncEnabled: localSettings.syncEnabled,
      syncToken: localSettings.syncToken,
      syncDeviceId: localSettings.syncDeviceId,
    });
    return true;
  }

  if (item.entity === 'progress' && item.payload) {
    await db.saveProgress(item.payload as ProgressRecord);
    return true;
  }

  if (item.entity === 'dailyLog' && item.payload) {
    await db.saveDailyLog(item.payload as DailyLogRecord);
    return true;
  }

  return false;
}

async function pullRemote(settings: SettingsRecord): Promise<number> {
  const data = await requestCloud<{ items: RemoteSyncItem[] }>(settings, 'GET');
  const pending = await db.getPendingSyncItems();
  const pendingIds = new Set(pending.map(item => `${item.entity}:${item.entityId}`));
  let applied = 0;

  for (const item of data.items || []) {
    if (item.deviceId === settings.syncDeviceId) continue;
    if (pendingIds.has(`${item.entity}:${item.entityId}`)) continue;
    if (await applyRemoteItem(item, settings)) {
      applied += 1;
    }
  }

  return applied;
}

export async function runCloudSync(settings: SettingsRecord): Promise<CloudSyncResult> {
  if (!settings.syncEnabled || !settings.syncToken) {
    return { pushed: 0, pulled: 0 };
  }

  try {
    const pushed = await pushPending(settings);
    const pulled = await pullRemote(settings);
    const latest = await db.getSettings();
    if (latest) {
      await db.saveSettings({
        ...latest,
        lastSyncAt: new Date().toISOString(),
        lastSyncError: '',
      });
    }
    return { pushed, pulled };
  } catch (error) {
    const latest = await db.getSettings();
    if (latest) {
      await db.saveSettings({
        ...latest,
        lastSyncError: error instanceof Error ? error.message : '云同步失败',
      });
    }
    throw error;
  }
}
