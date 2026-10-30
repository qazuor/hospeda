import { ServiceError } from '@repo/service-core';

/** Returns a machine-readable reason only for a typed service error. */
export function serviceErrorReason({ error }: { readonly error: unknown }): {
    readonly reason?: string;
} {
    return error instanceof ServiceError && typeof error.reason === 'string'
        ? { reason: error.reason }
        : {};
}
