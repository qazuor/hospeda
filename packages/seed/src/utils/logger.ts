export const logger = {
    info: (msg: string) => console.log(`\x1b[106m\x1b[30m[  INFO ]\x1b[0m ${msg}`),
    success: (msg: string) => console.log(`\x1b[102m\x1b[30m[SUCCESS]\x1b[0m ${msg}`),
    warn: (msg: string) => console.warn(`\x1b[43m\x1b[30m[  WARN ]\x1b[0m ${msg}`),
    error: (msg: string) => console.error(`\x1b[41m\x1b[37m[ ERROR ]\x1b[0m ${msg}`),
    dim: (msg: string) => console.log(`\x1b[2m${msg}\x1b[0m`)
};
