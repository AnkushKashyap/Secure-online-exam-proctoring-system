from pathlib import Path
import shutil

import kagglehub


DATASET_ID = "fareselmenshawii/face-detection-dataset"
TARGET_DIR = Path(__file__).resolve().parents[1] / "data" / "downloads"


def main():
    TARGET_DIR.mkdir(parents=True, exist_ok=True)
    downloaded_path = Path(kagglehub.dataset_download(DATASET_ID))
    destination = TARGET_DIR / downloaded_path.name

    if destination.exists():
        shutil.rmtree(destination)

    shutil.copytree(downloaded_path, destination)
    print(f"Dataset copied to: {destination}")


if __name__ == "__main__":
    main()
