/**
 * Tests for AccommodationSubTabLayout — the shared header/tab wrapper for
 * accommodation sub-tab routes (amenities, pricing, reviews). Verifies
 * SPEC-135 F-023: deep-linking into a sub-tab now shows a breadcrumb and the
 * accommodation name so the operator never lands on an anonymous page.
 */

import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AccommodationSubTabLayout } from '@/features/accommodations/components/AccommodationSubTabLayout';
import { useEffectiveSetSubject } from '@/features/billing/effective-set-subject';

vi.mock('@/features/accommodations/hooks/useAccommodationQuery', () => ({
    useAccommodationQuery: () => ({
        data: { ownerId: '11111111-1111-4111-8111-111111111111' },
        isLoading: false
    })
}));

vi.mock('@/components/layout/Breadcrumbs', () => ({
    Breadcrumbs: ({ entityContext }: { entityContext?: { name?: string; type?: string } }) => (
        <nav
            data-testid="breadcrumbs"
            data-entity-name={entityContext?.name ?? ''}
            data-entity-type={entityContext?.type ?? ''}
        />
    )
}));

vi.mock('@/components/layout/PageTabs', () => ({
    PageTabs: ({ basePath }: { basePath: string }) => (
        <div
            data-testid="page-tabs"
            data-base-path={basePath}
        />
    ),
    accommodationTabs: []
}));

describe('AccommodationSubTabLayout', () => {
    const accommodationId = 'acc-123';

    it('renders the entity name as the page h1', () => {
        render(
            <AccommodationSubTabLayout
                accommodationId={accommodationId}
                entityName="Retiro Soleado"
            >
                <div>section content</div>
            </AccommodationSubTabLayout>
        );

        const heading = screen.getByRole('heading', { level: 1 });
        expect(heading.textContent).toBe('Retiro Soleado');
    });

    it('falls back to the accommodation id when entityName is missing', () => {
        render(
            <AccommodationSubTabLayout accommodationId={accommodationId}>
                <div>section content</div>
            </AccommodationSubTabLayout>
        );

        const heading = screen.getByRole('heading', { level: 1 });
        expect(heading.textContent).toBe(accommodationId);
    });

    it('falls back to the accommodation id when entityName is whitespace only', () => {
        render(
            <AccommodationSubTabLayout
                accommodationId={accommodationId}
                entityName="   "
            >
                <div>section content</div>
            </AccommodationSubTabLayout>
        );

        expect(screen.getByRole('heading', { level: 1 }).textContent).toBe(accommodationId);
    });

    it('passes the entity context to the breadcrumb', () => {
        render(
            <AccommodationSubTabLayout
                accommodationId={accommodationId}
                entityName="Cabaña del Río"
            >
                <div>section content</div>
            </AccommodationSubTabLayout>
        );

        const breadcrumbs = screen.getByTestId('breadcrumbs');
        expect(breadcrumbs).toHaveAttribute('data-entity-name', 'Cabaña del Río');
        expect(breadcrumbs).toHaveAttribute('data-entity-type', 'accommodation');
    });

    it('forwards the accommodationId to PageTabs basePath', () => {
        render(
            <AccommodationSubTabLayout
                accommodationId={accommodationId}
                entityName="Retiro Soleado"
            >
                <div>section content</div>
            </AccommodationSubTabLayout>
        );

        expect(screen.getByTestId('page-tabs')).toHaveAttribute(
            'data-base-path',
            `/accommodations/${accommodationId}`
        );
    });

    it('renders provided children below the tabs', () => {
        render(
            <AccommodationSubTabLayout
                accommodationId={accommodationId}
                entityName="Retiro Soleado"
            >
                <div data-testid="section-content">Amenities list</div>
            </AccommodationSubTabLayout>
        );

        expect(screen.getByTestId('section-content').textContent).toBe('Amenities list');
    });

    it('TEST:B13a:23 AC:B13a:23 binds the sub-tab gate to the accommodation owner', () => {
        function SubjectProbe() {
            const subject = useEffectiveSetSubject();
            return <span data-testid="subject">{`${subject?.userId}:${subject?.vertical}`}</span>;
        }
        render(
            <AccommodationSubTabLayout accommodationId={accommodationId}>
                <SubjectProbe />
            </AccommodationSubTabLayout>
        );
        expect(screen.getByTestId('subject')).toHaveTextContent(
            '11111111-1111-4111-8111-111111111111:accommodation'
        );
    });
});
