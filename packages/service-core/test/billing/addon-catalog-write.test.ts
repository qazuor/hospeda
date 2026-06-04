/**
 * Unit tests for AddonCatalogService write methods (SPEC-192 T-018)
 *
 * Verifies that:
 * - create() inserts a new addon, emits audit log, returns AdminAddonResponse
 * - create() rejects duplicate slugs with ALREADY_EXISTS
 * - update() modifies mutable fields, emits diff audit log, returns AdminAddonResponse
 * - update() returns NOT_FOUND when the addon does not exist
 * - toggleActive() sets the active flag, emits audit log
 * - toggleActive() returns NOT_FOUND when the addon does not exist
 * - softDelete() sets deletedAt + active=false, emits audit log
 * - softDelete() returns NOT_FOUND when the addon does not exist
 * - restore() clears deletedAt + sets active=true, emits audit log
 * - restore() returns NOT_FOUND / VALIDATION_ERROR when appropriate
 * - hardDelete() removes the row after audit log, returns success
 * - hardDelete() returns ALREADY_EXISTS when referenced by purchases
 * - hardDelete() returns NOT_FOUND when the addon does not exist
 * - DB errors are caught and returned as INTERNAL_ERROR
 *
 * All DB calls are mocked via vi.mock('@repo/db') and vi.mock('@repo/db/schemas').
 *
 * NOTE: module-level Maps in billing code persist between tests — each test
 * uses unique IDs to avoid cache cross-contamination.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

// ─── Hoisted mocks ─────────────────────────────────────────────────────────

const { mockGetDb, mockWithTransaction } = vi.hoisted(() => ({
    mockGetDb: vi.fn(),
    mockWithTransaction: vi.fn()
}));

// Mock @repo/db
vi.mock('@repo/db', () => ({
    getDb: mockGetDb,
    withTransaction: mockWithTransaction,
    billingAddons: {
        id: 'id',
        name: 'name',
        description: 'description',
        active: 'active',
        unitAmount: 'unitAmount',
        currency: 'currency',
        billingInterval: 'billingInterval',
        billingIntervalCount: 'billingIntervalCount',
        entitlements: 'entitlements',
        limits: 'limits',
        livemode: 'livemode',
        metadata: 'metadata',
        deletedAt: 'deletedAt',
        createdAt: 'createdAt',
        updatedAt: 'updatedAt'
    },
    billingAuditLogs: { table: 'billingAuditLogs' },
    billingSubscriptionAddons: {
        table: 'billingSubscriptionAddons',
        // qzpay-drizzle names this column `addOnId` (capital O)
        addOnId: 'subscriptionAddonAddOnId'
    },
    and: vi.fn((...args: unknown[]) => ({ type: 'and', args })),
    eq: vi.fn((col: unknown, val: unknown) => ({ type: 'eq', col, val })),
    isNull: vi.fn((col: unknown) => ({ type: 'isNull', col })),
    sql: Object.assign(
        vi.fn((strings: TemplateStringsArray, ...values: unknown[]) => ({
            type: 'sql',
            strings,
            values
        })),
        { raw: vi.fn((s: string) => ({ type: 'sql_raw', s })) }
    ),
    count: vi.fn(() => ({ type: 'count' })),
    asc: vi.fn((col: unknown) => ({ type: 'asc', col }))
}));

// Mock @repo/db/schemas for billingAddonPurchases
vi.mock('@repo/db/schemas', () => ({
    billingAddonPurchases: {
        addonId: 'addonId',
        deletedAt: 'deletedAt'
    }
}));

// Import after mocks
import {
    createAddon,
    hardDeleteAddon,
    restoreAddon,
    softDeleteAddon,
    toggleAddonActive,
    updateAddon
} from '../../src/services/billing/addon/addon.crud.js';

// ─── Row builders ──────────────────────────────────────────────────────────

/** Builds a minimal billing_addons row for testing */
function buildAddonRow(
    overrides: Partial<{
        id: string;
        name: string;
        description: string;
        active: boolean;
        unitAmount: number;
        billingInterval: string;
        entitlements: string[];
        limits: Record<string, number>;
        metadata: Record<string, unknown>;
        deletedAt: Date | null;
        livemode: boolean;
    }> = {}
) {
    const id = overrides.id ?? 'addon-uuid-1';
    return {
        id,
        name: overrides.name ?? 'Extra Photos Pack',
        description: overrides.description ?? 'Adds 20 extra photo slots.',
        active: overrides.active ?? true,
        unitAmount: overrides.unitAmount ?? 200000,
        currency: 'ARS',
        billingInterval: overrides.billingInterval ?? 'month',
        billingIntervalCount: 1,
        entitlements: overrides.entitlements ?? [],
        limits: overrides.limits ?? { max_photos_per_accommodation: 20 },
        livemode: overrides.livemode ?? false,
        metadata: overrides.metadata ?? {
            slug: 'extra-photos-20',
            durationDays: null,
            targetCategories: ['owner', 'complex'],
            sortOrder: 3
        },
        deletedAt: overrides.deletedAt ?? null,
        createdAt: new Date('2024-01-01T00:00:00Z'),
        updatedAt: new Date('2024-01-01T00:00:00Z')
    };
}

