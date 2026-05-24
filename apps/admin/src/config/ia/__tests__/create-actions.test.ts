/**
 * Tests for apps/admin/src/config/ia/create-actions.ts (T-016)
 *
 * Verifies that all create actions parse against CreateActionSchema, that routes
 * start with "/", and that the 4 canonical IDs explicitly referenced by role
 * configs are present.
 */

import { PermissionEnum } from '@repo/schemas';
import { describe, expect, it } from 'vitest';
import { createActions } from '../create-actions';
import { CreateActionSchema } from '../schema';

// The 4 canonical IDs explicitly referenced by role configs (doc §17, §12, §13)
const REQUIRED_CANONICAL_IDS = ['newAccommodation', 'newPost', 'newEvent', 'newCampaign'] as const;

describe('createActions', () => {
    describe('registry shape', () => {
        it('should contain all 4 canonical IDs explicitly referenced by role configs', () => {
            const keys = Object.keys(createActions);
            for (const id of REQUIRED_CANONICAL_IDS) {
                expect(keys, `missing canonical create action: '${id}'`).toContain(id);
            }
        });

        it('should have at least 10 create actions registered', () => {
            expect(Object.keys(createActions).length).toBeGreaterThanOrEqual(10);
        });
    });

    describe('schema validation', () => {
        it('should parse all create actions against CreateActionSchema without errors', () => {
            for (const [key, action] of Object.entries(createActions)) {
                const result = CreateActionSchema.safeParse(action);
                expect(
                    result.success,
                    `createActions['${key}'] failed schema validation: ${JSON.stringify(result.error?.issues)}`
                ).toBe(true);
            }
        });

        it('should have id field matching the registry key for every action', () => {
            for (const [key, action] of Object.entries(createActions)) {
                expect(action.id).toBe(key);
            }
        });
    });

    describe('routes', () => {
        it('should have all routes starting with "/"', () => {
            for (const [key, action] of Object.entries(createActions)) {
                expect(action.route, `createActions['${key}'] has invalid route`).toMatch(/^\//);
            }
        });
    });

    describe('permission validity', () => {
        it('should only use real PermissionEnum keys in permission gates', () => {
            // Arrange
            // The IA config uses PermissionEnum key names (e.g. ACCOMMODATION_CREATE),
            // not the dotted enum values (e.g. 'accommodation.create').
            // PermissionExpressionSchema accepts uppercase identifiers that match PermissionEnum keys.
            const validPermKeys = new Set<string>(Object.keys(PermissionEnum));

            for (const [key, action] of Object.entries(createActions)) {
                if (action.permissions) {
                    for (const perm of action.permissions) {
                        expect(
                            validPermKeys.has(perm),
                            `createActions['${key}'] uses unknown permission key '${perm}'`
                        ).toBe(true);
                    }
                }
            }
        });
    });

    describe('i18n labels', () => {
        it('should have non-empty es/en/pt labels on every action', () => {
            for (const [key, action] of Object.entries(createActions)) {
                expect(action.label.es, `createActions['${key}'] missing es label`).toBeTruthy();
                expect(action.label.en, `createActions['${key}'] missing en label`).toBeTruthy();
                expect(action.label.pt, `createActions['${key}'] missing pt label`).toBeTruthy();
            }
        });
    });

    describe('canonical action routes', () => {
        it('newAccommodation should point to /accommodations/new', () => {
            expect(createActions.newAccommodation.route).toBe('/accommodations/new');
        });

        it('newPost should point to /posts/new', () => {
            expect(createActions.newPost.route).toBe('/posts/new');
        });

        it('newEvent should point to /events/new', () => {
            expect(createActions.newEvent.route).toBe('/events/new');
        });

        it('newCampaign should point to /newsletter/campaigns/new', () => {
            expect(createActions.newCampaign.route).toBe('/newsletter/campaigns/new');
        });

        it('newUser should point to /access/users/new', () => {
            expect(createActions.newUser.route).toBe('/access/users/new');
        });

        it('newDestination should point to /destinations/new', () => {
            expect(createActions.newDestination.route).toBe('/destinations/new');
        });
    });
});
