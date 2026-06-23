/**
 * Unit tests for SocialSettingService.
 *
 * Covers:
 * - listAll masks secret values (type === 'secret')
 * - list via inherited method masks secret values via _afterList hook
 * - getById masks secret values via _afterGetByField hook
 * - updateByKey returns NOT_FOUND when key does not exist
 * - updateByKey writes an audit row on success
 * - updateByKey redacts value in audit row for secret settings
 * - updateByKey returns masked value for secret settings
 * - Permission-denied path for SOCIAL_SETTINGS_MANAGE
 * - Create is FORBIDDEN (managed via migrations)
 */

import type { SocialAuditLogModel, SocialSettingModel } from '@repo/db';
import { PermissionEnum, ServiceErrorCode } from '@repo/schemas';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SocialSettingService } from '../../../src/services/social/social-setting.service';
import { createActor } from '../../factories/actorFactory';
import { createLoggerMock, createModelMock } from '../../utils/modelMockFactory';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const MOCK_UUID = '00000000-0000-4000-8000-000000000001';

function buildMockSetting(overrides: Record<string, unknown> = {}) {
    return {
        id: MOCK_UUID,
        key: 'make_webhook_url',
        value: 'https://hook.make.com/secret-path',
        type: 'string',
        active: true,
        description: 'Make.com webhook URL',
        createdAt: new Date(),
        updatedAt: new Date(),
        ...overrides
    };
}

function buildSecretSetting(overrides: Record<string, unknown> = {}) {
    return buildMockSetting({
        key: 'api_key',
        value: 'super-secret-api-key',
        type: 'secret',
        description: 'External API key',
        ...overrides
    });
}

// ---------------------------------------------------------------------------
// listAll — secret masking
// ---------------------------------------------------------------------------

describe('SocialSettingService.listAll — secret masking', () => {
    let service: SocialSettingService;
    let settingModelMock: ReturnType<typeof createModelMock>;
    let auditModelMock: ReturnType<typeof createModelMock>;
    let loggerMock: ReturnType<typeof createLoggerMock>;

    beforeEach(() => {
        settingModelMock = createModelMock();
        auditModelMock = createModelMock();
        loggerMock = createLoggerMock();
        service = new SocialSettingService(
            { logger: loggerMock },
            settingModelMock as unknown as SocialSettingModel,
            auditModelMock as unknown as SocialAuditLogModel
        );
        vi.clearAllMocks();
    });

    it('should mask value for settings with type === "secret"', async () => {
        // Arrange
        const actor = createActor({ permissions: [PermissionEnum.SOCIAL_SETTINGS_MANAGE] });
        const secretSetting = buildSecretSetting();
        const normalSetting = buildMockSetting({ key: 'timezone', value: 'UTC', type: 'string' });
        settingModelMock.findAll.mockResolvedValue({
            items: [secretSetting, normalSetting],
            total: 2
        });

        // Act
        const results = await service.listAll(actor);

        // Assert
        const secret = results.find((s) => s.key === 'api_key');
        const normal = results.find((s) => s.key === 'timezone');
        expect(secret?.value).toBe('***');
        expect(normal?.value).toBe('UTC');
    });

    it('should not mask non-secret settings', async () => {
        // Arrange
        const actor = createActor({ permissions: [PermissionEnum.SOCIAL_SETTINGS_MANAGE] });
        const setting = buildMockSetting({ type: 'string', value: 'https://example.com' });
        settingModelMock.findAll.mockResolvedValue({ items: [setting], total: 1 });

        // Act
        const results = await service.listAll(actor);

        // Assert
        expect(results[0]?.value).toBe('https://example.com');
    });

    it('should return FORBIDDEN when actor lacks SOCIAL_SETTINGS_MANAGE', async () => {
        // Arrange
        const actor = createActor({ permissions: [] });

        // Act & Assert
        await expect(service.listAll(actor)).rejects.toMatchObject({
            code: ServiceErrorCode.FORBIDDEN
        });
    });
});

