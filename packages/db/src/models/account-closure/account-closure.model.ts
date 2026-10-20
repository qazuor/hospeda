import { randomBytes } from 'node:crypto';
import { sql } from 'drizzle-orm';
import type { DrizzleClient } from '../../types.ts';
import type { ListingVertical } from '../listing/listing-publication.model.ts';
import {
    ACCOUNT_CLOSURE_CONTACT_KEYS,
    APPLICATION_EMAIL_PSEUDONYM_PREFIX,
    buildAccountEmailPseudonym,
    buildApplicationEmailPseudonym,
    CLOSED_ACCOUNT_DISPLAY_NAME,
    PSEUDONYM_EMAIL_DOMAIN,
    partnerPresenceHasContent
} from './account-closure.pure.ts';

/** The account row as action 24 reads it, locked until commit. */
export interface LockedClosureAccount {
    readonly id: string;
    readonly email: string;
    readonly displayName: string | null;
    readonly firstName: string | null;
    readonly lastName: string | null;
    readonly deletedAt: Date | null;
    readonly isSystemAccount: boolean;
}

/** A listing of the account outside `PURGED`, which blocks action 24 (H9). */
export interface ClosureBlockingListing {
    readonly vertical: ListingVertical;
    readonly id: string;
}

/** The partner presence of the account, locked until commit. */
export interface LockedPartnerPresence {
    readonly partnerId: string;
    readonly hasContent: boolean;
}

/** A partner application as action 24 reads it, locked until commit. */
export interface LockedClosureApplication {
    readonly id: string;
    readonly email: string;
    readonly status: string;
    readonly createdAt: Date;
}

/** What {@link accountClosureModel.closeAccount} wrote. It never returns the old mailbox. */
export interface CloseAccountResult {
    readonly replacedApplicationIds: readonly string[];
    readonly deletedAccounts: number;
    readonly deletedSessions: number;
    readonly deletedVerifications: number;
}

/** Thrown when the closure write does not find exactly one live account row to pseudonymise. */
export class AccountClosureWriteError extends Error {
    /** Id of the account the write was aimed at. */
    readonly userId: string;

    constructor(input: { readonly userId: string; readonly reason: string }) {
        super(`Account closure write failed for ${input.userId}: ${input.reason}`);
        this.name = 'AccountClosureWriteError';
        this.userId = input.userId;
    }
}

/** Fixed lock order across the three listing tables: accommodation, gastronomy, experience. */
const LISTING_LOCK_ORDER = ['accommodation', 'gastronomy', 'experience'] as const;

const LISTING_TABLES: Record<(typeof LISTING_LOCK_ORDER)[number], string> = {
    accommodation: 'accommodations',
    gastronomy: 'gastronomies',
    experience: 'experiences'
};

function toDate(value: unknown): Date {
    return value instanceof Date ? value : new Date(String(value));
}

function toNullableDate(value: unknown): Date | null {
    return value === null || value === undefined ? null : toDate(value);
}

function toNullableString(value: unknown): string | null {
    return value === null || value === undefined ? null : String(value);
}

function toNullableRecord(value: unknown): Readonly<Record<string, unknown>> | null {
    return value !== null && typeof value === 'object' && !Array.isArray(value)
        ? (value as Record<string, unknown>)
        : null;
}

/**
 * Transaction-bound persistence of administrative action 24, «dar de baja una cuenta a pedido de
 * su dueño» (ACC:24, `NUCLEO/08` §3; AC:V8a:10, AC:V8a:11, AC:V8a:12).
 *
 * The model decides nothing. Every method takes the caller's `tx`: the service opens ONE
 * transaction, takes the locks with the `lock*` reads, asks billing, and only then calls the
 * writes. A read outside that transaction would be a TOCTOU (Coord-182). The audit event is
 * written by the service with `domainEventModel.insert({ ..., tx })`, not here.
 */
