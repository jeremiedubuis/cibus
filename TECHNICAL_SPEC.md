# Technical Specification: Daily Nutrition & Health Connect Sync (Android / React Native)

## 1. Executive Summary & System Architecture

This specification outlines a local-first, privacy-focused Android nutrition tracker built with **React Native (Bare / Expo Prebuild)**, **TypeScript**, **Local SQLite**, and **Google Health Connect**. The application operates offline-first, storing user records in local storage and syncing nutrition records to the Android system.

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                            REACT NATIVE APP CORE                             │
├──────────────────┬────────────────────────────┬──────────────────────────────┤
│ UI Layer         │ React Native + Reanimated  │ Day-by-Day Dashboard, Meals  │
│ State / Storage  │ WatermelonDB / SQLite      │ Profiles, Meal Logs, Foods   │
├──────────────────┼────────────────────────────┼──────────────────────────────┤
│ Scan Engine      │ Vision Camera + ML Kit     │ Barcode Scan & Label OCR     │
│ Remote Sync      │ Open Food Facts REST API   │ Product Search & Publishing  │
│ Health Sync      │ Health Connect SDK Bridge  │ Dual-way Nutrition, Steps,   │
│                  │                            │ & Active Calories Burned     │
│ Update / Delivery│ Play In-App Updates SDK    │ Flexible & Immediate Updates │
└──────────────────┴────────────────────────────┴──────────────────────────────┘
```

---

## 2. Technical Stack & Native Modules

* **Framework:** React Native `0.74+` with **Expo Dev Client** (`npx expo run:android`)
* **Language:** TypeScript
* **Database:** `watermelondb` or `react-native-quick-sqlite` (High-performance JSI SQLite)
* **Camera & Machine Learning:**
  * `react-native-vision-camera` (v4+)
  * `@react-native-ml-kit/barcode-scanning`
  * `@react-native-ml-kit/text-recognition`
* **Health Sync:** `react-native-health-connect`
* **In-App Updates:** `sp-react-native-in-app-updates` or `expo-in-app-updates` (Play Core In-App Updates API)
* **Network Client:** Axios / Fetch API targeting `https://world.openfoodfacts.org`

---

## 3. Data Schema & Local Storage Structure

### 3.1 User Profile & Target Formulas

#### User Inputs
* **Weight** ($W$ in kg)
* **Height** ($H$ in cm)
* **Age** ($A$ in years)
* **Biological Sex:** `MALE` | `FEMALE`
* **Activity Factor ($AF$):**
  * Sedentary ($1.2$)
  * Lightly Active ($1.375$)
  * Moderately Active ($1.55$)
  * Very Active ($1.725$)
  * Extra Active ($1.9$)
* **Goal Type:**
  * `WEIGHT_LOSS` (Caloric Deficit: $-15\%$ to $-20\%$)
  * `MAINTENANCE` (Caloric Surplus/Deficit: $0\%$)
  * `MUSCLE_GAIN` (Caloric Surplus: $+10\%$ to $+15\%$)

#### Baseline BMR Formula (Mifflin-St Jeor)
$$\text{BMR}_{\text{male}} = (10 \times W) + (6.25 \times H) - (5 \times A) + 5$$
$$\text{BMR}_{\text{female}} = (10 \times W) + (6.25 \times H) - (5 \times A) - 161$$

$$\text{TDEE} = \text{BMR} \times AF$$
$$\text{Base Daily Calorie Target} = \text{TDEE} \times (1 + \text{GoalModifier})$$
$$\text{Dynamic Daily Budget} = \text{Base Daily Calorie Target} + \text{Active Calories Burned (Health Connect)}$$

#### Macro Target Presets
* **Maintenance / Balanced:** $50\%$ Carbs, $20\%$ Protein, $30\%$ Fat
* **Weight Loss / High Protein:** $40\%$ Carbs, $30\%$ Protein, $30\%$ Fat
* **Muscle Gain:** $55\%$ Carbs, $25\%$ Protein, $20\%$ Fat

#### Configurable Meal Calorie Distribution Defaults
* **Breakfast:** $25\%$
* **Lunch:** $35\%$
* **Dinner:** $30\%$
* **Snacks:** $10\%$

---

### 3.2 Database Models (SQLite)

