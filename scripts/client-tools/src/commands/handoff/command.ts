import type { ClientCommand } from '../../registry.ts';
import { runHandoff } from './handoff.ts';

export const handoffCommand: ClientCommand = {
    name: 'handoff',
    summary: 'Prepara un handoff read-only de la sesión actual',
    scope: 'local',
    run: (argv) => runHandoff({ argv })
};
