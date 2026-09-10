<h1 align="center">
  <img src="assets/ralgrum.png" width="48" height="48" valign="middle" />
  Open in ralgruM
</h1>

<div align="center">
  <img src="https://img.shields.io/github/actions/workflow/status/kekkodance/shelter-ralgrum-plugin/deploy.yml" />
  <img src="https://img.shields.io/github/actions/workflow/status/kekkodance/shelter-ralgrum-plugin/lint.yml?label=code%20quality" />

  <br/>

  <span>
    Shelter plugin that opens Deezer and SoundCloud links in the ralgruM desktop app via the <code>ralgrum://open</code> protocol.
  </span>
</div>

---

- Hijacks left-click actions. Ctrl/Cmd/Shift/middle-click still go to the browser.
- Supports canonical pages plus share shortlinks:
  `link.deezer.com`, `deezer.page.link`, `on.soundcloud.com`, and mobile
  `m.soundcloud.com`.
- Hijacked links show a tooltip. If ralgruM is missing, the
  click is blocked and a toast explains why.

## Install

You can install the plugin in shelter with `https://kekkodance.github.io/shelter-ralgrum-plugin/open-in-ralgrum`.

## Develop

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

Copyright © 2026 kekkodance. All rights reserved.
