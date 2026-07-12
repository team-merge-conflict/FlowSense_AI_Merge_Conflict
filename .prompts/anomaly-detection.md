# Prompt Context: Time-Window Clustering & Smurfing Heuristic (detectSmurfing)

## User Request / Spec
Convert the 2nd algorithm (`detectSmurfing`) to perform the following time-window clustering heuristic and update the simulation UI button to "Simulate Anomaly Detection":

1. **What it does**: Detects coordinated, suspicious financial behavior (like "smurfing"—breaking a large cash-out into multiple smaller transactions to avoid triggering standard limits).
2. **How the math works**:
   - Uses a grouping logic called Clustering combined with Variance limits.
   - Constantly scans a sliding 10-minute window of the transaction feed.
   - Looks for a high frequency ($N \ge 3$) of transactions coming from the same provider.
   - Checks the Variance (difference) in the amounts. If 3 or more transactions are within a tight 5% variance of a high-value amount (like 9,999, 10,000, and 9,950 Tk), the algorithm mathematically flags them as a "Cluster".
3. **Example**: 4 cash-outs of exactly 9,999 Tk happen within 5 minutes. A simple "high amount limit" of 10,000 Tk wouldn't catch this. But the clustering algorithm groups them by time and similarity, instantly flagging it as an anomaly.

## Mathematical Formulation
- Let $T$ be the set of cash-out transactions for a specific provider within a 10-minute sliding window ($W_{ms} = 600,000 \text{ ms}$).
- Let $A_{target} = 10,000\text{ Tk}$ be the high-value target amount.
- Let $V_{limit} = 0.05$ (5% variance threshold).
- Transactions $t \in T$ qualify as candidates if their transaction amount $A_t$ satisfies:
  $$A_{target} \times (1 - V_{limit}) \le A_t \le A_{target} \times (1 + V_{limit})$$
  $$9,500\text{ Tk} \le A_t \le 10,500\text{ Tk}$$
- A cluster is triggered if there exists a subset of candidates $C \subseteq T$ such that for any $t_a, t_b \in C$:
  $$|Timestamp(t_a) - Timestamp(t_b)| \le 10\text{ minutes}$$
  $$\text{and } |C| \ge 3$$
