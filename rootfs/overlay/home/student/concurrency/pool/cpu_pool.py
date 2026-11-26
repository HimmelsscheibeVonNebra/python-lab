"""CPU work: one by one, in a thread pool, and in a process pool.

count_primes() only computes, it never waits.  Threads share one interpreter
(and, in the usual build, one GIL), so they cannot compute in parallel.
Processes can -- but only if the machine has more than one CPU core.
"""
import os
import time
from concurrent.futures import ProcessPoolExecutor, ThreadPoolExecutor

CHUNKS = [(2, 4000), (4000, 8000), (8000, 12000), (12000, 16000)]


def count_primes(bounds):
    low, high = bounds
    count = 0
    for n in range(low, high):
        if all(n % d for d in range(2, int(n ** 0.5) + 1)):
            count += 1
    return count


def measure(label, run):
    start = time.perf_counter()
    total = sum(run())
    elapsed = time.perf_counter() - start
    print(f"{label:<10} {total} primes  {elapsed:.1f} s")
    return elapsed


def main():
    print("CPU cores:", os.cpu_count())
    count_primes(CHUNKS[0])          # warm-up: the first run of any code is slower
    base = measure("one by one", lambda: map(count_primes, CHUNKS))
    with ThreadPoolExecutor(max_workers=4) as pool:
        threads = measure("threads", lambda: pool.map(count_primes, CHUNKS))
    with ProcessPoolExecutor(max_workers=4) as pool:
        processes = measure("processes", lambda: pool.map(count_primes, CHUNKS))
    for label, seconds in (("threads", threads), ("processes", processes)):
        if seconds < 0.6 * base:
            verdict = "faster than"
        elif seconds > 1.5 * base:
            verdict = "slower than"
        else:
            verdict = "about the same as"
        print(f"{label}: {verdict} one by one")


if __name__ == "__main__":   # required: worker processes import this file
    main()
