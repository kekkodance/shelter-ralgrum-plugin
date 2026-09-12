// Tooltip ownership and eligibility shared by the observer, clicks, and settings.
import { classifyLink } from "./detectors.js";

const MARK_ATTR = "data-ralgrum";
export const REFRESH_EVENT = "open-in-ralgrum:refresh";
const TOOLTIP = "Open in ralgruM (Ctrl+Click for browser)";

// Only actively marked anchors are retained; all other href state is weak.
const markedAnchors = new Map();
let seenHrefs = new WeakMap();

function shortlinkProvider(rawUrl) {
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

export function isShortlinkEnabled(href, store) {
  if (
    store.showTracks === false &&
    store.showCollections === false &&
    store.showArtists === false
  ) {
    return false;
  }
  const provider = shortlinkProvider(href);
  return provider !== null && store[provider] !== false;
}

function shouldMark(href, classification, store) {
  if (classification.kind === "entity") {
    return isEntityEnabled(classification.entity, store);
  }
  if (classification.kind === "shortlink") {
    return isShortlinkEnabled(href, store);
  }
  return false;
}

function resetAnchor(a) {
  const originalTitle = markedAnchors.get(a);
  if (originalTitle === undefined) {
    return;
  }
  markedAnchors.delete(a);
  if (a.getAttribute(MARK_ATTR) === "1") {
    a.removeAttribute(MARK_ATTR);
  }
  // Discord may have replaced our tooltip while the anchor was marked.
  if (a.getAttribute("title") === TOOLTIP) {
    if (originalTitle === null) {
      a.removeAttribute("title");
    } else if (originalTitle !== TOOLTIP) {
      a.setAttribute("title", originalTitle);
    }
  }
}

export function markAnchor(a) {
  try {
    if (!(a instanceof HTMLAnchorElement)) {
      return;
    }
    if (!a.isConnected || !a.hasAttribute("href")) {
      seenHrefs.delete(a);
      resetAnchor(a);
      return;
    }
    const href = a.href;
    if (seenHrefs.get(a) !== href) {
      seenHrefs.set(a, href);
      if (!shouldMark(href, classifyLink(href), shelter.plugin.store)) {
        resetAnchor(a);
        return;
      }
      if (!markedAnchors.has(a)) {
        const originalTitle = a.getAttribute("title");
        markedAnchors.set(a, originalTitle);
        if (originalTitle !== TOOLTIP) {
          a.setAttribute("title", TOOLTIP);
        }
      }
    }
    if (markedAnchors.has(a) && a.getAttribute(MARK_ATTR) !== "1") {
      a.setAttribute(MARK_ATTR, "1");
    }
  } catch {
    // Never let marking break Discord rendering.
  }
}

/** Re-evaluate every anchor (used on load and after settings changes). */
export function refreshAllMarks() {
  try {
    seenHrefs = new WeakMap();
    // Include owners that lost href or were detached before observation ran.
    for (const a of markedAnchors.keys()) {
      markAnchor(a);
    }
    for (const a of document.querySelectorAll("a[href]")) {
      markAnchor(a);
    }
  } catch {
    // ignore
  }
}

/** Release every owned tooltip, including anchors outside the document. */
export function cleanupAllMarks() {
  try {
    for (const a of markedAnchors.keys()) {
      resetAnchor(a);
    }
    seenHrefs = new WeakMap();
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
