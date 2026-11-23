/**
 * @file qr-attribution.ts
 * @description UTMs on the redirect destination of a printed QR code (HOS-2359
 * §6.D.1, owner decision OD-9).
 *
 * A printed code is fixed in ink, so attribution cannot live in the printed URL.
 * It is added to the `targetUrl` the public resolve route answers with instead: the
 * stored target and the scan row's `target_url_at_scan` stay raw, and only the hop
 * the scanner actually takes carries `utm_source=qr&utm_medium=print`.
 */
import { buildOwnWebOrigins, isOwnWebUrl, type QrCampaign, withUtm } from '@repo/analytics';
import { EntityTypeEnum, QrCodePurposeEnum } from '@repo/schemas';

/**
 * `utm_campaign` per entity type. An entity type absent here (and a code with no
 * entity at all, an operator-made `MANUAL` code) maps to `manual` — a reversible
 * default (spec §2.1 item 5).
 */
const CAMPAIGN_BY_ENTITY_TYPE: Readonly<Partial<Record<EntityTypeEnum, QrCampaign>>> = {
    [EntityTypeEnum.ACCOMMODATION]: 'accommodation',
    [EntityTypeEnum.VENUE]: 'venue',
    [EntityTypeEnum.EXPERIENCE]: 'experience',
    [EntityTypeEnum.HOST_TRADE]: 'host-trade'
};

/** `utm_content` per purpose: the purpose in kebab-case. */
const CONTENT_BY_PURPOSE: Readonly<Record<QrCodePurposeEnum, string>> = {
    [QrCodePurposeEnum.HOST_TRADE_USAGE]: 'host-trade-usage',
    [QrCodePurposeEnum.LISTING]: 'listing',
    [QrCodePurposeEnum.MENU]: 'menu',
    [QrCodePurposeEnum.CERTIFICATE]: 'certificate',
    [QrCodePurposeEnum.BROCHURE]: 'brochure'
};

/** Input of {@link buildQrRedirectTarget}. */
export interface BuildQrRedirectTargetInput {
    /** The code's stored target, exactly as the row holds it. */
    readonly targetUrl: string;
    /** The entity the code belongs to, `null`/absent for an operator-made code. */
    readonly entityType?: EntityTypeEnum | null;
    /** The system purpose of the code, `null`/absent when it has none. */
    readonly purpose?: QrCodePurposeEnum | null;
    /** Public web URL (`HOSPEDA_SITE_URL`), used to recognise our own origins. */
    readonly siteUrl: string;
}

/**
 * Returns the URL a scanner is redirected to: the stored target plus
 * `utm_source=qr`, `utm_medium=print`, `utm_campaign=<campaign>` and, when the code
 * has a purpose, `utm_content=<purpose>`.
 *
 * - A target outside our web origins (an Instagram profile, a menu PDF host) is
 *   returned unchanged: UTMs only go on links that come back to the site (OD-4).
 * - A target that already carries any `utm_*` is returned unchanged (`withUtm`).
 * - `CERTIFICATE` purpose maps to `campaign=certificate` regardless of entity type.
 *
 * @param input - See {@link BuildQrRedirectTargetInput}
 * @returns The decorated (or untouched) target URL
 */
export function buildQrRedirectTarget({
    targetUrl,
    entityType,
    purpose,
    siteUrl
}: BuildQrRedirectTargetInput): string {
    const ownOrigins = buildOwnWebOrigins({ siteUrl });
    if (!isOwnWebUrl({ url: targetUrl, ownOrigins })) {
        return targetUrl;
    }

    const campaign: QrCampaign =
        purpose === QrCodePurposeEnum.CERTIFICATE
            ? 'certificate'
            : ((entityType ? CAMPAIGN_BY_ENTITY_TYPE[entityType] : undefined) ?? 'manual');
    const content = purpose ? CONTENT_BY_PURPOSE[purpose] : undefined;

    return withUtm({
        url: targetUrl,
        source: 'qr',
        medium: 'print',
        campaign,
        ...(content ? { content } : {})
    });
}
