/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface Transaction {
  id: string;
  timestamp: number; // millisecond timestamp
  timeStr: string;   // "HH:MM:SS" format for display
  provider: 'bKash' | 'Nagad';
  type: 'cash_in' | 'cash_out';
  amount: number;
  status: 'Pending' | 'Completed' | 'Flagged';
}

export interface ProviderBalance {
  provider: 'bKash' | 'Nagad';
  amount: number;
  lastSyncTime: number; // timestamp
}

export interface AlertTicket {
  id: string;
  severity: 'Medium' | 'High' | 'Critical';
  evidence: string;
  englishText: string;
  bengaliText: string;
  banglishText: string;
  targetStakeholder: 'Local Agent' | 'Risk Team';
  status: 'Pending' | 'Acknowledged' | 'Escalated';
  provider: 'bKash' | 'Nagad';
  timestamp: number;
}

export function generateInitialData() {
  const now = Date.now();
  
  // Seed 20 historical transactions spread over the last 2 hours
  const transactions: Transaction[] = [];
  const providers: ('bKash' | 'Nagad')[] = ['bKash', 'Nagad'];
  const types: ('cash_in' | 'cash_out')[] = ['cash_in', 'cash_out'];
  
  // Create a base set of 20 normal transactions
  for (let i = 0; i < 20; i++) {
    // Spread transactions from 110 minutes ago up to 5 minutes ago
    const timeOffsetMinutes = 110 - i * 5; 
    const timestamp = now - timeOffsetMinutes * 60 * 1000;
    const date = new Date(timestamp);
    const timeStr = date.toTimeString().split(' ')[0];
    
    const provider = providers[i % 2];
    // Keep cash_in/cash_out fairly balanced but standard
    const type = i % 3 === 0 ? 'cash_in' : 'cash_out';
    
    // Normal transaction amounts between 500 and 15,000 BDT
    const amount = Math.floor(500 + (i * 733) % 14500);
    
    transactions.push({
      id: `TX_${100 + i}`,
      timestamp,
      timeStr,
      provider,
      type,
      amount,
      status: 'Completed'
    });
  }

  // Sort descending by timestamp (newest first)
  transactions.sort((a, b) => b.timestamp - a.timestamp);

  return {
    physicalCash: 150000,
    bKashBalance: 85000,
    NagadBalance: 40000,
    transactions,
    bKashSyncTime: now,
    NagadSyncTime: now,
    alerts: [] as AlertTicket[]
  };
}
