/** Resolved guest session for the browser gallery fixture. */
export const useAccountPermissions = () => ({ user: null, permissions: {} });
/** Ready, unmarked favorite for the guest fixture. */
export const getFavoriteStatus = () => ({ isResolving: false, isFavorited: false });
/** Ready favorite state for the guest fixture. */
export const useFavoriteStatus = getFavoriteStatus;
/** The guest fixture never writes a favorite. */
export const setFavoriteStatus = () => {};
