# Joules - Daily Nutrition, Activity & Health Connect Sync

A local-first, privacy-focused Android nutrition and activity tracker built with **React Native**, **TypeScript**, **Local SQLite**, **Open Food Facts API**, **OCR Label Parsing**, **Google Health Connect**, and **Google Play In-App Updates**.

> [!WARNING]
> **Personal Project & AI Disclaimer**: Joules is an experimental personal project developed with heavy use of AI assistance. All nutrition calculations, barcode/OCR extractions, and health data sync features are provided "as-is" for informational purposes only, without any guarantee or medical warranty.

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
| **[ENVIRONMENT_SETUP.md](docs/ENVIRONMENT_SETUP.md)** | Step-by-step development environment setup guide for **Fedora Linux** (Node v20, OpenJDK 17, KVM hardware acceleration, Android Studio, environment variables, and running the emulator). |
| **[TESTING.md](docs/TESTING.md)** | Complete testing guide covering the automated unit test suite (`npm test`), offline mode test procedures, Google Health Connect round-trip sync verification (with Health Connect Toolbox), OCR accuracy benchmarks, and Play Store Internal App Sharing update flow verification. |
| **[ADB_REMOTE_INSTALL.md](docs/ADB_REMOTE_INSTALL.md)** | Step-by-step guide to build Debug/Release APKs and deploy remotely to physical Android phones via USB or Wireless ADB. |
| **[DISTRIBUTION.md](docs/DISTRIBUTION.md)** | Production release & Play Console compliance guide detailing signed `.aab` builds, Health Apps Declaration Form submission, Data Safety declaration, Privacy Policy requirements, and staged rollout procedures. |
| **[PRIVACY_POLICY.md](PRIVACY_POLICY.md)** | Production-ready privacy policy compliant with Google Play Health Connect policy requirements. |

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

---

## 📦 Automated GitHub APK Releases

Pushing a version tag automatically compiles the release APK and attaches it to a new GitHub Release:

```bash
git tag v1.0.0
git push origin v1.0.0
```

---

## 🔗 Quick Reference & Useful Links

* **Legal & Compliance**:
  * [MIT License](LICENSE)
  * [Privacy Policy](PRIVACY_POLICY.md)
  * [GitHub Release CI/CD Workflow](.github/workflows/release.yml)
* **Open Nutrition Datasets**:
  * [Open Food Facts Database](https://world.openfoodfacts.org) *(Licensed under [ODbL 1.0](https://opendatacommons.org/licenses/odbl/1-0/))*
  * [ANSES CIQUAL France Dataset](https://ciqual.anses.fr) *(Licensed under [Etalab Open License](https://github.com/etalab/licence-ouverte))*
  * [Swiss Food Composition Database](https://www.naehrwertdaten.ch) *(Agroscope / FSVO)*
  * [Fineli Finnish Food Database](https://fineli.fi) *(THL Finland)*
* **Health & Platform APIs**:
  * [Google Health Connect Overview](https://developer.android.com/health-and-fitness/guides/health-connect)
  * [Google Health Connect Toolbox Testing App](https://github.com/android/health-samples/tree/main/HealthConnectToolbox)
  * [Expo Updates & EAS Guide](https://docs.expo.dev/eas-update/introduction/)

---

## 📜 License & Data Attributions

* **Application License**: Distributed under the [MIT License](LICENSE).
* **Open Food Facts**: Product and barcode data provided by [Open Food Facts](https://world.openfoodfacts.org) under the [Open Database License (ODbL)](https://opendatacommons.org/licenses/odbl/1-0/).
* **ANSES CIQUAL (France)**: Nutritional composition dataset provided by ANSES under the [Etalab Open License](https://github.com/etalab/licence-ouverte).
* **Swiss Food Composition Database**: Provided by [Agroscope / FSVO](https://www.naehrwertdaten.ch).
* **Fineli Database (Finland)**: Provided by [THL (Finnish Institute for Health and Welfare)](https://fineli.fi).

