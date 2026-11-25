"use strict";

// Shared by every lab page: boots 32-bit x86 Linux (BusyBox + Python 3) in
// v86 and connects its serial console to xterm.js.  The page tells us where
// the site root is and which directory under /home/student to start in:
//
//   <body data-root="../../" data-lab-dir="week03/starter/session1">
(function () {
  const root = document.body.dataset.root || "";
  const labDir = document.body.dataset.labDir || "";

  const statusEl = document.getElementById("status");
  const BOOTING = { en: "Booting… (10–30 s)", ko: "부팅 중… (10~30초)" };
  const termEl = document.getElementById("terminal");
  const runButtons = Array.from(document.querySelectorAll("button[data-cmd]"));

  // Status line in the page's language; re-drawn when the reader switches.
  // setStatus({ en, ko })
  let lastStatus = null;
  function setStatus(texts) {
    lastStatus = texts;
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
    theme: { background: "#0e1116", foreground: "#d6dbe4" },
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
    cmdline: "console=ttyS0 rdinit=/init loglevel=4" + (labDir ? " lab.dir=" + labDir : ""),
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
  let ready = false;

  function markReady() {
    ready = true;
    runButtons.forEach((b) => { b.disabled = false; });
    setStatus({ en: "Ready — type in the terminal or press a ▶ button", ko: "준비됨 — 터미널에 입력하거나 ▶ 버튼을 누르세요" });
  }

  emulator.add_listener("serial0-output-byte", (byte) => {
    if (pending.length === 0) {
      requestAnimationFrame(() => {
        term.write(new Uint8Array(pending));
        pending = [];
      });
    }
    pending.push(byte);

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
})();
