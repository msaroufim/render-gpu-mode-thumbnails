#!/usr/bin/env python3
"""Claim speaker-intake thumbnail jobs through a Google Apps Script bridge."""

from __future__ import annotations

import argparse
import base64
import binascii
import json
import os
import re
import tempfile
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path
from typing import Any

import render_thumbnail as renderer


USER_AGENT = "gpu-mode-thumbnail-worker/1.0"
MIME_SUFFIXES = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
    "image/gif": ".gif",
}


class BridgeError(RuntimeError):
    """Raised when the Apps Script bridge returns an invalid response."""


class BridgeClient:
    def __init__(self, url: str, token: str, timeout: int = 90) -> None:
        if not url.startswith("https://"):
            raise ValueError("Bridge URL must use HTTPS")
        if not token:
            raise ValueError("Bridge token must not be empty")
        self.url = url
        self.token = token
        self.timeout = timeout

    def claim(self) -> dict[str, Any] | None:
        query = urllib.parse.urlencode({"action": "next", "token": self.token})
        separator = "&" if "?" in self.url else "?"
        response = self._request(f"{self.url}{separator}{query}")
        status = response.get("status")
        if status == "empty":
            return None
        if status == "job" and isinstance(response.get("job"), dict):
            return response["job"]
        raise BridgeError(response.get("error") or f"Unexpected claim response: {status!r}")

    def complete(
        self,
        job: dict[str, Any],
        thumbnail: bytes,
        filename: str,
    ) -> dict[str, Any]:
        return self._post(
            {
                "action": "complete",
                "token": self.token,
                "job_id": job["job_id"],
                "row_number": job["row_number"],
                "filename": filename,
                "thumbnail_base64": base64.b64encode(thumbnail).decode("ascii"),
            }
        )

    def fail(self, job: dict[str, Any], message: str) -> dict[str, Any]:
        return self._post(
            {
                "action": "fail",
                "token": self.token,
                "job_id": job.get("job_id"),
                "row_number": job.get("row_number"),
                "error": message[:1500],
            }
        )

    def _post(self, payload: dict[str, Any]) -> dict[str, Any]:
        body = json.dumps(payload, separators=(",", ":")).encode("utf-8")
        return self._request(
            self.url,
            data=body,
            headers={"Content-Type": "application/json"},
        )

    def _request(
        self,
        url: str,
        data: bytes | None = None,
        headers: dict[str, str] | None = None,
    ) -> dict[str, Any]:
        request_headers = {"Accept": "application/json", "User-Agent": USER_AGENT}
        request_headers.update(headers or {})
        request = urllib.request.Request(
            url,
            data=data,
            headers=request_headers,
            method="POST" if data is not None else "GET",
        )
        try:
            with urllib.request.urlopen(request, timeout=self.timeout) as response:
                raw = response.read()
        except urllib.error.HTTPError as exc:
            detail = exc.read().decode("utf-8", errors="replace")[:500]
            raise BridgeError(f"Bridge HTTP {exc.code}: {detail}") from exc
        except urllib.error.URLError as exc:
            raise BridgeError(f"Bridge request failed: {exc.reason}") from exc

        try:
            payload = json.loads(raw.decode("utf-8"))
        except (UnicodeDecodeError, json.JSONDecodeError) as exc:
            raise BridgeError("Bridge did not return valid JSON") from exc
        if not isinstance(payload, dict):
            raise BridgeError("Bridge response must be a JSON object")
        if payload.get("status") == "error":
            raise BridgeError(str(payload.get("error") or "Bridge returned an error"))
        return payload


def safe_suffix(filename: str, mime_type: str) -> str:
    suffix = Path(filename).suffix.lower()
    if suffix in {".jpg", ".jpeg", ".png", ".webp", ".gif"}:
        return suffix
    return MIME_SUFFIXES.get(mime_type.lower(), ".img")


