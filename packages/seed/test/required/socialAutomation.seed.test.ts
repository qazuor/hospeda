/**
 * Unit tests for the social automation settings seed data (HOS-64 G-2 / T-003)
 * and the platform / platform-format catalog data (HOS-65 T-009/T-010).
 *
 * Pure data assertions against the exported `SETTINGS`, `PLATFORMS`, and
 * `PLATFORM_FORMATS` arrays — no DB/model mocking needed, since each
 * `seedSocial*` function just idempotently inserts each row and the
 * idempotency itself is already covered by the model-level `findOne`/`create`
 * calls exercised elsewhere.
 *
 * @module test/required/socialAutomation.seed
 */

import { describe, expect, it } from 'vitest';
import { PLATFORM_FORMATS, PLATFORMS, SETTINGS } from '../../src/required/socialAutomation.seed.js';

describe('social automation settings seed (HOS-64 T-003)', () => {
    it('should include all 5 new operational settings with correct types and defaults', () => {
        const expected: Record<string, { value: string; type: string }> = {
            max_retry_count: { value: '3', type: 'number' },
            make_webhook_timeout_ms: { value: '40000', type: 'number' },
            download_timeout_ms: { value: '15000', type: 'number' },
            social_assets_folder: { value: 'hospeda/social/assets', type: 'string' },
            dispatch_cron_cadence: { value: '*/5 * * * *', type: 'string' }
        };

        for (const [key, { value, type }] of Object.entries(expected)) {
            const row = SETTINGS.find((setting) => setting.key === key);
            expect(row, `expected a SETTINGS row for key "${key}"`).toBeDefined();
            expect(row?.value).toBe(value);
            expect(row?.type).toBe(type);
            expect(row?.active).toBe(true);
            expect(row?.description).toBeTruthy();
        }
    });

    it('should keep every setting key unique', () => {
        const keys = SETTINGS.map((setting) => setting.key);
        expect(new Set(keys).size).toBe(keys.length);
    });

    it('should have exactly 11 settings total', () => {
        expect(SETTINGS).toHaveLength(11);
    });
});

describe('social platform catalog seed (HOS-65 T-009)', () => {
    it('should have exactly 5 platforms total', () => {
        expect(PLATFORMS).toHaveLength(5);
    });

    it('should include LINKEDIN and TIKTOK alongside the 3 original platforms', () => {
        const platforms = PLATFORMS.map((row) => row.platform);
        expect(platforms).toEqual(['INSTAGRAM', 'FACEBOOK', 'X', 'LINKEDIN', 'TIKTOK']);
    });

    it('should enable every platform by default', () => {
        expect(PLATFORMS.every((row) => row.enabled)).toBe(true);
    });

    it('should keep every platform value unique', () => {
        const platforms = PLATFORMS.map((row) => row.platform);
        expect(new Set(platforms).size).toBe(platforms.length);
    });
});

describe('social platform-format catalog seed (HOS-65 T-010)', () => {
    it('should have exactly 15 platform-format rows total', () => {
        expect(PLATFORM_FORMATS).toHaveLength(15);
    });

    it('should keep the idempotency guard key (platform, publishFormat) unique across all rows', () => {
        const keys = PLATFORM_FORMATS.map((row) => `${row.platform}/${row.publishFormat}`);
        expect(new Set(keys).size).toBe(keys.length);
    });

    it('should include LinkedIn TEXT_POST with mediaType NONE', () => {
        const row = PLATFORM_FORMATS.find(
            (r) => r.platform === 'LINKEDIN' && r.publishFormat === 'TEXT_POST'
        );
        expect(row).toBeDefined();
        expect(row?.mediaType).toBe('NONE');
        expect(row?.enabled).toBe(true);
    });

    it('should include LinkedIn VIDEO_POST with mediaType VIDEO', () => {
        const row = PLATFORM_FORMATS.find(
            (r) => r.platform === 'LINKEDIN' && r.publishFormat === 'VIDEO_POST'
        );
        expect(row).toBeDefined();
        expect(row?.mediaType).toBe('VIDEO');
        expect(row?.enabled).toBe(true);
    });

    it('should include TikTok VIDEO_POST with mediaType VIDEO', () => {
        const row = PLATFORM_FORMATS.find(
            (r) => r.platform === 'TIKTOK' && r.publishFormat === 'VIDEO_POST'
        );
        expect(row).toBeDefined();
        expect(row?.mediaType).toBe('VIDEO');
        expect(row?.enabled).toBe(true);
    });

    it('should NOT include a STORY row for LinkedIn or TikTok', () => {
        const hasStory = PLATFORM_FORMATS.some(
            (r) =>
                (r.platform === 'LINKEDIN' || r.platform === 'TIKTOK') &&
                r.publishFormat === 'STORY'
        );
        expect(hasStory).toBe(false);
    });

    it('should have exactly 2 LinkedIn rows and 1 TikTok row', () => {
        expect(PLATFORM_FORMATS.filter((r) => r.platform === 'LINKEDIN')).toHaveLength(2);
        expect(PLATFORM_FORMATS.filter((r) => r.platform === 'TIKTOK')).toHaveLength(1);
    });
});
