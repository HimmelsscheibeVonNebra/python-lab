"""Fetch URLs without crashing: each kind of failure gets its own message."""
import sys
from urllib.error import HTTPError, URLError
from urllib.request import urlopen


def fetch_text(url, timeout=3):
    """Returns the body as text, or None after printing what went wrong."""
    try:
        with urlopen(url, timeout=timeout) as response:
            return response.read().decode("utf-8")
    except HTTPError as error:          # the server answered with 4xx/5xx
        print(f"HTTP error {error.code} {error.reason}: {url}")
    except URLError as error:           # no answer: refused, unknown host, ...
        print(f"cannot reach {url}: {error.reason}")
    except TimeoutError:                # connected, but the reply never came
        print(f"timed out after {timeout} s: {url}")
    return None


for url in sys.argv[1:]:
    text = fetch_text(url)
    if text is not None:
        first_line = text.splitlines()[0] if text else ""
        print(f"OK {len(text)} characters: {first_line}")
