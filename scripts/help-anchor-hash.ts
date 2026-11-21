/**
 * @file help-anchor-hash.ts
 * @description What guard (c) of the help catalog hashes for each anchor
 * (HOS-2410 `docs/guards.md` §4.2), shared by the guard
 * (`check-help-lock.ts`) and `pnpm help:review` (`help-review.ts`). The inputs
 * are as narrow as the anchor's meaning, so a cosmetic edit elsewhere does not
 * flag every article.
 *
 * | Anchor | Hashed input |
 * |---|---|
 * | `page:` | the page `.astro` file only (components are not followed) |
 * | `section:` | the section's editor page file + its `LISTING_SECTIONS` entry, when one exists |
 * | `entitlement:` / `limit:` | the key's definition row `[key, scope, aggregation, enforcement, class]` (values are DB rows, never hashed) |
 * | `enum:` | the full value set of the vocabulary |
 * | `tool:` | the source file that defines the tool |
 * | `activation:` | the vertical's entry of `VERTICAL_ACTIVATION_EVENT_BY_VERTICAL` |
 * | `file:` | the file |
 *
 * Text is LF-normalized before hashing; a value is hashed as canonical JSON
 * (sorted keys). Every input is prefixed with the anchor itself, so two anchors
 * over the same file never share a hash by accident.
 *
 * Does NOT see: a change in a component, service or DB row the hashed file
 * imports or reads (opt into one with a `file:` anchor).
 */

import { createHash } from 'node:crypto';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { parseHelpAnchor } from '../packages/help/src/anchors.js';
import { toCanonicalJson } from '../packages/help/src/generator/canonical-json.js';
import { ENTITLEMENT_KEY_DEFINITIONS } from '../packages/schemas/src/catalog/entitlement-keys.js';
import { LIMIT_KEY_DEFINITIONS } from '../packages/schemas/src/catalog/limit-keys.js';
import { LISTING_SECTIONS } from '../packages/schemas/src/catalog/listing-sections.js';
import { VERTICAL_ACTIVATION_EVENT_BY_VERTICAL } from '../packages/schemas/src/catalog/vertical-activation-event.js';
import {
    DEFAULT_ROUTE_DATA,
    PORTAL_PAGES_DIR,
    type PortalRouteData
} from './check-portal-routes.js';
import { repoVocabularies } from './help-catalog-anchors.js';
import { mcpToolFiles } from './help-coverage-universe.js';

/** Everything an anchor hash reads besides plain files. Injectable for the tests. */
export interface HelpHashSources {
    /** `entitlement:<k>` / `limit:<k>` → the key's definition row. */
    readonly keyRows: ReadonlyMap<string, unknown>;
    /** `<vertical>.<sectionId>` → the `LISTING_SECTIONS` entry. */
    readonly sectionCatalog: ReadonlyMap<string, unknown>;
    /** Vocabulary → its values. */
    readonly enums: Readonly<Record<string, ReadonlySet<string>>>;
    /** Vertical → its activation event (`null` included). */
    readonly activations: ReadonlyMap<string, unknown>;
    /** The portal route data: section templates and slugs. */
    readonly routeData: PortalRouteData;
    /** Tool name → repo-relative file that defines it. */
    readonly toolFiles: ReadonlyMap<string, string>;
}

/** The hash sources of a repo, read from code. */
export function repoHashSources({ root }: { readonly root: string }): HelpHashSources {
    const keyRows = new Map<string, unknown>();
    for (const definition of [...ENTITLEMENT_KEY_DEFINITIONS, ...LIMIT_KEY_DEFINITIONS]) {
        keyRows.set(`${definition.kind}:${definition.key}`, [
            definition.key,
            definition.scope,
            definition.aggregationStrategy,
            definition.enforcementStrategy,
            definition.keyClass
        ]);
    }
    const sectionCatalog = new Map<string, unknown>();
    for (const [vertical, sections] of Object.entries(LISTING_SECTIONS)) {
        for (const section of sections) {
            sectionCatalog.set(`${vertical}.${section.id}`, section);
        }
    }
    return {
        keyRows,
        sectionCatalog,
        enums: repoVocabularies({ root }).enums,
        activations: new Map(Object.entries(VERTICAL_ACTIVATION_EVENT_BY_VERTICAL)),
        routeData: DEFAULT_ROUTE_DATA,
        toolFiles: mcpToolFiles({ root })
    };
}

/** The result of hashing one anchor. */
export type AnchorHashResult =
    | { readonly ok: true; readonly hash: string }
    | { readonly ok: false; readonly error: string };

/** sha256 hex of a text. */
function sha256(text: string): string {
    return createHash('sha256').update(text).digest('hex');
}

