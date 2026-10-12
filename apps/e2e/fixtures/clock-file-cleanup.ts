import { rmSync } from 'node:fs';

/** Remove the file-backed E2E clock so the API falls back to system time. */
export function removeE2eClockFile(args: { readonly path: string }): void {
    rmSync(args.path, { force: true });
}
