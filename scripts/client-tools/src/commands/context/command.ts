import type { ClientCommand } from '../../registry.ts';
import { runContextCommand } from './context.ts';

export const contextCommand: ClientCommand = {
    name: 'context',
    summary: 'Entrega contexto compacto y verificable de un issue/worktree',
    scope: 'local',
    run: (argv) => runContextCommand({ argv })
};
