import type { ClientCommand } from '../../registry.ts';
import { runUpdate } from './update.ts';

/** `hops update` — bring the tool itself up to date with staging. */
export const updateCommand: ClientCommand = {
    name: 'update',
    summary: 'Actualiza hops a lo último de staging',
    scope: 'local',
    run: (argv) => runUpdate({ argv })
};
