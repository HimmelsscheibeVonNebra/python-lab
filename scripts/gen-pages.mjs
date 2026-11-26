// Generates the static site from examples-meta/, class-notes/ and the course
// sources in course/.  Every page carries both languages; js/lang.js shows one
// (English by default, the reader's choice is remembered).
//
//   index.html                           hub: every week + the playground
//   playground.html                      free practice (hello.py, grades.py)
//   classes/weekNN/index.html            one week: one machine for all its
//                                        examples (#ex=<name> picks one),
//                                        steps, source, lecture notes
//   classes/<class>/...                  old addresses, redirect to the above
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
  <link rel="icon" href="data:,">
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
      <section id="preview" class="preview" hidden>
        <form id="preview-form" class="preview-bar">
          <strong>${bothText("App preview", "앱 미리보기")}</strong>
          <span id="preview-port" class="muted"></span>
          <input id="preview-path" type="text" value="/" aria-label="Path / 주소" spellcheck="false" autocomplete="off">
          <button type="submit">${bothText("Open", "열기")}</button>
          <span id="preview-info" class="muted" role="status"></span>
        </form>
        <iframe id="preview-frame" title="App preview / 앱 미리보기" sandbox="allow-same-origin allow-forms"></iframe>
      </section>
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

// One page per week: one virtual machine for all of that week's examples.
// Choosing an example swaps the steps and the source and runs cd in the
// same machine.  weekNN-S classes share the page classes/weekNN/; any other
// class (e.g. "sample") has its own.
const weekOf = (cls) => {
  const m = cls.class.match(/^week(\d+)-(\d+)$/);
  return m ? { key: `week${m[1]}`, n: Number(m[1]), session: Number(m[2]) } : { key: cls.class };
};
const weeks = [];
for (const cls of classes) {
  const w = weekOf(cls);
  let week = weeks.find((x) => x.key === w.key);
  if (!week) {
    week = { key: w.key, n: w.n, classes: [] };
    weeks.push(week);
  }
  week.classes.push(cls);
}
const weekLabel = (week) =>
  week.n ? { en: `Week ${week.n}`, ko: `${week.n}주차` } : classLabel(week.classes[0]);
const sessionLabel = (cls) => {
  const w = weekOf(cls);
  return w.session ? { en: `Session ${w.session}`, ko: `${w.session}차시` } : classLabel(cls);
};

// Example ids within a week page (#ex=<id>): the slug, or class-slug when
// two sessions use the same name.
function exampleIds(week) {
  const all = week.classes.flatMap((cls) => cls.examples.map((ex) => ({ cls, ex, slug: slugOf(ex) })));
  const count = {};
  all.forEach((e) => { count[e.slug] = (count[e.slug] || 0) + 1; });
  all.forEach((e) => { e.id = count[e.slug] > 1 ? `${e.cls.class}-${e.slug}` : e.slug; });
  return all;
}

// A page left at an old address (classes/<class>/<example>.html) sends the
// reader to the example on its week page.
const redirect = (to) => `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="refresh" content="0; url=${esc(to)}">
  <link rel="icon" href="data:,">
  <title>${SITE}</title>
  <script>location.replace(${JSON.stringify(to)});</script>
</head>
<body><p><a href="${esc(to)}">${esc(to)}</a></p></body>
</html>
`;

function examplePanel({ cls, ex, id }, first) {
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
  const panel = `      <section class="ex-panel" data-ex="${esc(id)}" data-dir="${esc(dir)}"${first ? "" : " hidden"}>
        <h2>${esc(ex.name)} <span class="muted">~/${esc(dir)}</span></h2>
        <p>${bothText(exSummary.en, exSummary.ko)}</p>
        <h3>${bothText("Steps", "실행 순서")}</h3>
        ${stepsHtml(steps)}
${ex.manual ? callout({
  en: "Some steps need your own typing. Click the terminal and type (stop: <kbd>Ctrl</kbd>+<kbd>C</kbd>).",
  ko: "직접 입력해야 하는 단계가 있습니다. 터미널을 클릭한 뒤 입력하세요 (중단: <kbd>Ctrl</kbd>+<kbd>C</kbd>).",
}) : ""}${ex.slow ? callout({
  en: "pandas, matplotlib and Flask are downloaded the first time they are used, and loading them inside the emulator takes 10–30 seconds. Wait until the prompt comes back.",
  ko: "pandas·matplotlib·Flask는 처음 쓸 때 필요한 파일을 내려받고, 에뮬레이터 안에서 불러오는 데 10~30초가 걸립니다. 프롬프트가 다시 나올 때까지 기다리세요.",
}) : ""}${ex.notes ? `      <p class="callout">${bothText(ex.en.notes, ex.notes)}</p>\n` : ""}      </section>`;
  const sources = `    <div class="ex-sources" data-ex="${esc(id)}"${first ? "" : " hidden"}>
${files.map((f, k) => sourceHtml(shownName(f, dir), read(homeFile(f)), k === 0)).join("\n")}
    </div>`;
  return { panel, sources };
}

