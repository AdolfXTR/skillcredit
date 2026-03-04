export const BAYESIAN_C = 5;
export const BAYESIAN_M = 3.5;

export function bayesianAvg(ratings: number[]): number {
  if (ratings.length === 0) return 0;
  const sum = ratings.reduce((a, b) => a + b, 0);
  return (BAYESIAN_C * BAYESIAN_M + sum) / (BAYESIAN_C + ratings.length);
}

export function formatBayesian(ratings: number[]): string {
  if (ratings.length === 0) return "—";
  return bayesianAvg(ratings).toFixed(2);
}

export function bayesianConfidenceLabel(count: number): string {
  if (count === 0) return "No ratings yet";
  if (count < 3)  return "Too early to tell";
  if (count < 8)  return "Building credibility";
  if (count < 20) return "Fairly rated";
  return "Highly trusted";
}