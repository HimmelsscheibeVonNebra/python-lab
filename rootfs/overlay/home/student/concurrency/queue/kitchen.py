"""Producer/consumer: one waiter takes orders, two cooks cook them.

The waiter (producer) puts orders into a queue.Queue; each cook (consumer)
takes the next order out.  queue.Queue does its own locking, so the threads
never touch a shared list directly.  None is the "no more orders" signal.
"""
import queue
import threading
import time

ORDERS = ["ramen", "bibimbap", "tteokbokki", "kimbap", "mandu", "japchae"]
COOKS = 2
COOK_TIME = 0.5              # seconds per dish

orders = queue.Queue(maxsize=3)   # the counter holds at most 3 tickets
served = queue.Queue()


def waiter():
    for dish in ORDERS:
        orders.put(dish)              # blocks while the counter is full
        print(f"waiter: order {dish}")
    for _ in range(COOKS):
        orders.put(None)              # one stop signal per cook


def cook(name):
    while True:
        dish = orders.get()           # blocks until there is an order
        if dish is None:
            break
        time.sleep(COOK_TIME)
        print(f"{name}: {dish} ready")
        served.put((dish, name))


def main():
    start = time.perf_counter()
    threads = [threading.Thread(target=waiter)]
    threads += [threading.Thread(target=cook, args=(f"cook{i}",)) for i in range(1, COOKS + 1)]
    for t in threads:
        t.start()
    for t in threads:
        t.join()
    elapsed = time.perf_counter() - start

    dishes = sorted(served.get()[0] for _ in range(served.qsize()))
    print(f"served {len(dishes)} dishes:", ", ".join(dishes))
    alone = len(ORDERS) * COOK_TIME
    print(f"{COOKS} cooks: about {round(elapsed * 2) / 2} s (one cook would need {alone} s)")


if __name__ == "__main__":
    main()
