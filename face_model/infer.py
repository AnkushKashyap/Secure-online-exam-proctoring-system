import argparse
from pathlib import Path

from ultralytics import YOLO


ROOT = Path(__file__).resolve().parent
DEFAULT_MODEL = ROOT / "artifacts" / "examguard-face-detector" / "weights" / "best.pt"


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--image", required=True, help="Path to image for inference")
    parser.add_argument("--model", default=str(DEFAULT_MODEL), help="Path to trained YOLO model")
    args = parser.parse_args()

    model = YOLO(args.model)
    results = model.predict(source=args.image, conf=0.25, save=True)

    for result in results:
        print(result.boxes)


if __name__ == "__main__":
    main()
