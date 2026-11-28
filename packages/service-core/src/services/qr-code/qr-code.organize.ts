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
 * Decodes one raw stored `utm_campaign` value exactly as `readUtmParams` does
 * (`+` as a space, percent-escapes of either case, a malformed escape kept raw,
 * NO trim). The dropdown and the filter both go through here, so they cannot
 * disagree about what a stored URL carries.
 *
 * @param input.raw - A raw value from `findDistinctRawUtmCampaigns` (it never
 *   contains `&` or `#`: the SQL stops at both).
 * @returns The decoded value.
 */
export function decodeRawCampaign(input: { readonly raw: string }): string {
    return readUtmParams({ url: `?utm_campaign=${input.raw}` }).utm_campaign ?? '';
}

/**
 * Turns the raw campaigns the model read into the dropdown's values: decoded by
 * {@link decodeRawCampaign}, values that are blank once trimmed dropped (nothing
 * an operator can pick), spellings of one campaign folded into one, sorted for
 * display. Values are shown UNtrimmed, so what the dropdown offers is exactly
 * what the filter matches.
 *
 * @param input.raw - Raw (encoded) values from `findDistinctRawUtmCampaigns`.
 * @returns Sorted, unique, decoded campaigns.
 */
export function decodeDistinctCampaigns(input: { readonly raw: readonly string[] }): string[] {
    const decoded = new Set<string>();
    for (const raw of input.raw) {
        const value = decodeRawCampaign({ raw });
        if (value.trim() !== '') decoded.add(value);
    }
    return [...decoded].sort((a, b) => a.localeCompare(b, 'es'));
}

/**
 * Folds per-raw-spelling counts into per-campaign counts (HOS-2679 PR 2), with
 * the same decoding, blank-dropping and ordering as {@link decodeDistinctCampaigns},
 * so the campaigns panel lists exactly what the filter dropdown offers.
 *
 * @param input.counts - Rows from `countLiveByRawUtmCampaign`.
 * @returns One entry per decoded campaign, sorted for display.
 */
export function foldCampaignCounts(input: {
    readonly counts: ReadonlyArray<{ readonly raw: string; readonly count: number }>;
}): Array<{ campaign: string; qrCount: number }> {
    const totals = new Map<string, number>();
    for (const row of input.counts) {
        const value = decodeRawCampaign({ raw: row.raw });
        if (value.trim() === '') continue;
        totals.set(value, (totals.get(value) ?? 0) + row.count);
    }
    return [...totals.entries()]
        .sort(([a], [b]) => a.localeCompare(b, 'es'))
        .map(([campaign, qrCount]) => ({ campaign, qrCount }));
}

/**
 * The raw spellings among `raw` that decode to exactly `value`.
 *
 * @param input.value - The decoded campaign picked in the dropdown.
 * @param input.raw - Every distinct raw value currently stored.
 * @returns The raw spellings to match in SQL; empty when none decodes to it.
 */
export function rawSpellingsForCampaign(input: {
    readonly value: string;
    readonly raw: readonly string[];
}): string[] {
    return input.raw.filter((raw) => decodeRawCampaign({ raw }) === input.value);
}

/**
 * The SQL conditions for the two admin filters that are not columns.
 *
 * @param input.utmCampaignRaws - Raw spellings to match exactly (from
 *   {@link rawSpellingsForCampaign}); `undefined` is no filter, `[]` matches nothing.
 * @param input.tagIds - Tags to match (any of), if any. An empty list is no filter.
 * @returns Conditions to AND into the admin list query.
 */
export function buildQrCodeOrganizeConditions(input: {
    readonly utmCampaignRaws?: readonly string[];
    readonly tagIds?: readonly string[];
}): SQL[] {
    const conditions: SQL[] = [];
    if (input.utmCampaignRaws !== undefined) {
        conditions.push(buildQrCodeUtmCampaignCondition({ rawValues: input.utmCampaignRaws }));
    }
    if (input.tagIds && input.tagIds.length > 0) {
        conditions.push(buildQrCodeTagFilterCondition({ tagIds: [...new Set(input.tagIds)] }));
    }
    return conditions;
}
