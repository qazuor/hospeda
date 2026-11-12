/**
 * Guard: every `ai_usage` writer that can write a listing-chat row carries the
 * visitor as `consumerUserId` (HOS-2100).
 *
 * ## Why
 *
 * HOS-2095 keys a chat row to the listing OWNER (`user_id`) and puts the visitor
 * who asked on `consumer_user_id`; the visitor's monthly quota counts that
 * column. To keep a tourist's pre-cutover usage, the consumer count ALSO counts
 * rows with `consumer_user_id IS NULL AND user_id = visitor`
 * (`countAiUsageForUserFeatureMonth`, `packages/ai-core/src/storage/usage.queries.ts`).
 * That fallback is permanent, so a future `chat*` writer that forgets
 * `consumerUserId` would not fail anywhere: its rows would silently land in
 * the legacy branch and be billed to the wrong person.
 *
 * ## What it checks
 *
 * 1. The set of call sites of `recordAiUsage(`, `meterAiUsage(`,
 *    `enforceAiQuota(` and the raw `insertAiUsage(` in production code is
 *    EXACTLY {@link INVENTORY}: a new site fails until someone declares whether
 *    it writes chat rows. Namespace calls (`ai.recordAiUsage(`) count too.
 * 2. A site declared `chat` passes the visitor: `consumerUserId` for a usage
 *    write, `usageAttribution` for a quota gate (whose `quota_exceeded` row is
 *    a chat row too), and never as a literal `undefined`/`null`.
 * 3. A site declared `not-chat` names no chat feature and does not read
 *    `CHAT_FEATURE_BY_ENTITY_TYPE`.
 * 4. The two pass-through writers forward what they receive: the quota gate
 *    must forward `consumerUserId`; `meterAiUsage` has no consumer field, which
 *    is why every one of its callers must be `not-chat`.
 *
 * ## What it does NOT see
 *
 * - A call through an alias (`const write = recordAiUsage; write({...})`), a
 *   destructured rename, or a dynamic property (`ai['recordAiUsage'](...)`).
 * - A value that is `undefined` at runtime although the source names a variable
 *   (`consumerUserId: maybeId`); only the literal `undefined`/`null` is caught.
 * - A direct Drizzle `db.insert(aiUsage)` that bypasses `insertAiUsage`.
 * - A feature computed at runtime from an unrelated variable.
 * It reads source text, like the other guards in this folder.
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const REPO_ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '../../../..');

/** Functions whose call writes (or gates and writes) an `ai_usage` row. */
const WRITERS = ['recordAiUsage', 'meterAiUsage', 'enforceAiQuota', 'insertAiUsage'] as const;
type Writer = (typeof WRITERS)[number];

/** How a site relates to the listing chat. */
type SiteKind = 'chat' | 'not-chat' | 'passthrough';

interface Site {
    readonly file: string;
    readonly writer: Writer;
    readonly count: number;
    readonly kind: SiteKind;
}

/** Every production call site, declared by hand. */
const INVENTORY: readonly Site[] = [
    {
        file: 'apps/api/src/routes/ai/protected/chat.finalize.ts',
        writer: 'recordAiUsage',
        count: 1,
        kind: 'chat'
    },
    {
        file: 'apps/api/src/routes/ai/protected/chat.ts',
        writer: 'enforceAiQuota',
        count: 2,
        kind: 'chat'
    },
    {
        file: 'apps/api/src/utils/listing-access/ai-quota-gate.ts',
        writer: 'recordAiUsage',
        count: 1,
        kind: 'passthrough'
    },
    {
        file: 'packages/ai-core/src/usage/usage-recorder.ts',
        writer: 'insertAiUsage',
        count: 1,
        kind: 'passthrough'
    },
    {
        file: 'apps/api/src/utils/ai-usage-metering.ts',
        writer: 'recordAiUsage',
        count: 1,
        kind: 'passthrough'
    },
    {
        // HOS-2101: the chat-answer classifier meters its own call with
        // `userId: null` and its own feature, so no chat quota counts it.
        file: 'apps/api/src/services/ai-chat-answer-classifier.ts',
        writer: 'recordAiUsage',
        count: 1,
        kind: 'not-chat'
    },
    {
        file: 'apps/api/src/routes/accommodation/protected/import-from-url.ts',
        writer: 'recordAiUsage',
        count: 1,
        kind: 'not-chat'
    },
    {
        file: 'apps/api/src/routes/ai/protected/search-chat.ts',
        writer: 'enforceAiQuota',
        count: 1,
        kind: 'not-chat'
    },
    {
        file: 'apps/api/src/routes/ai/protected/search-chat.ts',
        writer: 'meterAiUsage',
        count: 2,
        kind: 'not-chat'
    },
    {
        file: 'apps/api/src/routes/ai/protected/text-improve.ts',
        writer: 'enforceAiQuota',
        count: 1,
        kind: 'not-chat'
    },
    {
        file: 'apps/api/src/routes/ai/protected/text-improve.ts',
        writer: 'meterAiUsage',
        count: 2,
        kind: 'not-chat'
    },
    {
        file: 'apps/api/src/routes/ai/protected/translate.ts',
        writer: 'enforceAiQuota',
        count: 1,
        kind: 'not-chat'
    },
    {
        file: 'apps/api/src/routes/ai/protected/translate.ts',
        writer: 'meterAiUsage',
        count: 2,
        kind: 'not-chat'
    }
];

