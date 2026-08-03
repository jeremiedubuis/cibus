import {
  getDeviceLocaleInfo,
  transformOFFProduct,
  searchProductsOFF,
  clearOFFSearchCache,
} from '../src/services/offApi';

describe('Open Food Facts API & Regional Prioritization', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    clearOFFSearchCache();
    (global as any).fetch = jest.fn();
  });

  it('should detect device locale info with fallback', () => {
    const localeInfo = getDeviceLocaleInfo();
    expect(localeInfo).toHaveProperty('language');
    expect(localeInfo).toHaveProperty('country');
  });

  it('should transform product and use localized product name if available', () => {
    const rawProduct = {
      _id: '12345',
      code: '12345',
      product_name: 'Generic Apple',
      product_name_fr: 'Pomme Fraîche',
      brands: 'Bio',
      nutriments: {
        'energy-kcal_100g': 52,
        proteins_100g: 0.3,
        carbohydrates_100g: 14,
        fat_100g: 0.2,
      },
    };

    const transformedFr = transformOFFProduct(rawProduct, 'fr');
    expect(transformedFr.name).toBe('Pomme Fraîche');
    expect(transformedFr.calories100g).toBe(52);

    const transformedEn = transformOFFProduct(rawProduct, 'en');
    expect(transformedEn.name).toBe('Generic Apple');
  });

  it('should include regional parameters (lc and cc) in API request URL and prioritize regional results', async () => {
    const mockResponse = {
      count: 2,
      products: [
        {
          _id: 'p1',
          code: '111',
          product_name: 'US Oats',
          countries_tags: ['en:united-states'],
          nutriments: { 'energy-kcal_100g': 389, proteins_100g: 16.9, carbohydrates_100g: 66.3, fat_100g: 6.9 },
        },
        {
          _id: 'p2',
          code: '222',
          product_name: 'Flocons d\'avoine FR',
          product_name_fr: 'Flocons d\'avoine Bio',
          countries_tags: ['en:france'],
          languages_tags: ['en:french'],
          nutriments: { 'energy-kcal_100g': 370, proteins_100g: 13, carbohydrates_100g: 58, fat_100g: 7 },
        },
      ],
    };

    (global as any).fetch.mockResolvedValueOnce({
      ok: true,
      text: async () => JSON.stringify(mockResponse),
      json: async () => mockResponse,
    });

    const results = await searchProductsOFF('avoine', 'fr', 'fr');

    expect(global.fetch).toHaveBeenCalledTimes(1);
    const calledUrl = (global as any).fetch.mock.calls[0][0];

    expect(calledUrl).toContain('openfoodfacts.org');
    expect(calledUrl).toContain('lc=fr');
    expect(calledUrl).toContain('cc=fr');

    // FR item should be prioritized (ranked first)
    expect(results.length).toBe(2);
    expect(results[0].barcode).toBe('222');
    expect(results[0].name).toBe('Flocons d\'avoine Bio');
  });

  it('should cache search results and return cached data instantly when re-typing a query', async () => {
    const mockResponse = {
      count: 1,
      products: [
        {
          _id: 'apple_id',
          code: '999',
          product_name: 'Red Apple',
          nutriments: { 'energy-kcal_100g': 52 },
        },
      ],
    };

    (global as any).fetch.mockResolvedValue({
      ok: true,
      text: async () => JSON.stringify(mockResponse),
      json: async () => mockResponse,
    });

    // First search for "apple"
    const firstResults = await searchProductsOFF('apple', 'us', 'en');
    expect(firstResults.length).toBe(1);
    expect(global.fetch).toHaveBeenCalledTimes(1);

    // Second search for same query "apple" should hit in-memory cache without secondary fetch call
    const cachedResults = await searchProductsOFF('apple', 'us', 'en');
    expect(cachedResults.length).toBe(1);
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('should parse hits array and score multi-word queries matching title and brand across accents', async () => {
    const mockResponse = {
      count: 2,
      hits: [
        {
          _id: 'p_skyr',
          code: '6250382712525',
          product_name: 'Skyr',
          brands: ['Pâturages'],
          nutriments: { 'energy-kcal_100g': 50, proteins_100g: 8.5, carbohydrates_100g: 3.7, fat_100g: 0.5 },
        },
        {
          _id: 'p_other',
          code: '999999',
          product_name: 'Yaourt Nature',
          brands: 'Generic',
          nutriments: { 'energy-kcal_100g': 60, proteins_100g: 4, carbohydrates_100g: 4, fat_100g: 3 },
        },
      ],
    };

    (global as any).fetch.mockResolvedValueOnce({
      ok: true,
      text: async () => JSON.stringify(mockResponse),
      json: async () => mockResponse,
    });

    const results = await searchProductsOFF('skyr paturage', 'fr', 'fr');
    expect(results.length).toBe(2);
    expect(results[0].barcode).toBe('6250382712525');
    expect(results[0].name).toBe('Skyr');
    expect(results[0].brand).toBe('Pâturages');
  });
});


