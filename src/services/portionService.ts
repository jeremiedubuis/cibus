import { FoodItem, PortionOption } from '../types';

export interface ParsedServing {
  gramWeight?: number;
  unitName?: string;
  label?: string;
}

/**
 * Parses raw serving text strings (e.g. from Open Food Facts or datasets)
 * Example inputs: "1 glass (250 ml)", "1 slice (25g)", "1 portion (30 g)", "1 pot (125g)", "30 g", "250 ml", "125g"
 */
export function parseServingText(servingText?: string): ParsedServing | null {
  if (!servingText || typeof servingText !== 'string') return null;

  const text = servingText.trim();
  if (!text) return null;

  // Pattern 1: e.g. "1 glass (250 ml)", "1 slice (25g)", "1 pot (125 g)", "2 biscuits (30 g)"
  const matchWithParen = text.match(/^(?:\d+\s+)?([a-zA-Zà-ÿÀ-Ÿ\s]+?)\s*\(\s*(\d+(?:[\.,]\d+)?)\s*(?:g|ml|oz)?\s*\)$/i);
  if (matchWithParen) {
    const rawUnit = matchWithParen[1].trim().toLowerCase();
    const weight = parseFloat(matchWithParen[2].replace(',', '.'));
    if (!isNaN(weight) && weight > 0) {
      return {
        gramWeight: weight,
        unitName: rawUnit,
        label: `1 ${rawUnit} (${weight}g)`,
      };
    }
  }

  // Pattern 2: e.g. "30 g", "250 ml", "100g", "125g"
  const matchDirectWeight = text.match(/^(\d+(?:[\.,]\d+)?)\s*(?:g|ml|oz)?$/i);
  if (matchDirectWeight) {
    const weight = parseFloat(matchDirectWeight[1].replace(',', '.'));
    if (!isNaN(weight) && weight > 0 && weight !== 100) {
      return {
        gramWeight: weight,
        unitName: 'portion',
        label: `1 portion (${weight}g)`,
      };
    }
  }

  return null;
}

/**
 * Generates clean, deduplicated structured portion options for any FoodItem
 * Standard options: 1 unit / 1 portion / 1 glass / 1 slice / 1 pot, and always g (custom grams)
 */
export function getDefaultPortionsForFood(food: FoodItem): PortionOption[] {
  const rawOptions: PortionOption[] = [];

  const nameLower = (food.name || '').toLowerCase();
  const brandLower = (food.brand || '').toLowerCase();
  const combinedText = `${nameLower} ${brandLower}`;

  // Explicit solid food classification: meats, poultry, fish, cheeses, breads, cakes, chocolates, etc.
  const isSolidFood =
    /\b(jambon|ham|bacon|saucisson|sausage|salami|poulet|chicken|dinde|turkey|viande|meat|boeuf|beef|porc|pork|steak|fromage|cheese|pain|bread|toast|gâteau|cake|tarte|pie|quiche|brioche|chocolat|chocolate|laitue|lettuce|salade|salad|pâtes|pasta|riz|rice|biscuit|cookie)\b/i.test(
      combinedText
    );

  // Liquid beverages (must use word boundaries and cannot be solid food)
  const isLiquid =
    !isSolidFood &&
    /\b(lait|milk|jus|juice|eau|water|soda|bière|beer|vin|wine|café|coffee|thé|tea|boisson|drinks?|beverage|smoothie|limonade|cola|cider|cidre)\b/i.test(
      combinedText
    );

  const isSliceable =
    /\b(pain|bread|toast|slice|tranche|pizza|cheese|fromage|gâteau|cake|tarte|pie|quiche|brioche|jambon|ham|bacon)\b/i.test(
      combinedText
    );

  const isYogurtPot = /\b(yaourt|yoghurt|yogurt|skyr|faisselle|fromage blanc)\b/i.test(combinedText);

  const isPackagedUnit =
    isYogurtPot ||
    /\b(pomme|apple|banane|banana|oeuf|egg|barre|bar|biscuit|cookie|avocat|avocado|orange|citron|lemon)\b/i.test(
      combinedText
    );

  const liquidUnitNames = ['glass', 'verre', 'bottle', 'bouteille', 'can', 'cannette'];

  // 1. Existing food.portions if already populated
  if (food.portions && food.portions.length > 0) {
    food.portions.forEach((p) => {
      const u = (p.unitName || '').toLowerCase();
      if (isSolidFood && liquidUnitNames.includes(u)) {
        return; // Skip invalid liquid suggestion for solid item
      }
      rawOptions.push(p);
    });
  }

  // 2. Parsed dataset / OFF serving size if available
  if (food.servingName) {
    const parsed = parseServingText(food.servingName);
    if (parsed && parsed.gramWeight) {
      const unit = parsed.unitName || 'portion';
      const uLower = unit.toLowerCase();
      if (!isSolidFood || !liquidUnitNames.includes(uLower)) {
        rawOptions.push({
          id: `parsed_${unit}`,
          label: parsed.label || `1 ${unit} (${parsed.gramWeight}g)`,
          gramWeight: parsed.gramWeight,
          unitName: unit,
        });
      }
    }
  }

  // 3. Category / Name Heuristic Portions
  if (isLiquid) {
    rawOptions.push({
      id: 'glass',
      label: '1 glass (200g)',
      gramWeight: 200,
      unitName: 'glass',
    });
    rawOptions.push({
      id: 'can_bottle',
      label: '1 bottle / can (330g)',
      gramWeight: 330,
      unitName: 'bottle/can',
    });
  }

  if (isSliceable) {
    rawOptions.push({
      id: 'slice',
      label: '1 slice (35g)',
      gramWeight: 35,
      unitName: 'slice',
    });
  }

  if (isYogurtPot) {
    const potWeight = food.servingSizeG > 0 && food.servingSizeG !== 100 ? food.servingSizeG : 125;
    rawOptions.push({
      id: 'pot',
      label: `1 pot (${potWeight}g)`,
      gramWeight: potWeight,
      unitName: 'pot',
    });
  } else if (isPackagedUnit) {
    const unitWeight = food.servingSizeG > 0 && food.servingSizeG !== 100 ? food.servingSizeG : 100;
    rawOptions.push({
      id: 'unit',
      label: `1 unit (${unitWeight}g)`,
      gramWeight: unitWeight,
      unitName: 'unit',
    });
  }

  // 4. Default serving weight fallback if food has explicit servingSizeG != 100
  if (food.servingSizeG && food.servingSizeG > 0 && food.servingSizeG !== 100) {
    rawOptions.push({
      id: 'serving_custom',
      label: `1 portion (${food.servingSizeG}g)`,
      gramWeight: food.servingSizeG,
      unitName: 'portion',
    });
  }

  // Fallback 1 portion (100g) if no other portion options present yet
  if (rawOptions.length === 0) {
    rawOptions.push({
      id: 'portion_standard',
      label: '1 portion (100g)',
      gramWeight: 100,
      unitName: 'portion',
    });
  }

  // Deduplicate options by weight & label
  return deduplicatePortions(rawOptions);
}

