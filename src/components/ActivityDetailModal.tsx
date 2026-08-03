import React, { useState } from 'react';
import {
  Modal,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { ActivityEntry, HeartRateSample, SportActivityType } from '../types';
import { COLORS, FONTS } from '../constants/theme';
import { calculateHeartRateZones } from '../services/heartRateCalculator';

interface ActivityDetailModalProps {
  visible: boolean;
  activity: ActivityEntry | null;
  userAge?: number;
  onClose: () => void;
  onEdit?: (activity: ActivityEntry) => void;
}

export const ActivityDetailModal: React.FC<ActivityDetailModalProps> = ({
  visible,
  activity,
  userAge = 30,
  onClose,
  onEdit,
}) => {
  const { t } = useTranslation();
  const [selectedPoint, setSelectedPoint] = useState<HeartRateSample | null>(null);

  if (!activity) return null;

  const getActivityTypeLabel = (type: SportActivityType): string => {
    switch (type) {
      case 'RUNNING':
        return t('activities.running');
      case 'ELLIPTICAL':
        return t('activities.elliptical');
      case 'CALISTHENICS':
        return t('activities.calisthenics');
      case 'SWIMMING':
        return t('activities.swimming');
      case 'BICYCLE':
        return t('activities.bicycle');
      case 'CLIMBING':
        return t('activities.climbing');
      case 'WALKING':
        return t('activities.walking');
      case 'CROSSFIT':
        return t('activities.crossfit');
      case 'CANICROSS':
        return t('activities.canicross');
      case 'WEIGHTS':
        return t('activities.weights');
      default:
        return type;
    }
  };

  const getActivityIcon = (type: SportActivityType): string => {
    switch (type) {
      case 'RUNNING':
        return '🏃';
      case 'ELLIPTICAL':
        return '🔄';
      case 'CALISTHENICS':
        return '🤸';
      case 'SWIMMING':
        return '🏊';
      case 'BICYCLE':
        return '🚲';
      case 'CLIMBING':
        return '🧗';
      case 'WALKING':
        return '🚶';
      case 'CROSSFIT':
        return '🏋️‍♂️';
      case 'CANICROSS':
        return '🐕';
      case 'WEIGHTS':
        return '🏋️';
      default:
        return '⚽';
    }
  };

  const formatTimeStr = (isoString?: string): string => {
    if (!isoString) return '--:--';
    try {
      const dt = new Date(isoString);
      const hh = dt.getHours().toString().padStart(2, '0');
      const mm = dt.getMinutes().toString().padStart(2, '0');
      return `${hh}:${mm}`;
    } catch {
      return '--:--';
    }
  };

  const samples = activity.heartRateSamples || [];
  const zones =
    activity.heartRateZones ||
    calculateHeartRateZones(samples, activity.durationMinutes, userAge);

  const avgBpm = activity.avgHeartRateBpm || (samples.length > 0
    ? Math.round(samples.reduce((s, p) => s + p.bpm, 0) / samples.length)
    : null);

  const maxBpm = activity.maxHeartRateBpm || (samples.length > 0
    ? Math.max(...samples.map((p) => p.bpm))
    : null);

  const minBpm = activity.minHeartRateBpm || (samples.length > 0
    ? Math.min(...samples.map((p) => p.bpm))
    : null);

  // Graph math calculation bounds
  const minVal = minBpm ? Math.max(40, minBpm - 10) : 50;
  const maxVal = maxBpm ? Math.min(220, maxBpm + 10) : 190;
  const range = Math.max(20, maxVal - minVal);

  const getBpmZoneColor = (bpm: number): string => {
    if (bpm < 115) return '#0EA5E9'; // Zone 1
    if (bpm < 133) return '#10B981'; // Zone 2
    if (bpm < 152) return '#F59E0B'; // Zone 3
    if (bpm < 171) return '#F97316'; // Zone 4
    return '#EF4444'; // Zone 5
  };

  const totalZoneMinutes =
    (zones.zone1Minutes || 0) +
    (zones.zone2Minutes || 0) +
    (zones.zone3Minutes || 0) +
    (zones.zone4Minutes || 0) +
    (zones.zone5Minutes || 0) || activity.durationMinutes || 1;

  const zoneConfig = [
    { key: 'zone1', label: t('activities.zone1'), mins: zones.zone1Minutes || 0, color: '#0EA5E9' },
    { key: 'zone2', label: t('activities.zone2'), mins: zones.zone2Minutes || 0, color: '#10B981' },
    { key: 'zone3', label: t('activities.zone3'), mins: zones.zone3Minutes || 0, color: '#F59E0B' },
    { key: 'zone4', label: t('activities.zone4'), mins: zones.zone4Minutes || 0, color: '#F97316' },
    { key: 'zone5', label: t('activities.zone5'), mins: zones.zone5Minutes || 0, color: '#EF4444' },
  ];

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.modalContent}>
            {/* Header Bar */}
            <View style={styles.header}>
              <View style={styles.titleRow}>
                <Text style={styles.icon}>{getActivityIcon(activity.activityType)}</Text>
                <View>
                  <Text style={styles.title}>{getActivityTypeLabel(activity.activityType)}</Text>

                  <Text style={styles.subtitle}>
                    {activity.date} • {formatTimeStr(activity.startTime)}
                  </Text>
                </View>
              </View>

              <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
                <Text style={styles.closeBtnText}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView
              style={styles.body}
              contentContainerStyle={styles.bodyContent}
              showsVerticalScrollIndicator={false}
            >
            {/* Quick Stats Grid */}
            <View style={styles.statsGrid}>
              <View style={styles.statBox}>
                <Text style={styles.statLabel}>{t('activities.duration')}</Text>
                <Text style={styles.statVal}>{activity.durationMinutes} min</Text>
              </View>

              <View style={styles.statBox}>
                <Text style={styles.statLabel}>{t('activities.caloriesBurned')}</Text>
                <Text style={[styles.statVal, { color: COLORS.primary }]}>
                  {Math.round(activity.caloriesKcal)} kcal
                </Text>
              </View>

              {activity.distanceKm ? (
                <View style={styles.statBox}>
                  <Text style={styles.statLabel}>{t('activities.distance')}</Text>
                  <Text style={styles.statVal}>{activity.distanceKm} km</Text>
                </View>
              ) : null}
            </View>

            {/* Heart Rate Overview Cards */}
            <View style={styles.hrBannerCard}>
              <Text style={styles.sectionHeaderTitle}>
                ❤️ {t('activities.heartRateDetails')}
              </Text>

              <View style={styles.hrMetricsRow}>
                <View style={styles.hrMetricItem}>
                  <Text style={styles.hrMetricLabel}>{t('activities.avgHeartRate')}</Text>
                  <Text style={[styles.hrMetricValue, { color: COLORS.primary }]}>
                    {avgBpm ? `${avgBpm} BPM` : '--'}
                  </Text>
                </View>

                <View style={styles.hrMetricDivider} />

                <View style={styles.hrMetricItem}>
                  <Text style={styles.hrMetricLabel}>{t('activities.maxHeartRate')}</Text>
                  <Text style={[styles.hrMetricValue, { color: '#EF4444' }]}>
                    {maxBpm ? `${maxBpm} BPM` : '--'}
                  </Text>
                </View>

                <View style={styles.hrMetricDivider} />

                <View style={styles.hrMetricItem}>
                  <Text style={styles.hrMetricLabel}>{t('activities.minHeartRate')}</Text>
                  <Text style={[styles.hrMetricValue, { color: '#0EA5E9' }]}>
                    {minBpm ? `${minBpm} BPM` : '--'}
                  </Text>
                </View>
              </View>
            </View>

            {/* Interactive HR Line Graph */}
            <View style={styles.chartCard}>
              <Text style={styles.chartTitle}>{t('activities.heartRateChartTitle')}</Text>

              {samples.length === 0 ? (
                <View style={styles.noDataBox}>
                  <Text style={styles.noDataText}>{t('activities.noHrData')}</Text>
                </View>
              ) : (
                <View style={styles.chartWrapper}>
                  {/* Selected point tooltip */}
                  {selectedPoint && (
                    <View style={styles.tooltipBox}>
                      <Text style={styles.tooltipText}>
                        ⏱ {formatTimeStr(selectedPoint.timestamp)} —{' '}
                        <Text style={{ color: getBpmZoneColor(selectedPoint.bpm), fontWeight: '800' }}>
                          {selectedPoint.bpm} BPM
                        </Text>
                      </Text>
                    </View>
                  )}

                  {/* Visual Bar / Line Chart canvas */}
                  <View style={styles.barsArea}>
                    {samples.map((point, idx) => {
                      const heightPct = Math.max(
                        0.1,
                        Math.min(1.0, (point.bpm - minVal) / range)
                      );
                      const color = getBpmZoneColor(point.bpm);
                      const isSelected = selectedPoint === point;

                      return (
                        <TouchableOpacity
                          key={idx}
                          style={styles.barColumn}
                          activeOpacity={0.7}
                          onPress={() => setSelectedPoint(point)}
                        >
                          <View
                            style={[
                              styles.barFill,
                              {
                                height: `${Math.round(heightPct * 100)}%`,
                                backgroundColor: color,
                                opacity: isSelected ? 1 : 0.85,
                                borderWidth: isSelected ? 2 : 0,
                                borderColor: '#FFFFFF',
                              },
                            ]}
                          />
                        </TouchableOpacity>
                      );
                    })}
                  </View>

                  {/* Y Axis Legend labels */}
                  <View style={styles.yAxisLabels}>
                    <Text style={styles.yLabelText}>{maxVal} BPM</Text>
                    <Text style={styles.yLabelText}>{Math.round((maxVal + minVal) / 2)} BPM</Text>
                    <Text style={styles.yLabelText}>{minVal} BPM</Text>
                  </View>
                </View>
              )}
            </View>

            {/* Heart Rate Zones Distribution */}
            <View style={styles.zonesCard}>
              <Text style={styles.chartTitle}>{t('activities.heartRateZonesTitle')}</Text>

              {/* Stacked Percentage Bar */}
              <View style={styles.stackedBar}>
                {zoneConfig.map((z) => {
                  const pct = (z.mins / totalZoneMinutes) * 100;
                  if (pct <= 0) return null;
                  return (
                    <View
                      key={z.key}
                      style={{
                        width: `${pct}%`,
                        height: '100%',
                        backgroundColor: z.color,
                      }}
                    />
                  );
                })}
              </View>

              {/* Zone List */}
              <View style={styles.zoneList}>
                {zoneConfig.map((z) => {
                  const pct = Math.round((z.mins / totalZoneMinutes) * 100);
                  return (
                    <View key={z.key} style={styles.zoneRow}>
                      <View style={styles.zoneLeft}>
                        <View style={[styles.zoneDot, { backgroundColor: z.color }]} />

                        <Text style={styles.zoneName}>{z.label}</Text>
                      </View>

                      <View style={styles.zoneRight}>
                        <Text style={styles.zoneTime}>
                          {z.mins.toFixed(1)} min
                        </Text>
                        <Text style={styles.zonePct}>({pct}%)</Text>
                      </View>
                    </View>
                  );
                })}
              </View>
            </View>

            {/* Actions */}
            {onEdit && (
              <TouchableOpacity
                style={styles.editBtn}
                onPress={() => {
                  onClose();
                  onEdit(activity);
                }}
              >
                <Text style={styles.editBtnText}>✏️ {t('activities.updateActivity')}</Text>
              </TouchableOpacity>
            )}
          </ScrollView>
        </View>
      </SafeAreaView>
    </View>
  </Modal>
);
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'flex-end',
  },
  safeArea: {
    backgroundColor: COLORS.cardBg,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  modalContent: {
    backgroundColor: COLORS.cardBg,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '90%',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: Platform.OS === 'android' ? 24 : 12,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.cardBorder,
    marginBottom: 14,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  icon: {
    fontSize: 28,
  },
  title: {
    color: COLORS.textPrimary,
    fontSize: 18,
    fontWeight: '800',
    fontFamily: FONTS.extraBold,
  },
  subtitle: {
    color: COLORS.textSecondary,
    fontSize: 12,
    fontFamily: FONTS.medium,
    marginTop: 2,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.bgBackground,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeBtnText: {
    color: COLORS.textSecondary,
    fontSize: 16,
    fontWeight: '700',
  },
  body: {
    flexGrow: 0,
  },
  bodyContent: {
    paddingBottom: Platform.OS === 'android' ? 24 : 16,
  },
  statsGrid: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
  },
  statBox: {
    flex: 1,
    backgroundColor: COLORS.bgBackground,
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  statLabel: {
    color: COLORS.textSecondary,
    fontSize: 11,
    fontFamily: FONTS.medium,
    marginBottom: 4,
  },
  statVal: {
    color: COLORS.textPrimary,
    fontSize: 15,
    fontWeight: '800',
    fontFamily: FONTS.extraBold,
  },
  hrBannerCard: {
    backgroundColor: COLORS.bgBackground,
    borderRadius: 16,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  sectionHeaderTitle: {
    color: COLORS.primary,
    fontSize: 13,
    fontWeight: '800',
    fontFamily: FONTS.extraBold,
    letterSpacing: 0.8,
    marginBottom: 12,
  },
  hrMetricsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  hrMetricItem: {
    alignItems: 'center',
  },
  hrMetricLabel: {
    color: COLORS.textSecondary,
    fontSize: 11,
    fontFamily: FONTS.medium,
    marginBottom: 4,
  },
  hrMetricValue: {
    fontSize: 16,
    fontWeight: '800',
    fontFamily: FONTS.extraBold,
  },
  hrMetricDivider: {
    width: 1,
    height: 28,
    backgroundColor: COLORS.cardBorder,
  },
  chartCard: {
    backgroundColor: COLORS.bgBackground,
    borderRadius: 16,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  chartTitle: {
    color: COLORS.textPrimary,
    fontSize: 12,
    fontWeight: '800',
    fontFamily: FONTS.extraBold,
    letterSpacing: 0.8,
    marginBottom: 12,
  },
  noDataBox: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  noDataText: {
    color: COLORS.textSecondary,
    fontSize: 12,
    fontStyle: 'italic',
  },
  chartWrapper: {
    marginTop: 4,
  },
  tooltipBox: {
    backgroundColor: COLORS.cardBg,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    alignSelf: 'center',
    marginBottom: 8,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  tooltipText: {
    color: COLORS.textPrimary,
    fontSize: 12,
    fontFamily: FONTS.medium,
  },
  barsArea: {
    height: 120,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingTop: 10,
    paddingBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.cardBorder,
    gap: 3,
  },
  barColumn: {
    flex: 1,
    height: '100%',
    justifyContent: 'flex-end',
  },
  barFill: {
    width: '100%',
    borderRadius: 4,
  },
  yAxisLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  yLabelText: {
    color: COLORS.textSecondary,
    fontSize: 10,
    fontFamily: FONTS.medium,
  },
  zonesCard: {
    backgroundColor: COLORS.bgBackground,
    borderRadius: 16,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  stackedBar: {
    height: 12,
    borderRadius: 6,
    flexDirection: 'row',
    overflow: 'hidden',
    marginBottom: 12,
  },
  zoneList: {
    gap: 8,
  },
  zoneRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  zoneLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  zoneDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  zoneName: {
    color: COLORS.textPrimary,
    fontSize: 12,
    fontFamily: FONTS.medium,
  },
  zoneRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  zoneTime: {
    color: COLORS.textPrimary,
    fontSize: 12,
    fontWeight: '700',
    fontFamily: FONTS.bold,
  },
  zonePct: {
    color: COLORS.textSecondary,
    fontSize: 11,
    fontFamily: FONTS.medium,
  },
  editBtn: {
    backgroundColor: COLORS.primaryMuted,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.primary,
    marginTop: 8,
    marginBottom: 12,
  },
  editBtnText: {
    color: COLORS.primary,
    fontSize: 14,
    fontWeight: '800',
    fontFamily: FONTS.extraBold,
  },
});
