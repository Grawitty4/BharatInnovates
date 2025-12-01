#!/usr/bin/env python3
"""Check columns in each sheet to find common identifiers"""

import pandas as pd

input_file = "Applications_1186_final.xlsx"
excel_file = pd.ExcelFile(input_file)

print("Columns in each sheet:\n")
for sheet_name in excel_file.sheet_names:
    df = pd.read_excel(excel_file, sheet_name=sheet_name, nrows=5)  # Just read a few rows to see columns
    print(f"{sheet_name}:")
    print(f"  Columns: {list(df.columns)[:10]}...")  # Show first 10 columns
    print()

