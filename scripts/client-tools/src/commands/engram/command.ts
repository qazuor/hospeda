import type { ClientCommand } from '../../registry.ts';
import { runEngram } from './engram.ts';

/** `hops engram` — discoverable wrapper around the official Engram CLI. */
export const engramCommand: ClientCommand = {
    name: 'engram',
    summary: 'Acceso seguro y descubrible a la memoria Engram',
    scope: 'local',
    run: (argv) => runEngram({ argv })
};
