import { readFileSync } from 'node:fs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { buildUrl } from '@/lib/urls';

const { listMine, listRecurringAddons } = vi.hoisted(() => ({
    listMine: vi.fn(),
    listRecurringAddons: vi.fn()
}));
vi.mock('@/lib/api/endpoints-protected', () => ({ billingSubscriptionApi: { listMine } }));
vi.mock('@/lib/api/endpoints-protected-addons', () => ({
    billingAddonApi: { listRecurringAddons }
}));

const source = readFileSync('src/pages/[lang]/mi-cuenta/complementos/index.astro', 'utf8');
const frontmatter = source.split('---')[1] ?? '';

describe('AC:B10:11 account addon purchase page', () => {
    it('uses the shared fail-closed billing gate and preserves the return settlement', () => {
        expect(frontmatter).toContain('parseReturnOrderRequestId');
        expect(frontmatter).toContain('Astro.locals.user');
        expect(frontmatter).toContain('const title = t(');
        expect(frontmatter).toContain(
            "import { hasBillingPresence } from '@/lib/account-billing-presence'"
        );
        expect(frontmatter).toContain(
            '!returnOrderRequestId && !await hasBillingPresence({ userId: user.id, cookieHeader })'
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

describe('D5b complementos route access', () => {
    beforeEach(() => {
        vi.resetModules();
        vi.resetAllMocks();
        listMine.mockResolvedValue({
            ok: true,
            data: {
                subscriptions: [],
                deferredCourtesies: [],
                declinedSignups: [],
                expiredDeclinedSignups: []
            }
        });
        listRecurringAddons.mockResolvedValue({ ok: true, data: { items: [] } });
    });

    async function runPageGuard(returnOrderRequestId: string | null = null) {
        const { hasBillingPresence } = await import('@/lib/account-billing-presence');
        const redirect = vi.fn();
        // Execute the actual route guard with the real cached helper; Astro markup
        // is covered by the wiring assertions and the withdrawal component tests.
        const guard = frontmatter.slice(frontmatter.indexOf('if (!returnOrderRequestId'));
        expect(guard).toContain('return Astro.redirect');
        const execute = new Function(
            'hasBillingPresence',
            'Astro',
            'user',
            'cookieHeader',
            'locale',
            'returnOrderRequestId',
            'buildUrl',
            `return (async () => { ${guard} })();`
        );
        await execute(
            hasBillingPresence,
            { redirect },
            { id: 'addon-owner' },
            'test-session',
            'es',
            returnOrderRequestId,
            buildUrl
        );
        return redirect;
    }

    it('keeps the summary and withdrawal path reachable with an active add-on and zero subscriptions', async () => {
        listRecurringAddons.mockResolvedValue({
            ok: true,
            data: {
                items: [
                    {
                        addonInstanceId: '123e4567-e89b-42d3-a456-426614174001',
                        slug: 'destaque-alfa',
                        name: 'Destaque Alfa',
                        chargeKind: 'PERIODICO',
                        cycle: 'monthly',
                        price: 120000,
                        currency: 'ARS',
                        status: 'ACTIVE',
                        targetId: null,
                        targetName: null
                    }
                ]
            }
        });
        expect(await runPageGuard()).not.toHaveBeenCalled();
        expect(source).toContain('<RecurringAddonWithdrawal client:visible');
        expect(listRecurringAddons).toHaveBeenCalledWith({ cookieHeader: 'test-session' });
    });

    it('redirects to the account dashboard when both lists are empty', async () => {
        expect(await runPageGuard()).toHaveBeenCalledWith('/es/mi-cuenta/');
    });

    it('redirects on an add-on fetch error', async () => {
        listRecurringAddons.mockRejectedValue(new Error('offline'));
        expect(await runPageGuard()).toHaveBeenCalledWith('/es/mi-cuenta/');
    });

    it('lets the payment return settle even without billing presence', async () => {
        expect(await runPageGuard('123e4567-e89b-42d3-a456-426614174002')).not.toHaveBeenCalled();
        expect(listMine).not.toHaveBeenCalled();
        expect(listRecurringAddons).not.toHaveBeenCalled();
    });
});
