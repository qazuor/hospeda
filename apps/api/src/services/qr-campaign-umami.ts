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
 * - creating that segment on demand.
 *
 * ## Idempotency
 *
 * The create lists by name, matches the EXACT name and creates only when nothing
 * matches. Within one API instance a per-segment lock serialises concurrent
 * creates, so two clicks make one segment. Across instances two creates can still
 * race and leave two segments with the same name; that is harmless, because every
 * read takes the FIRST exact match, and an operator can delete the extra one.
 *
 * ## Credentials
 *
 * Creating a segment needs a key of a user with edit access to the web website:
 * `HOSPEDA_UMAMI_WRITE_API_KEY` (owner decision recorded on HOS-2679). It is the
 * api's only Umami API write credential and this is the only file that reads it
 * (`no-umami-write-credential.guard.test.ts`, which also confines the
 * `writeApiKey` identifier to this file). The config reader is NOT exported: the
 * handlers read it themselves, and only tests inject a config. Listing uses the
 * view-only `HOSPEDA_UMAMI_API_KEY` and never falls back to the write key.
 *
 * ## Campaigns Umami cannot filter
 *
 * Umami 3.5 splits an `eq` value on `,` (URL filter and segment alike), so a
 * campaign with a comma gets no link and cannot be segmented; one longer than
 * the create's limit cannot be segmented either (`unsupportedReason`).
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
    type QrCampaignUmamiUnavailableReason,
    qrCampaignSegmentName,
    qrCampaignUmamiUnsupportedReason,
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
    /** Edit-access key, used ONLY by the create. */
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
    unavailable: 'UMAMI_UNAVAILABLE',
    commaInCampaign: 'UMAMI_CAMPAIGN_HAS_COMMA'
} as const;

/**
 * Reads the config from the validated api env. Private on purpose: exporting it
 * would hand the write key to any importer without naming the env var.
 *
 * @returns The current Umami settings.
 */
