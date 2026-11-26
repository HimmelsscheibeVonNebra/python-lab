"""A server that never answers: it listens but never accepts.

The operating system still completes the TCP handshake, so clients
connect fine -- and then wait for a reply that never comes.
"""
import socket
import time

with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as server:
    server.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    server.bind(("127.0.0.1", 8001))
    server.listen()
    print("[silent] listening on 127.0.0.1:8001, will never reply")
    time.sleep(60)          # then exit on its own
