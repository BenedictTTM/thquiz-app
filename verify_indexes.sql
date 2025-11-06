-- Verify performance indexes exist
SELECT tablename,
    indexname,
    indexdef
FROM pg_indexes
WHERE schemaname = 'public'
    AND tablename IN ('Product', 'User')
ORDER BY tablename,
    indexname;