# Production Distribution & Play Console Compliance Guide

This guide details the end-to-end process for compiling signed release artifacts (`.aab`), fulfilling Google Play Console compliance policies (Health Apps Declaration, Data Safety, Privacy Policy), and submitting **Cibus** for production release.

---

## 1. Android Release Build & Signing Guide

### Step 1: Generate a Local Upload Keystore
Generate a secure upload keystore using Java's `keytool`:

```bash
keytool -genkeypair -v -storetype PKCS12 \
  -keystore cibus-upload-key.keystore \
  -alias cibus-upload-alias \
  -keyalg RSA -keysize 2048 -validity 10000
```

Store `cibus-upload-key.keystore` safely and record your keystore password and alias.

### Step 2: Configure Gradle Credentials
In `android/gradle.properties` (or environment variables):

```properties
MYAPP_UPLOAD_STORE_FILE=cibus-upload-key.keystore
MYAPP_UPLOAD_KEY_ALIAS=cibus-upload-alias
MYAPP_UPLOAD_STORE_PASSWORD=your_store_password
MYAPP_UPLOAD_KEY_PASSWORD=your_key_password
```

In `android/app/build.gradle`:

```groovy
android {
    ...
    defaultConfig {
        applicationId "com.cibusai.nutritiontracker"
        minSdkVersion 26
        targetSdkVersion 34
        versionCode 100
        versionName "1.0.0"
    }
    signingConfigs {
        release {
            if (project.hasProperty('MYAPP_UPLOAD_STORE_FILE')) {
                storeFile file(MYAPP_UPLOAD_STORE_FILE)
                storePassword MYAPP_UPLOAD_STORE_PASSWORD
                keyAlias MYAPP_UPLOAD_KEY_ALIAS
                keyPassword MYAPP_UPLOAD_KEY_PASSWORD
            }
        }
    }
    buildTypes {
        release {
            signingConfig signingConfigs.release
            minifyEnabled true
            proguardFiles getDefaultProguardFile('proguard-android-optimize.txt'), 'proguard-rules.pro'
        }
    }
}
```

### Step 3: Build the Android App Bundle (`.aab`)

Run Expo prebuild and compile the release AAB bundle:

```bash
npx expo prebuild --platform android
cd android
./gradlew bundleRelease
```

The compiled Android App Bundle artifact will be located at:
`android/app/build/outputs/bundle/release/app-release.aab`

---

## 2. Google Play Console Compliance Checklist

Before submitting your `.aab` bundle to Google Play Console, you must complete the mandatory policy declarations under **Policy > App Content**.

### Checklist Summary

| Policy Requirement | Play Console Section | Action Required |
| :--- | :--- | :--- |
| **Health Apps Declaration** | *Policy > Health Apps* | Complete Health Apps Declaration Form and declare `Nutrition` & `Weight` permission scope. |
| **Data Safety Form** | *Policy > Data Safety* | Declare local data storage, no 3rd-party data sharing, and HTTPS encryption in transit. |
| **Privacy Policy URL** | *App Overview > Store Listing* | Provide hosted public URL (e.g., GitHub Pages) pointing to `PRIVACY_POLICY.md`. |
| **Target SDK 34+** | *Release > Production* | Ensure `targetSdkVersion` is set to API 34 (Android 14) or higher. |
| **Rationale Intent** | *AndroidManifest.xml* | Include `androidx.health.ACTION_SHOW_PERMISSIONS_RATIONALE` intent-filter. |

---

## 3. Health Apps Declaration Form Detailed Walkthrough

In Google Play Console, navigate to **App content > Health apps**:

1. **App Category Selection**:
   * Select Category: `Nutrition and Weight Management`.

2. **Declared Health Connect Data Types**:
   * Check `Nutrition` (Read & Write).
   * Check `Weight` (Read & Write).
   * Check `Active Calories Burned` (Read).
   * Check `Steps` (Read).

3. **Core Use Case Justification**:
   * Input the following text into the **Use Case Justification** field:
     > *"Cibus is a local-first nutrition tracker. The application requires Health Connect Nutrition and Weight permissions to enable users to log dietary intake (calories, protein, carbohydrates, fats) and sync nutrition logs directly into Android's native health store. Active calories burned and step counts are read solely to dynamically calculate the user's daily energy budget on-device. No health data is stored on remote servers or sold to third parties."*

4. **Privacy Policy Link**:
   * Enter your hosted Privacy Policy URL (e.g., `https://username.github.io/cibus/PRIVACY_POLICY.html`).

---

## 4. Play Console Data Safety Declaration

Under **App Content > Data Safety**:

1. **Data Collection & Security**:
   * *Does your app collect or share any of the required user data types?* -> Select **Yes**.
   * *Is all of the user data collected by your app encrypted in transit?* -> Select **Yes** (Open Food Facts API calls use HTTPS).
   * *Do you provide a way for users to request that their data be deleted?* -> Select **Yes** (Users can clear local data directly inside the app settings).

2. **Data Types & Purposes**:
   * **Health and Fitness > Nutrition**:
     * Collected? **Yes** (Stored locally on device).
     * Shared? **No** (Data stays on-device / Health Connect).
     * Purpose: **App functionality & Analytics / Personalization**.
   * **Health and Fitness > Fitness**:
     * Collected? **Yes** (Active Calories & Steps read locally from Health Connect).
     * Shared? **No**.

---

## 5. In-App Updates Configuration in Play Console

To enable background Flexible and critical Immediate updates:

1. When releasing a new update in Play Console, click **Advanced Settings > In-App Update Priority**.
2. Assign an **Update Priority**:
   * **Priority 0-3**: Minor updates (triggers `FLEXIBLE` background update flow).
   * **Priority 4-5**: Critical schema/security fixes (triggers `IMMEDIATE` full-screen update flow).

---

## 6. Release Rollout Strategy

1. **Internal Testing**: Upload `app-release.aab` to Internal Testing track. Distribute link to internal QA testers to verify Health Connect permission dialogs.
2. **Closed Alpha / Beta**: Promote release to Closed Testing track once Health Apps Declaration Form is approved by Google Play policy team.
3. **Production Rollout**: Promote to Production track using staged rollout (e.g. 10% -> 25% -> 50% -> 100% over 7 days).
