/**
 * Component tests for `Breadcrumbs` (HOS-1754).
 *
 * The module-level mock replaces the global `@tanstack/react-router` mock so
 * each test controls the current pathname and the router's route table.
 * `useTranslations` keeps the global mock, which returns the i18n key as-is,
 * so assertions target keys rather than Spanish copy.
 *
 * Covers:
 * - TEST:1754:2 — subscription cancellation/revocation pages only link to
 *   "home"; the current page and prefixes without a page render as text.
 * - TEST:1754:5 — registered ancestor routes keep their links.
 * - TEST:1754:6 — an absent or empty route table hides no links (fail-open).
 *
 * @see apps/admin/src/components/layout/Breadcrumbs.tsx
 */

import { render, screen, within } from '@testing-library/react';
import type { ComponentProps, ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Breadcrumbs } from '@/components/layout/Breadcrumbs';
import { adminLogger } from '@/utils/logger';

vi.mock('@/utils/logger', () => ({ adminLogger: { warn: vi.fn() } }));

vi.mock('@repo/icons', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@repo/icons')>()),
    BreadcrumbsIcon: (props: ComponentProps<'svg'>) => (
        <svg
            data-testid="icon-BreadcrumbsIcon"
            {...props}
        />
    )
}));

const routerState = vi.hoisted(() => ({
    pathname: { current: '/' as string },
    routesByPath: { current: undefined as Record<string, unknown> | undefined }
}));

vi.mock('@tanstack/react-router', () => ({
    useRouterState: () => ({
        location: {
            pathname: routerState.pathname.current,
            search: '',
            hash: ''
        }
    }),
    useRouter: () => ({ routesByPath: routerState.routesByPath.current }),
    Link: ({
        to,
        children,
        className,
        title
    }: {
        to: string;
        children: ReactNode;
        className?: string;
        title?: string;
    }) => (
        <a
            href={to}
            className={className}
            title={title}
        >
            {children}
        </a>
    )
}));

const SUBSCRIPTION_ID = '04c89660-09eb-40ec-8294-35a1c165192b';

const SUBSCRIPTION_ROUTES: Record<string, unknown> = {
    '/billing/exchange-rates': {},
    '/billing/subscriptions/$subscriptionId/cancellation': {},
    '/billing/subscriptions/$subscriptionId/revocation': {},
    '/access/users': {}
};

const linkHrefs = (): (string | null)[] =>
    screen.getAllByRole('link').map((link) => link.getAttribute('href'));

const expectTextWithoutLink = (text: string): void => {
    expect(screen.getByText(text).closest('a')).toBeNull();
};

