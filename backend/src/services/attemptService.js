import { createPublicClient } from '../config/database.js';
import { createEnvironment, executeCommand } from '../simulation/executor.js';
import { lessons as curriculumLessons } from './curriculum.js';
import { lessonIsComplete, evaluateCommand } from '../simulation/taskEvaluator.js';
import { toPublicLesson } from './lessonService.js';
import AppError from '../middleware/AppError.js';

function databaseError(error) {
  if (error?.code === 'PGRST116') return new AppError(404, 'ATTEMPT_NOT_FOUND', 'That lesson attempt could not be found.');
  return new AppError(503, 'DATABASE_UNAVAILABLE', 'Your lesson attempt could not be saved. Check the database migration and retry.');
}

async function createAttempt(client, values) {
  const { data, error } = await client.from('training_attempts').insert(values).select('*').single();
  if (error) throw databaseError(error);
  return data;
}

async function getAttempt(client, attemptId, userId) {
  const { data, error } = await client.from('training_attempts').select('*').eq('id', attemptId).eq('user_id', userId).maybeSingle();
  if (error) throw databaseError(error);
  if (!data) throw new AppError(404, 'ATTEMPT_NOT_FOUND', 'That lesson attempt could not be found.');
  return data;
}

async function listActiveAttempts(client, userId) {
  const { data, error } = await client.from('training_attempts').select('*').eq('user_id', userId).eq('status', 'active').order('updated_at', { ascending: false });
  if (error) throw databaseError(error);
  return data || [];
}

async function listCommands(client, attemptId, userId) {
  const { data, error } = await client.from('training_command_history').select('id,command,cwd_before,cwd_after,cwd,stdout,stderr,exit_code,output,succeeded,host_before,host_after,user_before,user_after,created_at').eq('attempt_id', attemptId).eq('user_id', userId).order('id');
  if (error) throw databaseError(error);
  return (data || []).map((row) => ({
    id: row.id,
    command: row.command,
    cwdBefore: row.cwd_before || row.cwd || '/home/learner',
    cwdAfter: row.cwd_after || row.cwd || '/home/learner',
    stdout: row.stdout ?? (row.succeeded ? row.output : ''),
    stderr: row.stderr ?? (!row.succeeded ? row.output : ''),
    exitCode: row.exit_code ?? (row.succeeded ? 0 : 1),
    hostBefore: row.host_before || 'learnbox',
    hostAfter: row.host_after || 'learnbox',
    userBefore: row.user_before || 'learner',
    userAfter: row.user_after || 'learner',
    output: row.output,
    succeeded: row.succeeded,
    createdAt: row.created_at,
  }));
}

async function recordCommand(client, params) {
  const { data, error } = await client.rpc('record_attempt_command', params);
  if (error) throw databaseError(error);
  return data;
}

async function restartAttempt(client, attemptId, userId, state) {
  const { data, error } = await client.from('training_attempts').update({ state, completed_tasks: [], status: 'active', updated_at: new Date().toISOString() }).eq('id', attemptId).eq('user_id', userId).select('*').maybeSingle();
  if (error) throw databaseError(error);
  if (!data) throw new AppError(404, 'ATTEMPT_NOT_FOUND', 'That lesson attempt could not be found.');
  return data;
}

async function getProgress(client, userId) {
  const { data, error } = await client.from('learning_progress').select('*').eq('user_id', userId).maybeSingle();
  if (error) throw new AppError(503, 'DATABASE_UNAVAILABLE', 'Progress is temporarily unavailable.');
  return data || { completed_lessons: [], last_learning_day: null };
}

async function findLesson(client, lessonId) {
  const { data, error } = await client.from('training_lessons').select('*').eq('id', lessonId).maybeSingle();
  if (error) throw new AppError(503, 'DATABASE_UNAVAILABLE', 'The course catalog is unavailable. Apply the Supabase database migration, then try again.');
  return data;
}

async function listLessons(client) {
  const { data, error } = await client.from('training_lessons').select('*').order('unit_number').order('lesson_number');
  if (error) throw new AppError(503, 'DATABASE_UNAVAILABLE', 'The course catalog is unavailable. Apply the Supabase database migration, then try again.');
  return data || [];
}

function presentAttempt(row, commands = []) {
  return { id: row.id, lessonId: row.lesson_id, state: row.state, completedTasks: row.completed_tasks || [], status: row.status, commands, updatedAt: row.updated_at };
}

export function initialAttemptState(row) {
  const base = row.starting_environment || createEnvironment();
  const fixture = curriculumLessons.find((item) => item.id === row.id)?.startingState;
  if (!fixture) return base;
  return { ...base, ...fixture, files: { ...(base.files || {}), ...(fixture.files || {}) } };
}

