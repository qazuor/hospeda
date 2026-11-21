/**
 * @file email-catalog-filter.ts
 * @description Client-side search, domain filter and grouping of the email
 * catalog (HOS-2519 §8). Pure functions, no React.
 */

import type { EmailCatalogDomain, EmailPreviewEntrySummary } from '@repo/schemas';

/**
 * Lowercases and strips diacritics so "Renovación" matches "renov".
 *
 * @param input - The text to normalize.
 * @returns The normalized text.
 */
export function normalizeSearchText({ text }: { readonly text: string }): string {
    return text
        .normalize('NFD')
        .replace(/\p{Diacritic}/gu, '')
        .toLowerCase()
        .trim();
}

/** Input of {@link filterEmailCatalog}. */
export interface FilterEmailCatalogInput {
    readonly entries: readonly EmailPreviewEntrySummary[];
    /** Free text matched against name, key and id (case- and accent-insensitive). */
    readonly search: string;
    /** Selected domains; empty means every domain. */
    readonly domains: readonly EmailCatalogDomain[];
}

/**
 * Filters the catalog by the search text and the selected domains, keeping
 * catalog order.
 *
 * @param input - Entries, search text and selected domains.
 * @returns The matching entries.
 */
export function filterEmailCatalog(
    input: FilterEmailCatalogInput
): readonly EmailPreviewEntrySummary[] {
    const needle = normalizeSearchText({ text: input.search });
    const domainSet = new Set(input.domains);
    return input.entries.filter((entry) => {
        if (domainSet.size > 0 && !domainSet.has(entry.domain)) {
            return false;
        }
        if (!needle) {
            return true;
        }
        return [entry.name, entry.key, entry.id].some((field) =>
            normalizeSearchText({ text: field }).includes(needle)
        );
    });
}

/** One domain group of the list. */
export interface EmailCatalogGroup {
    readonly domain: EmailCatalogDomain;
    readonly entries: readonly EmailPreviewEntrySummary[];
}

/**
 * Groups entries by domain, in order of first appearance (catalog order).
 *
 * @param input - The entries to group.
 * @returns The groups.
 */
export function groupEmailCatalogByDomain({
    entries
}: {
    readonly entries: readonly EmailPreviewEntrySummary[];
}): readonly EmailCatalogGroup[] {
    const groups = new Map<EmailCatalogDomain, EmailPreviewEntrySummary[]>();
    for (const entry of entries) {
        const group = groups.get(entry.domain);
        if (group) {
            group.push(entry);
        } else {
            groups.set(entry.domain, [entry]);
        }
    }
    return [...groups].map(([domain, grouped]) => ({ domain, entries: grouped }));
}

/**
 * Domains present in the catalog, in order of first appearance.
 *
 * @param input - The full catalog.
 * @returns The distinct domains.
 */
export function listCatalogDomains({
    entries
}: {
    readonly entries: readonly EmailPreviewEntrySummary[];
}): readonly EmailCatalogDomain[] {
    return [...new Set(entries.map((entry) => entry.domain))];
}
