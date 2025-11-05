#!/usr/bin/env tsx

/**
 * Script to check for broken internal links in Markdown files
 *
 * This script:
 * 1. Finds all .md files in documentation folders
 * 2. Extracts all internal links (relative links)
 * 3. Verifies that each linked file exists
 * 4. Reports any broken links
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

interface BrokenLink {
    sourceFile: string;
    linkText: string;
    targetPath: string;
    line: number;
}

/**
 * Extract internal links from markdown content
 *
 * @param input - Input parameters
 * @param input.content - Markdown file content
 * @param input.sourceFile - Path to the source file
 * @returns Array of extracted links with their resolved paths
 */
function extractInternalLinks(input: {
    content: string;
    sourceFile: string;
}): Array<{ linkText: string; targetPath: string; line: number }> {
    const { content, sourceFile } = input;
    const links: Array<{ linkText: string; targetPath: string; line: number }> = [];

    // Regex to match markdown links: [text](path) or [text](path#anchor)
    const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;

    const lines = content.split('\n');

    for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
        const line = lines[lineIndex];
        let match: RegExpExecArray | null = linkRegex.exec(line);

        while (match !== null) {
            const linkText = match[1];
            const linkPath = match[2];

            // Remove anchor from path
            const pathWithoutAnchor = linkPath.split('#')[0];

            // Skip external links (http://, https://, mailto:, etc.)
            if (
                pathWithoutAnchor.startsWith('http://') ||
                pathWithoutAnchor.startsWith('https://') ||
                pathWithoutAnchor.startsWith('mailto:') ||
                pathWithoutAnchor.startsWith('tel:') ||
                pathWithoutAnchor === '' // Empty link (anchor only)
            ) {
                continue;
            }

            // Skip absolute paths (starting with /)
            if (pathWithoutAnchor.startsWith('/')) {
                // Convert absolute path to relative from project root
                const projectRoot = process.cwd();
                const absolutePath = path.join(projectRoot, pathWithoutAnchor);

                links.push({
                    linkText,
                    targetPath: absolutePath,
                    line: lineIndex + 1
                });
                continue;
            }

            // Only process relative links
            if (pathWithoutAnchor.startsWith('./') || pathWithoutAnchor.startsWith('../')) {
                const sourceDir = path.dirname(sourceFile);
                const targetPath = path.resolve(sourceDir, pathWithoutAnchor);

                links.push({
                    linkText,
                    targetPath,
                    line: lineIndex + 1
                });
            }

            match = linkRegex.exec(line);
        }
    }

    return links;
}

/**
 * Check if a file exists
 *
 * @param filePath - Path to the file to check
 * @returns True if file exists, false otherwise
 */
function fileExists(filePath: string): boolean {
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
    // Find all markdown files
    const markdownFiles = await glob('{docs,apps,packages}/**/*.md', {
        ignore: ['**/node_modules/**', '**/dist/**', '**/build/**'],
        absolute: true
    });

    const brokenLinks: BrokenLink[] = [];
    let _totalLinks = 0;

    // Check each markdown file
    for (const file of markdownFiles) {
        const content = fs.readFileSync(file, 'utf-8');
        const links = extractInternalLinks({ content, sourceFile: file });

        _totalLinks += links.length;

        for (const link of links) {
            if (!fileExists(link.targetPath)) {
                brokenLinks.push({
                    sourceFile: path.relative(process.cwd(), file),
                    linkText: link.linkText,
                    targetPath: path.relative(process.cwd(), link.targetPath),
                    line: link.line
                });
            }
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

main().catch((error: Error) => {
    console.error('❌ Error checking links:', error.message);
    process.exit(1);
});
