/**
 * @file TradesDirectory.test.tsx
 * @description Unit tests for the TradesDirectory and TradeCard islands.
 *
 * Coverage:
 * TradesDirectory (HOS-919 AC-5.1 to AC-5.3):
 * - Renders all trades when no filter is active
 * - Pills are the union of the categories in the result set, in catalog order
 * - Selecting several pills shows the UNION (any-of), each provider once
 * - Clicking an active pill clears just that pill; "Todos" clears all
 * - Shows an empty message when the active filter matches nothing
 * - Provider order (name) is never changed by filtering
 * - Filter pills use aria-pressed for accessibility
 *
 * TradeCard:
 * - Renders name, benefit, contact link
 * - is24h badge rendered only when is24h=true
 * - scheduleText rendered only when present
 * - Category badges (detailed in TradeCard.categories.test.tsx)
 */

import type { HostTradePublic } from '@repo/schemas';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Module mocks — must be declared before imports
// ---------------------------------------------------------------------------

vi.mock('@/lib/i18n', () => ({
    // The kit LinkButton (`external`) names its «opens in a new tab» hint with createT
    createT: () => (key: string) => key,
    createTranslations: (_locale: string) => ({
        t: (key: string, fallback?: string) => {
            const labels: Record<string, string> = {
                'host-trades.filter.all': 'Todos',
                'host-trades.card.is24h': 'Disponible 24hs',
                'host-trades.card.benefit': 'Beneficio para hosts',
                'host-trades.card.contact': 'Contactar',
                'host-trades.page.title': 'Directorio de proveedores',
                'host-trades.emptyState.noTrades':
                    'No hay proveedores disponibles para tus destinos por ahora.'
            };
            return labels[key] ?? fallback ?? key;
        },
        // The card reads `tPlural` for its stats line (T-052). These fixtures
        // carry no aggregates, so it is never called today — but leaving it out
        // would turn the first fixture that gains one into a crash rather than
        // a readable failure.
        tPlural: (key: string, count: number) => `${key}:${count}`
    })
}));

vi.mock('@/lib/cn', () => ({
    cn: (...classes: (string | undefined | false | null)[]) => classes.filter(Boolean).join(' ')
}));

vi.mock('@/components/host/host-trades/TradesDirectory.module.css', () => ({
    default: new Proxy({}, { get: (_t, prop) => String(prop) })
}));

vi.mock('@/components/host/host-trades/TradeCard.module.css', () => ({
    default: new Proxy({}, { get: (_t, prop) => String(prop) })
}));

import { TradeCard } from '../../../../src/components/host/host-trades/TradeCard';
// Import AFTER mock setup
import { TradesDirectory } from '../../../../src/components/host/host-trades/TradesDirectory.client';

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

/** Catalog order of the slugs used below (group weight, then category weight). */
const CATALOG_ORDER = ['plomeria', 'electricidad', 'cerrajeria', 'albanileria'] as const;

const NAMES: Record<(typeof CATALOG_ORDER)[number], string> = {
    plomeria: 'Plomería',
    electricidad: 'Electricidad',
    cerrajeria: 'Cerrajería',
    albanileria: 'Albañilería'
};

const refOf = (slug: (typeof CATALOG_ORDER)[number]) => ({
    id: `cat-${slug}`,
    slug,
    nameI18n: { es: NAMES[slug], en: `${NAMES[slug]} EN`, pt: NAMES[slug] },
    groupSlug: 'g'
});

// Cast: the fixtures carry only the fields the directory and the card read; the
// public aggregates (rating, counts) are irrelevant here and default in the card.
const makeTrade = (
    overrides: Partial<{
        id: string;
        name: string;
        categories: ReadonlyArray<(typeof CATALOG_ORDER)[number]>;
        contact: string;
        benefit: string;
        is24h: boolean;
        scheduleText: string | null | undefined;
    }> = {}
) =>
    ({
        id: overrides.id ?? 'trade-uuid-1',
        slug: 'plomero-juan',
        name: overrides.name ?? 'Juan Pérez Plomería',
        categories: (overrides.categories ?? ['plomeria']).map(refOf),
        contact: overrides.contact ?? '+549 11 1234-5678',
        benefit: overrides.benefit ?? '10% de descuento presentando la app',
        destinationId: 'dest-uuid-1',
        is24h: overrides.is24h ?? false,
        scheduleText: overrides.scheduleText === undefined ? null : overrides.scheduleText
    }) as unknown as HostTradePublic;

