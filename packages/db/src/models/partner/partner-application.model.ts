import { sql } from 'drizzle-orm';
import type { DrizzleClient } from '../../types.ts';

/** Transaction-bound persistence operations for Partner applications. */
export const partnerApplicationModel = {
    /** Locks a live Partner and reads its approved application mailbox and claim hash. */
    async lockPartnerForLinkClaim(args: {
        readonly tx: DrizzleClient;
        readonly partnerId: string;
    }): Promise<{
        readonly partnerId: string;
        readonly ownerUserId: string | null;
        readonly claimSecretHash: string | null;
        readonly applicationEmail: string | null;
    } | null> {
        const result = await args.tx.execute(sql`
            SELECT p.id AS partner_id, p.owner_user_id, p.claim_secret_hash, pa.email AS application_email
            FROM partners p
            LEFT JOIN partner_application pa ON pa.partner_id = p.id AND pa.status = 'APPROVED'
            WHERE p.id = ${args.partnerId} AND p.deleted_at IS NULL
            ORDER BY pa.resolved_at ASC NULLS LAST LIMIT 1 FOR UPDATE OF p`);
        const row = result.rows[0];
        return row
            ? {
                  partnerId: String(row.partner_id),
                  ownerUserId: row.owner_user_id == null ? null : String(row.owner_user_id),
                  claimSecretHash:
                      row.claim_secret_hash == null ? null : String(row.claim_secret_hash),
                  applicationEmail:
                      row.application_email == null ? null : String(row.application_email)
              }
            : null;
    },

    /** Finds the live Partner already owned by an account. */
    async findOwnedPartnerId(args: {
        readonly tx: DrizzleClient;
        readonly userId: string;
    }): Promise<string | null> {
        const result = await args.tx.execute(
            sql`SELECT id FROM partners WHERE owner_user_id = ${args.userId} AND deleted_at IS NULL LIMIT 1`
        );
        return result.rows[0] ? String(result.rows[0].id) : null;
    },

    /** Reads a live account's email verification state. */
    async readAccountForClaim(args: {
        readonly tx: DrizzleClient;
        readonly userId: string;
    }): Promise<{ readonly email: string; readonly emailVerified: boolean } | null> {
        const result = await args.tx.execute(
            sql`SELECT email, email_verified FROM users WHERE id = ${args.userId} AND deleted_at IS NULL`
        );
        const row = result.rows[0];
        return row
            ? { email: String(row.email), emailVerified: Boolean(row.email_verified) }
            : null;
    },

    /** Reads the credential stored on the specified account session. */
    async readSessionAuthMethod(args: {
        readonly tx: DrizzleClient;
        readonly sessionId: string;
        readonly userId: string;
    }): Promise<{ readonly found: boolean; readonly authMethod: string | null }> {
        const result = await args.tx.execute(
            sql`SELECT auth_method FROM session WHERE id = ${args.sessionId} AND user_id = ${args.userId}`
        );
        return result.rows[0]
            ? {
                  found: true,
                  authMethod:
                      result.rows[0].auth_method == null ? null : String(result.rows[0].auth_method)
              }
            : { found: false, authMethod: null };
    },

    /**
     * Verifies the account and removes all prior sessions, credentials, and verification tokens.
     * Same capability as account closure (ACC:24), scoped to everything except the claim session and its credential (V7 §2.4 rule 2).
     */
    async verifyAccountAndRevokeOthers(args: {
        readonly tx: DrizzleClient;
        readonly userId: string;
        readonly email: string;
        readonly keepSessionId: string;
        readonly keepProviderId: string | null;
    }): Promise<{
        readonly revokedSessionIds: readonly string[];
        readonly removedProviderIds: readonly string[];
    }> {
        await args.tx.execute(
            sql`UPDATE users SET email_verified = true WHERE id = ${args.userId}`
        );
        const sessionsResult = await args.tx.execute(
            sql`DELETE FROM session WHERE user_id = ${args.userId} AND id <> ${args.keepSessionId} RETURNING id`
        );
        const accountsResult = await args.tx.execute(
            sql`DELETE FROM account WHERE user_id = ${args.userId} AND (${args.keepProviderId}::text IS NULL OR provider_id <> ${args.keepProviderId}) RETURNING provider_id`
        );
        await args.tx.execute(
            sql`DELETE FROM verification WHERE value = ${args.userId} OR lower(identifier) = lower(${args.email})`
        );
        return {
            revokedSessionIds: sessionsResult.rows.map((row) => String(row.id)),
            removedProviderIds: accountsResult.rows.map((row) => String(row.provider_id)).sort()
        };
    },
    /** Reads an application without locking it for approval preflight checks. */
    async readById(args: { readonly tx: DrizzleClient; readonly applicationId: string }): Promise<{
        readonly id: string;
        readonly email: string;
        readonly status: string;
        readonly waitCancelledAt: Date | null;
    } | null> {
        const result = await args.tx.execute(sql`
            SELECT id, email, status, wait_cancelled_at
            FROM partner_application
            WHERE id = ${args.applicationId}`);
        const row = result.rows[0];
        if (!row) return null;
        return {
            id: String(row.id),
            email: String(row.email),
            status: String(row.status),
            waitCancelledAt: row.wait_cancelled_at as Date | null
        };
    },

    /** Locks the approved Partner created for this account, using the approval event marker. */
    async lockPartnerClaimableByCreatedAccount(args: {
        readonly tx: DrizzleClient;
        readonly userId: string;
        readonly email: string;
    }): Promise<{ readonly partnerId: string; readonly applicationId: string } | null> {
        const result = await args.tx.execute(sql`
            SELECT pa.id AS application_id, p.id AS partner_id
            FROM partner_application pa
            JOIN partners p ON p.id = pa.partner_id
            WHERE pa.status = 'APPROVED'
              AND lower(pa.email) = lower(${args.email})
              AND p.owner_user_id IS NULL
              AND p.deleted_at IS NULL
              AND EXISTS (
                SELECT 1 FROM domain_event de
                WHERE de.entity_type = 'partner_application'
                  AND de.entity_id = pa.id::text
                  AND de.event_type = 'partner_application.approved'
                  AND de.changes @> jsonb_build_array(jsonb_build_object('field', 'claim_account_user_id', 'new', ${args.userId}::text))
              )
            ORDER BY pa.resolved_at ASC
            LIMIT 1
            FOR UPDATE OF p`);
        const row = result.rows[0];
        return row
            ? { partnerId: String(row.partner_id), applicationId: String(row.application_id) }
            : null;
    },

    /** Sets a Partner owner only while the Partner remains unclaimed. */
    async setPartnerOwnerIfUnclaimed(args: {
        readonly tx: DrizzleClient;
        readonly partnerId: string;
        readonly userId: string;
    }): Promise<boolean> {
        const result = await args.tx.execute(sql`
            UPDATE partners
            SET owner_user_id = ${args.userId}, updated_by_id = ${args.userId}
            WHERE id = ${args.partnerId} AND owner_user_id IS NULL
            RETURNING id`);
        return result.rows.length > 0;
    },

    /**
     * The only writer of claim_secret_hash; overwrites a previous hash on purpose (a re-render
     * invalidates the previous link, D-2); never writes once the Partner has an owner, because
     * the claim keeps the hash (V7 §2.4 rule 4).
     */
    async setClaimSecretHashIfUnclaimed(args: {
        readonly tx: DrizzleClient;
        readonly partnerId: string;
        readonly hash: string;
    }): Promise<boolean> {
        const result = await args.tx.execute(sql`
            UPDATE partners
            SET claim_secret_hash = ${args.hash}
            WHERE id = ${args.partnerId}
              AND owner_user_id IS NULL
              AND deleted_at IS NULL
            RETURNING id`);
        return result.rows.length > 0;
    },

    /** Inserts a pending application and returns its generated identifier. */
    async insertPending(args: {
        readonly tx: DrizzleClient;
        readonly email: string;
    }): Promise<{ readonly id: string }> {
        const result = await args.tx.execute(sql`
            INSERT INTO partner_application (email, status, deadlines_version)
            VALUES (${args.email}, 'PENDING', (SELECT max("version") FROM "vertical_deadline_version"))
            RETURNING id`);
        const row = result.rows[0];
        if (!row) throw new Error('Partner application insert did not return an id');
        return { id: String(row.id) };
    },

    /** Locks a Partner application and reads the fields required to resolve its wait. */
    async lockById(args: { readonly tx: DrizzleClient; readonly applicationId: string }): Promise<{
        readonly id: string;
        readonly email: string;
        readonly status: string;
        readonly waitCancelledAt: Date | null;
    } | null> {
        const result = await args.tx.execute(sql`
            SELECT id, email, status, wait_cancelled_at
            FROM partner_application
            WHERE id = ${args.applicationId}
            FOR UPDATE`);
        const row = result.rows[0];
        if (!row) return null;
        return {
            id: String(row.id),
            email: String(row.email),
            status: String(row.status),
            waitCancelledAt: row.wait_cancelled_at as Date | null
        };
    },

    /** Cancels a rejected application's wait without changing its machine state. */
    async cancelWait(args: {
        readonly tx: DrizzleClient;
        readonly applicationId: string;
        readonly at: Date;
        readonly actorId: string;
    }): Promise<void> {
        await args.tx.execute(sql`
            UPDATE partner_application
            SET wait_cancelled_at = ${args.at}, wait_cancelled_by = ${args.actorId}
            WHERE id = ${args.applicationId}`);
    },

    /** Creates an unclaimed draft Partner for an approved application. */
    async insertUnclaimedPartner(args: {
        readonly tx: DrizzleClient;
        readonly name: string;
        readonly slug: string;
        readonly type: string;
        readonly actorId: string;
    }): Promise<{ readonly id: string }> {
        const result = await args.tx.execute(sql`
            INSERT INTO partners (slug, name, type, lifecycle_state, created_by_id, updated_by_id)
            VALUES (${args.slug}, ${args.name}, ${args.type}, 'DRAFT', ${args.actorId}, ${args.actorId})
            RETURNING id`);
        const row = result.rows[0];
        if (!row) throw new Error('Partner insert did not return an id');
        return { id: String(row.id) };
    },

    /** Marks a pending application approved and links its unclaimed Partner. */
    async markApproved(args: {
        readonly tx: DrizzleClient;
        readonly applicationId: string;
        readonly at: Date;
        readonly partnerId: string;
    }): Promise<void> {
        await args.tx.execute(sql`
            UPDATE partner_application
            SET status = 'APPROVED', resolved_at = ${args.at}, partner_id = ${args.partnerId}
            WHERE id = ${args.applicationId}`);
    },

    /** Marks a pending application rejected and stores the active deadline version. */
    async markRejected(args: {
        readonly tx: DrizzleClient;
        readonly applicationId: string;
        readonly at: Date;
    }): Promise<void> {
        await args.tx.execute(sql`
            UPDATE partner_application
            SET status = 'REJECTED', resolved_at = ${args.at},
                deadlines_version = (SELECT max("version") FROM "vertical_deadline_version")
            WHERE id = ${args.applicationId}`);
    },

    /** Finds an account by case-insensitive email, including soft-deleted rows. */
    async findAccountIdByEmail(args: {
        readonly tx: DrizzleClient;
        readonly email: string;
    }): Promise<{ readonly id: string } | null> {
        const result = await args.tx.execute(sql`
            SELECT id FROM users WHERE lower(email) = lower(${args.email}) LIMIT 1`);
        const row = result.rows[0];
        return row ? { id: String(row.id) } : null;
    },

    /** Reads the account's supported web locale, falling back to Spanish. */
    async readAccountLocaleByEmail(args: {
        readonly tx: DrizzleClient;
        readonly email: string;
    }): Promise<'es' | 'en' | 'pt'> {
        const result = await args.tx.execute(sql`
            SELECT COALESCE(settings->>'languageWeb', settings->>'language') AS locale
            FROM users
            WHERE lower(email) = lower(${args.email})
            LIMIT 1`);
        const locale = result.rows[0]?.locale;
        return locale === 'en' || locale === 'pt' || locale === 'es' ? locale : 'es';
    },

    /** Reads the rejection's market reapplication date from its stored deadline version. */
    async readReapplyAfter(args: {
        readonly tx: DrizzleClient;
        readonly applicationId: string;
    }): Promise<Date> {
        const result = await args.tx.execute(sql`
            SELECT pa.resolved_at + make_interval(days => (v."values" -> '9' ->> 'days')::integer) AS reapply_after
            FROM partner_application pa
            JOIN vertical_deadline_version v ON v.version = pa.deadlines_version
            WHERE pa.id = ${args.applicationId}`);
        const rawValue = result.rows[0]?.reapply_after;
        const value = rawValue instanceof Date ? rawValue : new Date(String(rawValue ?? ''));
        if (rawValue == null || Number.isNaN(value.getTime())) {
            throw new Error(
                `Could not read reapply date for partner application ${args.applicationId}`
            );
        }
        return value;
    }
};
