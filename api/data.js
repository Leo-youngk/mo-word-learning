import {
  getSupabaseAdmin,
  readJson,
  requireSessionUser,
  send,
  sendError,
} from './_lib/server.js';

const DEFAULT_SETTINGS = {
  currentBookId: 'cet6',
  dailyMinNewWords: 25,
  currentWordIndexByBook: {},
  streakCount: 0,
  lastStudyDate: '',
  themeMode: 'zen',
  motionLevel: 'standard',
};

function progressFromRow(row) {
  return {
    wordId: row.id,
    word: row.word,
    bookId: row.book_id,
    status: row.status ?? undefined,
    stage: row.stage ?? undefined,
    nextReviewDate: row.next_review_date ?? undefined,
    lastReviewDate: row.last_review_date ?? undefined,
    firstSeenDate: row.first_seen_date ?? undefined,
    firstLearnDate: row.first_learn_date ?? undefined,
    lastMarkedDate: row.last_marked_date ?? undefined,
    fuzzyCount: row.fuzzy_count ?? undefined,
    reviewCount: row.review_count ?? undefined,
    consecutiveCorrect: row.consecutive_correct ?? undefined,
    consecutiveWrong: row.consecutive_wrong ?? undefined,
    totalReviews: row.total_reviews ?? undefined,
    totalCorrect: row.total_correct ?? undefined,
    isStubborn: row.is_stubborn ?? undefined,
    graduated: row.graduated ?? undefined,
  };
}

function normalizeDateValue(value) {
  if (value === '' || value === undefined) {
    return null;
  }
  return value;
}

export function progressToRow(userId, record) {
  return {
    user_id: userId,
    id: record.wordId,
    word: record.word,
    book_id: record.bookId,
    status: record.status ?? null,
    stage: record.stage ?? null,
    next_review_date: normalizeDateValue(record.nextReviewDate),
    last_review_date: normalizeDateValue(record.lastReviewDate),
    first_seen_date: normalizeDateValue(record.firstSeenDate),
    first_learn_date: normalizeDateValue(record.firstLearnDate),
    last_marked_date: normalizeDateValue(record.lastMarkedDate),
    fuzzy_count: record.fuzzyCount ?? 0,
    review_count: record.reviewCount ?? 0,
    consecutive_correct: record.consecutiveCorrect ?? 0,
    consecutive_wrong: record.consecutiveWrong ?? 0,
    total_reviews: record.totalReviews ?? 0,
    total_correct: record.totalCorrect ?? 0,
    is_stubborn: record.isStubborn ?? false,
    graduated: record.graduated ?? false,
  };
}

function settingsFromRow(row) {
  return {
    currentBookId: row.current_book_id,
    dailyMinNewWords: row.daily_min_new_words,
    currentWordIndexByBook: row.current_word_index_by_book || {},
    streakCount: row.streak_count,
    lastStudyDate: row.last_study_date ?? '',
    themeMode: row.theme_mode || 'zen',
    motionLevel: row.motion_level || 'standard',
  };
}

function settingsToRow(userId, settings) {
  return {
    user_id: userId,
    id: 'settings',
    current_book_id: settings.currentBookId,
    daily_min_new_words: settings.dailyMinNewWords,
    current_word_index_by_book: settings.currentWordIndexByBook,
    streak_count: settings.streakCount,
    last_study_date: settings.lastStudyDate || null,
    theme_mode: settings.themeMode ?? 'zen',
    motion_level: settings.motionLevel ?? 'standard',
  };
}

function sessionFromRow(row) {
  return {
    id: row.id,
    date: row.date,
    bookId: row.book_id,
    sessionType: row.session_type,
    batchIndex: row.batch_index,
    status: row.status,
    phase: row.phase,
    currentIndex: row.current_index,
    reviewWordIds: row.review_word_ids ?? [],
    newWordIds: row.new_word_ids ?? [],
    completedWordIds: row.completed_word_ids ?? [],
    wordResults: row.word_results ?? {},
    plannedNextWordIndex: row.planned_next_word_index,
  };
}

function sessionToRow(userId, session) {
  return {
    ...(session.id ? { id: session.id } : {}),
    user_id: userId,
    date: session.date,
    book_id: session.bookId,
    session_type: session.sessionType,
    batch_index: session.batchIndex,
    status: session.status,
    phase: session.phase,
    current_index: session.currentIndex,
    review_word_ids: session.reviewWordIds,
    new_word_ids: session.newWordIds,
    completed_word_ids: session.completedWordIds,
    word_results: session.wordResults,
    planned_next_word_index: session.plannedNextWordIndex,
  };
}

function activityFromRow(row) {
  return {
    date: row.date,
    bookId: row.book_id,
    newWordsCount: row.new_words_count,
    reviewWordsCount: row.review_words_count,
    totalWordsStudied: row.total_words_studied,
  };
}

function activityToRow(userId, activity) {
  return {
    user_id: userId,
    date: activity.date,
    book_id: activity.bookId,
    new_words_count: activity.newWordsCount,
    review_words_count: activity.reviewWordsCount,
    total_words_studied: activity.totalWordsStudied,
  };
}

