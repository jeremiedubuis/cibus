import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { COLORS, FONTS } from '../constants/theme';

interface MacroProgressProps {
  proteinConsumedG: number;
  proteinTargetG: number;
  carbConsumedG: number;
  carbTargetG: number;
  fatConsumedG: number;
  fatTargetG: number;
}

export const MacroProgress: React.FC<MacroProgressProps> = ({
  proteinConsumedG,
  proteinTargetG,
  carbConsumedG,
  carbTargetG,
  fatConsumedG,
  fatTargetG,
}) => {
  const { t } = useTranslation();

  const renderMacroBar = (
    label: string,
    consumed: number,
    target: number,
    color: string,
    unit: string = 'g'
  ) => {
    const roundedConsumed = Math.round(consumed * 10) / 10;
    const roundedTarget = Math.round(target);
    const pct = Math.min(100, Math.max(0, Math.round((consumed / (target || 1)) * 100)));

    return (
      <View style={styles.macroCol}>
        <View style={styles.macroHeader}>
          <Text style={styles.macroLabel}>{label}</Text>
          <Text style={styles.macroValues}>
            {roundedConsumed}/{roundedTarget}
            {unit}
          </Text>
        </View>
        <View style={styles.track}>
          <View style={[styles.fill, { width: `${pct}%`, backgroundColor: color }]} />
        </View>
        <Text style={styles.pctText}>{pct}%</Text>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <Text style={styles.sectionTitle}>{t('macroProgress.title')}</Text>
      <View style={styles.row}>
        {renderMacroBar(t('macroProgress.protein'), proteinConsumedG, proteinTargetG, COLORS.macroProtein)}
        {renderMacroBar(t('macroProgress.carbs'), carbConsumedG, carbTargetG, COLORS.macroCarbs)}
        {renderMacroBar(t('macroProgress.fat'), fatConsumedG, fatTargetG, COLORS.macroFat)}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: COLORS.cardBg,
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginHorizontal: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  sectionTitle: {
    color: COLORS.textSecondary,
    fontSize: 11,
    fontWeight: '700',
    fontFamily: FONTS.bold,
    letterSpacing: 1.1,
    marginBottom: 10,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  macroCol: {
    flex: 1,
  },
  macroHeader: {
    marginBottom: 6,
  },
  macroLabel: {
    color: COLORS.textPrimary,
    fontSize: 13,
    fontWeight: '700',
    fontFamily: FONTS.bold,
  },
  macroValues: {
    color: COLORS.textSecondary,
    fontSize: 11,
    fontWeight: '500',
    fontFamily: FONTS.medium,
    marginTop: 2,
  },
  track: {
    height: 8,
    backgroundColor: COLORS.bgBackground,
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 4,
  },
  fill: {
    height: '100%',
    borderRadius: 4,
  },
  pctText: {
    color: COLORS.textMuted,
    fontSize: 10,
    fontWeight: '600',
    fontFamily: FONTS.semibold,
    alignSelf: 'flex-end',
  },
});
