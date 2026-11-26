"""UDP receiver: no connection, just datagrams arriving at a port."""
import socket

HOST = "127.0.0.1"
PORT = 5005
COUNT = 3

with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as sock:
    sock.bind((HOST, PORT))
    sock.settimeout(30)                       # give up if nothing arrives
    print(f"[receiver] waiting for {COUNT} datagrams on {HOST}:{PORT}")
    for number in range(1, COUNT + 1):
        data, addr = sock.recvfrom(1024)      # one whole datagram + sender
        print(f"[receiver] #{number} from {addr[0]}: {data.decode('utf-8')}")
print("[receiver] done")
