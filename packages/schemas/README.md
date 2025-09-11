
## @repo/schemas

Este paquete contiene todos los esquemas Zod utilizados en Hospeda: entidades de dominio, fragmentos comunes y enums validados. Los esquemas están tipados de forma estricta y exponen tipos derivados con `z.infer`.

- Estructura: `src/entities/*`, `src/common/*`, `src/enums/*`.
- Convenciones: cada exportación de esquema termina con `Schema` y, cuando aplica, existe un tipo exportado asociado derivado con `z.infer<typeof …Schema>`.
- Uso: importar desde este paquete para validación de formularios, contratos API y utilidades compartidas.

A continuación, se listan todos los esquemas detectados automáticamente, agrupados por entidad.


### accommodation

| filePath | entidad | schema | type inferido/asociado | commentario |
|---|---|---|---|---|
| src/entities/accommodation/accommodation.crud.schema.ts | accommodation | AccommodationCreateInputSchema | AccommodationCreateInput | Accommodation CRUD Schemas This file contains all schemas related to CRUD operations for accommodations: - Create (input/output) - Update (input/output) - Patch (input) - Delete (input/output) - Re… |
| src/entities/accommodation/accommodation.crud.schema.ts | accommodation | AccommodationCreateOutputSchema | AccommodationCreateOutput | Schema for accommodation creation response Returns the complete accommodation object |
| src/entities/accommodation/accommodation.crud.schema.ts | accommodation | AccommodationDeleteInputSchema | AccommodationDeleteInput | Schema for accommodation deletion input Requires ID and optional force flag for hard delete |
| src/entities/accommodation/accommodation.crud.schema.ts | accommodation | AccommodationDeleteOutputSchema | AccommodationDeleteOutput | Schema for accommodation deletion response Returns success status and deletion timestamp |
| src/entities/accommodation/accommodation.crud.schema.ts | accommodation | AccommodationPatchInputSchema | AccommodationPatchInput | Schema for partial accommodation updates (PATCH) Same as update but explicitly named for clarity |
| src/entities/accommodation/accommodation.crud.schema.ts | accommodation | AccommodationRestoreInputSchema | AccommodationRestoreInput | Schema for accommodation restoration input Requires only the accommodation ID |
| src/entities/accommodation/accommodation.crud.schema.ts | accommodation | AccommodationRestoreOutputSchema | AccommodationRestoreOutput | Schema for accommodation restoration response Returns the complete restored accommodation object |
| src/entities/accommodation/accommodation.crud.schema.ts | accommodation | AccommodationUpdateInputSchema | AccommodationUpdateInput | Schema for updating an accommodation (PUT - complete replacement) Omits auto-generated fields and makes all fields partial |
| src/entities/accommodation/accommodation.crud.schema.ts | accommodation | AccommodationUpdateOutputSchema | AccommodationUpdateOutput | Schema for accommodation update response Returns the complete updated accommodation object |
| src/entities/accommodation/accommodation.faq.schema.ts | accommodation | AccommodationFaqSchema | AccommodationFaq | Accommodation FAQ Schema - FAQ Entity belonging to an Accommodation This schema represents a FAQ entry that belongs to a specific accommodation. |
| src/entities/accommodation/accommodation.ia.schema.ts | accommodation | AccommodationIaDataSchema | AccommodationIaData | Accommodation IA Data Schema - IA Data Entity belonging to an Accommodation This schema represents an IA data entry that belongs to a specific accommodation. |
| src/entities/accommodation/accommodation.price.schema.ts | accommodation | AccommodationPriceSchema | AccommodationPrice | Accommodation Price Schema - Main Price Schema This schema defines the complete pricing structure for accommodations, including base price, additional fees, and discounts. |
| src/entities/accommodation/accommodation.price.schema.ts | accommodation | AdditionalFeesInfoSchema | AdditionalFeesInfo | Additional Fees Info Schema Extends base price with fee-specific flags |
| src/entities/accommodation/accommodation.price.schema.ts | accommodation | AdditionalFeesSchema | AdditionalFees | Additional Fees Schema Complete structure for all possible additional fees |
| src/entities/accommodation/accommodation.price.schema.ts | accommodation | DiscountInfoSchema | DiscountInfo | Discount Info Schema Extends base price with discount-specific flags |
| src/entities/accommodation/accommodation.price.schema.ts | accommodation | DiscountsSchema | Discounts | Discounts Schema Complete structure for all possible discounts |
| src/entities/accommodation/accommodation.price.schema.ts | accommodation | OtherAdditionalFeesSchema | OtherAdditionalFees | Other Additional Fees Schema For custom additional fees with a name |
| src/entities/accommodation/accommodation.price.schema.ts | accommodation | OtherDiscountSchema | OtherDiscount | Other Discount Schema For custom discounts with a name |
| src/entities/accommodation/accommodation.query.schema.ts | accommodation | AccommodationFiltersSchema | AccommodationFilters | Accommodation Query Schemas This file contains all schemas related to querying accommodations: - List (input/output/item) - Search (input/output/result) - Summary - Stats - Filters / // ===========… |
| src/entities/accommodation/accommodation.query.schema.ts | accommodation | AccommodationListInputSchema | AccommodationListInput | Schema for accommodation list input parameters Includes pagination and filters |
| src/entities/accommodation/accommodation.query.schema.ts | accommodation | AccommodationListItemSchema | AccommodationListItem | Schema for individual accommodation items in lists Contains essential fields for list display |
| src/entities/accommodation/accommodation.query.schema.ts | accommodation | AccommodationListOutputSchema | AccommodationListOutput | Schema for accommodation list output Uses generic paginated response with list items |
| src/entities/accommodation/accommodation.query.schema.ts | accommodation | AccommodationSearchInputSchema | AccommodationSearchInput | Schema for accommodation search input parameters Extends base search with accommodation-specific filters |
| src/entities/accommodation/accommodation.query.schema.ts | accommodation | AccommodationSearchOutputSchema | AccommodationSearchOutput | Schema for accommodation search output Uses generic paginated response with search results |
| src/entities/accommodation/accommodation.query.schema.ts | accommodation | AccommodationSearchResultSchema | AccommodationSearchResult | Schema for individual accommodation search results Extends list item with search score |
| src/entities/accommodation/accommodation.query.schema.ts | accommodation | AccommodationStatsSchema | AccommodationStats | Schema for accommodation statistics Contains metrics and analytics data |
| src/entities/accommodation/accommodation.query.schema.ts | accommodation | AccommodationSummarySchema | AccommodationSummary | Schema for accommodation summary Contains essential information for quick display |
| src/entities/accommodation/accommodation.rating.schema.ts | accommodation | AccommodationRatingSchema | AccommodationRatingInput | Accommodation Rating schema definition using Zod for validation. |
| src/entities/accommodation/accommodation.relations.schema.ts | accommodation | AccommodationWithAmenitiesSchema | AccommodationWithAmenities | Accommodation with amenities Includes an array of related amenities with additional info |
| src/entities/accommodation/accommodation.relations.schema.ts | accommodation | AccommodationWithBasicRelationsSchema | AccommodationWithBasicRelations | Accommodation with basic relations Includes destination and owner |
| src/entities/accommodation/accommodation.relations.schema.ts | accommodation | AccommodationWithContentRelationsSchema | AccommodationWithContentRelations | Accommodation with content relations Includes features, amenities, and reviews |
| src/entities/accommodation/accommodation.relations.schema.ts | accommodation | AccommodationWithDestinationSchema | AccommodationWithDestination | Accommodation Relations Schemas This file contains schemas for accommodations with related entities: - AccommodationWithDestination - AccommodationWithOwner - AccommodationWithReviews - Accommodati… |
| src/entities/accommodation/accommodation.relations.schema.ts | accommodation | AccommodationWithFeaturesSchema | AccommodationWithFeatures | Accommodation with features Includes an array of related features with additional info |
| src/entities/accommodation/accommodation.relations.schema.ts | accommodation | AccommodationWithFullRelationsSchema | AccommodationWithFullRelations | Accommodation with all relations Includes all possible related entities |
| src/entities/accommodation/accommodation.relations.schema.ts | accommodation | AccommodationWithOwnerSchema | AccommodationWithOwner | Accommodation with owner information Includes the related user (owner) data |
| src/entities/accommodation/accommodation.relations.schema.ts | accommodation | AccommodationWithReviewsSchema | AccommodationWithReviews | Accommodation with reviews Includes an array of related reviews |
| src/entities/accommodation/accommodation.review.schema.ts | accommodation | AccommodationReviewCreateInputSchema |  | Input schema for creating an Accommodation Review (without audit/id fields) |
| src/entities/accommodation/accommodation.review.schema.ts | accommodation | AccommodationReviewSchema |  | Accommodation Review schema definition using Zod for validation. |
| src/entities/accommodation/accommodation.schema.ts | accommodation | AccommodationSchema | Accommodation | Accommodation Schema - Main Entity Schema This schema defines the complete structure of an Accommodation entity using base field objects for consistency and maintainability. |

### accommodationReview

| filePath | entidad | schema | type inferido/asociado | commentario |
|---|---|---|---|---|
| src/entities/accommodationReview/accommodationReview.crud.schema.ts | accommodationReview | AccommodationReviewCreateInputSchema | AccommodationReviewCreateInput | Schema for creating a new accommodation review Omits auto-generated fields like id and audit fields |
| src/entities/accommodationReview/accommodationReview.crud.schema.ts | accommodationReview | AccommodationReviewCreateOutputSchema | AccommodationReviewCreateOutput | Schema for accommodation review creation response Returns the complete accommodation review object |
| src/entities/accommodationReview/accommodationReview.crud.schema.ts | accommodationReview | AccommodationReviewDeleteInputSchema | AccommodationReviewDeleteInput | Schema for accommodation review deletion input Requires ID and optional force flag for hard delete |
| src/entities/accommodationReview/accommodationReview.crud.schema.ts | accommodationReview | AccommodationReviewDeleteOutputSchema | AccommodationReviewDeleteOutput | Schema for accommodation review deletion response Returns success status and deletion timestamp |
| src/entities/accommodationReview/accommodationReview.crud.schema.ts | accommodationReview | AccommodationReviewPatchInputSchema | AccommodationReviewPatchInput | Schema for partial accommodation review updates (PATCH) Same as update but explicitly named for clarity |
| src/entities/accommodationReview/accommodationReview.crud.schema.ts | accommodationReview | AccommodationReviewRestoreInputSchema | AccommodationReviewRestoreInput | Schema for accommodation review restoration input Requires only the accommodation review ID |
| src/entities/accommodationReview/accommodationReview.crud.schema.ts | accommodationReview | AccommodationReviewRestoreOutputSchema | AccommodationReviewRestoreOutput | Schema for accommodation review restoration response Returns the complete restored accommodation review object |
| src/entities/accommodationReview/accommodationReview.crud.schema.ts | accommodationReview | AccommodationReviewUpdateInputSchema | AccommodationReviewUpdateInput | Schema for updating an accommodation review (PUT - complete replacement) Omits auto-generated fields and makes all fields partial |
| src/entities/accommodationReview/accommodationReview.crud.schema.ts | accommodationReview | AccommodationReviewUpdateOutputSchema | AccommodationReviewUpdateOutput | Schema for accommodation review update response Returns the complete updated accommodation review object |
| src/entities/accommodationReview/accommodationReview.query.schema.ts | accommodationReview | AccommodationReviewListByAccommodationOutputSchema | AccommodationReviewListByAccommodationOutput | Output schema for accommodation review list by accommodation |
| src/entities/accommodationReview/accommodationReview.query.schema.ts | accommodationReview | AccommodationReviewListByAccommodationParamsSchema | AccommodationReviewListByAccommodationParams | Schema for listing accommodation reviews by accommodation ID Combines accommodation ID parameter with pagination |
| src/entities/accommodationReview/accommodationReview.query.schema.ts | accommodationReview | AccommodationReviewListWithUserOutputSchema | AccommodationReviewListWithUserOutput | Output schema for accommodation review list with user information |
| src/entities/accommodationReview/accommodationReview.query.schema.ts | accommodationReview | AccommodationReviewListWithUserParamsSchema | AccommodationReviewListWithUserParams | Schema for listing accommodation reviews with user information Reuses the generic ListWithUserSchema |
| src/entities/accommodationReview/accommodationReview.query.schema.ts | accommodationReview | AccommodationReviewSearchParamsSchema | AccommodationReviewSearchParams | Schema for searching accommodation reviews Extends base search with accommodation-specific filters |
| src/entities/accommodationReview/accommodationReview.query.schema.ts | accommodationReview | AccommodationReviewWithUserSchema | AccommodationReviewWithUser | Schema for accommodation review with user information Extends the base review schema with user fields |
| src/entities/accommodationReview/accommodationReview.schema.ts | accommodationReview | AccommodationReviewSchema | AccommodationReview | Accommodation Review schema definition using Zod for validation. Represents a review for an accommodation. |

### amenity

