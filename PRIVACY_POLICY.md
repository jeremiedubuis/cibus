# Privacy Policy for Cibus

**Effective Date:** July 31, 2026

**Cibus** ("we", "our", or "us") is committed to protecting your privacy. This Privacy Policy explains how our local-first mobile application collects, uses, and safeguards your health and personal data when you use the **Cibus** application (the "App").

---

## 1. Local-First & Privacy-Focused Principles

Cibus is built on a **local-first architecture**. All your personal health records, meal entries, biometric profiles, and nutrition metrics are stored exclusively on your local mobile device inside a local SQLite database. We do not operate central application servers to collect, harvest, or monetize your personal health data.

---

## 2. Information Collected & Used

### A. User Profile & Biometric Inputs
To calculate your Basal Metabolic Rate (BMR), Total Daily Energy Expenditure (TDEE), and daily macro targets using the Mifflin-St Jeor formula, the App collects user inputs:
* Weight, Height, Age, Biological Sex
* Activity Factor and Fitness Goal

This information remains stored strictly on your device.

### B. Dietary Intake & Meal Logs
When you log meals, the App records the food name, brand, portion quantity (in grams), and calculated macronutrients (calories, protein, carbohydrates, fats).

### C. Open Food Facts Public API Queries
When you search for food items or lookup barcodes online, the App sends search terms or barcode numbers over HTTPS to the public [Open Food Facts REST API](https://world.openfoodfacts.org). No user identity, location, or biometric health metrics are sent with these queries.

---

## 3. Google Health Connect Integration & Data Usage

Cibus integrates with **Google Health Connect** to provide dual-way health synchronization on Android devices.

### A. Requested Health Permissions
* `android.permission.health.READ_NUTRITION` & `WRITE_NUTRITION`
* `android.permission.health.READ_WEIGHT` & `WRITE_WEIGHT`
* `android.permission.health.READ_ACTIVE_CALORIES_BURNED`
* `android.permission.health.READ_STEPS`

### B. Health Connect Data Usage Justification
* **Writing Nutrition Records**: When you log a meal in Cibus, dietary intake details (calories, protein, carbs, fats, and meal type) are written to Google Health Connect so other health apps on your device (e.g. Google Fit, Samsung Health) can access your dietary records.
* **Reading Active Calories & Steps**: The App reads active calories burned and daily step counts from Google Health Connect solely to dynamically calculate your daily energy budget on your device dashboard ($\text{Dynamic Budget} = \text{Base Target} + \text{Active Calories Burned}$).

### C. Health Connect Privacy Guarantee
* Health Connect data read by Cibus is processed **strictly in-memory and on-device**.
* Health Connect data is **never transmitted to external servers**, **never sold to third parties**, and **never used for advertising or marketing purposes**.

---

## 4. Third-Party Data Sharing

**We do NOT sell, rent, trade, or share your personal or health data with any third parties.** 

---

## 5. Data Security & Storage

Your data is secured locally on your Android device using standard operating system application sandboxing. External access to the App's local SQLite database is restricted by Android system permissions.

---

## 6. User Data Control & Deletion

You retain complete ownership and control over your data:
* **Deleting Meal Entries**: You can delete individual meal entries directly from the App dashboard at any time.
* **Complete Data Reset**: You can erase all application data, local databases, and cached foods by clearing the App's data in Android Settings (*Settings > Apps > Cibus > Storage > Clear Data*) or uninstalling the App.

---

## 7. Contact Us

If you have any questions, concerns, or requests regarding this Privacy Policy or data handling practices, please contact us at:

* **Email:** [Your Contact Email]
* **Website / Repository:** [Your Website or Project URL]
