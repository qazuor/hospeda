/**
 * Metro bundler configuration for the Hospeda mobile app (Expo SDK 56+).
 *
 * As of Expo SDK 52+, Metro automatically configures monorepo settings —
 * watchFolders, nodeModulesPaths, and symlink resolution — when
 * `getDefaultConfig` from `expo/metro-config` is used.
 * Manual configuration of those fields is no longer required.
 *
 * See: https://docs.expo.dev/guides/monorepos/#automatic-configuration-migrating-to-sdk-52
 *
 * @type {import('expo/metro-config').MetroConfig}
 */
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

module.exports = config;
