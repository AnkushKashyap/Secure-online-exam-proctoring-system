const mediaRegistry = new Map();

function ensureSession(sessionId) {
  if (!mediaRegistry.has(sessionId)) {
    mediaRegistry.set(sessionId, {
      webcamStream: null,
      screenStream: null,
    });
  }

  return mediaRegistry.get(sessionId);
}

export function setSessionWebcamStream(sessionId, stream) {
  const entry = ensureSession(sessionId);
  entry.webcamStream = stream;
}

export function setSessionScreenStream(sessionId, stream) {
  const entry = ensureSession(sessionId);
  entry.screenStream = stream;
}

export function getSessionMedia(sessionId) {
  return mediaRegistry.get(sessionId) ?? { webcamStream: null, screenStream: null };
}

export function stopSessionMedia(sessionId) {
  const entry = mediaRegistry.get(sessionId);
  if (!entry) return;

  for (const stream of [entry.webcamStream, entry.screenStream]) {
    if (!stream) continue;
    stream.getTracks().forEach((track) => track.stop());
  }

  mediaRegistry.set(sessionId, { webcamStream: null, screenStream: null });
}