/** The LF-normalized content of a repo file, or `undefined` when it is not a file. */
function readText({ root, file }: { readonly root: string; readonly file: string }) {
    const full = join(root, file);
    return existsSync(full) && statSync(full).isFile()
        ? readFileSync(full, 'utf8').replace(/\r\n/g, '\n')
        : undefined;
}

/** The repo-relative page file of a route template (`<path>.astro` or `<path>/index.astro`). */
function pageFile({ root, template }: { readonly root: string; readonly template: string }) {
    for (const candidate of [`${template}.astro`, `${template}/index.astro`]) {
        const file = `${PORTAL_PAGES_DIR}/${candidate}`;
        if (readText({ root, file }) !== undefined) {
            return file;
        }
    }
    return undefined;
}

/** The page file and catalog entry a `section:<vertical>.<slug>` anchor reads. */
function sectionInput({
    root,
    target,
    sources
}: {
    readonly root: string;
    readonly target: string;
    readonly sources: HelpHashSources;
}): string | undefined {
    const [vertical = '', slug = ''] = target.split('.');
    const data = sources.routeData;
    const sectionIds = Object.entries(data.sectionSlugs[vertical] ?? {});
    const pageIds = Object.entries(data.editorPageSlugs[vertical] ?? {});
    const sectionId = sectionIds.find(([, value]) => value === slug)?.[0];
    if (sectionId === undefined && !pageIds.some(([, value]) => value === slug)) {
        return undefined;
    }
    const templateKey = data.sectionTemplateByVertical[vertical];
    const template = templateKey === undefined ? undefined : data.templates[templateKey];
    const file =
        template === undefined
            ? undefined
            : pageFile({ root, template: template.replace(data.sectionPlaceholder, slug) });
    if (file === undefined) {
        return undefined;
    }
    const entry =
        sectionId === undefined
            ? null
            : (sources.sectionCatalog.get(`${vertical}.${sectionId}`) ?? null);
    return `${file}\n${readText({ root, file })}\n${toCanonicalJson({ value: entry })}`;
}

/** The text hashed for one anchor, or `undefined` when it names nothing hashable. */
function anchorInput({
    root,
    anchor,
    sources
}: {
    readonly root: string;
    readonly anchor: string;
    readonly sources: HelpHashSources;
}): string | undefined {
    const parsed = parseHelpAnchor({ anchor });
    if (parsed === undefined) {
        return undefined;
    }
    const { kind, target } = parsed;
    switch (kind) {
        case 'page': {
            const file = pageFile({ root, template: target });
            return file === undefined ? undefined : readText({ root, file });
        }
        case 'section':
            return sectionInput({ root, target, sources });
        case 'entitlement':
        case 'limit': {
            const row = sources.keyRows.get(anchor);
            return row === undefined ? undefined : toCanonicalJson({ value: row });
        }
        case 'enum': {
            const [vocabulary = '', value = ''] = target.split('.');
            const values = sources.enums[vocabulary];
            return values?.has(value) === true ? [...values].sort().join('\n') : undefined;
        }
        case 'tool': {
            const file = sources.toolFiles.get(target);
            return file === undefined ? undefined : readText({ root, file });
        }
        case 'activation':
            return sources.activations.has(target)
                ? toCanonicalJson({ value: sources.activations.get(target) ?? null })
                : undefined;
        case 'file':
            return readText({ root, file: target });
    }
}

/**
 * Builds a hasher of anchors for one repo.
 *
 * @param args.root - The repo root
 * @param args.sources - Overrides the code-derived inputs (tests)
 * @returns A function hashing one anchor, or saying why it cannot
 */
export function createAnchorHasher({
    root,
    sources = repoHashSources({ root })
}: {
    readonly root: string;
    readonly sources?: HelpHashSources;
}): (anchor: string) => AnchorHashResult {
    return (anchor) => {
        const input = anchorInput({ root, anchor, sources });
        return input === undefined
            ? {
                  ok: false,
                  error: `${anchor} names nothing that can be hashed (guard (a) a5 reports why)`
              }
            : { ok: true, hash: sha256(`${anchor}\n${input}`) };
    };
}

/**
 * The hash of a whole lock entry: sha256 of its sorted `anchor<TAB>hash` lines.
 *
 * @param args.anchors - anchor → hash
 * @returns The entry hash
 */
export function lockEntryHash({
    anchors
}: {
    readonly anchors: Readonly<Record<string, string>>;
}): string {
    return sha256(
        Object.entries(anchors)
            .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
            .map(([anchor, hash]) => `${anchor}\t${hash}\n`)
            .join('')
    );
}
