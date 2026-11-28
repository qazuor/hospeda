/**
 * HOS-2679 PR 2 — QR campaigns ↔ Umami: the list never fails because of Umami,
 * and the create is idempotent on the EXACT segment name.
 */

import { ServiceErrorCode } from '@repo/schemas';
import { ServiceError } from '@repo/service-core';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../src/utils/env', () => ({ env: {} }));

const warn = vi.hoisted(() => vi.fn());
vi.mock('../../src/utils/logger', () => ({
    apiLogger: { warn, info: vi.fn(), error: vi.fn(), debug: vi.fn() }
}));

import {
    ensureQrCampaignSegment,
    QR_CAMPAIGN_UMAMI_REASONS,
    type QrCampaignUmamiConfig,
    resolveQrCampaignsUmami
} from '../../src/services/qr-campaign-umami';

const WEBSITE = '0f3c2a5e-1111-4222-8333-444455556666';
const READ_KEY = 'umami_read';
const WRITE_KEY = 'umami_write';
const FULL: QrCampaignUmamiConfig = {
    baseUrl: 'https://umami.test',
    websiteId: WEBSITE,
    readApiKey: READ_KEY,
    writeApiKey: WRITE_KEY
};

function jsonResponse(body: unknown, status = 200): Response {
    return new Response(JSON.stringify(body), {
        status,
        headers: { 'content-type': 'application/json' }
    });
}

function page(names: ReadonlyArray<readonly [string, string]>): Response {
    return jsonResponse({
        data: names.map(([id, name]) => ({ id, type: 'segment', name, parameters: {} })),
        count: names.length
    });
}

function authOf(call: unknown): string {
    const [, init] = call as [string, RequestInit];
    return (init.headers as Record<string, string>).Authorization ?? '';
}

beforeEach(() => {
    warn.mockReset();
});

describe('resolveQrCampaignsUmami', () => {
    it('marks each campaign segment/missing from ONE list call with the view key', async () => {
        // Arrange
        const fetchMock = vi.fn(async () =>
            page([
                ['s1', 'QR · verano'],
                ['s2', 'QR · verano 2026 extra']
            ])
        );

        // Act
        const result = await resolveQrCampaignsUmami({
            campaigns: [
                { campaign: 'verano', qrCount: 2 },
                { campaign: 'verano 2026', qrCount: 1 }
            ],
            config: FULL,
            fetchImpl: fetchMock as unknown as typeof fetch
        });

        // Assert
        expect(fetchMock).toHaveBeenCalledTimes(1);
        expect(authOf(fetchMock.mock.calls[0])).toBe(`Bearer ${READ_KEY}`);
        expect(result.canCreateSegments).toBe(true);
        expect(result.items[0]).toStrictEqual({
            campaign: 'verano',
            qrCount: 2,
            umami: {
                status: 'segment',
                segmentId: 's1',
                viewUrl: `https://umami.test/websites/${WEBSITE}?utmCampaign=eq.verano`,
                segmentUrl: `https://umami.test/websites/${WEBSITE}?segment=s1`
            }
        });
        // A substring-only match is not the campaign's segment.
        expect(result.items[1]?.umami.status).toBe('missing');
    });

    it('lists with the write key when no view key is configured', async () => {
        const fetchMock = vi.fn(async () => page([]));

        await resolveQrCampaignsUmami({
            campaigns: [{ campaign: 'a', qrCount: 1 }],
            config: { ...FULL, readApiKey: undefined },
            fetchImpl: fetchMock as unknown as typeof fetch
        });

        expect(authOf(fetchMock.mock.calls[0])).toBe(`Bearer ${WRITE_KEY}`);
    });

    it('answers unavailable (and logs) when Umami errors, keeping the view link', async () => {
        // Arrange
        const fetchMock = vi.fn(async () => jsonResponse({}, 500));

        // Act
        const result = await resolveQrCampaignsUmami({
            campaigns: [{ campaign: 'a', qrCount: 1 }],
            config: FULL,
            fetchImpl: fetchMock as unknown as typeof fetch
        });

        // Assert
        expect(result.items[0]?.umami).toStrictEqual({
            status: 'unavailable',
            viewUrl: `https://umami.test/websites/${WEBSITE}?utmCampaign=eq.a`
        });
        expect(warn).toHaveBeenCalledTimes(1);
        expect(JSON.stringify(warn.mock.calls)).not.toContain(READ_KEY);
    });

    it('answers unavailable with no view link and no call when Umami is not configured', async () => {
        const fetchMock = vi.fn();

        const result = await resolveQrCampaignsUmami({
            campaigns: [{ campaign: 'a', qrCount: 1 }],
            config: {},
            fetchImpl: fetchMock as unknown as typeof fetch
        });

        expect(fetchMock).not.toHaveBeenCalled();
        expect(result).toStrictEqual({
            items: [{ campaign: 'a', qrCount: 1, umami: { status: 'unavailable', viewUrl: null } }],
            canCreateSegments: false
        });
    });

    it('reports canCreateSegments false without the write key', async () => {
        const result = await resolveQrCampaignsUmami({
            campaigns: [],
            config: { ...FULL, writeApiKey: undefined }
        });

        expect(result.canCreateSegments).toBe(false);
    });
});