// ─── Mock DB helpers ──────────────────────────────────────────────────────

/**
 * Builds a mock Drizzle client for select-only operations (getAddonByIdInternal).
 * `selectRows` is the list of rows to return from `select().from().where().limit(1)`.
 */
function buildSelectOnlyDb(selectRows: unknown[] = []) {
    return {
        select: vi.fn().mockReturnValue({
            from: vi.fn().mockReturnValue({
                where: vi.fn().mockReturnValue({
                    limit: vi.fn().mockResolvedValue(selectRows)
                })
            })
        }),
        insert: vi.fn().mockReturnValue({
            values: vi.fn().mockResolvedValue(undefined)
        }),
        update: vi.fn(),
        delete: vi.fn()
    };
}

/**
 * Builds a mock DB for update operations.
 * `selectRow` - the row returned by getAddonByIdInternal (undefined = not found).
 * `updateRow` - the row returned by .update().set().where().returning().
 * `countValue` - value returned by count queries (for hardDelete guard).
 */
function buildUpdateDb(
    options: {
        selectRow?: unknown;
        updateRow?: unknown;
        countValue?: number;
    } = {}
) {
    const { selectRow, updateRow, countValue = 0 } = options;

    return {
        select: vi.fn().mockImplementation((projection?: unknown) => {
            if (projection !== undefined) {
                // count query
                return {
                    from: vi.fn().mockReturnValue({
                        where: vi.fn().mockResolvedValue([{ value: countValue }])
                    })
                };
            }
            return {
                from: vi.fn().mockReturnValue({
                    where: vi.fn().mockReturnValue({
                        limit: vi.fn().mockResolvedValue(selectRow !== undefined ? [selectRow] : [])
                    })
                })
            };
        }),
        insert: vi.fn().mockReturnValue({
            values: vi.fn().mockResolvedValue(undefined)
        }),
        update: vi.fn().mockReturnValue({
            set: vi.fn().mockReturnValue({
                where: vi.fn().mockReturnValue({
                    returning: vi.fn().mockResolvedValue(updateRow !== undefined ? [updateRow] : [])
                })
            })
        }),
        delete: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([])
        })
    };
}

/**
 * Builds a mock DB for soft-delete (update without .returning()).
 * `selectRow` - row returned by getAddonByIdInternal.
 */
function buildSoftDeleteDb(selectRow?: unknown) {
    return {
        select: vi.fn().mockReturnValue({
            from: vi.fn().mockReturnValue({
                where: vi.fn().mockReturnValue({
                    limit: vi.fn().mockResolvedValue(selectRow !== undefined ? [selectRow] : [])
                })
            })
        }),
        insert: vi.fn().mockReturnValue({
            values: vi.fn().mockResolvedValue(undefined)
        }),
        // softDelete: await db.update().set().where() — the where() must resolve directly
        update: vi.fn().mockReturnValue({
            set: vi.fn().mockReturnValue({
                where: vi.fn().mockResolvedValue(undefined)
            })
        }),
        delete: vi.fn()
    };
}

