/**
 * Loads every case of the model-migration sweep from disk (HOS-2217): the chat
 * cases (`fixtures.json` + `contexts.generated.json`) and the non-chat cases
 * (`task-fixtures/*.json` + `tasks.generated.json`), joined and wrapped as
 * {@link RunnableCase}s. Throws when a generated file is stale.
 *
 * @module ai-core/scripts/ai-sweep/load-cases
 */

import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { FixtureFileSchema, GeneratedFileSchema, joinGeneratedCases } from './cases.js';
import { chatRunnable, type RunnableCase, taskRunnable } from './migration-lib.js';
import {
    GeneratedTasksFileSchema,
    joinTaskCases,
    type TaskCase,
    TaskFixtureFileSchema
} from './tasks.js';

/**
 * Reads and joins the non-chat cases.
 *
 * @param input.dir - The sweep directory.
 * @returns `{ cases }` in file-name order.
 */
export function loadTaskCases(input: { readonly dir: string }): { readonly cases: TaskCase[] } {
    const readJson = (name: string): unknown =>
        JSON.parse(readFileSync(resolve(input.dir, name), 'utf8'));
    const files = readdirSync(resolve(input.dir, 'task-fixtures'))
        .filter((f) => f.endsWith('.json'))
        .sort()
        .map((f) => TaskFixtureFileSchema.parse(readJson(`task-fixtures/${f}`)));
    return joinTaskCases({
        files,
        generated: GeneratedTasksFileSchema.parse(readJson('tasks.generated.json'))
    });
}

/**
 * Reads every case of every feature.
 *
 * @param input.dir - The sweep directory.
 * @returns `{ cases }`: chat cases first, then the non-chat ones.
 */
export function loadMigrationCases(input: { readonly dir: string }): {
    readonly cases: RunnableCase[];
} {
    const readJson = (name: string): unknown =>
        JSON.parse(readFileSync(resolve(input.dir, name), 'utf8'));
    const chat = joinGeneratedCases({
        fixtures: FixtureFileSchema.parse(readJson('fixtures.json')).cases,
        generated: GeneratedFileSchema.parse(readJson('contexts.generated.json'))
    });
    return {
        cases: [
            ...chat.map((promptCase) => chatRunnable({ promptCase }).runnable),
            ...loadTaskCases(input).cases.map((task) => taskRunnable({ task }).runnable)
        ]
    };
}
