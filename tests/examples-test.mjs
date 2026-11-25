// Runs the steps of every example page exactly as a student would: one boot
// per class as user "student", each example starting in its page's directory
// (cd /home/student/<dir>), each step typed into the interactive shell.
//
//   node tests/examples-test.mjs [class ...]     (VERBOSE=1 shows the console)
//
// An example passes when no step hangs, nothing crashes or is missing, no
// Python Traceback appears (unless the example is marked "traceback": true),
// and its "expect" text (if any) appears in the output.  Examples marked
// "manual" need typing; for those only the source's presence is checked.
// Full transcripts go to tests/out/<class>.log.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { bootGuest } from "./guest.mjs";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const metaDir = path.join(root, "examples-meta");
const outDir = path.join(root, "tests", "out");
fs.mkdirSync(outDir, { recursive: true });

const only = process.argv.slice(2);
const classes = fs
  .readdirSync(metaDir)
  .filter((f) => f.endsWith(".json"))
  .map((f) => JSON.parse(fs.readFileSync(path.join(metaDir, f), "utf8")))
  .filter((c) => c.examples.length > 0 && (only.length === 0 || only.includes(c.class)))
  .sort((a, b) => a.class.localeCompare(b.class, "en", { numeric: true }));

// A missing command, a shell syntax error, or a crashed interpreter.
const BROKEN = /: not found|syntax error|^(Segmentation fault|Illegal instruction|Bus error|Killed)( \(core dumped\))?$/m;
const TRACEBACK = /^Traceback \(most recent call last\):$/m;
// Python's colored tracebacks: compare plain text.
const plain = (s) => s.replace(/\x1b\[[0-9;?]*[A-Za-z]/g, "");

const results = [];

for (const cls of classes) {
  const first = cls.examples[0];
  const guest = await bootGuest(first.dir || path.posix.dirname(first.source));
  let log = `### ${cls.class} (boot ${guest.bootSeconds.toFixed(1)}s)\n`;

  for (const ex of cls.examples) {
    const result = { class: cls.class, name: ex.name, status: "PASS", why: "" };
    const dir = ex.dir || path.posix.dirname(ex.source);
    log += `\n===== ${ex.name}${ex.manual ? " (manual)" : ""}  [${dir}]\n`;

    const present = await guest.sh(`cd /home/student/${dir} && test -f /home/student/${ex.source}`);
    if (present.status !== 0) {
      result.status = "FAIL";
      result.why = `${ex.source} or ${dir} missing in the image`;
    } else if (ex.manual) {
      result.status = "MANUAL";
    } else {
      let combined = "";
      for (const step of ex.steps) {
        const r = await guest.sh(step.cmd, ex.slow ? 240_000 : 60_000);
        const out = plain(r.out);
        log += `$ ${step.cmd}\n${out}[exit ${r.timedOut ? "TIMEOUT" : r.status}]\n`;
        combined += out;
        if (r.timedOut) {
          result.status = "FAIL";
          result.why = `step hung: ${step.cmd}`;
          break;
        }
      }
      const broken = combined.match(BROKEN);
      if (result.status === "PASS" && broken) {
        result.status = "FAIL";
        result.why = `output contains "${broken[0]}"`;
      }
      if (result.status === "PASS" && !ex.traceback && TRACEBACK.test(combined)) {
        result.status = "FAIL";
        result.why = "unexpected Python Traceback";
      }
      if (result.status === "PASS" && ex.expect && !combined.includes(ex.expect)) {
        result.status = "FAIL";
        result.why = `expected text not found: ${JSON.stringify(ex.expect)}`;
      }
      await guest.sh("kill -9 $(jobs -p) 2>/dev/null; wait");
    }

    console.log(`${result.status.padEnd(6)} ${cls.class}/${ex.name}${result.why ? "  -- " + result.why : ""}`);
    results.push(result);
  }

  fs.writeFileSync(path.join(outDir, `${cls.class}.log`), log);
  await guest.destroy();
}

const count = (s) => results.filter((r) => r.status === s).length;
console.log(`\n${results.length} examples: ${count("PASS")} passed, ${count("MANUAL")} manual (not run), ${count("FAIL")} failed`);
process.exit(count("FAIL") ? 1 : 0);
