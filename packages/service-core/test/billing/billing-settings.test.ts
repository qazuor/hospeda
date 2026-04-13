import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@repo/db', () => ({
    billingSettings: { key: 'key' },
    billingAuditLogs: {},
    eq: vi.fn(),
    getDb: vi.fn(),
    withTransaction: vi.fn()
}));

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
            mockWithTransaction.mockImplementation(
                async (fn: (tx: unknown) => Promise<unknown>) => {
                    const tx = {
                        insert: vi.fn().mockReturnValue({
                            values: vi.fn().mockReturnValue({
                                onConflictDoUpdate: vi.fn().mockResolvedValue([])
                            })
                        })
                    };
                    return fn(tx);
                }
            );

            // Act
            const result = await service.updateSettings({ taxRate: 10 });

            // Assert
            expect(result.taxRate).toBe(10);
            expect(result.currency).toBe(DEFAULT.currency);
            expect(mockWithTransaction).toHaveBeenCalled();
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
            await expect(service.updateSettings({ taxRate: 200 })).rejects.toThrow('Validation');
        });
    });

    // ──────────────────────────────────────────────────────────────────────────
    // resetSettings
    // ──────────────────────────────────────────────────────────────────────────

    describe('resetSettings', () => {
        it('should persist DEFAULT_SETTINGS and return them', async () => {
            // Arrange
            mockWithTransaction.mockImplementation(
                async (fn: (tx: unknown) => Promise<unknown>) => {
                    const tx = {
                        insert: vi.fn().mockReturnValue({
                            values: vi.fn().mockReturnValue({
                                onConflictDoUpdate: vi.fn().mockResolvedValue([])
                            })
                        })
                    };
                    return fn(tx);
                }
            );

            // Act
            const result = await service.resetSettings('admin-1');

            // Assert
            expect(result).toEqual(DEFAULT);
            expect(mockWithTransaction).toHaveBeenCalled();
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
