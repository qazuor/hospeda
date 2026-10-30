import { randomUUID } from 'node:crypto';
import type { Clock } from '@repo/billing-verticals-contract';
import { archiveInactiveListing } from './archive-inactive-listing';
import type {
    PublicationAfterCommit,
    PublicationUnitOfWork,
    PublicationVertical,
    RetentionBilling
} from './publication-types';

/** Stable job identifier shared by the production cron registration. */
export const INACTIVITY_ARCHIVE_JOB = 'listing-inactivity-archive';
/** Maximum retention candidates fetched per keyset page. */
export const INACTIVITY_ARCHIVE_PAGE_SIZE = 200;

/** Runs PB4/PB5 over every page and isolates failures to individual listings. */
export async function runInactivityArchive(args: {
    readonly ports: {
        readonly population: {
            listDue(input: {
                readonly now: Date;
                readonly after: {
                    readonly vertical: PublicationVertical;
                    readonly listingId: string;
                } | null;
                readonly limit: number;
            }): Promise<{
                readonly items: readonly {
                    readonly vertical: PublicationVertical;
                    readonly listingId: string;
                    readonly ownerId: string;
                }[];
                readonly next: {
                    readonly vertical: PublicationVertical;
                    readonly listingId: string;
                } | null;
            }>;
        };
        readonly unitOfWork: PublicationUnitOfWork;
        readonly billing: RetentionBilling;
        readonly clock: Clock;
        readonly afterCommit: PublicationAfterCommit;
    };
}): Promise<{
    readonly read: number;
    readonly archived: number;
    readonly archivedByTransition: { readonly PB4: number; readonly PB5: number };
    readonly skipped: Readonly<Record<string, number>>;
    readonly failures: readonly {
        readonly vertical: PublicationVertical;
        readonly listingId: string;
        readonly error: unknown;
    }[];
    readonly complete: boolean;
}> {
    const now = args.ports.clock.now();
    let after: { vertical: PublicationVertical; listingId: string } | null = null;
    let read = 0;
    let archived = 0;
    let pb4 = 0;
    let pb5 = 0;
    const skipped: Record<string, number> = {};
    const failures: { vertical: PublicationVertical; listingId: string; error: unknown }[] = [];
    do {
        const page = await args.ports.population.listDue({
            now,
            after,
            limit: INACTIVITY_ARCHIVE_PAGE_SIZE
        });
        for (const candidate of page.items) {
            read += 1;
            try {
                const result = await archiveInactiveListing({
                    ...args.ports,
                    ...candidate,
                    correlationId: randomUUID()
                });
                if (result.archived) {
                    archived += 1;
                    if (result.transition === 'PB4') pb4 += 1;
                    else pb5 += 1;
                } else skipped[result.reason] = (skipped[result.reason] ?? 0) + 1;
            } catch (error) {
                failures.push({
                    vertical: candidate.vertical,
                    listingId: candidate.listingId,
                    error
                });
            }
        }
        after = page.next;
    } while (after !== null);
    return {
        read,
        archived,
        archivedByTransition: { PB4: pb4, PB5: pb5 },
        skipped,
        failures,
        complete: failures.length === 0
    };
}
