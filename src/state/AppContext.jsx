import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { initialExams, initialSessions, users } from "./mockData";

const STORAGE_KEY = "examguard-user-profiles-v1";
const AppContext = createContext(null);

const defaultState = {
  users,
  currentUser: null,
  monitoredSessionId: null,
  exams: initialExams,
  sessions: initialSessions,
  logs: [],
  authError: "",
  lastSubmission: null,
};

function readInitialState() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (!saved) return defaultState;

  try {
    const parsed = JSON.parse(saved);
    return {
      ...defaultState,
      users: parsed.users ?? users,
    };
  } catch {
    return defaultState;
  }
}

export function AppProvider({ children }) {
  const [state, setState] = useState(readInitialState);

  useEffect(() => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        users: state.users,
      }),
    );
  }, [state.users]);

  const value = useMemo(() => {
    const addAuditLog = (message, scope = "system") => {
      const entry = {
        id: crypto.randomUUID(),
        scope,
        message,
        timestamp: new Date().toISOString(),
      };

      setState((current) => ({
        ...current,
        logs: [entry, ...current.logs].slice(0, 150),
      }));
    };

    const login = (email, password) => {
      const normalizedEmail = email.trim().toLowerCase();
      const user = state.users.find(
        (item) => item.email.toLowerCase() === normalizedEmail && item.password === password,
      );

      if (!user) {
        setState((current) => ({ ...current, authError: "Invalid email or password." }));
        return false;
      }

      setState((current) => ({
        ...current,
        currentUser: user,
        authError: "",
        monitoredSessionId: null,
        lastSubmission: null,
      }));
      addAuditLog(`${user.role} login successful for ${user.email}.`, "auth");
      return true;
    };

    const logout = (reason = "User logged out.") => {
      setState((current) => ({
        ...current,
        currentUser: null,
        authError: "",
        monitoredSessionId: null,
        lastSubmission: null,
      }));
      addAuditLog(reason, "auth");
    };

    const clearLastSubmission = () => {
      setState((current) => ({ ...current, lastSubmission: null, authError: "" }));
    };

    const updateUserProfile = (userId, updates) => {
      setState((current) => {
        const updatedUsers = current.users.map((user) =>
          user.id === userId ? { ...user, ...updates } : user,
        );
        const updatedCurrentUser =
          updatedUsers.find((user) => user.id === current.currentUser?.id) ?? null;

        return {
          ...current,
          users: updatedUsers,
          currentUser: updatedCurrentUser,
        };
      });
      addAuditLog(`Profile updated for ${userId}.`, "profile");
    };

    const setMonitoredSessionId = (sessionId) => {
      setState((current) => ({ ...current, monitoredSessionId: sessionId }));
    };

    const updateExam = (examId, updates) => {
      setState((current) => ({
        ...current,
        exams: current.exams.map((exam) =>
          exam.id === examId ? { ...exam, ...updates } : exam,
        ),
      }));
      addAuditLog(`Exam ${examId} updated.`, "exam");
    };

    const updateSession = (sessionId, updates) => {
      setState((current) => ({
        ...current,
        sessions: current.sessions.map((session) =>
          session.id === sessionId ? { ...session, ...updates } : session,
        ),
      }));
    };

    const appendSessionLog = (sessionId, message, type = "system") => {
      const log = {
        id: crypto.randomUUID(),
        type,
        message,
        timestamp: new Date().toISOString(),
      };

      setState((current) => ({
        ...current,
        sessions: current.sessions.map((session) =>
          session.id === sessionId
            ? { ...session, activityLog: [log, ...session.activityLog] }
            : session,
        ),
        logs: [
          {
            id: crypto.randomUUID(),
            scope: `session:${sessionId}`,
            message: `[${type}] ${message}`,
            timestamp: log.timestamp,
          },
          ...current.logs,
        ].slice(0, 120),
      }));
    };

    const flagSession = (sessionId, reason, severity = "medium") => {
      const alert = {
        id: crypto.randomUUID(),
        severity,
        reason,
        timestamp: new Date().toISOString(),
      };

      setState((current) => ({
        ...current,
        sessions: current.sessions.map((session) => {
          if (session.id !== sessionId) return session;

          const riskLevel =
            severity === "high" || session.alerts.length >= 2
              ? "high"
              : severity === "medium"
                ? "medium"
                : session.riskLevel;

          return {
            ...session,
            riskLevel,
            alerts: [alert, ...session.alerts],
            activityLog: [
              {
                id: crypto.randomUUID(),
                type: "alert",
                message: reason,
                timestamp: new Date().toISOString(),
              },
              ...session.activityLog,
            ],
          };
        }),
      }));
      addAuditLog(`Flag raised on ${sessionId}: ${reason}`, "proctoring");
    };

    const startSession = (sessionId) => {
      updateSession(sessionId, {
        status: "active",
        startedAt: new Date().toISOString(),
      });
      appendSessionLog(sessionId, "Exam session started.", "exam");
      addAuditLog(`Session ${sessionId} started.`, "exam");
    };

    const terminateSession = (sessionId, actor = "faculty") => {
      updateSession(sessionId, { status: "terminated" });
      appendSessionLog(sessionId, `Session terminated by ${actor}.`, "exam");
      addAuditLog(`Session ${sessionId} terminated by ${actor}.`, "exam");
    };

    const setSessionQuestionIndex = (sessionId, index) => {
      updateSession(sessionId, { currentQuestionIndex: index });
    };

    const saveAnswer = (sessionId, questionId, optionIndex) => {
      setState((current) => ({
        ...current,
        sessions: current.sessions.map((session) =>
          session.id === sessionId
            ? {
                ...session,
                answers: {
                  ...session.answers,
                  [questionId]: optionIndex,
                },
              }
            : session,
        ),
      }));
    };

    const submitSession = (sessionId) => {
      const submittedSession = state.sessions.find((session) => session.id === sessionId);
      const submittedExam = state.exams.find((exam) => exam.id === submittedSession?.examId);
      const submittedAt = new Date().toISOString();

      setState((current) => ({
        ...current,
        sessions: current.sessions.map((session) =>
          session.id === sessionId
            ? {
                ...session,
                status: "submitted",
                submittedAt,
              }
            : session,
        ),
        currentUser:
          current.currentUser?.role === "student" && current.currentUser.id === submittedSession?.studentId
            ? null
            : current.currentUser,
        lastSubmission:
          current.currentUser?.role === "student" && current.currentUser.id === submittedSession?.studentId
            ? {
                studentName: current.currentUser.name,
                examTitle: submittedExam?.title ?? submittedSession?.examId,
                submittedAt,
              }
            : current.lastSubmission,
      }));
      appendSessionLog(sessionId, "Exam submitted by student.", "exam");
      addAuditLog(`Session ${sessionId} submitted.`, "exam");
    };

    const createExam = (payload) => {
      const instructions = Array.isArray(payload.instructions)
        ? payload.instructions
        : payload.instructions
            .split("\n")
            .map((line) => line.trim())
            .filter(Boolean);

      const questions = (payload.questions ?? [])
        .map((question, index) => ({
          id: question.id ?? `q-${index + 1}-${crypto.randomUUID().slice(0, 6)}`,
          prompt: question.prompt.trim(),
          options: question.options.map((option) => option.trim()).filter(Boolean),
          correctOption: Number(question.correctOption ?? 0),
        }))
        .filter((question) => question.prompt && question.options.length >= 2);

      const exam = {
        id: `exam-${Math.floor(Math.random() * 900 + 100)}`,
        title: payload.title,
        code: payload.code,
        durationMinutes: Number(payload.durationMinutes),
        startsAt: payload.startsAt,
        status: "draft",
        facultyId: state.currentUser.id,
        instructions,
        questions,
      };

      const newSessions = (payload.assignedStudentIds ?? []).map((studentId) => ({
        id: `session-${Math.floor(Math.random() * 9000 + 1000)}`,
        examId: exam.id,
        studentId,
        status: "ready",
        startedAt: null,
        submittedAt: null,
        riskLevel: "low",
        faceStatus: "pending",
        screenStatus: "not-shared",
        webcamStatus: "idle",
        answers: {},
        currentQuestionIndex: 0,
        alerts: [],
        activityLog: [
          {
            id: crypto.randomUUID(),
            type: "system",
            message: `Session created for ${exam.title}.`,
            timestamp: new Date().toISOString(),
          },
        ],
      }));

      setState((current) => ({
        ...current,
        exams: [exam, ...current.exams],
        sessions: [...newSessions, ...current.sessions],
      }));
      addAuditLog(`New exam "${exam.title}" created.`, "exam");
    };

    return {
      ...state,
      login,
      logout,
      clearLastSubmission,
      updateUserProfile,
      setMonitoredSessionId,
      updateExam,
      updateSession,
      startSession,
      terminateSession,
      setSessionQuestionIndex,
      saveAnswer,
      submitSession,
      createExam,
      appendSessionLog,
      flagSession,
      addAuditLog,
    };
  }, [state]);

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useAppContext() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error("useAppContext must be used within an AppProvider");
  }

  return context;
}
