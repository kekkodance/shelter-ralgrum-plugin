import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  parseDeezerUrl,
  parseSoundcloudUrl,
  isShortlinkUrl,
  classifyLink,
  defaultActionFor,
  buildRalgrumUrl,
  buildShortlinkRalgrumUrl,
} from "../plugins/open-in-ralgrum/detectors.js";

describe("Deezer canonical pages (ported from browser-integration)", () => {
  it("parses supported bare and locale URLs", () => {
    assert.equal(parseDeezerUrl("https://www.deezer.com/us/track/3135556").id, "3135556");
    assert.equal(parseDeezerUrl("https://www.deezer.com/track/3135556").type, "track");
    assert.equal(parseDeezerUrl("https://listen.deezer.com/album/302127").type, "album");
  });

  it("parses album, playlist, and artist entity paths", () => {
    assert.equal(parseDeezerUrl("https://www.deezer.com/album/302127").type, "album");
    assert.equal(parseDeezerUrl("https://www.deezer.com/playlist/13743145521").type, "playlist");
    assert.equal(parseDeezerUrl("https://www.deezer.com/artist/27").type, "artist");
  });

  it("requires HTTPS, an allowed host, and one exact entity path", () => {
    assert.equal(parseDeezerUrl("http://www.deezer.com/track/3135556"), null);
    assert.equal(parseDeezerUrl("https://notdeezer.com/track/3135556"), null);
    assert.equal(parseDeezerUrl("https://deezer.com.evil.example/track/3135556"), null);
    assert.equal(parseDeezerUrl("https://www.deezer.com/track/0"), null);
    assert.equal(parseDeezerUrl("https://www.deezer.com/search?q=test"), null);
  });

  it("rejects share shortlinks from canonical parsing", () => {
    assert.equal(parseDeezerUrl("https://link.deezer.com/s/34mrzDee5J0nOnvPzHHPH"), null);
  });
});

describe("SoundCloud pages", () => {
  it("serializes complete public artist, track, playlist, and album permalinks", () => {
    for (const [path, type, action] of [
      ["someartist", "artist", "open"],
      ["someartist/some-track", "track", "play"],
      ["someartist/sets/some-mix", "playlist", "open"],
      ["someartist/albums/some-album", "album", "open"],
    ]) {
      const href = `https://soundcloud.com/${path}`;
      const result = classifyLink(href);
      assert.equal(result.kind, "entity", path);
      const params = new URL(buildRalgrumUrl(result.entity)).searchParams;
      assert.equal(params.get("type"), type, path);
      assert.equal(params.get("action"), action, path);
      assert.equal(params.get("url"), href, path);
    }
  });

  it("canonicalizes supported mobile and www hosts without losing secret queries", () => {
    const path = "/someartist/some-track/?secret_token=s-aBc123&si=a%2Bb&utm_source=clipboard";
    for (const host of ["M.SoUnDcLoUd.CoM", "WWW.SOUNDCLOUD.COM"]) {
      const result = classifyLink(`https://${host}${path}#t=1:23`);
      assert.equal(result.kind, "entity", host);
      const params = new URL(buildRalgrumUrl(result.entity)).searchParams;
      assert.equal(params.get("provider"), "soundcloud");
      assert.equal(params.get("type"), "track");
      assert.equal(params.get("action"), "play");
      assert.equal(params.get("url"), `https://soundcloud.com${path}`);
    }
  });

  it("leaves nonmusic subdomains and lookalike hosts to browser navigation", () => {
    for (const href of [
      "https://help.soundcloud.com/hc/en-us",
      "https://developers.soundcloud.com/docs",
      "https://secure.soundcloud.com/authorize",
      "https://arbitrary.soundcloud.com/someartist/some-track",
      "https://nested.m.soundcloud.com/someartist/some-track",
      "https://notsoundcloud.com/someartist/some-track",
      "https://soundcloud.com.evil.example/someartist/some-track",
      "http://soundcloud.com/someartist/some-track",
    ]) {
      assert.equal(classifyLink(href).kind, null, href);
    }
  });

  it("rejects reserved top-level routes", () => {
    for (const route of [
      "you",
      "discover",
      "stream",
      "feed",
      "feed/likes",
      "search",
      "upload",
      "settings",
    ]) {
      assert.equal(classifyLink(`https://soundcloud.com/${route}`).kind, null, route);
    }
  });

  it("does not mistake profile tabs for tracks or individual collections", () => {
    for (const tab of [
      "likes",
      "tracks",
      "popular-tracks",
      "reposts",
      "followers",
      "following",
      "sets",
      "albums",
    ]) {
      assert.equal(classifyLink(`https://soundcloud.com/soundcloud/${tab}`).kind, null, tab);
    }
    assert.equal(classifyLink("https://soundcloud.com/soundcloud/likes/s-aBc123").kind, null);
  });

  it("requires complete resource shapes rather than any nested path or sets segment", () => {
    for (const path of [
      "someartist/some-track/extra",
      "someartist/some-track/sets",
      "someartist/some-track/s-",
      "someartist/some-track/s-aBc123/extra",
      "someartist/sets/some-mix/extra",
      "someartist/albums/some-album/s-",
      "someartist/sets/some-mix/s-aBc123/extra",
    ]) {
      assert.equal(classifyLink(`https://soundcloud.com/${path}`).kind, null, path);
    }
  });

  it("preserves private track and collection suffixes through native serialization", () => {
    for (const [path, type, action] of [
      ["someartist/some-track/s-aBc123", "track", "play"],
      ["someartist/sets/some-mix/s-aBc123", "playlist", "open"],
      ["someartist/albums/some-album/s-aBc123", "album", "open"],
    ]) {
      const canonical = `https://soundcloud.com/${path}?secret_token=s-aBc123&si=a%2Bb`;
      const result = classifyLink(`${canonical}#t=1:23`);
      assert.equal(result.kind, "entity", path);
      const params = new URL(buildRalgrumUrl(result.entity)).searchParams;
      assert.equal(params.get("type"), type, path);
      assert.equal(params.get("action"), action, path);
      assert.equal(params.get("url"), canonical, path);
    }
  });

  it("treats on.soundcloud.com share links as resolvable, never artists", () => {
    assert.equal(parseSoundcloudUrl("https://on.soundcloud.com/AbC123"), null);
    assert.equal(isShortlinkUrl("https://on.soundcloud.com/AbC123"), true);
    assert.equal(classifyLink("https://on.soundcloud.com/AbC123").kind, "shortlink");
  });
});

