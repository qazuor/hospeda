import { LifecycleStatusEnum, RoleEnum, TagColorEnum, TagTypeEnum } from '@repo/schemas';
import { describe, expect, it } from 'vitest';
import {
    normalizeCreateInput,
    normalizeUpdateInput
} from '../../../src/services/tag/tag.normalizers';

const actor = { id: 'actor-id', role: RoleEnum.ADMIN, permissions: [] };

/**
 * Tests for tag normalizers (SPEC-086 D-002, D-018).
 *
 * Key changes from pre-refactor:
 * - `slug` field removed — user-tags have no public URLs.
 * - `notes` field removed — replaced by `description`.
 * - `type` is now required on create input.
 * - `ownerId` required for USER tags.
 */
describe('tag normalizers', () => {
    describe('normalizeCreateInput', () => {
        it('trims name for a SYSTEM tag', async () => {
            const input = {
                name: '  Tag  ',
                type: TagTypeEnum.SYSTEM,
                color: TagColorEnum.BLUE,
                lifecycleState: LifecycleStatusEnum.ACTIVE
            };
            const result = await normalizeCreateInput(input, actor);
            expect(result.name).toBe('Tag');
        });

        it('preserves type and passes through ownerId for USER tag', async () => {
            const input = {
                name: 'My Tag',
                type: TagTypeEnum.USER,
                color: TagColorEnum.GREEN,
                lifecycleState: LifecycleStatusEnum.ACTIVE,
                ownerId: 'owner-uuid-123'
            };
            const result = await normalizeCreateInput(input, actor);
            expect(result.type).toBe(TagTypeEnum.USER);
            expect(result.ownerId).toBe('owner-uuid-123');
        });

        it('does not include slug in output (slug removed per D-002)', async () => {
            const input = {
                name: 'Tag Name',
                type: TagTypeEnum.SYSTEM,
                color: TagColorEnum.BLUE,
                lifecycleState: LifecycleStatusEnum.ACTIVE
            };
            const result = await normalizeCreateInput(input, actor);
            expect(result).not.toHaveProperty('slug');
        });

        it('throws on invalid color', async () => {
            await expect(
                normalizeCreateInput(
                    {
                        name: 'Tag',
                        type: TagTypeEnum.SYSTEM,
                        color: 'INVALID' as unknown as TagColorEnum,
                        lifecycleState: LifecycleStatusEnum.ACTIVE
                    },
                    actor
                )
            ).rejects.toThrow('Invalid tag color');
        });

        it('trims icon and description', async () => {
            const input = {
                name: 'Tag',
                type: TagTypeEnum.SYSTEM,
                color: TagColorEnum.BLUE,
                lifecycleState: LifecycleStatusEnum.ACTIVE,
                icon: '  icon  ',
                description: '  a description  '
            };
            const result = await normalizeCreateInput(input, actor);
            expect(result.icon).toBe('icon');
            expect(result.description).toBe('a description');
        });

        it('does not include notes in output (notes replaced by description per D-018)', async () => {
            const input = {
                name: 'Tag',
                type: TagTypeEnum.SYSTEM,
                color: TagColorEnum.BLUE,
                lifecycleState: LifecycleStatusEnum.ACTIVE,
                description: 'some description'
            };
            const result = await normalizeCreateInput(input, actor);
            expect(result).not.toHaveProperty('notes');
            expect(result.description).toBe('some description');
        });

        it('defaults lifecycleState to ACTIVE if not provided', async () => {
            const input = {
                name: 'Tag',
                type: TagTypeEnum.SYSTEM,
                color: TagColorEnum.BLUE
            };
            // lifecycleState has a Zod default — normalizer honors it
            const result = await normalizeCreateInput(
                { ...input, lifecycleState: undefined as unknown as LifecycleStatusEnum },
                actor
            );
            expect(result.lifecycleState).toBe(LifecycleStatusEnum.ACTIVE);
        });
    });

    describe('normalizeUpdateInput', () => {
        it('trims name, icon, and description', () => {
            const input = {
                name: '  Tag  ',
                icon: '  icon  ',
                description: '  description  ',
                color: TagColorEnum.BLUE
            };
            const result = normalizeUpdateInput(input, actor);
            expect(result.name).toBe('Tag');
            expect(result.icon).toBe('icon');
            expect(result.description).toBe('description');
        });

        it('does not include slug in output (slug removed per D-002)', () => {
            const input = { name: 'Tag', color: TagColorEnum.BLUE };
            const result = normalizeUpdateInput(input, actor);
            expect(result).not.toHaveProperty('slug');
        });

        it('does not include notes in output (replaced by description per D-018)', () => {
            const input = { description: 'updated description' };
            const result = normalizeUpdateInput(input, actor);
            expect(result).not.toHaveProperty('notes');
        });

        it('throws on invalid color', () => {
            expect(() =>
                normalizeUpdateInput({ color: 'INVALID' as unknown as TagColorEnum }, actor)
            ).toThrow('Invalid tag color');
        });

        it('does not mutate non-string fields', () => {
            const input = { lifecycleState: LifecycleStatusEnum.ARCHIVED };
            const result = normalizeUpdateInput(input, actor);
            expect(result.lifecycleState).toBe(LifecycleStatusEnum.ARCHIVED);
        });
    });
});
