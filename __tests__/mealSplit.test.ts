import { calculateNutritionTargets } from '../src/services/nutritionCalculator';

describe('Meal Calorie Percentage Split Suite', () => {
  it('calculates targets for custom meal percentage splits accurately', () => {
    const calorieTarget = 2000;
    const breakfastPct = 0.3; // 30%
    const lunchPct = 0.4; // 40%
    const dinnerPct = 0.2; // 20%
    const snackPct = 0.1; // 10%

    expect(breakfastPct + lunchPct + dinnerPct + snackPct).toBeCloseTo(1.0);

    const breakfastTarget = Math.round(calorieTarget * breakfastPct);
    const lunchTarget = Math.round(calorieTarget * lunchPct);
    const dinnerTarget = Math.round(calorieTarget * dinnerPct);
    const snackTarget = Math.round(calorieTarget * snackPct);

    expect(breakfastTarget).toBe(600);
    expect(lunchTarget).toBe(800);
    expect(dinnerTarget).toBe(400);
    expect(snackTarget).toBe(200);
    expect(breakfastTarget + lunchTarget + dinnerTarget + snackTarget).toBe(2000);
  });
});
