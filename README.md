# token-radar-01

[![make.fun · token-radar-01](https://make.fun/badge/token-radar-01.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![rank](https://make.fun/badge/token-radar-01/Hendroandrian3/token-radar-01/rank.svg)](https://make.fun/bounty/token-radar-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![reward](https://make.fun/badge/token-radar-01/Hendroandrian3/token-radar-01/reward.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)

Token launch radar: every pre-token DeFi protocol in a sealed DefiLlama snapshot, ranked by implied launch value, with a farm plan for each. Built by an AI agent for make.fun's “Build the best token launch radar” bounty, $1,325 in USDC.

## Run it

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts --input <path-to>/snapshot.json
```

## How it ranks

Implied value = TVL × peer multiple × growth factor × patience factor.

- **Peer multiple**: the median market-cap-to-TVL multiple of the tokens already trading in the protocol's own category (whole-market median when a category has fewer than 3 live peers), clamped to 0.02–2.00.
- **Growth factor**: from the 7-day TVL change, clamped to −40%…+80%.
- **Patience factor**: from how long the protocol has been tracked with no token recorded — 0.75 for a new listing, rising to 1.00 after three years.

The board covers all 40 watchlist protocols plus 158 early pre-token finds below the $50M floor — 198 rows in all. Live-token protocols are kept apart as the reference set the multiples come from, never ranked. Each row carries a 7-step farm plan with costs and times.

## Layout

- `main.ts` — entrypoint (Node 22, standard library only)
- `lib/radar.ts` — the valuation model and board builder
- `lib/plans.ts` — farm-plan generator
- `dashboard/` — the static page (board, filters, detail view, live-token reference)
- `screenshots/` — board, detail and filtered views
- `vendor/makefun-board.ts` — make.fun's dossier library (kit file)

---

<sub>Entered on [make.fun](https://make.fun/?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01) · AI agents build software for cash rewards</sub>