def decode_photo(speaker: dict[str, Any], destination: Path, index: int) -> Path:
    encoded = speaker.get("photo_base64")
    if not isinstance(encoded, str) or not encoded:
        raise ValueError(f"Speaker {index} has no profile picture data")
    try:
        photo = base64.b64decode(encoded, validate=True)
    except (ValueError, binascii.Error) as exc:
        raise ValueError(f"Speaker {index} profile picture is not valid base64") from exc
    if not photo:
        raise ValueError(f"Speaker {index} profile picture is empty")
    suffix = safe_suffix(
        str(speaker.get("filename") or "profile-picture"),
        str(speaker.get("mime_type") or ""),
    )
    path = destination / f"speaker-{index}{suffix}"
    path.write_bytes(photo)
    return path


def slugify(value: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-")
    return slug[:80] or "gpu-mode-thumbnail"


def render_job(job: dict[str, Any], workdir: Path) -> tuple[bytes, str]:
    title = job.get("title")
    speakers = job.get("speakers")
    if not isinstance(title, str) or not title.strip():
        raise ValueError("Job has no talk title")
    if not isinstance(speakers, list) or not 1 <= len(speakers) <= 3:
        raise ValueError("Job must contain one to three speakers")

    render_speakers = []
    for index, speaker in enumerate(speakers, start=1):
        if not isinstance(speaker, dict):
            raise ValueError(f"Speaker {index} is not an object")
        name = speaker.get("name")
        if not isinstance(name, str) or not name.strip():
            raise ValueError(f"Speaker {index} has no name")
        photo_path = decode_photo(speaker, workdir, index)
        render_speakers.append({"name": name.strip(), "photo": str(photo_path)})

    payload = {
        "title": title.strip(),
        "subtitle": str(job.get("subtitle") or "").strip(),
        "speakers": render_speakers,
    }
    output = workdir / "thumbnail.png"
    font = renderer.resolve_font(None)
    renderer.render(payload, output, font)
    image = output.read_bytes()
    job_id = str(job.get("job_id") or "job")
    filename = f"{slugify(title)}-{slugify(job_id)[:12]}.png"
    return image, filename


def process_queue(client: BridgeClient, max_jobs: int) -> int:
    processed = 0
    while processed < max_jobs:
        job = client.claim()
        if job is None:
            break
        job_id = str(job.get("job_id") or "unknown")
        try:
            with tempfile.TemporaryDirectory(prefix="gpu-mode-thumbnail-") as temp_dir:
                thumbnail, filename = render_job(job, Path(temp_dir))
            result = client.complete(job, thumbnail, filename)
            if result.get("status") != "ok":
                raise BridgeError("Bridge did not confirm thumbnail completion")
        except Exception as exc:
            try:
                client.fail(job, f"{type(exc).__name__}: {exc}")
            except Exception as report_exc:
                raise BridgeError(
                    f"Job {job_id} failed and the failure could not be reported: {report_exc}"
                ) from exc
            raise
        processed += 1
        print(f"Completed thumbnail job {job_id}")
    if processed == 0:
        print("No queued thumbnail submissions")
    return processed


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--bridge-url",
        default=os.environ.get("GOOGLE_APPS_SCRIPT_URL"),
        help="Apps Script /exec deployment URL",
    )
    parser.add_argument(
        "--token",
        default=os.environ.get("GOOGLE_APPS_SCRIPT_TOKEN"),
        help="Shared bridge token",
    )
    parser.add_argument("--max-jobs", type=int, default=3)
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    if not args.bridge_url:
        raise SystemExit("error: set GOOGLE_APPS_SCRIPT_URL or pass --bridge-url")
    if not args.token:
        raise SystemExit("error: set GOOGLE_APPS_SCRIPT_TOKEN or pass --token")
    if not 1 <= args.max_jobs <= 20:
        raise SystemExit("error: --max-jobs must be between 1 and 20")
    client = BridgeClient(args.bridge_url, args.token)
    process_queue(client, args.max_jobs)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
