/**
 * Product Category Enumeration
 * 
 * Enterprise-grade category definition following domain-driven design principles.
 * This enum ensures type safety and prevents invalid category values.
 * 
 * @enum {string}
 * @description Supported product categories in the e-commerce platform
 */
export enum ProductCategory {
  CLOTHES = 'clothes',
  ACCESSORIES = 'accessories',
  HOME = 'home',
  BOOKS = 'books',
  SPORTS_AND_OUTING = 'sports_and_outing',
  OTHERS = 'others',
}

/**
 * Category metadata for enhanced UX and SEO
 * Following the Open/Closed Principle - open for extension, closed for modification
 */
export interface CategoryMetadata {
  key: ProductCategory;
  label: string;
  description: string;
  icon?: string;
  seoKeywords: string[];
  popularTags: string[];
}

/**
 * Category configuration with metadata
 * Single source of truth for all category-related information
 */
export const CATEGORY_METADATA: Record<ProductCategory, CategoryMetadata> = {
  [ProductCategory.CLOTHES]: {
    key: ProductCategory.CLOTHES,
    label: 'Clothes & Fashion',
    description: 'Clothing, apparel, and fashion items',
    icon: 'shirt',
    seoKeywords: ['fashion', 'clothing', 'apparel', 'wear', 'outfit'],
    popularTags: ['men', 'women', 'casual', 'formal', 'vintage'],
  },
  [ProductCategory.ACCESSORIES]: {
    key: ProductCategory.ACCESSORIES,
    label: 'Accessories',
    description: 'Fashion accessories, jewelry, bags, and more',
    icon: 'watch',
    seoKeywords: ['accessories', 'jewelry', 'bags', 'watches', 'sunglasses'],
    popularTags: ['jewelry', 'bags', 'watches', 'belts', 'scarves'],
  },
  [ProductCategory.HOME]: {
    key: ProductCategory.HOME,
    label: 'Home & Living',
    description: 'Home decor, furniture, and household items',
    icon: 'home',
    seoKeywords: ['home', 'furniture', 'decor', 'household', 'kitchen'],
    popularTags: ['furniture', 'decor', 'kitchen', 'bedding', 'storage'],
  },
  [ProductCategory.BOOKS]: {
    key: ProductCategory.BOOKS,
    label: 'Books & Media',
    description: 'Books, textbooks, magazines, and educational materials',
    icon: 'book',
    seoKeywords: ['books', 'textbooks', 'novels', 'education', 'reading'],
    popularTags: ['textbooks', 'novels', 'academic', 'fiction', 'non-fiction'],
  },
  [ProductCategory.SPORTS_AND_OUTING]: {
    key: ProductCategory.SPORTS_AND_OUTING,
    label: 'Sports & Outdoors',
    description: 'Sports equipment, outdoor gear, and fitness items',
    icon: 'dumbbell',
    seoKeywords: ['sports', 'fitness', 'outdoor', 'camping', 'exercise'],
    popularTags: ['fitness', 'camping', 'hiking', 'sports gear', 'outdoor'],
  },
  [ProductCategory.OTHERS]: {
    key: ProductCategory.OTHERS,
    label: 'Other Items',
    description: 'Miscellaneous items and unique products',
    icon: 'grid',
    seoKeywords: ['miscellaneous', 'other', 'unique', 'various'],
    popularTags: ['unique', 'miscellaneous', 'special'],
  },
};

/**
 * Utility function to validate category
 * @param category - Category string to validate
 * @returns boolean indicating if category is valid
 */
export function isValidCategory(category: string): category is ProductCategory {
  return Object.values(ProductCategory).includes(category as ProductCategory);
}

/**
 * Utility function to get all valid categories
 * @returns Array of all valid category values
 */
export function getAllCategories(): ProductCategory[] {
  return Object.values(ProductCategory);
}

/**
 * Utility function to get category metadata
 * @param category - Category to get metadata for
 * @returns Category metadata or null if invalid
 */
export function getCategoryMetadata(category: ProductCategory): CategoryMetadata | null {
  return CATEGORY_METADATA[category] || null;
}

/**
 * Utility function to normalize category input
 * Handles case-insensitive matching and whitespace
 * @param input - Raw category input
 * @returns Normalized ProductCategory or null
 */
export function normalizeCategoryInput(input: string): ProductCategory | null {
  const normalized = input.toLowerCase().trim().replace(/\s+/g, '_');
  
  if (isValidCategory(normalized)) {
    return normalized as ProductCategory;
  }
  
  return null;
}
