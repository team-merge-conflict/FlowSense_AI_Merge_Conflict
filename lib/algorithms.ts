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
 * Detects Smurfing: Time-Window Clustering algorithm.
 * Scans the array for 3+ transactions of similar high amounts (e.g. within 5% variance of 10,000 BDT)
 * occurring within a 10-minute window on the same provider.
 */
export function detectSmurfing(transactions: Transaction[]): {
  isAnomaly: boolean;
  evidence: string;
  flaggedTxIds: string[];
  provider?: 'bKash' | 'Nagad';
} {
  const windowMs = 10 * 60 * 1000; // 10 minutes
  const targetAmount = 10000;
  const variance = 0.05; // 5%
  const minAmount = targetAmount * (1 - variance); // 9500 BDT
  const maxAmount = targetAmount * (1 + variance); // 10500 BDT

  // Group transactions by provider and filter for candidates (cash_out within range)
  const providers: ('bKash' | 'Nagad')[] = ['bKash', 'Nagad'];

  for (const provider of providers) {
    const candidates = transactions.filter(
      tx =>
        tx.provider === provider &&
        tx.type === 'cash_out' &&
        tx.amount >= minAmount &&
        tx.amount <= maxAmount
    );

    // For each candidate, find other candidates within a 10-minute window
    for (let i = 0; i < candidates.length; i++) {
      const baseTx = candidates[i];
      const cluster = candidates.filter(
        tx => Math.abs(tx.timestamp - baseTx.timestamp) <= windowMs
      );

      if (cluster.length >= 3) {
        const flaggedTxIds = cluster.map(tx => tx.id);
        const amounts = cluster.map(tx => tx.amount.toLocaleString());
        const evidence = `Detected ${cluster.length} Cash-Out transactions of near-identical amounts (${amounts.join(', ')} BDT) on ${provider} within a 10-minute window, suggesting structural splitting (smurfing).`;
        
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
