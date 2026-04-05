import { useState } from "react";
import { useAppContext } from "../state/AppContext";
import SessionMonitor from "./SessionMonitor";
import { downloadJson, formatDateTime, makeLogExportPayload } from "../utils/examUtils";

export default function FacultyPortal() {
  const { exams, sessions, logs, users, setMonitoredSessionId, updateExam, terminateSession, createExam } = useAppContext();
  const [form, setForm] = useState({
    title: "",
    code: "",
    durationMinutes: 60,
    startsAt: "2026-04-01T20:00",
    instructions: "Keep webcam on\nShare your full screen\nNo tab switching allowed",
  });

  const exportLogs = () => {
    downloadJson(
      `faculty-logs-${new Date().toISOString().replace(/[:.]/g, "-")}.json`,
      makeLogExportPayload(exams, sessions, logs),
    );
  };

  return (
    <div className="content-grid">
      <section className="panel">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Faculty Portal</p>
            <h3>Exam control room</h3>
          </div>
          <button className="button secondary" onClick={exportLogs}>
            Download Logs
          </button>
        </div>
        <div className="card-stack">
          {exams.map((exam) => (
            <article key={exam.id} className="exam-card">
              <div>
                <h4>{exam.title}</h4>
                <p className="muted">
                  {exam.code} • {exam.durationMinutes} min • {formatDateTime(exam.startsAt)}
                </p>
                <p className="muted">{exam.questions?.length ?? 0} questions configured</p>
              </div>
              <div className="actions-row">
                <span className={`badge ${exam.status}`}>{exam.status}</span>
                <button
                  className="button"
                  onClick={() =>
                    updateExam(exam.id, { status: exam.status === "live" ? "completed" : "live" })
                  }
                >
                  {exam.status === "live" ? "Close Exam" : "Make Live"}
                </button>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="panel">
        <p className="eyebrow">Create Exam</p>
        <h3>New assessment</h3>
        <div className="form-grid">
          <input
            className="input"
            placeholder="Exam title"
            value={form.title}
            onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
          />
          <input
            className="input"
            placeholder="Course code"
            value={form.code}
            onChange={(event) => setForm((current) => ({ ...current, code: event.target.value }))}
          />
          <input
            className="input"
            type="number"
            placeholder="Duration"
            value={form.durationMinutes}
            onChange={(event) =>
              setForm((current) => ({ ...current, durationMinutes: Number(event.target.value) }))
            }
          />
          <input
            className="input"
            type="datetime-local"
            value={form.startsAt}
            onChange={(event) => setForm((current) => ({ ...current, startsAt: event.target.value }))}
          />
          <textarea
            className="input textarea"
            placeholder="One instruction per line"
            value={form.instructions}
            onChange={(event) =>
              setForm((current) => ({ ...current, instructions: event.target.value }))
            }
          />
          <button className="button primary" onClick={() => createExam(form)}>
            Save Draft Exam
          </button>
        </div>
        <hr className="divider" />
        <p className="eyebrow">Student Sessions</p>
        <div className="card-stack">
          {sessions.map((session) => (
            <article key={session.id} className="session-row clickable-card">
              <div>
                <h4>{session.id}</h4>
                <p className="muted">
                  Status: {session.status} • Risk: {session.riskLevel} • Alerts: {session.alerts.length}
                </p>
                <p className="muted">Answered: {Object.keys(session.answers ?? {}).length}</p>
                <p className="muted">
                  Student: {users.find((user) => user.id === session.studentId)?.name ?? session.studentId}
                </p>
              </div>
              <div className="actions-row">
                <button className="button secondary" onClick={() => setMonitoredSessionId(session.id)}>
                  View Feed
                </button>
                <button className="button danger" onClick={() => terminateSession(session.id, "faculty")}>
                  Terminate
                </button>
              </div>
            </article>
          ))}
        </div>
      </section>
      <SessionMonitor title="Faculty Monitor" />
    </div>
  );
}
