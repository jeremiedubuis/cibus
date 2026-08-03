import { FoodItem } from '../types';
import rawCiqualData from '../data/ciqual_foods.json';

export interface CiqualFoodRaw {
  id: string;
  code: string;
  name: string;
  nameEn?: string;
  servingSizeG: number;
  calories100g: number;
  proteins100g: number;
  carbs100g: number;
  fats100g: number;
  fiber100g?: number;
  sodiumMg100g?: number;
  source: 'CIQUAL';
}

const ciqualFoods: FoodItem[] = (rawCiqualData as CiqualFoodRaw[]).map((item) => ({
  id: item.id,
  name: item.name,
  brand: 'CIQUAL',
  servingSizeG: item.servingSizeG || 100,
  calories100g: item.calories100g,
  proteins100g: item.proteins100g,
  carbs100g: item.carbs100g,
  fats100g: item.fats100g,
  fiber100g: item.fiber100g,
  sodiumMg100g: item.sodiumMg100g,
  source: 'CIQUAL',
  createdAt: 0,
}));

/**
  * Removes accents and converts to lowercase for tolerant text matching
 */
export function normalizeText(str: string): string {
  if (!str) return '';
  return str
    .toLowerCase()
    .replace(/œ/g, 'oe')
    .replace(/æ/g, 'ae')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

/**
 * Searches the offline CIQUAL dataset for matching food items
 */
export function searchCiqualFoods(query: string, limit = 30): FoodItem[] {
  const normQuery = normalizeText(query);
  if (!normQuery || normQuery.length < 2) {
    return [];
  }

  const queryWords = normQuery.split(/\s+/).filter(Boolean);

  const scoredResults: { item: FoodItem; score: number }[] = [];

  for (const item of ciqualFoods) {
    const normName = normalizeText(item.name);
    const normNameEn = item.brand === 'CIQUAL' && rawCiqualData ? normalizeText((item as any).nameEn || '') : '';

    let score = 0;

    // Direct string match checks on French name
    if (normName === normQuery) {
      score += 100;
    } else if (normName.startsWith(normQuery + ' ') || normName.startsWith(normQuery + ',')) {
      score += 80;
    } else if (normName.startsWith(normQuery)) {
      score += 65;
    } else if (normName.includes(normQuery)) {
      score += 45;
    }

    // Word coverage matching (e.g. "poulet blanc" matching "Poulet, blanc, cuit")
    let allWordsMatch = true;
    let wordScore = 0;

    for (const word of queryWords) {
      if (normName.includes(word)) {
        wordScore += 15;
      } else if (normNameEn.includes(word)) {
        wordScore += 10;
      } else {
        allWordsMatch = false;
      }
    }

    if (allWordsMatch) {
      score += wordScore + 25;
    } else if (wordScore > 0) {
      score += wordScore;
    }

    if (score > 0) {
      // Conciseness bonus: concise titles matching query are prioritized over 100-word titles
      const concisenessRatio = Math.min(1, normQuery.length / Math.max(normName.length, 1));
      score += Math.round(concisenessRatio * 20);

      scoredResults.push({ item, score });
    }
  }

  scoredResults.sort((a, b) => b.score - a.score);

  return scoredResults.slice(0, limit).map((r) => r.item);
}

/**
 * Retrieves a single CIQUAL food item by its ID
 */
export function getCiqualFoodById(id: string): FoodItem | undefined {
  return ciqualFoods.find((f) => f.id === id);
}

/**
 * Helper to retrieve total CIQUAL items count
 */
export function getCiqualFoodsCount(): number {
  return ciqualFoods.length;
}
