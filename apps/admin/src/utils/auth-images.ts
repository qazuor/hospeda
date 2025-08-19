/**
 * Utility functions for authentication page background images
 */

/**
 * List of available tourism images for authentication pages
 */
export const AUTH_BACKGROUND_IMAGES = [
    {
        src: '/images/auth/paso_vera.webp',
        alt: 'Paso Vera - Uruguay',
        location: 'Paso Vera, Uruguay'
    },
    {
        src: '/images/auth/sanjose.jpg',
        alt: 'San José - Uruguay',
        location: 'San José, Uruguay'
    },
    {
        src: '/images/auth/gualeguaychu_termal.jpg',
        alt: 'Gualeguaychú Termal - Entre Ríos',
        location: 'Gualeguaychú, Entre Ríos'
    },
    {
        src: '/images/auth/autodromo_tc.jpg',
        alt: 'Autódromo TC - Entre Ríos',
        location: 'Autódromo, Entre Ríos'
    },
    {
        src: '/images/auth/concepcion_uruguay.jpg',
        alt: 'Concepción del Uruguay - Entre Ríos',
        location: 'Concepción del Uruguay, Entre Ríos'
    },
    {
        src: '/images/auth/el_palmar.jpg',
        alt: 'El Palmar - Entre Ríos',
        location: 'Parque Nacional El Palmar, Entre Ríos'
    },
    {
        src: '/images/auth/elonce_turismo.jpg',
        alt: 'Turismo Entre Ríos',
        location: 'Entre Ríos, Argentina'
    }
] as const;

/**
 * Type for background image data
 */
export type AuthBackgroundImage = (typeof AUTH_BACKGROUND_IMAGES)[number];

/**
 * Gets a random background image for authentication pages
 * @returns A random image object with src, alt, and location
 */
export function getRandomAuthImage(): AuthBackgroundImage {
    const randomIndex = Math.floor(Math.random() * AUTH_BACKGROUND_IMAGES.length);
    return AUTH_BACKGROUND_IMAGES[randomIndex];
}

/**
 * Gets a random background image different from the current one
 * @param currentSrc The current image src to avoid
 * @returns A different random image object
 */
export function getRandomAuthImageExcluding(currentSrc: string): AuthBackgroundImage {
    const availableImages = AUTH_BACKGROUND_IMAGES.filter((img) => img.src !== currentSrc);

    if (availableImages.length === 0) {
        return AUTH_BACKGROUND_IMAGES[0];
    }

    const randomIndex = Math.floor(Math.random() * availableImages.length);
    return availableImages[randomIndex];
}

/**
 * Hook for using random auth background images in React components
 * @param excludeCurrent Optional current image src to exclude from selection
 * @returns An object with the selected image and a function to get a new random image
 */
export function useRandomAuthImage(excludeCurrent?: string) {
    const getImage = () => {
        return excludeCurrent ? getRandomAuthImageExcluding(excludeCurrent) : getRandomAuthImage();
    };

    return {
        image: getImage(),
        getNewImage: getImage
    };
}
