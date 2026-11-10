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

/** Time zone the digest week is counted in (the market's). */
export const DIGEST_TIME_ZONE = 'America/Argentina/Buenos_Aires';

/**
 * The digest week a run belongs to: the ISO 8601 week (`YYYY-Www`) of the
 * window END as a calendar date in {@link DIGEST_TIME_ZONE}.
 *
 * Used in the idempotency key. Keying on the week — not on a date derived
 * from the run instant — makes a manual re-run any other day of the same week
 * send nothing (HOS-2101 review, M3).
 *
 * @param input - Window end (the run instant).
 * @returns `{ weekKey }`, e.g. `2026-W47`.
 */
export function digestWeekKey(input: { readonly windowEnd: Date }): { readonly weekKey: string } {
    const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone: DIGEST_TIME_ZONE,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    }).formatToParts(input.windowEnd);
    const part = (type: string): number =>
        Number(parts.find((entry) => entry.type === type)?.value ?? Number.NaN);
    // A UTC-midnight Date stands for the local calendar date from here on.
    const date = new Date(Date.UTC(part('year'), part('month') - 1, part('day')));
    const isoWeekday = date.getUTCDay() === 0 ? 7 : date.getUTCDay();
    // The Thursday of this ISO week decides the ISO year.
    const thursday = new Date(date.getTime() + (4 - isoWeekday) * 86_400_000);
    const isoYear = thursday.getUTCFullYear();
    const yearStart = Date.UTC(isoYear, 0, 1);
    const week = Math.floor((thursday.getTime() - yearStart) / (7 * 86_400_000)) + 1;
    return { weekKey: `${isoYear}-W${String(week).padStart(2, '0')}` };
}
