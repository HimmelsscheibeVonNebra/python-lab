"""UDP sender: each command-line word becomes one datagram."""
import socket
import sys

HOST = "127.0.0.1"
PORT = 5005

with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as sock:
    for word in sys.argv[1:]:
        sent = sock.sendto(word.encode("utf-8"), (HOST, PORT))
        print(f"[sender] sent {sent} bytes: {word}")