function isUniqueBatchConflict(error) {
  return error?.code === '23505'
    && typeof error?.message === 'string'
    && error.message.includes('idx_momo_learning_sessions_user_date_batch');
}

export async function saveSessionRecord(supabase, userId, session) {
  const row = sessionToRow(userId, session);

  if (session.id) {
    const { data, error } = await supabase
      .from('momo_learning_sessions')
      .update(row)
      .eq('id', session.id)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) throw error;
    return sessionFromRow(data);
  }

  if (session.sessionType === 'daily') {
    const { data: existing, error: existingError } = await supabase
      .from('momo_learning_sessions')
      .select('id,batch_index')
      .eq('user_id', userId)
      .eq('date', session.date)
      .eq('session_type', 'daily')
      .maybeSingle();

    if (existingError) throw existingError;

    if (existing?.id) {
      const updateRow = sessionToRow(userId, {
        ...session,
        id: existing.id,
        batchIndex: Number(existing.batch_index ?? 0),
      });

      const { data, error } = await supabase
        .from('momo_learning_sessions')
        .update(updateRow)
        .eq('id', existing.id)
        .eq('user_id', userId)
        .select()
        .single();

      if (error) throw error;
      return sessionFromRow(data);
    }
  }

  const { data, error } = await supabase
    .from('momo_learning_sessions')
    .insert(row)
    .select()
    .single();

  if (error) throw error;
  return sessionFromRow(data);
}

export async function createExtraSessionRecord(supabase, userId, payload) {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const { data: existing, error: existingError } = await supabase
      .from('momo_learning_sessions')
      .select('batch_index')
      .eq('user_id', userId)
      .eq('date', payload.date)
      .order('batch_index', { ascending: false })
      .limit(1);

    if (existingError) throw existingError;

    const nextBatch = existing?.length ? Number(existing[0].batch_index) + 1 : 1;
    const row = {
      user_id: userId,
      date: payload.date,
      book_id: payload.bookId,
      session_type: 'extra',
      batch_index: nextBatch,
      status: 'active',
      phase: payload.reviewWordIds.length > 0 ? 'review' : 'round1',
      current_index: 0,
      review_word_ids: payload.reviewWordIds,
      new_word_ids: payload.newWordIds,
      completed_word_ids: [],
      word_results: {},
      planned_next_word_index: payload.plannedNextWordIndex,
    };

    const { data, error } = await supabase
      .from('momo_learning_sessions')
      .insert(row)
      .select()
      .single();

    if (!error) {
      return sessionFromRow(data);
    }

    if (!isUniqueBatchConflict(error) || attempt === 1) {
      throw error;
    }
  }

  throw new Error('Failed to create extra session');
}

async function getCurrentSettings(supabase, userId) {
  const { data, error } = await supabase
    .from('momo_user_settings')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) throw error;
  return data ? settingsFromRow(data) : { ...DEFAULT_SETTINGS };
}

async function saveSettings(supabase, userId, settings) {
  const row = settingsToRow(userId, settings);
  const { error } = await supabase
    .from('momo_user_settings')
    .upsert(row, { onConflict: 'user_id' });

  if (error) throw error;
  return settings;
}

async function handleSettings(supabase, userId, action, payload) {
  if (action === 'get') {
    return { settings: await getCurrentSettings(supabase, userId) };
  }

  if (action === 'save') {
    return { settings: await saveSettings(supabase, userId, payload.settings) };
  }

  if (action === 'updatePartial') {
    const current = await getCurrentSettings(supabase, userId);
    const updated = { ...current, ...payload.partial };
    return { settings: await saveSettings(supabase, userId, updated) };
  }

  throw new Error('Unsupported settings action');
}

async function handleProgress(supabase, userId, action, payload) {
  if (action === 'getAll') {
    const { data, error } = await supabase
      .from('momo_word_progress')
      .select('*')
      .eq('user_id', userId);

    if (error) throw error;
    return { items: (data || []).map(progressFromRow) };
  }

  if (action === 'getOne') {
    const { data, error } = await supabase
      .from('momo_word_progress')
      .select('*')
      .eq('user_id', userId)
      .eq('id', payload.wordId)
      .maybeSingle();

    if (error) throw error;
    return { item: data ? progressFromRow(data) : null };
  }

  if (action === 'getByBook') {
    const { data, error } = await supabase
      .from('momo_word_progress')
      .select('*')
      .eq('user_id', userId)
      .eq('book_id', payload.bookId);

    if (error) throw error;
    return { items: (data || []).map(progressFromRow) };
  }

  if (action === 'save') {
    const row = progressToRow(userId, payload.record);
    const { error } = await supabase
      .from('momo_word_progress')
      .upsert(row, { onConflict: 'user_id,id' });

    if (error) throw error;
    return { ok: true };
  }

  if (action === 'getDueWords') {
    const { data, error } = await supabase
      .from('momo_word_progress')
      .select('*')
      .eq('user_id', userId)
      .eq('book_id', payload.bookId)
      .eq('status', 'fuzzy')
      .lte('next_review_date', payload.today);

    if (error) throw error;
    return { items: (data || []).map(progressFromRow) };
  }

  if (action === 'countMastered' || action === 'countFuzzy') {
    let query = supabase
      .from('momo_word_progress')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('status', action === 'countMastered' ? 'mastered' : 'fuzzy');

    if (payload?.bookId) {
      query = query.eq('book_id', payload.bookId);
    }

    const { count, error } = await query;
    if (error) throw error;
    return { count: count ?? 0 };
  }

  throw new Error('Unsupported progress action');
}

