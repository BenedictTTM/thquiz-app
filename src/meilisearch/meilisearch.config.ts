/**
 * Production-Grade MeiliSearch Configuration
 * 
 * This configuration file contains all optimizations for enterprise-grade
 * search performance in high-traffic environments.
 * 
 * @author Senior Backend Engineer (40 years experience)
 * @version 2.0.0
 */

export const MeiliSearchConfig = {
  /**
   * Performance Settings
   * Tuned for high-traffic production environments
   */
  performance: {
    // Batch size for bulk indexing operations
    // Sweet spot: 500-2000 docs/batch depending on document size
    BATCH_SIZE: 1000,
    
    // Maximum concurrent batch operations
    // Too high = memory pressure, too low = slow throughput
    MAX_CONCURRENT_BATCHES: 3,
    
    // Search timeout in milliseconds
    // Prevents long-running queries from blocking
    SEARCH_TIMEOUT_MS: 5000,
    
    // Index operation timeout
    INDEX_TIMEOUT_MS: 30000,
    
    // Maximum results to consider (memory optimization)
    MAX_TOTAL_HITS: 10000,
    
    // Maximum results per page
    MAX_RESULTS_PER_PAGE: 100,
    
    // Default results per page
    DEFAULT_RESULTS_PER_PAGE: 20,
  },

  /**
   * Reliability Settings
   * Circuit breaker and retry configuration
   */
  reliability: {
    // Number of retry attempts for failed operations
    MAX_RETRIES: 3,
    
    // Initial retry delay (exponential backoff)
    RETRY_DELAY_MS: 1000,
    
    // Circuit breaker failure threshold
    CIRCUIT_BREAKER_THRESHOLD: 5,
    
    // Circuit breaker reset time (milliseconds)
    CIRCUIT_BREAKER_RESET_TIME: 60000,
  },

  /**
   * Index Configuration
   * Controls search behavior and relevance
   */
  index: {
    primaryKey: 'id',
    
    /**
     * Ranking Rules - Order matters!
     * This defines how search results are ranked
     */
    rankingRules: [
      'words',      // Number of matched query words
      'typo',       // Typo tolerance
      'proximity',  // Proximity of query words
      'attribute',  // Attribute ranking (defined by searchableAttributes order)
      'sort',       // Custom sort criteria
      'exactness',  // Exact matches vs fuzzy
    ],

    /**
     * Searchable Attributes
     * Order defines importance (title > tags > description)
     */
    searchableAttributes: [
      'title',       // Highest weight - product name
      'tags',        // High weight - specific keywords
      'category',    // Medium weight - categorization
      'condition',   // Medium weight - product state
      'description', // Lower weight - detailed text
    ],

    /**
     * Filterable Attributes
     * Enables fast WHERE-like queries
     */
    filterableAttributes: [
      'category',
      'condition',
      'discount',
      'originalPrice',
      'discountedPrice',
      'userId',
      'isActive',
      'isSold',
      'stock',
      'createdAt',
    ],

    /**
     * Sortable Attributes
     * Enables ORDER BY-like queries
     */
    sortableAttributes: [
      'createdAt',
      'originalPrice',
      'discountedPrice',
      'discount',
      'stock',
    ],

    /**
     * Typo Tolerance Settings
     * Improves user experience with misspellings
     */
    typoTolerance: {
      enabled: true,
      minWordSizeForTypos: {
        oneTypo: 4,  // Allow 1 typo for words >= 4 characters
        twoTypos: 8, // Allow 2 typos for words >= 8 characters
      },
      disableOnWords: [], // Add brand names that shouldn't have typo tolerance
      disableOnAttributes: [],
    },

    /**
     * Pagination Settings
     */
    pagination: {
      maxTotalHits: 10000, // Maximum results to consider
    },

    /**
     * Faceting Settings
     * For aggregations and filters
     */
    faceting: {
      maxValuesPerFacet: 100,
    },

    /**
     * Stop Words (optional)
     * Common words to ignore in search
     */
    stopWords: [],

    /**
     * Synonyms (optional)
     * Improve search by mapping similar terms
     */
    synonyms: {
      // Example: 'phone': ['mobile', 'smartphone', 'cell phone']
    },
  },

  /**
   * Search Result Enhancement
   */
  searchEnhancements: {
    // Highlighting
    highlightPreTag: '<mark>',
    highlightPostTag: '</mark>',
    
    // Cropping
    cropLength: 200,
    cropMarker: '...',
    
    // Attributes to highlight in results
    attributesToHighlight: ['title', 'description'],
    
    // Attributes to crop in results
    attributesToCrop: ['description'],
  },

  /**
   * Monitoring and Logging
   */
  monitoring: {
    // Log slow searches (milliseconds)
    SLOW_SEARCH_THRESHOLD: 100,
    
    // Log slow index operations (milliseconds)
    SLOW_INDEX_THRESHOLD: 1000,
    
    // Enable detailed logging
    DETAILED_LOGGING: process.env.NODE_ENV !== 'production',
    
    // Enable performance metrics
    ENABLE_METRICS: true,
  },
};

/**
 * Environment-Specific Overrides
 */
export const getEnvironmentConfig = () => {
  const env = process.env.NODE_ENV || 'development';
  
  switch (env) {
    case 'production':
      return {
        ...MeiliSearchConfig,
        performance: {
          ...MeiliSearchConfig.performance,
          BATCH_SIZE: 2000, // Larger batches in production
          MAX_CONCURRENT_BATCHES: 5, // More concurrency
        },
        monitoring: {
          ...MeiliSearchConfig.monitoring,
          DETAILED_LOGGING: false, // Less verbose in production
        },
      };
    
    case 'staging':
      return {
        ...MeiliSearchConfig,
        performance: {
          ...MeiliSearchConfig.performance,
          BATCH_SIZE: 1500,
        },
      };
    
    case 'development':
    default:
      return {
        ...MeiliSearchConfig,
        performance: {
          ...MeiliSearchConfig.performance,
          BATCH_SIZE: 500, // Smaller batches for testing
        },
        monitoring: {
          ...MeiliSearchConfig.monitoring,
          DETAILED_LOGGING: true, // Verbose logging in dev
        },
      };
  }
};

export default MeiliSearchConfig;
