/**
 * Tests for scripts/validate-examples.ts (SPEC-106 T-106-12).
 *
 * Two regression surfaces:
 * 1. The script must not hang. Previously, the script called
 *    `ts.getPreEmitDiagnostics(ts.createProgram([virtualFileName], ...))` per
 *    code block, which bootstrapped a fresh Program for each block over a
 *    non-existent virtual filename and ran the full type-checker. That made
 *    the script hang past CI's 10-minute cap. The fix keeps only
 *    `sourceFile.parseDiagnostics`. Acceptance: < 60 seconds end-to-end.
 * 2. Validation must be opt-in. Plain ```ts / ```typescript fences contain
 *    pseudocode like `BaseCrudService<...>` that is intentionally not valid
 *    TS. Only fences carrying the `validate` info-string marker are checked.
 */

import { describe, expect, it } from 'vitest';
import { extractCodeBlocks, validateTypeScriptCode } from '../validate-examples';

describe('extractCodeBlocks (opt-in via `validate` info-string marker)', () => {
    it('skips ts blocks without a validate marker (the default pseudocode case)', () => {
        const content = [
            '# Doc',
            '',
            '```ts',
            'const x: BaseCrudService<...> = z.object({...});',
            '```',
            ''
        ].join('\n');

        const blocks = extractCodeBlocks({ content });

        expect(blocks).toEqual([]);
    });

    it('skips typescript blocks without a validate marker', () => {
        const content = ['```typescript', "const x = 'pseudocode';", '```'].join('\n');

        const blocks = extractCodeBlocks({ content });

        expect(blocks).toEqual([]);
    });

    it('extracts ts blocks with the validate marker', () => {
        const content = [
            '# Header',
            '',
            '```ts validate',
            'export const sum = (a: number, b: number) => a + b;',
            '```'
        ].join('\n');

        const blocks = extractCodeBlocks({ content });

        expect(blocks).toHaveLength(1);
        expect(blocks[0]?.language).toBe('ts');
        expect(blocks[0]?.code).toBe('export const sum = (a: number, b: number) => a + b;');
    });

    it('extracts typescript blocks with the validate marker', () => {
        const content = [
            '```typescript validate',
            "import { z } from 'zod';",
            'export const Schema = z.object({ id: z.string() });',
            '```'
        ].join('\n');

        const blocks = extractCodeBlocks({ content });

        expect(blocks).toHaveLength(1);
        expect(blocks[0]?.language).toBe('typescript');
    });

    it('records the 1-based line where the opening fence sits', () => {
        const content = [
            'line 1',
            'line 2',
            'line 3',
            '```ts validate',
            'export const a = 1;',
            '```'
        ].join('\n');

        const blocks = extractCodeBlocks({ content });

        expect(blocks[0]?.line).toBe(4);
    });

    it('returns only marked blocks when the file mixes marked and unmarked', () => {
        const content = [
            '```ts',
            'const pseudocode: Service<...> = {};',
            '```',
            '',
            '```ts validate',
            'export const real = 1;',
            '```',
            '',
            '```typescript',
            'const moreP: T<...> = whatever;',
            '```'
        ].join('\n');

        const blocks = extractCodeBlocks({ content });

        expect(blocks).toHaveLength(1);
        expect(blocks[0]?.code).toBe('export const real = 1;');
    });

    it('ignores non-ts fences entirely', () => {
        const content = [
            '```bash validate',
            'echo hello',
            '```',
            '',
            '```js validate',
            "console.log('hi');",
            '```'
        ].join('\n');

        const blocks = extractCodeBlocks({ content });

        expect(blocks).toEqual([]);
    });

    it('matches `validate` as a whole word (not as a substring)', () => {
        const content = ['```ts validatorish', 'const broken: Wrong<...> = {};', '```'].join('\n');

        const blocks = extractCodeBlocks({ content });

        expect(blocks).toEqual([]);
    });

    it('does not get stuck in a loop on multiple consecutive marked blocks', () => {
        // Regression guard: confirms the matchAll iteration terminates.
        const content = Array.from({ length: 5 })
            .map((_, i) => ['```ts validate', `export const x${i} = ${i};`, '```'].join('\n'))
            .join('\n\n');

        const blocks = extractCodeBlocks({ content });

        expect(blocks).toHaveLength(5);
    });
});

describe('validateTypeScriptCode (syntax-only, parseDiagnostics)', () => {
    it('returns no errors for syntactically valid code', () => {
        const errors = validateTypeScriptCode({
            code: 'export const sum = (a: number, b: number): number => a + b;',
            fileName: 'virtual.ts'
        });

        expect(errors).toEqual([]);
    });

    it('returns errors for broken syntax with line + message', () => {
        const errors = validateTypeScriptCode({
            code: 'export const broken = (a: number => a + 1;',
            fileName: 'virtual.ts'
        });

        expect(errors.length).toBeGreaterThan(0);
        const first = errors[0];
        expect(first?.line).toBeTypeOf('number');
        expect(first?.message).toBeTypeOf('string');
        expect(first?.message.length).toBeGreaterThan(0);
    });

    it('returns errors for an unclosed brace', () => {
        const errors = validateTypeScriptCode({
            code: 'export function f() {\n  return 1;\n',
            fileName: 'virtual.ts'
        });

        expect(errors.length).toBeGreaterThan(0);
    });

    it('does not flag pseudocode-free, type-only constructs', () => {
        const errors = validateTypeScriptCode({
            code: [
                'type Id = string;',
                'interface User { id: Id; name: string }',
                'export const u: User = { id: "1", name: "x" };'
            ].join('\n'),
            fileName: 'virtual.ts'
        });

        expect(errors).toEqual([]);
    });

    it('returns within parser-fast time even for a moderately large block', () => {
        // Coarse-grained perf guard to catch a regression where someone re-adds
        // `ts.createProgram` per block. Threshold is generous (well under any
        // CI runner).
        const code = Array.from({ length: 500 })
            .map((_, i) => `export const v${i}: number = ${i};`)
            .join('\n');

        const start = Date.now();
        const errors = validateTypeScriptCode({ code, fileName: 'virtual.ts' });
        const elapsed = Date.now() - start;

        expect(errors).toEqual([]);
        expect(elapsed).toBeLessThan(2000);
    });
});
