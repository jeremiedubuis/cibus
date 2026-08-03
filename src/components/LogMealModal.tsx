import React, { useState, useEffect } from 'react';
import {
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { FoodItem, MealType, PortionOption } from '../types';
import { calculateMealItemMacros } from '../services/nutritionCalculator';
import {
  calculateGramsFromPortion,
  getDefaultPortionsForFood,
  getLocalizedPortionLabel,
} from '../services/portionService';
import { COLORS, FONTS } from '../constants/theme';

interface LogMealModalProps {
  visible: boolean;
  food: FoodItem | null;
  mealType: MealType;
  initialQuantityG?: number;
  isEditing?: boolean;
  onClose: () => void;
  onConfirmLog: (food: FoodItem, quantityG: number) => void;
}

export const LogMealModal: React.FC<LogMealModalProps> = ({
  visible,
  food,
  mealType,
  initialQuantityG,
  isEditing = false,
  onClose,
  onConfirmLog,
}) => {
  const { t } = useTranslation();

  const [portionOptions, setPortionOptions] = useState<PortionOption[]>([]);
  const [selectedPortionId, setSelectedPortionId] = useState<string>('grams');
  const [multiplier, setMultiplier] = useState<string>('1');
  const [customGrams, setCustomGrams] = useState<string>('100');

  useEffect(() => {
    if (food) {
      const options = getDefaultPortionsForFood(food);
      setPortionOptions(options);

      if (initialQuantityG && initialQuantityG > 0) {
        // Find if initialQuantityG matches a portion option in grams (exact or clean multiplier)
        let matchingPortion: PortionOption | undefined;
        let matchedMultiplier = 1;

        for (const p of options) {
          if (p.id === 'grams' || !p.gramWeight || p.gramWeight <= 0) continue;

          // Exact weight match
          if (Math.abs(p.gramWeight - initialQuantityG) < 0.1) {
            matchingPortion = p;
            matchedMultiplier = 1;
            break;
          }

          // Clean multiplier match (e.g. 0.5x, 1.5x, 2x, 3x, 4x, 5x)
          const mult = initialQuantityG / p.gramWeight;
          if ([0.5, 1.5, 2, 3, 4, 5].some((m) => Math.abs(mult - m) < 0.01)) {
            matchingPortion = p;
            matchedMultiplier = Math.round(mult * 100) / 100;
            break;
          }
        }

        if (matchingPortion) {
          setSelectedPortionId(matchingPortion.id);
          setMultiplier(matchedMultiplier.toString());
          setCustomGrams(initialQuantityG.toString());
        } else {
          // Precise grams entered previously
          setSelectedPortionId('grams');
          setCustomGrams(initialQuantityG.toString());
        }
      } else {
        // By default, preselect the 'grams' option
        setSelectedPortionId('grams');
        setCustomGrams('100');
      }
    }
  }, [food, initialQuantityG, visible]);

  if (!food) return null;

  const currentPortion =
    portionOptions.find((p) => p.id === selectedPortionId) || {
      id: 'grams',
      label: 'g',
      gramWeight: 1,
      unitName: 'g',
    };

  const isGramsMode = selectedPortionId === 'grams';

  const calculatedGrams = isGramsMode
    ? parseFloat(customGrams) || 0
    : calculateGramsFromPortion(currentPortion, parseFloat(multiplier) || 0);

  const calculatedMacros = calculateMealItemMacros(food, calculatedGrams);

  const handleSelectPortion = (portion: PortionOption) => {
    setSelectedPortionId(portion.id);
    if (portion.id === 'grams') {
      setCustomGrams(calculatedGrams ? calculatedGrams.toString() : '100');
    } else {
      setMultiplier('1');
    }
  };

  const handleAdjustMultiplier = (delta: number) => {
    const current = parseFloat(multiplier) || 0;
    const next = Math.max(0.25, Math.round((current + delta) * 100) / 100);
    setMultiplier(next.toString());
  };

  const handleAdjustGrams = (delta: number) => {
    const current = parseFloat(customGrams) || 0;
    const next = Math.max(1, Math.round(current + delta));
    setCustomGrams(next.toString());
  };

  const handleConfirm = () => {
    if (calculatedGrams > 0) {
      onConfirmLog(food, calculatedGrams);
      onClose();
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent={true} onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.modalContent}>
          <View style={styles.header}>
            <Text style={styles.title}>
              {isEditing ? t('logMeal.editTitle') : t('logMeal.title', { defaultValue: 'Log Food' })}
            </Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Text style={styles.closeBtnText}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.body} showsVerticalScrollIndicator={false}>
            {/* Food Header Card */}
            <View style={styles.foodCard}>
              <Text style={styles.foodName}>{food.name}</Text>
              {food.brand ? <Text style={styles.foodBrand}>{food.brand}</Text> : null}
              <Text style={styles.mealTargetTag}>
                {t('logMeal.loggingFor', { defaultValue: 'Logging for' })} {mealType}
              </Text>
            </View>

            {/* Portion Selection Section */}
            <View style={styles.portionSection}>
              <Text style={styles.label}>{t('logMeal.selectPortion', { defaultValue: 'Select Portion Type' })}</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.portionOptionsScroll}
                contentContainerStyle={styles.portionOptionsContainer}
              >
                {portionOptions.map((portion) => {
                  const isActive = selectedPortionId === portion.id;
                  return (
                    <TouchableOpacity
                      key={portion.id}
                      style={[styles.portionChip, isActive && styles.activePortionChip]}
                      onPress={() => handleSelectPortion(portion)}
                    >
                      <Text style={[styles.portionChipText, isActive && styles.activePortionChipText]}>
                        {getLocalizedPortionLabel(portion, t)}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              {/* Quantity / Multiplier Input Controls */}
              {selectedPortionId !== 'grams' && currentPortion ? (
                <View style={styles.inputContainer}>
                  <Text style={styles.subLabel}>
                    {t('logMeal.numberUnits', { defaultValue: 'Number of Serving Units' })}
                  </Text>
                  <View style={styles.portionInputRow}>
                    <TouchableOpacity
                      style={styles.stepperBtn}
                      onPress={() => handleAdjustMultiplier(-0.5)}
                    >
                      <Text style={styles.stepperBtnText}>-</Text>
                    </TouchableOpacity>
                    <TextInput
                      style={styles.portionInput}
                      keyboardType="decimal-pad"
                      value={multiplier}
                      onChangeText={setMultiplier}
                      selectTextOnFocus
                    />
                    <TouchableOpacity
                      style={styles.stepperBtn}
                      onPress={() => handleAdjustMultiplier(0.5)}
                    >
                      <Text style={styles.stepperBtnText}>+</Text>
                    </TouchableOpacity>
                  </View>

                  <View style={styles.presetsRow}>
                    {['0.5', '1', '1.5', '2'].map((val) => (
                      <TouchableOpacity
                        key={val}
                        style={[styles.presetChip, multiplier === val && styles.activePresetChip]}
                        onPress={() => setMultiplier(val)}
                      >
                        <Text
                          style={[
                            styles.presetChipText,
                            multiplier === val && styles.activePresetText,
                          ]}
                        >
                          {val}x
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  <View style={styles.gramFeedbackPill}>
                    <Text style={styles.gramFeedbackText}>
                      = {calculatedGrams}g ({currentPortion.gramWeight}g {t('logMeal.perUnit', { defaultValue: 'per unit' })})
                    </Text>
                  </View>
                </View>
              ) : (
                <View style={styles.inputContainer}>
                  <Text style={styles.subLabel}>{t('logMeal.exactWeight', { defaultValue: 'Exact Weight in Grams (g)' })}</Text>
                  <View style={styles.portionInputRow}>
                    <TouchableOpacity
                      style={styles.stepperBtn}
                      onPress={() => handleAdjustGrams(-25)}
                    >
                      <Text style={styles.stepperBtnText}>-</Text>
                    </TouchableOpacity>
                    <TextInput
                      style={styles.portionInput}
                      keyboardType="number-pad"
                      value={customGrams}
                      onChangeText={setCustomGrams}
                      selectTextOnFocus
                    />
                    <Text style={styles.unitText}>g</Text>
                    <TouchableOpacity
                      style={styles.stepperBtn}
                      onPress={() => handleAdjustGrams(25)}
                    >
                      <Text style={styles.stepperBtnText}>+</Text>
                    </TouchableOpacity>
                  </View>

                  <View style={styles.presetsRow}>
                    {['20', '30', '50', '100', '150'].map((val) => (
                      <TouchableOpacity
                        key={val}
                        style={[styles.presetChip, customGrams === val && styles.activePresetChip]}
                        onPress={() => setCustomGrams(val)}
                      >
                        <Text
                          style={[
                            styles.presetChipText,
                            customGrams === val && styles.activePresetText,
                          ]}
                        >
                          {val}g
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              )}
            </View>

            {/* Total Calculated Summary Card */}
            <View style={styles.summaryCard}>
              <Text style={styles.summaryTitle}>{t('logMeal.totalCalculated', { defaultValue: 'TOTAL NUTRITION' })}</Text>
              <Text style={styles.totalCalories}>{calculatedMacros.calories} kcal</Text>

              <View style={styles.macroGrid}>
                <View style={styles.macroCell}>
                  <Text style={styles.macroCellVal}>{calculatedMacros.protein}g</Text>
                  <Text style={styles.macroCellLabel}>{t('macroProgress.protein')}</Text>
                </View>
                <View style={styles.macroCell}>
                  <Text style={styles.macroCellVal}>{calculatedMacros.carbs}g</Text>
                  <Text style={styles.macroCellLabel}>{t('macroProgress.carbs')}</Text>
                </View>
                <View style={styles.macroCell}>
                  <Text style={styles.macroCellVal}>{calculatedMacros.fat}g</Text>
                  <Text style={styles.macroCellLabel}>{t('macroProgress.fat')}</Text>
                </View>
              </View>
            </View>

            {/* Confirm Submit Button */}
            <TouchableOpacity style={styles.submitBtn} onPress={handleConfirm} activeOpacity={0.8}>
              <Text style={styles.submitBtnText}>
                {isEditing
                  ? t('logMeal.updateBtn', { calories: Math.round(calculatedMacros.calories) })
                  : t('logMeal.logMealBtn', { calories: Math.round(calculatedMacros.calories) })}
              </Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: COLORS.cardBg,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '90%',
    paddingBottom: 24,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.cardBorder,
  },
  title: {
    color: COLORS.textPrimary,
    fontSize: 18,
    fontWeight: '700',
    fontFamily: FONTS.bold,
  },
  closeBtn: {
    padding: 6,
  },
  closeBtnText: {
    color: COLORS.textSecondary,
    fontSize: 18,
    fontWeight: '700',
    fontFamily: FONTS.bold,
  },
  body: {
    padding: 20,
  },
  foodCard: {
    backgroundColor: COLORS.bgBackground,
    borderRadius: 14,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  foodName: {
    color: COLORS.textPrimary,
    fontSize: 16,
    fontWeight: '700',
    fontFamily: FONTS.bold,
  },
  foodBrand: {
    color: COLORS.primary,
    fontSize: 12,
    fontFamily: FONTS.medium,
    marginTop: 2,
  },
  mealTargetTag: {
    color: COLORS.textSecondary,
    fontSize: 11,
    marginTop: 6,
    fontWeight: '600',
    fontFamily: FONTS.semibold,
  },
  portionSection: {
    marginBottom: 16,
  },
  label: {
    color: COLORS.textSecondary,
    fontSize: 12,
    fontWeight: '600',
    fontFamily: FONTS.semibold,
    marginBottom: 8,
  },
  subLabel: {
    color: COLORS.textMuted,
    fontSize: 11,
    fontWeight: '600',
    fontFamily: FONTS.semibold,
    marginBottom: 6,
  },
  portionOptionsScroll: {
    flexGrow: 0,
    marginBottom: 12,
  },
  portionOptionsContainer: {
    gap: 8,
  },
  portionChip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: COLORS.bgBackground,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    justifyContent: 'center',
    alignItems: 'center',
  },
  activePortionChip: {
    backgroundColor: COLORS.primaryDark,
    borderColor: COLORS.primary,
  },
  portionChipText: {
    color: COLORS.textSecondary,
    fontSize: 13,
    fontWeight: '600',
    fontFamily: FONTS.semibold,
  },
  activePortionChipText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontFamily: FONTS.bold,
  },
  inputContainer: {
    backgroundColor: COLORS.bgBackground,
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  portionInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
  },
  stepperBtn: {
    width: 44,
    height: 48,
    backgroundColor: COLORS.cardBg,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  stepperBtnText: {
    color: COLORS.primary,
    fontSize: 22,
    fontWeight: '700',
    fontFamily: FONTS.bold,
  },
  portionInput: {
    flex: 1,
    backgroundColor: COLORS.cardBg,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
    color: COLORS.textPrimary,
    fontSize: 20,
    fontWeight: '700',
    fontFamily: FONTS.bold,
    textAlign: 'center',
    borderWidth: 1,
    borderColor: COLORS.primary,
  },
  unitText: {
    color: COLORS.textSecondary,
    fontSize: 16,
    fontWeight: '600',
    fontFamily: FONTS.semibold,
  },
  presetsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  presetChip: {
    flex: 1,
    paddingVertical: 8,
    backgroundColor: COLORS.cardBg,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  activePresetChip: {
    backgroundColor: COLORS.primaryDark,
    borderColor: COLORS.primary,
  },
  presetChipText: {
    color: COLORS.textSecondary,
    fontSize: 12,
    fontWeight: '600',
    fontFamily: FONTS.semibold,
  },
  activePresetText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontFamily: FONTS.bold,
  },
  gramFeedbackPill: {
    marginTop: 10,
    paddingVertical: 6,
    paddingHorizontal: 10,
    backgroundColor: COLORS.cardBg,
    borderRadius: 8,
    alignItems: 'center',
  },
  gramFeedbackText: {
    color: COLORS.primary,
    fontSize: 12,
    fontWeight: '600',
    fontFamily: FONTS.semibold,
  },
  summaryCard: {
    backgroundColor: COLORS.bgBackground,
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    marginBottom: 20,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  summaryTitle: {
    color: COLORS.textMuted,
    fontSize: 11,
    fontWeight: '700',
    fontFamily: FONTS.bold,
    letterSpacing: 1,
  },
  totalCalories: {
    color: COLORS.primary,
    fontSize: 32,
    fontWeight: '800',
    fontFamily: FONTS.extraBold,
    marginVertical: 4,
  },
  macroGrid: {
    flexDirection: 'row',
    width: '100%',
    justifyContent: 'space-around',
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: COLORS.cardBg,
  },
  macroCell: {
    alignItems: 'center',
  },
  macroCellVal: {
    color: COLORS.textPrimary,
    fontSize: 16,
    fontWeight: '700',
    fontFamily: FONTS.bold,
  },
  macroCellLabel: {
    color: COLORS.textSecondary,
    fontSize: 11,
    fontFamily: FONTS.medium,
    marginTop: 2,
  },
  submitBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  submitBtnText: {
    color: '#0F172A',
    fontSize: 15,
    fontWeight: '800',
    fontFamily: FONTS.extraBold,
  },
});
