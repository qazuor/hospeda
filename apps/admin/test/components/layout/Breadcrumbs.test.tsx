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
 *   "home" and the leaf; the three prefixes without a page render as text.
 * - TEST:1754:5 — registered routes keep their links.
 * - TEST:1754:6 — an absent or empty route table hides no links (fail-open).
 *
 * @see apps/admin/src/components/layout/Breadcrumbs.tsx
 */

import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Breadcrumbs } from '@/components/layout/Breadcrumbs';

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
        className
    }: {
        to: string;
        children: ReactNode;
        className?: string;
    }) => (
        <a
            href={to}
            className={className}
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
    beforeEach(() => {
        routerState.pathname.current = '/';
        routerState.routesByPath.current = undefined;
    });

    it('links only home and the leaf on the cancellation page', () => {
        routerState.pathname.current = `/billing/subscriptions/${SUBSCRIPTION_ID}/cancellation`;
        routerState.routesByPath.current = SUBSCRIPTION_ROUTES;

        render(<Breadcrumbs />);

        expect(linkHrefs()).toEqual([
            '/dashboard',
            `/billing/subscriptions/${SUBSCRIPTION_ID}/cancellation`
        ]);
        expect(screen.getByRole('link', { name: 'ui.navigation.home' })).toHaveAttribute(
            'href',
            '/dashboard'
        );
        expect(
            screen.getByRole('link', { name: 'admin-menu.billing.subscriptionCancellation' })
        ).toHaveAttribute('href', `/billing/subscriptions/${SUBSCRIPTION_ID}/cancellation`);

        expectTextWithoutLink('admin-menu.billing.title');
        expectTextWithoutLink('admin-menu.billing.subscriptions');
        expectTextWithoutLink('admin-menu.billing.subscription');

        expect(screen.queryByText(SUBSCRIPTION_ID)).toBeNull();
        expect(document.body.textContent).not.toContain(SUBSCRIPTION_ID);
    });

    it('links only home and the leaf on the revocation page', () => {
        routerState.pathname.current = `/billing/subscriptions/${SUBSCRIPTION_ID}/revocation`;
        routerState.routesByPath.current = SUBSCRIPTION_ROUTES;

        render(<Breadcrumbs />);

        expect(linkHrefs()).toEqual([
            '/dashboard',
            `/billing/subscriptions/${SUBSCRIPTION_ID}/revocation`
        ]);
        expect(
            screen.getByRole('link', { name: 'admin-menu.billing.subscriptionRevocation' })
        ).toHaveAttribute('href', `/billing/subscriptions/${SUBSCRIPTION_ID}/revocation`);

        expectTextWithoutLink('admin-menu.billing.title');
        expectTextWithoutLink('admin-menu.billing.subscriptions');
        expectTextWithoutLink('admin-menu.billing.subscription');

        expect(document.body.textContent).not.toContain(SUBSCRIPTION_ID);
    });

    it('keeps linking every prefix of a registered route', () => {
        routerState.pathname.current = '/access/users';
        routerState.routesByPath.current = {
            '/access': {},
            '/access/users': {}
        };

        render(<Breadcrumbs />);

        expect(linkHrefs()).toEqual(['/dashboard', '/access', '/access/users']);
    });

    it.each<[string, Record<string, unknown> | undefined]>([
        ['undefined', undefined],
        ['empty', {}]
    ])('links every prefix when routesByPath is %s', (_label, routesByPath) => {
        routerState.pathname.current = `/billing/subscriptions/${SUBSCRIPTION_ID}/cancellation`;
        routerState.routesByPath.current = routesByPath;

        render(<Breadcrumbs />);

        expect(linkHrefs()).toEqual([
            '/dashboard',
            '/billing',
            '/billing/subscriptions',
            `/billing/subscriptions/${SUBSCRIPTION_ID}`,
            `/billing/subscriptions/${SUBSCRIPTION_ID}/cancellation`
        ]);
    });
});
