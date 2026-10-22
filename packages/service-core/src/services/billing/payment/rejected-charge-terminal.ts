/** Structural provider-charge fields used to identify a rejection with no retry window. */
export interface RejectedChargeTerminalInput {
    readonly charge: {
        readonly purpose: string;
        readonly status: string;
        readonly expiresAt: string | null;
    };
}

/**
 * HOS-1734: the signup charge record has no `expire_date` (RC-7). A rejected
 * cycle with a retry window is retried by the provider under the same id (RP8/GR-1)
 * and remains open for P2 to close when that window expires.
 */
export function isRejectedWithoutRetryWindow(input: RejectedChargeTerminalInput): boolean {
    return (
        input.charge.purpose === 'charge' &&
        input.charge.status === 'rejected' &&
        input.charge.expiresAt === null
    );
}
