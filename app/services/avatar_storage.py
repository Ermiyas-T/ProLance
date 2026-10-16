"""Cloudinary operations for profile avatar assets."""

from io import BytesIO
from uuid import uuid4

import cloudinary
from cloudinary import uploader

from app.core.config import settings


class AvatarStorageNotConfiguredError(RuntimeError):
    """Raised when the backend has no complete Cloudinary credentials."""


class AvatarStorageError(RuntimeError):
    """Raised when Cloudinary cannot complete an avatar operation."""


def _configure_cloudinary() -> None:
    # Validate credentials at request time so unrelated API features can start without Cloudinary.
    cloud_name = settings.CLOUDINARY_CLOUD_NAME
    api_key = settings.CLOUDINARY_API_KEY
    api_secret = settings.CLOUDINARY_API_SECRET
    if (
        not cloud_name
        or not cloud_name.strip()
        or not api_key
        or not api_key.strip()
        or not api_secret
        or not api_secret.strip()
    ):
        raise AvatarStorageNotConfiguredError("Cloudinary avatar storage is not configured")

    # Configure the SDK only from backend settings; these values are never returned to clients.
    cloudinary.config(
        cloud_name=cloud_name.strip(),
        api_key=api_key.strip(),
        api_secret=api_secret.strip(),
        secure=True,
    )


def upload_avatar_asset(image_data: bytes) -> tuple[str, str]:
    # Give each upload a new server-generated ID so replacement is safe to roll back.
    _configure_cloudinary()
    try:
        result = uploader.upload(
            BytesIO(image_data),
            folder="prolance/avatars",
            public_id=f"avatar-{uuid4().hex}",
            overwrite=False,
            resource_type="image",
        )
    except Exception as exc:
        raise AvatarStorageError("Cloudinary could not store the profile image") from exc

    secure_url = result.get("secure_url")
    public_id = result.get("public_id")
    if not isinstance(secure_url, str) or not isinstance(public_id, str):
        raise AvatarStorageError("Cloudinary returned incomplete avatar metadata")
    return secure_url, public_id


def delete_avatar_asset(public_id: str) -> None:
    # Delete only by the private provider ID saved with the owning profile.
    _configure_cloudinary()
    try:
        result = uploader.destroy(public_id, invalidate=True, resource_type="image")
    except Exception as exc:
        raise AvatarStorageError("Cloudinary could not delete the profile image") from exc

    if result.get("result") not in {"ok", "not found"}:
        raise AvatarStorageError("Cloudinary did not confirm profile image deletion")