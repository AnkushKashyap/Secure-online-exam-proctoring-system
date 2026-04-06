import { useState } from "react";
import { useAppContext } from "../state/AppContext";

export default function LoginPortal() {
  const { login, authError, lastSubmission, clearLastSubmission } = useAppContext();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  function handleSubmit(event) {
    event.preventDefault();
    login(email, password);
  }

  if (lastSubmission) {
    return (
      <div className="auth-shell">
        <section className="auth-panel thank-you-layout">
          <div className="thank-you-card thank-you-page">
            <p className="eyebrow">Thank You</p>
            <h1>Exam submitted successfully</h1>
            <p className="muted">
              {lastSubmission.studentName} submitted {lastSubmission.examTitle} on{" "}
              {new Intl.DateTimeFormat("en-IN", {
                dateStyle: "medium",
                timeStyle: "short",
              }).format(new Date(lastSubmission.submittedAt))}
              .
            </p>
            <p className="muted">You can continue back to the login page for the next user.</p>
            <button className="button primary" type="button" onClick={clearLastSubmission}>
              Back to Login
            </button>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="auth-shell">
      <section className="auth-panel centered-panel">
        <form className="auth-form" onSubmit={handleSubmit}>
          <p className="eyebrow">ExamGuard Pro</p>
          <h1>Login</h1>
          <p className="muted">
            Sign in as student, faculty, or admin to continue into the monitored exam workflow.
          </p>
          <input
            className="input" type="email" value={email} onChange={(event) => setEmail(event.target.value)}
            placeholder="Email"
          />
          <input
            className="input"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Password"
          />
          {authError ? <p className="auth-error">{authError}</p> : null}
          <button className="button primary" type="submit">
            Login
          </button>
        </form>
      </section>
    </div>
  );
}
