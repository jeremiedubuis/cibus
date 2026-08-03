#!/usr/bin/env python3
import os
import xml.etree.ElementTree as ET
import json

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.abspath(os.path.join(SCRIPT_DIR, '..'))

ALIM_XML = os.path.join(PROJECT_ROOT, 'data', 'ciqual', 'alim_2025_11_03.xml')
COMPO_XML = os.path.join(PROJECT_ROOT, 'data', 'ciqual', 'compo_2025_11_03.xml')
OUTPUT_JSON = os.path.join(PROJECT_ROOT, 'src', 'data', 'ciqual_foods.json')

def clean_val(val_str):
    if not val_str or val_str.strip() in ['-', 'tr', '<', '']:
        return 0.0
    v = val_str.strip().replace('<', '').replace('>', '').replace(',', '.').strip()
    try:
        return float(v)
    except ValueError:
        return 0.0

def parse_ciqual():
    print(f"Parsing CIQUAL food metadata from {ALIM_XML}...")
    alim_tree = ET.parse(ALIM_XML)
    foods = {}

    for child in alim_tree.getroot():
        code_el = child.find('alim_code')
        fr_el = child.find('alim_nom_fr')
        eng_el = child.find('alim_nom_eng')

        if code_el is None or fr_el is None:
            continue

        code = code_el.text.strip()
        nom_fr = fr_el.text.strip()
        nom_en = eng_el.text.strip() if eng_el is not None and eng_el.text else ''

        foods[code] = {
            'id': f'ciqual_{code}',
            'code': code,
            'name': nom_fr,
            'nameEn': nom_en,
            'servingSizeG': 100,
            'calories100g': 0.0,
            'proteins100g': 0.0,
            'carbs100g': 0.0,
            'fats100g': 0.0,
            'fiber100g': 0.0,
            'sodiumMg100g': 0.0,
            'source': 'CIQUAL',
        }

    print(f"Loaded {len(foods)} food titles. Parsing nutrition compositions from {COMPO_XML}...")
    compo_tree = ET.parse(COMPO_XML)

    for child in compo_tree.getroot():
        code_el = child.find('alim_code')
        const_el = child.find('const_code')
        teneur_el = child.find('teneur')

        if code_el is None or const_el is None:
            continue

        code = code_el.text.strip()
        const_code = const_el.text.strip()
        teneur = teneur_el.text if teneur_el is not None else ''

        if code in foods:
            val = clean_val(teneur)
            if const_code in ['328', '333'] and foods[code]['calories100g'] == 0:
                foods[code]['calories100g'] = round(val, 1)
            elif const_code in ['25000', '25003'] and foods[code]['proteins100g'] == 0:
                foods[code]['proteins100g'] = round(val, 1)
            elif const_code == '31000':
                foods[code]['carbs100g'] = round(val, 1)
            elif const_code == '40000':
                foods[code]['fats100g'] = round(val, 1)
            elif const_code == '34100':
                foods[code]['fiber100g'] = round(val, 1)
            elif const_code == '10110':
                foods[code]['sodiumMg100g'] = round(val, 1)

    # Fallback calorie calculation from macros if energy was unmeasured
    for f in foods.values():
        if f['calories100g'] == 0 and (f['proteins100g'] > 0 or f['carbs100g'] > 0 or f['fats100g'] > 0):
            calc_cal = round(f['proteins100g'] * 4.0 + f['carbs100g'] * 4.0 + f['fats100g'] * 9.0, 1)
            f['calories100g'] = calc_cal

    food_list = list(foods.values())
    os.makedirs(os.path.dirname(OUTPUT_JSON), exist_ok=True)

    with open(OUTPUT_JSON, 'w', encoding='utf-8') as out_f:
        json.dump(food_list, out_f, ensure_ascii=False, separators=(',', ':'))

    print(f"Successfully generated {OUTPUT_JSON} with {len(food_list)} food items.")

if __name__ == '__main__':
    parse_ciqual()
