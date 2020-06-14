// @ts-check

/**
 * @template T return value
 * @typedef {Object} RecursiveIterator
 * @property {IteratorResult<T>} next
 * @property {Promise<RecursiveIterator<T>>=} nextIterator
 */
/**
 * @param {number} delay
 * @returns {Promise<void>}
 */
export const sleep = (delay) => new Promise((resolve) => setTimeout(resolve, delay));

/**
 * @returns {Promise<void>}
 */
export const tick = () => sleep(0);

/**
 *
 * @template T return value
 * @param {AsyncIterable<T>} asyncIterable
 * @returns {AsyncIterableIterator<T>}
 */
const eagerIterator = (asyncIterable) => {
  let returned = false;
  /**
   *
   * @template T return value
   * @param {AsyncIterator<T>} asyncIterator
   * @returns {Promise<RecursiveIterator<T>>}
   */
  const eagerIteratorStep = async (asyncIterator) => {
    if (returned) return { next: { done: true, value: undefined } };
    await tick();
    const next = await asyncIterator.next();
    if (next.done) return { next };
    return { next, nextIterator: eagerIteratorStep(asyncIterator) };
  };

  let iteratorPromise = eagerIteratorStep(asyncIterable[Symbol.asyncIterator]());
  return {
    async next() {
      if (returned) return { done: true, value: undefined };
      const currentIteratorPromise = iteratorPromise;
      iteratorPromise = currentIteratorPromise.then(
        (currentIterator) => currentIterator.nextIterator,
      );
      const { next } = await currentIteratorPromise;
      if (next.done) returned = true;
      return next;
    },

    // Handle early termination.
    // A return/break in a for-await loop will call this, preventing further loading.
    async return(value = undefined) {
      returned = true;
      return { done: true, value };
    },
    [Symbol.asyncIterator]() {
      return this;
    },
  };
};

export default eagerIterator;