for (const week of weeks) {
  const label = weekLabel(week);
  const entries = exampleIds(week);
  const single = week.classes.length === 1;
  const titleOf = (cls) => txt(cls.en.title, cls.title);
  const built = entries.map((e, i) => ({ ...e, ...examplePanel(e, i === 0) }));

  const picker = week.classes
    .map((cls) => {
      const sl = sessionLabel(cls);
      const t = titleOf(cls);
      return `      <div class="ex-group">
${single ? "" : `        <h3>${bothText(`${sl.en} · ${t.en}`, `${sl.ko} · ${t.ko}`)}</h3>\n`}        <div class="ex-buttons">
${entries
  .filter((e) => e.cls === cls)
  .map((e) => `          <button type="button" data-pick="${esc(e.id)}" aria-pressed="${e === entries[0]}">${esc(e.ex.name)}</button>`)
  .join("\n")}
        </div>
      </div>`;
    })
    .join("\n");

  const notes = week.classes
    .map((cls) => {
      const ko = loadNotes(`class-notes/${cls.class}.html`, cls);
      const en = loadNotes(`class-notes/en/${cls.class}.html`, cls) || ko;
      if (!ko) return "";
      notesCount++;
      const sl = sessionLabel(cls);
      const t = titleOf(cls);
      return `    <article class="notes" id="notes-${esc(cls.class)}">
      <h2 class="notes-title">${single ? bothText(t.en, t.ko) : bothText(`${sl.en} — ${t.en}`, `${sl.ko} — ${t.ko}`)}</h2>
${both({ en: `\n${en}\n`, ko: `\n${ko}\n` }, "div")}
    </article>`;
    })
    .filter(Boolean)
    .join("\n");

  const h1 = single
    ? { en: `${label.en} — ${titleOf(week.classes[0]).en}`, ko: `${label.ko} — ${titleOf(week.classes[0]).ko}` }
    : label;
  const intro = single
    ? `<p>${bothText(txt(week.classes[0].en.summary, week.classes[0].summary).en, week.classes[0].summary)}</p>`
    : `<ul class="sessions">
${week.classes
  .map((cls) => {
    const sl = sessionLabel(cls);
    const t = titleOf(cls);
    const sm = txt(cls.en.summary, cls.summary);
    return `      <li><a href="#notes-${esc(cls.class)}"><strong>${bothText(`${sl.en} · ${t.en}`, `${sl.ko} · ${t.ko}`)}</strong></a> ${bothText(sm.en, sm.ko)}</li>`;
  })
  .join("\n")}
    </ul>`;

  write(
    `classes/${week.key}/index.html`,
    layout({
      title: h1,
      root: "../../",
      labDir: dirOf(entries[0].ex),
      withLab: true,
      crumbs: [{ text: SITE, href: "../../index.html" }, { text: label }],
      body: `  <header>
    <h1>${bothText(h1.en, h1.ko)}</h1>
    ${intro}
  </header>
  <main>
${machine({
  en: `One machine for the whole page: choosing another example runs <code>cd</code> to its directory in the same terminal, and the files you changed stay as they are (Reboot to start over). All course code is under <code>/home/student</code> (<code>week01</code> …, <code>sample</code>). ${COMMON_HINT.en}`,
  ko: `이 페이지의 예제는 모두 한 가상 머신에서 실행합니다. 다른 예제를 고르면 같은 터미널에서 그 디렉터리로 <code>cd</code>하며, 고친 파일은 그대로 남습니다 (처음 상태로 돌리려면 재부팅). 수업 코드는 모두 <code>/home/student</code>(<code>week01</code> …, <code>sample</code>)에 있습니다. ${COMMON_HINT.ko}`,
})}
    <aside class="guide">
      <nav class="ex-picker" aria-label="Examples / 예제">
        <h2>${bothText("Examples", "예제")}</h2>
${picker}
      </nav>
${built.map((b) => b.panel).join("\n")}
    </aside>
  </main>
  <section class="sources">
    <h2>${bothText("Source", "소스")}</h2>
${built.map((b) => b.sources).join("\n")}
  </section>
${notes}`,
    })
  );
  pageCount++;

  // Old addresses: classes/<class>/index.html and classes/<class>/<example>.html
  for (const cls of week.classes) {
    const base = cls.class === week.key ? "index.html" : `../${week.key}/index.html`;
    if (cls.class !== week.key) write(`classes/${cls.class}/index.html`, redirect(base));
    for (const e of entries.filter((x) => x.cls === cls)) {
      write(`classes/${cls.class}/${slugOf(e.ex)}.html`, redirect(`${base}#ex=${e.id}`));
    }
  }
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
      `Run the course examples in your browser with nothing to install. Each week's page boots one 32-bit x86 Linux with Python ${pythonVersion()} inside your browser; switch between that week's examples without rebooting.`,
      `설치 없이 브라우저에서 Linux를 부팅해 수업 예제를 실행합니다. 주차마다 한 페이지에서 32비트 x86 Linux와 Python ${pythonVersion()}를 한 번 부팅하고, 그 주의 예제를 재부팅 없이 바꿔 가며 실행합니다.`
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
${weeks
  .map((week) => {
    const label = weekLabel(week);
    const entries = exampleIds(week);
    const href = `classes/${week.key}/index.html`;
    return `    <section>
      <h2><a href="${href}">${week.classes.length === 1
        ? bothText(`${label.en} — ${week.classes[0].en.title ?? week.classes[0].title}`, `${label.ko} — ${week.classes[0].title}`)
        : bothText(label.en, label.ko)}</a></h2>
${week.classes
  .map((cls) => {
    const sl = sessionLabel(cls);
    return `      ${week.classes.length === 1 ? "" : `<h3>${bothText(`${sl.en} · ${cls.en.title ?? cls.title}`, `${sl.ko} · ${cls.title}`)}</h3>\n      `}<p class="muted">${bothText(cls.en.summary, cls.summary)}</p>
      <ul class="chips">
${entries.filter((e) => e.cls === cls).map((e) => `        <li><a href="${href}#ex=${e.id}">${esc(e.ex.name)}</a></li>`).join("\n")}
      </ul>`;
  })
  .join("\n")}
    </section>`;
  })
  .join("\n")}
  </main>`,
  })
);

console.log(
  `generated ${pageCount} week pages for ${classes.length} classes (${notesCount} with lecture notes), plus index.html and playground.html`
);
if (untranslated.length) console.log(`no English yet: ${untranslated.join("; ")}`);
