import type { FeatureId, FeatureType, UserId } from '@repo/types';
import { LifecycleStatusEnum } from '@repo/types';

/**
 * Returns a mock FeatureType object with default values. You can override any field.
 * @param overrides - Partial fields to override in the mock.
 * @returns FeatureType
 * @example
 * const feature = getMockFeature({ id: 'feature-2' as FeatureId });
 */
export const getMockFeature = (overrides: Partial<FeatureType> = {}): FeatureType => ({
    id: 'feature-uuid' as FeatureId,
    name: 'General Feature',
    description: 'A general feature',
    icon: 'star',
    isBuiltin: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    createdById: 'user-uuid' as UserId,
    updatedById: 'user-uuid' as UserId,
    lifecycleState: LifecycleStatusEnum.ACTIVE,
    ...overrides
});

export const createMockFeature = (overrides: Partial<FeatureType> = {}): FeatureType =>
    getMockFeature(overrides);

export const getMockFeatureId = (id?: string): FeatureId =>
    (id && /^[0-9a-fA-F-]{36}$/.test(id)
        ? id
        : '77777777-7777-7777-7777-777777777777') as FeatureId;
