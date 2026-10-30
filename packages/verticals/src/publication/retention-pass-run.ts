import { randomUUID } from 'node:crypto';
import type { Clock } from '@repo/billing-verticals-contract';
import type {
    PublicationUnitOfWork,
    PublicationVertical,
    RetentionAfterCommit,
    RetentionBilling
} from './publication-types';
import { purgeInactiveListing } from './purge-inactive-listing';
import { sendRetentionNotice } from './send-retention-notice';

/** AC:V9b:10, AC:V9b:14, TRANS:V:PB9; H12/H13: daily pass, notices first, PB9 second. */
export const RETENTION_PASS_JOB = 'listing-retention-pass';
/** Maximum candidates read per keyset page. */
export const RETENTION_PASS_PAGE_SIZE = 200;

type Candidate = {
    readonly vertical: PublicationVertical;
    readonly listingId: string;
    readonly ownerId: string;
};
type Cursor = Pick<Candidate, 'vertical' | 'listingId'>;
type Page = { readonly items: readonly Candidate[]; readonly next: Cursor | null };
type Failure = {
    readonly step: 'NOTICE' | 'PURGE';
    readonly vertical: PublicationVertical;
    readonly listingId: string;
    readonly error: unknown;
};

/** Runs all due notices before PB9, isolating failures to individual listings. */
export async function runRetentionPass(args: {
    readonly ports: {
        readonly population: {
            listNoticeDue(input: {
                readonly now: Date;
                readonly after: Cursor | null;
                readonly limit: number;
            }): Promise<Page>;
            listPurgeDue(input: {
                readonly now: Date;
                readonly after: Cursor | null;
                readonly limit: number;
            }): Promise<Page>;
        };
        readonly unitOfWork: PublicationUnitOfWork;
        readonly billing: RetentionBilling;
        readonly clock: Clock;
        readonly afterCommit: RetentionAfterCommit;
        readonly previousPassStartedAt: Date | null;
    };
}): Promise<{
    readonly runCorrelationId: string;
    readonly read: { readonly notices: number; readonly purges: number };
    readonly notices: {
        readonly sent: number;
        readonly enqueued: number;
        readonly skipped: Readonly<Record<string, number>>;
    };
    readonly purged: number;
    readonly purgeSkipped: Readonly<Record<string, number>>;
    readonly purgeWarnings: number;
    readonly failures: readonly Failure[];
    readonly complete: boolean;
}> {
    const { ports } = args;
    const now = ports.clock.now();
    const runCorrelationId = randomUUID();
    const failures: Failure[] = [];
    const noticeSkipped: Record<string, number> = {};
    const purgeSkipped: Record<string, number> = {};
    let noticesRead = 0;
    let purgesRead = 0;
    let sent = 0;
    let enqueued = 0;
    let purged = 0;
    let purgeWarnings = 0;

    let after: Cursor | null = null;
    do {
        const page = await ports.population.listNoticeDue({
            now,
            after,
            limit: RETENTION_PASS_PAGE_SIZE
        });
        for (const candidate of page.items) {
            noticesRead += 1;
            try {
                const result = await sendRetentionNotice({
                    ...ports,
                    ...candidate,
                    correlationId: randomUUID()
                });
                if (result.sent) {
                    sent += 1;
                    if (result.enqueued) enqueued += 1;
                } else noticeSkipped[result.reason] = (noticeSkipped[result.reason] ?? 0) + 1;
            } catch (error) {
                failures.push({
                    step: 'NOTICE',
                    vertical: candidate.vertical,
                    listingId: candidate.listingId,
                    error
                });
            }
        }
        after = page.next;
    } while (after !== null);

    after = null;
    do {
        const page = await ports.population.listPurgeDue({
            now,
            after,
            limit: RETENTION_PASS_PAGE_SIZE
        });
        for (const candidate of page.items) {
            purgesRead += 1;
            try {
                const result = await purgeInactiveListing({
                    ...ports,
                    ...candidate,
                    correlationId: randomUUID()
                });
                if (result.purged) {
                    purged += 1;
                    purgeWarnings += result.warnings.length;
                } else purgeSkipped[result.reason] = (purgeSkipped[result.reason] ?? 0) + 1;
            } catch (error) {
                failures.push({
                    step: 'PURGE',
                    vertical: candidate.vertical,
                    listingId: candidate.listingId,
                    error
                });
            }
        }
        after = page.next;
    } while (after !== null);

    return {
        runCorrelationId,
        read: { notices: noticesRead, purges: purgesRead },
        notices: { sent, enqueued, skipped: noticeSkipped },
        purged,
        purgeSkipped,
        purgeWarnings,
        failures,
        complete: failures.length === 0
    };
}
