import { Platform } from 'react-native';

export const COLORS = {
  // Primary brand color palette - Warm Sunset Amber / Honey Gold
  // Harmonizes with orange icon without being aggressive
  primary: '#F59E0B',
  primaryLight: '#FBBF24',
  primaryDark: '#D97706',
  primaryMuted: 'rgba(245, 158, 11, 0.15)',
  primaryGlow: 'rgba(245, 158, 11, 0.25)',

  // Secondary Warm Accent (Terracotta Coral)
  accent: '#F97316',
  accentLight: '#FB923C',

  // Dark Theme Backgrounds & Surfaces
  bgBackground: '#0B0F19',
  cardBg: '#1E293B',
  cardBgElevated: '#243248',
  cardBorder: '#334155',
  cardBorderFocused: '#F59E0B',

  // Text colors
  textPrimary: '#F8FAFC',
  textSecondary: '#94A3B8',
  textMuted: '#64748B',

  // Functional & Macro Colors
  success: '#10B981',
  successLight: '#34D399',
  warning: '#F59E0B',
  danger: '#EF4444',
  info: '#F59E0B',

  // Nutrition Macro Colors
  macroProtein: '#EC4899', // Rose/Pink
  macroCarbs: '#F59E0B',   // Warm Amber
  macroFat: '#8B5CF6',     // Violet/Purple
  macroCalories: '#F97316',// Warm Orange
};

export const FONTS = {
  regular: 'PlusJakartaSans_400Regular',
  medium: 'PlusJakartaSans_500Medium',
  semibold: 'PlusJakartaSans_600SemiBold',
  bold: 'PlusJakartaSans_700Bold',
  extraBold: 'PlusJakartaSans_800ExtraBold',
};
