export const unixTimestamp = (date?: number | string | Date | null) =>
  (new Date(date ?? Date.now()).getTime() / 1000) | 0;
