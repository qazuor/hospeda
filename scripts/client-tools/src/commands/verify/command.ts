import type { ClientCommand } from '../../registry.ts';
import { runVerify } from './verify.ts';

/** `hops verify` — run what CI runs, before pushing. */
export const verifyCommand: ClientCommand = {
    name: 'verify',
    summary: 'Corre lo que va a mirar CI, leyendo el workflow real',
    scope: 'local',
    run: (argv) => runVerify({ argv })
};
