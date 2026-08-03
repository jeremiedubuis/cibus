# ADB Remote Installation Guide

This guide details how to build an installable APK for **Joules** and deploy it to a physical Android device remotely using Android Debug Bridge (ADB) over USB or Wireless Debugging.

---

## 1. Prerequisites

### On your Development PC
- **Android SDK Platform-Tools** (`adb` command line tool installed and in system PATH).
- **Node.js** and **JDK 17+** configured.

### On your Android Phone
1. Enable **Developer Options**:
   - Go to **Settings > About Phone**.
   - Tap **Build Number** 7 times until you see *"You are now a developer!"*.
2. Enable **USB Debugging**:
   - Go to **Settings > System > Developer Options** (or Settings > Developer Options).
   - Toggle **USB Debugging** to **ON**.
3. Enable **Wireless Debugging** (Required for wireless installation without USB cable):
   - In **Developer Options**, toggle **Wireless Debugging** to **ON**.
   - Make sure your Phone and PC are connected to the **same Wi-Fi network**.

---

## 2. Building the APK

Android requires `.apk` files for direct sideloading via ADB (`.aab` app bundles are for Google Play Store upload only).

### Option A: Build Debug APK (Fastest for testing & debugging)
From the root of the project:

```bash
# 1. Ensure prebuild assets are generated (if needed)
npx expo prebuild --platform android

# 2. Build the Debug APK using Gradle
cd android
`./gradlew assembleDebug`
```

- **Output Artifact**: `android/app/build/outputs/apk/debug/app-debug.apk`

---

### Option B: Build Release APK (Standalone runtime, optimized performance)
For a standalone version that runs without needing an Expo development server:

```bash
cd android
./gradlew assembleRelease
```

- **Output Artifact**: `android/app/build/outputs/apk/release/app-release.apk`

---

## 3. Remote Installation via ADB

### Method A: Over USB Cable

1. Connect your phone to your PC via USB cable.
2. Accept the **"Allow USB Debugging?"** prompt on your phone screen.
3. Verify ADB detection:
   ```bash
   adb devices
   ```
   *(You should see your device ID listed with status `device`)*.

4. Install the APK:
   ```bash
   # Debug APK:
   adb install -r android/app/build/outputs/apk/debug/app-debug.apk

   # Or Release APK:
   adb install -r android/app/build/outputs/apk/release/app-release.apk
   ```

---

### Method B: Over Wireless ADB (Android 11+)

No USB cable required after initial setup!

#### Step 1: Pair Device (First time only)
1. On Phone: Open **Developer Options > Wireless Debugging > Pair device with pairing code**.
2. Note the **IP address**, **Port**, and **6-digit Pairing Code** shown.
3. On PC terminal, run:
   ```bash
   adb pair <PHONE_IP_ADDRESS>:<PAIRING_PORT>
   ```
4. Enter the 6-digit code when prompted. You will see `Successfully paired`.

#### Step 2: Connect via Wireless ADB
1. In the main **Wireless Debugging** screen on your phone, note the main **IP address & Port** (Note: this port is different from the pairing port).
2. On PC terminal, connect:
   ```bash
   adb connect <PHONE_IP_ADDRESS>:<PORT>
   ```
3. Check status:
   ```bash
   adb devices
   ```
   *(You will see `<PHONE_IP_ADDRESS>:<PORT> device`)*.

#### Step 3: Install APK Remotely
```bash
adb install -r android/app/build/outputs/apk/debug/app-debug.apk
```

---

## 4. Useful ADB Commands

| Task | ADB Command |
| :--- | :--- |
| **Install / Update App** | `adb install -r android/app/build/outputs/apk/debug/app-debug.apk` |
| **Install & Auto-Grant Permissions** | `adb install -r -g android/app/build/outputs/apk/debug/app-debug.apk` |
| **Launch App Remotely** | `adb shell am start -n com.joules.tracker/.MainActivity` |
| **View Live Logs** | `adb logcat \| grep -i joules` |
| **Uninstall App** | `adb uninstall com.joules.tracker` |
| **Disconnect Wireless ADB** | `adb disconnect` |

---

## 5. Troubleshooting Common ADB Issues

- **`Unable to load script... index.android.bundle` Red Screen**:
  - **Why**: A `debug` build requires a live Metro dev server (`npx expo start`) running on your PC.
  - **Solution for Standalone / Offline App**: Build a **Release APK** which bundles all JavaScript directly into the APK file so it runs without your PC:
    ```bash
    cd android
    ./gradlew assembleRelease
    adb uninstall com.joules.tracker
    adb -s <DEVICE_ID> install -r app/build/outputs/apk/release/app-release.apk
    ```
  - **Solution for Live Debugging**: Keep `npx expo start` running on your PC and forward the Metro port over ADB:
    ```bash
    adb -s <DEVICE_ID> reverse tcp:8081 tcp:8081
    ```
- **`adb: more than one device/emulator`**: Occurs when an emulator and physical/wireless device are connected simultaneously. Use the `-s` or `-d` flag to target a specific device:
  - Target by specific device ID / IP: `adb -s 192.168.1.89:40221 install -r <path-to-apk>`
  - Target physical USB device directly: `adb -d install -r <path-to-apk>`
  - Target running emulator directly: `adb -e install -r <path-to-apk>`
- **`error: device unauthorized`**: Check your phone screen and tap "Always allow from this computer".
- **`INSTALL_FAILED_ALREADY_EXISTS`**: Use the `-r` flag with `adb install` to allow reinstalling over an existing version.
- **`INSTALL_FAILED_UPDATE_INCOMPATIBLE`**: Occurs if switching between Debug and Release signatures. Uninstall the existing version first using `adb uninstall com.joules.tracker`.
- **Wireless connection drops**: Turn Wireless Debugging OFF and ON again in Developer Options on your phone, then run `adb connect <IP>:<PORT>`.
