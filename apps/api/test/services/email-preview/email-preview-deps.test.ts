/**
 * HOS-2519 AC-4.6: the preview deps are the fakes. The partner claim notice's
 * production renderer issues and PERSISTS a claim secret; through the preview
 * deps it must use the fake issuer. Guarded twice: the real
 * `issuePartnerClaimSecret` (and the two real readers) are throwing spies that
 * must record zero calls, and the HTML must carry the fake secret.
 */
import { renderEmailCatalogScenario } from '@repo/notifications';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
    buildEmailPreviewDeps,
    PREVIEW_PARTNER_CLAIM_SECRET,
    previewReadListingNames,
    previewReadReconciliationSubjects
} from '../../../src/services/email-preview/email-preview-deps.js';
import { calledIoSpies, ioGuardsAreArmed } from './preview-io-guards.js';

vi.mock(
    '../../../src/utils/partner-application/partner-claim-secret.js',
    async (importOriginal) => ({
        ...(await importOriginal<Record<string, unknown>>()),
        issuePartnerClaimSecret: vi.fn(async () => {
            throw new Error('A real database-backed collaborator ran during an email preview');
        })
    })
);
vi.mock(
    '../../../src/utils/listing-publication/listing-names-reader.js',
    async (importOriginal) => ({
        ...(await importOriginal<Record<string, unknown>>()),
        readListingNames: vi.fn(async () => {
            throw new Error('A real database-backed collaborator ran during an email preview');
        })
    })
);
vi.mock(
    '../../../src/utils/reconciliation-summary/reconciliation-subjects-reader.js',
    async (importOriginal) => ({
        ...(await importOriginal<Record<string, unknown>>()),
        readReconciliationSubjects: vi.fn(async () => {
            throw new Error('A real database-backed collaborator ran during an email preview');
        })
    })
);

describe('email preview deps', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders the partner claim notice with the fake issuer and no I/O', async () => {
        // Arrange
        const deps = buildEmailPreviewDeps({ siteUrl: 'https://hospeda.com.ar' });

        // Act
        const result = await renderEmailCatalogScenario({
            key: 'outbox.verticals.partner-claim-notice',
            scenarioId: 'application-es',
            deps
        });

        // Assert
        expect(ioGuardsAreArmed()).toBe(true);
        expect(calledIoSpies()).toEqual([]);
        expect(result.html).toContain(encodeURIComponent(PREVIEW_PARTNER_CLAIM_SECRET));
    });

    it('reads listing names without I/O', async () => {
        const names = await previewReadListingNames({
            vertical: 'accommodation',
            ids: ['listing-a', 'listing-b']
        });
        expect([...names.values()]).toEqual(['Ficha de ejemplo 1', 'Ficha de ejemplo 2']);
    });

    it('reads reconciliation subjects for every requested id without I/O', async () => {
        const subjects = await previewReadReconciliationSubjects({
            subscriptionIds: ['sub-a'],
            addonInstanceIds: ['addon-a']
        });
        expect(subjects.subscriptions.get('sub-a')?.planName).toBe('Plan Profesional');
        expect(subjects.addonInstances.get('addon-a')?.addonName).toBe('Destacado (ejemplo)');
        expect(subjects.openMarks.size).toBe(0);
    });

    it('builds an outbox renderer that renders through the production registry', async () => {
        const deps = buildEmailPreviewDeps({ siteUrl: 'https://hospeda.com.ar' });
        const result = await renderEmailCatalogScenario({
            key: 'outbox.verticals.partner-application-rejected',
            scenarioId: 'es',
            deps
        });
        expect(result.subject.trim()).not.toBe('');
        expect(calledIoSpies()).toEqual([]);
    });
});
