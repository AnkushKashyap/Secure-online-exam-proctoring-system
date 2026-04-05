const FACE_API_URL = import.meta.env.VITE_FACE_API_URL || "http://127.0.0.1:9000/predict";
const FACE_HEALTH_URL =
  import.meta.env.VITE_FACE_HEALTH_URL ||
  FACE_API_URL.replace(/\/predict$/, "/health");

export async function getFaceServiceHealth() {
  try {
    const response = await fetch(FACE_HEALTH_URL);
    if (!response.ok) {
      throw new Error("Face service health check failed.");
    }

    return response.json();
  } catch {
    return {
      ok: false,
      providerConfigured: false,
      message: "Local face model is not reachable. Start the Python API with uvicorn api:app --reload --port 9000.",
    };
  }
}

export async function runFaceDetection(payload) {
  const response = await fetch(FACE_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(
      error.message ||
        "Face detection request failed. Check whether the local Python face-model API is running.",
    );
  }

  const result = await response.json();
  if (!result.ok) {
    throw new Error(result.message || "Face detection request failed.");
  }

  return result;
}
