const {
  plugin: { store, scoped },
  ui,
  util: { log },
} = shelter;

import { classifyLink, buildRalgrumUrl, buildShortlinkRalgrumUrl } from "./detectors.js";
import {
  markAnchor,
  refreshAllMarks,
  cleanupAllMarks,
  isEntityEnabled,
  isShortlinkEnabled,
  REFRESH_EVENT,
} from "./marks.js";
import { SettingsPanel } from "./settings.jsx";

export const settings = SettingsPanel;

let loaded = false;
let stopObserving;

function ensureDefaults() {
  store.deezer ??= true;
  store.soundcloud ??= true;
  store.showTracks ??= true;
  store.showCollections ??= true;
  store.showArtists ??= true;
  store.confirmToast ??= true;
}

function toastColors() {
  return (
    ui.ToastColors || { INFO: "info", SUCCESS: "success", WARNING: "warning", CRITICAL: "critical" }
  );
}

function notifyError(content) {
  try {
    ui.showToast({
      title: "Open in ralgruM",
      content,
      color: toastColors().CRITICAL,
      duration: 4000,
    });
  } catch {
    // ignore
  }
}

function notifyInfo(title, content) {
  try {
    ui.showToast({ title, content, color: toastColors().INFO, duration: 2500 });
  } catch {
    // ignore
  }
}

function isPlainLeftClick(e) {
  if (e.button !== 0) {
    return false;
  }
  if (e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) {
    return false;
  }
  return true;
}

function hijack(e) {
  e.preventDefault();
  e.stopPropagation();
  if (typeof e.stopImmediatePropagation === "function") {
    e.stopImmediatePropagation();
  }
}

function launch(ralgrumUrl) {
  // Route through a real anchor navigation with target=_blank so Discord's
  // Electron shell treats it as external and hands it to the OS protocol
  // handler every time. Plain location.href assignment is swallowed by the
  // renderer after the first external navigation and never reaches the OS.
  try {
    const a = document.createElement("a");
    a.href = ralgrumUrl;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    a.style.display = "none";
    document.documentElement.appendChild(a);
    a.click();
    a.remove();
  } catch {
    notifyError("Could not hand the link to ralgruM. Ctrl+Click opens it in the browser.");
    return;
  }
  if (store.confirmToast !== false) {
    notifyInfo("Opening in ralgruM", "Ctrl+Click a link to open it in the browser instead.");
  }
}

function openEntity(entity, anchor) {
  const title = (anchor && anchor.textContent ? anchor.textContent : "").trim().slice(0, 200);
  const ralgrumUrl = buildRalgrumUrl(entity, title ? { title } : undefined);
  if (!ralgrumUrl) {
    notifyError("That link is too long to send to ralgruM. Ctrl+Click opens it in the browser.");
    return;
  }
  launch(ralgrumUrl);
}

const pendingResolves = new Set();

function openShortlink(originalUrl) {
  if (pendingResolves.has(originalUrl)) {
    return;
  }
  pendingResolves.add(originalUrl);
  try {
    // Sent straight to ralgruM, which follows the redirect natively and
    // corrects the entity kind afterwards. No in-page resolving attempt:
    // Discord's web context cannot read cross origin redirect targets,
    // so fetching here would only stall the click on its timeout.
    const forwarded = buildShortlinkRalgrumUrl(originalUrl);
    if (!forwarded) {
      notifyError("Could not resolve that share link. Ctrl+Click opens it in the browser.");
      return;
    }
    launch(forwarded);
  } finally {
    pendingResolves.delete(originalUrl);
  }
}

function handleClick(e) {
  try {
    if (!loaded || e.defaultPrevented || !isPlainLeftClick(e)) {
      return;
    }
    const target = e.target;
    if (!(target instanceof Element)) {
      return;
    }
    const anchor = target.closest("a[href]");
    if (!anchor) {
      return;
    }
    const classification = classifyLink(anchor.href);
    if (classification.kind === null) {
      return;
    }
    if (classification.kind === "entity") {
      // Disabled providers/kinds are never hijacked: fall through to Discord/browser.
      if (!isEntityEnabled(classification.entity, store)) {
        return;
      }
      hijack(e);
      openEntity(classification.entity, anchor);
      return;
    }
    // Share kinds are unknown until native resolution; all kinds off still opts out.
    if (!isShortlinkEnabled(anchor.href, store)) {
      return;
    }
    hijack(e);
    openShortlink(anchor.href);
  } catch {
    // Never break Discord clicks on unexpected errors.
  }
}

function handleObserved(node) {
  if (loaded) {
    markAnchor(node);
  }
}

function handleRefresh() {
  if (loaded) {
    refreshAllMarks();
  }
}

export function onLoad() {
  if (loaded) {
    return;
  }
  ensureDefaults();
  loaded = true;
  scoped.onDispose(onUnload);

  document.addEventListener("click", handleClick, true);

  window.addEventListener(REFRESH_EVENT, handleRefresh);

  // Observe href removal and transitions as well as new links of any host casing.
  stopObserving = scoped.observeDom("a", handleObserved);

  // Mark links already on screen before the observer fires.
  refreshAllMarks();

  log("[open-in-ralgrum] listening for Deezer/SoundCloud links");
}

export function onUnload() {
  if (!loaded) {
    return;
  }
  loaded = false;
  document.removeEventListener("click", handleClick, true);
  window.removeEventListener(REFRESH_EVENT, handleRefresh);
  stopObserving?.();
  stopObserving = undefined;
  pendingResolves.clear();
  cleanupAllMarks();
}
