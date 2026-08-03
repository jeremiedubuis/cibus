import React, { useEffect, useState } from 'react';
import {
  Alert,
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
import { ActivityEntry, HeartRateSample, HeartRateZones, SportActivityType } from '../types';
import { getAllActivityEntries } from '../services/database';
import { generateSyntheticHeartRateSamples } from '../services/heartRateCalculator';
import { COLORS, FONTS } from '../constants/theme';

interface LogActivityModalProps {
  visible: boolean;
  activityToEdit?: ActivityEntry | null;
  defaultDurationMinutes?: number;
  currentDateStr: string;
  onClose: () => void;
  onConfirmSave: (
    activityData: Omit<ActivityEntry, 'id'>,
    idToUpdate?: string
  ) => Promise<void>;
  onDeleteActivity?: (id: string) => Promise<void>;
}

export const LogActivityModal: React.FC<LogActivityModalProps> = ({
  visible,
  activityToEdit,
  defaultDurationMinutes = 20,
  currentDateStr,
  onClose,
  onConfirmSave,
  onDeleteActivity,
}) => {
  const { t, i18n } = useTranslation();

  const [activityType, setActivityType] = useState<SportActivityType>('RUNNING');
  const [caloriesKcal, setCaloriesKcal] = useState<string>('');
  const [startTime, setStartTime] = useState<string>('');
  const [durationMinutes, setDurationMinutes] = useState<string>('');
  const [distanceKm, setDistanceKm] = useState<string>('');
  const [avgHeartRateBpm, setAvgHeartRateBpm] = useState<string>('');
  const [maxHeartRateBpm, setMaxHeartRateBpm] = useState<string>('');
  const [heartRateSamples, setHeartRateSamples] = useState<HeartRateSample[] | undefined>(undefined);
  const [heartRateZones, setHeartRateZones] = useState<HeartRateZones | undefined>(undefined);
  const [loggedTypes, setLoggedTypes] = useState<Set<SportActivityType>>(new Set());

  useEffect(() => {
    if (visible) {
      getAllActivityEntries()
        .then((entries) => {
          const typesSet = new Set<SportActivityType>(entries.map((e) => e.activityType));
          setLoggedTypes(typesSet);
        })
        .catch(() => {});

      if (activityToEdit) {
        setActivityType(activityToEdit.activityType || 'RUNNING');
        setCaloriesKcal(
          activityToEdit.caloriesKcal != null ? String(activityToEdit.caloriesKcal) : ''
        );

        if (activityToEdit.startTime) {
          try {
            const dt = new Date(activityToEdit.startTime);
            if (!isNaN(dt.getTime())) {
              const hh = dt.getHours().toString().padStart(2, '0');
              const mm = dt.getMinutes().toString().padStart(2, '0');
              setStartTime(`${hh}:${mm}`);
            } else {
              setStartTime('12:00');
            }
          } catch {
            setStartTime('12:00');
          }
        } else {
          setStartTime('12:00');
        }

        setDurationMinutes(
          activityToEdit.durationMinutes != null
            ? String(activityToEdit.durationMinutes)
            : String(defaultDurationMinutes ?? 20)
        );
        setDistanceKm(
          activityToEdit.distanceKm != null
            ? String(activityToEdit.distanceKm)
            : ''
        );
        setAvgHeartRateBpm(
          activityToEdit.avgHeartRateBpm != null ? String(activityToEdit.avgHeartRateBpm) : ''
        );
        setMaxHeartRateBpm(
          activityToEdit.maxHeartRateBpm != null ? String(activityToEdit.maxHeartRateBpm) : ''
        );
        setHeartRateSamples(activityToEdit.heartRateSamples);
        setHeartRateZones(activityToEdit.heartRateZones);
      } else {
        const now = new Date();
        const twentyMinsAgo = new Date(now.getTime() - 20 * 60 * 1000);
        const hh = twentyMinsAgo.getHours().toString().padStart(2, '0');
        const mm = twentyMinsAgo.getMinutes().toString().padStart(2, '0');

        setCaloriesKcal('');
        setStartTime(`${hh}:${mm}`);
        setDurationMinutes(String(defaultDurationMinutes ?? 20));
        setDistanceKm('');
        setAvgHeartRateBpm('');
        setMaxHeartRateBpm('');
        setHeartRateSamples(undefined);
        setHeartRateZones(undefined);
      }
    }
  }, [visible, activityToEdit, defaultDurationMinutes]);

  const rawActivityOptions: Array<{ type: SportActivityType; label: string; icon: string }> = [
    { type: 'RUNNING', label: t('activities.running'), icon: '🏃' },
    { type: 'BICYCLE', label: t('activities.bicycle'), icon: '🚲' },
    { type: 'SWIMMING', label: t('activities.swimming'), icon: '🏊' },
    { type: 'CLIMBING', label: t('activities.climbing'), icon: '🧗' },
    { type: 'WALKING', label: t('activities.walking'), icon: '🚶' },
    { type: 'CROSSFIT', label: t('activities.crossfit'), icon: '🏋️‍♂️' },
    { type: 'CANICROSS', label: t('activities.canicross'), icon: '🐕' },
    { type: 'WEIGHTS', label: t('activities.weights'), icon: '🏋️' },
    { type: 'CALISTHENICS', label: t('activities.calisthenics'), icon: '🤸' },
    { type: 'ELLIPTICAL', label: t('activities.elliptical'), icon: '🔄' },
  ];

  const currentLocale = i18n.language || 'en';

  const activityOptions = [...rawActivityOptions].sort((a, b) => {
    const aLogged = loggedTypes.has(a.type);
    const bLogged = loggedTypes.has(b.type);

    if (aLogged && !bLogged) return -1;
    if (!aLogged && bLogged) return 1;

    return a.label.localeCompare(b.label, currentLocale, { sensitivity: 'base' });
  });

  useEffect(() => {
    if (visible && !activityToEdit && activityOptions.length > 0) {
      setActivityType(activityOptions[0].type);
    }
  }, [visible, activityToEdit, loggedTypes]);

  const handleGenerateSmartwatchData = () => {
    const duration = parseInt(durationMinutes, 10) || defaultDurationMinutes;
    const avg = parseInt(avgHeartRateBpm, 10) || 140;
    const max = parseInt(maxHeartRateBpm, 10) || 170;

    let isoStartTime = new Date().toISOString();
    if (startTime.includes(':')) {
      const [hStr, mStr] = startTime.split(':');
      const h = parseInt(hStr, 10) || 0;
      const m = parseInt(mStr, 10) || 0;
      const dt = new Date(`${currentDateStr}T00:00:00`);
      dt.setHours(h, m, 0, 0);
      isoStartTime = dt.toISOString();
    }

    const generated = generateSyntheticHeartRateSamples(isoStartTime, duration, avg, max);
    setAvgHeartRateBpm(String(generated.stats.avgHeartRateBpm));
    setMaxHeartRateBpm(String(generated.stats.maxHeartRateBpm));
    setHeartRateSamples(generated.samples);
    setHeartRateZones(generated.zones);
  };

  const handleSave = async () => {
    const kcal = parseFloat(caloriesKcal) || 0;
    const duration = parseInt(durationMinutes, 10) || defaultDurationMinutes;
    const distance = distanceKm.trim() ? parseFloat(distanceKm) : null;
    const parsedAvgHr = avgHeartRateBpm.trim() ? parseInt(avgHeartRateBpm, 10) : null;
    const parsedMaxHr = maxHeartRateBpm.trim() ? parseInt(maxHeartRateBpm, 10) : null;

    let isoStartTime = new Date().toISOString();
    if (startTime.includes(':')) {
      const [hStr, mStr] = startTime.split(':');
      const h = parseInt(hStr, 10) || 0;
      const m = parseInt(mStr, 10) || 0;
      const dt = new Date(`${currentDateStr}T00:00:00`);
      dt.setHours(h, m, 0, 0);
      isoStartTime = dt.toISOString();
    } else {
      isoStartTime = new Date(`${currentDateStr}T12:00:00`).toISOString();
    }

    let finalSamples = heartRateSamples;
    let finalZones = heartRateZones;

    if (parsedAvgHr && (!finalSamples || finalSamples.length === 0)) {
      const generated = generateSyntheticHeartRateSamples(
        isoStartTime,
        duration,
        parsedAvgHr,
        parsedMaxHr || undefined
      );
      finalSamples = generated.samples;
      finalZones = generated.zones;
    }

    const payload: Omit<ActivityEntry, 'id'> = {
      date: currentDateStr,
      startTime: isoStartTime,
      durationMinutes: duration,
      activityType,
      caloriesKcal: kcal,
      distanceKm: distance,
      healthConnectId: activityToEdit ? activityToEdit.healthConnectId : null,
      avgHeartRateBpm: parsedAvgHr,
      maxHeartRateBpm: parsedMaxHr,
      heartRateSamples: finalSamples,
      heartRateZones: finalZones,
    };

    await onConfirmSave(payload, activityToEdit ? activityToEdit.id : undefined);
    onClose();
  };

  const handleDelete = () => {
    if (!activityToEdit || !onDeleteActivity) return;

    Alert.alert(
      t('activities.confirmDeleteTitle'),
      t('activities.confirmDeleteMessage'),
      [
        { text: t('mealBreakdown.cancel'), style: 'cancel' },
        {
          text: t('mealBreakdown.delete'),
          style: 'destructive',
          onPress: async () => {
            await onDeleteActivity(activityToEdit.id);
            onClose();
          },
        },
      ]
    );
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <SafeAreaView style={styles.overlay}>
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.headerTitle}>
              {activityToEdit ? t('activities.editActivityTitle') : t('activities.logActivityTitle')}
            </Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Text style={styles.closeBtnText}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.body}
            contentContainerStyle={styles.bodyContent}
            keyboardShouldPersistTaps="handled"
          >
            {/* Horizontal Activity Type Selection */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>{t('activities.activityType')}</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.horizontalPickerContainer}
              >
                {activityOptions.map((opt) => {
                  const isSelected = activityType === opt.type;
                  return (
                    <TouchableOpacity
                      key={opt.type}
                      style={[
                        styles.horizontalTypeCard,
                        isSelected && styles.activeHorizontalTypeCard,
                      ]}
                      onPress={() => setActivityType(opt.type)}
                      activeOpacity={0.8}
                    >
                      <View style={[styles.iconCircle, isSelected && styles.activeIconCircle]}>
                        <Text style={styles.horizontalTypeIcon}>{opt.icon}</Text>
                      </View>
                      <Text
                        style={[
                          styles.horizontalTypeText,
                          isSelected && styles.activeHorizontalTypeText,
                        ]}
                        numberOfLines={1}
                      >
                        {opt.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>

            {/* Kcals Burned */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>{t('activities.caloriesBurned')}</Text>
              <TextInput
                style={styles.textInput}
                keyboardType="numeric"
                placeholder="e.g. 250"
                placeholderTextColor={COLORS.textMuted}
                value={caloriesKcal}
                onChangeText={setCaloriesKcal}
              />
            </View>

            {/* Start Time & Duration */}
            <View style={styles.rowTwoCols}>
              <View style={[styles.inputGroup, styles.colHalf]}>
                <Text style={styles.label}>{t('activities.startTime')}</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="HH:mm"
                  placeholderTextColor={COLORS.textMuted}
                  value={startTime}
                  onChangeText={setStartTime}
                />
              </View>

              <View style={[styles.inputGroup, styles.colHalf]}>
                <Text style={styles.label}>{t('activities.duration')}</Text>
                <TextInput
                  style={styles.textInput}
                  keyboardType="numeric"
                  placeholder="20"
                  placeholderTextColor={COLORS.textMuted}
                  value={durationMinutes}
                  onChangeText={setDurationMinutes}
                />
              </View>
            </View>

            {/* Distance (Optional) */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>{t('activities.distance')}</Text>
              <TextInput
                style={styles.textInput}
                keyboardType="numeric"
                placeholder="e.g. 3.5"
                placeholderTextColor={COLORS.textMuted}
                value={distanceKm}
                onChangeText={setDistanceKm}
              />
            </View>

            {/* Heart Rate Stats (Optional / Smartwatch) */}
            <View style={styles.rowTwoCols}>
              <View style={[styles.inputGroup, styles.colHalf]}>
                <Text style={styles.label}>{t('activities.avgHeartRate')}</Text>
                <TextInput
                  style={styles.textInput}
                  keyboardType="numeric"
                  placeholder="e.g. 142"
                  placeholderTextColor={COLORS.textMuted}
                  value={avgHeartRateBpm}
                  onChangeText={setAvgHeartRateBpm}
                />
              </View>

              <View style={[styles.inputGroup, styles.colHalf]}>
                <Text style={styles.label}>{t('activities.maxHeartRate')}</Text>
                <TextInput
                  style={styles.textInput}
                  keyboardType="numeric"
                  placeholder="e.g. 175"
                  placeholderTextColor={COLORS.textMuted}
                  value={maxHeartRateBpm}
                  onChangeText={setMaxHeartRateBpm}
                />
              </View>
            </View>

            <TouchableOpacity
              style={styles.generateHrBtn}
              onPress={handleGenerateSmartwatchData}
              activeOpacity={0.8}
            >
              <Text style={styles.generateHrBtnText}>{t('activities.generateHrData')}</Text>
            </TouchableOpacity>

            {/* Action Buttons */}
            <TouchableOpacity style={styles.saveBtn} onPress={handleSave} activeOpacity={0.8}>
              <Text style={styles.saveBtnText}>
                {activityToEdit ? t('activities.updateActivity') : t('activities.saveActivity')}
              </Text>
            </TouchableOpacity>

            {activityToEdit && onDeleteActivity && (
              <TouchableOpacity
                style={styles.deleteBtn}
                onPress={handleDelete}
                activeOpacity={0.8}
              >
                <Text style={styles.deleteBtnText}>{t('mealBreakdown.delete')}</Text>
              </TouchableOpacity>
            )}
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
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 24) + 8 : 0,
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
    flex: 1,
  },
  bodyContent: {
    padding: 20,
    paddingBottom: 48,
  },
  inputGroup: {
    marginBottom: 18,
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
    marginBottom: 8,
    letterSpacing: 0.5,
  },
  textInput: {
    backgroundColor: COLORS.cardBg,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: COLORS.textPrimary,
    fontSize: 15,
    fontWeight: '600',
    fontFamily: FONTS.semibold,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  horizontalPickerContainer: {
    gap: 10,
    paddingVertical: 4,
    paddingRight: 10,
  },
  horizontalTypeCard: {
    width: 86,
    paddingVertical: 12,
    paddingHorizontal: 8,
    backgroundColor: COLORS.cardBg,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeHorizontalTypeCard: {
    backgroundColor: COLORS.primaryMuted,
    borderColor: COLORS.primary,
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.bgBackground,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  activeIconCircle: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  horizontalTypeIcon: {
    fontSize: 22,
  },
  horizontalTypeText: {
    color: COLORS.textSecondary,
    fontSize: 11,
    fontWeight: '700',
    fontFamily: FONTS.bold,
    textAlign: 'center',
  },
  activeHorizontalTypeText: {
    color: COLORS.primary,
    fontWeight: '800',
    fontFamily: FONTS.extraBold,
  },
  generateHrBtn: {
    backgroundColor: COLORS.cardBg,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.primary,
    marginBottom: 14,
  },
  generateHrBtnText: {
    color: COLORS.primary,
    fontSize: 12,
    fontWeight: '700',
    fontFamily: FONTS.bold,
  },
  saveBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 10,
  },
  saveBtnText: {
    color: '#0F172A',
    fontSize: 16,
    fontWeight: '800',
    fontFamily: FONTS.extraBold,
  },
  deleteBtn: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.4)',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 12,
  },
  deleteBtnText: {
    color: '#F87171',
    fontSize: 15,
    fontWeight: '800',
    fontFamily: FONTS.extraBold,
  },
});