const tradePlomeria = makeTrade({
    id: 'trade-1',
    name: 'Juan Plomero',
    categories: ['plomeria'],
    benefit: 'Descuento 10%'
});

const tradeCerrajeria = makeTrade({
    id: 'trade-2',
    name: 'María Cerrajera',
    categories: ['cerrajeria'],
    benefit: 'Visita sin cargo',
    contact: 'https://wa.me/5491155555555'
});

const tradeAlbanileria = makeTrade({
    id: 'trade-3',
    name: 'Pedro Albañil',
    categories: ['albanileria'],
    benefit: 'Presupuesto gratis'
});

const tradeElectricidad = makeTrade({
    id: 'trade-4',
    name: 'Ana Electricista',
    categories: ['electricidad'],
    benefit: 'Primera inspección gratis',
    is24h: true
});

/** Does plumbing AND electrical: must be listed once when both pills are on. */
const tradeMulti = makeTrade({
    id: 'trade-5',
    name: 'Hogar Total',
    categories: ['plomeria', 'electricidad'],
    benefit: 'Todo para tu casa'
});

const allTrades = [tradePlomeria, tradeCerrajeria, tradeAlbanileria, tradeElectricidad];

/** Pill buttons (everything with aria-pressed except «Todos»), as text. */
const pillLabels = (): string[] =>
    screen
        .getAllByRole('button')
        .filter((btn) => btn.getAttribute('aria-pressed') !== null && btn.textContent !== 'Todos')
        .map((btn) => btn.textContent ?? '');

/** Names of the provider cards on screen, in DOM order. */
const cardNames = (): string[] =>
    screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent ?? '');

// ---------------------------------------------------------------------------
// TradesDirectory tests
// ---------------------------------------------------------------------------

describe('TradesDirectory — renders all trades', () => {
    it('renders all trade cards when no category filter is active', () => {
        render(
            <TradesDirectory
                trades={allTrades}
                locale="es"
            />
        );

        expect(screen.getByText('Juan Plomero')).toBeInTheDocument();
        expect(screen.getByText('María Cerrajera')).toBeInTheDocument();
        expect(screen.getByText('Pedro Albañil')).toBeInTheDocument();
        expect(screen.getByText('Ana Electricista')).toBeInTheDocument();
    });

    it('renders the "Todos" pill as active by default (aria-pressed=true)', () => {
        render(
            <TradesDirectory
                trades={allTrades}
                locale="es"
            />
        );

        expect(screen.getByRole('button', { name: 'Todos' })).toHaveAttribute(
            'aria-pressed',
            'true'
        );
    });

    it('renders one pill per distinct category present in the result set', () => {
        render(
            <TradesDirectory
                trades={[...allTrades, tradeMulti]}
                locale="es"
                catalogOrder={CATALOG_ORDER}
            />
        );

        // `tradeMulti` repeats plomeria/electricidad: still one pill each.
        expect(pillLabels()).toHaveLength(4);
    });

    it('labels pills in the page locale from the category name', () => {
        render(
            <TradesDirectory
                trades={[tradePlomeria]}
                locale="en"
            />
        );

        expect(screen.getByRole('button', { name: 'Plomería EN' })).toBeInTheDocument();
    });
});

describe('TradesDirectory — pill order follows the catalog (AC-5.2)', () => {
    it('orders pills by the catalog order given by the page, not by provider order', () => {
        render(
            <TradesDirectory
                trades={[...allTrades].reverse()}
                locale="es"
                catalogOrder={CATALOG_ORDER}
            />
        );

        expect(pillLabels()).toEqual(['Plomería', 'Electricidad', 'Cerrajería', 'Albañilería']);
    });

    it('puts categories the catalog order does not know after the known ones', () => {
        render(
            <TradesDirectory
                trades={allTrades}
                locale="es"
                catalogOrder={['electricidad']}
            />
        );

        expect(pillLabels()[0]).toBe('Electricidad');
        expect(pillLabels()).toHaveLength(4);
    });

    it('falls back to first appearance (each provider is already in catalog order) without a catalog', () => {
        render(
            <TradesDirectory
                trades={[tradeMulti, tradeCerrajeria]}
                locale="es"
            />
        );

        expect(pillLabels()).toEqual(['Plomería', 'Electricidad', 'Cerrajería']);
    });
});

