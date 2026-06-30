/**
 * @file dockerfile-build-args.test.ts
 * @description Build-stage enforcement gate (I4).
 *
 * The runtime cross-validation suites (`apps/* /test/*env-registry-cross-validation*`)
 * compare each app's Zod env schema against the registry, but they never look at
 * build-time inputs. Docker `ARG` declarations are the canonical list of values a
 * build needs (Coolify build-args, Sentry release chain, etc.). This gate closes
 * that blind spot: every `ARG` declared in an app Dockerfile must have a matching
 * entry in the env registry (so `.env.example` generation, docs, and the deploy
 * ledger know it exists and how to supply it).
 *
 * Build-time vars are registered with `apps: ['docker']` + `stage: 'build'`, which
 * keeps them out of the runtime cross-validation (they are not read by the runtime
 * Zod schemas) while still being tracked.
 *
 * To add a NEW build ARG: register it in the env registry with `stage: 'build'`.
 * Only put an ARG in EXCLUDED_ARGS when it is a framework/constant build arg that
 * is never user- or platform-configured (none today).
 */

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { ENV_REGISTRY } from '../env-registry.js';

const here = dirname(fileURLToPath(import.meta.url));
// packages/config/src/__tests__ → repo root is four levels up.
const repoRoot = resolve(here, '../../../..');

/**
 * Every `apps/* /Dockerfile`, discovered dynamically so a newly-added app's
 * build args are covered automatically (no hardcoded list to forget to update).
 * Only `apps/` is scanned — there are no Dockerfiles elsewhere today. If one is
 * ever added under `packages/`, `scripts/`, or the repo root, extend this scan.
 */
const DOCKERFILES = readdirSync(resolve(repoRoot, 'apps'), { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => `apps/${entry.name}/Dockerfile`)
    .filter((relativePath) => existsSync(resolve(repoRoot, relativePath)));

/** Apps that ship a Dockerfile today — guards against discovery silently finding none. */
const KNOWN_DOCKERFILE_APPS = ['admin', 'api', 'landing', 'web'] as const;

/**
 * Build ARGs intentionally NOT registered — framework/constant args that are
 * never user- or platform-supplied. Empty today (every real ARG is registered);
 * kept as the documented escape hatch.
 */
const EXCLUDED_ARGS = new Set<string>([]);

const registeredNames = new Set(ENV_REGISTRY.map((entry) => entry.name));

/** Extract the ARG names declared in a Dockerfile (strips any `=default`). */
function extractArgNames(dockerfile: string): string[] {
    return [...dockerfile.matchAll(/^\s*ARG\s+([A-Za-z0-9_]+)/gm)].map(
        (match) => match[1] as string
    );
}

describe('Dockerfile build ARGs are registered (I4)', () => {
    it('discovers every app Dockerfile (no silent zero-scan)', () => {
        for (const app of KNOWN_DOCKERFILE_APPS) {
            expect(DOCKERFILES, `apps/${app}/Dockerfile must be discovered`).toContain(
                `apps/${app}/Dockerfile`
            );
        }
    });

    for (const relativePath of DOCKERFILES) {
        it(`every ARG declared in ${relativePath} has an env-registry entry`, () => {
            const content = readFileSync(resolve(repoRoot, relativePath), 'utf8');
            const args = extractArgNames(content);

            // Sanity: the Dockerfile actually declared at least one ARG (guards
            // against a path typo silently passing the gate).
            expect(args.length, `No ARG declarations found in ${relativePath}`).toBeGreaterThan(0);

            const missing = [
                ...new Set(
                    args.filter((name) => !EXCLUDED_ARGS.has(name) && !registeredNames.has(name))
                )
            ];
            expect(
                missing,
                `Unregistered build ARG(s) in ${relativePath}: ${missing.join(', ')}. Register each in the env registry with stage: 'build' (or add to EXCLUDED_ARGS if it is a framework/constant arg).`
            ).toEqual([]);
        });
    }
});
