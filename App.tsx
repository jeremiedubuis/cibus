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
import { ActivityEntry, AppTab, FoodItem, MealEntry, MealType, SleepEntry, UserProfile } from './src/types';
import { COLORS, FONTS } from './src/constants/theme';
import {
  addActivityEntry,
  addMealEntry,
  addSleepEntry,
  deleteActivityEntry,
  deleteMealEntry,
  deleteSleepEntry,
  getActivityEntriesByDate,
  getDisclaimerAccepted,
  getMealEntriesByDate,
  getSleepEntriesByDate,
  getUserProfile,
  initDatabase,
  saveDisclaimerAccepted,
  saveUserProfile,
  updateActivityEntry,
  updateActivityHealthConnectId,
  updateMealEntry,
  updateMealHealthConnectId,
  updateSleepEntry,
} from './src/services/database';
import {
  HealthConnectPermissionStatus,
  checkHealthConnectGranularPermissions,
  checkHealthConnectPermissionsGranted,
  fetchDailyBurnedMetrics,
  isHealthConnectAvailable,
  reconcileHealthConnectData,
  requestHealthConnectPermissions,
  syncActivityToHealthConnect,
  syncMealToHealthConnect,
} from './src/services/healthConnect';
import { checkAppUpdates, startAppUpdate } from './src/services/inAppUpdates';
import { DateNavigator } from './src/components/DateNavigator';
import { EnergyBudgetCard } from './src/components/EnergyBudgetCard';
import { MacroProgress } from './src/components/MacroProgress';
import { MealBreakdownCard } from './src/components/MealBreakdownCard';
import { ActivityBreakdownCard } from './src/components/ActivityBreakdownCard';
import { SleepBreakdownCard } from './src/components/SleepBreakdownCard';
import { FoodSearchModal } from './src/components/FoodSearchModal';
import { LogMealModal } from './src/components/LogMealModal';
import { LogActivityModal } from './src/components/LogActivityModal';
import { ActivityDetailModal } from './src/components/ActivityDetailModal';
import { LogSleepModal } from './src/components/LogSleepModal';
import { UserProfileModal } from './src/components/UserProfileModal';
import { DisclaimerModal } from './src/components/DisclaimerModal';
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
  const [activeTab, setActiveTab] = useState<AppTab>('NUTRITION');
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [mealEntries, setMealEntries] = useState<MealEntry[]>([]);
  const [activityEntries, setActivityEntries] = useState<ActivityEntry[]>([]);
  const [sleepEntries, setSleepEntries] = useState<SleepEntry[]>([]);
  const [activeCalories, setActiveCalories] = useState<number>(0);
  const [stepCount, setStepCount] = useState<number>(0);
  const [regularStepCount, setRegularStepCount] = useState<number>(0);
  const [activityStepCount, setActivityStepCount] = useState<number>(0);
  const [isHealthConnectActive, setIsHealthConnectActive] = useState<boolean>(false);
  const [permissionsStatus, setPermissionsStatus] = useState<HealthConnectPermissionStatus>({
    nutritionGranted: false,
    activityGranted: false,
    sleepGranted: false,
    allGranted: false,
  });
  const [updateAvailable, setUpdateAvailable] = useState<boolean>(false);

  // Modals state
  const [disclaimerModalVisible, setDisclaimerModalVisible] = useState<boolean>(false);
  const [searchModalVisible, setSearchModalVisible] = useState<boolean>(false);
  const [logModalVisible, setLogModalVisible] = useState<boolean>(false);
  const [profileModalVisible, setProfileModalVisible] = useState<boolean>(false);
  const [activityModalVisible, setActivityModalVisible] = useState<boolean>(false);
  const [activityDetailModalVisible, setActivityDetailModalVisible] = useState<boolean>(false);
  const [selectedDetailActivity, setSelectedDetailActivity] = useState<ActivityEntry | null>(null);
  const [sleepModalVisible, setSleepModalVisible] = useState<boolean>(false);
  const [activeMealType, setActiveMealType] = useState<MealType>('BREAKFAST');
  const [selectedFood, setSelectedFood] = useState<FoodItem | null>(null);
  const [editingEntry, setEditingEntry] = useState<MealEntry | null>(null);
  const [editingActivity, setEditingActivity] = useState<ActivityEntry | null>(null);
  const [editingSleep, setEditingSleep] = useState<SleepEntry | null>(null);

  const refreshPermissionsStatus = async (): Promise<HealthConnectPermissionStatus> => {
    const status = await checkHealthConnectGranularPermissions();
    setPermissionsStatus(status);
    setIsHealthConnectActive(status.nutritionGranted || status.activityGranted);
    return status;
  };

  const handleConfirmDisclaimer = async () => {
    await saveDisclaimerAccepted();
    setDisclaimerModalVisible(false);
  };

  // Initial setup
  useEffect(() => {
    async function setupApp() {
      await initDatabase();
      let userProf = await getUserProfile();
      setProfile(userProf);

      const disclaimerAccepted = await getDisclaimerAccepted();
      if (!disclaimerAccepted) {
        setDisclaimerModalVisible(true);
      }

      const status = await refreshPermissionsStatus();

      if (status.nutritionGranted || status.activityGranted) {
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
        const status = await refreshPermissionsStatus();

        if (status.nutritionGranted || status.activityGranted) {
          await reconcileHealthConnectData();
          const freshProf = await getUserProfile();
          setProfile(freshProf);

          const entries = await getMealEntriesByDate(currentDateStr);
          setMealEntries(entries);

          const actEntries = await getActivityEntriesByDate(currentDateStr);
          setActivityEntries(actEntries);

          const slpEntries = await getSleepEntriesByDate(currentDateStr);
          setSleepEntries(slpEntries);

          const targetDate = new Date(currentDateStr);
          const metrics = await fetchDailyBurnedMetrics(targetDate);
          setActiveCalories(metrics.activeCaloriesKcal);
          setStepCount(metrics.stepCount);
          setRegularStepCount(metrics.regularStepCount);
          setActivityStepCount(metrics.activityStepCount);
        }
      }
    });

    return () => {
      subscription.remove();
    };
  }, [currentDateStr]);

  const handleConnectHealthConnect = async () => {
    await requestHealthConnectPermissions();
    const status = await refreshPermissionsStatus();
    if (status.nutritionGranted || status.activityGranted || status.sleepGranted) {
      // Force full week reconciliation on permission grant
      await reconcileHealthConnectData(true);
      const freshProf = await getUserProfile();
      setProfile(freshProf);

      const entries = await getMealEntriesByDate(currentDateStr);
      setMealEntries(entries);

      const actEntries = await getActivityEntriesByDate(currentDateStr);
      setActivityEntries(actEntries);

      const slpEntries = await getSleepEntriesByDate(currentDateStr);
      setSleepEntries(slpEntries);

      const targetDate = new Date(currentDateStr);
      const metrics = await fetchDailyBurnedMetrics(targetDate);
      setActiveCalories(metrics.activeCaloriesKcal);
      setStepCount(metrics.stepCount);
      setRegularStepCount(metrics.regularStepCount);
      setActivityStepCount(metrics.activityStepCount);
    }
  };

  // Reload entries & metrics on date or profile change
  useEffect(() => {
    async function loadDayData() {
      const entries = await getMealEntriesByDate(currentDateStr);
      setMealEntries(entries);

      const actEntries = await getActivityEntriesByDate(currentDateStr);
      setActivityEntries(actEntries);

      const slpEntries = await getSleepEntriesByDate(currentDateStr);
      setSleepEntries(slpEntries);

      const targetDate = new Date(currentDateStr);
      const metrics = await fetchDailyBurnedMetrics(targetDate);
      setActiveCalories(metrics.activeCaloriesKcal);
      setStepCount(metrics.stepCount);
      setRegularStepCount(metrics.regularStepCount);
      setActivityStepCount(metrics.activityStepCount);
    }
    loadDayData();
  }, [currentDateStr, profile]);

  const handleDateChange = (newDateStr: string) => {
    setCurrentDateStr(newDateStr);
  };

  // Meal handlers
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

  // Activity handlers
  const handleOpenAddActivity = () => {
    setEditingActivity(null);
    setActivityModalVisible(true);
  };

  const handleOpenEditActivity = (entry: ActivityEntry) => {
    setEditingActivity(entry);
    setActivityModalVisible(true);
  };

  const handleConfirmSaveActivity = async (
    activityData: Omit<ActivityEntry, 'id'>,
    idToUpdate?: string
  ) => {
    if (idToUpdate) {
      await updateActivityEntry(idToUpdate, activityData);
      if (activityData.healthConnectId) {
        await syncActivityToHealthConnect({ ...activityData, id: idToUpdate });
      }
    } else {
      const created = await addActivityEntry(activityData);
      const hcId = await syncActivityToHealthConnect(created);
      if (hcId && created.id) {
        await updateActivityHealthConnectId(created.id, hcId);
      }
    }

    const updated = await getActivityEntriesByDate(currentDateStr);
    setActivityEntries(updated);

    const targetDate = new Date(currentDateStr);
    const metrics = await fetchDailyBurnedMetrics(targetDate);
    setActiveCalories(metrics.activeCaloriesKcal);
    setStepCount(metrics.stepCount);
    setRegularStepCount(metrics.regularStepCount);
    setActivityStepCount(metrics.activityStepCount);
  };

  const handleDeleteActivity = async (activityId: string) => {
    await deleteActivityEntry(activityId);
    const updated = await getActivityEntriesByDate(currentDateStr);
    setActivityEntries(updated);

    const targetDate = new Date(currentDateStr);
    const metrics = await fetchDailyBurnedMetrics(targetDate);
    setActiveCalories(metrics.activeCaloriesKcal);
    setStepCount(metrics.stepCount);
    setRegularStepCount(metrics.regularStepCount);
    setActivityStepCount(metrics.activityStepCount);
  };

  // Sleep handlers
  const handleOpenAddSleep = () => {
    setEditingSleep(null);
    setSleepModalVisible(true);
  };

  const handleOpenEditSleep = (entry: SleepEntry) => {
    setEditingSleep(entry);
    setSleepModalVisible(true);
  };

  const handleSaveSleepEntry = async (entryData: Omit<SleepEntry, 'id'>, idToUpdate?: string) => {
    if (idToUpdate) {
      await updateSleepEntry(idToUpdate, entryData);
    } else {
      await addSleepEntry(entryData);
    }
    const updated = await getSleepEntriesByDate(currentDateStr);
    setSleepEntries(updated);
  };

  const handleDeleteSleepEntry = async (id: string) => {
    await deleteSleepEntry(id);
    const updated = await getSleepEntriesByDate(currentDateStr);
    setSleepEntries(updated);
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

      {/* Global Tab Navigation */}
      <View style={styles.tabBarContainer}>
        <TouchableOpacity
          style={[styles.tabBtn, activeTab === 'NUTRITION' && styles.activeTabBtn]}
          onPress={() => setActiveTab('NUTRITION')}
          activeOpacity={0.7}
        >
          <Text style={[styles.tabBtnText, activeTab === 'NUTRITION' && styles.activeTabBtnText]}>
            🥗 {t('tabs.nutrition')}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabBtn, activeTab === 'ACTIVITIES' && styles.activeTabBtn]}
          onPress={() => setActiveTab('ACTIVITIES')}
          activeOpacity={0.7}
        >
          <Text style={[styles.tabBtnText, activeTab === 'ACTIVITIES' && styles.activeTabBtnText]}>
            🏃 {t('tabs.activities')}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabBtn, activeTab === 'SLEEP' && styles.activeTabBtn]}
          onPress={() => setActiveTab('SLEEP')}
          activeOpacity={0.7}
        >
          <Text style={[styles.tabBtnText, activeTab === 'SLEEP' && styles.activeTabBtnText]}>
            😴 {t('tabs.sleep')}
          </Text>
        </TouchableOpacity>
      </View>

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
          activeCaloriesBurned={Math.max(
            activeCalories,
            activityEntries.reduce((sum, a) => sum + (a.caloriesKcal || 0), 0)
          )}
          consumedCalories={totalConsumedCal}
          stepCount={stepCount}
          regularStepCount={regularStepCount}
          activityStepCount={activityStepCount}
          isHealthConnectActive={permissionsStatus.nutritionGranted}
          onConnectHealthConnect={handleConnectHealthConnect}
        />

        {activeTab === 'NUTRITION' ? (
          <>
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
          </>
        ) : activeTab === 'ACTIVITIES' ? (
          <ActivityBreakdownCard
            entries={activityEntries}
            isHealthConnectActive={permissionsStatus.activityGranted}
            onConnectHealthConnect={handleConnectHealthConnect}
            onAddActivity={handleOpenAddActivity}
            onEditActivity={handleOpenEditActivity}
            onSelectActivity={(activity) => {
              setSelectedDetailActivity(activity);
              setActivityDetailModalVisible(true);
            }}
            onDeleteActivity={handleDeleteActivity}
          />
        ) : (
          <SleepBreakdownCard
            sleepEntries={sleepEntries}
            targetSleepMinutes={profile?.targetSleepMinutes ?? 480}
            onAddSleep={handleOpenAddSleep}
            onEditSleep={handleOpenEditSleep}
            onDeleteSleep={handleDeleteSleepEntry}
            isHealthConnectActive={permissionsStatus.sleepGranted ?? false}
            onConnectHealthConnect={handleConnectHealthConnect}
          />
        )}
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

      <LogActivityModal
        visible={activityModalVisible}
        activityToEdit={editingActivity}
        defaultDurationMinutes={profile?.defaultWorkoutDurationMinutes ?? 20}
        currentDateStr={currentDateStr}
        onClose={() => {
          setEditingActivity(null);
          setActivityModalVisible(false);
        }}
        onConfirmSave={handleConfirmSaveActivity}
        onDeleteActivity={handleDeleteActivity}
      />

      <ActivityDetailModal
        visible={activityDetailModalVisible}
        activity={selectedDetailActivity}
        userAge={profile?.age ?? 30}
        onClose={() => {
          setActivityDetailModalVisible(false);
          setSelectedDetailActivity(null);
        }}
        onEdit={(act) => {
          setActivityDetailModalVisible(false);
          handleOpenEditActivity(act);
        }}
      />

      <LogSleepModal
        visible={sleepModalVisible}
        onClose={() => {
          setEditingSleep(null);
          setSleepModalVisible(false);
        }}
        onSave={handleSaveSleepEntry}
        initialEntry={editingSleep}
        currentDateStr={currentDateStr}
        targetSleepMinutes={profile?.targetSleepMinutes ?? 480}
      />

      {profile && (
        <UserProfileModal
          visible={profileModalVisible}
          profile={profile}
          isNutritionPermissionGranted={permissionsStatus.nutritionGranted}
          isActivityPermissionGranted={permissionsStatus.activityGranted}
          isSleepPermissionGranted={permissionsStatus.sleepGranted ?? false}
          onConnectHealthConnect={handleConnectHealthConnect}
          onClose={() => setProfileModalVisible(false)}
          onSaveProfile={handleSaveProfile}
        />
      )}

      <DisclaimerModal
        visible={disclaimerModalVisible}
        onConfirm={handleConfirmDisclaimer}
      />
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
  tabBarContainer: {
    flexDirection: 'row',
    backgroundColor: COLORS.cardBg,
    marginHorizontal: 20,
    marginTop: 12,
    marginBottom: 4,
    borderRadius: 14,
    padding: 4,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 10,
  },
  activeTabBtn: {
    backgroundColor: COLORS.primaryDark,
  },
  tabBtnText: {
    color: COLORS.textSecondary,
    fontSize: 14,
    fontWeight: '700',
    fontFamily: FONTS.bold,
  },
  activeTabBtnText: {
    color: '#FFFFFF',
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
