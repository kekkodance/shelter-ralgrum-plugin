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
  it("detects artist, track, playlist, and album shapes", () => {
    assert.equal(parseSoundcloudUrl("https://soundcloud.com/someartist").type, "artist");
    assert.equal(parseSoundcloudUrl("https://soundcloud.com/someartist/some-track").type, "track");
    assert.equal(parseSoundcloudUrl("https://soundcloud.com/someartist/sets/some-mix").type, "playlist");
    assert.equal(parseSoundcloudUrl("https://soundcloud.com/someartist/albums/some-album").type, "album");
  });

  it("supports the mobile subdomain", () => {
    const entity = parseSoundcloudUrl("https://m.soundcloud.com/sloobymusic/thebassisnowgoingtodrop");
    assert.equal(entity.type, "track");
    assert.equal(entity.provider, "soundcloud");
  });

  it("canonicalizes entity URLs to soundcloud.com for api-v2 resolve", () => {
    const entity = parseSoundcloudUrl("https://m.soundcloud.com/sloobymusic/thebassisnowgoingtodrop");
    assert.equal(entity.url, "https://soundcloud.com/sloobymusic/thebassisnowgoingtodrop");
    const link = buildRalgrumUrl(entity);
    assert.match(link, /url=https%3A%2F%2Fsoundcloud\.com%2Fsloobymusic%2Fthebassisnowgoingtodrop/);
  });

  it("rejects reserved top-level routes", () => {
    for (const route of ["you", "discover", "stream", "search", "upload", "settings"]) {
      assert.equal(parseSoundcloudUrl(`https://soundcloud.com/${route}`), null, route);
    }
  });

  it("treats on.soundcloud.com share links as resolvable, never artists", () => {
    assert.equal(parseSoundcloudUrl("https://on.soundcloud.com/AbC123"), null);
    assert.equal(isShortlinkUrl("https://on.soundcloud.com/AbC123"), true);
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
      provider: "deezer", type: "track", id: "1", url: "https://www.deezer.com/track/1",
    });
    const album = buildRalgrumUrl({
      provider: "deezer", type: "album", id: "2", url: "https://www.deezer.com/album/2",
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
