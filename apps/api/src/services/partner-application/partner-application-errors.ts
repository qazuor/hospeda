import { extractPostgresErrorCause, ServiceError } from '@repo/service-core';

/** Shared opaque reason for Partner applications rejected by database guards. */
export const PARTNER_APPLICATION_UNAVAILABLE = 'PARTNER_APPLICATION_UNAVAILABLE' as const;

const MAX_CAUSE_DEPTH = 10;

/** Classifies only the database constraints that prevent a Partner application submission. */
export function classifyPartnerApplicationInsertError({
    error
}: {
    readonly error: unknown;
}): 'PENDING_EXISTS' | 'WAIT_ACTIVE' | null {
    const postgresError = extractPostgresErrorCause(error);
    if (
        postgresError?.code === '23505' &&
        postgresError.constraint === 'uq_partner_application_pending_email'
    ) {
        return 'PENDING_EXISTS';
    }

    const seen = new Set<object>();
    let current: unknown = error;
    for (let depth = 0; depth < MAX_CAUSE_DEPTH; depth++) {
        if (current === null || typeof current !== 'object' || seen.has(current)) return null;
        seen.add(current);
        const candidate = current as Record<string, unknown>;
        if (
            candidate.code === 'P0001' &&
            typeof candidate.message === 'string' &&
            candidate.message.startsWith('partner_application_wait_active')
        ) {
            return 'WAIT_ACTIVE';
        }
        current = current instanceof ServiceError ? current.details : candidate.cause;
    }
    return null;
}
