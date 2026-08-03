import React from 'react';
import {
  Modal,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { COLORS, FONTS } from '../constants/theme';

interface DisclaimerModalProps {
  visible: boolean;
  onConfirm: () => void;
}

export const DisclaimerModal: React.FC<DisclaimerModalProps> = ({ visible, onConfirm }) => {
  const { t } = useTranslation();

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent={true}
      statusBarTranslucent={true}
      onRequestClose={() => {
        // Non-dismissable without confirmation
      }}
    >
      <View style={styles.overlay}>
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.container}>
            <ScrollView
              style={styles.scrollView}
              contentContainerStyle={styles.scrollContent}
              showsVerticalScrollIndicator={false}
            >
              {/* Header Icon & Title */}
              <View style={styles.header}>
                <View style={styles.iconContainer}>
                  <Text style={styles.iconText}>⚠️</Text>
                </View>
                <Text style={styles.title}>{t('disclaimer.title')}</Text>
                <Text style={styles.subtitle}>{t('disclaimer.subtitle')}</Text>
              </View>

              {/* Warning Point 1: Nutritionist */}
              <View style={styles.warningCard}>
                <Text style={styles.warningIcon}>🩺</Text>
                <View style={styles.warningTextContainer}>
                  <Text style={styles.warningTitle}>{t('disclaimer.notValidatedTitle')}</Text>
                  <Text style={styles.warningBody}>{t('disclaimer.notValidatedText')}</Text>
                </View>
              </View>

              {/* Warning Point 2: AI Development */}
              <View style={styles.warningCard}>
                <Text style={styles.warningIcon}>🤖</Text>
                <View style={styles.warningTextContainer}>
                  <Text style={styles.warningTitle}>{t('disclaimer.aiDevTitle')}</Text>
                  <Text style={styles.warningBody}>{t('disclaimer.aiDevText')}</Text>
                </View>
              </View>

              {/* Warning Point 3: Critical Distance */}
              <View style={styles.warningCardHighlight}>
                <Text style={styles.warningIcon}>🧠</Text>
                <View style={styles.warningTextContainer}>
                  <Text style={styles.warningTitleHighlight}>
                    {t('disclaimer.criticalDistanceTitle')}
                  </Text>
                  <Text style={styles.warningBodyHighlight}>
                    {t('disclaimer.criticalDistanceText')}
                  </Text>
                </View>
              </View>
            </ScrollView>

            {/* Big Action Button */}
            <View style={styles.footer}>
              <TouchableOpacity
                style={styles.confirmButton}
                activeOpacity={0.85}
                onPress={onConfirm}
              >
                <Text style={styles.confirmButtonText}>{t('disclaimer.confirmButton')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </SafeAreaView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(5, 8, 15, 0.92)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  safeArea: {
    width: '100%',
    maxWidth: 500,
    maxHeight: '90%',
  },
  container: {
    backgroundColor: COLORS.cardBgElevated,
    borderRadius: 24,
    borderWidth: 1.5,
    borderColor: COLORS.warning,
    overflow: 'hidden',
    shadowColor: COLORS.warning,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 12,
  },
  scrollView: {
    maxHeight: 520,
  },
  scrollContent: {
    padding: 24,
  },
  header: {
    alignItems: 'center',
    marginBottom: 24,
  },
  iconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  iconText: {
    fontSize: 32,
  },
  title: {
    fontFamily: FONTS.extraBold,
    fontSize: 22,
    color: COLORS.textPrimary,
    textAlign: 'center',
    marginBottom: 6,
  },
  subtitle: {
    fontFamily: FONTS.medium,
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
  warningCard: {
    flexDirection: 'row',
    backgroundColor: COLORS.cardBg,
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    alignItems: 'flex-start',
  },
  warningCardHighlight: {
    flexDirection: 'row',
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1.5,
    borderColor: 'rgba(239, 68, 68, 0.5)',
    alignItems: 'flex-start',
  },
  warningIcon: {
    fontSize: 26,
    marginRight: 14,
    marginTop: 2,
  },
  warningTextContainer: {
    flex: 1,
  },
  warningTitle: {
    fontFamily: FONTS.bold,
    fontSize: 15,
    color: COLORS.textPrimary,
    marginBottom: 4,
  },
  warningTitleHighlight: {
    fontFamily: FONTS.bold,
    fontSize: 15,
    color: '#FCA5A5',
    marginBottom: 4,
  },
  warningBody: {
    fontFamily: FONTS.regular,
    fontSize: 13,
    color: COLORS.textSecondary,
    lineHeight: 19,
  },
  warningBodyHighlight: {
    fontFamily: FONTS.regular,
    fontSize: 13,
    color: '#FEE2E2',
    lineHeight: 19,
  },
  footer: {
    padding: 20,
    paddingTop: 12,
    backgroundColor: COLORS.cardBgElevated,
    borderTopWidth: 1,
    borderTopColor: COLORS.cardBorder,
  },
  confirmButton: {
    backgroundColor: COLORS.primary,
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 16,
    alignItems: 'center',
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  confirmButtonText: {
    fontFamily: FONTS.extraBold,
    fontSize: 16,
    color: '#0B0F19',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
});