function readQrCampaignUmamiConfig(): QrCampaignUmamiConfig {
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

/** The view link of a campaign, or `null` without URL + website or with a comma. */
function viewUrlOf(config: QrCampaignUmamiConfig, campaign: string): string | null {
    if (!config.baseUrl || !config.websiteId) return null;
    if (qrCampaignUmamiUnsupportedReason({ campaign }) === 'COMMA_IN_CAMPAIGN') return null;
    return buildUmamiCampaignViewUrl({
        baseUrl: config.baseUrl,
        websiteId: config.websiteId,
        campaign
    });
}

/** What the list read of Umami produced: the segments, or why there are none. */
type SegmentsRead =
    | { readonly ok: true; readonly segments: readonly UmamiSegment[] }
    | { readonly ok: false; readonly reason: QrCampaignUmamiUnavailableReason };

/** The FIRST segment with exactly the campaign's name (a cross-instance race may leave two). */
function findExact(segments: readonly UmamiSegment[], name: string): UmamiSegment | undefined {
    return segments.find((segment) => segment.type === 'segment' && segment.name === name);
}

/** Builds one row from what Umami said. */
function toItem(input: {
    readonly config: QrCampaignUmamiConfig;
    readonly campaign: QrCampaignCount;
    readonly read: SegmentsRead;
}): QrCampaignUmamiItem {
    const { config, campaign, read } = input;
    const viewUrl = viewUrlOf(config, campaign.campaign);
    const unsupportedReason = qrCampaignUmamiUnsupportedReason({ campaign: campaign.campaign });
    const base = { campaign: campaign.campaign, qrCount: campaign.qrCount };
    const extra = unsupportedReason ? { unsupportedReason } : {};
    if (!read.ok) {
        return {
            ...base,
            umami: { status: 'unavailable', unavailableReason: read.reason, ...extra, viewUrl }
        };
    }
    const match = findExact(read.segments, qrCampaignSegmentName({ campaign: campaign.campaign }));
    if (!match || !config.baseUrl || !config.websiteId) {
        return { ...base, umami: { status: 'missing', ...extra, viewUrl } };
    }
    return {
        ...base,
        umami: {
            status: 'segment',
            ...extra,
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

/** Reads every `QR · ` segment with the VIEW-ONLY key. Never throws. */
async function readQrSegments(input: {
    readonly config: QrCampaignUmamiConfig;
    readonly fetchImpl?: typeof fetch;
}): Promise<SegmentsRead> {
    const { config, fetchImpl } = input;
    if (!config.baseUrl || !config.websiteId) return { ok: false, reason: 'NOT_CONFIGURED' };
    if (!config.readApiKey) return { ok: false, reason: 'READ_KEY_MISSING' };
    try {
        const segments = await createUmamiSegmentsClient({
            baseUrl: config.baseUrl,
            websiteId: config.websiteId,
            apiKey: config.readApiKey,
            ...(fetchImpl ? { fetchImpl } : {})
        }).listSegments({ search: QR_CAMPAIGN_SEGMENT_NAME_PREFIX });
        return { ok: true, segments };
    } catch (error) {
        logUmamiFailure('list', error);
        return { ok: false, reason: 'UMAMI_ERROR' };
    }
}

/**
 * Adds the Umami state to every campaign. Never throws because of Umami.
 *
 * @param input.campaigns - Campaigns with their counts (from the QR service)
 * @param input.config - Test-only override; production reads the env itself
 * @param input.fetchImpl - Fetch override (tests)
 * @returns The panel rows plus whether creating is possible
 */
export async function resolveQrCampaignsUmami(input: {
    readonly campaigns: readonly QrCampaignCount[];
    readonly config?: QrCampaignUmamiConfig;
    readonly fetchImpl?: typeof fetch;
}): Promise<QrCampaignsUmamiResponse> {
    const { campaigns, fetchImpl } = input;
    const config = input.config ?? readQrCampaignUmamiConfig();
    const read: SegmentsRead =
        campaigns.length > 0
            ? await readQrSegments({ config, ...(fetchImpl ? { fetchImpl } : {}) })
            : { ok: true, segments: [] };
    return {
        items: campaigns.map((campaign) => toItem({ config, campaign, read })),
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
 * In-flight creates, keyed by website + segment name. Each entry is the tail of
 * a promise chain: a second create for the same segment waits for the first to
 * settle, then lists again and finds what the first created.
 */
const inFlightCreates = new Map<string, Promise<unknown>>();

/**
 * Runs `task` after every earlier task with the same key has settled.
 *
 * @param key - Lock key
 * @param task - The work to serialise
 * @returns What `task` returns
 */
async function withSegmentLock<T>(key: string, task: () => Promise<T>): Promise<T> {
    const previous = inFlightCreates.get(key) ?? Promise.resolve();
    const run = previous.then(task, task);
    inFlightCreates.set(key, run);
    try {
        return await run;
    } finally {
        if (inFlightCreates.get(key) === run) inFlightCreates.delete(key);
    }
}

/**
 * Creates the `QR · <campaign>` segment when absent; returns the existing one
 * otherwise. It lists by name, matches the EXACT name (Umami's search is a
 * substring match) and creates only when nothing matches. Idempotent within one
 * API instance (see the module docblock for the cross-instance case).
 *
 * The caller has already checked the campaign exists among the QR campaigns.
 *
 * @param input.campaign - The campaign with its count
 * @param input.config - Test-only override; production reads the env itself
 * @param input.fetchImpl - Fetch override (tests)
 * @returns The row and whether this call created the segment
 * @throws {ServiceError} 400 `VALIDATION_ERROR` (`UMAMI_CAMPAIGN_HAS_COMMA`) or
 *   503 `SERVICE_UNAVAILABLE` with a {@link QR_CAMPAIGN_UMAMI_REASONS} reason
 */
export async function ensureQrCampaignSegment(input: {
    readonly campaign: QrCampaignCount;
    readonly config?: QrCampaignUmamiConfig;
    readonly fetchImpl?: typeof fetch;
}): Promise<QrCampaignUmamiSegmentResponse> {
    const { campaign, fetchImpl } = input;
    const config = input.config ?? readQrCampaignUmamiConfig();
    if (qrCampaignUmamiUnsupportedReason({ campaign: campaign.campaign }) === 'COMMA_IN_CAMPAIGN') {
        throw new ServiceError(
            ServiceErrorCode.VALIDATION_ERROR,
            'Umami splits filter values on commas, so a segment for this campaign would count other campaigns too',
            { reason: QR_CAMPAIGN_UMAMI_REASONS.commaInCampaign },
            QR_CAMPAIGN_UMAMI_REASONS.commaInCampaign
        );
    }
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
    return withSegmentLock(`${config.websiteId}\u0000${name}`, async () => {
        try {
            const existing = await client.listSegments({ search: name });
            if (findExact(existing, name)) {
                return {
                    item: toItem({ config, campaign, read: { ok: true, segments: existing } }),
                    created: false
                };
            }
            const created = await client.createSegment({
                name,
                filters: [{ name: 'utmCampaign', operator: 'eq', value: campaign.campaign }]
            });
            apiLogger.info({
                message: 'Created Umami segment for a QR campaign',
                segmentId: created.id
            });
            return {
                item: toItem({ config, campaign, read: { ok: true, segments: [created] } }),
                created: true
            };
        } catch (error) {
            logUmamiFailure('create', error);
            throw toCreateError(error);
        }
    });
}
