// Regex para slugs (ej: my-slug-123)
export const SlugRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

// Regex para hora en formato HH:mm (24h)
export const TimeRegExp = /^([01]\d|2[0-3]):([0-5]\d)$/;

// Regex para teléfono internacional (E.164)
export const InternationalPhoneRegex = /^\+[1-9]\d{1,14}(?:\s\d{1,15})*$/;

// Regex para URLs de redes sociales
export const FacebookUrlRegex = /^https?:\/\/(www\.)?facebook\.com\//;
export const InstagramUrlRegex = /^https?:\/\/(www\.)?instagram\.com\//;
export const TwitterUrlRegex = /^https?:\/\/(www\.)?twitter\.com\//;
export const LinkedInUrlRegex = /^https?:\/\/(www\.)?linkedin\.com\//;
export const TikTokUrlRegex = /^https?:\/\/(www\.)?tiktok\.com\//;
export const YouTubeUrlRegex = /^https?:\/\/(www\.)?youtube\.com\//;

export const isValidLatitude = (val: string) => {
    const n = Number(val);
    return !Number.isNaN(n) && n >= -90 && n <= 90;
};
export const isValidLongitude = (val: string) => {
    const n = Number(val);
    return !Number.isNaN(n) && n >= -180 && n <= 180;
};

// Regex para password fuerte: 8-20 caracteres, al menos una mayúscula, una minúscula, un número y un caracter especial
export const StrongPasswordRegex =
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]).{8,20}$/;

// Campos base a omitir en acciones CRUD
export const omittedBaseEntityFieldsForActions = [
    'id',
    'createdAt',
    'updatedAt',
    'deletedAt',
    'deletedById'
];
