/**
 * Lint guard test: ensures all internal href links in source files
 * include trailing slashes, consistent with Astro's `trailingSlash: 'always'` config.
 *
 * This test scans `.astro` and `.tsx` source files for href patterns
 * that point to internal paths without a trailing slash.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

const SRC_DIR = join(__dirname, '../../src');

/**
 * Files to exclude from scanning (middleware has path examples in comments, etc.)
 */
const EXCLUDED_FILES = ['middleware.ts', 'middleware-helpers.ts', 'urls.ts'];

/**
 * Recursively collect all files matching given extensions
 */
function collectFiles({
    dir,
    extensions
}: {
    readonly dir: string;
    readonly extensions: ReadonlyArray<string>;
}): ReadonlyArray<string> {
    const results: string[] = [];

    const entries = readdirSync(dir);
    for (const entry of entries) {
        const fullPath = join(dir, entry);
        const stat = statSync(fullPath);

        if (stat.isDirectory()) {
            results.push(...collectFiles({ dir: fullPath, extensions }));
        } else if (extensions.some((ext) => entry.endsWith(ext))) {
            results.push(fullPath);
        }
    }

    return results;
}

/**
 * Extract internal href values from a source file.
 * Returns array of { line, href, lineNumber } for hrefs missing trailing slashes.
 */
function findBadHrefs({
    content
}: {
    readonly content: string;
}): ReadonlyArray<{ readonly line: string; readonly href: string; readonly lineNumber: number }> {
    const lines = content.split('\n');
    const violations: Array<{
        readonly line: string;
        readonly href: string;
        readonly lineNumber: number;
    }> = [];

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (!line) continue;

        const trimmed = line.trim();

        // Skip comments (HTML, JS single-line, JSDoc)
        if (
            trimmed.startsWith('//') ||
            trimmed.startsWith('*') ||
            trimmed.startsWith('/*') ||
            trimmed.startsWith('<!--')
        ) {
            continue;
        }

        // Match href patterns in various forms:
        // href="..." href='...' href={`...`} href={...} href: `...`
        const hrefPatterns = [
            // href="value" or href='value'
            /href=["']([^"']+)["']/g,
            // href={`value`}
            /href=\{`([^`]+)`\}/g,
            // href: `value`  (used in objects like navItems)
            /href:\s*`([^`]+)`/g,
            // href: "value" or href: 'value' (used in objects)
            /href:\s*["']([^"']+)["']/g
        ];

        for (const pattern of hrefPatterns) {
            let match: RegExpExecArray | null;
            // Reset lastIndex for each line
            pattern.lastIndex = 0;
            // biome-ignore lint/suspicious/noAssignInExpressions: standard regex exec loop pattern
            while ((match = pattern.exec(line)) !== null) {
                const href = match[1];
                if (!href) continue;

                // Skip external URLs
                if (href.startsWith('http://') || href.startsWith('https://')) continue;

                // Skip anchor links
                if (href.startsWith('#')) continue;

                // Skip query-only links
                if (href.startsWith('?')) continue;

                // Skip mailto/tel links
                if (href.startsWith('mailto:') || href.startsWith('tel:')) continue;

                // Skip JavaScript expressions that are not simple strings
                // (e.g., variable references, function calls)
                if (href.includes('${') && !href.startsWith('/')) continue;

                // Extract the path portion (before query string or hash)
                const pathPart = href.split('?')[0]?.split('#')[0] ?? '';

                // Skip empty path
                if (!pathPart || pathPart === '/') continue;

                // Check if the path ends with a trailing slash
                if (!pathPart.endsWith('/')) {
                    violations.push({
                        line: line.trim(),
                        href,
                        lineNumber: i + 1
                    });
                }
            }
        }
    }

    return violations;
}

describe('Trailing slash guard', () => {
    it('should not find any internal hrefs missing trailing slashes in source files', () => {
        const files = collectFiles({ dir: SRC_DIR, extensions: ['.astro', '.tsx'] });

        const allViolations: Array<{
            readonly file: string;
            readonly lineNumber: number;
            readonly href: string;
            readonly line: string;
        }> = [];

        for (const filePath of files) {
            const fileName = filePath.split('/').pop() ?? '';

            // Skip excluded files
            if (EXCLUDED_FILES.some((excluded) => fileName === excluded)) continue;

            const content = readFileSync(filePath, 'utf-8');
            const violations = findBadHrefs({ content });

            for (const violation of violations) {
                allViolations.push({
                    file: relative(SRC_DIR, filePath),
                    lineNumber: violation.lineNumber,
                    href: violation.href,
                    line: violation.line
                });
            }
        }

        if (allViolations.length > 0) {
            const report = allViolations
                .map((v) => `  ${v.file}:${String(v.lineNumber)} - href="${v.href}"\n    ${v.line}`)
                .join('\n\n');

            expect.fail(
                `Found ${String(allViolations.length)} internal href(s) missing trailing slashes:\n\n${report}\n\nUse buildUrl() from src/lib/urls.ts or add a trailing slash to fix.`
            );
        }
    });
});
