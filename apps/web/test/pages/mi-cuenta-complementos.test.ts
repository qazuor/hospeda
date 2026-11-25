import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = readFileSync('src/pages/[lang]/mi-cuenta/complementos/index.astro', 'utf8');
const frontmatter = source.split('---')[1] ?? '';

describe('AC:B10:11 account addon purchase page', () => {
    it('redirects only a successful empty subscription read and preserves the return settlement', () => {
        expect(frontmatter).toContain('parseReturnOrderRequestId');
        expect(frontmatter).toContain('Astro.locals.user');
        expect(frontmatter).toContain('const title = t(');
        expect(frontmatter).toContain(
            'parseOwnSubscriptions({ result: await billingSubscriptionApi.listMine({ cookieHeader }) })'
        );
        expect(frontmatter).toContain(
            '!returnOrderRequestId && ownSubscriptions?.subscriptions.length === 0'
        );
        expect(frontmatter).toContain("Astro.redirect(buildUrl({ locale, path: 'mi-cuenta' }))");
        expect(source).toMatch(/returnOrderRequestId && <AddonPurchase\s+client:load/u);
        expect(source).not.toContain('<AddonPurchaseGate');
        expect(source).toContain('id="recurring-addons"');
        expect(source).toContain('listingId={listingId}');
    });
    it('places each eligible vertical purchase section inside subscriptions with browser reads', () => {
        const subscriptionPage = readFileSync(
            'src/pages/[lang]/mi-cuenta/suscripcion/index.astro',
            'utf8'
        );
        expect(subscriptionPage).toContain('eligibleSubscriptionTargets({');
        expect(subscriptionPage).toContain('addonVerticals.map((vertical)');
        expect(subscriptionPage).toMatch(/id=\{`addons-\$\{vertical\}`\}/);
        expect(subscriptionPage).toContain('<AddonPurchaseGate client:visible');
        expect(subscriptionPage).toContain('onlyVertical={vertical}');
        expect(subscriptionPage).toContain('helpId="section:complementos.recurrentes"');
        expect(subscriptionPage).not.toContain('section:complementos.compra');
    });
});
