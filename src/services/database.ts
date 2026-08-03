import { FoodItem, MealEntry, UserProfile } from '../types';
import { calculateNutritionTargets } from './nutritionCalculator';

// Local storage state for offline-first resilience & cross-platform support
let profileStore: UserProfile = {
  id: 'default_user',
  weightKg: 75,
  targetWeightKg: 70,
  heightCm: 178,
  age: 28,
  sex: 'MALE',
  activityFactor: 1.55,
  goalType: 'RECOMP',
  wantMuscleGain: true,
  calorieTarget: 2276,
  proteinTargetG: 98,
  carbTargetG: 329,
  fatTargetG: 63,
  breakfastPct: 0.25,
  lunchPct: 0.35,
  dinnerPct: 0.3,
  snackPct: 0.1,
  updatedAt: Date.now(),
};

let foodsStore: Map<string, FoodItem> = new Map();
let mealEntriesStore: MealEntry[] = [];

// Seed default master foods catalog
const SEED_FOODS: FoodItem[] = [
  {
    id: 'food_raw_tomato_01',
    name: 'Tomate fraîche (Raw Tomato)',
    brand: 'Fruits & Légumes',
    servingSizeG: 100,
    calories100g: 18,
    proteins100g: 0.9,
    carbs100g: 3.9,
    fats100g: 0.2,
    fiber100g: 1.2,
    sodiumMg100g: 5,
    source: 'MANUAL',
    createdAt: Date.now() - 86400000 * 35,
  },
  {
    id: 'food_cherry_tomato_02',
    name: 'Tomates Cerises (Cherry Tomatoes)',
    brand: 'Fruits & Légumes',
    servingSizeG: 100,
    calories100g: 19,
    proteins100g: 0.9,
    carbs100g: 2.5,
    fats100g: 0.3,
    fiber100g: 1.3,
    sodiumMg100g: 4,
    source: 'MANUAL',
    createdAt: Date.now() - 86400000 * 34,
  },
  {
    id: 'food_tomato_sauce_03',
    name: 'Sauce Tomate Nature (Tomato Sauce)',
    brand: 'Épicerie',
    servingSizeG: 100,
    calories100g: 32,
    proteins100g: 1.4,
    carbs100g: 6.2,
    fats100g: 0.3,
    fiber100g: 1.5,
    sodiumMg100g: 320,
    source: 'MANUAL',
    createdAt: Date.now() - 86400000 * 33,
  },
  {
    id: 'food_oatmeal_01',
    barcode: '030000010204',
    name: 'Whole Grain Rolled Oats',
    brand: 'Quaker',
    servingSizeG: 100,
    calories100g: 375,
    proteins100g: 13.3,
    carbs100g: 66.7,
    fats100g: 6.7,
    fiber100g: 10.0,
    sodiumMg100g: 0,
    source: 'OFF_API',
    createdAt: Date.now() - 86400000 * 30,
  },
  {
    id: 'food_chicken_02',
    name: 'Poulet Grillé / Chicken Breast',
    brand: 'Boucherie',
    servingSizeG: 100,
    calories100g: 165,
    proteins100g: 31.0,
    carbs100g: 0.0,
    fats100g: 3.6,
    fiber100g: 0.0,
    sodiumMg100g: 74,
    source: 'MANUAL',
    createdAt: Date.now() - 86400000 * 20,
  },
  {
    id: 'food_apple_03',
    barcode: '000000004011',
    name: 'Pomme Rouge / Red Apple',
    brand: 'Fruits & Légumes',
    servingSizeG: 100,
    calories100g: 52,
    proteins100g: 0.3,
    carbs100g: 13.8,
    fats100g: 0.2,
    fiber100g: 2.4,
    sodiumMg100g: 1,
    source: 'OFF_API',
    createdAt: Date.now() - 86400000 * 15,
  },
  {
    id: 'food_greek_yogurt_04',
    name: 'Yaourt Grec Nature / Greek Yogurt',
    brand: 'Laiterie',
    servingSizeG: 100,
    calories100g: 59,
    proteins100g: 10.2,
    carbs100g: 3.6,
    fats100g: 0.4,
    fiber100g: 0.0,
    sodiumMg100g: 36,
    source: 'OFF_API',
    createdAt: Date.now() - 86400000 * 10,
  },
];

SEED_FOODS.forEach((f) => foodsStore.set(f.id, f));

// Initialize Database Service
export async function initDatabase(): Promise<void> {
  // Ensure profile initial calculation targets are up to date
  const targets = calculateNutritionTargets(
    profileStore.weightKg,
    profileStore.heightCm,
    profileStore.age,
    profileStore.sex,
    profileStore.activityFactor,
    profileStore.targetWeightKg ?? profileStore.weightKg,
    profileStore.wantMuscleGain ?? false,
    {
      BREAKFAST: profileStore.breakfastPct,
      LUNCH: profileStore.lunchPct,
      DINNER: profileStore.dinnerPct,
      SNACK: profileStore.snackPct,
    }
  );

  profileStore.goalType = targets.derivedGoalType;
  profileStore.calorieTarget = targets.baseCalorieTarget;
  profileStore.proteinTargetG = targets.proteinG;
  profileStore.carbTargetG = targets.carbG;
  profileStore.fatTargetG = targets.fatG;
}