describe('Breadcrumbs', () => {
    it('renders the registered permanent grants page as current text with its billing label', () => {
        routerState.pathname.current = '/billing/permanent-grants';
        routerState.routesByPath.current = { '/billing/permanent-grants': {} };
        render(<Breadcrumbs />);
        expectTextWithoutLink('admin-menu.billing.permanentGrants');
        expect(screen.getByText('admin-menu.billing.permanentGrants')).toHaveAttribute(
            'aria-current',
            'page'
        );
    });
    beforeEach(() => {
        routerState.pathname.current = '/';
        routerState.routesByPath.current = undefined;
    });

    it('links only home on the cancellation page', () => {
        routerState.pathname.current = `/billing/subscriptions/${SUBSCRIPTION_ID}/cancellation`;
        routerState.routesByPath.current = SUBSCRIPTION_ROUTES;

        render(<Breadcrumbs />);

        expect(linkHrefs()).toEqual(['/dashboard']);
        expect(screen.getByRole('link', { name: 'ui.navigation.home' })).toHaveAttribute(
            'href',
            '/dashboard'
        );
        expectTextWithoutLink('admin-menu.billing.subscriptionCancellation');

        expectTextWithoutLink('admin-menu.billing.title');
        expectTextWithoutLink('admin-menu.billing.subscriptions');
        expectTextWithoutLink('admin-menu.billing.subscription');

        expect(screen.queryByText(SUBSCRIPTION_ID)).toBeNull();
        expect(document.body.textContent).not.toContain(SUBSCRIPTION_ID);
    });

    it('links only home on the revocation page', () => {
        routerState.pathname.current = `/billing/subscriptions/${SUBSCRIPTION_ID}/revocation`;
        routerState.routesByPath.current = SUBSCRIPTION_ROUTES;

        render(<Breadcrumbs />);

        expect(linkHrefs()).toEqual(['/dashboard']);
        expectTextWithoutLink('admin-menu.billing.subscriptionRevocation');

        expectTextWithoutLink('admin-menu.billing.title');
        expectTextWithoutLink('admin-menu.billing.subscriptions');
        expectTextWithoutLink('admin-menu.billing.subscription');

        expect(document.body.textContent).not.toContain(SUBSCRIPTION_ID);
    });

    it('keeps linking registered ancestors of the current route', () => {
        routerState.pathname.current = '/access/users';
        routerState.routesByPath.current = {
            '/access': {},
            '/access/users': {}
        };

        render(<Breadcrumbs />);

        expect(linkHrefs()).toEqual(['/dashboard', '/access']);
    });

    it.each<[string, Record<string, unknown> | undefined]>([
        ['undefined', undefined],
        ['empty', {}]
    ])('links every ancestor when routesByPath is %s', (_label, routesByPath) => {
        routerState.pathname.current = `/billing/subscriptions/${SUBSCRIPTION_ID}/cancellation`;
        routerState.routesByPath.current = routesByPath;

        render(<Breadcrumbs />);

        expect(linkHrefs()).toEqual([
            '/dashboard',
            '/billing',
            '/billing/subscriptions',
            `/billing/subscriptions/${SUBSCRIPTION_ID}`
        ]);
    });
});

const FINDER_ROUTES: Record<string, unknown> = {
    '/billing/subscriptions/': {},
    '/billing/subscriptions/$subscriptionId/': {},
    '/billing/subscriptions/$subscriptionId/pause': {},
    '/billing/subscriptions/$subscriptionId/plan-change': {},
    '/billing/subscriptions/$subscriptionId/courtesy': {}
};

describe('HOS-2081 CA-3 el breadcrumb de las acciones enlaza al detalle', () => {
    beforeEach(() => {
        routerState.pathname.current = '/';
        routerState.routesByPath.current = undefined;
    });

    it.each<[string, string]>([
        ['pause', 'admin-menu.billing.subscriptionPause'],
        ['plan-change', 'admin-menu.billing.subscriptionPlanChange'],
        ['courtesy', 'admin-menu.billing.subscriptionCourtesy']
    ])('links the detail and the list from the %s action page', (segment, leafLabel) => {
        routerState.pathname.current = `/billing/subscriptions/${SUBSCRIPTION_ID}/${segment}`;
        routerState.routesByPath.current = FINDER_ROUTES;

        render(<Breadcrumbs />);

        expect(linkHrefs()).toEqual([
            '/dashboard',
            '/billing/subscriptions',
            `/billing/subscriptions/${SUBSCRIPTION_ID}`
        ]);
        expect(
            screen.getByRole('link', { name: 'admin-menu.billing.subscriptions' })
        ).toHaveAttribute('href', '/billing/subscriptions');
        expect(
            screen.getByRole('link', { name: 'admin-menu.billing.subscription' })
        ).toHaveAttribute('href', `/billing/subscriptions/${SUBSCRIPTION_ID}`);
        expectTextWithoutLink(leafLabel);
        expect(screen.getByText(leafLabel)).toHaveAttribute('aria-current', 'page');
        expectTextWithoutLink('admin-menu.billing.title');
    });
});

