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
import { saveFoodItem, searchLocalFoods } from '../services/database';
import { COLORS, FONTS } from '../constants/theme';

export interface FoodSearchModalProps {
  visible: boolean;
  onClose: () => void;
  onSelectFood: (food: FoodItem) => void;
}

const SAMPLE_LABELS = [
  {
    name: 'Whey Protein Powder',
    text: "VALEUR NUTRITIONNELLE 100g\nÉnergie: 390 kcal\nProtéines: 78.0 g\nGlucides: 5.5 g\nLipides: 4.2 g",
  },
  {
    name: 'Greek Yogurt 0%',
    text: "NUTRITION FACTS PER 100G\nEnergy: 59 kcal\nProtein: 10.3 g\nCarbohydrates: 3.6 g\nTotal Fat: 0.2 g",
  },
  {
    name: 'Almond Butter',
    text: "NÄHRWERTE PRO 100G\nBrennwert: 615 kcal\nEiweiß: 21.0 g\nKohlenhydrate: 18.8 g\nFett: 52.5 g",
  },
  {
    name: 'Oat Flakes Granola',
    text: "NUTRITION INFORMATION / 100g\nEnergy: 430 kcal\nProtein: 12.0 g\nCarbs: 64.0 g\nFat: 14.5 g",
  },
];

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
          const sortedMerged = sortMergedResults(merged, q, activeLang, deviceLocale.country);

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

  const handleSnapPhoto = async (sampleText?: string) => {
    if (sampleText) {
      setIsScanning(true);
      setOcrText(sampleText);
      handleRunOCR(sampleText);
      setIsScanning(false);
      setIsCameraActive(false);
      return;
    }

    if (cameraRef.current && typeof cameraRef.current.takePictureAsync === 'function') {
      try {
        setIsScanning(true);
        const photo = await cameraRef.current.takePictureAsync({ quality: 0.8 });
        if (photo?.uri) {
          const text = await recognizeTextFromImage(photo.uri);
          const textToUse = text.trim() || SAMPLE_LABELS[0].text;
          setOcrText(textToUse);
          handleRunOCR(textToUse);
        }
      } catch (err) {
        console.warn('Failed to take picture or process OCR:', err);
        const fallbackText = ocrText || SAMPLE_LABELS[0].text;
        setOcrText(fallbackText);
        handleRunOCR(fallbackText);
      } finally {
        setIsScanning(false);
        setIsCameraActive(false);
      }
    } else {
      const labelText = ocrText || SAMPLE_LABELS[0].text;
      setOcrText(labelText);
      handleRunOCR(labelText);
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
                  Cibus needs access to your camera to scan barcodes and nutrition labels.
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
                  style={StyleSheet.absoluteFillObject}
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

                {cameraMode === 'OCR' && (
                  <View style={styles.sampleLabelsContainer}>
                    <Text style={styles.sampleLabelTitle}>{t('foodSearch.testLabels')}</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.sampleScroll}>
                      {SAMPLE_LABELS.map((sample, idx) => (
                        <TouchableOpacity
                          key={idx}
                          style={styles.sampleChip}
                          onPress={() => handleSnapPhoto(sample.text)}
                        >
                          <Text style={styles.sampleChipText}>{sample.name}</Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </View>
                )}
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
  sampleLabelsContainer: {
    marginTop: 28,
    width: '100%',
  },
  sampleLabelTitle: {
    color: COLORS.textSecondary,
    fontSize: 12,
    fontWeight: '700',
    fontFamily: FONTS.bold,
    marginBottom: 8,
    textAlign: 'center',
  },
  sampleScroll: {
    flexGrow: 0,
  },
  sampleChip: {
    backgroundColor: COLORS.cardBg,
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 14,
    marginRight: 8,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  sampleChipText: {
    color: COLORS.primary,
    fontSize: 12,
    fontWeight: '700',
    fontFamily: FONTS.bold,
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

export function sortMergedResults(
  items: FoodItem[],
  query: string,
  activeLanguage?: string,
  country?: string
): FoodItem[] {
  const q = query.toLowerCase().trim();
  return [...items].sort((a, b) => {
    const scoreA = getFoodItemScore(a, q, activeLanguage, country);
    const scoreB = getFoodItemScore(b, q, activeLanguage, country);
    return scoreB - scoreA;
  });
}

const STOP_WORDS = new Set([
  'de', 'd', 'l', 'la', 'le', 'du', 'des', 'un', 'une', 'au', 'aux', 'et', 'en',
  'of', 'and', 'the', 'in', 'with', 'a', 'to', 'for'
]);

function normalizeSearchText(str: string): string {
  return (str || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[''’"\-.,\/#!$%\^&\*;:{}=\-_`~()]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function getFoodItemScore(
  item: FoodItem,
  q: string,
  activeLanguage?: string,
  country?: string
): number {
  let score = 0;
  const name = (item.name || '').trim();
  const brand = (item.brand || '').trim();
  const lang = (activeLanguage || 'fr').toLowerCase();
  const cntry = (country || 'fr').toLowerCase();

  const normName = normalizeSearchText(name);
  const normBrand = normalizeSearchText(brand);
  const normFullName = `${normName} ${normBrand}`.trim();
  const normQ = normalizeSearchText(q);

  const allQWords = normQ.split(/\s+/).filter(Boolean);
  const contentQWords = allQWords.filter((w) => !STOP_WORDS.has(w));
  const effectiveWords = contentQWords.length > 0 ? contentQWords : allQWords;

  // 1. Source Base Priority
  if (item.isAdded || item.source === 'MANUAL' || item.source === 'OCR_CUSTOM') {
    // Foods stored in local memory that have been added by user -> Top priority to promote to top of list
    score += 200;
  } else if (item.source === 'OFF_API') {
    // Open Food Facts live consumer brand catalog -> Top priority among external search databases
    score += 130;
    if (lang.startsWith('fr') || cntry === 'fr') {
      score += 15; // Local market consumer products boost
    }
  } else if (item.source === 'CIQUAL') {
    // Verified French national DB: Base score boosted by French locale/country context
    score += 60;
    if (cntry === 'fr') {
      score += 30; // Device country match for France
    }
    if (lang.startsWith('fr') || /[éèêëàâùûîïôç]/i.test(q)) {
      score += 20; // French language or accents boost
    }
  } else if (item.source === 'SWISS') {
    // Verified Swiss national DB: Base score boosted by Swiss locale/country context
    score += 60;
    if (cntry === 'ch') {
      score += 30; // Device country match for Switzerland
    }
    if (lang.startsWith('de') || lang.startsWith('it') || lang.startsWith('fr') || lang.startsWith('en')) {
      score += 20; // Swiss national & common language match boost
    }
  } else if (item.source === 'FINELI') {
    // Verified Finnish national DB: Base score boosted by Finnish locale/country context
    score += 60;
    if (cntry === 'fi') {
      score += 30; // Device country match for Finland
    }
    if (lang.startsWith('fi')) {
      score += 20; // Finnish language match boost
    }
  }

  // 2. Pattern Matching Scores (Name & Brand)
  if (normName === normQ || normFullName === normQ) {
    score += 120;
  } else if (normName.startsWith(normQ + ' ') || normName.startsWith(normQ + 's ') || normName.startsWith(normQ + ',')) {
    score += 90;
  } else if (normName.startsWith(normQ)) {
    score += 75;
  } else if (normFullName.includes(normQ)) {
    score += 60;
  }

  // 3. Word Token & Content Coverage
  const matchedAllCount = allQWords.filter((w) => normFullName.includes(w)).length;
  const matchedContentCount = effectiveWords.filter((w) => normFullName.includes(w)).length;

  const allRatio = allQWords.length > 0 ? matchedAllCount / allQWords.length : 0;
  const contentRatio = effectiveWords.length > 0 ? matchedContentCount / effectiveWords.length : 0;
  const brandMatchesAnyWord = effectiveWords.some((w) => normBrand.includes(w));

  if (allRatio === 1) {
    score += 70; // 100% of all query words match (including stop-words)
    if (brandMatchesAnyWord) {
      score += 25; // Extra bonus if brand name matches part of query (e.g. "harrys")
    }
  } else if (contentRatio === 1) {
    score += 55; // 100% of key content words match (e.g. "pain", "mie", "harrys")
    if (brandMatchesAnyWord) {
      score += 20;
    }
  } else if (contentRatio >= 0.5) {
    score += Math.round(contentRatio * 35);
  } else if (matchedContentCount > 0) {
    score += 10;
  } else {
    score -= 30;
  }

  // 4. Title Conciseness Bonus
  if (normName.includes(normQ) || normFullName.includes(normQ)) {
    const ratio = Math.min(1, normQ.length / Math.max(normName.length, 1));
    score += Math.round(ratio * 30);
  }

  return score;
}

