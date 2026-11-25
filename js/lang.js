"use strict";

// Language switch shared by every page.  Pages carry both languages as
// <span lang="en">…</span><span lang="ko">…</span>; css/style.css shows the
// one named by <html data-lang>.  English is the default; the reader's
// choice is remembered in this browser.  Loaded in <head> (before the body is
// drawn) so the page never flashes the other language.
(function () {
  const KEY = "python-lab-lang";
  const html = document.documentElement;

  function stored() {
    try {
      const v = localStorage.getItem(KEY);
      return v === "ko" || v === "en" ? v : null;
    } catch (e) {
      return null;
    }
  }

  function apply(lang) {
    html.dataset.lang = lang;
    html.lang = lang;
    const title = html.dataset["title" + (lang === "ko" ? "Ko" : "En")];
    if (title) document.title = title;
    document.querySelectorAll("[data-set-lang]").forEach((b) => {
      b.setAttribute("aria-pressed", String(b.dataset.setLang === lang));
    });
    document.dispatchEvent(new CustomEvent("langchange", { detail: lang }));
  }

  // Text in the current language, for scripts: lab.lang.t({ en, ko }).
  window.labLang = {
    get: () => html.dataset.lang || "en",
    t: (texts) => texts[html.dataset.lang] || texts.en,
  };

  apply(stored() || "en");

  document.addEventListener("DOMContentLoaded", () => {
    apply(html.dataset.lang);
    document.querySelectorAll("[data-set-lang]").forEach((b) => {
      b.addEventListener("click", () => {
        try {
          localStorage.setItem(KEY, b.dataset.setLang);
        } catch (e) {
          /* private mode: the choice lasts for this page only */
        }
        apply(b.dataset.setLang);
      });
    });
  });
})();