export const accountClosureModel = {
    /**
     * Reads and locks the account row (`FOR UPDATE`). Does NOT filter `deleted_at`: the service
     * answers 404 for an account already closed.
     */
    async lockAccount(args: {
        readonly tx: DrizzleClient;
        readonly userId: string;
    }): Promise<LockedClosureAccount | null> {
        const result = await args.tx.execute(sql`
            SELECT id, email, display_name, first_name, last_name, deleted_at, is_system_account
            FROM users WHERE id = ${args.userId}
            FOR UPDATE`);
        const row = result.rows[0];
        if (!row) return null;
        return {
            id: String(row.id),
            email: String(row.email),
            displayName: toNullableString(row.display_name),
            firstName: toNullableString(row.first_name),
            lastName: toNullableString(row.last_name),
            deletedAt: toNullableDate(row.deleted_at),
            isSystemAccount: row.is_system_account === true
        };
    },

    /**
     * Reads and locks the owner's listings outside `PURGED` (H9): `deleted_at IS NULL` and
     * `publication_status <> 'PURGED'`, across the three tables in a fixed order (accommodation,
     * gastronomy, experience) so two closures never lock them crosswise. A row with `deleted_at`
     * does not count: PB12 cannot see it, and it would block the account forever.
     */
    async lockListingsNotPurged(args: {
        readonly tx: DrizzleClient;
        readonly ownerId: string;
    }): Promise<readonly ClosureBlockingListing[]> {
        const listings: ClosureBlockingListing[] = [];
        for (const vertical of LISTING_LOCK_ORDER) {
            const result = await args.tx.execute(sql`
                SELECT id FROM ${sql.identifier(LISTING_TABLES[vertical])}
                WHERE owner_id = ${args.ownerId} AND deleted_at IS NULL
                  AND publication_status <> 'PURGED'
                ORDER BY id
                FOR UPDATE`);
            for (const row of result.rows) {
                listings.push({ vertical: vertical as ListingVertical, id: String(row.id) });
            }
        }
        return listings;
    },

    /**
     * Reads and locks the account's live partner presence (`owner_user_id`, `deleted_at IS NULL`;
     * at most one by `uq_partners_owner_user_id`) and tells whether it still holds content.
     */
    async lockPartnerPresence(args: {
        readonly tx: DrizzleClient;
        readonly ownerUserId: string;
    }): Promise<LockedPartnerPresence | null> {
        const result = await args.tx.execute(sql`
            SELECT id, logo_url, description, website_url, pending_logo_url,
                   pending_description, pending_website_url, social_networks, contact_info
            FROM partners
            WHERE owner_user_id = ${args.ownerUserId} AND deleted_at IS NULL
            FOR UPDATE`);
        const row = result.rows[0];
        if (!row) return null;
        return {
            partnerId: String(row.id),
            hasContent: partnerPresenceHasContent({
                logoUrl: toNullableString(row.logo_url),
                description: toNullableString(row.description),
                websiteUrl: toNullableString(row.website_url),
                pendingLogoUrl: toNullableString(row.pending_logo_url),
                pendingDescription: toNullableString(row.pending_description),
                pendingWebsiteUrl: toNullableString(row.pending_website_url),
                socialNetworks: toNullableRecord(row.social_networks),
                contactInfo: toNullableRecord(row.contact_info)
            })
        };
    },

    /** Reads and locks one partner application (`FOR UPDATE`), for action 24 without an account. */
    async lockApplication(args: {
        readonly tx: DrizzleClient;
        readonly applicationId: string;
    }): Promise<LockedClosureApplication | null> {
        const result = await args.tx.execute(sql`
            SELECT id, email, status, created_at FROM partner_application
            WHERE id = ${args.applicationId}
            FOR UPDATE`);
        const row = result.rows[0];
        if (!row) return null;
        return {
            id: String(row.id),
            email: String(row.email),
            status: String(row.status),
            createdAt: toDate(row.created_at)
        };
    },

    /** Finds the live account (no `deleted_at`) whose mailbox matches, ignoring case (H15). */
    async findLiveAccountIdByEmail(args: {
        readonly tx: DrizzleClient;
        readonly email: string;
    }): Promise<string | null> {
        const result = await args.tx.execute(sql`
            SELECT id FROM users
            WHERE lower(email) = lower(${args.email}) AND deleted_at IS NULL
            LIMIT 1`);
        const row = result.rows[0];
        return row ? String(row.id) : null;
    },

    /**
     * Writes action 24 over an account (AC:V8a:11), in this order and inside the caller's `tx`:
     * (a) reads the current mailbox (the row is already locked by {@link lockAccount});
     * (b) replaces the mailbox of every partner application carrying it, ignoring case, each
     *     with its own pseudonym;
     * (c) deletes the `verification` rows bound to the account (by `value`) or to its mailbox
     *     (by `identifier`), so a live reset token cannot mint a new credential (H6);
     * (d) deletes its sessions, with the same criterion as `revokeUserSessions`
     *     (`packages/service-core/src/services/user/user.session-revocation.ts:42-55`);
     * (e) deletes its `account` rows: the password and every external provider link (AUT-015);
     * (f) pseudonymises the `users` row: mailbox, display, first and last name, slug (a copy of
     *     the name), and every phone and mailbox in `contact_info`; writes `deleted_at` and
     *     `deleted_by_id`. Writing `deleted_at` fires `trg_softdelete_bookmarks_on_users`
     *     (`extras/003`), which deletes the bookmarks OTHER accounts saved on this one.
     *
     * It does NOT touch, by DEC-DATA-005📌5: the audit log (`domain_event`, actor and subject by
     * id), payments, the payer name and mailbox copied on each `receipt` (the law requires
     * keeping receipts), nor the `trial` row with its pseudonym (FK `RESTRICT`, the lock against
     * repeating the trial). Also left as residue for the owner (H4, H6): `user_role`,
     * `r_user_permission`, `user_bookmarks` saved BY the account, `user_auth_identities`,
     * `user_push_tokens`, `image`, `birth_date`, `location`, `social_networks`, `profile`,
     * `settings`. It re-checks no precondition: the service decides before calling it.
     *
     * @throws {AccountClosureWriteError} when no live account row is updated.
     */
    async closeAccount(args: {
        readonly tx: DrizzleClient;
        readonly userId: string;
        readonly actorId: string;
        readonly at: Date;
    }): Promise<CloseAccountResult> {
        const { tx, userId, actorId, at } = args;
        const current = await tx.execute(sql`SELECT email FROM users WHERE id = ${userId}`);
        const currentRow = current.rows[0];
        if (!currentRow) {
            throw new AccountClosureWriteError({ userId, reason: 'account not found' });
        }
        const oldEmail = String(currentRow.email);

        const applications = await tx.execute(sql`
            UPDATE partner_application
            SET email = ${APPLICATION_EMAIL_PSEUDONYM_PREFIX} || id::text || ${`@${PSEUDONYM_EMAIL_DOMAIN}`},
                updated_at = ${at}
            WHERE lower(email) = lower(${oldEmail})
            RETURNING id`);

        const verifications = await tx.execute(sql`
            DELETE FROM verification
            WHERE value = ${userId} OR lower(identifier) = lower(${oldEmail})
            RETURNING id`);
        const sessions = await tx.execute(
            sql`DELETE FROM session WHERE user_id = ${userId} RETURNING id`
        );
        const accounts = await tx.execute(
            sql`DELETE FROM account WHERE user_id = ${userId} RETURNING id`
        );

        const nulledContactKeys = sql.join(
            ACCOUNT_CLOSURE_CONTACT_KEYS.map((key) => sql`${key}::text, NULL`),
            sql`, `
        );
        const updated = await tx.execute(sql`
            UPDATE users SET
                email = ${buildAccountEmailPseudonym({ userId }).email},
                display_name = ${CLOSED_ACCOUNT_DISPLAY_NAME},
                first_name = NULL,
                last_name = NULL,
                slug = ${`user-${randomBytes(4).toString('hex')}`},
                contact_info = CASE
                    WHEN contact_info IS NULL OR jsonb_typeof(contact_info) <> 'object'
                        THEN contact_info
                    ELSE contact_info || jsonb_build_object(${nulledContactKeys})
                END,
                deleted_at = ${at},
                deleted_by_id = ${actorId},
                updated_at = ${at},
                updated_by_id = ${actorId}
            WHERE id = ${userId} AND deleted_at IS NULL
            RETURNING id`);
        if (updated.rows.length !== 1) {
            throw new AccountClosureWriteError({
                userId,
                reason: `expected 1 live account row, updated ${updated.rows.length}`
            });
        }

        return {
            replacedApplicationIds: applications.rows.map((row) => String(row.id)),
            deletedAccounts: accounts.rows.length,
            deletedSessions: sessions.rows.length,
            deletedVerifications: verifications.rows.length
        };
    },

    /**
     * Writes action 24 over a partner application made without an account (AC:V8a:12): replaces
     * its mailbox with its own pseudonym. Leaves status, `resolved_at`, `partner_id` and the wait
     * untouched.
     */
    async replaceApplicationEmail(args: {
        readonly tx: DrizzleClient;
        readonly applicationId: string;
        readonly at: Date;
    }): Promise<{ readonly replaced: boolean }> {
        const result = await args.tx.execute(sql`
            UPDATE partner_application
            SET email = ${buildApplicationEmailPseudonym({ applicationId: args.applicationId }).email},
                updated_at = ${args.at}
            WHERE id = ${args.applicationId}
            RETURNING id`);
        return { replaced: result.rows.length > 0 };
    }
};
