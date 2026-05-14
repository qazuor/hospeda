#!/usr/bin/env tsx

/**
 * Script to check for broken internal links in Markdown files.
 *
 * This script:
 * 1. Finds all .md files in documentation folders.
 * 2. Extracts internal links (absolute paths from repo root + ./ / ../ relative).
 * 3. Verifies that each linked file exists, considering Astro content-collection
 *    aliases (see CONTENT_COLLECTION_ALIASES below).
 * 4. Reports any broken links.
 *
 * Content collection aliases:
 *   Some absolute paths are Astro routes that map to files in a content
 *   collection on disk (e.g. `/beta/host/dashboard/` is generated at build
 *   time from `apps/web/src/content/beta/host/dashboard.md`). The plain
 *   filesystem check fails for these because the URL path does not match the
 *   on-disk path. To validate them, each alias defines a URL prefix and the
 *   corresponding content-collection root; a link is considered valid if any
 *   of the candidate paths (literal-from-root, alias + ".md", alias + "/index.md")
 *   exists.
 *
 * Usage:
 *   pnpm docs:check-links
 *
 * Exit codes:
 *   0 - All links are valid
 *   1 - Broken links found
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { glob } from 'glob';

export interface BrokenLink {
    sourceFile: string;
    linkText: string;
    targetPath: string;
    line: number;
}

/**
 * URL prefix -> content-collection root mapping. When an absolute link starts
 * with `urlPrefix`, the checker ALSO tries to resolve it against `fsPrefix`
 * (treating the rest of the URL as a content-collection entry id and trying
 * both `<rest>.md` and `<rest>/index.md`). Extend this list when new Astro
 * content collections are added.
 */
export const CONTENT_COLLECTION_ALIASES: ReadonlyArray<{
    readonly urlPrefix: string;
    readonly fsPrefix: string;
}> = [{ urlPrefix: '/beta/', fsPrefix: 'apps/web/src/content/beta/' }];

/**
 * Resolve an absolute link (one that starts with `/`) to every filesystem
 * candidate the checker should accept. The first candidate is the literal
 * `<projectRoot>/<absoluteLink>` resolution; subsequent candidates come from
 * matching content-collection aliases. A link is considered valid when ANY
 * candidate is a real file.
 */
export function resolveAbsoluteLinkCandidates(input: {
    absoluteLink: string;
    projectRoot: string;
}): string[] {
    const { absoluteLink, projectRoot } = input;
    const candidates: string[] = [path.join(projectRoot, absoluteLink)];

    for (const { urlPrefix, fsPrefix } of CONTENT_COLLECTION_ALIASES) {
        if (!absoluteLink.startsWith(urlPrefix)) continue;

        const rest = absoluteLink.slice(urlPrefix.length).replace(/\/$/, '');
        if (rest === '') {
            candidates.push(path.join(projectRoot, fsPrefix, 'index.md'));
            continue;
        }

        candidates.push(path.join(projectRoot, fsPrefix, `${rest}.md`));
        candidates.push(path.join(projectRoot, fsPrefix, rest, 'index.md'));
    }

    return candidates;
}

/**
 * Extract internal links from markdown content
 *
 * @param input - Input parameters
 * @param input.content - Markdown file content
 * @param input.sourceFile - Path to the source file
 * @returns Array of extracted links with their resolved paths
 */
/**
 * Test whether a line is the opening or closing fence of a fenced code block.
 * Matches the standard CommonMark fence: a line whose first non-whitespace
 * characters are three or more backticks or tildes. An optional info string
 * may follow on the same line.
 */
