import type { AppOpenAPI } from '../types';
import { apiLogger } from '../utils/logger';
import { accommodationRoutes } from './accommodation';
import accommodationListingRoutes from './accommodation-listing';
import accommodationListingPlanRoutes from './accommodation-listing-plan';
import adMediaAssetRoutes from './ad-media-asset';
import adPricingCatalogRoutes from './ad-pricing-catalog';
import adSlotRoutes from './ad-slot';
import adSlotReservationRoutes from './ad-slot-reservation';
import { attractionRoutes } from './attraction';
import benefitListingRoutes from './benefit-listing';
import benefitListingPlanRoutes from './benefit-listing-plan';
import benefitPartnerRoutes from './benefit-partner';
import campaignRoutes from './campaign';
import { clientRoutes } from './client';
import { clientAccessRightRoutes } from './client-access-right';
import creditNoteRoutes from './credit-note';
import { destinationRoutes } from './destination';
import discountCodeRoutes from './discount-code';
import discountCodeUsageRoutes from './discount-code-usage';
import { eventRoutes } from './event';
import { eventLocationRoutes } from './event-location';
import { eventOrganizerRoutes } from './event-organizer';
import featuredAccommodationRoutes from './featured-accommodation';
import invoiceRoutes from './invoice';
import invoiceLineRoutes from './invoice-line';
import notificationRoutes from './notification';
import paymentRoutes from './payment';
import paymentMethodRoutes from './payment-method';
import { postRoutes } from './post';
import { pricingPlanRoutes } from './pricing-plan';
import { pricingTierRoutes } from './pricing-tier';
import { productRoutes } from './product';
import professionalServiceRoutes from './professional-service';
import professionalServiceOrderRoutes from './professional-service-order';
import promotionRoutes from './promotion';
import { purchaseRoutes } from './purchase';
import refundRoutes from './refund';
import serviceListingRoutes from './service-listing';
import serviceListingPlanRoutes from './service-listing-plan';
import { sponsorRoutes } from './sponsor';
import sponsorshipRoutes from './sponsorship';
import { subscriptionRoutes } from './subscription';
import { subscriptionItemRoutes } from './subscription-item';
import touristServiceRoutes from './tourist-service';

apiLogger.debug('🏠 Loading accommodation routes...');
apiLogger.debug('✅ Accommodation routes loaded successfully');

import { amenityRoutes } from './amenity';
import { authRoutes } from './auth';
import { docsIndexRoutes, scalarRoutes, swaggerRoutes } from './docs';
import { featureRoutes } from './feature';
import { dbHealthRoutes, healthRoutes, liveRoutes, readyRoutes } from './health';
import { metricsRoutes } from './metrics';
import { userRoutes } from './user';

import { ApiInfoSchema } from '@repo/schemas';
import { createSimpleRoute } from '../utils/route-factory';

const rootRoute = createSimpleRoute({
    method: 'get',
    path: '/',
    summary: 'API Information',
    description: 'Returns basic information about the Hospeda API',
    tags: ['System'],
    responseSchema: ApiInfoSchema,
    handler: async () => ({
        name: 'hospeda-api',
        version: '0.0.1',
        description: 'Complete API for the Hospeda tourism accommodation platform',
        status: 'operational',
        timestamp: new Date().toISOString(),
        documentation: '/docs'
    }),
    options: {
        skipAuth: true, // Public endpoint
        cacheTTL: 300 // Cache for 5 minutes
    }
});

