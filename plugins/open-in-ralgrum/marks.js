// DOM marking helpers shared by index.jsx (observer/click/unload)
// and settings.jsx (re-scan after toggles). No shelter imports at module
// top level except types; shelter global is read lazily so lune dev
// reloads and tests stay predictable.
import { classifyLink } from "./detectors.js";
import classes from "./styles.css";

export const MARK_ATTR = "ralgrum";
export const REFRESH_EVENT = "open-in-ralgrum:refresh";
export const TOOLTIP = "Open in ralgruM (Ctrl+Click for browser)";

export function shortlinkProvider(rawUrl) {
  try {
    const host = new URL(String(rawUrl)).hostname.toLowerCase();
    if (/(?:^|\.)(link\.deezer\.com|deezer\.page\.link)$/.test(host)) {
      return "deezer";
    }
    if (host === "on.soundcloud.com") {
      return "soundcloud";
    }
  } catch {
    // ignore, treated as unknown below
  }
  return null;
}

export function isEntityEnabled(entity, store) {
  if (!entity) {
    return false;
  }
  if (store[entity.provider] === false) {
    return false;
  }
  if (entity.type === "track" && store.showTracks === false) {
    return false;
  }
  if ((entity.type === "album" || entity.type === "playlist") && store.showCollections === false) {
    return false;
  }
  if (entity.type === "artist" && store.showArtists === false) {
    return false;
  }
  return true;
}

function shouldMark(href, classification, store) {
  if (classification.kind === "entity") {
    return isEntityEnabled(classification.entity, store);
  }
  if (classification.kind === "shortlink") {
    const provider = shortlinkProvider(href);
    return provider ? store[provider] !== false : false;
  }
  return false;
}

function resetAnchor(a) {
  const badge = a.querySelector(`.${classes.badge}`);
  if (badge) {
    badge.remove();
  }
  if (MARK_ATTR in a.dataset) {
    delete a.dataset[MARK_ATTR];
  }
  if ("ralgrumOrigTitle" in a.dataset) {
    a.title = a.dataset.ralgrumOrigTitle;
    delete a.dataset.ralgrumOrigTitle;
  }
}

export function markAnchor(a) {
  try {
    if (!(a instanceof HTMLAnchorElement)) {
      return;
    }
    if (MARK_ATTR in a.dataset) {
      return;
    }
    const store = shelter.plugin.store;
    const href = a.href;
    const classification = classifyLink(href);
    const mark = shouldMark(href, classification, store);
    a.dataset[MARK_ATTR] = mark ? "1" : "0";
    if (!mark) {
      return;
    }
    if (!("ralgrumOrigTitle" in a.dataset)) {
      a.dataset.ralgrumOrigTitle = a.title || "";
    }
    a.title = TOOLTIP;
  } catch {
    // Never let marking break Discord rendering.
  }
}

/** Re-evaluate every anchor (used on load and after settings changes). */
export function refreshAllMarks() {
  try {
    const anchors = document.querySelectorAll("a[href]");
    for (const a of anchors) {
      resetAnchor(a);
      markAnchor(a);
    }
  } catch {
    // ignore
  }
}

/** Remove all marks (plus pills left behind by older versions). */
export function cleanupAllMarks() {
  try {
    const marked = document.querySelectorAll(`a[data-${MARK_ATTR}]`);
    for (const a of marked) {
      resetAnchor(a);
    }
  } catch {
    // ignore
  }
}

export function emitRefresh() {
  try {
    window.dispatchEvent(new Event(REFRESH_EVENT));
  } catch {
    // ignore
  }
}
