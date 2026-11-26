"""Sends each argument as a line to the echo server and prints the replies.

  python3 echo_client.py hello world
"""
import asyncio
import sys

HOST = "127.0.0.1"
PORT = 8765


async def connect(tries=6):
    """The server may still be starting: try a few times, half a second apart."""
    for _ in range(tries - 1):
        try:
            return await asyncio.open_connection(HOST, PORT)
        except ConnectionRefusedError:
            await asyncio.sleep(0.5)
    return await asyncio.open_connection(HOST, PORT)


async def main(messages):
    try:
        reader, writer = await connect()
    except ConnectionRefusedError:
        print(f"client: no server on {HOST}:{PORT}")
        return 1
    for text in messages:
        writer.write(text.encode() + b"\n")
        await writer.drain()
        reply = await reader.readline()
        print("client got:", reply.decode().strip())
    writer.close()
    await writer.wait_closed()
    return 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main(sys.argv[1:] or ["hello"])))
