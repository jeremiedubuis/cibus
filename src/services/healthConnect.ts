import { Platform } from 'react-native';
import { ActivityEntry, DailyExpenditure, FoodItem, MealType, SleepEntry, SportActivityType } from '../types';
import { calculateBMR } from './nutritionCalculator';
import { assignSleepDateAndType, calculateSleepQualityScore } from './sleepCalculator';
import { generateSyntheticHeartRateSamples } from './heartRateCalculator';
import {
  addActivityEntry,
  addMealEntry,
  addSleepEntry,
  getActivityEntriesByDate,
  getAllActivityEntries,
  getAllMealEntries,
  getAllSleepEntries,
  getLastReconciledAt,
  getUserProfile,
  saveFoodItem,
  saveUserProfile,
  searchLocalFoods,
  updateActivityHealthConnectId,
  updateLastReconciledAt,
  updateMealHealthConnectId,
  updateSleepHealthConnectId,
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

export const EXERCISE_TYPE_MAP: Record<SportActivityType, number> = {
  RUNNING: 56,
  ELLIPTICAL: 25,
  CALISTHENICS: 13,
  SWIMMING: 71,
  BICYCLE: 8,
  CLIMBING: 55,
  WALKING: 79,
  CROSSFIT: 19,
  CANICROSS: 56,
  WEIGHTS: 82,
};

export const REVERSE_EXERCISE_TYPE_MAP: Record<number, SportActivityType> = {
  56: 'RUNNING',
  25: 'ELLIPTICAL',
  13: 'CALISTHENICS',
  71: 'SWIMMING',
  70: 'SWIMMING',
  8: 'BICYCLE',
  55: 'CLIMBING',
  79: 'WALKING',
  19: 'CROSSFIT',
  82: 'WEIGHTS',
  80: 'WEIGHTS',
};

let healthConnectModule: any = null;

try {
  healthConnectModule = require('react-native-health-connect');
} catch (e) {
  // Native module unavailable (e.g. web/simulator/test env)
  healthConnectModule = null;
}

const isAndroidNative = Platform.OS === 'android' && healthConnectModule !== null;

const ACTIVITY_READ_PERMISSIONS = [
  { accessType: 'read', recordType: 'ActiveCaloriesBurned' },
  { accessType: 'read', recordType: 'TotalCaloriesBurned' },
  { accessType: 'read', recordType: 'ExerciseSession' },
  { accessType: 'read', recordType: 'Steps' },
  { accessType: 'read', recordType: 'Distance' },
  { accessType: 'read', recordType: 'HeartRate' },
] as const;

/**
 * Estimate walking calories from the deduplicated daily step count. Health
 * Connect exposes workout energy and steps as separate record types, so the
 * energy budget combines both contributions.
 */
export function estimateStepCalories(stepCount: number, weightKg: number): number {
  if (!Number.isFinite(stepCount) || !Number.isFinite(weightKg) || stepCount <= 0 || weightKg <= 0) {
    return 0;
  }

  // Approx. 0.0005 kcal per step per kg (about 35 kcal / 1,000 steps at 70 kg).
  return Math.round(stepCount * weightKg * 0.0005);
}

export function calculateDailyBurnedCalories(
  activityCaloriesKcal: number,
  stepCount: number,
  weightKg: number
): number {
  const activityCalories = Number.isFinite(activityCaloriesKcal)
    ? Math.max(0, Math.round(activityCaloriesKcal))
    : 0;
  return activityCalories + estimateStepCalories(stepCount, weightKg);
}

export function estimateActivityCalories(
  activityType: SportActivityType,
  durationMinutes: number,
  weightKg: number = 75
): number {
  const metMap: Record<SportActivityType, number> = {
    RUNNING: 9.8,
    BICYCLE: 7.5,
    SWIMMING: 8.0,
    CLIMBING: 7.0,
    WALKING: 3.8,
    CROSSFIT: 8.5,
    CANICROSS: 10.0,
    WEIGHTS: 5.0,
    CALISTHENICS: 6.0,
    ELLIPTICAL: 7.0,
  };
  const met = metMap[activityType] || 7.0;
  const safeWeight = weightKg > 0 ? weightKg : 75;
  const safeDuration = Math.max(1, durationMinutes);
  return Math.round((met * 3.5 * safeWeight / 200) * safeDuration);
}

export async function fetchExerciseSessionCalories(
  hcRecord: any,
  durationMinutes: number,
  activityType: SportActivityType,
  userWeightKg: number
): Promise<number> {
  const directKcal =
    hcRecord.activeCalories?.inKilocalories ||
    hcRecord.energy?.inKilocalories ||
    hcRecord.totalEnergy?.inKilocalories;

  if (directKcal && directKcal > 0) {
    return Math.round(directKcal);
  }

  if (isAndroidNative && hcRecord.startTime && hcRecord.endTime) {
    try {
      const activeCalRes = await withTimeout(
        healthConnectModule.readRecords('ActiveCaloriesBurned', {
          timeRangeFilter: {
            operator: 'between',
            startTime: hcRecord.startTime,
            endTime: hcRecord.endTime,
          },
        }),
        3000,
        { records: [] }
      );
      const activeSum = (activeCalRes?.records || []).reduce(
        (sum: number, r: any) => sum + (r.energy?.inKilocalories || 0),
        0
      );
      if (activeSum > 0) {
        return Math.round(activeSum);
      }
    } catch (err) {
      console.warn('Failed to query ActiveCaloriesBurned for exercise session:', err);
    }
  }

  return estimateActivityCalories(activityType, durationMinutes, userWeightKg);
}

function withTimeout<T>(promise: Promise<T>, timeoutMs = 2000, fallbackValue: T): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((resolve) => setTimeout(() => resolve(fallbackValue), timeoutMs)),
  ]);
}

