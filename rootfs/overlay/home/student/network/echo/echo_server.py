"""TCP echo server: sends every message straight back to the client."""
import socket

HOST = "127.0.0.1"   # loopback: only programs on this computer can connect
PORT = 5000          # the "door number" clients knock on

with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as server:
    # allow restarting the server right away on the same port
    server.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    server.bind((HOST, PORT))
    server.listen()
    print(f"[server] listening on {HOST}:{PORT}")

    while True:
        conn, addr = server.accept()          # waits for the next client
        with conn:
            print(f"[server] connection from {addr[0]}")
            data = conn.recv(1024)            # bytes, at most 1024 of them
            print(f"[server] received {len(data)} bytes: {data!r}")
            conn.sendall(data)                # echo the same bytes back
