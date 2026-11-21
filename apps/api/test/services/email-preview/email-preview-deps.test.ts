/**
 * HOS-2519 AC-4.6: the preview deps are the fakes. Rendering the partner claim
 * notice, whose production renderer issues and PERSISTS a claim secret, must
 * not touch the database: every mock of the global `@repo/db` mock records
 * zero calls.
 */
import * as db from '@repo/db';
import { renderEmailCatalogScenario } from '@repo/notifications';
import { beforeEach, describe, expect, it, type MockInstance, vi } from 'vitest';
import {
    buildEmailPreviewDeps,
    PREVIEW_PARTNER_CLAIM_SECRET,
    previewReadListingNames,
    previewReadReconciliationSubjects
} from '../../../src/services/email-preview/email-preview-deps.js';

/** Every `vi.fn` exported by the `@repo/db` mock, top level and one level into models. */
function dbMocks(): readonly { readonly name: string; readonly mock: MockInstance }[] {
    const found: { name: string; mock: MockInstance }[] = [];
    for (const [name, value] of Object.entries(db as Record<string, unknown>)) {
        if (vi.isMockFunction(value)) {
            found.push({ name, mock: value });
        } else if (value && typeof value === 'object') {
            for (const [method, inner] of Object.entries(value as Record<string, unknown>)) {
                if (vi.isMockFunction(inner))
                    found.push({ name: `${name}.${method}`, mock: inner });
            }
        }
    }
    return found;
}

describe('email preview deps', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders the partner claim notice with the fake secret and no database call', async () => {
        // Arrange
        const deps = buildEmailPreviewDeps({ siteUrl: 'https://hospeda.com.ar' });
        const mocks = dbMocks();

        // Act
        const result = await renderEmailCatalogScenario({
            key: 'outbox.verticals.partner-claim-notice',
            scenarioId: 'application-es',
            deps
        });

        // Assert
        expect(mocks.length).toBeGreaterThan(0);
        expect(
            mocks.filter(({ mock }) => mock.mock.calls.length > 0).map(({ name }) => name)
        ).toEqual([]);
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
    });
});