```sql
-- User Profiles & Settings
CREATE TABLE user_profile (
    id TEXT PRIMARY KEY,
    weight_kg REAL NOT NULL,
    height_cm REAL NOT NULL,
    age INTEGER NOT NULL,
    sex TEXT CHECK(sex IN ('MALE', 'FEMALE')) NOT NULL,
    activity_factor REAL NOT NULL,
    goal_type TEXT CHECK(goal_type IN ('WEIGHT_LOSS', 'MAINTENANCE', 'MUSCLE_GAIN')) NOT NULL,
    calorie_target INTEGER NOT NULL,
    protein_target_g REAL NOT NULL,
    carb_target_g REAL NOT NULL,
    fat_target_g REAL NOT NULL,
    breakfast_pct REAL DEFAULT 0.25,
    lunch_pct REAL DEFAULT 0.35,
    dinner_pct REAL DEFAULT 0.30,
    snack_pct REAL DEFAULT 0.10,
    updated_at INTEGER NOT NULL
);

-- Master Local Food Catalog (Cached from OFF + Custom OCR entries)
CREATE TABLE foods (
    id TEXT PRIMARY KEY, -- OFF Barcode or Generated UUID
    barcode TEXT UNIQUE,
    name TEXT NOT NULL,
    brand TEXT,
    serving_size_g REAL DEFAULT 100.0,
    calories_100g REAL NOT NULL,
    proteins_100g REAL NOT NULL,
    carbs_100g REAL NOT NULL,
    fats_100g REAL NOT NULL,
    fiber_100g REAL DEFAULT 0.0,
    sodium_mg_100g REAL DEFAULT 0.0,
    source TEXT CHECK(source IN ('OFF_API', 'OCR_CUSTOM', 'MANUAL')) NOT NULL,
    created_at INTEGER NOT NULL
);

-- Daily Meal Logs
CREATE TABLE meal_entries (
    id TEXT PRIMARY KEY,
    date TEXT NOT NULL, -- Format: YYYY-MM-DD
    meal_type TEXT CHECK(meal_type IN ('BREAKFAST', 'LUNCH', 'DINNER', 'SNACK')) NOT NULL,
    food_id TEXT NOT NULL,
    quantity_g REAL NOT NULL,
    calculated_calories REAL NOT NULL,
    calculated_protein REAL NOT NULL,
    calculated_carbs REAL NOT NULL,
    calculated_fat REAL NOT NULL,
    health_connect_id TEXT, -- Null if not yet synced
    FOREIGN KEY(food_id) REFERENCES foods(id)
);
```

---

## 4. UI/UX Architecture & Screen Flows

```
[ Root App Navigation ]
  ├── 1. Onboarding / Profile Settings Screen
  ├── 2. Day-by-Day Main Dashboard Screen (Default)
  │      ├── Date Navigator Bar (< Prev | Date | Next >)
  │      ├── Daily Energy Budget Component (Progress Rings / Bars)
  │      └── Meal Breakdown Cards (Breakfast, Lunch, Dinner, Snacks)
  └── 3. Food Search & Capture Modal
         ├── Tab A: OFF API Online Search & Barcode Scanner
         └── Tab B: Add Custom Food (Manual + OCR Reader)
```

```
          ┌──────────────────────────┐
          │ Main Dashboard (Date Nav)│
          └────────────┬─────────────┘
                       │ Select Meal (+)
                       ▼
          ┌──────────────────────────┐
          │ Food Search / Scan Modal │
          └──────┬────────────┬──────┘
  Found via Barcode/Search    │ Product Not Found
         │                    ▼
         │          ┌───────────────────┐
         │          │ OCR Label Scanner │
         │          └─────────┬─────────┘
         │                    │ Extracted JSON
         ▼                    ▼
  ┌─────────────────────────────────────┐
  │ Adjust Portion (g) & Log Meal Entry │
  └──────────────────┬──────────────────┘
                     │ Save
                     ▼
  ┌─────────────────────────────────────┐
  │ Update Local DB & Write to Health   │
  │ Connect (NutritionRecord)           │
  ──────────────────────────────────────┘
```

---

## 5. OCR & Data Parsing Pipeline

### Regex Parsing Layer for Package Labels
When ML Kit returns plain text lines from packaging, pass the array through structured phrase rules:

