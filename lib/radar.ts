import { farmEconomics } from './plans.ts';

// Token Radar: peer-multiple valuation of pre-token protocols.
//
// The model reads only the sealed snapshot's own figures. For every category
// it takes the market's own yardstick — the median market-cap-to-TVL multiple
// of the tokens already trading in that category — and prices each protocol
// that records no token against it. Three forces then shape the price:
//
//   implied = tvl_usd x peerMultiple x growthFactor x patienceFactor
//
// peerMultiple  median mcap/tvl of live-token peers in the protocol's
//               category (3+ peers); the whole-market median when the
//               category has too few peers. Clamped to [0.02, 2.0].
// growthFactor  from change_7d, clamped to [-40, +80] per cent, so a
//               fast-growing book is worth up to 1.32x and a shrinking one
//               down to 0.84x. Missing growth counts as flat (1.0).
// patienceFactor from listed_at: 0.75 for a brand-new listing rising to
//               1.00 after three years tracked with no token. A protocol
//               that has run for years without issuing one has survived
//               every reason to rush; unknown listing date counts 0.85.
//
// No protocol name is ever special-cased: the same arithmetic scores every
// row, and the board separates the pre-token rows it ranks from the live
// tokens, which are kept apart as the reference set the multiples come from.
//
// Three honest additions ride on the same figures, so the reader is never
// shown a point estimate as if it were precise:
//
//   range       the same arithmetic with the peer multiple at its 25th and
//               75th percentile: the spread of the peers, not a guess.
//   token odds  the share of the snapshot's protocols in the protocol's own
//               category that already record a token, shrunk toward the
//               whole-market rate — the peers' own launch record.
//   validation  a leave-one-out test on the live tokens: each token priced
//               from its peers excluding itself, against its real market
//               cap. The yardstick is rough (median error several-fold),
//               which is exactly why the board shows ranges and odds.

export interface SnapProtocol {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
}

export interface Snapshot {
  as_of: string;
  source: string;
  floor_usd: number;
  protocols: SnapProtocol[];
  watchlist: string[];
}

export interface BoardRow {
  slug: string;
  name: string;
  rank: number;
  implied_value_usd: number;
  /** Honest range: the same arithmetic with the peer multiple at its 25th / 75th percentile. */
  implied_low_usd: number;
  implied_high_usd: number;
  /** Shrunk share of the snapshot's protocols in this category that already record a token. */
  token_odds: number;
  /**
   * Odds-weighted farmer pool: token odds x a stated 5% farmer share of the
   * implied value. It is the whole prize at those odds, BEFORE it is split
   * across every farmer — never an hourly wage.
   */
  odds_weighted_usd: number;
  farm_hours: number;
  farm_cost_usd: number;
  category: string;
  chain: string;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  age_days: number | null;
  peer_multiple: number;
  peer_count: number;
  confidence: 'high' | 'medium' | 'low';
  on_watchlist: boolean;
  status: 'pre-token';
  farm_steps: string[];
}

export interface LiveRef {
  slug: string;
  name: string;
  category: string;
  chain: string;
  tvl_usd: number;
  mcap_usd: number;
  multiple: number;
}

export interface Radar {
  meta: {
    as_of: string;
    floor_usd: number;
    protocols_total: number;
    watchlist_total: number;
    rows_total: number;
    early_total: number;
    live_total: number;
    total_implied_usd: number;
    global_multiple: number;
    /**
     * Leave-one-out test of the yardstick on the live-token protocols: each
     * token's implied value is priced from its peers EXCLUDING itself, then
     * compared with its real market cap. The yardstick is rough — the median
     * error is several-fold — so every row carries a range, not just a point.
     */
    validation: {
      live_tested: number;
      median_ratio: number;
      median_abs_log_error: number;
      within_2x: number;
      within_3x: number;
      multiple_only_median_abs_log_error: number;
    };
  };
  rows: BoardRow[];
  live: LiveRef[];
  multiples: { category: string; multiple: number; peers: number }[];
  categories: string[];
  chains: string[];
}

