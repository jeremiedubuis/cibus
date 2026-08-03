export type BiologicalSex = 'MALE' | 'FEMALE';

export type ActivityFactor = 1.0 | 1.2 | 1.375 | 1.55 | 1.725 | 1.9;

export type GoalType = 'WEIGHT_LOSS' | 'MAINTENANCE' | 'MUSCLE_GAIN' | 'RECOMP';

export type MealType = 'BREAKFAST' | 'LUNCH' | 'DINNER' | 'SNACK';

export type FoodSource = 'OFF_API' | 'OCR_CUSTOM' | 'MANUAL' | 'CIQUAL' | 'SWISS' | 'FINELI';

export type SportActivityType =
  | 'RUNNING'
  | 'BICYCLE'
  | 'SWIMMING'
  | 'CLIMBING'
  | 'CALISTHENICS'
  | 'ELLIPTICAL'
  | 'WALKING'
  | 'CROSSFIT'
  | 'CANICROSS'
  | 'WEIGHTS';

export type AppTab = 'NUTRITION' | 'ACTIVITIES' | 'SLEEP';

export interface UserProfile {
  id: string;
  weightKg: number;
  targetWeightKg: number;
  heightCm: number;
  age: number;
  sex: BiologicalSex;
  activityFactor: ActivityFactor;
  goalType: GoalType;
  wantMuscleGain: boolean;
  calorieTarget: number;
  proteinTargetG: number;
  carbTargetG: number;
  fatTargetG: number;
  breakfastPct: number;
  lunchPct: number;
  dinnerPct: number;
  snackPct: number;
  defaultWorkoutDurationMinutes?: number;
  targetSleepMinutes?: number;
  updatedAt: number;
  lastReconciledAt?: number;
}

export type SleepStageType =
  | 'AWAKE'
  | 'LIGHT'
  | 'DEEP'
  | 'REM'
  | 'OUT_OF_BED'
  | 'SLEEPING'
  | 'UNKNOWN';

export interface SleepStage {
  stage: SleepStageType;
  startTime: string; // ISO string
  endTime: string; // ISO string
  durationMinutes: number;
}

export interface SleepEntry {
  id: string;
  date: string; // YYYY-MM-DD (date sleep/wake is assigned to)
  startTime: string; // ISO string
  endTime: string; // ISO string
  durationMinutes: number;
  qualityScore: number; // 0-100
  isNap: boolean;
  deepSleepMinutes?: number;
  remSleepMinutes?: number;
  lightSleepMinutes?: number;
  awakeMinutes?: number;
  stages?: SleepStage[];
  healthConnectId?: string | null;
  source?: 'HEALTH_CONNECT' | 'MANUAL';
  notes?: string;
}

export interface HeartRateSample {
  timestamp: string; // ISO string
  bpm: number;
}

export interface HeartRateZones {
  zone1Minutes: number; // Warm up (<60% max HR)
  zone2Minutes: number; // Fat Burn (60-70% max HR)
  zone3Minutes: number; // Aerobic (70-80% max HR)
  zone4Minutes: number; // Anaerobic (80-90% max HR)
  zone5Minutes: number; // Maximum / Extreme (90-100% max HR)
}

export interface ActivityEntry {
  id: string;
  date: string; // YYYY-MM-DD
  startTime: string; // ISO string or HH:mm string with date context
  durationMinutes: number;
  activityType: SportActivityType;
  caloriesKcal: number;
  distanceKm?: number | null;
  healthConnectId?: string | null;
  avgHeartRateBpm?: number | null;
  maxHeartRateBpm?: number | null;
  minHeartRateBpm?: number | null;
  heartRateSamples?: HeartRateSample[];
  heartRateZones?: HeartRateZones;
}

export interface PortionOption {
  id: string;
  label: string; // e.g. "1 unit", "1 portion", "1 glass", "1 slice", "Grams (g)"
  gramWeight: number; // weight in grams for 1 unit of this portion
  unitName?: string; // e.g. "unit", "portion", "glass", "slice", "g"
}

export interface FoodItem {
  id: string;
  barcode?: string;
  name: string;
  brand?: string;
  servingSizeG: number;
  servingName?: string;
  portions?: PortionOption[];
  calories100g: number;
  proteins100g: number;
  carbs100g: number;
  fats100g: number;
  fiber100g?: number;
  sodiumMg100g?: number;
  source: FoodSource;
  createdAt: number;
  isAdded?: boolean;
  addedAt?: number;
}

export interface MealEntry {
  id: string;
  date: string; // YYYY-MM-DD
  mealType: MealType;
  foodId: string;
  quantityG: number;
  selectedPortionId?: string;
  portionQuantity?: number;
  calculatedCalories: number;
  calculatedProtein: number;
  calculatedCarbs: number;
  calculatedFat: number;
  healthConnectId?: string | null;
  food?: FoodItem;
}

export interface ParsedNutrition {
  calories: number | null;
  protein: number | null;
  carbs: number | null;
  fat: number | null;
}

export interface DailyExpenditure {
  /** Calories reported by Health Connect activity sources, e.g. workouts. */
  activityCaloriesKcal: number;
  /** Estimated walking calories from the deduplicated daily step count. */
  stepCaloriesKcal: number;
  activeCaloriesKcal: number;
  stepCount: number;
  regularStepCount: number;
  activityStepCount: number;
}

export interface MacroDistribution {
  carbsPct: number;
  proteinPct: number;
  fatPct: number;
}

export interface CalculatedTargets {
  bmr: number;
  tdee: number;
  baseCalorieTarget: number;
  proteinG: number;
  carbG: number;
  fatG: number;
  mealBudgets: Record<MealType, number>;
  weightDiffKg: number;
  calorieAdjustment: number;
  isHealthyWeight: boolean;
  minHealthyWeightKg: number;
  targetBmi: number;
  derivedGoalType: GoalType;
}

export type InAppUpdateStatus =
  | 'IDLE'
  | 'CHECKING'
  | 'UPDATE_AVAILABLE'
  | 'DOWNLOADING'
  | 'DOWNLOADED'
  | 'UP_TO_DATE'
  | 'ERROR';

export interface InAppUpdateInfo {
  shouldUpdate: boolean;
  updatePriority?: number;
  availableVersionCode?: number;
}
