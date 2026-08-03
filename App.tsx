import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  AppState,
  AppStateStatus,
  Image,
  Platform,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  useFonts,
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
  PlusJakartaSans_800ExtraBold,
} from '@expo-google-fonts/plus-jakarta-sans';
import './src/i18n';
import { useTranslation } from 'react-i18next';
import { FoodItem, MealEntry, MealType, UserProfile } from './src/types';
import { COLORS, FONTS } from './src/constants/theme';
import {
  addMealEntry,
  deleteMealEntry,
  getMealEntriesByDate,
  getUserProfile,
  initDatabase,
  saveUserProfile,
  updateMealEntry,
  updateMealHealthConnectId,
} from './src/services/database';
import {
  checkHealthConnectPermissionsGranted,
  fetchDailyBurnedMetrics,
  isHealthConnectAvailable,
  reconcileHealthConnectData,
  requestHealthConnectPermissions,
  syncMealToHealthConnect,
} from './src/services/healthConnect';
import { checkAppUpdates, startAppUpdate } from './src/services/inAppUpdates';
import { DateNavigator } from './src/components/DateNavigator';
import { EnergyBudgetCard } from './src/components/EnergyBudgetCard';
import { MacroProgress } from './src/components/MacroProgress';
import { MealBreakdownCard } from './src/components/MealBreakdownCard';
import { FoodSearchModal } from './src/components/FoodSearchModal';
import { LogMealModal } from './src/components/LogMealModal';
import { UserProfileModal } from './src/components/UserProfileModal';
import { UpdateBanner } from './src/components/UpdateBanner';
import { LOGO_BASE64 } from './src/assets/logoBase64';

const BRAND_LOGO_SOURCE = { uri: LOGO_BASE64 };

