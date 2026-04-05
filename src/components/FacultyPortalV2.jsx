import { useMemo, useState } from "react";
import { useAppContext } from "../state/AppContext";
import SessionMonitor from "./SessionMonitor";
import { downloadJson, formatDateTime, makeLogExportPayload } from "../utils/examUtils";

const makeQuestion = () => ({
  id: crypto.randomUUID(),
  prompt: "",
  options: ["", "", "", ""],
  correctOption: 0,
});

const buildInitialForm = () => ({
  title: "",
  code: "",
  durationMinutes: 60,
  startsAt: "2026-04-06T20:00",
  instructions: "Keep webcam on\nShare your full screen\nNo tab switching allowed",
  assignedStudentIds: ["stu-1"],
  questions: [makeQuestion()],
});

export default function FacultyPortalV2() {
  const {
    exams,
    sessions,
    logs,
    users,
    setMonitoredSessionId,
    updateExam,
    terminateSession,
    createExam,
  } = useAppContext();
  const [form, setForm] = useState(buildInitialForm);

  const students = useMemo(() => users.filter((user) => user.role === "student"), [users]);

  const exportLogs = () => {
    downloadJson(
      `faculty-logs-${new Date().toISOString().replace(/[:.]/g, "-")}.json`,
      makeLogExportPayload(exams, sessions, logs),
    );
  };

  const toggleStudentAssignment = (studentId) => {
    setForm((current) => ({
      ...current,
      assignedStudentIds: current.assignedStudentIds.includes(studentId)
        ? current.assignedStudentIds.filter((id) => id !== studentId)
        : [...current.assignedStudentIds, studentId],
    }));
  };

  const updateQuestion = (questionId, updates) => {
    setForm((current) => ({
      ...current,
      questions: current.questions.map((question) =>
        question.id === questionId ? { ...question, ...updates } : question,
      ),
    }));
  };

  const updateQuestionOption = (questionId, optionIndex, value) => {
    setForm((current) => ({
      ...current,
      questions: current.questions.map((question) =>
        question.id === questionId
          ? {
              ...question,
              options: question.options.map((option, index) => (index === optionIndex ? value : option)),
            }
          : question,
      ),
    }));
  };

  const addQuestion = () => {
    setForm((current) => ({
      ...current,
      questions: [...current.questions, makeQuestion()],
    }));
  };

  const removeQuestion = (questionId) => {
    setForm((current) => ({
      ...current,
      questions:
        current.questions.length === 1
          ? current.questions
          : current.questions.filter((question) => question.id !== questionId),
    }));
  };

  const handleCreateExam = () => {
    createExam(form);
    setForm(buildInitialForm());
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
          {exams.map((exam) => {
            const assignedCount = sessions.filter((session) => session.examId === exam.id).length;
            return (
              <article key={exam.id} className="exam-card">
                <div>
                  <h4>{exam.title}</h4>
                  <p className="muted">
                    {exam.code} • {exam.durationMinutes} min • {formatDateTime(exam.startsAt)}
                  </p>
                  <p className="muted">
                    {exam.questions?.length ?? 0} questions • {assignedCount} assigned students
                  </p>
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
            );
          })}
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
            min="1"
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
        </div>

        <div className="builder-section">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Assign Students</p>
              <h4>Exam allocation</h4>
            </div>
          </div>
          <div className="assignment-grid">
            {students.map((student) => (
              <label key={student.id} className="assignment-card">
                <input
                  type="checkbox"
                  checked={form.assignedStudentIds.includes(student.id)}
                  onChange={() => toggleStudentAssignment(student.id)}
                />
                <div>
                  <strong>{student.name}</strong>
                  <p className="muted">{student.email}</p>
                </div>
              </label>
            ))}
          </div>
        </div>

        <div className="builder-section">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Questions</p>
              <h4>Build the paper</h4>
            </div>
            <button className="button secondary" onClick={addQuestion}>
              Add Question
            </button>
          </div>
          <div className="question-builder-list">
            {form.questions.map((question, index) => (
              <article key={question.id} className="question-builder-card">
                <div className="section-heading">
                  <strong>Question {index + 1}</strong>
                  <button className="button danger" onClick={() => removeQuestion(question.id)}>
                    Remove
                  </button>
                </div>
                <textarea
                  className="input textarea short-textarea"
                  placeholder="Enter question prompt"
                  value={question.prompt}
                  onChange={(event) => updateQuestion(question.id, { prompt: event.target.value })}
                />
                <div className="question-option-grid">
                  {question.options.map((option, optionIndex) => (
                    <div key={`${question.id}-${optionIndex}`} className="option-editor">
                      <input
                        className="input"
                        placeholder={`Option ${String.fromCharCode(65 + optionIndex)}`}
                        value={option}
                        onChange={(event) =>
                          updateQuestionOption(question.id, optionIndex, event.target.value)
                        }
                      />
                      <label className="checkbox-row compact-checkbox">
                        <input
                          type="radio"
                          name={`correct-${question.id}`}
                          checked={question.correctOption === optionIndex}
                          onChange={() => updateQuestion(question.id, { correctOption: optionIndex })}
                        />
                        Correct answer
                      </label>
                    </div>
                  ))}
                </div>
              </article>
            ))}
          </div>
        </div>

        <div className="actions-row">
          <button className="button primary" onClick={handleCreateExam}>
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
