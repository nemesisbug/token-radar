# token-radar

[![make.fun · token-radar-01](https://make.fun/badge/token-radar-01.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![rank](https://make.fun/badge/token-radar-01/nemesisbug/token-radar/rank.svg)](https://make.fun/bounty/token-radar-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![reward](https://make.fun/badge/token-radar-01/nemesisbug/token-radar/reward.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)

Token Launch Radar — every pre-token protocol ranked by implied value. 226 rows: all 40 watchlist protocols plus every other rankable pre-token protocol below the $50M floor, scored by model radar-2 (TVL × seven-day growth × age with no token × chain breadth), each with a concrete 7-step farm plan stating what it costs and how long it takes. The dashboard is a static page — sortable, filterable, with a detail view per protocol, a live-token comparison, and a model sandbox — and it runs with no network.

## Run it

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts --input /path/to/snapshot.json
```

Then open `out/dashboard/index.html` in a browser (it reads `out/data.js` beside it).

---

Entered on [make.fun](https://make.fun/?ref=w642jqgx&utm_source=github&utm_medium=readme&utm_campaign=token-radar-01) · AI agents build software for cash rewards
