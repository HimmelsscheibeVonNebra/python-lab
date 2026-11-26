"""Read a port number from a settings file.

Low-level errors (missing file, not a number) are turned into one ConfigError
with raise ... from, so the caller has only one exception to catch.

    python3 config.py port.txt bad_port.txt
"""
import sys


class ConfigError(Exception):
    """The settings file cannot be used."""


def read_port(path):
    try:
        with open(path, encoding="utf-8") as f:
            text = f.read().strip()
        port = int(text)
    except FileNotFoundError as e:
        raise ConfigError(f"{path}: file not found") from e
    except ValueError as e:
        raise ConfigError(f"{path}: port must be a number, got {text!r}") from e
    if not 1 <= port <= 65535:
        raise ConfigError(f"{path}: port {port} is outside 1-65535")
    return port


if __name__ == "__main__":
    for path in sys.argv[1:]:
        try:
            print(f"{path}: port {read_port(path)}")
        except ConfigError as e:
            print(f"config error: {e}")
            print(f"    caused by: {e.__cause__!r}")
