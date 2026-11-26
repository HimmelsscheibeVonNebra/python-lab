"""HTTP client with urllib.request: the standard library does the protocol."""
import json
import sys
from urllib.request import urlopen

url = sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:8000/hello.txt"

with urlopen(url, timeout=5) as response:
    print("status:", response.status, response.reason)
    content_type = response.headers.get("Content-Type")
    print("type:", content_type)
    body = response.read()                 # bytes

print("length:", len(body), "bytes")
if content_type == "application/json":
    data = json.loads(body)                # JSON text -> dict
    for key, value in data.items():
        print(f"  {key}: {value}")
else:
    print(body.decode("utf-8"), end="")
