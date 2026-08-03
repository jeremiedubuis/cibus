import {
  ActivityFactor,
  BiologicalSex,
  CalculatedTargets,
  GoalType,
  MacroDistribution,
  MealType,
} from '../types';

export const MACRO_PRESETS: Record<GoalType, MacroDistribution> = {
  MAINTENANCE: { carbsPct: 0.5, proteinPct: 0.2, fatPct: 0.3 },
  WEIGHT_LOSS: { carbsPct: 0.4, proteinPct: 0.3, fatPct: 0.3 },
  MUSCLE_GAIN: { carbsPct: 0.55, proteinPct: 0.25, fatPct: 0.2 },
  RECOMP: { carbsPct: 0.45, proteinPct: 0.3, fatPct: 0.25 },
};

export const DEFAULT_MEAL_DISTRIBUTION: Record<MealType, number> = {
  BREAKFAST: 0.25,
  LUNCH: 0.35,
  DINNER: 0.3,
  SNACK: 0.1,
};

/**
 * Calculates BMR using the Mifflin-St Jeor formula
 */
export function calculateBMR(
  weightKg: number,
  heightCm: number,
  age: number,
  sex: BiologicalSex
): number {
  const base = 10 * weightKg + 6.25 * heightCm - 5 * age;
  return sex === 'MALE' ? Math.round(base + 5) : Math.round(base - 161);
}

/**
 * Calculates TDEE based on BMR and Activity Factor
 */
export function calculateTDEE(bmr: number, activityFactor: ActivityFactor): number {
  return Math.round(bmr * activityFactor);
}

/**
 * Calculates minimum healthy target weight based on WHO BMI >= 18.5 threshold
 */
export function calculateMinHealthyWeight(heightCm: number): number {
  if (!heightCm || heightCm <= 0) return 40;
  const heightM = heightCm / 100;
  return Math.round(18.5 * heightM * heightM * 10) / 10;
}

/**
 * Calculates BMI rounded to 1 decimal place
 */
export function calculateBMI(weightKg: number, heightCm: number): number {
  if (!heightCm || heightCm <= 0 || !weightKg || weightKg <= 0) return 0;
  const heightM = heightCm / 100;
  return Math.round((weightKg / (heightM * heightM)) * 10) / 10;
}

/**
 * Calculates total target calories and conservative low-mark macros based on target weight & cumulative goals.
 * Enforces rate limiting so users never burn through calories too fast or pick an unhealthy diet.
 */
