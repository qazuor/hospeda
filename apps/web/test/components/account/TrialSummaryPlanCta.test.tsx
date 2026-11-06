import { TrialStatusEnum, type TrialSummaryResponse } from '@repo/schemas';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { resolveTrialSummaryView } from '@/lib/billing/trial-summary-view';
import { buildUrl } from '@/lib/urls';

const active: TrialSummaryResponse = {
    status: TrialStatusEnum.TRIAL_ACTIVE,
    startedAt: '2026-10-20T03:00:00.000Z',
    endsAt: '2026-11-19T03:00:00.000Z',
    totalDays: 30,
    origins: { base: 20, promo: 5, support: 5 }
};

function summary(status: TrialStatusEnum): TrialSummaryResponse {
    return { ...active, status };
}

function renderPlanCta({
    trial,
    hasLiveSubscription,
    locale,
    vertical
}: {
    trial: TrialSummaryResponse;
    hasLiveSubscription: boolean;
    locale: 'es' | 'en';
    vertical: 'accommodation' | 'venue' | 'experience';
}): string {
    const view = resolveTrialSummaryView({ summary: trial, hasLiveSubscription });
    if (view.kind === 'hidden' || !view.canChoosePlan) return '';

    const message =
        view.kind === 'running'
            ? 'Tu prueba sigue activa.'
            : 'Tu prueba terminó. Elegí un plan para volver a publicar.';
    const path = {
        accommodation: 'planes/anfitriones/precios',
        venue: 'planes/comer-y-salir/precios',
        experience: 'planes/experiencias/precios'
    }[vertical];

    return renderToStaticMarkup(
        <>
            <p>{message}</p>
            <a href={buildUrl({ locale, path })}>Choose your plan</a>
        </>
    );
}

describe('TrialSummary plan CTA markup behaviour', () => {
    it.each([
        ['accommodation', '/es/planes/anfitriones/precios/'],
        ['venue', '/es/planes/comer-y-salir/precios/'],
        ['experience', '/es/planes/experiencias/precios/']
    ] as const)('shows the running trial link for %s without a live subscription', (vertical, href) => {
        expect(
            renderPlanCta({ trial: active, hasLiveSubscription: false, locale: 'es', vertical })
        ).toContain(`href="${href}"`);
    });

    it('omits the running trial link when a live subscription exists', () => {
        expect(
            renderPlanCta({
                trial: active,
                hasLiveSubscription: true,
                locale: 'es',
                vertical: 'accommodation'
            })
        ).not.toContain('<a ');
    });

    it('omits the converted trial link when a live subscription exists', () => {
        expect(
            renderPlanCta({
                trial: summary(TrialStatusEnum.TRIAL_CONVERTED),
                hasLiveSubscription: true,
                locale: 'es',
                vertical: 'accommodation'
            })
        ).not.toContain('<a ');
    });

    it('keeps the ended message and link for expired and converted trials without a live plan', () => {
        for (const trial of [
            summary(TrialStatusEnum.TRIAL_EXPIRED),
            summary(TrialStatusEnum.TRIAL_CONVERTED)
        ]) {
            const html = renderPlanCta({
                trial,
                hasLiveSubscription: false,
                locale: 'es',
                vertical: 'accommodation'
            });
            expect(html).toContain('Tu prueba terminó. Elegí un plan para volver a publicar.');
            expect(html).toContain('href="/es/planes/anfitriones/precios/"');
        }
    });

    it('builds the localized English pricing link', () => {
        expect(
            renderPlanCta({
                trial: active,
                hasLiveSubscription: false,
                locale: 'en',
                vertical: 'accommodation'
            })
        ).toContain('href="/en/planes/anfitriones/precios/"');
    });
});
