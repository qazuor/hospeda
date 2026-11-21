/**
 * @file help-catalog-anchors.ts
 * @description Guard (a) of the help catalog, predicate a5 and the repo half of
 * a6 (HOS-2410 `docs/guards.md` §2, `docs/data-model.md` §2.2): every `covers`
 * and `entryFor` anchor names something that exists in the repo, and every
 * `{{limit}}` token names a real limit key. Split out of
 * `check-help-catalog.ts` to keep each file small.
 *
 * Each anchor kind resolves against its source of truth:
 *
 * | Kind | Resolves when |
 * |---|---|
 * | `page` | `<path>.astro` or `<path>/index.astro` exists under the web pages dir |
 * | `section` | the slug is in the vertical's `EDITOR_SECTION_SLUGS` or `EDITOR_NON_SECTION_PAGE_SLUGS` (the same lists a `{{link:section}}` token resolves from, so a5 and IL-1 agree) and its editor page exists |
 * | `entitlement` / `limit` | a value of `EntitlementKeyEnum` / `LimitKeyEnum` |
 * | `enum` | a value of `PublicationStatusEnum`, `SUBSCRIPTION_STATUSES` or `TrialStatusEnum` |
 * | `tool` | a `name: '<x>'` (or `*_TOOL_NAME = '<x>'`) of a `defineTool` under `apps/api/src/mcp/tools` |
 * | `activation` | a vertical with a non-null event in `VERTICAL_ACTIVATION_EVENT_BY_VERTICAL` |
 * | `file` | the file exists |
 *
 * Does NOT see: whether a `section` slug still belongs to the section the
 * article talks about (only that its page exists); a web editor page that is
 * in neither list (add it to `EDITOR_NON_SECTION_PAGE_SLUGS`); a tool defined without a
 * literal name; a vocabulary added to the enum list without a source here.
 */

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { parseHelpAnchor } from '../packages/help/src/anchors.js';
import {
    EDITOR_NON_SECTION_PAGE_SLUGS,
    EDITOR_SECTION_SLUGS,
    EDITOR_SECTION_TEMPLATE_BY_VERTICAL,
    PORTAL_ROUTE_TEMPLATES,
    PORTAL_SECTION_PLACEHOLDER
} from '../packages/portal-routes/src/index.js';
import { EntitlementKeyEnum, LimitKeyEnum } from '../packages/schemas/src/catalog/key-enums.js';
import { VERTICAL_ACTIVATION_EVENT_BY_VERTICAL } from '../packages/schemas/src/catalog/vertical-activation-event.js';
import { PublicationStatusEnum } from '../packages/schemas/src/enums/publication-status.enum.js';
import { TrialStatusEnum } from '../packages/schemas/src/enums/trial-status.enum.js';
import { PORTAL_PAGES_DIR, pageExists } from './check-portal-routes.js';

/** Where `SUBSCRIPTION_STATUSES` is declared (read as text: the DB package is not imported). */
export const SUBSCRIPTION_STATUSES_FILE =
    'packages/db/src/schemas/vertical/subscription.dbschema.ts';

/** Where the MCP tools are defined. */
export const MCP_TOOLS_DIR = 'apps/api/src/mcp/tools';

/** The closed vocabularies an anchor resolves against. Injectable for the tests. */
export interface HelpRepoVocabularies {
    readonly entitlements: ReadonlySet<string>;
    readonly limits: ReadonlySet<string>;
    readonly enums: Readonly<Record<string, ReadonlySet<string>>>;
    readonly activations: ReadonlySet<string>;
}

