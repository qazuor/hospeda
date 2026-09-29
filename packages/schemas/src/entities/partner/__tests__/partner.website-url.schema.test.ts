import { describe, expect, it } from 'vitest';
import { createPartnerSchema } from '../partner.create.schema.js';
import { PartnerOwnerUpdateSchema } from '../partner.owner.schema.js';
import { partnerSchema } from '../partner.schema.js';
import { updatePartnerSchema } from '../partner.update.schema.js';

const PAYLOADS = [
    'javascript:alert(1)',
    'data:text/html,<script>alert(1)</script>',
    'vbscript:msgbox(1)'
] as const;

const validCreate = {
    slug: 'acme',
    name: 'Acme',
    type: 'COMPANY',
    tier: 'GOLD'
};

describe('partner websiteUrl — write contract (HOS-703)', () => {
    it.each(PAYLOADS)('createPartnerSchema rejects %s', (websiteUrl) => {
        const result = createPartnerSchema.safeParse({ ...validCreate, websiteUrl });
        expect(result.success).toBe(false);
        expect(
            result.success ? [] : result.error.issues.map((issue) => issue.path.join('.'))
        ).toContain('websiteUrl');
    });

    it.each(PAYLOADS)('updatePartnerSchema rejects %s', (websiteUrl) => {
        expect(updatePartnerSchema.safeParse({ websiteUrl }).success).toBe(false);
    });

    it.each(PAYLOADS)('PartnerOwnerUpdateSchema rejects %s', (websiteUrl) => {
        expect(PartnerOwnerUpdateSchema.safeParse({ websiteUrl }).success).toBe(false);
    });

    it('accepts https, null and absence on every write schema', () => {
        expect(
            updatePartnerSchema.safeParse({ websiteUrl: 'https://acme.example.com' }).success
        ).toBe(true);
        expect(updatePartnerSchema.safeParse({ websiteUrl: null }).success).toBe(true);
        expect(
            PartnerOwnerUpdateSchema.safeParse({ websiteUrl: 'http://acme.example.com' }).success
        ).toBe(true);
        expect(PartnerOwnerUpdateSchema.safeParse({}).success).toBe(true);
    });

    it('an unrelated edit is not revalidated against a stored bad websiteUrl', () => {
        // The update payload only carries what the caller sends.
        expect(updatePartnerSchema.safeParse({ name: 'Renamed' }).success).toBe(true);
        expect(PartnerOwnerUpdateSchema.safeParse({ contactInfo: {} }).success).toBe(true);
    });
});

describe('partner websiteUrl — read contract stays tolerant (HOS-703)', () => {
    it('partnerSchema still parses an already-stored non-http(s) value, so reads never 500', () => {
        const shape = partnerSchema.shape.websiteUrl;
        expect(shape.safeParse('javascript:alert(1)').success).toBe(true);
        expect(partnerSchema.shape.pendingWebsiteUrl.safeParse('javascript:alert(1)').success).toBe(
            true
        );
    });
});
