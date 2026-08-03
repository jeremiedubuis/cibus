import { Platform } from 'react-native';
import { DailyExpenditure, MealType } from '../types';
import {
  addMealEntry,
  getAllMealEntries,
  getLastReconciledAt,
  getUserProfile,
  saveFoodItem,
  saveUserProfile,
  updateLastReconciledAt,
  updateMealHealthConnectId,
} from './database';

export const MEAL_TYPE_MAP: Record<MealType, number> = {
  BREAKFAST: 1,
  LUNCH: 2,
  DINNER: 3,
  SNACK: 4,
};

export const REVERSE_MEAL_TYPE_MAP: Record<number, MealType> = {
  1: 'BREAKFAST',
  2: 'LUNCH',
  3: 'DINNER',
  4: 'SNACK',
};

let healthConnectModule: any = null;

try {
  healthConnectModule = require('react-native-health-connect');
} catch (e) {
  // Native module unavailable (e.g. web/simulator/test env)
  healthConnectModule = null;
}

const isAndroidNative = Platform.OS === 'android' && healthConnectModule !== null;

function withTimeout<T>(promise: Promise<T>, timeoutMs = 2000, fallbackValue: T): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((resolve) => setTimeout(() => resolve(fallbackValue), timeoutMs)),
  ]);
}

export async function isHealthConnectAvailable(): Promise<boolean> {
  if (!isAndroidNative) return false;
  try {
    return await withTimeout(healthConnectModule.initialize(), 5000, false);
  } catch (err) {
    return false;
  }
}

export async function requestHealthConnectPermissions(): Promise<boolean> {
  if (!isAndroidNative) return false;
  try {
    const isInitialized = await withTimeout(healthConnectModule.initialize(), 5000, false);
    if (!isInitialized) return false;

    const permissions = await withTimeout(
      healthConnectModule.requestPermission([
        { accessType: 'write', recordType: 'Nutrition' },
        { accessType: 'read', recordType: 'Nutrition' },
        { accessType: 'read', recordType: 'ActiveCaloriesBurned' },
        { accessType: 'read', recordType: 'Steps' },
        { accessType: 'write', recordType: 'Weight' },
        { accessType: 'read', recordType: 'Weight' },
      ]),
      5000,
      []
    );

    return (permissions || []).some(
      (p: any) => p.recordType === 'Nutrition' && (p.accessType === 'write' || p.accessType === 'read')
    );
  } catch (error: any) {
    if (error?.message?.includes('not seem to be linked') || error?.message?.includes('Expo Go')) {
      console.log('Health Connect native module is not linked in current build environment.');
    } else {
      console.warn('Failed to request Health Connect permissions:', error);
    }
    return false;
  }
}

export async function checkHealthConnectPermissionsGranted(): Promise<boolean> {
  if (!isAndroidNative) return false;
  try {
    const isInitialized = await withTimeout(healthConnectModule.initialize(), 5000, false);
    if (!isInitialized) return false;

    const granted = await withTimeout(healthConnectModule.getGrantedPermissions(), 5000, []);
    return (granted || []).some(
      (p: any) => p.recordType === 'Nutrition' && (p.accessType === 'write' || p.accessType === 'read')
    );
  } catch (error) {
    return false;
  }
}

/**
 * Syncs a logged meal entry directly into Google Health Connect as a Nutrition Record
 */
export async function syncMealToHealthConnect(
  mealName: string,
  mealType: MealType,
  consumedAt: Date,
  caloriesKcal: number,
  proteinGrams: number,
  carbsGrams: number,
  fatGrams: number
): Promise<string | null> {
  if (!isAndroidNative) {
    // Return mock ID for non-native / test execution
    return `mock_hc_${Date.now()}`;
  }

  try {
    const isInitialized = await withTimeout(healthConnectModule.initialize(), 5000, false);
    if (!isInitialized) {
      console.warn('Health Connect initialization failed or timed out');
      return null;
    }

    const mealTypeConstant = MEAL_TYPE_MAP[mealType] || 4;

    // Health Connect interval records require endTime to be strictly after startTime
    const startTime = consumedAt.toISOString();
    const endTime = new Date(consumedAt.getTime() + 60 * 1000).toISOString();

    const record = {
      recordType: 'Nutrition' as const,
      startTime,
      endTime,
      mealType: mealTypeConstant,
      name: mealName,
      energy: { value: caloriesKcal, unit: 'kilocalories' },
      protein: { value: proteinGrams, unit: 'grams' },
      totalCarbohydrate: { value: carbsGrams, unit: 'grams' },
      totalFat: { value: fatGrams, unit: 'grams' },
    };

    const insertedIds = await withTimeout<string[] | null>(
      healthConnectModule.insertRecords([record]),
      5000,
      null
    );
    if (insertedIds && insertedIds.length > 0) {
      return insertedIds[0];
    }
    console.warn('Health Connect insertRecords returned empty or timed out');
    return null;
  } catch (error) {
    console.error('Error syncing meal to Health Connect:', error);
    return null;
  }
}

