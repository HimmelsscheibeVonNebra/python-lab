"""Packs Flask and its dependencies into one zip for the 9p filesystem.

Over 9p every file the guest opens is a separate HTTP request, and
`import flask` opens about 200 files.  One zip is fetched in one request.

    python3 make-flask-zip.py <site-packages> <out.zip>

The packages (and their .dist-info, for importlib.metadata) are removed from
<site-packages>.  Modules are stored as .py plus a legacy .pyc next to it
(unchecked-hash, so zipimport uses it without comparing timestamps); the .py
keeps source lines in tracebacks.  C extensions cannot be imported from a
zip: markupsafe falls back to its pure-Python implementation.

The guest finds the zip through rootfs/overlay/.../_lab_flask.py.
"""

import compileall
import pathlib
import py_compile
import re
import shutil
import sys
import tempfile
import zipfile

# Top-level import names -> distribution names (normalized)
PACKAGES = ["flask", "werkzeug", "jinja2", "markupsafe", "click", "itsdangerous", "blinker", "dotenv"]
DISTS = ["flask", "werkzeug", "jinja2", "markupsafe", "click", "itsdangerous", "blinker", "python_dotenv"]
# Where the guest sees the zip (file names in tracebacks)
ZIP_IN_GUEST = "/opt/py/flask.zip"


def norm(name):
    return re.sub(r"[-_.]+", "_", name).lower()


def main():
    site = pathlib.Path(sys.argv[1])
    out = pathlib.Path(sys.argv[2])
    moved = []
    with tempfile.TemporaryDirectory() as tmp:
        tmp = pathlib.Path(tmp)
        for entry in sorted(site.iterdir()):
            name = entry.name
            dist = name.endswith(".dist-info") and norm(name.split("-")[0]) in DISTS
            if (entry.is_dir() and name in PACKAGES) or dist:
                shutil.move(str(entry), tmp / name)
                moved.append(name)
        missing = [p for p in PACKAGES if p not in moved]
        if "flask" in missing:
            sys.exit("make-flask-zip: no flask in " + str(site))
        for so in list(tmp.rglob("*.so")):
            so.unlink()
        for cache in list(tmp.rglob("__pycache__")):
            shutil.rmtree(cache)
        ok = compileall.compile_dir(
            tmp, quiet=1, legacy=True, ddir=ZIP_IN_GUEST, optimize=0,
            invalidation_mode=py_compile.PycInvalidationMode.UNCHECKED_HASH,
        )
        if not ok:
            sys.exit("make-flask-zip: compile failed")
        with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED, compresslevel=9) as z:
            for f in sorted(tmp.rglob("*")):
                if f.is_file():
                    z.write(f, f.relative_to(tmp).as_posix())
    print(f"flask.zip: {', '.join(moved)}  ({out.stat().st_size // 1024} KB)"
          + (f"  not installed: {', '.join(missing)}" if missing else ""))


main()
