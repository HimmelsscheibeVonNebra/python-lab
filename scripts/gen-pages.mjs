// Generates the static site from examples-meta/, class-notes/ and the course
// sources in course/.  Every page carries both languages; js/lang.js shows one
// (English by default, the reader's choice is remembered).
//
//   index.html                           hub: every class + the playground
//   playground.html                      free practice (hello.py, grades.py)
//   classes/<class>/index.html           one class: its examples + lecture notes
//   classes/<class>/<example>.html       one example: terminal + steps + source
//
//   node scripts/gen-pages.mjs
//
// Korean (the source of truth for commands and tests):
//   examples-meta/<class>.json   class = weekNN-S (e.g. week03-1); any other id
//                                (e.g. "sample") needs a "label" and is
//                                listed after the weeks
//   {
//     "class": "week03-1", "title": "...", "summary": "...",
//     "examples": [{
//       "name": "even_sum",                       page name (also the file slug)
//       "source": "week03/starter/session1/even_sum.py",   under course/ (or
//                                                 rootfs/overlay/home/student/)
//       "dir": "week03/starter/session1",         start directory (default:
//                                                 the source's directory)
//       "also": ["week03/solutions/session1/even_sum.py"],  more files to show
//       "summary": "...",
//       "steps": [{ "cmd": "python3 even_sum.py", "note": "..." }],
//       "manual": false,       true: needs typing; the test does not run it
//       "expect": "30",        text the steps' output must contain (test)
//       "traceback": false,    true: a Python Traceback is the expected result
//       "slow": false,         true: imports pandas/matplotlib (longer timeout)
//       "notes": "..."         callout under the steps (optional)
//     }]
//   }
//   class-notes/<class>.html     lecture notes (HTML fragment, checked below)
//
// English (text only; commands come from the Korean file):
//   examples-meta/en/<class>.json
//   {
//     "title": "...", "summary": "...", "label": "...",   (label: non-week only)
//     "examples": {
//       "even_sum": { "summary": "...", "notes": "...",
//                     "steps": ["note of step 1", "note of step 2", ...] }
//     }
//   }
//   "steps" has one entry per Korean step (null where the step has no note).
//   class-notes/en/<class>.html  the same notes in English
//
// A class without its English files still builds (its Korean text is shown
// in both languages) and is listed as untranslated at the end.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), "utf8");
const exists = (rel) => fs.existsSync(path.join(ROOT, rel));
const SITE = "Python Lab";

