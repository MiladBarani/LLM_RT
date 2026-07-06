/*
 * Claude RTL — اصلاح متن دوطرفه (همه‌منظوره، با پشتیبانی iframe و Shadow DOM)
 * -----------------------------------------------------------------------------
 * بلاک‌های متنیِ دارای فارسی/عربی را در همه‌ی سایت‌ها راست‌به‌چپ می‌کند،
 * حتی اگر محتوا داخل Shadow DOM (وب‌کامپوننت) یا iframe باشد.
 * کد و عناصر تعاملی (ویجت، دکمه، کادر ویرایش) دست‌نخورده می‌مانند.
 *
 * کنترل‌ها:
 *   - claudeRtlEnabled        : کلید کلی (روشن/خاموش در همه‌جا)
 *   - claudeRtlDisabledHosts  : فهرست دامنه‌هایی که افزونه در آن‌ها خاموش است
 */
(() => {
  "use strict";

  const KEY_ENABLED = "claudeRtlEnabled";
  const KEY_DISABLED_HOSTS = "claudeRtlDisabledHosts";

  const RTL_RE =
    /[\u0590-\u05FF\u0600-\u06FF\u0700-\u074F\u0750-\u077F\u08A0-\u08FF\uFB1D-\uFDFF\uFE70-\uFEFF]/;

  const TEXT_SELECTOR =
    "p, li, h1, h2, h3, h4, h5, h6, blockquote, td, th, dd, dt, summary, figcaption, div.paragraph";

  const SKIP_INSIDE =
    'pre, code, kbd, samp, [contenteditable="true"], textarea, input, button, [role="textbox"], [role="button"]';

  const HOST = location.hostname;

  let active = false;
  let state = { enabled: true, disabledHosts: {} };

  let observers = [];
  let observedRoots = new Set(); // ریشه‌هایی که رصد می‌شوند (document + shadow roots)

  function computeShouldBeActive() {
    return state.enabled !== false && !state.disabledHosts[HOST];
  }

  function hasRTL(text) {
    return !!text && RTL_RE.test(text);
  }

  // جمع‌آوری همه‌ی ریشه‌ها: خودِ document به‌علاوه‌ی همه‌ی shadow rootهای تو در تو
  function deepRoots() {
    const out = [document];
    const stack = [document];
    while (stack.length) {
      const root = stack.pop();
      let els;
      try {
        els = root.querySelectorAll("*");
      } catch (e) {
        continue;
      }
      for (const el of els) {
        if (el.shadowRoot) {
          out.push(el.shadowRoot);
          stack.push(el.shadowRoot);
        }
      }
    }
    return out;
  }

  function fixBlock(el) {
    if (el.closest && el.closest(SKIP_INSIDE)) return;
    if (hasRTL(el.textContent)) {
      if (el.getAttribute("dir") !== "rtl") {
        el.setAttribute("dir", "rtl");
        el.classList.add("cbf-rtl");
      }
    }
  }

  function ensureObserved(root) {
    if (observedRoots.has(root)) return;
    observedRoots.add(root);
    const obs = new MutationObserver(scheduleFix);
    try {
      obs.observe(root, { childList: true, subtree: true, characterData: true });
      observers.push(obs);
    } catch (e) {}
  }

  function applyFix() {
    const roots = deepRoots();
    for (const root of roots) {
      ensureObserved(root);
      try {
        root.querySelectorAll(TEXT_SELECTOR).forEach(fixBlock);
      } catch (e) {}
    }
  }

  function undoFix() {
    deepRoots().forEach((root) => {
      try {
        root.querySelectorAll(".cbf-rtl").forEach((el) => {
          el.removeAttribute("dir");
          el.classList.remove("cbf-rtl");
        });
      } catch (e) {}
    });
  }

  // throttle برای حفظ کارایی هنگام استریم/تغییرات زیاد
  let lastRun = 0;
  let timer = null;
  const DELAY = 150;
  function scheduleFix() {
    const now = Date.now();
    const elapsed = now - lastRun;
    if (elapsed >= DELAY) {
      lastRun = now;
      applyFix();
    } else if (!timer) {
      timer = setTimeout(() => {
        timer = null;
        lastRun = Date.now();
        applyFix();
      }, DELAY - elapsed);
    }
  }

  function start() {
    document.documentElement.classList.add("cbf-on");
    applyFix(); // اولین اجرا، که خودش ریشه‌ها را هم رصد می‌کند
  }

  function stop() {
    observers.forEach((o) => o.disconnect());
    observers = [];
    observedRoots = new Set();
    document.documentElement.classList.remove("cbf-on");
    undoFix();
  }

  function refresh() {
    const shouldBe = computeShouldBeActive();
    if (shouldBe && !active) {
      active = true;
      start();
    } else if (!shouldBe && active) {
      active = false;
      stop();
    }
  }

  chrome.storage.local.get(
    { [KEY_ENABLED]: true, [KEY_DISABLED_HOSTS]: {} },
    (res) => {
      state.enabled = res[KEY_ENABLED];
      state.disabledHosts = res[KEY_DISABLED_HOSTS] || {};
      refresh();
    }
  );

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "local") return;
    if (changes[KEY_ENABLED]) state.enabled = changes[KEY_ENABLED].newValue;
    if (changes[KEY_DISABLED_HOSTS])
      state.disabledHosts = changes[KEY_DISABLED_HOSTS].newValue || {};
    refresh();
  });
})();
