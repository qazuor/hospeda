import { type SQL, sql } from 'drizzle-orm';
import { qrCodes } from '../../schemas/qr-code/qr_code.dbschema.ts';
import { qrCodeTags } from '../../schemas/qr-code/qr_code_tag.dbschema.ts';
import { rQrCodeQrCodeTag } from '../../schemas/qr-code/r_qr_code_qr_code_tag.dbschema.ts';

/**
 * SQL conditions for the two admin QR list filters that are not columns
 * (HOS-2679). Kept in `@repo/db` so the service never spells table SQL itself.
 *
 * @module models/qr-code/qrCode.filters
 */

/**
 * The raw (still percent-encoded) value of the FIRST `utm_campaign` param in the
 * QUERY STRING of `qr_codes.target_url`, or `NULL`.
 *
 * Parity with `readUtmParams` (`@repo/analytics`), which is what the panel shows:
 * - only the query string is searched: the text after the FIRST `?` and before
 *   the first `#`, so neither a path segment nor the fragment can match;
 * - the key matches case-insensitively and with its `_` spelled `%5F`/`%5f`;
 * - the LEFTMOST `key=value` segment wins, which is the first occurrence.
 *
 * Known gaps, deliberately not chased in SQL (each is a URL nobody writes):
 * a key with OTHER escaped letters (`%75tm_campaign`), and a bare
 * `utm_campaign` segment with no `=`, which `readUtmParams` reads as `''` and
 * this expression skips.
 *
 * The value is NOT decoded here — SQL has no `decodeURIComponent`, and an inline
 * decoder would fail the whole query on one malformed escape. Decoding happens
 * in JS over the distinct raw values ({@link QrCodeModel.findDistinctRawUtmCampaigns}),
 * and the filter matches the RAW spellings whose decoding equals the value
 * picked ({@link buildQrCodeUtmCampaignCondition}). Dropdown and filter
 * therefore decode with the same function and cannot disagree.
 */
export const QR_CODE_RAW_UTM_CAMPAIGN_SQL: SQL<string | null> = sql<
    string | null
>`(regexp_match(substring(split_part(${qrCodes.targetUrl}, '#', 1) from '\\?(.*)$'), '(?:^|&)utm(?:_|%5f)campaign=([^&]*)', 'i'))[1]`;

/**
 * Codes whose stored raw `utm_campaign` is exactly one of `rawValues`.
 *
 * Exact on purpose — `verano` must not match `verano-2025`. The caller passes
 * the raw spellings (as stored) that decode to the value being filtered; an
 * empty list matches nothing, so a campaign no code carries answers an empty
 * page instead of the whole table.
 *
 * @param input.rawValues - Raw spellings to accept; may be empty.
 * @returns The SQL condition.
 */
export function buildQrCodeUtmCampaignCondition(input: {
    readonly rawValues: readonly string[];
}): SQL {
    if (input.rawValues.length === 0) return sql`false`;
    const values = input.rawValues.map((value) => sql`${value}`);
    return sql`${QR_CODE_RAW_UTM_CAMPAIGN_SQL} in (${sql.join(values, sql`, `)})`;
}

/**
 * Codes carrying ANY of `tagIds`, counting live tags only — a soft-deleted tag
 * keeps its join rows but must stop matching.
 *
 * @param input.tagIds - Non-empty list of tag ids.
 * @returns The SQL condition.
 */
export function buildQrCodeTagFilterCondition(input: { readonly tagIds: readonly string[] }): SQL {
    const ids = input.tagIds.map((id) => sql`${id}`);
    return sql`exists (select 1 from ${rQrCodeQrCodeTag} inner join ${qrCodeTags} on ${qrCodeTags.id} = ${rQrCodeQrCodeTag.qrCodeTagId} where ${rQrCodeQrCodeTag.qrCodeId} = ${qrCodes.id} and ${qrCodeTags.deletedAt} is null and ${rQrCodeQrCodeTag.qrCodeTagId} in (${sql.join(ids, sql`, `)}))`;
}
