import { describe, expect, it } from 'bun:test';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { localRunner } from '../src/lib/runner.ts';

describe('runner capture', () => {
    it('separates stdout and stderr without inheriting terminal output', async () => {
        const cwd = mkdtempSync(join(tmpdir(), 'hops-runner-'));
        const result = await localRunner().execCapture({
            command: 'bash',
            args: ['-c', 'printf out; printf err >&2'],
            cwd
        });

        expect(result.code).toBe(0);
        expect(result.stdout).toBe('out');
        expect(result.stderr).toBe('err');
    });

    it('normalizes a failed child process to a nonzero code', async () => {
        const cwd = mkdtempSync(join(tmpdir(), 'hops-runner-'));
        const result = await localRunner().execCapture({
            command: 'bash',
            args: ['-c', 'exit 7'],
            cwd
        });

        expect(result.code).toBe(7);
    });
});
