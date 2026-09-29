/**
 * @file index.ts
 * @description Astro integration that derives, at build time, the union of the
 * inline-script hashes of every page and writes it into the server bundle, so
 * every response's CSP authorises the inline scripts of every page a
 * `<ClientRouter />` soft navigation can reach (HOS-807).
 *
 * Sources, both exhaustive by construction:
 * 1. Every compiled `.astro` module. A Vite `transform` hook (post) parses the
 *    compiled JS and reads the cooked template literals, where the compiler
 *    spells out each `<script is:inline>` byte for byte.
 * 2. The build manifest's `inlinedScripts`: processed `<script>` blocks Vite
 *    was small enough to inline, rendered by Astro as
 *    `<script type="module">${content}</script>`.
 *
 * It fails the build — never degrades silently — when:
 * - an executable inline script's body depends on render-time data and the
 *   component is not on {@link RENDER_TIME_INLINE_SCRIPT_ALLOWLIST}, because
 *   such a script cannot be pre-hashed and breaks on soft navigation;
 * - an allowlisted component no longer emits a render-time script (stale
 *   entry — the allowlist must describe the code, not its history);
 * - the placeholder does not appear EXACTLY once in the server bundle.
 *
 * It also writes `csp-soft-nav-script-hashes.json` next to the server entry,
 * which `scripts/verify-csp-over-the-wire.mjs` reads to assert, over real
 * HTTP, that no served page carries an inline script outside the union.
 */

import { createHash } from 'node:crypto';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { AstroIntegration } from 'astro';
import { SOFT_NAV_SCRIPT_HASHES_PLACEHOLDER } from '../../src/lib/csp-soft-nav-placeholder';
import { collectTemplateQuasis } from './collect-template-quasis';
import { type DynamicInlineScript, extractInlineScripts } from './extract-inline-scripts';
import {
    checkRenderTimeScripts,
    RENDER_TIME_INLINE_SCRIPT_ALLOWLIST,
    replacePlaceholderOnce,
    SOFT_NAV_REPORT_FILE_NAME
} from './union-build-checks';

/** Minimal slice of the Vite/Rolldown plugin context this hook relies on. */
interface ParseCapableContext {
    parse?: (code: string) => unknown;
    error: (message: string) => never;
}

/** Minimal slice of the serialized manifest passed to `astro:build:ssr`. */
interface ManifestWithInlinedScripts {
    readonly inlinedScripts?: Iterable<readonly [string, string]>;
}

const toCspHash = (source: string): string =>
    `sha256-${createHash('sha256').update(source, 'utf8').digest('base64')}`;

/**
 * Creates the `csp-soft-nav-hashes` integration.
 *
 * @returns The Astro integration.
 */
