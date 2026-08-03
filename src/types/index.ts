export type BiologicalSex = 'MALE' | 'FEMALE';

export type ActivityFactor = 1.0 | 1.2 | 1.375 | 1.55 | 1.725 | 1.9;

export type GoalType = 'WEIGHT_LOSS' | 'MAINTENANCE' | 'MUSCLE_GAIN' | 'RECOMP';

export type MealType = 'BREAKFAST' | 'LUNCH' | 'DINNER' | 'SNACK';

export type FoodSource = 'OFF_API' | 'OCR_CUSTOM' | 'MANUAL' | 'CIQUAL' | 'SWISS' | 'FINELI';

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
  updatedAt: number;
  lastReconciledAt?: number;
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
  activeCaloriesKcal: number;
  stepCount: number;
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
