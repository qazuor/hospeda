import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const css = readFileSync(
    resolve(__dirname, '../../../src/components/alliance/AllianceLead.module.css'),
    'utf8'
);
const partnerCss = readFileSync(
    resolve(__dirname, '../../../src/components/partner/PartnerApplication.module.css'),
    'utf8'
);

describe('public alliance form presentation', () => {
    it('shares the same tokenized card and controls across both form implementations', () => {
        expect(css).toMatch(/\.form\s*\{\s*composes: card;/);
        expect(css).toContain('border-radius: var(--radius-card)');
        expect(css).toContain('background-color: var(--core-card)');
        expect(partnerCss).toContain('composes: card from "../alliance/AllianceLead.module.css"');
        expect(partnerCss).toContain('composes: input from "../alliance/AllianceLead.module.css"');
    });

    it('keeps native selects styled like inputs with a token-colored noninteractive chevron', () => {
        expect(css).toMatch(/\.input,\s*\.select,\s*\.textarea\s*\{/);
        expect(css).toMatch(/\.select\s*\{\s*appearance: none;/);
        const chevron = css.match(/\.selectControl::after\s*\{([^}]+)\}/)?.[1];
        expect(chevron).toContain('var(--core-muted-foreground)');
        expect(chevron).toContain('pointer-events: none');
        expect(css).toContain('.select.inputError');
    });

    it('provides the same new translation keys in all three locales', () => {
        const locales = ['es', 'en', 'pt'].map((locale) =>
            JSON.parse(
                readFileSync(
                    resolve(
                        __dirname,
                        `../../../../../packages/i18n/src/locales/${locale}/alliance-leads.json`
                    ),
                    'utf8'
                )
            )
        );
        for (const locale of locales) {
            expect(locale.form.placeholders.sponsorshipInterest).toBeTruthy();
            expect(locale.form.hints.sponsorshipInterest).toBeTruthy();
        }
    });
});