function hasRequiredHealthConnectPermissions(permissions: any[]): boolean {
  const hasReadPermission = (recordType: string) =>
    permissions.some((permission: any) =>
      permission.recordType === recordType && permission.accessType === 'read'
    );

  return hasReadPermission('Nutrition') &&
    hasReadPermission('ActiveCaloriesBurned') &&
    hasReadPermission('Steps');
}

/**
 * Google Health may write exercise energy as TotalCaloriesBurned. These
 * records include basal energy, so retain only the fraction within an exercise
 * session and subtract baseline BMR for that same fraction of time.
 */
export function getExerciseSessionNetActiveCalories(
  totalCalorieRecords: any[],
  exerciseSessions: any[],
  bmrKcalPerDay: number
): number {
  if (!Number.isFinite(bmrKcalPerDay) || bmrKcalPerDay <= 0) return 0;

  const sessions = exerciseSessions
    .map((session) => ({
      start: Date.parse(session.startTime),
      end: Date.parse(session.endTime),
    }))
    .filter(({ start, end }) => Number.isFinite(start) && Number.isFinite(end) && end > start);

  const bmrKcalPerMillisecond = bmrKcalPerDay / (24 * 60 * 60 * 1000);
  const MAX_WORKOUT_ENERGY_RECORD_MS = 6 * 60 * 60 * 1000;

  return totalCalorieRecords.reduce((sum, record) => {
    const start = Date.parse(record.startTime);
    const end = Date.parse(record.endTime);
    const grossEnergy = record.energy?.inKilocalories;
    const durationMs = end - start;
    if (!Number.isFinite(start) || !Number.isFinite(end) || durationMs <= 0 ||
      durationMs > MAX_WORKOUT_ENERGY_RECORD_MS ||
      !Number.isFinite(grossEnergy) || grossEnergy <= 0) {
      return sum;
    }

    // Exercise sessions should not overlap; cap the matched fraction to avoid
    // ever counting the same total-energy interval twice.
    const matchedDurationMs = Math.min(durationMs, sessions.reduce((matched, session) =>
      matched + Math.max(0, Math.min(end, session.end) - Math.max(start, session.start)), 0));
    if (matchedDurationMs === 0) return sum;

    const matchedFraction = matchedDurationMs / durationMs;
    const netEnergy = grossEnergy * matchedFraction - bmrKcalPerMillisecond * matchedDurationMs;
    return sum + Math.max(0, netEnergy);
  }, 0);
}

