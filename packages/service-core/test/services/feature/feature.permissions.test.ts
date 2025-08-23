// TODO [85fa4251-5215-4acd-8b2d-d0d36b245b9c]: Implement tests for all permission check functions in feature.permissions.ts, covering all permission and error scenarios.

import type { FeatureType } from '@repo/types';
import { PermissionEnum, ServiceErrorCode } from '@repo/types';
import { describe, expect, it } from 'vitest';
import {
    checkCanAddFeatureToAccommodation,
    checkCanCountFeatures,
    checkCanCreateFeature,
    checkCanDeleteFeature,
    checkCanListFeatures,
    checkCanRemoveFeatureFromAccommodation,
    checkCanUpdateFeature,
    checkCanViewFeature
} from '../../../src/services/feature/feature.permissions';
import { createActor } from '../../factories/actorFactory';
import { FeatureFactoryBuilder } from '../../factories/featureFactory';

describe('feature.permissions', () => {
    const actorWithPerm = createActor({
        permissions: [PermissionEnum.ACCOMMODATION_FEATURES_EDIT]
    });
    const actorNoPerm = createActor({ permissions: [] });
    const dummyFeature: FeatureType = FeatureFactoryBuilder.create();

    function expectForbiddenError(err: unknown) {
        if (typeof err === 'object' && err !== null && 'code' in err) {
            expect((err as { code: unknown }).code).toBe(ServiceErrorCode.FORBIDDEN);
        } else {
            throw err;
        }
    }

    it('checkCanCreateFeature allows with permission', () => {
        expect(() => checkCanCreateFeature(actorWithPerm)).not.toThrow();
    });
    it('checkCanCreateFeature throws FORBIDDEN without permission', () => {
        try {
            checkCanCreateFeature(actorNoPerm);
            throw new Error('Should have thrown');
        } catch (err: unknown) {
            expectForbiddenError(err);
        }
    });

    it('checkCanUpdateFeature allows with permission', () => {
        expect(() => checkCanUpdateFeature(actorWithPerm, dummyFeature)).not.toThrow();
    });
    it('checkCanUpdateFeature throws FORBIDDEN without permission', () => {
        try {
            checkCanUpdateFeature(actorNoPerm, dummyFeature);
            throw new Error('Should have thrown');
        } catch (err: unknown) {
            expectForbiddenError(err);
        }
    });

    it('checkCanDeleteFeature allows with permission', () => {
        expect(() => checkCanDeleteFeature(actorWithPerm, dummyFeature)).not.toThrow();
    });
    it('checkCanDeleteFeature throws FORBIDDEN without permission', () => {
        try {
            checkCanDeleteFeature(actorNoPerm, dummyFeature);
            throw new Error('Should have thrown');
        } catch (err: unknown) {
            expectForbiddenError(err);
        }
    });

    it('checkCanViewFeature always allows', () => {
        expect(() => checkCanViewFeature(actorWithPerm, dummyFeature)).not.toThrow();
        expect(() => checkCanViewFeature(actorNoPerm, dummyFeature)).not.toThrow();
    });

    it('checkCanListFeatures allows with permission', () => {
        expect(() => checkCanListFeatures(actorWithPerm)).not.toThrow();
    });
    it('checkCanListFeatures throws FORBIDDEN without permission', () => {
        try {
            checkCanListFeatures(actorNoPerm);
            throw new Error('Should have thrown');
        } catch (err: unknown) {
            expectForbiddenError(err);
        }
    });

    it('checkCanCountFeatures allows with permission', () => {
        expect(() => checkCanCountFeatures(actorWithPerm)).not.toThrow();
    });
    it('checkCanCountFeatures throws FORBIDDEN without permission', () => {
        try {
            checkCanCountFeatures(actorNoPerm);
            throw new Error('Should have thrown');
        } catch (err: unknown) {
            expectForbiddenError(err);
        }
    });

    it('checkCanAddFeatureToAccommodation allows with permission', () => {
        expect(() => checkCanAddFeatureToAccommodation(actorWithPerm)).not.toThrow();
    });
    it('checkCanAddFeatureToAccommodation throws FORBIDDEN without permission', () => {
        try {
            checkCanAddFeatureToAccommodation(actorNoPerm);
            throw new Error('Should have thrown');
        } catch (err: unknown) {
            expectForbiddenError(err);
        }
    });

    it('checkCanRemoveFeatureFromAccommodation allows with permission', () => {
        expect(() => checkCanRemoveFeatureFromAccommodation(actorWithPerm)).not.toThrow();
    });
    it('checkCanRemoveFeatureFromAccommodation throws FORBIDDEN without permission', () => {
        try {
            checkCanRemoveFeatureFromAccommodation(actorNoPerm);
            throw new Error('Should have thrown');
        } catch (err: unknown) {
            expectForbiddenError(err);
        }
    });
});
