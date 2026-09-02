import type { ClientCommand } from '../../registry.ts';
import { runEnv } from './env.ts';

/** `hops env` */
export const envCommand: ClientCommand = {
    name: 'env',
    summary: 'Chequea las variables de entorno (los seis checks)',
    scope: 'local',
    run: (argv) => runEnv({ argv })
};