async function handleSessions(supabase, userId, action, payload) {
  if (action === 'getActive') {
    const { data, error } = await supabase
      .from('momo_learning_sessions')
      .select('*')
      .eq('user_id', userId)
      .eq('date', payload.date)
      .eq('status', 'active')
      .order('batch_index', { ascending: true })
      .limit(1)
      .maybeSingle();

    if (error) throw error;
    return { session: data ? sessionFromRow(data) : null };
  }

  if (action === 'getAllActive') {
    const { data, error } = await supabase
      .from('momo_learning_sessions')
      .select('*')
      .eq('user_id', userId)
      .eq('date', payload.date)
      .eq('status', 'active')
      .order('batch_index', { ascending: true });

    if (error) throw error;
    return { sessions: (data || []).map(sessionFromRow) };
  }

  if (action === 'save') {
    return { session: await saveSessionRecord(supabase, userId, payload.session) };
  }

  if (action === 'complete') {
    const { error } = await supabase
      .from('momo_learning_sessions')
      .update({ status: 'completed', phase: 'summary', current_index: 0 })
      .eq('id', payload.sessionId)
      .eq('user_id', userId);

    if (error) throw error;
    return { ok: true };
  }

  if (action === 'createExtra') {
    return { session: await createExtraSessionRecord(supabase, userId, payload) };
  }

  throw new Error('Unsupported session action');
}

async function handleActivities(supabase, userId, action, payload) {
  if (action === 'getDaily') {
    const { data, error } = await supabase
      .from('momo_daily_activities')
      .select('*')
      .eq('user_id', userId)
      .eq('date', payload.date)
      .maybeSingle();

    if (error) throw error;
    return { activity: data ? activityFromRow(data) : null };
  }

  if (action === 'getRecent') {
    const days = Math.max(1, Number(payload.days || 7));
    const dates = [];
    const now = new Date();

    for (let i = days - 1; i >= 0; i -= 1) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      dates.push(date.toISOString().slice(0, 10));
    }

    const { data, error } = await supabase
      .from('momo_daily_activities')
      .select('*')
      .eq('user_id', userId)
      .in('date', dates)
      .order('date', { ascending: true });

    if (error) throw error;
    return { activities: (data || []).map(activityFromRow) };
  }

  if (action === 'upsert') {
    const { error } = await supabase
      .from('momo_daily_activities')
      .upsert(activityToRow(userId, payload.activity), { onConflict: 'user_id,date' });

    if (error) throw error;
    return { ok: true };
  }

  if (action === 'increment') {
    const { data, error } = await supabase
      .from('momo_daily_activities')
      .select('*')
      .eq('user_id', userId)
      .eq('date', payload.date)
      .maybeSingle();

    if (error) throw error;

    const current = data
      ? activityFromRow(data)
      : {
          date: payload.date,
          bookId: payload.bookId,
          newWordsCount: 0,
          reviewWordsCount: 0,
          totalWordsStudied: 0,
        };

    const next = {
      ...current,
      bookId: payload.bookId,
      newWordsCount: current.newWordsCount + (payload.isNew ? 1 : 0),
      reviewWordsCount: current.reviewWordsCount + (payload.isNew ? 0 : 1),
      totalWordsStudied: current.totalWordsStudied + 1,
    };

    const { error: upsertError } = await supabase
      .from('momo_daily_activities')
      .upsert(activityToRow(userId, next), { onConflict: 'user_id,date' });

    if (upsertError) throw upsertError;
    return { activity: next };
  }

  throw new Error('Unsupported activity action');
}

export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') {
      res.setHeader('Allow', 'POST');
      send(res, 405, { error: 'Method not allowed' });
      return;
    }

    const body = await readJson(req);
    const user = requireSessionUser(req);
    const supabase = getSupabaseAdmin();
    const scope = body.scope;
    const action = body.action;
    const payload = body.payload || {};

    let data;

    if (scope === 'settings') {
      data = await handleSettings(supabase, user.id, action, payload);
    } else if (scope === 'progress') {
      data = await handleProgress(supabase, user.id, action, payload);
    } else if (scope === 'session') {
      data = await handleSessions(supabase, user.id, action, payload);
    } else if (scope === 'activity') {
      data = await handleActivities(supabase, user.id, action, payload);
    } else {
      throw new Error('Unsupported data scope');
    }

    send(res, 200, data);
  } catch (error) {
    sendError(res, error);
  }
}
