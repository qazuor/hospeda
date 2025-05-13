-- migrations/triggers/20250513_create_search_index_gin.sql

CREATE INDEX IF NOT EXISTS idx_search_index_tsv
  ON search_index
  USING GIN(tsv);
