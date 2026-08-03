import { ParsedNutrition } from '../types';

function cleanValue(raw: string): number | null {
  if (!raw) return null;
  let cleaned = raw.replace(',', '.').trim();

  // Fix OCR misreads where '9' or 'q' is misread for 'g' at the end of a decimal (e.g. '9.69' -> '9.6')
  if (/^\d+\.\d+9$/.test(cleaned)) {
    cleaned = cleaned.substring(0, cleaned.length - 1);
  }

  // Remove trailing unit characters ('g', 'q', 'gr', 'grams')
  cleaned = cleaned.replace(/(?:g|q|gr|grams)$/i, '').trim();

  // If number ends with '9' and is preceded by digits without decimal (e.g. '269' misread from '26g')
  if (/^\d{2,3}9$/.test(cleaned) && parseInt(cleaned, 10) > 200 && parseInt(cleaned, 10) < 1000) {
    const dropped = cleaned.substring(0, cleaned.length - 1);
    const num = parseFloat(dropped);
    if (!isNaN(num) && num < 100) {
      cleaned = dropped;
    }
  }

  const val = parseFloat(cleaned);
  return !isNaN(val) ? val : null;
}

/**
 * Sequence parser for two-column ML Kit blocks where headers appear in order, followed by values in order.
 */
function parseSequenceColumns(lines: string[]): ParsedNutrition {
  const result: ParsedNutrition = { calories: null, protein: null, carbs: null, fat: null };

  const headers: { type: 'calories' | 'fat' | 'sat_fat' | 'carbs' | 'sugar' | 'fiber' | 'protein' | 'salt'; lineIdx: number }[] = [];

  lines.forEach((line, idx) => {
    const l = line.toLowerCase();
    if (/(?:energy|énergie|energie|calories|brennwert)/i.test(l)) {
      headers.push({ type: 'calories', lineIdx: idx });
    } else if (/(?:acides\s+gras|verzadigde|saturates|saturé)/i.test(l)) {
      headers.push({ type: 'sat_fat', lineIdx: idx });
    } else if (/(?:matières?\s+grasses?|matieres?\s+grasses?|vetten|lipides|fett|fat)/i.test(l)) {
      headers.push({ type: 'fat', lineIdx: idx });
    } else if (/(?:sucres?|suiker|suikes|sugars?)/i.test(l)) {
      headers.push({ type: 'sugar', lineIdx: idx });
    } else if (/(?:glucides|koolhydraten|kohlenhydrate|carbohydrates|carbs)/i.test(l)) {
      headers.push({ type: 'carbs', lineIdx: idx });
    } else if (/(?:fibres?|fbres|vezels|ballaststoffe)/i.test(l)) {
      headers.push({ type: 'fiber', lineIdx: idx });
    } else if (/(?:protéines|proteines|eiwitten|eivwitten|protein|eiweiß)/i.test(l)) {
      headers.push({ type: 'protein', lineIdx: idx });
    } else if (/(?:sel|zout|salt|salz)/i.test(l)) {
      headers.push({ type: 'salt', lineIdx: idx });
    }
  });

  const valueTokens: { val: number; raw: string; isKcal?: boolean }[] = [];
  lines.forEach((line) => {
    // Ignore standalone serving size header lines like "100 g"
    if (/^\s*(?:sachet|per|pour)?\s*100\s*g\s*$/i.test(line)) {
      return;
    }

    const kcalMatch = line.match(/(\d+[\.,]?\d*)\s*kcal/i);
    if (kcalMatch && kcalMatch[1]) {
      const v = cleanValue(kcalMatch[1]);
      if (v !== null) valueTokens.push({ val: v, raw: line, isKcal: true });
      return;
    }

    const numMatch = line.match(/^\s*(\d+[\.,]?\d*)\s*(?:g|q|gr|9)?\s*$/i);
    if (numMatch && numMatch[1]) {
      const v = cleanValue(numMatch[1]);
      if (v !== null) valueTokens.push({ val: v, raw: line });
    }
  });

  if (headers.length >= 3 && valueTokens.length >= 3) {
    headers.forEach((h, hIdx) => {
      if (hIdx < valueTokens.length) {
        const tokenVal = valueTokens[hIdx].val;
        if (h.type === 'calories' && result.calories === null) result.calories = tokenVal;
        if (h.type === 'fat' && result.fat === null) result.fat = tokenVal;
        if (h.type === 'carbs' && result.carbs === null) result.carbs = tokenVal;
        if (h.type === 'protein' && result.protein === null) result.protein = tokenVal;
      }
    });
  }

  return result;
}

/**
 * Regex & Multi-line Parsing Layer for Package Labels (OCR Text Lines)
 * Extract calories, protein, carbs, and fat from extracted packaging text lines.
 * Supports French, Dutch, German, English, two-column layouts, and common OCR typos.
 */
