import { NativeModules, Platform } from 'react-native';
import { FoodItem } from '../types';

const OFF_BASE_URL = 'https://world.openfoodfacts.org';

export interface OFFProductResponse {
  status: number;
  product?: {
    _id: string;
    code?: string;
    product_name?: string;
    product_name_en?: string;
    brands?: string;
    nutriments?: {
      'energy-kcal_100g'?: number;
      'energy-kcal'?: number;
      proteins_100g?: number;
      carbohydrates_100g?: number;
      fat_100g?: number;
      fiber_100g?: number;
      sodium_100g?: number;
    };
  };
}

export interface OFFSearchResponse {
  count: number;
  hits?: Array<{
    _id?: string;
    code?: string;
    product_name?: string;
    brands?: string | string[];
    nutriments?: {
      'energy-kcal_100g'?: number;
      proteins_100g?: number;
      carbohydrates_100g?: number;
      fat_100g?: number;
      fiber_100g?: number;
      sodium_100g?: number;
    };
  }>;
  products?: Array<{
    _id?: string;
    code?: string;
    product_name?: string;
    brands?: string | string[];
    nutriments?: {
      'energy-kcal_100g'?: number;
      proteins_100g?: number;
      carbohydrates_100g?: number;
      fat_100g?: number;
      fiber_100g?: number;
      sodium_100g?: number;
    };
  }>;
}

/**
 * Retrieves the device's preferred language and country code for regional API queries
 */
export function getDeviceLocaleInfo(): { language: string; country: string } {
  let language = 'en';
  let country = 'us';

  try {
    const ExpoLocalization = require('expo-localization');
    const locales = ExpoLocalization.getLocales?.();
    if (locales && locales.length > 0) {
      if (locales[0]?.languageCode) {
        language = locales[0].languageCode.toLowerCase();
      }
      if (locales[0]?.regionCode) {
        country = locales[0].regionCode.toLowerCase();
      } else if (locales[0]?.countryCode) {
        country = locales[0].countryCode.toLowerCase();
      }
    }
  } catch (e) {
    // Fallback if ExpoLocalization module is not present
  }

  try {
    const intlLocale = Intl?.DateTimeFormat?.().resolvedOptions?.().locale;
    if (intlLocale) {
      const parts = intlLocale.replace('_', '-').split('-');
      if (parts[0] && language === 'en') language = parts[0].toLowerCase();
      if (parts[1] && country === 'us') country = parts[1].toLowerCase();
    }
  } catch (e) {
    // Intl fallback failed
  }

  try {
    const nativeLocale =
      Platform.OS === 'ios'
        ? NativeModules.SettingsManager?.settings?.AppleLocale ||
          NativeModules.SettingsManager?.settings?.AppleLanguages?.[0]
        : NativeModules.I18nManager?.localeIdentifier;
    if (nativeLocale) {
      const parts = nativeLocale.replace('_', '-').split('-');
      if (parts[0] && language === 'en') language = parts[0].toLowerCase();
      if (parts[1] && country === 'us') country = parts[1].toLowerCase();
    }
  } catch (e) {
    // NativeModules fallback failed
  }

  if (language === 'fr' && country === 'us') {
    country = 'fr';
  } else if (language === 'de' && country === 'us') {
    country = 'de';
  } else if (language === 'es' && country === 'us') {
    country = 'es';
  } else if (language === 'it' && country === 'us') {
    country = 'it';
  }

  return { language, country };
}

/**
 * Transforms OFF product data to standard FoodItem interface
 */