/**
 * Health Connect's duration aggregation applies source-priority deduplication.
 * Removing only buckets that overlap a logged workout avoids adding a walking
 * workout's steps both as workout energy and as a step estimate.
 */
export function getStepCountOutsideExerciseSessions(
  stepBuckets: any[],
  exerciseSessions: any[]
): number {
  const sessions = exerciseSessions
    .map((session) => ({ start: Date.parse(session.startTime), end: Date.parse(session.endTime) }))
    .filter(({ start, end }) => Number.isFinite(start) && Number.isFinite(end) && end > start);

  return stepBuckets.reduce((sum, bucket) => {
    const start = Date.parse(bucket.startTime);
    const end = Date.parse(bucket.endTime);
    const count = bucket.result?.COUNT_TOTAL;
    const durationMs = end - start;
    if (!Number.isFinite(start) || !Number.isFinite(end) || durationMs <= 0 ||
      !Number.isFinite(count) || count <= 0) {
      return sum;
    }

    const overlappingMs = Math.min(durationMs, sessions.reduce((overlap, session) =>
      overlap + Math.max(0, Math.min(end, session.end) - Math.max(start, session.start)), 0));
    return sum + count * (1 - overlappingMs / durationMs);
  }, 0);
}

export async function isHealthConnectAvailable(): Promise<boolean> {
  if (!isAndroidNative) return false;
  try {
    return await withTimeout(healthConnectModule.initialize(), 5000, false);
  } catch (err) {
    return false;
  }
}

export interface HealthConnectPermissionStatus {
  nutritionGranted: boolean;
  activityGranted: boolean;
  sleepGranted?: boolean;
  allGranted: boolean;
}

export function checkHasNutritionPermissions(permissions: any[]): boolean {
  const hasRead = (recordType: string) =>
    permissions.some((p: any) => p.recordType === recordType && p.accessType === 'read');
  const hasWrite = (recordType: string) =>
    permissions.some((p: any) => p.recordType === recordType && p.accessType === 'write');

  return hasRead('Nutrition') && hasWrite('Nutrition');
}

export function checkHasActivityPermissions(permissions: any[]): boolean {
  const hasRead = (recordType: string) =>
    permissions.some((p: any) => p.recordType === recordType && p.accessType === 'read');
  const hasWrite = (recordType: string) =>
    permissions.some((p: any) => p.recordType === recordType && p.accessType === 'write');

  return hasRead('ExerciseSession') && hasWrite('ExerciseSession');
}

export function checkHasSleepPermissions(permissions: any[]): boolean {
  return permissions.some((p: any) => p.recordType === 'SleepSession' && p.accessType === 'read');
}

export async function checkHealthConnectGranularPermissions(): Promise<HealthConnectPermissionStatus> {
  const fallback = { nutritionGranted: false, activityGranted: false, sleepGranted: false, allGranted: false };
  if (!isAndroidNative) return fallback;

  try {
    const isInitialized = await withTimeout(healthConnectModule.initialize(), 5000, false);
    if (!isInitialized) return fallback;

    const granted = await withTimeout(healthConnectModule.getGrantedPermissions(), 5000, []);
    const nutritionGranted = checkHasNutritionPermissions(granted || []);
    const activityGranted = checkHasActivityPermissions(granted || []);
    const sleepGranted = checkHasSleepPermissions(granted || []);

    return {
      nutritionGranted,
      activityGranted,
      sleepGranted,
      allGranted: nutritionGranted && activityGranted && sleepGranted,
    };
  } catch (error) {
    return fallback;
  }
}

export function openHealthConnectSettings(): void {
  if (!isAndroidNative || typeof healthConnectModule?.openHealthConnectSettings !== 'function') return;
  try {
    healthConnectModule.openHealthConnectSettings();
  } catch (err) {
    console.warn('Failed to open Health Connect settings:', err);
  }
}

