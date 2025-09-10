// Helper functions for the game

/**
 * Performs true modulo operation that handles negative numbers correctly
 * @param n The dividend
 * @param m The divisor
 * @returns The remainder, always positive
 */
export function trueModulo(n: number, m: number): number {
  return ((n % m) + m) % m;
}
