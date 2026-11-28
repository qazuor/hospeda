/**
 * QR campaigns in Umami (HOS-2679 PR 2).
 *
 * Each distinct `utm_campaign` on the QR targets is a campaign. This module adds
 * the Umami side to the campaign list the QR service already computes:
 *
 * - a deep link to the web website filtered by the campaign (always, when the
 *   Umami URL and web website id are configured);
 * - whether a segment named `QR · <campaign>` exists, read with ONE paginated
 *   list call per request (`search: 'QR · '`), never one call per campaign;
 * - creating that segment on demand, idempotently.
 *
 * ## Credentials
 *
 * Creating a segment needs a key of a user with edit access to the web website:
 * `HOSPEDA_UMAMI_WRITE_API_KEY` (owner decision recorded on HOS-2679). It is the
 * api's only Umami API write credential and this is the only file that reads it
 * (`no-umami-write-credential.guard.test.ts`). Listing prefers the view-only
 * `HOSPEDA_UMAMI_API_KEY` (least privilege) and falls back to the write key.
 *
 * ## Failure policy
 *
 * The list never fails because of Umami: a missing env var or any Umami error
 * makes every row `unavailable` (logged), and the admin page still renders.
 * The create answers typed 503s with a `reason` the admin reads:
 * `UMAMI_WRITE_NOT_CONFIGURED`, `UMAMI_KEY_REJECTED` (401/403) and
 * `UMAMI_UNAVAILABLE` (anything else). Never `INTERNAL_ERROR`.
 *
 * @module services/qr-campaign-umami
 */

import {
    QR_CAMPAIGN_SEGMENT_NAME_PREFIX,
    type QrCampaignsUmamiResponse,
    type QrCampaignUmamiItem,
    type QrCampaignUmamiSegmentResponse,
    qrCampaignSegmentName,
    ServiceErrorCode
} from '@repo/schemas';
import { ServiceError } from '@repo/service-core';
import {
    buildUmamiCampaignViewUrl,
    buildUmamiSegmentViewUrl,
    createUmamiSegmentsClient,
    type UmamiSegment,
    UmamiSegmentsError
} from '../lib/umami-segments-client';
import { env } from '../utils/env';
import { apiLogger } from '../utils/logger';

/** The Umami settings this module needs; every field is optional. */
export interface QrCampaignUmamiConfig {
    readonly baseUrl?: string;
    readonly websiteId?: string;
    /** View-only key, used to list. */
    readonly readApiKey?: string;
    /** Edit-access key, used to create (and to list when no view key is set). */
    readonly writeApiKey?: string;
}

/** A campaign with its live code count, as the QR service returns it. */
export interface QrCampaignCount {
    readonly campaign: string;
    readonly qrCount: number;
}

/** Machine-readable reasons of the create's typed errors. */
export const QR_CAMPAIGN_UMAMI_REASONS = {
    notConfigured: 'UMAMI_WRITE_NOT_CONFIGURED',
    keyRejected: 'UMAMI_KEY_REJECTED',
    unavailable: 'UMAMI_UNAVAILABLE'
} as const;

/**
 * Reads the config from the validated api env.
 *
 * @returns The current Umami settings.
 */
export function readQrCampaignUmamiConfig(): QrCampaignUmamiConfig {
    return {
        baseUrl: env.HOSPEDA_UMAMI_URL,
        websiteId: env.HOSPEDA_UMAMI_WEBSITE_ID_WEB,
        readApiKey: env.HOSPEDA_UMAMI_API_KEY,
        writeApiKey: env.HOSPEDA_UMAMI_WRITE_API_KEY
    };
}

/** Whether the create path is fully configured. */
function canCreate(config: QrCampaignUmamiConfig): boolean {
    return Boolean(config.baseUrl && config.websiteId && config.writeApiKey);
}

/** The view link of a campaign, or `null` without URL + website. */
function viewUrlOf(config: QrCampaignUmamiConfig, campaign: string): string | null {
    if (!config.baseUrl || !config.websiteId) return null;
    return buildUmamiCampaignViewUrl({
        baseUrl: config.baseUrl,
        websiteId: config.websiteId,
        campaign
    });
}

/** Builds one row from what Umami said (or `undefined` when it said nothing). */
function toItem(input: {
    readonly config: QrCampaignUmamiConfig;
    readonly campaign: QrCampaignCount;
    readonly segments: readonly UmamiSegment[] | undefined;
}): QrCampaignUmamiItem {
    const { config, campaign, segments } = input;
    const viewUrl = viewUrlOf(config, campaign.campaign);
    const base = { campaign: campaign.campaign, qrCount: campaign.qrCount };
    if (segments === undefined) return { ...base, umami: { status: 'unavailable', viewUrl } };
    const name = qrCampaignSegmentName({ campaign: campaign.campaign });
    const match = segments.find((segment) => segment.type === 'segment' && segment.name === name);
    if (!match || !config.baseUrl || !config.websiteId) {
        return { ...base, umami: { status: 'missing', viewUrl } };
    }
    return {
        ...base,
        umami: {
            status: 'segment',
            segmentId: match.id,
            viewUrl,
            segmentUrl: buildUmamiSegmentViewUrl({
                baseUrl: config.baseUrl,
                websiteId: config.websiteId,
                segmentId: match.id
            })
        }
    };
}

