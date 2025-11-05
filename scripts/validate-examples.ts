#!/usr/bin/env tsx

/**
 * Script to validate TypeScript code blocks in Markdown files
 *
 * This script:
 * 1. Finds all .md files in documentation folders
 * 2. Extracts all code blocks with language 'typescript' or 'ts'
 * 3. Uses TypeScript compiler API to validate syntax
 * 4. Reports any syntax errors
 *
 * Usage:
 *   pnpm docs:validate-examples
 *
 * Exit codes:
 *   0 - All code blocks are syntactically valid
 *   1 - Syntax errors found
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { glob } from 'glob';
import ts from 'typescript';

interface CodeBlock {
    code: string;
    language: string;
    line: number;
}

interface ValidationError {
    sourceFile: string;
    blockLine: number;
    errorLine: number;
    errorMessage: string;
    code: string;
}

/**
 * Extract TypeScript code blocks from markdown content
 *
 * @param input - Input parameters
 * @param input.content - Markdown file content
 * @returns Array of extracted code blocks
 */
function extractCodeBlocks(input: { content: string }): CodeBlock[] {
    const { content } = input;
    const codeBlocks: CodeBlock[] = [];

    // Regex to match code blocks: ```language\ncode\n```
    const codeBlockRegex = /```(typescript|ts)\n([\s\S]*?)\n```/g;

    const _lines = content.split('\n');
    let match: RegExpExecArray | null = codeBlockRegex.exec(content);

    while (match !== null) {
        const language = match[1];
        const code = match[2];

        // Find the line number where this code block starts
        const blockStart = content.substring(0, match.index).split('\n').length;

        codeBlocks.push({
            code,
            language,
            line: blockStart
        });

        match = codeBlockRegex.exec(content);
    }

    return codeBlocks;
}

/**
 * Validate TypeScript code syntax
 *
 * @param input - Input parameters
 * @param input.code - TypeScript code to validate
 * @param input.fileName - Virtual file name for the code block
 * @returns Array of validation errors (empty if valid)
 */
function validateTypeScriptCode(input: {
    code: string;
    fileName: string;
}): Array<{ line: number; message: string }> {
    const { code, fileName } = input;

    // Create a virtual source file
    const sourceFile = ts.createSourceFile(
        fileName,
        code,
        ts.ScriptTarget.Latest,
        true,
        ts.ScriptKind.TS
    );

    const errors: Array<{ line: number; message: string }> = [];

    // Get diagnostics (syntax errors)
    const diagnostics = [
        ...sourceFile.parseDiagnostics,
        ...ts.getPreEmitDiagnostics(
            ts.createProgram([fileName], {
                noEmit: true,
                skipLibCheck: true,
                skipDefaultLibCheck: true
            })
        )
    ];

    for (const diagnostic of diagnostics) {
        if (diagnostic.file && diagnostic.start !== undefined) {
            const { line } = diagnostic.file.getLineAndCharacterOfPosition(diagnostic.start);
            const message = ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n');

            errors.push({
                line: line + 1, // Convert to 1-based line numbers
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

main().catch((error: Error) => {
    console.error('❌ Error validating code blocks:', error.message);
    process.exit(1);
});