/**
 * Deduplicates portion options so identical weights and duplicate labels are cleaned up.
 * Always appends 'g' (Grams) option as the final option.
 */
export function deduplicatePortions(options: PortionOption[]): PortionOption[] {
  const result: PortionOption[] = [];
  const seenLabels = new Set<string>();

  const specificUnits = ['pot', 'glass', 'slice', 'cup', 'can', 'bottle'];

  for (const opt of options) {
    if (opt.id === 'grams') continue; // Grams handled at the end

    const normLabel = opt.label.trim().toLowerCase();
    if (seenLabels.has(normLabel)) continue;

    // Check if an option with the exact same gram weight already exists
    const existingIndex = result.findIndex((existing) => existing.gramWeight === opt.gramWeight);
    if (existingIndex !== -1) {
      const existing = result[existingIndex];
      // If current option has a specific unit (e.g. 'pot') and existing is generic, upgrade to specific
      const optUnit = (opt.unitName || '').toLowerCase();
      const existingUnit = (existing.unitName || '').toLowerCase();

      if (specificUnits.includes(optUnit) && !specificUnits.includes(existingUnit)) {
        seenLabels.delete(existing.label.trim().toLowerCase());
        result[existingIndex] = opt;
        seenLabels.add(normLabel);
      }
      continue;
    }

    seenLabels.add(normLabel);
    result.push(opt);
  }

  // Always append Grams 'g' mode as final option
  result.push({
    id: 'grams',
    label: 'g',
    gramWeight: 1,
    unitName: 'g',
  });

  return result;
}

/**
 * Calculates final total grams based on selected portion option and quantity multiplier
 */
export function calculateGramsFromPortion(portion: PortionOption, quantity: number): number {
  if (!portion || isNaN(quantity) || quantity <= 0) return 0;
  return Math.max(0, Math.round(portion.gramWeight * quantity * 10) / 10);
}

/**
 * Formats a localized display label for a PortionOption (e.g. "1 tranche (35g)", "1 glass (200g)")
 */
export function getLocalizedPortionLabel(
  portion: PortionOption,
  t: (key: string, options?: any) => string
): string {
  if (!portion) return '';

  if (portion.id === 'grams' || portion.unitName === 'g') {
    return t('logMeal.grams', { defaultValue: 'g' });
  }

  const unitNameLower = (portion.unitName || '').toLowerCase().trim();

  let unitKey: string | null = null;
  if (unitNameLower === 'slice' || unitNameLower === 'tranche') {
    unitKey = 'slice';
  } else if (unitNameLower === 'glass' || unitNameLower === 'verre') {
    unitKey = 'glass';
  } else if (
    unitNameLower === 'bottle/can' ||
    unitNameLower === 'can_bottle' ||
    unitNameLower === 'bottle' ||
    unitNameLower === 'can' ||
    unitNameLower === 'bouteille' ||
    unitNameLower === 'canette'
  ) {
    unitKey = 'bottle_can';
  } else if (unitNameLower === 'pot') {
    unitKey = 'pot';
  } else if (unitNameLower === 'unit' || unitNameLower === 'unité') {
    unitKey = 'unit';
  } else if (unitNameLower === 'portion') {
    unitKey = 'portion';
  }

  const translatedUnit = unitKey
    ? t(`logMeal.units.${unitKey}`, { defaultValue: portion.unitName || unitKey })
    : portion.unitName || 'portion';

  if (portion.gramWeight && portion.gramWeight > 0) {
    return t('logMeal.portionFormat', {
      defaultValue: `1 ${translatedUnit} (${portion.gramWeight}g)`,
      unit: translatedUnit,
      weight: portion.gramWeight,
    });
  }

  return translatedUnit;
}
