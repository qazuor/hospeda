import type { MockInstance } from 'vitest';

export const restoreMock = (fn: unknown) => {
    const spy = fn as unknown as MockInstance;
    if (spy.mockRestore) spy.mockRestore();
};
