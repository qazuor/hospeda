/**
 * @fileoverview
 * Guard for the root `.dockerignore`: an "any depth" directory rule
 * (`**\/<name>`) must never match a directory that holds tracked source code.
 *
 * Regression: `**\/coverage` (meant for test-coverage reports) also stripped
 * `packages/verticals/src/coverage/` and
 * `packages/service-core/src/services/billing/coverage/` from the Docker build
 * context, so the staging API image failed to build with
 * `Could not resolve "./coverage/bootstrap-billing-for-verticals"`. CI never
 * builds the images, so nothing caught it before the deploy.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = resolve(__dirname, '..', '..');

/** Directory names excluded at any depth by a plain `**\/<name>` rule. */
function readAnyDepthDirectoryRules(): readonly string[] {
    return readFileSync(join(ROOT, '.dockerignore'), 'utf8')
        .split('\n')
        .map((line) => line.trim())
        .map((line) => /^\*\*\/([A-Za-z0-9._-]+)\/?$/.exec(line)?.[1])
        .filter((name): name is string => name !== undefined && !name.includes('*'));
}

function listTrackedSourceFiles(): readonly string[] {
    return execFileSync('git', ['ls-files'], {
        cwd: ROOT,
        encoding: 'utf8',
        maxBuffer: 256 * 1024 * 1024
    })
        .split('\n')
        .filter((file) => /(^|\/)src\//.test(file));
}

describe('.dockerignore keeps source directories in the build context', () => {
    it('declares at least one any-depth directory rule', () => {
        // Arrange / Act
        const rules = readAnyDepthDirectoryRules();

        // Assert
        expect(rules.length).toBeGreaterThan(0);
    });

    it('excludes no tracked file under a src/ directory', () => {
        // Arrange
        const rules = new Set(readAnyDepthDirectoryRules());

        // Act
        const stripped = listTrackedSourceFiles().filter((file) =>
            file
                .split('/')
                .slice(0, -1)
                .some((segment) => rules.has(segment))
        );

        // Assert
        expect(stripped).toEqual([]);
    });
});
