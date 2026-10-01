import { describe, expect, it } from 'bun:test';
import { runCloseIssue } from '../src/commands/close-issue/close-issue.ts';

describe('close-issue preflight', () => {
    it('requires the explicit read-only plan flag', async () => {
        expect(await runCloseIssue({ argv: [], context: undefined })).toBe(2);
    });

    it('does not run outside an issue worktree', async () => {
        expect(await runCloseIssue({ argv: ['--plan'], context: undefined })).toBe(1);
    });

    it('exposes help without touching Git, Linear or GitHub', async () => {
        expect(await runCloseIssue({ argv: ['--help'], context: undefined })).toBe(0);
    });
});
