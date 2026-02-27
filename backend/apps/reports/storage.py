"""
MinIO client helpers and presigned URL generation.
"""
from django.conf import settings


def get_minio_client():
    from minio import Minio  # type: ignore

    return Minio(
        settings.MINIO_ENDPOINT,
        access_key=settings.MINIO_ACCESS_KEY,
        secret_key=settings.MINIO_SECRET_KEY,
        secure=settings.MINIO_USE_HTTPS,
    )


def ensure_bucket():
    client = get_minio_client()
    bucket = settings.MINIO_BUCKET_NAME
    if not client.bucket_exists(bucket):
        client.make_bucket(bucket)
    return bucket


def get_presigned_download_url(object_key: str, expiry_hours: int = 1) -> str:
    from datetime import timedelta
    client = get_minio_client()
    # Use external endpoint for browser-accessible URLs
    from minio import Minio  # type: ignore
    external_client = Minio(
        settings.MINIO_EXTERNAL_ENDPOINT.replace("http://", "").replace("https://", ""),
        access_key=settings.MINIO_ACCESS_KEY,
        secret_key=settings.MINIO_SECRET_KEY,
        secure=settings.MINIO_EXTERNAL_ENDPOINT.startswith("https"),
    )
    return external_client.presigned_get_object(
        settings.MINIO_BUCKET_NAME,
        object_key,
        expires=timedelta(hours=expiry_hours),
    )


def upload_bytes(object_key: str, data: bytes, content_type: str = "application/octet-stream") -> str:
    import io
    client = get_minio_client()
    bucket = ensure_bucket()
    client.put_object(
        bucket,
        object_key,
        io.BytesIO(data),
        length=len(data),
        content_type=content_type,
    )
    return object_key
