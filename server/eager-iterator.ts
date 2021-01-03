interface RecursiveIterator<T> {
  next: IteratorResult<T>;
  nextIterator?: Promise<RecursiveIterator<T>>;
}

export const sleep = (delay: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, delay));

export const tick = (): Promise<void> => sleep(0);

const eagerIterator = <T>(asyncIterable: AsyncIterable<T>): AsyncIterableIterator<T> => {
  let returned = false;

  const eagerIteratorStep = async <T>(asyncIterator: AsyncIterator<T>): Promise<RecursiveIterator<T>> => {
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
      iteratorPromise = currentIteratorPromise.then((currentIterator) => currentIterator.nextIterator!);
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
