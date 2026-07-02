/**
 * Unit tests for the social automation settings seed data (HOS-64 G-2 / T-003).
 *
 * Pure data assertions against the exported `SETTINGS` array — no DB/model
 * mocking needed, since `seedSocialSettings()` just idempotently inserts each
 * row and the idempotency itself is already covered by the model-level
 * `findOne`/`create` calls exercised elsewhere.
 *
 * @module test/required/socialAutomation.seed
 */

import { describe, expect, it } from 'vitest';
import { SETTINGS } from '../../src/required/socialAutomation.seed.js';

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

    it('should have exactly 12 settings total', () => {
        expect(SETTINGS).toHaveLength(12);
    });
});
