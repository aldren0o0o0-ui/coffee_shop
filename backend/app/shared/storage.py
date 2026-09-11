import os
import uuid
from pathlib import Path

from fastapi import HTTPException, status

BASE_UPLOAD_DIR = Path("uploads/menu")
MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024  # 5MB

MAGIC_SIGNATURES = {
    "jpeg": (b"\xff\xd8\xff", 0),
    "png": (b"\x89PNG\r\n\x1a\n", 0),
}


def detect_image_type(content: bytes) -> str | None:
    """
    Inspects binary magic bytes rather than trusting filename extension or client header.
    """
    if len(content) < 12:
        return None

    # Check JPEG
    if content.startswith(b"\xff\xd8\xff"):
        return ".jpg"

    # Check PNG
    if content.startswith(b"\x89PNG\r\n\x1a\n"):
        return ".png"

    # Check WebP (RIFF....WEBP)
    if content.startswith(b"RIFF") and content[8:12] == b"WEBP":
        return ".webp"

    return None


def save_menu_item_image(
    menu_item_id: int,
    file_bytes: bytes,
    original_filename: str | None = None,
) -> tuple[str, int]:
    """
    Validates image size and content, saves to structured local directory,
    and returns web-accessible relative URL and byte size.
    """
    file_size = len(file_bytes)
    if file_size > MAX_FILE_SIZE_BYTES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Image exceeds maximum permitted file size of 5MB (size: {file_size / (1024 * 1024):.2f}MB).",
        )

    extension = detect_image_type(file_bytes)
    if not extension:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid image format. Only authentic JPG, PNG, and WebP files are accepted.",
        )

    item_upload_dir = BASE_UPLOAD_DIR / str(menu_item_id)
    item_upload_dir.mkdir(parents=True, exist_ok=True)

    unique_filename = f"{uuid.uuid4().hex}{extension}"
    target_path = item_upload_dir / unique_filename

    with open(target_path, "wb") as f:
        f.write(file_bytes)

    # Standardized URL served by FastAPI static mount
    relative_url = f"/uploads/menu/{menu_item_id}/{unique_filename}"
    return relative_url, file_size


def delete_file_by_url(image_url: str) -> None:
    """
    Safely deletes the local file associated with an image URL.
    """
    if not image_url or not image_url.startswith("/uploads/"):
        return

    # Strip leading slash and normalize
    clean_path = Path(image_url.lstrip("/"))
    try:
        if clean_path.exists() and clean_path.is_file():
            os.remove(clean_path)
    except OSError:
        pass
