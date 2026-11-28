import { readUtmParams } from '@repo/analytics';
import { buildQrCodeTagFilterCondition, buildQrCodeUtmCampaignCondition } from '@repo/db';
import type { SQL } from 'drizzle-orm';

/**
 * Pure helpers behind the admin QR list's organisation features (HOS-2679):
 * the `utmCampaign` / `tagIds` filters and the campaign dropdown.
 *
 * Separate from `qr-code.service.ts` so the encoding rules are testable without a
 * service, and so that file stops growing.
 *
 * @module services/qr-code/qr-code.organize
 */

/**
 * Every spelling a decoded campaign may be stored under in a target URL.
 *
 * The column holds the URL as written, and SQL cannot decode it, so the filter
 * compares against the encoded forms instead: `encodeURIComponent` (what the
 * panel's UTM editor writes), the same with `+` for spaces (what a form or
 * `URLSearchParams` writes), and the raw value (what somebody typed by hand into
 * the URL field — `verano-2026` is all three at once).
 *
 * @param input.value - The decoded campaign, as the operator picked it.
 * @returns De-duplicated encoded spellings.
 */
export function encodedCampaignSpellings(input: { readonly value: string }): string[] {
    const percent = encodeURIComponent(input.value);
    return [...new Set([percent, percent.replace(/%20/g, '+'), input.value])];
}

/**
 * Turns the raw campaigns the model read into the dropdown's values: decoded the
 * same way `readUtmParams` decodes, blanks dropped, spellings of one campaign
 * folded into one, sorted for display.
 *
 * @param input.raw - Raw (encoded) values from `findDistinctRawUtmCampaigns`.
 * @returns Sorted, unique, decoded campaigns.
 */
export function decodeDistinctCampaigns(input: { readonly raw: readonly string[] }): string[] {
    const decoded = new Set<string>();
    for (const raw of input.raw) {
        const value = readUtmParams({ url: `?utm_campaign=${raw}` }).utm_campaign?.trim();
        if (value) decoded.add(value);
    }
    return [...decoded].sort((a, b) => a.localeCompare(b, 'es'));
}

/**
 * The SQL conditions for the two admin filters that are not columns.
 *
 * @param input.utmCampaign - Decoded campaign to match exactly, if any.
 * @param input.tagIds - Tags to match (any of), if any. An empty list is no filter.
 * @returns Conditions to AND into the admin list query.
 */
export function buildQrCodeOrganizeConditions(input: {
    readonly utmCampaign?: string;
    readonly tagIds?: readonly string[];
}): SQL[] {
    const conditions: SQL[] = [];
    if (input.utmCampaign) {
        conditions.push(
            buildQrCodeUtmCampaignCondition({
                encodedValues: encodedCampaignSpellings({ value: input.utmCampaign })
            })
        );
    }
    if (input.tagIds && input.tagIds.length > 0) {
        conditions.push(buildQrCodeTagFilterCondition({ tagIds: [...new Set(input.tagIds)] }));
    }
    return conditions;
}
