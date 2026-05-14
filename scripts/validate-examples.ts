#!/usr/bin/env tsx

/**
 * Script to validate TypeScript code blocks in Markdown files.
 *
 * This script:
 * 1. Finds all .md files in documentation folders.
 * 2. Extracts only code blocks marked for validation (opt-in).
 * 3. Uses the TypeScript parser to validate SYNTAX (not types).
 * 4. Reports any syntax errors.
 *
 * Opt-in policy:
 *   The Hospeda docs corpus is overwhelmingly pseudocode-style — examples like
 *   `BaseCrudService<...>` and `z.object({ ... })` are illustrative and not
 *   meant to be syntactically valid TypeScript. Validating every fenced block
 *   produced ~3,700 spurious "errors" against intentionally elided syntax.
 *
 *   So validation is OPT-IN: only blocks fenced with `validate` in the info
 *   string are checked. Use it for blocks that are meant to be precise and
 *   copy-pasteable (quickstart guides, ADR-attached snippets, runbook
 *   commands). Examples:
 *
 *       ```ts validate
 *       export const sum = (a: number, b: number) => a + b;
 *       ```
 *
 *       ```typescript validate
 *       import { z } from 'zod';
 *       export const Schema = z.object({ id: z.string() });
 *       ```
 *
 *   Plain `\`\`\`ts` and `\`\`\`typescript` fences (without `validate`) are
 *   treated as illustrative pseudocode and skipped.
 *
 * Why syntax-only (not full type-check):
 *   Full type-checking requires a real `ts.Program` with module resolution
 *   against the workspace `tsconfig.json` and each block's transitive imports.
 *   Doing that per-block (one `createProgram` per code block over a virtual
 *   filename that does not exist on disk) is what caused this script to hang
 *   in CI until the 10-minute cap. See SPEC-106 §2-bis. The earlier code path
 *   called `ts.getPreEmitDiagnostics(ts.createProgram([virtualFileName], ...))`
 *   per block, which (a) bootstrapped a fresh Program every time, walking the
 *   filesystem looking for lib.d.ts and the non-existent virtual file, and
 *   (b) ran the full type-checker, which is meaningless without the real
 *   workspace types available. The diagnostics it produced were either empty
 *   or noise; the real signal is in `sourceFile.parseDiagnostics`, which is
 *   produced for free by `ts.createSourceFile`. So we keep only that.
 *
 * Usage:
 *   pnpm docs:validate-examples
 *
 * Exit codes:
 *   0 - All opted-in code blocks are syntactically valid
 *   1 - Syntax errors found in opted-in blocks
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { glob } from 'glob';
import ts from 'typescript';

export interface CodeBlock {
    code: string;
    language: string;
    line: number;
}

export interface ValidationError {
    sourceFile: string;
    blockLine: number;
    errorLine: number;
    errorMessage: string;
    code: string;
}

/**
 * Match a fenced TS code block, capturing the info string (anything between
 * the language tag and the end of the opening fence line). Validation is
 * opt-in: only blocks whose info string contains `validate` are returned by
 * `extractCodeBlocks`.
 *
 * Captures:
 *   [1] language (`typescript` | `ts`)
 *   [2] info string (everything after the language up to the newline)
 *   [3] code body
 */
const CODE_BLOCK_REGEX = /```(typescript|ts)([^\n]*)\n([\s\S]*?)\n```/g;

const VALIDATE_MARKER_REGEX = /\bvalidate\b/;

export function extractCodeBlocks(input: { content: string }): CodeBlock[] {
    const { content } = input;
    const codeBlocks: CodeBlock[] = [];

    for (const match of content.matchAll(CODE_BLOCK_REGEX)) {
        const language = match[1];
        const meta = match[2] ?? '';
        const code = match[3];

        if (!VALIDATE_MARKER_REGEX.test(meta)) continue;
        if (match.index === undefined) continue;

        const blockStart = content.substring(0, match.index).split('\n').length;

        codeBlocks.push({
            code,
            language,
            line: blockStart
        });
    }

    return codeBlocks;
}

/**
 * `parseDiagnostics` is the list of syntax errors produced by the TS parser
 * itself, populated during `ts.createSourceFile`. It is marked `@internal` in
 * the public TypeScript typings, so we extend the SourceFile type here to
 * access it without `any`. There is no public API for "syntax-only diagnostics
 * without a Program" — every alternative drags in module resolution and the
 * per-block-Program performance bug that SPEC-106 fixed.
 */
type SourceFileWithParseDiagnostics = ts.SourceFile & {
    readonly parseDiagnostics: readonly ts.DiagnosticWithLocation[];
};

export function validateTypeScriptCode(input: {
    code: string;
    fileName: string;
}): Array<{ line: number; message: string }> {
    const { code, fileName } = input;

    const sourceFile = ts.createSourceFile(
        fileName,
        code,
        ts.ScriptTarget.Latest,
        true,
        ts.ScriptKind.TS
    ) as SourceFileWithParseDiagnostics;

    const errors: Array<{ line: number; message: string }> = [];

    for (const diagnostic of sourceFile.parseDiagnostics) {
        if (diagnostic.file && diagnostic.start !== undefined) {
            const { line } = diagnostic.file.getLineAndCharacterOfPosition(diagnostic.start);
            const message = ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n');

            errors.push({
                line: line + 1,
                message
            });
        }
    }

    return errors;
}

/**
 * Main function to validate all code blocks
 */
async function main(): Promise<void> {
    // Find all markdown files
    const markdownFiles = await glob('{docs,apps,packages}/**/*.md', {
        ignore: ['**/node_modules/**', '**/dist/**', '**/build/**'],
        absolute: true
    });

    const validationErrors: ValidationError[] = [];
    let _totalBlocks = 0;

    // Check each markdown file
    for (const file of markdownFiles) {
        const content = fs.readFileSync(file, 'utf-8');
        const codeBlocks = extractCodeBlocks({ content });

        _totalBlocks += codeBlocks.length;

        for (const block of codeBlocks) {
            const errors = validateTypeScriptCode({
                code: block.code,
                fileName: `${file}-block-${block.line}.ts`
            });

            for (const error of errors) {
                validationErrors.push({
                    sourceFile: path.relative(process.cwd(), file),
                    blockLine: block.line,
                    errorLine: error.line,
                    errorMessage: error.message,
                    code: block.code
                });
            }
        }
    }

    if (validationErrors.length === 0) {
        process.exit(0);
    }

    console.error(`❌ Found ${validationErrors.length} syntax error(s):\n`);

    for (const error of validationErrors) {
        console.error(`  File: ${error.sourceFile}:${error.blockLine}`);
        console.error(`  Error at line ${error.errorLine}: ${error.errorMessage}`);
        console.error('  Code block:\n');
        console.error(
            error.code
                .split('\n')
                .map((line, index) => `    ${index + 1} | ${line}`)
                .join('\n')
        );
        console.error('\n');
    }

    process.exit(1);
}

// Run only when invoked as a script (skip when imported by tests).
const isMainModule =
    process.argv[1] &&
    path.resolve(process.argv[1]) === path.resolve(import.meta.url.replace(/^file:\/\//, ''));

if (isMainModule) {
    main().catch((error: Error) => {
        console.error('❌ Error validating code blocks:', error.message);
        process.exit(1);
    });
}