/** The vocabularies of this repo. */
export function repoVocabularies({ root }: { readonly root: string }): HelpRepoVocabularies {
    const file = join(root, SUBSCRIPTION_STATUSES_FILE);
    const source = existsSync(file) ? readFileSync(file, 'utf8') : '';
    const block = /export const SUBSCRIPTION_STATUSES = \[([^\]]*)\]/.exec(source)?.[1] ?? '';
    return {
        entitlements: new Set<string>(Object.values(EntitlementKeyEnum)),
        limits: new Set<string>(Object.values(LimitKeyEnum)),
        enums: {
            PublicationStatus: new Set<string>(Object.values(PublicationStatusEnum)),
            SubscriptionStatus: new Set(
                [...block.matchAll(/'([A-Z_]+)'/g)].map((match) => match[1] ?? '')
            ),
            TrialStatus: new Set<string>(Object.values(TrialStatusEnum))
        },
        activations: new Set(
            Object.entries(VERTICAL_ACTIVATION_EVENT_BY_VERTICAL)
                .filter(([, event]) => event !== null)
                .map(([vertical]) => vertical)
        )
    };
}

/** Every `.ts` file under a dir. */
function tsFilesUnder(dir: string): string[] {
    if (!existsSync(dir)) {
        return [];
    }
    return readdirSync(dir).flatMap((name) => {
        const full = join(dir, name);
        return statSync(full).isDirectory()
            ? tsFilesUnder(full)
            : name.endsWith('.ts')
              ? [full]
              : [];
    });
}

/** The names of the MCP tools defined under the tools dir. */
export function mcpToolNames({ root }: { readonly root: string }): ReadonlySet<string> {
    const names = new Set<string>();
    for (const file of tsFilesUnder(join(root, MCP_TOOLS_DIR))) {
        const source = readFileSync(file, 'utf8');
        for (const match of source.matchAll(/[A-Z_]+_TOOL_NAME\s*=\s*'([a-z0-9_]+)'/g)) {
            names.add(match[1] ?? '');
        }
        for (const match of source.matchAll(/defineTool\(\{\s*name:\s*'([a-z0-9_]+)'/g)) {
            names.add(match[1] ?? '');
        }
    }
    return names;
}

/** Whether a `section:<vertical>.<slug>` target resolves. */
function sectionResolves({ root, target }: { readonly root: string; readonly target: string }) {
    const [vertical, slug = ''] = target.split('.');
    if (vertical !== 'accommodation' && vertical !== 'venue' && vertical !== 'experience') {
        return false;
    }
    const slugs: readonly string[] = [
        ...Object.values(EDITOR_SECTION_SLUGS[vertical]),
        ...Object.values(EDITOR_NON_SECTION_PAGE_SLUGS[vertical])
    ];
    if (!slugs.includes(slug)) {
        return false;
    }
    const template = PORTAL_ROUTE_TEMPLATES[EDITOR_SECTION_TEMPLATE_BY_VERTICAL[vertical]];
    return pageExists({
        pagesRoot: join(root, PORTAL_PAGES_DIR),
        path: template.replace(PORTAL_SECTION_PLACEHOLDER, slug)
    });
}

/** What {@link createAnchorResolver} returns. */
export type HelpAnchorResolver = (anchor: string) => boolean;

/**
 * Builds a resolver for anchors against one repo. The tool names and the web
 * registries are read once.
 *
 * @param args.root - The repo root
 * @param args.vocabularies - Overrides the closed vocabularies (tests)
 * @returns A function telling whether an anchor names something that exists
 */
export function createAnchorResolver({
    root,
    vocabularies = repoVocabularies({ root })
}: {
    readonly root: string;
    readonly vocabularies?: HelpRepoVocabularies;
}): HelpAnchorResolver {
    const tools = mcpToolNames({ root });
    return (anchor) => {
        const parsed = parseHelpAnchor({ anchor });
        if (parsed === undefined) {
            return false;
        }
        const { kind, target } = parsed;
        switch (kind) {
            case 'page':
                return pageExists({ pagesRoot: join(root, PORTAL_PAGES_DIR), path: target });
            case 'section':
                return sectionResolves({ root, target });
            case 'entitlement':
                return vocabularies.entitlements.has(target);
            case 'limit':
                return vocabularies.limits.has(target);
            case 'enum': {
                const [vocabulary = '', value = ''] = target.split('.');
                return vocabularies.enums[vocabulary]?.has(value) ?? false;
            }
            case 'tool':
                return tools.has(target);
            case 'activation':
                return vocabularies.activations.has(target);
            case 'file':
                return existsSync(join(root, target)) && statSync(join(root, target)).isFile();
        }
    };
}
