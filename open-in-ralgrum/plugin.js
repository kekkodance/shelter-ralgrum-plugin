(function(exports) {

//#region rolldown:runtime
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __commonJS = (cb, mod) => function() {
	return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
};
var __copyProps = (to, from, except, desc) => {
	if (from && typeof from === "object" || typeof from === "function") for (var keys = __getOwnPropNames(from), i = 0, n = keys.length, key; i < n; i++) {
		key = keys[i];
		if (!__hasOwnProp.call(to, key) && key !== except) __defProp(to, key, {
			get: ((k) => from[k]).bind(null, key),
			enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable
		});
	}
	return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", {
	value: mod,
	enumerable: true
}) : target, mod));

//#endregion

//#region plugins/open-in-ralgrum/detectors.js
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
	"logout"
]);
const SOUNDCLOUD_PROFILE_TABS = new Set([
	"likes",
	"tracks",
	"popular-tracks",
	"reposts",
	"followers",
	"following"
]);
const SOUNDCLOUD_SECRET_SUFFIX_RE = /^s-.+$/i;
function normalizeType(raw) {
	raw = String(raw || "").toLowerCase();
	if (raw === "track" || raw === "album" || raw === "playlist" || raw === "artist") return raw;
	return null;
}
function parseDeezerUrl(url) {
	try {
		const raw = String(url || "");
		const parsed = new URL(raw);
		if (parsed.protocol !== "https:" || !DEEZER_HOST_RE.test(parsed.hostname)) return null;
		if (DEEZER_SHORT_HOST_RE.test(parsed.hostname)) return null;
		const segments = parsed.pathname.split("/").filter(Boolean);
		let offset = 0;
		if (segments.length === 3 && DEEZER_LOCALE_RE.test(segments[0])) offset = 1;
		if (segments.length !== 2 + offset) return null;
		const type = normalizeType(segments[offset]);
		const id = segments[offset + 1];
		if (!type || !/^\d+$/.test(id) || id === "0") return null;
		return {
			provider: "deezer",
			type,
			id,
			url: raw
		};
	} catch {
		return null;
	}
}
function soundcloudPathSegments(url) {
	try {
		const u = new URL(String(url));
		if (u.protocol !== "https:" || !SOUNDCLOUD_HOST_RE.test(u.hostname)) return null;
		return u.pathname.split("/").filter(Boolean);
	} catch {
		return null;
	}
}
function canonicalSoundcloudUrl(url) {
	try {
		const u = new URL(String(url));
		u.hostname = "soundcloud.com";
		u.hash = "";
		return u.toString();
	} catch {
		return String(url);
	}
}
function parseSoundcloudUrl(url) {
	const segs = soundcloudPathSegments(url);
	if (!segs || segs.length === 0 || SOUNDCLOUD_RESERVED_ROUTES.has(segs[0].toLowerCase())) return null;
	let type;
	if (segs.length === 1) type = "artist";
else {
		const second = segs[1].toLowerCase();
		if (second === "sets" || second === "albums") {
			if (segs.length !== 3 && !(segs.length === 4 && SOUNDCLOUD_SECRET_SUFFIX_RE.test(segs[3]))) return null;
			type = second === "sets" ? "playlist" : "album";
		} else {
			if (SOUNDCLOUD_PROFILE_TABS.has(second)) return null;
			if (segs.length !== 2 && !(segs.length === 3 && SOUNDCLOUD_SECRET_SUFFIX_RE.test(segs[2]))) return null;
			type = "track";
		}
	}
	return {
		provider: "soundcloud",
		type,
		id: null,
		url: canonicalSoundcloudUrl(url)
	};
}
function isShortlinkUrl(url) {
	try {
		const u = new URL(String(url));
		if (u.protocol !== "https:") return false;
		const host = u.hostname.toLowerCase();
		if (DEEZER_SHORT_HOST_RE.test(host)) return u.pathname.split("/").filter(Boolean).length > 0;
		if (SOUNDCLOUD_SHORT_HOST_RE.test(host)) return u.pathname.split("/").filter(Boolean).length > 0;
		return false;
	} catch {
		return false;
	}
}
function detectFromUrl(url) {
	return parseDeezerUrl(url) || parseSoundcloudUrl(url);
}
function classifyLink(url) {
	const entity = detectFromUrl(url);
	if (entity) return {
		kind: "entity",
		entity
	};
	if (isShortlinkUrl(url)) return {
		kind: "shortlink",
		url: String(url)
	};
	return { kind: null };
}
function defaultActionFor(entity) {
	if (!entity) return "open";
	return entity.type === "track" ? "play" : "open";
}
function buildRalgrumUrl(entity, opts) {
	if (!entity || !entity.provider || !entity.type || !entity.url) return null;
	const provider = String(entity.provider).toLowerCase();
	const type = normalizeType(entity.type);
	if (provider !== "deezer" && provider !== "soundcloud" || !type) return null;
	let action = opts && opts.action ? String(opts.action) : defaultActionFor(entity);
	if (action !== "play" && action !== "open") action = defaultActionFor(entity);
	const params = new URLSearchParams();
	params.set("provider", provider);
	params.set("type", type);
	if (entity.id) params.set("id", String(entity.id));
	params.set("action", action);
	params.set("url", String(entity.url));
	if (opts && opts.title) params.set("title", String(opts.title));
else if (entity.title) params.set("title", String(entity.title));
	const built = "ralgrum://open?" + params.toString();
	if (built.length > 2048) return null;
	return built;
}
function buildShortlinkRalgrumUrl(rawUrl) {
	let provider = null;
	try {
		const host = new URL(String(rawUrl)).hostname.toLowerCase();
		if (/(?:^|\.)(link\.deezer\.com|deezer\.page\.link)$/.test(host)) provider = "deezer";
else if (host === "on.soundcloud.com") provider = "soundcloud";
	} catch {
		return null;
	}
	if (!provider || !isShortlinkUrl(rawUrl)) return null;
	const params = new URLSearchParams();
	params.set("provider", provider);
	params.set("type", "track");
	params.set("action", "open");
	params.set("url", String(rawUrl));
	const built = "ralgrum://open?" + params.toString();
	if (built.length > 2048) return null;
	return built;
}

