export * from './post.operations.schema.js'; // CRUD and operational schemas
export * from './post.schema.js'; // Main entity schema
// REMOVED: Legacy schemas that used obsolete PostSchema
// - post.requests.schema.js (used PostSchema)
// - post.responses.schema.js (used PostSchema)
// - post.service.schema.js (used PostSchema)
// export * from './post.schema.js'; // REMOVED: Legacy schema replaced by post.flat.schema.js
// REMOVED: Type exports from deleted post.service.schema.js
// These types are no longer available after cleanup
export * from './post.sponsor.schema.js';
export * from './post.sponsorship.schema.js';
