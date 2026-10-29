import { runRehearsalEmailsCli } from './cli-rehearsal-emails-main.ts';
import { connectWritable } from './known-ids.ts';

/**
 * Entry point of the rehearsal email rewrite (G2 of HOS-1957). All logic lives in
 * `cli-rehearsal-emails-main.ts`; this file only wires the real dependencies.
 */
async function entry(): Promise<void> {
    try {
        process.exit(
            await runRehearsalEmailsCli({
                args: process.argv.slice(2),
                session: process.env,
                connectDb: connectWritable,
                out: (line) => console.info(line),
                err: (line) => console.error(line)
            })
        );
    } catch {
        console.error(
            'rehearsal email rewrite crashed; the rewrite runs in one transaction, so nothing was written'
        );
        process.exit(1);
    }
}

void entry();