//#endregion
//#region plugins/open-in-ralgrum/marks.js
const MARK_ATTR = "data-ralgrum";
const REFRESH_EVENT = "open-in-ralgrum:refresh";
const TOOLTIP = "Open in ralgruM (Ctrl+Click for browser)";
const markedAnchors = new Map();
let seenHrefs = new WeakMap();
function shortlinkProvider(rawUrl) {
	try {
		const host = new URL(String(rawUrl)).hostname.toLowerCase();
		if (/(?:^|\.)(link\.deezer\.com|deezer\.page\.link)$/.test(host)) return "deezer";
		if (host === "on.soundcloud.com") return "soundcloud";
	} catch {}
	return null;
}
function isEntityEnabled(entity, store$1) {
	if (!entity) return false;
	if (store$1[entity.provider] === false) return false;
	if (entity.type === "track" && store$1.showTracks === false) return false;
	if ((entity.type === "album" || entity.type === "playlist") && store$1.showCollections === false) return false;
	if (entity.type === "artist" && store$1.showArtists === false) return false;
	return true;
}
function isShortlinkEnabled(href, store$1) {
	if (store$1.showTracks === false && store$1.showCollections === false && store$1.showArtists === false) return false;
	const provider = shortlinkProvider(href);
	return provider !== null && store$1[provider] !== false;
}
function shouldMark(href, classification, store$1) {
	if (classification.kind === "entity") return isEntityEnabled(classification.entity, store$1);
	if (classification.kind === "shortlink") return isShortlinkEnabled(href, store$1);
	return false;
}
function resetAnchor(a) {
	const originalTitle = markedAnchors.get(a);
	if (originalTitle === undefined) return;
	markedAnchors.delete(a);
	if (a.getAttribute(MARK_ATTR) === "1") a.removeAttribute(MARK_ATTR);
	if (a.getAttribute("title") === TOOLTIP) {
		if (originalTitle === null) a.removeAttribute("title");
else if (originalTitle !== TOOLTIP) a.setAttribute("title", originalTitle);
	}
}
function markAnchor(a) {
	try {
		if (!(a instanceof HTMLAnchorElement)) return;
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
				if (originalTitle !== TOOLTIP) a.setAttribute("title", TOOLTIP);
			}
		}
		if (markedAnchors.has(a) && a.getAttribute(MARK_ATTR) !== "1") a.setAttribute(MARK_ATTR, "1");
	} catch {}
}
function refreshAllMarks() {
	try {
		seenHrefs = new WeakMap();
		for (const a of markedAnchors.keys()) markAnchor(a);
		for (const a of document.querySelectorAll("a[href]")) markAnchor(a);
	} catch {}
}
function cleanupAllMarks() {
	try {
		for (const a of markedAnchors.keys()) resetAnchor(a);
		seenHrefs = new WeakMap();
	} catch {}
}
function emitRefresh() {
	try {
		window.dispatchEvent(new Event(REFRESH_EVENT));
	} catch {}
}

