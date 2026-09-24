import type { ClientCommand } from '../../registry.ts';
import { runArtifact } from './artifact.ts';

export const artifactCommand: ClientCommand = {
    name: 'artifact',
    summary: 'Publica y lista artifacts locales versionados',
    scope: 'local',
    run: (argv) => runArtifact({ argv })
};
