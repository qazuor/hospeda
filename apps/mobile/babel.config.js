/**
 * Babel configuration for the Expo / React Native mobile app.
 *
 * Uses `babel-preset-expo` which is the standard preset for managed-workflow
 * Expo apps. No additional plugins are needed: NativeWind is NOT used (ADR-033),
 * so there is no Tailwind Babel plugin here.
 *
 * @param {import('@babel/core').ConfigAPI} api
 * @returns {import('@babel/core').TransformOptions}
 */
module.exports = (api) => {
    api.cache(true);
    return {
        presets: ['babel-preset-expo']
    };
};