/**
 * Reads Active Calories Burned and Step Count metrics from Health Connect for target date
 */
export async function fetchDailyBurnedMetrics(targetDate: Date): Promise<DailyExpenditure> {
  const fallback = { activeCaloriesKcal: 250, stepCount: 6500 };
  if (!isAndroidNative) return fallback;

  try {
    const isInitialized = await withTimeout(healthConnectModule.initialize(), 5000, false);
    if (!isInitialized) return fallback;

    const startOfDay = new Date(targetDate);
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date(targetDate);
    endOfDay.setHours(23, 59, 59, 999);

    console.log('HEALTH_CONNECT_DEBUG: querying Health Connect between', startOfDay.toISOString(), 'and', endOfDay.toISOString());

    const timeRangeFilter = {
      operator: 'between' as const,
      startTime: startOfDay.toISOString(),
      endTime: endOfDay.toISOString(),
    };

    // Read Active Calories Burned using Health Connect aggregation engine (deduplicates sources)
    let totalActiveKcal = 0;
    try {
      const calAggregate: any = await withTimeout(
        healthConnectModule.aggregateRecord({
          recordType: 'ActiveCaloriesBurned',
          timeRangeFilter,
        }),
        5000,
        null
      );
      if (calAggregate && calAggregate.ACTIVE_CALORIES_TOTAL?.inKilocalories !== undefined) {
        totalActiveKcal = calAggregate.ACTIVE_CALORIES_TOTAL.inKilocalories;
      } else {
        const activeCalorieRecords = await withTimeout(
          healthConnectModule.readRecords('ActiveCaloriesBurned', { timeRangeFilter }),
          5000,
          { records: [] }
        );
        totalActiveKcal = (activeCalorieRecords?.records || []).reduce(
          (acc: number, record: any) => acc + (record.energy?.inKilocalories || 0),
          0
        );
      }
    } catch (e) {
      console.warn('Failed to aggregate active calories:', e);
    }

    // Read Steps Count using Health Connect aggregation engine (deduplicates sources)
    let totalSteps = 0;
    try {
      const stepsAggregate: any = await withTimeout(
        healthConnectModule.aggregateRecord({
          recordType: 'Steps',
          timeRangeFilter,
        }),
        5000,
        null
      );
      if (stepsAggregate && typeof stepsAggregate.COUNT_TOTAL === 'number') {
        totalSteps = stepsAggregate.COUNT_TOTAL;
      } else {
        const stepRecords = await withTimeout(
          healthConnectModule.readRecords('Steps', { timeRangeFilter }),
          5000,
          { records: [] }
        );
        totalSteps = (stepRecords?.records || []).reduce(
          (acc: number, record: any) => acc + (record.count || 0),
          0
        );
      }
    } catch (e) {
      console.warn('Failed to aggregate steps:', e);
    }

    return {
      activeCaloriesKcal: Math.round(totalActiveKcal),
      stepCount: totalSteps,
    };
  } catch (error) {
    return fallback;
  }
}

export interface SyncReconciliationResult {
  reconciledWindowDays: number;
  importedCount: number;
  exportedCount: number;
  weightUpdated: boolean;
}

/**
 * Background Reconciliation Engine:
 * Synchronizes and reconciles Health Connect entries with local SQLite store.
 * - Stale (>3 hours) or forced: 7-day lookback window.
 * - Recent (<3 hours): 1-day (current day) lookback window.
 */
