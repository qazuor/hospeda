#!/usr/bin/env node

/**
 * Script to fix markdown linting errors EXCEPT MD040 (code language)
 * Fixes: MD036, MD029, MD024, MD051, MD033
 *
 * Does NOT touch code blocks to avoid incorrectly guessing languages
 */

const fs = require('node:fs');
const path = require('node:path');
const { globSync } = require('glob');

// Statistics
const stats = {
    filesProcessed: 0,
    md036Fixed: 0,
    md029Fixed: 0,
    md024Fixed: 0,
    md051Fixed: 0,
    md033Fixed: 0
};

/**
 * Fix MD036: Convert emphasis to headings
 * Only converts when pattern clearly indicates it should be a heading
 */
function fixMD036(content) {
    let fixed = 0;
    const lines = content.split('\n');

    const result = lines.map((line, index) => {
        // Pattern: **Text** on its own line, possibly followed by content
        const match = line.match(/^(\*\*([A-Z][A-Za-z0-9\s\-\(\)\.]+)\*\*)\s*$/);

        if (match) {
            const text = match[2];

            // Don't convert if it contains special markers
            if (
                text.includes('✅') ||
                text.includes('❌') ||
                text.includes(':') ||
                text.includes('Issue:')
            ) {
                return line;
            }

            // Don't convert if it looks like emphasis in a list
            const prevLine = index > 0 ? lines[index - 1] : '';
            if (prevLine.trim().match(/^[-\*\d+\.]/)) {
                return line;
            }

            // Don't convert if next line is also bold (likely a list of items)
            const nextLine = index < lines.length - 1 ? lines[index + 1] : '';
            if (nextLine.trim().match(/^\*\*/)) {
                return line;
            }

            fixed++;
            return `#### ${text}`;
        }

        return line;
    });

    stats.md036Fixed += fixed;
    return result.join('\n');
}

/**
 * Fix MD029: Correct ordered list numbering
 */
function fixMD029(content) {
    const lines = content.split('\n');
    let inList = false;
    let listNumber = 1;
    let indentLevel = 0;
    let fixed = 0;

    const result = lines.map((line) => {
        // Detect ordered list item with any indentation
        const listMatch = line.match(/^(\s*)(\d+)\.\s/);

        if (listMatch) {
            const [, indent, originalNum] = listMatch;
            const currentIndent = indent.length;

            // Reset counter if indent level changed
            if (currentIndent !== indentLevel) {
                listNumber = 1;
                indentLevel = currentIndent;
            }

            // Fix numbering if wrong
            const expectedNum = Number.parseInt(originalNum);
            if (expectedNum !== listNumber) {
                fixed++;
                const corrected = line.replace(/^(\s*)\d+\./, `$1${listNumber}.`);
                listNumber++;
                inList = true;
                return corrected;
            }

            listNumber++;
            inList = true;
            return line;
        }

        // Reset on blank line or non-list content
        if (inList && line.trim() === '') {
            inList = false;
            listNumber = 1;
            indentLevel = 0;
        }

        return line;
    });

    stats.md029Fixed += fixed;
    return result.join('\n');
}

/**
 * Fix MD024: Make duplicate headings unique
 */
function fixMD024(content) {
    const lines = content.split('\n');
    const headingCounts = new Map();
    const headingContexts = new Map();
    let fixed = 0;
    let currentSection = '';

    // First pass: collect all headings and their contexts
    lines.forEach((line, index) => {
        const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);

        if (headingMatch) {
            const [, hashes, text] = headingMatch;
            const level = hashes.length;
            const normalizedText = text.toLowerCase().trim();

            // Track parent context for sub-headings
            if (level <= 3) {
                currentSection = text;
            }

            if (!headingCounts.has(normalizedText)) {
                headingCounts.set(normalizedText, 0);
                headingContexts.set(normalizedText, []);
            }

            headingCounts.set(normalizedText, headingCounts.get(normalizedText) + 1);
            headingContexts.get(normalizedText).push({
                index,
                level,
                originalText: text,
                context: currentSection
            });
        }
    });

    // Second pass: fix duplicates
    const result = lines.map((line, index) => {
        const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);

        if (headingMatch) {
            const [, hashes, text] = headingMatch;
            const normalizedText = text.toLowerCase().trim();

            // Only fix if there are duplicates
            if (headingCounts.get(normalizedText) > 1) {
                const contexts = headingContexts.get(normalizedText);
                const currentContext = contexts.find((c) => c.index === index);

                if (currentContext && currentContext.context && currentContext.context !== text) {
                    // Don't add context if it would be redundant
                    const contextWords = currentContext.context.split(' ').slice(0, 2).join(' ');
                    if (!text.includes(contextWords)) {
                        fixed++;
                        return `${hashes} ${contextWords} ${text}`;
                    }
                }
            }
        }

        return line;
    });

    stats.md024Fixed += fixed;
    return result.join('\n');
}

