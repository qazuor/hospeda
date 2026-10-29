import { runRehearsalSandboxIdsCli } from './cli-rehearsal-sandbox-ids-main.ts';
import { connectWritable } from './known-ids.ts';
import { createRehearsalSandboxApi } from './rehearsal-sandbox-api.ts';
import { createStagingSandboxApi } from './staging-sandbox-api.ts';

/**
 * Entry point of the rehearsal sandbox-id rewrite (HOS-1957, owner decision 1). All logic lives
 * in `cli-rehearsal-sandbox-ids-main.ts`; this file only wires the real dependencies.
 */
async function entry(): Promise<void> {
    try {
        process.exit(
            await runRehearsalSandboxIdsCli({
                args: process.argv.slice(2),
                session: process.env,
                createAccountApi: createStagingSandboxApi,
                createSandboxApi: createRehearsalSandboxApi,
                connectDb: connectWritable,
                out: (line) => console.info(line),
                err: (line) => console.error(line)
            })
        );
    } catch {
        console.error(
            'rehearsal sandbox-id rewrite crashed: the last checkpoint written (outcome in-progress), if any, holds the ids'
        );
        process.exit(1);
    }
}

void entry();
