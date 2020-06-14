// @ts-check

/**
 * Memoise a function, so previously passed values are stored to avoid recomputation.
 *
 * Note that this will lead to a memory leak if too many inputs are given: they are never cleared.
 * The function must take a single string.
 *
 * @template T
 * @param {(arg: string) => T} fn The function to memoise.
 * @returns {(arg: string) => T} The memoised function.
 */
export const memoise = (fn) => {
  const memo = {};

  return (arg) => {
    const cached = memo[arg];
    if (cached) return cached;

    const computed = fn(arg);
    memo[arg] = computed;
    return computed;
  };
};

/**
 * @template T
 * @param {(activities: T) => Promise<void>} fn
 * @returns {(input: T) => Promise<void>}
 */
export const inOrder = (fn) => {
  let lastItem = Promise.resolve();
  return (input) => {
    lastItem = lastItem.then(() => fn(input));
    return lastItem;
  };
};
