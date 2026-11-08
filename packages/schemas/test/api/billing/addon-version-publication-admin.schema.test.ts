import { describe, expect, it } from 'vitest';
import {
    AddonVersionPublicationPreviewRequestSchema,
    PublishAddonVersionRequestSchema
} from '../../../src/api/billing/addon-version-publication-admin.schema.js';

const id = '11111111-1111-4111-8111-111111111111';
const preview = { addonVersionId: id, price: 1500 };

describe('TEST:B10:9 AC:B10:8 action 20 request schemas', () => {
    it('accepts preview and compare-and-swap confirmation', () => {
        expect(AddonVersionPublicationPreviewRequestSchema.safeParse(preview).success).toBe(true);
        expect(
            PublishAddonVersionRequestSchema.safeParse({
                ...preview,
                expectedCurrentVersionId: id,
                expectedCurrentPrice: 1500
            }).success
        ).toBe(true);
    });

    it('rejects version edits, bad price, and missing expected state', () => {
        expect(
            AddonVersionPublicationPreviewRequestSchema.safeParse({
                ...preview,
                validityDays: 40
            }).success
        ).toBe(false);
        expect(PublishAddonVersionRequestSchema.safeParse(preview).success).toBe(false);
        expect(
            PublishAddonVersionRequestSchema.safeParse({
                ...preview,
                expectedCurrentVersionId: id,
                expectedCurrentPrice: 0
            }).success
        ).toBe(false);
    });
});
