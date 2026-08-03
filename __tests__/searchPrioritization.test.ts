import { getFoodItemScore, sortMergedResults } from '../src/components/FoodSearchModal';
import { FoodItem } from '../src/types';

describe('Multi-Source Search Prioritization Engine', () => {
  const customItem: FoodItem = {
    id: 'custom_1',
    name: 'Poulet grillé maison',
    brand: 'Custom',
    servingSizeG: 100,
    calories100g: 165,
    proteins100g: 31,
    carbs100g: 0,
    fats100g: 3.6,
    source: 'MANUAL',
    createdAt: Date.now(),
    isAdded: true,
  };

  const addedOffItem: FoodItem = {
    id: 'off_added_10',
    name: 'Chicken Breast Saved',
    brand: 'Local Memory',
    servingSizeG: 100,
    calories100g: 155,
    proteins100g: 30,
    carbs100g: 0,
    fats100g: 2.5,
    source: 'OFF_API',
    createdAt: Date.now(),
    isAdded: true,
  };

  const ciqualItem: FoodItem = {
    id: 'ciqual_200',
    name: 'Poulet, blanc, cuit',
    brand: 'CIQUAL',
    servingSizeG: 100,
    calories100g: 160,
    proteins100g: 29.8,
    carbs100g: 0,
    fats100g: 3.2,
    source: 'CIQUAL',
    createdAt: 0,
  };

  const swissItem: FoodItem = {
    id: 'swiss_300',
    name: 'Chicken breast, raw',
    brand: 'Swiss DB',
    servingSizeG: 100,
    calories100g: 110,
    proteins100g: 23,
    carbs100g: 0,
    fats100g: 1.5,
    source: 'SWISS',
    createdAt: 0,
  };

  const fineliItem: FoodItem = {
    id: 'fineli_350',
    name: 'Chicken breast, grilled',
    brand: 'Fineli (FI/EN)',
    servingSizeG: 100,
    calories100g: 140,
    proteins100g: 27,
    carbs100g: 0,
    fats100g: 2.5,
    source: 'FINELI',
    createdAt: 0,
  };

  const offItem: FoodItem = {
    id: 'off_400',
    name: 'Chicken breast fillet',
    brand: 'Supermarket Brand',
    servingSizeG: 100,
    calories100g: 150,
    proteins100g: 25,
    carbs100g: 0,
    fats100g: 2,
    source: 'OFF_API',
    createdAt: 0,
  };

  it('should promote foods added to local memory to the top of the search results list', () => {
    const addedScore = getFoodItemScore(addedOffItem, 'chicken', 'en', 'fr');
    const offScore = getFoodItemScore(offItem, 'chicken', 'en', 'fr');
    const swissScore = getFoodItemScore(swissItem, 'chicken', 'en', 'fr');

    expect(addedScore).toBeGreaterThan(offScore);
    expect(addedScore).toBeGreaterThan(swissScore);
  });

  it('should rank Open Food Facts API results as top priority among external databases', () => {
    const offScore = getFoodItemScore(offItem, 'chicken', 'en', 'us');
    const swissScore = getFoodItemScore(swissItem, 'chicken', 'en', 'us');
    const fineliScore = getFoodItemScore(fineliItem, 'chicken', 'en', 'us');

    expect(offScore).toBeGreaterThan(swissScore);
    expect(offScore).toBeGreaterThan(fineliScore);
  });

  it('should sort reference databases by location relevance (country match)', () => {
    const swissScoreCH = getFoodItemScore(swissItem, 'chicken', 'en', 'ch');
    const ciqualScoreCH = getFoodItemScore(ciqualItem, 'chicken', 'en', 'ch');
    const fineliScoreCH = getFoodItemScore(fineliItem, 'chicken', 'en', 'ch');

    // For Switzerland (ch), Swiss DB gets country match boost
    expect(swissScoreCH).toBeGreaterThan(ciqualScoreCH);
    expect(swissScoreCH).toBeGreaterThan(fineliScoreCH);

    const ciqualScoreFR = getFoodItemScore(ciqualItem, 'poulet', 'fr', 'fr');
    const swissScoreFR = getFoodItemScore(swissItem, 'poulet', 'fr', 'fr');

    // For France (fr), CIQUAL DB gets country match boost
    expect(ciqualScoreFR).toBeGreaterThan(swissScoreFR);
  });

  it('should sort merged results array prioritizing added foods, OFF API, and location relevance', () => {
    const items = [fineliItem, swissItem, ciqualItem, offItem, addedOffItem];
    const sorted = sortMergedResults(items, 'chicken', 'en', 'ch');

    // 1st: Added item in local memory (addedOffItem)
    expect(sorted[0].id).toBe('off_added_10');
    // 2nd: OFF API external item (offItem)
    expect(sorted[1].id).toBe('off_400');
    // 3rd: Swiss DB (due to country 'ch' boost)
    expect(sorted[2].id).toBe('swiss_300');
  });

  it('should boost Fineli when device country is Finland (fi)', () => {
    const fineliScoreFI = getFoodItemScore(fineliItem, 'chicken', 'fi', 'fi');
    const fineliScoreUS = getFoodItemScore(fineliItem, 'chicken', 'en', 'us');

    expect(fineliScoreFI).toBeGreaterThan(fineliScoreUS);
  });

  it("should prioritize specific multi-word matches like 'pain de mie harry\\'s' over partial matches like 'pain de campagne'", () => {
    const harryItem: FoodItem = {
      id: 'off_harrys',
      name: 'Pain de mie Harrys extra moelleux',
      brand: 'Harrys',
      servingSizeG: 100,
      calories100g: 270,
      proteins100g: 8.5,
      carbs100g: 48,
      fats100g: 4.5,
      source: 'OFF_API',
      createdAt: 0,
    };

    const genericPainCampagne: FoodItem = {
      id: 'off_campagne',
      name: 'Pain de Campagne',
      brand: 'Carrefour',
      servingSizeG: 100,
      calories100g: 250,
      proteins100g: 8,
      carbs100g: 50,
      fats100g: 1.5,
      source: 'OFF_API',
      createdAt: 0,
    };

    const harryScore = getFoodItemScore(harryItem, "pain de mie harry's", 'fr', 'fr');
    const genericScore = getFoodItemScore(genericPainCampagne, "pain de mie harry's", 'fr', 'fr');

    expect(harryScore).toBeGreaterThan(genericScore);
  });
});

