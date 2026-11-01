/**
 * Renders one composition into the external out dir.
 * Usage: tsx scripts/render.mts <CompositionId> <file-name> [extra remotion flags...]
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { resolveAssetPaths } from '../config/asset-paths';

const [composition, fileName, ...rest] = process.argv.slice(2);
if (!composition || !fileName) {
    console.error('Usage: tsx scripts/render.mts <CompositionId> <file-name> [remotion flags...]');
    process.exit(1);
}

const { outDir } = resolveAssetPaths();
mkdirSync(outDir, { recursive: true });
const output = join(outDir, fileName);
execFileSync('remotion', ['render', composition, output, ...rest], { stdio: 'inherit' });
console.info(`rendered → ${output}`);
