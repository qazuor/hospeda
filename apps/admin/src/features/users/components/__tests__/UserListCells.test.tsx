// @vitest-environment jsdom

import { RoleEnum } from '@repo/schemas';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { User } from '@/features/users/schemas/users.schemas';
import { CustomerTypeBadge } from '../CustomerTypeBadge';
import { UserRelationsSummaryCell } from '../UserRelationsSummaryCell';

function createUser(overrides: Partial<User> = {}): User {
    return {
        id: 'user-1',
        role: 'USER',
        currentPlanSlug: null,
        accommodationsCount: 0,
        gastronomiesCount: 0,
        experiencesCount: 0,
        eventsCount: 0,
        postsCount: 0,
        ...overrides
    } as unknown as User;
}

describe('CustomerTypeBadge', () => {
    it('renders the active plan label when the user has a current plan slug', () => {
        render(<CustomerTypeBadge row={createUser({ currentPlanSlug: 'owner-pro' })} />);

        expect(screen.getByText('billing.plan.owner-pro.name')).toBeInTheDocument();
    });

    it('renders staff when the user has an internal role and no current plan', () => {
        render(<CustomerTypeBadge row={createUser({ role: RoleEnum.ADMIN })} />);

        const badge = screen.getByText('admin-pages.access.users.customerType.staff');
        expect(badge).toBeInTheDocument();
        expect(badge).toHaveClass('bg-blue-100');
    });

    it('renders no plan for host-like roles without an active plan', () => {
        render(<CustomerTypeBadge row={createUser({ role: RoleEnum.HOST })} />);

        const badge = screen.getByText('admin-pages.access.users.customerType.noPlan');
        expect(badge).toBeInTheDocument();
        expect(badge).toHaveClass('bg-amber-100');
    });

    it('renders free with its own colored badge when there is no current plan', () => {
        render(<CustomerTypeBadge row={createUser()} />);

        const badge = screen.getByText('billing.plan.tourist-free.name');
        expect(badge).toBeInTheDocument();
        expect(badge).toHaveClass('bg-slate-100');
    });
});

describe('UserRelationsSummaryCell', () => {
    it('renders the full related-count summary', () => {
        render(
            <UserRelationsSummaryCell
                row={createUser({
                    accommodationsCount: 2,
                    gastronomiesCount: 1,
                    experiencesCount: 3,
                    eventsCount: 4,
                    postsCount: 5
                })}
            />
        );

        expect(
            screen.getByText('admin-pages.access.users.relatedCounts.accommodationsShort')
        ).toBeInTheDocument();
        expect(
            screen.getByText('admin-pages.access.users.relatedCounts.gastronomiesShort')
        ).toBeInTheDocument();
        expect(
            screen.getByText('admin-pages.access.users.relatedCounts.experiencesShort')
        ).toBeInTheDocument();
        expect(
            screen.getByText('admin-pages.access.users.relatedCounts.eventsShort')
        ).toBeInTheDocument();
        expect(
            screen.getByText('admin-pages.access.users.relatedCounts.postsShort')
        ).toBeInTheDocument();
        expect(screen.getByText('2')).toBeInTheDocument();
        expect(screen.getByText('1')).toBeInTheDocument();
        expect(screen.getByText('3')).toBeInTheDocument();
        expect(screen.getByText('4')).toBeInTheDocument();
        expect(screen.getByText('5')).toBeInTheDocument();
    });

    it('hides relations with zero count', () => {
        render(
            <UserRelationsSummaryCell
                row={createUser({
                    accommodationsCount: 0,
                    gastronomiesCount: 0,
                    experiencesCount: 0,
                    eventsCount: 4,
                    postsCount: 0
                })}
            />
        );

        expect(
            screen.queryByText('admin-pages.access.users.relatedCounts.accommodationsShort')
        ).not.toBeInTheDocument();
        expect(
            screen.queryByText('admin-pages.access.users.relatedCounts.gastronomiesShort')
        ).not.toBeInTheDocument();
        expect(
            screen.queryByText('admin-pages.access.users.relatedCounts.experiencesShort')
        ).not.toBeInTheDocument();
        expect(
            screen.getByText('admin-pages.access.users.relatedCounts.eventsShort')
        ).toBeInTheDocument();
        expect(
            screen.queryByText('admin-pages.access.users.relatedCounts.postsShort')
        ).not.toBeInTheDocument();
    });

    it('renders a dash when every relation count is zero', () => {
        render(<UserRelationsSummaryCell row={createUser()} />);

        expect(screen.getByText('-')).toBeInTheDocument();
    });
});
