import AsyncStorage from '@react-native-async-storage/async-storage';
import { ActivityEntry, FoodItem, MealEntry, SleepEntry, UserProfile } from '../types';
import { calculateNutritionTargets } from './nutritionCalculator';

const PROFILE_STORAGE_KEY = '@joules_user_profile';
const MEAL_STORAGE_KEY = '@joules_meal_entries';
const ACTIVITY_STORAGE_KEY = '@joules_activity_entries';
const SLEEP_STORAGE_KEY = '@joules_sleep_entries';
const DISCLAIMER_STORAGE_KEY = '@joules_disclaimer_accepted';

const DEFAULT_PROFILE: UserProfile = {
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
  defaultWorkoutDurationMinutes: 20,
  targetSleepMinutes: 480,
  updatedAt: Date.now(),
};

// Local storage state for offline-first resilience & cross-platform support
let profileStore: UserProfile = { ...DEFAULT_PROFILE };

let foodsStore: Map<string, FoodItem> = new Map();
let mealEntriesStore: MealEntry[] = [];
let activityEntriesStore: ActivityEntry[] = [];
let sleepEntriesStore: SleepEntry[] = [];

async function persistProfileStore(): Promise<void> {
  try {
    await AsyncStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(profileStore));
  } catch (err) {
    console.error('Failed to persist user profile:', err);
  }
}

export async function persistActivityStore(): Promise<void> {
  try {
    await AsyncStorage.setItem(ACTIVITY_STORAGE_KEY, JSON.stringify(activityEntriesStore));
  } catch (err) {
    console.error('Failed to persist activity entries:', err);
  }
}

export async function persistMealStore(): Promise<void> {
  try {
    await AsyncStorage.setItem(MEAL_STORAGE_KEY, JSON.stringify(mealEntriesStore));
  } catch (err) {
    console.error('Failed to persist meal entries:', err);
  }
}

export async function persistSleepStore(): Promise<void> {
  try {
    await AsyncStorage.setItem(SLEEP_STORAGE_KEY, JSON.stringify(sleepEntriesStore));
  } catch (err) {
    console.error('Failed to persist sleep entries:', err);
  }
}

// Initialize Database Service
export async function initDatabase(): Promise<void> {
  try {
    const jsonProfile = await AsyncStorage.getItem(PROFILE_STORAGE_KEY);
    if (jsonProfile != null) {
      const savedProfile = JSON.parse(jsonProfile);
      profileStore = { ...DEFAULT_PROFILE, ...savedProfile };
    }
  } catch (err) {
    console.error('Failed to load user profile from storage:', err);
  }

  try {
    const jsonActivities = await AsyncStorage.getItem(ACTIVITY_STORAGE_KEY);
    if (jsonActivities != null) {
      activityEntriesStore = JSON.parse(jsonActivities);
    }
  } catch (err) {
    console.error('Failed to load activity entries from storage:', err);
  }

  try {
    const jsonMeals = await AsyncStorage.getItem(MEAL_STORAGE_KEY);
    if (jsonMeals != null) {
      mealEntriesStore = JSON.parse(jsonMeals);
    }
  } catch (err) {
    console.error('Failed to load meal entries from storage:', err);
  }

  try {
    const jsonSleep = await AsyncStorage.getItem(SLEEP_STORAGE_KEY);
    if (jsonSleep != null) {
      sleepEntriesStore = JSON.parse(jsonSleep);
    }
  } catch (err) {
    console.error('Failed to load sleep entries from storage:', err);
  }

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

  await persistProfileStore();
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
    defaultWorkoutDurationMinutes: profileData.defaultWorkoutDurationMinutes ?? 20,
    targetSleepMinutes: profileData.targetSleepMinutes ?? profileStore.targetSleepMinutes ?? 480,
    goalType: targets.derivedGoalType,
    calorieTarget: targets.baseCalorieTarget,
    proteinTargetG: targets.proteinG,
    carbTargetG: targets.carbG,
    fatTargetG: targets.fatG,
    updatedAt: Date.now(),
  };

  await persistProfileStore();

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
  const validLocal = Array.from(foodsStore.values()).filter(
    (f) => f.brand !== 'Health Connect' && !f.id.startsWith('hc_food_')
  );
  if (!q) return validLocal;

  return validLocal.filter(
    (f) =>
      f.name.toLowerCase().includes(q) ||
      (f.brand && f.brand.toLowerCase().includes(q)) ||
      (f.barcode && f.barcode.includes(q))
  );
}

