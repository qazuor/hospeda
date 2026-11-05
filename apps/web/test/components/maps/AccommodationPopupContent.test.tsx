import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AccommodationPopupContent } from '../../../src/components/maps/ListingMapInner.client';

vi.mock('../../../src/components/maps/ListingMap.module.css', () => ({
    default: new Proxy({} as Record<string, string>, { get: (_target, prop) => String(prop) })
}));
vi.mock('../../../src/components/shared/favorite/FavoriteButton.client', () => ({
    FavoriteButton: () => null
}));

const baseItem = {
    id: 'acc-1',
    slug: 'casa-rio',
    name: 'Casa del Río',
    approximateLocation: { lat: -32, lng: -58, radiusMeters: 400 }
};

describe('AccommodationPopupContent', () => {
    it('renders localized price explanation and availability CTA in the same footer slots', () => {
        const { container } = render(
            <AccommodationPopupContent
                item={{ ...baseItem, detailHref: '/es/alojamientos/casa-rio/' }}
                priceConsultLabel="Precio a consultar"
                consultAvailabilityLabel="Consultar disponibilidad"
                viewDetailsLabel="Ver más"
                locale="es"
            />
        );

        expect(screen.getByText('Precio a consultar')).toBeInTheDocument();
        expect(screen.getByRole('link', { name: 'Consultar disponibilidad' })).toHaveAttribute(
            'href',
            '/es/alojamientos/casa-rio/'
        );
        expect(screen.getByRole('link', { name: 'Consultar disponibilidad' })).toHaveClass(
            'popupCtaCompact'
        );
        expect(container.querySelector('.popupFooter')?.children).toHaveLength(2);
    });

    it('keeps the priced popup label and details CTA in the same footer slots', () => {
        const { container } = render(
            <AccommodationPopupContent
                item={{
                    ...baseItem,
                    priceLabel: '$ 15.000',
                    detailHref: '/es/alojamientos/casa-rio/'
                }}
                priceConsultLabel="Precio a consultar"
                consultAvailabilityLabel="Consultar disponibilidad"
                viewDetailsLabel="Ver más"
                locale="es"
            />
        );

        expect(screen.getByText('$ 15.000')).toBeInTheDocument();
        expect(screen.getByRole('link', { name: 'Ver más' })).toBeInTheDocument();
        expect(screen.getByRole('link', { name: 'Ver más' })).not.toHaveClass('popupCtaCompact');
        expect(container.querySelector('.popupFooter')?.children).toHaveLength(2);
    });
});
