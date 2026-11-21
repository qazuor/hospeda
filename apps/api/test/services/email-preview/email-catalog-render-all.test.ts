/**
 * HOS-2519 AC-4.4 + AC-4.6: every scenario of every catalog entry renders
 * through the preview dependencies (production renderers, fake readers)
 * without throwing, with a real subject, no warnings and non-empty HTML and
 * text bodies, and without any I/O: the real database-backed collaborators are
 * throwing spies and every `@repo/db` mock must record zero calls.
 */
import {
    EMAIL_CATALOG,
    type EmailCatalogRenderDeps,
    renderEmailCatalogScenario
} from '@repo/notifications';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { buildEmailPreviewDeps } from '../../../src/services/email-preview/email-preview-deps.js';
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

const UNRESOLVED_PLACEHOLDER = /\{[A-Za-z][A-Za-z0-9]*\}/;

const deps: EmailCatalogRenderDeps = buildEmailPreviewDeps({
    siteUrl: 'https://hospeda.com.ar',
    adminUrl: 'https://admin.hospeda.com.ar',
    environmentLabel: 'STAGING'
});

const cases = EMAIL_CATALOG.flatMap((entry) =>
    entry.scenarios.map((scenario) => [entry.key, scenario.id] as const)
);

describe('email catalog: render every scenario through the preview deps', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('has scenarios to render and an armed I/O guard', () => {
        expect(cases.length).toBeGreaterThanOrEqual(EMAIL_CATALOG.length);
        expect(ioGuardsAreArmed()).toBe(true);
    });

    it.each(cases)('renders %s / %s', async (key, scenarioId) => {
        // Act
        const result = await renderEmailCatalogScenario({ key, scenarioId, deps });

        // Assert
        expect(result.subject.trim()).not.toBe('');
        expect(result.subject).not.toMatch(UNRESOLVED_PLACEHOLDER);
        expect(result.warnings).toEqual([]);
        expect(result.html).toContain('<html');
        expect(result.text.trim()).not.toBe('');
        expect(calledIoSpies(), 'the preview performed I/O').toEqual([]);
    });
});
