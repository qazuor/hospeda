import type { ClientCommand } from '../../registry.ts';
import { runHelp } from './help.ts';

/** `hops help` */
export const helpCommand: ClientCommand = {
    name: 'help',
    summary: 'Centro de ayuda: exporta las guías de una audiencia a Markdown (export)',
    scope: 'local',
    run: (argv) => runHelp({ argv })
};