describe('ensureQrCampaignSegment', () => {
    const verano = { campaign: 'verano', qrCount: 3 };

    it('creates the segment when only a substring match exists', async () => {
        // Arrange
        const fetchMock = vi
            .fn()
            .mockResolvedValueOnce(page([['other', 'QR · verano 2026']]))
            .mockResolvedValueOnce(
                jsonResponse({ id: 'new', type: 'segment', name: 'QR · verano', parameters: {} })
            );

        // Act
        const result = await ensureQrCampaignSegment({
            campaign: verano,
            config: FULL,
            fetchImpl: fetchMock as unknown as typeof fetch
        });

        // Assert
        expect(result.created).toBe(true);
        expect(result.item.umami.status).toBe('segment');
        expect(result.item.umami.segmentId).toBe('new');
        const [, init] = fetchMock.mock.calls[1] as [string, RequestInit];
        expect(JSON.parse(init.body as string)).toStrictEqual({
            type: 'segment',
            name: 'QR · verano',
            parameters: { filters: [{ name: 'utmCampaign', operator: 'eq', value: 'verano' }] }
        });
        expect(authOf(fetchMock.mock.calls[1])).toBe(`Bearer ${WRITE_KEY}`);
    });

    it('returns the existing segment on an exact name match and creates nothing', async () => {
        // Arrange
        const fetchMock = vi.fn(async () => page([['s1', 'QR · verano']]));

        // Act
        const result = await ensureQrCampaignSegment({
            campaign: verano,
            config: FULL,
            fetchImpl: fetchMock as unknown as typeof fetch
        });

        // Assert
        expect(result.created).toBe(false);
        expect(result.item.umami.segmentId).toBe('s1');
        expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('refuses with 503 UMAMI_WRITE_NOT_CONFIGURED without the write key, calling nothing', async () => {
        const fetchMock = vi.fn();

        const error = await ensureQrCampaignSegment({
            campaign: verano,
            config: { ...FULL, writeApiKey: undefined },
            fetchImpl: fetchMock as unknown as typeof fetch
        }).catch((e: unknown) => e);

        expect(error).toBeInstanceOf(ServiceError);
        expect((error as ServiceError).code).toBe(ServiceErrorCode.SERVICE_UNAVAILABLE);
        expect((error as ServiceError).reason).toBe(QR_CAMPAIGN_UMAMI_REASONS.notConfigured);
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it('maps a 401 to UMAMI_KEY_REJECTED', async () => {
        const fetchMock = vi
            .fn()
            .mockResolvedValueOnce(page([]))
            .mockResolvedValueOnce(jsonResponse({ error: 'Unauthorized' }, 401));

        const error = await ensureQrCampaignSegment({
            campaign: verano,
            config: FULL,
            fetchImpl: fetchMock as unknown as typeof fetch
        }).catch((e: unknown) => e);

        expect((error as ServiceError).code).toBe(ServiceErrorCode.SERVICE_UNAVAILABLE);
        expect((error as ServiceError).reason).toBe(QR_CAMPAIGN_UMAMI_REASONS.keyRejected);
    });

    it('maps any other Umami failure to UMAMI_UNAVAILABLE', async () => {
        const fetchMock = vi.fn(async () => jsonResponse({}, 502));

        const error = await ensureQrCampaignSegment({
            campaign: verano,
            config: FULL,
            fetchImpl: fetchMock as unknown as typeof fetch
        }).catch((e: unknown) => e);

        expect((error as ServiceError).reason).toBe(QR_CAMPAIGN_UMAMI_REASONS.unavailable);
        expect(JSON.stringify(warn.mock.calls)).not.toContain(WRITE_KEY);
    });
});
