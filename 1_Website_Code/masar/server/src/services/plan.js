// Where a student stands in the plan for their chosen track, shared by the
// student dashboard and the supervisor's student details.
import { getTrackContent } from '../content/index.js';

/**
 * @param {object} user                      needs chosenTrack and planDone
 * @param {Record<string, {level}>} levels   latest level result per track
 * @param {Array<{taskId, track, status}>} submissions
 * @returns {null | {stepsDone, stepsTotal, tasksTotal, tasksApproved, nextTask}}
 *   null until the student has a track and a level in it. `nextTask` is the
 *   task that needs them next: one sent back for changes comes first.
 */
export function planSummary(user, levels, submissions) {
  const track = user.chosenTrack;
  const level = track && levels[track]?.level;
  if (!level) return null;
  const content = getTrackContent(track);
  const steps = content.plans[level].steps;
  const prefix = `${track}:${level}:`;
  const ticked = new Set((user.planDone || []).filter((k) => k.startsWith(prefix)).map((k) => k.slice(prefix.length)));
  const byTask = Object.fromEntries(submissions.filter((s) => s.track === track).map((s) => [s.taskId, s]));
  const levelTasks = content.tasks.filter((t) => t.level === level);
  const next =
    levelTasks.find((t) => byTask[t.id]?.status === 'needs_revision') || levelTasks.find((t) => !byTask[t.id]);
  return {
    stepsDone: steps.filter((st) => ticked.has(st.id)).length,
    stepsTotal: steps.length,
    tasksTotal: levelTasks.length,
    tasksApproved: levelTasks.filter((t) => byTask[t.id]?.status === 'approved').length,
    nextTask: next ? { id: next.id, title: next.title, status: byTask[next.id]?.status || null } : null,
  };
}
