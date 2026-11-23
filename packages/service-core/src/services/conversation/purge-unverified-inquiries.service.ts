import { hardDeleteUnverifiedBeforeQuery } from '@repo/db';

/** Days an anonymous inquiry may wait for its email confirmation before it is deleted (HOS-2571). */
export const UNVERIFIED_INQUIRY_RETENTION_DAYS = 7;

/** Source of "now", injected so the cutoff is testable. */
export interface PurgeUnverifiedInquiriesClock {
    /** Current instant. */
    readonly now: () => Date;
}

/**
 * Hard-deletes the anonymous conversations that stayed in `PENDING_VERIFICATION` for more
 * than {@link UNVERIFIED_INQUIRY_RETENTION_DAYS} days, together with the visitor's held
 * message, name, email and phone. Verified conversations are never touched.
 *
 * @param input - `{ clock }`: the clock the 7-day cutoff is measured from.
 * @returns The number of deleted conversations and the cutoff used.
 */
export async function purgeUnverifiedInquiries(input: {
    readonly clock: PurgeUnverifiedInquiriesClock;
}): Promise<{ readonly deleted: number; readonly cutoff: Date }> {
    const cutoff = new Date(
        input.clock.now().getTime() - UNVERIFIED_INQUIRY_RETENTION_DAYS * 24 * 60 * 60 * 1000
    );
    const { deleted } = await hardDeleteUnverifiedBeforeQuery({ cutoff });
    return { deleted, cutoff };
}
