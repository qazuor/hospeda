-- =============================================================================
-- Hospeda Database Initialization Script
-- =============================================================================
-- This script runs automatically when PostgreSQL container starts for the first time

-- Create additional databases for testing
CREATE DATABASE hospeda_test;

-- Grant all privileges to hospeda_user on both databases
GRANT ALL PRIVILEGES ON DATABASE hospeda_dev TO hospeda_user;
GRANT ALL PRIVILEGES ON DATABASE hospeda_test TO hospeda_user;

-- Connect to hospeda_dev to set up extensions
\c hospeda_dev;

-- Enable commonly used PostgreSQL extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "unaccent";

-- Create schemas if needed (optional)
-- CREATE SCHEMA IF NOT EXISTS auth;
-- CREATE SCHEMA IF NOT EXISTS public;

-- Grant schema permissions
GRANT ALL ON SCHEMA public TO hospeda_user;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO hospeda_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO hospeda_user;

-- Connect to test database and set up the same extensions
\c hospeda_test;

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "unaccent";

GRANT ALL ON SCHEMA public TO hospeda_user;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO hospeda_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO hospeda_user;

-- Log completion
SELECT 'Database initialization completed successfully!' as status;