export function parseNutritionText(textLines: string[]): ParsedNutrition {
  // 1. Try sequence column pairing first for multi-line / two-column tables
  const seqResult = parseSequenceColumns(textLines);

  const cleanedLines = textLines.filter((l) => !/^\s*(?:sachet|pour|per|par)?\s*100\s*g\s*$/i.test(l));
  const fullText = cleanedLines.join('\n');
  const lowerText = fullText.toLowerCase();

  const extractFromPatterns = (patterns: RegExp[]): number | null => {
    for (const pattern of patterns) {
      const match = lowerText.match(pattern);
      if (match && match[1]) {
        const val = cleanValue(match[1]);
        if (val !== null) return val;
      }
    }
    return null;
  };

  // 2. Calories / Energy Extraction
  let calories = seqResult.calories ?? extractFromPatterns([
    /(?:energy|énergie|energie|calories|brennwert|valeur\s+énergétique)\s*:?\s*(\d+[\.,]?\d*)\s*kcal/i,
    /(\d+[\.,]?\d*)\s*kcal/i,
    /(?:energy|énergie|energie|calories)\s*:?\s*(\d+[\.,]?\d*)/i,
  ]);

  if (calories === null) {
    const kjKcalMatch = lowerText.match(/(\d+[\.,]?\d*)\s*kj\s*\(\s*(\d+[\.,]?\d*)\s*kcal\s*\)/i);
    if (kjKcalMatch && kjKcalMatch[2]) {
      calories = cleanValue(kjKcalMatch[2]);
    }
  }

  // 3. Fat Extraction (Excluding saturated fats and energy values)
  let fat = seqResult.fat ?? extractFromPatterns([
    /(?:total\s+fat|fat|lipides|fett|matières?\s+grasses?|matieres?\s+grasses?|vetten|vet)\s*:?\s*(\d+[\.,]?\d*)\s*(?:g|q|gr|grams)?\b(?!\s*(?:dont\s+acides|kcal|kj))/i,
    /(?:matières?\s+grasses?|matieres?\s+grasses?|vetten|lipides|fett|fat)\s*[\/\s\w]*[\n:]+\s*(\d+[\.,]?\d*)\s*(?:g|q)?/i,
  ]);

  if (fat === null) {
    const fatMatch = lowerText.match(/(?:matières?\s+grasses?|matieres?\s+grasses?|vetten|lipides|fett|total\s+fat)\b[\s\S]{0,120}?(\d+[\.,]?\d*)\s*(?:g|q|9)?\b(?!\s*(?:kcal|kj))/i);
    if (fatMatch && fatMatch[1]) {
      fat = cleanValue(fatMatch[1]);
    }
  }

  // 4. Carbohydrates Extraction (Excluding sugars and energy values)
  let carbs = seqResult.carbs ?? extractFromPatterns([
    /(?:carbohydrate|carbohydrates|glucides|kohlenhydrate|koolhydraten|carbs)\s*:?\s*(\d+[\.,]?\d*)\s*(?:g|q|gr|grams)?\b(?!\s*(?:dont\s+sucres|kcal|kj))/i,
    /(?:glucides|koolhydraten|kohlenhydrate|carbohydrates)\s*[\/\s\w]*[\n:]+\s*(\d+[\.,]?\d*)\s*(?:g|q)?/i,
  ]);

  if (carbs === null) {
    const carbsMatch = lowerText.match(/(?:glucides|koolhydraten|kohlenhydrate|carbohydrates|carbs)\b[\s\S]{0,120}?\b(\d+[\.,]?\d*)\s*(?:g|q|9)?\b(?!\s*(?:kcal|kj))/i);
    if (carbsMatch && carbsMatch[1]) {
      carbs = cleanValue(carbsMatch[1]);
    }
  }

  // 5. Protein Extraction (Excluding energy values)
  let protein = seqResult.protein ?? extractFromPatterns([
    /(?:protein|protéines|proteines|eiweiß|eiweiss|eiwitten|eivwitten)\s*:?\s*(\d+[\.,]?\d*)\s*(?:g|q|gr|grams)?\b(?!\s*(?:kcal|kj))/i,
    /(?:protéines|proteines|eiwitten|eivwitten|protein|eiweiß)\s*[\/\s\w]*[\n:]+\s*(\d+[\.,]?\d*)\s*(?:g|q)?/i,
  ]);

  if (protein === null) {
    const proteinMatch = lowerText.match(/(?:protéines|proteines|eiwitten|eivwitten|protein|eiweiß)\b[\s\S]{0,120}?(\d+[\.,]?\d*)\s*(?:g|q|9)?\b(?!\s*(?:kcal|kj))/i);
    if (proteinMatch && proteinMatch[1]) {
      protein = cleanValue(proteinMatch[1]);
    }
  }

  return { calories, protein, carbs, fat };
}

/**
 * Perform native ML Kit Text Recognition on a given image file URI.
 * Gracefully returns empty string if ML Kit is not available in mock/testing environments.
 */
export async function recognizeTextFromImage(imageUri: string): Promise<string> {
  try {
    const TextRecognition = require('@react-native-ml-kit/text-recognition').default;
    if (!TextRecognition || typeof TextRecognition.recognize !== 'function') {
      return '';
    }
    const result = await TextRecognition.recognize(imageUri);
    if (!result) return '';

    if (Array.isArray(result.blocks) && result.blocks.length > 0) {
      const lineObjects: { text: string; top: number; left: number }[] = [];

      for (const block of result.blocks) {
        if (Array.isArray(block.lines) && block.lines.length > 0) {
          for (const line of block.lines) {
            if (line && line.text) {
              lineObjects.push({
                text: line.text,
                top: line.frame ? line.frame.top : 0,
                left: line.frame ? line.frame.left : 0,
              });
            }
          }
        } else if (block.text) {
          lineObjects.push({
            text: block.text,
            top: block.frame ? block.frame.top : 0,
            left: block.frame ? block.frame.left : 0,
          });
        }
      }

      // Sort lines by vertical position (top) to align rows in two-column layouts
      lineObjects.sort((a, b) => {
        const diffTop = a.top - b.top;
        if (Math.abs(diffTop) > 12) {
          return diffTop;
        }
        return a.left - b.left;
      });

      return lineObjects.map((l) => l.text).join('\n');
    }
    return result.text || '';
  } catch (err) {
    console.warn('Text recognition error (falling back):', err);
    return '';
  }
}
