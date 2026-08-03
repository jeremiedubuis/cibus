import {
  searchCiqualFoods,
  getCiqualFoodById,
  getCiqualFoodsCount,
  normalizeText,
} from '../src/services/ciqualService';

describe('CIQUAL Nutrition Database Service', () => {
  it('should load all 3484 bundled CIQUAL food items', () => {
    const totalCount = getCiqualFoodsCount();
    expect(totalCount).toBe(3484);
  });

  it('should normalize text by stripping accents and converting to lowercase', () => {
    expect(normalizeText('Bœuf, rôti')).toBe('boeuf, roti');
    expect(normalizeText('Épinard, cuit')).toBe('epinard, cuit');
  });

  it('should find French food items by search query', () => {
    const results = searchCiqualFoods('poulet');
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].source).toBe('CIQUAL');
    expect(results[0].name.toLowerCase()).toContain('poulet');
  });

  it('should handle accent-insensitive search queries', () => {
    const resultsAccented = searchCiqualFoods('boeuf');
    expect(resultsAccented.length).toBeGreaterThan(0);
    expect(resultsAccented.some((f) => normalizeText(f.name).includes('boeuf'))).toBe(true);
  });

  it('should retrieve a specific food item by its CIQUAL ID', () => {
    const item = getCiqualFoodById('ciqual_1000');
    expect(item).toBeDefined();
    expect(item?.name).toBe('Pastis');
    expect(item?.calories100g).toBe(274);
    expect(item?.source).toBe('CIQUAL');
  });

  it('should return empty array for invalid or short queries', () => {
    expect(searchCiqualFoods('')).toEqual([]);
    expect(searchCiqualFoods('a')).toEqual([]);
  });
});
