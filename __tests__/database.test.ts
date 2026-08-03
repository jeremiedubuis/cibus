import {
  _resetDatabaseState,
  addMealEntry,
  deleteMealEntry,
  getFoodByBarcode,
  getFoodById,
  getMealEntriesByDate,
  getUserProfile,
  initDatabase,
  saveFoodItem,
  saveUserProfile,
  searchLocalFoods,
  updateMealEntry,
  updateMealHealthConnectId,
} from '../src/services/database';
import { FoodItem } from '../src/types';

describe('Local Database Storage Service', () => {
  beforeEach(async () => {
    _resetDatabaseState();
    await initDatabase();
  });

  describe('User Profile Operations', () => {
    it('should load default user profile and calculate targets', async () => {
      const profile = await getUserProfile();
      expect(profile.id).toBe('default_user');
      expect(profile.weightKg).toBe(75);
      expect(profile.calorieTarget).toBeGreaterThan(0);
    });

    it('should save user profile updates and recalculate target calories', async () => {
      const updated = await saveUserProfile({
        weightKg: 85,
        targetWeightKg: 80,
        heightCm: 185,
        age: 30,
        sex: 'MALE',
        activityFactor: 1.725,
        goalType: 'RECOMP',
        wantMuscleGain: true,
        calorieTarget: 0,
        proteinTargetG: 0,
        carbTargetG: 0,
        fatTargetG: 0,
        breakfastPct: 0.25,
        lunchPct: 0.35,
        dinnerPct: 0.3,
        snackPct: 0.1,
      });

      expect(updated.weightKg).toBe(85);
      expect(updated.targetWeightKg).toBe(80);
      expect(updated.wantMuscleGain).toBe(true);
      expect(updated.goalType).toBe('RECOMP');
      expect(updated.calorieTarget).toBeGreaterThan(2000);
    });
  });

  describe('Master Foods Catalog Operations', () => {
    it('should retrieve seeded foods by ID and barcode', async () => {
      const foodById = await getFoodById('food_oatmeal_01');
      expect(foodById).not.toBeNull();
      expect(foodById?.name).toBe('Whole Grain Rolled Oats');

      const foodByBarcode = await getFoodByBarcode('030000010204');
      expect(foodByBarcode).not.toBeNull();
      expect(foodByBarcode?.id).toBe('food_oatmeal_01');
    });

    it('should search local foods by query string', async () => {
      const matches = await searchLocalFoods('apple');
      expect(matches.length).toBeGreaterThan(0);
      expect(matches[0].name).toContain('Apple');
    });

    it('should save custom food items into local catalog', async () => {
      const customFood: FoodItem = {
        id: 'food_custom_almond_butter',
        name: 'Almond Butter',
        brand: 'Organic Kitchen',
        servingSizeG: 100,
        calories100g: 614,
        proteins100g: 21,
        carbs100g: 19,
        fats100g: 55,
        source: 'MANUAL',
        createdAt: Date.now(),
      };

      await saveFoodItem(customFood);

      const retrieved = await getFoodById('food_custom_almond_butter');
      expect(retrieved).not.toBeNull();
      expect(retrieved?.calories100g).toBe(614);
      expect(retrieved?.isAdded).toBe(true);
      expect(retrieved?.addedAt).toBeDefined();
    });
  });

  describe('Meal Entries Logging Operations', () => {
    it('should add a meal entry and associate food details', async () => {
      const today = new Date().toISOString().split('T')[0];

      const entry = await addMealEntry({
        date: today,
        mealType: 'BREAKFAST',
        foodId: 'food_oatmeal_01',
        quantityG: 150,
        calculatedCalories: 562.5,
        calculatedProtein: 20,
        calculatedCarbs: 100,
        calculatedFat: 10,
      });

      expect(entry.id).toBeDefined();

      const dayEntries = await getMealEntriesByDate(today);
      expect(dayEntries.length).toBe(1);
      expect(dayEntries[0].food?.name).toBe('Whole Grain Rolled Oats');
      expect(dayEntries[0].food?.isAdded).toBe(true);
    });

    it('should update Health Connect ID for logged meal', async () => {
      const today = new Date().toISOString().split('T')[0];

      const entry = await addMealEntry({
        date: today,
        mealType: 'LUNCH',
        foodId: 'food_chicken_02',
        quantityG: 200,
        calculatedCalories: 330,
        calculatedProtein: 62,
        calculatedCarbs: 0,
        calculatedFat: 7.2,
      });

      await updateMealHealthConnectId(entry.id, 'hc_record_12345');

      const dayEntries = await getMealEntriesByDate(today);
      expect(dayEntries[0].healthConnectId).toBe('hc_record_12345');
    });

    it('should update a meal entry with new quantity and macros', async () => {
      const today = new Date().toISOString().split('T')[0];

      const entry = await addMealEntry({
        date: today,
        mealType: 'DINNER',
        foodId: 'food_oats_01',
        quantityG: 100,
        calculatedCalories: 389,
        calculatedProtein: 16.9,
        calculatedCarbs: 66.3,
        calculatedFat: 6.9,
      });

      const updated = await updateMealEntry(entry.id, {
        quantityG: 150,
        calculatedCalories: 583.5,
        calculatedProtein: 25.35,
        calculatedCarbs: 99.45,
        calculatedFat: 10.35,
      });

      expect(updated).not.toBeNull();
      expect(updated?.quantityG).toBe(150);
      expect(updated?.calculatedCalories).toBe(583.5);

      const dayEntries = await getMealEntriesByDate(today);
      expect(dayEntries.find((e) => e.id === entry.id)?.quantityG).toBe(150);
    });

    it('should delete a meal entry', async () => {
      const today = new Date().toISOString().split('T')[0];

      const entry = await addMealEntry({
        date: today,
        mealType: 'SNACK',
        foodId: 'food_apple_03',
        quantityG: 100,
        calculatedCalories: 52,
        calculatedProtein: 0.3,
        calculatedCarbs: 13.8,
        calculatedFat: 0.2,
      });

      await deleteMealEntry(entry.id);

      const dayEntries = await getMealEntriesByDate(today);
      expect(dayEntries.length).toBe(0);
    });
  });
});
