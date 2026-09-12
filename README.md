<h1 align="center">
  Open in <img src="assets/ralgrum.png" width="48" height="48" valign="middle" /> ralgruM
</h1>

<div align="center">
  <img src="https://img.shields.io/github/actions/workflow/status/kekkodance/shelter-ralgrum-plugin/deploy.yml?label=checks%20%26%20deploy" />

  <br/>

  <span>
    Shelter plugin that opens Deezer and SoundCloud links in the ralgruM desktop app via the <code>ralgrum://open</code> protocol.
  </span>
</div>

---

- Hijacks plain left-click actions. Ctrl/Cmd/Shift/Alt/middle-click still go to the browser.
- Supports canonical pages plus share shortlinks:  
  `link.deezer.com`, `deezer.page.link`, `on.soundcloud.com`, and `m.soundcloud.com`.
- SoundCloud profile tabs, navigation pages, and non-music subdomains stay in the browser.


## Install

You can install the plugin in shelter with `https://kekkodance.github.io/shelter-ralgrum-plugin/open-in-ralgrum`.

## Develop

Use Node.js 24 LTS (recommended). The supported range is
`^20.19.0 || ^22.13.0 || >=24`.

```powershell
npm i
npm run dev
```

Enable Lune Dev Mode in Discord (shelter settings).

Open ralgruM at least once so its protocol handler gets registered.

## Build / host locally

```powershell
npm run build
npx http-server dist/ --cors
```

Install in shelter with `http://localhost:8080/open-in-ralgrum`.

## Test

```powershell
npm test
```

The suite covers URL parsing and the built plugin's click, tooltip, settings, and
unload behavior in an isolated DOM. It does not launch the native app.

The combined CI workflow runs lint, tests, and the production build. Only a successful
main-branch run can publish its checked artifact; superseded revisions are skipped.

Copyright © 2026 kekkodance. All rights reserved. See LICENSE.
