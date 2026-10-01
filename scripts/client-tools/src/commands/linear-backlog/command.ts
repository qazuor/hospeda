import { resolve } from 'node:path';
import { runLinearBacklog } from '../../lib/linear-backlog.ts';
import type { ClientCommand } from '../../registry.ts';

export const linearBacklogCommand: ClientCommand = {
    name: 'linear-backlog',
    summary: 'Prepara una issue de backlog y crea sólo con --yes',
    scope: 'local',
    run: (argv) => runLinearBacklog({ argv, repoRoot: resolve(process.cwd()) })
};
