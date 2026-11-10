/**
 * Pure decisions of the weekly AI questions digest (HOS-2101): grouping,
 * opt-out, locale, links and the week key. No database import, so the owner
 * rules — no email on an empty week, opt-out honoured — are testable alone.
 *
 * @module apps/api/services/ai-questions-digest.helpers
 */

import type { AiChatEntityType } from '@repo/schemas';

/** Questions quoted per listing in the email. */
export const DIGEST_MAX_QUESTIONS_PER_LISTING = 5;

/** Length of the digest window. */
export const DIGEST_WINDOW_DAYS = 7;

/** Digest locales. */
export type DigestLocale = 'es' | 'en' | 'pt';

/** One unanswered question, as read for the digest. */
export interface DigestRow {
    readonly ownerId: string;
    readonly entityType: AiChatEntityType;
    readonly entityId: string;
    readonly listingName: string;
    readonly question: string;
    readonly askedAt: Date;
}

/** One listing of one owner's digest. */
export interface DigestListing {
    readonly entityType: AiChatEntityType;
    readonly entityId: string;
    readonly listingName: string;
    readonly unansweredCount: number;
    /** Newest first, at most {@link DIGEST_MAX_QUESTIONS_PER_LISTING}. */
    readonly questions: readonly string[];
}

/** Everything one owner's digest is about. */
export interface OwnerDigest {
    readonly ownerId: string;
    readonly listings: readonly DigestListing[];
    readonly totalUnanswered: number;
}

/**
 * Groups unanswered rows by owner and listing.
 *
 * Owners with no rows simply do not appear, which is the whole "no email on an
 * empty week" rule: an owner is only ever produced from at least one row.
 *
 * @param input - The rows of the window.
 * @returns `{ digests }`, listings ordered by unanswered count (desc).
 */
export function groupDigestRows(input: { readonly rows: readonly DigestRow[] }): {
    readonly digests: readonly OwnerDigest[];
} {
    const byOwner = new Map<string, Map<string, { listing: DigestRow; rows: DigestRow[] }>>();
    for (const row of input.rows) {
        const listings = byOwner.get(row.ownerId) ?? new Map();
        const key = `${row.entityType}:${row.entityId}`;
        const entry = listings.get(key) ?? { listing: row, rows: [] };
        entry.rows.push(row);
        listings.set(key, entry);
        byOwner.set(row.ownerId, listings);
    }

    const digests: OwnerDigest[] = [];
    for (const [ownerId, listings] of byOwner) {
        const built: DigestListing[] = [...listings.values()]
            .map(({ listing, rows }) => ({
                entityType: listing.entityType,
                entityId: listing.entityId,
                listingName: listing.listingName,
                unansweredCount: rows.length,
                questions: [...rows]
                    .sort((a, b) => b.askedAt.getTime() - a.askedAt.getTime())
                    .slice(0, DIGEST_MAX_QUESTIONS_PER_LISTING)
                    .map((row) => row.question)
            }))
            .sort((a, b) => b.unansweredCount - a.unansweredCount);
        digests.push({
            ownerId,
            listings: built,
            totalUnanswered: built.reduce((sum, listing) => sum + listing.unansweredCount, 0)
        });
    }
    return { digests };
}

/**
 * Whether an account accepts the digest.
 *
 * Opt-OUT: absent keys mean yes. Two switches can say no — the dedicated
 * `aiQuestionsDigest` preference and the general `notifications.allowEmails`.
 *
 * @param input - The account's stored `settings` JSONB (any shape).
 * @returns `{ accepts }`.
 */
export function acceptsDigest(input: { readonly settings: unknown }): {
    readonly accepts: boolean;
} {
    if (input.settings === null || typeof input.settings !== 'object') {
        return { accepts: true };
    }
    const settings = input.settings as {
        readonly aiQuestionsDigest?: unknown;
        readonly notifications?: { readonly allowEmails?: unknown } | null;
    };
    if (settings.aiQuestionsDigest === false) {
        return { accepts: false };
    }
    if (settings.notifications?.allowEmails === false) {
        return { accepts: false };
    }
    return { accepts: true };
}

/**
 * The recipient's locale from stored settings, `es` otherwise.
 *
 * @param input - The stored `settings`.
 * @returns `{ locale }`.
 */
export function digestLocale(input: { readonly settings: unknown }): {
    readonly locale: DigestLocale;
} {
    const raw =
        input.settings !== null && typeof input.settings === 'object'
            ? (input.settings as { readonly languageWeb?: unknown }).languageWeb
            : undefined;
    return { locale: raw === 'en' || raw === 'pt' ? raw : 'es' };
}

/**
 * Absolute link to a listing's «Preguntas a la IA» tab.
 *
 * @param input - Site URL, locale and listing.
 * @returns `{ url }`.
 */
export function buildPanelUrl(input: {
    readonly siteUrl: string;
    readonly locale: DigestLocale;
    readonly entityType: AiChatEntityType;
    readonly entityId: string;
}): { readonly url: string } {
    const base = input.siteUrl.replace(/\/+$/, '');
    const hub =
        input.entityType === 'accommodation'
            ? `mi-cuenta/propiedades/${input.entityId}/editar`
            : `mi-cuenta/comercio/${input.entityType}/${input.entityId}/editar`;
    return { url: `${base}/${input.locale}/${hub}/preguntas-ia/` };
}

/**
 * The digest week a run belongs to, as the UTC date of the window start.
 * Used in the idempotency key so a re-run in the same week sends nothing new.
 *
 * @param input - Window start.
 * @returns `{ weekKey }` (`YYYY-MM-DD`).
 */
export function digestWeekKey(input: { readonly windowStart: Date }): { readonly weekKey: string } {
    return { weekKey: input.windowStart.toISOString().slice(0, 10) };
}