// User Profile Operations
export async function getUserProfile(): Promise<UserProfile> {
  return { ...profileStore };
}

export async function saveUserProfile(profileData: Omit<UserProfile, 'id' | 'updatedAt'>): Promise<UserProfile> {
  const targetWeight = profileData.targetWeightKg ?? profileData.weightKg;
  const wantMuscle = profileData.wantMuscleGain ?? false;

  const targets = calculateNutritionTargets(
    profileData.weightKg,
    profileData.heightCm,
    profileData.age,
    profileData.sex,
    profileData.activityFactor,
    targetWeight,
    wantMuscle,
    {
      BREAKFAST: profileData.breakfastPct,
      LUNCH: profileData.lunchPct,
      DINNER: profileData.dinnerPct,
      SNACK: profileData.snackPct,
    }
  );

  profileStore = {
    ...profileData,
    id: 'default_user',
    targetWeightKg: targetWeight,
    wantMuscleGain: wantMuscle,
    goalType: targets.derivedGoalType,
    calorieTarget: targets.baseCalorieTarget,
    proteinTargetG: targets.proteinG,
    carbTargetG: targets.carbG,
    fatTargetG: targets.fatG,
    updatedAt: Date.now(),
  };

  return { ...profileStore };
}

// Foods Operations
export async function getFoodById(id: string): Promise<FoodItem | null> {
  const food = foodsStore.get(id);
  return food ? { ...food } : null;
}

export async function getFoodByBarcode(barcode: string): Promise<FoodItem | null> {
  for (const food of foodsStore.values()) {
    if (food.barcode === barcode) {
      return { ...food };
    }
  }
  return null;
}

export async function saveFoodItem(food: FoodItem): Promise<FoodItem> {
  const savedItem: FoodItem = {
    ...food,
    isAdded: true,
    addedAt: food.addedAt || Date.now(),
  };
  foodsStore.set(food.id, savedItem);
  return { ...savedItem };
}

export async function searchLocalFoods(query: string): Promise<FoodItem[]> {
  const q = query.toLowerCase().trim();
  if (!q) return Array.from(foodsStore.values());

  return Array.from(foodsStore.values()).filter(
    (f) =>
      f.name.toLowerCase().includes(q) ||
      (f.brand && f.brand.toLowerCase().includes(q)) ||
      (f.barcode && f.barcode.includes(q))
  );
}

// Meal Entries Operations
export async function getMealEntriesByDate(dateStr: string): Promise<MealEntry[]> {
  return mealEntriesStore
    .filter((entry) => entry.date === dateStr)
    .map((entry) => ({
      ...entry,
      food: foodsStore.get(entry.foodId),
    }));
}

export async function addMealEntry(entry: Omit<MealEntry, 'id'>): Promise<MealEntry> {
  const existingFood = foodsStore.get(entry.foodId);
  if (existingFood && !existingFood.isAdded) {
    const markedFood: FoodItem = {
      ...existingFood,
      isAdded: true,
      addedAt: Date.now(),
    };
    foodsStore.set(entry.foodId, markedFood);
  }

  const newEntry: MealEntry = {
    ...entry,
    id: `meal_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    food: foodsStore.get(entry.foodId),
  };

  mealEntriesStore.push(newEntry);
  return newEntry;
}

export async function updateMealHealthConnectId(mealId: string, healthConnectId: string): Promise<void> {
  const entry = mealEntriesStore.find((m) => m.id === mealId);
  if (entry) {
    entry.healthConnectId = healthConnectId;
  }
}

export async function updateMealEntry(
  mealId: string,
  updatedData: Partial<MealEntry>
): Promise<MealEntry | null> {
  const index = mealEntriesStore.findIndex((m) => m.id === mealId);
  if (index !== -1) {
    const existing = mealEntriesStore[index];
    const foodId = updatedData.foodId || existing.foodId;
    const updatedEntry: MealEntry = {
      ...existing,
      ...updatedData,
      food: foodsStore.get(foodId),
    };
    mealEntriesStore[index] = updatedEntry;
    return updatedEntry;
  }
  return null;
}

export async function deleteMealEntry(mealId: string): Promise<void> {
  mealEntriesStore = mealEntriesStore.filter((m) => m.id !== mealId);
}

export async function getAllMealEntries(startDateStr?: string, endDateStr?: string): Promise<MealEntry[]> {
  return mealEntriesStore
    .filter((entry) => {
      if (startDateStr && entry.date < startDateStr) return false;
      if (endDateStr && entry.date > endDateStr) return false;
      return true;
    })
    .map((entry) => ({
      ...entry,
      food: foodsStore.get(entry.foodId),
    }));
}

export async function findMealEntryByHealthConnectId(healthConnectId: string): Promise<MealEntry | null> {
  const entry = mealEntriesStore.find((m) => m.healthConnectId === healthConnectId);
  return entry ? { ...entry, food: foodsStore.get(entry.foodId) } : null;
}

export async function updateLastReconciledAt(timestamp: number): Promise<void> {
  profileStore.lastReconciledAt = timestamp;
}

export async function getLastReconciledAt(): Promise<number | undefined> {
  return profileStore.lastReconciledAt;
}

// Clear helper for tests
export function _resetDatabaseState(): void {
  foodsStore.clear();
  SEED_FOODS.forEach((f) => foodsStore.set(f.id, f));
  mealEntriesStore = [];
}

