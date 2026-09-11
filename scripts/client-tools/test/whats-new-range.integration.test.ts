import { describe, expect, it } from 'bun:test';
import { join } from 'node:path';
import {
    enumerateFirstParentCommits,
    readCommitTimestamp
} from '../src/commands/whats-new/range.ts';

const REPO_ROOT = join(import.meta.dir, '..', '..', '..');

/**
 * Exercises the real `git log` plumbing against this repo's own history —
 * no network, no `gh`, just the delimiter parsing that would otherwise only
 * be proven by eyeballing `cat -A` output once and hoping it stays right.
 */
describe('enumerateFirstParentCommits (integration, real git)', () => {
    it('should parse a small real range into well-formed commits', async () => {
        const commits = await enumerateFirstParentCommits({
            cwd: REPO_ROOT,
            range: 'HEAD~3..HEAD'
        });

        expect(commits).not.toBeNull();
        expect(commits).toHaveLength(3);
        for (const commit of commits ?? []) {
            expect(commit.sha).toMatch(/^[0-9a-f]{40}$/);
            expect(commit.subject.length).toBeGreaterThan(0);
            expect(Number.isFinite(commit.timestamp)).toBe(true);
            // A subject must never carry a stray control-character delimiter:
            // that would mean the split-by-separator parsing left a fragment in.
            expect(commit.subject).not.toContain('\x1e');
            expect(commit.subject).not.toContain('\x1f');
        }
    });

    it('should return an empty array (not null) for an empty range', async () => {
        const commits = await enumerateFirstParentCommits({ cwd: REPO_ROOT, range: 'HEAD..HEAD' });

        expect(commits).toEqual([]);
    });

    it('should return null for a range git cannot resolve', async () => {
        const commits = await enumerateFirstParentCommits({
            cwd: REPO_ROOT,
            range: 'this-ref-does-not-exist..HEAD'
        });

        expect(commits).toBeNull();
    });
});

describe('readCommitTimestamp (integration, real git)', () => {
    it('should read a real commit timestamp', async () => {
        const timestamp = await readCommitTimestamp({ sha: 'HEAD', cwd: REPO_ROOT });

        expect(timestamp).not.toBeNull();
        expect(timestamp ?? 0).toBeGreaterThan(0);
    });

    it('should return null for a SHA that does not resolve', async () => {
        const timestamp = await readCommitTimestamp({
            sha: 'deadbeefdeadbeefdeadbeefdeadbeefdeadbeef',
            cwd: REPO_ROOT
        });

        expect(timestamp).toBeNull();
    });
});