/**
 * Builds a mock DB for hard-delete operations.
 * `selectRow` — row for getAddonByIdInternal.
 * `subscriptionAddonCount` — count of billing_subscription_addons references (> 0 blocks delete).
 * `purchaseCount` — count of billing_addon_purchases references (> 0 blocks delete).
 *
 * Count queries are table-aware: the `from(table)` argument decides which
 * count to return, mirroring the two sequential referential guards.
 */
function buildHardDeleteDb(
    options: {
        selectRow?: unknown;
        subscriptionAddonCount?: number;
        purchaseCount?: number;
    } = {}
) {
    const { selectRow, subscriptionAddonCount = 0, purchaseCount = 0 } = options;
    return {
        select: vi.fn().mockImplementation((projection?: unknown) => {
            if (projection !== undefined) {
                return {
                    from: vi.fn().mockImplementation((table: { table?: string }) => ({
                        where: vi.fn().mockResolvedValue([
                            {
                                value:
                                    table?.table === 'billingSubscriptionAddons'
                                        ? subscriptionAddonCount
                                        : purchaseCount
                            }
                        ])
                    }))
                };
            }
            return {
                from: vi.fn().mockReturnValue({
                    where: vi.fn().mockReturnValue({
                        limit: vi.fn().mockResolvedValue(selectRow !== undefined ? [selectRow] : [])
                    })
                })
            };
        }),
        insert: vi.fn().mockReturnValue({
            values: vi.fn().mockResolvedValue(undefined)
        }),
        update: vi.fn(),
        delete: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([])
        })
    };
}

// ─── Tests ────────────────────────────────────────────────────────────────

