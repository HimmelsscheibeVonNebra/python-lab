"""Speak HTTP by hand: a GET request over a plain TCP socket."""
import socket
import sys

HOST = "127.0.0.1"
PORT = 8000

path = sys.argv[1] if len(sys.argv) > 1 else "/hello.txt"

# An HTTP request is just text: a request line, headers, an empty line.
request = f"GET {path} HTTP/1.0\r\nHost: {HOST}:{PORT}\r\n\r\n"
print("request:", repr(request))

with socket.create_connection((HOST, PORT)) as sock:
    sock.sendall(request.encode("ascii"))
    chunks = []
    while True:                     # read until the server closes the connection
        chunk = sock.recv(4096)
        if not chunk:
            break
        chunks.append(chunk)

response = b"".join(chunks)
head, _, body = response.partition(b"\r\n\r\n")   # headers end at an empty line
lines = head.decode("iso-8859-1").split("\r\n")

print("status line:", lines[0])
for line in lines[1:]:
    name, _, value = line.partition(": ")
    print(f"  header {name} = {value}")
print(f"body ({len(body)} bytes):")
print(body.decode("utf-8"))