/**
 * Fix MD051: Fix link fragments
 * Note: This is conservative - it only removes invalid fragments, doesn't try to fix them
 */
function fixMD051(content) {
    let fixed = 0;
    const lines = content.split('\n');

    // Extract all headings to build valid fragment map
    const validFragments = new Set();
    lines.forEach((line) => {
        const headingMatch = line.match(/^#{1,6}\s+(.+)$/);
        if (headingMatch) {
            // Convert to slug (markdown heading anchor format)
            const slug = headingMatch[1]
                .toLowerCase()
                .replace(/[^\w\s-]/g, '')
                .replace(/\s+/g, '-');
            validFragments.add(slug);
        }
    });

    // Fix invalid fragment links
    const result = content.replace(/\[([^\]]+)\]\(#([^)]+)\)/g, (match, text, fragment) => {
        // Check if fragment exists
        if (!validFragments.has(fragment)) {
            fixed++;
            // Remove the fragment, keep as plain text
            return text;
        }
        return match;
    });

    stats.md051Fixed += fixed;
    return result;
}

/**
 * Fix MD033: Escape inline HTML
 */
function fixMD033(content) {
    let fixed = 0;

    // Find HTML tags that are not in code blocks
    const lines = content.split('\n');
    let inCodeBlock = false;

    const result = lines.map((line) => {
        // Track code blocks
        if (line.trim().startsWith('```')) {
            inCodeBlock = !inCodeBlock;
            return line;
        }

        // Don't touch lines in code blocks
        if (inCodeBlock) {
            return line;
        }

        // Escape inline HTML tags (but not code spans)
        let modified = line;
        const codeSpanRegex = /`[^`]+`/g;
        const codeSpans = [];

        // Temporarily remove code spans
        modified = modified.replace(codeSpanRegex, (match) => {
            codeSpans.push(match);
            return `__CODE_SPAN_${codeSpans.length - 1}__`;
        });

        // Escape HTML tags outside code spans
        const originalModified = modified;
        modified = modified.replace(/<([A-Za-z][A-Za-z0-9]*)>/g, (match) => {
            fixed++;
            return `\`${match}\``;
        });

        // Restore code spans
        codeSpans.forEach((span, index) => {
            modified = modified.replace(`__CODE_SPAN_${index}__`, span);
        });

        return modified;
    });

    stats.md033Fixed += fixed;
    return result.join('\n');
}

/**
 * Process a single markdown file
 */
function processFile(filePath) {
    try {
        let content = fs.readFileSync(filePath, 'utf8');
        const originalContent = content;

        // Apply fixes in order (but skip MD040)
        content = fixMD036(content);
        content = fixMD029(content);
        content = fixMD024(content);
        content = fixMD051(content);
        content = fixMD033(content);

        // Only write if changes were made
        if (content !== originalContent) {
            fs.writeFileSync(filePath, content, 'utf8');
            stats.filesProcessed++;
            console.log(`✓ Fixed: ${filePath}`);
        }
    } catch (error) {
        console.error(`✗ Error processing ${filePath}:`, error.message);
    }
}

/**
 * Main execution
 */
function main() {
    console.log('🔧 Fixing markdown errors (excluding MD040)...\n');

    const patterns = ['docs/**/*.md', 'apps/*/docs/**/*.md', 'packages/*/docs/**/*.md'];

    const files = [];
    patterns.forEach((pattern) => {
        const matches = globSync(pattern, {
            ignore: ['**/node_modules/**', '**/dist/**', '**/build/**'],
            cwd: process.cwd()
        });
        files.push(...matches);
    });

    console.log(`Found ${files.length} markdown files to process\n`);

    // Process each file
    files.forEach(processFile);

    // Print summary
    console.log('\n✅ Markdown fixes complete!\n');
    console.log('Statistics:');
    console.log(`  Files modified: ${stats.filesProcessed}`);
    console.log(`  MD036 (emphasis→heading): ${stats.md036Fixed} fixed`);
    console.log(`  MD029 (list numbering): ${stats.md029Fixed} fixed`);
    console.log(`  MD024 (duplicate headings): ${stats.md024Fixed} fixed`);
    console.log(`  MD051 (link fragments): ${stats.md051Fixed} fixed`);
    console.log(`  MD033 (inline HTML): ${stats.md033Fixed} fixed`);
    console.log(
        `  Total fixes: ${stats.md036Fixed + stats.md029Fixed + stats.md024Fixed + stats.md051Fixed + stats.md033Fixed}`
    );
    console.log(`\nNote: MD040 (code language) errors were intentionally NOT fixed`);
    console.log(`      and will need manual review (language detection requires context)`);
}

// Run if called directly
if (require.main === module) {
    main();
}

module.exports = { processFile, fixMD036, fixMD029, fixMD024, fixMD051, fixMD033 };