function write(rel, content) {
  const file = path.join(ROOT, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
}

const esc = (s) =>
  String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

// ---------------------------------------------------------------- languages

// Both languages of one piece of text, as HTML.  t = { en, ko } (HTML, already
// escaped).  Identical texts are written once.
function both(t, tag = "span") {
  if (t.en === t.ko) return t.ko;
  return `<${tag} lang="en">${t.en}</${tag}><${tag} lang="ko">${t.ko}</${tag}>`;
}
// Same, from plain text.
const bothText = (en, ko, tag) => both({ en: esc(en ?? ko), ko: esc(ko) }, tag);

// Example files: course/<path>, or the lab's own files in the student's home
// (rootfs/overlay/home/student/<path>, e.g. flask_hello/app.py).
const homeFile = (rel) =>
  exists(path.join("course", rel)) ? path.join("course", rel) : path.join("rootfs/overlay/home/student", rel);

const slugOf = (ex) => ex.name.replace(/[^A-Za-z0-9_.-]+/g, "-");
const dirOf = (ex) => ex.dir || path.posix.dirname(ex.source);

// week03-1 -> "Week 3 · Session 1" / "3주차 1차시"; others use their "label"
function classLabel(cls) {
  const m = cls.class.match(/^week(\d+)-(\d+)$/);
  if (!m) return { en: cls.en.label || cls.label || cls.class, ko: cls.label || cls.class };
  return { en: `Week ${Number(m[1])} · Session ${Number(m[2])}`, ko: `${Number(m[1])}주차 ${Number(m[2])}차시` };
}
// Weekly classes first, in order; then the others (Flask samples).
const classOrder = (c) => (/^week\d/.test(c.class) ? "0" : "1") + c.class;

// ---------------------------------------------------------------- templates

// title: { en, ko } plain text.  crumbs: [{ text: {en, ko} | string, href }]
function layout({ title, root, labDir, crumbs, body, withLab }) {
  const crumbHtml = crumbs
    .map((c) => {
      const text = typeof c.text === "string" ? esc(c.text) : bothText(c.text.en, c.text.ko);
      return c.href ? `<a href="${esc(c.href)}">${text}</a>` : `<span>${text}</span>`;
    })
    .join('<span class="sep">/</span>');
  const full = (s) => (s === SITE ? SITE : `${s} · ${SITE}`);
  return `<!DOCTYPE html>
<html lang="en" data-lang="en" data-title-en="${esc(full(title.en))}" data-title-ko="${esc(full(title.ko))}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${esc(full(title.en))}</title>
  <script src="${root}js/lang.js"></script>
  <link rel="stylesheet" href="${root}css/style.css">
${withLab ? `  <link rel="stylesheet" href="${root}vendor/xterm/xterm.css">
  <script src="${root}vendor/xterm/xterm.js"></script>
  <script src="${root}build/libv86.js"></script>
` : ""}</head>
<body data-root="${root}"${labDir ? ` data-lab-dir="${esc(labDir)}"` : ""}>
  <div class="topbar">
    <nav class="crumbs">${crumbHtml}</nav>
    <div class="lang-switch" role="group" aria-label="Language / 언어">
      <button type="button" data-set-lang="en" aria-pressed="true">English</button><button type="button" data-set-lang="ko" aria-pressed="false">한국어</button>
    </div>
  </div>
${body}
${withLab ? `  <script src="${root}js/lab.js"></script>\n` : ""}</body>
</html>
`;
}

const machine = (hint) => `    <section class="machine">
      <div class="toolbar">
        <button id="reset" type="button">${bothText("Reboot", "재부팅")}</button>
        <label class="upload">${bothText("Upload files", "파일 올리기")}<input id="upload" type="file" multiple hidden></label>
        <form id="download-form" class="download">
          <input id="download-name" type="text" placeholder="/mnt/host/file name" aria-label="File to download (in /mnt/host)" spellcheck="false" autocomplete="off">
          <button type="submit">${bothText("Download", "받기")}</button>
        </form>
        <span id="status" role="status">${bothText("Loading…", "준비 중…")}</span>
      </div>
      <div class="terminal-wrap"><div id="terminal"></div></div>
      <p class="hint">${both(hint)}</p>
    </section>`;

const COMMON_HINT = {
  en:
    "Editors: <code>nano</code> (save <kbd>Ctrl</kbd>+<kbd>O</kbd>, quit <kbd>Ctrl</kbd>+<kbd>X</kbd>) and <code>vi</code>. " +
    "Uploaded files appear in <code>/mnt/host</code>. To save a result (chart, CSV, HTML) to your computer, run <code>cp file /mnt/host/</code>, type its name in the box above and press <b>Download</b>. " +
    "Reloading or rebooting returns the machine to its original state.",
  ko:
    "편집기는 <code>nano</code>(저장 <kbd>Ctrl</kbd>+<kbd>O</kbd>, 종료 <kbd>Ctrl</kbd>+<kbd>X</kbd>)와 <code>vi</code>입니다. " +
    "올린 파일은 <code>/mnt/host</code>에 나타나고, 결과 파일(그림·CSV·HTML)은 <code>cp 파일 /mnt/host/</code> 후 이름을 입력하고 <b>받기</b>를 누르면 내 컴퓨터에 저장됩니다. " +
    "새로고침하거나 재부팅하면 처음 상태로 돌아갑니다.",
};

// steps: [{ cmd, note: { en, ko } | undefined }]
function stepsHtml(steps) {
  return `<ol class="steps">
${steps
  .map(
    (s) => `        <li>
          <div class="cmd"><button type="button" data-cmd="${esc(s.cmd)}" title="Run in the terminal / 터미널에서 실행" aria-label="Run: ${esc(s.cmd)}">▶</button><code>${esc(s.cmd)}</code></div>
${s.note ? `          <p>${bothText(s.note.en, s.note.ko)}</p>\n` : ""}        </li>`
  )
  .join("\n")}
      </ol>`;
}

function sourceHtml(name, text, open) {
  const lines = text.replace(/\n$/, "").split("\n");
  return `    <details class="source"${open ? " open" : ""}>
      <summary>${esc(name)} <span class="muted">${bothText(`${lines.length} lines`, `${lines.length}줄`)}</span></summary>
      <pre class="code"><code>${lines.map((l) => `<span class="ln">${esc(l) || " "}</span>`).join("\n")}</code></pre>
    </details>`;
}

// Files shown under an example: its source, then "also" (path relative to the
// start directory when it is below it, otherwise relative to /home/student).
function shownName(rel, dir) {
  const r = path.posix.relative(dir, rel);
  return r.startsWith("..") ? rel : r;
}

const callout = (t) => `      <p class="callout">${both(t)}</p>\n`;

// ---------------------------------------------------------------- lecture notes

// class-notes/[en/]<class>.html is an HTML fragment (the class's slides
// written out as prose) inlined into the class index page.  Because it is
// inlined as-is, check it: allowed tags only, properly nested, links resolve.
const NOTE_TAGS = new Set(
  "h2 h3 p ul ol li pre code table thead tbody tr th td strong em a blockquote br kbd".split(" ")
);

function loadNotes(rel, cls) {
  if (!exists(rel)) return "";
  const html = read(rel).trim();
  const slugs = new Set(cls.examples.map(slugOf));
  const problems = [];
  const stack = [];

  for (const m of html.matchAll(/<(\/?)([a-zA-Z][a-zA-Z0-9]*)([^>]*)>/g)) {
    const [, close, rawTag, attrs] = m;
    const tag = rawTag.toLowerCase();
    if (!NOTE_TAGS.has(tag)) {
      problems.push(`tag <${tag}> not allowed`);
      continue;
    }
    if (tag === "br") continue;
    if (close) {
      const open = stack.pop();
      if (open !== tag) problems.push(`</${tag}> closes <${open ?? "nothing"}>`);
      continue;
    }
    stack.push(tag);
    const attrText = attrs.trim();
    if (tag === "a") {
      const href = attrText.match(/^href="([^"]*)"$/);
      if (!href) problems.push(`<a> must have only href: ${attrText}`);
      else if (!/^https?:\/\//.test(href[1]) && !slugs.has(href[1].replace(/\.html$/, "")))
        problems.push(`link to unknown example page: ${href[1]}`);
    } else if (attrText) {
      problems.push(`<${tag}> has attributes: ${attrText}`);
    }
  }
  if (stack.length) problems.push(`unclosed: ${stack.join(", ")}`);
  // A bare "<" or "&" would swallow or garble the text after it.
  const text = html.replace(/<\/?[a-zA-Z][^>]*>/g, "");
  if (/</.test(text)) problems.push('unescaped "<" in text');
  if (/&(?!(amp|lt|gt|quot|#\d+|#x[0-9a-fA-F]+);)/.test(text)) problems.push('unescaped "&" in text');

  if (problems.length) {
    throw new Error(`${rel}:\n  ${[...new Set(problems)].slice(0, 12).join("\n  ")}`);
  }
  return html;
}

// ---------------------------------------------------------------- classes

const untranslated = [];

// Attaches the English overlay as cls.en and ex.en, checking it lines up.
function loadEnglish(cls) {
  const rel = `examples-meta/en/${cls.class}.json`;
  const en = exists(rel) ? JSON.parse(read(rel)) : null;
  const missing = [];
  if (!en) missing.push("meta");
  cls.en = en || {};
  const enExamples = cls.en.examples || {};
  for (const name of Object.keys(enExamples)) {
    if (!cls.examples.some((ex) => ex.name === name)) throw new Error(`${rel}: unknown example "${name}"`);
  }
  for (const ex of cls.examples) {
    ex.en = enExamples[ex.name] || {};
    if (en && !enExamples[ex.name]) missing.push(`example ${ex.name}`);
    const notes = ex.en.steps || [];
    if (en && enExamples[ex.name] && notes.length !== ex.steps.length) {
      throw new Error(`${rel}: ${ex.name} has ${notes.length} step notes, the Korean file has ${ex.steps.length} steps`);
    }
  }
  if (!exists(`class-notes/en/${cls.class}.html`) && exists(`class-notes/${cls.class}.html`)) missing.push("notes");
  if (missing.length) untranslated.push(`${cls.class} (${missing.join(", ")})`);
}

const classes = fs
  .readdirSync(path.join(ROOT, "examples-meta"))
  .filter((f) => f.endsWith(".json"))
  .map((f) => JSON.parse(read(path.join("examples-meta", f))))
  .filter((c) => c.examples.length > 0)
  .sort((a, b) => classOrder(a).localeCompare(classOrder(b), "en", { numeric: true }));
classes.forEach(loadEnglish);

const txt = (enText, koText) => ({ en: enText ?? koText, ko: koText });

let pageCount = 0;
let notesCount = 0;

for (const cls of classes) {
  const label = classLabel(cls);
  const title = txt(cls.en.title, cls.title);
  const summary = txt(cls.en.summary, cls.summary);
  const notesKo = loadNotes(`class-notes/${cls.class}.html`, cls);
  const notesEn = loadNotes(`class-notes/en/${cls.class}.html`, cls) || notesKo;
  if (notesKo) notesCount++;
  const slugs = cls.examples.map(slugOf);
  if (new Set(slugs).size !== slugs.length) throw new Error(`${cls.class}: duplicate example names`);

  write(
    `classes/${cls.class}/index.html`,
    layout({
      title: { en: `${label.en} ${title.en}`, ko: `${label.ko} ${title.ko}` },
      root: "../../",
      crumbs: [{ text: SITE, href: "../../index.html" }, { text: label }],
      body: `  <header>
    <h1>${bothText(title.en, title.ko)}</h1>
    <p>${bothText(summary.en, summary.ko)}</p>
  </header>
  <main class="list">
    <section>
      <h2>${bothText("Examples to run", "실행해 볼 예제")}</h2>
      <ul class="cards">
${cls.examples
  .map(
    (ex) => `        <li><a href="${slugOf(ex)}.html"><strong>${esc(ex.name)}</strong><span>${bothText(ex.en.summary, ex.summary)}</span></a></li>`
  )
  .join("\n")}
      </ul>
    </section>
${notesKo ? `    <article class="notes">\n${both({ en: `\n${notesEn}\n`, ko: `\n${notesKo}\n` }, "div")}\n    </article>\n` : ""}  </main>`,
    })
  );

  cls.examples.forEach((ex, i) => {
    const prev = cls.examples[i - 1];
    const next = cls.examples[i + 1];
    const dir = dirOf(ex);
    const files = [ex.source, ...(ex.also || [])];
    for (const f of files) {
      if (!exists(homeFile(f))) throw new Error(`${cls.class}/${ex.name}: no course/${f}`);
    }
    if (!exists(homeFile(dir))) throw new Error(`${cls.class}/${ex.name}: no course/${dir}`);
    const steps = ex.steps.map((s, k) => ({
      cmd: s.cmd,
      note: s.note ? txt((ex.en.steps || [])[k], s.note) : undefined,
    }));
    const exSummary = txt(ex.en.summary, ex.summary);

    write(
      `classes/${cls.class}/${slugOf(ex)}.html`,
      layout({
        title: { en: `${ex.name} — ${title.en}`, ko: `${ex.name} — ${title.ko}` },
        root: "../../",
        labDir: dir,
        withLab: true,
        crumbs: [
          { text: SITE, href: "../../index.html" },
          { text: label, href: "index.html" },
          { text: ex.name },
        ],
        body: `  <header>
    <h1>${esc(ex.name)}</h1>
    <p>${bothText(exSummary.en, exSummary.ko)}</p>
  </header>
  <main>
${machine({
  en: `Starts as user <code>student</code> in <code>/home/student/${esc(dir)}</code>. All course code is under <code>/home/student</code> (<code>week01</code> …, <code>sample</code>). ${COMMON_HINT.en}`,
  ko: `<code>/home/student/${esc(dir)}</code>에서 <code>student</code> 사용자로 시작합니다. 수업 코드가 모두 <code>/home/student</code>(<code>week01</code> …, <code>sample</code>)에 들어 있습니다. ${COMMON_HINT.ko}`,
})}
    <aside class="guide">
      <h2>${bothText("Steps", "실행 순서")}</h2>
      ${stepsHtml(steps)}
${ex.manual ? callout({
  en: "Some steps need your own typing. Click the terminal and type (stop: <kbd>Ctrl</kbd>+<kbd>C</kbd>).",
  ko: "직접 입력해야 하는 단계가 있습니다. 터미널을 클릭한 뒤 입력하세요 (중단: <kbd>Ctrl</kbd>+<kbd>C</kbd>).",
}) : ""}${ex.slow ? callout({
  en: "pandas, matplotlib and Flask are downloaded the first time they are used, and loading them inside the emulator takes 10–30 seconds. Wait until the prompt comes back.",
  ko: "pandas·matplotlib·Flask는 처음 쓸 때 필요한 파일을 내려받고, 에뮬레이터 안에서 불러오는 데 10~30초가 걸립니다. 프롬프트가 다시 나올 때까지 기다리세요.",
}) : ""}${ex.notes ? `      <p class="callout">${bothText(ex.en.notes, ex.notes)}</p>\n` : ""}    </aside>
  </main>
  <section class="sources">
    <h2>${bothText("Source", "소스")}</h2>
${files.map((f, k) => sourceHtml(shownName(f, dir), read(homeFile(f)), k === 0)).join("\n")}
  </section>
  <nav class="pager">
    ${prev ? `<a href="${slugOf(prev)}.html">← ${esc(prev.name)}</a>` : "<span></span>"}
    ${next ? `<a href="${slugOf(next)}.html">${esc(next.name)} →</a>` : "<span></span>"}
  </nav>`,
      })
    );
    pageCount++;
  });
}

// ---------------------------------------------------------------- playground

const playground = [
  {
    title: txt("01 · Getting started with Python", "01 · Python 시작하기"),
    summary: txt("Check the installed Python version and open the interactive shell (REPL).", "설치된 Python 버전을 확인하고 대화형 셸(REPL)을 열어 봅니다."),
    steps: [
      { cmd: "python3 -V", note: txt("The Python version (python is the same command)", "Python 버전 (python도 같은 명령입니다)") },
      { cmd: "python3", note: txt("The interactive shell (REPL): type code after >>>", "대화형 셸(REPL). >>> 뒤에 코드를 입력합니다") },
      { cmd: 'print("Hello, Python!")', note: txt("Run inside the REPL — the result is printed right away", "REPL 안에서 실행 — 결과가 바로 출력됩니다") },
      { cmd: "[n * n for n in range(1, 11)]", note: txt("The value of an expression is shown even without print", "식의 값은 print 없이도 보입니다") },
      { cmd: "exit()", note: txt("Leave the REPL (Ctrl+D works too)", "REPL 종료 (Ctrl+D도 됩니다)") },
    ],
  },
  {
    title: txt("02 · Running a script", "02 · 스크립트 실행"),
    summary: txt("Run the example files in the home directory. Their source is below.", "홈 디렉터리의 예제 파일을 실행합니다. 소스는 아래에 있습니다."),
    steps: [
      { cmd: "ls", note: txt("hello.py, grades.py and the course code directories week01 …", "hello.py, grades.py와 주차별 수업 코드 디렉터리 week01 …") },
      { cmd: "python3 hello.py", note: txt("When input() asks for your name, type it in the terminal and press Enter", "input()이 이름을 물으면 터미널에 입력하고 Enter") },
      { cmd: "python3 grades.py", note: txt("Builds a grades file with a dictionary, a function and the csv module", "딕셔너리·함수·csv 모듈로 성적 파일을 만듭니다") },
      { cmd: "cat grades.csv", note: txt("The file the program wrote", "프로그램이 쓴 파일의 내용") },
    ],
  },
  {
    title: txt("03 · Writing code", "03 · 코드 작성하기"),
    summary: txt("Create a new file with the nano editor and run it. Save with Ctrl+O → Enter, quit with Ctrl+X. vi is also available.", "편집기 nano로 새 파일을 만들고 실행합니다. 저장은 Ctrl+O → Enter, 종료는 Ctrl+X. vi도 있습니다."),
    steps: [
      { cmd: "nano my_first.py", note: txt("Type your code, save, and quit", "코드를 입력하고 저장한 뒤 종료") },
      { cmd: "python3 my_first.py", note: txt("On an error, read the last line of the Traceback and its line number", "오류가 나면 Traceback의 마지막 줄과 줄 번호를 확인합니다") },
      { cmd: "python3 -i my_first.py", note: txt("Stay in the REPL after the run to inspect variables and functions", "실행 후 REPL에 남아 변수와 함수를 직접 확인") },
    ],
  },
  {
    title: txt("04 · Exchanging files", "04 · 파일 주고받기"),
    summary: txt("Upload .py and .csv files from your computer, run them, and download the results.", "내 컴퓨터의 .py·.csv 파일을 올려 실행하고, 결과 파일을 다시 받습니다."),
    steps: [
      { cmd: "ls -l /mnt/host", note: txt("Files you upload appear here", "파일 올리기로 올린 파일이 여기에 나타납니다") },
      { cmd: "cp /mnt/host/*.py .", note: txt("Copy them home to run, or run them in place: python3 /mnt/host/file.py", "홈 디렉터리로 복사해 실행하거나 python3 /mnt/host/파일.py로 바로 실행") },
      { cmd: "cp grades.csv /mnt/host/", note: txt("Copy the file to /mnt/host, type its name in the box above and press Download", "받을 파일을 /mnt/host에 복사한 뒤, 위의 입력란에 이름을 적고 받기") },
    ],
  },
];

write(
  "playground.html",
  layout({
    title: txt("Playground", "자유 실습"),
    root: "",
    withLab: true,
    crumbs: [{ text: SITE, href: "index.html" }, { text: txt("Playground", "자유 실습") }],
    body: `  <header>
    <h1>${bothText("Playground", "자유 실습")}</h1>
    <p>${both({
      en: "Run code directly in the REPL, or write a <code>.py</code> file in an editor and run it. You can also upload files from your computer and run them.",
      ko: "REPL에서 바로 코드를 실행하거나, 편집기로 <code>.py</code> 파일을 만들어 실행합니다. 내 컴퓨터의 파일을 올려 실행할 수도 있습니다.",
    })}</p>
  </header>
  <main>
${machine({
  en: `Starts as user <code>student</code> in <code>/home/student</code>. The course code is in <code>week01</code> … and <code>sample</code>. ${COMMON_HINT.en}`,
  ko: `<code>student</code> 사용자로 <code>/home/student</code>에서 시작합니다. 주차별 수업 코드는 <code>week01</code> …, <code>sample</code> 디렉터리에 있습니다. ${COMMON_HINT.ko}`,
})}
    <aside class="guide">
${playground
  .map(
    (g, i) => `      <details${i === 0 ? " open" : ""}>
        <summary>${bothText(g.title.en, g.title.ko)}</summary>
        <p>${bothText(g.summary.en, g.summary.ko)}</p>
        ${stepsHtml(g.steps)}
      </details>`
  )
  .join("\n")}
${callout({
  en: "The full standard library plus pandas, numpy, matplotlib and Flask are installed (downloaded on first import; pandas and matplotlib take 10–30 s to load). There is no network, so <code>pip install</code> does not work.",
  ko: "표준 라이브러리 전체와 pandas·numpy·matplotlib·Flask가 들어 있습니다 (처음 import할 때 내려받으며, pandas·matplotlib는 10~30초 걸립니다). 네트워크가 없어 <code>pip install</code>은 할 수 없습니다.",
})}    </aside>
  </main>
  <section class="sources">
    <h2>${bothText("Example source", "예제 소스")}</h2>
${["hello.py", "grades.py"].map((f, i) => sourceHtml(f, read(`rootfs/overlay/home/student/${f}`), i === 0)).join("\n")}
  </section>`,
  })
);

// ---------------------------------------------------------------- hub

function pythonVersion() {
  // Recorded by scripts/build-images.sh; fall back to the major version.
  const f = "images/python-version";
  return exists(f) ? read(f).trim() : "3";
}

write(
  "index.html",
  layout({
    title: txt(SITE, SITE),
    root: "",
    crumbs: [{ text: SITE }],
    body: `  <header>
    <h1>${SITE} — ${bothText("Basic Programming Using Python", "파이썬 기초 프로그래밍")}</h1>
    <p>${bothText(
      `Run the course examples in your browser with nothing to install. Every page boots its own 32-bit x86 Linux with Python ${pythonVersion()} inside your browser and starts in that class's code directory.`,
      `설치 없이 브라우저에서 Linux를 부팅해 수업 예제를 실행합니다. 각 페이지는 자신의 브라우저 안에서 32비트 x86 Linux와 Python ${pythonVersion()}를 새로 부팅하며, 그 주차의 수업 코드 디렉터리에서 시작합니다.`
    )}</p>
  </header>
  <main class="list">
    <section>
      <h2>${bothText("Playground", "자유 실습")}</h2>
      <ul class="cards">
        <li><a href="playground.html"><strong>python3 · nano · ${bothText("file exchange", "파일 주고받기")}</strong><span>${bothText(
          "The REPL, writing and running scripts, uploading your files and downloading results.",
          "REPL, 스크립트 작성과 실행, 내 컴퓨터의 파일 올리기와 결과 받기."
        )}</span></a></li>
      </ul>
    </section>
${classes
  .map((cls) => {
    const label = classLabel(cls);
    return `    <section>
      <h2><a href="classes/${cls.class}/index.html">${bothText(`${label.en} — ${cls.en.title ?? cls.title}`, `${label.ko} — ${cls.title}`)}</a></h2>
      <p class="muted">${bothText(cls.en.summary, cls.summary)}</p>
      <ul class="chips">
${cls.examples.map((ex) => `        <li><a href="classes/${cls.class}/${slugOf(ex)}.html">${esc(ex.name)}</a></li>`).join("\n")}
      </ul>
    </section>`;
  })
  .join("\n")}
  </main>`,
  })
);

console.log(
  `generated ${pageCount} example pages in ${classes.length} classes (${notesCount} with lecture notes), plus index.html and playground.html`
);
if (untranslated.length) console.log(`no English yet: ${untranslated.join("; ")}`);
