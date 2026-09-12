// RalgrumDetectors for the shelter plugin.
//  - m.soundcloud.com explicitly supported (mobile subdomain)
//  - link.deezer.com / deezer.page.link treated as shortlinks that ralgruM
//    resolves natively (web pages cannot follow their redirects, CORS hides
//    cross origin redirect targets)
//  - on.soundcloud.com treated as a shortlink (never an artist)
// ralgrum URL format:
// ralgrum://open?provider=deezer&type=track&id=123&action=play&url=..&title=..

const DEEZER_HOST_RE = /^(?:[a-z0-9-]+\.)*deezer\.com$/i;
const DEEZER_LOCALE_RE = /^[a-z]{2}(?:-[a-z]{2})?$/i;
const DEEZER_SHORT_HOST_RE = /^(?:[a-z0-9-]+\.)*(?:link\.deezer\.com|deezer\.page\.link)$/i;
const SOUNDCLOUD_HOST_RE = /^(?:(?:www|m)\.)?soundcloud\.com$/i;
const SOUNDCLOUD_SHORT_HOST_RE = /^on\.soundcloud\.com$/i;
const SOUNDCLOUD_RESERVED_ROUTES = new Set([
  "you",
  "discover",
  "stream",
  "feed",
  "search",
  "upload",
  "settings",
  "charts",
  "stations",
  "pages",
  "terms",
  "imprint",
  "logout",
]);
const SOUNDCLOUD_PROFILE_TABS = new Set([
  "likes",
  "tracks",
  "popular-tracks",
  "reposts",
  "followers",
  "following",
]);
const SOUNDCLOUD_SECRET_SUFFIX_RE = /^s-.+$/i;

export function normalizeType(raw) {
  raw = String(raw || "").toLowerCase();
  if (raw === "track" || raw === "album" || raw === "playlist" || raw === "artist") {
    return raw;
  }
  return null;
}

export function parseDeezerUrl(url) {
  try {
    const raw = String(url || "");
    const parsed = new URL(raw);
    if (parsed.protocol !== "https:" || !DEEZER_HOST_RE.test(parsed.hostname)) {
      return null;
    }
    // Share shortlinks carry no numeric id; ralgruM resolves them natively.
    if (DEEZER_SHORT_HOST_RE.test(parsed.hostname)) {
      return null;
    }
    const segments = parsed.pathname.split("/").filter(Boolean);
    let offset = 0;
    if (segments.length === 3 && DEEZER_LOCALE_RE.test(segments[0])) {
      offset = 1;
    }
    if (segments.length !== 2 + offset) {
      return null;
    }
    const type = normalizeType(segments[offset]);
    const id = segments[offset + 1];
    if (!type || !/^\d+$/.test(id) || id === "0") {
      return null;
    }
    return { provider: "deezer", type, id, url: raw };
  } catch {
    return null;
  }
}

function soundcloudPathSegments(url) {
  try {
    const u = new URL(String(url));
    if (u.protocol !== "https:" || !SOUNDCLOUD_HOST_RE.test(u.hostname)) {
      return null;
    }
    return u.pathname.split("/").filter(Boolean);
  } catch {
    return null;
  }
}

/**
 * SoundCloud's api-v2 /resolve endpoint only resolves canonical
 * soundcloud.com permalinks. The accepted www. and m. permalink hosts
 * share the canonical path; other subdomains are not entity hosts.
 */
export function canonicalSoundcloudUrl(url) {
  try {
    const u = new URL(String(url));
    u.hostname = "soundcloud.com";
    u.hash = "";
    return u.toString();
  } catch {
    return String(url);
  }
}

