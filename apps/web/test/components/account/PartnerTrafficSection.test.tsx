/**
 * @file PartnerTrafficSection.test.tsx
 * @description Tests for the partner traffic section (HOS-2119 T-054): the
 * island owns the window selector and feeds {@link TrafficStatsCards}; the
 * page mounts it beneath `PartnerStatsSection`, only for a partner whose
 * views card applies (own page), with `client:visible`.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { PartnerTrafficSection } from '../../../src/components/account/PartnerTrafficSection.client';

vi.mock('../../../src/lib/i18n', () => ({
    createTranslations: (_locale: string) => ({
        t: (_key: string, fallback?: string) => fallback ?? _key
    })
}));

vi.mock('../../../src/components/account/PartnerTrafficSection.module.css', () => ({
    default: new Proxy({} as Record<string, string>, { get: (_t, prop) => String(prop) })
}));

vi.mock('../../../src/components/listing/TrafficStatsCards.client', () => ({
    TrafficStatsCards: (props: { entityType: string; entityId: string; window: string }) => (
        <div
            data-testid="traffic-stub"
            data-entity-type={props.entityType}
            data-entity-id={props.entityId}
            data-window={props.window}
        />
    )
}));

const PAGE_SOURCE = readFileSync(
    resolve(__dirname, '../../../src/pages/[lang]/mi-cuenta/aliados/index.astro'),
    'utf8'
);

describe('PartnerTrafficSection (HOS-2119)', () => {
    it('renders an h2 and mounts the cards for the partner with entityType PARTNER', () => {
        render(
            <PartnerTrafficSection
                locale="es"
                partnerId="partner-1"
            />
        );

        expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('Tráfico de tu página');
        const stub = screen.getByTestId('traffic-stub');
        expect(stub).toHaveAttribute('data-entity-type', 'PARTNER');
        expect(stub).toHaveAttribute('data-entity-id', 'partner-1');
        expect(stub).toHaveAttribute('data-window', '30d');
    });

    it('offers 7d, 30d and 90d and propagates the chosen window to the cards', () => {
        render(
            <PartnerTrafficSection
                locale="es"
                partnerId="partner-1"
            />
        );

        expect(screen.getByRole('group')).toBeTruthy();
        expect(screen.getByText('7 días')).toBeTruthy();
        expect(screen.getByText('30 días')).toBeTruthy();

        fireEvent.click(screen.getByText('90 días'));
        expect(screen.getByTestId('traffic-stub')).toHaveAttribute('data-window', '90d');
        expect(screen.getByText('90 días')).toHaveAttribute('aria-pressed', 'true');

        fireEvent.click(screen.getByText('7 días'));
        expect(screen.getByTestId('traffic-stub')).toHaveAttribute('data-window', '7d');
    });

    describe('page wiring', () => {
        it('mounts the island with client:visible, gated on resolvePartnerTrafficId', () => {
            expect(PAGE_SOURCE).toContain('resolvePartnerTrafficId({ stats: myStats30, locale })');
            expect(PAGE_SOURCE).toMatch(
                /\{trafficPartnerId !== null && \(\s*<PartnerTrafficSection client:visible/
            );
        });

        it('mounts it beneath PartnerStatsSection', () => {
            const stats = PAGE_SOURCE.indexOf('<PartnerStatsSection');
            const traffic = PAGE_SOURCE.indexOf('<PartnerTrafficSection ');
            const mentions = PAGE_SOURCE.indexOf('<PartnerMentionsSection');
            expect(stats).toBeGreaterThan(-1);
            expect(traffic).toBeGreaterThan(stats);
            expect(traffic).toBeLessThan(mentions);
        });
    });
});
