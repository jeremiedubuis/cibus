import { FoodItem } from '../types';
import rawSwissData from '../data/swiss_foods.json';
import { normalizeText } from './ciqualService';

export interface SwissFoodRaw {
  id: string;
  code: string;
  name: string;
  synonyms?: string;
  category?: string;
  servingSizeG: number;
  calories100g: number;
  proteins100g: number;
  carbs100g: number;
  fats100g: number;
  fiber100g?: number;
  sodiumMg100g?: number;
  source: 'SWISS';
}

const swissFoods: FoodItem[] = (rawSwissData as SwissFoodRaw[]).map((item) => ({
  id: item.id,
  name: item.name,
  brand: item.category ? `Swiss DB (${item.category.split('/')[0]})` : 'Swiss DB',
  servingSizeG: item.servingSizeG || 100,
  calories100g: item.calories100g,
  proteins100g: item.proteins100g,
  carbs100g: item.carbs100g,
  fats100g: item.fats100g,
  fiber100g: item.fiber100g,
  sodiumMg100g: item.sodiumMg100g,
  source: 'SWISS',
  createdAt: 0,
}));

/**
 * Searches the offline Swiss Food Composition Database for matching items
 */
export function searchSwissFoods(query: string, limit = 30): FoodItem[] {
  const normQuery = normalizeText(query);
  if (!normQuery || normQuery.length < 2) {
    return [];
  }

  const queryWords = normQuery.split(/\s+/).filter(Boolean);
  const scoredResults: { item: FoodItem; score: number }[] = [];

  for (let i = 0; i < swissFoods.length; i++) {
    const item = swissFoods[i];
    const rawItem = rawSwissData[i] as SwissFoodRaw;
    const normName = normalizeText(item.name);
    const normSynonyms = normalizeText(rawItem.synonyms || '');
    const normCategory = normalizeText(rawItem.category || '');

    let score = 0;

    // Direct string match checks on Swiss food name
    if (normName === normQuery) {
      score += 100;
    } else if (normName.startsWith(normQuery + ' ') || normName.startsWith(normQuery + ',')) {
      score += 80;
    } else if (normName.startsWith(normQuery)) {
      score += 65;
    } else if (normName.includes(normQuery)) {
      score += 45;
    } else if (normSynonyms.includes(normQuery)) {
      score += 35;
    }

    // Word coverage matching
    let allWordsMatch = true;
    let wordScore = 0;

    for (const word of queryWords) {
      if (normName.includes(word)) {
        wordScore += 15;
      } else if (normSynonyms.includes(word)) {
        wordScore += 10;
      } else if (normCategory.includes(word)) {
        wordScore += 5;
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
      const concisenessRatio = Math.min(1, normQuery.length / Math.max(normName.length, 1));
      score += Math.round(concisenessRatio * 20);

      scoredResults.push({ item, score });
    }
  }

  scoredResults.sort((a, b) => b.score - a.score);

  return scoredResults.slice(0, limit).map((r) => r.item);
}

/**
 * Retrieves a single Swiss food item by its ID
 */
export function getSwissFoodById(id: string): FoodItem | undefined {
  return swissFoods.find((f) => f.id === id);
}

/**
 * Returns total count of Swiss food items
 */
export function getSwissFoodsCount(): number {
  return swissFoods.length;
}