export function calculateNutritionTargets(
  weightKg: number,
  heightCm: number,
  age: number,
  sex: BiologicalSex,
  activityFactor: ActivityFactor,
  targetWeightKgOrGoalType: number | GoalType,
  wantMuscleGain: boolean = false,
  customMealDistribution: Record<MealType, number> = DEFAULT_MEAL_DISTRIBUTION
): CalculatedTargets {
  let targetWeightKg: number;
  let forceWantMuscleGain = wantMuscleGain;

  if (typeof targetWeightKgOrGoalType === 'string') {
    if (targetWeightKgOrGoalType === 'WEIGHT_LOSS') {
      targetWeightKg = Math.max(40, weightKg - 5);
    } else if (targetWeightKgOrGoalType === 'MUSCLE_GAIN') {
      targetWeightKg = weightKg + 3;
      forceWantMuscleGain = true;
    } else if (targetWeightKgOrGoalType === 'RECOMP') {
      targetWeightKg = Math.max(40, weightKg - 5);
      forceWantMuscleGain = true;
    } else {
      targetWeightKg = weightKg;
    }
  } else {
    targetWeightKg = targetWeightKgOrGoalType;
  }

  const bmr = calculateBMR(weightKg, heightCm, age, sex);
  const tdee = calculateTDEE(bmr, activityFactor);

  const minHealthyWeightKg = calculateMinHealthyWeight(heightCm);
  const targetBmi = calculateBMI(targetWeightKg, heightCm);
  const isHealthyWeight = targetBmi >= 18.5 && targetWeightKg > 0;

  const weightDiffKg = Math.round((weightKg - targetWeightKg) * 10) / 10; // > 0 means weight decrease needed

  // Calculate safe calorie adjustment (prevent burning through calories too fast)
  // Max safe deficit is capped at 15% of TDEE or 500 kcal/day (~0.5 kg/week)
  let calorieAdjustment = 0;
  if (weightDiffKg > 0) {
    calorieAdjustment = -Math.min(500, Math.round(tdee * 0.15));
  } else if (weightDiffKg < 0) {
    calorieAdjustment = Math.min(300, Math.round(tdee * 0.10));
  }

  // Calculate base calorie target with safety floor (never below BMR or absolute gender min)
  let baseCalorieTarget = tdee + calorieAdjustment;
  const absoluteMin = sex === 'FEMALE' ? 1200 : 1500;
  const safetyFloor = Math.max(bmr, absoluteMin);
  baseCalorieTarget = Math.max(safetyFloor, baseCalorieTarget);

  // CONSERVATIVE LOW-MARK MACRONUTRIENTS FOCUS
  // Protein (Low mark): 1.0g/kg for baseline/loss, 1.3g/kg for cumulative muscle gain
  const proteinPerKg = forceWantMuscleGain ? 1.3 : 1.0;
  const proteinG = Math.max(40, Math.round(weightKg * proteinPerKg));

  // Fat (Low mark): 25% of total calorie target
  const fatG = Math.max(30, Math.round((baseCalorieTarget * 0.25) / 9));

  // Carbs (Fills remaining calories): (baseCalorieTarget - (proteinG*4 + fatG*9)) / 4
  const proteinCal = proteinG * 4;
  const fatCal = fatG * 9;
  const remainingCal = Math.max(0, baseCalorieTarget - (proteinCal + fatCal));
  const carbG = Math.round(remainingCal / 4);

  // Derived Goal Type for display / legacy sync
  let derivedGoalType: GoalType = 'MAINTENANCE';
  if (weightDiffKg > 0 && forceWantMuscleGain) {
    derivedGoalType = 'RECOMP';
  } else if (weightDiffKg > 0) {
    derivedGoalType = 'WEIGHT_LOSS';
  } else if (weightDiffKg < 0 || forceWantMuscleGain) {
    derivedGoalType = 'MUSCLE_GAIN';
  }

  const mealBudgets: Record<MealType, number> = {
    BREAKFAST: Math.round(baseCalorieTarget * customMealDistribution.BREAKFAST),
    LUNCH: Math.round(baseCalorieTarget * customMealDistribution.LUNCH),
    DINNER: Math.round(baseCalorieTarget * customMealDistribution.DINNER),
    SNACK: Math.round(baseCalorieTarget * customMealDistribution.SNACK),
  };

  return {
    bmr,
    tdee,
    baseCalorieTarget,
    proteinG,
    carbG,
    fatG,
    mealBudgets,
    weightDiffKg,
    calorieAdjustment,
    isHealthyWeight,
    minHealthyWeightKg,
    targetBmi,
    derivedGoalType,
  };
}

/**
 * Calculates dynamic daily calorie budget taking Health Connect active calories into account
 * Dynamic Budget = Base Target + Active Burned Calories
 */
export function calculateDynamicBudget(
  baseCalorieTarget: number,
  activeCaloriesBurned: number
): number {
  return Math.max(0, Math.round(baseCalorieTarget + activeCaloriesBurned));
}

/**
 * Calculates remaining calories: Dynamic Budget - Consumed Calories
 */
export function calculateRemainingCalories(
  dynamicBudget: number,
  consumedCalories: number
): number {
  return Math.round(dynamicBudget - consumedCalories);
}

/**
 * Calculates macro totals for a specific quantity in grams
 */
export function calculateMealItemMacros(
  foodItem: { calories100g: number; proteins100g: number; carbs100g: number; fats100g: number },
  quantityG: number
) {
  const factor = quantityG / 100;
  return {
    calories: Math.round(foodItem.calories100g * factor * 10) / 10,
    protein: Math.round(foodItem.proteins100g * factor * 10) / 10,
    carbs: Math.round(foodItem.carbs100g * factor * 10) / 10,
    fat: Math.round(foodItem.fats100g * factor * 10) / 10,
  };
}
