#!/usr/bin/env python3
"""Quick script to check row counts in each sheet"""

import pandas as pd

input_file = "Applications_1186_final.xlsx"
excel_file = pd.ExcelFile(input_file)

print("Sheet row counts:")
total_combinations = 1
for sheet_name in excel_file.sheet_names:
    df = pd.read_excel(excel_file, sheet_name=sheet_name)
    print(f"  {sheet_name}: {len(df):,} rows")
    total_combinations *= len(df)

print(f"\nTotal combinations (cross join): {total_combinations:,}")

