export const testimonials = [
    {
        id: 1,
        name: 'María Fernández',
        location: 'Buenos Aires',
        content:
            'Encontramos una cabaña preciosa en Colón gracias a Hosped.ar. El proceso de reserva fue rápido y sencillo, y la atención del anfitrión excelente. ¡Repetiremos seguro!',
        avatar: 'https://images.pexels.com/photos/774909/pexels-photo-774909.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=1',
        rating: 5
    },
    {
        id: 2,
        name: 'Carlos Gutiérrez',
        location: 'Rosario',
        content:
            'Viajamos en familia a Gualeguaychú y reservamos una casa con piscina que superó nuestras expectativas. Las fotos eran precisas y el lugar estaba impecable. Muy recomendable.',
        avatar: 'https://images.pexels.com/photos/91227/pexels-photo-91227.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=1',
        rating: 4
    },
    {
        id: 3,
        name: 'Laura Méndez',
        location: 'Córdoba',
        content:
            'Gracias a Hosped.ar descubrimos Federación y sus termas. El apartamento que reservamos estaba muy bien ubicado y el anfitrión nos dio excelentes recomendaciones locales.',
        avatar: 'https://images.pexels.com/photos/1239291/pexels-photo-1239291.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=1',
        rating: 5
    }
];

export function getTestimonials() {
    return testimonials;
}