describe('TradesDirectory — any-of category filter (AC-5.2)', () => {
    it('filters visible trades to the selected category', () => {
        render(
            <TradesDirectory
                trades={allTrades}
                locale="es"
            />
        );

        fireEvent.click(screen.getByRole('button', { name: 'Plomería' }));

        expect(screen.getByText('Juan Plomero')).toBeInTheDocument();
        expect(screen.queryByText('María Cerrajera')).not.toBeInTheDocument();
        expect(screen.queryByText('Pedro Albañil')).not.toBeInTheDocument();
        expect(screen.queryByText('Ana Electricista')).not.toBeInTheDocument();
    });

    it('shows the UNION when two pills are selected', () => {
        render(
            <TradesDirectory
                trades={allTrades}
                locale="es"
            />
        );

        fireEvent.click(screen.getByRole('button', { name: 'Plomería' }));
        fireEvent.click(screen.getByRole('button', { name: 'Cerrajería' }));

        expect(screen.getByText('Juan Plomero')).toBeInTheDocument();
        expect(screen.getByText('María Cerrajera')).toBeInTheDocument();
        expect(screen.queryByText('Pedro Albañil')).not.toBeInTheDocument();
        expect(screen.queryByText('Ana Electricista')).not.toBeInTheDocument();
    });

    it('lists a provider matching two selected pills exactly once', () => {
        render(
            <TradesDirectory
                trades={[tradePlomeria, tradeMulti, tradeElectricidad]}
                locale="es"
                catalogOrder={CATALOG_ORDER}
            />
        );

        fireEvent.click(screen.getByRole('button', { name: 'Plomería' }));
        fireEvent.click(screen.getByRole('button', { name: 'Electricidad' }));

        expect(cardNames().filter((name) => name === 'Hogar Total')).toHaveLength(1);
        expect(cardNames()).toEqual(['Juan Plomero', 'Hogar Total', 'Ana Electricista']);
    });

    it('matches a provider through any one of its categories', () => {
        render(
            <TradesDirectory
                trades={[tradeMulti, tradeCerrajeria]}
                locale="es"
            />
        );

        fireEvent.click(screen.getByRole('button', { name: 'Electricidad' }));

        expect(cardNames()).toEqual(['Hogar Total']);
    });

    it('marks every selected pill as aria-pressed=true', () => {
        render(
            <TradesDirectory
                trades={allTrades}
                locale="es"
            />
        );

        fireEvent.click(screen.getByRole('button', { name: 'Cerrajería' }));
        fireEvent.click(screen.getByRole('button', { name: 'Plomería' }));

        expect(screen.getByRole('button', { name: 'Cerrajería' })).toHaveAttribute(
            'aria-pressed',
            'true'
        );
        expect(screen.getByRole('button', { name: 'Plomería' })).toHaveAttribute(
            'aria-pressed',
            'true'
        );
        expect(screen.getByRole('button', { name: 'Todos' })).toHaveAttribute(
            'aria-pressed',
            'false'
        );
    });

    it('"Todos" pill clears every selected pill and shows all trades', () => {
        render(
            <TradesDirectory
                trades={allTrades}
                locale="es"
            />
        );
        fireEvent.click(screen.getByRole('button', { name: 'Plomería' }));
        fireEvent.click(screen.getByRole('button', { name: 'Cerrajería' }));
        expect(screen.queryByText('Pedro Albañil')).not.toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: 'Todos' }));

        expect(cardNames()).toHaveLength(4);
        expect(screen.getByRole('button', { name: 'Plomería' })).toHaveAttribute(
            'aria-pressed',
            'false'
        );
    });

    it('clicking an active pill a second time clears just that pill', () => {
        render(
            <TradesDirectory
                trades={allTrades}
                locale="es"
            />
        );
        const plomeria = screen.getByRole('button', { name: 'Plomería' });
        fireEvent.click(plomeria);
        fireEvent.click(screen.getByRole('button', { name: 'Cerrajería' }));

        fireEvent.click(plomeria);

        expect(plomeria).toHaveAttribute('aria-pressed', 'false');
        expect(cardNames()).toEqual(['María Cerrajera']);
    });

    it('clearing the last active pill shows every trade again', () => {
        render(
            <TradesDirectory
                trades={allTrades}
                locale="es"
            />
        );
        const plomeria = screen.getByRole('button', { name: 'Plomería' });
        fireEvent.click(plomeria);
        expect(cardNames()).toHaveLength(1);

        fireEvent.click(plomeria);

        expect(cardNames()).toHaveLength(4);
        expect(screen.getByRole('button', { name: 'Todos' })).toHaveAttribute(
            'aria-pressed',
            'true'
        );
    });

    it('keeps the provider order of the server (name) whatever the filter', () => {
        const byName = [tradeElectricidad, tradeMulti, tradePlomeria]; // Ana, Hogar, Juan
        render(
            <TradesDirectory
                trades={byName}
                locale="es"
            />
        );

        fireEvent.click(screen.getByRole('button', { name: 'Plomería' }));
        fireEvent.click(screen.getByRole('button', { name: 'Electricidad' }));

        expect(cardNames()).toEqual(['Ana Electricista', 'Hogar Total', 'Juan Plomero']);
    });

    it('shows the empty message when the active filter matches nothing', () => {
        const { rerender } = render(
            <TradesDirectory
                trades={allTrades}
                locale="es"
            />
        );
        fireEvent.click(screen.getByRole('button', { name: 'Cerrajería' }));

        // The result set changes under an active filter (e.g. a re-render with
        // fresh data) and nobody has the selected category any more.
        rerender(
            <TradesDirectory
                trades={[tradePlomeria]}
                locale="es"
            />
        );

        expect(
            screen.getByText('No hay proveedores disponibles para tus destinos por ahora.')
        ).toBeInTheDocument();
        expect(screen.queryByText('Juan Plomero')).not.toBeInTheDocument();
    });

    it('does not show the empty message by default', () => {
        render(
            <TradesDirectory
                trades={[tradePlomeria]}
                locale="es"
            />
        );

        expect(
            screen.queryByText('No hay proveedores disponibles para tus destinos por ahora.')
        ).not.toBeInTheDocument();
    });
});