describe("link classification", () => {
  it("classifies canonical links as entities", () => {
    assert.equal(classifyLink("https://www.deezer.com/track/3135556").kind, "entity");
    assert.equal(classifyLink("https://soundcloud.com/a/b").kind, "entity");
  });

  it("classifies share shortlinks", () => {
    assert.equal(classifyLink("https://link.deezer.com/s/34mrzDee5J0nOnvPzHHPH").kind, "shortlink");
    assert.equal(isShortlinkUrl("https://link.deezer.com/s/34mrzDee5J0nOnvPzHHPH"), true);
  });

  it("ignores unrelated links", () => {
    assert.equal(classifyLink("https://example.com/foo").kind, null);
    assert.equal(classifyLink("https://www.youtube.com/watch?v=x").kind, null);
  });
});

describe("ralgrum links", () => {
  it("defaults tracks to play and collections to open", () => {
    const track = buildRalgrumUrl({
      provider: "deezer",
      type: "track",
      id: "1",
      url: "https://www.deezer.com/track/1",
    });
    const album = buildRalgrumUrl({
      provider: "deezer",
      type: "album",
      id: "2",
      url: "https://www.deezer.com/album/2",
    });
    assert.match(track, /action=play/);
    assert.match(album, /action=open/);
    assert.equal(defaultActionFor({ type: "track" }), "play");
    assert.equal(defaultActionFor({ type: "artist" }), "open");
  });

  it("rejects overlong links the app would drop", () => {
    const built = buildRalgrumUrl(
      { provider: "deezer", type: "track", id: "1", url: "https://www.deezer.com/track/1" },
      { title: "x".repeat(5000) },
    );
    assert.equal(built, null);
  });

  it("forwards share shortlinks to the app without an id", () => {
    const deezer = buildShortlinkRalgrumUrl("https://link.deezer.com/s/34mrzDee5J0nOnvPzHHPH");
    const parsedDeezer = new URL(deezer);
    assert.equal(parsedDeezer.searchParams.get("provider"), "deezer");
    assert.equal(parsedDeezer.searchParams.get("id"), null);
    assert.equal(
      parsedDeezer.searchParams.get("url"),
      "https://link.deezer.com/s/34mrzDee5J0nOnvPzHHPH",
    );
    const soundcloud = buildShortlinkRalgrumUrl("https://on.soundcloud.com/AbC123");
    assert.equal(new URL(soundcloud).searchParams.get("provider"), "soundcloud");
    assert.equal(buildShortlinkRalgrumUrl("https://www.deezer.com/track/1"), null);
    assert.equal(buildShortlinkRalgrumUrl("https://example.com/x"), null);
  });
});