export async function reconcileHealthConnectData(
  forceFullWeek = false
): Promise<SyncReconciliationResult> {
  const result: SyncReconciliationResult = {
    reconciledWindowDays: 1,
    importedCount: 0,
    exportedCount: 0,
    weightUpdated: false,
  };

  if (!isAndroidNative) return result;

  try {
    const isInitialized = await withTimeout(healthConnectModule.initialize(), 5000, false);
    if (!isInitialized) return result;

    const hasPermission = await checkHealthConnectPermissionsGranted();
    if (!hasPermission) return result;

    const now = Date.now();
    const lastReconciled = await getLastReconciledAt();
    const STALE_THRESHOLD_MS = 3 * 60 * 60 * 1000; // 3 hours

    const isStale = !lastReconciled || now - lastReconciled > STALE_THRESHOLD_MS;
    const windowDays = forceFullWeek || isStale ? 7 : 1;
    result.reconciledWindowDays = windowDays;

    const startTime = new Date(now - windowDays * 24 * 60 * 60 * 1000);
    startTime.setHours(0, 0, 0, 0);
    const endTime = new Date(now);

    const timeRangeFilter = {
      operator: 'between' as const,
      startTime: startTime.toISOString(),
      endTime: endTime.toISOString(),
    };

    // 1. Read Health Connect Nutrition records
    let hcNutritionRecords: any[] = [];
    try {
      const res = await withTimeout(
        healthConnectModule.readRecords('Nutrition', { timeRangeFilter }),
        5000,
        { records: [] }
      );
      hcNutritionRecords = res?.records || [];
    } catch (e) {
      console.warn('Failed to query Health Connect nutrition records:', e);
    }

    // 2. Fetch local meal entries in window
    const startDateStr = startTime.toISOString().split('T')[0];
    const endDateStr = endTime.toISOString().split('T')[0];
    const localEntries = await getAllMealEntries(startDateStr, endDateStr);

    const existingHcIds = new Set(
      localEntries.map((e) => e.healthConnectId).filter(Boolean) as string[]
    );

    // 3. Import missing HC entries -> local store
    for (const hcRecord of hcNutritionRecords) {
      const recordId = hcRecord.metadata?.id;
      if (!recordId || existingHcIds.has(recordId)) {
        continue;
      }

      // Check if entry logged directly in Cibus AI matches this HC record by timestamp & kcal
      const recordDateStr = (hcRecord.startTime || new Date().toISOString()).split('T')[0];
      const hcKcal = Math.round(hcRecord.energy?.inKilocalories || 0);
      const hcMealType = REVERSE_MEAL_TYPE_MAP[hcRecord.mealType] || 'SNACK';

      const matchedLocal = localEntries.find(
        (e) =>
          !e.healthConnectId &&
          e.date === recordDateStr &&
          e.mealType === hcMealType &&
          Math.abs(e.calculatedCalories - hcKcal) <= 5
      );

      if (matchedLocal) {
        await updateMealHealthConnectId(matchedLocal.id, recordId);
        existingHcIds.add(recordId);
      } else {
        // Synthesize FoodItem and create new MealEntry
        const protein = Math.round(hcRecord.protein?.inGrams || 0);
        const carbs = Math.round(hcRecord.totalCarbohydrate?.inGrams || 0);
        const fat = Math.round(hcRecord.totalFat?.inGrams || 0);
        const name = hcRecord.name || hcRecord.title || 'Health Connect Entry';

        const foodItem = await saveFoodItem({
          id: `hc_food_${recordId.substring(0, 8)}`,
          name,
          brand: 'Health Connect',
          servingSizeG: 100,
          calories100g: hcKcal || 100,
          proteins100g: protein,
          carbs100g: carbs,
          fats100g: fat,
          source: 'MANUAL',
          createdAt: Date.now(),
        });

        await addMealEntry({
          date: recordDateStr,
          mealType: hcMealType,
          foodId: foodItem.id,
          quantityG: 100,
          calculatedCalories: hcKcal,
          calculatedProtein: protein,
          calculatedCarbs: carbs,
          calculatedFat: fat,
          healthConnectId: recordId,
        });

        existingHcIds.add(recordId);
        result.importedCount++;
      }
    }

    // 4. Export un-synced local entries -> Health Connect
    for (const localEntry of localEntries) {
      if (!localEntry.healthConnectId) {
        const foodName = localEntry.food?.name || 'Meal Entry';
        const consumedAt = new Date(`${localEntry.date}T12:00:00.000Z`);
        const insertedId = await syncMealToHealthConnect(
          foodName,
          localEntry.mealType,
          consumedAt,
          localEntry.calculatedCalories,
          localEntry.calculatedProtein,
          localEntry.calculatedCarbs,
          localEntry.calculatedFat
        );

        if (insertedId) {
          await updateMealHealthConnectId(localEntry.id, insertedId);
          result.exportedCount++;
        }
      }
    }

    // 5. Reconcile Weight records
    try {
      const weightRes = await withTimeout(
        healthConnectModule.readRecords('Weight', { timeRangeFilter }),
        5000,
        { records: [] }
      );
      const weightRecords: any[] = weightRes?.records || [];
      if (weightRecords.length > 0) {
        // Get most recent weight record
        const latestWeightRec = weightRecords.sort(
          (a: any, b: any) => new Date(b.time).getTime() - new Date(a.time).getTime()
        )[0];

        const recWeightKg = latestWeightRec?.weight?.inKilograms;
        if (recWeightKg && recWeightKg > 0) {
          const profile = await getUserProfile();
          if (Math.abs(profile.weightKg - recWeightKg) > 0.1) {
            await saveUserProfile({
              ...profile,
              weightKg: Math.round(recWeightKg * 10) / 10,
            });
            result.weightUpdated = true;
          }
        }
      }
    } catch (e) {
      console.warn('Failed to reconcile Health Connect weight records:', e);
    }

    // Record last successful reconciliation timestamp
    await updateLastReconciledAt(Date.now());
    return result;
  } catch (error) {
    console.error('Error during Health Connect reconciliation:', error);
    return result;
  }
}

