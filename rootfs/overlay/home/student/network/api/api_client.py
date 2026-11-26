"""Client for api_server.py: sends JSON, reads JSON back."""
import json
import sys
from urllib.error import HTTPError
from urllib.request import Request, urlopen

BASE = "http://127.0.0.1:8080"


def call(method, path, data=None):
    """Sends one request; returns (status code, decoded JSON)."""
    body = None
    headers = {}
    if data is not None:
        body = json.dumps(data).encode("utf-8")
        headers["Content-Type"] = "application/json"
    request = Request(BASE + path, data=body, headers=headers, method=method)
    try:
        with urlopen(request, timeout=5) as response:
            return response.status, json.loads(response.read())
    except HTTPError as error:              # 4xx/5xx: the body still has JSON
        return error.code, json.loads(error.read())


if __name__ == "__main__":
    if len(sys.argv) > 1:
        text = " ".join(sys.argv[1:])
        print("POST /memos", call("POST", "/memos", {"text": text}))
    print("GET  /memos", call("GET", "/memos"))
