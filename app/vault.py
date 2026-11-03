"""Quarantine vault on Vultr Object Storage (S3-compatible).

After every case, Caveo seals the evidence into a private bucket: the original attachment (renamed .quarantine for
anything flagged, so nothing can open it by double-click), the sandbox screenshots, and the evidence pack.
The local server keeps nothing it does not need; auditors get time-limited signed links.
"""
import json, os

HOST = os.environ.get("VAULT_HOST", "")
BUCKET = os.environ.get("VAULT_BUCKET", "caveo-vault")
_client = None


def enabled():
    return bool(HOST and os.environ.get("VAULT_ACCESS_KEY") and os.environ.get("VAULT_SECRET_KEY"))


def client():
    global _client
    if _client is None:
        import boto3
        _client = boto3.client("s3", endpoint_url=f"https://{HOST}", aws_access_key_id=os.environ["VAULT_ACCESS_KEY"],
                               aws_secret_access_key=os.environ["VAULT_SECRET_KEY"], region_name="us-east-1")
        try:
            _client.head_bucket(Bucket=BUCKET)
        except Exception:
            _client.create_bucket(Bucket=BUCKET)
    return _client


def put(key, data, content_type="application/octet-stream"):
    client().put_object(Bucket=BUCKET, Key=key, Body=data, ContentType=content_type, ACL="private")
    return key


def put_json(key, obj):
    return put(key, json.dumps(obj, indent=2, default=str).encode(), "application/json")


def signed(key, seconds=3600):
    return client().generate_presigned_url("get_object", Params={"Bucket": BUCKET, "Key": key}, ExpiresIn=seconds)