| filePath | entidad | schema | type inferido/asociado | commentario |
|---|---|---|---|---|
| src/entities/amenity/amenity.crud.schema.ts | amenity | AmenityBulkOperationInputSchema | AmenityBulkOperationInput | Schema for bulk amenity operations input Requires array of amenity IDs and operation type |
| src/entities/amenity/amenity.crud.schema.ts | amenity | AmenityBulkOperationOutputSchema | AmenityBulkOperationOutput | Schema for bulk amenity operations response Returns operation results for each amenity |
| src/entities/amenity/amenity.crud.schema.ts | amenity | AmenityCategoryUpdateInputSchema | AmenityCategoryUpdateInput | Schema for amenity category update input Allows updating category for multiple amenities |
| src/entities/amenity/amenity.crud.schema.ts | amenity | AmenityCategoryUpdateOutputSchema | AmenityCategoryUpdateOutput | Schema for amenity category update response Returns update statistics |
| src/entities/amenity/amenity.crud.schema.ts | amenity | AmenityCreateInputSchema | AmenityCreateInput | Amenity CRUD Schemas This file contains all schemas related to CRUD operations for amenities: - Create (input/output) - Update (input/output) - Patch (input) - Delete (input/output) - Restore (inpu… |
| src/entities/amenity/amenity.crud.schema.ts | amenity | AmenityCreateOutputSchema | AmenityCreateOutput | Schema for amenity creation response Returns the complete amenity object |
| src/entities/amenity/amenity.crud.schema.ts | amenity | AmenityDeleteInputSchema | AmenityDeleteInput | Schema for amenity deletion input Requires ID and optional force flag for hard delete |
| src/entities/amenity/amenity.crud.schema.ts | amenity | AmenityDeleteOutputSchema | AmenityDeleteOutput | Schema for amenity deletion response Returns success status and deletion timestamp |
| src/entities/amenity/amenity.crud.schema.ts | amenity | AmenityIconUpdateInputSchema | AmenityIconUpdateInput | Schema for amenity icon update input Allows updating icons for multiple amenities |
| src/entities/amenity/amenity.crud.schema.ts | amenity | AmenityIconUpdateOutputSchema | AmenityIconUpdateOutput | Schema for amenity icon update response Returns update statistics |
| src/entities/amenity/amenity.crud.schema.ts | amenity | AmenityMergeInputSchema | AmenityMergeInput | Schema for amenity merge input Requires source amenity ID and target amenity ID |
| src/entities/amenity/amenity.crud.schema.ts | amenity | AmenityMergeOutputSchema | AmenityMergeOutput | Schema for amenity merge response Returns the target amenity and merge statistics |
| src/entities/amenity/amenity.crud.schema.ts | amenity | AmenityPatchInputSchema | AmenityPatchInput | Schema for partial amenity updates (PATCH) Same as update but explicitly named for clarity |
| src/entities/amenity/amenity.crud.schema.ts | amenity | AmenityRestoreInputSchema | AmenityRestoreInput | Schema for amenity restoration input Requires only the amenity ID |
| src/entities/amenity/amenity.crud.schema.ts | amenity | AmenityRestoreOutputSchema | AmenityRestoreOutput | Schema for amenity restoration response Returns the complete restored amenity object |
| src/entities/amenity/amenity.crud.schema.ts | amenity | AmenityUpdateInputSchema | AmenityUpdateInput | Schema for updating an amenity (PUT - complete replacement) Omits auto-generated fields and makes all fields partial |
| src/entities/amenity/amenity.crud.schema.ts | amenity | AmenityUpdateOutputSchema | AmenityUpdateOutput | Schema for amenity update response Returns the complete updated amenity object |
| src/entities/amenity/amenity.crud.schema.ts | amenity | AmenityAddToAccommodationInputSchema | AmenityAddToAccommodationInput | Schema for adding an amenity to an accommodation - Reuses AccommodationAmenityRelationSchema for consistency |
| src/entities/amenity/amenity.crud.schema.ts | amenity | AmenityRemoveFromAccommodationInputSchema | AmenityRemoveFromAccommodationInput | Schema for removing an amenity from an accommodation - Uses .pick() from AccommodationAmenityRelationSchema |
| src/entities/amenity/amenity.crud.schema.ts | amenity | AmenityAccommodationRelationOutputSchema | AmenityAccommodationRelationOutput | Schema for accommodation-amenity relation output Returns the relationship data after add/remove operations |
| src/entities/amenity/amenity.query.schema.ts | amenity | AmenityCategoriesInputSchema | AmenityCategoriesInput | Schema for amenity categories input Parameters for fetching amenity categories |
| src/entities/amenity/amenity.query.schema.ts | amenity | AmenityCategoriesOutputSchema | AmenityCategoriesOutput | Schema for amenity categories output Returns list of categories with statistics |
| src/entities/amenity/amenity.query.schema.ts | amenity | AmenityFiltersSchema | AmenityFilters | Amenity Query Schemas This file contains all schemas related to querying amenities: - List (input/output/item) - Search (input/output/result) - Summary - Stats - Filters / // ======================… |
| src/entities/amenity/amenity.query.schema.ts | amenity | AmenityListInputSchema | AmenityListInput | Schema for amenity list input parameters Includes pagination and filters |
| src/entities/amenity/amenity.query.schema.ts | amenity | AmenityListItemSchema | AmenityListItem | Schema for individual amenity items in lists Contains essential fields for list display |
| src/entities/amenity/amenity.query.schema.ts | amenity | AmenityListOutputSchema | AmenityListOutput | Schema for amenity list output Uses generic paginated response with list items |
| src/entities/amenity/amenity.query.schema.ts | amenity | AmenitySearchInputSchema | AmenitySearchInput | Schema for amenity search input parameters Extends base search with amenity-specific filters |
| src/entities/amenity/amenity.query.schema.ts | amenity | AmenitySearchOutputSchema | AmenitySearchOutput | Schema for amenity search output Uses generic paginated response with search results |
| src/entities/amenity/amenity.query.schema.ts | amenity | AmenitySearchResultSchema | AmenitySearchResult | Schema for individual amenity search results Extends list item with search score |
| src/entities/amenity/amenity.query.schema.ts | amenity | AmenityStatsSchema | AmenityStats | Schema for amenity statistics Contains metrics and analytics data |
| src/entities/amenity/amenity.query.schema.ts | amenity | AmenityGetAccommodationsInputSchema | AmenityGetAccommodationsInput | Schema for getting accommodations by amenity input Parameters for finding all accommodations that have a specific amenity |
| src/entities/amenity/amenity.query.schema.ts | amenity | AmenityGetForAccommodationInputSchema | AmenityGetForAccommodationInput | Schema for getting amenities for accommodation input Parameters for finding all amenities of a specific accommodation |
| src/entities/amenity/amenity.query.schema.ts | amenity | AmenityListWithUsageCountSchema | AmenityListWithUsageCount | Schema for amenity list with usage count Used for searchForList method that includes accommodation counts |
| src/entities/amenity/amenity.query.schema.ts | amenity | AmenitySearchForListOutputSchema | AmenitySearchForListOutput | Schema for amenity search for list output Returns amenities with accommodation counts and pagination |
| src/entities/amenity/amenity.query.schema.ts | amenity | AmenityAccommodationsOutputSchema | AmenityAccommodationsOutput | Schema for accommodations output - Uses AccommodationSummarySchema for proper typing |
| src/entities/amenity/amenity.query.schema.ts | amenity | AmenityArrayOutputSchema | AmenityArrayOutput | Schema for amenities output Used when returning lists of amenities |
| src/entities/amenity/amenity.query.schema.ts | amenity | AmenitySummarySchema | AmenitySummary | Schema for amenity summary Contains essential information for quick display |
| src/entities/amenity/amenity.query.schema.ts | amenity | PopularAmenitiesInputSchema | PopularAmenitiesInput | Schema for popular amenities input Parameters for fetching popular amenities |
| src/entities/amenity/amenity.query.schema.ts | amenity | PopularAmenitiesOutputSchema | PopularAmenitiesOutput | Schema for popular amenities output Returns list of popular amenities with usage statistics |
| src/entities/amenity/amenity.relations.schema.ts | amenity | AmenityComparisonInputSchema | AmenityComparisonInput | Amenity comparison input schema Parameters for comparing multiple amenities |
| src/entities/amenity/amenity.relations.schema.ts | amenity | AmenityComparisonOutputSchema | AmenityComparisonOutput | Amenity comparison output schema Returns comparison data for multiple amenities |
| src/entities/amenity/amenity.relations.schema.ts | amenity | AmenityWithAccommodationsSchema | AmenityWithAccommodations | Amenity with accommodations Includes an array of accommodations using this amenity |
| src/entities/amenity/amenity.relations.schema.ts | amenity | AmenityWithCategorySchema | AmenityWithCategory | Amenity with category information Includes detailed category data and related amenities in the same category |
| src/entities/amenity/amenity.relations.schema.ts | amenity | AmenityWithFullRelationsSchema | AmenityWithFullRelations | Amenity with all relations Includes all possible related data |
| src/entities/amenity/amenity.relations.schema.ts | amenity | AmenityWithGeographicSchema | AmenityWithGeographic | Amenity with geographic distribution Shows where this amenity is most commonly found |
| src/entities/amenity/amenity.relations.schema.ts | amenity | AmenityWithPricingSchema | AmenityWithPricing | Amenity with pricing information Includes pricing data from accommodations that offer this amenity |
| src/entities/amenity/amenity.relations.schema.ts | amenity | AmenityWithSimilarSchema | AmenityWithSimilar | Amenity with similar amenities Includes amenities that are commonly used together or are similar |
| src/entities/amenity/amenity.relations.schema.ts | amenity | AmenityWithUsageStatsSchema | AmenityWithUsageStats | Amenity Relations Schemas This file contains schemas for amenities with related entities: - AmenityWithUsageStats - AmenityWithAccommodations - AmenityWithCategory - AmenityWithSimilar - AmenityWit… |
| src/entities/amenity/amenity.schema.ts | amenity | AccommodationAmenityRelationSchema | AccommodationAmenityRelation | Accommodation-Amenity Relation Schema Represents the many-to-many relationship between accommodations and amenities |
| src/entities/amenity/amenity.schema.ts | amenity | AmenitySchema | Amenity | Amenity Schema - Main Entity Schema This schema represents an amenity entity that can be associated with accommodations. |

### common

| filePath | entidad | schema | type inferido/asociado | commentario |
|---|---|---|---|---|
| src/common/admin.schema.ts | common | AdminInfoSchema | AdminInfo |  |
| src/common/api.schema.ts | common | BaseQuerySchema | BaseQuery | Base query schema combining common query parameters Can be extended by specific entity query schemas |
| src/common/api.schema.ts | common | CommerceQuerySchema | CommerceQuery | Commerce query schema with price filtering For entities related to commerce and pricing |
| src/common/api.schema.ts | common | DateRangeQuerySchema | DateRangeQuery | Schema for date range query parameters Used for filtering by date ranges across all entities |
| src/common/api.schema.ts | common | ExtendedQuerySchema | ExtendedQuery | Extended query schema with date and location filters For entities that need comprehensive filtering capabilities |
| src/common/api.schema.ts | common | LocationQuerySchema | LocationQuery | Schema for location-based query parameters Used for filtering by location across accommodations, destinations, and events |
| src/common/api.schema.ts | common | PaginationQuerySchema | PaginationQuery | Common API Query Schemas This file contains reusable schemas for API query parameters: - Pagination - Sorting - Search - Date ranges - Price ranges - Location queries / // =========================… |
| src/common/api.schema.ts | common | PriceRangeQuerySchema | PriceRangeQuery | Schema for price range query parameters Used for filtering by price ranges across accommodations and other entities |
| src/common/api.schema.ts | common | SearchQuerySchema | SearchQuery | Schema for search query parameters Used across all search endpoints for consistent search functionality |
| src/common/api.schema.ts | common | SortQuerySchema | SortQuery | Schema for sorting query parameters Used across all list endpoints for consistent sorting |
| src/common/audit.schema.ts | common | AuditSchema | Audit | Base audit fields for tracking creation, updates, and soft deletion / export const BaseAuditFields = { createdAt: z.coerce.date({ message: 'zodError.common.createdAt.required' }), updatedAt: z.coer… |
| src/common/contact.schema.ts | common | ContactInfoSchema | ContactInfo |  |
| src/common/faq.schema.ts | common | BaseFaqSchema | BaseFaq | Base FAQ Schema - Common structure for FAQ entries This schema can be extended by specific entities (accommodation, destination, etc.) to create their own FAQ schemas with the appropriate ID field. |
| src/common/ia.schema.ts | common | BaseIaDataSchema | BaseIaData | Base IA Data Schema - Common structure for IA data entries This schema can be extended by specific entities (accommodation, destination, etc.) to create their own IA data schemas with the appropria… |
| src/common/id.schema.ts | common | AccommodationFaqIdSchema |  |  |
| src/common/id.schema.ts | common | AccommodationIaDataIdSchema |  |  |
| src/common/id.schema.ts | common | AccommodationIdSchema |  |  |
| src/common/id.schema.ts | common | AccommodationReviewIdSchema |  |  |
| src/common/id.schema.ts | common | AmenityIdSchema |  |  |
| src/common/id.schema.ts | common | AttractionIdSchema |  |  |
| src/common/id.schema.ts | common | DestinationIdSchema |  |  |
| src/common/id.schema.ts | common | DestinationReviewIdSchema |  |  |
| src/common/id.schema.ts | common | EventIdSchema |  |  |
| src/common/id.schema.ts | common | EventLocationIdSchema |  |  |
| src/common/id.schema.ts | common | EventOrganizerIdSchema |  |  |
| src/common/id.schema.ts | common | FeatureIdSchema |  |  |
| src/common/id.schema.ts | common | IdSchema |  |  |
| src/common/id.schema.ts | common | PaymentIdSchema |  |  |
| src/common/id.schema.ts | common | PaymentPlanIdSchema |  |  |
| src/common/id.schema.ts | common | PostIdSchema |  |  |
| src/common/id.schema.ts | common | PostSponsorIdSchema |  |  |
| src/common/id.schema.ts | common | PostSponsorshipIdSchema |  |  |
| src/common/id.schema.ts | common | SubscriptionIdSchema |  |  |
| src/common/id.schema.ts | common | TagIdSchema |  |  |
| src/common/id.schema.ts | common | UserBookmarkIdSchema |  |  |
| src/common/id.schema.ts | common | UserIdSchema |  |  |
| src/common/lifecycle.schema.ts | common | LifecycleSchema | Lifecycle | Base lifecycle state fields / export const BaseLifecycleFields = { lifecycleState: LifecycleStatusEnumSchema } as const; /** Lifecycle Schema - Complete lifecycle information Can be used as a stand… |
| src/common/location.schema.ts | common | BaseLocationSchema | BaseLocation | Base Location Schema Represents basic location information without full address details Matches BaseLocationType from @repo/types |
| src/common/location.schema.ts | common | CoordinatesSchema | Coordinates | Coordinates Schema Represents geographic coordinates with latitude and longitude Matches CoordinatesType from @repo/types |
| src/common/location.schema.ts | common | FullLocationSchema | FullLocation | Full Location Schema Represents complete location information with full address details Matches FullLocationType from @repo/types |
| src/common/location.schema.ts | common | LocationSchema | Location | Legacy Location Schema (for backward compatibility) @deprecated Use FullLocationSchema instead |
| src/common/media.schema.ts | common | ImageSchema | Image |  |
| src/common/media.schema.ts | common | MediaSchema | Media |  |
| src/common/media.schema.ts | common | VideoSchema | Video |  |
| src/common/moderation.schema.ts | common | ModerationSchema | Moderation | Base moderation fields / export const BaseModerationFields = { moderationState: ModerationStatusEnumSchema } as const; /** Moderation Schema - Complete moderation information Can be used as a stand… |
| src/common/params.schema.ts | common | AccommodationAmenityParamsSchema | AccommodationAmenityParams | Schema for accommodation amenity parameters Used for accommodation-amenity relationship endpoints |
| src/common/params.schema.ts | common | AccommodationFaqParamsSchema | AccommodationFaqParams | Schema for accommodation FAQ parameters Used for accommodation FAQ endpoints |
| src/common/params.schema.ts | common | AccommodationFeatureParamsSchema | AccommodationFeatureParams | Schema for accommodation feature parameters Used for accommodation-feature relationship endpoints |
| src/common/params.schema.ts | common | AccommodationIdParamsSchema | AccommodationIdParams | Schema for Accommodation ID path parameters Used for accommodation-specific endpoints |
| src/common/params.schema.ts | common | AccommodationReviewParamsSchema | AccommodationReviewParams | Schema for accommodation review parameters Used for accommodation review endpoints |
| src/common/params.schema.ts | common | AmenityIdParamsSchema | AmenityIdParams | Schema for Amenity ID path parameters Used for amenity-specific endpoints |
| src/common/params.schema.ts | common | DestinationIdParamsSchema | DestinationIdParams | Schema for Destination ID path parameters Used for destination-specific endpoints |
| src/common/params.schema.ts | common | DestinationReviewParamsSchema | DestinationReviewParams | Schema for destination review parameters Used for destination review endpoints |
| src/common/params.schema.ts | common | EventIdParamsSchema | EventIdParams | Schema for Event ID path parameters Used for event-specific endpoints |
| src/common/params.schema.ts | common | EventTagParamsSchema | EventTagParams | Schema for event tag parameters Used for event-tag relationship endpoints |
| src/common/params.schema.ts | common | FaqIdParamsSchema | FaqIdParams | Schema for FAQ ID path parameters Used for FAQ-specific endpoints |
| src/common/params.schema.ts | common | FeatureIdParamsSchema | FeatureIdParams | Schema for Feature ID path parameters Used for feature-specific endpoints |
| src/common/params.schema.ts | common | IdOrSlugParamsSchema | IdOrSlugParams | Schema for combined ID or slug parameters Used for endpoints that accept either UUID or slug |
| src/common/params.schema.ts | common | IdParamsSchema | IdParams | Common API Parameter Schemas This file contains reusable schemas for API path parameters: - Generic ID parameters - Slug parameters - Entity-specific ID parameters / // ============================… |
| src/common/params.schema.ts | common | LanguageParamsSchema | LanguageParams | Schema for language parameters Used for internationalization in path parameters |
| src/common/params.schema.ts | common | LocaleParamsSchema | LocaleParams | Schema for locale parameters Used for full locale specification in path parameters |
| src/common/params.schema.ts | common | NestedParamsSchema | NestedParams | Schema for nested resource parameters Used for endpoints with parent-child relationships |
| src/common/params.schema.ts | common | OptionalIdParamsSchema | OptionalIdParams | Schema for optional ID parameters Used for endpoints where ID might be optional |
| src/common/params.schema.ts | common | OptionalSlugParamsSchema | OptionalSlugParams | Schema for optional slug parameters Used for endpoints where slug might be optional |
| src/common/params.schema.ts | common | PaymentIdParamsSchema | PaymentIdParams | Schema for Payment ID path parameters Used for payment-specific endpoints |
| src/common/params.schema.ts | common | PostIdParamsSchema | PostIdParams | Schema for Post ID path parameters Used for post-specific endpoints |
| src/common/params.schema.ts | common | PostTagParamsSchema | PostTagParams | Schema for post tag parameters Used for post-tag relationship endpoints |
| src/common/params.schema.ts | common | ReviewIdParamsSchema | ReviewIdParams | Schema for Review ID path parameters Used for review-specific endpoints |
| src/common/params.schema.ts | common | SlugParamsSchema | SlugParams | Schema for slug path parameters Used for endpoints that accept URL-friendly string identifiers |
| src/common/params.schema.ts | common | TagIdParamsSchema | TagIdParams | Schema for Tag ID path parameters Used for tag-specific endpoints |
| src/common/params.schema.ts | common | UserAccommodationParamsSchema | UserAccommodationParams | Schema for user accommodation parameters Used for user's accommodation endpoints |
| src/common/params.schema.ts | common | UserIdParamsSchema | UserIdParams | Schema for User ID path parameters Used for user-specific endpoints |
| src/common/params.schema.ts | common | UserPaymentParamsSchema | UserPaymentParams | Schema for user payment parameters Used for user's payment endpoints |
| src/common/params.schema.ts | common | VersionParamsSchema | VersionParams | Schema for version parameters Used for API versioning in path parameters |
| src/common/price.schema.ts | common | PriceSchema |  |  |
| src/common/response.schema.ts | common | BulkOperationResponseSchema | BulkOperationResponse | Schema for bulk operation API responses Used for operations that process multiple items |
| src/common/response.schema.ts | common | createListResponseSchema |  | Generic schema for simple list API responses (without pagination) Can be used with any data type for consistent list structure |
| src/common/response.schema.ts | common | createPaginatedResponseSchema |  | Generic schema for paginated API responses Can be used with any data type for consistent pagination structure |
| src/common/response.schema.ts | common | createSingleItemResponseSchema |  | Generic schema for single item API responses Can be used with any data type for consistent single item structure |
| src/common/response.schema.ts | common | ErrorResponseSchema | ErrorResponse | Schema for API error responses Used for operations that fail with error details |
| src/common/response.schema.ts | common | HealthCheckResponseSchema | HealthCheckResponse | Schema for health check API responses Used for system health and status endpoints |
| src/common/response.schema.ts | common | ListResponseSchema |  | Schema for list responses with unknown item type Use createListResponseSchema for type-safe versions |
| src/common/response.schema.ts | common | PaginatedResponseSchema |  | Schema for paginated responses with unknown item type Use createPaginatedResponseSchema for type-safe versions |
| src/common/response.schema.ts | common | PaginationMetadataSchema | PaginationMetadata | Schema for pagination metadata Used in paginated responses to provide navigation information |
| src/common/response.schema.ts | common | SingleItemResponseSchema |  | Schema for single item responses with unknown item type Use createSingleItemResponseSchema for type-safe versions |
| src/common/response.schema.ts | common | StatsResponseSchema | StatsResponse | Schema for statistics API responses Used for endpoints that return analytics and metrics data |
| src/common/response.schema.ts | common | SuccessResponseSchema | SuccessResponse | Common API Response Schemas This file contains reusable schemas for API responses: - Success responses - Error responses - Paginated responses - List responses - Stats responses / // ==============… |
| src/common/review.schema.ts | common | ReviewSchema | Review | Base review relation fields (for entities that have separate review tables) NOTE: Actual reviews are stored in separate entities (AccommodationReviewSchema, DestinationReviewSchema) / export const … |
| src/common/seo.schema.ts | common | SeoSchema | Seo | SEO Schema - Search Engine Optimization information |
| src/common/social.schema.ts | common | SocialNetworkSchema | SocialNetwork |  |
| src/common/tags.schema.ts | common | TagsSchema | Tags | Tags Schema - Complete tags information Can be used as a standalone schema when needed |
| src/common/visibility.schema.ts | common | VisibilitySchema | Visibility | Base visibility fields / export const BaseVisibilityFields = { visibility: VisibilityEnumSchema } as const; /** Visibility Schema - Complete visibility information Can be used as a standalone schem… |
| src/common/result.schema.ts | common | SuccessSchema | Success | Generic success response schema Use for endpoints that return only a success boolean. |

### attraction

| filePath | entidad | schema | type inferido/asociado | commentario |
|---|---|---|---|---|
| src/entities/attraction/attraction.crud.schema.ts | attraction | AttractionCreateInputSchema | AttractionCreateInput | Schema for creating a new attraction Omits server-generated fields and makes some fields optional |
| src/entities/attraction/attraction.crud.schema.ts | attraction | AttractionUpdateInputSchema | AttractionUpdateInput | Schema for updating an attraction All fields are optional for partial updates, except id is not allowed |
| src/entities/attraction/attraction.crud.schema.ts | attraction | AttractionDeleteInputSchema | AttractionDeleteInput | Schema for deleting an attraction (soft delete) Only requires the attraction ID |
| src/entities/attraction/attraction.crud.schema.ts | attraction | AttractionRestoreInputSchema | AttractionRestoreInput | Schema for restoring a soft-deleted attraction Only requires the attraction ID |
| src/entities/attraction/attraction.crud.schema.ts | attraction | AttractionCreateOutputSchema | AttractionCreateOutput | Schema for attraction creation response Returns the created attraction |
| src/entities/attraction/attraction.crud.schema.ts | attraction | AttractionUpdateOutputSchema | AttractionUpdateOutput | Schema for attraction update response Returns the updated attraction |
| src/entities/attraction/attraction.crud.schema.ts | attraction | AttractionDeleteOutputSchema | AttractionDeleteOutput | Schema for attraction deletion response Returns the deleted attraction |
| src/entities/attraction/attraction.crud.schema.ts | attraction | AttractionRestoreOutputSchema | AttractionRestoreOutput | Schema for attraction restoration response Returns the restored attraction |
| src/entities/attraction/attraction.crud.schema.ts | attraction | AttractionViewOutputSchema | AttractionViewOutput | Schema for attraction view response Returns a single attraction by ID or slug |
| src/entities/attraction/attraction.crud.schema.ts | attraction | AttractionAddToDestinationInputSchema | AttractionAddToDestinationInput | Schema for adding an attraction to a destination |
| src/entities/attraction/attraction.crud.schema.ts | attraction | AttractionRemoveFromDestinationInputSchema | AttractionRemoveFromDestinationInput | Schema for removing an attraction from a destination |
| src/entities/attraction/attraction.crud.schema.ts | attraction | AttractionDestinationRelationOutputSchema | AttractionDestinationRelationOutput | Schema for attraction-destination relation response Returns success status and the relation data |
| src/entities/attraction/attraction.query.schema.ts | attraction | AttractionFiltersSchema | AttractionFilters | Schema for attraction search filters Contains all possible filter criteria for searching attractions |
| src/entities/attraction/attraction.query.schema.ts | attraction | AttractionSearchInputSchema | AttractionSearchInput | Schema for attraction search input Combines filters with pagination and sorting |
| src/entities/attraction/attraction.query.schema.ts | attraction | AttractionListInputSchema | AttractionListInput | Schema for attraction list input (simpler than search) Used for basic listing with pagination only |
| src/entities/attraction/attraction.query.schema.ts | attraction | AttractionsByDestinationInputSchema | AttractionsByDestinationInput | Schema for getting attractions by destination |
| src/entities/attraction/attraction.query.schema.ts | attraction | DestinationsByAttractionInputSchema | DestinationsByAttractionInput | Schema for getting destinations by attraction |
| src/entities/attraction/attraction.query.schema.ts | attraction | AttractionSearchOutputSchema | AttractionSearchOutput | Schema for attraction search results Returns attractions with pagination info |
| src/entities/attraction/attraction.query.schema.ts | attraction | AttractionListOutputSchema | AttractionListOutput | Schema for attraction list results (basic listing) Returns attractions with total count |
| src/entities/attraction/attraction.query.schema.ts | attraction | AttractionWithDestinationCountSchema | AttractionWithDestinationCount | Schema for attraction list with destination counts Used by searchForList method that includes destination counts |
| src/entities/attraction/attraction.query.schema.ts | attraction | AttractionListWithCountsOutputSchema | AttractionListWithCountsOutput | Schema for attraction list with destination counts output |
| src/entities/attraction/attraction.query.schema.ts | attraction | AttractionsByDestinationOutputSchema | AttractionsByDestinationOutput | Schema for attractions by destination results |
| src/entities/attraction/attraction.query.schema.ts | attraction | DestinationsByAttractionOutputSchema | DestinationsByAttractionOutput | Schema for destinations by attraction results |
| src/entities/attraction/attraction.query.schema.ts | attraction | AttractionCountOutputSchema | AttractionCountOutput | Schema for attraction count results |
| src/entities/attraction/attraction.query.schema.ts | attraction | AttractionStatsSchema | AttractionStats | Schema for attraction statistics Provides aggregate information about attractions |
| src/entities/attraction/attraction.query.schema.ts | attraction | AttractionStatsOutputSchema | AttractionStatsOutput | Schema for attraction statistics output |
| src/entities/attraction/attraction.relations.schema.ts | attraction | DestinationAttractionRelationSchema | DestinationAttractionRelation | Destination-Attraction Relation Schema Represents the many-to-many relationship between destinations and attractions |
| src/entities/attraction/attraction.relations.schema.ts | attraction | AttractionWithDestinationSchema | AttractionWithDestination | Attraction with Destination Info Schema Used when displaying attractions with their associated destination information |
| src/entities/attraction/attraction.relations.schema.ts | attraction | DestinationWithAttractionsSchema | DestinationWithAttractions | Destination with Attractions Schema Used when displaying destinations with their associated attractions |
| src/entities/attraction/attraction.relations.schema.ts | attraction | AttractionListItemWithRelationsSchema | AttractionListItemWithRelations | Attraction List Item with Relations Schema Extended version of attraction for list displays that includes relation counts |
| src/entities/attraction/attraction.relations.schema.ts | attraction | BulkAddAttractionsToDestinationInputSchema | BulkAddAttractionsToDestinationInput | Schema for bulk adding attractions to a destination |
| src/entities/attraction/attraction.relations.schema.ts | attraction | BulkRemoveAttractionsFromDestinationInputSchema | BulkRemoveAttractionsFromDestinationInput | Schema for bulk removing attractions from a destination |
| src/entities/attraction/attraction.relations.schema.ts | attraction | UpdateAttractionOrderInputSchema | UpdateAttractionOrderInput | Schema for updating attraction order in a destination |
| src/entities/attraction/attraction.relations.schema.ts | attraction | BulkRelationOperationOutputSchema | BulkRelationOperationOutput | Schema for bulk relation operation results |
| src/entities/attraction/attraction.relations.schema.ts | attraction | AttractionDestinationRelationDetailSchema | AttractionDestinationRelationDetail | Schema for attraction-destination relation with full details |
| src/entities/attraction/attraction.schema.ts | attraction | AttractionSchema | Attraction | Attraction Schema - Main entity schema for attractions Represents an attraction that can be associated with destinations |
| src/entities/attraction/attraction.schema.ts | attraction | AttractionSummarySchema | AttractionSummary | Attraction Summary Schema - Lightweight version for lists and relations Contains only essential fields for display purposes |
| src/entities/attraction/attraction.schema.ts | attraction | AttractionMiniSchema | AttractionMini | Attraction Mini Schema - Minimal version for dropdowns and references Contains only the most basic identifying information |

### destination

| filePath | entidad | schema | type inferido/asociado | commentario |
|---|---|---|---|---|
| src/entities/destination/destination.crud.schema.ts | destination | DestinationBulkOperationInputSchema | DestinationBulkOperationInput | Schema for bulk destination operations input Requires array of destination IDs and operation type |
| src/entities/destination/destination.crud.schema.ts | destination | DestinationBulkOperationOutputSchema | DestinationBulkOperationOutput | Schema for bulk destination operations response Returns operation results for each destination |
| src/entities/destination/destination.crud.schema.ts | destination | DestinationCreateInputSchema | DestinationCreateInput | Destination CRUD Schemas This file contains all schemas related to CRUD operations for destinations: - Create (input/output) - Update (input/output) - Patch (input) - Delete (input/output) - Restor… |
| src/entities/destination/destination.crud.schema.ts | destination | DestinationCreateOutputSchema | DestinationCreateOutput | Schema for destination creation response Returns the complete destination object |
| src/entities/destination/destination.crud.schema.ts | destination | DestinationDeleteInputSchema | DestinationDeleteInput | Schema for destination deletion input Requires ID and optional force flag for hard delete |
| src/entities/destination/destination.crud.schema.ts | destination | DestinationDeleteOutputSchema | DestinationDeleteOutput | Schema for destination deletion response Returns success status and deletion timestamp |
| src/entities/destination/destination.crud.schema.ts | destination | DestinationFeatureToggleInputSchema | DestinationFeatureToggleInput | Schema for destination feature toggle input Requires destination ID and feature status |
| src/entities/destination/destination.crud.schema.ts | destination | DestinationFeatureToggleOutputSchema | DestinationFeatureToggleOutput | Schema for destination feature toggle response Returns the updated destination object |
| src/entities/destination/destination.crud.schema.ts | destination | DestinationPatchInputSchema | DestinationPatchInput | Schema for partial destination updates (PATCH) Same as update but explicitly named for clarity |
| src/entities/destination/destination.crud.schema.ts | destination | DestinationRestoreInputSchema | DestinationRestoreInput | Schema for destination restoration input Requires only the destination ID |
| src/entities/destination/destination.crud.schema.ts | destination | DestinationRestoreOutputSchema | DestinationRestoreOutput | Schema for destination restoration response Returns the complete restored destination object |
| src/entities/destination/destination.crud.schema.ts | destination | DestinationUpdateInputSchema | DestinationUpdateInput | Schema for updating a destination (PUT - complete replacement) Omits auto-generated fields and makes all fields partial |
| src/entities/destination/destination.crud.schema.ts | destination | DestinationUpdateOutputSchema | DestinationUpdateOutput | Schema for destination update response Returns the complete updated destination object |
| src/entities/destination/destination.crud.schema.ts | destination | CreateDestinationServiceSchema | CreateDestinationService | Service layer alias for destination creation Used by DestinationService for consistency with existing code |
| src/entities/destination/destination.crud.schema.ts | destination | UpdateDestinationServiceSchema | UpdateDestinationService | Service layer alias for destination updates Used by DestinationService for consistency with existing code |
| src/entities/destination/destination.query.schema.ts | destination | DestinationFiltersSchema | DestinationFilters | Destination Query Schemas This file contains all schemas related to querying destinations: - List (input/output/item) - Search (input/output/result) - Summary - Stats - Filters / // ===============… |
| src/entities/destination/destination.query.schema.ts | destination | DestinationListInputSchema | DestinationListInput | Schema for destination list input parameters Includes pagination and filters |
| src/entities/destination/destination.query.schema.ts | destination | DestinationListItemSchema | DestinationListItem | Schema for individual destination items in lists Contains essential fields for list display |
| src/entities/destination/destination.query.schema.ts | destination | DestinationListOutputSchema | DestinationListOutput | Schema for destination list output Uses generic paginated response with list items |
| src/entities/destination/destination.query.schema.ts | destination | DestinationSearchInputSchema | DestinationSearchInput | Schema for destination search input parameters Extends base search with destination-specific filters |
| src/entities/destination/destination.query.schema.ts | destination | DestinationSearchOutputSchema | DestinationSearchOutput | Schema for destination search output Uses generic paginated response with search results |
| src/entities/destination/destination.query.schema.ts | destination | DestinationSearchResultSchema | DestinationSearchResult | Schema for individual destination search results Extends list item with search score |
| src/entities/destination/destination.query.schema.ts | destination | DestinationStatsSchema | DestinationStats | Schema for destination statistics Contains metrics and analytics data |
| src/entities/destination/destination.query.schema.ts | destination | DestinationSummarySchema | DestinationSummary | Schema for destination summary Contains essential information for quick display Matches DestinationSummaryType from @repo/types |
| src/entities/destination/destination.query.schema.ts | destination | DestinationSummaryExtendedSchema | DestinationSummaryExtended | Schema for destination summary with additional fields Extended version with more fields for different use cases |
| src/entities/destination/destination.query.schema.ts | destination | DestinationFilterInputSchema | DestinationFilterInput | Schema for destination filter input (used by service) Combines filters with pagination for service layer |
| src/entities/destination/destination.query.schema.ts | destination | GetDestinationAccommodationsInputSchema | GetDestinationAccommodationsInput | Schema for getting destination accommodations Supports both legacy destinationId and new id parameter |
| src/entities/destination/destination.query.schema.ts | destination | GetDestinationStatsInputSchema | GetDestinationStatsInput | Schema for getting destination stats |
| src/entities/destination/destination.query.schema.ts | destination | GetDestinationSummaryInputSchema | GetDestinationSummaryInput | Schema for getting destination summary |
| src/entities/destination/destination.query.schema.ts | destination | DestinationListItemWithStringAttractionsSchema | DestinationListItemWithStringAttractions | Schema for destination list item with attractions as strings Used by searchForList method |
| src/entities/destination/destination.query.schema.ts | destination | DestinationSearchForListOutputSchema | DestinationSearchForListOutput | Schema for searchForList output |
| src/entities/destination/destination.rating.schema.ts | destination | DestinationRatingSchema | DestinationRatingInput | Destination Rating schema definition using Zod for validation. |
| src/entities/destination/destination.relations.schema.ts | destination | DestinationWithAccommodationsSchema | DestinationWithAccommodations | Destination Relations Schemas This file contains schemas for destinations with related entities: - DestinationWithAccommodations - DestinationWithAttractions - DestinationWithReviews - DestinationW… |
| src/entities/destination/destination.relations.schema.ts | destination | DestinationWithActivityRelationsSchema | DestinationWithActivityRelations | Destination with activity relations Includes events and posts |
| src/entities/destination/destination.relations.schema.ts | destination | DestinationWithAttractionsSchema | DestinationWithAttractions | Destination with attractions Includes an array of attractions in this destination |
| src/entities/destination/destination.relations.schema.ts | destination | DestinationWithContentRelationsSchema | DestinationWithContentRelations | Destination with content relations Includes accommodations, attractions, and reviews |
| src/entities/destination/destination.relations.schema.ts | destination | DestinationWithEventsSchema | DestinationWithEvents | Destination with events Includes events happening in this destination |
| src/entities/destination/destination.relations.schema.ts | destination | DestinationWithFullRelationsSchema | DestinationWithFullRelations | Destination with all relations Includes all possible related entities |
| src/entities/destination/destination.relations.schema.ts | destination | DestinationWithNearbySchema | DestinationWithNearby | Destination with nearby destinations Includes related/nearby destinations for discovery |
| src/entities/destination/destination.relations.schema.ts | destination | DestinationWithPostsSchema | DestinationWithPosts | Destination with posts Includes blog posts/articles about this destination |
| src/entities/destination/destination.relations.schema.ts | destination | DestinationWithReviewsSchema | DestinationWithReviews | Destination with reviews Includes reviews for this destination |
| src/entities/destination/destination.review.schema.ts | destination | DestinationReviewCreateInputSchema |  | Input schema for creating a Destination Review (sin campos de auditoría ni id) |
| src/entities/destination/destination.review.schema.ts | destination | DestinationReviewSchema |  | Destination Review schema definition using Zod for validation. |
| src/entities/destination/destination.schema.ts | destination | DestinationSchema | Destination | Destination Schema - Main Entity Schema This schema defines the complete structure of a Destination entity using base field objects for consistency and maintainability. |

### enums

| filePath | entidad | schema | type inferido/asociado | commentario |
|---|---|---|---|---|
| src/enums/accommodation-type.enum.schema.ts | enums | AccommodationTypeEnumSchema |  |  |
| src/enums/amenity-type.enum.schema.ts | enums | AmenitiesTypeEnumSchema |  |  |
| src/enums/client-type.enum.schema.ts | enums | ClientTypeEnumSchema |  |  |
| src/enums/contact-preference.enum.schema.ts | enums | PreferredContactEnumSchema |  |  |
| src/enums/currency.enum.schema.ts | enums | PriceCurrencyEnumSchema |  |  |
| src/enums/entity-type.enum.schema.ts | enums | EntityTypeEnumSchema |  |  |
| src/enums/event-category.enum.schema.ts | enums | EventCategoryEnumSchema |  |  |
| src/enums/lifecycle-state.enum.schema.ts | enums | LifecycleStatusEnumSchema |  |  |
| src/enums/moderation-status.enum.schema.ts | enums | ModerationStatusEnumSchema |  |  |
| src/enums/payment-method.enum.schema.ts | enums | PaymentMethodEnumSchema |  | Payment method enum schema for validation |
| src/enums/payment-status.enum.schema.ts | enums | PaymentStatusEnumSchema |  | Payment status enum schema for validation |
| src/enums/payment-type.enum.schema.ts | enums | BillingCycleEnumSchema |  | Billing cycle enum schema for validation |
| src/enums/payment-type.enum.schema.ts | enums | PaymentTypeEnumSchema |  | Payment type enum schema for validation |
| src/enums/payment-type.enum.schema.ts | enums | SubscriptionStatusEnumSchema |  | Subscription status enum schema for validation |
| src/enums/permission.enum.schema.ts | enums | PermissionEnumSchema |  |  |
| src/enums/post-category.enum.schema.ts | enums | PostCategoryEnumSchema |  |  |
| src/enums/recurrence.enum.schema.ts | enums | RecurrenceTypeEnumSchema |  |  |
| src/enums/role.enum.schema.ts | enums | RoleEnumSchema |  |  |
| src/enums/tag-color.enum.schema.ts | enums | TagColorEnumSchema |  |  |
| src/enums/visibility.enum.schema.ts | enums | VisibilityEnumSchema |  |  |

### event

| filePath | entidad | schema | type inferido/asociado | commentario |
|---|---|---|---|---|
| src/entities/event/event.crud.schema.ts | event | EventBulkOperationInputSchema | EventBulkOperationInput | Schema for bulk event operations input Requires array of event IDs and operation type |
| src/entities/event/event.crud.schema.ts | event | EventBulkOperationOutputSchema | EventBulkOperationOutput | Schema for bulk event operations response Returns operation results for each event |
| src/entities/event/event.crud.schema.ts | event | EventCancelInputSchema | EventCancelInput | Schema for event cancellation input Requires event ID and optional cancellation reason |
| src/entities/event/event.crud.schema.ts | event | EventCancelRescheduleOutputSchema | EventCancelRescheduleOutput | Schema for event cancel/reschedule response Returns the updated event object |
| src/entities/event/event.crud.schema.ts | event | EventCreateInputSchema | EventCreateInput | Event CRUD Schemas This file contains all schemas related to CRUD operations for events: - Create (input/output) - Update (input/output) - Patch (input) - Delete (input/output) - Restore (input/out… |
| src/entities/event/event.crud.schema.ts | event | EventCreateOutputSchema | EventCreateOutput | Schema for event creation response Returns the complete event object |
| src/entities/event/event.crud.schema.ts | event | EventDeleteInputSchema | EventDeleteInput | Schema for event deletion input Requires ID and optional force flag for hard delete |
| src/entities/event/event.crud.schema.ts | event | EventDeleteOutputSchema | EventDeleteOutput | Schema for event deletion response Returns success status and deletion timestamp |
| src/entities/event/event.crud.schema.ts | event | EventDuplicateInputSchema | EventDuplicateInput | Schema for event duplication input Requires event ID and optional new details |
| src/entities/event/event.crud.schema.ts | event | EventDuplicateOutputSchema | EventDuplicateOutput | Schema for event duplication response Returns the new duplicated event object |
| src/entities/event/event.crud.schema.ts | event | EventFeatureToggleInputSchema | EventFeatureToggleInput | Schema for event feature toggle input Requires event ID and feature status |
| src/entities/event/event.crud.schema.ts | event | EventFeatureToggleOutputSchema | EventFeatureToggleOutput | Schema for event feature toggle response Returns the updated event object |
| src/entities/event/event.crud.schema.ts | event | EventPatchInputSchema | EventPatchInput | Schema for partial event updates (PATCH) Same as update but explicitly named for clarity |
| src/entities/event/event.crud.schema.ts | event | EventPublishInputSchema | EventPublishInput | Schema for event publish input Requires event ID and optional publish date |
| src/entities/event/event.crud.schema.ts | event | EventPublishOutputSchema | EventPublishOutput | Schema for event publish/unpublish response Returns the updated event object |
| src/entities/event/event.crud.schema.ts | event | EventRescheduleInputSchema | EventRescheduleInput | Schema for event reschedule input Requires event ID and new dates |
| src/entities/event/event.crud.schema.ts | event | EventRestoreInputSchema | EventRestoreInput | Schema for event restoration input Requires only the event ID |
| src/entities/event/event.crud.schema.ts | event | EventRestoreOutputSchema | EventRestoreOutput | Schema for event restoration response Returns the complete restored event object |
| src/entities/event/event.crud.schema.ts | event | EventUnpublishInputSchema | EventUnpublishInput | Schema for event unpublish input Requires only the event ID |
| src/entities/event/event.crud.schema.ts | event | EventUpdateInputSchema | EventUpdateInput | Schema for updating an event (PUT - complete replacement) Omits auto-generated fields and makes all fields partial |
| src/entities/event/event.crud.schema.ts | event | EventUpdateOutputSchema | EventUpdateOutput | Schema for event update response Returns the complete updated event object |
| src/entities/event/event.date.schema.ts | event | EventDateSchema |  |  |
| src/entities/event/event.location.schema.ts | event | EventLocationSchema | EventLocationInput | Event Location schema definition using Zod for validation. |
| src/entities/event/event.organizer.schema.ts | event | EventOrganizerSchema | EventOrganizer | Event Organizer Schema - using Base Field Objects This schema represents the organizer details for an event. |
| src/entities/event/event.price.schema.ts | event | EventPriceSchema | EventPrice | Event Price Schema - using Base Field Objects This schema represents the price details for an event. |
| src/entities/event/event.query.schema.ts | event | EventFiltersSchema | EventFilters | Event Query Schemas This file contains all schemas related to querying events: - List (input/output/item) - Search (input/output/result) - Summary - Stats - Filters / // ===========================… |
| src/entities/event/event.query.schema.ts | event | EventListInputSchema | EventListInput | Schema for event list input parameters Includes pagination and filters |
| src/entities/event/event.query.schema.ts | event | EventListItemSchema | EventListItem | Schema for individual event items in lists Contains essential fields for list display |
| src/entities/event/event.query.schema.ts | event | EventListOutputSchema | EventListOutput | Schema for event list output Uses generic paginated response with list items |
| src/entities/event/event.query.schema.ts | event | EventSearchInputSchema | EventSearchInput | Schema for event search input parameters Extends base search with event-specific filters |
| src/entities/event/event.query.schema.ts | event | EventSearchOutputSchema | EventSearchOutput | Schema for event search output Uses generic paginated response with search results |
| src/entities/event/event.query.schema.ts | event | EventSearchResultSchema | EventSearchResult | Schema for individual event search results Extends list item with search score |
| src/entities/event/event.query.schema.ts | event | EventStatsSchema | EventStats | Schema for event statistics Contains metrics and analytics data |
| src/entities/event/event.query.schema.ts | event | EventSummarySchema | EventSummary | Schema for event summary Contains essential information for quick display |
| src/entities/event/event.relations.schema.ts | event | EventWithAttendeesSchema | EventWithAttendees | Event with attendees Includes an array of event attendees |
| src/entities/event/event.relations.schema.ts | event | EventWithBasicRelationsSchema | EventWithBasicRelations | Event with basic relations Includes organizer, location, and destination |
| src/entities/event/event.relations.schema.ts | event | EventWithBusinessRelationsSchema | EventWithBusinessRelations | Event with business relations Includes attendees and tickets |
| src/entities/event/event.relations.schema.ts | event | EventWithDestinationSchema | EventWithDestination | Event with destination information Includes the related destination data |
| src/entities/event/event.relations.schema.ts | event | EventWithFullRelationsSchema | EventWithFullRelations | Event with all relations Includes all possible related entities |
| src/entities/event/event.relations.schema.ts | event | EventWithLocationSchema | EventWithLocation | Event with location information Includes the complete location data |
| src/entities/event/event.relations.schema.ts | event | EventWithOrganizerSchema | EventWithOrganizer | Event Relations Schemas This file contains schemas for events with related entities: - EventWithOrganizer - EventWithLocation - EventWithDestination - EventWithAttendees - EventWithTickets - EventW… |
| src/entities/event/event.relations.schema.ts | event | EventWithPostsSchema | EventWithPosts | Event with posts Includes blog posts/articles about this event |
| src/entities/event/event.relations.schema.ts | event | EventWithRecommendationsSchema | EventWithRecommendations | Event with recommendations Includes similar and related events for discovery |
| src/entities/event/event.relations.schema.ts | event | EventWithSeriesSchema | EventWithSeries | Event with series information Includes related events in the same series |
| src/entities/event/event.relations.schema.ts | event | EventWithTicketsSchema | EventWithTickets | Event with tickets Includes an array of ticket types for the event |
| src/entities/event/event.schema.ts | event | EventSchema | Event | Event Schema - Main Entity Schema This schema defines the complete structure of an Event entity using base field objects for consistency and maintainability. |

### feature

| filePath | entidad | schema | type inferido/asociado | commentario |
|---|---|---|---|---|
| src/entities/feature/feature.crud.schema.ts | feature | FeatureAvailabilityUpdateInputSchema | FeatureAvailabilityUpdateInput | Schema for feature availability update input Allows updating availability status for multiple features |
| src/entities/feature/feature.crud.schema.ts | feature | FeatureAvailabilityUpdateOutputSchema | FeatureAvailabilityUpdateOutput | Schema for feature availability update response Returns update statistics |
| src/entities/feature/feature.crud.schema.ts | feature | FeatureBulkOperationInputSchema | FeatureBulkOperationInput | Schema for bulk feature operations input Requires array of feature IDs and operation type |
| src/entities/feature/feature.crud.schema.ts | feature | FeatureBulkOperationOutputSchema | FeatureBulkOperationOutput | Schema for bulk feature operations response Returns operation results for each feature |
| src/entities/feature/feature.crud.schema.ts | feature | FeatureCategoryUpdateInputSchema | FeatureCategoryUpdateInput | Schema for feature category update input Allows updating category for multiple features |
| src/entities/feature/feature.crud.schema.ts | feature | FeatureCategoryUpdateOutputSchema | FeatureCategoryUpdateOutput | Schema for feature category update response Returns update statistics |
| src/entities/feature/feature.crud.schema.ts | feature | FeatureCreateInputSchema | FeatureCreateInput | Feature CRUD Schemas This file contains all schemas related to CRUD operations for features: - Create (input/output) - Update (input/output) - Patch (input) - Delete (input/output) - Restore (input… |
| src/entities/feature/feature.crud.schema.ts | feature | FeatureCreateOutputSchema | FeatureCreateOutput | Schema for feature creation response Returns the complete feature object |
| src/entities/feature/feature.crud.schema.ts | feature | FeatureDeleteInputSchema | FeatureDeleteInput | Schema for feature deletion input Requires ID and optional force flag for hard delete |
| src/entities/feature/feature.crud.schema.ts | feature | FeatureDeleteOutputSchema | FeatureDeleteOutput | Schema for feature deletion response Returns success status and deletion timestamp |
| src/entities/feature/feature.crud.schema.ts | feature | FeatureIconUpdateInputSchema | FeatureIconUpdateInput | Schema for feature icon update input Allows updating icons for multiple features |
| src/entities/feature/feature.crud.schema.ts | feature | FeatureIconUpdateOutputSchema | FeatureIconUpdateOutput | Schema for feature icon update response Returns update statistics |
| src/entities/feature/feature.crud.schema.ts | feature | FeatureMergeInputSchema | FeatureMergeInput | Schema for feature merge input Requires source feature ID and target feature ID |
| src/entities/feature/feature.crud.schema.ts | feature | FeatureMergeOutputSchema | FeatureMergeOutput | Schema for feature merge response Returns the target feature and merge statistics |
| src/entities/feature/feature.crud.schema.ts | feature | FeaturePatchInputSchema | FeaturePatchInput | Schema for partial feature updates (PATCH) Same as update but explicitly named for clarity |
| src/entities/feature/feature.crud.schema.ts | feature | FeaturePriorityUpdateInputSchema | FeaturePriorityUpdateInput | Schema for feature priority update input Allows updating priority for multiple features |
| src/entities/feature/feature.crud.schema.ts | feature | FeaturePriorityUpdateOutputSchema | FeaturePriorityUpdateOutput | Schema for feature priority update response Returns update statistics |
| src/entities/feature/feature.crud.schema.ts | feature | FeatureRestoreInputSchema | FeatureRestoreInput | Schema for feature restoration input Requires only the feature ID |
| src/entities/feature/feature.crud.schema.ts | feature | FeatureRestoreOutputSchema | FeatureRestoreOutput | Schema for feature restoration response Returns the complete restored feature object |
| src/entities/feature/feature.crud.schema.ts | feature | FeatureUpdateInputSchema | FeatureUpdateInput | Schema for updating a feature (PUT - complete replacement) Omits auto-generated fields and makes all fields partial |
| src/entities/feature/feature.crud.schema.ts | feature | FeatureUpdateOutputSchema | FeatureUpdateOutput | Schema for feature update response Returns the complete updated feature object |
| src/entities/feature/feature.query.schema.ts | feature | FeatureCategoriesInputSchema | FeatureCategoriesInput | Schema for feature categories input Parameters for fetching feature categories |
| src/entities/feature/feature.query.schema.ts | feature | FeatureCategoriesOutputSchema | FeatureCategoriesOutput | Schema for feature categories output Returns list of categories with statistics |
| src/entities/feature/feature.query.schema.ts | feature | FeatureFiltersSchema | FeatureFilters | Feature Query Schemas This file contains all schemas related to querying features: - List (input/output/item) - Search (input/output/result) - Summary - Stats - Filters / // =======================… |
| src/entities/feature/feature.query.schema.ts | feature | FeatureListInputSchema | FeatureListInput | Schema for feature list input parameters Includes pagination and filters |
| src/entities/feature/feature.query.schema.ts | feature | FeatureListItemSchema | FeatureListItem | Schema for individual feature items in lists Contains essential fields for list display |
| src/entities/feature/feature.query.schema.ts | feature | FeatureListOutputSchema | FeatureListOutput | Schema for feature list output Uses generic paginated response with list items |
| src/entities/feature/feature.query.schema.ts | feature | FeaturePriorityDistributionInputSchema | FeaturePriorityDistributionInput | Schema for feature priority distribution input Parameters for analyzing priority distribution |
| src/entities/feature/feature.query.schema.ts | feature | FeaturePriorityDistributionOutputSchema | FeaturePriorityDistributionOutput | Schema for feature priority distribution output Returns priority distribution analysis |
| src/entities/feature/feature.query.schema.ts | feature | FeatureSearchInputSchema | FeatureSearchInput | Schema for feature search input parameters Extends base search with feature-specific filters |
| src/entities/feature/feature.query.schema.ts | feature | FeatureSearchOutputSchema | FeatureSearchOutput | Schema for feature search output Uses generic paginated response with search results |
| src/entities/feature/feature.query.schema.ts | feature | FeatureSearchResultSchema | FeatureSearchResult | Schema for individual feature search results Extends list item with search score |
| src/entities/feature/feature.query.schema.ts | feature | FeatureStatsSchema | FeatureStats | Schema for feature statistics Contains metrics and analytics data |
| src/entities/feature/feature.query.schema.ts | feature | FeatureSummarySchema | FeatureSummary | Schema for feature summary Contains essential information for quick display |
| src/entities/feature/feature.query.schema.ts | feature | PopularFeaturesInputSchema | PopularFeaturesInput | Schema for popular features input Parameters for fetching popular features |
| src/entities/feature/feature.query.schema.ts | feature | PopularFeaturesOutputSchema | PopularFeaturesOutput | Schema for popular features output Returns list of popular features with usage statistics |
| src/entities/feature/feature.relations.schema.ts | feature | FeatureComparisonInputSchema | FeatureComparisonInput | Feature comparison input schema Parameters for comparing multiple features |
| src/entities/feature/feature.relations.schema.ts | feature | FeatureComparisonOutputSchema | FeatureComparisonOutput | Feature comparison output schema Returns comparison data for multiple features |
| src/entities/feature/feature.relations.schema.ts | feature | FeatureWithAccommodationsSchema | FeatureWithAccommodations | Feature with accommodations Includes an array of accommodations using this feature |
| src/entities/feature/feature.relations.schema.ts | feature | FeatureWithAvailabilitySchema | FeatureWithAvailability | Feature with availability analysis Includes detailed availability patterns and constraints |
| src/entities/feature/feature.relations.schema.ts | feature | FeatureWithCategorySchema | FeatureWithCategory | Feature with category information Includes detailed category data and related features in the same category |
| src/entities/feature/feature.relations.schema.ts | feature | FeatureWithFullRelationsSchema | FeatureWithFullRelations | Feature with all relations Includes all possible related data |
| src/entities/feature/feature.relations.schema.ts | feature | FeatureWithGeographicSchema | FeatureWithGeographic | Feature with geographic distribution Shows where this feature is most commonly found |
| src/entities/feature/feature.relations.schema.ts | feature | FeatureWithPricingSchema | FeatureWithPricing | Feature with pricing information Includes pricing data from accommodations that offer this feature |
| src/entities/feature/feature.relations.schema.ts | feature | FeatureWithSimilarSchema | FeatureWithSimilar | Feature with similar features Includes features that are commonly used together or are similar |
| src/entities/feature/feature.relations.schema.ts | feature | FeatureWithUsageStatsSchema | FeatureWithUsageStats | Feature Relations Schemas This file contains schemas for features with related entities: - FeatureWithUsageStats - FeatureWithAccommodations - FeatureWithCategory - FeatureWithSimilar - FeatureWith… |
| src/entities/feature/feature.schema.ts | feature | AccommodationFeatureRelationSchema | AccommodationFeatureRelation | Accommodation-Feature Relation Schema Represents the many-to-many relationship between accommodations and features |
| src/entities/feature/feature.schema.ts | feature | FeatureSchema | Feature | Feature Schema - Main Entity Schema This schema represents a feature entity that can be associated with accommodations. |

### payment

| filePath | entidad | schema | type inferido/asociado | commentario |
|---|---|---|---|---|
| src/entities/payment/payment-plan.schema.ts | payment | PaymentPlanSchema | PaymentPlan | Payment Plan Schema - Main Entity Schema This schema defines the complete structure of a Payment Plan entity representing a payment plan configuration in the system. |
| src/entities/payment/payment.crud.schema.ts | payment | PaymentBulkOperationInputSchema | PaymentBulkOperationInput | Schema for bulk payment operations input Requires array of payment IDs and operation type |
| src/entities/payment/payment.crud.schema.ts | payment | PaymentBulkOperationOutputSchema | PaymentBulkOperationOutput | Schema for bulk payment operations response Returns operation results for each payment |
| src/entities/payment/payment.crud.schema.ts | payment | PaymentCancelInputSchema | PaymentCancelInput | Schema for payment cancellation input Requires payment ID and optional cancellation reason |
| src/entities/payment/payment.crud.schema.ts | payment | PaymentCancelOutputSchema | PaymentCancelOutput | Schema for payment cancellation response Returns cancellation status and details |
| src/entities/payment/payment.crud.schema.ts | payment | PaymentCreateInputSchema | PaymentCreateInput | Payment CRUD Schemas This file contains all schemas related to CRUD operations for payments: - Payment (create/update/cancel/refund) - PaymentPlan (create/update/delete/activate/deactivate) - Subsc… |
| src/entities/payment/payment.crud.schema.ts | payment | PaymentCreateOutputSchema | PaymentCreateOutput | Schema for payment creation response Returns the complete payment object |
| src/entities/payment/payment.crud.schema.ts | payment | PaymentPatchInputSchema | PaymentPatchInput | Schema for partial payment updates (PATCH) Same as update but explicitly named for clarity |
| src/entities/payment/payment.crud.schema.ts | payment | PaymentPlanActivateInputSchema | PaymentPlanActivateInput | Schema for payment plan activation input Requires only the payment plan ID |
| src/entities/payment/payment.crud.schema.ts | payment | PaymentPlanActivateOutputSchema | PaymentPlanActivateOutput | Schema for payment plan activation response Returns the activated payment plan object |
| src/entities/payment/payment.crud.schema.ts | payment | PaymentPlanCreateInputSchema | PaymentPlanCreateInput | Schema for creating a new payment plan Omits auto-generated fields like id and audit fields |
| src/entities/payment/payment.crud.schema.ts | payment | PaymentPlanCreateOutputSchema | PaymentPlanCreateOutput | Schema for payment plan creation response Returns the complete payment plan object |
| src/entities/payment/payment.crud.schema.ts | payment | PaymentPlanDeactivateInputSchema | PaymentPlanDeactivateInput | Schema for payment plan deactivation input Requires payment plan ID and optional reason |
| src/entities/payment/payment.crud.schema.ts | payment | PaymentPlanDeactivateOutputSchema | PaymentPlanDeactivateOutput | Schema for payment plan deactivation response Returns the deactivated payment plan object |
| src/entities/payment/payment.crud.schema.ts | payment | PaymentPlanDeleteInputSchema | PaymentPlanDeleteInput | Schema for payment plan deletion input Requires ID and optional force flag for hard delete |
| src/entities/payment/payment.crud.schema.ts | payment | PaymentPlanDeleteOutputSchema | PaymentPlanDeleteOutput | Schema for payment plan deletion response Returns success status and deletion timestamp |
| src/entities/payment/payment.crud.schema.ts | payment | PaymentPlanPatchInputSchema | PaymentPlanPatchInput | Schema for partial payment plan updates (PATCH) Same as update but explicitly named for clarity |
| src/entities/payment/payment.crud.schema.ts | payment | PaymentPlanUpdateInputSchema | PaymentPlanUpdateInput | Schema for updating a payment plan (PUT - complete replacement) Omits auto-generated fields and makes all fields partial |
| src/entities/payment/payment.crud.schema.ts | payment | PaymentPlanUpdateOutputSchema | PaymentPlanUpdateOutput | Schema for payment plan update response Returns the complete updated payment plan object |
| src/entities/payment/payment.crud.schema.ts | payment | PaymentRefundInputSchema | PaymentRefundInput | Schema for payment refund input Requires payment ID and refund details |
| src/entities/payment/payment.crud.schema.ts | payment | PaymentRefundOutputSchema | PaymentRefundOutput | Schema for payment refund response Returns refund status and details |
| src/entities/payment/payment.crud.schema.ts | payment | PaymentUpdateInputSchema | PaymentUpdateInput | Schema for updating a payment (PUT - complete replacement) Omits auto-generated fields and makes all fields partial |
| src/entities/payment/payment.crud.schema.ts | payment | PaymentUpdateOutputSchema | PaymentUpdateOutput | Schema for payment update response Returns the complete updated payment object |
| src/entities/payment/payment.crud.schema.ts | payment | SubscriptionCancelInputSchema | SubscriptionCancelInput | Schema for subscription cancellation input Requires subscription ID and optional cancellation details |
| src/entities/payment/payment.crud.schema.ts | payment | SubscriptionCancelOutputSchema | SubscriptionCancelOutput | Schema for subscription cancellation response Returns cancellation status and details |
| src/entities/payment/payment.crud.schema.ts | payment | SubscriptionChangePlanInputSchema | SubscriptionChangePlanInput | Schema for subscription plan change input Requires subscription ID and new plan details |
| src/entities/payment/payment.crud.schema.ts | payment | SubscriptionChangePlanOutputSchema | SubscriptionChangePlanOutput | Schema for subscription plan change response Returns plan change status and details |
| src/entities/payment/payment.crud.schema.ts | payment | SubscriptionCreateInputSchema | SubscriptionCreateInput | Schema for creating a new subscription Omits auto-generated fields like id and audit fields |
| src/entities/payment/payment.crud.schema.ts | payment | SubscriptionCreateOutputSchema | SubscriptionCreateOutput | Schema for subscription creation response Returns the complete subscription object |
| src/entities/payment/payment.crud.schema.ts | payment | SubscriptionPatchInputSchema | SubscriptionPatchInput | Schema for partial subscription updates (PATCH) Same as update but explicitly named for clarity |
| src/entities/payment/payment.crud.schema.ts | payment | SubscriptionReactivateInputSchema | SubscriptionReactivateInput | Schema for subscription reactivation input Requires subscription ID and optional reactivation details |
| src/entities/payment/payment.crud.schema.ts | payment | SubscriptionReactivateOutputSchema | SubscriptionReactivateOutput | Schema for subscription reactivation response Returns reactivation status and details |
| src/entities/payment/payment.crud.schema.ts | payment | SubscriptionUpdateInputSchema | SubscriptionUpdateInput | Schema for updating a subscription (PUT - complete replacement) Omits auto-generated fields and makes all fields partial |
| src/entities/payment/payment.crud.schema.ts | payment | SubscriptionUpdateOutputSchema | SubscriptionUpdateOutput | Schema for subscription update response Returns the complete updated subscription object |
| src/entities/payment/payment.query.schema.ts | payment | PaymentFiltersSchema | PaymentFilters | Payment Query Schemas This file contains all schemas related to querying payments: - Payment List/Search/Summary/Stats - PaymentPlan List/Search/Summary/Stats - Subscription List/Search/Summary/Sta… |
| src/entities/payment/payment.query.schema.ts | payment | PaymentListInputSchema | PaymentListInput | Schema for payment list input parameters Includes pagination and filters |
| src/entities/payment/payment.query.schema.ts | payment | PaymentListItemSchema | PaymentListItem | Schema for individual payment items in lists Contains essential fields for list display |
| src/entities/payment/payment.query.schema.ts | payment | PaymentListOutputSchema | PaymentListOutput | Schema for payment list output Uses generic paginated response with list items |
| src/entities/payment/payment.query.schema.ts | payment | PaymentPlanFiltersSchema | PaymentPlanFilters | Schema for payment plan-specific filters Used in list and search operations |
| src/entities/payment/payment.query.schema.ts | payment | PaymentPlanListInputSchema | PaymentPlanListInput | Schema for payment plan list input parameters |
| src/entities/payment/payment.query.schema.ts | payment | PaymentPlanListItemSchema | PaymentPlanListItem | Schema for individual payment plan items in lists |
| src/entities/payment/payment.query.schema.ts | payment | PaymentPlanListOutputSchema | PaymentPlanListOutput | Schema for payment plan list output |
| src/entities/payment/payment.query.schema.ts | payment | PaymentPlanSummarySchema | PaymentPlanSummary | Schema for payment plan summary |
| src/entities/payment/payment.query.schema.ts | payment | PaymentSearchInputSchema | PaymentSearchInput | Schema for payment search input parameters Extends base search with payment-specific filters |
| src/entities/payment/payment.query.schema.ts | payment | PaymentSearchOutputSchema | PaymentSearchOutput | Schema for payment search output Uses generic paginated response with search results |
| src/entities/payment/payment.query.schema.ts | payment | PaymentSearchResultSchema | PaymentSearchResult | Schema for individual payment search results Extends list item with search score |
| src/entities/payment/payment.query.schema.ts | payment | PaymentStatsSchema | PaymentStats | Schema for payment statistics |
| src/entities/payment/payment.query.schema.ts | payment | PaymentSummarySchema | PaymentSummary | Schema for payment summary |
| src/entities/payment/payment.query.schema.ts | payment | SubscriptionFiltersSchema | SubscriptionFilters | Schema for subscription-specific filters Used in list and search operations |
| src/entities/payment/payment.query.schema.ts | payment | SubscriptionListInputSchema | SubscriptionListInput | Schema for subscription list input parameters |
| src/entities/payment/payment.query.schema.ts | payment | SubscriptionListItemSchema | SubscriptionListItem | Schema for individual subscription items in lists |
| src/entities/payment/payment.query.schema.ts | payment | SubscriptionListOutputSchema | SubscriptionListOutput | Schema for subscription list output |
| src/entities/payment/payment.query.schema.ts | payment | SubscriptionStatsSchema | SubscriptionStats | Schema for subscription statistics |
| src/entities/payment/payment.query.schema.ts | payment | SubscriptionSummarySchema | SubscriptionSummary | Schema for subscription summary |
| src/entities/payment/payment.relations.schema.ts | payment | PaymentAnalyticsInputSchema | PaymentAnalyticsInput | Payment analytics input schema Parameters for generating payment analytics |
| src/entities/payment/payment.relations.schema.ts | payment | PaymentAnalyticsOutputSchema | PaymentAnalyticsOutput | Payment analytics output schema Returns comprehensive payment analytics |
| src/entities/payment/payment.relations.schema.ts | payment | PaymentPlanWithFullRelationsSchema | PaymentPlanWithFullRelations | Payment plan with all relations Includes all possible related data |
| src/entities/payment/payment.relations.schema.ts | payment | PaymentPlanWithRevenueSchema | PaymentPlanWithRevenue | Payment plan with revenue analytics Includes detailed revenue and performance metrics |
| src/entities/payment/payment.relations.schema.ts | payment | PaymentPlanWithSubscriptionsSchema | PaymentPlanWithSubscriptions | Payment plan with subscriptions Includes active and historical subscription data |
| src/entities/payment/payment.relations.schema.ts | payment | PaymentPlanWithUsageSchema | PaymentPlanWithUsage | Payment plan with feature usage Includes feature adoption and usage statistics |
| src/entities/payment/payment.relations.schema.ts | payment | PaymentWithFullRelationsSchema | PaymentWithFullRelations | Payment with all relations Includes all possible related data |
| src/entities/payment/payment.relations.schema.ts | payment | PaymentWithPlanSchema | PaymentWithPlan | Payment with plan information Includes detailed plan data and features |
| src/entities/payment/payment.relations.schema.ts | payment | PaymentWithRefundsSchema | PaymentWithRefunds | Payment with refund information Includes detailed refund history and status |
| src/entities/payment/payment.relations.schema.ts | payment | PaymentWithSubscriptionSchema | PaymentWithSubscription | Payment with subscription information Includes subscription context and history |
| src/entities/payment/payment.relations.schema.ts | payment | PaymentWithTransactionSchema | PaymentWithTransaction | Payment with transaction details Includes detailed transaction and processing information |
| src/entities/payment/payment.relations.schema.ts | payment | PaymentWithUserSchema | PaymentWithUser | Payment Relations Schemas This file contains schemas for payments with related entities: - PaymentWithUser - PaymentWithPlan - PaymentWithSubscription - PaymentPlanWithSubscriptions - SubscriptionW… |
| src/entities/payment/payment.relations.schema.ts | payment | SubscriptionWithFullRelationsSchema | SubscriptionWithFullRelations | Subscription with all relations Includes all possible related data |
| src/entities/payment/payment.relations.schema.ts | payment | SubscriptionWithPaymentsSchema | SubscriptionWithPayments | Subscription with payments Includes payment history and billing information |
| src/entities/payment/payment.relations.schema.ts | payment | SubscriptionWithTrialSchema | SubscriptionWithTrial | Subscription with trial information Includes trial history and conversion data |
| src/entities/payment/payment.relations.schema.ts | payment | SubscriptionWithUserSchema | SubscriptionWithUser | Subscription with user and accommodations Includes user context and accommodation usage |
| src/entities/payment/payment.schema.ts | payment | PaymentSchema | Payment | Payment Schema - Main Entity Schema This schema defines the complete structure of a Payment entity representing a payment transaction in the system. |
| src/entities/payment/subscription.schema.ts | payment | SubscriptionSchema | Subscription | Subscription Schema - Main Entity Schema This schema defines the complete structure of a Subscription entity representing a subscription to a payment plan in the system. |

### post

| filePath | entidad | schema | type inferido/asociado | commentario |
|---|---|---|---|---|
| src/entities/post/post.crud.schema.ts | post | PostBulkOperationInputSchema | PostBulkOperationInput | Schema for bulk post operations input Requires array of post IDs and operation type |
| src/entities/post/post.crud.schema.ts | post | PostBulkOperationOutputSchema | PostBulkOperationOutput | Schema for bulk post operations response Returns operation results for each post |
| src/entities/post/post.crud.schema.ts | post | PostCreateInputSchema | PostCreateInput | Post CRUD Schemas This file contains all schemas related to CRUD operations for posts: - Create (input/output) - Update (input/output) - Patch (input) - Delete (input/output) - Restore (input/outpu… |
| src/entities/post/post.crud.schema.ts | post | PostCreateOutputSchema | PostCreateOutput | Schema for post creation response Returns the complete post object |
| src/entities/post/post.crud.schema.ts | post | PostDeleteInputSchema | PostDeleteInput | Schema for post deletion input Requires ID and optional force flag for hard delete |
| src/entities/post/post.crud.schema.ts | post | PostDeleteOutputSchema | PostDeleteOutput | Schema for post deletion response Returns success status and deletion timestamp |
| src/entities/post/post.crud.schema.ts | post | PostDuplicateInputSchema | PostDuplicateInput | Schema for post duplication input Requires post ID and optional new title |
| src/entities/post/post.crud.schema.ts | post | PostDuplicateOutputSchema | PostDuplicateOutput | Schema for post duplication response Returns the new duplicated post object |
| src/entities/post/post.crud.schema.ts | post | PostFeatureToggleInputSchema | PostFeatureToggleInput | Schema for post feature toggle input Requires post ID and feature status |
| src/entities/post/post.crud.schema.ts | post | PostFeatureToggleOutputSchema | PostFeatureToggleOutput | Schema for post feature toggle response Returns the updated post object |
| src/entities/post/post.crud.schema.ts | post | PostPatchInputSchema | PostPatchInput | Schema for partial post updates (PATCH) Same as update but explicitly named for clarity |
| src/entities/post/post.crud.schema.ts | post | PostPublishInputSchema | PostPublishInput | Schema for post publish input Requires post ID and optional publish date |
| src/entities/post/post.crud.schema.ts | post | PostPublishOutputSchema | PostPublishOutput | Schema for post publish/unpublish response Returns the updated post object |
| src/entities/post/post.crud.schema.ts | post | PostRestoreInputSchema | PostRestoreInput | Schema for post restoration input Requires only the post ID |
| src/entities/post/post.crud.schema.ts | post | PostRestoreOutputSchema | PostRestoreOutput | Schema for post restoration response Returns the complete restored post object |
| src/entities/post/post.crud.schema.ts | post | PostUnpublishInputSchema | PostUnpublishInput | Schema for post unpublish input Requires only the post ID |
| src/entities/post/post.crud.schema.ts | post | PostUpdateInputSchema | PostUpdateInput | Schema for updating a post (PUT - complete replacement) Omits auto-generated fields and makes all fields partial |
| src/entities/post/post.crud.schema.ts | post | PostUpdateOutputSchema | PostUpdateOutput | Schema for post update response Returns the complete updated post object |
| src/entities/post/post.query.schema.ts | post | PostFiltersSchema | PostFilters | Post Query Schemas This file contains all schemas related to querying posts: - List (input/output/item) - Search (input/output/result) - Summary - Stats - Filters / // =============================… |
| src/entities/post/post.query.schema.ts | post | PostListInputSchema | PostListInput | Schema for post list input parameters Includes pagination and filters |
| src/entities/post/post.query.schema.ts | post | PostListItemSchema | PostListItem | Schema for individual post items in lists Contains essential fields for list display |
| src/entities/post/post.query.schema.ts | post | PostListOutputSchema | PostListOutput | Schema for post list output Uses generic paginated response with list items |
| src/entities/post/post.query.schema.ts | post | PostSearchInputSchema | PostSearchInput | Schema for post search input parameters Extends base search with post-specific filters |
| src/entities/post/post.query.schema.ts | post | PostSearchOutputSchema | PostSearchOutput | Schema for post search output Uses generic paginated response with search results |
| src/entities/post/post.query.schema.ts | post | PostSearchResultSchema | PostSearchResult | Schema for individual post search results Extends list item with search score |
| src/entities/post/post.query.schema.ts | post | PostStatsSchema | PostStats | Schema for post statistics Contains metrics and analytics data |
| src/entities/post/post.query.schema.ts | post | PostSummarySchema | PostSummary | Schema for post summary Contains essential information for quick display |
| src/entities/post/post.relations.schema.ts | post | PostWithAccommodationsSchema | PostWithAccommodations | Post with accommodations Includes an array of related accommodations |
| src/entities/post/post.relations.schema.ts | post | PostWithAuthorSchema | PostWithAuthor | Post Relations Schemas This file contains schemas for posts with related entities: - PostWithAuthor - PostWithDestinations - PostWithAccommodations - PostWithEvents - PostWithSponsorship - PostWith… |
| src/entities/post/post.relations.schema.ts | post | PostWithCommentsSchema | PostWithComments | Post with comments Includes an array of comments on the post |
| src/entities/post/post.relations.schema.ts | post | PostWithContentRelationsSchema | PostWithContentRelations | Post with content relations Includes destinations, accommodations, and events |
| src/entities/post/post.relations.schema.ts | post | PostWithDestinationsSchema | PostWithDestinations | Post with destinations Includes an array of related destinations |
| src/entities/post/post.relations.schema.ts | post | PostWithEngagementRelationsSchema | PostWithEngagementRelations | Post with engagement relations Includes comments and sponsorship |
| src/entities/post/post.relations.schema.ts | post | PostWithEventsSchema | PostWithEvents | Post with events Includes an array of related events |
| src/entities/post/post.relations.schema.ts | post | PostWithFullRelationsSchema | PostWithFullRelations | Post with all relations Includes all possible related entities |
| src/entities/post/post.relations.schema.ts | post | PostWithSeriesSchema | PostWithSeries | Post with series information Includes related posts in the same series |
| src/entities/post/post.relations.schema.ts | post | PostWithSponsorshipSchema | PostWithSponsorship | Post with sponsorship information Includes sponsorship details if the post is sponsored |
| src/entities/post/post.schema.ts | post | PostSchema | Post | Post Schema - Main Entity Schema This schema defines the complete structure of a Post entity using base field objects for consistency and maintainability. |
| src/entities/post/post.sponsor.schema.ts | post | PostSponsorSchema | PostSponsor | Post Sponsor Schema - using Base Field Objects This schema represents a sponsor entity for a post. |
| src/entities/post/post.sponsorship.schema.ts | post | PostSponsorshipSchema | PostSponsorship | Post Sponsorship Schema - using Base Field Objects This schema represents sponsorship details for a post. |

### tag

| filePath | entidad | schema | type inferido/asociado | commentario |
|---|---|---|---|---|
| src/entities/tag/tag.crud.schema.ts | tag | TagBulkOperationInputSchema | TagBulkOperationInput | Schema for bulk tag operations input Requires array of tag IDs and operation type |
| src/entities/tag/tag.crud.schema.ts | tag | TagBulkOperationOutputSchema | TagBulkOperationOutput | Schema for bulk tag operations response Returns operation results for each tag |
| src/entities/tag/tag.crud.schema.ts | tag | TagCleanupInputSchema | TagCleanupInput | Schema for tag cleanup input Removes unused tags based on criteria |
| src/entities/tag/tag.crud.schema.ts | tag | TagCleanupOutputSchema | TagCleanupOutput | Schema for tag cleanup response Returns cleanup statistics |
| src/entities/tag/tag.crud.schema.ts | tag | TagCreateInputSchema | TagCreateInput | Tag CRUD Schemas This file contains all schemas related to CRUD operations for tags: - Create (input/output) - Update (input/output) - Patch (input) - Delete (input/output) - Restore (input/output)… |
| src/entities/tag/tag.crud.schema.ts | tag | TagCreateOutputSchema | TagCreateOutput | Schema for tag creation response Returns the complete tag object |
| src/entities/tag/tag.crud.schema.ts | tag | TagDeleteInputSchema | TagDeleteInput | Schema for tag deletion input Requires ID and optional force flag for hard delete |
| src/entities/tag/tag.crud.schema.ts | tag | TagDeleteOutputSchema | TagDeleteOutput | Schema for tag deletion response Returns success status and deletion timestamp |
| src/entities/tag/tag.crud.schema.ts | tag | TagMergeInputSchema | TagMergeInput | Schema for tag merge input Requires source tag ID and target tag ID |
| src/entities/tag/tag.crud.schema.ts | tag | TagMergeOutputSchema | TagMergeOutput | Schema for tag merge response Returns the target tag and merge statistics |
| src/entities/tag/tag.crud.schema.ts | tag | TagPatchInputSchema | TagPatchInput | Schema for partial tag updates (PATCH) Same as update but explicitly named for clarity |
| src/entities/tag/tag.crud.schema.ts | tag | TagRestoreInputSchema | TagRestoreInput | Schema for tag restoration input Requires only the tag ID |
| src/entities/tag/tag.crud.schema.ts | tag | TagRestoreOutputSchema | TagRestoreOutput | Schema for tag restoration response Returns the complete restored tag object |
| src/entities/tag/tag.crud.schema.ts | tag | TagUpdateInputSchema | TagUpdateInput | Schema for updating a tag (PUT - complete replacement) Omits auto-generated fields and makes all fields partial |
| src/entities/tag/tag.crud.schema.ts | tag | TagUpdateOutputSchema | TagUpdateOutput | Schema for tag update response Returns the complete updated tag object |
| src/entities/tag/tag.query.schema.ts | tag | PopularTagsInputSchema | PopularTagsInput | Schema for popular tags input Parameters for fetching popular tags |
| src/entities/tag/tag.query.schema.ts | tag | PopularTagsOutputSchema | PopularTagsOutput | Schema for popular tags output Returns list of popular tags with usage statistics |
| src/entities/tag/tag.query.schema.ts | tag | TagFiltersSchema | TagFilters | Tag Query Schemas This file contains all schemas related to querying tags: - List (input/output/item) - Search (input/output/result) - Summary - Stats - Filters / // ===============================… |
| src/entities/tag/tag.query.schema.ts | tag | TagListInputSchema | TagListInput | Schema for tag list input parameters Includes pagination and filters |
| src/entities/tag/tag.query.schema.ts | tag | TagListItemSchema | TagListItem | Schema for individual tag items in lists Contains essential fields for list display |
| src/entities/tag/tag.query.schema.ts | tag | TagListOutputSchema | TagListOutput | Schema for tag list output Uses generic paginated response with list items |
| src/entities/tag/tag.query.schema.ts | tag | TagSearchInputSchema | TagSearchInput | Schema for tag search input parameters Extends base search with tag-specific filters |
| src/entities/tag/tag.query.schema.ts | tag | TagSearchOutputSchema | TagSearchOutput | Schema for tag search output Uses generic paginated response with search results |
| src/entities/tag/tag.query.schema.ts | tag | TagSearchResultSchema | TagSearchResult | Schema for individual tag search results Extends list item with search score |
| src/entities/tag/tag.query.schema.ts | tag | TagStatsSchema | TagStats | Schema for tag statistics Contains metrics and analytics data |
| src/entities/tag/tag.query.schema.ts | tag | TagSummarySchema | TagSummary | Schema for tag summary Contains essential information for quick display |
| src/entities/tag/tag.relations.schema.ts | tag | RelatedTagsInputSchema | RelatedTagsInput | Related tags input schema Parameters for finding related tags |
| src/entities/tag/tag.relations.schema.ts | tag | RelatedTagsOutputSchema | RelatedTagsOutput | Related tags output schema Returns tags that are commonly used together |
| src/entities/tag/tag.relations.schema.ts | tag | TagCloudInputSchema | TagCloudInput | Tag cloud input schema Parameters for generating tag clouds |
| src/entities/tag/tag.relations.schema.ts | tag | TagCloudItemSchema | TagCloudItem | Tag cloud item schema Contains tag information for tag cloud display |
| src/entities/tag/tag.relations.schema.ts | tag | TagCloudOutputSchema | TagCloudOutput | Tag cloud output schema Returns formatted tag cloud data |
| src/entities/tag/tag.relations.schema.ts | tag | TagWithAccommodationsSchema | TagWithAccommodations | Tag with accommodations Includes an array of accommodations using this tag |
| src/entities/tag/tag.relations.schema.ts | tag | TagWithContentRelationsSchema | TagWithContentRelations | Tag with content relations Includes accommodations, destinations, posts, and events |
| src/entities/tag/tag.relations.schema.ts | tag | TagWithDestinationsSchema | TagWithDestinations | Tag with destinations Includes an array of destinations using this tag |
| src/entities/tag/tag.relations.schema.ts | tag | TagWithEntitiesSchema | TagWithEntities | Tag with all entity counts Includes counts for each entity type without full entity data |
| src/entities/tag/tag.relations.schema.ts | tag | TagWithEventsSchema | TagWithEvents | Tag with events Includes an array of events using this tag |
| src/entities/tag/tag.relations.schema.ts | tag | TagWithFullRelationsSchema | TagWithFullRelations | Tag with all relations Includes all possible related entities and statistics |
| src/entities/tag/tag.relations.schema.ts | tag | TagWithPostsSchema | TagWithPosts | Tag with posts Includes an array of posts using this tag |
| src/entities/tag/tag.relations.schema.ts | tag | TagWithUsageStatsSchema | TagWithUsageStats | Tag Relations Schemas This file contains schemas for tags with related entities: - TagWithUsageStats - TagWithEntities - TagWithAccommodations - TagWithDestinations - TagWithPosts - TagWithEvents -… |
| src/entities/tag/tag.relations.schema.ts | tag | TagWithUsersSchema | TagWithUsers | Tag with users Includes an array of users using this tag |
| src/entities/tag/tag.schema.ts | tag | TagsArraySchema | TagsArray | Tag array schema |
| src/entities/tag/tag.schema.ts | tag | TagSchema | Tag | Tag Schema - Main Entity Schema (Completely Flat) This schema defines the complete structure of a Tag entity with all fields declared inline for zero dependencies. |

### user

| filePath | entidad | schema | type inferido/asociado | commentario |
|---|---|---|---|---|
| src/entities/user/permission.schema.ts | user | UserPermissionAssignmentSchema | UserPermissionAssignment | Zod schema for the assignment of a permission to a user. |
| src/entities/user/role.schema.ts | user | RolePermissionAssignmentSchema |  | Zod schema for the assignment of a permission to a role. |
| src/entities/user/user.bookmark.schema.ts | user | UserBookmarkSchema | UserBookmark | User Bookmark schema definition using Zod for validation. |
| src/entities/user/user.crud.schema.ts | user | UserActivateInputSchema | UserActivateInput | Schema for user activation input Requires only the user ID |
| src/entities/user/user.crud.schema.ts | user | UserActivationOutputSchema | UserActivationOutput | Schema for user activation/deactivation response Returns the updated user object |
| src/entities/user/user.crud.schema.ts | user | UserCreateInputSchema | UserCreateInput | User CRUD Schemas This file contains all schemas related to CRUD operations for users: - Create (input/output) - Update (input/output) - Patch (input) - Delete (input/output) - Restore (input/outpu… |
| src/entities/user/user.crud.schema.ts | user | UserCreateOutputSchema | UserCreateOutput | Schema for user creation response Returns the complete user object |
| src/entities/user/user.crud.schema.ts | user | UserDeactivateInputSchema | UserDeactivateInput | Schema for user deactivation input Requires user ID and optional reason |
| src/entities/user/user.crud.schema.ts | user | UserDeleteInputSchema | UserDeleteInput | Schema for user deletion input Requires ID and optional force flag for hard delete |
| src/entities/user/user.crud.schema.ts | user | UserDeleteOutputSchema | UserDeleteOutput | Schema for user deletion response Returns success status and deletion timestamp |
| src/entities/user/user.crud.schema.ts | user | UserPasswordChangeInputSchema | UserPasswordChangeInput | Schema for password change input Requires current and new password |
| src/entities/user/user.crud.schema.ts | user | UserPasswordOutputSchema | UserPasswordOutput | Schema for password operation response Returns success status |
| src/entities/user/user.crud.schema.ts | user | UserPasswordResetInputSchema | UserPasswordResetInput | Schema for password reset input Requires only user ID (admin operation) |
| src/entities/user/user.crud.schema.ts | user | UserPatchInputSchema | UserPatchInput | Schema for partial user updates (PATCH) Same as update but explicitly named for clarity |
| src/entities/user/user.crud.schema.ts | user | UserRestoreInputSchema | UserRestoreInput | Schema for user restoration input Requires only the user ID |
| src/entities/user/user.crud.schema.ts | user | UserRestoreOutputSchema | UserRestoreOutput | Schema for user restoration response Returns the complete restored user object |
| src/entities/user/user.crud.schema.ts | user | UserUpdateInputSchema | UserUpdateInput | Schema for updating a user (PUT - complete replacement) Omits auto-generated fields and makes all fields partial |
| src/entities/user/user.crud.schema.ts | user | UserUpdateOutputSchema | UserUpdateOutput | Schema for user update response Returns the complete updated user object |
| src/entities/user/user.profile.schema.ts | user | UserProfileSchema |  | User Profile schema definition using Zod for validation. |
| src/entities/user/user.query.schema.ts | user | UserFiltersSchema | UserFilters | User Query Schemas This file contains all schemas related to querying users: - List (input/output/item) - Search (input/output/result) - Summary - Stats - Filters / // =============================… |
| src/entities/user/user.query.schema.ts | user | UserListInputSchema | UserListInput | Schema for user list input parameters Includes pagination and filters |
| src/entities/user/user.query.schema.ts | user | UserListItemSchema | UserListItem | Schema for individual user items in lists Contains essential fields for list display (excludes sensitive data) |
| src/entities/user/user.query.schema.ts | user | UserListOutputSchema | UserListOutput | Schema for user list output Uses generic paginated response with list items |
| src/entities/user/user.query.schema.ts | user | UserSearchInputSchema | UserSearchInput | Schema for user search input parameters Extends base search with user-specific filters |
| src/entities/user/user.query.schema.ts | user | UserSearchOutputSchema | UserSearchOutput | Schema for user search output Uses generic paginated response with search results |
| src/entities/user/user.query.schema.ts | user | UserSearchResultSchema | UserSearchResult | Schema for individual user search results Extends list item with search score |
| src/entities/user/user.query.schema.ts | user | UserStatsSchema | UserStats | Schema for user statistics Contains metrics and analytics data |
| src/entities/user/user.query.schema.ts | user | UserSummarySchema | UserSummary | Schema for user summary Contains essential information for quick display (public safe) |
| src/entities/user/user.relations.schema.ts | user | UserWithAccommodationsSchema | UserWithAccommodations | User Relations Schemas This file contains schemas for users with related entities: - UserWithAccommodations - UserWithSubscriptions - UserWithPermissions - UserWithReviews - UserWithPayments - User… |
| src/entities/user/user.relations.schema.ts | user | UserWithActivityRelationsSchema | UserWithActivityRelations | User with activity relations Includes reviews and permissions |
| src/entities/user/user.relations.schema.ts | user | UserWithAdminDetailsSchema | UserWithAdminDetails | User with admin details Includes sensitive information for admin views |
| src/entities/user/user.relations.schema.ts | user | UserWithBusinessRelationsSchema | UserWithBusinessRelations | User with business relations Includes accommodations, subscriptions, and payments |
| src/entities/user/user.relations.schema.ts | user | UserWithFullRelationsSchema | UserWithFullRelations | User with all relations Includes all possible related entities |
| src/entities/user/user.relations.schema.ts | user | UserWithPaymentsSchema | UserWithPayments | User with payments Includes payment history |
| src/entities/user/user.relations.schema.ts | user | UserWithPermissionsSchema | UserWithPermissions | User with permissions Includes permission assignments |
| src/entities/user/user.relations.schema.ts | user | UserWithReviewsSchema | UserWithReviews | User with reviews Includes reviews written by the user |
| src/entities/user/user.relations.schema.ts | user | UserWithSubscriptionsSchema | UserWithSubscriptions | User with subscriptions Includes subscription information |
| src/entities/user/user.schema.ts | user | UserSchema | User | User Schema - Main Entity Schema This schema defines the complete structure of a User entity using base field objects for consistency and maintainability. |
| src/entities/user/user.settings.schema.ts | user | UserNotificationsSchema |  | User Settings schema definition using Zod for validation. |
| src/entities/user/user.settings.schema.ts | user | UserSettingsSchema |  |  |
