from pathlib import Path

import yaml
from ultralytics import YOLO


ROOT = Path(__file__).resolve().parent
CONFIG_PATH = ROOT / "configs" / "train_config.yaml"


def load_config():
    with CONFIG_PATH.open("r", encoding="utf-8") as file:
        return yaml.safe_load(file)


def main():
    config = load_config()
    prepared_data_dir = ROOT / config["prepared_data_dir"]
    data_yaml = prepared_data_dir / "data.yaml"

    if not data_yaml.exists():
        raise FileNotFoundError(
            f"{data_yaml} not found. Prepare the dataset first and create the YOLO data file."
        )

    model = YOLO(config["base_model"])
    results = model.train(
        data=str(data_yaml),
        epochs=config["epochs"],
        imgsz=config["imgsz"],
        batch=config["batch"],
        device=config["device"],
        project=str(ROOT / config["model_output_dir"]),
        name=config["project_name"],
    )
    print(results)


if __name__ == "__main__":
    main()
