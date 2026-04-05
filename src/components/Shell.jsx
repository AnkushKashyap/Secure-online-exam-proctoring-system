export default function Shell({ children }) {
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div>
          <p className="eyebrow">ExamGuard Pro</p>
          <h1>Secure Online Exam Proctoring</h1>
          <p className="muted">
            Student exam readiness, faculty control room, and admin-wide monitoring in one React app.
          </p>
        </div>
        <div className="sidebar-card">
          <p className="card-title">Scope included</p>
          <ul className="compact-list">
            <li>Local trained face detection model integration</li>
            <li>Live screen-share permission and monitoring</li>
            <li>Red-flag alerts for tab switch and fullscreen exit</li>
            <li>Student, faculty, and admin portals</li>
          </ul>
        </div>
      </aside>
      <main className="main-panel">{children}</main>
    </div>
  );
}
