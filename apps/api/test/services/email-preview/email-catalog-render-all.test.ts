/**
 * HOS-2519 AC-4.4: every scenario of every catalog entry renders through the
 * preview dependencies (production renderers, fake readers) without throwing,
 * with a real subject, no warnings and non-empty HTML and text bodies.
 */
import {
    EMAIL_CATALOG,
    type EmailCatalogRenderDeps,
    renderEmailCatalogScenario
} from '@repo/notifications';
import { describe, expect, it } from 'vitest';
import { buildEmailPreviewDeps } from '../../../src/services/email-preview/email-preview-deps.js';

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
    it('has scenarios to render', () => {
        expect(cases.length).toBeGreaterThanOrEqual(EMAIL_CATALOG.length);
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
    });
});
