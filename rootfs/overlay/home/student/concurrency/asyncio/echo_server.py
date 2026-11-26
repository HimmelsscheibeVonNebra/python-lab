"""An asyncio TCP echo server on 127.0.0.1.

  python3 echo_server.py          server + 3 clients in this one script
  python3 echo_server.py serve    only the server, on port 8765; it stops
                                  after 2 clients or 30 seconds

One thread, one event loop: while one client is quiet, the server answers
the others.
"""
import asyncio
import sys

HOST = "127.0.0.1"
PORT = 8765


async def handle(reader, writer):
    """Called once per connection; echoes each line back in capitals."""
    peer = writer.get_extra_info("peername")[1]
    print(f"server: client from port {peer} connected")
    while True:
        line = await reader.readline()        # b"" when the client hangs up
        if not line:
            break
        writer.write(line.upper())
        await writer.drain()
    print(f"server: client from port {peer} left")
    writer.close()
    await writer.wait_closed()


async def client(name, messages, port):
    reader, writer = await asyncio.open_connection(HOST, port)
    replies = []
    for text in messages:
        writer.write(f"{name}: {text}\n".encode())
        await writer.drain()
        replies.append((await reader.readline()).decode().strip())
        await asyncio.sleep(0.5)              # a slow client; others go on
    writer.close()
    await writer.wait_closed()
    return replies


async def demo():
    server = await asyncio.start_server(handle, HOST, 0)   # port 0: any free port
    port = server.sockets[0].getsockname()[1]
    async with server:
        results = await asyncio.gather(
            client("mina", ["hi", "bye"], port),
            client("jun", ["hello", "see you"], port),
            client("sora", ["hey", "later"], port),
        )
    for replies in results:
        print("client got:", replies)


async def serve(clients=2, seconds=30):
    done = asyncio.Event()
    count = 0

    async def handle_and_count(reader, writer):
        nonlocal count
        await handle(reader, writer)
        count += 1
        if count == clients:
            done.set()

    server = await asyncio.start_server(handle_and_count, HOST, PORT)
    print(f"server: listening on {HOST}:{PORT}")
    async with server:
        try:
            await asyncio.wait_for(done.wait(), seconds)
        except TimeoutError:
            print("server: time is up")
    print(f"server: served {count} clients, bye")


if __name__ == "__main__":
    asyncio.run(serve() if sys.argv[1:] == ["serve"] else demo())
