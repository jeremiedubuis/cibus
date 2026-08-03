import {
  parseServingText,
  getDefaultPortionsForFood,
  deduplicatePortions,
  calculateGramsFromPortion,
  getLocalizedPortionLabel,
} from '../src/services/portionService';
import { FoodItem } from '../src/types';

describe('portionService', () => {
  describe('parseServingText', () => {
    it('should parse unit and weight with parentheses', () => {
      const parsed = parseServingText('1 slice (25g)');
      expect(parsed).toEqual({
        gramWeight: 25,
        unitName: 'slice',
        label: '1 slice (25g)',
      });
    });

    it('should parse direct weight string', () => {
      const parsed = parseServingText('125g');
      expect(parsed).toEqual({
        gramWeight: 125,
        unitName: 'portion',
        label: '1 portion (125g)',
      });
    });

    it('should return null for empty or invalid string', () => {
      expect(parseServingText('')).toBeNull();
      expect(parseServingText('100g')).toBeNull(); // 100g is standard base, not custom portion
    });
  });

  describe('getDefaultPortionsForFood - High Confidence Portion Suggestions', () => {
    it('should NOT suggest liquid glass/bottle for ham even if "eau" is present in name', () => {
      const hamItem: FoodItem = {
        id: 'ham_1',
        name: 'Jambon cuit à l’eau',
        brand: 'Herta',
        servingSizeG: 100,
        calories100g: 110,
        proteins100g: 20,
        carbs100g: 1,
        fats100g: 3,
        source: 'MANUAL',
        createdAt: Date.now(),
      };

      const portions = getDefaultPortionsForFood(hamItem);
      const units = portions.map((p) => p.unitName);

      expect(units).not.toContain('glass');
      expect(units).not.toContain('bottle/can');
      expect(units).toContain('slice');
    });

    it('should NOT suggest liquid glass for chocolate even though "cola" is in "chocolat"', () => {
      const chocolateItem: FoodItem = {
        id: 'choc_1',
        name: 'Chocolat au lait',
        brand: 'Milka',
        servingSizeG: 100,
        calories100g: 530,
        proteins100g: 7,
        carbs100g: 58,
        fats100g: 30,
        source: 'MANUAL',
        createdAt: Date.now(),
      };

      const portions = getDefaultPortionsForFood(chocolateItem);
      const units = portions.map((p) => p.unitName);

      expect(units).not.toContain('glass');
      expect(units).not.toContain('bottle/can');
    });

    it('should suggest glass and bottle/can for actual liquids like milk or juice', () => {
      const milkItem: FoodItem = {
        id: 'milk_1',
        name: 'Lait demi-écrémé',
        brand: 'Lactel',
        servingSizeG: 100,
        calories100g: 46,
        proteins100g: 3.2,
        carbs100g: 4.8,
        fats100g: 1.5,
        source: 'MANUAL',
        createdAt: Date.now(),
      };

      const portions = getDefaultPortionsForFood(milkItem);
      const units = portions.map((p) => p.unitName);

      expect(units).toContain('glass');
      expect(units).toContain('bottle/can');
    });

    it('should filter out bogus liquid serving names on solid food items', () => {
      const solidItemWithBogusServing: FoodItem = {
        id: 'ham_bogus',
        name: 'Jambon blanc',
        brand: 'Fleury Michon',
        servingSizeG: 200,
        servingName: '1 glass (200 ml)', // Bogus OFF data
        calories100g: 110,
        proteins100g: 20,
        carbs100g: 1,
        fats100g: 3,
        source: 'MANUAL',
        createdAt: Date.now(),
      };

      const portions = getDefaultPortionsForFood(solidItemWithBogusServing);
      const units = portions.map((p) => p.unitName);

      expect(units).not.toContain('glass');
    });

    it('should always append "g" as the final portion option', () => {
      const appleItem: FoodItem = {
        id: 'apple_1',
        name: 'Pomme Gala',
        brand: 'Generic',
        servingSizeG: 150,
        calories100g: 52,
        proteins100g: 0.3,
        carbs100g: 14,
        fats100g: 0.2,
        source: 'MANUAL',
        createdAt: Date.now(),
      };

      const portions = getDefaultPortionsForFood(appleItem);
      const lastOption = portions[portions.length - 1];

      expect(lastOption.id).toBe('grams');
      expect(lastOption.unitName).toBe('g');
    });
  });

  describe('calculateGramsFromPortion', () => {
    it('should calculate total grams correctly', () => {
      const portion = { id: 'slice', label: '1 slice (35g)', gramWeight: 35, unitName: 'slice' };
      expect(calculateGramsFromPortion(portion, 2)).toBe(70);
      expect(calculateGramsFromPortion(portion, 0.5)).toBe(17.5);
    });
  });

  describe('getLocalizedPortionLabel', () => {
    const mockTFr = (key: string, options?: any) => {
      const translations: Record<string, string> = {
        'logMeal.units.slice': 'tranche',
        'logMeal.units.glass': 'verre',
        'logMeal.units.bottle_can': 'bouteille / canette',
        'logMeal.units.pot': 'pot',
        'logMeal.units.unit': 'unité',
        'logMeal.units.portion': 'portion',
      };
      if (key === 'logMeal.portionFormat') {
        return `1 ${options.unit} (${options.weight}g)`;
      }
      return translations[key] || options?.defaultValue || key;
    };

    it('should format localized slice portion label in French', () => {
      const slicePortion = { id: 'slice', label: '1 slice (35g)', gramWeight: 35, unitName: 'slice' };
      expect(getLocalizedPortionLabel(slicePortion, mockTFr)).toBe('1 tranche (35g)');
    });

    it('should format localized glass portion label in French', () => {
      const glassPortion = { id: 'glass', label: '1 glass (200g)', gramWeight: 200, unitName: 'glass' };
      expect(getLocalizedPortionLabel(glassPortion, mockTFr)).toBe('1 verre (200g)');
    });
  });
});
