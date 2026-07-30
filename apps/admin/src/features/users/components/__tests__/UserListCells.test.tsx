// @vitest-environment jsdom

import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { User } from '@/features/users/schemas/users.schemas';
import { CustomerTypeBadge } from '../CustomerTypeBadge';
import { UserRelationsSummaryCell } from '../UserRelationsSummaryCell';

function createUser(overrides: Partial<User> = {}): User {
    return {
        id: 'user-1',
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

    // HOS-296: `role` no longer exists on the admin user LIST payload
    // (UserListItemSchema drops it — see CustomerTypeBadge.tsx), so the former
    // "staff"/"no plan" role-derived branches were removed rather than
    // fabricated from another field. Every row without a current plan now
    // falls back to the tourist-free label, regardless of the roles the
    // account actually holds.
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