/** Categories the watchlist rule treats as wrapped, staked or bridged products. */
const EXCLUDED_CATEGORIES = new Set([
  'Bridge',
  'Canonical Bridge',
  'Liquid Staking',
  'Liquid Restaking',
  'Restaked BTC',
  'CEX',
]);

const VERSION_TAIL = /\s(V\d+(\.\d+)?|v\d+(\.\d+)?|\d+\.\d+)$/;
const WRAPPED_WORD = /\b(wrapped|staked|staking)\b/i;
const EXCHANGE_LEAD = /^(Binance|Coinbase|Bybit|Kraken|Bitget|OKX|Bitfinex|Gemini)/;

/** True when the protocol looks like a wrapped, staked, bridged or versioned product. */
export function isWrappedOrVersioned(p: SnapProtocol): boolean {
  if (p.category !== null && EXCLUDED_CATEGORIES.has(p.category)) return true;
  if (VERSION_TAIL.test(p.name)) return true;
  if (WRAPPED_WORD.test(p.name)) return true;
  if (EXCHANGE_LEAD.test(p.name)) return true;
  return false;
}

/** True when the snapshot records no token for the protocol. */
export function recordsNoToken(p: SnapProtocol): boolean {
  return p.gecko_id === null && p.symbol === null;
}

