# Development Environment Setup Guide

This document details how to set up your local development environment for building, running, and debugging **Joules** (React Native / Expo / Android Health Connect).

---

## 1. Fedora Linux Development Environment Setup

This section provides a complete step-by-step guide for setting up your development environment on **Fedora Linux** (Fedora Workstation 38 / 39 / 40+), including Node.js, OpenJDK 17, Android Studio, KVM hardware acceleration, and running the Android Emulator.

---

### Step 1: System Update & Essential Tools

First, update your system packages and install basic build utilities:

```bash
sudo dnf check-update
sudo dnf update -y
sudo dnf install -y curl wget git tar unzip gcc-c++ make
```

---

### Step 2: Install Node.js & Package Managers

React Native `0.74+` and Expo `51+` require **Node.js LTS (v18, v20, or v22)**.

#### Option A: Install Node.js via Fedora DNF
```bash
sudo dnf install -y nodejs npm
```

#### Option B: Install via Node Version Manager (nvm) - Recommended
Installing via `nvm` allows switching Node versions easily without `sudo`:

```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
source ~/.bashrc
nvm install 20
nvm use 20
nvm alias default 20
```

Verify installation:
```bash
node -v   # Should be v20.x or higher
npm -v
```

---

### Step 3: Install Java Development Kit (JDK)

This Expo 57 / React Native 0.86 project runs Gradle with **JDK 25**. CI uses
the same version.

On Fedora Linux, install `java-25-openjdk-devel`.

#### Install via Fedora DNF:
```bash
sudo dnf install -y java-25-openjdk-devel
```

> **Note for Fedora users**: `java-latest-openjdk-devel` is also suitable when
> it provides Java 25. Android Studio's bundled JBR must likewise report Java
> 25 or newer.

Set `JAVA_HOME` in your `~/.bashrc` (or `~/.zshrc`):

```bash
# Keep this aligned with the Java version used by CI.
export JAVA_HOME=/usr/lib/jvm/java-25-openjdk
export PATH=$JAVA_HOME/bin:$PATH
# Java 25 requires this for Android Gradle native/CMake subprocesses.
export JAVA_TOOL_OPTIONS=--enable-native-access=ALL-UNNAMED
```

Apply the environment changes:
```bash
source ~/.bashrc
```

Verify that Java and its compiler are both Java 25:
```bash
java -version
javac -version
```

Both commands should report Java 25. If `javac` is missing, the runtime-only
package is installed; install `java-25-openjdk-devel` before running
`npx expo run:android`.

---

### Step 4: Install & Configure KVM Hardware Acceleration

For the Android Emulator to run smoothly with native hardware performance on Fedora Linux, **KVM (Kernel-based Virtual Machine)** must be installed and configured.

#### 1. Check CPU Virtualization Support
```bash
egrep -c '(vmx|svm)' /proc/cpuinfo
```
*(If output is > 0, hardware virtualization is enabled in your BIOS).*

#### 2. Install KVM Packages
```bash
sudo dnf install -y qemu-kvm libvirt virt-install virt-manager
```

#### 3. Add User to KVM Group
Add your Fedora user account to the `kvm` and `libvirt` groups:

```bash
sudo usermod -aG kvm $USER
sudo usermod -aG libvirt $USER
```

> **Note:** Log out and log back in (or run `newgrp kvm`) for group membership to take effect.

Verify KVM permissions:
```bash
ls -l /dev/kvm
# Output should show: crw-rw----+ 1 root kvm ... /dev/kvm
```

---

### Step 5: Install Android Studio & Android SDK

#### Option A: Install via Official Tarball (Recommended)

