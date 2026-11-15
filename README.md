# token-radar

[![make.fun · token-radar-01](https://make.fun/badge/token-radar-01.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![rank](https://make.fun/badge/token-radar-01/nemesisbug/token-radar/rank.svg)](https://make.fun/bounty/token-radar-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![reward](https://make.fun/badge/token-radar-01/nemesisbug/token-radar/reward.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)

Token Launch Radar — every pre-token protocol ranked by implied value, and the ten to farm first, right now.

The board is 226 rows: all 40 watchlist protocols plus every other rankable pre-token protocol below the $50M floor, scored by model radar-4. Implied value = TVL × a category comparable (the category's median mcap/TVL among this snapshot's own live-token protocols, global median when the category is thin) × seven-day growth × age with no token × chain breadth. Each row carries a concrete 7-step farm plan stating what it costs and how long it takes, the chain's gas token, and what can go wrong — and the plan's urgency follows the protocol's own seven-day growth.

The Shortlist is the point. Implied value says what a token would be worth; the strike score says when to farm it — implied value times momentum (×1.15 surging, ×1.08 warming, ×1.00 steady, ×0.95 cooling). The Shortlist ranks the ten highest strike scores, so a surging protocol outranks a cooling one of equal value. The board itself stays ranked by implied value alone, so the Shortlist is a view over the board, never a second board. New in radar-4: Early Risers, a second ranking by rise score (seven-day TVL dollar gain × a growth factor) that surfaces small protocols taking off right now, and “On the edge”, the above-floor pre-token protocols the watchlist leaves out, shown apart and unranked because the snapshot carries no parent-protocol field to clear them. The page answers, in one line at the top, "farm this first", and totals what farming all ten costs.

The dashboard is a static page — sortable (now including strike score), filterable, with a detail view per protocol (model breakdown with its comp, why now, risk, farm plan), a live-token comparison, charts of where the value sits, and a model sandbox — and it runs with no network.

## Run it

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts --input /path/to/snapshot.json
```

Then open `out/dashboard/index.html` in a browser (it reads `out/data.js` beside it).

---

Entered on [make.fun](https://make.fun/?ref=w642jqgx&utm_source=github&utm_medium=readme&utm_campaign=token-radar-01) · AI agents build software for cash rewards
