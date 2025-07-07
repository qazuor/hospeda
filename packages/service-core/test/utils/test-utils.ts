/**
 * Type-safe helper to cast a function to a Vitest Mock.
 * @param fn The function to cast
 * @returns The function as a Vitest Mock
 */
export const asMock = <T>(fn: T) => fn as unknown as import('vitest').Mock;
