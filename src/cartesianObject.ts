export class CartesianLimitExceededError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CartesianLimitExceededError";
  }
}

/**
 * Computes the cartesian product of a record of arrays.
 *
 * @example
 * cartesianObject({
 *   a: [1, 2],
 *   b: ['x', 'y']
 * })
 * // returns:
 * // [
 * //   { a: 1, b: 'x' },
 * //   { a: 1, b: 'y' },
 * //   { a: 2, b: 'x' },
 * //   { a: 2, b: 'y' }
 * // ]
 *
 * @param obj - A record where keys are strings and values are arrays.
 * @param limit - The maximum number of combinations to generate.
 * @returns An array of objects representing the cartesian product.
 */
export const cartesianObject = <T>(
  obj: Record<string, T[]>,
  limit: number,
): Record<string, T>[] => {
  const keys = Object.keys(obj);
  if (keys.length === 0) {
    return [{}];
  }

  const result: Record<string, T>[] = [];
  const max = keys.length - 1;

  function generate(current: Record<string, T>, k: number) {
    if (result.length >= limit) {
      return;
    }

    const key = keys[k];
    if (!key) throw new Error("cartesianObjectE1");
    const values = obj[key];
    if (!values) throw new Error("cartesianObjectE2");

    for (let i = 0; i < values.length; i++) {
      const newCurrent = { ...current, [key]: values[i]! };
      if (k === max) {
        result.push(newCurrent);
        if (result.length >= limit) {
          throw new CartesianLimitExceededError(
            `cartesianObjectE3: Combination limit exceeded: ${limit}`,
          );
        }
      } else {
        generate(newCurrent, k + 1);
        if (result.length >= limit) {
          return;
        }
      }
    }
  }

  generate({}, 0);
  return result;
};
