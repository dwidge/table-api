export const mapAsync = <T, R>(
  f: (v: T) => Promise<R>,
  rows: T[],
): Promise<R[]> => Promise.all(rows.map(f));
