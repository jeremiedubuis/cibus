import React from 'react';
import { Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { ActivityEntry, SportActivityType } from '../types';
import { COLORS, FONTS } from '../constants/theme';

interface ActivityBreakdownCardProps {
  entries: ActivityEntry[];
  isHealthConnectActive?: boolean;
  onConnectHealthConnect?: () => void;
  onAddActivity: () => void;
  onEditActivity: (entry: ActivityEntry) => void;
  onSelectActivity?: (entry: ActivityEntry) => void;
  onDeleteActivity: (id: string) => void;
}

export const ActivityBreakdownCard: React.FC<ActivityBreakdownCardProps> = ({
  entries,
  isHealthConnectActive = false,
  onConnectHealthConnect,
  onAddActivity,
  onEditActivity,
  onSelectActivity,
  onDeleteActivity,
}) => {
  const { t } = useTranslation();

  const totalCalories = entries.reduce((sum, e) => sum + (e.caloriesKcal || 0), 0);

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

  const handleDeletePrompt = (entry: ActivityEntry) => {
    Alert.alert(
      t('activities.confirmDeleteTitle'),
      t('activities.confirmDeleteMessage'),
      [
        { text: t('mealBreakdown.cancel'), style: 'cancel' },
        {
          text: t('mealBreakdown.delete'),
          style: 'destructive',
          onPress: () => onDeleteActivity(entry.id),
        },
      ]
    );
  };

  return (
    <View style={styles.cardContainer}>
      {/* Total Burned Summary Banner */}
      <View style={styles.summaryBanner}>
        <Text style={styles.summaryTitle}>{t('activities.title')}</Text>
        <Text style={styles.summaryVal}>
          {t('activities.totalBurned', { total: Math.round(totalCalories) })}
        </Text>
      </View>

      {/* Health Connect Activity Permissions Banner */}
      {!isHealthConnectActive && onConnectHealthConnect && (
        <View style={styles.connectHcBox}>
          <Text style={styles.connectHcTitle}>{t('activities.connectHcTitle')}</Text>
          <Text style={styles.connectHcDesc}>{t('activities.connectHcDesc')}</Text>
          <TouchableOpacity
            style={styles.connectHcBtn}
            onPress={onConnectHealthConnect}
            activeOpacity={0.8}
          >
            <Text style={styles.connectHcBtnText}>{t('activities.connectHcBtn')}</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Activity List */}
      {entries.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>{t('activities.noActivities')}</Text>
        </View>
      ) : (
        <View style={styles.listContainer}>
          {entries.map((entry) => (
            <View key={entry.id} style={styles.entryRow}>
              <View style={styles.iconBox}>
                <Text style={styles.iconText}>{getActivityIcon(entry.activityType)}</Text>
              </View>

              <TouchableOpacity
                style={styles.entryContent}
                onPress={() => (onSelectActivity ? onSelectActivity(entry) : onEditActivity(entry))}
                activeOpacity={0.7}
              >
                <Text style={styles.activityName}>
                  {getActivityTypeLabel(entry.activityType)}
                </Text>
                <View style={styles.detailsRow}>
                  <Text style={styles.detailBadge}>⏱ {formatTimeStr(entry.startTime)}</Text>
                  <Text style={styles.detailBadge}>⏳ {entry.durationMinutes} min</Text>
                  {entry.distanceKm ? (
                    <Text style={styles.detailBadge}>📍 {entry.distanceKm} km</Text>
                  ) : null}
                  {entry.avgHeartRateBpm ? (
                    <Text style={[styles.detailBadge, { color: COLORS.primary, fontWeight: '700' }]}>
                      ❤️ {entry.avgHeartRateBpm} bpm
                    </Text>
                  ) : null}
                </View>
              </TouchableOpacity>

              <View style={styles.rightInfoBox}>
                <Text style={styles.kcalText}>{Math.round(entry.caloriesKcal)} kcal</Text>
                <View style={styles.actionRow}>
                  <TouchableOpacity
                    onPress={() => (onSelectActivity ? onSelectActivity(entry) : onEditActivity(entry))}
                    style={styles.actionBtn}
                  >
                    <Text style={styles.actionBtnText}>📈</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={() => onEditActivity(entry)}
                    style={styles.actionBtn}
                  >
                    <Text style={styles.actionBtnText}>✏️</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={() => handleDeletePrompt(entry)}
                    style={styles.actionBtn}
                  >
                    <Text style={styles.actionBtnText}>🗑️</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          ))}
        </View>
      )}

      {/* Add Sport Activity Button */}
      <TouchableOpacity
        style={styles.addBtn}
        onPress={onAddActivity}
        activeOpacity={0.8}
      >
        <Text style={styles.addBtnText}>{t('activities.addActivity')}</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  cardContainer: {
    backgroundColor: COLORS.cardBg,
    marginHorizontal: 20,
    marginTop: 14,
    marginBottom: 16,
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  summaryBanner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.cardBorder,
  },
  summaryTitle: {
    color: COLORS.primary,
    fontSize: 12,
    fontWeight: '800',
    fontFamily: FONTS.extraBold,
    letterSpacing: 1.2,
  },
  summaryVal: {
    color: COLORS.successLight,
    fontSize: 13,
    fontWeight: '800',
    fontFamily: FONTS.extraBold,
  },
  emptyContainer: {
    paddingVertical: 18,
    alignItems: 'center',
  },
  emptyText: {
    color: COLORS.textSecondary,
    fontSize: 13,
    fontFamily: FONTS.medium,
    fontStyle: 'italic',
  },
  listContainer: {
    gap: 10,
    marginBottom: 14,
  },
  entryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.bgBackground,
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    gap: 12,
  },
  iconBox: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: COLORS.cardBg,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  iconText: {
    fontSize: 20,
  },
  entryContent: {
    flex: 1,
  },
  activityName: {
    color: COLORS.textPrimary,
    fontSize: 15,
    fontWeight: '700',
    fontFamily: FONTS.bold,
  },
  detailsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
  },
  detailBadge: {
    color: COLORS.textSecondary,
    fontSize: 11,
    fontFamily: FONTS.medium,
  },
  rightInfoBox: {
    alignItems: 'flex-end',
    gap: 4,
  },
  kcalText: {
    color: COLORS.primary,
    fontSize: 14,
    fontWeight: '800',
    fontFamily: FONTS.extraBold,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 6,
  },
  actionBtn: {
    padding: 4,
  },
  actionBtnText: {
    fontSize: 14,
  },
  addBtn: {
    backgroundColor: COLORS.primaryMuted,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.primary,
  },
  addBtnText: {
    color: COLORS.primary,
    fontSize: 14,
    fontWeight: '800',
    fontFamily: FONTS.extraBold,
  },
  connectHcBox: {
    backgroundColor: COLORS.bgBackground,
    borderRadius: 14,
    padding: 14,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: COLORS.primaryMuted,
  },
  connectHcTitle: {
    color: COLORS.primary,
    fontSize: 13,
    fontWeight: '800',
    fontFamily: FONTS.extraBold,
    marginBottom: 4,
  },
  connectHcDesc: {
    color: COLORS.textSecondary,
    fontSize: 12,
    lineHeight: 18,
    fontFamily: FONTS.medium,
    marginBottom: 10,
  },
  connectHcBtn: {
    backgroundColor: COLORS.primaryMuted,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.primary,
  },
  connectHcBtnText: {
    color: COLORS.primary,
    fontSize: 13,
    fontWeight: '800',
    fontFamily: FONTS.extraBold,
  },
});
