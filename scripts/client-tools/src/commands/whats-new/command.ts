import type { ClientCommand } from '../../registry.ts';
import { runWhatsNew } from './dispatch.ts';

/** `hops whats-new` */
export const whatsNewCommand: ClientCommand = {
    name: 'whats-new',
    summary: 'Novedades: auditar la promoción, ver lo pendiente, retirar (audit | pending | drop)',
    scope: 'local',
    run: (argv) => runWhatsNew({ argv })
};
