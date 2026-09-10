import { AsyncLocalStorage } from "node:async_hooks";

/** Leave enough leftover time to await the next hop’s 202 ACK. */
export const FUNCTION_LIMIT_MS = 300_000;
export const HOP_RESERVE_MS = 35_000;
export const TURN_BUDGET_MS = FUNCTION_LIMIT_MS - HOP_RESERVE_MS;

const turn = new AsyncLocalStorage<{ startedAt: number }>();

export function runPipelineTurn<T>(fn: () => Promise<T>): Promise<T> {
  return turn.run({ startedAt: Date.now() }, fn);
}

export function pipelineTurnElapsedMs(): number {
  const startedAt = turn.getStore()?.startedAt;
  return startedAt == null ? 0 : Date.now() - startedAt;
}

/** False when another STT chunk would likely consume the hop-ACK reserve. */
export function pipelineTurnHasBudget(): boolean {
  return pipelineTurnElapsedMs() < TURN_BUDGET_MS;
}
