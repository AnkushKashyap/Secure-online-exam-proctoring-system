# Face Detection Training Workspace

This folder contains a starter Python pipeline for training and serving a face detection model for the exam proctoring system.

## What this setup does

- downloads the Kaggle dataset with `kagglehub`
- copies the raw dataset into a local project folder
- prepares a YOLO-style training config
- trains a face detector using transfer learning
- runs local inference on images
- serves predictions through a FastAPI backend

## Folder layout

- `scripts/download_dataset.py`: downloads the dataset from Kaggle
- `scripts/prepare_dataset.py`: copies the dataset into `data/raw`
- `configs/train_config.yaml`: training configuration
- `train.py`: trains the model
- `infer.py`: runs inference on an image
- `api.py`: exposes the model through a local API
- `requirements.txt`: Python dependencies

## Install

```bash
cd face_model
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
```

## Download dataset

```bash
python scripts/download_dataset.py
python scripts/prepare_dataset.py
```

## Important note

This starter assumes the downloaded dataset either:

- already contains YOLO labels, or
- is close enough that we can adapt it with a small converter later

If the dataset format is different, we will update `prepare_dataset.py` after we inspect the files.

## Train

```bash
python train.py
```

## Run inference

```bash
python infer.py --image path\\to\\image.jpg
```

## Run API

```bash
uvicorn api:app --reload --port 9000
```

## Next step after dataset download

After you download the dataset, send me the folder structure or a file listing from `face_model/data/raw`, and I will adapt the preparation script exactly to that dataset.
