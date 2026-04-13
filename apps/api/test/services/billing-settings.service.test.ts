/**
 * Tests for BillingSettingsService
 *
 * Tests the service after migration from billing_audit_logs to dedicated
 * billing_settings table (key-value pattern with key='global').
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
    BillingSettingsService,
    getBillingSettingsService,
    resetBillingSettingsService
} from '../../src/services/billing-settings.service';

// Hoist shared mock functions for drizzle operators and getDb reference
const { mockEq, mockGetDb } = vi.hoisted(() => ({
    mockEq: vi.fn((field: string, value: unknown) => ({ eq: field, value })),
    mockGetDb: vi.fn()
}));

// Mock @repo/db
vi.mock('@repo/db', () => ({
    getDb: mockGetDb,
    // withTransaction is required by BillingSettingsService.updateSettings (in @repo/service-core).
    // Delegates to callback(existingTx) or callback(getDb()) so the test's mockDb
    // (set via mockGetDb.mockReturnValue(...) in beforeEach) is used as the transaction client.
    withTransaction: vi.fn((callback: (tx: unknown) => Promise<unknown>, existingTx?: unknown) => {
        if (existingTx) {
            return callback(existingTx);
        }
        // Lazily resolve so the mockReturnValue set in beforeEach is used at call time
        return callback(mockGetDb());
    }),
    billingSettings: {
        key: 'key',
        value: 'value',
        updatedBy: 'updatedBy',
        updatedAt: 'updatedAt'
    },
    billingAuditLogs: {
        action: 'action',
        entityType: 'entityType',
        entityId: 'entityId',
        actorId: 'actorId',
        metadata: 'metadata',
        livemode: 'livemode',
        createdAt: 'createdAt'
    },
    eq: mockEq
}));

vi.mock('../../src/utils/logger', () => ({
    apiLogger: {
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn()
    }
}));

// Import after mocking to get mocked versions
import { billingAuditLogs, billingSettings, getDb } from '@repo/db';

describe('BillingSettingsService', () => {
    let service: BillingSettingsService;

    // Mock database chain methods
    let mockSelect: ReturnType<typeof vi.fn>;
    let mockFrom: ReturnType<typeof vi.fn>;
    let mockWhere: ReturnType<typeof vi.fn>;
    let mockLimit: ReturnType<typeof vi.fn>;
    let mockInsert: ReturnType<typeof vi.fn>;
    let mockValues: ReturnType<typeof vi.fn>;
    let mockOnConflictDoUpdate: ReturnType<typeof vi.fn>;
    let mockDb: Record<string, ReturnType<typeof vi.fn>>;

    /** Tracks insert calls in order: [tableName, valuesArg] */
    let insertCalls: Array<{ table: unknown; values: unknown }>;

    // Default settings reference
    const DEFAULT_SETTINGS = {
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

    beforeEach(() => {
        vi.clearAllMocks();
        insertCalls = [];

        // Create chainable mock methods for SELECT chain
        mockSelect = vi.fn().mockReturnThis();
        mockFrom = vi.fn().mockReturnThis();
        mockWhere = vi.fn().mockReturnThis();
        mockLimit = vi.fn().mockResolvedValue([]);

        // CREATE chainable mock methods for INSERT chain
        mockOnConflictDoUpdate = vi.fn().mockResolvedValue(undefined);
        mockValues = vi.fn();

        // values() can either resolve directly (audit log insert) or return onConflictDoUpdate chain (upsert)
        mockValues.mockImplementation((valuesArg: unknown) => {
            // Record the insert call
            const lastTable = insertCalls.length > 0 ? insertCalls[insertCalls.length - 1] : null;
            if (lastTable && lastTable.values === null) {
                lastTable.values = valuesArg;
            }
            return {
                onConflictDoUpdate: mockOnConflictDoUpdate
            };
        });

        mockInsert = vi.fn((table: unknown) => {
            insertCalls.push({ table, values: null });
            return { values: mockValues };
        });

        mockSelect.mockReturnValue({ from: mockFrom });
        mockFrom.mockReturnValue({ where: mockWhere });
        mockWhere.mockReturnValue({ limit: mockLimit });

        // Setup mock db
        mockDb = {
            select: mockSelect,
            insert: mockInsert
        };

        vi.mocked(getDb).mockReturnValue(mockDb as unknown as ReturnType<typeof getDb>);

        // Create service instance
        service = new BillingSettingsService();
    });

    describe('getSettings', () => {
        it('should return default settings when no row found in billing_settings', async () => {
            // Arrange
            mockLimit.mockResolvedValue([]);

            // Act
            const result = await service.getSettings();

            // Assert
            expect(result).toEqual(DEFAULT_SETTINGS);
            expect(getDb).toHaveBeenCalled();
            expect(mockDb.select).toHaveBeenCalled();
            expect(mockFrom).toHaveBeenCalledWith(billingSettings);
            expect(mockEq).toHaveBeenCalledWith(billingSettings.key, 'global');
        });

        it('should return merged settings when custom row found', async () => {
            // Arrange
            const customSettings = {
                ownerTrialDays: 30,
                currency: 'USD'
            };

            const mockRow = {
                key: 'global',
                value: customSettings
            };

            mockLimit.mockResolvedValue([mockRow]);

            // Act
            const result = await service.getSettings();

            // Assert
            expect(result).toEqual({
                ...DEFAULT_SETTINGS,
                ...customSettings
            });
            expect(result.ownerTrialDays).toBe(30);
            expect(result.currency).toBe('USD');
            expect(result.complexTrialDays).toBe(DEFAULT_SETTINGS.complexTrialDays);
        });

        it('should return defaults when value is null', async () => {
            // Arrange
            const mockRow = {
                key: 'global',
                value: null
            };

            mockLimit.mockResolvedValue([mockRow]);

            // Act
            const result = await service.getSettings();

            // Assert
            expect(result).toEqual(DEFAULT_SETTINGS);
        });

        it('should return defaults when value is invalid type', async () => {
            // Arrange
            const mockRow = {
                key: 'global',
                value: 'invalid-string'
            };

            mockLimit.mockResolvedValue([mockRow]);

            // Act
            const result = await service.getSettings();

            // Assert
            expect(result).toEqual(DEFAULT_SETTINGS);
        });

        it('should return defaults on database error', async () => {
            // Arrange
            mockLimit.mockRejectedValue(new Error('Database connection failed'));

            // Act
            const result = await service.getSettings();

            // Assert
            expect(result).toEqual(DEFAULT_SETTINGS);
        });
    });

    describe('updateSettings', () => {
        it('should successfully update partial settings', async () => {
            // Arrange
            const patch = { ownerTrialDays: 21 };
            mockLimit.mockResolvedValue([]);

            // Act
            const result = await service.updateSettings(patch);

            // Assert
            expect(result).toEqual({
                ...DEFAULT_SETTINGS,
                ownerTrialDays: 21
            });
        });

        it('should upsert into billing_settings table first', async () => {
            // Arrange
            const patch = { ownerTrialDays: 21 };
            mockLimit.mockResolvedValue([]);

            // Act
            await service.updateSettings(patch);

            // Assert - first insert is into billingSettings
            expect(insertCalls.length).toBeGreaterThanOrEqual(2);
            expect(insertCalls[0]?.table).toBe(billingSettings);
            expect(mockOnConflictDoUpdate).toHaveBeenCalledWith(
                expect.objectContaining({
                    target: billingSettings.key
                })
            );
        });

        it('should insert audit log entry after upsert', async () => {
            // Arrange
            const patch = { ownerTrialDays: 21, currency: 'USD' };
            mockLimit.mockResolvedValue([]);

            // Act
            await service.updateSettings(patch);

            // Assert - second insert is into billingAuditLogs
            expect(insertCalls.length).toBe(2);
            expect(insertCalls[1]?.table).toBe(billingAuditLogs);
            expect(insertCalls[1]?.values).toEqual(
                expect.objectContaining({
                    action: 'billing_settings_update',
                    entityType: 'settings',
                    entityId: 'global',
                    actorId: null,
                    actorType: 'system',
                    previousValues: DEFAULT_SETTINGS,
                    livemode: true
                })
            );
        });

        it('should include actorId in audit entry when provided', async () => {
            // Arrange
            const patch = { ownerTrialDays: 21 };
            const actorId = 'admin_123';
            mockLimit.mockResolvedValue([]);

            // Act
            await service.updateSettings(patch, actorId);

            // Assert - audit log has actorId
            expect(insertCalls[1]?.values).toEqual(
                expect.objectContaining({
                    actorId: actorId,
                    actorType: 'admin'
                })
            );
        });

        it('should throw on validation failure - ownerTrialDays zero', async () => {
            // Arrange
            const patch = { ownerTrialDays: 0 };
            mockLimit.mockResolvedValue([]);

            // Act & Assert
            await expect(service.updateSettings(patch)).rejects.toThrow(
                'Validation failed: ownerTrialDays must be between 1 and 90'
            );
            expect(mockInsert).not.toHaveBeenCalled();
        });

        it('should throw on validation failure - invalid currency', async () => {
            // Arrange
            const patch = { currency: 'ARSSS' };
            mockLimit.mockResolvedValue([]);

            // Act & Assert
            await expect(service.updateSettings(patch)).rejects.toThrow(
                'Validation failed: currency must be a 3-letter ISO 4217 code'
            );
            expect(mockInsert).not.toHaveBeenCalled();
        });

        it('should throw on multiple validation errors', async () => {
            // Arrange
            const patch = {
                ownerTrialDays: 0,
                complexTrialDays: 100,
                taxRate: 150
            };
            mockLimit.mockResolvedValue([]);

            // Act & Assert
            await expect(service.updateSettings(patch)).rejects.toThrow('Validation failed:');
            const error = (await service.updateSettings(patch).catch((e: unknown) => e)) as Error;
            expect(error.message).toContain('ownerTrialDays must be between 1 and 90');
            expect(error.message).toContain('complexTrialDays must be between 1 and 90');
            expect(error.message).toContain('taxRate must be between 0 and 100');
        });

        it('should propagate error on database failure', async () => {
            // Arrange
            const patch = { ownerTrialDays: 21 };
            mockLimit.mockResolvedValue([]);
            mockOnConflictDoUpdate.mockRejectedValue(new Error('Insert failed'));

            // Act & Assert
            await expect(service.updateSettings(patch)).rejects.toThrow('Insert failed');
        });

        it('should validate ownerTrialDays minimum boundary', async () => {
            const patch = { ownerTrialDays: 0 };
            mockLimit.mockResolvedValue([]);
            await expect(service.updateSettings(patch)).rejects.toThrow(
                'ownerTrialDays must be between 1 and 90'
            );
        });

        it('should validate ownerTrialDays maximum boundary', async () => {
            const patch = { ownerTrialDays: 91 };
            mockLimit.mockResolvedValue([]);
            await expect(service.updateSettings(patch)).rejects.toThrow(
                'ownerTrialDays must be between 1 and 90'
            );
        });

        it('should validate complexTrialDays minimum boundary', async () => {
            const patch = { complexTrialDays: 0 };
            mockLimit.mockResolvedValue([]);
            await expect(service.updateSettings(patch)).rejects.toThrow(
                'complexTrialDays must be between 1 and 90'
            );
        });

        it('should validate complexTrialDays maximum boundary', async () => {
            const patch = { complexTrialDays: 91 };
            mockLimit.mockResolvedValue([]);
            await expect(service.updateSettings(patch)).rejects.toThrow(
                'complexTrialDays must be between 1 and 90'
            );
        });

        it('should validate gracePeriodDays minimum boundary', async () => {
            const patch = { gracePeriodDays: -1 };
            mockLimit.mockResolvedValue([]);
            await expect(service.updateSettings(patch)).rejects.toThrow(
                'gracePeriodDays must be between 0 and 30'
            );
        });

        it('should validate gracePeriodDays maximum boundary', async () => {
            const patch = { gracePeriodDays: 31 };
            mockLimit.mockResolvedValue([]);
            await expect(service.updateSettings(patch)).rejects.toThrow(
                'gracePeriodDays must be between 0 and 30'
            );
        });

        it('should validate currency is 3 letters', async () => {
            const patch = { currency: 'US' };
            mockLimit.mockResolvedValue([]);
            await expect(service.updateSettings(patch)).rejects.toThrow(
                'currency must be a 3-letter ISO 4217 code'
            );
        });

        it('should validate taxRate minimum boundary', async () => {
            const patch = { taxRate: -1 };
            mockLimit.mockResolvedValue([]);
            await expect(service.updateSettings(patch)).rejects.toThrow(
                'taxRate must be between 0 and 100'
            );
        });

        it('should validate taxRate maximum boundary', async () => {
            const patch = { taxRate: 101 };
            mockLimit.mockResolvedValue([]);
            await expect(service.updateSettings(patch)).rejects.toThrow(
                'taxRate must be between 0 and 100'
            );
        });

        it('should validate maxPaymentRetries minimum boundary', async () => {
            const patch = { maxPaymentRetries: -1 };
            mockLimit.mockResolvedValue([]);
            await expect(service.updateSettings(patch)).rejects.toThrow(
                'maxPaymentRetries must be between 0 and 10'
            );
        });

        it('should validate maxPaymentRetries maximum boundary', async () => {
            const patch = { maxPaymentRetries: 11 };
            mockLimit.mockResolvedValue([]);
            await expect(service.updateSettings(patch)).rejects.toThrow(
                'maxPaymentRetries must be between 0 and 10'
            );
        });

        it('should validate retryIntervalHours minimum boundary', async () => {
            const patch = { retryIntervalHours: 0 };
            mockLimit.mockResolvedValue([]);
            await expect(service.updateSettings(patch)).rejects.toThrow(
                'retryIntervalHours must be between 1 and 168'
            );
        });

        it('should validate retryIntervalHours maximum boundary', async () => {
            const patch = { retryIntervalHours: 169 };
            mockLimit.mockResolvedValue([]);
            await expect(service.updateSettings(patch)).rejects.toThrow(
                'retryIntervalHours must be between 1 and 168'
            );
        });

        it('should validate trialExpiryReminderDays minimum boundary', async () => {
            const patch = { trialExpiryReminderDays: 0 };
            mockLimit.mockResolvedValue([]);
            await expect(service.updateSettings(patch)).rejects.toThrow(
                'trialExpiryReminderDays must be between 1 and 30'
            );
        });

        it('should validate trialExpiryReminderDays maximum boundary', async () => {
            const patch = { trialExpiryReminderDays: 31 };
            mockLimit.mockResolvedValue([]);
            await expect(service.updateSettings(patch)).rejects.toThrow(
                'trialExpiryReminderDays must be between 1 and 30'
            );
        });
    });

    describe('resetSettings', () => {
        it('should return default settings', async () => {
            // Act
            const result = await service.resetSettings();

            // Assert
            expect(result).toEqual(DEFAULT_SETTINGS);
        });

        it('should upsert defaults into billing_settings table', async () => {
            // Act
            await service.resetSettings();

            // Assert - first insert is into billingSettings
            expect(insertCalls.length).toBe(2);
            expect(insertCalls[0]?.table).toBe(billingSettings);
            expect(mockOnConflictDoUpdate).toHaveBeenCalledWith(
                expect.objectContaining({
                    target: billingSettings.key
                })
            );
        });

        it('should insert reset audit log entry', async () => {
            // Act
            await service.resetSettings();

            // Assert - second insert is into billingAuditLogs
            expect(insertCalls[1]?.table).toBe(billingAuditLogs);
            expect(insertCalls[1]?.values).toEqual(
                expect.objectContaining({
                    action: 'billing_settings_reset',
                    entityType: 'settings',
                    entityId: 'global',
                    actorId: null,
                    actorType: 'system',
                    changes: DEFAULT_SETTINGS,
                    previousValues: null,
                    livemode: true,
                    ipAddress: null,
                    userAgent: null
                })
            );
        });

        it('should include actorId in audit entry when provided', async () => {
            // Arrange
            const actorId = 'admin_456';

            // Act
            await service.resetSettings(actorId);

            // Assert
            expect(insertCalls[1]?.values).toEqual(
                expect.objectContaining({
                    actorId: actorId,
                    actorType: 'admin'
                })
            );
        });

        it('should throw on database failure', async () => {
            // Arrange
            mockOnConflictDoUpdate.mockRejectedValue(new Error('Insert failed'));

            // Act & Assert
            await expect(service.resetSettings()).rejects.toThrow('Insert failed');
        });
    });

    describe('validateSettings - edge cases', () => {
        it('should accept valid settings at minimum boundaries', async () => {
            // Arrange
            const patch = {
                ownerTrialDays: 1,
                complexTrialDays: 1,
                gracePeriodDays: 0,
                taxRate: 0,
                maxPaymentRetries: 0,
                retryIntervalHours: 1,
                trialExpiryReminderDays: 1
            };
            mockLimit.mockResolvedValue([]);

            // Act
            const result = await service.updateSettings(patch);

            // Assert
            expect(result.ownerTrialDays).toBe(1);
            expect(result.gracePeriodDays).toBe(0);
        });

        it('should accept valid settings at maximum boundaries', async () => {
            // Arrange
            const patch = {
                ownerTrialDays: 90,
                complexTrialDays: 90,
                gracePeriodDays: 30,
                taxRate: 100,
                maxPaymentRetries: 10,
                retryIntervalHours: 168,
                trialExpiryReminderDays: 30
            };
            mockLimit.mockResolvedValue([]);

            // Act
            const result = await service.updateSettings(patch);

            // Assert
            expect(result.ownerTrialDays).toBe(90);
            expect(result.maxPaymentRetries).toBe(10);
        });

        it('should merge existing custom settings with new patch', async () => {
            // Arrange
            const existingSettings = {
                ownerTrialDays: 30,
                currency: 'USD',
                taxRate: 15
            };

            const mockRow = {
                key: 'global',
                value: existingSettings
            };

            mockLimit.mockResolvedValue([mockRow]);

            const patch = { ownerTrialDays: 45 };

            // Act
            const result = await service.updateSettings(patch);

            // Assert
            expect(result.ownerTrialDays).toBe(45);
            expect(result.currency).toBe('USD');
            expect(result.taxRate).toBe(15);
            expect(result.complexTrialDays).toBe(DEFAULT_SETTINGS.complexTrialDays);
        });
    });

    describe('getBillingSettingsService (singleton)', () => {
        beforeEach(() => {
            resetBillingSettingsService();
        });

        it('should return the same instance on multiple calls', () => {
            // Act
            const instance1 = getBillingSettingsService();
            const instance2 = getBillingSettingsService();

            // Assert
            expect(instance1).toBe(instance2);
        });

        it('should return a new instance after reset', () => {
            // Arrange
            const instance1 = getBillingSettingsService();

            // Act
            resetBillingSettingsService();
            const instance2 = getBillingSettingsService();

            // Assert
            expect(instance1).not.toBe(instance2);
        });

        it('should return an instance of BillingSettingsService', () => {
            // Act
            const instance = getBillingSettingsService();

            // Assert
            expect(instance).toBeInstanceOf(BillingSettingsService);
        });
    });
});
