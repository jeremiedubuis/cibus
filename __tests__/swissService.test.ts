import {
  searchSwissFoods,
  getSwissFoodById,
  getSwissFoodsCount,
} from '../src/services/swissService';

describe('Swiss Food Database Service', () => {
  it('should load all 1246 bundled Swiss food items', () => {
    const totalCount = getSwissFoodsCount();
    expect(totalCount).toBe(1246);
  });

  it('should find Swiss food items by English query', () => {
    const results = searchSwissFoods('almond');
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].source).toBe('SWISS');
    expect(results[0].name.toLowerCase()).toContain('almond');
  });

  it('should retrieve a specific food item by its Swiss ID', () => {
    const item = getSwissFoodById('swiss_10533');
    expect(item).toBeDefined();
    expect(item?.name).toBe('Agar Agar');
    expect(item?.calories100g).toBe(160);
    expect(item?.source).toBe('SWISS');
  });

  it('should return empty array for empty or single-character queries', () => {
    expect(searchSwissFoods('')).toEqual([]);
    expect(searchSwissFoods('x')).toEqual([]);
  });
});
