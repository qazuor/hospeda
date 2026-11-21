/**
 * HOS-2519 AC-5.5 through the REAL default wiring: no `getSubjectPrefix`
 * injection, so the prefix comes from `getEmailSender().subjectPrefix`, which
 * reads `HOSPEDA_DEPLOY_ENV` from the env module (mocked here, as in
 * `test/utils/email-sender.wrapper.test.ts`).
 */

import type { EmailCatalogRenderDeps, RenderedEmailCatalogScenario } from '@repo/notifications';
import { EMAIL_CATALOG } from '@repo/notifications';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockEnv: Record<string, string | undefined> = {};

vi.mock('../../../src/utils/env', () => ({
    get env() {
        return mockEnv;
    }
}));

const { createEmailPreviewService } = await import(
    '../../../src/services/email-preview/email-preview.service.js'
);

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

function serviceWithDefaultPrefix() {
    return createEmailPreviewService({
        buildDeps: () =>
            ({ siteUrl: 'https://hospeda.com.ar' }) as unknown as EmailCatalogRenderDeps,
        renderScenario: async () => RENDERED
    });
}

describe('AC-5.5: subject prefix from the real sender wiring', () => {
    beforeEach(() => {
        for (const key of Object.keys(mockEnv)) {
            delete mockEnv[key];
        }
    });

    it("is '[STAGING] ' on a staging deploy", async () => {
        // Arrange
        mockEnv.HOSPEDA_DEPLOY_ENV = 'preview';

        // Act
        const result = await serviceWithDefaultPrefix().render({
            key: FIRST.key,
            scenarioId: FIRST_SCENARIO
        });

        // Assert
        expect(result.subjectPrefix).toBe('[STAGING] ');
    });

    it('is null on production', async () => {
        // Arrange
        mockEnv.HOSPEDA_DEPLOY_ENV = 'prod';

        // Act
        const result = await serviceWithDefaultPrefix().render({
            key: FIRST.key,
            scenarioId: FIRST_SCENARIO
        });

        // Assert
        expect(result.subjectPrefix).toBeNull();
    });

    it('is null when the deploy env is unset (fail-safe production)', async () => {
        const result = await serviceWithDefaultPrefix().render({
            key: FIRST.key,
            scenarioId: FIRST_SCENARIO
        });

        expect(result.subjectPrefix).toBeNull();
    });
});