// ---------------------------------------------------------------------------
// list (inherited) — _afterList hook masks secrets
// ---------------------------------------------------------------------------

describe('SocialSettingService.list — _afterList secret masking', () => {
    let service: SocialSettingService;
    let settingModelMock: ReturnType<typeof createModelMock>;
    let auditModelMock: ReturnType<typeof createModelMock>;
    let loggerMock: ReturnType<typeof createLoggerMock>;

    beforeEach(() => {
        settingModelMock = createModelMock();
        auditModelMock = createModelMock();
        loggerMock = createLoggerMock();
        service = new SocialSettingService(
            { logger: loggerMock },
            settingModelMock as unknown as SocialSettingModel,
            auditModelMock as unknown as SocialAuditLogModel
        );
        vi.clearAllMocks();
    });

    it('should mask secret values in paginated list result', async () => {
        // Arrange
        const actor = createActor({ permissions: [PermissionEnum.SOCIAL_SETTINGS_MANAGE] });
        const secretSetting = buildSecretSetting();
        settingModelMock.findAll.mockResolvedValue({ items: [secretSetting], total: 1 });

        // Act
        const result = await service.list(actor, {});

        // Assert
        expect(result.error).toBeUndefined();
        const item = result.data?.items?.[0];
        expect(item?.value).toBe('***');
    });

    it('should return FORBIDDEN when actor lacks SOCIAL_SETTINGS_MANAGE for list', async () => {
        // Arrange
        const actor = createActor({ permissions: [] });
        settingModelMock.findAll.mockResolvedValue({ items: [], total: 0 });

        // Act
        const result = await service.list(actor, {});

        // Assert
        expect(result.error).toBeDefined();
        expect(result.error?.code).toBe(ServiceErrorCode.FORBIDDEN);
    });
});

// ---------------------------------------------------------------------------
// getById — _afterGetByField hook masks secrets
// ---------------------------------------------------------------------------

describe('SocialSettingService.getById — _afterGetByField secret masking', () => {
    let service: SocialSettingService;
    let settingModelMock: ReturnType<typeof createModelMock>;
    let auditModelMock: ReturnType<typeof createModelMock>;
    let loggerMock: ReturnType<typeof createLoggerMock>;

    beforeEach(() => {
        settingModelMock = createModelMock();
        auditModelMock = createModelMock();
        loggerMock = createLoggerMock();
        service = new SocialSettingService(
            { logger: loggerMock },
            settingModelMock as unknown as SocialSettingModel,
            auditModelMock as unknown as SocialAuditLogModel
        );
        vi.clearAllMocks();
    });

    it('should mask secret value when fetched by id', async () => {
        // Arrange
        const actor = createActor({ permissions: [PermissionEnum.SOCIAL_SETTINGS_MANAGE] });
        const secretSetting = buildSecretSetting();
        // getById → getByField('id', ...) → model.findOne({ id: ... })
        settingModelMock.findOne.mockResolvedValue(secretSetting);

        // Act
        const result = await service.getById(actor, MOCK_UUID);

        // Assert
        expect(result.error).toBeUndefined();
        expect(result.data?.value).toBe('***');
    });

    it('should not mask non-secret value when fetched by id', async () => {
        // Arrange
        const actor = createActor({ permissions: [PermissionEnum.SOCIAL_SETTINGS_MANAGE] });
        const setting = buildMockSetting({ type: 'string', value: 'UTC' });
        // getById → getByField('id', ...) → model.findOne({ id: ... })
        settingModelMock.findOne.mockResolvedValue(setting);

        // Act
        const result = await service.getById(actor, MOCK_UUID);

        // Assert
        expect(result.data?.value).toBe('UTC');
    });
});

// ---------------------------------------------------------------------------
// updateByKey
// ---------------------------------------------------------------------------

