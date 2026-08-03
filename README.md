# Cibus - Daily Nutrition & Health Connect Sync

A local-first, privacy-focused Android nutrition tracker built with **React Native**, **TypeScript**, **Local SQLite**, **Open Food Facts API**, **OCR Label Parsing**, **Google Health Connect**, and **Google Play In-App Updates**.

---

## 🌟 Key Features

* **Offline-First Architecture**: 100% of your data (profiles, master foods catalog, daily meal logs) is saved locally on your device in local SQLite storage.
* **Mifflin-St Jeor Target Engine**: Automatic BMR, TDEE, goal modifiers (`WEIGHT_LOSS`, `MAINTENANCE`, `MUSCLE_GAIN`), and macro targets.
* **Dynamic Daily Calorie Budget**:
  $$\text{Dynamic Daily Budget} = \text{Base Calorie Target} + \text{Active Calories Burned (Health Connect)}$$
* **Google Health Connect Dual-Way Sync**: Sync meal logs directly into Android's native health store as `Nutrition` records and read active calories & step counts.
* **Open Food Facts REST Integration**: Online text search and barcode lookup (`https://world.openfoodfacts.org`).
* **Multilingual OCR Label Regex Parser**: Automatically extract calories, protein, carbohydrates, and fats from nutrition packaging text lines.
* **Play In-App Updates Engine**: Auto-checks and triggers `FLEXIBLE` or `IMMEDIATE` updates.

---

## 📚 Complete Project Documentation

| Document | Description |
| :--- | :--- |
| **[ENVIRONMENT_SETUP.md](file:///home/jeremie/dev/ai-lab/cibus-ai/docs/ENVIRONMENT_SETUP.md)** | Step-by-step development environment setup guide for **Fedora Linux** (Node v20, OpenJDK 17, KVM hardware acceleration, Android Studio, environment variables, and running the emulator). |
| **[TESTING.md](file:///home/jeremie/dev/ai-lab/cibus-ai/docs/TESTING.md)** | Complete testing guide covering the automated unit test suite (`npm test`), offline mode test procedures, Google Health Connect round-trip sync verification (with Health Connect Toolbox), OCR accuracy benchmarks, and Play Store Internal App Sharing update flow verification. |
| **[ADB_REMOTE_INSTALL.md](file:///home/jeremie/dev/ai-lab/cibus-ai/docs/ADB_REMOTE_INSTALL.md)** | Step-by-step guide to build Debug/Release APKs and deploy remotely to physical Android phones via USB or Wireless ADB. |
| **[DISTRIBUTION.md](file:///home/jeremie/dev/ai-lab/cibus-ai/docs/DISTRIBUTION.md)** | Production release & Play Console compliance guide detailing signed `.aab` builds, Health Apps Declaration Form submission, Data Safety declaration, Privacy Policy requirements, and staged rollout procedures. |
| **[PRIVACY_POLICY.md](file:///home/jeremie/dev/ai-lab/cibus-ai/PRIVACY_POLICY.md)** | Production-ready privacy policy compliant with Google Play Health Connect policy requirements. |

---

## 🚀 Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Run Automated Unit Tests
```bash
npm test
```

### 3. Typecheck Codebase
```bash
npm run typecheck
```

### 4. Start Application in Development Mode
```bash
npx expo run:android
```
