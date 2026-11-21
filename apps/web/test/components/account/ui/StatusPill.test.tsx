/**
 * Tests for StatusPill, CountPill and status-tone (HOS-2413 T-010).
 */

import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import {
    CountPill,
    STATUS_TONES,
    type StatusDomain,
    StatusPill,
    statusLabelKey,
    toneFor
} from '../../../../src/components/account/ui';
import { createT } from '../../../../src/lib/i18n';

const CASES = (Object.keys(STATUS_TONES) as StatusDomain[]).flatMap((domain) =>
    Object.entries(STATUS_TONES[domain]).map(([status, tone]) => ({ domain, status, tone }))
);

describe('StatusPill', () => {
    it.each(CASES)('$domain/$status resolves tone $tone and a real word', ({
        domain,
        status,
        tone
    }) => {
        // Arrange + Act
        const { container } = render(
            <StatusPill
                domain={domain}
                status={status}
                locale="es"
            />
        );
        // Assert
        const pill = container.firstElementChild as HTMLElement;
        const word = createT('es')(statusLabelKey({ domain, status }));
        expect(word).not.toBe(statusLabelKey({ domain, status }));
        expect(pill).toHaveAttribute('data-tone', tone);
        expect(pill).toHaveClass('pill', tone);
        expect(pill).toHaveTextContent(word);
    });

    it('has a label in every locale for every status', () => {
        for (const locale of ['es', 'en', 'pt'] as const) {
            const t = createT(locale);
            for (const { domain, status } of CASES) {
                const key = statusLabelKey({ domain, status });
                expect(t(key), `${locale} ${key}`).not.toBe(key);
            }
        }
    });

    it('renders an explicit tone with its text, including the plan tone', () => {
        render(<StatusPill tone="plan">Pro</StatusPill>);
        expect(screen.getByText('Pro')).toHaveClass('plan');
    });

    it('always renders the word, with or without the dot', () => {
        const { container } = render(
            <StatusPill
                tone="success"
                dot
            >
                Activo
            </StatusPill>
        );
        expect(container.querySelector('.dot')).toHaveAttribute('aria-hidden', 'true');
        expect(container).toHaveTextContent('Activo');
    });

    it('falls back to neutral for an unknown status', () => {
        expect(toneFor({ domain: 'moderation', status: 'NOPE' })).toBe('neutral');
    });
});

describe('CountPill', () => {
    it('caps at max and keeps the full count in its label', () => {
        render(
            <CountPill
                count={120}
                label="120 sin leer"
            />
        );
        const pill = screen.getByRole('img', { name: '120 sin leer' });
        expect(pill).toHaveTextContent('99+');
    });

    it('shows the exact count at or below max and honours a custom max', () => {
        const { rerender } = render(
            <CountPill
                count={99}
                label="99"
            />
        );
        expect(screen.getByRole('img')).toHaveTextContent('99');
        rerender(
            <CountPill
                count={11}
                max={9}
                label="11"
            />
        );
        expect(screen.getByRole('img')).toHaveTextContent('9+');
    });

    it('has solid and muted variants', () => {
        const { rerender } = render(
            <CountPill
                count={1}
                label="1"
                variant="solid"
            />
        );
        expect(screen.getByRole('img')).toHaveClass('countSolid');
        rerender(
            <CountPill
                count={1}
                label="1"
            />
        );
        expect(screen.getByRole('img')).toHaveClass('countMuted');
    });
});
