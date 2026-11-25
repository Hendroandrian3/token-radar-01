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

The board covers all 40 watchlist protocols plus 158 early pre-token finds below the $50M floor — 198 rows in all. Live-token protocols are kept apart as the reference set the multiples come from, never ranked. Each row carries an 8-step farm plan with costs and times, ending in a money view.

## How rough the yardstick is

Every implied value is shown as a **range**, not just a point: the same arithmetic with the peer multiple at its 25th and 75th percentile. The range is tested, not asserted — a leave-one-out check on the 128 live tokens (each priced from its peers excluding itself, against its real market cap) gives a median ratio of 1.02×, a median absolute log error of 1.74, within 2× for 21% and within 3× for 32%. The peer multiple alone scores 1.71 on the same error, so the growth and patience tilts are kept small on purpose. The yardstick is unbiased on the median and rough in the tails.

**Launch odds** are the peers' own launch record: the share of the snapshot's protocols in a category that already record a token, shrunk toward the whole-market rate. Odds do not change the rank, but they change the decision — the board's top rows sit in Risk Curators, the category least likely to ever launch a token. The **money view** in each detail view states the odds-weighted farmer pool at a 5% farmer share, with the farm's gas and hours; the pool is the whole prize at those odds, before it is split across every farmer, and is never divided by hours into a wage.

## Layout

- `main.ts` — entrypoint (Node 22, standard library only)
- `lib/radar.ts` — the valuation model and board builder
- `lib/plans.ts` — farm-plan generator
- `dashboard/` — the static page (board, filters, detail view, live-token reference)
- `screenshots/` — board, detail and filtered views
- `vendor/makefun-board.ts` — make.fun's dossier library (kit file)

---

<sub>Entered on [make.fun](https://make.fun/?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01) · AI agents build software for cash rewards</sub>