```typescript
export interface ParsedNutrition {
  calories: number | null;
  protein: number | null;
  carbs: number | null;
  fat: number | null;
}

export function parseNutritionText(textLines: string[]): ParsedNutrition {
  const fullText = textLines.join(" ").toLowerCase();
  
  const extract = (patterns: RegExp[]): number | null => {
    for (const pattern of patterns) {
      const match = fullText.match(pattern);
      if (match && match[1]) {
        return parseFloat(match[1].replace(',', '.'));
      }
    }
    return null;
  };

  return {
    calories: extract([
      /(?:energy|énergie|calories|kcal)\s*:?\s*(\d+[\.,]?\d*)\s*kcal/i,
      /(\d+[\.,]?\d*)\s*kcal/i
    ]),
    protein: extract([
      /(?:protein|protéines|eiweiß)\s*:?\s*(\d+[\.,]?\d*)\s*g/i
    ]),
    carbs: extract([
      /(?:carbohydrate|glucides|kohlenhydrate)\s*:?\s*(\d+[\.,]?\d*)\s*g/i
    ]),
    fat: extract([
      /(?:fat|lipides|fett)\s*:?\s*(\d+[\.,]?\d*)\s*g/i
    ])
  };
}
```

---

## 6. Health Connect Integration Spec

### 6.1 Required Android Permissions (`AndroidManifest.xml`)

```xml
<manifest xmlns:android="http://schemas.android.com/apk/res/android">
    <!-- Permissions -->
    <uses-permission android:name="android.permission.health.READ_NUTRITION"/>
    <uses-permission android:name="android.permission.health.WRITE_NUTRITION"/>
    <uses-permission android:name="android.permission.health.READ_WEIGHT"/>
    <uses-permission android:name="android.permission.health.READ_ACTIVE_CALORIES_BURNED"/>
    <uses-permission android:name="android.permission.health.READ_STEPS"/>
    <uses-permission android:name="android.permission.health.READ_EXERCISE"/>
    <uses-permission android:name="android.permission.health.WRITE_WEIGHT"/>

    <application>
      <!-- Required Rationale Intent Filter -->
      <activity android:name=".MainActivity" android:exported="true">
        <intent-filter>
          <action android:name="androidx.health.ACTION_SHOW_PERMISSIONS_RATIONALE" />
        </intent-filter>
      </activity>
    </application>
</manifest>
```

### 6.2 Health Connect Sync Implementation

```typescript
import { 
  initialize, 
  requestPermission, 
  insertRecords 
} from 'react-native-health-connect';

export async function syncMealToHealthConnect(
  mealName: string,
  mealTypeConstant: number,
  consumedAt: Date,
  caloriesKcal: number,
  proteinGrams: number,
  carbsGrams: number,
  fatGrams: number
): Promise<string | null> {
  const isInitialized = await initialize();
  if (!isInitialized) return null;

  const permissions = await requestPermission([
    { accessType: 'write', recordType: 'Nutrition' }
  ]);

  const hasPermission = permissions.some(
    (p) => p.recordType === 'Nutrition' && p.accessType === 'write'
  );

  if (!hasPermission) return null;

  const record = {
    recordType: 'Nutrition' as const,
    startTime: consumedAt.toISOString(),
    endTime: consumedAt.toISOString(),
    mealType: mealTypeConstant, // 1: Breakfast, 2: Lunch, 3: Dinner, 4: Snack
    name: mealName,
    energy: { value: caloriesKcal, unit: 'kilocalories' },
    protein: { value: proteinGrams, unit: 'grams' },
    totalCarbohydrate: { value: carbsGrams, unit: 'grams' },
    totalFat: { value: fatGrams, unit: 'grams' },
  };

  const [insertedId] = await insertRecords([record]);
  return insertedId;
}
```

---


### 6.3 Querying Active Calories & Exercise (Read Pipeline)

To dynamically calculate the adjusted daily budget:
$$\text{Adjusted Budget} = \text{Base Calorie Target} + \text{Active Calories Burned (Health Connect)}$$

The app queries `ActiveCaloriesBurned` and `TotalCaloriesBurned` records logged by Google Fit, Samsung Health, or smartwatch hardware for the active day.

```typescript
import { 
  readRecords, 
  RecordType 
} from 'react-native-health-connect';

export interface DailyExpenditure {
  activeCaloriesKcal: number;
  stepCount: number;
}

export async function fetchDailyBurnedMetrics(targetDate: Date): Promise<DailyExpenditure> {
  const startOfDay = new Date(targetDate);
  startOfDay.setHours(0, 0, 0, 0);

  const endOfDay = new Date(targetDate);
  endOfDay.setHours(23, 59, 59, 999);

  const timeRangeFilter = {
    operator: 'between' as const,
    startTime: startOfDay.toISOString(),
    endTime: endOfDay.toISOString(),
  };

  // Read Active Calories Burned (e.g. Google Fit exercises, walking, running)
  const activeCalorieRecords = await readRecords('ActiveCaloriesBurned', {
    timeRangeFilter,
  });

  const totalActiveKcal = activeCalorieRecords.records.reduce(
    (acc, record) => acc + record.energy.inKilocalories,
    0
  );

  // Read Steps Count
  const stepRecords = await readRecords('Steps', {
    timeRangeFilter,
  });

  const totalSteps = stepRecords.records.reduce(
    (acc, record) => acc + record.count,
    0
  );

  return {
    activeCaloriesKcal: Math.round(totalActiveKcal),
    stepCount: totalSteps,
  };
}
```

