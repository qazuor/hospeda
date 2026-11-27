/**
 * @file hos-2666-audit-remainders.test.ts
 * @description Source-contract tests for the HOS-2666 audit remainders: each
 * block pins one CARD so a regression to the old value fails loudly.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (path: string) => readFileSync(resolve(__dirname, '../..', path), 'utf8');
const readI18n = (locale: string, file: string) =>
    JSON.parse(
        readFileSync(
            resolve(__dirname, '../../../../packages/i18n/src/locales', locale, file),
            'utf8'
        )
    );

describe('HOS-2666 audit remainders', () => {
    it('CARD-100 H-7: the Amex mark is a stroked wordmark, not the full-bleed simpleicons square', () => {
        const icon = readFileSync(
            resolve(
                __dirname,
                '../../../../packages/icons/src/icons/payment/AmericanExpressIcon.tsx'
            ),
            'utf8'
        );
        expect(icon).toContain("viewBox: '0 0 48 24'");
        expect(icon).toContain('stroke="currentColor"');
        expect(icon).not.toContain('M16.015 14.378');
    });

    it('CARD-011 H-7: mobile cards are compact and the chip row fades from first paint', () => {
        const css = read('src/components/shared/cards/AccommodationCard.css');
        const mobile = css.slice(css.lastIndexOf('@media (max-width: 767px)'));
        expect(mobile).toMatch(/\.acc-card__image-area\s*\{\s*height: 120px;/);
        expect(mobile).toMatch(/\.acc-card__description\s*\{\s*-webkit-line-clamp: 1;/);
        const chips = read('src/components/shared/ui/FilterChips.astro');
        expect(chips).toMatch(
            /@media \(max-width: 767px\)\s*\{\s*\.filter-chips__list\s*\{\s*--filter-chips-fade-end: 64px;/
        );
    });

    it('CARD-023 H-3: the locked price alert explains what unlocks it', () => {
        const button = read('src/components/accommodation/PriceAlertButton.tsx');
        expect(button).toContain("'accommodations.detail.priceAlert.lockedHint'");
        for (const [locale, text] of [
            ['es', 'Disponible con Turista VIP'],
            ['en', 'Available with Tourist VIP'],
            ['pt', 'Disponível com Turista VIP']
        ] as const) {
            expect(readI18n(locale, 'accommodations.json').detail.priceAlert.lockedHint).toBe(text);
        }
    });

    it('CARD-043 H-3 / CARD-038 H-1: gate popovers are readable with 40px+ targets', () => {
        const compare = read('src/components/shared/compare/CompareUpsellPopover.module.css');
        expect(compare).toMatch(/\.ctaButton,\s*\.dismissButton\s*\{\s*min-height: 2\.75rem;/);
        expect(compare).not.toContain('font-size: 0.8125rem');
        const auth = read('src/components/auth/AuthRequiredPopover.module.css');
        expect(auth).not.toContain('font-size: 0.8125rem');
        expect(auth).toMatch(/\.closeButton\s*\{[^}]*width: 44px;[^}]*height: 44px;/);
        expect(auth).toMatch(
            /@media \(max-width: 30rem\)\s*\{\s*\.actions\s*\{\s*flex-direction: column;/
        );
        for (const file of [
            'src/components/auth/AuthRequiredPopover.client.tsx',
            'src/components/shared/compare/CompareUpsellPopover.client.tsx'
        ]) {
            expect(read(file)).toContain('width="16"');
        }
    });

    it('CARD-038 H-1: the favorites gate is one column and the sign-in icon never shrinks', () => {
        const auth = read('src/components/auth/AuthRequiredPopover.module.css');
        expect(auth).toMatch(/\.header\s*\{[^}]*flex-wrap: wrap;/);
        expect(auth).toMatch(/\.message\s*\{[^}]*flex: 1 1 0;[^}]*min-width: 0;/);
        expect(auth).toMatch(/\.benefit\s*\{[^}]*flex: 0 0 100%;/);
        expect(auth).toMatch(/\.signInButton svg\s*\{[^}]*flex-shrink: 0;/);
        const tsx = read('src/components/auth/AuthRequiredPopover.client.tsx');
        expect(tsx).toContain('<UserIcon');
    });

    it('CARD-040 H-3: the VIP save toast says "ilimitados" in every locale', () => {
        for (const locale of ['es', 'en', 'pt']) {
            const audit = readI18n(locale, 'ui.json').favorite.audit;
            expect(audit.savedUnlimited.toLowerCase()).toMatch(/ilimitados|unlimited/);
            expect(audit.removedUsage).toContain('{{usage}}');
        }
    });

    it('CARD-037 H-1: the assistant header renders the shared PlanBadge', () => {
        const widget = read('src/components/accommodation/AiChatWidget.tsx');
        expect(widget).toContain("from '@/components/shared/ui/PlanBadge'");
        expect(widget).toContain('<PlanBadge name={planBadgeName} />');
    });

    it('CARD-052 H-8: venue payment methods sit in the hours slot under their own title', () => {
        const page = read('src/pages/[lang]/comer-y-salir/[slug].astro');
        expect(page).toMatch(
            /name="hours"[\s\S]*?<ListingHouseRules policies=\{\{ paymentMethods \}\} locale=\{locale\} variant="payments" \/>/
        );
        const rules = read('src/components/listing/ListingHouseRules.astro');
        expect(rules).toContain("'listing.policies.paymentMethods.label'");
        expect(rules).toContain('.house-rules--payments .house-rules__value');
    });

    it('CARD-104 H-2: an invalid field keeps the normal background (border only)', () => {
        const css = read('src/styles/components.css');
        const rule = css.match(/select\[aria-invalid="true"\]\s*\{([^}]*)\}/)?.[1];
        expect(rule).toContain('border-color: var(--destructive');
        expect(rule).not.toContain('background-color');
    });

    it('CARD-103 H-3: contact descriptions and hours use the body text scale', () => {
        const page = read('src/pages/[lang]/contacto/index.astro');
        for (const selector of [
            '.contact-channel__description',
            '.contact-visit-card__row',
            '.contact-visit-card__note'
        ]) {
            const block = page.match(
                new RegExp(`${selector.replace('.', '\\.')}\\s*\\{([^}]*)\\}`)
            )?.[1];
            expect(block, selector).toContain('font-size: var(--text-body);');
        }
    });
});
