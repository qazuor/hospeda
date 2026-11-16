import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { PaidSignupsPausedNotice } from '@/components/billing/PaidSignupsPausedNotice';

vi.mock('@/components/billing/PaidSignupsPausedNotice.module.css', () => ({
    default: new Proxy({}, { get: (_target, property) => String(property) })
}));

describe('HOS-2229 the signups-paused notice only promises what billing.paidSignupsFreeze cuts', () => {
    it.each([
        ['es', /compras/i],
        ['en', /purchases/i],
        ['pt', /compras/i]
    ] as const)('%s: mentions new subscriptions and never purchases', (locale, purchases) => {
        render(
            <PaidSignupsPausedNotice
                locale={locale}
                testId="notice"
            />
        );
        const text = screen.getByTestId('notice').textContent ?? '';
        expect(text.length).toBeGreaterThan(0);
        expect(text).not.toMatch(purchases);
        expect(text).toMatch(
            locale === 'es' ? /suscripciones/ : locale === 'en' ? /subscriptions/ : /assinaturas/
        );
    });
});
