/**
 * @fileoverview
 * Unit tests for the `0170-hos-2183-chat-venue-experience-prompt-rows` data migration with a
 * mocked `ctx.db`: insert shape, "only when missing" and the frozen content hashes.
 */
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it, vi } from 'vitest';
import * as migration from '../../src/data-migrations/0170-hos-2183-chat-venue-experience-prompt-rows.js';
import type { SeedMigrationCtx } from '../../src/data-migrations/types.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const frozen = JSON.parse(
    readFileSync(
        path.resolve(
            HERE,
            '../../src/data-migrations/0170-hos-2183-chat-venue-experience-prompt-rows.data.json'
        ),
        'utf-8'
    )
) as { prompts: Record<'chat_venue' | 'chat_experience', { content: string; rules: string }> };

const md5 = (text: string) => createHash('md5').update(text).digest('hex');

/** Builds a ctx whose select returns `existingByCall[i]` for the i-th lookup. */
function buildCtx(existingByCall: readonly (readonly unknown[])[]) {
    const inserted: unknown[] = [];
    let call = 0;
    const select = vi.fn().mockImplementation(() => ({
        from: () => ({ where: () => ({ limit: async () => existingByCall[call++] ?? [] }) })
    }));
    const insert = vi.fn().mockImplementation(() => ({
        values: async (row: unknown) => {
            inserted.push(row);
        }
    }));
    const ctx = {
        db: { select, insert },
        actor: { id: 'actor-id' },
        models: {},
        services: {},
        helpers: {}
    } as unknown as SeedMigrationCtx;
    return { ctx, inserted };
}

describe('0170-hos-2183-chat-venue-experience-prompt-rows', () => {
    it('freezes the exact rules and content the staging rows carry (hash equality)', () => {
        expect(md5(frozen.prompts.chat_venue.rules)).toBe('d08776600cc009698869a31982d60b4b');
        expect(md5(frozen.prompts.chat_experience.rules)).toBe('5f41dcc1ee6ba7d6fda5e9c602b61e4b');
        expect(md5(frozen.prompts.chat_venue.content)).toBe('5c82e6662838f921e58c925028eacce5');
        expect(md5(frozen.prompts.chat_experience.content)).toBe(
            '643f68ede473be48b9e6449f532d0914'
        );
    });

    it('inserts an active v1 row for each missing feature', async () => {
        const { ctx, inserted } = buildCtx([[], []]);

        const result = await migration.up(ctx);

        expect(inserted).toEqual([
            {
                feature: 'chat_venue',
                version: 1,
                content: frozen.prompts.chat_venue.content,
                rules: frozen.prompts.chat_venue.rules,
                isActive: true,
                createdBy: 'actor-id'
            },
            {
                feature: 'chat_experience',
                version: 1,
                content: frozen.prompts.chat_experience.content,
                rules: frozen.prompts.chat_experience.rules,
                isActive: true,
                createdBy: 'actor-id'
            }
        ]);
        expect(result.counts).toEqual({ chat_venue: 1, chat_experience: 1 });
    });

    it('inserts nothing when both rows already exist', async () => {
        const { ctx, inserted } = buildCtx([[{ id: 'a' }], [{ id: 'b' }]]);

        const result = await migration.up(ctx);

        expect(inserted).toHaveLength(0);
        expect(result.counts).toEqual({ chat_venue: 0, chat_experience: 0 });
        expect(result.summary).toContain('no change');
    });

    it('inserts only the feature that is missing', async () => {
        const { ctx, inserted } = buildCtx([[{ id: 'a' }], []]);

        await migration.up(ctx);

        expect(inserted).toHaveLength(1);
        expect(inserted[0]).toMatchObject({ feature: 'chat_experience' });
    });
});