---

## 7. In-App Updates & Auto-Update Engine

To ensure users receive critical fixes without manually checking the Google Play Store, the app integrates Google Play's native **In-App Updates API** (`com.google.android.play:app-update`).

### 7.1 Update Modes
* **Flexible Updates:** Downloaded in the background while the user continues using the app. Once downloaded, prompts the user to complete the installation. Used for minor version releases.
* **Immediate Updates:** Full-screen blocking UI that forces the user to complete the update before continuing. Used for critical schema/sync breaking changes.

### 7.2 Implementation Specification

```typescript
import SpInAppUpdates, {
  IAUUpdateKind,
  StartUpdateOptions,
} from 'sp-react-native-in-app-updates';

export async function checkForAppUpdates(): Promise<void> {
  const inAppUpdates = new SpInAppUpdates(false); // false = production mode

  try {
    const result = await inAppUpdates.checkNeedsUpdate();

    if (result.shouldUpdate) {
      let updateOptions: StartUpdateOptions = {};

      // If the update priority is high (set via Play Console API) or critical semver
      if (result.other?.updatePriority >= 4) {
        updateOptions = {
          updateType: IAUUpdateKind.IMMEDIATE,
        };
      } else {
        updateOptions = {
          updateType: IAUUpdateKind.FLEXIBLE,
        };
      }

      await inAppUpdates.startUpdate(updateOptions);
    }
  } catch (error) {
    console.warn('In-App Update check failed:', error);
  }
}
```

---

## 8. Play Store Delivery, Policy & Compliance

### 8.1 Build Delivery Artifacts
* **Format:** Android App Bundle (`.aab`) compiled via `npx expo run:android --variant release` or EAS Build (`eas build --platform android`).
* **Target SDK:** API Level 34+ (Android 14) required for modern Play Store submission.
* **Signing:** Google Play App Signing with an upload key managed in local keystore.

### 8.2 Google Play Console Compliance Requirements

#### 1. Play Console Health Apps Declaration Form
Before Google Play approves an app using Health Connect permissions, you must fill out the **Health Apps Declaration Form** under *Policy > App Content* in Google Play Console:
* **Declared Category:** Select `Nutrition and Weight Management`.
* **Declared Data Types:** Declare `Nutrition` and `Weight` permissions.
* **Use Case Justification:** Explicitly state that nutrition data is read/written solely to track user dietary intake and sync daily caloric logs to Android's native health store.

#### 2. Data Safety Declaration
In the Play Console Data Safety section:
* **Data Collection:** Declare that data is collected locally.
* **Data Sharing:** Set **No Data Shared with Third Parties** (if all data stays on-device and syncs exclusively via Health Connect).
* **Encryption:** Declare data encrypted in transit (when fetching Open Food Facts API over HTTPS).

#### 3. Privacy Policy Requirement
* A publicly accessible Privacy Policy URL must be hosted (e.g., via GitHub Pages) and added to both:
  1. The Google Play Store listing.
  2. The `ACTION_SHOW_PERMISSIONS_RATIONALE` intent target screen in your app.

---

## 9. Verification & Test Suite Matrix

1. **Calculations Test:** Verify Mifflin-St Jeor calculations against manual test sets for Male/Female profiles across various activity levels.
2. **Offline Mode Test:** Scan and log custom/cached meals without network connectivity; ensure Health Connect writes complete locally without failures.
3. **Health Connect Round-Trip:** Confirm entries logged inside the app render correctly in Google Health Connect and cross-sync to external consumers (e.g., Google Fit / Samsung Health).
4. **OCR Accuracy Test:** Benchmark label extractions across low-light, skewed, and multi-language nutrition tables.
5. **In-App Update Flow:** Test using **Internal App Sharing** on Play Console by pushing a lower version code (`versionCode 100`) and uploading `versionCode 101` to verify the update prompt overlay triggers correctly.
