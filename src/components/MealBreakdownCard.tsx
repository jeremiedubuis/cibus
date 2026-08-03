import React from 'react';
import { Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { MealEntry, MealType } from '../types';
import { COLORS, FONTS } from '../constants/theme';

interface MealBreakdownCardProps {
  mealType: MealType;
  entries: MealEntry[];
  targetCalories: number;
  onAddFood: (mealType: MealType) => void;
  onDeleteEntry: (entryId: string) => void;
  onEditEntry?: (entry: MealEntry) => void;
}

const MEAL_ICONS: Record<MealType, string> = {
  BREAKFAST: '☕',
  LUNCH: '🍜',
  DINNER: '🥗',
  SNACK: '🍎',
};

const MEAL_KEY_MAP: Record<MealType, string> = {
  BREAKFAST: 'breakfast',
  LUNCH: 'lunch',
  DINNER: 'dinner',
  SNACK: 'snacks',
};

export const MealBreakdownCard: React.FC<MealBreakdownCardProps> = ({
  mealType,
  entries,
  targetCalories,
  onAddFood,
  onDeleteEntry,
  onEditEntry,
}) => {
  const { t } = useTranslation();
  const icon = MEAL_ICONS[mealType];
  const mealTitle = t(`mealBreakdown.${MEAL_KEY_MAP[mealType]}`);

  const totalMealCalories = Math.round(
    entries.reduce((sum, item) => sum + item.calculatedCalories, 0)
  );

  const handleDeletePress = (entry: MealEntry) => {
    const foodName = entry.food?.name || t('mealBreakdown.loggedFood');
    Alert.alert(
      t('mealBreakdown.confirmDeleteTitle'),
      t('mealBreakdown.confirmDeleteMessage', { name: foodName }),
      [
        {
          text: t('mealBreakdown.cancel'),
          style: 'cancel',
        },
        {
          text: t('mealBreakdown.delete'),
          style: 'destructive',
          onPress: () => onDeleteEntry(entry.id),
        },
      ]
    );
  };

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.icon}>{icon}</Text>
          <View>
            <Text style={styles.mealTitle}>{mealTitle}</Text>
            <Text style={styles.targetSubtext}>
              {t('mealBreakdown.target', { target: Math.round(targetCalories) })}
            </Text>
          </View>
        </View>

        <View style={styles.headerRight}>
          <Text style={styles.mealCalories}>
            {totalMealCalories} {t('mealBreakdown.kcal')}
          </Text>
        </View>
      </View>

      {entries.length > 0 ? (
        <View style={styles.entriesList}>
          {entries.map((entry) => (
            <View key={entry.id} style={styles.entryRow}>
              <TouchableOpacity
                style={styles.entryClickableArea}
                onPress={() => onEditEntry && onEditEntry(entry)}
                activeOpacity={0.7}
              >
                <View style={styles.entryInfo}>
                  <Text style={styles.foodName}>{entry.food?.name || t('mealBreakdown.loggedFood')}</Text>
                  <Text style={styles.foodMeta}>
                    {entry.quantityG}g • {t('mealBreakdown.proteinShort')}: {entry.calculatedProtein}g | {t('mealBreakdown.carbsShort')}: {entry.calculatedCarbs}g | {t('mealBreakdown.fatShort')}: {entry.calculatedFat}g
                  </Text>
                </View>

                <Text style={styles.entryCalories}>
                  {Math.round(entry.calculatedCalories)} {t('mealBreakdown.kcal')}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => handleDeletePress(entry)}
                style={styles.deleteBtn}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Text style={styles.deleteBtnText}>✕</Text>
              </TouchableOpacity>
            </View>
          ))}
        </View>
      ) : (
        <Text style={styles.emptyText}>
          {t('mealBreakdown.noFoodLogged', { meal: mealTitle.toLowerCase() })}
        </Text>
      )}

      <TouchableOpacity style={styles.addBtn} onPress={() => onAddFood(mealType)} activeOpacity={0.7}>
        <Text style={styles.addBtnText}>{t('mealBreakdown.addFood')}</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.cardBg,
    borderRadius: 18,
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  icon: {
    fontSize: 22,
  },
  mealTitle: {
    color: COLORS.textPrimary,
    fontSize: 16,
    fontWeight: '700',
    fontFamily: FONTS.bold,
  },
  targetSubtext: {
    color: COLORS.textMuted,
    fontSize: 11,
    fontWeight: '500',
    fontFamily: FONTS.medium,
    marginTop: 1,
  },
  headerRight: {
    alignItems: 'flex-end',
  },
  mealCalories: {
    color: COLORS.primary,
    fontSize: 16,
    fontWeight: '700',
    fontFamily: FONTS.bold,
  },
  entriesList: {
    borderTopWidth: 1,
    borderTopColor: COLORS.cardBorder,
    paddingTop: 10,
    gap: 10,
  },
  entryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  entryClickableArea: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginRight: 10,
  },
  entryInfo: {
    flex: 1,
    paddingRight: 8,
  },
  foodName: {
    color: '#F1F5F9',
    fontSize: 14,
    fontWeight: '600',
    fontFamily: FONTS.semibold,
  },
  foodMeta: {
    color: COLORS.textSecondary,
    fontSize: 11,
    fontFamily: FONTS.regular,
    marginTop: 2,
  },
  entryRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  entryCalories: {
    color: '#CBD5E1',
    fontSize: 13,
    fontWeight: '600',
    fontFamily: FONTS.semibold,
  },
  deleteBtn: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: COLORS.cardBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteBtnText: {
    color: COLORS.danger,
    fontSize: 12,
    fontWeight: 'bold',
    fontFamily: FONTS.bold,
  },
  emptyText: {
    color: COLORS.textMuted,
    fontSize: 12,
    fontStyle: 'italic',
    fontFamily: FONTS.regular,
    marginVertical: 8,
  },
  addBtn: {
    marginTop: 12,
    backgroundColor: COLORS.bgBackground,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  addBtnText: {
    color: COLORS.primary,
    fontSize: 13,
    fontWeight: '700',
    fontFamily: FONTS.bold,
  },
});
