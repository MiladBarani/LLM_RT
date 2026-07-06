const KEY_ENABLED = "claudeRtlEnabled";
const KEY_DISABLED_HOSTS = "claudeRtlDisabledHosts";

const master = document.getElementById("master");
const site = document.getElementById("site");
const hostEl = document.getElementById("host");
const statusEl = document.getElementById("status");

let host = null;
let state = { enabled: true, disabledHosts: {} };

// دامنه‌ی تب فعال را با activeTab می‌خوانیم
function getActiveHost() {
  return new Promise((resolve) => {
    try {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        try {
          const url = tabs && tabs[0] && tabs[0].url;
          const u = new URL(url);
          if (u.protocol === "http:" || u.protocol === "https:") {
            return resolve(u.hostname);
          }
        } catch (e) {}
        resolve(null);
      });
    } catch (e) {
      resolve(null);
    }
  });
}

function render() {
  const masterOn = state.enabled !== false;
  master.checked = masterOn;

  const siteOn = host ? !state.disabledHosts[host] : false;
  site.checked = masterOn && siteOn;
  site.disabled = !host || !masterOn;
  hostEl.textContent = host || "این صفحه پشتیبانی نمی‌شود";

  if (!masterOn) statusEl.textContent = "افزونه به‌طور کامل خاموش است.";
  else if (!host) statusEl.textContent = "روی این صفحه قابل‌اعمال نیست.";
  else if (siteOn) statusEl.textContent = "روشن — متن فارسی این سایت اصلاح می‌شود.";
  else statusEl.textContent = "در این سایت خاموش است.";
}

async function init() {
  host = await getActiveHost();
  chrome.storage.local.get(
    { [KEY_ENABLED]: true, [KEY_DISABLED_HOSTS]: {} },
    (res) => {
      state.enabled = res[KEY_ENABLED];
      state.disabledHosts = res[KEY_DISABLED_HOSTS] || {};
      render();
    }
  );
}

master.addEventListener("change", () => {
  state.enabled = master.checked;
  chrome.storage.local.set({ [KEY_ENABLED]: state.enabled }, render);
});

site.addEventListener("change", () => {
  if (!host) return;
  const dh = Object.assign({}, state.disabledHosts);
  if (site.checked) delete dh[host];
  else dh[host] = true;
  state.disabledHosts = dh;
  chrome.storage.local.set({ [KEY_DISABLED_HOSTS]: dh }, render);
});

init();
