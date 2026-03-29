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
    """
    Create the bucket if it doesn't exist and always ensure it has an anonymous
    read policy so that direct download URLs (MINIO_EXTERNAL_ENDPOINT/bucket/key)
    work without presigning, avoiding host-mismatch 403s inside Docker.
    This is idempotent: safe to call on every upload.
    """
    import json

    client = get_minio_client()
    bucket = settings.MINIO_BUCKET_NAME
    if not client.bucket_exists(bucket):
        client.make_bucket(bucket)
    # Allow public anonymous GET on all objects in the bucket.
    # Equivalent to: mc anonymous set download <alias>/<bucket>
    anonymous_read_policy = json.dumps({
        "Version": "2012-10-17",
        "Statement": [{
            "Effect": "Allow",
            "Principal": {"AWS": "*"},
            "Action": ["s3:GetObject"],
            "Resource": [f"arn:aws:s3:::{bucket}/*"],
        }],
    })
    client.set_bucket_policy(bucket, anonymous_read_policy)
    return bucket


def get_presigned_download_url(object_key: str, expiry_hours: int = 24) -> str:
    """
    Return a public URL for the object.

    The bucket is configured with anonymous read access (mc anonymous set download),
    so a direct URL is sufficient and avoids host-mismatch 403 errors that occur
    when presigned URLs are generated inside Docker with an internal hostname.
    """
    external_base = settings.MINIO_EXTERNAL_ENDPOINT.rstrip("/")
    return f"{external_base}/{settings.MINIO_BUCKET_NAME}/{object_key}"


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
