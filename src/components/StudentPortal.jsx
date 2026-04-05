import { useEffect, useRef, useState } from "react";
import { useAppContext } from "../state/AppContext";
import { getFaceServiceHealth, runFaceDetection } from "../services/proctoringApi";
import { setSessionScreenStream, setSessionWebcamStream, stopSessionMedia } from "../services/localMediaBridge";
import {
  captureVideoFrame,
  formatCountdown,
  formatDateTime,
  minutesBetween,
} from "../utils/examUtils";

export default function StudentPortal() {
  const {
    exams,
    sessions,
    currentUser,
    startSession,
    updateSession,
    saveAnswer,
    setSessionQuestionIndex,
    submitSession,
    flagSession,
    appendSessionLog,
  } = useAppContext();
  const studentSessions = sessions.filter((session) => session.studentId === currentUser.id);
  const availableSessions = studentSessions.filter((entry) => {
    const exam = exams.find((item) => item.id === entry.examId);
    return ["live", "active", "submitted"].includes(entry.status) || exam?.status === "live";
  });
  const [selectedSessionId, setSelectedSessionId] = useState(availableSessions[0]?.id ?? null);
  const session = availableSessions.find((entry) => entry.id === selectedSessionId) ?? availableSessions[0];
  const liveExam = exams.find((exam) => exam.id === session?.examId);
  const videoRef = useRef(null);
  const screenPreviewRef = useRef(null);
  const captureCanvasRef = useRef(null);
  const [checklist, setChecklist] = useState({
    webcam: false,
    microphone: false,
    keyboard: false,
    mouse: false,
    externalDisplay: false,
    screenShared: false,
  });
  const [hardwareMessage, setHardwareMessage] = useState(
    "Run the hardware verification before starting the exam.",
  );
  const [manualDisplayCheck, setManualDisplayCheck] = useState(false);
  const [faceServiceHealth, setFaceServiceHealth] = useState({
    ok: false,
    providerConfigured: false,
    message: "Checking face-detection service...",
  });
  const [secondsLeft, setSecondsLeft] = useState(null);

  const questions = liveExam?.questions ?? [];
  const currentQuestionIndex = session?.currentQuestionIndex ?? 0;
  const currentQuestion = questions[currentQuestionIndex];
  const answeredCount = questions.filter((question) => session?.answers?.[question.id] !== undefined).length;
  const examSubmitted = session?.status === "submitted";

  useEffect(() => {
    if (!availableSessions.length) {
      setSelectedSessionId(null);
      return;
    }

    if (!availableSessions.some((item) => item.id === selectedSessionId)) {
      setSelectedSessionId(availableSessions[0].id);
    }
  }, [availableSessions, selectedSessionId]);

  useEffect(() => {
    if (screenPreviewRef.current) {
      screenPreviewRef.current.srcObject = session ? window.__screenStream ?? null : null;
    }
  }, [session?.screenStatus, selectedSessionId]);

  useEffect(() => {
    let mounted = true;

    async function loadHealth() {
      const health = await getFaceServiceHealth();
      if (!mounted) return;

      if (!health.ok) {
        setFaceServiceHealth(health);
        setHardwareMessage(health.message || "Face service is unavailable.");
        return;
      }

      if (!health.providerConfigured) {
        setFaceServiceHealth({
          ...health,
          message: "Local face model API is reachable, but trained weights are missing.",
        });
        return;
      }

      setFaceServiceHealth({
        ...health,
        message: "Local face detection model is ready.",
      });
    }

    loadHealth();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!session || session.status !== "active" || !liveExam) return undefined;

    const totalSeconds = liveExam.durationMinutes * 60;
    const startedAt = new Date(session.startedAt).getTime();

    const tick = () => {
      const elapsed = Math.floor((Date.now() - startedAt) / 1000);
      const remaining = Math.max(totalSeconds - elapsed, 0);
      setSecondsLeft(remaining);

      if (remaining === 0) {
        submitSession(session.id);
      }
    };

    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, [liveExam, session, submitSession]);

  useEffect(() => {
    if (!session || session.status !== "active") return undefined;
    if (!faceServiceHealth.ok || !faceServiceHealth.providerConfigured) return undefined;

    const handleVisibility = () => {
      if (document.visibilityState === "hidden") {
        flagSession(session.id, "Student left the exam tab or opened another tab.", "high");
      }
    };

    const handleBlur = () => {
      flagSession(session.id, "Browser window lost focus during the exam.", "medium");
    };

    const handleFullscreen = () => {
      if (!document.fullscreenElement) {
        flagSession(session.id, "Fullscreen mode was exited during the exam.", "medium");
      }
    };

    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("blur", handleBlur);
    document.addEventListener("fullscreenchange", handleFullscreen);

    const interval = window.setInterval(async () => {
      try {
        const imageBase64 = captureVideoFrame(videoRef.current, captureCanvasRef.current);
        if (!imageBase64) {
          appendSessionLog(session.id, "Skipped face check because webcam frame was unavailable.", "warning");
          return;
        }

        const result = await runFaceDetection({
          imageBase64,
          sessionId: session.id,
          studentId: currentUser.id,
          timestamp: new Date().toISOString(),
        });

        updateSession(session.id, { faceStatus: result.status });
        appendSessionLog(
          session.id,
          `Face detection check: ${result.status} (${result.note ?? "no note"})`,
          "proctoring",
        );

        if (result.status === "no-face") {
          flagSession(session.id, "No face detected in the webcam feed.", "high");
        } else if (result.status === "multiple-faces") {
          flagSession(session.id, "Multiple faces detected in the webcam feed.", "high");
        } else if (result.status === "review") {
          flagSession(session.id, "Face quality is too low and needs review.", "medium");
        }
      } catch (error) {
        updateSession(session.id, { faceStatus: "error" });
        appendSessionLog(session.id, error.message, "error");
        setHardwareMessage(error.message);
      }
    }, 15000);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("blur", handleBlur);
      document.removeEventListener("fullscreenchange", handleFullscreen);
      window.clearInterval(interval);
    };
  }, [
    appendSessionLog,
    currentUser.id,
    faceServiceHealth.ok,
    faceServiceHealth.providerConfigured,
    flagSession,
    session,
    updateSession,
  ]);

  const examReady = Object.values(checklist).every(Boolean);

  async function runHardwareCheck() {
    try {
      setHardwareMessage("Checking webcam and microphone permissions...");
      const mediaStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      const devices = await navigator.mediaDevices.enumerateDevices();
      const webcamReady = devices.some((device) => device.kind === "videoinput");
      const microphoneReady = devices.some((device) => device.kind === "audioinput");

      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
      setSessionWebcamStream(session.id, mediaStream);

      setChecklist((current) => ({
        ...current,
        webcam: webcamReady,
        microphone: microphoneReady,
      }));
      updateSession(session.id, { webcamStatus: "ready" });
      setHardwareMessage("Camera and microphone are ready. Move to screen sharing and input checks.");
    } catch {
      setHardwareMessage("Camera or microphone access was blocked. Please allow permission and retry.");
    }
  }

  async function startScreenShare() {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { displaySurface: "monitor" },
        audio: false,
      });
      window.__screenStream = stream;
      setSessionScreenStream(session.id, stream);
      const [track] = stream.getVideoTracks();
      track.addEventListener("ended", () => {
        setChecklist((current) => ({ ...current, screenShared: false }));
        updateSession(session.id, { screenStatus: "stopped" });
        setSessionScreenStream(session.id, null);
        flagSession(session.id, "Student stopped screen sharing.", "high");
      });
      setChecklist((current) => ({ ...current, screenShared: true }));
      updateSession(session.id, { screenStatus: "shared" });
      appendSessionLog(session.id, "Screen sharing started.", "proctoring");
    } catch {
      setHardwareMessage("Screen sharing was not granted. The exam cannot begin without it.");
    }
  }

  async function detectDisplays() {
    if ("getScreenDetails" in window) {
      try {
        const details = await window.getScreenDetails();
        const singleScreen = details.screens.length === 1;
        setChecklist((current) => ({ ...current, externalDisplay: singleScreen }));
        setHardwareMessage(
          singleScreen
            ? "Single screen confirmed."
            : "Multiple displays detected. Disconnect extra screens before the exam.",
        );
        return;
      } catch {
        setHardwareMessage("Display detection permission was denied, so manual confirmation is required.");
      }
    }

    setChecklist((current) => ({ ...current, externalDisplay: manualDisplayCheck }));
  }

  function markKeyboardMouseReady(kind) {
    setChecklist((current) => ({ ...current, [kind]: true }));
  }

  async function beginExam() {
    if (!session) return;
    await document.documentElement.requestFullscreen?.();
    startSession(session.id);
  }

  function handleSelectAnswer(questionId, optionIndex) {
    saveAnswer(session.id, questionId, optionIndex);
  }

  function goToQuestion(index) {
    setSessionQuestionIndex(session.id, index);
  }

  function handleSubmitExam() {
    if (session) {
      stopSessionMedia(session.id);
      updateSession(session.id, {
        screenStatus: "stopped",
        webcamStatus: "stopped",
      });
    }
    submitSession(session.id);
  }

  if (!session || !liveExam) {
    return (
      <section className="panel">
        <h3>No live exam right now</h3>
        <p className="muted">Faculty can publish an exam, and it will appear here for the student.</p>
      </section>
    );
  }

  return (
    <div className="content-grid">
      <section className="panel">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Student Dashboard</p>
            <h3>{liveExam.title}</h3>
          </div>
          <span className={`badge ${session.status}`}>{session.status}</span>
        </div>
        <p className="muted">
          {liveExam.code} • Starts {formatDateTime(liveExam.startsAt)} • Duration {liveExam.durationMinutes} minutes
        </p>
        <div className="assigned-exam-list">
          <p className="eyebrow">Assigned Live Exams</p>
          <div className="assigned-exam-grid">
            {availableSessions.map((entry) => {
              const exam = exams.find((item) => item.id === entry.examId);
              const selected = entry.id === session.id;
              return (
                <button
                  key={entry.id}
                  className={`assigned-exam-card ${selected ? "selected" : ""}`}
                  onClick={() => setSelectedSessionId(entry.id)}
                >
                  <strong>{exam?.title ?? entry.examId}</strong>
                  <span>{exam?.code}</span>
                  <span>Status: {entry.status}</span>
                </button>
              );
            })}
          </div>
        </div>
        <div className={`service-banner ${faceServiceHealth.providerConfigured ? "ready" : "warning"}`}>
          <strong>Face Service</strong>
          <p>{faceServiceHealth.message}</p>
        </div>
        <div className="instruction-box">
          {liveExam.instructions.map((item) => (
            <p key={item}>{item}</p>
          ))}
        </div>
        <div className="actions-row">
          <button className="button primary" onClick={runHardwareCheck}>
            Verify Camera & Mic
          </button>
          <button className="button" onClick={detectDisplays}>
            Detect Displays
          </button>
          <button className="button" onClick={startScreenShare}>
            Start Screen Share
          </button>
        </div>
        <p className="muted">{hardwareMessage}</p>
        <div className="check-grid">
          {Object.entries(checklist).map(([key, value]) => (
            <div key={key} className={`check-item ${value ? "passed" : ""}`}>
              <span>{key.replace(/([A-Z])/g, " $1")}</span>
              <strong>{value ? "Ready" : "Pending"}</strong>
            </div>
          ))}
        </div>
        <label className="checkbox-row">
          <input
            type="checkbox"
            checked={manualDisplayCheck}
            onChange={(event) => {
              setManualDisplayCheck(event.target.checked);
              setChecklist((current) => ({ ...current, externalDisplay: event.target.checked }));
            }}
          />
          I confirm that no external display is connected.
        </label>
        <div className="actions-row">
          <button className="button secondary" onClick={() => markKeyboardMouseReady("keyboard")}>
            Confirm Keyboard
          </button>
          <button className="button secondary" onClick={() => markKeyboardMouseReady("mouse")}>
            Confirm Mouse
          </button>
          <button className="button primary" disabled={!examReady} onClick={beginExam}>
            Enter Exam
          </button>
        </div>
      </section>

      <section className="panel">
        {session.status !== "active" && !examSubmitted ? (
          <>
           <div className="section-heading">
              <div>
                <p className="eyebrow">Live Proctor Feed</p>
                <h3>Readiness and monitoring</h3>
              </div>
              <span className={`risk-chip ${session.riskLevel}`}>{session.riskLevel} risk</span>
            </div>
            <div className="preview-grid single-preview">
              <div className="preview-card">
                <p>Webcam Preview</p>
                <video ref={videoRef} autoPlay muted playsInline />
                <canvas ref={captureCanvasRef} className="hidden-canvas" />
              </div>
              <div className="preview-card">
                <p>Screen Share Preview</p>
                <video ref={screenPreviewRef} autoPlay muted playsInline />
              </div>
            </div>
            <div className="meta-grid">
              <div>
                <span>Face Status</span>
                <strong>{session.faceStatus}</strong>
              </div>
              <div>
                <span>Screen Status</span>
                <strong>{session.screenStatus}</strong>
              </div>
              <div>
                <span>Time to start</span>
                <strong>{minutesBetween(liveExam.startsAt)} min</strong>
              </div>
            </div>
            <div className="notice-banner">
              Entire screen sharing is active for monitoring. The screen preview is visible only to faculty and admin in this demo.
            </div>
            <div className="timeline">
              {session.activityLog.slice(0, 6).map((item) => (
                <div key={item.id} className="timeline-item">
                  <strong>{item.type}</strong>
                  <p>{item.message}</p>
                  <span>{formatDateTime(item.timestamp)}</span>
                </div>
              ))}
            </div>
          </>
        ) : examSubmitted ? (
          <div className="submitted-state">
            <p className="eyebrow">Exam Submitted</p>
            <h3>Your response has been recorded</h3>
            <p className="muted">
              You answered {answeredCount} of {questions.length} questions.
            </p>
            <div className="meta-grid">
              <div>
                <span>Submitted At</span>
                <strong>{formatDateTime(session.submittedAt)}</strong>
              </div>
              <div>
                <span>Risk Level</span>
                <strong>{session.riskLevel}</strong>
              </div>
              <div>
                <span>Face Status</span>
                <strong>{session.faceStatus}</strong>
              </div>
            </div>
          </div>
        ) : (
          <div className="exam-workspace">
            <div className="exam-topbar">
              <div>
                <p className="eyebrow">Live Exam</p>
                <h3>Answer all questions and submit before time ends</h3>
              </div>
              <div className="timer-pill">
                <span className="stopwatch-icon" aria-hidden="true" />
                <div>
                  <span>Timer</span>
                  <strong>{formatCountdown(secondsLeft ?? liveExam.durationMinutes * 60)}</strong>
                </div>
              </div>
            </div>
            <div className="exam-layout">
              <aside className="question-palette">
                <div className="palette-head">
                  <h4>Question Menu</h4>
                  <p className="muted">
                    {answeredCount}/{questions.length} answered
                  </p>
                </div>
                <div className="palette-grid">
                  {questions.map((question, index) => {
                    const answered = session.answers?.[question.id] !== undefined;
                    const active = index === currentQuestionIndex;

                    return (
                      <button
                        key={question.id}
                        className={`palette-button ${answered ? "answered" : ""} ${active ? "active" : ""}`}
                        onClick={() => goToQuestion(index)}
                      >
                        {index + 1}
                      </button>
                    );
                  })}
                </div>
                <button className="button danger" onClick={handleSubmitExam}>
                  Submit Exam
                </button>
              </aside>
              <div className="question-panel">
                <div className="question-card">
                  <div className="question-header">
                    <span className="question-index">Question {currentQuestionIndex + 1}</span>
                    <span className={`risk-chip ${session.riskLevel}`}>{session.riskLevel} risk</span>
                  </div>
                  <h4>{currentQuestion?.prompt}</h4>
                  <div className="option-list">
                    {currentQuestion?.options.map((option, optionIndex) => {
                      const selected = session.answers?.[currentQuestion.id] === optionIndex;
                      return (
                        <label key={option} className={`option-card ${selected ? "selected" : ""}`}>
                          <input
                            type="radio"
                            name={currentQuestion.id}
                            checked={selected}
                            onChange={() => handleSelectAnswer(currentQuestion.id, optionIndex)}
                          />
                          <span className="option-badge">{String.fromCharCode(65 + optionIndex)}</span>
                          <span>{option}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
                <div className="exam-footer">
                  <button
                    className="button"
                    disabled={currentQuestionIndex === 0}
                    onClick={() => goToQuestion(currentQuestionIndex - 1)}
                  >
                    Previous
                  </button>
                  <div className="exam-footer-meta">
                    <span>
                      {answeredCount} answered / {questions.length - answeredCount} remaining
                    </span>
                  </div>
                  {currentQuestionIndex === questions.length - 1 ? (
                    <button className="button primary" onClick={handleSubmitExam}>
                      Final Submit
                    </button>
                  ) : (
                    <button
                      className="button primary"
                      onClick={() => goToQuestion(currentQuestionIndex + 1)}
                    >
                      Next
                    </button>
                  )}
                </div>
                <div className="preview-grid single-preview compact-previews">
                  <div className="preview-card small-camera-card">
                    <p>Webcam Preview</p>
                    <video ref={videoRef} autoPlay muted playsInline />
                    <canvas ref={captureCanvasRef} className="hidden-canvas" />
                  </div>
                </div>
                <div className="notice-banner">
                  Screen sharing continues in the background and is monitored by faculty and admin.
                </div>
              </div>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
