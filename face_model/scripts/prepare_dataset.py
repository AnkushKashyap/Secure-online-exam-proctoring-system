from pathlib import Path
import shutil


ROOT = Path(__file__).resolve().parents[1]
DOWNLOADS_DIR = ROOT / "data" / "downloads"
RAW_DIR = ROOT / "data" / "raw"
PREPARED_DIR = ROOT / "data" / "prepared"


def find_latest_download():
    folders = [path for path in DOWNLOADS_DIR.iterdir() if path.is_dir()]
    if not folders:
        raise FileNotFoundError("No downloaded dataset found. Run scripts/download_dataset.py first.")

    folders.sort(key=lambda item: item.stat().st_mtime, reverse=True)
    return folders[0]


def main():
    source = find_latest_download()

    if RAW_DIR.exists():
        shutil.rmtree(RAW_DIR)

    shutil.copytree(source, RAW_DIR)
    print(f"Raw dataset ready at: {RAW_DIR}")

    if PREPARED_DIR.exists():
        shutil.rmtree(PREPARED_DIR)

    shutil.copytree(RAW_DIR, PREPARED_DIR)

    data_yaml = PREPARED_DIR / "data.yaml"
    data_yaml.write_text(
        "\n".join(
            [
                f"path: {PREPARED_DIR.as_posix()}",
                "train: images/train",
                "val: images/val",
                "",
                "names:",
                "  0: face",
                "",
            ]
        ),
        encoding="utf-8",
    )

    print(f"Prepared dataset ready at: {PREPARED_DIR}")
    print(f"YOLO data config created at: {data_yaml}")


if __name__ == "__main__":
    main()
