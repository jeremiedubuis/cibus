import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { COLORS, FONTS } from '../constants/theme';

interface UpdateBannerProps {
  visible: boolean;
  onStartUpdate: () => void;
}

export const UpdateBanner: React.FC<UpdateBannerProps> = ({ visible, onStartUpdate }) => {
  const { t } = useTranslation();
  if (!visible) return null;

  return (
    <View style={styles.banner}>
      <View style={styles.content}>
        <Text style={styles.title}>{t('updateBanner.title')}</Text>
        <Text style={styles.subtitle}>
          {t('updateBanner.description')}
        </Text>
      </View>
      <TouchableOpacity style={styles.updateBtn} onPress={onStartUpdate} activeOpacity={0.8}>
        <Text style={styles.updateBtnText}>{t('updateBanner.updateNow')}</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  banner: {
    backgroundColor: COLORS.primaryDark,
    paddingHorizontal: 16,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: 16,
    marginTop: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.primary,
  },
  content: {
    flex: 1,
    paddingRight: 10,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
    fontFamily: FONTS.extraBold,
  },
  subtitle: {
    color: '#FEF3C7',
    fontSize: 11,
    fontFamily: FONTS.medium,
    marginTop: 2,
  },
  updateBtn: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  updateBtnText: {
    color: COLORS.primaryDark,
    fontSize: 12,
    fontWeight: '800',
    fontFamily: FONTS.extraBold,
  },
});
