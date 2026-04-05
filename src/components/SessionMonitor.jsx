import { useEffect, useRef } from "react";
import { useAppContext } from "../state/AppContext";
import { getSessionMedia } from "../services/localMediaBridge";
import { formatDateTime } from "../utils/examUtils";

export default function SessionMonitor({ title }) {
  const { monitoredSessionId, sessions, exams, users } = useAppContext();
  const webcamRef = useRef(null);
  const screenRef = useRef(null);

  const session = sessions.find((item) => item.id === monitoredSessionId) ?? null;
  const exam = exams.find((item) => item.id === session?.examId);
  const student = users.find((item) => item.id === session?.studentId);
  useEffect(() => {
    const media = session ? getSessionMedia(session.id) : { webcamStream: null, screenStream: null };
    if (webcamRef.current) {
      webcamRef.current.srcObject = media.webcamStream ?? null;
    }
    if (screenRef.current) {
      screenRef.current.srcObject = media.screenStream ?? null;
    }
  }, [monitoredSessionId, session?.screenStatus, session?.webcamStatus]);

  if (!session) {
    return (
      <section className="panel">
        <p className="eyebrow">{title}</p>
        <h3>Select a student session</h3>
        <p className="muted">Choose a session from the list to inspect the local demo webcam and screen feeds.</p>
      </section>
    );
  }

  return (
    <section className="panel">
      <div className="section-heading">
        <div>
          <p className="eyebrow">{title}</p>
          <h3>{student?.name ?? session.studentId}</h3>
        </div>
        <span className={`badge ${session.status}`}>{session.status}</span>
      </div>
      <p className="muted">
        {exam?.title ?? session.examId} • Risk {session.riskLevel} • Screen {session.screenStatus}
      </p>
      <div className="preview-grid">
        <div className="preview-card">
          <p>Student Webcam</p>
          <video ref={webcamRef} autoPlay muted playsInline />
        </div>
        <div className="preview-card">
          <p>Shared Screen</p>
          <video ref={screenRef} autoPlay muted playsInline />
        </div>
      </div>
      <div className="timeline">
        {session.activityLog.slice(0, 5).map((item) => (
          <div key={item.id} className="timeline-item">
            <strong>{item.type}</strong>
            <p>{item.message}</p>
            <span>{formatDateTime(item.timestamp)}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
