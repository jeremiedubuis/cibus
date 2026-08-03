import {
  searchFineliFoods,
  getFineliFoodById,
  getFineliFoodsCount,
} from '../src/services/fineliService';

describe('Fineli Food Database Service', () => {
  it('should load all 4238 bundled Fineli food items', () => {
    const totalCount = getFineliFoodsCount();
    expect(totalCount).toBe(4238);
  });

  it('should find Fineli food items by English query', () => {
    const results = searchFineliFoods('honey');
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].source).toBe('FINELI');
    expect(results[0].name.toLowerCase()).toContain('honey');
  });

  it('should retrieve a specific food item by its Fineli ID', () => {
    const item = getFineliFoodById('fineli_1');
    expect(item).toBeDefined();
    expect(item?.name).toBe('SUGAR');
    expect(item?.calories100g).toBeCloseTo(405.9, 1);
    expect(item?.source).toBe('FINELI');
  });

  it('should return empty array for empty or single-character queries', () => {
    expect(searchFineliFoods('')).toEqual([]);
    expect(searchFineliFoods('z')).toEqual([]);
  });
});