export const setupRoutes = (app: AppOpenAPI) => {
    app.route('/', rootRoute);

    // Health check routes
    app.route('/health', healthRoutes);
    app.route('/health', dbHealthRoutes);
    app.route('/health', readyRoutes);
    app.route('/health', liveRoutes);

    // Metrics routes
    app.route('/metrics', metricsRoutes);

    // Public routes
    app.route('/api/v1/public/users', userRoutes);

    try {
        apiLogger.debug('🔗 Registering accommodation routes...');
        app.route('/api/v1/public/accommodations', accommodationRoutes);
        apiLogger.debug('✅ Accommodation routes registered successfully');

        apiLogger.debug('🔗 Registering destination routes...');
        app.route('/api/v1/public/destinations', destinationRoutes);
        apiLogger.debug('✅ Destination routes registered successfully');

        apiLogger.debug('🔗 Registering event routes...');
        app.route('/api/v1/public/events', eventRoutes);
        apiLogger.debug('✅ Event routes registered successfully');

        apiLogger.debug('🔗 Registering post routes...');
        app.route('/api/v1/public/posts', postRoutes);
        apiLogger.debug('✅ Post routes registered successfully');

        apiLogger.debug('🔗 Registering amenity routes...');
        app.route('/api/v1/public', amenityRoutes);
        apiLogger.debug('✅ Amenity routes registered successfully');

        apiLogger.debug('🔗 Registering feature routes...');
        app.route('/api/v1/public', featureRoutes);
        apiLogger.debug('✅ Feature routes registered successfully');

        apiLogger.debug('🔗 Registering attraction routes...');
        app.route('/api/v1/public', attractionRoutes);
        apiLogger.debug('✅ Attraction routes registered successfully');

        apiLogger.debug('🔗 Registering sponsor routes...');
        app.route('/api/v1/public', sponsorRoutes);
        apiLogger.debug('✅ Sponsor routes registered successfully');

        apiLogger.debug('🔗 Registering event organizer routes...');
        app.route('/api/v1/public', eventOrganizerRoutes);
        apiLogger.debug('✅ Event organizer routes registered successfully');

        apiLogger.debug('🔗 Registering event location routes...');
        app.route('/api/v1/public', eventLocationRoutes);
        apiLogger.debug('✅ Event location routes registered successfully');

        // Business Model System routes
        apiLogger.debug('🔗 Registering client routes...');
        app.route('/api/v1/clients', clientRoutes);
        apiLogger.debug('✅ Client routes registered successfully');

        apiLogger.debug('🔗 Registering client access right routes...');
        app.route('/api/v1/client-access-rights', clientAccessRightRoutes);
        apiLogger.debug('✅ Client access right routes registered successfully');

        apiLogger.debug('🔗 Registering product routes...');
        app.route('/api/v1/products', productRoutes);
        apiLogger.debug('✅ Product routes registered successfully');

        apiLogger.debug('🔗 Registering pricing plan routes...');
        app.route('/api/v1/pricing-plans', pricingPlanRoutes);
        apiLogger.debug('✅ Pricing plan routes registered successfully');

        apiLogger.debug('🔗 Registering pricing tier routes...');
        app.route('/api/v1/pricing-tiers', pricingTierRoutes);
        apiLogger.debug('✅ Pricing tier routes registered successfully');

        apiLogger.debug('🔗 Registering subscription routes...');
        app.route('/api/v1/subscriptions', subscriptionRoutes);
        apiLogger.debug('✅ Subscription routes registered successfully');

        apiLogger.debug('🔗 Registering purchase routes...');
        app.route('/api/v1/purchases', purchaseRoutes);
        apiLogger.debug('✅ Purchase routes registered successfully');

        apiLogger.debug('🔗 Registering subscription item routes...');
        app.route('/api/v1/subscription-items', subscriptionItemRoutes);
        apiLogger.debug('✅ Subscription item routes registered successfully');

        apiLogger.debug('🔗 Registering payment routes...');
        app.route('/api/v1/payments', paymentRoutes);
        apiLogger.debug('✅ Payment routes registered successfully');

        apiLogger.debug('🔗 Registering payment method routes...');
        app.route('/api/v1/payment-methods', paymentMethodRoutes);
        apiLogger.debug('✅ Payment method routes registered successfully');

        apiLogger.debug('🔗 Registering invoice routes...');
        app.route('/api/v1/invoices', invoiceRoutes);
        apiLogger.debug('✅ Invoice routes registered successfully');

        apiLogger.debug('🔗 Registering invoice line routes...');
        app.route('/api/v1/invoice-lines', invoiceLineRoutes);
        apiLogger.debug('✅ Invoice line routes registered successfully');

        apiLogger.debug('🔗 Registering refund routes...');
        app.route('/api/v1/refunds', refundRoutes);
        apiLogger.debug('✅ Refund routes registered successfully');

        apiLogger.debug('🔗 Registering ad slot routes...');
        app.route('/api/v1/ad-slots', adSlotRoutes);
        apiLogger.debug('✅ Ad slot routes registered successfully');

        apiLogger.debug('🔗 Registering ad slot reservation routes...');
        app.route('/api/v1/ad-slot-reservations', adSlotReservationRoutes);
        apiLogger.debug('✅ Ad slot reservation routes registered successfully');

        apiLogger.debug('🔗 Registering professional service routes...');
        app.route('/api/v1/professional-services', professionalServiceRoutes);
        apiLogger.debug('✅ Professional service routes registered successfully');

        apiLogger.debug('🔗 Registering professional service order routes...');
        app.route('/api/v1/professional-service-orders', professionalServiceOrderRoutes);
        apiLogger.debug('✅ Professional service order routes registered successfully');

        apiLogger.debug('🔗 Registering service listing routes...');
        app.route('/api/v1/service-listings', serviceListingRoutes);
        apiLogger.debug('✅ Service listing routes registered successfully');

        apiLogger.debug('🔗 Registering accommodation listing routes...');
        app.route('/api/v1/accommodation-listings', accommodationListingRoutes);
        apiLogger.debug('✅ Accommodation listing routes registered successfully');

        apiLogger.debug('🔗 Registering credit note routes...');
        app.route('/api/v1/credit-notes', creditNoteRoutes);
        apiLogger.debug('✅ Credit note routes registered successfully');

        apiLogger.debug('🔗 Registering promotion routes...');
        app.route('/api/v1/promotions', promotionRoutes);
        apiLogger.debug('✅ Promotion routes registered successfully');

        apiLogger.debug('🔗 Registering discount code routes...');
        app.route('/api/v1/discount-codes', discountCodeRoutes);
        apiLogger.debug('✅ Discount code routes registered successfully');

        apiLogger.debug('🔗 Registering discount code usage routes...');
        app.route('/api/v1/discount-code-usages', discountCodeUsageRoutes);
        apiLogger.debug('✅ Discount code usage routes registered successfully');

        apiLogger.debug('🔗 Registering campaign routes...');
        app.route('/api/v1/campaigns', campaignRoutes);
        apiLogger.debug('✅ Campaign routes registered successfully');

        apiLogger.debug('🔗 Registering notification routes...');
        app.route('/api/v1/notifications', notificationRoutes);
        apiLogger.debug('✅ Notification routes registered successfully');

        apiLogger.debug('🔗 Registering ad pricing catalog routes...');
        app.route('/api/v1/ad-pricing-catalogs', adPricingCatalogRoutes);
        apiLogger.debug('✅ Ad pricing catalog routes registered successfully');

        apiLogger.debug('🔗 Registering ad media asset routes...');
        app.route('/api/v1/ad-media-assets', adMediaAssetRoutes);
        apiLogger.debug('✅ Ad media asset routes registered successfully');

        apiLogger.debug('🔗 Registering sponsorship routes...');
        app.route('/api/v1/sponsorships', sponsorshipRoutes);
        apiLogger.debug('✅ Sponsorship routes registered successfully');

        apiLogger.debug('🔗 Registering featured accommodation routes...');
        app.route('/api/v1/featured-accommodations', featuredAccommodationRoutes);
        apiLogger.debug('✅ Featured accommodation routes registered successfully');

        apiLogger.debug('🔗 Registering accommodation listing plan routes...');
        app.route('/api/v1/accommodation-listing-plans', accommodationListingPlanRoutes);
        apiLogger.debug('✅ Accommodation listing plan routes registered successfully');

        apiLogger.debug('🔗 Registering service listing plan routes...');
        app.route('/api/v1/service-listing-plans', serviceListingPlanRoutes);
        apiLogger.debug('✅ Service listing plan routes registered successfully');

        apiLogger.debug('🔗 Registering benefit partner routes...');
        app.route('/api/v1/benefit-partners', benefitPartnerRoutes);
        apiLogger.debug('✅ Benefit partner routes registered successfully');

        apiLogger.debug('🔗 Registering benefit listing plan routes...');
        app.route('/api/v1/benefit-listing-plans', benefitListingPlanRoutes);
        apiLogger.debug('✅ Benefit listing plan routes registered successfully');

        apiLogger.debug('🔗 Registering benefit listing routes...');
        app.route('/api/v1/benefit-listings', benefitListingRoutes);
        apiLogger.debug('✅ Benefit listing routes registered successfully');

        apiLogger.debug('🔗 Registering tourist service routes...');
        app.route('/api/v1/tourist-services', touristServiceRoutes);
        apiLogger.debug('✅ Tourist service routes registered successfully');
    } catch (error) {
        apiLogger.debug('❌ Failed to register routes:', String(error));
        throw error;
    }

    app.route('/api/v1/public/auth', authRoutes);

    // Documentation routes
    app.route('/docs', docsIndexRoutes);
    app.route('/docs', swaggerRoutes);
    app.route('/docs', scalarRoutes);
};
