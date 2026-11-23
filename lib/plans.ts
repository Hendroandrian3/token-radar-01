// Farm plans: seven concrete steps per protocol, written from the snapshot's
// own figures — the protocol's name, category, chain and age — never slogans.
// Every step names what to do, what it costs and how long it takes, so a
// reader can follow it without guessing. Amounts scale with the protocol's
// size: a billion-dollar book gets a larger first position than a small one.

import type { PlanContext, SnapProtocol } from './radar.ts';

/** What a first touch looks like in each category, and what the main position is. */
const ACTIONS: Record<string, { touch: string; core: string }> = {
  Lending: {
    touch: 'supply a small deposit to its lending market',
    core: 'supply assets to the lending market and, where it is offered, borrow a small amount against them',
  },
  Dexs: {
    touch: 'swap a small amount through its pools',
    core: 'provide liquidity to its deepest pool and keep the position in range',
  },
  'Yield Aggregator': {
    touch: 'deposit a small amount into its highest-TVL vault',
    core: 'deposit into its vaults and let the strategy compound',
  },
  Yield: {
    touch: 'deposit a small amount into its yield vault',
    core: 'deposit into its yield vault and keep the position earning',
  },
  CDP: {
    touch: 'lock a small amount of collateral and mint its stable asset',
    core: 'lock collateral, mint its stable asset and keep the position safely over-collateralised',
  },
  'CDP Manager': {
    touch: 'open a small managed vault position',
    core: 'run a managed vault position through its automation',
  },
  Derivatives: {
    touch: 'open a small test position on its market',
    core: 'trade its markets in small size and keep a position open',
  },
  'Risk Curators': {
    touch: 'deposit a small amount into one of its curated vaults',
    core: 'deposit into its curated vaults and stay allocated',
  },
  'Onchain Capital Allocator': {
    touch: 'allocate a small amount to one of its vaults',
    core: 'allocate to its vaults and keep the capital working',
  },
  RWA: {
    touch: 'buy a small amount of its tokenised real-world asset',
    core: 'hold its tokenised asset position and collect the yield it pays',
  },
  'Prediction Market': {
    touch: 'place a small prediction on one of its live markets',
    core: 'keep a prediction position open on its live markets',
  },
  Bridge: {
    touch: 'bridge a small amount through it to another chain',
    core: 'route regular transfers through it and keep the volume steady',
  },
  Staking: {
    touch: 'stake a small amount through it',
    core: 'stake through it and keep the stake delegated',
  },
  'Liquid Staking': {
    touch: 'stake a small amount and hold the receipt token',
    core: 'stake through it, hold the receipt token and use it in DeFi',
  },
  'Algo-Stables': {
    touch: 'mint a small amount of its stable asset',
    core: 'hold its stable asset and use it in its own pools',
  },
  Insurance: {
    touch: 'buy a small cover policy on one of its pools',
    core: 'hold cover on the pools you use and renew it before it lapses',
  },
  Options: {
    touch: 'buy a small option on one of its markets',
    core: 'keep an option position open on its markets',
  },
  'NFT Lending': {
    touch: 'supply a small loan against an NFT you hold',
    core: 'lend against NFTs and keep the loans repaid on time',
  },
  'Cross Chain': {
    touch: 'move a small amount across chains through it',
    core: 'route cross-chain moves through it on a regular schedule',
  },
  'Basis Trading': {
    touch: 'deposit a small amount into its basis vault',
    core: 'hold a position in its basis vault through funding cycles',
  },
};

const DEFAULT_ACTION = {
  touch: 'use its main feature once with a small amount',
  core: 'use its main feature regularly and keep a position open',
};

/** Typical gas cost of one transaction on each chain, as a readable range. */
const GAS: Record<string, string> = {
  Ethereum: '$3 to $9',
  Base: '$0.10 to $0.50',
  Arbitrum: '$0.20 to $0.80',
  Optimism: '$0.10 to $0.50',
  Solana: 'about $0.01',
  BSC: '$0.10 to $0.40',
  'BNB Chain': '$0.10 to $0.40',
  Polygon: '$0.05 to $0.20',
  Avalanche: '$0.20 to $0.60',
  Tron: '$1 to $3',
  zkSync: '$0.20 to $0.80',
  Linea: '$0.10 to $0.50',
  Scroll: '$0.10 to $0.50',
  Mode: '$0.05 to $0.30',
  Blast: '$0.10 to $0.50',
};

function gasFor(chain: string): string {
  return GAS[chain] ?? '$0.50 to $2';
}

function ageText(ageDays: number | null): string {
  if (ageDays === null) return 'an unreported length of time';
  if (ageDays >= 365) return `about ${(ageDays / 365).toFixed(1)} years`;
  if (ageDays >= 30) return `about ${Math.round(ageDays / 30)} months`;
  return `${ageDays} days`;
}

/**
 * Seven farm steps for one protocol. Amounts follow its TVL: a book over
 * $1B gets a $250 first position, $100M–$1B gets $150, below that $100.
 * The hold window follows its age: protocols tracked over a year get 90
 * days, younger ones 60.
 */
export function farmPlan(p: SnapProtocol, ctx: PlanContext): string[] {
  const chain = p.chains[0] ?? 'its main chain';
  const otherChains = p.chains.length > 1 ? ` (it also runs on ${p.chains.slice(1, 3).join(', ')})` : '';
  const category = p.category ?? 'DeFi';
  const action = ACTIONS[category] ?? DEFAULT_ACTION;
  const gas = gasFor(chain);
  const first = p.tvl_usd >= 1_000_000_000 ? 250 : p.tvl_usd >= 100_000_000 ? 150 : 100;
  const holdDays = (ctx.ageDays ?? 0) >= 365 ? 90 : 60;
  const name = p.name;
  const tvl =
    p.tvl_usd >= 1e9
      ? `$${(p.tvl_usd / 1e9).toFixed(2)}B`
      : `$${Math.round(p.tvl_usd / 1e6)}M`;

  return [
    `Open a fresh wallet on ${chain}${otherChains} and fund it with $${first + 50} — $${first} to deploy and the rest for gas. Moving funds costs about ${gas} per transaction and takes 10–20 minutes. Never share the seed phrase with any site or person.`,
    `Make a first move on ${name}: ${action.touch} with about $${Math.round(first / 2)}. That first transaction costs about ${gas} in gas and takes 5–10 minutes, and it proves the route works before you commit more.`,
    `Place the main position: ${action.core}. ${name} holds ${tvl} in TVL in ${category}, so a $${first} position is a small, sensible stake. Setting it up costs about ${gas} and takes 15–30 minutes.`,
    `Once a week, repeat one qualifying action on ${name} — a deposit, a swap or a vote where one is offered — so the activity looks like a real user, not a single visit. Each weekly action costs about ${gas} and takes about 10 minutes.`,
    `Check ${name}'s points, season or rewards page and its official announcements at least once a month for a new campaign or snapshot. This costs nothing and takes 5–10 minutes, and it is where a launch is announced first.`,
    `Hold the position for at least ${holdDays} days. ${name} has already run ${ageText(ctx.ageDays)} with no token recorded, so patience is the trade: an early exit forfeits whatever a launch would pay to the holders still there.`,
    `When a token launches, or you decide to stop, unwind the position in two or three transactions rather than one, and write every transaction hash and date in your own notes. Unwinding costs about ${gas} per transaction and takes 10–15 minutes.`,
  ];
}
