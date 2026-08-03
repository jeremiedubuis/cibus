import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  ActivityIndicator,
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
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useTranslation } from 'react-i18next';
import { FoodItem } from '../types';
import { fetchProductByBarcode, getDeviceLocaleInfo, searchProductsOFF } from '../services/offApi';
import { searchCiqualFoods } from '../services/ciqualService';
import { searchSwissFoods } from '../services/swissService';
import { searchFineliFoods } from '../services/fineliService';
import { parseNutritionText, recognizeTextFromImage } from '../services/ocrParser';
import { saveFoodItem, searchLocalFoods, getRecentFoodLogInfo, RecentFoodLogInfo } from '../services/database';
import { COLORS, FONTS } from '../constants/theme';

export interface FoodSearchModalProps {
  visible: boolean;
  onClose: () => void;
  onSelectFood: (food: FoodItem) => void;
}

export const FoodSearchModal: React.FC<FoodSearchModalProps> = ({
  visible,
  onClose,
  onSelectFood,
}) => {
  const { t, i18n } = useTranslation();
  const [activeTab, setActiveTab] = useState<'SEARCH' | 'CUSTOM'>('SEARCH');

  // Search Tab state
  const [searchQuery, setSearchQuery] = useState('');
  const [results, setResults] = useState<FoodItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [barcodeInput, setBarcodeInput] = useState('');

  // Custom Food & OCR Camera state
  const [name, setName] = useState('');
  const [brand, setBrand] = useState('');
  const [servingName, setServingName] = useState('');
  const [servingWeightG, setServingWeightG] = useState('100');
  const [calories100g, setCalories100g] = useState('');
  const [protein100g, setProtein100g] = useState('');
  const [carbs100g, setCarbs100g] = useState('');
  const [fat100g, setFat100g] = useState('');
  const [ocrText, setOcrText] = useState('');
  const [ocrStatus, setOcrStatus] = useState<string | null>(null);

  // Native Expo Camera & ML Kit state
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [cameraMode, setCameraMode] = useState<'BARCODE' | 'OCR'>('BARCODE');
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [cameraFlash, setCameraFlash] = useState(false);
  const [isScanning, setIsScanning] = useState(false);

  const cameraRef = useRef<any>(null);
  const isProcessingBarcode = useRef(false);

  const searchRequestIdRef = useRef(0);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const latestQueryRef = useRef('');

  const clearDebounceTimer = () => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
  };

  // Reset state when modal visibility toggles off
  useEffect(() => {
    if (!visible) {
      clearDebounceTimer();
      latestQueryRef.current = '';
      setSearchQuery('');
      setResults([]);
      setLoading(false);
      setBarcodeInput('');
      setIsCameraActive(false);
      setIsScanning(false);
      setCameraFlash(false);
      isProcessingBarcode.current = false;
    }
  }, [visible]);

  const performSearch = useCallback(
    async (queryToSearch: string) => {
      clearDebounceTimer();
      const q = (queryToSearch !== undefined ? queryToSearch : latestQueryRef.current).trim();
      if (q.length < 3) {
        setResults([]);
        setLoading(false);
        return;
      }

      const requestId = ++searchRequestIdRef.current;
      setLoading(true);

      try {
        const deviceLocale = getDeviceLocaleInfo();
        const activeLang = i18n.language || deviceLocale.language;

        // Search local foods first
        const localMatches = await searchLocalFoods(q);
        // Search CIQUAL offline foods dataset
        const ciqualMatches = searchCiqualFoods(q);
        // Search Swiss DB offline foods dataset
        const swissMatches = searchSwissFoods(q);
        // Search Fineli offline foods dataset (low priority)
        const fineliMatches = searchFineliFoods(q);
        // Search OFF API with regional prioritization based on active language/locale
        const offMatches = await searchProductsOFF(q, deviceLocale.country, activeLang);

        // Fetch recent food log history for recency sorting
        const logInfo = await getRecentFoodLogInfo();

        // Only update state if this request is still the latest one
        if (requestId === searchRequestIdRef.current) {
          const existingLocalIds = new Set(localMatches.map((f) => f.id));
          const filteredCiqual = ciqualMatches.filter((f) => !existingLocalIds.has(f.id));

          const existingIds1 = new Set([
            ...existingLocalIds,
            ...filteredCiqual.map((f) => f.id),
          ]);
          const filteredSwiss = swissMatches.filter((f) => !existingIds1.has(f.id));

          const existingIds2 = new Set([
            ...existingIds1,
            ...filteredSwiss.map((f) => f.id),
          ]);
          const filteredFineli = fineliMatches.filter((f) => !existingIds2.has(f.id));

          const existingBarcodes = new Set([
            ...localMatches.map((f) => f.barcode).filter(Boolean),
            ...filteredCiqual.map((f) => f.barcode).filter(Boolean),
            ...filteredSwiss.map((f) => f.barcode).filter(Boolean),
            ...filteredFineli.map((f) => f.barcode).filter(Boolean),
          ]);
          const filteredOff = offMatches.filter((f) => !f.barcode || !existingBarcodes.has(f.barcode));

          const merged = [...localMatches, ...filteredCiqual, ...filteredSwiss, ...filteredFineli, ...filteredOff];
          const sortedMerged = sortMergedResults(merged, q, activeLang, deviceLocale.country, logInfo);

          setResults(sortedMerged);
        }
      } catch (err) {
        console.warn('Search failed:', err);
      } finally {
        if (requestId === searchRequestIdRef.current) {
          setLoading(false);
        }
      }
    },
    [i18n.language]
  );

  // Debounced search on type starting at 3 characters
  useEffect(() => {
    const trimmedQuery = searchQuery.trim();
    if (trimmedQuery.length < 3) {
      searchRequestIdRef.current++;
      clearDebounceTimer();
      setResults([]);
      setLoading(false);
      return;
    }

    clearDebounceTimer();
    debounceTimerRef.current = setTimeout(() => {
      performSearch(trimmedQuery);
    }, 350);

    return () => {
      clearDebounceTimer();
    };
  }, [searchQuery, performSearch]);

  const handleSearch = (explicitQuery?: string) => {
    clearDebounceTimer();
    const queryToUse = typeof explicitQuery === 'string' ? explicitQuery : latestQueryRef.current;
    performSearch(queryToUse);
  };

  const handleOpenCamera = async (mode: 'BARCODE' | 'OCR') => {
    setCameraMode(mode);
    setIsCameraActive(true);
    isProcessingBarcode.current = false;

    if (!cameraPermission?.granted) {
      try {
        await requestCameraPermission();
      } catch (err) {
        console.warn('Camera permission request error:', err);
      }
    }
  };

  const handleBarcodeScanned = async (codeData: string) => {
    if (isProcessingBarcode.current || !codeData) return;
    isProcessingBarcode.current = true;
    setBarcodeInput(codeData);
    setIsCameraActive(false);
    setLoading(true);

    try {
      const product = await fetchProductByBarcode(codeData);
      if (product) {
        await saveFoodItem(product);
        onSelectFood(product);
        onClose();
      } else {
        alert(`No product found for barcode: ${codeData}`);
      }
    } catch (err) {
      alert('Barcode lookup failed.');
    } finally {
      setLoading(false);
      isProcessingBarcode.current = false;
    }
  };

  const handleBarcodeLookup = async () => {
    const code = barcodeInput.trim();
    if (!code) return;
    setLoading(true);

    try {
      const product = await fetchProductByBarcode(code);
      if (product) {
        await saveFoodItem(product);
        onSelectFood(product);
        onClose();
      } else {
        alert(`No product found for barcode: ${code}`);
      }
    } catch (err) {
      alert('Barcode lookup failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleRunOCR = (overrideText?: string) => {
    const textToUse = overrideText !== undefined ? overrideText : ocrText;
    if (!textToUse.trim()) {
      handleOpenCamera('OCR');
      return;
    }

    const lines = textToUse.split('\n');
    const parsed = parseNutritionText(lines);

    let foundCount = 0;
    if (parsed.calories !== null) {
      setCalories100g(parsed.calories.toString());
      foundCount++;
    }
    if (parsed.protein !== null) {
      setProtein100g(parsed.protein.toString());
      foundCount++;
    }
    if (parsed.carbs !== null) {
      setCarbs100g(parsed.carbs.toString());
      foundCount++;
    }
    if (parsed.fat !== null) {
      setFat100g(parsed.fat.toString());
      foundCount++;
    }

    setOcrStatus(
      foundCount > 0
        ? `Successfully extracted ${foundCount} nutrient values via OCR!`
        : 'Could not extract nutrition values. Please double-check formatting or try camera scan.'
    );
  };

  const handleSnapPhoto = async () => {
    if (cameraRef.current && typeof cameraRef.current.takePictureAsync === 'function') {
      try {
        setIsScanning(true);
        const photo = await cameraRef.current.takePictureAsync({ quality: 0.8 });
        if (photo?.uri) {
          const text = await recognizeTextFromImage(photo.uri);
          if (text.trim()) {
            setOcrText(text);
            handleRunOCR(text);
          } else {
            setOcrStatus('Could not read any text from this image. Please try again or enter the values manually.');
          }
        }
      } catch (err) {
        console.warn('Failed to take picture or process OCR:', err);
        setOcrStatus('Could not process this image. Please try again or enter the values manually.');
      } finally {
        setIsScanning(false);
        setIsCameraActive(false);
      }
    } else {
      setOcrStatus('Camera is unavailable. Please enter the values manually.');
      setIsCameraActive(false);
    }
  };

  const handleSaveCustomFood = async () => {
    if (!name.trim()) {
      alert('Please enter a food name');
      return;
    }

    const servingG = parseFloat(servingWeightG) || 100;
    const sName = servingName.trim();

    const customItem: FoodItem = {
      id: `custom_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      name: name.trim(),
      brand: brand.trim() || 'Custom',
      servingSizeG: servingG,
      servingName: sName || (servingG !== 100 ? `1 portion (${servingG}g)` : undefined),
      calories100g: parseFloat(calories100g) || 0,
      proteins100g: parseFloat(protein100g) || 0,
      carbs100g: parseFloat(carbs100g) || 0,
      fats100g: parseFloat(fat100g) || 0,
      source: ocrText ? 'OCR_CUSTOM' : 'MANUAL',
      createdAt: Date.now(),
    };

    await saveFoodItem(customItem);
    onSelectFood(customItem);
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent={false} onRequestClose={onClose}>
      <SafeAreaView style={styles.container}>
        {/* Modal Header */}
        <View style={styles.header}>
          <Text style={styles.title}>{t('foodSearch.title')}</Text>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
            <Text style={styles.closeBtnText}>✕</Text>
          </TouchableOpacity>
        </View>

        {/* Navigation Tabs */}
        <View style={styles.tabsRow}>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'SEARCH' && styles.activeTab]}
            onPress={() => setActiveTab('SEARCH')}
          >
            <Text style={[styles.tabText, activeTab === 'SEARCH' && styles.activeTabText]}>
              🔍 {t('foodSearch.all')} & {t('foodSearch.scanBarcode')}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tab, activeTab === 'CUSTOM' && styles.activeTab]}
            onPress={() => setActiveTab('CUSTOM')}
          >
            <Text style={[styles.tabText, activeTab === 'CUSTOM' && styles.activeTabText]}>
              📷 {t('foodSearch.custom')} & {t('foodSearch.scanOcr')}
            </Text>
          </TouchableOpacity>
        </View>

        {activeTab === 'SEARCH' ? (
          <View style={styles.tabContent}>
            {/* Search Input */}
            <View style={styles.searchBoxContainer}>
              <TextInput
                style={styles.searchInput}
                placeholder={t('foodSearch.searchPlaceholder')}
                placeholderTextColor="#64748B"
                value={searchQuery}
                onChangeText={(text) => {
                  latestQueryRef.current = text;
                  setSearchQuery(text);
                }}
                onSubmitEditing={(e) => handleSearch(e.nativeEvent.text)}
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="search"
              />
              <TouchableOpacity style={styles.searchBtn} onPress={() => handleSearch(latestQueryRef.current)}>
                <Text style={styles.searchBtnText}>🔍</Text>
              </TouchableOpacity>
            </View>

            {/* Primary Live Camera Barcode Action */}
            <TouchableOpacity
              style={styles.barcodeCameraBanner}
              onPress={() => handleOpenCamera('BARCODE')}
            >
              <Text style={styles.barcodeCameraBannerIcon}>📷</Text>
              <View style={styles.barcodeCameraBannerTextContainer}>
                <Text style={styles.barcodeCameraBannerTitle}>Scan Barcode with Camera</Text>
                <Text style={styles.barcodeCameraBannerSub}>Scan product package barcode automatically</Text>
              </View>
              <Text style={styles.barcodeCameraBannerArrow}>›</Text>
            </TouchableOpacity>

            {/* Manual Barcode Code Lookup Fallback */}
            <View style={styles.barcodeBox}>
              <TextInput
                style={styles.barcodeInput}
                placeholder="Or type barcode number manually..."
                placeholderTextColor="#64748B"
                value={barcodeInput}
                onChangeText={setBarcodeInput}
                keyboardType="numeric"
              />
              <TouchableOpacity style={styles.barcodeBtn} onPress={handleBarcodeLookup}>
                <Text style={styles.barcodeBtnText}>Lookup Code</Text>
              </TouchableOpacity>
            </View>

            {loading && <ActivityIndicator size="large" color={COLORS.primary} style={{ marginVertical: 20 }} />}

            {/* Results List */}
            <ScrollView style={styles.resultsList} contentContainerStyle={{ paddingBottom: 40 }}>
              {results.map((item) => (
                <TouchableOpacity
                  key={item.id}
                  style={styles.foodCard}
                  onPress={() => {
                    saveFoodItem(item);
                    onSelectFood(item);
                    onClose();
                  }}
                >
                  <View style={styles.foodCardMain}>
                    <View style={styles.foodTitleRow}>
                      <Text style={styles.foodName}>{item.name}</Text>
                      {item.source === 'CIQUAL' && (
                        <View style={styles.ciqualBadge}>
                          <Text style={styles.ciqualBadgeText}>🇫🇷 {t('foodSearch.sourceCiqual')}</Text>
                        </View>
                      )}
                      {item.source === 'SWISS' && (
                        <View style={styles.swissBadge}>
                          <Text style={styles.swissBadgeText}>🇨🇭 {t('foodSearch.sourceSwiss')}</Text>
                        </View>
                      )}
                      {item.source === 'FINELI' && (
                        <View style={styles.fineliBadge}>
                          <Text style={styles.fineliBadgeText}>🇫🇮 {t('foodSearch.sourceFineli')}</Text>
                        </View>
                      )}
                    </View>
                    <Text style={styles.foodBrand}>
                      {item.source === 'CIQUAL'
                        ? 'CIQUAL (Base de données FR)'
                        : item.source === 'SWISS'
                        ? item.brand || 'Swiss DB'
                        : item.source === 'FINELI'
                        ? 'Fineli (FI/EN)'
                        : item.brand || 'Generic'}
                    </Text>
                    <Text style={styles.foodMacros}>
                      {t('foodSearch.per100g')}: {t('mealBreakdown.proteinShort')}: {item.proteins100g}g | {t('mealBreakdown.carbsShort')}: {item.carbs100g}g | {t('mealBreakdown.fatShort')}: {item.fats100g}g
                    </Text>
                  </View>
                  <View style={styles.foodCardRight}>
                    <Text style={styles.foodCal}>{item.calories100g} kcal</Text>
                    <Text style={styles.selectText}>Select ›</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        ) : (
          <ScrollView style={styles.tabContent} contentContainerStyle={{ paddingBottom: 40 }}>
            {/* Custom OCR Section */}
            <View style={styles.ocrSection}>
              <Text style={styles.ocrTitle}>{t('foodSearch.ocrTitle')}</Text>
              <Text style={styles.ocrSubtext}>
                {t('foodSearch.ocrInstruction')}
              </Text>

              <TouchableOpacity
                style={styles.openCameraBtn}
                onPress={() => handleOpenCamera('OCR')}
              >
                <Text style={styles.openCameraBtnText}>{t('foodSearch.openCamera')}</Text>
              </TouchableOpacity>

              <TextInput
                style={styles.ocrTextArea}
                multiline
                numberOfLines={4}
                placeholder={`Example text:\nVALEUR NUTRITIONNELLE 100g\nÉnergie: 450 kcal\nProtéines: 12.5 g\nGlucides: 55 g\nLipides: 18 g`}
                placeholderTextColor="#64748B"
                value={ocrText}
                onChangeText={setOcrText}
              />
              <TouchableOpacity style={styles.ocrBtn} onPress={() => handleRunOCR()}>
                <Text style={styles.ocrBtnText}>{t('foodSearch.captureBtn')}</Text>
              </TouchableOpacity>
              {ocrStatus && <Text style={styles.ocrStatusText}>{ocrStatus}</Text>}
            </View>

            {/* Form Fields */}
            <View style={styles.formSection}>
              <Text style={styles.formTitle}>Food Information ({t('foodSearch.per100g')})</Text>

              <Text style={styles.label}>Product Name *</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. Organic Almond Butter"
                placeholderTextColor="#64748B"
                value={name}
                onChangeText={setName}
              />

              <Text style={styles.label}>Brand</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. Kirkland Signature"
                placeholderTextColor="#64748B"
                value={brand}
                onChangeText={setBrand}
              />

              <View style={styles.gridRow}>
                <View style={styles.gridCol}>
                  <Text style={styles.label}>Portion Name (optional)</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="e.g. 1 slice, 1 glass"
                    placeholderTextColor="#64748B"
                    value={servingName}
                    onChangeText={setServingName}
                  />
                </View>
                <View style={styles.gridCol}>
                  <Text style={styles.label}>Portion Weight (g)</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="100"
                    placeholderTextColor="#64748B"
                    keyboardType="numeric"
                    value={servingWeightG}
                    onChangeText={setServingWeightG}
                  />
                </View>
              </View>

              <View style={styles.gridRow}>
                <View style={styles.gridCol}>
                  <Text style={styles.label}>{t('logMeal.calories')} (kcal)</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="0"
                    placeholderTextColor="#64748B"
                    keyboardType="numeric"
                    value={calories100g}
                    onChangeText={setCalories100g}
                  />
                </View>
                <View style={styles.gridCol}>
                  <Text style={styles.label}>{t('macroProgress.protein')} (g)</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="0"
                    placeholderTextColor="#64748B"
                    keyboardType="numeric"
                    value={protein100g}
                    onChangeText={setProtein100g}
                  />
                </View>
              </View>

              <View style={styles.gridRow}>
                <View style={styles.gridCol}>
                  <Text style={styles.label}>{t('macroProgress.carbs')} (g)</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="0"
                    placeholderTextColor="#64748B"
                    keyboardType="numeric"
                    value={carbs100g}
                    onChangeText={setCarbs100g}
                  />
                </View>
                <View style={styles.gridCol}>
                  <Text style={styles.label}>{t('macroProgress.fat')} (g)</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="0"
                    placeholderTextColor="#64748B"
                    keyboardType="numeric"
                    value={fat100g}
                    onChangeText={setFat100g}
                  />
                </View>
              </View>

              <TouchableOpacity style={styles.saveCustomBtn} onPress={handleSaveCustomFood}>
                <Text style={styles.saveCustomBtnText}>Save Food & Log Meal</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        )}
      </SafeAreaView>

      {/* Camera Viewfinder Modal */}
      {isCameraActive && (
        <Modal visible={isCameraActive} animationType="slide" transparent={false} onRequestClose={() => setIsCameraActive(false)}>
          <SafeAreaView style={styles.cameraContainer}>
            {/* Camera Header */}
            <View style={styles.cameraHeader}>
              <TouchableOpacity onPress={() => setIsCameraActive(false)} style={styles.cameraBackBtn}>
                <Text style={styles.cameraBackBtnText}>✕ Close</Text>
              </TouchableOpacity>
              <Text style={styles.cameraHeaderTitle}>
                {cameraMode === 'BARCODE' ? 'Scan Product Barcode' : t('foodSearch.cameraTitle')}
              </Text>
              <TouchableOpacity onPress={() => setCameraFlash(!cameraFlash)} style={styles.cameraFlashBtn}>
                <Text style={styles.cameraFlashBtnText}>
                  {cameraFlash ? t('foodSearch.flashOn') : t('foodSearch.flashOff')}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Viewfinder / Live Camera Feed or Permission Prompt */}
            {!cameraPermission?.granted ? (
              <View style={styles.permissionBox}>
                <Text style={styles.permissionIcon}>📷</Text>
                <Text style={styles.permissionTitle}>Camera Permission Required</Text>
                <Text style={styles.permissionSubtext}>
                  Joules needs access to your camera to scan barcodes and nutrition labels.
                </Text>
                <TouchableOpacity
                  style={styles.grantPermissionBtn}
                  onPress={() => requestCameraPermission()}
                >
                  <Text style={styles.grantPermissionBtnText}>Grant Camera Permission</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.viewfinderContainer}>
                <CameraView
                  ref={cameraRef}
                  style={StyleSheet.absoluteFill}
                  enableTorch={cameraFlash}
                  barcodeScannerSettings={
                    cameraMode === 'BARCODE'
                      ? { barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e', 'qr', 'code128', 'code39'] }
                      : undefined
                  }
                  onBarcodeScanned={
                    cameraMode === 'BARCODE'
                      ? (result) => handleBarcodeScanned(result.data)
                      : undefined
                  }
                />

                <View style={[styles.viewfinderFrame, cameraFlash && styles.viewfinderFrameFlash]}>
                  {/* Corner markers */}
                  <View style={[styles.corner, styles.topLeftCorner]} />
                  <View style={[styles.corner, styles.topRightCorner]} />
                  <View style={[styles.corner, styles.bottomLeftCorner]} />
                  <View style={[styles.corner, styles.bottomRightCorner]} />

                  <View style={styles.viewfinderCenter}>
                    <Text style={styles.viewfinderInstruction}>
                      {cameraMode === 'BARCODE'
                        ? 'Position barcode inside frame'
                        : t('foodSearch.alignLabel')}
                    </Text>
                    <View style={styles.scanLine} />
                  </View>
                </View>

              </View>
            )}

            {/* Shutter Footer (for OCR mode) or Status text (for Barcode mode) */}
            {cameraPermission?.granted && (
              <View style={styles.cameraFooter}>
                {cameraMode === 'OCR' ? (
                  <>
                    <TouchableOpacity
                      style={styles.shutterBtn}
                      onPress={() => handleSnapPhoto()}
                      disabled={isScanning}
                    >
                      {isScanning ? (
                        <ActivityIndicator color="#0F172A" size="large" />
                      ) : (
                        <View style={styles.shutterInner} />
                      )}
                    </TouchableOpacity>
                    <Text style={styles.shutterText}>{t('foodSearch.snapPhoto')}</Text>
                  </>
                ) : (
                  <Text style={styles.shutterText}>Scanning barcode automatically...</Text>
                )}
              </View>
            )}
          </SafeAreaView>
        </Modal>
      )}
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bgBackground,
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 24) + 12 : 12,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  title: {
    color: COLORS.textPrimary,
    fontSize: 20,
    fontWeight: '800',
    fontFamily: FONTS.extraBold,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.cardBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtnText: {
    color: COLORS.textSecondary,
    fontSize: 16,
    fontWeight: 'bold',
    fontFamily: FONTS.bold,
  },
  tabsRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    marginBottom: 16,
    gap: 8,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    backgroundColor: COLORS.cardBg,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  activeTab: {
    backgroundColor: COLORS.primaryDark,
    borderColor: COLORS.primary,
  },
  tabText: {
    color: COLORS.textSecondary,
    fontSize: 12,
    fontWeight: '700',
    fontFamily: FONTS.bold,
  },
  activeTabText: {
    color: '#FFFFFF',
  },
  tabContent: {
    flex: 1,
    paddingHorizontal: 16,
  },
  searchBoxContainer: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12,
  },
  searchInput: {
    flex: 1,
    backgroundColor: COLORS.cardBg,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: COLORS.textPrimary,
    fontFamily: FONTS.medium,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  searchBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    paddingHorizontal: 16,
    justifyContent: 'center',
  },
  searchBtnText: {
    color: '#0F172A',
    fontWeight: '700',
    fontFamily: FONTS.bold,
  },
  barcodeBox: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
  },
  barcodeInput: {
    flex: 1,
    backgroundColor: COLORS.cardBg,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    color: COLORS.textPrimary,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    fontSize: 13,
    fontFamily: FONTS.medium,
  },
  barcodeBtn: {
    backgroundColor: COLORS.cardBorder,
    borderRadius: 12,
    paddingHorizontal: 14,
    justifyContent: 'center',
  },
  barcodeBtnText: {
    color: COLORS.primary,
    fontWeight: '700',
    fontFamily: FONTS.bold,
    fontSize: 12,
  },
  barcodeCameraBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.primaryDark,
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1.5,
    borderColor: COLORS.primary,
  },
  barcodeCameraBannerIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  barcodeCameraBannerTextContainer: {
    flex: 1,
  },
  barcodeCameraBannerTitle: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
    fontFamily: FONTS.extraBold,
  },
  barcodeCameraBannerSub: {
    color: COLORS.textSecondary,
    fontSize: 12,
    fontFamily: FONTS.regular,
    marginTop: 2,
  },
  barcodeCameraBannerArrow: {
    color: COLORS.primary,
    fontSize: 22,
    fontWeight: '700',
    marginLeft: 8,
  },
  resultsList: {
    flex: 1,
  },
  foodCard: {
    backgroundColor: COLORS.cardBg,
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  foodCardMain: {
    flex: 1,
    paddingRight: 10,
  },
  foodName: {
    color: COLORS.textPrimary,
    fontSize: 15,
    fontWeight: '700',
    fontFamily: FONTS.bold,
  },
  foodBrand: {
    color: COLORS.primary,
    fontSize: 12,
    fontFamily: FONTS.medium,
    marginTop: 2,
  },
  foodMacros: {
    color: COLORS.textSecondary,
    fontSize: 11,
    fontFamily: FONTS.regular,
    marginTop: 4,
  },
  foodCardRight: {
    alignItems: 'flex-end',
  },
  foodCal: {
    color: COLORS.primary,
    fontSize: 15,
    fontWeight: '800',
    fontFamily: FONTS.extraBold,
  },
  selectText: {
    color: COLORS.primary,
    fontSize: 12,
    fontWeight: '600',
    fontFamily: FONTS.semibold,
    marginTop: 4,
  },
  ocrSection: {
    backgroundColor: COLORS.cardBg,
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  ocrTitle: {
    color: COLORS.primary,
    fontSize: 14,
    fontWeight: '800',
    fontFamily: FONTS.extraBold,
  },
  ocrSubtext: {
    color: COLORS.textSecondary,
    fontSize: 12,
    fontFamily: FONTS.regular,
    marginVertical: 6,
  },
  ocrTextArea: {
    backgroundColor: COLORS.bgBackground,
    borderRadius: 10,
    padding: 12,
    color: COLORS.textPrimary,
    fontSize: 12,
    fontFamily: FONTS.regular,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    textAlignVertical: 'top',
    height: 100,
  },
  ocrBtn: {
    marginTop: 10,
    backgroundColor: COLORS.primaryDark,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  ocrBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontFamily: FONTS.bold,
    fontSize: 13,
  },
  ocrStatusText: {
    color: COLORS.successLight,
    fontSize: 12,
    marginTop: 8,
    fontStyle: 'italic',
    fontFamily: FONTS.regular,
  },
  formSection: {
    backgroundColor: COLORS.cardBg,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  formTitle: {
    color: COLORS.textPrimary,
    fontSize: 15,
    fontWeight: '700',
    fontFamily: FONTS.bold,
    marginBottom: 14,
  },
  label: {
    color: COLORS.textSecondary,
    fontSize: 12,
    fontWeight: '600',
    fontFamily: FONTS.semibold,
    marginBottom: 6,
  },
  input: {
    backgroundColor: COLORS.bgBackground,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: COLORS.textPrimary,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    marginBottom: 12,
    fontFamily: FONTS.medium,
  },
  gridRow: {
    flexDirection: 'row',
    gap: 12,
  },
  gridCol: {
    flex: 1,
  },
  openCameraBtn: {
    backgroundColor: COLORS.primaryDark,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    marginVertical: 10,
    borderWidth: 1,
    borderColor: COLORS.primary,
  },
  openCameraBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
    fontFamily: FONTS.extraBold,
  },
  saveCustomBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 12,
  },
  saveCustomBtnText: {
    color: '#0F172A',
    fontSize: 15,
    fontWeight: '800',
    fontFamily: FONTS.extraBold,
  },
  // Camera Viewfinder Styles
  cameraContainer: {
    flex: 1,
    backgroundColor: COLORS.bgBackground,
  },
  cameraHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: COLORS.bgBackground,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.cardBg,
  },
  cameraBackBtn: {
    padding: 6,
  },
  cameraBackBtnText: {
    color: COLORS.textPrimary,
    fontSize: 14,
    fontWeight: '700',
    fontFamily: FONTS.bold,
  },
  cameraHeaderTitle: {
    color: COLORS.primary,
    fontSize: 16,
    fontWeight: '800',
    fontFamily: FONTS.extraBold,
  },
  cameraFlashBtn: {
    backgroundColor: COLORS.cardBg,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  cameraFlashBtnText: {
    color: COLORS.textPrimary,
    fontSize: 12,
    fontWeight: '600',
    fontFamily: FONTS.semibold,
  },
  permissionBox: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 30,
    backgroundColor: COLORS.bgBackground,
  },
  permissionIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  permissionTitle: {
    color: COLORS.textPrimary,
    fontSize: 18,
    fontWeight: '800',
    fontFamily: FONTS.extraBold,
    textAlign: 'center',
    marginBottom: 8,
  },
  permissionSubtext: {
    color: COLORS.textSecondary,
    fontSize: 14,
    fontFamily: FONTS.regular,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 20,
  },
  grantPermissionBtn: {
    backgroundColor: COLORS.primary,
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
  },
  grantPermissionBtnText: {
    color: '#0F172A',
    fontSize: 15,
    fontWeight: '800',
    fontFamily: FONTS.extraBold,
  },
  viewfinderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  viewfinderFrame: {
    width: 280,
    height: 260,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  viewfinderFrameFlash: {
    backgroundColor: COLORS.primaryMuted,
    borderColor: COLORS.primary,
  },
  corner: {
    position: 'absolute',
    width: 24,
    height: 24,
    borderColor: COLORS.primary,
  },
  topLeftCorner: {
    top: 0,
    left: 0,
    borderTopWidth: 4,
    borderLeftWidth: 4,
    borderTopLeftRadius: 8,
  },
  topRightCorner: {
    top: 0,
    right: 0,
    borderTopWidth: 4,
    borderRightWidth: 4,
    borderTopRightRadius: 8,
  },
  bottomLeftCorner: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 4,
    borderLeftWidth: 4,
    borderBottomLeftRadius: 8,
  },
  bottomRightCorner: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 4,
    borderRightWidth: 4,
    borderBottomRightRadius: 8,
  },
  viewfinderCenter: {
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  viewfinderInstruction: {
    color: COLORS.textPrimary,
    fontSize: 13,
    fontWeight: '600',
    fontFamily: FONTS.semibold,
    textAlign: 'center',
    marginBottom: 16,
  },
  scanLine: {
    width: 220,
    height: 2,
    backgroundColor: COLORS.primary,
    shadowColor: COLORS.primary,
    shadowRadius: 6,
    shadowOpacity: 0.9,
  },
  cameraFooter: {
    backgroundColor: COLORS.bgBackground,
    paddingVertical: 24,
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: COLORS.cardBg,
  },
  shutterBtn: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 4,
    borderColor: COLORS.textPrimary,
    backgroundColor: COLORS.primaryDark,
    justifyContent: 'center',
    alignItems: 'center',
  },
  shutterInner: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#F8FAFC',
  },
  shutterText: {
    color: '#F8FAFC',
    fontSize: 13,
    fontWeight: '700',
    marginTop: 10,
  },
  foodTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  ciqualBadge: {
    backgroundColor: '#0284C7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  ciqualBadgeText: {
    color: '#F8FAFC',
    fontSize: 10,
    fontWeight: '700',
  },
  swissBadge: {
    backgroundColor: '#DC2626',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  swissBadgeText: {
    color: '#F8FAFC',
    fontSize: 10,
    fontWeight: '700',
  },
  fineliBadge: {
    backgroundColor: '#0D9488',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  fineliBadgeText: {
    color: '#F8FAFC',
    fontSize: 10,
    fontWeight: '700',
  },
});

export function getFoodLastLoggedAt(
  item: FoodItem,
  logInfo?: RecentFoodLogInfo
): number {
  if (!logInfo) {
    return item.isAdded ? (item.addedAt || 1) : 0;
  }
  let maxTime = 0;
  if (item.id && logInfo.byFoodId?.has(item.id)) {
    maxTime = Math.max(maxTime, logInfo.byFoodId.get(item.id)!);
  }
  if (item.barcode && logInfo.byBarcode?.has(item.barcode)) {
    maxTime = Math.max(maxTime, logInfo.byBarcode.get(item.barcode)!);
  }
  if (item.name) {
    const normName = item.name.toLowerCase().trim();
    if (logInfo.byNameKey?.has(normName)) {
      maxTime = Math.max(maxTime, logInfo.byNameKey.get(normName)!);
    }
  }
  if (maxTime === 0 && item.isAdded) {
    maxTime = item.addedAt || 1;
  }
  return maxTime;
}

export function sortMergedResults(
  items: FoodItem[],
  query: string,
  activeLanguage?: string,
  country?: string,
  logInfo?: RecentFoodLogInfo
): FoodItem[] {
  // Filter out Health Connect dummy cards
  const validItems = items.filter(
    (item) => item.brand !== 'Health Connect' && !item.id.startsWith('hc_food_')
  );

  const queryWords = getSearchWords(query);

  return [...validItems].sort((a, b) => {
    const lastLoggedA = getFoodLastLoggedAt(a, logInfo);
    const lastLoggedB = getFoodLastLoggedAt(b, logInfo);

    const isLoggedA = lastLoggedA > 0;
    const isLoggedB = lastLoggedB > 0;

    if (isLoggedA && !isLoggedB) return -1;
    if (!isLoggedA && isLoggedB) return 1;

    if (isLoggedA && isLoggedB) {
      if (lastLoggedA !== lastLoggedB) {
        return lastLoggedB - lastLoggedA; // most recent first
      }
    }

    const scoreA = getFoodItemScore(a, queryWords, activeLanguage, country);
    const scoreB = getFoodItemScore(b, queryWords, activeLanguage, country);
    return scoreB - scoreA;
  });
}

function normalizeSearchText(str: string): string {
  return (str || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    // Keep contractions as one word: "Harry's" and "Harrys" should match.
    .replace(/['’]/g, '')
    .replace(/["\-.,\/#!$%\^&\*;:{}=\-_`~()]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function getSearchWords(value: string | readonly string[]): string[] {
  const text = typeof value === 'string' ? value : value.join(' ');
  return normalizeSearchText(text).split(/\s+/).filter(Boolean);
}

function getSourceModifier(item: FoodItem, activeLanguage?: string, country?: string): number {
  const lang = (activeLanguage || 'fr').toLowerCase();
  const cntry = (country || 'fr').toLowerCase();

  if (item.isAdded || item.source === 'MANUAL' || item.source === 'OCR_CUSTOM') {
    return 20;
  }
  if (item.source === 'OFF_API') {
    return 13 + (lang.startsWith('fr') || cntry === 'fr' ? 2 : 0);
  }
  if (item.source === 'CIQUAL') {
    return 6 + (cntry === 'fr' ? 3 : 0) + (lang.startsWith('fr') ? 2 : 0);
  }
  if (item.source === 'SWISS') {
    return 6 + (cntry === 'ch' ? 3 : 0)
      + (lang.startsWith('de') || lang.startsWith('it') || lang.startsWith('fr') || lang.startsWith('en') ? 2 : 0);
  }
  if (item.source === 'FINELI') {
    return 6 + (cntry === 'fi' ? 3 : 0) + (lang.startsWith('fi') ? 2 : 0);
  }
  return 0;
}

const SEARCH_STOP_WORDS = new Set([
  'de', 'd', 'l', 'la', 'le', 'du', 'des', 'un', 'une', 'au', 'aux', 'et', 'en',
  'of', 'and', 'the', 'in', 'with', 'a', 'to', 'for'
]);

export function getFoodItemScore(
  item: FoodItem,
  query: string | readonly string[],
  activeLanguage?: string,
  country?: string
): number {
  const queryWords = getSearchWords(query);
  const nameWords = getSearchWords(item.name || '');
  const brandWords = getSearchWords(item.brand || '');

  // Filter out stop words for brand matching to avoid false brand matches on words like 'de'
  const contentQueryWords = queryWords.filter((w) => !SEARCH_STOP_WORDS.has(w));
  const brandCheckWords = contentQueryWords.length > 0 ? contentQueryWords : queryWords;

  // Exact token matching prevents a query such as "ham" from matching
  // unrelated name tokens such as "champignon".
  const matchingNameWordCount = queryWords.filter((word) => nameWords.includes(word)).length;
  const matchingBrandWordCount = brandCheckWords.filter((word) => brandWords.includes(word)).length;

  // Name and brand are both direct search intent signals. Brand matching is given
  // a strong weight (250 points per matching word) so brand intent takes priority.
  return matchingNameWordCount * 100
    + matchingBrandWordCount * 250
    + getSourceModifier(item, activeLanguage, country);
}
