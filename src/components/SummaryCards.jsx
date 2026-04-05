import { useAppContext } from "../state/AppContext";

export default function SummaryCards() {
  const { exams, sessions, logs } = useAppContext();
  const liveExams = exams.filter((exam) => exam.status === "live").length;
  const activeSessions = sessions.filter((session) => session.status === "active").length;
  const flaggedSessions = sessions.filter((session) => session.alerts.length > 0).length;

  return (
    <div className="stats-grid">
      <article className="stat-card">
        <span>Live Exams</span>
        <strong>{liveExams}</strong>
      </article>
      <article className="stat-card">
        <span>Active Sessions</span>
        <strong>{activeSessions}</strong>
      </article>
      <article className="stat-card">
        <span>Flagged Sessions</span>
        <strong>{flaggedSessions}</strong>
      </article>
      <article className="stat-card">
        <span>Audit Logs</span>
        <strong>{logs.length}</strong>
      </article>
    </div>
  );
}