/** Production source roots scanned. */
const ROOTS = ['apps/api/src', 'packages'] as const;

/** A listing-chat feature literal, or the registry that yields one. */
const CHAT_FEATURE_REFERENCE = /'chat(?:_venue|_experience)?'|CHAT_FEATURE_BY_ENTITY_TYPE/;

function walk(dir: string): string[] {
    const out: string[] = [];
    for (const entry of readdirSync(dir)) {
        if (
            entry === 'node_modules' ||
            entry === 'dist' ||
            entry === 'test' ||
            entry === '__tests__'
        )
            continue;
        const path = join(dir, entry);
        if (statSync(path).isDirectory()) out.push(...walk(path));
        else if (/\.tsx?$/.test(entry) && !/\.(test|spec)\.tsx?$/.test(entry)) out.push(path);
    }
    return out;
}

/** Source files under {@link ROOTS}; under `packages` only each package's `src`. */
function productionFiles(): string[] {
    const files = walk(join(REPO_ROOT, 'apps/api/src'));
    for (const pkg of readdirSync(join(REPO_ROOT, 'packages'))) {
        const src = join(REPO_ROOT, 'packages', pkg, 'src');
        try {
            if (statSync(src).isDirectory()) files.push(...walk(src));
        } catch {
            // a package without src/
        }
    }
    return files;
}

/** Removes comments so JSDoc examples are not call sites. */
function stripComments(source: string): string {
    return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
}

/** The argument text of every `writer(` call (not the declaration). */
function callBlocks(source: string, writer: Writer): string[] {
    const blocks: string[] = [];
    // `(?<!\w)` (not `[\w.]`): a namespace call `ai.recordAiUsage(` is a site.
    const pattern = new RegExp(`(?<!function )(?<!\\w)${writer}\\(`, 'g');
    for (const match of source.matchAll(pattern)) {
        let depth = 0;
        const start = (match.index ?? 0) + match[0].length - 1;
        for (let i = start; i < source.length; i += 1) {
            const ch = source[i];
            if (ch === '(') depth += 1;
            else if (ch === ')') {
                depth -= 1;
                if (depth === 0) {
                    blocks.push(source.slice(start, i + 1));
                    break;
                }
            }
        }
    }
    return blocks;
}

/** All call sites found in production code, keyed `file|writer`. */
function scan(): Map<string, { readonly blocks: string[]; readonly source: string }> {
    const found = new Map<string, { readonly blocks: string[]; readonly source: string }>();
    for (const path of productionFiles()) {
        const source = stripComments(readFileSync(path, 'utf8'));
        for (const writer of WRITERS) {
            const blocks = callBlocks(source, writer);
            if (blocks.length > 0)
                found.set(`${relative(REPO_ROOT, path)}|${writer}`, { blocks, source });
        }
    }
    return found;
}

const FOUND = scan();

describe('guard: chat ai_usage writers pass consumerUserId (HOS-2100)', () => {
    it('scans a plausible tree (fails closed on a moved root)', () => {
        expect(ROOTS.length).toBe(2);
        expect(FOUND.size).toBeGreaterThanOrEqual(INVENTORY.length);
    });

    it('every writer call site is declared in the inventory, with its exact count', () => {
        const declared = new Map(
            INVENTORY.map((site) => [`${site.file}|${site.writer}`, site.count])
        );
        const actual = new Map([...FOUND].map(([key, value]) => [key, value.blocks.length]));
        expect(Object.fromEntries(actual)).toEqual(Object.fromEntries(declared));
    });

    it.each(
        INVENTORY.filter((site) => site.kind === 'chat')
    )('$file ($writer) passes the visitor on every call', (site) => {
        const blocks = FOUND.get(`${site.file}|${site.writer}`)?.blocks ?? [];
        const field = site.writer === 'enforceAiQuota' ? 'usageAttribution' : 'consumerUserId';
        expect(blocks.length).toBe(site.count);
        for (const block of blocks) {
            expect(block).toMatch(new RegExp(`\\b${field}\\b`));
            expect(block).not.toMatch(new RegExp(`\\b${field}\\s*:\\s*(undefined|null)\\b`));
        }
    });

    it.each(
        INVENTORY.filter((site) => site.kind === 'not-chat')
    )('$file ($writer) names no listing-chat feature', (site) => {
        const entry = FOUND.get(`${site.file}|${site.writer}`);
        for (const block of entry?.blocks ?? []) expect(block).not.toMatch(CHAT_FEATURE_REFERENCE);
        expect(entry?.source ?? '').not.toContain('CHAT_FEATURE_BY_ENTITY_TYPE');
    });

    it('the usage recorder forwards consumerUserId into the raw insert', () => {
        const blocks =
            FOUND.get('packages/ai-core/src/usage/usage-recorder.ts|insertAiUsage')?.blocks ?? [];
        expect(blocks).toHaveLength(1);
        expect(blocks[0]).toMatch(/consumerUserId:\s*consumerUserId\b/);
    });

    it('the quota gate forwards consumerUserId into its quota_exceeded row', () => {
        const blocks =
            FOUND.get('apps/api/src/utils/listing-access/ai-quota-gate.ts|recordAiUsage')?.blocks ??
            [];
        expect(blocks).toHaveLength(1);
        expect(blocks[0]).toMatch(/consumerUserId:\s*args\.usageAttribution\.consumerUserId/);
    });
});
