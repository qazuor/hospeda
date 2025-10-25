/**
 * Professional Service Schema Exports
 *
 * This module exports all professional service-related schemas for the services platform.
 * Includes main service schema, CRUD operations, queries, HTTP coercion,
 * and comprehensive service management functionality.
 */

// Main professional service schema
export {
    ProfessionalServiceSchema,
    PublicProfessionalServiceSchema,
    type ProfessionalService,
    type PublicProfessionalService
} from './professionalService.schema.js';

// CRUD operation schemas
export {
    CreateProfessionalServiceSchema,
    UpdateProfessionalServicePricingSchema,
    UpdateProfessionalServiceSchema,
    UpdateProfessionalServiceStatusSchema,
    type CreateProfessionalService,
    type UpdateProfessionalService,
    type UpdateProfessionalServicePricing,
    type UpdateProfessionalServiceStatus
} from './professionalService.crud.schema.js';

// Query and search schemas
export {
    BulkProfessionalServiceOperationSchema,
    ProfessionalServiceAnalyticsSchema,
    SearchProfessionalServicesSchema,
    type BulkProfessionalServiceOperation,
    type ProfessionalServiceAnalytics,
    type SearchProfessionalServices
} from './professionalService.query.schema.js';

// HTTP coercion schemas
export {
    HttpBulkProfessionalServiceOperationSchema,
    HttpCreateProfessionalServiceSchema,
    HttpProfessionalServiceAnalyticsSchema,
    HttpSearchProfessionalServicesSchema,
    HttpUpdateProfessionalServicePricingSchema,
    HttpUpdateProfessionalServiceSchema,
    HttpUpdateProfessionalServiceStatusSchema,
    type HttpBulkProfessionalServiceOperation,
    type HttpCreateProfessionalService,
    type HttpProfessionalServiceAnalytics,
    type HttpSearchProfessionalServices,
    type HttpUpdateProfessionalService,
    type HttpUpdateProfessionalServicePricing,
    type HttpUpdateProfessionalServiceStatus
} from './professionalService.http.schema.js';
