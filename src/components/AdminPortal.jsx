import { useMemo } from "react";
import { useAppContext } from "../state/AppContext";
import SessionMonitor from "./SessionMonitor";
import { downloadJson, formatDateTime, makeLogExportPayload } from "../utils/examUtils";

export default function AdminPortal() {
  const { sessions, logs, exams, users, setMonitoredSessionId } = useAppContext();
  const flaggedSessions = useMemo(
    () => sessions.filter((session) => session.alerts.length > 0),
    [sessions],
  );

  const exportLogs = () => {
    downloadJson(
      `admin-logs-${new Date().toISOString().replace(/[:.]/g, "-")}.json`,
      makeLogExportPayload(exams, sessions, logs),
    );
  };

  return (
    <div className="content-grid">
      <section className="panel">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Admin Portal</p>
            <h3>Platform visibility</h3>
          </div>
          <button className="button secondary" onClick={exportLogs}>
            Download Logs
          </button>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Exam</th>
                <th>Status</th>
                <th>Risk</th>
                <th>Face</th>
                <th>Screen</th>
                <th>Alerts</th>
                <th>Inspect</th>
              </tr>
            </thead>
            <tbody>
              {sessions.map((session) => {
                const exam = exams.find((item) => item.id === session.examId);
                return (
                  <tr key={session.id}>
                    <td>{exam?.title ?? session.examId}</td>
                    <td>{session.status}</td>
                    <td>{session.riskLevel}</td>
                    <td>{session.faceStatus}</td>
                    <td>{session.screenStatus}</td>
                    <td>{session.alerts.length}</td>
                    <td>
                      <button className="button secondary table-button" onClick={() => setMonitoredSessionId(session.id)}>
                        Inspect
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
      <section className="panel">
        <p className="eyebrow">Red Flags</p>
        <h3>Escalations and logs</h3>
        <div className="card-stack">
          {flaggedSessions.length === 0 ? (
            <p className="muted">No red flags at the moment.</p>
          ) : (
            flaggedSessions.map((session) => (
              <article key={session.id} className="alert-card">
                <h4>{session.id}</h4>
                <p className="muted">
                  {users.find((user) => user.id === session.studentId)?.name ?? session.studentId}
                </p>
                {session.alerts.slice(0, 3).map((alert) => (
                  <p key={alert.id}>
                    <strong>{alert.severity}</strong> • {alert.reason}
                  </p>
                ))}
              </article>
            ))
          )}
        </div>
        <hr className="divider" />
        <div className="timeline">
          {logs.slice(0, 8).map((item) => (
            <div key={item.id} className="timeline-item">
              <strong>{item.scope}</strong>
              <p>{item.message}</p>
              <span>{formatDateTime(item.timestamp)}</span>
            </div>
          ))}
        </div>
      </section>
      <SessionMonitor title="Admin Monitor" />
    </div>
  );
}