/** Logs a Umami failure without the key (the error never carries it). */
function logUmamiFailure(operation: string, error: unknown): void {
    apiLogger.warn({
        message: 'Umami segment call failed (QR campaigns)',
        operation,
        kind: error instanceof UmamiSegmentsError ? error.kind : 'unknown',
        status: error instanceof UmamiSegmentsError ? error.status : undefined
    });
}

/**
 * Adds the Umami state to every campaign. Never throws because of Umami.
 *
 * @param input.campaigns - Campaigns with their counts (from the QR service)
 * @param input.config - Umami settings
 * @param input.fetchImpl - Fetch override (tests)
 * @returns The panel rows plus whether creating is possible
 */
export async function resolveQrCampaignsUmami(input: {
    readonly campaigns: readonly QrCampaignCount[];
    readonly config: QrCampaignUmamiConfig;
    readonly fetchImpl?: typeof fetch;
}): Promise<QrCampaignsUmamiResponse> {
    const { campaigns, config, fetchImpl } = input;
    const listKey = config.readApiKey ?? config.writeApiKey;
    let segments: readonly UmamiSegment[] | undefined;
    if (campaigns.length > 0 && config.baseUrl && config.websiteId && listKey) {
        try {
            segments = await createUmamiSegmentsClient({
                baseUrl: config.baseUrl,
                websiteId: config.websiteId,
                apiKey: listKey,
                ...(fetchImpl ? { fetchImpl } : {})
            }).listSegments({ search: QR_CAMPAIGN_SEGMENT_NAME_PREFIX });
        } catch (error) {
            logUmamiFailure('list', error);
        }
    }
    return {
        items: campaigns.map((campaign) => toItem({ config, campaign, segments })),
        canCreateSegments: canCreate(config)
    };
}

/** Maps a Umami failure of the create path to its typed 503. */
function toCreateError(error: unknown): ServiceError {
    if (error instanceof UmamiSegmentsError && error.kind === 'auth') {
        return new ServiceError(
            ServiceErrorCode.SERVICE_UNAVAILABLE,
            'Umami refused HOSPEDA_UMAMI_WRITE_API_KEY: it must belong to a user with edit access to the web website',
            { reason: QR_CAMPAIGN_UMAMI_REASONS.keyRejected },
            QR_CAMPAIGN_UMAMI_REASONS.keyRejected
        );
    }
    return new ServiceError(
        ServiceErrorCode.SERVICE_UNAVAILABLE,
        'Umami did not answer the segment request',
        { reason: QR_CAMPAIGN_UMAMI_REASONS.unavailable },
        QR_CAMPAIGN_UMAMI_REASONS.unavailable
    );
}

/**
 * Creates the `QR · <campaign>` segment when absent; returns the existing one
 * otherwise. Idempotent: it lists by name, matches the EXACT name (Umami's
 * search is a substring match) and creates only when nothing matches.
 *
 * The caller has already checked the campaign exists among the QR campaigns.
 *
 * @param input.campaign - The campaign with its count
 * @param input.config - Umami settings
 * @param input.fetchImpl - Fetch override (tests)
 * @returns The row and whether this call created the segment
 * @throws {ServiceError} 503 `SERVICE_UNAVAILABLE` with a {@link QR_CAMPAIGN_UMAMI_REASONS} reason
 */
export async function ensureQrCampaignSegment(input: {
    readonly campaign: QrCampaignCount;
    readonly config: QrCampaignUmamiConfig;
    readonly fetchImpl?: typeof fetch;
}): Promise<QrCampaignUmamiSegmentResponse> {
    const { campaign, config, fetchImpl } = input;
    if (!config.baseUrl || !config.websiteId || !config.writeApiKey) {
        throw new ServiceError(
            ServiceErrorCode.SERVICE_UNAVAILABLE,
            'Creating Umami segments needs HOSPEDA_UMAMI_URL, HOSPEDA_UMAMI_WEBSITE_ID_WEB and HOSPEDA_UMAMI_WRITE_API_KEY',
            { reason: QR_CAMPAIGN_UMAMI_REASONS.notConfigured },
            QR_CAMPAIGN_UMAMI_REASONS.notConfigured
        );
    }
    const client = createUmamiSegmentsClient({
        baseUrl: config.baseUrl,
        websiteId: config.websiteId,
        apiKey: config.writeApiKey,
        ...(fetchImpl ? { fetchImpl } : {})
    });
    const name = qrCampaignSegmentName({ campaign: campaign.campaign });
    try {
        const existing = await client.listSegments({ search: name });
        if (existing.some((segment) => segment.type === 'segment' && segment.name === name)) {
            return { item: toItem({ config, campaign, segments: existing }), created: false };
        }
        const created = await client.createSegment({
            name,
            filters: [{ name: 'utmCampaign', operator: 'eq', value: campaign.campaign }]
        });
        apiLogger.info({
            message: 'Created Umami segment for a QR campaign',
            segmentId: created.id
        });
        return { item: toItem({ config, campaign, segments: [created] }), created: true };
    } catch (error) {
        logUmamiFailure('create', error);
        throw toCreateError(error);
    }
}
