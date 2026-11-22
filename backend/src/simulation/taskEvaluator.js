import { lessons, validateTask } from '../services/curriculum.js';

export function evaluateCommand({ lessonId, attempt, command, result }) {
  const lesson = lessons.find((item) => item.id === lessonId);
  if (!lesson) return attempt.completed_tasks || [];
  const existing = new Set(attempt.completed_tasks || []);
  lesson.objectives.forEach((task) => {
    if (!existing.has(task.id) && validateTask(task, attempt.state, command, result)) existing.add(task.id);
  });
  return [...existing];
}

export function lessonIsComplete(lessonId, completedTaskIds) {
  const lesson = lessons.find((item) => item.id === lessonId);
  return !!lesson && lesson.objectives.every((task) => completedTaskIds.includes(task.id));
}
