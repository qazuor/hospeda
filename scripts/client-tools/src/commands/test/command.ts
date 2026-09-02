import type { ClientCommand } from '../../registry.ts';
import { runTest } from './test.ts';

/** `hops test` — run the tests of one category, package by package. */
export const testCommand: ClientCommand = {
    name: 'test',
    summary: 'Corre los tests de una categoría (billing, auth, gastronomy…)',
    scope: 'local',
    run: (argv) => runTest({ argv })
};
