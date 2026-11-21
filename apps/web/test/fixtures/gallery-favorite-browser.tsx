import { createRoot } from 'react-dom/client';
import { ImageGallery } from '@/components/ImageGallery.client';

const root = document.querySelector('#gallery');
if (root) {
    createRoot(root).render(
        <ImageGallery
            variant="detail"
            locale="en"
            images={[{ url: '/hero.jpg', alt: 'Hero' }]}
            mobile={{
                backHref: '/en/alojamientos/',
                favorite: { entityId: 'listing-1', entityType: 'ACCOMMODATION' }
            }}
        />
    );
}
