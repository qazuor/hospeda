import { Config } from '@remotion/cli/config';
import { resolveAssetPaths } from './config/asset-paths';

/** Webpack alias that lets compositions import JSON (event logs, layer maps) from the external public dir. */
const ASSETS_ALIAS = '@marketing-assets';

const { publicDir } = resolveAssetPaths();

Config.setVideoImageFormat('jpeg');
Config.setOverwriteOutput(true);
// Generated media (recordings, poses, audio) lives outside the repo; staticFile() resolves here.
Config.setPublicDir(publicDir);
Config.overrideWebpackConfig((current) => {
    const alias = current.resolve?.alias;
    if (Array.isArray(alias)) {
        throw new Error('Unexpected array-form webpack alias in the Remotion config');
    }
    return {
        ...current,
        resolve: {
            ...current.resolve,
            alias: { ...alias, [ASSETS_ALIAS]: publicDir }
        }
    };
});
