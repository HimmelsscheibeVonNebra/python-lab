// Generates the static site from examples-meta/, class-notes/ and the course
// sources in course/.  Every page carries both languages; js/lang.js shows one
// (English by default, the reader's choice is remembered).
//
//   index.html                           hub: every chapter + the playground
//   playground.html                      free practice (hello.py, grades.py)
//   <chapter>/index.html                 one chapter (chapters.json): one machine
//                                        for all its examples (#ex=<name> picks
//                                        one), steps, source, lecture notes
//
//   node scripts/gen-pages.mjs
//
// Table of contents: chapters.json
//   [{ "id": "loops", "nav": {en, ko}, "title": {en, ko}, "classes": ["..."] }]
//   A chapter is made of one or more classes (parts), in order.  Every class
//   file must belong to a chapter.
//
// Korean (the source of truth for commands and tests):
//   examples-meta/<class>.json
//   {
//     "class": "loops", "title": "...", "summary": "...",
//     "examples": [{
//       "name": "even_sum",                       page name (also the file slug)
//       "source": "loops/starter/even_sum.py",   under course/ (or
//                                                 rootfs/overlay/home/student/)
//       "dir": "loops/starter",                   start directory (default:
//                                                 the source's directory)
//       "also": ["loops/solutions/even_sum.py"],  more files to show
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
//     "title": "...", "summary": "...",
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
// (rootfs/overlay/home/student/<path>, e.g. web/flask_hello/app.py).
const homeFile = (rel) =>
  exists(path.join("course", rel)) ? path.join("course", rel) : path.join("rootfs/overlay/home/student", rel);

const slugOf = (ex) => ex.name.replace(/[^A-Za-z0-9_.-]+/g, "-");
const dirOf = (ex) => ex.dir || path.posix.dirname(ex.source);

// ---------------------------------------------------------------- templates

// The bar at the top of every page: home, the table of contents (a menu of
// every chapter, one click away from anywhere), the playground and the
// language switch.  current: a chapter id, "playground" or "home".
function topbar(root, current) {
  const here = chapters.find((c) => c.id === current);
  return `  <div class="topbar">
    <div class="topbar-inner">
      <a class="brand" href="${root}index.html"><span class="logo" aria-hidden="true">&gt;_</span><span>${SITE}</span></a>
      <details class="toc">
        <summary>${here
          ? `<span class="toc-num">${here.num}</span>${bothText(here.title.en, here.title.ko)}`
          : bothText("Chapters", "목차")}<span class="toc-caret" aria-hidden="true">▾</span></summary>
        <ol class="toc-menu">
${chapters
  .map((c) => `          <li><a href="${root}${c.id}/index.html"${c.id === current ? ' aria-current="page"' : ""}><span class="toc-num">${c.num}</span>${bothText(c.title.en, c.title.ko)}</a></li>`)
  .join("\n")}
          <li class="toc-extra"><a href="${root}playground.html"${current === "playground" ? ' aria-current="page"' : ""}><span class="toc-num">&gt;_</span>${bothText("Playground", "자유 실습")}</a></li>
        </ol>
      </details>
      <nav class="chapnav" aria-label="Chapters / 장">
${chapters
  .map((c) => `        <a href="${root}${c.id}/index.html"${c.id === current ? ' aria-current="page"' : ""} title="${esc(c.title.en)} / ${esc(c.title.ko)}">${bothText(c.nav.en, c.nav.ko)}</a>`)
  .join("\n")}
      </nav>
      <div class="lang-switch" role="group" aria-label="Language / 언어">
        <button type="button" data-set-lang="en" aria-pressed="true">EN</button><button type="button" data-set-lang="ko" aria-pressed="false">한국어</button>
      </div>
    </div>
  </div>`;
}