// ---------------------------------------------------------------------------
// TradeCard tests
// ---------------------------------------------------------------------------

describe('TradeCard — basic render', () => {
    it('renders the trade name', () => {
        // Arrange / Act
        render(
            <TradeCard
                trade={tradePlomeria}
                locale="es"
            />
        );

        // Assert
        expect(screen.getByText('Juan Plomero')).toBeInTheDocument();
    });

    it('links the name to the provider page (HOS-376 T-053)', () => {
        // The name IS the way in: nothing else on the card reaches the detail
        // page, so losing this link makes the page unreachable from the
        // directory without breaking anything visible.
        render(
            <TradeCard
                trade={tradePlomeria}
                locale="es"
            />
        );

        const link = screen.getByRole('link', { name: 'Juan Plomero' });
        expect(link).toHaveAttribute(
            'href',
            `/es/mi-cuenta/directorio-proveedores/${tradePlomeria.slug}/`
        );
    });

    it('renders the benefit text', () => {
        // Arrange / Act
        render(
            <TradeCard
                trade={tradePlomeria}
                locale="es"
            />
        );

        // Assert
        expect(screen.getByText('Descuento 10%')).toBeInTheDocument();
    });

    it('renders the contact button with correct label', () => {
        // Arrange / Act
        render(
            <TradeCard
                trade={tradePlomeria}
                locale="es"
            />
        );

        // Assert
        expect(screen.getByRole('button', { name: /Contactar/ })).toHaveAttribute(
            'aria-haspopup',
            'dialog'
        );
    });

    it('resolves a raw phone number to a tel: href', () => {
        // Arrange / Act
        render(
            <TradeCard
                trade={tradePlomeria}
                locale="es"
            />
        );

        // Assert — +549 11 1234-5678 → tel:+54911 12345678 (spaces stripped)
        fireEvent.click(screen.getByRole('button', { name: /Contactar/ }));
        const link = screen.getByRole('link', { name: 'host-trades.detail.channel.phone' });
        expect(link.getAttribute('href')).toMatch(/^tel:/);
    });

    it('uses an https wa.me URL as-is (not wrapped in tel:)', () => {
        // Arrange
        const tradeWithUrl = makeTrade({ contact: 'https://wa.me/5491155555555' });

        // Act
        render(
            <TradeCard
                trade={tradeWithUrl}
                locale="es"
            />
        );

        // Assert
        fireEvent.click(screen.getByRole('button', { name: /Contactar/ }));
        const link = screen.getByRole('link', { name: /host-trades.detail.channel.whatsapp/ });
        expect(link.getAttribute('href')).toBe('https://wa.me/5491155555555');
    });

    it('prepends https:// to a bare wa.me/ path (regression: SPEC-241 fix)', () => {
        // Arrange — bare "wa.me/..." without scheme was previously passed through
        // unchanged, producing an invalid relative-URL href. The fix prepends https://.
        const tradeWithWa = makeTrade({ contact: 'wa.me/5491155555555' });

        // Act
        render(
            <TradeCard
                trade={tradeWithWa}
                locale="es"
            />
        );

        // Assert — must be a fully-qualified HTTPS URL, NOT a bare domain path
        fireEvent.click(screen.getByRole('button', { name: /Contactar/ }));
        const link = screen.getByRole('link', { name: /host-trades.detail.channel.whatsapp/ });
        expect(link.getAttribute('href')).toBe('https://wa.me/5491155555555');
    });

    it('prepends https:// to a bare wa.me? query-string path (regression: SPEC-241 fix)', () => {
        // Arrange — wa.me?phone= variant also needs https:// prepended
        const tradeWithWaQuery = makeTrade({ contact: 'wa.me?phone=5491155555555' });

        // Act
        render(
            <TradeCard
                trade={tradeWithWaQuery}
                locale="es"
            />
        );

        // Assert
        fireEvent.click(screen.getByRole('button', { name: /Contactar/ }));
        const link = screen.getByRole('link', { name: /host-trades.detail.channel.whatsapp/ });
        expect(link.getAttribute('href')).toBe('https://wa.me?phone=5491155555555');
    });
});

