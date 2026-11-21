import { describe, expect, it } from 'vitest';
import {
    EmailCatalogDomainSchema,
    EmailPreviewEntrySummarySchema,
    EmailPreviewListResponseSchema,
    EmailPreviewRenderQuerySchema,
    EmailPreviewRenderResponseSchema,
    EmailSendPathSchema
} from '../../../src/index.js';

const entry = {
    key: 'outbox.billing.renewal-upcoming',
    id: 'billing.renewal-upcoming',
    sendPath: 'outbox',
    name: 'Aviso de renovación',
    domain: 'billing',
    wired: true,
    scenarios: [{ id: 'monthly', label: 'Mensual' }]
} as const;

describe('HOS-2519 email preview schemas', () => {
    it('lists the six send paths and the fourteen domains of §7.1', () => {
        expect(EmailSendPathSchema.options).toEqual([
            'notification',
            'outbox',
            'auth',
            'conversation',
            'alert-digest',
            'newsletter'
        ]);
        expect(EmailCatalogDomainSchema.options).toHaveLength(14);
    });

    it('accepts a valid entry summary and list response', () => {
        // Act
        const parsed = EmailPreviewListResponseSchema.safeParse({ entries: [entry], total: 1 });

        // Assert
        expect(parsed.success).toBe(true);
    });

    it('rejects an entry without scenarios, or with an unknown domain', () => {
        expect(EmailPreviewEntrySummarySchema.safeParse({ ...entry, scenarios: [] }).success).toBe(
            false
        );
        expect(
            EmailPreviewEntrySummarySchema.safeParse({ ...entry, domain: 'other' }).success
        ).toBe(false);
    });

    it('requires both query params within their length limits', () => {
        expect(EmailPreviewRenderQuerySchema.safeParse({ key: 'a', scenarioId: 'b' }).success).toBe(
            true
        );
        expect(EmailPreviewRenderQuerySchema.safeParse({ scenarioId: 'b' }).success).toBe(false);
        expect(EmailPreviewRenderQuerySchema.safeParse({ key: '', scenarioId: 'b' }).success).toBe(
            false
        );
        expect(
            EmailPreviewRenderQuerySchema.safeParse({ key: 'k'.repeat(201), scenarioId: 'b' })
                .success
        ).toBe(false);
        expect(
            EmailPreviewRenderQuerySchema.safeParse({ key: 'k', scenarioId: 's'.repeat(101) })
                .success
        ).toBe(false);
    });

    it('accepts a null subject prefix (production) and a string one (staging)', () => {
        const base = {
            key: entry.key,
            scenarioId: 'monthly',
            subject: 'Tu plan se renueva',
            html: '<html></html>',
            text: 'texto',
            warnings: []
        };
        expect(
            EmailPreviewRenderResponseSchema.safeParse({ ...base, subjectPrefix: null }).success
        ).toBe(true);
        expect(
            EmailPreviewRenderResponseSchema.safeParse({ ...base, subjectPrefix: '[STAGING] ' })
                .success
        ).toBe(true);
    });
});
