/**
 * Tests for the editor shell kit pieces: EditorSectionNav, EditorSwitcher and
 * CompletenessMeter (HOS-2486, HOS-2499, spec HOS-2415 §6.1).
 */

import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import {
    CompletenessMeter,
    EditorSectionNav,
    EditorSwitcher
} from '../../../../src/components/account/ui';
import type { EditorNavGroup } from '../../../../src/lib/editor/editor-route-nav-model';
import { buildEditorSwitcherModel } from '../../../../src/lib/editor/editor-switcher-model';

const GROUPS: readonly EditorNavGroup[] = [
    {
        group: 'property',
        headingKey: 'host.properties.editor.group.property',
        links: [
            {
                sectionId: 'basicInfo',
                href: '/es/a/datos/',
                labelKey: 'host.properties.editor.section.basicInfo',
                isActive: false,
                status: 'complete'
            },
            {
                sectionId: 'location',
                href: '/es/a/ubicacion/',
                labelKey: 'host.properties.editor.section.location',
                isActive: true,
                status: 'incomplete'
            }
        ]
    },
    {
        group: 'content',
        headingKey: 'host.properties.editor.group.content',
        links: [
            {
                sectionId: 'photos',
                href: '/es/a/fotos/',
                labelKey: 'host.properties.editor.section.photos',
                isActive: false,
                status: 'locked'
            }
        ]
    }
];

describe('EditorSectionNav', () => {
    it('renders a labelled nav with real links and marks the current one', () => {
        // Act
        render(
            <EditorSectionNav
                groups={GROUPS}
                locale="es"
            />
        );
        const nav = screen.getByRole('navigation', { name: 'Secciones de la ficha' });

        // Assert
        const links = within(nav).getAllByRole('link');
        expect(links).toHaveLength(3);
        expect(links.map((link) => link.getAttribute('href'))).toEqual([
            '/es/a/datos/',
            '/es/a/ubicacion/',
            '/es/a/fotos/'
        ]);
        expect(within(nav).getByRole('link', { current: 'page' })).toHaveAttribute(
            'href',
            '/es/a/ubicacion/'
        );
    });

    it('writes each known status as a word, not only as color', () => {
        render(
            <EditorSectionNav
                groups={GROUPS}
                locale="es"
            />
        );

        expect(screen.getByText('Completa')).toBeInTheDocument();
        expect(screen.getByText('Incompleta')).toBeInTheDocument();
        expect(screen.getByText('Bloqueada por tu plan')).toBeInTheDocument();
    });

    it('translates its landmark in en and pt', () => {
        const { unmount } = render(
            <EditorSectionNav
                groups={GROUPS}
                locale="en"
            />
        );
        expect(screen.getByRole('navigation', { name: 'Listing sections' })).toBeInTheDocument();
        unmount();

        render(
            <EditorSectionNav
                groups={GROUPS}
                locale="pt"
            />
        );
        expect(screen.getByRole('navigation', { name: 'Seções do anúncio' })).toBeInTheDocument();
    });
});

describe('EditorSwitcher', () => {
    it('offers previous and next as real links named after their section', () => {
        // Arrange
        const model = buildEditorSwitcherModel({ groups: GROUPS });

        // Act
        render(
            <EditorSwitcher
                model={model}
                entityName="Casa del Río"
                locale="es"
            />
        );
        const nav = screen.getByRole('navigation', { name: 'Cambiar de sección' });

        // Assert
        expect(within(nav).getByRole('link', { name: /Sección anterior/ })).toHaveAttribute(
            'href',
            '/es/a/datos/'
        );
        expect(within(nav).getByRole('link', { name: /Sección siguiente/ })).toHaveAttribute(
            'href',
            '/es/a/fotos/'
        );
    });

    it('shows the listing, the section and n/N in the menu summary', () => {
        const model = buildEditorSwitcherModel({ groups: GROUPS });

        const { container } = render(
            <EditorSwitcher
                model={model}
                entityName="Casa del Río"
                locale="es"
            />
        );
        const summary = container.querySelector('summary');

        expect(summary).toHaveTextContent('Casa del Río');
        expect(summary).toHaveTextContent('2/3');
        expect(summary).toHaveTextContent('Sección 2 de 3');
    });

    it('lists every section in a native details menu, as links', () => {
        const model = buildEditorSwitcherModel({ groups: GROUPS });

        const { container } = render(
            <EditorSwitcher
                model={model}
                entityName="Casa del Río"
                locale="es"
            />
        );
        const details = container.querySelector('details');

        expect(details).not.toBeNull();
        expect(details?.querySelectorAll('a[href]')).toHaveLength(3);
        expect(details?.querySelector('a[aria-current="page"]')).toHaveAttribute(
            'href',
            '/es/a/ubicacion/'
        );
    });

    it('renders an inert step, not a link, at either end', () => {
        const firstActive = GROUPS.map((group) => ({
            ...group,
            links: group.links.map((link) => ({
                ...link,
                isActive: link.sectionId === 'basicInfo'
            }))
        }));
        const model = buildEditorSwitcherModel({ groups: firstActive });

        render(
            <EditorSwitcher
                model={model}
                entityName="Casa del Río"
                locale="es"
            />
        );

        expect(screen.queryByRole('link', { name: /Sección anterior/ })).toBeNull();
        expect(screen.getByRole('link', { name: /Sección siguiente/ })).toBeInTheDocument();
    });
});

describe('CompletenessMeter', () => {
    it('writes the count and links each missing section', () => {
        // Act
        render(
            <CompletenessMeter
                done={1}
                total={3}
                missing={[
                    { id: 'photos', label: 'Fotos', href: '/es/a/fotos/' },
                    { id: 'contact', label: 'Contacto' }
                ]}
                locale="es"
            />
        );

        // Assert
        expect(screen.getByText('1 de 3 secciones completas')).toBeInTheDocument();
        expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '1');
        expect(screen.getByRole('link', { name: 'Fotos' })).toHaveAttribute('href', '/es/a/fotos/');
        expect(screen.queryByRole('link', { name: 'Contacto' })).toBeNull();
        expect(screen.getByText('Contacto')).toBeInTheDocument();
    });

    it('says the listing is complete when nothing is missing', () => {
        const { container } = render(
            <CompletenessMeter
                done={3}
                total={3}
                missing={[]}
                locale="en"
            />
        );

        expect(
            screen.getByText('Your listing has everything it needs to be published.')
        ).toBeInTheDocument();
        expect(container.querySelectorAll('[data-filled="true"]')).toHaveLength(3);
    });

    it('fills one segment per complete section, with no inline style', () => {
        const { container } = render(
            <CompletenessMeter
                done={2}
                total={5}
                missing={[]}
                locale="pt"
            />
        );

        expect(container.querySelectorAll('[data-filled]')).toHaveLength(5);
        expect(container.querySelectorAll('[data-filled="true"]')).toHaveLength(2);
        expect(container.querySelector('[style]')).toBeNull();
    });
});