export function cspSoftNavHashes(): AstroIntegration {
    const staticBodiesByComponent = new Map<string, readonly string[]>();
    const dynamicByComponent = new Map<string, readonly DynamicInlineScript[]>();
    let inlinedScriptBodies: readonly string[] = [];
    let rootDir = '';
    let serverDir = '';
    let pageRoutes: readonly { readonly pattern: string; readonly params: readonly string[] }[] =
        [];

    return {
        name: 'hospeda:csp-soft-nav-hashes',
        hooks: {
            'astro:config:setup': ({ command, updateConfig }) => {
                if (command !== 'build') {
                    return;
                }
                updateConfig({
                    vite: {
                        plugins: [
                            {
                                name: 'hospeda:csp-soft-nav-hashes:scan',
                                enforce: 'post',
                                transform(this: ParseCapableContext, code: string, id: string) {
                                    if (id.includes('?') || !id.endsWith('.astro')) {
                                        return null;
                                    }
                                    if (typeof this.parse !== 'function') {
                                        this.error(
                                            '[HOS-807] the bundler plugin context has no parse(); the CSP soft-nav union cannot be derived'
                                        );
                                    }
                                    const ast = this.parse(code);
                                    const { templates } = collectTemplateQuasis({ ast });
                                    const { staticBodies, dynamicScripts } = extractInlineScripts({
                                        templates
                                    });
                                    const key = rootDir ? relative(rootDir, id) : id;
                                    staticBodiesByComponent.set(key, staticBodies);
                                    if (dynamicScripts.length > 0) {
                                        dynamicByComponent.set(key, dynamicScripts);
                                    } else {
                                        dynamicByComponent.delete(key);
                                    }
                                    return null;
                                }
                            }
                        ]
                    }
                });
            },
            'astro:routes:resolved': ({ routes }) => {
                // Every page route of the router manifest, for the
                // over-the-wire verifier. Taken from the router, never from a
                // hand list, so a new page type is checked without anybody
                // remembering to add it.
                pageRoutes = routes
                    .filter((route) => route.type === 'page' && route.origin === 'project')
                    .map((route) => ({ pattern: route.pattern, params: [...route.params] }));
            },
            'astro:config:done': ({ config }) => {
                rootDir = fileURLToPath(config.root);
                serverDir = fileURLToPath(config.build.server);
            },
            'astro:build:ssr': ({ manifest }) => {
                const inlined = (manifest as ManifestWithInlinedScripts).inlinedScripts ?? [];
                inlinedScriptBodies = [...inlined]
                    .map(([, content]) => content)
                    .filter((content) => content.length > 0);
            },
            'astro:build:done': async ({ logger }) => {
                const renderTimeCheck = checkRenderTimeScripts({
                    dynamicByComponent,
                    allowlist: RENDER_TIME_INLINE_SCRIPT_ALLOWLIST
                });
                if (renderTimeCheck.errors.length > 0) {
                    throw new Error(`[HOS-807] ${renderTimeCheck.errors.join('\n')}`);
                }

                const staticBodies = [...staticBodiesByComponent.values()].flat();
                const hashes = [
                    ...new Set([...staticBodies, ...inlinedScriptBodies].map(toCspHash))
                ].sort();

                if (staticBodies.length === 0 || inlinedScriptBodies.length === 0) {
                    throw new Error(
                        `[HOS-807] implausible CSP soft-nav union: ${staticBodies.length} is:inline scripts from ${staticBodiesByComponent.size} components and ${inlinedScriptBodies.length} manifest-inlined scripts. One source came back empty, so the derivation is broken, not the app.`
                    );
                }

                const serialized = JSON.stringify(hashes);
                const bundleFiles = await listModuleFiles({ dir: serverDir });
                const contents = await Promise.all(
                    bundleFiles.map(async (file) => ({ file, text: await readFile(file, 'utf8') }))
                );
                const { file, text } = replacePlaceholderOnce({
                    files: contents,
                    placeholder: SOFT_NAV_SCRIPT_HASHES_PLACEHOLDER,
                    serialized
                });
                await writeFile(file, text);

                await writeFile(
                    join(serverDir, SOFT_NAV_REPORT_FILE_NAME),
                    `${JSON.stringify(
                        {
                            scriptHashes: hashes,
                            renderTimeScripts: renderTimeCheck.allowed,
                            pageRoutes
                        },
                        null,
                        2
                    )}\n`
                );

                const headerBytes = hashes.reduce((sum, hash) => sum + hash.length + 3, 0);
                logger.info(
                    `CSP soft-nav union: ${hashes.length} script hashes (${staticBodies.length} is:inline from ${staticBodiesByComponent.size} components + ${inlinedScriptBodies.length} manifest-inlined), ~${headerBytes} bytes of script-src, written into ${relative(serverDir, file)}`
                );
            }
        }
    };
}

async function listModuleFiles({ dir }: { readonly dir: string }): Promise<readonly string[]> {
    const entries = await readdir(dir, { recursive: true, withFileTypes: true });
    return entries
        .filter((entry) => entry.isFile() && entry.name.endsWith('.mjs'))
        .map((entry) => join(entry.parentPath, entry.name));
}
