# Production Distribution & Play Console Compliance Guide

This guide details the end-to-end process for compiling signed release artifacts (`.aab`), fulfilling Google Play Console compliance policies (Health Apps Declaration, Data Safety, Privacy Policy), and submitting **Joules** for production release.

---

## 1. Android Release Build & Signing Guide

### Step 1: Generate an Upload Key Pair and Keystore

An Android **upload key** is an RSA private key and public certificate. The keystore is the password-protected file that stores that private key. The following command generates both: it creates a new RSA key pair under the `joules-upload-alias` alias and saves the private key in `android/joules-upload-key.keystore`.

```bash
keytool -genkeypair -v -storetype PKCS12 \
  -keystore android/joules-upload-key.keystore \
  -alias joules-upload-alias \
  -keyalg RSA -keysize 2048 -validity 10000
```

`keytool` prompts you for the **keystore password** and the certificate identity details. It does not prompt for a separate key password: PKCS12 uses the keystore password to protect the private upload key. Use that one value for both `ANDROID_KEYSTORE_PASSWORD` and `ANDROID_KEY_PASSWORD` below.

Keep `android/cibus-upload-key.keystore`, the alias, and its password backed up securely. The private upload key must remain secret and must never be committed to Git; `.gitignore` already excludes `.keystore` files.

### Step 2: Build Locally With Gradle Credentials
For a local signed build, add these values to your uncommitted `~/.gradle/gradle.properties` or `android/gradle.properties`:

```properties
MYAPP_UPLOAD_STORE_FILE=cibus-upload-key.keystore
MYAPP_UPLOAD_KEY_ALIAS=cibus-upload-alias
MYAPP_UPLOAD_STORE_PASSWORD=your_store_password
MYAPP_UPLOAD_KEY_PASSWORD=your_store_password
```

The release build deliberately fails when any of these four values is missing; it never falls back to the Android debug key.

### Step 3: Configure GitHub Actions Signing Secrets

The tag-release workflow decodes a private keystore only inside the GitHub Actions runner and passes the credentials to Gradle. Add these repository secrets under **Settings → Secrets and variables → Actions → New repository secret**:

| Secret | Value |
| :--- | :--- |
| `ANDROID_KEYSTORE_BASE64` | Base64-encoded contents of `cibus-upload-key.keystore` |
| `ANDROID_KEYSTORE_PASSWORD` | Keystore password |
| `ANDROID_KEY_ALIAS` | `cibus-upload-alias` (or the alias you chose) |
| `ANDROID_KEY_PASSWORD` | Same value as `ANDROID_KEYSTORE_PASSWORD` for this PKCS12 keystore |

Create the Base64 value without exposing the keystore in Git:

```bash
base64 -w 0 android/cibus-upload-key.keystore
```

On macOS, use `base64 -i android/cibus-upload-key.keystore | tr -d '\n'` instead. Copy the resulting single line into `ANDROID_KEYSTORE_BASE64`. Keep the original keystore and all four secrets backed up securely; losing the key prevents future updates signed with the same app identity.

### Step 4: Build the Android App Bundle (`.aab`)

Run Expo prebuild and compile the release AAB bundle:

```bash
npx expo prebuild --platform android
cd android
./gradlew bundleRelease
```

The compiled Android App Bundle artifact will be located at:
`android/app/build/outputs/bundle/release/app-release.aab`

### Step 5: Publish a Signed APK From GitHub

After the four secrets are saved, commit the release workflow and push a version tag. GitHub Actions runs the test suite, builds a signed APK, and attaches it to a GitHub Release:

```bash
git tag v1.0.0
git push origin v1.0.0
```

The APK is available from the release page. Verify its signer before sharing it:

```bash
apksigner verify --verbose --print-certs app-release.apk
```

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
     > *"Joules is a local-first nutrition and activity tracker. The application requires Health Connect Nutrition, Exercise, and Weight permissions to enable users to log dietary intake (calories, protein, carbohydrates, fats) and sport activities, syncing logs directly into Android's native health store. Active calories burned and step counts are read solely to dynamically calculate the user's daily energy budget on-device. No health data is stored on remote servers or sold to third parties."*

4. **Privacy Policy Link**:
   * Enter your hosted Privacy Policy URL (e.g., `https://username.github.io/joules/PRIVACY_POLICY.html`).

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
