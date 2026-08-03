import { parseNutritionText } from '../src/services/ocrParser';

describe('OCR Regex Parser Pipeline', () => {
  it('should parse English nutrition label text correctly', () => {
    const lines = [
      'NUTRITION FACTS',
      'Serving Size: 100g',
      'Energy: 250 kcal',
      'Total Fat: 8.5g',
      'Carbohydrates: 32g',
      'Protein: 14g',
    ];

    const result = parseNutritionText(lines);
    expect(result.calories).toBe(250);
    expect(result.fat).toBe(8.5);
    expect(result.carbs).toBe(32);
    expect(result.protein).toBe(14);
  });

  it('should parse French nutrition label text with comma decimal points', () => {
    const lines = [
      'INFORMATIONS NUTRITIONNELLES POUR 100G',
      'Valeur Énergétique: 450,5 kcal',
      'Protéines: 12,8 g',
      'Glucides: 55,2 g',
      'Lipides: 18,0 g',
    ];

    const result = parseNutritionText(lines);
    expect(result.calories).toBe(450.5);
    expect(result.protein).toBe(12.8);
    expect(result.carbs).toBe(55.2);
    expect(result.fat).toBe(18.0);
  });

  it('should parse German nutrition label text correctly', () => {
    const lines = [
      'NÄHRWERTE PRO 100G',
      'Brennwert: 380 kcal',
      'Eiweiß: 22g',
      'Kohlenhydrate: 45g',
      'Fett: 9,5g',
    ];

    const result = parseNutritionText(lines);
    expect(result.calories).toBe(380);
    expect(result.protein).toBe(22);
    expect(result.carbs).toBe(45);
    expect(result.fat).toBe(9.5);
  });

  it('should handle missing values gracefully by returning null', () => {
    const lines = [
      'Ingredients: Water, Sugar, Salt',
      'Net weight 500g',
    ];

    const result = parseNutritionText(lines);
    expect(result.calories).toBeNull();
    expect(result.protein).toBeNull();
    expect(result.carbs).toBeNull();
    expect(result.fat).toBeNull();
  });

  it('should parse camera viewfinder sample label preset texts', () => {
    const sampleWhey = [
      'VALEUR NUTRITIONNELLE 100g',
      'Énergie: 390 kcal',
      'Protéines: 78.0 g',
      'Glucides: 5.5 g',
      'Lipides: 4.2 g',
    ];
    const wheyParsed = parseNutritionText(sampleWhey);
    expect(wheyParsed.calories).toBe(390);
    expect(wheyParsed.protein).toBe(78.0);
    expect(wheyParsed.carbs).toBe(5.5);
    expect(wheyParsed.fat).toBe(4.2);

    const sampleYogurt = [
      'NUTRITION FACTS PER 100G',
      'Energy: 59 kcal',
      'Protein: 10.3 g',
      'Carbohydrates: 3.6 g',
      'Total Fat: 0.2 g',
    ];
    const yogurtParsed = parseNutritionText(sampleYogurt);
    expect(yogurtParsed.calories).toBe(59);
    expect(yogurtParsed.protein).toBe(10.3);
    expect(yogurtParsed.carbs).toBe(3.6);
    expect(yogurtParsed.fat).toBe(0.2);
  });

  it('should parse French/Dutch bilingual two-column packaging OCR text correctly', () => {
    const frenchBilingualText = [
      'Gemidelde voedingswaarden yoor:',
      'Energie/Energie',
      'Matières grasses /Vetten',
      'dont acides gras saturé/',
      'Glucides / Koolhydraten',
      'ont sucres /waarvan suikes',
      'Fbres alimentaires /Vezels',
      'Protéines /Eivwitten',
      'Sel/ Zout',
      '100 g',
      '2555 kJ (617 kcal)',
      '51g',
      '5,9g',
      '9,69',
      '4,9g',
      '7,89',
      '269',
      '0,04 q',
    ];

    const result = parseNutritionText(frenchBilingualText);
    expect(result.calories).toBe(617);
    expect(result.fat).toBe(51);
    expect(result.carbs).toBe(9.6);
    expect(result.protein).toBe(26);
  });

  it('should handle recognizeTextFromImage gracefully when ML Kit is mocked/not present', async () => {
    const { recognizeTextFromImage } = require('../src/services/ocrParser');
    const text = await recognizeTextFromImage('file:///test/path/sample.jpg');
    expect(typeof text).toBe('string');
  });
});
