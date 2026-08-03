import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { COLORS, FONTS } from '../constants/theme';

interface EnergyBudgetCardProps {
  baseCalorieTarget: number;
  activeCaloriesBurned: number;
  consumedCalories: number;
  stepCount: number;
  isHealthConnectActive: boolean;
  onConnectHealthConnect?: () => void;
}

export const EnergyBudgetCard: React.FC<EnergyBudgetCardProps> = ({
  baseCalorieTarget,
  activeCaloriesBurned,
  consumedCalories,
  stepCount,
  isHealthConnectActive,
  onConnectHealthConnect,
}) => {
  const { t } = useTranslation();
  const dynamicBudget = Math.max(0, baseCalorieTarget + activeCaloriesBurned);
  const remainingCalories = dynamicBudget - consumedCalories;
  const progressRatio = Math.min(1, Math.max(0, consumedCalories / (dynamicBudget || 1)));

  if (!isHealthConnectActive) {
    return (
      <View style={styles.ctaCard}>
        <View style={styles.headerRow}>
          <Text style={styles.cardTitle}>{t('energyBudget.title')}</Text>
        </View>

        <View style={styles.ctaContent}>
          <View style={styles.ctaIconBadge}>
            <Text style={styles.ctaIcon}>⚡</Text>
          </View>
          <Text style={styles.ctaTitle}>
            {t('energyBudget.connectHcTitle', { defaultValue: 'Connect Health Connect' })}
          </Text>
          <Text style={styles.ctaDescription}>
            {t('energyBudget.connectHcDesc', {
              defaultValue:
                'Connect Google Health Connect to automatically sync active calories, steps, and track your dynamic energy budget.',
            })}
          </Text>
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={onConnectHealthConnect}
            style={styles.ctaButton}
          >
            <Text style={styles.ctaButtonText}>
              {t('energyBudget.connectHcBtn', { defaultValue: '⚡ Connect Health Connect' })}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>{t('energyBudget.title')}</Text>

      <View style={styles.remainingSection}>
        <Text style={[styles.remainingNumber, { color: COLORS.textPrimary }]}>
          {Math.abs(Math.round(remainingCalories))}
        </Text>
        <Text style={styles.remainingLabel}>
          {remainingCalories < 0 ? t('energyBudget.overBudget') : t('energyBudget.remaining')}
        </Text>
      </View>

      <View style={styles.progressBarContainer}>
        <View style={[styles.progressBarFill, { width: `${progressRatio * 100}%` }]} />
      </View>

      <View style={styles.metricsRow}>
        <View style={styles.metricItem}>
          <Text style={styles.metricValue}>{Math.round(baseCalorieTarget)}</Text>
          <Text style={styles.metricLabel}>{t('energyBudget.baseGoal')}</Text>
        </View>

        <Text style={styles.metricPlus}>+</Text>

        <View style={styles.metricItem}>
          <Text style={[styles.metricValue, { color: COLORS.successLight }]}>
            {Math.round(activeCaloriesBurned)}
          </Text>
          <Text style={styles.metricLabel}>{t('energyBudget.activeBurned')}</Text>
        </View>

        <Text style={styles.metricMinus}>-</Text>

        <View style={styles.metricItem}>
          <Text style={[styles.metricValue, { color: COLORS.primary }]}>
            {Math.round(consumedCalories)}
          </Text>
          <Text style={styles.metricLabel}>{t('energyBudget.foodIntake')}</Text>
        </View>
      </View>

      {stepCount > 0 && (
        <View style={styles.stepsRow}>
          <Text style={styles.stepsText}>{t('energyBudget.steps', { count: stepCount.toLocaleString() })}</Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.cardBg,
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginHorizontal: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  cardTitle: {
    color: COLORS.textSecondary,
    fontSize: 11,
    fontWeight: '700',
    fontFamily: FONTS.bold,
    letterSpacing: 1.1,
    marginBottom: 6,
  },
  remainingSection: {
    alignItems: 'center',
    marginVertical: 4,
  },
  remainingNumber: {
    fontSize: 36,
    fontWeight: '800',
    fontFamily: FONTS.extraBold,
    letterSpacing: -0.5,
    lineHeight: 40,
  },
  remainingLabel: {
    color: COLORS.textSecondary,
    fontSize: 12,
    fontWeight: '500',
    fontFamily: FONTS.medium,
    marginTop: -2,
  },
  progressBarContainer: {
    height: 6,
    backgroundColor: COLORS.bgBackground,
    borderRadius: 3,
    overflow: 'hidden',
    marginVertical: 8,
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: COLORS.primary,
    borderRadius: 3,
  },
  metricsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: COLORS.cardBorder,
  },
  metricItem: {
    flex: 1,
    alignItems: 'center',
  },
  metricValue: {
    color: COLORS.textPrimary,
    fontSize: 15,
    fontWeight: '700',
    fontFamily: FONTS.bold,
  },
  metricLabel: {
    color: COLORS.textMuted,
    fontSize: 10,
    fontWeight: '500',
    fontFamily: FONTS.medium,
    marginTop: 2,
    textAlign: 'center',
  },
  metricPlus: {
    color: COLORS.successLight,
    fontSize: 14,
    fontWeight: '700',
    fontFamily: FONTS.bold,
  },
  metricMinus: {
    color: COLORS.primary,
    fontSize: 14,
    fontWeight: '700',
    fontFamily: FONTS.bold,
  },
  stepsRow: {
    marginTop: 8,
    backgroundColor: COLORS.bgBackground,
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 6,
    alignSelf: 'center',
  },
  stepsText: {
    color: '#CBD5E1',
    fontSize: 11,
    fontWeight: '600',
    fontFamily: FONTS.semibold,
  },
  ctaCard: {
    backgroundColor: COLORS.cardBg,
    borderRadius: 16,
    padding: 14,
    marginHorizontal: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  ctaContent: {
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  ctaIconBadge: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.primaryMuted,
    borderWidth: 1,
    borderColor: COLORS.primaryGlow,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  ctaIcon: {
    fontSize: 22,
  },
  ctaTitle: {
    color: COLORS.textPrimary,
    fontSize: 16,
    fontWeight: '700',
    fontFamily: FONTS.bold,
    textAlign: 'center',
    marginBottom: 4,
  },
  ctaDescription: {
    color: COLORS.textSecondary,
    fontSize: 12,
    fontFamily: FONTS.regular,
    lineHeight: 18,
    textAlign: 'center',
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  ctaButton: {
    backgroundColor: COLORS.primary,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 12,
    width: '100%',
    alignItems: 'center',
  },
  ctaButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
    fontFamily: FONTS.bold,
    letterSpacing: 0.3,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
});
