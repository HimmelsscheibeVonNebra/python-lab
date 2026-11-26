"""asyncio: many waits on one thread.

A coroutine (async def) pauses at each await and lets the event loop run
another coroutine until its wait is over.
"""
import asyncio
import time


async def brew(drink, seconds):
    print(f"  start {drink}")
    await asyncio.sleep(seconds)     # pause here; other coroutines run meanwhile
    print(f"  done  {drink}")
    return f"{drink} ({seconds} s)"


async def one_after_another():
    return [await brew("coffee", 1), await brew("tea", 1), await brew("cocoa", 1)]


async def together():
    return await asyncio.gather(brew("coffee", 1), brew("tea", 1), brew("cocoa", 1))


async def main():
    for label, func in (("one after another", one_after_another), ("gather", together)):
        print(label)
        start = time.perf_counter()
        results = await func()
        print(f"{label}: {results} in about {round(time.perf_counter() - start)} s")


if __name__ == "__main__":
    asyncio.run(main())              # start the event loop and run main() to the end
