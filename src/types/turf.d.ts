declare module '@turf/turf' {
  const turf: Record<string, (...args: unknown[]) => unknown>;
  export = turf;
}
