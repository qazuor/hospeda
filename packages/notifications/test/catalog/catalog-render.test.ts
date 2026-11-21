/**
 * Renders every scenario of the catalog entries this package can render on
 * its own (every send path except the outbox, whose renderers are composed by
 * `apps/api`). The full render-all test, outbox included, is in `apps/api`
 * (HOS-2519 AC-4.4).
 */
import { describe, expect, it } from 'vitest';
import {
    EMAIL_CATALOG,
    EmailCatalogEntryNotFoundError,
    type EmailCatalogRenderDeps,
    EmailCatalogScenarioNotFoundError,
    renderEmailCatalogScenario
} from '../../src/catalog/index';

const UNRESOLVED_PLACEHOLDER = /\{[A-Za-z][A-Za-z0-9]*\}/;

const deps: EmailCatalogRenderDeps = {
    siteUrl: 'https://hospeda.com.ar',
    outboxRenderer: () => {
        throw new Error('outbox renders are covered in apps/api');
    }
};

const cases = EMAIL_CATALOG.filter((entry) => entry.sendPath !== 'outbox').flatMap((entry) =>
    entry.scenarios.map((scenario) => [entry.key, scenario.id] as const)
);

describe('email catalog render (non-outbox paths)', () => {
    it.each(cases)('renders %s / %s', async (key, scenarioId) => {
        const result = await renderEmailCatalogScenario({ key, scenarioId, deps });

        expect(result.subject.trim()).not.toBe('');
        expect(result.subject).not.toMatch(UNRESOLVED_PLACEHOLDER);
        expect(result.warnings).toEqual([]);
        expect(result.html).toContain('<html');
        expect(result.text.trim()).not.toBe('');
    });

    it('rejects an unknown key', async () => {
        await expect(
            renderEmailCatalogScenario({ key: 'auth.nope', scenarioId: 'x', deps })
        ).rejects.toBeInstanceOf(EmailCatalogEntryNotFoundError);
    });

    it('rejects an unknown scenario of a known key', async () => {
        await expect(
            renderEmailCatalogScenario({ key: 'auth.reset-password', scenarioId: 'nope', deps })
        ).rejects.toBeInstanceOf(EmailCatalogScenarioNotFoundError);
    });
});
