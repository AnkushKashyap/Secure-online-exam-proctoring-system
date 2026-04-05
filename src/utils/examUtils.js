export function formatDateTime(value) {
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function minutesBetween(value) {
  const ms = new Date(value).getTime() - Date.now();
  return Math.max(Math.round(ms / 60000), 0);
}

export function formatCountdown(totalSeconds) {
  const safeSeconds = Math.max(totalSeconds, 0);
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const seconds = safeSeconds % 60;

  return [hours, minutes, seconds]
    .map((part) => String(part).padStart(2, "0"))
    .join(":");
}

export function captureVideoFrame(videoElement, canvasElement) {
  if (!videoElement || !canvasElement || videoElement.readyState < 2) {
    return null;
  }

  const width = videoElement.videoWidth || 640;
  const height = videoElement.videoHeight || 480;
  canvasElement.width = width;
  canvasElement.height = height;

  const context = canvasElement.getContext("2d");
  if (!context) return null;

  context.drawImage(videoElement, 0, 0, width, height);
  const dataUrl = canvasElement.toDataURL("image/jpeg", 0.82);

  return dataUrl.replace(/^data:image\/jpeg;base64,/, "");
}

export function downloadJson(filename, data) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function makeLogExportPayload(exams, sessions, logs) {
  return {
    exportedAt: new Date().toISOString(),
    exams,
    sessions: sessions.map((session) => ({
      ...session,
      activityLog: [...session.activityLog],
      alerts: [...session.alerts],
    })),
    auditLogs: logs,
  };
}