1. Download Android Studio for Linux from the official site:
   [https://developer.android.com/studio](https://developer.android.com/studio)

2. Extract the archive to `/opt/` or your home directory:
   ```bash
   sudo tar -xzf android-studio-*-linux.tar.gz -C /opt/
   ```

3. Launch Android Studio setup wizard:
   ```bash
   /opt/android-studio/bin/studio.sh
   ```

#### Option B: Install via Flatpak
```bash
flatpak install flathub com.google.AndroidStudio
flatpak run com.google.AndroidStudio
```

#### Complete Android Studio Setup Wizard
1. Choose **Standard** installation type.
2. Ensure the following components are checked for installation:
   * **Android SDK**
   * **Android SDK Platform-Tools**
   * **Android Emulator**
   * **SDK Platform: Android 14 (API 34)**
3. Complete installation. The default SDK path on Fedora will be `~/Android/Sdk`.

---

### Step 6: Configure Environment Variables

Export the Android SDK paths in your shell profile:

Add the following lines to `~/.bashrc` (or `~/.zshrc`):

```bash
# Android SDK Configuration
export ANDROID_HOME=$HOME/Android/Sdk
export PATH=$PATH:$ANDROID_HOME/emulator
export PATH=$PATH:$ANDROID_HOME/platform-tools
export PATH=$PATH:$ANDROID_HOME/cmdline-tools/latest/bin
export PATH=$PATH:$ANDROID_HOME/tools
export PATH=$PATH:$ANDROID_HOME/tools/bin
```

Apply the changes immediately:
```bash
source ~/.bashrc
```

Verify command-line tools:
```bash
adb --version
```

---

### Step 7: Create and Run the Android Emulator

#### Creating an Android Virtual Device (AVD)

1. Open **Android Studio**.
2. Click **More Actions > Virtual Device Manager** (or **Tools > Device Manager**).
3. Click **Create Device**.
4. Select a hardware profile (e.g. **Pixel 8** or **Pixel 7**).
5. Select a system image: Choose **API Level 34** (Android 14.0 - `x86_64` architecture with Google Play Services).
6. Click **Finish**.

#### Running the Emulator via Command Line

List all created AVDs:
```bash
emulator -list-avds
# Example output: Pixel_8_API_34
```

Launch the emulator:
```bash
emulator -avd Pixel_8_API_34 &
```

*(Tip: You can pass `-gpu host` for maximum graphics acceleration).*

Verify ADB connection:
```bash
adb devices
# Output should show your running emulator:
# List of devices attached
# emulator-5554    device
```

---


### Step 9: Launch Joules in Dev Mode on Fedora

1. Clone the project repository and navigate to the root directory:
   ```bash
   cd cibus-ai
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Ensure your Android Emulator is running (`adb devices`).

4. Run the application on your Fedora emulator:
   ```bash
   npx expo run:android
   ```
   *or start the Expo Metro Bundler:*
   ```bash
   npm start
   ```

5. Press `a` in the terminal to automatically attach and run the app on the active Fedora Android Emulator!

---

### Step 10: Health Connect Emulation, Mock Mode & Permission Behavior

#### 1. Why No Permission Prompt in Expo Go / Standard JS Mode?
* **Permission Dialog Behavior**: The app only triggers the Android native Health Connect permission modal (`requestHealthConnectPermissions()`) if `isHealthConnectAvailable()` returns `true`.
* **Expo Go / JS-Only Limits**: Native modules like `react-native-health-connect` require custom native Android C++/Java compilation. When running in Expo Go or non-native JS environments, the module runtime is `null`.
* **Fallback Behavior**: In this state, `isHealthConnectAvailable()` returns `false`, so the app intentionally bypasses the native OS permission prompt and defaults to returning mock metrics (e.g. baseline **6,500 steps** and **250 active kcal**) so developers can still work on UI/layout features without a connected native Health Connect engine.

#### 2. Triggering Real Health Connect Permission Prompts
To test actual OS permission prompts and live data sync:
1. Build and run a **Native Development Build** on your emulator:
   ```bash
   npx expo run:android
   ```
2. Make sure the emulator image runs **Android 14 (API 34)** or has the **Google Health Connect** app installed.
3. Upon launching the native build, `isHealthConnectAvailable()` evaluates to `true`, and the app will present the official Health Connect permission sheet asking for access (`Nutrition`, `Steps`, `ActiveCaloriesBurned`, `Weight`).

#### 3. Spoofing Data via Health Connect Toolbox
* On an emulator, Health Connect starts with **0 data**.
* **Option A: Install via Play Store (Easiest)**: If your emulator image has Google Play Store, open Play Store, search for `Health Connect Toolbox`, and install it.
* **Option B: Install via ADB**: Download the official ZIP from [Android Developers Health Connect Test Integration](https://developer.android.com/health-and-fitness/guides/health-connect/test-integration), extract the `.apk` file, and install it:
  ```bash
  # Replace <path-to-extracted-file.apk> with the actual path to your downloaded APK
  adb install /path/to/extracted-HealthConnectToolbox.apk
  ```
* Use the Toolbox app to insert steps, workouts, or meals to verify live read/write sync in Joules.
