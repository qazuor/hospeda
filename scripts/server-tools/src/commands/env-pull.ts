/**
 * `hops env-pull <api|web|admin>` — dump Coolify env vars to a local
 * file in `.env` format.
 *
 * Default: values redacted, output goes to `./.env.coolify-{kind}`.
 * Pass `--reveal` to write actual values (requires `read:sensitive`
 * scope on the API token) and `-o <path>` to override the destination.
 *
 * The file is created with mode 0600 so secrets do not leak via group /
 * other read bits. The command refuses to overwrite an existing file
 * unless `--force` is passed.
 */

import { writeFileSync } from 'node:fs';
import { findContainer, getApplicationUuid } from '../lib/container-lookup.ts';
import { CoolifyApiError, type CoolifyEnvVar, createCoolifyClient } from '../lib/coolify.ts';
import { die, log } from '../lib/log.ts';

const KINDS = ['api', 'web', 'admin'] as const;
type App = (typeof KINDS)[number];

const HELP = `
hops env-pull <api|web|admin> [-o <path>] [--reveal] [--force]

Write the Coolify env vars for an app to a local file in .env format.
The file is created with mode 0600 (read/write for the owner only).

Flags:
  -o <path>     Output file path (default: ./.env.coolify-<kind>).
  --reveal      Write actual values (token must have read:sensitive
                scope). Without this, values are redacted.
  --force       Overwrite the output file if it already exists.
  --help, -h    Show this help.

Examples:
  hops env-pull api
  hops env-pull api --reveal -o ./tmp/api.env
  hops env-pull web --force
`.trim();

function isApp(value: string): value is App {
    return (KINDS as ReadonlyArray<string>).includes(value);
}

function quoteIfNeeded(value: string): string {
    if (value === '') return '';
    // Quote when the value contains whitespace, '#', or quotes; keep
    // it bare otherwise so the file stays diff-friendly.
    if (/[\s#"']/.test(value)) {
        return `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
    }
    return value;
}

export async function envPull(argv: ReadonlyArray<string>): Promise<void> {
    const args = [...argv];

    if (args.includes('--help') || args.includes('-h')) {
        process.stdout.write(`${HELP}\n`);
        return;
    }

    const reveal = args.includes('--reveal');
    const force = args.includes('--force');

    const oIdx = args.indexOf('-o');
    const outputArg = oIdx >= 0 ? args[oIdx + 1] : undefined;
    if (oIdx >= 0 && !outputArg) {
        die('-o requires a path argument.');
    }

    const positional = args.filter((a) => !a.startsWith('-')).filter((a) => a !== outputArg);

    const kindRaw = positional[0];
    if (!kindRaw) die('Missing <kind>. Run with --help for usage.');
    if (!isApp(kindRaw)) {
        die(`Unknown app '${kindRaw}'. Known: ${KINDS.join(', ')}.`);
    }

    const outputPath = outputArg ?? `./.env.coolify-${kindRaw}`;

    // Refuse to overwrite without --force so a stray invocation does
    // not silently nuke the operator's existing dotenv file.
    try {
        const fs = await import('node:fs');
        if (fs.existsSync(outputPath) && !force) {
            die(`Refusing to overwrite '${outputPath}' (pass --force to override).`);
        }
    } catch (err) {
        die(
            `fs check failed for '${outputPath}': ${err instanceof Error ? err.message : String(err)}`
        );
    }

    const container = await findContainer(kindRaw);
    const uuid = await getApplicationUuid(container);
    const client = createCoolifyClient();

    let vars: ReadonlyArray<CoolifyEnvVar>;
    try {
        vars = await client.listEnvVars(uuid);
    } catch (err) {
        if (err instanceof CoolifyApiError) {
            die(`Coolify rejected env list (${err.status}): ${JSON.stringify(err.body)}`);
        }
        throw err;
    }

    const sorted = [...vars].sort((a, b) => a.key.localeCompare(b.key));
    const lines: string[] = [
        `# Coolify env vars for '${kindRaw}'`,
        `# Pulled from ${client.baseUrl()} on ${new Date().toISOString()}`,
        `# Mode: ${reveal ? 'values revealed' : 'values redacted'}`,
        ''
    ];
    for (const v of sorted) {
        if (reveal) {
            lines.push(`${v.key}=${quoteIfNeeded(v.value ?? '')}`);
        } else {
            lines.push(`${v.key}=${v.value ? '***REDACTED***' : ''}`);
        }
    }

    writeFileSync(outputPath, `${lines.join('\n')}\n`, { mode: 0o600 });

    log.ok(
        `Wrote ${sorted.length} vars to ${outputPath} (${reveal ? 'revealed' : 'redacted'}, mode 0600).`
    );
}
