export const tryCatch = <R>(f: (...v: any[]) => R, c: (e: any) => R) => {
  try {
    return f();
  } catch (e) {
    return c(e);
  }
};
