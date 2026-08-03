import React, { useState } from 'react';
import {
  Modal,
  Platform,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { ActivityFactor, BiologicalSex, UserProfile } from '../types';
import { calculateNutritionTargets } from '../services/nutritionCalculator';
import { COLORS, FONTS } from '../constants/theme';

interface UserProfileModalProps {
  visible: boolean;
  profile: UserProfile;
  onClose: () => void;
  onSaveProfile: (updatedProfile: Omit<UserProfile, 'id' | 'updatedAt'>) => void;
}

export const UserProfileModal: React.FC<UserProfileModalProps> = ({
  visible,
  profile,
  onClose,
  onSaveProfile,
}) => {
  const { t } = useTranslation();
  const [weightKg, setWeightKg] = useState(profile.weightKg.toString());
  const [targetWeightKg, setTargetWeightKg] = useState(
    (profile.targetWeightKg ?? profile.weightKg).toString()
  );
  const [heightCm, setHeightCm] = useState(profile.heightCm.toString());
  const [age, setAge] = useState(profile.age.toString());
  const [sex, setSex] = useState<BiologicalSex>(profile.sex);
  const [activityFactor, setActivityFactor] = useState<ActivityFactor>(profile.activityFactor);
  const [wantMuscleGain, setWantMuscleGain] = useState<boolean>(profile.wantMuscleGain ?? false);
  const [breakfastPctStr, setBreakfastPctStr] = useState(
    Math.round((profile.breakfastPct ?? 0.25) * 100).toString()
  );
  const [lunchPctStr, setLunchPctStr] = useState(
    Math.round((profile.lunchPct ?? 0.35) * 100).toString()
  );
  const [dinnerPctStr, setDinnerPctStr] = useState(
    Math.round((profile.dinnerPct ?? 0.3) * 100).toString()
  );
  const [snackPctStr, setSnackPctStr] = useState(
    Math.round((profile.snackPct ?? 0.1) * 100).toString()
  );

  React.useEffect(() => {
    setWeightKg(profile.weightKg.toString());
    setTargetWeightKg((profile.targetWeightKg ?? profile.weightKg).toString());
    setHeightCm(profile.heightCm.toString());
    setAge(profile.age.toString());
    setSex(profile.sex);
    setActivityFactor(profile.activityFactor);
    setWantMuscleGain(profile.wantMuscleGain ?? false);
    setBreakfastPctStr(Math.round((profile.breakfastPct ?? 0.25) * 100).toString());
    setLunchPctStr(Math.round((profile.lunchPct ?? 0.35) * 100).toString());
    setDinnerPctStr(Math.round((profile.dinnerPct ?? 0.3) * 100).toString());
    setSnackPctStr(Math.round((profile.snackPct ?? 0.1) * 100).toString());
  }, [profile, visible]);

  const w = parseFloat(weightKg) || 70;
  const targetW = parseFloat(targetWeightKg) || w;
  const h = parseFloat(heightCm) || 170;
  const a = parseInt(age, 10) || 25;

  const bPct = parseFloat(breakfastPctStr) || 0;
  const lPct = parseFloat(lunchPctStr) || 0;
  const dPct = parseFloat(dinnerPctStr) || 0;
  const sPct = parseFloat(snackPctStr) || 0;
  const totalPct = bPct + lPct + dPct + sPct;
  const isSplitValid = Math.abs(totalPct - 100) < 0.1;

  const liveTargets = calculateNutritionTargets(w, h, a, sex, activityFactor, targetW, wantMuscleGain);

  const activityOptions: Array<{ label: string; factor: ActivityFactor }> = [
    { label: t('userProfile.activity.smartwatchTracked'), factor: 1.0 },
    { label: t('userProfile.activity.sedentary'), factor: 1.2 },
    { label: t('userProfile.activity.lightlyActive'), factor: 1.375 },
    { label: t('userProfile.activity.moderatelyActive'), factor: 1.55 },
    { label: t('userProfile.activity.veryActive'), factor: 1.725 },
    { label: t('userProfile.activity.extraActive'), factor: 1.9 },
  ];

  const handleSave = () => {
    if (!liveTargets.isHealthyWeight || !isSplitValid) return;

    onSaveProfile({
      weightKg: w,
      targetWeightKg: targetW,
      heightCm: h,
      age: a,
      sex,
      activityFactor,
      goalType: liveTargets.derivedGoalType,
      wantMuscleGain,
      calorieTarget: liveTargets.baseCalorieTarget,
      proteinTargetG: liveTargets.proteinG,
      carbTargetG: liveTargets.carbG,
      fatTargetG: liveTargets.fatG,
      breakfastPct: bPct / 100,
      lunchPct: lPct / 100,
      dinnerPct: dPct / 100,
      snackPct: sPct / 100,
    });
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <SafeAreaView style={styles.overlay}>
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.headerTitle}>{t('userProfile.title')}</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Text style={styles.closeBtnText}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.body} showsVerticalScrollIndicator={false}>
            {/* Biological Sex */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>{t('userProfile.sexLabel')}</Text>
              <View style={styles.selectorRow}>
                <TouchableOpacity
                  style={[styles.selectorBtn, sex === 'MALE' && styles.activeSelectorBtn]}
                  onPress={() => setSex('MALE')}
                >
                  <Text style={[styles.selectorText, sex === 'MALE' && styles.activeSelectorText]}>
                    {t('userProfile.male')}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.selectorBtn, sex === 'FEMALE' && styles.activeSelectorBtn]}
                  onPress={() => setSex('FEMALE')}
                >
                  <Text
                    style={[styles.selectorText, sex === 'FEMALE' && styles.activeSelectorText]}
                  >
                    {t('userProfile.female')}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Current Weight & Target Weight */}
            <View style={styles.rowTwoCols}>
              <View style={[styles.inputGroup, styles.colHalf]}>
                <Text style={styles.label}>{t('userProfile.currentWeightLabel')}</Text>
                <TextInput
                  style={styles.textInput}
                  keyboardType="numeric"
                  value={weightKg}
                  onChangeText={setWeightKg}
                />
              </View>

              <View style={[styles.inputGroup, styles.colHalf]}>
                <Text style={styles.label}>{t('userProfile.targetWeightLabel')}</Text>
                <TextInput
                  style={styles.textInput}
                  keyboardType="numeric"
                  value={targetWeightKg}
                  onChangeText={setTargetWeightKg}
                />
              </View>
            </View>

            {/* Height & Age */}
            <View style={styles.rowTwoCols}>
              <View style={[styles.inputGroup, styles.colHalf]}>
                <Text style={styles.label}>{t('userProfile.heightLabel')}</Text>
                <TextInput
                  style={styles.textInput}
                  keyboardType="numeric"
                  value={heightCm}
                  onChangeText={setHeightCm}
                />
              </View>

              <View style={[styles.inputGroup, styles.colHalf]}>
                <Text style={styles.label}>{t('userProfile.ageLabel')}</Text>
                <TextInput
                  style={styles.textInput}
                  keyboardType="numeric"
                  value={age}
                  onChangeText={setAge}
                />
              </View>
            </View>

            {/* Activity Level */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>{t('userProfile.activityLabel')}</Text>
              <View style={styles.optionsCol}>
                {activityOptions.map((opt) => (
                  <TouchableOpacity
                    key={opt.factor.toString()}
                    style={[
                      styles.optChip,
                      activityFactor === opt.factor && styles.activeOptChip,
                    ]}
                    onPress={() => setActivityFactor(opt.factor)}
                  >
                    <Text
                      style={[
                        styles.optChipText,
                        activityFactor === opt.factor && styles.activeOptChipText,
                      ]}
                    >
                      {opt.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Objective 2: Gain Muscle Toggle */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>{t('userProfile.muscleGainTitle')}</Text>
              <TouchableOpacity
                style={[styles.toggleChip, wantMuscleGain && styles.activeToggleChip]}
                onPress={() => setWantMuscleGain(!wantMuscleGain)}
                activeOpacity={0.7}
              >
                <Text style={styles.toggleChipIcon}>{wantMuscleGain ? '💪' : '⚪'}</Text>
                <Text
                  style={[
                    styles.toggleChipText,
                    wantMuscleGain && styles.activeToggleChipText,
                  ]}
                >
                  {t('userProfile.gainMuscleToggle')}
                </Text>
              </TouchableOpacity>

              {wantMuscleGain && (
                <View style={styles.cumulativeBadgeBox}>
                  <Text style={styles.cumulativeBadgeText}>
                    ⚡ {t('userProfile.recompActiveBadge')}
                  </Text>
                </View>
              )}
            </View>

            {/* Meal Calorie Distribution (%) */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>{t('userProfile.mealSplitTitle')}</Text>

              <View style={styles.mealSplitGrid}>
                <View style={styles.mealSplitItem}>
                  <Text style={styles.mealSplitLabel}>☕ {t('mealBreakdown.breakfast')}</Text>
                  <View style={styles.percentInputRow}>
                    <TextInput
                      style={styles.percentInput}
                      keyboardType="numeric"
                      value={breakfastPctStr}
                      onChangeText={setBreakfastPctStr}
                    />
                    <Text style={styles.percentSymbol}>%</Text>
                  </View>
                  <Text style={styles.mealSplitKcal}>
                    {Math.round(liveTargets.baseCalorieTarget * (bPct / 100))} kcal
                  </Text>
                </View>

                <View style={styles.mealSplitItem}>
                  <Text style={styles.mealSplitLabel}>🍜 {t('mealBreakdown.lunch')}</Text>
                  <View style={styles.percentInputRow}>
                    <TextInput
                      style={styles.percentInput}
                      keyboardType="numeric"
                      value={lunchPctStr}
                      onChangeText={setLunchPctStr}
                    />
                    <Text style={styles.percentSymbol}>%</Text>
                  </View>
                  <Text style={styles.mealSplitKcal}>
                    {Math.round(liveTargets.baseCalorieTarget * (lPct / 100))} kcal
                  </Text>
                </View>

                <View style={styles.mealSplitItem}>
                  <Text style={styles.mealSplitLabel}>🥗 {t('mealBreakdown.dinner')}</Text>
                  <View style={styles.percentInputRow}>
                    <TextInput
                      style={styles.percentInput}
                      keyboardType="numeric"
                      value={dinnerPctStr}
                      onChangeText={setDinnerPctStr}
                    />
                    <Text style={styles.percentSymbol}>%</Text>
                  </View>
                  <Text style={styles.mealSplitKcal}>
                    {Math.round(liveTargets.baseCalorieTarget * (dPct / 100))} kcal
                  </Text>
                </View>

                <View style={styles.mealSplitItem}>
                  <Text style={styles.mealSplitLabel}>🍎 {t('mealBreakdown.snacks')}</Text>
                  <View style={styles.percentInputRow}>
                    <TextInput
                      style={styles.percentInput}
                      keyboardType="numeric"
                      value={snackPctStr}
                      onChangeText={setSnackPctStr}
                    />
                    <Text style={styles.percentSymbol}>%</Text>
                  </View>
                  <Text style={styles.mealSplitKcal}>
                    {Math.round(liveTargets.baseCalorieTarget * (sPct / 100))} kcal
                  </Text>
                </View>
              </View>

              <View style={[styles.splitBadgeBox, isSplitValid ? styles.splitBadgeValid : styles.splitBadgeInvalid]}>
                <Text style={[styles.splitBadgeText, isSplitValid ? styles.splitBadgeTextValid : styles.splitBadgeTextInvalid]}>
                  {isSplitValid
                    ? t('userProfile.totalSplitValid', { total: Math.round(totalPct) })
                    : t('userProfile.totalSplitInvalid', { total: Math.round(totalPct) })}
                </Text>
              </View>
            </View>

            {/* Live Recalculated Targets Preview Card */}
            <View style={styles.previewCard}>
              <Text style={styles.previewTitle}>{t('userProfile.previewTitle')}</Text>

              <View style={styles.previewGrid}>
                <View style={styles.previewItem}>
                  <Text style={styles.previewVal}>{liveTargets.bmr} kcal</Text>
                  <Text style={styles.previewLabel}>{t('userProfile.bmrLabel')}</Text>
                </View>

                <View style={styles.previewItem}>
                  <Text style={styles.previewVal}>{liveTargets.tdee} kcal</Text>
                  <Text style={styles.previewLabel}>{t('userProfile.tdeeLabel')}</Text>
                </View>
              </View>

              <View style={styles.targetBanner}>
                <Text style={styles.targetBannerTitle}>{t('userProfile.recommendedCalorieTarget')}</Text>
                <Text style={styles.targetBannerVal}>{liveTargets.baseCalorieTarget} kcal/day</Text>
                {liveTargets.calorieAdjustment !== 0 && (
                  <Text style={styles.safetySubtext}>
                    {liveTargets.calorieAdjustment < 0 ? 'Deficit' : 'Surplus'}:{' '}
                    {Math.abs(liveTargets.calorieAdjustment)} kcal/day
                  </Text>
                )}
              </View>

              <View style={styles.macroSplitRow}>
                <Text style={styles.macroSplitText}>
                  {t('macroProgress.protein')}: {liveTargets.proteinG}g
                </Text>
                <Text style={styles.macroSplitText}>
                  {t('macroProgress.carbs')}: {liveTargets.carbG}g
                </Text>
                <Text style={styles.macroSplitText}>
                  {t('macroProgress.fat')}: {liveTargets.fatG}g
                </Text>
              </View>
            </View>

            {/* Save Action Button */}
            <TouchableOpacity
              style={[
                styles.saveBtn,
                (!liveTargets.isHealthyWeight || !isSplitValid) && styles.saveBtnDisabled,
              ]}
              onPress={handleSave}
              disabled={!liveTargets.isHealthyWeight || !isSplitValid}
            >
              <Text
                style={[
                  styles.saveBtnText,
                  (!liveTargets.isHealthyWeight || !isSplitValid) && styles.saveBtnTextDisabled,
                ]}
              >
                {t('userProfile.saveProfileBtn')}
              </Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: COLORS.bgBackground,
  },
  container: {
    flex: 1,
    backgroundColor: COLORS.bgBackground,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.cardBg,
  },
  headerTitle: {
    color: COLORS.textPrimary,
    fontSize: 20,
    fontWeight: '800',
    fontFamily: FONTS.extraBold,
  },
  closeBtn: {
    padding: 4,
  },
  closeBtnText: {
    color: COLORS.textSecondary,
    fontSize: 20,
    fontWeight: '700',
    fontFamily: FONTS.bold,
  },
  body: {
    padding: 20,
  },
  inputGroup: {
    marginBottom: 16,
  },
  rowTwoCols: {
    flexDirection: 'row',
    gap: 12,
  },
  colHalf: {
    flex: 1,
  },
  label: {
    color: COLORS.textSecondary,
    fontSize: 12,
    fontWeight: '700',
    fontFamily: FONTS.bold,
    marginBottom: 6,
    letterSpacing: 0.5,
  },
  textInput: {
    backgroundColor: COLORS.cardBg,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    color: COLORS.textPrimary,
    fontSize: 15,
    fontWeight: '600',
    fontFamily: FONTS.semibold,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  selectorRow: {
    flexDirection: 'row',
    gap: 10,
  },
  selectorBtn: {
    flex: 1,
    paddingVertical: 12,
    backgroundColor: COLORS.cardBg,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  activeSelectorBtn: {
    backgroundColor: COLORS.primaryDark,
    borderColor: COLORS.primary,
  },
  selectorText: {
    color: COLORS.textSecondary,
    fontWeight: '700',
    fontFamily: FONTS.bold,
  },
  activeSelectorText: {
    color: '#FFFFFF',
  },
  optionsCol: {
    gap: 8,
  },
  optChip: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    backgroundColor: COLORS.cardBg,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  activeOptChip: {
    backgroundColor: COLORS.primaryDark,
    borderColor: COLORS.primary,
  },
  optChipText: {
    color: COLORS.textSecondary,
    fontSize: 13,
    fontWeight: '600',
    fontFamily: FONTS.semibold,
  },
  activeOptChipText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontFamily: FONTS.bold,
  },
  toggleChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    backgroundColor: COLORS.cardBg,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  activeToggleChip: {
    backgroundColor: COLORS.primaryDark,
    borderColor: COLORS.primary,
  },
  toggleChipIcon: {
    fontSize: 16,
    color: COLORS.primary,
  },
  toggleChipText: {
    color: COLORS.textPrimary,
    fontSize: 13,
    fontWeight: '600',
    fontFamily: FONTS.semibold,
  },
  activeToggleChipText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontFamily: FONTS.bold,
  },
  cumulativeBadgeBox: {
    marginTop: 10,
    backgroundColor: COLORS.cardBg,
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  cumulativeBadgeText: {
    color: COLORS.primary,
    fontSize: 12,
    fontWeight: '700',
    fontFamily: FONTS.bold,
  },
  mealSplitGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 10,
    marginTop: 8,
  },
  mealSplitItem: {
    width: '48%',
    backgroundColor: COLORS.cardBg,
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  mealSplitLabel: {
    color: COLORS.textPrimary,
    fontSize: 13,
    fontWeight: '600',
    fontFamily: FONTS.semibold,
    marginBottom: 6,
  },
  percentInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.bgBackground,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    paddingHorizontal: 8,
  },
  percentInput: {
    flex: 1,
    color: COLORS.textPrimary,
    fontSize: 16,
    fontWeight: '700',
    fontFamily: FONTS.bold,
    paddingVertical: 6,
  },
  percentSymbol: {
    color: COLORS.textSecondary,
    fontSize: 14,
    fontWeight: '600',
    fontFamily: FONTS.semibold,
  },
  mealSplitKcal: {
    color: COLORS.primary,
    fontSize: 12,
    fontWeight: '600',
    fontFamily: FONTS.semibold,
    marginTop: 4,
  },
  splitBadgeBox: {
    marginTop: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  splitBadgeValid: {
    backgroundColor: 'rgba(34, 197, 94, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(34, 197, 94, 0.4)',
  },
  splitBadgeInvalid: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.4)',
  },
  splitBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    fontFamily: FONTS.semibold,
  },
  splitBadgeTextValid: {
    color: COLORS.successLight,
  },
  splitBadgeTextInvalid: {
    color: '#F87171',
  },
  previewCard: {
    backgroundColor: COLORS.cardBg,
    borderRadius: 18,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: COLORS.primary,
  },
  previewTitle: {
    color: COLORS.primary,
    fontSize: 12,
    fontWeight: '800',
    fontFamily: FONTS.extraBold,
    letterSpacing: 1.2,
    marginBottom: 12,
  },
  previewGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 12,
  },
  previewItem: {
    alignItems: 'center',
  },
  previewVal: {
    color: COLORS.textPrimary,
    fontSize: 16,
    fontWeight: '700',
    fontFamily: FONTS.bold,
  },
  previewLabel: {
    color: COLORS.textSecondary,
    fontSize: 11,
    fontFamily: FONTS.medium,
    marginTop: 2,
  },
  targetBanner: {
    backgroundColor: COLORS.bgBackground,
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
    marginVertical: 6,
  },
  targetBannerTitle: {
    color: COLORS.textSecondary,
    fontSize: 12,
    fontWeight: '600',
    fontFamily: FONTS.semibold,
  },
  targetBannerVal: {
    color: COLORS.successLight,
    fontSize: 26,
    fontWeight: '800',
    fontFamily: FONTS.extraBold,
    marginTop: 2,
  },
  safetySubtext: {
    color: COLORS.primary,
    fontSize: 11,
    fontWeight: '600',
    fontFamily: FONTS.semibold,
    marginTop: 4,
  },
  macroSplitRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 10,
  },
  macroSplitText: {
    color: COLORS.textPrimary,
    fontSize: 12,
    fontWeight: '600',
    fontFamily: FONTS.semibold,
  },
  saveBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  saveBtnDisabled: {
    backgroundColor: COLORS.cardBorder,
    opacity: 0.6,
  },
  saveBtnText: {
    color: '#0F172A',
    fontSize: 16,
    fontWeight: '800',
    fontFamily: FONTS.extraBold,
  },
  saveBtnTextDisabled: {
    color: COLORS.textMuted,
  },
});
