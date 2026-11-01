import { existsSync, statSync } from 'node:fs';
import { join } from 'node:path';

/** Environment variable that points at the root of the generated marketing assets. */
export const ASSETS_DIR_ENV = 'HOSPEDA_MARKETING_ASSETS_DIR';

/** Default root of the generated marketing assets: outside the repo, next to it. */
export const DEFAULT_ASSETS_DIR = '/home/qazuor/projects/WEBS/marketing';

/** Every directory the video tooling reads from or writes to. None of them is inside the repo. */
export type AssetPaths = {
    /** Root of the generated marketing assets (`HOSPEDA_MARKETING_ASSETS_DIR`). */
    readonly assetsDir: string;
    /** Working area of the video pipeline inside the assets root. */
    readonly labDir: string;
    /** Remotion public dir: recordings ready to edit, character poses, audio, logo. */
    readonly publicDir: string;
    /** Raw Playwright takes (frames + event log). */
    readonly recordingsDir: string;
    /** Rendered videos and stills. */
    readonly outDir: string;
};

/**
 * Resolves the external asset directories from the environment.
 *
 * @param input.env - Environment to read (defaults to the process environment).
 * @param input.requireExisting - Throw when the assets root does not exist (default `true`).
 * @returns The resolved {@link AssetPaths}.
 * @throws Error when `requireExisting` is set and the assets root is missing or not a directory.
 */
export const resolveAssetPaths = ({
    env = process.env,
    requireExisting = true
}: {
    readonly env?: Readonly<Record<string, string | undefined>>;
    readonly requireExisting?: boolean;
} = {}): AssetPaths => {
    const raw = env[ASSETS_DIR_ENV]?.trim();
    const assetsDir = raw && raw.length > 0 ? raw : DEFAULT_ASSETS_DIR;
    if (requireExisting && !(existsSync(assetsDir) && statSync(assetsDir).isDirectory())) {
        throw new Error(
            `${ASSETS_DIR_ENV} must point at an existing directory; got "${assetsDir}". See marketing/videos/README.md.`
        );
    }
    const labDir = join(assetsDir, 'video-lab');
    return {
        assetsDir,
        labDir,
        publicDir: join(labDir, 'public'),
        recordingsDir: join(labDir, 'recordings'),
        outDir: join(labDir, 'out')
    };
};
