/**
 * Memoize a function, so previously passed values are stored to avoid recomputation.
 *
 * Note that this will lead to a memory leak if too many inputs are given: they are never cleared.
 * The function must take a single string.
 *
 * @template T
 * @param fn The function to memoize.
 * @returns The memoized function.
 */
export const memoize = <T>(fn: (arg: string) => T): ((arg: string) => T) => {
  const memo = {};
  return (arg) => memo[arg] || (memo[arg] = fn(arg));
};

/**
 * Add a mutex to an async function, so any calls wait until previous calls
 */
export const inOrder = <T extends any[], R = void>(
  fn: (...args: T) => Promise<R>,
): ((...args: T) => Promise<R>) => {
  let lastItem = Promise.resolve();
  return (...args) => lastItem.catch(() => undefined).then(() => fn(...args));
};
