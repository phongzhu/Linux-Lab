import { writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { units, lessons } from '../../src/services/curriculum.js';
import { appliedUnits } from '../../src/services/appliedCurriculum.js';
import { createEnvironment, normalizeEnvironment } from '../../src/simulation/executor.js';

const here = dirname(fileURLToPath(import.meta.url));
const quote = (value) => `'${String(value).replaceAll("'", "''")}'`;
const json = (value) => `${quote(JSON.stringify(value))}::jsonb`;
const foundationUnits = units.map((unit, index) => ({ ...unit, id: `LF-U${String(index + 1).padStart(2, '0')}`, number: index + 1, trackId: 'linux-fundamentals' }));
const allUnits = [...foundationUnits, ...appliedUnits];
const rows = lessons.map((lesson) => {
  const unit = allUnits.find((candidate) => candidate.id === lesson.unitId);
  const tasks = lesson.objectives.map(({ id, title, description, hint, hints, feedback, expectedOutcome }) => ({ id, title, description, hint, hints, feedback, expectedOutcome }));
  const base = createEnvironment();
  const env = normalizeEnvironment({ ...base, ...lesson.startingState, files: { ...base.files, ...(lesson.startingState?.files || {}) }, scenarioId: lesson.id });
  const outcomes = lesson.expectedOutcomes || lesson.objectives.map((item) => item.expectedOutcome).filter(Boolean);
  return `(${[
    quote(lesson.id), lesson.unitNumber, lesson.lessonNumber, quote(unit.title), quote(unit.color), quote(unit.subtitle),
    quote(lesson.title), quote(lesson.duration || lesson.time), quote(lesson.intro), quote(lesson.scenario), json(tasks), json(lesson.recap || []), json(env),
    quote(lesson.sectionId), quote(lesson.trackId), quote(lesson.unitId), `array[${(lesson.prerequisites || []).map(quote).join(',')}]::text[]`, quote(lesson.role || 'learner'), quote(lesson.workspaceType || 'local-shell'), `array[${(lesson.tools || []).map(quote).join(',')}]::text[]`, json(outcomes), json(lesson.explanation || lesson.recap || []), quote(lesson.implementationStatus || 'ready'),
  ].join(', ')})`;
});
const columns = 'id, unit_number, lesson_number, unit_title, unit_color, unit_subtitle, title, duration, concept, scenario, objectives, recap, starting_environment, section_id, track_id, unit_id, prerequisites, role_name, workspace_type, tools, expected_outcomes, explanation, implementation_status';
const sql = `insert into public.training_lessons (${columns})\nvalues\n${rows.join(',\n')}\non conflict (id) do nothing;\n`;
writeFileSync(resolve(here, '001_training_lessons.sql'), sql, 'utf8');
const appliedRows = rows.filter((_, index) => lessons[index].sectionId === 'applied-linux-sre');
writeFileSync(resolve(here, '002_applied_lessons.sql'), `insert into public.training_lessons (${columns})\nvalues\n${appliedRows.join(',\n')}\non conflict (id) do nothing;\n`, 'utf8');
console.log(`Wrote ${lessons.length} lesson seeds (${appliedRows.length} new applied lessons).`);