describe('SocialSettingService.updateByKey — not-found path', () => {
    let service: SocialSettingService;
    let settingModelMock: ReturnType<typeof createModelMock>;
    let auditModelMock: ReturnType<typeof createModelMock>;
    let loggerMock: ReturnType<typeof createLoggerMock>;

    beforeEach(() => {
        settingModelMock = createModelMock();
        auditModelMock = createModelMock();
        loggerMock = createLoggerMock();
        service = new SocialSettingService(
            { logger: loggerMock },
            settingModelMock as unknown as SocialSettingModel,
            auditModelMock as unknown as SocialAuditLogModel
        );
        vi.clearAllMocks();
    });

    it('should throw NOT_FOUND when key does not exist', async () => {
        // Arrange
        const actor = createActor({ permissions: [PermissionEnum.SOCIAL_SETTINGS_MANAGE] });
        settingModelMock.findOne.mockResolvedValue(null);

        // Act & Assert
        await expect(service.updateByKey(actor, 'nonexistent_key', 'value')).rejects.toMatchObject({
            code: ServiceErrorCode.NOT_FOUND
        });
        expect(settingModelMock.update).not.toHaveBeenCalled();
    });

    it('should return FORBIDDEN when actor lacks SOCIAL_SETTINGS_MANAGE', async () => {
        // Arrange
        const actor = createActor({ permissions: [] });

        // Act & Assert
        await expect(service.updateByKey(actor, 'some_key', 'value')).rejects.toMatchObject({
            code: ServiceErrorCode.FORBIDDEN
        });
    });
});

