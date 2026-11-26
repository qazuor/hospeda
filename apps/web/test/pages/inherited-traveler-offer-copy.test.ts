import { expect, it } from 'vitest';
import { createT } from '@/lib/i18n';

it.each([
    ['es', 'Accedé a los beneficios para viajeros de tu plan sin pagar una segunda suscripción.'],
    [
        'en',
        'Access the traveler benefits included in your plan without paying for a second subscription.'
    ],
    [
        'pt',
        'Acesse os benefícios para viajantes incluídos no seu plano sem pagar uma segunda assinatura.'
    ]
] as const)('keeps inherited traveler copy independent of named entitlements in %s', (locale, body) => {
    const t = createT(locale);

    expect(t('pricing.group.inheritedTravelerBody')).toBe(body);
});
