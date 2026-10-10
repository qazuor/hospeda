// @vitest-environment jsdom

import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { User } from '@/features/users/schemas/users.schemas';
import { UserRelationsSummaryCell } from '../UserRelationsSummaryCell';

function createUser(overrides: Partial<User> = {}): User {
    return {
        id: 'user-1',
        accommodationsCount: 0,
        gastronomiesCount: 0,
        experiencesCount: 0,
        eventsCount: 0,
        postsCount: 0,
        ...overrides
    } as unknown as User;
}

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
