import "dotenv/config";
import express from "express";
import { DetectFacesCommand, RekognitionClient } from "@aws-sdk/client-rekognition";

const app = express();
const port = process.env.PORT || 8787;
const AWS_REGION = process.env.AWS_REGION || "ap-south-1";
const AWS_ACCESS_KEY_ID = process.env.AWS_ACCESS_KEY_ID;
const AWS_SECRET_ACCESS_KEY = process.env.AWS_SECRET_ACCESS_KEY;

function hasRealValue(value) {
  return Boolean(value && !String(value).startsWith("replace_with_your_"));
}

const awsConfigured = Boolean(
  AWS_REGION && hasRealValue(AWS_ACCESS_KEY_ID) && hasRealValue(AWS_SECRET_ACCESS_KEY),
);
const rekognitionClient = awsConfigured
  ? new RekognitionClient({
      region: AWS_REGION,
      credentials: {
        accessKeyId: AWS_ACCESS_KEY_ID,
        secretAccessKey: AWS_SECRET_ACCESS_KEY,
      },
    })
  : null;

app.use(express.json({ limit: "12mb" }));

app.get("/api/health", (_request, response) => {
  response.json({
    ok: true,
    provider: "aws-rekognition",
    providerConfigured: awsConfigured,
    region: AWS_REGION,
  });
});

app.post("/api/face/detect", async (request, response) => {
  try {
    const { imageBase64 } = request.body;

    if (!awsConfigured || !rekognitionClient) {
      return response.status(500).json({
        status: "configuration_error",
        message: "AWS_REGION, AWS_ACCESS_KEY_ID, and AWS_SECRET_ACCESS_KEY must be set in your environment.",
      });
    }

    if (!imageBase64) {
      return response.status(400).json({
        status: "bad_request",
        message: "imageBase64 is required.",
      });
    }

    const result = await rekognitionClient.send(
      new DetectFacesCommand({
        Image: {
          Bytes: Buffer.from(imageBase64, "base64"),
        },
        Attributes: ["ALL"],
      }),
    );

    const faces = result.FaceDetails || [];
    const primaryFace = faces[0];
    const faceCount = faces.length;
    const confidence = primaryFace?.Confidence ?? null;
    const eyesOpen = primaryFace?.EyesOpen?.Value ?? null;
    const sunglasses = primaryFace?.Sunglasses?.Value ?? null;
    const faceOccluded = primaryFace?.FaceOccluded?.Value ?? null;
    const pose = primaryFace?.Pose ?? null;

    let status = "verified";
    let note = "Single face detected.";

    if (faceCount === 0) {
      status = "no-face";
      note = "No face detected in the webcam frame.";
    } else if (faceCount > 1) {
      status = "multiple-faces";
      note = "Multiple faces detected in the webcam frame.";
    } else if (confidence !== null && confidence < 90) {
      status = "review";
      note = "Face detected, but confidence is too low for a reliable proctoring check.";
    } else if (faceOccluded) {
      status = "review";
      note = "Face appears occluded and needs manual review.";
    }

    response.json({
      provider: "aws-rekognition",
      status,
      note,
      faceCount,
      confidence,
      eyesOpen,
      sunglasses,
      faceOccluded,
      headPose: pose,
      providerResponse: result,
    });
  } catch (error) {
    response.status(502).json({
      status: "provider_error",
      message: error.message || "Unexpected AWS Rekognition error during face detection.",
    });
  }
});

app.listen(port, () => {
  console.log(`AWS Rekognition backend listening on http://localhost:${port}`);
});