export async function requestHealthConnectPermissions(): Promise<boolean> {
  if (!isAndroidNative) return false;
  try {
    const isInitialized = await withTimeout(healthConnectModule.initialize(), 5000, false);
    if (!isInitialized) return false;

    // Standard permissions required for Nutrition, Sport Activity, and Sleep sync
    const requiredPermissions: any[] = [
      { accessType: 'write', recordType: 'Nutrition' },
      { accessType: 'read', recordType: 'Nutrition' },
      { accessType: 'write', recordType: 'ExerciseSession' },
      { accessType: 'read', recordType: 'ExerciseSession' },
      { accessType: 'write', recordType: 'ActiveCaloriesBurned' },
      { accessType: 'read', recordType: 'ActiveCaloriesBurned' },
      { accessType: 'write', recordType: 'Distance' },
      { accessType: 'read', recordType: 'Distance' },
      { accessType: 'read', recordType: 'TotalCaloriesBurned' },
      { accessType: 'read', recordType: 'Steps' },
      { accessType: 'write', recordType: 'Weight' },
      { accessType: 'read', recordType: 'Weight' },
      { accessType: 'read', recordType: 'SleepSession' },
    ];

    try {
      await withTimeout(
        healthConnectModule.requestPermission(requiredPermissions),
        10000,
        []
      );
    } catch (reqErr) {
      console.warn('Primary Health Connect permissions request error:', reqErr);
    }

    // Try requesting history permission separately if supported (API 34+)
    try {
      await withTimeout(
        healthConnectModule.requestPermission([
          { accessType: 'read', recordType: 'ReadHealthDataHistory' },
        ]),
        3000,
        []
      );
    } catch {
      // Optional history permission fallback
    }

    let status = await checkHealthConnectGranularPermissions();

    // If permissions are still not granted (e.g. system dialog was previously dismissed), open settings
    if (!status.nutritionGranted || !status.activityGranted) {
      openHealthConnectSettings();
    }

    return status.nutritionGranted || status.activityGranted;
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
    return hasRequiredHealthConnectPermissions(granted || []);
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
 * Syncs a logged sport activity entry directly into Google Health Connect as an ExerciseSession Record
 */
export async function syncActivityToHealthConnect(
  activity: ActivityEntry
): Promise<string | null> {
  if (!isAndroidNative) {
    return `mock_hc_act_${Date.now()}`;
  }

  try {
    const isInitialized = await withTimeout(healthConnectModule.initialize(), 5000, false);
    if (!isInitialized) return null;

    const startTimeDate = new Date(activity.startTime);
    const durationMs = (activity.durationMinutes || 20) * 60 * 1000;
    const endTimeDate = new Date(startTimeDate.getTime() + durationMs);

    const exerciseTypeConstant = EXERCISE_TYPE_MAP[activity.activityType] || 0;
    const titleMap: Record<SportActivityType, string> = {
      RUNNING: 'Running',
      ELLIPTICAL: 'Elliptical bike',
      CALISTHENICS: 'Calisthenics',
      SWIMMING: 'Swimming',
      BICYCLE: 'Bicycle',
      CLIMBING: 'Climbing',
      WALKING: 'Walking',
      CROSSFIT: 'Cross-fit',
      CANICROSS: 'Canicross',
      WEIGHTS: 'Weights',
    };

    const sessionRecord = {
      recordType: 'ExerciseSession' as const,
      startTime: startTimeDate.toISOString(),
      endTime: endTimeDate.toISOString(),
      exerciseType: exerciseTypeConstant,
      title: titleMap[activity.activityType] || 'Sport Activity',
    };

    const insertedIds = await withTimeout<string[] | null>(
      healthConnectModule.insertRecords([sessionRecord]),
      5000,
      null
    );

    if (insertedIds && insertedIds.length > 0) {
      if (activity.caloriesKcal > 0) {
        try {
          await withTimeout(
            healthConnectModule.insertRecords([
              {
                recordType: 'ActiveCaloriesBurned' as const,
                startTime: startTimeDate.toISOString(),
                endTime: endTimeDate.toISOString(),
                energy: { value: activity.caloriesKcal, unit: 'kilocalories' },
              },
            ]),
            5000,
            null
          );
        } catch (calErr) {
          console.warn('Failed to insert ActiveCaloriesBurned record:', calErr);
        }
      }

      if (activity.distanceKm && activity.distanceKm > 0) {
        try {
          await withTimeout(
            healthConnectModule.insertRecords([
              {
                recordType: 'Distance' as const,
                startTime: startTimeDate.toISOString(),
                endTime: endTimeDate.toISOString(),
                distance: { value: activity.distanceKm * 1000, unit: 'meters' },
              },
            ]),
            5000,
            null
          );
        } catch (distErr) {
          console.warn('Failed to insert Distance record:', distErr);
        }
      }

      return insertedIds[0];
    }
    return null;
  } catch (error) {
    console.error('Error syncing activity to Health Connect:', error);
    return null;
  }
}

/**
 * Reads Active Calories Burned and Step Count metrics from Health Connect for target date
 */
export async function fetchDailyBurnedMetrics(targetDate: Date): Promise<DailyExpenditure> {
  const fallback = {
    activityCaloriesKcal: 0,
    stepCaloriesKcal: 0,
    activeCaloriesKcal: 0,
    stepCount: 0,
    regularStepCount: 0,
    activityStepCount: 0,
  };
  if (!isAndroidNative) return fallback;

  try {
    const isInitialized = await withTimeout(healthConnectModule.initialize(), 5000, false);
    if (!isInitialized) return fallback;

    const profile = await getUserProfile();
    const bmrKcalPerDay = calculateBMR(profile.weightKg, profile.heightCm, profile.age, profile.sex);

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
    let exerciseSessions: any[] = [];
    try {
      const calAggregate: any = await withTimeout(
        healthConnectModule.aggregateRecord({
          recordType: 'ActiveCaloriesBurned',
          timeRangeFilter,
        }),
        5000,
        null
      );
      if (calAggregate && calAggregate.ACTIVE_CALORIES_TOTAL?.inKilocalories > 0) {
        totalActiveKcal = calAggregate.ACTIVE_CALORIES_TOTAL.inKilocalories;
      } else {
        // Some providers expose a zero aggregate even though their individual
        // workout records are readable. Treat zero as an aggregate miss and
        // use the raw records before concluding there is no activity energy.
        const activeCalorieRecords = await withTimeout(
          healthConnectModule.readRecords('ActiveCaloriesBurned', { timeRangeFilter }),
          5000,
          { records: [] }
        );
        totalActiveKcal = (activeCalorieRecords?.records || []).reduce(
          (acc: number, record: any) => acc + (record.energy?.inKilocalories || 0),
          0
        );
        console.log(
          'HEALTH_CONNECT_DEBUG: active calorie aggregate was empty; read',
          activeCalorieRecords?.records?.length || 0,
          'raw records for',
          totalActiveKcal,
          'kcal'
        );

        // Google Health manually logged workouts are stored as an exercise
        // session plus TotalCaloriesBurned. Only use session-bounded totals
        // as a fallback so daily total/BMR records are never added.
        if (totalActiveKcal === 0) {
          try {
            const [totalCalorieResult, exerciseSessionResult] = await Promise.all([
              withTimeout(
                healthConnectModule.readRecords('TotalCaloriesBurned', { timeRangeFilter }),
                5000,
                { records: [] }
              ),
              withTimeout(
                healthConnectModule.readRecords('ExerciseSession', { timeRangeFilter }),
                5000,
                { records: [] }
              ),
            ]);
            totalActiveKcal = getExerciseSessionNetActiveCalories(
              totalCalorieResult?.records || [],
              exerciseSessionResult?.records || [],
              bmrKcalPerDay
            );
            exerciseSessions = exerciseSessionResult?.records || [];
            console.log(
              'HEALTH_CONNECT_DEBUG: active calories were empty; found',
              totalCalorieResult?.records?.length || 0,
              'total-calorie records and',
              exerciseSessionResult?.records?.length || 0,
              'exercise sessions, using',
              totalActiveKcal,
              'workout kcal'
            );
            console.log(
              'HEALTH_CONNECT_DEBUG: total-calorie record summary',
              (totalCalorieResult?.records || []).map((record: any) => ({
                startTime: record.startTime,
                endTime: record.endTime,
                kcal: record.energy?.inKilocalories,
                source: record.metadata?.dataOrigin,
              }))
            );
          } catch (error) {
            // Existing installs may not yet contain the manifest permission
            // added for this Google Health compatibility fallback.
            console.log('HEALTH_CONNECT_DEBUG: total-calorie workout fallback unavailable:', error);
          }
        }
      }
    } catch (e) {
      console.warn('Failed to aggregate active calories:', e);
    }

    // Ensure exerciseSessions contains all Health Connect exercise sessions and local activity entries
    try {
      const hcSessionResult = await withTimeout(
        healthConnectModule.readRecords('ExerciseSession', { timeRangeFilter }),
        5000,
        { records: [] }
      );
      const hcSessions = hcSessionResult?.records || [];

      const targetDateStr = targetDate.toISOString().split('T')[0];
      const localActivities = await getActivityEntriesByDate(targetDateStr);
      const localSessions = (localActivities || [])
        .filter((act) => act.startTime && (act.durationMinutes || 0) > 0)
        .map((act) => {
          let startMs = Date.parse(act.startTime);
          if (!Number.isFinite(startMs) && act.date && act.startTime) {
            startMs = Date.parse(`${act.date}T${act.startTime}:00`);
          }
          const endMs = startMs + (act.durationMinutes || 0) * 60 * 1000;
          return {
            startTime: new Date(startMs).toISOString(),
            endTime: new Date(endMs).toISOString(),
          };
        })
        .filter((s) => Number.isFinite(Date.parse(s.startTime)) && Number.isFinite(Date.parse(s.endTime)));

      exerciseSessions = [...exerciseSessions, ...hcSessions, ...localSessions];
    } catch (err) {
      console.warn('Failed to read exercise sessions for step window matching:', err);
    }

    // Read Steps Count using Health Connect aggregation engine (deduplicates sources)
    let totalSteps = 0;
    let stepsForCalorieEstimate = 0;
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
      stepsForCalorieEstimate = totalSteps;

      if (exerciseSessions.length > 0) {
        const stepBuckets = await withTimeout(
          healthConnectModule.aggregateGroupByDuration({
            recordType: 'Steps',
            timeRangeFilter,
            timeRangeSlicer: { duration: 'MINUTES', length: 15 },
          }),
          5000,
          []
        );
        stepsForCalorieEstimate = getStepCountOutsideExerciseSessions(stepBuckets || [], exerciseSessions);
      }
    } catch (e) {
      console.warn('Failed to aggregate steps:', e);
    }

    const activityCaloriesKcal = Math.max(0, Math.round(totalActiveKcal));
    const stepCaloriesKcal = estimateStepCalories(stepsForCalorieEstimate, profile.weightKg);

    const regularStepCount = Math.max(0, Math.round(stepsForCalorieEstimate));
    const activityStepCount = Math.max(0, Math.round(totalSteps - regularStepCount));

    return {
      activityCaloriesKcal,
      stepCaloriesKcal,
      activeCaloriesKcal: calculateDailyBurnedCalories(activityCaloriesKcal, stepsForCalorieEstimate, profile.weightKg),
      stepCount: totalSteps,
      regularStepCount,
      activityStepCount,
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

      // Check if entry logged directly in Joules matches this HC record by timestamp & kcal
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
        matchedLocal.healthConnectId = recordId;
      } else {
        // Synthesize FoodItem and create new MealEntry
        const protein = Math.round(hcRecord.protein?.inGrams || 0);
        const carbs = Math.round(hcRecord.totalCarbohydrate?.inGrams || 0);
        const fat = Math.round(hcRecord.totalFat?.inGrams || 0);
        const name = hcRecord.name || hcRecord.title || 'Health Connect Entry';

        // Check if a catalog or user food item matching this name already exists
        const normName = name.toLowerCase().trim();
        const existingFoodMatches = await searchLocalFoods(normName);
        const matchedFood = existingFoodMatches.find(
          (f: FoodItem) => f.name.toLowerCase().trim() === normName
        );

        const foodItem = matchedFood || (await saveFoodItem({
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
        }));

        const newMeal = await addMealEntry({
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
        localEntries.push(newMeal);
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
          localEntry.healthConnectId = insertedId;
          result.exportedCount++;
        }
      }
    }

    // 5. Reconcile ExerciseSession records
    let hcExerciseRecords: any[] = [];
    try {
      const res = await withTimeout(
        healthConnectModule.readRecords('ExerciseSession', { timeRangeFilter }),
        5000,
        { records: [] }
      );
      hcExerciseRecords = res?.records || [];
    } catch (e) {
      console.warn('Failed to query Health Connect exercise records:', e);
    }

    const userProfile = await getUserProfile();
    const localActivities = await getAllActivityEntries(startDateStr, endDateStr);
    const existingHcActivityIds = new Set(
      localActivities.map((a) => a.healthConnectId).filter(Boolean) as string[]
    );

    const parseLocalStartTimeMs = (entry: ActivityEntry): number => {
      if (entry.startTime) {
        const parsed = Date.parse(entry.startTime);
        if (!isNaN(parsed)) return parsed;
        if (entry.startTime.includes(':') && entry.date) {
          return Date.parse(`${entry.date}T${entry.startTime}:00.000Z`);
        }
      }
      return 0;
    };

    for (const hcRecord of hcExerciseRecords) {
      const recordId = hcRecord.metadata?.id;
      if (!recordId || existingHcActivityIds.has(recordId)) {
        continue;
      }

      const recordDateStr = (hcRecord.startTime || new Date().toISOString()).split('T')[0];
      const startMs = Date.parse(hcRecord.startTime || new Date().toISOString());
      const endMs = Date.parse(hcRecord.endTime || hcRecord.startTime || new Date().toISOString());
      const durationMinutes = Math.max(1, Math.round((endMs - startMs) / 60000));
      const activityType: SportActivityType =
        REVERSE_EXERCISE_TYPE_MAP[hcRecord.exerciseType] || 'RUNNING';

      const matchedLocal = localActivities.find((a) => {
        if (a.healthConnectId) return false;
        if (a.date !== recordDateStr) return false;
        const localMs = parseLocalStartTimeMs(a);
        const isTypeMatch = a.activityType === activityType;
        const isTimeMatch = localMs > 0 && Math.abs(localMs - startMs) <= 15 * 60 * 1000;
        return isTypeMatch && isTimeMatch;
      });

      if (matchedLocal) {
        await updateActivityHealthConnectId(matchedLocal.id, recordId);
        existingHcActivityIds.add(recordId);
        matchedLocal.healthConnectId = recordId;
      } else {
        const caloriesKcal = await fetchExerciseSessionCalories(
          hcRecord,
          durationMinutes,
          activityType,
          userProfile.weightKg
        );

        const hrData = generateSyntheticHeartRateSamples(
          hcRecord.startTime || new Date().toISOString(),
          durationMinutes,
          142,
          172
        );
        const newActivity = await addActivityEntry({
          date: recordDateStr,
          startTime: hcRecord.startTime || new Date().toISOString(),
          durationMinutes,
          activityType,
          caloriesKcal,
          healthConnectId: recordId,
          avgHeartRateBpm: hrData.stats.avgHeartRateBpm,
          maxHeartRateBpm: hrData.stats.maxHeartRateBpm,
          minHeartRateBpm: hrData.stats.minHeartRateBpm,
          heartRateSamples: hrData.samples,
          heartRateZones: hrData.zones,
        });
        existingHcActivityIds.add(recordId);
        localActivities.push(newActivity);
        result.importedCount++;
      }
    }

    for (const localActivity of localActivities) {
      if (!localActivity.healthConnectId) {
        const insertedId = await syncActivityToHealthConnect(localActivity);
        if (insertedId) {
          await updateActivityHealthConnectId(localActivity.id, insertedId);
          localActivity.healthConnectId = insertedId;
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

    // 6. Reconcile SleepSession records
    try {
      let hcSleepRecords: any[] = [];
      try {
        const res = await withTimeout(
          healthConnectModule.readRecords('SleepSession', { timeRangeFilter }),
          5000,
          { records: [] }
        );
        hcSleepRecords = res?.records || [];
      } catch (e) {
        console.warn('Failed to query Health Connect sleep records:', e);
      }

      const localSleepEntries = await getAllSleepEntries(startDateStr, endDateStr);
      const existingHcSleepIds = new Set(
        localSleepEntries.map((s) => s.healthConnectId).filter(Boolean) as string[]
      );

      const profile = await getUserProfile();
      const targetSleepMins = profile.targetSleepMinutes || 480;

      for (const hcRecord of hcSleepRecords) {
        const recordId = hcRecord.metadata?.id;
        if (!recordId || existingHcSleepIds.has(recordId)) {
          continue;
        }

        const startTimeStr = hcRecord.startTime || new Date().toISOString();
        const endTimeStr = hcRecord.endTime || startTimeStr;
        const startMs = Date.parse(startTimeStr);
        const endMs = Date.parse(endTimeStr);
        const durationMinutes = Math.max(1, Math.round((endMs - startMs) / 60000));

        const { dateStr, isNap } = assignSleepDateAndType(startTimeStr);

        let deepMins = 0;
        let remMins = 0;
        let lightMins = 0;
        let awakeMins = 0;

        if (Array.isArray(hcRecord.stages)) {
          for (const stage of hcRecord.stages) {
            const stStart = Date.parse(stage.startTime);
            const stEnd = Date.parse(stage.endTime);
            const stDur = Math.max(0, Math.round((stEnd - stStart) / 60000));
            if (stage.stage === 1 || stage.stage === 3 || stage.stage === 'AWAKE') {
              awakeMins += stDur;
            } else if (stage.stage === 5 || stage.stage === 'DEEP') {
              deepMins += stDur;
            } else if (stage.stage === 6 || stage.stage === 'REM') {
              remMins += stDur;
            } else if (stage.stage === 4 || stage.stage === 'LIGHT' || stage.stage === 2 || stage.stage === 'SLEEPING') {
              lightMins += stDur;
            }
          }
        }

        const qualityScore = calculateSleepQualityScore(
          durationMinutes,
          targetSleepMins,
          deepMins > 0 ? deepMins : undefined,
          remMins > 0 ? remMins : undefined,
          awakeMins > 0 ? awakeMins : undefined
        );

        const matchedLocal = localSleepEntries.find(
          (s) =>
            !s.healthConnectId &&
            s.date === dateStr &&
            Math.abs(Date.parse(s.startTime) - startMs) <= 5 * 60 * 1000
        );

        if (matchedLocal) {
          await updateSleepHealthConnectId(matchedLocal.id, recordId);
          existingHcSleepIds.add(recordId);
          matchedLocal.healthConnectId = recordId;
        } else {
          const newSleep = await addSleepEntry({
            date: dateStr,
            startTime: startTimeStr,
            endTime: endTimeStr,
            durationMinutes,
            qualityScore,
            isNap,
            deepSleepMinutes: deepMins || undefined,
            remSleepMinutes: remMins || undefined,
            lightSleepMinutes: lightMins || undefined,
            awakeMinutes: awakeMins || undefined,
            healthConnectId: recordId,
            source: 'HEALTH_CONNECT',
          });
          existingHcSleepIds.add(recordId);
          localSleepEntries.push(newSleep);
          result.importedCount++;
        }
      }
    } catch (e) {
      console.warn('Failed to reconcile Health Connect sleep records:', e);
    }

    // Record last successful reconciliation timestamp
    await updateLastReconciledAt(Date.now());
    return result;
  } catch (error) {
    console.error('Error during Health Connect reconciliation:', error);
    return result;
  }
}
