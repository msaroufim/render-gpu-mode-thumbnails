from __future__ import annotations

import base64
import io
import json
import sys
import threading
import unittest
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

from PIL import Image


REPO_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(REPO_ROOT / "scripts"))

import process_intake_job as worker  # noqa: E402


def portrait_base64(color: tuple[int, int, int]) -> str:
    image = Image.new("RGB", (512, 512), color)
    buffer = io.BytesIO()
    image.save(buffer, "PNG")
    return base64.b64encode(buffer.getvalue()).decode("ascii")


class BridgeHandler(BaseHTTPRequestHandler):
    job = {
        "job_id": "job-123",
        "row_number": 2,
        "title": "Automated Thumbnail Test",
        "abstract": "A test submission.",
        "subtitle": "gpu-mode.test",
        "speakers": [
            {
                "name": "Ada Speaker",
                "filename": "ada.png",
                "mime_type": "image/png",
                "photo_base64": portrait_base64((28, 90, 140)),
            },
            {
                "name": "Ben Speaker",
                "filename": "ben.png",
                "mime_type": "image/png",
                "photo_base64": portrait_base64((170, 90, 45)),
            },
        ],
    }
    completion = None

    def do_GET(self) -> None:
        payload = {"status": "job", "job": self.job}
        self._send(payload)

    def do_POST(self) -> None:
        length = int(self.headers["Content-Length"])
        type(self).completion = json.loads(self.rfile.read(length))
        self._send({"status": "ok", "thumbnail_url": "https://drive.google.test/file"})

    def log_message(self, format: str, *args: object) -> None:
        return

    def _send(self, payload: dict[str, object]) -> None:
        body = json.dumps(payload).encode("utf-8")
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)


class SpeakerIntakeWorkerTest(unittest.TestCase):
    def test_processes_job_and_posts_exact_thumbnail(self) -> None:
        BridgeHandler.completion = None
        server = ThreadingHTTPServer(("127.0.0.1", 0), BridgeHandler)
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        try:
            url = f"http://127.0.0.1:{server.server_port}/bridge"
            client = worker.BridgeClient.__new__(worker.BridgeClient)
            client.url = url
            client.token = "test-token"
            client.timeout = 10
            processed = worker.process_queue(client, max_jobs=1)
        finally:
            server.shutdown()
            server.server_close()
            thread.join(timeout=5)

        self.assertEqual(processed, 1)
        completion = BridgeHandler.completion
        self.assertIsNotNone(completion)
        self.assertEqual(completion["action"], "complete")
        self.assertEqual(completion["job_id"], "job-123")
        image_bytes = base64.b64decode(completion["thumbnail_base64"])
        with Image.open(io.BytesIO(image_bytes)) as image:
            self.assertEqual(image.size, (1280, 720))
            self.assertEqual(image.format, "PNG")


if __name__ == "__main__":
    unittest.main()
