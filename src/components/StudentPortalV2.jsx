import { useEffect, useRef, useState } from "react";
import { useAppContext } from "../state/AppContext";
import { getFaceServiceHealth, runFaceDetection } from "../services/proctoringApi";
import {
  getSessionMedia,
  setSessionScreenStream,
  setSessionWebcamStream,
  stopSessionMedia,
} from "../services/localMediaBridge";
import {
  captureVideoFrame,
  formatCountdown,
  formatDateTime,
  minutesBetween,
} from "../utils/examUtils";

function hashSeed(value) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return hash;
}

function seededSort(items, seedKey) {
  return [...items]
    .map((item, index) => ({
      item,
      order: hashSeed(`${seedKey}-${index}-${JSON.stringify(item)}`),
    }))
    .sort((left, right) => left.order - right.order)
    .map((entry) => entry.item);
}

export default function StudentPortalV2() {
  const {
    exams,
    sessions,
    currentUser,
    startSession,
    terminateSession,
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
  const [studentWarnings, setStudentWarnings] = useState([]);

  const session = availableSessions.find((entry) => entry.id === selectedSessionId) ?? availableSessions[0];
  const liveExam = exams.find((exam) => exam.id === session?.examId);
  const questions = liveExam?.questions ?? [];
  const shuffledQuestions = questions.length
    ? seededSort(questions, `${session?.id}-questions`).map((question) => ({
        ...question,
        shuffledOptions: seededSort(
          question.options.map((option, optionIndex) => ({
            label: option,
            originalIndex: optionIndex,
          })),
          `${session?.id}-${question.id}-options`,
        ),
      }))
    : [];
  const currentQuestionIndex = session?.currentQuestionIndex ?? 0;
  const currentQuestion = shuffledQuestions[currentQuestionIndex];
  const answeredCount = shuffledQuestions.filter(
    (question) => session?.answers?.[question.id] !== undefined,
  ).length;
  const examSubmitted = session?.status === "submitted";
  const examActive = session?.status === "active";
  const examReady = Object.values(checklist).every(Boolean);

  const videoRef = useRef(null);
  const screenPreviewRef = useRef(null);
  const captureCanvasRef = useRef(null);
  const lastNoiseFlagAtRef = useRef(0);
  const lastFaceViolationAtRef = useRef(0);
  const lastAttentionFlagAtRef = useRef(0);
  const attentionDriftRef = useRef({ side: null, count: 0 });
  const fullscreenStrikeRef = useRef(0);

  function pushStudentWarning(message) {
    setStudentWarnings((current) => [
      { id: crypto.randomUUID(), message },
      ...current,
    ].slice(0, 4));
  }

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
    if (!session) return;

    const media = getSessionMedia(session.id);
    if (videoRef.current) {
      videoRef.current.srcObject = media.webcamStream ?? null;
    }
    if (screenPreviewRef.current) {
      screenPreviewRef.current.srcObject = media.screenStream ?? window.__screenStream ?? null;
    }
  }, [selectedSessionId, session?.status, session?.webcamStatus, session?.screenStatus]);

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
  }, [liveExam?.durationMinutes, session?.id, session?.startedAt, session?.status]);

  useEffect(() => {
    if (!session || session.status !== "active") return undefined;
    if (!faceServiceHealth.ok || !faceServiceHealth.providerConfigured) return undefined;

    const handleVisibility = () => {
      if (document.visibilityState === "hidden") {
        flagSession(session.id, "Student left the exam tab or opened another tab.", "high");
        pushStudentWarning("Warning: tab switching is not allowed during the exam.");
      }
    };

    const handleBlur = () => {
      flagSession(session.id, "Browser window lost focus during the exam.", "medium");
      pushStudentWarning("Warning: keep the exam window focused at all times.");
    };

    const handleFullscreen = () => {
      if (!document.fullscreenElement) {
        fullscreenStrikeRef.current += 1;

        if (fullscreenStrikeRef.current === 1) {
          flagSession(session.id, "Fullscreen mode was exited during the exam.", "medium");
          pushStudentWarning("Warning: fullscreen mode must remain enabled. A second exit will terminate the exam.");
          window.alert("Fullscreen is required for the exam. Returning you to fullscreen now. A second exit will terminate the exam.");
          document.documentElement.requestFullscreen?.().catch(() => {});
          return;
        }

        flagSession(session.id, "Fullscreen exited twice. Session terminated.", "high");
        pushStudentWarning("Exam terminated: fullscreen was exited again.");
        terminateSession(session.id, "system");
      }
    };

    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("blur", handleBlur);
    document.addEventListener("fullscreenchange", handleFullscreen);

    const runCheck = async () => {
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

        if (result.status === "no-face" || result.status === "multiple-faces") {
          const now = Date.now();
          if (now - lastFaceViolationAtRef.current > 12000) {
            lastFaceViolationAtRef.current = now;
            flagSession(
              session.id,
              result.status === "no-face"
                ? "Face-count violation: no face detected in the webcam feed."
                : "Face-count violation: more than one face detected in the webcam feed.",
              "high",
            );
            pushStudentWarning(
              result.status === "no-face"
                ? "Warning: your face is not visible on camera."
                : "Warning: more than one face was detected on camera.",
            );
          }
        attentionDriftRef.current = { side: null, count: 0 };
        } else if (result.status === "review") {
          flagSession(session.id, "Face quality is too low and needs review.", "medium");
          pushStudentWarning("Warning: camera quality is too low. Adjust your position and lighting.");
          attentionDriftRef.current = { side: null, count: 0 };
        } else if (result.status === "verified" && result.detections?.length === 1) {
          const detection = result.detections[0];
          const videoWidth = videoRef.current?.videoWidth || 0;

          if (videoWidth > 0) {
            const faceCenterX = (detection.box.x1 + detection.box.x2) / 2;
            const normalizedX = faceCenterX / videoWidth;
            const side =
              normalizedX < 0.24 ? "left" : normalizedX > 0.76 ? "right" : null;

            if (!side) {
              attentionDriftRef.current = { side: null, count: 0 };
            } else if (attentionDriftRef.current.side === side) {
              attentionDriftRef.current = {
                side,
                count: attentionDriftRef.current.count + 1,
              };
            } else {
              attentionDriftRef.current = { side, count: 1 };
            }

            const now = Date.now();
            if (
              attentionDriftRef.current.count >= 2 &&
              now - lastAttentionFlagAtRef.current > 15000
            ) {
              lastAttentionFlagAtRef.current = now;
              flagSession(
                session.id,
                `Attention warning: face stayed far toward the ${side} side of the frame.`,
                "medium",
              );
              pushStudentWarning(`Warning: keep your face centered. You were turned too far to the ${side}.`);
            }
          }
        }
      } catch (error) {
        updateSession(session.id, { faceStatus: "error" });
        appendSessionLog(session.id, error.message, "error");
        setHardwareMessage(error.message);
      }
    };

    runCheck();
    const interval = window.setInterval(runCheck, 15000);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("blur", handleBlur);
      document.removeEventListener("fullscreenchange", handleFullscreen);
      window.clearInterval(interval);
    };
  }, [currentUser.id, faceServiceHealth.ok, faceServiceHealth.providerConfigured, session?.id, session?.status]);

  useEffect(() => {
    if (!session || session.status !== "active") return undefined;

    const webcamStream = getSessionMedia(session.id).webcamStream;
    if (!webcamStream) return undefined;

    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return undefined;

    const audioContext = new AudioContextClass();
    const analyser = audioContext.createAnalyser();
    analyser.fftSize = 2048;
    analyser.smoothingTimeConstant = 0.85;

    const source = audioContext.createMediaStreamSource(webcamStream);
    source.connect(analyser);

    const samples = new Uint8Array(analyser.fftSize);
    const noiseInterval = window.setInterval(() => {
      analyser.getByteTimeDomainData(samples);

      let sumSquares = 0;
      for (let index = 0; index < samples.length; index += 1) {
        const normalized = (samples[index] - 128) / 128;
        sumSquares += normalized * normalized;
      }

      const rms = Math.sqrt(sumSquares / samples.length);
      const now = Date.now();
      if (rms > 0.08 && now - lastNoiseFlagAtRef.current > 10000) {
        lastNoiseFlagAtRef.current = now;
        appendSessionLog(
          session.id,
          `Noise monitor triggered during exam (level ${rms.toFixed(3)}).`,
          "proctoring",
        );
        flagSession(session.id, "Noise detected through the microphone during the exam.", "high");
        pushStudentWarning("Warning: noise was detected through your microphone.");
      }
    }, 2000);

    return () => {
      window.clearInterval(noiseInterval);
      source.disconnect();
      analyser.disconnect();
      audioContext.close().catch(() => {});
    };
  }, [appendSessionLog, flagSession, session?.id, session?.status]);

  async function runHardwareCheck() {
    try {
      setHardwareMessage("Checking webcam and microphone permissions...");
      const mediaStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      const devices = await navigator.mediaDevices.enumerateDevices();
      const webcamReady = devices.some((device) => device.kind === "videoinput");
      const microphoneReady = devices.some((device) => device.kind === "audioinput");

      setSessionWebcamStream(session.id, mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }

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
      if (screenPreviewRef.current) {
        screenPreviewRef.current.srcObject = stream;
      }

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
    fullscreenStrikeRef.current = 0;
    setStudentWarnings([]);
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
    <div className={`content-grid ${examActive ? "single-column-grid" : ""}`}>
      {!examActive ? (
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
      ) : null}

      <section className="panel">
        {!examActive && !examSubmitted ? (
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
              You answered {answeredCount} of {shuffledQuestions.length} questions.
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
            {studentWarnings.length ? (
              <div className="warning-stack">
                {studentWarnings.map((warning) => (
                  <div key={warning.id} className="student-warning-banner">
                    {warning.message}
                  </div>
                ))}
              </div>
            ) : null}
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
                    {answeredCount}/{shuffledQuestions.length} answered
                  </p>
                </div>
                <div className="palette-grid">
                  {shuffledQuestions.map((question, index) => {
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
                    {currentQuestion?.shuffledOptions.map((option, optionIndex) => {
                      const selected = session.answers?.[currentQuestion.id] === option.originalIndex;
                      return (
                        <label key={`${currentQuestion.id}-${optionIndex}`} className={`option-card ${selected ? "selected" : ""}`}>
                          <input
                            type="radio"
                            name={currentQuestion.id}
                            checked={selected}
                            onChange={() => handleSelectAnswer(currentQuestion.id, option.originalIndex)}
                          />
                          <span className="option-badge">{String.fromCharCode(65 + optionIndex)}</span>
                          <span>{option.label}</span>
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
                      {answeredCount} answered / {shuffledQuestions.length - answeredCount} remaining
                    </span>
                  </div>
                  {currentQuestionIndex === shuffledQuestions.length - 1 ? (
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
