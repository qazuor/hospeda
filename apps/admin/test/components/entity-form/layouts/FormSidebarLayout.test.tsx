/**
 * Tests for FormSidebarLayout — the responsive shell that wraps multi-section
 * entity forms (CREATE + EDIT pages). Verifies the mobile accordion + desktop
 * sidebar dual rendering that fixes SPEC-135 F-020 (BLOCKER).
 */

import { FormSidebarLayout } from '@/components/entity-form/layouts/FormSidebarLayout';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@repo/i18n', () => ({
    useTranslations: () => ({
        t: (key: string) => key
    })
}));

describe('FormSidebarLayout', () => {
    const sidebar = <nav data-testid="nav-content">Section navigation</nav>;
    const children = <div data-testid="form-content">Form fields</div>;

    it('renders the form content area with children', () => {
        render(<FormSidebarLayout sidebar={sidebar}>{children}</FormSidebarLayout>);

        expect(screen.getByTestId('form-content')).toBeInTheDocument();
    });

    it('renders the sidebar twice (mobile accordion + desktop column)', () => {
        // The desktop column hides on mobile via Tailwind (`hidden lg:block`)
        // and the accordion hides on desktop (`lg:hidden`). Both render in the
        // DOM so CSS picks the right one — there are two copies of the
        // sidebar content as a result.
        render(<FormSidebarLayout sidebar={sidebar}>{children}</FormSidebarLayout>);

        expect(screen.getAllByTestId('nav-content')).toHaveLength(2);
    });

    it('exposes the mobile accordion as a <details> element', () => {
        render(<FormSidebarLayout sidebar={sidebar}>{children}</FormSidebarLayout>);

        const accordion = screen.getByTestId('form-sidebar-mobile-accordion');
        expect(accordion.tagName.toLowerCase()).toBe('details');
        // <details> without `open` attribute starts collapsed.
        expect(accordion).not.toHaveAttribute('open');
    });

    it('opens the mobile accordion by default when defaultMobileOpen is true', () => {
        render(
            <FormSidebarLayout
                sidebar={sidebar}
                defaultMobileOpen
            >
                {children}
            </FormSidebarLayout>
        );

        const accordion = screen.getByTestId('form-sidebar-mobile-accordion');
        expect(accordion).toHaveAttribute('open');
    });

    it('hides the desktop sidebar below lg via tailwind utility classes', () => {
        // Tailwind cannot be evaluated in jsdom, so we assert on the classes
        // instead of the computed styles. The acceptance test on a real
        // browser viewport runs in the manual smoke checklist.
        render(<FormSidebarLayout sidebar={sidebar}>{children}</FormSidebarLayout>);

        const desktop = screen.getByTestId('form-sidebar-desktop');
        expect(desktop.className).toContain('hidden');
        expect(desktop.className).toContain('lg:block');
        expect(desktop.className).toContain('w-80');
    });

    it('hides the mobile accordion at lg via tailwind utility classes', () => {
        render(<FormSidebarLayout sidebar={sidebar}>{children}</FormSidebarLayout>);

        const accordion = screen.getByTestId('form-sidebar-mobile-accordion');
        expect(accordion.className).toContain('lg:hidden');
    });

    it('stacks vertically on mobile and switches to row at lg', () => {
        const { container } = render(
            <FormSidebarLayout sidebar={sidebar}>{children}</FormSidebarLayout>
        );

        const wrapper = container.firstChild as HTMLElement;
        expect(wrapper.className).toContain('flex');
        expect(wrapper.className).toContain('flex-col');
        expect(wrapper.className).toContain('lg:flex-row');
    });

    it('forwards a custom className to the outer wrapper', () => {
        const { container } = render(
            <FormSidebarLayout
                sidebar={sidebar}
                className="my-custom-class"
            >
                {children}
            </FormSidebarLayout>
        );

        const wrapper = container.firstChild as HTMLElement;
        expect(wrapper.className).toContain('my-custom-class');
    });
});
