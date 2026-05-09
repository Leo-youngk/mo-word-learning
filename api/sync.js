const ENTITY_SET = new Set(['settings', 'progress', 'dailyLog']);
const OPERATION_SET = new Set(['upsert', 'delete']);

function send(res, status, payload) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(payload));
}

function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing ${name}`);
  }
  return value;
}

function assertAuthorized(req) {
  const expected = requireEnv('MO_SYNC_TOKEN');
  const auth = req.headers.authorization || '';
  if (auth !== `Bearer ${expected}`) {
    const error = new Error('Unauthorized');
    error.statusCode = 401;
    throw error;
  }
}

function normalizeItem(item) {
  if (!item || typeof item !== 'object') {
    throw new Error('Invalid sync item');
  }

  const entity = item.entity;
  const entityId = item.entityId || item.entity_id;
  const operation = item.operation || 'upsert';

  if (!ENTITY_SET.has(entity)) {
    throw new Error(`Invalid entity: ${entity}`);
  }
  if (!entityId || typeof entityId !== 'string') {
    throw new Error('Missing entityId');
  }
  if (!OPERATION_SET.has(operation)) {
    throw new Error(`Invalid operation: ${operation}`);
  }

  const now = new Date().toISOString();
  return {
    entity,
    entity_id: entityId,
    operation,
    payload: operation === 'delete' ? null : item.payload,
    device_id: typeof item.deviceId === 'string' ? item.deviceId : null,
    client_updated_at: item.updatedAt || item.clientUpdatedAt || now,
    updated_at: now,
  };
}

async function readJson(req) {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(chunk);
  }
  const raw = Buffer.concat(chunks).toString('utf8');
  return raw ? JSON.parse(raw) : {};
}

async function supabaseFetch(path, init = {}) {
  const supabaseUrl = requireEnv('SUPABASE_URL').replace(/\/$/, '');
  const serviceRoleKey = requireEnv('SUPABASE_SERVICE_ROLE_KEY');
  const response = await fetch(`${supabaseUrl}${path}`, {
    ...init,
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Supabase ${response.status}: ${text}`);
  }

  if (response.status === 204) return null;
  const text = await response.text();
  return text ? JSON.parse(text) : null;
}

export default async function handler(req, res) {
  try {
    assertAuthorized(req);

    if (req.method === 'GET') {
      const rows = await supabaseFetch('/rest/v1/mo_sync_items?select=entity,entity_id,operation,payload,device_id,client_updated_at,updated_at&order=updated_at.asc');
      send(res, 200, {
        items: (rows || []).map(row => ({
          entity: row.entity,
          entityId: row.entity_id,
          operation: row.operation,
          payload: row.payload,
          deviceId: row.device_id,
          clientUpdatedAt: row.client_updated_at,
          updatedAt: row.updated_at,
        })),
      });
      return;
    }

    if (req.method === 'POST') {
      const body = await readJson(req);
      const rows = Array.isArray(body.items) ? body.items.map(normalizeItem) : [];
      if (rows.length > 0) {
        await supabaseFetch('/rest/v1/mo_sync_items?on_conflict=entity,entity_id', {
          method: 'POST',
          headers: {
            Prefer: 'resolution=merge-duplicates,return=minimal',
          },
          body: JSON.stringify(rows),
        });
      }
      send(res, 200, { ok: true, count: rows.length });
      return;
    }

    res.setHeader('Allow', 'GET, POST');
    send(res, 405, { error: 'Method not allowed' });
  } catch (error) {
    const status = error.statusCode || 500;
    send(res, status, { error: error.message || 'Sync failed' });
  }
}
