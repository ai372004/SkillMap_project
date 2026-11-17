// Four simple badges, worked out from data the platform already stores.
// There are no points: a badge is earned once and records when it happened.
export const BADGE_IDS = ['trackQuiz', 'levelTest', 'firstSubmission', 'firstApproval'];

const earliest = (dates) => {
  const times = dates.filter(Boolean).map((d) => new Date(d).getTime());
  return times.length ? new Date(Math.min(...times)) : null;
};

/**
 * @param {object} data
 * @param {Array<{createdAt}>} data.trackResults  every track-quiz attempt
 * @param {Array<{createdAt}>} data.levelResults  every level-test attempt (any track)
 * @param {Array<{createdAt, status, reviewedAt, updatedAt}>} data.submissions
 * @returns {Array<{id: string, earned: boolean, earnedAt: Date|null}>}
 */
export function computeBadges({ trackResults = [], levelResults = [], submissions = [] }) {
  const approved = submissions.filter((s) => s.status === 'approved');
  const dates = {
    trackQuiz: earliest(trackResults.map((r) => r.createdAt)),
    levelTest: earliest(levelResults.map((r) => r.createdAt)),
    firstSubmission: earliest(submissions.map((s) => s.createdAt)),
    firstApproval: earliest(approved.map((s) => s.reviewedAt || s.updatedAt)),
  };
  return BADGE_IDS.map((id) => ({ id, earned: !!dates[id], earnedAt: dates[id] }));
}
