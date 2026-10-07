import { runCli } from './cli-main.ts';
import { createKnownIdsReader } from './known-ids.ts';
import { createProviderApi } from './provider-api.ts';

/** Entry point of the cutover script. All logic lives in `cli-main.ts`; this file only wires the real dependencies. */
async function entry(): Promise<void> {
    try {
        process.exit(
            await runCli({
                args: process.argv.slice(2),
                session: process.env,
                createApi: createProviderApi,
                createKnownIdsReader,
                sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
                out: (line) => console.info(line),
                err: (line) => console.error(line)
            })
        );
    } catch {
        console.error(
            'cutover crashed: the last checkpoint written (outcome in-progress), if any, holds the ids'
        );
        process.exit(1);
    }
}

void entry();