describe('AddonCatalogService — write methods (T-018)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        // Default: withTransaction calls the provided function with an empty select-only DB
        mockWithTransaction.mockImplementation((fn: (db: unknown) => Promise<unknown>) =>
            fn(buildSelectOnlyDb())
        );
    });

    // ── create() ───────────────────────────────────────────────────────────

    describe('create()', () => {
        const createInput = {
            slug: 'new-addon-test-001',
            name: 'New Addon',
            description: 'A test addon',
            billingType: 'one_time' as const,
            priceArs: 500000,
            durationDays: 7,
            affectsLimitKey: null,
            limitIncrease: null,
            grantsEntitlement: 'FEATURED_LISTING',
            targetCategories: ['owner', 'complex'] as const,
            isActive: true,
            sortOrder: 10
        };

        describe('when slug is unique', () => {
            it('should insert a new addon and return AdminAddonResponse', async () => {
                // Arrange
                const inserted = buildAddonRow({
                    id: 'new-addon-uuid-001',
                    name: 'New Addon',
                    metadata: {
                        slug: 'new-addon-test-001',
                        durationDays: 7,
                        targetCategories: ['owner', 'complex'],
                        sortOrder: 10
                    }
                });

                // Build a custom mock that handles the specific create flow:
                // 1. select().from().where().limit(1) → [] (no duplicate)
                // 2. insert().values().returning() → [inserted] (new row)
                // 3. insert().values() → (audit log, no .returning())
                mockWithTransaction.mockImplementation(
                    async (fn: (db: unknown) => Promise<unknown>) => {
                        let insertCallIdx = 0;
                        const db = {
                            select: vi.fn().mockReturnValue({
                                from: vi.fn().mockReturnValue({
                                    where: vi.fn().mockReturnValue({
                                        limit: vi.fn().mockResolvedValue([]) // no duplicate
                                    })
                                })
                            }),
                            insert: vi.fn().mockImplementation(() => {
                                const idx = insertCallIdx++;
                                if (idx === 0) {
                                    // Main insert → returning()
                                    return {
                                        values: vi.fn().mockReturnValue({
                                            returning: vi.fn().mockResolvedValue([inserted])
                                        })
                                    };
                                }
                                // Audit log insert → no returning
                                return {
                                    values: vi.fn().mockResolvedValue(undefined)
                                };
                            }),
                            update: vi.fn(),
                            delete: vi.fn()
                        };
                        return fn(db);
                    }
                );

                // Act
                const result = await createAddon(createInput, { actorId: 'admin-uuid' });

                // Assert
                expect(result.success).toBe(true);
                if (!result.success) return;
                expect(result.data.id).toBe('new-addon-uuid-001');
                expect(result.data.createdAt).toBeDefined();
                expect(result.data.deletedAt).toBeNull();
            });
        });

        describe('when slug already exists', () => {
            it('should return ALREADY_EXISTS error', async () => {
                // Arrange
                const existingRow = buildAddonRow({ id: 'existing-uuid-001' });
                mockWithTransaction.mockImplementation(
                    async (fn: (db: unknown) => Promise<unknown>) => {
                        const db = {
                            select: vi.fn().mockReturnValue({
                                from: vi.fn().mockReturnValue({
                                    where: vi.fn().mockReturnValue({
                                        limit: vi.fn().mockResolvedValue([existingRow]) // duplicate found
                                    })
                                })
                            }),
                            insert: vi.fn(),
                            update: vi.fn(),
                            delete: vi.fn()
                        };
                        return fn(db);
                    }
                );

                // Act
                const result = await createAddon(createInput, {});

                // Assert
                expect(result.success).toBe(false);
                if (result.success) return;
                expect(result.error.code).toBe('ALREADY_EXISTS');
                expect(result.error.message).toContain('new-addon-test-001');
            });
        });

        describe('when DB throws', () => {
            it('should return INTERNAL_ERROR', async () => {
                // Arrange
                mockWithTransaction.mockRejectedValue(new Error('DB connection failed'));

                // Act
                const result = await createAddon(createInput, {});

                // Assert
                expect(result.success).toBe(false);
                if (result.success) return;
                expect(result.error.code).toBe('INTERNAL_ERROR');
            });
        });
    });

    // ── update() ───────────────────────────────────────────────────────────

    describe('update()', () => {
        describe('when addon exists', () => {
            it('should update the addon and return AdminAddonResponse', async () => {
                // Arrange
                const existingRow = buildAddonRow({ id: 'update-uuid-001' });
                const updatedRow = buildAddonRow({ id: 'update-uuid-001', name: 'Updated Name' });

                mockWithTransaction.mockImplementation(
                    async (fn: (db: unknown) => Promise<unknown>) => {
                        return fn(buildUpdateDb({ selectRow: existingRow, updateRow: updatedRow }));
                    }
                );

                // Act
                const result = await updateAddon(
                    'update-uuid-001',
                    { name: 'Updated Name' },
                    { actorId: 'admin-uuid' }
                );

                // Assert
                expect(result.success).toBe(true);
                if (!result.success) return;
                expect(result.data.id).toBe('update-uuid-001');
            });
        });

        describe('when addon does not exist', () => {
            it('should return NOT_FOUND', async () => {
                // Arrange
                mockWithTransaction.mockImplementation(
                    async (fn: (db: unknown) => Promise<unknown>) => {
                        return fn(buildUpdateDb({ selectRow: undefined }));
                    }
                );

                // Act
                const result = await updateAddon('missing-uuid-001', { name: 'X' }, {});

                // Assert
                expect(result.success).toBe(false);
                if (result.success) return;
                expect(result.error.code).toBe('NOT_FOUND');
            });
        });

        describe('when DB throws', () => {
            it('should return INTERNAL_ERROR', async () => {
                // Arrange
                mockWithTransaction.mockRejectedValue(new Error('DB error'));

                // Act
                const result = await updateAddon('any-uuid', { name: 'X' }, {});

                // Assert
                expect(result.success).toBe(false);
                if (result.success) return;
                expect(result.error.code).toBe('INTERNAL_ERROR');
            });
        });
    });

    // ── toggleAddonActive() ────────────────────────────────────────────────

    describe('toggleAddonActive()', () => {
        describe('when addon exists', () => {
            it('should toggle active to false and return updated addon', async () => {
                // Arrange
                const existingRow = buildAddonRow({ id: 'toggle-uuid-001', active: true });
                const updatedRow = buildAddonRow({ id: 'toggle-uuid-001', active: false });

                mockWithTransaction.mockImplementation(
                    async (fn: (db: unknown) => Promise<unknown>) => {
                        return fn(buildUpdateDb({ selectRow: existingRow, updateRow: updatedRow }));
                    }
                );

                // Act
                const result = await toggleAddonActive('toggle-uuid-001', false, {});

                // Assert
                expect(result.success).toBe(true);
                if (!result.success) return;
                expect(result.data.isActive).toBe(false);
            });

            it('should toggle active to true', async () => {
                // Arrange
                const existingRow = buildAddonRow({ id: 'toggle-uuid-002', active: false });
                const updatedRow = buildAddonRow({ id: 'toggle-uuid-002', active: true });

                mockWithTransaction.mockImplementation(
                    async (fn: (db: unknown) => Promise<unknown>) => {
                        return fn(buildUpdateDb({ selectRow: existingRow, updateRow: updatedRow }));
                    }
                );

                // Act
                const result = await toggleAddonActive('toggle-uuid-002', true, {});

                // Assert
                expect(result.success).toBe(true);
                if (!result.success) return;
                expect(result.data.isActive).toBe(true);
            });
        });

        describe('when addon does not exist', () => {
            it('should return NOT_FOUND', async () => {
                // Arrange
                mockWithTransaction.mockImplementation(
                    async (fn: (db: unknown) => Promise<unknown>) => {
                        return fn(buildUpdateDb({ selectRow: undefined }));
                    }
                );

                // Act
                const result = await toggleAddonActive('missing-uuid-002', true, {});

                // Assert
                expect(result.success).toBe(false);
                if (result.success) return;
                expect(result.error.code).toBe('NOT_FOUND');
            });
        });
    });

    // ── softDeleteAddon() ─────────────────────────────────────────────────

    describe('softDeleteAddon()', () => {
        describe('when addon exists', () => {
            it('should soft-delete successfully', async () => {
                // Arrange
                const existingRow = buildAddonRow({ id: 'soft-delete-uuid-001', active: true });

                mockWithTransaction.mockImplementation(
                    async (fn: (db: unknown) => Promise<unknown>) => {
                        return fn(buildSoftDeleteDb(existingRow));
                    }
                );

                // Act
                const result = await softDeleteAddon('soft-delete-uuid-001', {
                    actorId: 'admin-uuid'
                });

                // Assert
                expect(result.success).toBe(true);
                if (!result.success) return;
                expect(result.data).toBeUndefined();
            });
        });

        describe('when addon does not exist', () => {
            it('should return NOT_FOUND', async () => {
                // Arrange
                mockWithTransaction.mockImplementation(
                    async (fn: (db: unknown) => Promise<unknown>) => {
                        return fn(buildSoftDeleteDb(undefined));
                    }
                );

                // Act
                const result = await softDeleteAddon('missing-uuid-003', {});

                // Assert
                expect(result.success).toBe(false);
                if (result.success) return;
                expect(result.error.code).toBe('NOT_FOUND');
            });
        });
    });

    // ── restoreAddon() ────────────────────────────────────────────────────

    describe('restoreAddon()', () => {
        describe('when addon is soft-deleted', () => {
            it('should restore and return AdminAddonResponse with active=true', async () => {
                // Arrange
                const deletedRow = buildAddonRow({
                    id: 'restore-uuid-001',
                    active: false,
                    deletedAt: new Date('2024-01-15T00:00:00Z')
                });
                const restoredRow = buildAddonRow({
                    id: 'restore-uuid-001',
                    active: true,
                    deletedAt: null
                });

                mockWithTransaction.mockImplementation(
                    async (fn: (db: unknown) => Promise<unknown>) => {
                        return fn(buildUpdateDb({ selectRow: deletedRow, updateRow: restoredRow }));
                    }
                );

                // Act
                const result = await restoreAddon('restore-uuid-001', { actorId: 'admin-uuid' });

                // Assert
                expect(result.success).toBe(true);
                if (!result.success) return;
                expect(result.data.isActive).toBe(true);
                expect(result.data.deletedAt).toBeNull();
            });
        });

        describe('when addon is NOT soft-deleted', () => {
            it('should return VALIDATION_ERROR', async () => {
                // Arrange — row exists but deletedAt is null
                const activeRow = buildAddonRow({ id: 'restore-uuid-002', deletedAt: null });

                mockWithTransaction.mockImplementation(
                    async (fn: (db: unknown) => Promise<unknown>) => {
                        return fn(buildUpdateDb({ selectRow: activeRow }));
                    }
                );

                // Act
                const result = await restoreAddon('restore-uuid-002', {});

                // Assert
                expect(result.success).toBe(false);
                if (result.success) return;
                expect(result.error.code).toBe('VALIDATION_ERROR');
                expect(result.error.message).toContain('not soft-deleted');
            });
        });

        describe('when addon does not exist', () => {
            it('should return NOT_FOUND', async () => {
                // Arrange
                mockWithTransaction.mockImplementation(
                    async (fn: (db: unknown) => Promise<unknown>) => {
                        return fn(buildUpdateDb({ selectRow: undefined }));
                    }
                );

                // Act
                const result = await restoreAddon('missing-uuid-004', {});

                // Assert
                expect(result.success).toBe(false);
                if (result.success) return;
                expect(result.error.code).toBe('NOT_FOUND');
            });
        });
    });

    // ── hardDeleteAddon() ─────────────────────────────────────────────────

    describe('hardDeleteAddon()', () => {
        describe('when addon exists and has no references', () => {
            it('should delete the addon and return success', async () => {
                // Arrange
                const existingRow = buildAddonRow({ id: 'hard-delete-uuid-001' });

                mockWithTransaction.mockImplementation(
                    async (fn: (db: unknown) => Promise<unknown>) => {
                        return fn(buildHardDeleteDb({ selectRow: existingRow }));
                    }
                );

                // Act
                const result = await hardDeleteAddon('hard-delete-uuid-001', {
                    actorId: 'admin-uuid'
                });

                // Assert
                expect(result.success).toBe(true);
                if (!result.success) return;
                expect(result.data).toBeUndefined();
            });
        });

        describe('when addon is referenced by purchases', () => {
            it('should return ALREADY_EXISTS (conflict)', async () => {
                // Arrange
                const existingRow = buildAddonRow({ id: 'hard-delete-uuid-002' });

                mockWithTransaction.mockImplementation(
                    async (fn: (db: unknown) => Promise<unknown>) => {
                        return fn(buildHardDeleteDb({ selectRow: existingRow, purchaseCount: 3 }));
                    }
                );

                // Act
                const result = await hardDeleteAddon('hard-delete-uuid-002', {});

                // Assert
                expect(result.success).toBe(false);
                if (result.success) return;
                expect(result.error.code).toBe('ALREADY_EXISTS');
                expect(result.error.message).toContain('3');
                expect(result.error.message).toContain('purchase');
            });
        });

        describe('when addon is referenced by subscription addons', () => {
            it('should return ALREADY_EXISTS (conflict) before checking purchases', async () => {
                // Arrange — FK on billing_subscription_addons.addon_id is
                // ON DELETE RESTRICT, so this guard must block the delete
                const existingRow = buildAddonRow({ id: 'hard-delete-uuid-003' });

                mockWithTransaction.mockImplementation(
                    async (fn: (db: unknown) => Promise<unknown>) => {
                        return fn(
                            buildHardDeleteDb({ selectRow: existingRow, subscriptionAddonCount: 2 })
                        );
                    }
                );

                // Act
                const result = await hardDeleteAddon('hard-delete-uuid-003', {});

                // Assert
                expect(result.success).toBe(false);
                if (result.success) return;
                expect(result.error.code).toBe('ALREADY_EXISTS');
                expect(result.error.message).toContain('2');
                expect(result.error.message).toContain('subscription');
            });
        });

        describe('when addon does not exist', () => {
            it('should return NOT_FOUND', async () => {
                // Arrange
                mockWithTransaction.mockImplementation(
                    async (fn: (db: unknown) => Promise<unknown>) => {
                        return fn(buildHardDeleteDb({ selectRow: undefined }));
                    }
                );

                // Act
                const result = await hardDeleteAddon('missing-uuid-005', {});

                // Assert
                expect(result.success).toBe(false);
                if (result.success) return;
                expect(result.error.code).toBe('NOT_FOUND');
            });
        });

        describe('when DB throws', () => {
            it('should return INTERNAL_ERROR', async () => {
                // Arrange
                mockWithTransaction.mockRejectedValue(new Error('DB failure'));

                // Act
                const result = await hardDeleteAddon('any-uuid', {});

                // Assert
                expect(result.success).toBe(false);
                if (result.success) return;
                expect(result.error.code).toBe('INTERNAL_ERROR');
            });
        });
    });
});
