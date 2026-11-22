import AppError from '../middleware/AppError.js';

function unwrap({ data, error }) {
  if (error) {
    if (error.code === 'PGRST116') return null;
    throw new AppError(503, 'DATABASE_UNAVAILABLE', 'The course catalog is unavailable. Apply the Supabase database migrations, then try again.');
  }
  return data;
}

async function listLessons(client) {
  return unwrap(await client.from('training_lessons').select('id,unit_number,lesson_number,unit_title,unit_color,unit_subtitle,title,duration,concept,scenario,objectives,recap,section_id,track_id,unit_id,prerequisites,role_name,workspace_type,tools,expected_outcomes,explanation,implementation_status').order('unit_number').order('lesson_number')) || [];
}

async function findLesson(client, lessonId) {
  return unwrap(await client.from('training_lessons').select('*').eq('id', lessonId).maybeSingle());
}

export function toPublicLesson(row) {
  return {
    id: row.id,
    unitIndex: row.unit_number - 1,
    lessonIndex: row.lesson_number - 1,
    number: (row.unit_number - 1) * 3 + row.lesson_number,
    sectionId: row.section_id || 'linux-fundamentals',
    trackId: row.track_id || 'linux-fundamentals',
    unitId: row.unit_id || `LF-U${String(row.unit_number).padStart(2, '0')}`,
    unitNumber: row.unit_number,
    lessonNumber: row.lesson_number,
    unitTitle: row.unit_title,
    unitColor: row.unit_color,
    title: row.title,
    time: row.duration,
    intro: row.concept,
    scenario: row.scenario,
    objectives: row.objectives,
    recap: row.recap,
    prerequisites: row.prerequisites || [],
    role: row.role_name || 'learner',
    workspaceType: row.workspace_type || 'local-shell',
    tools: row.tools || [],
    expectedOutcomes: row.expected_outcomes || [],
    explanation: row.explanation || row.recap || [],
    implementationStatus: row.implementation_status || 'ready',
    objectives: (row.objectives || []).map((task) => ({
      ...task,
      hints: Array.isArray(task.hints) ? task.hints : [task.hint, task.hint, task.hint].filter(Boolean),
    })),
  };
}

export async function getUnits(client) {
  const lessons = await listLessons(client);
  const units = new Map();
  lessons.forEach((row) => {
    const lesson = toPublicLesson(row);
    const key = `${lesson.sectionId}:${lesson.trackId}:${lesson.unitId}`;
    if (!units.has(key)) units.set(key, {
      id: lesson.unitId,
      sectionId: lesson.sectionId,
      trackId: lesson.trackId,
      number: row.unit_number,
      title: row.unit_title,
      subtitle: row.unit_subtitle,
      color: row.unit_color,
      lessons: [],
    });
    units.get(key).lessons.push(lesson);
  });
  const allUnits = [...units.values()];
  const sections = [{
    id: 'linux-fundamentals',
    title: 'Linux Fundamentals',
    tracks: [{ id: 'linux-fundamentals', title: 'Linux Fundamentals', units: allUnits.filter((unit) => unit.sectionId === 'linux-fundamentals') }],
  }, {
    id: 'applied-linux-sre',
    title: 'Applied Linux & SRE Practice',
    tracks: ['applied-linux', 'sre-operations'].map((trackId) => ({
      id: trackId,
      title: trackId === 'applied-linux' ? 'Applied Linux' : 'SRE Operations',
      units: allUnits.filter((unit) => unit.sectionId === 'applied-linux-sre' && unit.trackId === trackId),
    })),
  }].filter((section) => section.id === 'linux-fundamentals' || allUnits.some((unit) => unit.sectionId === section.id));
  return { units: allUnits, sections };
}

export async function getLesson(client, lessonId) {
  const row = await findLesson(client, lessonId);
  if (!row) throw new AppError(404, 'LESSON_NOT_FOUND', 'That lesson could not be found.');
  return toPublicLesson(row);
}
