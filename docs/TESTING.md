# Comprehensive Testing Guide: Cibus

This document provides a complete guide for testing the **Cibus** application across automated unit tests, offline operation, Google Health Connect integration, OCR label parsing accuracy, and Google Play Store In-App Updates.

---

## 1. Automated Unit Test Suite (`npm test`)

The project includes Jest unit tests covering all core services, math formulas, database models, regex OCR parsers, and Health Connect bridges.

### Running the Test Suite

Run the full automated test suite from the root directory:

```bash
npm test
```

To run tests in watch mode during development:

```bash
npx jest --watch
```

To run typechecking:

```bash
npm run typecheck
```

### Test Suite Coverage Matrix

| Test Suite File | Domain Covered | Key Verification Objectives |
| :--- | :--- | :--- |
| [`__tests__/nutritionCalculator.test.ts`](file:///home/jeremie/dev/ai-lab/cibus-ai/__tests__/nutritionCalculator.test.ts) | Math & Targets Engine | Mifflin-St Jeor BMR (Male/Female), TDEE scaling, Goal Modifiers (`WEIGHT_LOSS`, `MAINTENANCE`, `MUSCLE_GAIN`), Macro Presets, Dynamic Budget math ($\text{Base} + \text{Active Burned}$), and portion recalculations. |
| [`__tests__/ocrParser.test.ts`](file:///home/jeremie/dev/ai-lab/cibus-ai/__tests__/ocrParser.test.ts) | Multilingual OCR Regex | Text extractions for calories, protein, carbs, and fats across English (`kcal`, `protein`, `carbs`), French (`énergie`, `protéines`, `glucides`, `lipides` with comma decimals), and German (`brennwert`, `eiweiß`, `kohlenhydrate`). |
| [`__tests__/database.test.ts`](file:///home/jeremie/dev/ai-lab/cibus-ai/__tests__/database.test.ts) | Local SQLite DB Storage | UserProfile storage, Master Foods Catalog CRUD, Open Food Facts caching, Meal Entries logging, Health Connect ID updates, and deletion filters. |
| [`__tests__/healthConnect.test.ts`](file:///home/jeremie/dev/ai-lab/cibus-ai/__tests__/healthConnect.test.ts) | Health Connect SDK Bridge | Permission mapping, meal type constant mapping (1: Breakfast, 2: Lunch, 3: Dinner, 4: Snack), record insertion payloads, and active burn metrics querying. |

---

## 2. Offline Mode Test Procedure

Cibus operates local-first, ensuring 100% functionality without active internet connectivity.

### Execution Steps
1. Open the application on an Android test device or emulator.
2. Put the device into **Airplane Mode** (disable Wi-Fi and Mobile Data).
3. Navigate to **Search & Add Food** -> **Custom & OCR Scan**.
4. Enter a custom food item or paste nutrition label text into the OCR text area.
5. Tap **Parse Nutrition via OCR Regex** and confirm nutrient extraction.
6. Tap **Save Food & Log Meal**, select a portion size (e.g. `150g`), and tap **Log Meal & Sync to Health Connect**.
7. **Verification**:
   - Verify that the meal entry renders immediately in the Day-by-Day Dashboard.
   - Verify that local database records persist upon closing and reopening the app.
   - Verify that Health Connect writes succeed locally (Health Connect native service queues and stores records on-device without needing internet access).

---

## 3. Google Health Connect Round-Trip Sync Test Procedure

### Prerequisites
* Android device running Android 14 (API 34+) or Android 9-13 with the Google Health Connect app installed.
* **Health Connect Toolbox** installed from Google Play Store or sideloaded APK for inspecting logged raw records.

### Step-by-Step Round-Trip Verification

#### A. Write Pipeline (App -> Health Connect)
1. Launch Cibus (via native dev build `npx expo run:android`) and tap **Allow** when prompted for Health Connect permissions (`READ_NUTRITION`, `WRITE_NUTRITION`, `READ_WEIGHT`, `WRITE_WEIGHT`, `READ_ACTIVE_CALORIES_BURNED`, `READ_STEPS`). *(Note: In non-native environments like Expo Go, permission prompts are bypassed and mock data is used; see ENVIRONMENT_SETUP.md).*
2. Log a meal item (e.g., *Grilled Chicken Breast - 200g* containing `330 kcal`, `62g Protein`, `0g Carbs`, `7.2g Fat`).
3. Open the **Google Health Connect** app or **Health Connect Toolbox**.
4. Navigate to **Data and access > Nutrition**.
5. Select today's date and verify that an entry named `Grilled Chicken Breast` appears with exact match values for energy, protein, carbohydrates, and total fat.

#### B. Read Pipeline (Health Connect -> App)
1. Open **Health Connect Toolbox** (or Google Fit / Samsung Health) and write a simulated `ActiveCaloriesBurned` record of `350 kcal` and `5,000 steps`.
2. Return to Cibus and refresh/navigate to the current date.
3. **Verification**:
   - Confirm the **Daily Energy Budget** card displays:
     $$\text{Dynamic Budget} = \text{Base Goal} + 350 \text{ kcal}$$
   - Confirm remaining calories automatically increment by `+350 kcal`.
   - Confirm step count displays `🚶 Step Count: 5,000 steps today`.

---

## 4. OCR Label Parser Accuracy Benchmarking

### Test Conditions
Test label parsing under 4 packaging scenarios:

1. **Standard English Package**:
   ```
   NUTRITION FACTS
   Per 100g: Energy 520 kcal, Protein 22g, Carbohydrate 48g, Fat 26g
   ```
   - *Expected Result*: `calories: 520, protein: 22, carbs: 48, fat: 26`.

2. **European French Package with Comma Decimals**:
   ```
   INFORMATIONS NUTRITIONNELLES POUR 100G
   Énergie: 340,5 kcal
   Protéines: 9,2 g
   Glucides: 68,0 g
   Lipides: 3,5 g
   ```
   - *Expected Result*: `calories: 340.5, protein: 9.2, carbs: 68, fat: 3.5`.

3. **German Packaging**:
   ```
   Brennwert: 410 kcal
   Eiweiß: 30g
   Kohlenhydrate: 12g
   Fett: 25g
   ```
   - *Expected Result*: `calories: 410, protein: 30, carbs: 12, fat: 25`.

4. **Dirty OCR Noise & Unrelated Text Lines**:
   ```
   MAY CONTAIN TRACES OF NUTS
   STORE IN A COOL DRY PLACE
   Calories: 150 kcal
   Protein 5g
   ```
   - *Expected Result*: `calories: 150, protein: 5, carbs: null, fat: null`.

---

## 5. Play Store In-App Updates Flow Verification

To test Google Play's In-App Updates API without publishing live to production:

### Using Internal App Sharing
1. In `app.json` / `build.gradle`, set `versionCode 100` and build an Android App Bundle (`.aab`):
   ```bash
   npx expo run:android --variant release
   ```
2. Upload `versionCode 100` to Google Play Console **Internal App Sharing**.
3. Sideload and install `versionCode 100` onto your physical Android test device via the Internal App Sharing link.
4. Update `versionCode 101` in your codebase and upload the new `.aab` to Internal App Sharing.
5. Launch the installed app on your device (`versionCode 100`).
6. **Verification**:
   - The app detects the `versionCode 101` update from Google Play Core API.
   - The top `UpdateBanner` overlay renders: `⚡ App Update Available`.
   - Tapping **Update Now** triggers the native Play Store flexible in-app update sheet overlay.
