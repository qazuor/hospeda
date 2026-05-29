import { LayoutTypeEnum } from '@/components/entity-form/enums/form-config.enums';
import type { SectionConfig } from '@/components/entity-form/types/section-config.types';
import { EntityViewContent } from '@/components/entity-pages/EntityViewContent';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

// EntityViewSection pulls in a lot of i18n + table cells; stub it for the
// shell-level assertions. EntitlementGatedSection is irrelevant when no
// `entitlementKey` is set on the section.
vi.mock('@/components/entity-form', () => ({
    EntityViewSection: ({ config }: { config: { id?: string } }) => (
        <div data-testid={`view-section-${config.id ?? 'unknown'}`}>view-section-body</div>
    )
}));

vi.mock('@/components/entity-form/sections/EntitlementGatedSection', () => ({
    EntitlementGatedSection: ({ children }: { children: React.ReactNode }) => <>{children}</>
}));

// SectionAccordion's animation hooks aren't relevant; stub with a div that
// keeps children visible. The flat-mode branch doesn't touch this stub.
vi.mock('@/components/entity-form/accordion/SectionAccordion', () => ({
    SectionAccordion: ({ children }: { children: React.ReactNode }) => (
        <div data-testid="accordion-root">{children}</div>
    ),
    SectionAccordionItem: ({
        id,
        title,
        children
    }: {
        id: string;
        title: string;
        children: React.ReactNode;
    }) => (
        <div data-testid={`accordion-item-${id}`}>
            <div>{title}</div>
            <div>{children}</div>
        </div>
    )
}));

// `filterAndSortSections` reads `userPermissions` to filter sections. Bypass
// it with an identity that preserves order.
vi.mock('@/components/entity-pages/utils/section-sorter', () => ({
    filterAndSortSections: <T,>(sections: readonly T[]) => Array.from(sections)
}));

// Summarizer isn't used in flat mode but the accordion branch calls it.
vi.mock('@/components/entity-pages/utils/section-summarizer', () => ({
    computeSectionSummary: () => null
}));

function makeSection(id: string, title: string): SectionConfig {
    return {
        id,
        title,
        layout: LayoutTypeEnum.GRID,
        modes: ['view'],
        fields: []
    } as SectionConfig;
}

describe('EntityViewContent', () => {
    const sections: SectionConfig[] = [
        makeSection('basic-info', 'Datos básicos'),
        makeSection('flags', 'Banderas'),
        makeSection('states', 'Estados')
    ];

    describe('flat mode (SPEC-154 Phase 6)', () => {
        it('renders sections as standalone cards, no accordion root', () => {
            render(
                <EntityViewContent
                    entityType="amenity"
                    sections={sections}
                    entity={{ name: 'Pool' }}
                    userPermissions={[]}
                    flat
                />
            );

            expect(screen.queryByTestId('accordion-root')).not.toBeInTheDocument();
            expect(screen.getByTestId('view-section-basic-info')).toBeInTheDocument();
            expect(screen.getByTestId('view-section-flags')).toBeInTheDocument();
            expect(screen.getByTestId('view-section-states')).toBeInTheDocument();
        });

        it('renders each section title once in flat mode', () => {
            render(
                <EntityViewContent
                    entityType="amenity"
                    sections={sections}
                    entity={{ name: 'Pool' }}
                    userPermissions={[]}
                    flat
                />
            );

            // In flat mode the title comes from the CardTitle; in accordion
            // mode it would also live in the AccordionItem header. Either way
            // it should appear exactly once because we don't render an
            // accordion above the cards.
            expect(screen.getAllByText('Datos básicos')).toHaveLength(1);
            expect(screen.getAllByText('Banderas')).toHaveLength(1);
            expect(screen.getAllByText('Estados')).toHaveLength(1);
        });
    });

    describe('default (accordion) mode', () => {
        it('renders the accordion root and one accordion item per section', () => {
            render(
                <EntityViewContent
                    entityType="amenity"
                    sections={sections}
                    entity={{ name: 'Pool' }}
                    userPermissions={[]}
                />
            );

            expect(screen.getByTestId('accordion-root')).toBeInTheDocument();
            expect(screen.getByTestId('accordion-item-basic-info')).toBeInTheDocument();
            expect(screen.getByTestId('accordion-item-flags')).toBeInTheDocument();
            expect(screen.getByTestId('accordion-item-states')).toBeInTheDocument();
        });
    });
});