export function transformOFFProduct(product: any, language?: string): FoodItem {
  const nutriments = product.nutriments || {};

  const calories =
    nutriments['energy-kcal_100g'] ?? nutriments['energy-kcal_value'] ?? nutriments['energy-kcal'] ?? 0;

  const langKey = language ? `product_name_${language.toLowerCase()}` : undefined;
  const langProductName = langKey ? product[langKey] : undefined;
  const productName = langProductName || product.product_name || product.product_name_en || 'Unknown Food Product';

  const rawServingSize = product.serving_size || product.serving_quantity_unit || '';
  const rawServingQty = parseFloat(product.serving_quantity);
  const servingSizeG = !isNaN(rawServingQty) && rawServingQty > 0 ? Math.round(rawServingQty) : 100;

  const brandName = Array.isArray(product.brands)
    ? product.brands.join(', ')
    : typeof product.brands === 'string' && product.brands.trim() !== ''
    ? product.brands.trim()
    : 'Generic';

  return {
    id: product._id || product.code || `off_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    barcode: product.code,
    name: productName,
    brand: brandName,
    servingSizeG,
    servingName: rawServingSize || undefined,
    calories100g: Math.round(Number(calories) || 0),
    proteins100g: Math.round(Number(nutriments.proteins_100g || 0) * 10) / 10,
    carbs100g: Math.round(Number(nutriments.carbohydrates_100g || 0) * 10) / 10,
    fats100g: Math.round(Number(nutriments.fat_100g || 0) * 10) / 10,
    fiber100g: Math.round(Number(nutriments.fiber_100g || 0) * 10) / 10,
    sodiumMg100g: Math.round(Number(nutriments.sodium_100g || 0) * 1000),
    source: 'OFF_API',
    createdAt: Date.now(),
  };
}

const barcodeCache = new Map<string, FoodItem | null>();
const OFF_USER_AGENT = 'CibusAI-NutritionTracker/1.0 (Mobile App; dev@cibus.ai)';

/**
 * Fetch product details from Open Food Facts API by barcode
 */
export async function fetchProductByBarcode(barcode: string): Promise<FoodItem | null> {
  const code = barcode.trim();
  if (!code) return null;
  if (barcodeCache.has(code)) {
    return barcodeCache.get(code) || null;
  }

  try {
    const response = await fetch(`${OFF_BASE_URL}/api/v2/product/${encodeURIComponent(code)}.json`, {
      headers: {
        'User-Agent': OFF_USER_AGENT,
      },
    });

    if (!response.ok) {
      barcodeCache.set(code, null);
      return null;
    }

    const data: OFFProductResponse = await response.json();
    if (data.status === 1 && data.product) {
      const item = transformOFFProduct(data.product);
      barcodeCache.set(code, item);
      return item;
    }
    barcodeCache.set(code, null);
    return null;
  } catch (error) {
    console.warn('Open Food Facts barcode lookup error:', error);
    return null;
  }
}

const STOP_WORDS = new Set([
  'de', 'd', 'l', 'la', 'le', 'du', 'des', 'un', 'une', 'au', 'aux', 'et', 'en',
  'of', 'and', 'the', 'in', 'with', 'a', 'to', 'for'
]);

function normalizeSearchText(str: string): string {
  return (str || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[''’"\-.,\/#!$%\^&\*;:{}=\-_`~()]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Prioritizes products based on title search query relevance and regional/locale match
 */
function sortProductsByRegion(
  items: FoodItem[],
  rawProducts: any[],
  query: string,
  targetCountry: string,
  targetLang: string
): FoodItem[] {
  const rawMap = new Map<string, any>();
  rawProducts.forEach((p) => {
    const id = p._id || p.code;
    if (id) rawMap.set(id, p);
  });

  return [...items].sort((a, b) => {
    const rawA = rawMap.get(a.id);
    const rawB = rawMap.get(b.id);

    const scoreA = getProductScore(a, rawA, query, targetCountry, targetLang);
    const scoreB = getProductScore(b, rawB, query, targetCountry, targetLang);

    return scoreB - scoreA;
  });
}

function getProductScore(
  item: FoodItem,
  rawProduct: any,
  query: string,
  targetCountry: string,
  targetLang: string
): number {
  let score = 0;

  const normQ = normalizeSearchText(query);
  const normName = normalizeSearchText(item.name);
  const normBrand = normalizeSearchText(item.brand || '');
  const normFullName = `${normName} ${normBrand}`.trim();

  const allQWords = normQ.split(/\s+/).filter(Boolean);
  const contentQWords = allQWords.filter((w) => !STOP_WORDS.has(w));
  const effectiveWords = contentQWords.length > 0 ? contentQWords : allQWords;

  // 1. Title/Name & Brand Relevance (highest priority)
  if (normName === normQ || normFullName === normQ) {
    score += 120; // Exact match
  } else if (normName.startsWith(normQ + ' ') || normName.startsWith(normQ + 's ') || normName.startsWith(normQ + ',')) {
    score += 90; // Title starts with word match
  } else if (normName.startsWith(normQ)) {
    score += 70; // Title starts with query substring
  } else if (normName.includes(` ${normQ} `) || normName.includes(` ${normQ}`) || normName.endsWith(` ${normQ}`)) {
    score += 35; // Word appears inside title
  } else if (normName.includes(normQ) || normFullName.includes(normQ)) {
    score += 25; // Substring inside title or full name
  }

  // 2. Word Token & Content Coverage
  const matchedAllCount = allQWords.filter((w) => normFullName.includes(w)).length;
  const matchedContentCount = effectiveWords.filter((w) => normFullName.includes(w)).length;

  const allRatio = allQWords.length > 0 ? matchedAllCount / allQWords.length : 0;
  const contentRatio = effectiveWords.length > 0 ? matchedContentCount / effectiveWords.length : 0;
  const brandMatchesAnyWord = effectiveWords.some((w) => normBrand.includes(w));

  if (allRatio === 1) {
    score += 70; // 100% of all query words match
    if (brandMatchesAnyWord) score += 25;
  } else if (contentRatio === 1) {
    score += 55; // 100% of key content words match (e.g. "pain", "mie", "harrys")
    if (brandMatchesAnyWord) score += 20;
  } else if (contentRatio >= 0.5) {
    score += Math.round(contentRatio * 35);
  } else if (matchedContentCount > 0) {
    score += 10;
  } else {
    score -= 40;
  }

  // 2. Title Conciseness Bonus
  if (normName.includes(normQ) || normFullName.includes(normQ)) {
    const lengthRatio = Math.min(1, normQ.length / Math.max(normName.length, 1));
    score += Math.round(lengthRatio * 40);
  }

  // 3. Category & Food Type Bonuses / Penalties
  if (rawProduct && rawProduct.categories_tags) {
    const cats = JSON.stringify(rawProduct.categories_tags).toLowerCase();
    if (
      cats.includes('tomatoes') ||
      cats.includes('fresh-foods') ||
      cats.includes('vegetables') ||
      cats.includes('canned-tomatoes') ||
      cats.includes('tomato-sauces') ||
      cats.includes('skyrs') ||
      cats.includes('yogurts')
    ) {
      score += 30; // Category relevance bonus for raw/pure foods
    }

    if (
      cats.includes('chips') ||
      cats.includes('snacks') ||
      cats.includes('biscuits') ||
      cats.includes('galettes')
    ) {
      score -= 30; // Penalty for snack/chips/galettes where flavor is secondary
    }
  }

  // 4. Foreign Language Title Penalty
  if (targetLang === 'fr') {
    const firstWord = normName.split(' ')[0];
    const spanishWords = ['atun', 'salsa', 'pan', 'galletas', 'queso', 'ensalada'];
    if (spanishWords.includes(firstWord)) {
      score -= 35; // Penalty for non-target language title (e.g. "Atún con tomate")
    }
  }

  // 5. Brand match bonus
  if (normBrand && (normBrand.includes(normQ) || effectiveWords.some((w) => normBrand.includes(w)))) {
    score += 15;
  }

  // 6. Regional / Language match
  if (rawProduct) {
    const countriesStr = JSON.stringify(
      rawProduct.countries_tags || rawProduct.countries_hierarchy || rawProduct.countries || ''
    ).toLowerCase();
    const langStr = JSON.stringify(
      rawProduct.languages_tags || rawProduct.languages_hierarchy || rawProduct.languages || rawProduct.lang || ''
    ).toLowerCase();

    if (targetCountry && targetCountry !== 'world' && countriesStr.includes(targetCountry)) {
      score += 15;
    }

    if (targetLang && (langStr.includes(targetLang) || rawProduct[`product_name_${targetLang}`])) {
      score += 10;
    }
  }

  return score;
}

const searchCache = new Map<string, FoodItem[]>();

/**
 * Clear in-memory search cache (useful for testing)
 */
export function clearOFFSearchCache(): void {
  searchCache.clear();
  barcodeCache.clear();
}

/**
 * Search products by query term on Open Food Facts API, prioritizing regional/locale results
 */
export async function searchProductsOFF(
  query: string,
  country?: string,
  language?: string
): Promise<FoodItem[]> {
  const q = query.trim();
  if (!q) return [];

  const localeInfo = getDeviceLocaleInfo();
  const targetLang = (language || localeInfo.language || 'en').toLowerCase();
  const targetCountry = (country || localeInfo.country || 'world').toLowerCase();

  const cacheKey = `${q.toLowerCase()}_${targetCountry}_${targetLang}`;
  if (searchCache.has(cacheKey)) {
    return searchCache.get(cacheKey)!;
  }

  try {
    // Primary: Modern high-performance Search API endpoint
    const primaryUrl = `https://search.openfoodfacts.org/search?q=${encodeURIComponent(
      q
    )}&fields=code,product_name,brands,nutriments,product_name_en,product_name_${targetLang},countries_tags,languages_tags,serving_size,serving_quantity,serving_quantity_unit&page_size=25&lc=${encodeURIComponent(
      targetLang
    )}&cc=${encodeURIComponent(targetCountry)}`;

    const response = await fetch(primaryUrl, {
      headers: {
        'User-Agent': OFF_USER_AGENT,
      },
    });

    let data: OFFSearchResponse | null = null;

    if (response.ok) {
      try {
        const text = typeof response.text === 'function' ? await response.text() : JSON.stringify(await response.json());
        if (text && text.trim().startsWith('{')) {
          data = JSON.parse(text);
        }
      } catch (e) {
        // Ignore JSON parse error on non-JSON response
      }
    }

    // If primary endpoint failed or returned empty/non-JSON, try fallback endpoint
    if (!data || (!data.hits && !data.products)) {
      const fallbackUrl = `https://world.openfoodfacts.org/api/v2/search?q=${encodeURIComponent(
        q
      )}&fields=code,product_name,brands,nutriments,product_name_en,product_name_${targetLang},countries_tags,languages_tags&page_size=20&lc=${encodeURIComponent(
        targetLang
      )}&cc=${encodeURIComponent(targetCountry)}`;

      const fallbackRes = await fetch(fallbackUrl, {
        headers: {
          'User-Agent': OFF_USER_AGENT,
        },
      });

      if (fallbackRes.ok) {
        try {
          const fbText = typeof fallbackRes.text === 'function' ? await fallbackRes.text() : JSON.stringify(await fallbackRes.json());
          if (fbText && fbText.trim().startsWith('{')) {
            data = JSON.parse(fbText);
          }
        } catch (e) {
          // Ignore
        }
      }
    }

    const rawProducts: any[] = (data && (data.hits || data.products)) || [];

    if (Array.isArray(rawProducts) && rawProducts.length > 0) {
      const validProducts = rawProducts.filter(
        (p) => (p.product_name || (p as any)[`product_name_${targetLang}`]) && p.nutriments
      );

      const transformed = validProducts.map((p) => transformOFFProduct(p, targetLang));
      const sorted = sortProductsByRegion(transformed, rawProducts, q, targetCountry, targetLang);

      if (sorted.length > 0) {
        searchCache.set(cacheKey, sorted);
      }
      return sorted;
    }

    return [];
  } catch (error) {
    console.warn('Open Food Facts product search error:', error);
    return [];
  }
}



