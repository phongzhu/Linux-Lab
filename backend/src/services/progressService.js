import AppError from '../middleware/AppError.js';

async function readProgress(client, userId) {
  const { data, error } = await client.from('learning_progress').select('*').eq('user_id', userId).maybeSingle();
  if (error) throw new AppError(503, 'DATABASE_UNAVAILABLE', 'Progress is temporarily unavailable.');
  return data || { user_id: userId, completed_lessons: [], xp: 0, streak: 0, last_learning_day: null, timezone: 'Asia/Manila' };
}

async function listActivity(client, userId) {
  const { data, error } = await client.from('learning_activity').select('activity_date,completed_lessons').eq('user_id', userId).order('activity_date', { ascending: false }).limit(30);
  if (error) throw new AppError(503, 'DATABASE_UNAVAILABLE', 'Learning activity is temporarily unavailable.');
  return data || [];
}

async function clearProgress(client) {
  const { data, error } = await client.rpc('reset_learning_progress');
  if (error) throw new AppError(503, 'DATABASE_UNAVAILABLE', 'Progress could not be reset. Check the database migration and retry.');
  return data;
}

export async function getProgress(client, userId) {
  const [progress, activity] = await Promise.all([readProgress(client, userId), listActivity(client, userId)]);
  return {
    completedLessons: progress.completed_lessons,
    xp: progress.xp,
    streak: progress.streak,
    lastLearningDay: progress.last_learning_day,
    timezone: progress.timezone,
    activity,
  };
}

export async function resetProgress(client) {
  const saved = await clearProgress(client);
  return { completedLessons: saved.completed_lessons, xp: saved.xp, streak: saved.streak, lastLearningDay: saved.last_learning_day, timezone: saved.timezone, activity: [] };
}
