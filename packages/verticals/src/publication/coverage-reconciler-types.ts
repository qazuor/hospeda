import type {
    PublicationAfterCommit,
    PublicationBilling,
    PublicationUnitOfWork,
    PublicationVertical
} from './publication-types';

/** A read-only count snapshot for one owner and vertical. */
export interface ReconcilerOwnerSummary {
    readonly published: number;
    readonly unpublishedByBilling: number;
    readonly archived: number;
}

/** Presence keys whose cached effective set must match the live set. */
export type PartnerPresenceKey = 'partner_public_page' | 'partner_carousel_presence';

/** Ports used by the daily coverage reconciliation; all pages use keyset cursors. */
export interface ReconcilerPorts {
    readonly population: {
        listOwnerVerticals(args: {
            readonly after: {
                readonly userId: string;
                readonly vertical: PublicationVertical;
            } | null;
            readonly limit: number;
        }): Promise<{
            readonly items: readonly {
                readonly userId: string;
                readonly vertical: PublicationVertical;
            }[];
            readonly next: {
                readonly userId: string;
                readonly vertical: PublicationVertical;
            } | null;
        }>;
        listPartnerUsers(args: {
            readonly after: string | null;
            readonly limit: number;
        }): Promise<{ readonly items: readonly string[]; readonly next: string | null }>;
    };
    readonly reader: {
        summarize(args: {
            readonly userId: string;
            readonly vertical: PublicationVertical;
        }): Promise<ReconcilerOwnerSummary>;
    };
    readonly liveLimit: (args: {
        readonly userId: string;
        readonly vertical: PublicationVertical;
    }) => Promise<number | null>;
    readonly billing: PublicationBilling;
    readonly presence: {
        liveKeys(args: { readonly userId: string }): Promise<readonly PartnerPresenceKey[]>;
        cachedKeys(args: {
            readonly userId: string;
        }): Promise<readonly PartnerPresenceKey[] | null>;
        invalidate(args: { readonly userId: string }): Promise<void>;
    };
    readonly unitOfWork: PublicationUnitOfWork;
    readonly afterCommit: PublicationAfterCommit;
    readonly clock: import('@repo/billing-verticals-contract').Clock;
    readonly monitor: { ping(args: { readonly job: string }): Promise<void> };
}

/** Result of one daily reconciliation run. */
export interface ReconcilerSummary {
    readonly pairsRead: number;
    readonly ran: number;
    readonly lowered: number;
    readonly restored: number;
    readonly partnerChecked: number;
    readonly partnerInvalidated: number;
    readonly failures: readonly {
        readonly userId: string;
        readonly vertical?: PublicationVertical;
        readonly error: unknown;
    }[];
    readonly complete: boolean;
    readonly pinged: boolean;
}
