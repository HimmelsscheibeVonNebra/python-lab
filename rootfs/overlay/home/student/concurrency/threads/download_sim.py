"""Three pretend downloads, first one after another, then in three threads.

Each download only waits (time.sleep stands in for the network), so while
one thread waits the others can run: the waits overlap.
"""
import threading
import time

FILES = ["a.txt", "b.txt", "c.txt"]
WAIT = 1.0   # seconds each download waits for the "network"


def download(name):
    print(f"  start {name}")
    time.sleep(WAIT)             # waiting: this thread sleeps, the CPU is free
    print(f"  done  {name}")


def one_after_another():
    for name in FILES:
        download(name)


def in_threads():
    threads = [threading.Thread(target=download, args=(name,)) for name in FILES]
    for t in threads:
        t.start()                # starts running download(name) in the background
    for t in threads:
        t.join()                 # waits until that thread has finished


def timed(label, func):
    print(label)
    start = time.perf_counter()
    func()
    elapsed = time.perf_counter() - start
    print(f"{label}: about {round(elapsed)} s")


if __name__ == "__main__":
    timed("sequential", one_after_another)
    timed("threaded", in_threads)
