/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Transaction } from './mockData';

/**
 * Calculates liquidity burn down using Exponential Moving Average (EMA)
 * on the last 15 minutes of cash_out transactions to calculate velocity (BDT/min).
 */
export function calculateBurnDown(
  transactions: Transaction[],
  currentBalance: number,
  provider: 'bKash' | 'Nagad'
): { velocity: number; estimatedMinutesToZero: number } {
  const now = Date.now();
  const windowMs = 15 * 60 * 1000; // 15 minutes
  const startTime = now - windowMs;

  // Filter cash_out transactions for this provider in the last 15 minutes
  const filteredTxs = transactions.filter(
    tx =>
      tx.provider === provider &&
      tx.type === 'cash_out' &&
      tx.timestamp >= startTime &&
      tx.timestamp <= now
  );

  // Divide the 15-minute window into 15 buckets of 1 minute each
  const N = 15;
  const buckets = new Array(N).fill(0);
  
  filteredTxs.forEach(tx => {
    const elapsedMs = now - tx.timestamp;
    const bucketIndex = N - 1 - Math.floor(elapsedMs / (60 * 1000));
    if (bucketIndex >= 0 && bucketIndex < N) {
      buckets[bucketIndex] += tx.amount;
    }
  });

  // Calculate EMA over these 15 buckets
  // alpha = 2 / (N + 1)
  const alpha = 2 / (N + 1);
  let ema = buckets[0];
  for (let i = 1; i < N; i++) {
    ema = alpha * buckets[i] + (1 - alpha) * ema;
  }

  // Velocity is BDT/minute
  const velocity = Math.round(ema);

  let estimatedMinutesToZero = Infinity;
  if (velocity > 0) {
    estimatedMinutesToZero = Math.round(currentBalance / velocity);
  }

  return { velocity, estimatedMinutesToZero };
}

/**
 * Detects Smurfing: Time-Window Clustering / Smurfing Heuristic.
 * What it does: Detects coordinated, suspicious financial behavior (like "smurfing"—breaking a large cash-out into multiple smaller transactions to avoid triggering standard limits).
 * How the math works:
 * It uses a grouping logic called Clustering combined with Variance limits.
 * The algorithm constantly scans a sliding 10-minute window of the transaction feed.
 * It looks for a high frequency (e.g., N >= 3) of transactions coming from the same provider.
 * It checks the Variance (difference) in the amounts. If 3 or more transactions are within a tight 5% variance of a high-value amount (like 9,999, 10,000, and 9,950 Tk), the algorithm mathematically flags them as a "Cluster".
 */
export function detectSmurfing(transactions: Transaction[]): {
  isAnomaly: boolean;
  evidence: string;
  flaggedTxIds: string[];
  provider?: 'bKash' | 'Nagad';
} {
  const windowMs = 10 * 60 * 1000; // Sliding 10-minute window
  const targetHighValueAmount = 10000; // High-value amount target (e.g., 10,000 Tk)
  const varianceLimit = 0.05; // Tight 5% variance limit
  const minAmount = targetHighValueAmount * (1 - varianceLimit); // 9,500 BDT
  const maxAmount = targetHighValueAmount * (1 + varianceLimit); // 10,500 BDT

  // Group transactions by provider (bKash or Nagad)
  const providers: ('bKash' | 'Nagad')[] = ['bKash', 'Nagad'];

  for (const provider of providers) {
    // Filter cash_out transactions that fall within the tight 5% variance of the high-value target amount
    const candidates = transactions.filter(
      tx =>
        tx.provider === provider &&
        tx.type === 'cash_out' &&
        tx.amount >= minAmount &&
        tx.amount <= maxAmount
    );

    // Scan for clusters using the sliding 10-minute window
    for (let i = 0; i < candidates.length; i++) {
      const baseTx = candidates[i];
      
      // Group candidates occurring within a 10-minute window of the base transaction
      const cluster = candidates.filter(
        tx => Math.abs(tx.timestamp - baseTx.timestamp) <= windowMs
      );

      // Math Check: If high frequency (N >= 3) is met within the window, flag the Cluster
      if (cluster.length >= 3) {
        const flaggedTxIds = cluster.map(tx => tx.id);
        const amounts = cluster.map(tx => `${tx.amount} Tk`);
        
        const evidence = `Detected ${cluster.length} Cash-Out transactions of near-identical amounts (${amounts.join(', ')}) on ${provider} within a 10-minute sliding window, violating the 5% variance threshold around ${targetHighValueAmount} Tk and indicating coordinated transaction splitting (smurfing).`;
        
        return {
          isAnomaly: true,
          evidence,
          flaggedTxIds,
          provider
        };
      }
    }
  }

  return {
    isAnomaly: false,
    evidence: '',
    flaggedTxIds: []
  };
}

/**
 * Calculates a confidence score.
 * 100% at 0 minutes delay, decaying by 10% for every minute the sync is delayed.
 */
export function calculateConfidenceScore(lastSyncTimestamp: number): number {
  const elapsedMs = Date.now() - lastSyncTimestamp;
  const elapsedMinutes = elapsedMs / (60 * 1000);
  const score = 100 - Math.floor(elapsedMinutes) * 10;
  return Math.max(0, score);
}
