// LMSR (Logarithmic Market Scoring Rule) Math Engine
// Multi-outcome prediction market pricing for TTC bus arrivals

export type Outcome = 'EARLY' | 'ON_TIME' | 'LATE';

export interface LMSRState {
  q_early: number;
  q_ontime: number;
  q_late: number;
  b: number;
}

const OUTCOMES: Outcome[] = ['EARLY', 'ON_TIME', 'LATE'];
const DEFAULT_B = 100;

function getQuantities(state: LMSRState): number[] {
  return [state.q_early, state.q_ontime, state.q_late];
}

function withUpdatedQuantity(state: LMSRState, outcome: Outcome, delta: number): LMSRState {
  return {
    ...state,
    q_early: state.q_early + (outcome === 'EARLY' ? delta : 0),
    q_ontime: state.q_ontime + (outcome === 'ON_TIME' ? delta : 0),
    q_late: state.q_late + (outcome === 'LATE' ? delta : 0),
  };
}

// Log-sum-exp trick for numerical stability: log(Σ exp(x_i)) = max + log(Σ exp(x_i - max))
function logSumExp(values: number[]): number {
  const max = Math.max(...values);
  const sum = values.reduce((acc, v) => acc + Math.exp(v - max), 0);
  return max + Math.log(sum);
}

/** Cost function: C(q) = b * ln(Σ exp(q_i / b)) */
export function costFunction(state: LMSRState): number {
  const q = getQuantities(state);
  const scaled = q.map((qi) => qi / state.b);
  return state.b * logSumExp(scaled);
}

/** Prices via softmax: p_i = exp(q_i/b) / Σ exp(q_j/b). Always sum to 1.0 */
export function calculatePrices(state: LMSRState): Record<Outcome, number> {
  const q = getQuantities(state);
  const max = Math.max(...q.map((qi) => qi / state.b));
  const exps = q.map((qi) => Math.exp(qi / state.b - max));
  const sum = exps.reduce((a, b) => a + b, 0);
  return {
    EARLY: exps[0] / sum,
    ON_TIME: exps[1] / sum,
    LATE: exps[2] / sum,
  };
}

/** Cost to buy `shares` of a given outcome: C(q_after) - C(q_before) */
export function calculateBuyCost(state: LMSRState, outcome: Outcome, shares: number): number {
  const before = costFunction(state);
  const after = costFunction(withUpdatedQuantity(state, outcome, shares));
  return after - before;
}

/** Binary search: how many shares can you buy for maxCost lamports */
export function calculateSharesForCost(
  state: LMSRState,
  outcome: Outcome,
  maxCost: number
): number {
  let lo = 0;
  let hi = maxCost * 10; // upper bound heuristic
  const epsilon = 0.001;

  for (let i = 0; i < 100; i++) {
    const mid = (lo + hi) / 2;
    const cost = calculateBuyCost(state, outcome, mid);
    if (Math.abs(cost - maxCost) < epsilon) return mid;
    if (cost < maxCost) {
      lo = mid;
    } else {
      hi = mid;
    }
  }
  return lo;
}

/**
 * Classify outcome based on error in seconds.
 * Negative error = arrived earlier than predicted.
 * - EARLY: error < -60 (arrived more than 60s before prediction)
 * - ON_TIME: -60 <= error <= 60
 * - LATE: error > 60 (arrived more than 60s after prediction)
 */
export function classifyOutcome(errorSeconds: number): Outcome {
  if (errorSeconds < -60) return 'EARLY';
  if (errorSeconds > 60) return 'LATE';
  return 'ON_TIME';
}

/** Create a fresh market state with equal quantities */
export function createInitialState(b: number = DEFAULT_B): LMSRState {
  return { q_early: 0, q_ontime: 0, q_late: 0, b };
}

/** Potential payout if outcome wins: 1 SOL per share */
export function calculatePotentialPayout(shares: number): number {
  return shares;
}

export { DEFAULT_B, OUTCOMES };