//#endregion
//#region solid-js/web
var require_web = __commonJS({ "solid-js/web"(exports, module) {
	module.exports = shelter.solidWeb;
} });

//#endregion
//#region plugins/open-in-ralgrum/settings.jsx
var import_web = __toESM(require_web(), 1);
var import_web$1 = __toESM(require_web(), 1);
var import_web$2 = __toESM(require_web(), 1);
const _tmpl$ = /*#__PURE__*/ (0, import_web.template)(`<br>`, 1);
const { SwitchItem, Header, Text, Divider } = shelter.ui;
const { HeaderTags, TextTags } = shelter.ui;
function toggle(key) {
	return (value) => {
		shelter.plugin.store[key] = value;
		emitRefresh();
	};
}
function SettingsPanel() {
	const store$1 = shelter.plugin.store;
	return [
		(0, import_web$1.createComponent)(Text, {
			get tag() {
				return TextTags.textSM;
			},
			style: {
				display: "block",
				"margin-bottom": "8px"
			},
			get children() {
				return [
					"Left-click opens links in ralgruM.",
					(0, import_web$2.getNextElement)(_tmpl$),
					"Ctrl/Cmd/Shift/Middle-click opens them in the browser."
				];
			}
		}),
		(0, import_web$1.createComponent)(Text, {
			get tag() {
				return TextTags.textSM;
			},
			style: {
				display: "block",
				"margin-bottom": "4px"
			},
			children: "If nothing happens, make sure the ralgrum:// protocol is registered."
		}),
		(0, import_web$1.createComponent)(Divider, {
			mt: true,
			mb: true
		}),
		(0, import_web$1.createComponent)(Header, {
			get tag() {
				return HeaderTags.H3;
			},
			children: "Providers"
		}),
		(0, import_web$1.createComponent)(SwitchItem, {
			get checked() {
				return store$1.deezer;
			},
			get onChange() {
				return toggle("deezer");
			},
			children: "Deezer links"
		}),
		(0, import_web$1.createComponent)(SwitchItem, {
			get checked() {
				return store$1.soundcloud;
			},
			get onChange() {
				return toggle("soundcloud");
			},
			children: "SoundCloud links"
		}),
		(0, import_web$1.createComponent)(Header, {
			get tag() {
				return HeaderTags.H3;
			},
			children: "Link kinds"
		}),
		(0, import_web$1.createComponent)(Text, {
			get tag() {
				return TextTags.textSM;
			},
			style: {
				display: "block",
				"margin-bottom": "8px"
			},
			children: "Share-link kinds are unknown until ralgruM resolves them. Individual kind switches cannot filter shares; turning all kinds off disables share links too."
		}),
		(0, import_web$1.createComponent)(SwitchItem, {
			get checked() {
				return store$1.showTracks;
			},
			get onChange() {
				return toggle("showTracks");
			},
			children: "Tracks"
		}),
		(0, import_web$1.createComponent)(SwitchItem, {
			get checked() {
				return store$1.showCollections;
			},
			get onChange() {
				return toggle("showCollections");
			},
			children: "Albums and playlists"
		}),
		(0, import_web$1.createComponent)(SwitchItem, {
			get checked() {
				return store$1.showArtists;
			},
			get onChange() {
				return toggle("showArtists");
			},
			children: "Artists"
		}),
		(0, import_web$1.createComponent)(Header, {
			get tag() {
				return HeaderTags.H3;
			},
			children: "Behavior"
		}),
		(0, import_web$1.createComponent)(SwitchItem, {
			note: "Toast every time a link is handed to ralgruM.",
			get checked() {
				return store$1.confirmToast;
			},
			get onChange() {
				return toggle("confirmToast");
			},
			children: "Confirm when opening"
		})
	];
}

