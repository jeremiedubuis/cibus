import React from 'react';
import {
  Alert,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { SleepEntry } from '../types';
import { COLORS, FONTS } from '../constants/theme';
import { aggregateDailySleep } from '../services/sleepCalculator';

interface SleepBreakdownCardProps {
  sleepEntries: SleepEntry[];
  targetSleepMinutes?: number;
  onAddSleep: () => void;
  onEditSleep: (entry: SleepEntry) => void;
  onDeleteSleep: (id: string) => void;
  isHealthConnectActive: boolean;
  onConnectHealthConnect?: () => void;
}

export const SleepBreakdownCard: React.FC<SleepBreakdownCardProps> = ({
  sleepEntries,
  targetSleepMinutes = 480,
  onAddSleep,
  onEditSleep,
  onDeleteSleep,
  isHealthConnectActive,
  onConnectHealthConnect,
}) => {
  const { t } = useTranslation();

  const aggregated = aggregateDailySleep(sleepEntries, targetSleepMinutes);

  const targetHours = (targetSleepMinutes / 60).toFixed(1);
  const totalSleptHours = Math.floor(aggregated.totalSleepMinutes / 60);
  const totalSleptMins = aggregated.totalSleepMinutes % 60;
  const progressRatio = Math.min(1.0, aggregated.totalSleepMinutes / targetSleepMinutes);

  const confirmDelete = (entry: SleepEntry) => {
    Alert.alert(
      t('sleep.confirmDeleteTitle'),
      t('sleep.confirmDeleteMessage'),
      [
        { text: t('mealBreakdown.cancel'), style: 'cancel' },
        {
          text: t('mealBreakdown.delete'),
          style: 'destructive',
          onPress: () => onDeleteSleep(entry.id),
        },
      ]
    );
  };

  const formatTime = (isoStr: string) => {
    const d = new Date(isoStr);
    if (isNaN(d.getTime())) return '--:--';
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  };

  const getInsightText = () => {
    if (sleepEntries.length === 0) return null;
    if (aggregated.overallScore >= 80) return t('sleep.insightGood');
    if (aggregated.totalDeepMinutes > 90) return t('sleep.insightDeep');
    return t('sleep.insightShort');
  };

  return (
    <View style={styles.container}>
      {/* Top Title */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.headerTitle}>{t('sleep.title')}</Text>
        </View>
      </View>

      {/* Health Connect Sleep Permissions Banner */}
      {!isHealthConnectActive && onConnectHealthConnect && (
        <View style={styles.connectHcBox}>
          <Text style={styles.connectHcTitle}>{t('sleep.connectHcTitle')}</Text>
          <Text style={styles.connectHcDesc}>{t('sleep.connectHcDesc')}</Text>
          <TouchableOpacity
            style={styles.connectHcBtn}
            onPress={onConnectHealthConnect}
            activeOpacity={0.8}
          >
            <Text style={styles.connectHcBtnText}>{t('sleep.connectHcBtn')}</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Primary Score & Target Progress Card */}
      <View style={styles.scoreCard}>
        <View style={styles.scoreRow}>
          <View style={[styles.scoreBadgeCircle, { borderColor: aggregated.ratingInfo.color }]}>
            <Text style={[styles.scoreNumber, { color: aggregated.ratingInfo.color }]}>
              {aggregated.overallScore}
            </Text>
            <Text style={styles.scoreSubtext}>/ 100</Text>
          </View>

          <View style={styles.scoreMeta}>
            <Text style={styles.scoreLabel}>{t('sleep.sleepQuality')}</Text>
            <View style={[styles.ratingPill, { backgroundColor: aggregated.ratingInfo.color + '22' }]}>
              <Text style={[styles.ratingPillText, { color: aggregated.ratingInfo.color }]}>
                {t(aggregated.ratingInfo.labelKey)}
              </Text>
            </View>

            <Text style={styles.totalSleptText}>
              {t('sleep.totalSlept', { hours: totalSleptHours, mins: totalSleptMins })}
            </Text>
            <Text style={styles.targetGoalText}>
              {t('sleep.targetGoal', { target: targetHours })}
            </Text>
          </View>
        </View>

        {/* Progress Bar */}
        <View style={styles.progressTrack}>
          <View
            style={[
              styles.progressBar,
              {
                width: `${Math.round(progressRatio * 100)}%`,
                backgroundColor: aggregated.ratingInfo.color,
              },
            ]}
          />
        </View>
      </View>

      {/* Sleep Stages Breakdown (if available) */}
      {(aggregated.totalDeepMinutes > 0 ||
        aggregated.totalRemMinutes > 0 ||
        aggregated.totalLightMinutes > 0) && (
        <View style={styles.stagesSection}>
          <Text style={styles.sectionHeading}>{t('sleep.stageBreakdown')}</Text>

          <View style={styles.stagesGrid}>
            <View style={styles.stageItem}>
              <Text style={styles.stageName}>{t('sleep.deepSleep')}</Text>
              <Text style={styles.stageVal}>{aggregated.totalDeepMinutes}m</Text>
            </View>

            <View style={styles.stageItem}>
              <Text style={styles.stageName}>{t('sleep.remSleep')}</Text>
              <Text style={styles.stageVal}>{aggregated.totalRemMinutes}m</Text>
            </View>

            <View style={styles.stageItem}>
              <Text style={styles.stageName}>{t('sleep.lightSleep')}</Text>
              <Text style={styles.stageVal}>{aggregated.totalLightMinutes}m</Text>
            </View>

            {aggregated.totalAwakeMinutes > 0 && (
              <View style={styles.stageItem}>
                <Text style={styles.stageName}>{t('sleep.awakeTime')}</Text>
                <Text style={styles.stageVal}>{aggregated.totalAwakeMinutes}m</Text>
              </View>
            )}
          </View>
        </View>
      )}

      {/* Insights Banner */}
      {getInsightText() && (
        <View style={styles.insightBanner}>
          <Text style={styles.insightText}>💡 {getInsightText()}</Text>
        </View>
      )}

      {/* Sleep Sessions List */}
      <View style={styles.entriesSection}>
        {sleepEntries.length === 0 ? (
          <Text style={styles.emptyText}>{t('sleep.noSleepLogged')}</Text>
        ) : (
          sleepEntries.map((entry) => {
            const h = Math.floor(entry.durationMinutes / 60);
            const m = entry.durationMinutes % 60;
            return (
              <View key={entry.id} style={styles.entryCard}>
                <View style={styles.entryHeader}>
                  <View style={styles.entryTypePill}>
                    <Text style={styles.entryTypeText}>
                      {entry.isNap ? `🌙 ${t('sleep.isNap')}` : `😴 ${t('sleep.overnightSleep')}`}
                    </Text>
                  </View>

                  <View style={styles.entryActions}>
                    <TouchableOpacity onPress={() => onEditSleep(entry)} style={styles.actionBtn}>
                      <Text style={styles.actionBtnText}>✏️</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => confirmDelete(entry)} style={styles.actionBtn}>
                      <Text style={styles.actionBtnText}>🗑️</Text>
                    </TouchableOpacity>
                  </View>
                </View>

                <View style={styles.entryTimeRow}>
                  <Text style={styles.entryTimes}>
                    {formatTime(entry.startTime)} → {formatTime(entry.endTime)}
                  </Text>
                  <Text style={styles.entryDuration}>
                    {h}h {m}m
                  </Text>
                </View>

                {entry.notes ? <Text style={styles.entryNotes}>"{entry.notes}"</Text> : null}
              </View>
            );
          })
        )}
      </View>

      {/* Log Button */}
      <TouchableOpacity style={styles.addBtn} onPress={onAddSleep}>
        <Text style={styles.addBtnText}>{t('sleep.logSleep')}</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: COLORS.cardBg,
    borderRadius: 20,
    padding: 18,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 13,
    fontFamily: FONTS.bold,
    color: COLORS.textMuted,
    letterSpacing: 0.8,
  },
  connectHcBox: {
    backgroundColor: COLORS.background,
    borderRadius: 14,
    padding: 14,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: COLORS.primary + '30',
  },
  connectHcTitle: {
    color: COLORS.primary,
    fontSize: 13,
    fontFamily: FONTS.bold,
    marginBottom: 4,
  },
  connectHcDesc: {
    color: COLORS.textMuted,
    fontSize: 12,
    lineHeight: 18,
    fontFamily: FONTS.medium,
    marginBottom: 10,
  },
  connectHcBtn: {
    backgroundColor: COLORS.primary + '20',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.primary + '40',
  },
  connectHcBtnText: {
    color: COLORS.primary,
    fontSize: 13,
    fontFamily: FONTS.bold,
  },
  scoreCard: {
    backgroundColor: COLORS.background,
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  scoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  scoreBadgeCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 3,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  scoreNumber: {
    fontSize: 22,
    fontFamily: FONTS.extraBold,
  },
  scoreSubtext: {
    fontSize: 9,
    fontFamily: FONTS.medium,
    color: COLORS.textMuted,
    marginTop: -2,
  },
  scoreMeta: {
    flex: 1,
  },
  scoreLabel: {
    fontSize: 13,
    fontFamily: FONTS.bold,
    color: COLORS.text,
    marginBottom: 4,
  },
  ratingPill: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    marginBottom: 6,
  },
  ratingPillText: {
    fontSize: 11,
    fontFamily: FONTS.bold,
  },
  totalSleptText: {
    fontSize: 14,
    fontFamily: FONTS.semiBold,
    color: COLORS.text,
  },
  targetGoalText: {
    fontSize: 12,
    fontFamily: FONTS.regular,
    color: COLORS.textMuted,
  },
  progressTrack: {
    height: 8,
    backgroundColor: COLORS.cardBg,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    borderRadius: 4,
  },
  stagesSection: {
    marginBottom: 14,
  },
  sectionHeading: {
    fontSize: 12,
    fontFamily: FONTS.bold,
    color: COLORS.textMuted,
    marginBottom: 8,
  },
  stagesGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  stageItem: {
    backgroundColor: COLORS.background,
    borderRadius: 10,
    padding: 10,
    flex: 1,
    marginHorizontal: 3,
    alignItems: 'center',
  },
  stageName: {
    fontSize: 10,
    fontFamily: FONTS.medium,
    color: COLORS.textMuted,
    marginBottom: 2,
  },
  stageVal: {
    fontSize: 13,
    fontFamily: FONTS.bold,
    color: COLORS.text,
  },
  insightBanner: {
    backgroundColor: 'rgba(59, 130, 246, 0.12)',
    padding: 12,
    borderRadius: 12,
    marginBottom: 14,
  },
  insightText: {
    fontSize: 12,
    fontFamily: FONTS.medium,
    color: COLORS.text,
    lineHeight: 17,
  },
  entriesSection: {
    marginBottom: 14,
  },
  emptyText: {
    fontSize: 13,
    fontFamily: FONTS.regular,
    color: COLORS.textMuted,
    textAlign: 'center',
    marginVertical: 12,
  },
  entryCard: {
    backgroundColor: COLORS.background,
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  entryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  entryTypePill: {
    backgroundColor: COLORS.cardBg,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  entryTypeText: {
    fontSize: 11,
    fontFamily: FONTS.semiBold,
    color: COLORS.text,
  },
  entryActions: {
    flexDirection: 'row',
  },
  actionBtn: {
    marginLeft: 8,
    padding: 2,
  },
  actionBtnText: {
    fontSize: 14,
  },
  entryTimeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  entryTimes: {
    fontSize: 14,
    fontFamily: FONTS.bold,
    color: COLORS.text,
  },
  entryDuration: {
    fontSize: 13,
    fontFamily: FONTS.semiBold,
    color: COLORS.primary,
  },
  entryNotes: {
    fontSize: 12,
    fontFamily: FONTS.regular,
    fontStyle: 'italic',
    color: COLORS.textMuted,
    marginTop: 4,
  },
  addBtn: {
    backgroundColor: COLORS.primary + '18',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.primary + '30',
  },
  addBtnText: {
    fontSize: 14,
    fontFamily: FONTS.bold,
    color: COLORS.primary,
  },
});
