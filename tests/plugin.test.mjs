import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { before, describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

import { createShelter } from "./helpers/shelter.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));
const shares = [
  { provider: "deezer", href: "https://link.deezer.com/s/AbC123?source=chat&label=a%26b" },
  { provider: "deezer", href: "https://deezer.page.link/AbC123" },
  { provider: "soundcloud", href: "https://on.soundcloud.com/AbC123" },
];
const canonical = [
  "https://www.deezer.com/track/123",
  "https://www.deezer.com/album/456",
  "https://www.deezer.com/playlist/789",
  "https://www.deezer.com/artist/27",
  "https://soundcloud.com/artist-name/track-name",
];

function assertMarked(anchor) {
  assert.match(
    anchor.getAttribute("title") ?? "",
    /ralgrum/i,
    "Eligible links advertise their handler",
  );
}

function assertPassThrough(result, prevented = false) {
  assert.equal(result.reachedSink, true, "The host still receives the original click");
  assert.equal(result.defaultPrevented, prevented, "The plugin does not cancel this click");
  assert.deepEqual(result.handoffs, [], "No external handoff should occur");
}

function assertHandoff(result, expected) {
  assert.equal(result.defaultPrevented, true, "The original browser navigation is cancelled");
  assert.equal(result.handoffs.length, 1, "Exactly one external navigation is emitted");
  const href = result.handoffs[0];
  const destination = new URL(href);
  assert.equal(destination.protocol, "ralgrum:");
  assert.equal(destination.hostname, "open");
  assert.match(href, /[?&]url=https%3A%2F%2F/, "The source URL is encoded as a query value");
  assert.deepEqual(Object.fromEntries(destination.searchParams), expected);
}

describe("built plugin DOM behavior", () => {
  let bundle;

  before(async () => {
    const output = await mkdtemp(join(tmpdir(), "ralgrum-plugin-test-"));
    try {
      // Use Lune's failure-propagating build command, not ci or a stale dist.
      // execFile and absolute argv avoid shell quoting and .cmd differences.
      await promisify(execFile)(
        process.execPath,
        [
          join(root, "node_modules", "@uwu", "lune", "dist", "clibundle.cjs"),
          "build",
          join(root, "plugins", "open-in-ralgrum"),
          "--to",
          output,
          "--cfg",
          join(root, "lune.config.js"),
        ],
        { cwd: root, windowsHide: true },
      );
      bundle = await readFile(join(output, "plugin.js"), "utf8");
    } finally {
      await rm(output, { recursive: true, force: true });
    }
  });

  it("reclassifies live href changes in both directions, including removal and re-add", async (t) => {
    const host = createShelter(t, bundle);
    const supported = host.link(canonical[0], { title: "Original host title" });
    const unsupported = host.link("https://example.com/unrelated");
    host.load();
    await host.flush();
    assertMarked(supported);
    assert.equal(unsupported.getAttribute("title"), null);

    supported.href = "https://example.com/changed";
    unsupported.href = canonical[0];
    await host.flush();
    assert.equal(supported.getAttribute("title"), "Original host title");
    assertPassThrough(host.click(supported));
    assertMarked(unsupported);
    assertHandoff(host.click(unsupported), {
      provider: "deezer",
      type: "track",
      id: "123",
      action: "play",
      url: canonical[0],
      title: "Open this link",
    });

    unsupported.removeAttribute("href");
    await host.flush();
    assert.equal(unsupported.getAttribute("title"), null);
    assertPassThrough(host.click(unsupported));
    unsupported.setAttribute("href", canonical[0]);
    await host.flush();
    assertMarked(unsupported);
    assertHandoff(host.click(unsupported), {
      provider: "deezer",
      type: "track",
      id: "123",
      action: "play",
      url: canonical[0],
      title: "Open this link",
    });
  });

  it("marks newly inserted mixed-case hosts and encodes text without creating markup", async (t) => {
    const host = createShelter(t, bundle);
    host.load();
    await host.flush();
    const title = '<img src="https://example.com/not-loaded" onerror="bad()"> & café + ?';
    const anchor = host.link("https://WWW.DEEZER.COM/track/123?label=a%26b&source=chat", {
      text: title,
    });
    await host.flush();
    assertMarked(anchor);
    assertHandoff(host.click(anchor), {
      provider: "deezer",
      type: "track",
      id: "123",
      action: "play",
      url: anchor.href,
      title,
    });
    assert.equal(anchor.textContent, title);
    assert.equal(host.document.querySelector("img"), null);
    await host.flush();
  });

  it("passes canonical and every share-link family through when all kinds are disabled", async (t) => {
    const host = createShelter(t, bundle, {
      showTracks: false,
      showCollections: false,
      showArtists: false,
    });
    const anchors = [...canonical, ...shares.map(({ href }) => href)].map((href) =>
      host.link(href),
    );
    host.load();
    await host.flush();
    for (const anchor of anchors) {
      assert.equal(anchor.getAttribute("title"), null, anchor.href);
      assertPassThrough(host.click(anchor));
    }
  });

  it("preserves provider opt-outs for canonical links and their share families", async (t) => {
    const host = createShelter(t, bundle, { deezer: false, soundcloud: false });
    const anchors = [canonical[0], canonical[4], ...shares.map(({ href }) => href)].map((href) =>
      host.link(href),
    );
    host.load();
    await host.flush();
    for (const anchor of anchors) {
      assert.equal(anchor.getAttribute("title"), null, anchor.href);
      assertPassThrough(host.click(anchor));
    }
  });

  it("hands each enabled share family directly to the native handler without fetching", async (t) => {
    const host = createShelter(t, bundle);
    const anchors = shares.map(({ href }) => host.link(href));
    host.load();
    await host.flush();
    for (let i = 0; i < anchors.length; i++) {
      assertMarked(anchors[i]);
      assertHandoff(host.click(anchors[i]), {
        provider: shares[i].provider,
        type: "track",
        action: "open",
        url: shares[i].href,
      });
    }
    await host.flush();
  });

  it("leaves modified, non-left and previously prevented clicks to the host", async (t) => {
    const host = createShelter(t, bundle);
    const anchors = [canonical[0], shares[2].href].map((href) => host.link(href));
    host.load();
    await host.flush();
    for (const anchor of anchors) {
      for (const init of [
        { ctrlKey: true },
        { metaKey: true },
        { shiftKey: true },
        { altKey: true },
        { button: 1 },
        { button: 2 },
      ]) {
        assertPassThrough(host.click(anchor, init));
      }
      assertPassThrough(host.click(anchor, { prevented: true }), true);
    }
    assertHandoff(host.click(anchors[0]), {
      provider: "deezer",
      type: "track",
      id: "123",
      action: "play",
      url: canonical[0],
      title: "Open this link",
    });
  });

  it("restores nullable, empty and explicit titles without suppressing inherited tooltips", async (t) => {
    const host = createShelter(t, bundle);
    const parent = host.document.createElement("div");
    parent.title = "Inherited host tooltip";
    host.document.body.append(parent);
    const inherited = host.link(canonical[0], { parent });
    const empty = host.link(canonical[0], { title: "" });
    const explicit = host.link(canonical[0], { title: "Host track details" });
    const unrelated = host.link("https://example.com", { title: "Unrelated host title" });
    host.load();
    await host.flush();
    for (const anchor of [inherited, empty, explicit]) assertMarked(anchor);
    assert.equal(unrelated.title, "Unrelated host title");
    host.unload();
    await host.flush();
    assert.equal(inherited.hasAttribute("title"), false);
    assert.equal(parent.title, "Inherited host tooltip");
    assert.equal(empty.getAttribute("title"), "");
    assert.equal(explicit.getAttribute("title"), "Host track details");
    assert.equal(unrelated.getAttribute("title"), "Unrelated host title");
  });

  it("preserves later host title edits and removals during href changes and unload", async (t) => {
    const host = createShelter(t, bundle);
    const changed = host.link(canonical[0], { title: "Old title" });
    const removed = host.link(canonical[0], { title: "Old title" });
    host.load();
    await host.flush();
    changed.title = "Host updated this title";
    removed.removeAttribute("title");
    await host.flush();
    assert.equal(changed.title, "Host updated this title");
    assert.equal(removed.getAttribute("title"), null);
    changed.href = "https://example.com";
    await host.flush();
    assert.equal(changed.title, "Host updated this title");
    host.unload();
    await host.flush();
    assert.equal(changed.title, "Host updated this title");
    assert.equal(removed.getAttribute("title"), null);
  });

  it("cleans detached subtrees before reinsertion, including unload before observer delivery", async (t) => {
    const host = createShelter(t, bundle);
    const wrapper = host.document.createElement("section");
    host.document.body.append(wrapper);
    const retained = host.link(canonical[0], { parent: wrapper, title: "Retained host title" });
    const immediate = host.link(canonical[0]);
    host.load();
    await host.flush();
    assertMarked(retained);
    assertMarked(immediate);
    wrapper.remove();
    await host.flush();
    assert.equal(retained.title, "Retained host title");
    host.document.body.append(wrapper);
    await host.flush();
    assertMarked(retained);

    // Neither removal has reached the observer when the host unloads the plugin.
    wrapper.remove();
    immediate.remove();
    host.unload();
    host.document.body.append(wrapper, immediate);
    await host.flush();
    assert.equal(retained.title, "Retained host title");
    assert.equal(immediate.hasAttribute("title"), false);
    assertPassThrough(host.click(retained));
    assertPassThrough(host.click(immediate));
  });

  it("reloads without duplicate handoffs and leaves subsequent links untouched after unload", async (t) => {
    const host = createShelter(t, bundle);
    const anchor = host.link(canonical[0]);
    for (let cycle = 0; cycle < 3; cycle++) {
      host.load();
      await host.flush();
      assertMarked(anchor);
      assertHandoff(host.click(anchor), {
        provider: "deezer",
        type: "track",
        id: "123",
        action: "play",
        url: canonical[0],
        title: "Open this link",
      });
      host.unload();
      await host.flush();
      assert.equal(anchor.hasAttribute("title"), false);
      assertPassThrough(host.click(anchor));
    }
    const later = host.link(canonical[0]);
    await host.flush();
    assert.equal(later.hasAttribute("title"), false);
    assertPassThrough(host.click(later));
  });

  it("settles observer work without repeatedly rewriting an unchanged tooltip", async (t) => {
    const host = createShelter(t, bundle);
    const anchor = host.link(canonical[0]);
    host.load();
    await host.flush();
    assertMarked(anchor);
    const titleChanges = [];
    const observer = new host.window.MutationObserver((records) => titleChanges.push(...records));
    observer.observe(anchor, { attributes: true, attributeFilter: ["title"] });
    t.after(() => observer.disconnect());
    host.document.body.append(host.document.createElement("div"));
    await host.flush();
    await host.flush();
    assert.deepEqual(
      titleChanges,
      [],
      "Unrelated host rendering must not rewrite a stable tooltip",
    );
    assertMarked(anchor);
  });
});
