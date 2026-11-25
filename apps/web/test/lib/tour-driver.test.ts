/**
 * @file tour-driver.test.ts
 * @description Regression for HOS-2448: the tour counter said "1 of 6" (driver.js
 * default) and a replay from Preferences pointed at anchors that are not there.
 */

import { describe, expect, it } from 'vitest';
import { createTranslations } from '../../src/lib/i18n';
import { buildTourDriverTexts, filterStepsPresentOnPage } from '../../src/lib/tour-driver';

describe('buildTourDriverTexts', () => {
    it('hides Previous in a real driver popover only on the first step', async () => {
        const { driver } = await import('../../src/lib/load-driver');
        const instance = driver({
            ...buildTourDriverTexts({ t: createTranslations('en').t }),
            animate: false,
            steps: [
                { popover: { title: 'Welcome', description: 'First step' } },
                { popover: { title: 'Finish', description: 'Second step' } }
            ]
        });
        try {
            instance.drive();
            expect(
                document.querySelector<HTMLButtonElement>('.driver-popover-prev-btn')?.hidden
            ).toBe(true);
            instance.moveNext();
            expect(
                document.querySelector<HTMLButtonElement>('.driver-popover-prev-btn')?.hidden
            ).toBe(false);
            instance.movePrevious();
            expect(
                document.querySelector<HTMLButtonElement>('.driver-popover-prev-btn')?.hidden
            ).toBe(true);
        } finally {
            instance.destroy();
        }
    });
    it('hides Previous on the first visible step and restores it on later steps', () => {
        const config = buildTourDriverTexts({ t: createTranslations('en').t });
        const previousButton = document.createElement('button');
        // Exercise the shared hook with the exact fields it consumes.
        const renderPopover = config.onPopoverRender as (
            popover: { previousButton: HTMLButtonElement },
            options: { index: number }
        ) => void;
        renderPopover({ previousButton }, { index: 0 });
        expect(previousButton.hidden).toBe(true);
        renderPopover({ previousButton }, { index: 1 });
        expect(previousButton.hidden).toBe(false);
        renderPopover({ previousButton }, { index: 0 });
        expect(previousButton.hidden).toBe(true);
    });
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