export default function App() {
  const [fontsLoaded] = useFonts({
    PlusJakartaSans_400Regular,
    PlusJakartaSans_500Medium,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
    PlusJakartaSans_800ExtraBold,
  });

  const [currentDateStr, setCurrentDateStr] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [mealEntries, setMealEntries] = useState<MealEntry[]>([]);
  const [activeCalories, setActiveCalories] = useState<number>(0);
  const [stepCount, setStepCount] = useState<number>(0);
  const [isHealthConnectActive, setIsHealthConnectActive] = useState<boolean>(false);
  const [updateAvailable, setUpdateAvailable] = useState<boolean>(false);

  // Modals state
  const [searchModalVisible, setSearchModalVisible] = useState<boolean>(false);
  const [logModalVisible, setLogModalVisible] = useState<boolean>(false);
  const [profileModalVisible, setProfileModalVisible] = useState<boolean>(false);
  const [activeMealType, setActiveMealType] = useState<MealType>('BREAKFAST');
  const [selectedFood, setSelectedFood] = useState<FoodItem | null>(null);

  // Initial setup
  useEffect(() => {
    async function setupApp() {
      await initDatabase();
      let userProf = await getUserProfile();
      setProfile(userProf);

      // Check if permissions are already granted on cold launch
      const isGranted = await checkHealthConnectPermissionsGranted();
      setIsHealthConnectActive(isGranted);

      if (isGranted) {
        // Run initial reconciliation
        await reconcileHealthConnectData();
        userProf = await getUserProfile();
        setProfile(userProf);
      }

      // In-App Updates check
      const updateInfo = await checkAppUpdates();
      if (updateInfo.shouldUpdate) {
        setUpdateAvailable(true);
      }
    }
    setupApp();
  }, []);

  // Background reconciliation when app is brought to foreground (maximized/opened)
  useEffect(() => {
    const subscription = AppState.addEventListener('change', async (nextAppState: AppStateStatus) => {
      if (nextAppState === 'active') {
        const isGranted = await checkHealthConnectPermissionsGranted();
        setIsHealthConnectActive(isGranted);

        if (isGranted) {
          await reconcileHealthConnectData();
          const freshProf = await getUserProfile();
          setProfile(freshProf);

          const entries = await getMealEntriesByDate(currentDateStr);
          setMealEntries(entries);

          const targetDate = new Date(currentDateStr);
          const metrics = await fetchDailyBurnedMetrics(targetDate);
          setActiveCalories(metrics.activeCaloriesKcal);
          setStepCount(metrics.stepCount);
        }
      }
    });

    return () => {
      subscription.remove();
    };
  }, [currentDateStr]);

  const handleConnectHealthConnect = async () => {
    const permOk = await requestHealthConnectPermissions();
    setIsHealthConnectActive(permOk);
    if (permOk) {
      // Force full week reconciliation on permission grant
      await reconcileHealthConnectData(true);
      const freshProf = await getUserProfile();
      setProfile(freshProf);

      const entries = await getMealEntriesByDate(currentDateStr);
      setMealEntries(entries);

      const targetDate = new Date(currentDateStr);
      const metrics = await fetchDailyBurnedMetrics(targetDate);
      setActiveCalories(metrics.activeCaloriesKcal);
      setStepCount(metrics.stepCount);
    }
  };

  // Reload entries & metrics on date or profile change
  useEffect(() => {
    async function loadDayData() {
      const entries = await getMealEntriesByDate(currentDateStr);
      setMealEntries(entries);

      const targetDate = new Date(currentDateStr);
      const metrics = await fetchDailyBurnedMetrics(targetDate);
      setActiveCalories(metrics.activeCaloriesKcal);
      setStepCount(metrics.stepCount);
    }
    loadDayData();
  }, [currentDateStr, profile]);

  const [editingEntry, setEditingEntry] = useState<MealEntry | null>(null);

  const handleDateChange = (newDateStr: string) => {
    setCurrentDateStr(newDateStr);
  };

  const handleOpenSearchModal = (mealType: MealType) => {
    setEditingEntry(null);
    setActiveMealType(mealType);
    setSearchModalVisible(true);
  };

  const handleEditEntry = (entry: MealEntry) => {
    if (entry.food) {
      setEditingEntry(entry);
      setSelectedFood(entry.food);
      setActiveMealType(entry.mealType);
      setLogModalVisible(true);
    }
  };

  const handleSelectFood = (food: FoodItem) => {
    setSelectedFood(food);
    setLogModalVisible(true);
  };

  const handleConfirmLogMeal = async (food: FoodItem, quantityG: number) => {
    const factor = quantityG / 100;
    const calcCal = Math.round(food.calories100g * factor * 10) / 10;
    const calcProt = Math.round(food.proteins100g * factor * 10) / 10;
    const calcCarbs = Math.round(food.carbs100g * factor * 10) / 10;
    const calcFat = Math.round(food.fats100g * factor * 10) / 10;

    const todayStr = new Date().toISOString().split('T')[0];
    const consumedDate = currentDateStr === todayStr ? new Date() : new Date(`${currentDateStr}T12:00:00`);

    if (editingEntry) {
      await updateMealEntry(editingEntry.id, {
        quantityG,
        calculatedCalories: calcCal,
        calculatedProtein: calcProt,
        calculatedCarbs: calcCarbs,
        calculatedFat: calcFat,
      });

      await syncMealToHealthConnect(
        food.name,
        activeMealType,
        consumedDate,
        calcCal,
        calcProt,
        calcCarbs,
        calcFat
      );
    } else {
      const createdEntry = await addMealEntry({
        date: currentDateStr,
        mealType: activeMealType,
        foodId: food.id,
        quantityG,
        calculatedCalories: calcCal,
        calculatedProtein: calcProt,
        calculatedCarbs: calcCarbs,
        calculatedFat: calcFat,
      });

      const hcRecordId = await syncMealToHealthConnect(
        food.name,
        activeMealType,
        consumedDate,
        calcCal,
        calcProt,
        calcCarbs,
        calcFat
      );

      if (hcRecordId && createdEntry.id) {
        await updateMealHealthConnectId(createdEntry.id, hcRecordId);
      }
    }

    const updatedEntries = await getMealEntriesByDate(currentDateStr);
    setMealEntries(updatedEntries);

    setEditingEntry(null);
    setLogModalVisible(false);
    setSearchModalVisible(false);
  };

  const handleDeleteEntry = async (entryId: string) => {
    await deleteMealEntry(entryId);
    const updatedEntries = await getMealEntriesByDate(currentDateStr);
    setMealEntries(updatedEntries);
  };

  const handleSaveProfile = async (updatedData: Omit<UserProfile, 'id' | 'updatedAt'>) => {
    const updatedProf = await saveUserProfile(updatedData);
    setProfile(updatedProf);
  };

  // Calculations for current day
  const baseTarget = profile ? profile.calorieTarget : 2000;
  const proteinTarget = profile ? profile.proteinTargetG : 150;
  const carbTarget = profile ? profile.carbTargetG : 200;
  const fatTarget = profile ? profile.fatTargetG : 65;

  const totalConsumedCal = mealEntries.reduce((sum, e) => sum + e.calculatedCalories, 0);
  const totalConsumedProt = mealEntries.reduce((sum, e) => sum + e.calculatedProtein, 0);
  const totalConsumedCarbs = mealEntries.reduce((sum, e) => sum + e.calculatedCarbs, 0);
  const totalConsumedFat = mealEntries.reduce((sum, e) => sum + e.calculatedFat, 0);

  const mealEntriesByType: Record<MealType, MealEntry[]> = {
    BREAKFAST: mealEntries.filter((e) => e.mealType === 'BREAKFAST'),
    LUNCH: mealEntries.filter((e) => e.mealType === 'LUNCH'),
    DINNER: mealEntries.filter((e) => e.mealType === 'DINNER'),
    SNACK: mealEntries.filter((e) => e.mealType === 'SNACK'),
  };

  const breakfastTarget = baseTarget * (profile?.breakfastPct || 0.25);
  const lunchTarget = baseTarget * (profile?.lunchPct || 0.35);
  const dinnerTarget = baseTarget * (profile?.dinnerPct || 0.3);
  const snackTarget = baseTarget * (profile?.snackPct || 0.1);
  const { t } = useTranslation();

  if (!fontsLoaded) {
    return (
      <View style={{ flex: 1, backgroundColor: COLORS.bgBackground, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor="#0F172A" translucent={false} />

      {/* Main Header */}
      <View style={styles.appHeader}>
        <View style={styles.brandRow}>
          <View style={styles.titleWithIcon}>
            <Image
              source={BRAND_LOGO_SOURCE}
              style={styles.brandLogoImage}
              resizeMode="contain"
            />
            <Text style={styles.brandLogo}>{t('app.title')}</Text>
          </View>
        </View>

        <TouchableOpacity
          style={styles.profileIconBtn}
          onPress={() => setProfileModalVisible(true)}
          activeOpacity={0.7}
        >
          <Text style={styles.profileIconText}>👤 {t('app.profile')}</Text>
        </TouchableOpacity>
      </View>

      <UpdateBanner visible={updateAvailable} onStartUpdate={() => startAppUpdate(false)} />

      <ScrollView
        style={styles.mainScrollView}
        contentContainerStyle={{ paddingBottom: 60, flexGrow: 1 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={true}
        nestedScrollEnabled={true}
      >
        <DateNavigator currentDateStr={currentDateStr} onDateChange={handleDateChange} />

        <EnergyBudgetCard
          baseCalorieTarget={baseTarget}
          activeCaloriesBurned={activeCalories}
          consumedCalories={totalConsumedCal}
          stepCount={stepCount}
          isHealthConnectActive={isHealthConnectActive}
          onConnectHealthConnect={handleConnectHealthConnect}
        />

        <MacroProgress
          proteinConsumedG={totalConsumedProt}
          proteinTargetG={proteinTarget}
          carbConsumedG={totalConsumedCarbs}
          carbTargetG={carbTarget}
          fatConsumedG={totalConsumedFat}
          fatTargetG={fatTarget}
        />

        {/* Meal Breakdown List */}
        <Text style={styles.sectionHeaderTitle}>{t('mealBreakdown.title')}</Text>

        <MealBreakdownCard
          mealType="BREAKFAST"
          entries={mealEntriesByType.BREAKFAST}
          targetCalories={breakfastTarget}
          onAddFood={handleOpenSearchModal}
          onDeleteEntry={handleDeleteEntry}
          onEditEntry={handleEditEntry}
        />

        <MealBreakdownCard
          mealType="LUNCH"
          entries={mealEntriesByType.LUNCH}
          targetCalories={lunchTarget}
          onAddFood={handleOpenSearchModal}
          onDeleteEntry={handleDeleteEntry}
          onEditEntry={handleEditEntry}
        />

        <MealBreakdownCard
          mealType="DINNER"
          entries={mealEntriesByType.DINNER}
          targetCalories={dinnerTarget}
          onAddFood={handleOpenSearchModal}
          onDeleteEntry={handleDeleteEntry}
          onEditEntry={handleEditEntry}
        />

        <MealBreakdownCard
          mealType="SNACK"
          entries={mealEntriesByType.SNACK}
          targetCalories={snackTarget}
          onAddFood={handleOpenSearchModal}
          onDeleteEntry={handleDeleteEntry}
          onEditEntry={handleEditEntry}
        />
      </ScrollView>

      {/* Modals */}
      <FoodSearchModal
        visible={searchModalVisible}
        onClose={() => setSearchModalVisible(false)}
        onSelectFood={handleSelectFood}
      />

      <LogMealModal
        visible={logModalVisible}
        food={selectedFood}
        mealType={activeMealType}
        initialQuantityG={editingEntry ? editingEntry.quantityG : undefined}
        isEditing={!!editingEntry}
        onClose={() => {
          setEditingEntry(null);
          setLogModalVisible(false);
        }}
        onConfirmLog={handleConfirmLogMeal}
      />

      {profile && (
        <UserProfileModal
          visible={profileModalVisible}
          profile={profile}
          onClose={() => setProfileModalVisible(false)}
          onSaveProfile={handleSaveProfile}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.bgBackground,
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 24) + 8 : 0,
  },
  appHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: COLORS.bgBackground,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.cardBg,
  },
  brandRow: {
    justifyContent: 'center',
  },
  titleWithIcon: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  brandLogoImage: {
    width: 32,
    height: 32,
  },
  brandLogo: {
    color: COLORS.primary,
    fontSize: 22,
    fontWeight: '900',
    fontFamily: FONTS.extraBold,
    letterSpacing: 0.5,
  },
  profileIconBtn: {
    backgroundColor: COLORS.cardBg,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  profileIconText: {
    color: COLORS.textPrimary,
    fontSize: 12,
    fontWeight: '700',
    fontFamily: FONTS.bold,
  },
  mainScrollView: {
    flex: 1,
  },
  sectionHeaderTitle: {
    color: COLORS.textSecondary,
    fontSize: 12,
    fontWeight: '800',
    fontFamily: FONTS.extraBold,
    letterSpacing: 1.2,
    marginHorizontal: 20,
    marginTop: 10,
    marginBottom: 12,
  },
});
