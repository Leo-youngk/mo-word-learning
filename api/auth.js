import {
  clearSessionCookie,
  getSessionUser,
  getSupabaseAdmin,
  normalizeEmail,
  readJson,
  send,
  sendError,
  setSessionCookie,
} from './_lib/server.js';

export default async function handler(req, res) {
  try {
    if (req.method === 'GET') {
      send(res, 200, { user: getSessionUser(req) });
      return;
    }

    if (req.method !== 'POST') {
      res.setHeader('Allow', 'GET, POST');
      send(res, 405, { error: 'Method not allowed' });
      return;
    }

    const body = await readJson(req);
    const action = body.action;
    const email = normalizeEmail(body.email);
    const password = String(body.password || '');
    const supabase = getSupabaseAdmin();

    if (action === 'signup') {
      const { data, error } = await supabase.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });

      if (error) throw error;
      if (!data.user) throw new Error('注册失败');

      setSessionCookie(res, req, data.user);
      send(res, 200, {
        user: {
          id: data.user.id,
          email: data.user.email ?? null,
        },
      });
      return;
    }

    if (action === 'login') {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });

      if (error) throw error;
      if (!data.user) throw new Error('登录失败');

      setSessionCookie(res, req, data.user);
      send(res, 200, {
        user: {
          id: data.user.id,
          email: data.user.email ?? null,
        },
      });
      return;
    }

    if (action === 'logout') {
      clearSessionCookie(res, req);
      send(res, 200, { ok: true });
      return;
    }

    send(res, 400, { error: 'Unsupported auth action' });
  } catch (error) {
    sendError(res, error);
  }
}