export async function listActive(accessToken, userId) {
  const client = createPublicClient(accessToken);
  const attempts = await listActiveAttempts(client, userId);
  const lessons = await listLessons(client);
  const lookup = new Map(lessons.map((lesson) => [lesson.id, lesson]));
  return attempts.map((row) => {
    const lesson = lookup.get(row.lesson_id);
    return { ...presentAttempt(row), lesson: lesson ? toPublicLesson(lesson) : undefined };
  });
}

export async function start(accessToken, userId, lessonId, timezone) {
  const client = createPublicClient(accessToken);
  const [lesson, progress] = await Promise.all([
    findLesson(client, lessonId), getProgress(client, userId),
  ]);
  if (!lesson) throw new AppError(404, 'LESSON_NOT_FOUND', 'That lesson could not be found.');
  if (timezone && !progress.last_learning_day) await client.from('learning_progress').upsert({ user_id: userId, timezone }, { onConflict: 'user_id' });
  const state = initialAttemptState(lesson);
  const row = await createAttempt(client, { user_id: userId, lesson_id: lessonId, state, completed_tasks: [], status: 'active' });
  return { attempt: presentAttempt(row), lesson: toPublicLesson(lesson) };
}

export async function get(accessToken, userId, attemptId) {
  const client = createPublicClient(accessToken);
  const row = await getAttempt(client, attemptId, userId);
  const [lesson, commands] = await Promise.all([findLesson(client, row.lesson_id), listCommands(client, attemptId, userId)]);
  return { attempt: presentAttempt(row, commands), lesson: toPublicLesson(lesson) };
}

export async function restart(accessToken, userId, attemptId) {
  const client = createPublicClient(accessToken);
  const row = await getAttempt(client, attemptId, userId);
  const lesson = await findLesson(client, row.lesson_id);
  if (!lesson) throw new AppError(404, 'LESSON_NOT_FOUND', 'That lesson could not be found.');
  const reset = await restartAttempt(client, attemptId, userId, initialAttemptState(lesson));
  return { attempt: presentAttempt(reset), lesson: toPublicLesson(lesson) };
}

export async function submitCommand(accessToken, userId, attemptId, command) {
  const client = createPublicClient(accessToken);
  const attemptRow = await getAttempt(client, attemptId, userId);
  if (attemptRow.status !== 'active') throw new AppError(409, 'ATTEMPT_COMPLETE', 'This attempt is complete. Start a new replay to continue practicing.');
  const [lesson, previousCommands] = await Promise.all([
    findLesson(client, attemptRow.lesson_id), listCommands(client, attemptId, userId),
  ]);
  if (!lesson) throw new AppError(404, 'LESSON_NOT_FOUND', 'That lesson could not be found.');
  const commandList = previousCommands.map((item) => item.command);
  const result = executeCommand(attemptRow.state, command, commandList);
  const attemptState = result.env;
  const attemptView = { ...attemptRow, state: attemptState, completed_tasks: attemptRow.completed_tasks || [] };
  const completedTasks = evaluateCommand({ lessonId: attemptRow.lesson_id, attempt: attemptView, command, result });
  const completeLesson = lessonIsComplete(attemptRow.lesson_id, completedTasks);
  const rpc = await recordCommand(client, {
    p_attempt_id: attemptId,
    p_command: command,
    p_stdout: result.stdout,
    p_stderr: result.stderr,
    p_exit_code: result.exitCode,
    p_cwd_before: result.cwdBefore,
    p_cwd_after: result.cwdAfter,
    p_host_before: result.hostBefore,
    p_host_after: result.hostAfter,
    p_user_before: result.userBefore,
    p_user_after: result.userAfter,
    p_state: attemptState,
    p_completed_tasks: completedTasks,
    p_complete_lesson: completeLesson,
  });
  const [saved, commands] = await Promise.all([
    getAttempt(client, attemptId, userId), listCommands(client, attemptId, userId),
  ]);
  return {
    stdout: result.stdout,
    stderr: result.stderr,
    exitCode: result.exitCode,
    output: result.stdout || result.stderr,
    error: result.exitCode !== 0,
    cwd: attemptState.cwd,
    attempt: presentAttempt(saved, commands),
    completedTasks,
    lessonComplete: completeLesson,
    awardedXp: rpc?.awarded_xp || 0,
    progress: rpc?.progress ? {
      completedLessons: rpc.progress.completed_lessons,
      xp: rpc.progress.xp,
      streak: rpc.progress.streak,
      lastLearningDay: rpc.progress.last_learning_day,
      timezone: rpc.progress.timezone,
    } : undefined,
  };
}
