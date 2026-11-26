"""TCP echo client: sends one message and prints the reply."""
import socket
import sys

HOST = "127.0.0.1"
PORT = 5000

message = " ".join(sys.argv[1:]) or "hello"

with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as client:
    client.connect((HOST, PORT))              # ConnectionRefusedError if no server
    data = message.encode("utf-8")            # str -> bytes
    client.sendall(data)
    reply = client.recv(1024)

print(f"[client] sent {len(data)} bytes, got back: {reply.decode('utf-8')}")
