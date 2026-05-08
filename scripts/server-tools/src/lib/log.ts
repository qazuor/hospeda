/**
 * Tiny structured logger for hctl. Writes everything to stderr so tool
 * stdout (the actual command output) stays pipe-friendly.
 *
 * The intent is not feature-parity with pino/winston — it's just the
 * smallest API the toolkit needs, with consistent prefixes / colors so
 * operators can scan output quickly.
 */

const isTty = process.stderr.isTTY;

const c = {
    reset: isTty ? '\x1b[0m' : '',
    dim: isTty ? '\x1b[2m' : '',
    red: isTty ? '\x1b[31m' : '',
    yellow: isTty ? '\x1b[33m' : '',
    green: isTty ? '\x1b[32m' : '',
    cyan: isTty ? '\x1b[36m' : ''
} as const;

function emit(prefix: string, color: string, message: string): void {
    process.stderr.write(`${color}${prefix}${c.reset} ${message}\n`);
}

export const log = {
    info(message: string): void {
        emit('ℹ', c.cyan, message);
    },
    ok(message: string): void {
        emit('✓', c.green, message);
    },
    warn(message: string): void {
        emit('⚠', c.yellow, message);
    },
    error(message: string): void {
        emit('✗', c.red, message);
    },
    hint(message: string): void {
        process.stderr.write(`${c.dim}${message}${c.reset}\n`);
    }
};

/**
 * Print an error and exit with the given status (default 1). Wraps the
 * common "log + process.exit" pattern so call sites stay short.
 */
export function die(message: string, status = 1): never {
    log.error(message);
    process.exit(status);
}
