"""Four threads add to one shared balance.  Run: python3 counter_race.py [lock]

Without the lock, a thread can read the balance, get paused, and write back
an old value: other threads' deposits are lost.  With the lock, only one
thread at a time runs the read-and-write part.
"""
import sys
import threading
import time

THREADS = 4
DEPOSITS = 1000              # per thread

balance = 0
lock = threading.Lock()


def deposit(times, use_lock):
    global balance
    for _ in range(times):
        if use_lock:
            with lock:                   # acquire ... release, even on errors
                current = balance
                time.sleep(0)
                balance = current + 1
        else:
            current = balance            # 1. read
            time.sleep(0)                # 2. pause: another thread may run now
            balance = current + 1        # 3. write back (maybe a stale value)


def main():
    use_lock = sys.argv[1:] == ["lock"]
    threads = [threading.Thread(target=deposit, args=(DEPOSITS, use_lock))
               for _ in range(THREADS)]
    for t in threads:
        t.start()
    for t in threads:
        t.join()

    expected = THREADS * DEPOSITS
    print("with lock:" if use_lock else "without lock:", f"expected {expected}, got {balance}")
    if balance == expected:
        print("correct")
    else:
        print(f"lost updates: {expected - balance}")


if __name__ == "__main__":
    main()
