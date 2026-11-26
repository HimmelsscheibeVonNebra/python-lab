// Headless end-to-end test of the Python Lab image.
//
//   node tests/python-test.mjs          (VERBOSE=1 shows the guest console)
//
// Boots the same kernel + initramfs as index.html and checks that a student
// can run Python: REPL-less scripts, the bundled examples, the standard
// library modules the course uses, and file exchange with the page.

import { bootGuest } from "./guest.mjs";

let failures = 0;
function check(name, ok, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}`);
  if (!ok) {
    failures++;
    if (detail) console.log(detail.trim().split("\n").map((l) => "      " + l).join("\n"));
  }
}

let guest;
try {
  guest = await bootGuest();
  const { sh } = guest;
  console.log(`booted to shell in ${guest.bootSeconds.toFixed(1)}s`);

  let r = await sh("id -un; pwd; uname -m");
  check("student shell in /home/student on i686",
    /^student$/m.test(r.out) && /^\/home\/student$/m.test(r.out) && /^i686$/m.test(r.out), r.out);

  r = await sh("python3 -V; python -V");
  check("python3 and python on PATH", (r.out.match(/^Python 3\.\d+\.\d+$/gm) || []).length === 2, r.out);

  r = await sh("command -v gcc cc || echo no-compiler");
  check("no C compiler in the image", r.out.includes("no-compiler"), r.out);

  let t = Date.now();
  r = await sh(`python3 -c 'print(sum(range(101)))'`);
  check(`python3 -c runs (${((Date.now() - t) / 1000).toFixed(1)}s)`, /^5050$/m.test(r.out), r.out);

  r = await sh(`echo 테스트 | python3 hello.py`);
  check("hello.py: Korean output and input()", r.status === 0 && r.out.includes("반갑습니다, 테스트님!")
    && r.out.includes("1부터 10까지의 합: 55"), r.out);

  r = await sh("python3 grades.py && cat grades.csv");
  check("grades.py writes grades.csv", r.status === 0 && r.out.includes("지영,94.3,A"), r.out);

  const mods = ["math", "random", "csv", "json", "sqlite3", "datetime", "pathlib", "tempfile",
    "unittest", "argparse", "statistics", "decimal", "fractions", "collections", "itertools",
    "re", "zlib", "hashlib", "readline", "curses"];
  r = await sh(`python3 -c 'import ${mods.join(", ")}; print("imports-ok")'`, 60_000);
  check("standard library modules import", r.out.includes("imports-ok"), r.out);

  r = await sh(`python3 -c 'import sqlite3; c = sqlite3.connect(":memory:"); c.execute("create table t(x)"); c.executemany("insert into t values (?)", [(i,) for i in range(5)]); print("rows", c.execute("select count(*), sum(x) from t").fetchone())'`);
  check("sqlite3 in-memory database", r.out.includes("rows (5, 10)"), r.out);

  r = await sh(`python3 -c 'import datetime; print(datetime.datetime.now().year)'`);
  check("clock: guest has real wall-clock time", parseInt(r.out.trim().split("\n").pop(), 10) >= 2026, r.out);

  r = await sh(`printf 'x = 6 * 7\\nprint("answer", x)\\n' > mine.py && python3 mine.py`);
  check("student can write and run a new script", r.out.includes("answer 42"), r.out);

  r = await sh(`python3 -c 'print(1/0)'`);
  check("tracebacks reach the terminal", r.status === 1 && r.out.includes("ZeroDivisionError"), r.out);

  // pandas / matplotlib over 9p (numpy on the reference BLAS: no SSSE3)
  r = await sh(`python3 -c 'import numpy as np, pandas as pd; df = pd.DataFrame({"x": [1, 2, 3]}); print("pandas", df.x.sum(), np.linalg.inv(np.eye(2) * 2)[0][0])'`, 240_000);
  check("pandas and numpy.linalg (9p, fetched on import)", r.out.includes("pandas 6 0.5"), r.out);
  r = await sh(`cd /tmp && python3 -c 'import matplotlib.pyplot as plt; plt.plot([1, 3, 2]); plt.title("chart"); plt.savefig("chart.png")' && head -c 4 chart.png | od -c | head -1; cd`, 240_000);
  check("matplotlib saves a PNG", r.status === 0 && r.out.includes("P   N   G"), r.out);

  r = await sh(`cd ~/web/sample2 && python3 -c 'from app import app; r = app.test_client().get("/?market=KOSPI"); print("flask", r.status_code, "+0.33%" in r.get_data(as_text=True))'; cd`, 240_000);
  check("Flask app answers through test_client()", r.out.includes("flask 200 True"), r.out);
  // App preview bridge: the page writes /host/.web/req-*.json, "web start"'s
  // bridge answers in res-*.json (js/lab.js does the same in the browser).
  r = await sh("cd ~/web/flask_hello && web start app.py; cd", 240_000);
  {
    const readJson = async (f) => { try { return JSON.parse(new TextDecoder().decode(await guest.readFile(f))); } catch { return null; } };
    // Like the page: wait for the bridge to announce the app first.
    let server = null;
    for (let i = 0; i < 100 && !server; i++) {
      await new Promise((ok) => setTimeout(ok, 200));
      server = await readJson("/host/.web/server.json");
    }
    await guest.createFile("/host/.web/req-t1.json", new TextEncoder().encode(JSON.stringify({ method: "GET", path: "/hello?name=Bridge" })));
    let res = null;
    for (let i = 0; i < 200 && !res; i++) {
      await new Promise((ok) => setTimeout(ok, 150));
      res = await readJson("/host/.web/res-t1.json");
    }
    check("app preview bridge answers the page's request",
      server && server.port === 5000 && res && res.status === 200 && res.body.includes("Hello, Bridge!"), r.out + JSON.stringify(res));
  }
  r = await sh("web stop; test ! -e /mnt/host/.web/server.json && echo bridge-cleared");
  check("web stop clears the preview state", r.out.includes("bridge-cleared"), r.out);

  r = await sh("python3 -m http.server 8765 >/dev/null 2>&1 & sleep 4; wget -qO- http://127.0.0.1:8765/ | grep -c href; kill %1");
  check("loopback networking (127.0.0.1)", /^[1-9]\d*$/m.test(r.out), r.out);

  r = await sh("ls ~/basics/starter ~/database/examples/sqlite_lab");
  check("course code in /home/student (topic folders)", r.out.includes("bmi.py") && r.out.includes("create_db.py"), r.out);

  // Interactive REPL (the new PyREPL, driven as the page's xterm.js would)
  {
    const from = guest.serialLength();
    guest.send("python3\n");
    await guest.waitFor(">>> ", 30_000, from);
    let at = guest.serialLength();
    guest.send('word = "파이썬"; print(word * 2, len(word))\n');
    await guest.waitFor("파이썬파이썬 3", 30_000, at);
    guest.send("exit()\n");
    await guest.waitFor("$ ", 30_000, guest.serialLength());
    const out = guest.output(from);
    check("REPL: >>> prompt, Korean input, exit()", out.includes("파이썬파이썬 3"), out);
  }

  // Page -> guest ("파일 올리기")
  await guest.createFile("/host/uploaded.py", new TextEncoder().encode('print("uploaded", 2 ** 10)\n'));
  r = await sh("python3 /mnt/host/uploaded.py");
  check("upload: file from the page runs from /mnt/host", r.out.includes("uploaded 1024"), r.out);

  // Guest -> page ("받기")
  r = await sh("cp grades.csv /mnt/host/ && sync");
  const back = new TextDecoder().decode(await guest.readFile("/host/grades.csv"));
  check("download: student file copied to /mnt/host is readable by the page",
    r.status === 0 && back.includes("현우,79.0,C"), back || r.out);
} catch (err) {
  failures++;
  console.error("ERROR", err.message);
  if (err.tail) console.error("--- serial tail ---\n" + err.tail);
}

console.log(failures ? `\n${failures} check(s) failed` : "\nall checks passed");
if (guest) await guest.destroy();
process.exit(failures ? 1 : 0);