export function parseSoundcloudUrl(url) {
  const segs = soundcloudPathSegments(url);
  if (!segs || segs.length === 0 || SOUNDCLOUD_RESERVED_ROUTES.has(segs[0].toLowerCase())) {
    return null;
  }

  let type;
  if (segs.length === 1) {
    type = "artist";
  } else {
    const second = segs[1].toLowerCase();
    if (second === "sets" || second === "albums") {
      // A profile's collection tab needs a resource slug to name one collection.
      if (segs.length !== 3 && !(segs.length === 4 && SOUNDCLOUD_SECRET_SUFFIX_RE.test(segs[3]))) {
        return null;
      }
      type = second === "sets" ? "playlist" : "album";
    } else {
      if (SOUNDCLOUD_PROFILE_TABS.has(second)) {
        return null;
      }
      // Private tracks add one opaque s-... suffix to the public permalink.
      if (segs.length !== 2 && !(segs.length === 3 && SOUNDCLOUD_SECRET_SUFFIX_RE.test(segs[2]))) {
        return null;
      }
      type = "track";
    }
  }
  return { provider: "soundcloud", type, id: null, url: canonicalSoundcloudUrl(url) };
}

/** True when the URL is a share shortlink that ralgruM resolves natively. */
export function isShortlinkUrl(url) {
  try {
    const u = new URL(String(url));
    if (u.protocol !== "https:") {
      return false;
    }
    const host = u.hostname.toLowerCase();
    if (DEEZER_SHORT_HOST_RE.test(host)) {
      return u.pathname.split("/").filter(Boolean).length > 0;
    }
    if (SOUNDCLOUD_SHORT_HOST_RE.test(host)) {
      return u.pathname.split("/").filter(Boolean).length > 0;
    }
    return false;
  } catch {
    return false;
  }
}

export function detectFromUrl(url) {
  return parseDeezerUrl(url) || parseSoundcloudUrl(url);
}

/**
 * Classify a link href for the click hijacker.
 * Returns { kind: "entity", entity }, { kind: "shortlink", url },
 * or { kind: null } when the URL is not ours.
 */
export function classifyLink(url) {
  const entity = detectFromUrl(url);
  if (entity) {
    return { kind: "entity", entity };
  }
  if (isShortlinkUrl(url)) {
    return { kind: "shortlink", url: String(url) };
  }
  return { kind: null };
}

export function defaultActionFor(entity) {
  if (!entity) {
    return "open";
  }
  return entity.type === "track" ? "play" : "open";
}

export function buildRalgrumUrl(entity, opts) {
  if (!entity || !entity.provider || !entity.type || !entity.url) {
    return null;
  }
  const provider = String(entity.provider).toLowerCase();
  const type = normalizeType(entity.type);
  if ((provider !== "deezer" && provider !== "soundcloud") || !type) {
    return null;
  }
  let action = opts && opts.action ? String(opts.action) : defaultActionFor(entity);
  if (action !== "play" && action !== "open") {
    action = defaultActionFor(entity);
  }
  const params = new URLSearchParams();
  params.set("provider", provider);
  params.set("type", type);
  if (entity.id) {
    params.set("id", String(entity.id));
  }
  params.set("action", action);
  params.set("url", String(entity.url));
  if (opts && opts.title) {
    params.set("title", String(opts.title));
  } else if (entity.title) {
    params.set("title", String(entity.title));
  }
  const built = "ralgrum://open?" + params.toString();
  if (built.length > 2048) {
    return null;
  }
  return built;
}

/**
 * Builds a ralgrum:// link for a share shortlink (link.deezer.com,
 * deezer.page.link, on.soundcloud.com). The entity kind is unknown until
 * ralgruM follows the redirect natively, so type is sent as a placeholder
 * the app corrects after resolving.
 */
export function buildShortlinkRalgrumUrl(rawUrl) {
  let provider = null;
  try {
    const host = new URL(String(rawUrl)).hostname.toLowerCase();
    if (/(?:^|\.)(link\.deezer\.com|deezer\.page\.link)$/.test(host)) {
      provider = "deezer";
    } else if (host === "on.soundcloud.com") {
      provider = "soundcloud";
    }
  } catch {
    return null;
  }
  if (!provider || !isShortlinkUrl(rawUrl)) {
    return null;
  }
  const params = new URLSearchParams();
  params.set("provider", provider);
  params.set("type", "track");
  params.set("action", "open");
  params.set("url", String(rawUrl));
  const built = "ralgrum://open?" + params.toString();
  if (built.length > 2048) {
    return null;
  }
  return built;
}
