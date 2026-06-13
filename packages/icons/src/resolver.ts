/**
 * @repo/icons/resolver — Icon resolver subpath.
 *
 * Isolated entry for ICON_MAP + resolveIcon so consumers that only need
 * named icon components (e.g. `import { SearchIcon } from '@repo/icons'`)
 * never pull the ~230-icon static map into their chunk.
 */
export { ICON_MAP, resolveIcon } from './icon-resolver';
