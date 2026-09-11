import type { ClientCommand } from '../../registry.ts';
import { runRun } from './run.ts';

/** `hops run` */
export const runCommand: ClientCommand = {
    name: 'run',
    summary: 'Corre cualquier script del repo, con búsqueda',
    scope: 'local',
    run: (argv) => runRun({ argv })
};
