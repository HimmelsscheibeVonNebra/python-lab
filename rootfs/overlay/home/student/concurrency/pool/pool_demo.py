"""concurrent.futures.ThreadPoolExecutor: a pool of worker threads.

fetch() pretends to download a page: it waits, then returns a file name.
"""
import time
from concurrent.futures import ThreadPoolExecutor, as_completed

PAGES = {"home": 1.5, "news": 0.5, "about": 1.0}   # page -> seconds to wait


def fetch(page):
    time.sleep(PAGES[page])
    return f"{page}.html"


def with_map():
    print("map: results in the order of the inputs")
    with ThreadPoolExecutor(max_workers=3) as pool:
        for result in pool.map(fetch, PAGES):
            print("  got", result)


def with_as_completed():
    print("submit + as_completed: results in the order they finish")
    with ThreadPoolExecutor(max_workers=3) as pool:
        futures = [pool.submit(fetch, page) for page in PAGES]
        for future in as_completed(futures):
            print("  got", future.result())


if __name__ == "__main__":
    start = time.perf_counter()
    with_map()
    with_as_completed()
    print(f"total: about {round(time.perf_counter() - start)} s (one by one: 6 s)")