// title: { en, ko } plain text.
function layout({ title, root, labDir, current, body, withLab }) {
  const full = (s) => (s === SITE ? SITE : `${s} · ${SITE}`);
  return `<!DOCTYPE html>
<html lang="en" data-lang="en" data-title-en="${esc(full(title.en))}" data-title-ko="${esc(full(title.ko))}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${esc(full(title.en))}</title>
  <link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' rx='7' fill='%23306998'/%3E%3Ctext x='5' y='22' font-family='monospace' font-size='16' font-weight='700' fill='%23ffd43b'%3E%3E_%3C/text%3E%3C/svg%3E">
  <script src="${root}js/lang.js"></script>
  <link rel="stylesheet" href="${root}css/style.css">
${withLab ? `  <link rel="stylesheet" href="${root}vendor/xterm/xterm.css">
  <script src="${root}vendor/xterm/xterm.js"></script>
  <script src="${root}build/libv86.js"></script>
` : ""}</head>
<body data-root="${root}"${labDir ? ` data-lab-dir="${esc(labDir)}"` : ""}>
${topbar(root, current)}
  <div class="page">
${body}
  </div>
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
      <div class="term-window">
        <div class="term-bar" aria-hidden="true"><span class="dots"><i></i><i></i><i></i></span><span>student@python-lab</span></div>
        <div class="terminal-wrap"><div id="terminal"></div></div>
      </div>
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

// path: the file in the guest (/home/student/...).  js/lab.js redraws the
// listing when the file is edited there (lab-srcwatch in the guest).
function sourceHtml(name, text, open, path) {
  const lines = text.replace(/\n$/, "").split("\n");
  return `    <details class="source"${open ? " open" : ""}${path ? ` data-path="${esc(path)}"` : ""}>
      <summary>${esc(name)} <span class="muted src-lines" data-lines="${lines.length}">${bothText(`${lines.length} lines`, `${lines.length}줄`)}</span><span class="src-edited" hidden>${bothText("edited in the terminal", "터미널에서 수정됨")}</span></summary>
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

// Chapters (chapters.json) and their classes (examples-meta/<class>.json)
const allClasses = new Map(
  fs
    .readdirSync(path.join(ROOT, "examples-meta"))
    .filter((f) => f.endsWith(".json"))
    .map((f) => JSON.parse(read(path.join("examples-meta", f))))
    .map((c) => [c.class, c])
);
const chapterDefs = JSON.parse(read("chapters.json"));
const listed = new Set(chapterDefs.flatMap((c) => c.classes));
for (const id of allClasses.keys()) {
  if (!listed.has(id)) throw new Error(`examples-meta/${id}.json belongs to no chapter in chapters.json`);
}
// A chapter whose classes are not written yet is left out.
const chapters = chapterDefs
  .map((c) => ({ ...c, classes: c.classes.map((id) => allClasses.get(id)).filter((cls) => cls && cls.examples.length > 0) }))
  .filter((c) => c.classes.length > 0);
chapters.forEach((c, i) => { c.num = String(i + 1).padStart(2, "0"); });
const classes = chapters.flatMap((c) => c.classes);
classes.forEach(loadEnglish);

const txt = (enText, koText) => ({ en: enText ?? koText, ko: koText });

let pageCount = 0;
let notesCount = 0;

// Example ids within a chapter page (#ex=<id>): the slug, or class-slug when
// two sessions use the same name.
function exampleIds(chapter) {
  const all = chapter.classes.flatMap((cls) => cls.examples.map((ex) => ({ cls, ex, slug: slugOf(ex) })));
  const count = {};
  all.forEach((e) => { count[e.slug] = (count[e.slug] || 0) + 1; });
  all.forEach((e) => { e.id = count[e.slug] > 1 ? `${e.cls.class}-${e.slug}` : e.slug; });
  return all;
}

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
${files.map((f, k) => sourceHtml(shownName(f, dir), read(homeFile(f)), k === 0, `/home/student/${f}`)).join("\n")}
    </div>`;
  return { panel, sources };
}

for (const chapter of chapters) {
  const entries = exampleIds(chapter);
  const single = chapter.classes.length === 1;
  const titleOf = (cls) => txt(cls.en.title, cls.title);
  const built = entries.map((e, i) => ({ ...e, ...examplePanel(e, i === 0) }));
  // Links between examples in the notes (<a href="name.html">) pick the example.
  const linkExamples = (html, cls) =>
    html.replace(/href="([A-Za-z0-9_.-]+)\.html"/g, (m, slug) => {
      const e = entries.find((x) => x.slug === slug && x.cls === cls) || entries.find((x) => x.slug === slug);
      return e ? `href="#ex=${e.id}"` : m;
    });

  const picker = chapter.classes
    .map((cls) => {
      const t = titleOf(cls);
      return `      <div class="ex-group">
${single ? "" : `        <h3>${bothText(t.en, t.ko)}</h3>\n`}        <div class="ex-buttons">
${entries
  .filter((e) => e.cls === cls)
  .map((e) => `          <button type="button" data-pick="${esc(e.id)}" aria-pressed="${e === entries[0]}">${esc(e.ex.name)}</button>`)
  .join("\n")}
        </div>
      </div>`;
    })
    .join("\n");

  const notes = chapter.classes
    .map((cls) => {
      const ko = loadNotes(`class-notes/${cls.class}.html`, cls);
      const en = loadNotes(`class-notes/en/${cls.class}.html`, cls) || ko;
      if (!ko) return "";
      notesCount++;
      const t = titleOf(cls);
      return `    <article class="notes" id="notes-${esc(cls.class)}">
      <h2 class="notes-title">${bothText(t.en, t.ko)}</h2>
${both({ en: `\n${linkExamples(en, cls)}\n`, ko: `\n${linkExamples(ko, cls)}\n` }, "div")}
    </article>`;
    })
    .filter(Boolean)
    .join("\n");

  const at = chapters.indexOf(chapter);
  const prev = chapters[at - 1];
  const next = chapters[at + 1];
  const pagerLink = (c, dir) =>
    c
      ? `<a class="${dir}" href="../${c.id}/index.html" title="${esc(c.title.en)} / ${esc(c.title.ko)}">${dir === "prev" ? "← " : ""}${c.num} ${bothText(c.nav.en, c.nav.ko)}${dir === "next" ? " →" : ""}</a>`
      : "<span></span>";
  const counts = {
    en: `${single ? "" : `${chapter.classes.length} parts · `}${entries.length} example${entries.length === 1 ? "" : "s"}`,
    ko: `${single ? "" : `${chapter.classes.length}부분 · `}예제 ${entries.length}개`,
  };
  const intro = single
    ? `<p class="lead">${bothText(txt(chapter.classes[0].en.summary, chapter.classes[0].summary).en, chapter.classes[0].summary)}${
        exists(`class-notes/${chapter.classes[0].class}.html`) ? ` <a href="#notes-${esc(chapter.classes[0].class)}">${bothText("Lecture notes ↓", "강의 내용 ↓")}</a>` : ""
      }</p>`
    : `<ul class="sessions">
${chapter.classes
  .map((cls) => {
    const t = titleOf(cls);
    const sm = txt(cls.en.summary, cls.summary);
    return `      <li><a href="#notes-${esc(cls.class)}"><strong>${bothText(t.en, t.ko)}</strong><span class="sess-sum">${bothText(sm.en, sm.ko)}</span><span class="sess-more">${bothText("Lecture notes ↓", "강의 내용 ↓")}</span></a></li>`;
  })
  .join("\n")}
    </ul>`;

  write(
    `${chapter.id}/index.html`,
    layout({
      title: chapter.title,
      root: "../",
      labDir: dirOf(entries[0].ex),
      withLab: true,
      current: chapter.id,
      body: `  <header class="page-head">
    <div class="page-head-top">
      <span class="eyebrow">${bothText(`Chapter ${chapter.num} · ${counts.en}`, `${chapter.num}장 · ${counts.ko}`)}</span>
      <nav class="pager" aria-label="Previous and next chapter / 이전·다음 장">${pagerLink(prev, "prev")}${pagerLink(next, "next")}</nav>
    </div>
    <h1>${bothText(chapter.title.en, chapter.title.ko)}</h1>
    ${intro}
  </header>
  <main>
${machine({
  en: `One machine for the whole page: choosing another example runs <code>cd</code> to its directory in the same terminal, and the files you changed stay as they are (Reboot to start over). All example code is under <code>/home/student</code> (<code>ls ~</code>). ${COMMON_HINT.en}`,
  ko: `이 페이지의 예제는 모두 한 가상 머신에서 실행합니다. 다른 예제를 고르면 같은 터미널에서 그 디렉터리로 <code>cd</code>하며, 고친 파일은 그대로 남습니다 (처음 상태로 돌리려면 재부팅). 예제 코드는 모두 <code>/home/student</code>에 있습니다 (<code>ls ~</code>). ${COMMON_HINT.ko}`,
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
      { cmd: "ls", note: txt("hello.py, grades.py and the directories of the example code", "hello.py, grades.py와 예제 코드 디렉터리들") },
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
    current: "playground",
    body: `  <header class="page-head">
    <h1>${bothText("Playground", "자유 실습")}</h1>
    <p>${both({
      en: "Run code directly in the REPL, or write a <code>.py</code> file in an editor and run it. You can also upload files from your computer and run them.",
      ko: "REPL에서 바로 코드를 실행하거나, 편집기로 <code>.py</code> 파일을 만들어 실행합니다. 내 컴퓨터의 파일을 올려 실행할 수도 있습니다.",
    })}</p>
  </header>
  <main>
${machine({
  en: `Starts as user <code>student</code> in <code>/home/student</code>, where all the example code is (<code>ls</code>). ${COMMON_HINT.en}`,
  ko: `<code>student</code> 사용자로 <code>/home/student</code>에서 시작합니다. 예제 코드가 모두 여기에 있습니다 (<code>ls</code>). ${COMMON_HINT.ko}`,
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
${["hello.py", "grades.py"].map((f, i) => sourceHtml(f, read(`rootfs/overlay/home/student/${f}`), i === 0, `/home/student/${f}`)).join("\n")}
  </section>`,
  })
);

// ---------------------------------------------------------------- hub

function pythonVersion() {
  // Recorded by scripts/build-images.sh; fall back to the major version.
  const f = "images/python-version";
  return exists(f) ? read(f).trim() : "3";
}

// The one-line summary of a single-part chapter, shortened for a card.
function cls0Summary(chapter) {
  const cls = chapter.classes[0];
  const cut = (t) => {
    const first = t.split(/(?<=[.!?。])\s|(?<=다\.)\s/)[0];
    return first.length > 160 ? first.slice(0, 157) + "…" : first;
  };
  return { en: cut(cls.en.summary ?? cls.summary), ko: cut(cls.summary) };
}

const exampleCount = chapters.reduce((n, c) => n + exampleIds(c).length, 0);

write(
  "index.html",
  layout({
    title: txt(SITE, SITE),
    root: "",
    current: "home",
    body: `  <header class="hero">
    <div class="hero-text">
      <p class="eyebrow">${bothText("Basic Programming Using Python", "파이썬 기초 프로그래밍")}</p>
      <h1>${bothText("Learn Python by running it, right in your browser", "브라우저에서 바로 실행하며 배우는 파이썬")}</h1>
      <p class="lead">${bothText(
        `Nothing to install. Each chapter's page boots a small Linux with Python ${pythonVersion()} right in your browser — pick an example and press ▶ to type its commands into the terminal.`,
        `설치할 것이 없습니다. 장 페이지를 열면 브라우저 안에서 Python ${pythonVersion()}가 든 작은 Linux가 부팅되고, 예제를 고른 뒤 ▶를 누르면 명령이 터미널에 입력됩니다.`
      )}</p>
      <div class="hero-actions">
        <a class="btn primary" href="#chapters">${bothText("Browse the chapters", "목차 보기")}</a>
        <a class="btn" href="playground.html">${bothText("Open the playground", "자유 실습 열기")}</a>
      </div>
      <p class="hero-stats">${bothText(
        `${chapters.length} chapters · ${exampleCount} examples`,
        `${chapters.length}개 장 · 예제 ${exampleCount}개`
      )}</p>
    </div>
    <div class="hero-term" aria-hidden="true">
      <div class="term-bar"><span class="dots"><i></i><i></i><i></i></span><span>student@python-lab</span></div>
      <pre><span class="p">student@python-lab:~$</span> python3 hello.py
What is your name? Mina
Hello, Mina!
<span class="p">student@python-lab:~$</span> python3 -c 'print(sum(range(1, 11)))'
55
<span class="p">student@python-lab:~$</span> <span class="cursor"> </span></pre>
    </div>
  </header>

  <section class="howto" aria-label="How to use / 사용법">
    <ol>
      <li><span class="n">1</span><div><strong>${bothText("Pick a chapter", "장 고르기")}</strong><p>${bothText(
        "Use the chapter menu at the top of every page, or the cards below.",
        "모든 페이지 맨 위의 장 메뉴나 아래 카드를 누릅니다."
      )}</p></div></li>
      <li><span class="n">2</span><div><strong>${bothText("Choose an example", "예제 고르기")}</strong><p>${bothText(
        "All of the chapter's examples share one machine; switching just changes directory.",
        "그 장의 예제는 한 머신을 같이 씁니다. 바꾸면 디렉터리만 옮겨 갑니다."
      )}</p></div></li>
      <li><span class="n">3</span><div><strong>${bothText("Press ▶", "▶ 누르기")}</strong><p>${both({
        en: "Each step's command is typed into the terminal. Edit with <code>nano</code> and run it again — the source below follows your edits.",
        ko: "단계마다 명령이 터미널에 입력됩니다. <code>nano</code>로 고쳐 다시 실행해 보세요 — 아래 소스도 고친 대로 바뀝니다.",
      })}</p></div></li>
    </ol>
    <p class="tip">${both({
      en: `Short addresses: add a chapter name to the site address, e.g. <a href="network/"><code>network/</code></a> or <a href="oop/"><code>oop/</code></a>, and <code>#ex=</code> plus an example name to open it directly, e.g. <a href="oop/#ex=composition"><code>oop/#ex=composition</code></a>.`,
      ko: `짧은 주소: 사이트 주소 뒤에 장 이름을 붙이면 됩니다. 예: <a href="network/"><code>network/</code></a>, <a href="oop/"><code>oop/</code></a>. <code>#ex=</code>와 예제 이름을 더하면 그 예제가 바로 열립니다. 예: <a href="oop/#ex=composition"><code>oop/#ex=composition</code></a>`,
    })}</p>
  </section>

  <main class="list" id="chapters">
    <div class="chapter-grid">
${chapters
  .map((chapter) => {
    const entries = exampleIds(chapter);
    const href = `${chapter.id}/index.html`;
    return `      <article class="chapter-card">
        <a class="chapter-card-head" href="${href}">
          <span class="ch-num">${chapter.num}</span>
          <span class="ch-name">${bothText(chapter.title.en, chapter.title.ko)}<small>${bothText(
            `${entries.length} example${entries.length === 1 ? "" : "s"}`,
            `예제 ${entries.length}개`
          )}</small></span>
          <span class="ch-go" aria-hidden="true">→</span>
        </a>
${chapter.classes.length > 1 ? `        <ul class="ch-parts">
${chapter.classes.map((cls) => `          <li>${bothText(cls.en.title ?? cls.title, cls.title)}</li>`).join("\n")}
        </ul>
` : `        <p class="ch-sum">${bothText(cls0Summary(chapter).en, cls0Summary(chapter).ko)}</p>
`}        <ul class="chips">
${entries.map((e) => `          <li><a href="${href}#ex=${e.id}">${esc(e.ex.name)}</a></li>`).join("\n")}
        </ul>
        <p class="ch-short"><code>${chapter.id}/</code></p>
      </article>`;
  })
  .join("\n")}
      <article class="chapter-card special">
        <a class="chapter-card-head" href="playground.html">
          <span class="ch-num">&gt;_</span>
          <span class="ch-name">${bothText("Playground", "자유 실습")}<small>python3 · nano · ${bothText("file exchange", "파일 주고받기")}</small></span>
          <span class="ch-go" aria-hidden="true">→</span>
        </a>
        <p class="ch-sum">${bothText("The REPL, writing and running scripts, uploading your files and downloading results.", "REPL, 스크립트 작성과 실행, 내 컴퓨터의 파일 올리기와 결과 받기.")}</p>
      </article>
    </div>
  </main>`,
  })
);

console.log(
  `generated ${pageCount} chapter pages from ${classes.length} classes (${notesCount} with lecture notes), plus index.html and playground.html`
);
if (untranslated.length) console.log(`no English yet: ${untranslated.join("; ")}`);
