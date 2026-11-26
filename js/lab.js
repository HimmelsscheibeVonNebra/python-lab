"use strict";

// Shared by every lab page: boots 32-bit x86 Linux (BusyBox + Python 3) in
// v86 and connects its serial console to xterm.js.  The page tells us where
// the site root is and which directory under /home/student to start in:
//
//   <body data-root="../../" data-lab-dir="week03/starter/session1">
(function () {
  const root = document.body.dataset.root || "";

  // Week pages hold several examples (scripts/gen-pages.mjs) that share this
  // one machine: <section class="ex-panel" data-ex="id" data-dir="...">.
  // #ex=<id> picks the one to start with; choosing another runs cd.
  const panels = Array.from(document.querySelectorAll(".ex-panel"));
  const sourceSets = Array.from(document.querySelectorAll(".ex-sources"));
  const pickButtons = Array.from(document.querySelectorAll("button[data-pick]"));
  const hashExample = () => {
    const m = location.hash.match(/[#&]ex=([^&]+)/);
    return m ? decodeURIComponent(m[1]) : null;
  };
  const panelOf = (id) => panels.find((p) => p.dataset.ex === id) || null;
  let currentPanel = panelOf(hashExample()) || panels[0] || null;
  function showPanel(panel) {
    currentPanel = panel;
    const id = panel.dataset.ex;
    panels.forEach((p) => { p.hidden = p !== panel; });
    sourceSets.forEach((s) => { s.hidden = s.dataset.ex !== id; });
    pickButtons.forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.pick === id)));
  }
  if (currentPanel) showPanel(currentPanel);
  // The directory the machine boots in (also after Reboot)
  const labDir = currentPanel ? currentPanel.dataset.dir : document.body.dataset.labDir || "";

  const statusEl = document.getElementById("status");
  const BOOTING = { en: "Booting… (10–30 s)", ko: "부팅 중… (10~30초)" };
  const termEl = document.getElementById("terminal");
  const runButtons = Array.from(document.querySelectorAll("button[data-cmd]"));

  // Status line in the page's language; re-drawn when the reader switches.
  // setStatus({ en, ko })
  let ready = false;            // the guest shell is up
  let lastStatus = null;
  function setStatus(texts) {
    lastStatus = texts;
    statusEl.dataset.state = ready ? "ready" : "booting";
    statusEl.textContent = window.labLang ? window.labLang.t(texts) : texts.en;
  }
  document.addEventListener("langchange", () => {
    if (lastStatus) setStatus(lastStatus);
    const input = document.getElementById("download-name");
    const ko = window.labLang && window.labLang.get() === "ko";
    input.placeholder = ko ? "/mnt/host/파일 이름" : "/mnt/host/file name";
    input.setAttribute("aria-label", ko ? "받을 파일 이름 (/mnt/host 안)" : "File to download (in /mnt/host)");
  });

  // Size must match "stty rows 30 cols 100" in the guest's /etc/profile.d/lab.sh.
  const term = new Terminal({
    cols: 100,
    rows: 30,
    fontSize: 14,
    fontFamily: '"SF Mono", Menlo, Consolas, "DejaVu Sans Mono", "D2Coding", monospace',
    cursorBlink: true,
    scrollback: 5000,
    theme: { background: "#0f141b", foreground: "#d6dbe4" },
  });
  term.open(termEl);

  const emulator = new V86({
    wasm_path: root + "build/v86.wasm",
    memory_size: 256 * 1024 * 1024,
    vga_memory_size: 2 * 1024 * 1024,
    bios: { url: root + "bios/seabios.bin" },
    vga_bios: { url: root + "bios/vgabios.bin" },
    bzimage: { url: root + "images/bzImage" },
    initrd: { url: root + "images/rootfs.cpio.gz" },
    cmdline: "console=ttyS0 rdinit=/init loglevel=1" + (labDir ? " lab.dir=" + labDir : ""),
    // 9p filesystem, mounted at /mnt/9p in the guest.  Only the file list
    // (fs.json) is loaded at boot; a file's contents are fetched when the
    // guest first opens it.
    //   /py   -> /opt/py    (pandas, matplotlib, numpy: fetched on import)
    //   /host -> /mnt/host  (uploaded files, files to download)
    filesystem: {
      basefs: root + "images/9p/fs.json",
      baseurl: root + "images/9p/base/",
    },
    // Input goes through xterm.js only; keep v86 from grabbing page keys.
    disable_keyboard: true,
    disable_mouse: true,
    autostart: true,
  });

  // Guest -> terminal (batched per frame; raw bytes so UTF-8 decodes correctly)
  let pending = [];
  let tail = "";

  let recent = "";              // the last output, to see whether the shell waits at its prompt

  function markReady() {
    ready = true;
    runButtons.forEach((b) => { b.disabled = false; });
    setStatus({ en: "Ready — type in the terminal or press a ▶ button", ko: "준비됨 — 터미널에 입력하거나 ▶ 버튼을 누르세요" });
    // An example chosen during the boot (or before Reboot) is somewhere else.
    // The prompt follows the banner; wait for it (up to ~5 s).
    if (currentPanel && currentPanel.dataset.dir !== labDir) {
      let tries = 0;
      const later = () => (atPrompt() || ++tries > 50 ? changeDir(currentPanel) : setTimeout(later, 100));
      later();
    }
  }

  emulator.add_listener("serial0-output-byte", (byte) => {
    if (pending.length === 0) {
      requestAnimationFrame(() => {
        term.write(new Uint8Array(pending));
        pending = [];
      });
    }
    pending.push(byte);
    recent = (recent + String.fromCharCode(byte)).slice(-200);

    if (!ready) {
      // The login banner printed by lab.sh ends the boot.
      tail = (tail + String.fromCharCode(byte)).slice(-32);
      if (tail.includes("Lab -- ")) markReady();
    }
  });

  // Terminal -> guest
  const encoder = new TextEncoder();
  function sendToGuest(text) {
    emulator.serial_send_bytes(0, encoder.encode(text));
  }
  term.onData(sendToGuest);

  // ---------------------------------------------------------------- examples
  const atPrompt = () => /student@python-lab:[^\n]*\$ $/.test(recent.replace(/\x1b\[[0-9;?]*[A-Za-z]/g, ""));
  function changeDir(panel) {
    const dir = "~/" + panel.dataset.dir;
    if (!atPrompt()) {
      setStatus({
        en: `A program is still running — finish it (Ctrl+C, or exit() in the REPL), then run: cd ${dir}`,
        ko: `실행 중인 프로그램이 있습니다 — 끝낸 뒤(Ctrl+C, REPL은 exit()) 직접 실행하세요: cd ${dir}`,
      });
      return;
    }
    // A Flask app of the previous example would keep the preview busy.
    const preview = document.getElementById("preview");
    const appRunning = preview && !preview.hidden && !preview.classList.contains("stopped");
    sendToGuest((appRunning ? "web stop; " : "") + "cd " + dir + "\n");
    setStatus({ en: `Now in ${dir}`, ko: `${dir}로 이동했습니다` });
  }
  function pick(id, fromHash) {
    const panel = panelOf(id);
    if (!panel || panel === currentPanel) return;
    showPanel(panel);
    if (!fromHash) history.replaceState(null, "", "#ex=" + encodeURIComponent(id));
    if (ready) changeDir(panel);
  }
  pickButtons.forEach((b) => b.addEventListener("click", () => pick(b.dataset.pick, false)));
  window.addEventListener("hashchange", () => {
    const id = hashExample();
    if (id) pick(id, true);
  });

  runButtons.forEach((button) => {
    button.disabled = true;
    button.addEventListener("click", () => {
      sendToGuest(button.dataset.cmd + "\n");
      term.focus();
    });
  });

  emulator.add_listener("download-progress", (e) => {
    const name = (e.file_name || "").split("/").pop();
    if (e.total) {
      const pct = Math.floor((e.loaded / e.total) * 100);
      setStatus({ en: `Downloading: ${name} ${pct}%`, ko: `내려받는 중: ${name} ${pct}%` });
    } else {
      setStatus({ en: `Downloading: ${name}`, ko: `내려받는 중: ${name}` });
    }
  });
  emulator.add_listener("download-error", (e) => {
    setStatus({ en: `Could not download: ${e.file_name}`, ko: `파일을 내려받지 못했습니다: ${e.file_name}` });
  });
  emulator.add_listener("emulator-started", () => {
    if (!ready) setStatus(BOOTING);
  });

  document.getElementById("reset").addEventListener("click", () => {
    ready = false;
    tail = "";
    runButtons.forEach((b) => { b.disabled = true; });
    term.reset();
    setStatus(BOOTING);
    emulator.restart();
    term.focus();
  });

  // Page -> guest: files land in /mnt/host
  document.getElementById("upload").addEventListener("change", async (ev) => {
    const files = Array.from(ev.target.files);
    ev.target.value = "";
    try {
      for (const file of files) {
        const data = new Uint8Array(await file.arrayBuffer());
        await emulator.create_file("/host/" + file.name, data);
      }
      const list = files.map((f) => "/mnt/host/" + f.name).join(", ");
      setStatus({ en: `Uploaded: ${list}`, ko: `올림: ${list}` });
    } catch (err) {
      setStatus({ en: `Could not upload: ${err.message || err}`, ko: `파일을 올리지 못했습니다: ${err.message || err}` });
    }
  });

  // Guest -> page: save a file from /mnt/host to the student's computer
  document.getElementById("download-form").addEventListener("submit", async (ev) => {
    ev.preventDefault();
    const input = document.getElementById("download-name");
    const name = input.value.trim().replace(/^\/?mnt\/host\//, "").replace(/^\/+/, "");
    if (!name) {
      setStatus({ en: "Type the name of the file to download (first: cp file /mnt/host/)", ko: "받을 파일 이름을 입력하세요 (먼저 cp 파일 /mnt/host/)" });
      input.focus();
      return;
    }
    try {
      const data = await emulator.read_file("/host/" + name);
      const url = URL.createObjectURL(new Blob([data]));
      const a = document.createElement("a");
      a.href = url;
      a.download = name.split("/").pop();
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setStatus({ en: `Downloaded: /mnt/host/${name}`, ko: `받음: /mnt/host/${name}` });
    } catch (err) {
      const base = name.split("/").pop();
      setStatus({
        en: `No file /mnt/host/${name} — run cp ${base} /mnt/host/ in the terminal, then try again`,
        ko: `/mnt/host/${name} 파일이 없습니다 — 터미널에서 cp ${base} /mnt/host/ 후 다시 받으세요`,
      });
    }
  });

  // ---------------------------------------------------------------- app preview
  //
  // A Flask app in the guest listens on 127.0.0.1 only, and the guest has no
  // network link to this page.  "web start" (/usr/local/bin/web in the guest)
  // therefore also runs a bridge that talks to the page through the shared 9p
  // folder /mnt/host/.web (= /host/.web here):
  //   server.json   exists while an app runs           (guest writes)
  //   show.json     "web show PATH" asks us to show PATH (guest writes)
  //   req-<id>.json one request from this panel         (we write)
  //   res-<id>.json its answer, CSS and images inlined  (guest writes)
  const preview = document.getElementById("preview");
  if (preview) {
    const frame = document.getElementById("preview-frame");
    const pathInput = document.getElementById("preview-path");
    const info = document.getElementById("preview-info");
    const decoder = new TextDecoder();
    const t = (texts) => (window.labLang ? window.labLang.t(texts) : texts.en);
    let server = null;          // server.json of the running app
    let lastShow = null;        // seq of the last show.json handled
    let current = "/";          // path shown in the frame
    let seq = 0;
    let busy = false;
    let queued = null;          // the latest request made while one was loading
    let lastInfo = null;

    const setInfo = (texts) => {
      lastInfo = texts;
      info.textContent = t(texts);
    };
    document.addEventListener("langchange", () => lastInfo && setInfo(lastInfo));

    const readJson = async (p) => {
      try {
        return JSON.parse(decoder.decode(await emulator.read_file(p)));
      } catch (e) {
        return null;           // missing (or, rarely, being replaced)
      }
    };
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    const escHtml = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");

    async function navigate(path, method = "GET", body = null, type = null) {
      if (!server || server.state === "restarting") return;
      if (busy) {
        queued = [path, method, body, type];
        return;
      }
      busy = true;
      const id = `${Date.now()}-${++seq}`;
      setInfo({ en: `Loading ${path} …`, ko: `불러오는 중: ${path} …` });
      try {
        const req = { method, path, body, type };
        await emulator.create_file(`/host/.web/req-${id}.json`, encoder.encode(JSON.stringify(req)));
        let res = null;
        for (let i = 0; i < 800 && !res; i++) {     // up to ~2 minutes
          await sleep(150);
          res = await readJson(`/host/.web/res-${id}.json`);
        }
        if (!res) throw new Error("timeout");
        render(res);
      } catch (err) {
        setInfo({ en: "The app did not answer — is it still running? (web log)", ko: "앱이 응답하지 않습니다 — 서버가 켜져 있나요? (web log)" });
      } finally {
        busy = false;
        if (queued) {
          const next = queued;
          queued = null;
          navigate(...next);
        }
      }
    }

    function render(res) {
      current = res.path || "/";
      pathInput.value = current;
      const type = res.type || "";
      if (type.startsWith("text/html")) {
        frame.srcdoc = res.body;
      } else if (res.body64 && type.startsWith("image/")) {
        frame.srcdoc = `<img src="data:${type};base64,${res.body64}" alt="">`;
      } else {
        frame.srcdoc = `<pre style="white-space:pre-wrap">${escHtml(res.body ?? "(binary data)")}</pre>`;
      }
      const ok = res.status >= 200 && res.status < 400;
      setInfo({
        en: res.status ? `HTTP ${res.status}${ok ? "" : " (error)"} · ${current}` : res.body,
        ko: res.status ? `HTTP ${res.status}${ok ? "" : " (오류)"} · ${current}` : res.body,
      });
    }

    // Links and forms inside the preview go back through the bridge.  The
    // frame is sandboxed without scripts, so only these handlers (ours) run.
    const resolve = (href) => {
      const u = new URL(href, "http://app" + current);
      return u.host === "app" || u.hostname === "127.0.0.1" || u.hostname === "localhost"
        ? u.pathname + u.search
        : null;
    };
    frame.addEventListener("load", () => {
      const doc = frame.contentDocument;
      if (!doc) return;
      doc.addEventListener("click", (ev) => {
        const a = ev.target.closest && ev.target.closest("a[href]");
        if (!a) return;
        ev.preventDefault();
        const href = a.getAttribute("href");
        if (href.startsWith("#")) return;
        const p = resolve(href);
        if (p) navigate(p);
        else setInfo({ en: `External links do not open here: ${href}`, ko: `외부 링크는 여기서 열 수 없습니다: ${href}` });
      });
      doc.addEventListener("submit", (ev) => {
        ev.preventDefault();
        const form = ev.target;
        const params = new URLSearchParams(new FormData(form, ev.submitter || undefined));
        const method = (form.getAttribute("method") || "get").toUpperCase();
        const action = resolve(form.getAttribute("action") || current.split("?")[0]) || "/";
        if (method === "GET") navigate(action.split("?")[0] + (params.toString() ? "?" + params : ""));
        else navigate(action, method, params.toString(), "application/x-www-form-urlencoded");
      });
    });

    // Rebooting forgets the app (the guest clears /mnt/host/.web at boot).
    document.getElementById("reset").addEventListener("click", () => {
      server = null;
      preview.hidden = true;
    });

    document.getElementById("preview-form").addEventListener("submit", (ev) => {
      ev.preventDefault();
      let p = pathInput.value.trim() || "/";
      p = p.replace(/^https?:\/\/[^/]+/, "");
      navigate(p.startsWith("/") ? p : "/" + p);
    });

    // Watch for an app starting or stopping, and for "web show".
    (async function watch() {
      for (;;) {
        await sleep(1000);
        if (!ready) continue;
        const now = await readJson("/host/.web/server.json");
        const prev = server;
        if (now && now.state === "restarting") {
          // A file changed (or "web restart"): the guest restarts the app.
          if (!prev || prev.state !== "restarting") {
            server = now;
            preview.hidden = false;
            preview.classList.add("stopped");
            setInfo({ en: `${now.message} — restarting the app …`, ko: `${now.message} — 앱을 다시 시작하는 중 …` });
          }
        } else if (now && now.state === "error") {
          // The app did not start (e.g. a SyntaxError): show its log.
          if (!prev || prev.state !== "error" || prev.message !== now.message) {
            server = now;
            preview.hidden = false;
            preview.classList.remove("stopped");
            frame.srcdoc = `<pre style="white-space:pre-wrap;color:#b00020;margin:12px">${escHtml(now.message || "")}</pre>`;
            setInfo({ en: "The app stopped with an error — fix the code and save; it restarts by itself.", ko: "앱이 오류로 멈췄습니다 — 코드를 고쳐 저장하면 저절로 다시 시작합니다." });
          }
        } else if (now && (!prev || now.started !== prev.started || prev.state !== "running")) {
          server = now;
          preview.hidden = false;
          preview.classList.remove("stopped");
          document.getElementById("preview-port").textContent = `127.0.0.1:${now.port}`;
          // Same app restarted after an edit: reload the page being viewed.
          navigate(prev && prev.app === now.app ? current : "/");
        } else if (!now && server) {
          server = null;
          preview.classList.add("stopped");
          setInfo({ en: "The app has stopped (web start to run it again)", ko: "앱이 꺼졌습니다 (다시 띄우려면 web start)" });
        }
        const show = server && (await readJson("/host/.web/show.json"));
        if (show && show.seq !== lastShow) {
          lastShow = show.seq;
          navigate(show.path);
        }
      }
    })();
  }
})();
