/**
 * `hops docker-by-name <prefix>` — print details for any running
 * container whose name starts with the given prefix. Equivalent to the
 * docker-ps + grep dance we kept typing during the migration, with a
 * clear error message when there is no match.
 */

import * as p from '@clack/prompts';
import { dockerPs } from '../lib/docker.ts';
import { die, log } from '../lib/log.ts';

const HELP = `
hops docker-by-name <prefix>

Print details for any running container whose name starts with <prefix>.
Output columns: NAMES, STATUS, IMAGE, PORTS.

Flags:
  --help, -h     Show this help.

Examples:
  hops docker-by-name coolify
  hops docker-by-name j4luw

Notes:
  Without <prefix>, opens an interactive prompt to enter one.
`.trim();

export async function dockerByName(argv: ReadonlyArray<string>): Promise<void> {
    if (argv.includes('--help') || argv.includes('-h')) {
        process.stdout.write(`${HELP}\n`);
        return;
    }

    let [prefix] = argv;

    if (!prefix) {
        const answer = await p.text({
            message: 'Container name prefix',
            placeholder: 'e.g. j4luw or coolify',
            validate(value) {
                if (!value || value.trim().length === 0) {
                    return 'Prefix cannot be empty.';
                }
                return undefined;
            }
        });
        if (p.isCancel(answer)) {
            log.warn('Cancelled.');
            return;
        }
        prefix = answer.trim();
    }

    const rows = await dockerPs({
        format: '{{.Names}}\t{{.Status}}\t{{.Image}}\t{{.Ports}}'
    });

    const needle = prefix;
    const matches = rows.filter((line) => {
        const name = line.split('\t')[0] ?? '';
        return name.startsWith(needle);
    });

    if (matches.length === 0) {
        die(`No running container matches prefix '${prefix}'.`);
    }

    const output = ['NAMES\tSTATUS\tIMAGE\tPORTS', ...matches];
    process.stdout.write(`${formatTable(output)}\n`);
}

/**
 * Render a tab-separated table as space-padded columns. Avoids pulling
 * in cli-table3 / table for a one-screen output.
 */
function formatTable(lines: ReadonlyArray<string>): string {
    const rows = lines.map((line) => line.split('\t'));
    const widths: number[] = [];
    for (const row of rows) {
        row.forEach((cell, i) => {
            widths[i] = Math.max(widths[i] ?? 0, cell.length);
        });
    }
    return rows
        .map((row) => row.map((cell, i) => cell.padEnd(widths[i] ?? cell.length)).join('  '))
        .join('\n');
}
