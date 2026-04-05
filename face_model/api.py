import base64
from pathlib import Path
from tempfile import NamedTemporaryFile

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from ultralytics import YOLO


ROOT = Path(__file__).resolve().parent
MODEL_PATH = ROOT / "artifacts" / "examguard-face-detector" / "weights" / "best.pt"

app = FastAPI(title="ExamGuard Face Detector API")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
model = YOLO(str(MODEL_PATH)) if MODEL_PATH.exists() else None


class PredictPayload(BaseModel):
    imageBase64: str


@app.get("/health")
def health():
    return {"ok": True, "providerConfigured": model is not None, "provider": "local-yolo-face-model"}


def run_detection(source):
    results = model.predict(source=source, conf=0.25)
    detections = []

    for result in results:
        for box in result.boxes:
            xyxy = box.xyxy.tolist()[0]
            detections.append(
                {
                    "classId": int(box.cls.tolist()[0]),
                    "confidence": float(box.conf.tolist()[0]),
                    "box": {
                        "x1": xyxy[0],
                        "y1": xyxy[1],
                        "x2": xyxy[2],
                        "y2": xyxy[3],
                    },
                }
            )

    face_count = len(detections)
    if face_count == 0:
        status = "no-face"
        note = "No face detected in the webcam frame."
    elif face_count > 1:
        status = "multiple-faces"
        note = "Multiple faces detected in the webcam frame."
    else:
        status = "verified"
        note = "Single face detected by the local model."

    return {
        "ok": True,
        "provider": "local-yolo-face-model",
        "status": status,
        "note": note,
        "faceCount": face_count,
        "detections": detections,
    }


@app.post("/predict")
async def predict_base64(payload: PredictPayload):
    if model is None:
        return {"ok": False, "message": "Model weights not found. Train the model first."}

    with NamedTemporaryFile(delete=False, suffix=".jpg") as temp_file:
        temp_file.write(base64.b64decode(payload.imageBase64))
        temp_path = temp_file.name

    return run_detection(temp_path)
