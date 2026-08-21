import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@repo/db', () => ({
    billingSettings: { key: 'key' },
    billingAuditLogs: {},
    eq: vi.fn(),
    getDb: vi.fn(),
    withTransaction: vi.fn()
}));

import type { DrizzleClient } from '@repo/db';
import * as dbModule from '@repo/db';
import {
    BillingSettingsService,
    getBillingSettingsService,
    resetBillingSettingsService
} from '../../src/services/billing/settings/billing-settings.service.js';

const mockGetDb = dbModule.getDb as ReturnType<typeof vi.fn>;
const mockWithTransaction = dbModule.withTransaction as ReturnType<typeof vi.fn>;

/** Default settings returned by the service when no row exists */
const DEFAULT = {
    ownerTrialDays: 14,
    complexTrialDays: 28,
    trialAutoBlock: true,
    gracePeriodDays: 3,
    currency: 'ARS',
    taxRate: 21,
    maxPaymentRetries: 3,
    retryIntervalHours: 24,
    sendTrialExpiryReminder: true,
    trialExpiryReminderDays: 3,
    sendPaymentFailedNotification: true,
    sendSubscriptionCancelledNotification: true
};

describe('BillingSettingsService', () => {
    let service: BillingSettingsService;

    beforeEach(() => {
        vi.clearAllMocks();
        resetBillingSettingsService();
        service = new BillingSettingsService();
    });

    // ──────────────────────────────────────────────────────────────────────────
    // getSettings
    // ──────────────────────────────────────────────────────────────────────────

    describe('getSettings', () => {
        it('should return default settings when no row exists in DB', async () => {
            // Arrange
            mockGetDb.mockReturnValue({
                select: vi.fn().mockReturnValue({
                    from: vi.fn().mockReturnValue({
                        where: vi.fn().mockReturnValue({
                            limit: vi.fn().mockResolvedValue([])
                        })
                    })
                })
            });

            // Act
            const result = await service.getSettings();

            // Assert
            expect(result).toEqual(DEFAULT);
        });

        it('should merge DB values over defaults when a row exists', async () => {
            // Arrange
            mockGetDb.mockReturnValue({
                select: vi.fn().mockReturnValue({
                    from: vi.fn().mockReturnValue({
                        where: vi.fn().mockReturnValue({
                            limit: vi
                                .fn()
                                .mockResolvedValue([
                                    { key: 'global', value: { taxRate: 15, currency: 'USD' } }
                                ])
                        })
                    })
                })
            });

            // Act
            const result = await service.getSettings();

            // Assert
            expect(result.taxRate).toBe(15);
            expect(result.currency).toBe('USD');
            // Defaults for keys not overridden
            expect(result.ownerTrialDays).toBe(DEFAULT.ownerTrialDays);
        });

        it('should return defaults when DB row value is null', async () => {
            // Arrange
            mockGetDb.mockReturnValue({
                select: vi.fn().mockReturnValue({
                    from: vi.fn().mockReturnValue({
                        where: vi.fn().mockReturnValue({
                            limit: vi.fn().mockResolvedValue([{ key: 'global', value: null }])
                        })
                    })
                })
            });

            // Act
            const result = await service.getSettings();

            // Assert
            expect(result).toEqual(DEFAULT);
        });

        it('should return defaults when DB throws', async () => {
            // Arrange
            mockGetDb.mockReturnValue({
                select: vi.fn().mockReturnValue({
                    from: vi.fn().mockReturnValue({
                        where: vi.fn().mockReturnValue({
                            limit: vi.fn().mockRejectedValue(new Error('db failure'))
                        })
                    })
                })
            });

            // Act
            const result = await service.getSettings();

            // Assert
            expect(result).toEqual(DEFAULT);
        });
    });

    // ──────────────────────────────────────────────────────────────────────────
    // updateSettings
    // ──────────────────────────────────────────────────────────────────────────

    describe('updateSettings', () => {
        it('should merge patch with current settings and persist via transaction', async () => {
            // Arrange — getSettings reads from DB (returns defaults)
            mockGetDb.mockReturnValue({
                select: vi.fn().mockReturnValue({
                    from: vi.fn().mockReturnValue({
                        where: vi.fn().mockReturnValue({
                            limit: vi.fn().mockResolvedValue([])
                        })
                    })
                })
            });
            mockWithTransaction.mockImplementation(async function (
                fn: (tx: unknown) => Promise<unknown>
            ) {
                const tx = {
                    insert: vi.fn().mockReturnValue({
                        values: vi.fn().mockReturnValue({
                            onConflictDoUpdate: vi.fn().mockResolvedValue([])
                        })
                    })
                };
                return fn(tx);
            });

            // Act
            const result = await service.updateSettings({ taxRate: 10 }, false);

            // Assert
            expect(result.taxRate).toBe(10);
            expect(result.currency).toBe(DEFAULT.currency);
            expect(mockWithTransaction).toHaveBeenCalled();
        });

        it('writes the audit log with a valid UUID entityId, not the literal "global" (F-ADMIN-SETTINGS-WRITE)', async () => {
            // billing_audit_logs.entity_id is a NOT NULL UUID column; writing the
            // string 'global' threw `invalid input syntax for type uuid` and rolled
            // back every settings save. Assert the audit insert uses a UUID.
            mockGetDb.mockReturnValue({
                select: vi.fn().mockReturnValue({
                    from: vi.fn().mockReturnValue({
                        where: vi.fn().mockReturnValue({
                            limit: vi.fn().mockResolvedValue([])
                        })
                    })
                })
            });
            const valuesSpy = vi.fn().mockReturnValue({
                onConflictDoUpdate: vi.fn().mockResolvedValue([])
            });
            mockWithTransaction.mockImplementation(async function (
                fn: (tx: unknown) => Promise<unknown>
            ) {
                return fn({ insert: vi.fn().mockReturnValue({ values: valuesSpy }) });
            });

            await service.updateSettings({ taxRate: 10 }, false);

            const auditInsert = valuesSpy.mock.calls
                .map((c) => c[0] as { entityType?: string; entityId?: string })
                .find((v) => v?.entityType === 'settings');
            expect(auditInsert).toBeDefined();
            expect(auditInsert?.entityId).not.toBe('global');
            expect(auditInsert?.entityId).toMatch(
                /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
            );
        });

        it('should throw when patch produces invalid settings', async () => {
            // Arrange
            mockGetDb.mockReturnValue({
                select: vi.fn().mockReturnValue({
                    from: vi.fn().mockReturnValue({
                        where: vi.fn().mockReturnValue({
                            limit: vi.fn().mockResolvedValue([])
                        })
                    })
                })
            });

            // Act / Assert — taxRate 200 is out of range (0–100)
            await expect(service.updateSettings({ taxRate: 200 }, false)).rejects.toThrow(
                'Validation'
            );
        });

        // HOS-719: `livemode` on the billing_audit_logs insert must be the value
        // the caller explicitly derives from the sandbox env var — never a
        // hardcoded `true`. Before this fix the audit trail always mislabeled
        // sandbox-originated settings changes as production data.
        it('writes the audit log with the caller-provided livemode (HOS-719)', async () => {
            mockGetDb.mockReturnValue({
                select: vi.fn().mockReturnValue({
                    from: vi.fn().mockReturnValue({
                        where: vi.fn().mockReturnValue({
                            limit: vi.fn().mockResolvedValue([])
                        })
                    })
                })
            });
            const valuesSpy = vi.fn().mockReturnValue({
                onConflictDoUpdate: vi.fn().mockResolvedValue([])
            });
            mockWithTransaction.mockImplementation(async function (
                fn: (tx: unknown) => Promise<unknown>
            ) {
                return fn({ insert: vi.fn().mockReturnValue({ values: valuesSpy }) });
            });

            // Act — sandbox mode (livemode: false)
            await service.updateSettings({ taxRate: 10 }, false);

            const sandboxAuditInsert = valuesSpy.mock.calls
                .map((c) => c[0] as { entityType?: string; livemode?: boolean })
                .find((v) => v?.entityType === 'settings');
            expect(sandboxAuditInsert?.livemode).toBe(false);

            // Act — production mode (livemode: true)
            await service.updateSettings({ taxRate: 10 }, true);

            const liveAuditInsert = valuesSpy.mock.calls
                .map((c) => c[0] as { entityType?: string; livemode?: boolean })
                .filter((v) => v?.entityType === 'settings')
                .at(-1);
            expect(liveAuditInsert?.livemode).toBe(true);
        });
    });

    // ──────────────────────────────────────────────────────────────────────────
    // resetSettings
    // ──────────────────────────────────────────────────────────────────────────

    describe('resetSettings', () => {
        it('should persist DEFAULT_SETTINGS and return them', async () => {
            // Arrange
            mockWithTransaction.mockImplementation(async function (
                fn: (tx: unknown) => Promise<unknown>
            ) {
                const tx = {
                    insert: vi.fn().mockReturnValue({
                        values: vi.fn().mockReturnValue({
                            onConflictDoUpdate: vi.fn().mockResolvedValue([])
                        })
                    })
                };
                return fn(tx);
            });

            // Act
            const result = await service.resetSettings(false, 'admin-1');

            // Assert
            expect(result).toEqual(DEFAULT);
            expect(mockWithTransaction).toHaveBeenCalled();
        });
    });

    // ──────────────────────────────────────────────────────────────────────────
    // ctx threading — QueryContext propagation
    // ──────────────────────────────────────────────────────────────────────────

    describe('ctx threading', () => {
        describe('getSettings', () => {
            it('should use ctx.tx instead of getDb() when ctx with tx is provided', async () => {
                // Arrange
                const mockTx = {
                    select: vi.fn().mockReturnValue({
                        from: vi.fn().mockReturnValue({
                            where: vi.fn().mockReturnValue({
                                limit: vi.fn().mockResolvedValue([])
                            })
                        })
                    })
                };
                const ctx = { tx: mockTx as unknown as DrizzleClient };

                // Act
                const result = await service.getSettings(ctx);

                // Assert — ctx.tx was used, not getDb()
                expect(mockGetDb).not.toHaveBeenCalled();
                expect(mockTx.select).toHaveBeenCalled();
                expect(result).toEqual(DEFAULT);
            });

            it('should fall back to getDb() when ctx is undefined', async () => {
                // Arrange
                mockGetDb.mockReturnValue({
                    select: vi.fn().mockReturnValue({
                        from: vi.fn().mockReturnValue({
                            where: vi.fn().mockReturnValue({
                                limit: vi.fn().mockResolvedValue([])
                            })
                        })
                    })
                });

                // Act
                await service.getSettings(undefined);

                // Assert
                expect(mockGetDb).toHaveBeenCalled();
            });

            it('should fall back to getDb() when ctx has no tx property', async () => {
                // Arrange
                mockGetDb.mockReturnValue({
                    select: vi.fn().mockReturnValue({
                        from: vi.fn().mockReturnValue({
                            where: vi.fn().mockReturnValue({
                                limit: vi.fn().mockResolvedValue([])
                            })
                        })
                    })
                });

                // Act
                await service.getSettings({});

                // Assert
                expect(mockGetDb).toHaveBeenCalled();
            });
        });

        describe('updateSettings', () => {
            it('should propagate ctx to internal getSettings() call', async () => {
                // Arrange — tx mock used for the getSettings read
                const mockTx = {
                    select: vi.fn().mockReturnValue({
                        from: vi.fn().mockReturnValue({
                            where: vi.fn().mockReturnValue({
                                limit: vi.fn().mockResolvedValue([])
                            })
                        })
                    }),
                    insert: vi.fn().mockReturnValue({
                        values: vi.fn().mockReturnValue({
                            onConflictDoUpdate: vi.fn().mockResolvedValue([])
                        })
                    })
                };
                const ctx = { tx: mockTx as unknown as DrizzleClient };

                mockWithTransaction.mockImplementation(async function (
                    fn: (tx: unknown) => Promise<unknown>
                ) {
                    return fn(mockTx);
                });

                // Act
                const result = await service.updateSettings({ taxRate: 10 }, false, undefined, ctx);

                // Assert — getDb() was NOT called; ctx.tx drove the read
                expect(mockGetDb).not.toHaveBeenCalled();
                expect(mockTx.select).toHaveBeenCalled();
                expect(result.taxRate).toBe(10);
            });

            it('should use getDb() for the read when no ctx is provided', async () => {
                // Arrange
                mockGetDb.mockReturnValue({
                    select: vi.fn().mockReturnValue({
                        from: vi.fn().mockReturnValue({
                            where: vi.fn().mockReturnValue({
                                limit: vi.fn().mockResolvedValue([])
                            })
                        })
                    })
                });
                mockWithTransaction.mockImplementation(async function (
                    fn: (tx: unknown) => Promise<unknown>
                ) {
                    const tx = {
                        insert: vi.fn().mockReturnValue({
                            values: vi.fn().mockReturnValue({
                                onConflictDoUpdate: vi.fn().mockResolvedValue([])
                            })
                        })
                    };
                    return fn(tx);
                });

                // Act
                await service.updateSettings({ taxRate: 5 }, false);

                // Assert
                expect(mockGetDb).toHaveBeenCalled();
            });
        });

        describe('resetSettings', () => {
            it('should accept ctx parameter without error (backward-compat API)', async () => {
                // Arrange
                mockWithTransaction.mockImplementation(async function (
                    fn: (tx: unknown) => Promise<unknown>
                ) {
                    const tx = {
                        insert: vi.fn().mockReturnValue({
                            values: vi.fn().mockReturnValue({
                                onConflictDoUpdate: vi.fn().mockResolvedValue([])
                            })
                        })
                    };
                    return fn(tx);
                });
                const ctx = { tx: {} as unknown as DrizzleClient };

                // Act — should not throw
                const result = await service.resetSettings(false, 'admin-1', ctx);

                // Assert — still returns defaults; transaction still runs
                expect(result).toEqual(DEFAULT);
                expect(mockWithTransaction).toHaveBeenCalled();
            });
        });
    });

    // ──────────────────────────────────────────────────────────────────────────
    // Singleton helpers
    // ──────────────────────────────────────────────────────────────────────────

    describe('getBillingSettingsService / resetBillingSettingsService', () => {
        it('should return the same instance on repeated calls', () => {
            // Arrange
            resetBillingSettingsService();

            // Act
            const a = getBillingSettingsService();
            const b = getBillingSettingsService();

            // Assert
            expect(a).toBe(b);
        });

        it('should return a new instance after reset', () => {
            // Arrange
            const first = getBillingSettingsService();
            resetBillingSettingsService();

            // Act
            const second = getBillingSettingsService();

            // Assert
            expect(second).not.toBe(first);
        });
    });
});
