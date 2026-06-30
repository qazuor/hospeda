/**
 * userSearchHistoryFactory.ts
 *
 * Factory functions for generating UserSearchHistoryEntry mock data in tests.
 */

import type { UserSearchHistoryEntry } from '@repo/schemas';
import { BaseFactoryBuilder } from './baseEntityFactory';
import { getMockId } from './utilsFactory';

/**
 * Returns a deterministic UUID usable as a UserSearchHistoryEntry id.
 * @param id - Optional string to hash; defaults to `'userSearchHistory'`.
 */
export const getMockSearchHistoryId = (id?: string): string => getMockId('userSearchHistory', id);

/**
 * Minimal valid UserSearchHistoryEntry for mock use.
 */
const baseEntry: UserSearchHistoryEntry = {
    id: getMockSearchHistoryId(),
    userId: getMockId('user'),
    queryText: 'playa',
    filtersJson: null,
    resultCount: 5,
    createdAt: new Date('2026-01-01T10:00:00.000Z')
};

/**
 * Builder for UserSearchHistoryEntry test objects.
 */
export class UserSearchHistoryEntryBuilder extends BaseFactoryBuilder<UserSearchHistoryEntry> {
    constructor() {
        super(baseEntry);
    }
}

/**
 * Creates a mock UserSearchHistoryEntry with optional field overrides.
 * @param overrides - Fields to override on the base entry.
 */
export const createMockSearchHistoryEntry = (
    overrides: Partial<UserSearchHistoryEntry> = {}
): UserSearchHistoryEntry => new UserSearchHistoryEntryBuilder().with(overrides).build();
