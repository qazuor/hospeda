import type { ClientCommand } from '../../registry.ts';
import { runWhatsNewAudit } from './audit.ts';

/** `hops whats-new` */
export const whatsNewCommand: ClientCommand = {
    name: 'whats-new',
    summary: '¿Tiene cada PR de la promoción una decisión de novedad? (audit [--fix])',
    scope: 'local',
    run: (argv) => runWhatsNewAudit({ argv })
};