function isCodeFence(line: string): boolean {
    return /^\s*(```+|~~~+)/.test(line);
}

export function extractInternalLinks(input: {
    content: string;
    sourceFile: string;
    projectRoot: string;
}): Array<{ linkText: string; targetPaths: string[]; line: number }> {
    const { content, sourceFile, projectRoot } = input;
    const links: Array<{ linkText: string; targetPaths: string[]; line: number }> = [];

    // Regex to match markdown links: [text](path) or [text](path#anchor).
    // `matchAll` is used (instead of `RegExp.prototype.exec` + `continue` in a
    // while loop) because the earlier implementation could infinite-loop: any
    // `continue` path skipped the `lastIndex` advance and `match` stayed
    // non-null.
    const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;

    const lines = content.split('\n');

    // Track whether we are inside a fenced code block. Markdown spec says
    // content inside fenced code blocks is rendered verbatim, so any
    // `[text](path)` inside them is NOT a link — it's illustrative text.
    let insideCodeFence = false;

    for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
        const line = lines[lineIndex];

        if (isCodeFence(line)) {
            insideCodeFence = !insideCodeFence;
            continue;
        }

        if (insideCodeFence) continue;

        for (const match of line.matchAll(linkRegex)) {
            const linkText = match[1];
            const linkPath = match[2];

            // Remove anchor from path
            const pathWithoutAnchor = linkPath.split('#')[0];

            // Skip external links (http://, https://, mailto:, etc.) and
            // anchor-only references (empty path before the hash).
            if (
                pathWithoutAnchor.startsWith('http://') ||
                pathWithoutAnchor.startsWith('https://') ||
                pathWithoutAnchor.startsWith('mailto:') ||
                pathWithoutAnchor.startsWith('tel:') ||
                pathWithoutAnchor === ''
            ) {
                continue;
            }

            // Absolute paths (starting with /) are resolved against the repo
            // root, with extra candidates for content-collection aliases.
            if (pathWithoutAnchor.startsWith('/')) {
                links.push({
                    linkText,
                    targetPaths: resolveAbsoluteLinkCandidates({
                        absoluteLink: pathWithoutAnchor,
                        projectRoot
                    }),
                    line: lineIndex + 1
                });
                continue;
            }

            // Relative links are resolved against the directory of the source file.
            if (pathWithoutAnchor.startsWith('./') || pathWithoutAnchor.startsWith('../')) {
                const sourceDir = path.dirname(sourceFile);
                const targetPath = path.resolve(sourceDir, pathWithoutAnchor);

                links.push({
                    linkText,
                    targetPaths: [targetPath],
                    line: lineIndex + 1
                });
            }
        }
    }

    return links;
}

export function fileExists(filePath: string): boolean {
    try {
        return fs.existsSync(filePath) && fs.statSync(filePath).isFile();
    } catch {
        return false;
    }
}

/**
 * Main function to check all links
 */
async function main(): Promise<void> {
    const projectRoot = process.cwd();

    const markdownFiles = await glob('{docs,apps,packages}/**/*.md', {
        ignore: ['**/node_modules/**', '**/dist/**', '**/build/**'],
        absolute: true
    });

    const brokenLinks: BrokenLink[] = [];
    let _totalLinks = 0;

    for (const file of markdownFiles) {
        const content = fs.readFileSync(file, 'utf-8');
        const links = extractInternalLinks({ content, sourceFile: file, projectRoot });

        _totalLinks += links.length;

        for (const link of links) {
            if (link.targetPaths.some(fileExists)) continue;

            // Report the FIRST candidate path (the literal one) so the message
            // reads naturally as "this is what you wrote, it does not exist".
            const reportedTarget = link.targetPaths[0];

            brokenLinks.push({
                sourceFile: path.relative(projectRoot, file),
                linkText: link.linkText,
                targetPath: path.relative(projectRoot, reportedTarget),
                line: link.line
            });
        }
    }

    if (brokenLinks.length === 0) {
        process.exit(0);
    }

    console.error(`❌ Found ${brokenLinks.length} broken link(s):\n`);

    for (const brokenLink of brokenLinks) {
        console.error(`  File: ${brokenLink.sourceFile}:${brokenLink.line}`);
        console.error(`  Link: [${brokenLink.linkText}](${brokenLink.targetPath})`);
        console.error(`  Target: ${brokenLink.targetPath} (does not exist)\n`);
    }

    process.exit(1);
}

// Run only when invoked as a script (skip when imported by tests).
const isMainModule =
    process.argv[1] &&
    path.resolve(process.argv[1]) === path.resolve(import.meta.url.replace(/^file:\/\//, ''));

if (isMainModule) {
    main().catch((error: Error) => {
        console.error('❌ Error checking links:', error.message);
        process.exit(1);
    });
}
