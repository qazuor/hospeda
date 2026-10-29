import { runStagingSandboxCli } from './cli-staging-sandbox-main.ts';
import { connectReadOnly } from './known-ids.ts';
import { createProviderApi } from './provider-api.ts';
import { createStagingSandboxApi } from './staging-sandbox-api.ts';

/**
 * Entry point of the staging sandbox run (HOS-1951, step V1 of the staging window). All logic
 * lives in `cli-staging-sandbox-main.ts`; this file only wires the real dependencies.
 */
async function entry(): Promise<void> {
    try {
        process.exit(
            await runStagingSandboxCli({
                args: process.argv.slice(2),
                session: process.env,
                createApi: createProviderApi,
                createSandboxApi: createStagingSandboxApi,
                connectDb: connectReadOnly,
                sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
                out: (line) => console.info(line),
                err: (line) => console.error(line)
            })
        );
    } catch {
        console.error(
            'staging sandbox run crashed: the last checkpoint written (outcome in-progress), if any, holds the ids'
        );
        process.exit(1);
    }
}

void entry();
