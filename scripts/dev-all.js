#!/usr/bin/env node

/**
 * Development script to run all servers concurrently:
 * - API (port 3001)
 * - Admin (port 3000)
 * - Web (port 4321)
 *
 * Usage: node scripts/dev-all.js [options]
 * Options:
 *   --api-only     Run only the API server
 *   --admin-only   Run only the Admin server
 *   --web-only     Run only the Web server
 *   --no-api       Run without the API server
 *   --no-admin     Run without the Admin server
 *   --no-web       Run without the Web server
 */

import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');

// ANSI colors for terminal output
const colors = {
    reset: '\x1b[0m',
    bold: '\x1b[1m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    cyan: '\x1b[36m'
};

// Server configurations
const servers = {
    api: {
        name: 'API',
        color: colors.cyan,
        cwd: join(rootDir, 'apps/api'),
        command: 'pnpm',
        args: ['dev'],
        port: 3001
    },
    admin: {
        name: 'Admin',
        color: colors.magenta,
        cwd: join(rootDir, 'apps/admin'),
        command: 'pnpm',
        args: ['dev'],
        port: 3000
    },
    web: {
        name: 'Web',
        color: colors.green,
        cwd: join(rootDir, 'apps/web'),
        command: 'pnpm',
        args: ['dev'],
        port: 4321
    }
};

// Parse command line arguments
const args = process.argv.slice(2);
const onlyApi = args.includes('--api-only');
const onlyAdmin = args.includes('--admin-only');
const onlyWeb = args.includes('--web-only');
const noApi = args.includes('--no-api');
const noAdmin = args.includes('--no-admin');
const noWeb = args.includes('--no-web');

// Determine which servers to run
let serversToRun = [];

if (onlyApi) {
    serversToRun = ['api'];
} else if (onlyAdmin) {
    serversToRun = ['admin'];
} else if (onlyWeb) {
    serversToRun = ['web'];
} else {
    serversToRun = Object.keys(servers).filter((key) => {
        if (key === 'api' && noApi) return false;
        if (key === 'admin' && noAdmin) return false;
        if (key === 'web' && noWeb) return false;
        return true;
    });
}

// Track running processes for cleanup
const processes = [];

/**
 * Create a prefixed logger for a server
 */
function createLogger(server) {
    const prefix = `${server.color}[${server.name.padEnd(5)}]${colors.reset}`;
    return {
        log: (data) => {
            const lines = data.toString().split('\n').filter(Boolean);
            for (const line of lines) {
                console.log(`${prefix} ${line}`);
            }
        },
        error: (data) => {
            const lines = data.toString().split('\n').filter(Boolean);
            for (const line of lines) {
                console.error(`${prefix} ${colors.red}${line}${colors.reset}`);
            }
        }
    };
}

/**
 * Start a server process
 */
function startServer(key) {
    const server = servers[key];
    const logger = createLogger(server);

    console.log(
        `${colors.bold}${server.color}Starting ${server.name} server on port ${server.port}...${colors.reset}`
    );

    const proc = spawn(server.command, server.args, {
        cwd: server.cwd,
        shell: true,
        env: { ...process.env, FORCE_COLOR: '1' }
    });

    proc.stdout.on('data', logger.log);
    proc.stderr.on('data', logger.error);

    proc.on('error', (err) => {
        console.error(`${colors.red}Failed to start ${server.name}: ${err.message}${colors.reset}`);
    });

    proc.on('exit', (code) => {
        if (code !== null && code !== 0) {
            console.log(
                `${colors.yellow}${server.name} exited with code ${code}${colors.reset}`
            );
        }
    });

    processes.push(proc);
    return proc;
}

/**
 * Cleanup all processes on exit
 */
function cleanup() {
    console.log(`\n${colors.yellow}Shutting down all servers...${colors.reset}`);
    for (const proc of processes) {
        proc.kill('SIGTERM');
    }
    process.exit(0);
}

// Handle termination signals
process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);

// Print header
console.log(`
${colors.bold}════════════════════════════════════════════════════════════════${colors.reset}
${colors.bold}  🚀 Hospeda Development Servers${colors.reset}
${colors.bold}════════════════════════════════════════════════════════════════${colors.reset}
`);

// Start selected servers
for (const key of serversToRun) {
    startServer(key);
}

// Print running info
console.log(`
${colors.bold}Running servers:${colors.reset}
${serversToRun.map((key) => `  ${servers[key].color}● ${servers[key].name.padEnd(6)}${colors.reset} → http://localhost:${servers[key].port}`).join('\n')}

${colors.yellow}Press Ctrl+C to stop all servers${colors.reset}
────────────────────────────────────────────────────────────────
`);
