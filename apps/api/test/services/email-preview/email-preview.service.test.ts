/**
 * HOS-2519 §6.3: the admin email preview service. AC-5.5 (the subject prefix
 * the inbox would show), the catalog-order summary, the 404/500 mapping and the
 * once-per-process render dependencies.
 */

import type { EmailCatalogRenderDeps, RenderedEmailCatalogScenario } from '@repo/notifications';
import {
    EMAIL_CATALOG,
    EmailCatalogEntryNotFoundError,
    EmailCatalogScenarioNotFoundError
} from '@repo/notifications';
import { ServiceErrorCode } from '@repo/schemas';
import { describe, expect, it, vi } from 'vitest';

// The global setup swaps `ServiceError` for a double; the real class is needed
// to assert the mapped codes.
vi.mock('@repo/service-core', async () => vi.importActual('@repo/service-core'));

import {
    createEmailPreviewService,
    EMAIL_PREVIEW_RENDER_FAILED_MESSAGE
} from '../../../src/services/email-preview/email-preview.service.js';
import { buildEmailPreviewDeps } from '../../../src/services/email-preview/email-preview-deps.js';
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
    it('lists every entry in catalog order with its scenarios and no renderer', async () => {
        // Arrange: one entry whose subjects come from a stub, one that throws.
        const working = {
            ...FIRST,
            renderScenario: vi.fn(async ({ scenarioId }: { scenarioId: string }) => ({
                subject: `Asunto ${scenarioId}`,
                react: null as never,
                warnings: []
            }))
        };
        const broken = {
            ...FIRST,
            key: `${FIRST.key}.broken` as typeof FIRST.key,
            renderScenario: vi.fn(async () => {
                throw new Error('sample failed');
            })
        };
        const buildDeps = vi.fn(() => FAKE_DEPS);
        const service = createEmailPreviewService({ catalog: [working, broken], buildDeps });

        // Act
        const first = await service.listEntries();
        const second = await service.listEntries();

        // Assert
        expect(first.total).toBe(2);
        expect(first.entries[0]).toEqual({
            key: FIRST.key,
            id: FIRST.id,
            sendPath: FIRST.sendPath,
            name: FIRST.name,
            domain: FIRST.domain,
            audience: FIRST.audience,
            wired: FIRST.wired,
            // HOS-2580 §H: the subject of each sample, for the previewer search.
            scenarios: FIRST.scenarios.map(({ id, label, locale }) => ({
                id,
                label,
                locale,
                subject: `Asunto ${id}`
            }))
        });
        // A sample that throws yields a null subject, never a failed list.
        expect(first.entries[1]?.scenarios.every((scenario) => scenario.subject === null)).toBe(
            true
        );
        // Computed once: the second call reuses the first.
        expect(second).toBe(first);
        expect(working.renderScenario).toHaveBeenCalledTimes(FIRST.scenarios.length);
        expect(buildDeps).toHaveBeenCalledTimes(1);
    });

    it('HOS-2580 §H lists the real subject of every catalog scenario', async () => {
        // Act: the production catalog with the preview fakes.
        const { entries, total } = await createEmailPreviewService({
            buildDeps: () =>
                buildEmailPreviewDeps({
                    siteUrl: 'https://hospeda.com.ar',
                    adminUrl: 'https://admin.example.com'
                })
        }).listEntries();

        // Assert
        expect(total).toBe(EMAIL_CATALOG.length);
        expect(entries.map((entry) => entry.key)).toEqual(EMAIL_CATALOG.map((entry) => entry.key));
        const subjects = entries.flatMap((entry) => entry.scenarios.map((s) => s.subject));
        expect(subjects.every((subject) => typeof subject === 'string' && subject !== '')).toBe(
            true
        );
        expect(subjects).toContain('Tu acceso termina mañana');
        // The owner's case: the subject reads differently from the entry name.
        const downgrade = entries.find(
            (entry) => entry.name === 'Aviso de límite por cambio a un plan menor'
        );
        expect(
            downgrade?.scenarios.some((s) => s.subject?.startsWith('Límite reducido en tu plan'))
        ).toBe(true);
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

    it.each([
        {
            label: 'scenario',
            error: new EmailCatalogScenarioNotFoundError({ key: 'k', scenarioId: 's' }),
            message: 'Email catalog scenario not found'
        },
        {
            label: 'entry',
            error: new EmailCatalogEntryNotFoundError('k'),
            message: 'Email catalog entry not found'
        }
    ])('maps a pipeline $label-not-found error to NOT_FOUND with its own message', async ({
        error,
        message
    }) => {
        // Arrange
        const service = createEmailPreviewService({
            buildDeps: () => FAKE_DEPS,
            renderScenario: async () => {
                throw error;
            }
        });

        // Act / Assert
        await expect(
            service.render({ key: FIRST.key, scenarioId: FIRST_SCENARIO })
        ).rejects.toMatchObject({ code: ServiceErrorCode.NOT_FOUND, message });
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
