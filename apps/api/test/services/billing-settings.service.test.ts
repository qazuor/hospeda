/**
 * Tests for BillingSettingsService
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BillingSettingsService } from '../../src/services/billing-settings.service';

// Hoist shared mock functions for drizzle operators
const { mockDesc, mockEq, mockAnd } = vi.hoisted(() => ({
    mockDesc: vi.fn((field: string) => ({ desc: field })),
    mockEq: vi.fn((field: string, value: unknown) => ({ eq: field, value })),
    mockAnd: vi.fn((...conditions: unknown[]) => ({ and: conditions }))
}));

// Mock drizzle-orm (the service imports and/desc/eq from here)
vi.mock('drizzle-orm', () => ({
    desc: mockDesc,
    eq: mockEq,
    and: mockAnd
}));

// Mock @repo/db (also re-exports drizzle operators)
vi.mock('@repo/db', () => ({
    getDb: vi.fn(),
    billingAuditLogs: {
        action: 'action',
        entityType: 'entityType',
        entityId: 'entityId',
        actorId: 'actorId',
        metadata: 'metadata',
        livemode: 'livemode',
        createdAt: 'createdAt'
    },
    desc: mockDesc,
    eq: mockEq,
    and: mockAnd
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
import { billingAuditLogs, getDb } from '@repo/db';
import { and, desc, eq } from '@repo/db';

describe('BillingSettingsService', () => {
    let service: BillingSettingsService;

    // Mock database methods
    let mockSelect: ReturnType<typeof vi.fn>;
    let mockFrom: ReturnType<typeof vi.fn>;
    let mockWhere: ReturnType<typeof vi.fn>;
    let mockOrderBy: ReturnType<typeof vi.fn>;
    let mockLimit: ReturnType<typeof vi.fn>;
    let mockInsert: ReturnType<typeof vi.fn>;
    let mockValues: ReturnType<typeof vi.fn>;
    let mockDb: any;

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

        // Create chainable mock methods
        mockSelect = vi.fn().mockReturnThis();
        mockFrom = vi.fn().mockReturnThis();
        mockWhere = vi.fn().mockReturnThis();
        mockOrderBy = vi.fn().mockReturnThis();
        mockLimit = vi.fn().mockResolvedValue([]);
        mockInsert = vi.fn().mockReturnThis();
        mockValues = vi.fn().mockResolvedValue(undefined);

        // Setup mock db with chainable methods
        mockDb = {
            select: mockSelect,
            insert: mockInsert
        };

        mockSelect.mockReturnValue({
            from: mockFrom
        });

        mockFrom.mockReturnValue({
            where: mockWhere
        });

        mockWhere.mockReturnValue({
            orderBy: mockOrderBy
        });

        mockOrderBy.mockReturnValue({
            limit: mockLimit
        });

        mockInsert.mockReturnValue({
            values: mockValues
        });

        vi.mocked(getDb).mockReturnValue(mockDb);

        // Create service instance
        service = new BillingSettingsService();
    });

    describe('getSettings', () => {
        it('should return default settings when no entries found', async () => {
            // Arrange
            mockLimit.mockResolvedValue([]);

            // Act
            const result = await service.getSettings();

            // Assert
            expect(result).toEqual(DEFAULT_SETTINGS);
            expect(getDb).toHaveBeenCalled();
            expect(mockDb.select).toHaveBeenCalled();
            expect(mockFrom).toHaveBeenCalledWith(billingAuditLogs);
            expect(and).toHaveBeenCalled();
            expect(eq).toHaveBeenCalledWith(billingAuditLogs.action, 'billing_settings_update');
            expect(eq).toHaveBeenCalledWith(billingAuditLogs.entityType, 'settings');
            expect(eq).toHaveBeenCalledWith(billingAuditLogs.entityId, 'global');
            expect(desc).toHaveBeenCalledWith(billingAuditLogs.createdAt);
        });

        it('should return merged settings when custom entry found', async () => {
            // Arrange
            const customSettings = {
                ownerTrialDays: 30,
                currency: 'USD'
            };

            const mockEntry = {
                action: 'billing_settings_update',
                entityType: 'settings',
                entityId: 'global',
                metadata: customSettings,
                createdAt: new Date()
            };

            mockLimit.mockResolvedValue([mockEntry]);

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

        it('should return defaults when metadata is null', async () => {
            // Arrange
            const mockEntry = {
                action: 'billing_settings_update',
                entityType: 'settings',
                entityId: 'global',
                metadata: null,
                createdAt: new Date()
            };

            mockLimit.mockResolvedValue([mockEntry]);

            // Act
            const result = await service.getSettings();

            // Assert
            expect(result).toEqual(DEFAULT_SETTINGS);
        });

        it('should return defaults when metadata is invalid', async () => {
            // Arrange
            const mockEntry = {
                action: 'billing_settings_update',
                entityType: 'settings',
                entityId: 'global',
                metadata: 'invalid-string',
                createdAt: new Date()
            };

            mockLimit.mockResolvedValue([mockEntry]);

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
            const patch = {
                ownerTrialDays: 21
            };

            mockLimit.mockResolvedValue([]);

            // Act
            const result = await service.updateSettings(patch);

            // Assert
            expect(result).toEqual({
                ...DEFAULT_SETTINGS,
                ownerTrialDays: 21
            });
            expect(mockDb.insert).toHaveBeenCalledWith(billingAuditLogs);
            expect(mockValues).toHaveBeenCalled();
        });

        it('should insert audit log entry with correct data', async () => {
            // Arrange
            const patch = {
                ownerTrialDays: 21,
                currency: 'USD'
            };

            mockLimit.mockResolvedValue([]);

            // Act
            await service.updateSettings(patch);

            // Assert
            expect(mockValues).toHaveBeenCalledWith({
                action: 'billing_settings_update',
                entityType: 'settings',
                entityId: 'global',
                actorId: null,
                metadata: {
                    ...DEFAULT_SETTINGS,
                    ...patch
                },
                livemode: true
            });
        });

        it('should include actorId in audit entry when provided', async () => {
            // Arrange
            const patch = { ownerTrialDays: 21 };
            const actorId = 'admin_123';

            mockLimit.mockResolvedValue([]);

            // Act
            await service.updateSettings(patch, actorId);

            // Assert
            expect(mockValues).toHaveBeenCalledWith({
                action: 'billing_settings_update',
                entityType: 'settings',
                entityId: 'global',
                actorId: actorId,
                metadata: expect.any(Object),
                livemode: true
            });
        });

        it('should throw on validation failure - ownerTrialDays zero', async () => {
            // Arrange
            const patch = { ownerTrialDays: 0 };
            mockLimit.mockResolvedValue([]);

            // Act & Assert
            await expect(service.updateSettings(patch)).rejects.toThrow(
                'Validation failed: ownerTrialDays must be between 1 and 90'
            );
            expect(mockValues).not.toHaveBeenCalled();
        });

        it('should throw on validation failure - invalid currency', async () => {
            // Arrange
            const patch = { currency: 'ARSSS' };
            mockLimit.mockResolvedValue([]);

            // Act & Assert
            await expect(service.updateSettings(patch)).rejects.toThrow(
                'Validation failed: currency must be a 3-letter ISO 4217 code'
            );
            expect(mockValues).not.toHaveBeenCalled();
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
            const error = await service.updateSettings(patch).catch((e) => e);
            expect(error.message).toContain('ownerTrialDays must be between 1 and 90');
            expect(error.message).toContain('complexTrialDays must be between 1 and 90');
            expect(error.message).toContain('taxRate must be between 0 and 100');
        });

        it('should propagate error on database failure', async () => {
            // Arrange
            const patch = { ownerTrialDays: 21 };
            mockLimit.mockResolvedValue([]);
            mockValues.mockRejectedValue(new Error('Insert failed'));

            // Act & Assert
            await expect(service.updateSettings(patch)).rejects.toThrow('Insert failed');
        });

        it('should validate ownerTrialDays minimum boundary', async () => {
            // Arrange
            const patch = { ownerTrialDays: 0 };
            mockLimit.mockResolvedValue([]);

            // Act & Assert
            await expect(service.updateSettings(patch)).rejects.toThrow(
                'ownerTrialDays must be between 1 and 90'
            );
        });

        it('should validate ownerTrialDays maximum boundary', async () => {
            // Arrange
            const patch = { ownerTrialDays: 91 };
            mockLimit.mockResolvedValue([]);

            // Act & Assert
            await expect(service.updateSettings(patch)).rejects.toThrow(
                'ownerTrialDays must be between 1 and 90'
            );
        });

        it('should validate complexTrialDays minimum boundary', async () => {
            // Arrange
            const patch = { complexTrialDays: 0 };
            mockLimit.mockResolvedValue([]);

            // Act & Assert
            await expect(service.updateSettings(patch)).rejects.toThrow(
                'complexTrialDays must be between 1 and 90'
            );
        });

        it('should validate complexTrialDays maximum boundary', async () => {
            // Arrange
            const patch = { complexTrialDays: 91 };
            mockLimit.mockResolvedValue([]);

            // Act & Assert
            await expect(service.updateSettings(patch)).rejects.toThrow(
                'complexTrialDays must be between 1 and 90'
            );
        });

        it('should validate gracePeriodDays minimum boundary', async () => {
            // Arrange
            const patch = { gracePeriodDays: -1 };
            mockLimit.mockResolvedValue([]);

            // Act & Assert
            await expect(service.updateSettings(patch)).rejects.toThrow(
                'gracePeriodDays must be between 0 and 30'
            );
        });

        it('should validate gracePeriodDays maximum boundary', async () => {
            // Arrange
            const patch = { gracePeriodDays: 31 };
            mockLimit.mockResolvedValue([]);

            // Act & Assert
            await expect(service.updateSettings(patch)).rejects.toThrow(
                'gracePeriodDays must be between 0 and 30'
            );
        });

        it('should validate currency is 3 letters', async () => {
            // Arrange
            const patch = { currency: 'US' };
            mockLimit.mockResolvedValue([]);

            // Act & Assert
            await expect(service.updateSettings(patch)).rejects.toThrow(
                'currency must be a 3-letter ISO 4217 code'
            );
        });

        it('should validate taxRate minimum boundary', async () => {
            // Arrange
            const patch = { taxRate: -1 };
            mockLimit.mockResolvedValue([]);

            // Act & Assert
            await expect(service.updateSettings(patch)).rejects.toThrow(
                'taxRate must be between 0 and 100'
            );
        });

        it('should validate taxRate maximum boundary', async () => {
            // Arrange
            const patch = { taxRate: 101 };
            mockLimit.mockResolvedValue([]);

            // Act & Assert
            await expect(service.updateSettings(patch)).rejects.toThrow(
                'taxRate must be between 0 and 100'
            );
        });

        it('should validate maxPaymentRetries minimum boundary', async () => {
            // Arrange
            const patch = { maxPaymentRetries: -1 };
            mockLimit.mockResolvedValue([]);

            // Act & Assert
            await expect(service.updateSettings(patch)).rejects.toThrow(
                'maxPaymentRetries must be between 0 and 10'
            );
        });

        it('should validate maxPaymentRetries maximum boundary', async () => {
            // Arrange
            const patch = { maxPaymentRetries: 11 };
            mockLimit.mockResolvedValue([]);

            // Act & Assert
            await expect(service.updateSettings(patch)).rejects.toThrow(
                'maxPaymentRetries must be between 0 and 10'
            );
        });

        it('should validate retryIntervalHours minimum boundary', async () => {
            // Arrange
            const patch = { retryIntervalHours: 0 };
            mockLimit.mockResolvedValue([]);

            // Act & Assert
            await expect(service.updateSettings(patch)).rejects.toThrow(
                'retryIntervalHours must be between 1 and 168'
            );
        });

        it('should validate retryIntervalHours maximum boundary', async () => {
            // Arrange
            const patch = { retryIntervalHours: 169 };
            mockLimit.mockResolvedValue([]);

            // Act & Assert
            await expect(service.updateSettings(patch)).rejects.toThrow(
                'retryIntervalHours must be between 1 and 168'
            );
        });

        it('should validate trialExpiryReminderDays minimum boundary', async () => {
            // Arrange
            const patch = { trialExpiryReminderDays: 0 };
            mockLimit.mockResolvedValue([]);

            // Act & Assert
            await expect(service.updateSettings(patch)).rejects.toThrow(
                'trialExpiryReminderDays must be between 1 and 30'
            );
        });

        it('should validate trialExpiryReminderDays maximum boundary', async () => {
            // Arrange
            const patch = { trialExpiryReminderDays: 31 };
            mockLimit.mockResolvedValue([]);

            // Act & Assert
            await expect(service.updateSettings(patch)).rejects.toThrow(
                'trialExpiryReminderDays must be between 1 and 30'
            );
        });
    });

    describe('resetSettings', () => {
        it('should return default settings', async () => {
            // Arrange
            mockValues.mockResolvedValue(undefined);

            // Act
            const result = await service.resetSettings();

            // Assert
            expect(result).toEqual(DEFAULT_SETTINGS);
        });

        it('should insert reset audit log entry', async () => {
            // Arrange
            mockValues.mockResolvedValue(undefined);

            // Act
            await service.resetSettings();

            // Assert
            expect(mockDb.insert).toHaveBeenCalledWith(billingAuditLogs);
            expect(mockValues).toHaveBeenCalledWith({
                action: 'billing_settings_reset',
                entityType: 'settings',
                entityId: 'global',
                actorId: null,
                metadata: DEFAULT_SETTINGS,
                livemode: true
            });
        });

        it('should include actorId in audit entry when provided', async () => {
            // Arrange
            const actorId = 'admin_456';
            mockValues.mockResolvedValue(undefined);

            // Act
            await service.resetSettings(actorId);

            // Assert
            expect(mockValues).toHaveBeenCalledWith({
                action: 'billing_settings_reset',
                entityType: 'settings',
                entityId: 'global',
                actorId: actorId,
                metadata: DEFAULT_SETTINGS,
                livemode: true
            });
        });

        it('should throw on database failure', async () => {
            // Arrange
            mockValues.mockRejectedValue(new Error('Insert failed'));

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

            const mockEntry = {
                action: 'billing_settings_update',
                entityType: 'settings',
                entityId: 'global',
                metadata: existingSettings,
                createdAt: new Date()
            };

            mockLimit.mockResolvedValue([mockEntry]);

            const patch = {
                ownerTrialDays: 45
            };

            // Act
            const result = await service.updateSettings(patch);

            // Assert
            expect(result.ownerTrialDays).toBe(45);
            expect(result.currency).toBe('USD');
            expect(result.taxRate).toBe(15);
            expect(result.complexTrialDays).toBe(DEFAULT_SETTINGS.complexTrialDays);
        });
    });
});