export interface RecentFoodLogInfo {
  byFoodId: Map<string, number>;
  byBarcode: Map<string, number>;
  byNameKey: Map<string, number>;
}

export async function getRecentFoodLogInfo(): Promise<RecentFoodLogInfo> {
  const byFoodId = new Map<string, number>();
  const byBarcode = new Map<string, number>();
  const byNameKey = new Map<string, number>();

  const updateMax = (map: Map<string, number>, key: string | undefined | null, timestamp: number) => {
    if (!key) return;
    const existing = map.get(key) || 0;
    if (timestamp > existing) {
      map.set(key, timestamp);
    }
  };

  for (const entry of mealEntriesStore) {
    const food = entry.food || foodsStore.get(entry.foodId);
    let timestamp = 0;
    if (entry.date) {
      const d = new Date(entry.date);
      timestamp = !isNaN(d.getTime()) ? d.getTime() : 0;
    }
    if (food?.addedAt && food.addedAt > timestamp) {
      timestamp = food.addedAt;
    }

    if (entry.foodId) {
      updateMax(byFoodId, entry.foodId, timestamp);
    }
    if (food?.barcode) {
      updateMax(byBarcode, food.barcode, timestamp);
    }
    if (food?.name) {
      const normName = food.name.toLowerCase().trim();
      updateMax(byNameKey, normName, timestamp);
    }
  }

  for (const food of foodsStore.values()) {
    if (food.isAdded && food.addedAt) {
      updateMax(byFoodId, food.id, food.addedAt);
      if (food.barcode) updateMax(byBarcode, food.barcode, food.addedAt);
      if (food.name) updateMax(byNameKey, food.name.toLowerCase().trim(), food.addedAt);
    }
  }

  return { byFoodId, byBarcode, byNameKey };
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
  if (entry.healthConnectId) {
    const existing = mealEntriesStore.find((m) => m.healthConnectId === entry.healthConnectId);
    if (existing) {
      return { ...existing, food: foodsStore.get(existing.foodId) };
    }
  }

  // Ensure catalog food is marked as added/logged
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

// Activity Entries Operations
export async function getActivityEntriesByDate(dateStr: string): Promise<ActivityEntry[]> {
  return activityEntriesStore
    .filter((entry) => entry.date === dateStr)
    .map((entry) => ({ ...entry }));
}

export async function addActivityEntry(entry: Omit<ActivityEntry, 'id'>): Promise<ActivityEntry> {
  // 1. Deduplicate by exact healthConnectId if present
  if (entry.healthConnectId) {
    const existing = activityEntriesStore.find((a) => a.healthConnectId === entry.healthConnectId);
    if (existing) {
      const merged: ActivityEntry = {
        ...existing,
        caloriesKcal: entry.caloriesKcal > 0 ? entry.caloriesKcal : existing.caloriesKcal,
        avgHeartRateBpm: entry.avgHeartRateBpm || existing.avgHeartRateBpm,
        maxHeartRateBpm: entry.maxHeartRateBpm || existing.maxHeartRateBpm,
        minHeartRateBpm: entry.minHeartRateBpm || existing.minHeartRateBpm,
        heartRateSamples: entry.heartRateSamples?.length ? entry.heartRateSamples : existing.heartRateSamples,
        heartRateZones: entry.heartRateZones || existing.heartRateZones,
      };
      const idx = activityEntriesStore.findIndex((a) => a.id === existing.id);
      if (idx !== -1) activityEntriesStore[idx] = merged;
      await persistActivityStore();
      return { ...merged };
    }
  }

  // 2. Deduplicate by date, activityType, and start time tolerance (within 15 minutes)
  const parseMs = (timeStr?: string, dateStr?: string): number => {
    if (!timeStr) return 0;
    const parsed = Date.parse(timeStr);
    if (!isNaN(parsed)) return parsed;
    if (timeStr.includes(':') && dateStr) {
      return Date.parse(`${dateStr}T${timeStr}:00.000Z`);
    }
    return 0;
  };

  const newStartMs = parseMs(entry.startTime, entry.date);

  const existingMatchIndex = activityEntriesStore.findIndex((a) => {
    if (a.date !== entry.date) return false;
    if (a.activityType !== entry.activityType) return false;

    const existingMs = parseMs(a.startTime, a.date);
    if (newStartMs > 0 && existingMs > 0) {
      return Math.abs(newStartMs - existingMs) <= 15 * 60 * 1000;
    }

    // Fallback: match by duration if start time couldn't be parsed
    return Math.abs(a.durationMinutes - entry.durationMinutes) <= 5;
  });

  if (existingMatchIndex !== -1) {
    const existing = activityEntriesStore[existingMatchIndex];
    const merged: ActivityEntry = {
      ...existing,
      healthConnectId: entry.healthConnectId || existing.healthConnectId,
      caloriesKcal: entry.caloriesKcal > 0 ? entry.caloriesKcal : existing.caloriesKcal,
      durationMinutes: entry.durationMinutes || existing.durationMinutes,
      distanceKm: entry.distanceKm ?? existing.distanceKm,
      avgHeartRateBpm: entry.avgHeartRateBpm || existing.avgHeartRateBpm,
      maxHeartRateBpm: entry.maxHeartRateBpm || existing.maxHeartRateBpm,
      minHeartRateBpm: entry.minHeartRateBpm || existing.minHeartRateBpm,
      heartRateSamples: entry.heartRateSamples?.length ? entry.heartRateSamples : existing.heartRateSamples,
      heartRateZones: entry.heartRateZones || existing.heartRateZones,
    };
    activityEntriesStore[existingMatchIndex] = merged;
    await persistActivityStore();
    return { ...merged };
  }

  const newEntry: ActivityEntry = {
    ...entry,
    id: `activity_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
  };
  activityEntriesStore.push(newEntry);
  await persistActivityStore();
  return { ...newEntry };
}

export async function updateActivityEntry(
  activityId: string,
  updatedData: Partial<ActivityEntry>
): Promise<ActivityEntry | null> {
  const index = activityEntriesStore.findIndex((a) => a.id === activityId);
  if (index !== -1) {
    const updatedEntry: ActivityEntry = {
      ...activityEntriesStore[index],
      ...updatedData,
    };
    activityEntriesStore[index] = updatedEntry;
    await persistActivityStore();
    return { ...updatedEntry };
  }
  return null;
}

export async function deleteActivityEntry(activityId: string): Promise<void> {
  activityEntriesStore = activityEntriesStore.filter((a) => a.id !== activityId);
  await persistActivityStore();
}

export async function getAllActivityEntries(startDateStr?: string, endDateStr?: string): Promise<ActivityEntry[]> {
  return activityEntriesStore
    .filter((entry) => {
      if (startDateStr && entry.date < startDateStr) return false;
      if (endDateStr && entry.date > endDateStr) return false;
      return true;
    })
    .map((entry) => ({ ...entry }));
}

export async function updateActivityHealthConnectId(activityId: string, healthConnectId: string): Promise<void> {
  const entry = activityEntriesStore.find((a) => a.id === activityId);
  if (entry) {
    entry.healthConnectId = healthConnectId;
    await persistActivityStore();
  }
}

export async function findActivityEntryByHealthConnectId(healthConnectId: string): Promise<ActivityEntry | null> {
  const entry = activityEntriesStore.find((a) => a.healthConnectId === healthConnectId);
  return entry ? { ...entry } : null;
}

// Sleep Entries Operations
export async function getSleepEntriesByDate(dateStr: string): Promise<SleepEntry[]> {
  return sleepEntriesStore
    .filter((entry) => entry.date === dateStr)
    .map((entry) => ({ ...entry }));
}

export async function addSleepEntry(entry: Omit<SleepEntry, 'id'>): Promise<SleepEntry> {
  if (entry.healthConnectId) {
    const existing = sleepEntriesStore.find((s) => s.healthConnectId === entry.healthConnectId);
    if (existing) {
      return { ...existing };
    }
  }

  const newEntry: SleepEntry = {
    ...entry,
    id: `sleep_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
  };
  sleepEntriesStore.push(newEntry);
  return { ...newEntry };
}

export async function updateSleepEntry(
  sleepId: string,
  updatedData: Partial<SleepEntry>
): Promise<SleepEntry | null> {
  const index = sleepEntriesStore.findIndex((s) => s.id === sleepId);
  if (index !== -1) {
    const updatedEntry: SleepEntry = {
      ...sleepEntriesStore[index],
      ...updatedData,
    };
    sleepEntriesStore[index] = updatedEntry;
    return { ...updatedEntry };
  }
  return null;
}

export async function deleteSleepEntry(sleepId: string): Promise<void> {
  sleepEntriesStore = sleepEntriesStore.filter((s) => s.id !== sleepId);
}

export async function getAllSleepEntries(startDateStr?: string, endDateStr?: string): Promise<SleepEntry[]> {
  return sleepEntriesStore
    .filter((entry) => {
      if (startDateStr && entry.date < startDateStr) return false;
      if (endDateStr && entry.date > endDateStr) return false;
      return true;
    })
    .map((entry) => ({ ...entry }));
}

export async function updateSleepHealthConnectId(sleepId: string, healthConnectId: string): Promise<void> {
  const entry = sleepEntriesStore.find((s) => s.id === sleepId);
  if (entry) {
    entry.healthConnectId = healthConnectId;
  }
}

export async function findSleepEntryByHealthConnectId(healthConnectId: string): Promise<SleepEntry | null> {
  const entry = sleepEntriesStore.find((s) => s.healthConnectId === healthConnectId);
  return entry ? { ...entry } : null;
}

export async function updateLastReconciledAt(timestamp: number): Promise<void> {
  profileStore.lastReconciledAt = timestamp;
  await persistProfileStore();
}

export async function getLastReconciledAt(): Promise<number | undefined> {
  return profileStore.lastReconciledAt;
}

export async function getDisclaimerAccepted(): Promise<boolean> {
  try {
    const val = await AsyncStorage.getItem(DISCLAIMER_STORAGE_KEY);
    return val === 'true';
  } catch (err) {
    console.error('Failed to read disclaimer status:', err);
    return false;
  }
}

export async function saveDisclaimerAccepted(): Promise<void> {
  try {
    await AsyncStorage.setItem(DISCLAIMER_STORAGE_KEY, 'true');
  } catch (err) {
    console.error('Failed to save disclaimer status:', err);
  }
}

// Clear helper for tests
export function _resetDatabaseState(): void {
  profileStore = { ...DEFAULT_PROFILE };
  foodsStore.clear();
  mealEntriesStore = [];
  activityEntriesStore = [];
  sleepEntriesStore = [];
  AsyncStorage.removeItem(PROFILE_STORAGE_KEY).catch(() => {});
  AsyncStorage.removeItem(MEAL_STORAGE_KEY).catch(() => {});
  AsyncStorage.removeItem(ACTIVITY_STORAGE_KEY).catch(() => {});
  AsyncStorage.removeItem(SLEEP_STORAGE_KEY).catch(() => {});
  AsyncStorage.removeItem(DISCLAIMER_STORAGE_KEY).catch(() => {});
}