describe('breadcrumb semantics and overflow', () => {
    afterEach(() => {
        vi.unstubAllEnvs();
        vi.clearAllMocks();
    });

    it('renders an ordered list with only the last label marked as the current page', () => {
        routerState.pathname.current = '/access/users';
        routerState.routesByPath.current = { '/access': {}, '/access/users': {} };

        render(<Breadcrumbs />);

        const nav = screen.getByRole('navigation', { name: 'ui.accessibility.breadcrumb' });
        const list = within(nav).getByRole('list');
        const items = within(list).getAllByRole('listitem');
        expect(list.tagName).toBe('OL');
        expect(items).toHaveLength(3);
        expect(items.every((item) => item.tagName === 'LI')).toBe(true);
        expect(nav.querySelectorAll('[aria-current="page"]')).toHaveLength(1);
        expect(items[2].querySelector('[aria-current="page"]')).not.toBeNull();
        expect(within(items[2]).queryByRole('link')).toBeNull();
        expect(nav).toHaveClass('min-w-0', 'truncate');
        expect(list).toHaveClass('min-w-0', 'flex-nowrap', 'truncate');
        for (const item of items) {
            expect(item).toHaveClass('min-w-0', 'truncate');
            const label = item.querySelector('[title]');
            expect(label).toHaveClass('max-w-[24ch]', 'truncate');
            expect(label?.getAttribute('title')).toBe(label?.textContent);
        }
        const separators = nav.querySelectorAll('[data-testid="icon-BreadcrumbsIcon"]');
        expect(separators).toHaveLength(2);
        for (const separator of separators) {
            expect(separator).toHaveAttribute('aria-hidden', 'true');
        }
    });

    it('marks home as current on the root path', () => {
        routerState.pathname.current = '/';
        render(<Breadcrumbs />);
        expect(screen.getAllByRole('listitem')).toHaveLength(1);
        expect(screen.getByText('ui.navigation.home')).toHaveAttribute('aria-current', 'page');
        expect(screen.queryByRole('link')).toBeNull();
    });

    it('preserves a long entity name in the truncated current label and title', () => {
        routerState.pathname.current = `/accommodations/${SUBSCRIPTION_ID}`;
        const name = 'A very long accommodation name that exceeds twenty-four characters';
        render(<Breadcrumbs entityContext={{ name }} />);
        expect(screen.getByText(name)).toHaveAttribute('title', name);
        expect(screen.getByText(name)).toHaveClass('max-w-[24ch]', 'truncate');
        expect(screen.getByText(name)).toHaveAttribute('aria-current', 'page');
    });

    it('warns once per unknown segment in development across paths and rerenders', () => {
        vi.stubEnv('DEV', true);
        routerState.pathname.current = '/run5-unknown-label';
        const { rerender } = render(<Breadcrumbs />);
        rerender(<Breadcrumbs />);
        routerState.pathname.current = '/access/run5-unknown-label';
        rerender(<Breadcrumbs />);
        expect(adminLogger.warn).toHaveBeenCalledExactlyOnceWith(
            'Missing breadcrumb label for segment',
            { segment: 'run5-unknown-label' }
        );
        expect(screen.getByText('Run5-unknown-label')).toBeInTheDocument();
        routerState.pathname.current = '/run5-other-label';
        rerender(<Breadcrumbs />);
        expect(adminLogger.warn).toHaveBeenCalledTimes(2);
    });

    it('keeps the fallback without warnings in production', () => {
        vi.stubEnv('DEV', false);
        routerState.pathname.current = '/run5-production-label';
        render(<Breadcrumbs />);
        expect(screen.getByText('Run5-production-label')).toBeInTheDocument();
        expect(adminLogger.warn).not.toHaveBeenCalled();
    });

    it('does not warn for known labels or entity context', () => {
        vi.stubEnv('DEV', true);
        routerState.pathname.current = `/accommodations/${SUBSCRIPTION_ID}`;
        render(<Breadcrumbs entityContext={{ name: 'Test accommodation' }} />);
        expect(adminLogger.warn).not.toHaveBeenCalled();
    });
});
