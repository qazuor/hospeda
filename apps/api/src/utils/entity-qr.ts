import type { EntityTypeEnum, QrCodePurposeEnum } from '@repo/schemas';
import { ServiceErrorCode } from '@repo/schemas';
import { QrCodeService } from '@repo/service-core';
// Same module instance `utils/response-helpers` compares against: importing
// `ServiceError` from the package ROOT yields a DIFFERENT class under the test
// resolver, and `instanceof` then fails — a NOT_FOUND answered as a 500.
import { type Actor, ServiceError } from '@repo/service-core/types';
import { apiLogger } from './logger.js';

/**
 * Turning "this entity, for this purpose" into the URL a printed code encodes
 * (HOS-981, HOS-1129).
 *
 * ## What this module exists to stop
 *
 * A printed QR cannot be corrected. So the platform never encodes a
 * destination — it encodes an identifier it owns, `{site}/qr/{qrSlug}/`, and
 * resolves that with a 302 to a row an operator can edit. The two consequences
 * are the point: a destination that moves stops costing every code already in
 * the field, and a scan becomes countable because it passes through us.
 *
 * That rule was already true for the provider sticker (HOS-981 PR 4) and false
 * for the brochure and the certificate, which were minting their own codes over
 * the final URL — the exact defect this system was built to remove, in
 * production, twice. HOS-1129 routes them through here.
 *
 * ## Why the resolution is here and not in the renderers
 *
 * Minting a code is asynchronous and touches the database; drawing a page is a
 * pure function of its inputs. Keeping the two apart means a renderer can still
 * be tested without a DB, and it means the `qr_codes` row is provisioned once
 * per document rather than once per drawing helper.
 *
 * @module utils/entity-qr
 */

/** Top-level path of the platform's own redirect endpoint. */
const QR_SCAN_PATH_PREFIX = '/qr';

/** `qr_codes.label` is `varchar(200)`; a longer label is a failed insert. */
const QR_CODE_LABEL_MAX_LENGTH = 200;

const qrCodeService = new QrCodeService({ logger: apiLogger });

/**
 * Builds the URL a QR symbol actually encodes.
 *
 * The trailing slash is deliberate: `apps/web` runs with
 * `trailingSlash: 'always'`, so the slash-less form costs every single scan an
 * extra redirect hop before the one the code exists to perform. On a printed
 * code that hop is not recoverable later.
 *
 * The path is language-neutral on purpose — `/qr/…`, never `/{lang}/qr/…`. A
 * locale baked into ink would choose, permanently, what language every future
 * scanner reads the site in. See `apps/web/src/pages/qr/[slug].astro`.
 *
 * This is the ONE spelling of that path in `apps/api`: the provider sticker's
 * own builder delegates here rather than repeating it. Two spellings would not
 * fail — they would quietly start redirecting one family of printed codes to a
 * 404.
 *
 * @param input - Input parameters.
 * @param input.qrSlug - The QR CODE's slug (`qr_codes.slug`), not the entity's.
 * @param input.siteUrl - Public base URL of the web app (`HOSPEDA_SITE_URL`).
 *   A trailing slash is tolerated.
 * @returns The absolute URL encoded in the symbol.
 */
export function buildQrScanUrl(input: {
    readonly qrSlug: string;
    readonly siteUrl: string;
}): string {
    const base = input.siteUrl.replace(/\/$/, '');
    // The QR alphabet has no URL metacharacters, so this encodes nothing today.
    // It is here so a value from outside that alphabet 404s rather than
    // truncating the path into a different page.
    const qrSlug = encodeURIComponent(input.qrSlug);
    return `${base}${QR_SCAN_PATH_PREFIX}/${qrSlug}/`;
}

/**
 * Builds the operator-facing name of a generated code.
 *
 * `qr_codes.label` is what an admin searches on a year from now, when the only
 * thing they have is a photograph of a printed sheet. It therefore carries BOTH
 * the entity's display name (what a human calls it) and its slug (what the
 * target URL contains), because either one alone fails a real lookup: two
 * listings may share a trading name, and nobody remembers a slug.
 *
 * The result is truncated to the column's width rather than left to fail at
 * insert time — a listing with a very long name must still get a QR.
 *
 * @param input - Input parameters.
 * @param input.description - What the code is for, e.g. `Brochure QR`.
 * @param input.name - The entity's display name.
 * @param input.slug - The entity's slug.
 * @returns A label of at most 200 characters.
 */
export function buildEntityQrLabel(input: {
    readonly description: string;
    readonly name: string;
    readonly slug: string;
}): string {
    const label = `${input.description} — ${input.name} (${input.slug})`;
    return label.length > QR_CODE_LABEL_MAX_LENGTH
        ? label.slice(0, QR_CODE_LABEL_MAX_LENGTH)
        : label;
}

/**
 * Provisions (or reuses) an entity's code for one purpose and returns the URL
 * to encode.
 *
 * The code is minted on the first document that needs it and reused for every
 * later one, which is what makes a reprint byte-identical to the sheet already
 * on somebody's wall. `targetUrl` and `label` are creation-only values: an
 * existing code keeps whatever target an operator has since pointed it at, and
 * silently reverting that on a read would undo an edit nobody asked to undo.
 *
 * @param input - Input parameters.
 * @param input.actor - Actor performing the action.
 * @param input.entityType - The entity's type.
 * @param input.entityId - The entity's id.
 * @param input.purpose - WHICH of the entity's codes this is. Part of the
 *   lookup key: an experience's brochure code and its certificate code are two
 *   live rows for one subject, not duplicates.
 * @param input.targetUrl - Where a scan should land, on creation.
 * @param input.label - Operator-facing name, on creation.
 * @param input.siteUrl - Public base URL of the web app.
 * @returns The absolute `{site}/qr/{qrSlug}/` URL to encode.
 * @throws {ServiceError} When the code could not be provisioned.
 */
export async function resolveEntityQrScanUrl(input: {
    readonly actor: Actor;
    readonly entityType: EntityTypeEnum;
    readonly entityId: string;
    readonly purpose: QrCodePurposeEnum;
    readonly targetUrl: string;
    readonly label: string;
    readonly siteUrl: string;
}): Promise<string> {
    const code = await qrCodeService.getOrCreateForEntity({
        actor: input.actor,
        entityType: input.entityType,
        entityId: input.entityId,
        purpose: input.purpose,
        targetUrl: input.targetUrl,
        label: input.label
    });

    if (code.error) {
        throw new ServiceError(code.error.code, code.error.message);
    }
    // A success carrying no slug would print a code for `undefined` — a sheet
    // whose QR is permanently dead, with nothing on the page to say so. Fail
    // the download instead.
    if (!code.data?.slug) {
        throw new ServiceError(
            ServiceErrorCode.INTERNAL_ERROR,
            'QR code could not be provisioned for this entity'
        );
    }

    return buildQrScanUrl({ qrSlug: code.data.slug, siteUrl: input.siteUrl });
}
