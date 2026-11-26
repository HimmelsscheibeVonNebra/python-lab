"""A tiny JSON API: a memo board kept in memory.

GET  /memos        -> 200, every memo
GET  /memos/<id>   -> 200, one memo (404 if there is none)
POST /memos        -> 201, add {"text": "..."} (400 if the body is wrong)
"""
import json
from http.server import BaseHTTPRequestHandler, HTTPServer

HOST = "127.0.0.1"
PORT = 8080

memos = [{"id": 1, "text": "buy milk"}]


class MemoHandler(BaseHTTPRequestHandler):
    def send_json(self, status, data):
        body = json.dumps(data, ensure_ascii=False).encode("utf-8")
        self.send_response(status)                       # status line
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()                               # empty line
        self.wfile.write(body)                           # body

    def do_GET(self):
        if self.path == "/memos":
            self.send_json(200, memos)
        elif self.path.startswith("/memos/"):
            memo_id = self.path.removeprefix("/memos/")
            for memo in memos:
                if str(memo["id"]) == memo_id:
                    self.send_json(200, memo)
                    return
            self.send_json(404, {"error": f"no memo {memo_id}"})
        else:
            self.send_json(404, {"error": "not found"})

    def do_POST(self):
        if self.path != "/memos":
            self.send_json(404, {"error": "not found"})
            return
        length = int(self.headers.get("Content-Length", 0))
        raw = self.rfile.read(length)                    # the request body
        try:
            text = json.loads(raw)["text"]
        except (json.JSONDecodeError, KeyError, TypeError):
            self.send_json(400, {"error": 'send JSON like {"text": "..."}'})
            return
        memo = {"id": len(memos) + 1, "text": text}
        memos.append(memo)
        self.send_json(201, memo)

    def log_request(self, code="-", size="-"):
        # one short line per request instead of the default access log
        print(f"[server] {self.command} {self.path} -> {code}")


print(f"[server] memo API on http://{HOST}:{PORT}")
HTTPServer((HOST, PORT), MemoHandler).serve_forever()
