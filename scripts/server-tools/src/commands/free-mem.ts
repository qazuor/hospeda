/**
 * `hops free-mem` — host + per-container memory snapshot.
 *
 * Two sources:
 *   - Host: `free -m` (kernel-reported total / used / available).
 *   - Containers: `docker stats --no-stream` (cgroup-reported per
 *     container CPU%, mem usage, mem%).
 *
 * No follow mode — this is a one-shot snapshot. For continuous
 * watching use `docker stats` directly.
 */

import { docker } from '../lib/docker.ts';
import { die, log } from '../lib/log.ts';
import { runner } from '../lib/runner.ts';

const HELP = `
hops free-mem [--warn-pct <N>]

Print host RAM (free -m) followed by per-container CPU / memory stats
from \`docker stats --no-stream\`.

Flags:
  --warn-pct <N>     Highlight containers using >= N% of their mem
                     limit (default 80).
  --help, -h         Show this help.

Examples:
  hops free-mem
  hops free-mem --warn-pct 50
`.trim();

interface ContainerRow {
    readonly name: string;
    readonly cpuPct: string;
    readonly memUsage: string;
    readonly memPctRaw: string;
    readonly memPctNumber: number;
}

export async function freeMem(argv: ReadonlyArray<string>): Promise<void> {
    if (argv.includes('--help') || argv.includes('-h')) {
        process.stdout.write(`${HELP}\n`);
        return;
    }

    let warnPct = 80;
    const warnIdx = argv.indexOf('--warn-pct');
    if (warnIdx >= 0) {
        const value = argv[warnIdx + 1];
        if (!value) die('--warn-pct requires a number.');
        const parsed = Number.parseFloat(value);
        if (!Number.isFinite(parsed) || parsed < 0 || parsed > 100) {
            die(`--warn-pct: invalid percentage '${value}' (expected 0..100).`);
        }
        warnPct = parsed;
    }

    // ── Host ────────────────────────────────────────────────────────────
    log.info('Host memory (free -m):');
    const host = await runner.run(['free', '-m']);
    if (host.exitCode !== 0) {
        die(`free -m failed: ${host.stderr.trim() || `exit ${host.exitCode}`}`);
    }
    process.stdout.write(host.stdout.trimEnd());
    process.stdout.write('\n\n');

    // ── Containers ──────────────────────────────────────────────────────
    log.info('Containers (docker stats --no-stream):');
    const stats = await docker([
        'stats',
        '--no-stream',
        '--format',
        '{{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.MemPerc}}'
    ]);
    if (stats.exitCode !== 0) {
        die(`docker stats failed: ${stats.stderr.trim() || `exit ${stats.exitCode}`}`);
    }

    const rows: ContainerRow[] = stats.stdout
        .trim()
        .split('\n')
        .filter((line) => line.length > 0)
        .map((line) => {
            const [name, cpuPct, memUsage, memPctRaw] = line.split('\t');
            return {
                name: name ?? '?',
                cpuPct: cpuPct ?? '?',
                memUsage: memUsage ?? '?',
                memPctRaw: memPctRaw ?? '0%',
                memPctNumber: Number.parseFloat((memPctRaw ?? '0').replace('%', '')) || 0
            };
        })
        .sort((a, b) => b.memPctNumber - a.memPctNumber);

    if (rows.length === 0) {
        log.warn('No running containers.');
        return;
    }

    // Pretty table — fixed-width columns, container name truncated to 60
    // so a long Coolify-suffixed name doesn't push everything off-screen.
    const header: ContainerRow = {
        name: 'NAME',
        cpuPct: 'CPU %',
        memUsage: 'MEM USAGE / LIMIT',
        memPctRaw: 'MEM %',
        memPctNumber: -1
    };
    const all = [header, ...rows];
    const widths = {
        name: Math.min(60, Math.max(...all.map((r) => r.name.length))),
        cpu: Math.max(...all.map((r) => r.cpuPct.length)),
        mem: Math.max(...all.map((r) => r.memUsage.length)),
        pct: Math.max(...all.map((r) => r.memPctRaw.length))
    };
    const truncate = (s: string, n: number): string => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

    let warnings = 0;
    for (const row of all) {
        const isHeader = row === header;
        const overWarn = !isHeader && row.memPctNumber >= warnPct;
        const line = [
            truncate(row.name, widths.name).padEnd(widths.name),
            row.cpuPct.padStart(widths.cpu),
            row.memUsage.padStart(widths.mem),
            row.memPctRaw.padStart(widths.pct)
        ].join('  ');
        if (overWarn) {
            warnings++;
            process.stdout.write(`\x1b[33m${line}\x1b[0m\n`);
        } else {
            process.stdout.write(`${line}\n`);
        }
    }

    if (warnings > 0) {
        log.warn(`${warnings} container(s) at or above ${warnPct}% memory.`);
    }
}
