import type { ClientCommand } from '../../registry.ts';
import { runCi } from './ci.ts';

/** `hops ci` */
export const ciCommand: ClientCommand = {
    name: 'ci',
    summary: '¿Está verde el PR de esta branch?',
    scope: 'local',
    run: (argv) => runCi({ argv })
};