//#endregion
//#region plugins/open-in-ralgrum/index.jsx
const { plugin: { store, scoped }, ui, util: { log } } = shelter;
const settings = SettingsPanel;
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
	return ui.ToastColors || {
		INFO: "info",
		SUCCESS: "success",
		WARNING: "warning",
		CRITICAL: "critical"
	};
}
function notifyError(content) {
	try {
		ui.showToast({
			title: "Open in ralgruM",
			content,
			color: toastColors().CRITICAL,
			duration: 4e3
		});
	} catch {}
}
function notifyInfo(title, content) {
	try {
		ui.showToast({
			title,
			content,
			color: toastColors().INFO,
			duration: 2500
		});
	} catch {}
}
function isPlainLeftClick(e) {
	if (e.button !== 0) return false;
	if (e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return false;
	return true;
}
function hijack(e) {
	e.preventDefault();
	e.stopPropagation();
	if (typeof e.stopImmediatePropagation === "function") e.stopImmediatePropagation();
}
function launch(ralgrumUrl) {
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
	if (store.confirmToast !== false) notifyInfo("Opening in ralgruM", "Ctrl+Click a link to open it in the browser instead.");
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
	if (pendingResolves.has(originalUrl)) return;
	pendingResolves.add(originalUrl);
	try {
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
		if (!loaded || e.defaultPrevented || !isPlainLeftClick(e)) return;
		const target = e.target;
		if (!(target instanceof Element)) return;
		const anchor = target.closest("a[href]");
		if (!anchor) return;
		const classification = classifyLink(anchor.href);
		if (classification.kind === null) return;
		if (classification.kind === "entity") {
			if (!isEntityEnabled(classification.entity, store)) return;
			hijack(e);
			openEntity(classification.entity, anchor);
			return;
		}
		if (!isShortlinkEnabled(anchor.href, store)) return;
		hijack(e);
		openShortlink(anchor.href);
	} catch {}
}
function handleObserved(node) {
	if (loaded) markAnchor(node);
}
function handleRefresh() {
	if (loaded) refreshAllMarks();
}
function onLoad() {
	if (loaded) return;
	ensureDefaults();
	loaded = true;
	scoped.onDispose(onUnload);
	document.addEventListener("click", handleClick, true);
	window.addEventListener(REFRESH_EVENT, handleRefresh);
	stopObserving = scoped.observeDom("a", handleObserved);
	refreshAllMarks();
	log("[open-in-ralgrum] listening for Deezer/SoundCloud links");
}
function onUnload() {
	if (!loaded) return;
	loaded = false;
	document.removeEventListener("click", handleClick, true);
	window.removeEventListener(REFRESH_EVENT, handleRefresh);
	stopObserving?.();
	stopObserving = undefined;
	pendingResolves.clear();
	cleanupAllMarks();
}

//#endregion
exports.onLoad = onLoad
exports.onUnload = onUnload
exports.settings = settings
return exports;
})({});