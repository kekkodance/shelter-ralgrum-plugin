const {
  plugin: { store, scoped },
  ui,
  util: { log },
} = shelter;

import { classifyLink, buildRalgrumUrl, buildShortlinkRalgrumUrl } from "./detectors.js";
import { markAnchor, refreshAllMarks, cleanupAllMarks, isEntityEnabled, shortlinkProvider, REFRESH_EVENT } from "./marks.js";
import { SettingsPanel } from "./settings.jsx";

export const settings = SettingsPanel;

const LINK_SELECTOR =
  'a[href*="deezer.com"]:not([data-ralgrum]),' +
  'a[href*="soundcloud.com"]:not([data-ralgrum]),' +
  'a[href*="deezer.page.link"]:not([data-ralgrum])';

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
    ui.showToast({ title: "Open in ralgruM", content, color: toastColors().CRITICAL, duration: 4000 });
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
    if (e.defaultPrevented) {
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
      if (!isPlainLeftClick(e)) {
        return;
      }
      hijack(e);
      openEntity(classification.entity, anchor);
      return;
    }
    // Shortlink: provider toggle decides hijack before anything else. The
    // host family implies the provider (see marks.js shortlinkProvider).
    // Disabled providers are never hijacked: fall through to the browser.
    const shortProvider = shortlinkProvider(anchor.href);
    if (shortProvider && store[shortProvider] === false) {
      return;
    }
    if (!isPlainLeftClick(e)) {
      return;
    }
    hijack(e);
    openShortlink(anchor.href);
  } catch {
    // Never break Discord clicks on unexpected errors.
  }
}

function handleObserved(node) {
  try {
    if (node instanceof HTMLAnchorElement) {
      markAnchor(node);
      return;
    }
    if (node && typeof node.querySelectorAll === "function") {
      const anchors = node.querySelectorAll("a[href]");
      for (const a of anchors) {
        markAnchor(a);
      }
    }
  } catch {
    // ignore
  }
}

export function onLoad() {
  ensureDefaults();

  document.addEventListener("click", handleClick, true);
  scoped.onDispose(() => document.removeEventListener("click", handleClick, true));

  const onRefresh = () => refreshAllMarks();
  window.addEventListener(REFRESH_EVENT, onRefresh);
  scoped.onDispose(() => window.removeEventListener(REFRESH_EVENT, onRefresh));

  scoped.observeDom(LINK_SELECTOR, handleObserved);

  // Mark links already on screen before the observer fires.
  refreshAllMarks();

  log("[open-in-ralgrum] listening for Deezer/SoundCloud links");
}

export function onUnload() {
  pendingResolves.clear();
  cleanupAllMarks();
}
