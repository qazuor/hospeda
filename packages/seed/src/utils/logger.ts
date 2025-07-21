export const logger = {
    info: (msg: string) => console.log(`\x1b[36m[INFO]\x1b[0m ${msg}`),
    success: (msg: string) => console.log(`\x1b[32m[SUCCESS]\x1b[0m ${msg}`),
    warn: (msg: string) => console.warn(`\x1b[33m[WARN]\x1b[0m ${msg}`),
    error: (msg: string) => console.error(`\x1b[31m[ERROR]\x1b[0m ${msg}`),
    dim: (msg: string) => console.log(`\x1b[2m${msg}\x1b[0m`)
};
