/**
 * @file EditorSectionNav.test.tsx
 * @description Tests for the accommodation editor's sticky scrollspy nav (BETA-138).
 *
 * Covers:
 * - Renders one link per section, in order
 * - Clicking a link marks it as the active (aria-current) section
 * - The IntersectionObserver callback updates the active section as it scrolls
 */

import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { EditorSectionNavItem } from '@/components/host/editor/EditorSectionNav.client';
import { EditorSectionNav } from '@/components/host/editor/EditorSectionNav.client';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('@/lib/i18n', () => ({
    createTranslations: (_locale: string) => ({
        t: (_key: string, fallback?: string) => fallback ?? _key
    })
}));

const SECTIONS: readonly EditorSectionNavItem[] = [
    { id: 'editor-basicInfo', label: 'Información básica' },
    { id: 'editor-capacity', label: 'Capacidad' },
    { id: 'editor-pricing', label: 'Precio' }
];

// ---------------------------------------------------------------------------
// Test-local IntersectionObserver mock
// ---------------------------------------------------------------------------

let capturedCallback: IntersectionObserverCallback | null = null;

class CapturingIntersectionObserver implements IntersectionObserver {
    readonly root: Element | null = null;
    readonly rootMargin: string = '';
    readonly thresholds: ReadonlyArray<number> = [];

    constructor(callback: IntersectionObserverCallback) {
        capturedCallback = callback;
    }

    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
    takeRecords(): IntersectionObserverEntry[] {
        return [];
    }
}

describe('EditorSectionNav', () => {
    beforeEach(() => {
        vi.stubGlobal('IntersectionObserver', CapturingIntersectionObserver);
        // jsdom does not implement scrollIntoView.
        Element.prototype.scrollIntoView = vi.fn();

        for (const section of SECTIONS) {
            const el = document.createElement('section');
            el.id = section.id;
            document.body.appendChild(el);
        }
    });

    afterEach(() => {
        vi.unstubAllGlobals();
        document.body.innerHTML = '';
        capturedCallback = null;
    });

    it('should render one link per section, in order', () => {
        render(
            <EditorSectionNav
                locale="es"
                sections={SECTIONS}
            />
        );

        const links = screen.getAllByRole('link');
        expect(links).toHaveLength(SECTIONS.length);
        expect(links.map((link) => link.textContent)).toEqual(SECTIONS.map((s) => s.label));
        for (const [index, section] of SECTIONS.entries()) {
            expect(links[index]).toHaveAttribute('href', `#${section.id}`);
        }
    });

    it('should mark the clicked link as active with aria-current', () => {
        render(
            <EditorSectionNav
                locale="es"
                sections={SECTIONS}
            />
        );

        const link = screen.getByRole('link', { name: 'Capacidad' });
        expect(link).not.toHaveAttribute('aria-current');

        fireEvent.click(link);

        expect(link).toHaveAttribute('aria-current', 'true');
        expect(screen.getByRole('link', { name: 'Precio' })).not.toHaveAttribute('aria-current');
    });

    it('should update the active section when IntersectionObserver reports it visible', () => {
        render(
            <EditorSectionNav
                locale="es"
                sections={SECTIONS}
            />
        );

        expect(capturedCallback).not.toBeNull();

        const pricingSection = document.getElementById('editor-pricing');
        expect(pricingSection).not.toBeNull();

        act(() => {
            capturedCallback?.(
                [
                    {
                        isIntersecting: true,
                        target: pricingSection as Element
                    } as IntersectionObserverEntry
                ],
                {} as IntersectionObserver
            );
        });

        expect(screen.getByRole('link', { name: 'Precio' })).toHaveAttribute(
            'aria-current',
            'true'
        );
        expect(screen.getByRole('link', { name: 'Información básica' })).not.toHaveAttribute(
            'aria-current'
        );
    });
});
