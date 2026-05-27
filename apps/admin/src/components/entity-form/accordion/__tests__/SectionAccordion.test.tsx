import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { SectionAccordion, SectionAccordionItem } from '../SectionAccordion';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Renders a SectionAccordion with two items for reuse across tests.
 */
function renderTwoSections({
    generalDefaultCollapsed = false,
    galleryDefaultCollapsed = true,
    generalSummary = 'Hotel Plaza · Hotel',
    gallerySummary = '8 fotos',
    defaultOpenIds
}: {
    generalDefaultCollapsed?: boolean;
    galleryDefaultCollapsed?: boolean;
    generalSummary?: string;
    gallerySummary?: string;
    defaultOpenIds?: string[];
} = {}) {
    return render(
        <SectionAccordion defaultOpenIds={defaultOpenIds}>
            <SectionAccordionItem
                id="general"
                title="Datos principales"
                collapsedSummary={generalSummary}
                defaultCollapsed={generalDefaultCollapsed}
            >
                <p>General content</p>
            </SectionAccordionItem>

            <SectionAccordionItem
                id="gallery"
                title="Galería"
                collapsedSummary={gallerySummary}
                defaultCollapsed={galleryDefaultCollapsed}
            >
                <p>Gallery content</p>
            </SectionAccordionItem>
        </SectionAccordion>
    );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('SectionAccordion', () => {
    // ---- Default state ----

    it('renders the container', () => {
        renderTwoSections();
        expect(screen.getByTestId('section-accordion')).toBeInTheDocument();
    });

    it('renders section headers regardless of open/collapsed state', () => {
        renderTwoSections();
        expect(screen.getByTestId('accordion-header-general')).toBeInTheDocument();
        expect(screen.getByTestId('accordion-header-gallery')).toBeInTheDocument();
    });

    it('opens sections that have defaultCollapsed=false and closes ones that are defaultCollapsed=true', () => {
        renderTwoSections({
            generalDefaultCollapsed: false,
            galleryDefaultCollapsed: true
        });

        // "general" is open → panel visible, summary hidden
        expect(screen.getByTestId('accordion-panel-general')).toBeInTheDocument();
        expect(screen.queryByTestId('accordion-summary-general')).not.toBeInTheDocument();

        // "gallery" is collapsed → panel hidden, summary visible
        expect(screen.queryByTestId('accordion-panel-gallery')).not.toBeInTheDocument();
        expect(screen.getByTestId('accordion-summary-gallery')).toBeInTheDocument();
    });

    it('shows the collapsed summary text when the section is closed', () => {
        renderTwoSections({ galleryDefaultCollapsed: true, gallerySummary: '8 fotos' });

        const summary = screen.getByTestId('accordion-summary-gallery');
        expect(summary).toHaveTextContent('8 fotos');
    });

    it('does NOT show the summary when the section is open', () => {
        renderTwoSections({ generalDefaultCollapsed: false, generalSummary: 'Hotel Plaza' });

        expect(screen.queryByTestId('accordion-summary-general')).not.toBeInTheDocument();
    });

    // ---- Toggle interaction ----

    it('opens a collapsed section when its header is clicked', async () => {
        const user = userEvent.setup();
        renderTwoSections({ galleryDefaultCollapsed: true });

        const galleryHeader = screen.getByTestId('accordion-header-gallery');
        await user.click(galleryHeader);

        expect(screen.getByTestId('accordion-panel-gallery')).toBeInTheDocument();
    });

    it('hides the summary once a collapsed section is toggled open', async () => {
        const user = userEvent.setup();
        renderTwoSections({ galleryDefaultCollapsed: true, gallerySummary: '8 fotos' });

        // Summary is visible before click
        expect(screen.getByTestId('accordion-summary-gallery')).toBeInTheDocument();

        await user.click(screen.getByTestId('accordion-header-gallery'));

        // Summary disappears once open
        expect(screen.queryByTestId('accordion-summary-gallery')).not.toBeInTheDocument();
    });

    it('collapses an open section when its header is clicked', async () => {
        const user = userEvent.setup();
        renderTwoSections({ generalDefaultCollapsed: false });

        const generalHeader = screen.getByTestId('accordion-header-general');

        // Panel visible initially
        expect(screen.getByTestId('accordion-panel-general')).toBeInTheDocument();

        await user.click(generalHeader);

        // Panel hidden after click
        expect(screen.queryByTestId('accordion-panel-general')).not.toBeInTheDocument();
    });

    // ---- Multiple sections open at once ----

    it('allows multiple sections to be open simultaneously', async () => {
        const user = userEvent.setup();
        renderTwoSections({
            generalDefaultCollapsed: false,
            galleryDefaultCollapsed: true
        });

        // Open gallery while general is already open
        await user.click(screen.getByTestId('accordion-header-gallery'));

        expect(screen.getByTestId('accordion-panel-general')).toBeInTheDocument();
        expect(screen.getByTestId('accordion-panel-gallery')).toBeInTheDocument();
    });

    // ---- Accessibility ----

    it('sets aria-expanded=true on the header button when open', () => {
        renderTwoSections({ generalDefaultCollapsed: false });

        const header = screen.getByTestId('accordion-header-general');
        expect(header).toHaveAttribute('aria-expanded', 'true');
    });

    it('sets aria-expanded=false on the header button when collapsed', () => {
        renderTwoSections({ galleryDefaultCollapsed: true });

        const header = screen.getByTestId('accordion-header-gallery');
        expect(header).toHaveAttribute('aria-expanded', 'false');
    });

    it('links the header to the panel via aria-controls / id', () => {
        renderTwoSections({ generalDefaultCollapsed: false });

        const header = screen.getByTestId('accordion-header-general');
        const panel = screen.getByTestId('accordion-panel-general');

        expect(header).toHaveAttribute('aria-controls', panel.id);
    });

    it('toggles open state via keyboard Enter', async () => {
        const user = userEvent.setup();
        renderTwoSections({ galleryDefaultCollapsed: true });

        const galleryHeader = screen.getByTestId('accordion-header-gallery');
        galleryHeader.focus();
        await user.keyboard('{Enter}');

        expect(screen.getByTestId('accordion-panel-gallery')).toBeInTheDocument();
    });

    it('toggles open state via keyboard Space', async () => {
        const user = userEvent.setup();
        renderTwoSections({ galleryDefaultCollapsed: true });

        const galleryHeader = screen.getByTestId('accordion-header-gallery');
        galleryHeader.focus();
        await user.keyboard(' ');

        expect(screen.getByTestId('accordion-panel-gallery')).toBeInTheDocument();
    });

    // ---- Icon / badge slots ----

    it('renders the optional icon slot', () => {
        render(
            <SectionAccordion>
                <SectionAccordionItem
                    id="with-icon"
                    title="Con ícono"
                    icon={<span data-testid="custom-icon" />}
                >
                    content
                </SectionAccordionItem>
            </SectionAccordion>
        );

        expect(screen.getByTestId('custom-icon')).toBeInTheDocument();
    });

    it('renders the optional badge slot', () => {
        render(
            <SectionAccordion>
                <SectionAccordionItem
                    id="with-badge"
                    title="Con badge"
                    badge={<span data-testid="status-badge">Publicado</span>}
                >
                    content
                </SectionAccordionItem>
            </SectionAccordion>
        );

        expect(screen.getByTestId('status-badge')).toBeInTheDocument();
        expect(screen.getByTestId('status-badge')).toHaveTextContent('Publicado');
    });

    // ---- defaultOpenIds override ----

    it('respects defaultOpenIds to pre-open a section marked defaultCollapsed', () => {
        // gallery is defaultCollapsed=true but its id is in defaultOpenIds
        renderTwoSections({
            galleryDefaultCollapsed: true,
            defaultOpenIds: ['gallery']
        });

        expect(screen.getByTestId('accordion-panel-gallery')).toBeInTheDocument();
    });

    // ---- Body content ----

    it('renders children inside the open panel', () => {
        renderTwoSections({ generalDefaultCollapsed: false });

        expect(screen.getByText('General content')).toBeInTheDocument();
    });

    it('does NOT render children when section is collapsed (unmounted)', () => {
        renderTwoSections({ galleryDefaultCollapsed: true });

        expect(screen.queryByText('Gallery content')).not.toBeInTheDocument();
    });
});
