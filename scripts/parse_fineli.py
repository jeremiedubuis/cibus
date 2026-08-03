#!/usr/bin/env python3
import os
import csv
import json

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.abspath(os.path.join(SCRIPT_DIR, '..'))

FINELI_DIR = os.path.join(PROJECT_ROOT, 'src', 'data', 'fineli')
FOODNAME_CSV = os.path.join(FINELI_DIR, 'foodname_EN.csv')
COMPONENT_VAL_CSV = os.path.join(FINELI_DIR, 'component_value.csv')
OUTPUT_JSON = os.path.join(PROJECT_ROOT, 'src', 'data', 'fineli_foods.json')

def parse_fineli():
    print(f"Parsing Fineli food dataset from {FINELI_DIR}...")
    foods = {}

    # 1. Load English Food Names
    with open(FOODNAME_CSV, 'r', encoding='latin1') as f:
        reader = csv.reader(f, delimiter=';')
        next(reader) # skip header
        for row in reader:
            if len(row) >= 2:
                food_id = row[0].strip()
                food_name = row[1].strip()
                foods[food_id] = {
                    'id': f'fineli_{food_id}',
                    'code': food_id,
                    'name': food_name,
                    'servingSizeG': 100,
                    'calories100g': 0.0,
                    'proteins100g': 0.0,
                    'carbs100g': 0.0,
                    'fats100g': 0.0,
                    'fiber100g': 0.0,
                    'sodiumMg100g': 0.0,
                    'source': 'FINELI',
                }

    print(f"Loaded {len(foods)} Fineli food names. Parsing component values...")

    # 2. Load Component Values
    with open(COMPONENT_VAL_CSV, 'r', encoding='latin1') as f:
        reader = csv.reader(f, delimiter=';')
        next(reader) # skip header
        for row in reader:
            if len(row) >= 3:
                food_id = row[0].strip()
                eufdname = row[1].strip()
                val_str = row[2].strip().replace(',', '.')

                if food_id in foods:
                    try:
                        val = float(val_str)
                    except ValueError:
                        val = 0.0

                    if eufdname == 'ENERC':
                        # Convert kJ to kcal
                        foods[food_id]['calories100g'] = round(val / 4.184, 1)
                    elif eufdname == 'PROT':
                        foods[food_id]['proteins100g'] = round(val, 1)
                    elif eufdname in ['CHOAVL', 'CHOCDF'] and foods[food_id]['carbs100g'] == 0:
                        foods[food_id]['carbs100g'] = round(val, 1)
                    elif eufdname == 'FAT':
                        foods[food_id]['fats100g'] = round(val, 1)
                    elif eufdname in ['FIBC', 'FIBT'] and foods[food_id]['fiber100g'] == 0:
                        foods[food_id]['fiber100g'] = round(val, 1)
                    elif eufdname == 'NA':
                        foods[food_id]['sodiumMg100g'] = round(val, 1)

    food_list = list(foods.values())

    # Fallback energy calculation from macros if energy unmeasured
    for f in food_list:
        if f['calories100g'] == 0.0 and (f['proteins100g'] > 0 or f['carbs100g'] > 0 or f['fats100g'] > 0):
            f['calories100g'] = round(f['proteins100g'] * 4.0 + f['carbs100g'] * 4.0 + f['fats100g'] * 9.0, 1)

    os.makedirs(os.path.dirname(OUTPUT_JSON), exist_ok=True)
    with open(OUTPUT_JSON, 'w', encoding='utf-8') as out_f:
        json.dump(food_list, out_f, ensure_ascii=False, separators=(',', ':'))

    print(f"Successfully generated {OUTPUT_JSON} with {len(food_list)} Fineli food items.")

if __name__ == '__main__':
    parse_fineli()