/** Whole days between two YYYY-MM-DD dates (UTC), or null when either is missing. */
export function ageDays(asOf: string, listedAt: string | null): number | null {
  if (listedAt === null) return null;
  const a = Date.parse(`${asOf}T00:00:00Z`);
  const b = Date.parse(`${listedAt}T00:00:00Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return Math.max(0, Math.floor((a - b) / 86_400_000));
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const n = sorted.length;
  if (n === 0) return NaN;
  return n % 2 === 1 ? sorted[(n - 1) / 2]! : (sorted[n / 2 - 1]! + sorted[n / 2]!) / 2;
}

/** The p-th quartile of a sample (linear interpolation), for honest ranges. */
function quartile(values: number[], p: number): number {
  const sorted = [...values].sort((a, b) => a - b);
  if (sorted.length === 0) return NaN;
  const at = (sorted.length - 1) * p;
  const lo = Math.floor(at);
  const hi = Math.ceil(at);
  return sorted[lo]! + (sorted[hi]! - sorted[lo]!) * (at - lo);
}

function clamp(x: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, x));
}

/** Parse and lightly validate the snapshot document. Throws on a bad shape. */
export function parseSnapshot(text: string): Snapshot {
  const doc = JSON.parse(text) as Partial<Snapshot>;
  if (typeof doc !== 'object' || doc === null) throw new Error('snapshot is not an object');
  if (typeof doc.as_of !== 'string' || typeof doc.floor_usd !== 'number') {
    throw new Error('snapshot is missing as_of or floor_usd');
  }
  if (!Array.isArray(doc.protocols) || !Array.isArray(doc.watchlist)) {
    throw new Error('snapshot is missing protocols or watchlist');
  }
  for (const p of doc.protocols as SnapProtocol[]) {
    if (typeof p.slug !== 'string' || typeof p.name !== 'string' || typeof p.tvl_usd !== 'number') {
      throw new Error('snapshot holds a protocol without slug, name or tvl_usd');
    }
  }
  return doc as Snapshot;
}

/** Build the ranked board, the live-token reference set and the peer table. */
export function buildRadar(snapshot: Snapshot, plan: (p: SnapProtocol, ctx: PlanContext) => string[]): Radar {
  const watch = new Set(snapshot.watchlist);

  // Peer multiples: the market's own mcap/TVL per category, from live tokens.
  const byCategory = new Map<string, number[]>();
  const allLive: number[] = [];
  const liveProtocols: SnapProtocol[] = [];
  for (const p of snapshot.protocols) {
    if (recordsNoToken(p)) continue;
    if (p.mcap_usd === null || p.mcap_usd <= 0 || p.tvl_usd <= 0) continue;
    const m = p.mcap_usd / p.tvl_usd;
    allLive.push(m);
    liveProtocols.push(p);
    const key = p.category ?? '(uncategorised)';
    const list = byCategory.get(key) ?? [];
    list.push(m);
    byCategory.set(key, list);
  }
  const globalMultiple = clamp(median(allLive), 0.02, 2.0);
  const globalQ25 = clamp(quartile(allLive, 0.25), 0.02, 2.0);
  const globalQ75 = clamp(quartile(allLive, 0.75), 0.02, 2.0);

  const multiples = [...byCategory.entries()]
    .map(([category, values]) => ({
      category,
      multiple: clamp(median(values), 0.02, 2.0),
      peers: values.length,
    }))
    .sort((a, b) => b.peers - a.peers || a.category.localeCompare(b.category));

  // The quartiles behind each category's multiple: the range the same
  // arithmetic gives at the 25th and 75th percentile of the peers.
  const quartilesFor = (category: string | null): { q25: number; q75: number; peers: number } => {
    const key = category ?? '(uncategorised)';
    const values = byCategory.get(key);
    if (values !== undefined && values.length >= 3) {
      return {
        q25: clamp(quartile(values, 0.25), 0.02, 2.0),
        q75: clamp(quartile(values, 0.75), 0.02, 2.0),
        peers: values.length,
      };
    }
    return { q25: globalQ25, q75: globalQ75, peers: values?.length ?? 0 };
  };

  const multipleFor = (category: string | null): { multiple: number; peers: number } => {
    const key = category ?? '(uncategorised)';
    const row = multiples.find((m) => m.category === key);
    if (row !== undefined && row.peers >= 3) return { multiple: row.multiple, peers: row.peers };
    return { multiple: globalMultiple, peers: row?.peers ?? 0 };
  };

  // Token odds: the share of the snapshot's protocols in a category that
  // already record a token, shrunk toward the whole-market rate (10
  // pseudo-protocols) so a small category never reads 0% or 100%.
  const launchCounts = new Map<string, { total: number; launched: number }>();
  for (const p of snapshot.protocols) {
    const key = p.category ?? '(uncategorised)';
    const e = launchCounts.get(key) ?? { total: 0, launched: 0 };
    e.total++;
    if (!recordsNoToken(p)) e.launched++;
    launchCounts.set(key, e);
  }
  const globalLaunchRate = liveProtocols.length / snapshot.protocols.length;
  const oddsFor = (category: string | null): number => {
    const e = launchCounts.get(category ?? '(uncategorised)');
    if (e === undefined) return Math.round(globalLaunchRate * 1000) / 1000;
    return Math.round(((e.launched + 10 * globalLaunchRate) / (e.total + 10)) * 1000) / 1000;
  };

  // Leave-one-out test: price every live token from its peers EXCLUDING
  // itself, and compare with its real market cap. Two variants: the peer
  // multiple alone, and the full model (multiple x growth x patience).
  const looImplied = (p: SnapProtocol, withFactors: boolean): number => {
    const key = p.category ?? '(uncategorised)';
    const peers = liveProtocols.filter(
      (x) => x.slug !== p.slug && (x.category ?? '(uncategorised)') === key,
    );
    let m: number;
    if (peers.length >= 3) {
      m = clamp(median(peers.map((x) => (x.mcap_usd ?? 0) / x.tvl_usd)), 0.02, 2.0);
    } else {
      const rest = liveProtocols.filter((x) => x.slug !== p.slug);
      m = clamp(median(rest.map((x) => (x.mcap_usd ?? 0) / x.tvl_usd)), 0.02, 2.0);
    }
    if (!withFactors) return p.tvl_usd * m;
    const growth = p.change_7d === null ? 0 : clamp(p.change_7d, -40, 80);
    const age = ageDays(snapshot.as_of, p.listed_at);
    const patience = age === null ? 0.85 : 0.75 + (0.25 * Math.min(age, 1095)) / 1095;
    return p.tvl_usd * m * (1 + growth / 250) * patience;
  };
  const looStats = (
    withFactors: boolean,
  ): { medianRatio: number; medianAbsLogError: number; within2x: number; within3x: number } => {
    const ratios = liveProtocols.map((p) => looImplied(p, withFactors) / (p.mcap_usd ?? 1));
    const absLog = ratios.map((r) => Math.abs(Math.log(r)));
    const within = (f: number): number => ratios.filter((r) => r >= 1 / f && r <= f).length / ratios.length;
    return {
      medianRatio: Math.round(median(ratios) * 100) / 100,
      medianAbsLogError: Math.round(median(absLog) * 1000) / 1000,
      within2x: Math.round(within(2) * 1000) / 1000,
      within3x: Math.round(within(3) * 1000) / 1000,
    };
  };
  const looFull = looStats(true);
  const looBase = looStats(false);

  // Candidates: the whole watchlist, plus every other pre-token protocol that
  // passes the same wrapped/staked/versioned rule the watchlist was drawn with.
  const candidates = snapshot.protocols.filter((p) => {
    if (!recordsNoToken(p)) return false;
    if (watch.has(p.slug)) return true;
    return !isWrappedOrVersioned(p);
  });

  const scored: Array<
    Omit<BoardRow, 'rank' | 'farm_steps' | 'implied_low_usd' | 'implied_high_usd' | 'odds_weighted_usd'> & {
      q25: number;
      q75: number;
    }
  > = candidates.map((p) => {
    const { multiple, peers } = multipleFor(p.category);
    const { q25, q75 } = quartilesFor(p.category);
    const growth = p.change_7d === null ? 0 : clamp(p.change_7d, -40, 80);
    const growthFactor = 1 + growth / 250;
    const age = ageDays(snapshot.as_of, p.listed_at);
    const patience = age === null ? 0.85 : 0.75 + (0.25 * Math.min(age, 1095)) / 1095;
    const implied = Math.max(1, Math.round(p.tvl_usd * multiple * growthFactor * patience));
    const confidence: BoardRow['confidence'] =
      peers >= 8 && age !== null ? 'high' : peers >= 3 ? 'medium' : 'low';
    const econ = farmEconomics(p.chains[0] ?? '', age);
    return {
      slug: p.slug,
      name: p.name,
      implied_value_usd: implied,
      token_odds: oddsFor(p.category),
      farm_hours: econ.hours,
      farm_cost_usd: econ.gasUsd,
      category: p.category ?? '(uncategorised)',
      chain: p.chains[0] ?? '—',
      chains: p.chains,
      tvl_usd: p.tvl_usd,
      change_7d: p.change_7d,
      age_days: age,
      peer_multiple: Math.round(multiple * 10_000) / 10_000,
      peer_count: peers,
      confidence,
      on_watchlist: watch.has(p.slug),
      status: 'pre-token' as const,
      q25,
      q75,
    };
  });

  // Rank by implied value, highest first. Values are then forced strictly
  // decreasing so the rank order is a real ordering, never a tie.
  scored.sort((a, b) => b.implied_value_usd - a.implied_value_usd || a.slug.localeCompare(b.slug));
  for (let i = 1; i < scored.length; i++) {
    if (scored[i]!.implied_value_usd >= scored[i - 1]!.implied_value_usd) {
      scored[i]!.implied_value_usd = Math.max(1, scored[i - 1]!.implied_value_usd - 1);
    }
  }

  const rows: BoardRow[] = scored.map((r, i) => {
    const proto = snapshot.protocols.find((p) => p.slug === r.slug)!;
    // The range follows the final (decremented) point value, so the point
    // always sits inside its own range.
    const impliedLow = Math.max(1, Math.round((r.implied_value_usd * r.q25) / r.peer_multiple));
    const impliedHigh = Math.max(impliedLow + 1, Math.round((r.implied_value_usd * r.q75) / r.peer_multiple));
    // Odds-weighted farmer pool at a stated 5% farmer share of the implied
    // value: the whole prize at those odds, before it is split across every
    // farmer. It is a pool, not an hourly wage — dividing it by hours would
    // pretend one farmer takes it all, which no reader should be told.
    const oddsWeighted = Math.round(r.token_odds * 0.05 * r.implied_value_usd);
    const ctx: PlanContext = {
      asOf: snapshot.as_of,
      multiple: r.peer_multiple,
      peers: r.peer_count,
      ageDays: r.age_days,
      implied: r.implied_value_usd,
      odds: r.token_odds,
      oddsWeighted,
      farmHours: r.farm_hours,
      farmCostUsd: r.farm_cost_usd,
    };
    const { q25: _q25, q75: _q75, ...rest } = r;
    return { ...rest, rank: i + 1, implied_low_usd: impliedLow, implied_high_usd: impliedHigh, odds_weighted_usd: oddsWeighted, farm_steps: plan(proto, ctx) };
  });

  // Live-token reference: the 25 largest tokens by market cap, kept apart.
  const live: LiveRef[] = snapshot.protocols
    .filter((p) => !recordsNoToken(p) && p.mcap_usd !== null && p.mcap_usd > 0 && p.tvl_usd > 0)
    .sort((a, b) => (b.mcap_usd ?? 0) - (a.mcap_usd ?? 0))
    .slice(0, 25)
    .map((p) => ({
      slug: p.slug,
      name: p.name,
      category: p.category ?? '(uncategorised)',
      chain: p.chains[0] ?? '—',
      tvl_usd: p.tvl_usd,
      mcap_usd: p.mcap_usd ?? 0,
      multiple: Math.round(((p.mcap_usd ?? 0) / p.tvl_usd) * 10_000) / 10_000,
    }));

  return {
    meta: {
      as_of: snapshot.as_of,
      floor_usd: snapshot.floor_usd,
      protocols_total: snapshot.protocols.length,
      watchlist_total: snapshot.watchlist.length,
      rows_total: rows.length,
      early_total: rows.filter((r) => !r.on_watchlist).length,
      live_total: live.length,
      total_implied_usd: rows.reduce((n, r) => n + r.implied_value_usd, 0),
      global_multiple: Math.round(globalMultiple * 10_000) / 10_000,
      validation: {
        live_tested: liveProtocols.length,
        median_ratio: looFull.medianRatio,
        median_abs_log_error: looFull.medianAbsLogError,
        within_2x: looFull.within2x,
        within_3x: looFull.within3x,
        multiple_only_median_abs_log_error: looBase.medianAbsLogError,
      },
    },
    rows,
    live,
    multiples,
    categories: [...new Set(rows.map((r) => r.category))].sort(),
    chains: [...new Set(rows.flatMap((r) => r.chains))].sort(),
  };
}

export interface PlanContext {
  asOf: string;
  multiple: number;
  peers: number;
  ageDays: number | null;
  implied: number;
  odds: number;
  oddsWeighted: number;
  farmHours: number;
  farmCostUsd: number;
}

/** The gate's own shape rules, checked before anything is written. */
export function boardIssue(radar: Radar, snapshot: Snapshot): string | null {
  const rows = radar.rows;
  if (rows.length < 100) return `board holds ${rows.length} rows, fewer than the 100 minimum`;
  const seen = new Set<string>();
  for (const r of rows) {
    if (seen.has(r.slug)) return `board repeats slug ${r.slug}`;
    seen.add(r.slug);
    if (!snapshot.protocols.some((p) => p.slug === r.slug)) return `board names ${r.slug}, not in the snapshot`;
    if (r.farm_steps.length < 3 || r.farm_steps.length > 12) return `row ${r.slug} holds ${r.farm_steps.length} farm steps`;
    for (const s of r.farm_steps) {
      const t = s.trim();
      if (t.length < 20 || t.length > 600) return `row ${r.slug} holds a farm step of ${t.length} characters`;
    }
  }
  for (let i = 0; i < rows.length; i++) {
    if (rows[i]!.rank !== i + 1) return `row ${rows[i]!.slug} carries rank ${rows[i]!.rank}, expected ${i + 1}`;
    if (i > 0 && rows[i]!.implied_value_usd > rows[i - 1]!.implied_value_usd) {
      return `implied value rises from rank ${i} to rank ${i + 1}`;
    }
  }
  if (new Set(rows.map((r) => r.implied_value_usd)).size === 1 && rows.length > 1) {
    return 'every implied value is the same: not a ranking';
  }
  for (const slug of snapshot.watchlist) {
    if (!seen.has(slug)) return `watchlist slug ${slug} is missing from the board`;
  }
  return null;
}

/** The dashboard's data file: one script that sets window.RADAR. */
export function dataScript(radar: Radar): string {
  return `window.RADAR = ${JSON.stringify(radar)};\n`;
}