describe('SocialSettingService.updateByKey — audit row and masking', () => {
    let service: SocialSettingService;
    let settingModelMock: ReturnType<typeof createModelMock>;
    let auditModelMock: ReturnType<typeof createModelMock>;
    let loggerMock: ReturnType<typeof createLoggerMock>;

    beforeEach(() => {
        settingModelMock = createModelMock();
        auditModelMock = createModelMock();
        loggerMock = createLoggerMock();
        service = new SocialSettingService(
            { logger: loggerMock },
            settingModelMock as unknown as SocialSettingModel,
            auditModelMock as unknown as SocialAuditLogModel
        );
        vi.clearAllMocks();
    });

    it('should write an audit row on successful updateByKey', async () => {
        // Arrange
        const actor = createActor({ permissions: [PermissionEnum.SOCIAL_SETTINGS_MANAGE] });
        const existing = buildMockSetting({ type: 'string', value: 'old-url' });
        const updated = buildMockSetting({ type: 'string', value: 'new-url' });
        settingModelMock.findOne.mockResolvedValue(existing);
        settingModelMock.update.mockResolvedValue(updated);
        auditModelMock.create.mockResolvedValue({ id: 'audit-id' });

        // Act
        const result = await service.updateByKey(actor, 'make_webhook_url', 'new-url');

        // Assert
        expect(result.entity).toBeDefined();
        expect(auditModelMock.create).toHaveBeenCalledTimes(1);
        const auditCall = auditModelMock.create.mock.calls[0]?.[0] as Record<string, unknown>;
        expect(auditCall?.eventType).toBe('SETTING_UPDATED');
        expect(auditCall?.entityType).toBe('social_setting');
        expect(auditCall?.entityId).toBe(MOCK_UUID);
    });

    it('should write audit row with actorId from actor', async () => {
        // Arrange
        const actor = createActor({ permissions: [PermissionEnum.SOCIAL_SETTINGS_MANAGE] });
        const existing = buildMockSetting({ type: 'string', value: 'old' });
        const updated = buildMockSetting({ type: 'string', value: 'new' });
        settingModelMock.findOne.mockResolvedValue(existing);
        settingModelMock.update.mockResolvedValue(updated);
        auditModelMock.create.mockResolvedValue({ id: 'audit-id' });

        // Act
        await service.updateByKey(actor, 'make_webhook_url', 'new');

        // Assert
        const auditCall = auditModelMock.create.mock.calls[0]?.[0] as Record<string, unknown>;
        expect(auditCall?.actorId).toBe(actor.id);
    });

    it('should redact value in audit row when setting type is secret', async () => {
        // Arrange
        const actor = createActor({ permissions: [PermissionEnum.SOCIAL_SETTINGS_MANAGE] });
        const existing = buildSecretSetting({ value: 'old-secret' });
        const updated = buildSecretSetting({ value: 'new-secret' });
        settingModelMock.findOne.mockResolvedValue(existing);
        settingModelMock.update.mockResolvedValue(updated);
        auditModelMock.create.mockResolvedValue({ id: 'audit-id' });

        // Act
        const result = await service.updateByKey(actor, 'api_key', 'new-secret');

        // Assert — audit row contains *** not the real secret
        const auditCall = auditModelMock.create.mock.calls[0]?.[0] as Record<string, unknown>;
        const oldVal = (auditCall?.oldValueJson as Record<string, unknown>)?.value;
        const newVal = (auditCall?.newValueJson as Record<string, unknown>)?.value;
        expect(oldVal).toBe('***');
        expect(newVal).toBe('***');
        // And the returned entity also has masked value
        expect(result.entity.value).toBe('***');
    });

    it('should NOT redact value in audit row for non-secret settings', async () => {
        // Arrange
        const actor = createActor({ permissions: [PermissionEnum.SOCIAL_SETTINGS_MANAGE] });
        const existing = buildMockSetting({ type: 'string', value: 'UTC' });
        const updated = buildMockSetting({ type: 'string', value: 'America/Buenos_Aires' });
        settingModelMock.findOne.mockResolvedValue(existing);
        settingModelMock.update.mockResolvedValue(updated);
        auditModelMock.create.mockResolvedValue({ id: 'audit-id' });

        // Act
        const result = await service.updateByKey(actor, 'default_timezone', 'America/Buenos_Aires');

        // Assert — audit row preserves the real value for non-secrets
        const auditCall = auditModelMock.create.mock.calls[0]?.[0] as Record<string, unknown>;
        const oldVal = (auditCall?.oldValueJson as Record<string, unknown>)?.value;
        const newVal = (auditCall?.newValueJson as Record<string, unknown>)?.value;
        expect(oldVal).toBe('UTC');
        expect(newVal).toBe('America/Buenos_Aires');
        // And the returned entity exposes the real value
        expect(result.entity.value).toBe('America/Buenos_Aires');
    });
});

// ---------------------------------------------------------------------------
// create — FORBIDDEN gating
// ---------------------------------------------------------------------------

describe('SocialSettingService.create — managed-only gating', () => {
    let service: SocialSettingService;
    let settingModelMock: ReturnType<typeof createModelMock>;
    let auditModelMock: ReturnType<typeof createModelMock>;
    let loggerMock: ReturnType<typeof createLoggerMock>;

    beforeEach(() => {
        settingModelMock = createModelMock();
        auditModelMock = createModelMock();
        loggerMock = createLoggerMock();
        service = new SocialSettingService(
            { logger: loggerMock },
            settingModelMock as unknown as SocialSettingModel,
            auditModelMock as unknown as SocialAuditLogModel
        );
        vi.clearAllMocks();
    });

    it('should return FORBIDDEN on create regardless of actor permissions', async () => {
        // Arrange
        const actor = createActor({ permissions: Object.values(PermissionEnum) });
        const input = {
            key: 'new_key',
            value: 'value',
            type: 'string' as const,
            active: true
        };

        // Act
        const result = await service.create(actor, input);

        // Assert
        expect(result.error).toBeDefined();
        expect(result.error?.code).toBe(ServiceErrorCode.FORBIDDEN);
        expect(settingModelMock.create).not.toHaveBeenCalled();
    });
});
