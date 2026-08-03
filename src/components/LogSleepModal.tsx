import React, { useEffect, useState } from 'react';
import {
  Modal,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { SleepEntry } from '../types';
import { COLORS, FONTS } from '../constants/theme';
import { assignSleepDateAndType, calculateSleepQualityScore } from '../services/sleepCalculator';

interface LogSleepModalProps {
  visible: boolean;
  onClose: () => void;
  onSave: (entry: Omit<SleepEntry, 'id'>, id?: string) => void;
  initialEntry?: SleepEntry | null;
  currentDateStr: string;
  targetSleepMinutes?: number;
}

export const LogSleepModal: React.FC<LogSleepModalProps> = ({
  visible,
  onClose,
  onSave,
  initialEntry,
  currentDateStr,
  targetSleepMinutes = 480,
}) => {
  const { t } = useTranslation();

  const [startTimeStr, setStartTimeStr] = useState('23:00');
  const [endTimeStr, setEndTimeStr] = useState('07:00');
  const [isNapOverride, setIsNapOverride] = useState<boolean | null>(null);
  const [deepMinsStr, setDeepMinsStr] = useState('');
  const [remMinsStr, setRemMinsStr] = useState('');
  const [lightMinsStr, setLightMinsStr] = useState('');
  const [awakeMinsStr, setAwakeMinsStr] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (initialEntry) {
      const startDt = new Date(initialEntry.startTime);
      const endDt = new Date(initialEntry.endTime);
      setStartTimeStr(
        !isNaN(startDt.getTime())
          ? `${String(startDt.getHours()).padStart(2, '0')}:${String(startDt.getMinutes()).padStart(2, '0')}`
          : '23:00'
      );
      setEndTimeStr(
        !isNaN(endDt.getTime())
          ? `${String(endDt.getHours()).padStart(2, '0')}:${String(endDt.getMinutes()).padStart(2, '0')}`
          : '07:00'
      );
      setIsNapOverride(initialEntry.isNap);
      setDeepMinsStr(initialEntry.deepSleepMinutes ? initialEntry.deepSleepMinutes.toString() : '');
      setRemMinsStr(initialEntry.remSleepMinutes ? initialEntry.remSleepMinutes.toString() : '');
      setLightMinsStr(initialEntry.lightSleepMinutes ? initialEntry.lightSleepMinutes.toString() : '');
      setAwakeMinsStr(initialEntry.awakeMinutes ? initialEntry.awakeMinutes.toString() : '');
      setNotes(initialEntry.notes || '');
    } else {
      setStartTimeStr('23:00');
      setEndTimeStr('07:00');
      setIsNapOverride(null);
      setDeepMinsStr('');
      setRemMinsStr('');
      setLightMinsStr('');
      setAwakeMinsStr('');
      setNotes('');
    }
  }, [initialEntry, visible]);

  const handleSave = () => {
    // Parse time strings
    const [startH, startM] = startTimeStr.split(':').map((v) => parseInt(v, 10) || 0);
    const [endH, endM] = endTimeStr.split(':').map((v) => parseInt(v, 10) || 0);

    const baseDate = new Date(`${currentDateStr}T00:00:00.000`);

    const startDate = new Date(baseDate);
    startDate.setHours(startH, startM, 0, 0);

    let endDate = new Date(baseDate);
    endDate.setHours(endH, endM, 0, 0);

    // If end time is earlier than start time (e.g. 23:00 to 07:00), end time is next morning
    if (endDate.getTime() <= startDate.getTime()) {
      endDate.setDate(endDate.getDate() + 1);
    }

    const durationMinutes = Math.max(1, Math.round((endDate.getTime() - startDate.getTime()) / 60000));

    const { dateStr, isNap: autoNap } = assignSleepDateAndType(startDate);
    const isNap = isNapOverride !== null ? isNapOverride : autoNap;

    const deepSleepMinutes = parseInt(deepMinsStr, 10) || undefined;
    const remSleepMinutes = parseInt(remMinsStr, 10) || undefined;
    const lightSleepMinutes = parseInt(lightMinsStr, 10) || undefined;
    const awakeMinutes = parseInt(awakeMinsStr, 10) || undefined;

    const qualityScore = calculateSleepQualityScore(
      durationMinutes,
      targetSleepMinutes,
      deepSleepMinutes,
      remSleepMinutes,
      awakeMinutes
    );

    onSave(
      {
        date: dateStr,
        startTime: startDate.toISOString(),
        endTime: endDate.toISOString(),
        durationMinutes,
        qualityScore,
        isNap,
        deepSleepMinutes,
        remSleepMinutes,
        lightSleepMinutes,
        awakeMinutes,
        notes,
        source: 'MANUAL',
      },
      initialEntry?.id
    );

    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <SafeAreaView style={styles.overlay}>
        <View style={styles.container}>
          <View style={styles.header}>
            <Text style={styles.title}>
              {initialEntry ? t('sleep.editSleepTitle') : t('sleep.logSleepTitle')}
            </Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Text style={styles.closeBtnText}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.formContainer} contentContainerStyle={{ paddingBottom: 24 }}>
            {/* Start Time & End Time */}
            <View style={styles.row}>
              <View style={[styles.inputGroup, { flex: 1, marginRight: 8 }]}>
                <Text style={styles.label}>{t('sleep.bedtime')}</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="23:00"
                  placeholderTextColor={COLORS.textMuted}
                  value={startTimeStr}
                  onChangeText={setStartTimeStr}
                />
              </View>

              <View style={[styles.inputGroup, { flex: 1, marginLeft: 8 }]}>
                <Text style={styles.label}>{t('sleep.wakeTime')}</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="07:00"
                  placeholderTextColor={COLORS.textMuted}
                  value={endTimeStr}
                  onChangeText={setEndTimeStr}
                />
              </View>
            </View>

            {/* Is Daytime Nap Toggle */}
            <View style={styles.toggleRow}>
              <Text style={styles.label}>{t('sleep.isNap')}</Text>
              <Switch
                value={isNapOverride ?? false}
                onValueChange={(val) => setIsNapOverride(val)}
                trackColor={{ false: COLORS.border, true: COLORS.primary }}
                thumbColor={COLORS.cardBg}
              />
            </View>

            {/* Sleep Stages (Optional) */}
            <Text style={[styles.sectionTitle, { marginTop: 16 }]}>
              {t('sleep.stageBreakdown')}
            </Text>

            <View style={styles.row}>
              <View style={[styles.inputGroup, { flex: 1, marginRight: 6 }]}>
                <Text style={styles.label}>{t('sleep.deepSleep')} (m)</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="90"
                  placeholderTextColor={COLORS.textMuted}
                  keyboardType="numeric"
                  value={deepMinsStr}
                  onChangeText={setDeepMinsStr}
                />
              </View>

              <View style={[styles.inputGroup, { flex: 1, marginLeft: 6, marginRight: 6 }]}>
                <Text style={styles.label}>{t('sleep.remSleep')} (m)</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="100"
                  placeholderTextColor={COLORS.textMuted}
                  keyboardType="numeric"
                  value={remMinsStr}
                  onChangeText={setRemMinsStr}
                />
              </View>

              <View style={[styles.inputGroup, { flex: 1, marginLeft: 6 }]}>
                <Text style={styles.label}>{t('sleep.awakeTime')} (m)</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="15"
                  placeholderTextColor={COLORS.textMuted}
                  keyboardType="numeric"
                  value={awakeMinsStr}
                  onChangeText={setAwakeMinsStr}
                />
              </View>
            </View>

            {/* Notes / Dream Journal */}
            <View style={[styles.inputGroup, { marginTop: 12 }]}>
              <Text style={styles.label}>{t('sleep.notes')}</Text>
              <TextInput
                style={[styles.textInput, { height: 80, textAlignVertical: 'top' }]}
                placeholder={t('sleep.notesPlaceholder')}
                placeholderTextColor={COLORS.textMuted}
                multiline
                value={notes}
                onChangeText={setNotes}
              />
            </View>
          </ScrollView>

          <View style={styles.footer}>
            <TouchableOpacity style={styles.saveBtn} onPress={handleSave}>
              <Text style={styles.saveBtnText}>
                {initialEntry ? t('sleep.updateSleep') : t('sleep.saveSleep')}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'flex-end',
  },
  container: {
    backgroundColor: COLORS.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '90%',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  title: {
    fontSize: 18,
    fontFamily: FONTS.bold,
    color: COLORS.text,
  },
  closeBtn: {
    padding: 6,
  },
  closeBtnText: {
    fontSize: 18,
    color: COLORS.textMuted,
    fontFamily: FONTS.medium,
  },
  formContainer: {
    marginTop: 16,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  inputGroup: {
    marginBottom: 12,
  },
  label: {
    fontSize: 13,
    fontFamily: FONTS.semiBold,
    color: COLORS.textMuted,
    marginBottom: 6,
  },
  sectionTitle: {
    fontSize: 14,
    fontFamily: FONTS.bold,
    color: COLORS.text,
    marginBottom: 8,
  },
  textInput: {
    backgroundColor: COLORS.cardBg,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    fontFamily: FONTS.regular,
    color: COLORS.text,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.cardBg,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  footer: {
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  saveBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  saveBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontFamily: FONTS.bold,
  },
});
