// The line icon for each of the four badges, shared by the dashboard panel
// and the toast that celebrates a new badge.
const PATHS = {
  trackQuiz: <path d="M6 20V5m0 0h10l-2 3.5L16 12H6" />,
  levelTest: <path d="M5 19h14M7 19V13m5 6V9m5 10V5" />,
  firstSubmission: <path d="M12 16V5m0 0L7.5 9.5M12 5l4.5 4.5M5 19h14" />,
  firstApproval: <path d="M5 12.5l4.5 4.5L19 7.5" />,
};

export default function BadgeIcon({ id, size = 26 }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {PATHS[id]}
    </svg>
  );
}