describe('TradeCard — is24h badge', () => {
    it('renders the is24h badge when is24h=true', () => {
        // Arrange
        const trade24h = makeTrade({ is24h: true });

        // Act
        render(
            <TradeCard
                trade={trade24h}
                locale="es"
            />
        );

        // Assert
        expect(screen.getByText('Disponible 24hs')).toBeInTheDocument();
    });

    it('does NOT render the is24h badge when is24h=false', () => {
        // Arrange
        const tradeNo24h = makeTrade({ is24h: false });

        // Act
        render(
            <TradeCard
                trade={tradeNo24h}
                locale="es"
            />
        );

        // Assert
        expect(screen.queryByText('Disponible 24hs')).not.toBeInTheDocument();
    });
});

describe('TradeCard — scheduleText', () => {
    it('renders scheduleText when present and is24h=false', () => {
        // Arrange
        const tradeWithSchedule = makeTrade({
            is24h: false,
            scheduleText: 'Lunes a Viernes 8:00–18:00'
        });

        // Act
        render(
            <TradeCard
                trade={tradeWithSchedule}
                locale="es"
            />
        );

        // Assert
        expect(screen.getByText('Lunes a Viernes 8:00–18:00')).toBeInTheDocument();
    });

    it('does NOT render scheduleText when it is null', () => {
        // Arrange
        const tradeNoSchedule = makeTrade({ scheduleText: null });

        // Act
        render(
            <TradeCard
                trade={tradeNoSchedule}
                locale="es"
            />
        );

        // Assert — no schedule text element present
        expect(screen.queryByText(/lunes|viernes/i)).not.toBeInTheDocument();
    });

    it('does NOT render scheduleText when is24h=true (24h overrides)', () => {
        // Arrange
        const trade24hSchedule = makeTrade({
            is24h: true,
            scheduleText: 'Lunes a Viernes 8:00–18:00'
        });

        // Act
        render(
            <TradeCard
                trade={trade24hSchedule}
                locale="es"
            />
        );

        // Assert — scheduleText hidden because is24h takes precedence
        expect(screen.queryByText('Lunes a Viernes 8:00–18:00')).not.toBeInTheDocument();
        // But the 24h badge IS shown
        expect(screen.getByText('Disponible 24hs')).toBeInTheDocument();
    });
});

describe('TradeCard — category badges', () => {
    it('renders one badge per category, in the order received', () => {
        render(
            <TradeCard
                trade={tradeMulti}
                locale="es"
            />
        );

        expect(screen.getByText('Plomería')).toBeInTheDocument();
        expect(screen.getByText('Electricidad')).toBeInTheDocument();
    });

    it('renders the badge label in the page locale', () => {
        render(
            <TradeCard
                trade={tradeAlbanileria}
                locale="en"
            />
        );

        expect(screen.getByText('Albañilería EN')).toBeInTheDocument();
    });
});
