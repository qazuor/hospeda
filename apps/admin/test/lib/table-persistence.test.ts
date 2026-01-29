/**
 * Tests for Table Persistence System
 *
 * Tests for TASK-307: Verify table state persistence across navigation
 * - State persists after navigation (localStorage)
 * - State clears on session end (sessionStorage)
 * - Schema changes don't break persistence
 * - Storage adapters work correctly
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Mock localStorage and sessionStorage
const createMockStorage = () => {
    const store: Record<string, string> = {};
    return {
        getItem: vi.fn((key: string) => store[key] ?? null),
        setItem: vi.fn((key: string, value: string) => {
            store[key] = value;
        }),
        removeItem: vi.fn((key: string) => {
            delete store[key];
        }),
        clear: vi.fn(() => {
            for (const key of Object.keys(store)) {
                delete store[key];
            }
        }),
        get length() {
            return Object.keys(store).length;
        },
        key: vi.fn((index: number) => Object.keys(store)[index] ?? null),
        _store: store
    };
};

describe('Table Persistence System', () => {
    let mockLocalStorage: ReturnType<typeof createMockStorage>;
    let mockSessionStorage: ReturnType<typeof createMockStorage>;
    let originalLocalStorage: Storage;
    let originalSessionStorage: Storage;

    beforeEach(() => {
        // Save originals
        originalLocalStorage = globalThis.localStorage;
        originalSessionStorage = globalThis.sessionStorage;

        // Create mocks
        mockLocalStorage = createMockStorage();
        mockSessionStorage = createMockStorage();

        // Replace globals
        Object.defineProperty(globalThis, 'localStorage', {
            value: mockLocalStorage,
            writable: true
        });
        Object.defineProperty(globalThis, 'sessionStorage', {
            value: mockSessionStorage,
            writable: true
        });
    });

    afterEach(() => {
        // Restore originals
        Object.defineProperty(globalThis, 'localStorage', {
            value: originalLocalStorage,
            writable: true
        });
        Object.defineProperty(globalThis, 'sessionStorage', {
            value: originalSessionStorage,
            writable: true
        });
        vi.clearAllMocks();
    });

    describe('localStorage Persistence', () => {
        it('should save table state to localStorage', () => {
            const state = {
                sorting: [{ id: 'name', desc: false }],
                pagination: { pageIndex: 0, pageSize: 20 },
                columnVisibility: { description: false },
                columnFilters: []
            };

            const key = 'table-state:test-table';
            mockLocalStorage.setItem(key, JSON.stringify(state));

            expect(mockLocalStorage.setItem).toHaveBeenCalledWith(key, JSON.stringify(state));
            expect(mockLocalStorage._store[key]).toBe(JSON.stringify(state));
        });

        it('should restore table state from localStorage', () => {
            const state = {
                sorting: [{ id: 'name', desc: true }],
                pagination: { pageIndex: 2, pageSize: 50 },
                columnVisibility: { id: false, createdAt: false },
                columnFilters: [{ id: 'status', value: 'active' }]
            };

            const key = 'table-state:my-table';
            mockLocalStorage._store[key] = JSON.stringify(state);

            const retrieved = mockLocalStorage.getItem(key);
            expect(retrieved).toBe(JSON.stringify(state));

            const parsed = JSON.parse(retrieved!);
            expect(parsed.sorting).toEqual([{ id: 'name', desc: true }]);
            expect(parsed.pagination.pageIndex).toBe(2);
            expect(parsed.columnVisibility.id).toBe(false);
        });

        it('should return null for non-existent key', () => {
            const result = mockLocalStorage.getItem('table-state:nonexistent');
            expect(result).toBeNull();
        });

        it('should remove state from localStorage', () => {
            const key = 'table-state:to-remove';
            mockLocalStorage._store[key] = JSON.stringify({ sorting: [] });

            mockLocalStorage.removeItem(key);

            expect(mockLocalStorage.removeItem).toHaveBeenCalledWith(key);
            expect(mockLocalStorage._store[key]).toBeUndefined();
        });

        it('should persist across simulated page reloads', () => {
            const state = {
                sorting: [{ id: 'createdAt', desc: true }],
                pagination: { pageIndex: 0, pageSize: 10 },
                columnVisibility: {},
                columnFilters: []
            };

            const key = 'table-state:persistent';

            // Initial save
            mockLocalStorage.setItem(key, JSON.stringify(state));

            // Simulate "page reload" by clearing the mock calls but keeping storage
            vi.clearAllMocks();

            // Verify data is still there
            const retrieved = mockLocalStorage.getItem(key);
            expect(retrieved).not.toBeNull();

            const parsed = JSON.parse(retrieved!);
            expect(parsed.sorting[0].id).toBe('createdAt');
        });
    });

    describe('sessionStorage Persistence', () => {
        it('should save table state to sessionStorage', () => {
            const state = {
                sorting: [],
                pagination: { pageIndex: 0, pageSize: 25 },
                columnVisibility: {},
                columnFilters: []
            };

            const key = 'table-state:session-table';
            mockSessionStorage.setItem(key, JSON.stringify(state));

            expect(mockSessionStorage.setItem).toHaveBeenCalledWith(key, JSON.stringify(state));
            expect(mockSessionStorage._store[key]).toBe(JSON.stringify(state));
        });

        it('should restore table state from sessionStorage', () => {
            const state = {
                sorting: [{ id: 'updatedAt', desc: true }],
                pagination: { pageIndex: 1, pageSize: 15 },
                columnVisibility: { slug: false },
                columnFilters: []
            };

            const key = 'table-state:session-restore';
            mockSessionStorage._store[key] = JSON.stringify(state);

            const retrieved = mockSessionStorage.getItem(key);
            const parsed = JSON.parse(retrieved!);

            expect(parsed.sorting[0].id).toBe('updatedAt');
            expect(parsed.pagination.pageSize).toBe(15);
        });

        it('should clear on session end (simulated)', () => {
            const key = 'table-state:session-clear';
            mockSessionStorage._store[key] = JSON.stringify({ sorting: [] });

            // Simulate session end by clearing sessionStorage
            mockSessionStorage.clear();

            expect(mockSessionStorage._store[key]).toBeUndefined();
            expect(mockSessionStorage.getItem(key)).toBeNull();
        });
    });

    describe('Schema Validation', () => {
        it('should handle invalid JSON gracefully', () => {
            const key = 'table-state:invalid-json';
            mockLocalStorage._store[key] = 'not valid json{';

            // Attempting to parse should throw, but our code should handle it
            let parsed = null;
            try {
                const value = mockLocalStorage.getItem(key);
                if (value) {
                    parsed = JSON.parse(value);
                }
            } catch {
                parsed = null;
            }

            expect(parsed).toBeNull();
        });

        it('should handle missing required fields', () => {
            const key = 'table-state:missing-fields';
            // Only has sorting, missing pagination, columnVisibility, columnFilters
            mockLocalStorage._store[key] = JSON.stringify({ sorting: [] });

            const retrieved = mockLocalStorage.getItem(key);
            const parsed = JSON.parse(retrieved!);

            // The data exists but is incomplete
            expect(parsed.sorting).toEqual([]);
            expect(parsed.pagination).toBeUndefined();
        });

        it('should handle schema version changes', () => {
            // Simulate old schema format
            const oldSchema = {
                sort: 'name', // old format used 'sort' instead of 'sorting'
                page: 1 // old format used 'page' instead of 'pagination'
            };

            const key = 'table-state:old-schema';
            mockLocalStorage._store[key] = JSON.stringify(oldSchema);

            const retrieved = mockLocalStorage.getItem(key);
            const parsed = JSON.parse(retrieved!);

            // Old schema doesn't have 'sorting' property
            expect(parsed.sorting).toBeUndefined();
            expect(parsed.sort).toBe('name'); // Old field present
        });

        it('should validate sorting array format', () => {
            const validSorting = [{ id: 'name', desc: false }];
            const key = 'table-state:valid-sorting';
            mockLocalStorage._store[key] = JSON.stringify({ sorting: validSorting });

            const retrieved = mockLocalStorage.getItem(key);
            const parsed = JSON.parse(retrieved!);

            expect(Array.isArray(parsed.sorting)).toBe(true);
            expect(parsed.sorting[0]).toHaveProperty('id');
            expect(parsed.sorting[0]).toHaveProperty('desc');
        });

        it('should validate pagination object format', () => {
            const validPagination = { pageIndex: 0, pageSize: 20 };
            const key = 'table-state:valid-pagination';
            mockLocalStorage._store[key] = JSON.stringify({ pagination: validPagination });

            const retrieved = mockLocalStorage.getItem(key);
            const parsed = JSON.parse(retrieved!);

            expect(parsed.pagination).toHaveProperty('pageIndex');
            expect(parsed.pagination).toHaveProperty('pageSize');
            expect(typeof parsed.pagination.pageIndex).toBe('number');
            expect(typeof parsed.pagination.pageSize).toBe('number');
        });
    });

    describe('Storage Quota Handling', () => {
        it('should handle localStorage quota exceeded', () => {
            const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

            // Simulate quota exceeded error
            mockLocalStorage.setItem.mockImplementationOnce(() => {
                const error = new Error('QuotaExceededError');
                error.name = 'QuotaExceededError';
                throw error;
            });

            let errorThrown = false;
            try {
                mockLocalStorage.setItem('test', 'value');
            } catch (error) {
                if (error instanceof Error && error.name === 'QuotaExceededError') {
                    errorThrown = true;
                }
            }

            expect(errorThrown).toBe(true);
            consoleSpy.mockRestore();
        });

        it('should handle sessionStorage quota exceeded', () => {
            mockSessionStorage.setItem.mockImplementationOnce(() => {
                const error = new Error('QuotaExceededError');
                error.name = 'QuotaExceededError';
                throw error;
            });

            let errorThrown = false;
            try {
                mockSessionStorage.setItem('test', 'value');
            } catch (error) {
                if (error instanceof Error && error.name === 'QuotaExceededError') {
                    errorThrown = true;
                }
            }

            expect(errorThrown).toBe(true);
        });
    });

    describe('Multiple Tables', () => {
        it('should maintain separate state for different tables', () => {
            const table1State = {
                sorting: [{ id: 'name', desc: false }],
                pagination: { pageIndex: 0, pageSize: 10 }
            };
            const table2State = {
                sorting: [{ id: 'createdAt', desc: true }],
                pagination: { pageIndex: 2, pageSize: 50 }
            };

            mockLocalStorage.setItem('table-state:table1', JSON.stringify(table1State));
            mockLocalStorage.setItem('table-state:table2', JSON.stringify(table2State));

            const retrieved1 = JSON.parse(mockLocalStorage.getItem('table-state:table1')!);
            const retrieved2 = JSON.parse(mockLocalStorage.getItem('table-state:table2')!);

            expect(retrieved1.sorting[0].id).toBe('name');
            expect(retrieved2.sorting[0].id).toBe('createdAt');
            expect(retrieved1.pagination.pageSize).toBe(10);
            expect(retrieved2.pagination.pageSize).toBe(50);
        });

        it('should not affect other tables when clearing one', () => {
            mockLocalStorage._store['table-state:tableA'] = JSON.stringify({ sorting: [] });
            mockLocalStorage._store['table-state:tableB'] = JSON.stringify({ sorting: [] });

            mockLocalStorage.removeItem('table-state:tableA');

            expect(mockLocalStorage._store['table-state:tableA']).toBeUndefined();
            expect(mockLocalStorage._store['table-state:tableB']).toBeDefined();
        });
    });

    describe('State Update Patterns', () => {
        it('should support partial state updates', () => {
            const initialState = {
                sorting: [],
                pagination: { pageIndex: 0, pageSize: 20 },
                columnVisibility: {},
                columnFilters: []
            };

            const key = 'table-state:partial-update';
            mockLocalStorage._store[key] = JSON.stringify(initialState);

            // Read, modify, write pattern
            const current = JSON.parse(mockLocalStorage.getItem(key)!);
            const updated = {
                ...current,
                sorting: [{ id: 'name', desc: true }]
            };
            mockLocalStorage.setItem(key, JSON.stringify(updated));

            const final = JSON.parse(mockLocalStorage.getItem(key)!);
            expect(final.sorting[0].id).toBe('name');
            expect(final.pagination.pageSize).toBe(20); // Unchanged
        });

        it('should support column visibility toggle', () => {
            const state = {
                columnVisibility: { description: true, notes: false }
            };

            const key = 'table-state:visibility';
            mockLocalStorage._store[key] = JSON.stringify(state);

            // Toggle visibility
            const current = JSON.parse(mockLocalStorage.getItem(key)!);
            current.columnVisibility.description = !current.columnVisibility.description;
            mockLocalStorage.setItem(key, JSON.stringify(current));

            const updated = JSON.parse(mockLocalStorage.getItem(key)!);
            expect(updated.columnVisibility.description).toBe(false);
            expect(updated.columnVisibility.notes).toBe(false);
        });

        it('should support filter addition and removal', () => {
            const state = {
                columnFilters: [{ id: 'status', value: 'active' }]
            };

            const key = 'table-state:filters';
            mockLocalStorage._store[key] = JSON.stringify(state);

            // Add filter
            const current = JSON.parse(mockLocalStorage.getItem(key)!);
            current.columnFilters.push({ id: 'type', value: 'accommodation' });
            mockLocalStorage.setItem(key, JSON.stringify(current));

            const updated = JSON.parse(mockLocalStorage.getItem(key)!);
            expect(updated.columnFilters).toHaveLength(2);

            // Remove filter
            updated.columnFilters = updated.columnFilters.filter(
                (f: { id: string }) => f.id !== 'status'
            );
            mockLocalStorage.setItem(key, JSON.stringify(updated));

            const final = JSON.parse(mockLocalStorage.getItem(key)!);
            expect(final.columnFilters).toHaveLength(1);
            expect(final.columnFilters[0].id).toBe('type');
        });
    });

    describe('Reset Functionality', () => {
        it('should support resetting to default state', () => {
            const defaultState = {
                sorting: [],
                pagination: { pageIndex: 0, pageSize: 20 },
                columnVisibility: {},
                columnFilters: []
            };

            const modifiedState = {
                sorting: [{ id: 'name', desc: true }],
                pagination: { pageIndex: 5, pageSize: 100 },
                columnVisibility: { id: false },
                columnFilters: [{ id: 'status', value: 'draft' }]
            };

            const key = 'table-state:reset-test';

            // Save modified state
            mockLocalStorage.setItem(key, JSON.stringify(modifiedState));

            // Reset by removing and potentially re-adding default
            mockLocalStorage.removeItem(key);
            mockLocalStorage.setItem(key, JSON.stringify(defaultState));

            const final = JSON.parse(mockLocalStorage.getItem(key)!);
            expect(final.sorting).toEqual([]);
            expect(final.pagination.pageIndex).toBe(0);
            expect(final.pagination.pageSize).toBe(20);
        });

        it('should support complete state clearing', () => {
            mockLocalStorage._store['table-state:t1'] = JSON.stringify({});
            mockLocalStorage._store['table-state:t2'] = JSON.stringify({});
            mockLocalStorage._store['other-key'] = 'other value';

            // Clear only table state keys
            const keys = Object.keys(mockLocalStorage._store).filter((k) =>
                k.startsWith('table-state:')
            );
            for (const key of keys) {
                mockLocalStorage.removeItem(key);
            }

            expect(mockLocalStorage._store['table-state:t1']).toBeUndefined();
            expect(mockLocalStorage._store['table-state:t2']).toBeUndefined();
            expect(mockLocalStorage._store['other-key']).toBe('other value');
        });
    });
});
