/**
 * GUARD (HOS-2217): every AI feature production knows is covered by the
 * model-migration sweep.
 *
 * Owner rule: a new AI feature does not ship without sweep cases, so the next
 * model change measures it instead of guessing. "Known to production" means:
 *
 * - every value of `AiFeatureSchema` (the keys of `ai_settings.features`);
 * - every usage-only feature, declared as an exported `*_USAGE_FEATURE`
 *   string constant (today `CHAT_ANSWER_CLASSIFIER_USAGE_FEATURE`). A feature
 *   metered in `ai_usage` under its own key must be declared that way.
 *
 * "Covered" means at least one case in the sweep fixtures (`fixtures.json`
 * for the chat features, `task-fixtures/<feature>.json` for the rest) AND an
 * entry in `sweep.config.migration.json`, so `migration.ts` runs it.
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { AiFeatureSchema } from '@repo/schemas';
import { describe, expect, it } from 'vitest';
import { SWEEP_DIR } from '../../scripts/ai-sweep/generate-sweep-contexts.js';

const ROOT = resolve(SWEEP_DIR, '../../../..');
const HOW_TO =
    'Add sweep cases for it: see "Adding a feature or a case" in ' +
    'packages/ai-core/scripts/ai-sweep/README.md (fixture cases in task-fixtures/<feature>.json, ' +
    'a renderTask branch in apps/api/scripts/ai-sweep/render-sweep-tasks.ts, regenerate ' +
    'tasks.generated.json, and a features entry in sweep.config.migration.json).';

/** Every `.ts` file under `dir`, skipping tests and build output. */
function sourceFiles(dir: string): string[] {
    const out: string[] = [];
    for (const name of readdirSync(dir)) {
        if (name === 'node_modules' || name === 'dist' || name.startsWith('.')) continue;
        const path = join(dir, name);
        if (statSync(path).isDirectory()) out.push(...sourceFiles(path));
        else if (name.endsWith('.ts') && !name.endsWith('.test.ts')) out.push(path);
    }
    return out;
}

/** Values of every exported `*_USAGE_FEATURE` string constant in production source. */
function usageOnlyFeatures(): string[] {
    const roots = [
        join(ROOT, 'apps/api/src'),
        ...readdirSync(join(ROOT, 'packages')).map((p) => join(ROOT, 'packages', p, 'src'))
    ].filter((dir) => {
        try {
            return statSync(dir).isDirectory();
        } catch {
            return false;
        }
    });
    const found = new Set<string>();
    for (const file of roots.flatMap(sourceFiles)) {
        const source = readFileSync(file, 'utf8');
        for (const m of source.matchAll(
            /export const [A-Z0-9_]+_USAGE_FEATURE(?:\s*:\s*[^=]+)?\s*=\s*'([a-z0-9_]+)'/g
        )) {
            if (m[1]) found.add(m[1]);
        }
    }
    return [...found].sort();
}

/** Features with at least one sweep case. */
function featuresWithCases(): Set<string> {
    const read = (name: string): unknown => JSON.parse(readFileSync(join(SWEEP_DIR, name), 'utf8'));
    const covered = new Set<string>();
    for (const c of (read('fixtures.json') as { cases: { feature: string }[] }).cases) {
        covered.add(c.feature);
    }
    for (const file of readdirSync(join(SWEEP_DIR, 'task-fixtures')).filter((f) =>
        f.endsWith('.json')
    )) {
        const parsed = read(`task-fixtures/${file}`) as { feature: string; cases: unknown[] };
        if (parsed.cases.length > 0) covered.add(parsed.feature);
    }
    return covered;
}

describe('GUARD HOS-2217: every AI feature is covered by the model-migration sweep', () => {
    it('finds the usage-only features (the scan is not blind)', () => {
        // Act
        const usageOnly = usageOnlyFeatures();

        // Assert
        expect(usageOnly).toContain('chat_answer_classifier');
    });

    it('every production AI feature has sweep cases and a migration config entry', () => {
        // Arrange
        const production = [...new Set([...AiFeatureSchema.options, ...usageOnlyFeatures()])];
        const covered = featuresWithCases();
        const config = JSON.parse(
            readFileSync(join(SWEEP_DIR, 'sweep.config.migration.json'), 'utf8')
        ) as { features: Record<string, unknown> };

        // Act
        const missingCases = production.filter((f) => !covered.has(f));
        const missingConfig = production.filter((f) => !(f in config.features));

        // Assert
        expect(production.length).toBeGreaterThan(10);
        expect(missingCases, `AI features with NO sweep cases. ${HOW_TO}`).toEqual([]);
        expect(
            missingConfig,
            `AI features missing from sweep.config.migration.json "features". ${HOW_TO}`
        ).toEqual([]);
    });
});
