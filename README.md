<h1 align="center">
 Open in ralgruM (shelter)
</h1>

<div align="center">
  <img src="https://img.shields.io/github/actions/workflow/status/kekkodance/shelter-ralgrum-plugin/deploy.yml" />
  <img src="https://img.shields.io/github/actions/workflow/status/kekkodance/shelter-ralgrum-plugin/lint.yml?label=code quality" />

  <br/>

  <span>
    Shelter plugin that hijacks left-click on Deezer and SoundCloud links and opens them in the ralgruM desktop app via the `ralgrum://open` protocol instead of the browser.
  </span>
</div>


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

Open ralgruM at least once so it's protocol handler gets registered.

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
