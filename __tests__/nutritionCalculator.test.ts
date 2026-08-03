import {
  calculateBMI,
  calculateBMR,
  calculateDynamicBudget,
  calculateMealItemMacros,
  calculateMinHealthyWeight,
  calculateNutritionTargets,
  calculateRemainingCalories,
  calculateTDEE,
} from '../src/services/nutritionCalculator';

describe('Nutrition Calculator Service', () => {
  describe('Mifflin-St Jeor BMR & TDEE Calculations', () => {
    it('should correctly calculate BMR for male profile', () => {
      // W = 80kg, H = 180cm, A = 30yrs, Male
      // (10 * 80) + (6.25 * 180) - (5 * 30) + 5 = 800 + 1125 - 150 + 5 = 1780
      const bmrMale = calculateBMR(80, 180, 30, 'MALE');
      expect(bmrMale).toBe(1780);
    });

    it('should correctly calculate BMR for female profile', () => {
      // W = 60kg, H = 165cm, A = 25yrs, Female
      // (10 * 60) + (6.25 * 165) - (5 * 25) - 161 = 600 + 1031.25 - 125 - 161 = 1345.25 => 1345
      const bmrFemale = calculateBMR(60, 165, 25, 'FEMALE');
      expect(bmrFemale).toBe(1345);
    });

    it('should calculate TDEE based on activity factor', () => {
      // BMR = 1780, AF = 1.55 (Moderately Active)
      // 1780 * 1.55 = 2759
      const tdee = calculateTDEE(1780, 1.55);
      expect(tdee).toBe(2759);

      // Smartwatch / Sensor Tracked (1.0x): TDEE equals pure BMR resting baseline
      const tdeeSmartwatch = calculateTDEE(1780, 1.0);
      expect(tdeeSmartwatch).toBe(1780);
    });
  });

  describe('Target Weight & Safe Rate Limiting', () => {
    it('should calculate weight decrease and safe deficit for weight loss', () => {
      // Current weight = 80kg, Target weight = 75kg (-5kg decrease)
      const targets = calculateNutritionTargets(80, 180, 30, 'MALE', 1.55, 75, false);
      expect(targets.weightDiffKg).toBe(5);
      // TDEE = 2759. 15% deficit = -414 kcal => 2345 kcal
      expect(targets.calorieAdjustment).toBe(-414);
      expect(targets.baseCalorieTarget).toBe(2345);
      expect(targets.derivedGoalType).toBe('WEIGHT_LOSS');
    });

    it('should enforce safety floor and prevent burning through calories too fast', () => {
      // Case with very low BMR / low calories, deficit capped so target never drops below BMR/safety floor
      const targets = calculateNutritionTargets(55, 160, 40, 'FEMALE', 1.2, 48, false);
      // BMR = 550 + 1000 - 200 - 161 = 1189. Absolute female floor = 1200 kcal.
      expect(targets.baseCalorieTarget).toBeGreaterThanOrEqual(1200);
    });

    it('should identify healthy vs unhealthy target weights (WHO BMI < 18.5)', () => {
      const minWeight = calculateMinHealthyWeight(180);
      expect(minWeight).toBe(59.9); // 18.5 * (1.8^2) = 59.94 => 59.9 kg

      const healthyTarget = calculateNutritionTargets(80, 180, 30, 'MALE', 1.55, 70);
      expect(healthyTarget.isHealthyWeight).toBe(true);

      const unhealthyTarget = calculateNutritionTargets(80, 180, 30, 'MALE', 1.55, 45);
      expect(unhealthyTarget.isHealthyWeight).toBe(false);
      expect(unhealthyTarget.targetBmi).toBeLessThan(18.5);
    });
  });

  describe('Cumulative Objectives & Low-Mark Nutrient Target Focus', () => {
    it('should support cumulative Lose Weight + Gain Muscle (Recomposition) with conservative low-mark macros', () => {
      // Current weight = 75kg, Target weight = 70kg, Cumulative Muscle Gain = true
      const recompTargets = calculateNutritionTargets(75, 178, 28, 'MALE', 1.55, 70, true);
      expect(recompTargets.derivedGoalType).toBe('RECOMP');

      // Conservative low mark protein for muscle gain/recomp = 1.3g/kg (75kg * 1.3 = 97.5 => 98g)
      // Fat = 25% of calories
      expect(recompTargets.proteinG).toBe(98);
      expect(recompTargets.proteinG).toBeLessThan(140); // Much lower than excessive 2.0+ g/kg marks!
    });

    it('should calculate baseline low-mark macros without muscle gain objective', () => {
      // 75kg baseline -> 1.0g/kg protein = 75g
      const baselineTargets = calculateNutritionTargets(75, 178, 28, 'MALE', 1.55, 70, false);
      expect(baselineTargets.proteinG).toBe(75);
    });

    it('should allocate meal budgets according to distribution default percentages', () => {
      const targets = calculateNutritionTargets(80, 180, 30, 'MALE', 1.55, 80, false);
      // Base calories = 2759
      expect(targets.mealBudgets.BREAKFAST).toBe(690);
      expect(targets.mealBudgets.LUNCH).toBe(966);
      expect(targets.mealBudgets.DINNER).toBe(828);
      expect(targets.mealBudgets.SNACK).toBe(276);
    });
  });

  describe('Dynamic Budget & Macro Portion Recalculations', () => {
    it('should dynamically calculate daily budget with Health Connect active calories', () => {
      const dynamicBudget = calculateDynamicBudget(2000, 450);
      expect(dynamicBudget).toBe(2450);
    });

    it('should calculate remaining calories accurately', () => {
      const remaining = calculateRemainingCalories(2450, 1800);
      expect(remaining).toBe(650);

      const overRemaining = calculateRemainingCalories(2450, 2600);
      expect(overRemaining).toBe(-150);
    });

    it('should recalculate meal item macros based on portion quantity in grams', () => {
      const food = {
        calories100g: 375,
        proteins100g: 13.3,
        carbs100g: 66.7,
        fats100g: 6.7,
      };

      const macros150g = calculateMealItemMacros(food, 150);
      expect(macros150g.calories).toBe(562.5);
      expect(macros150g.protein).toBe(20);
      expect(macros150g.carbs).toBe(100.1);
      expect(macros150g.fat).toBe(10.1);
    });
  });
});
