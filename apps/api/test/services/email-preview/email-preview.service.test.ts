/**
 * HOS-2519 §6.3: the admin email preview service. AC-5.5 (the subject prefix
 * the inbox would show), the catalog-order summary, the 404/500 mapping and the
 * once-per-process render dependencies.
 */

import type { EmailCatalogRenderDeps, RenderedEmailCatalogScenario } from '@repo/notifications';
import { EMAIL_CATALOG } from '@repo/notifications';
import { ServiceErrorCode } from '@repo/schemas';
import { describe, expect, it, vi } from 'vitest';

// The global setup swaps `ServiceError` for a double; the real class is needed
// to assert the mapped codes.
vi.mock('@repo/service-core', async () => vi.importActual('@repo/service-core'));

import {
    createEmailPreviewService,
    EMAIL_PREVIEW_RENDER_FAILED_MESSAGE
} from '../../../src/services/email-preview/email-preview.service.js';
import { buildEmailEnvDecoration } from '../../../src/utils/email-sender.js';

const FAKE_DEPS = { siteUrl: 'https://hospeda.com.ar' } as unknown as EmailCatalogRenderDeps;
const RENDERED: RenderedEmailCatalogScenario = {
    subject: 'Asunto de ejemplo',
    html: '<html lang="es"></html>',
    text: 'Texto de ejemplo',
    warnings: []
};
const FIRST = EMAIL_CATALOG[0];

if (!FIRST) {
    throw new Error('The email catalog is empty');
}
const FIRST_SCENARIO = FIRST.scenarios[0]?.id ?? '';

describe('createEmailPreviewService', () => {
    it('lists every entry in catalog order with its scenarios and no renderer', () => {
        // Act
        const { entries, total } = createEmailPreviewService().listEntries();

        // Assert
        expect(total).toBe(EMAIL_CATALOG.length);
        expect(entries.map((entry) => entry.key)).toEqual(EMAIL_CATALOG.map((entry) => entry.key));
        expect(entries[0]).toEqual({
            key: FIRST.key,
            id: FIRST.id,
            sendPath: FIRST.sendPath,
            name: FIRST.name,
            domain: FIRST.domain,
            wired: FIRST.wired,
            scenarios: FIRST.scenarios.map(({ id, label }) => ({ id, label }))
        });
    });

    it.each([
        { label: 'staging', deployEnv: 'preview', expected: '[STAGING] ' },
        { label: 'production', deployEnv: 'prod', expected: null }
    ])('AC-5.5: reports the $label subject prefix', async ({ deployEnv, expected }) => {
        // Arrange
        const service = createEmailPreviewService({
            buildDeps: () => FAKE_DEPS,
            renderScenario: async () => RENDERED,
            getSubjectPrefix: () =>
                buildEmailEnvDecoration({ deployEnv, baseFromName: 'Hospeda' }).subjectPrefix
        });

        // Act
        const result = await service.render({ key: FIRST.key, scenarioId: FIRST_SCENARIO });

        // Assert
        expect(result).toEqual({
            key: FIRST.key,
            scenarioId: FIRST_SCENARIO,
            subject: RENDERED.subject,
            subjectPrefix: expected,
            html: RENDERED.html,
            text: RENDERED.text,
            warnings: []
        });
    });

    it('builds the render dependencies once and passes them to every render', async () => {
        // Arrange
        const buildDeps = vi.fn(() => FAKE_DEPS);
        const renderScenario = vi.fn(async () => RENDERED);
        const service = createEmailPreviewService({
            buildDeps,
            renderScenario,
            getSubjectPrefix: () => undefined
        });

        // Act
        await service.render({ key: FIRST.key, scenarioId: FIRST_SCENARIO });
        await service.render({ key: FIRST.key, scenarioId: FIRST_SCENARIO });

        // Assert
        expect(buildDeps).toHaveBeenCalledTimes(1);
        expect(renderScenario).toHaveBeenCalledWith({
            key: FIRST.key,
            scenarioId: FIRST_SCENARIO,
            deps: FAKE_DEPS
        });
    });

    it.each([
        { key: 'auth.unknown', scenarioId: FIRST_SCENARIO },
        { key: FIRST.key, scenarioId: 'unknown-scenario' }
    ])('throws NOT_FOUND without rendering for %j', async (query) => {
        // Arrange
        const renderScenario = vi.fn(async () => RENDERED);
        const service = createEmailPreviewService({ buildDeps: () => FAKE_DEPS, renderScenario });

        // Act / Assert
        await expect(service.render(query)).rejects.toMatchObject({
            code: ServiceErrorCode.NOT_FOUND
        });
        expect(renderScenario).not.toHaveBeenCalled();
    });

    it('maps a render failure to INTERNAL_ERROR with a generic message', async () => {
        // Arrange
        const service = createEmailPreviewService({
            buildDeps: () => FAKE_DEPS,
            renderScenario: async () => {
                throw new Error('boom: internal detail');
            }
        });

        // Act / Assert
        await expect(
            service.render({ key: FIRST.key, scenarioId: FIRST_SCENARIO })
        ).rejects.toMatchObject({
            code: ServiceErrorCode.INTERNAL_ERROR,
            message: EMAIL_PREVIEW_RENDER_FAILED_MESSAGE
        });
    });
});
