import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { COLORS, FONTS } from '../constants/theme';

interface DateNavigatorProps {
  currentDateStr: string; // YYYY-MM-DD
  onDateChange: (newDateStr: string) => void;
}

export const DateNavigator: React.FC<DateNavigatorProps> = ({ currentDateStr, onDateChange }) => {
  const { t, i18n } = useTranslation();
  const todayStr = new Date().toISOString().split('T')[0];

  const handlePrevDay = () => {
    const d = new Date(currentDateStr);
    d.setDate(d.getDate() - 1);
    onDateChange(d.toISOString().split('T')[0]);
  };

  const handleNextDay = () => {
    const d = new Date(currentDateStr);
    d.setDate(d.getDate() + 1);
    onDateChange(d.toISOString().split('T')[0]);
  };

  const isToday = currentDateStr === todayStr;

  const formatDateLabel = (dateStr: string) => {
    if (dateStr === todayStr) return t('dateNavigator.today');
    const [y, m, d] = dateStr.split('-');
    const dateObj = new Date(parseInt(y, 10), parseInt(m, 10) - 1, parseInt(d, 10));
    try {
      return dateObj.toLocaleDateString(i18n.language, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    } catch (e) {
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      return `${months[parseInt(m, 10) - 1]} ${parseInt(d, 10)}, ${y}`;
    }
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.navButton} onPress={handlePrevDay} activeOpacity={0.7}>
        <Text style={styles.navButtonText}>‹</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.dateTitleContainer}
        onPress={() => onDateChange(todayStr)}
        activeOpacity={0.7}
      >
        <Text style={styles.dateText}>{formatDateLabel(currentDateStr)}</Text>
        {!isToday && <Text style={styles.todayChip}>{t('dateNavigator.tapToReturnToday')}</Text>}
      </TouchableOpacity>

      <TouchableOpacity style={styles.navButton} onPress={handleNextDay} activeOpacity={0.7}>
        <Text style={styles.navButtonText}>›</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.cardBg,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 16,
    marginHorizontal: 16,
    marginVertical: 12,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  navButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.cardBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navButtonText: {
    color: COLORS.primary,
    fontSize: 22,
    fontWeight: 'bold',
    fontFamily: FONTS.bold,
    lineHeight: 24,
  },
  dateTitleContainer: {
    alignItems: 'center',
  },
  dateText: {
    color: COLORS.textPrimary,
    fontSize: 17,
    fontWeight: '700',
    fontFamily: FONTS.bold,
    letterSpacing: 0.3,
  },
  todayChip: {
    color: COLORS.primary,
    fontSize: 10,
    marginTop: 2,
    fontWeight: '600',
    fontFamily: FONTS.semibold,
  },
});

