export * from './logging';
export * from './permission';
export * from './service-logger';
export * from './validation';

/**
 * Normalizes an adminInfo object to ensure favorite is always boolean and never undefined.
 * If neither notes nor favorite are present, returns undefined.
 */
import type { AdminInfoType } from '@repo/types';
export function normalizeAdminInfo(input: unknown): AdminInfoType | undefined {
    if (!input || typeof input !== 'object') return undefined;
    const { notes, favorite } = input as Partial<AdminInfoType>;
    if (notes === undefined && favorite === undefined) return undefined;
    return {
        ...(notes !== undefined ? { notes } : {}),
        favorite: typeof favorite === 'boolean' ? favorite : false
    } as AdminInfoType;
}
