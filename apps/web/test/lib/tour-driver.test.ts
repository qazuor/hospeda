/**
 * @file tour-driver.test.ts
 * @description Regression for HOS-2448: the tour counter said "1 of 6" (driver.js
 * default) and a replay from Preferences pointed at anchors that are not there.
 */

import { describe, expect, it } from 'vitest';
import { createTranslations } from '../../src/lib/i18n';
import { buildTourDriverTexts, filterStepsPresentOnPage } from '../../src/lib/tour-driver';

describe('buildTourDriverTexts', () => {
    it('translates the progress counter instead of leaving the English default', () => {
        const { t } = createTranslations('es');

        const texts = buildTourDriverTexts({ t });

        expect(texts.progressText).toBe('Paso {{current}} de {{total}}');
        expect(texts.progressText).not.toMatch(/\bof\b/);
    });

    it('translates the counter for en and pt', () => {
        expect(buildTourDriverTexts({ t: createTranslations('en').t }).progressText).toMatch(
            /Step/
        );
        expect(buildTourDriverTexts({ t: createTranslations('pt').t }).progressText).toMatch(
            /Passo/
        );
    });
});

describe('filterStepsPresentOnPage', () => {
    it('keeps center steps and steps whose anchor exists, drops the rest', () => {
        document.body.innerHTML = '<div data-tour="here"></div>';
        const steps = [
            { target: 'center' },
            { target: '[data-tour="here"]' },
            { target: '[data-tour="absent"]' }
        ];

        const result = filterStepsPresentOnPage({ steps, doc: document });

        expect(result.map((s) => s.target)).toEqual(['center', '[data-tour="here"]']);
    });
});
