/**
 * @file TradeCard.stats.test.tsx
 * @description What the directory card actually prints about a provider
 * (HOS-376 T-052, AC-25/AC-26).
 *
 * The threshold rule itself is asserted against the pure resolver in
 * `resolve-trade-stats.test.ts`. What these tests add is the wiring: that the
 * card reads the resolver at all, formats the average for the locale, and
 * keeps the use/host pair together.
 */

import type { HostTradePublic } from '@repo/schemas';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Module mocks — must be declared before imports
// ---------------------------------------------------------------------------

vi.mock('@/lib/i18n', () => ({
    createTranslations: (_locale: string) => ({
        t: (key: string, fallback?: string, params?: Record<string, string>) => {
            const labels: Record<string, string> = {
                'host-trades.categories.PLOMERIA': 'Plomería',
                'host-trades.card.benefit': 'Beneficio para hosts',
                'host-trades.card.contact': 'Contactar',
                'host-trades.card.stats.ratingLabel': '{{rating}} de 5 estrellas'
            };
            const template = labels[key] ?? fallback ?? key;
            return Object.entries(params ?? {}).reduce(
                (text, [name, value]) => text.replace(`{{${name}}}`, value),
                template
            );
        },
        // Mirrors the CLDR `_one`/`_other` selection the real helper performs,
        // so a card that reached for the wrong key still fails here.
        tPlural: (key: string, count: number, params?: Record<string, string>) => {
            const forms: Record<string, string> = {
                'host-trades.card.stats.reviews_one': '{{count}} valoración',
                'host-trades.card.stats.reviews_other': '{{count}} valoraciones',
                'host-trades.card.stats.uses_one': '{{count}} uso',
                'host-trades.card.stats.uses_other': '{{count}} usos',
                'host-trades.card.stats.hosts_one': '{{count}} anfitrión',
                'host-trades.card.stats.hosts_other': '{{count}} anfitriones'
            };
            const template = forms[`${key}${count === 1 ? '_one' : '_other'}`] ?? key;
            return Object.entries(params ?? {}).reduce(
                (text, [name, value]) => text.replace(`{{${name}}}`, value),
                template
            );
        }
    })
}));

vi.mock('@/components/host/host-trades/TradeCard.module.css', () => ({
    default: new Proxy({}, { get: (_t, prop) => String(prop) })
}));

import { TradeCard } from '@/components/host/host-trades/TradeCard';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

/**
 * Builds a public trade carrying only the aggregates under test.
 *
 * @param aggregates - The stats columns to override.
 * @returns A trade shaped as the public tier serves it.
 */
function buildTrade(aggregates: Partial<HostTradePublic> = {}): HostTradePublic {
    return {
        id: 'trade-1',
        slug: 'plomeria-lopez',
        name: 'Plomería López',
        category: 'PLOMERIA',
        benefit: '15% de descuento',
        contact: '+54 9 3442 567890',
        is24h: false,
        ...aggregates
    } as HostTradePublic;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('TradeCard — stats line', () => {
    it('should hide the average below the threshold, keeping the count (AC-25)', () => {
        render(
            <TradeCard
                locale="es"
                trade={buildTrade({ reviewsCount: 2, averageRating: 4.6 })}
            />
        );

        expect(screen.getByText('2 valoraciones')).toBeInTheDocument();
        expect(screen.queryByText('4,6')).not.toBeInTheDocument();
        expect(screen.queryByText('★')).not.toBeInTheDocument();
    });

    it('should show the average from the threshold up (AC-25)', () => {
        render(
            <TradeCard
                locale="es"
                trade={buildTrade({ reviewsCount: 3, averageRating: 4.6 })}
            />
        );

        expect(screen.getByText('4,6')).toBeInTheDocument();
        expect(screen.getByText('★')).toBeInTheDocument();
        expect(screen.getByText('3 valoraciones')).toBeInTheDocument();
    });

    it('should format the average for the locale', () => {
        render(
            <TradeCard
                locale="en"
                trade={buildTrade({ reviewsCount: 12, averageRating: 4.5999999 })}
            />
        );

        // One decimal, English separator — not the raw aggregate value.
        expect(screen.getByText('4.6')).toBeInTheDocument();
        expect(screen.queryByText('4.5999999')).not.toBeInTheDocument();
    });

    it('should give the star an accessible label rather than a bare glyph', () => {
        render(
            <TradeCard
                locale="es"
                trade={buildTrade({ reviewsCount: 12, averageRating: 4.6 })}
            />
        );

        expect(screen.getByText('4,6 de 5 estrellas')).toBeInTheDocument();
    });

    it('should print both halves of the anti-collusion pair (AC-26)', () => {
        render(
            <TradeCard
                locale="es"
                trade={buildTrade({ confirmedUsesCount: 34, distinctHostsCount: 21 })}
            />
        );

        expect(screen.getByText('34 usos')).toBeInTheDocument();
        expect(screen.getByText('21 anfitriones')).toBeInTheDocument();
    });

    it('should never state uses without the hosts behind them (§6.5)', () => {
        // The pair is the signal. "40 usos" alone hides exactly what "40 usos ·
        // 2 anfitriones" gives away, so the host count renders even at 2.
        render(
            <TradeCard
                locale="es"
                trade={buildTrade({ confirmedUsesCount: 40, distinctHostsCount: 2 })}
            />
        );

        expect(screen.getByText('40 usos')).toBeInTheDocument();
        expect(screen.getByText('2 anfitriones')).toBeInTheDocument();
    });

    it('should singularise a lone use', () => {
        render(
            <TradeCard
                locale="es"
                trade={buildTrade({ confirmedUsesCount: 1, distinctHostsCount: 1 })}
            />
        );

        expect(screen.getByText('1 uso')).toBeInTheDocument();
        expect(screen.getByText('1 anfitrión')).toBeInTheDocument();
    });

    it('should render no stats line at all for a brand-new provider', () => {
        const { container } = render(
            <TradeCard
                locale="es"
                trade={buildTrade({
                    reviewsCount: 0,
                    averageRating: 0,
                    confirmedUsesCount: 0,
                    distinctHostsCount: 0
                })}
            />
        );

        // The assertion is on the ELEMENT, not on the absence of "0 usos".
        // Every count guard inside the row is independently zero-guarded, so an
        // `isEmpty` that stopped working would still print no text — and a test
        // that only looked for text would stay green over an empty <p> with the
        // row's margins. A row of zeros reads as a measurement ("nobody used
        // this") when it only means the provider just joined.
        expect(container.querySelector('.statsRow')).toBeNull();
    });

    it('should render the stats line when there is something to state', () => {
        // The control for the assertion above: proves `.statsRow` is the
        // selector the card actually emits, so its absence means something.
        const { container } = render(
            <TradeCard
                locale="es"
                trade={buildTrade({ confirmedUsesCount: 3, distinctHostsCount: 3 })}
            />
        );

        expect(container.querySelector('.statsRow')).not.toBeNull();
    });

    it('should still render the card body when there are no stats', () => {
        render(
            <TradeCard
                locale="es"
                trade={buildTrade()}
            />
        );

        expect(screen.getByText('Plomería López')).toBeInTheDocument();
        expect(screen.getByText('Contactar')).toBeInTheDocument();
    });
});
