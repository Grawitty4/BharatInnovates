#!/usr/bin/env python3
"""
Script to remove redundant columns from a consolidated Excel file.
Removes:
1. Constant columns (same value in all rows)
2. Duplicate columns (columns with identical values)
3. Columns with same base name across different sheets (keeps only one)
"""

import pandas as pd
import sys
import os
import json
from collections import defaultdict
from datetime import datetime

def remove_redundant_columns(input_file, output_file=None, keep_join_key=True, join_key='ApplicationId'):
    """
    Remove redundant columns from a consolidated Excel file.
    
    Args:
        input_file: Path to the input Excel file
        output_file: Path to the output Excel file (optional)
        keep_join_key: Whether to keep the join key column (default: True)
        join_key: Name of the join key column (default: 'ApplicationId')
    """
    if not os.path.exists(input_file):
        print(f"Error: File '{input_file}' not found.")
        return
    
    print(f"Reading consolidated file: {input_file}")
    df = pd.read_excel(input_file)
    original_cols = len(df.columns)
    print(f"Original columns: {original_cols}")
    print(f"Rows: {len(df):,}")
    
    columns_to_remove = set()
    
    # 1. Remove constant columns (same value in all rows, excluding NaN)
    print("\n1. Checking for constant columns (same value in all rows)...")
    constant_cols = []
    for col in df.columns:
        if col == join_key and keep_join_key:
            continue
        # Check if column has the same value (ignoring NaN)
        unique_values = df[col].dropna().unique()
        if len(unique_values) <= 1:
            constant_cols.append(col)
            columns_to_remove.add(col)
    
    if constant_cols:
        print(f"   Found {len(constant_cols)} constant columns:")
        for col in constant_cols[:10]:  # Show first 10
            val = df[col].dropna().iloc[0] if len(df[col].dropna()) > 0 else "NaN"
            print(f"     - {col} (value: {val})")
        if len(constant_cols) > 10:
            print(f"     ... and {len(constant_cols) - 10} more")
    else:
        print("   No constant columns found.")
    
    # 2. Find duplicate columns (columns with identical values)
    print("\n2. Checking for duplicate columns (identical values)...")
    duplicate_groups = []
    checked_cols = set()
    
    for i, col1 in enumerate(df.columns):
        if col1 in checked_cols or col1 == join_key:
            continue
        
        duplicates = [col1]
        for col2 in df.columns[i+1:]:
            if col2 in checked_cols or col2 == join_key:
                continue
            
            # Check if columns are identical (handling NaN)
            if df[col1].equals(df[col2]) or (df[col1].fillna('').equals(df[col2].fillna(''))):
                duplicates.append(col2)
                checked_cols.add(col2)
        
        if len(duplicates) > 1:
            duplicate_groups.append(duplicates)
            # Keep the first one, remove the rest
            for dup_col in duplicates[1:]:
                columns_to_remove.add(dup_col)
            checked_cols.add(col1)
    
    if duplicate_groups:
        print(f"   Found {len(duplicate_groups)} groups of duplicate columns:")
        for group in duplicate_groups[:5]:  # Show first 5 groups
            print(f"     - Keeping: {group[0]}")
            print(f"       Removing: {', '.join(group[1:])}")
        if len(duplicate_groups) > 5:
            print(f"     ... and {len(duplicate_groups) - 5} more groups")
    else:
        print("   No duplicate columns found.")
    
    # 3. Find columns with same base name across different sheets
    print("\n3. Checking for columns with same base name across different sheets...")
    base_name_groups = defaultdict(list)
    
    for col in df.columns:
        if col == join_key:
            continue
        # Extract base name (remove sheet prefix)
        if '_' in col:
            parts = col.split('_', 1)
            if len(parts) == 2:
                base_name = parts[1]
                base_name_groups[base_name].append(col)
    
    same_base_removed = []
    for base_name, cols in base_name_groups.items():
        if len(cols) > 1:
            # Check if all columns with same base name have identical values
            all_identical = True
            first_col = cols[0]
            
            for col in cols[1:]:
                if not (df[first_col].equals(df[col]) or df[first_col].fillna('').equals(df[col].fillna(''))):
                    all_identical = False
                    break
            
            if all_identical:
                # Keep the first one (prefer earlier sheets), remove the rest
                for col in cols[1:]:
                    if col not in columns_to_remove:  # Don't double-remove
                        columns_to_remove.add(col)
                        same_base_removed.append(col)
    
    if same_base_removed:
        print(f"   Found {len(same_base_removed)} redundant columns with same base names:")
        # Group by base name for display
        removed_by_base = defaultdict(list)
        for col in same_base_removed:
            base = col.split('_', 1)[1] if '_' in col else col
            removed_by_base[base].append(col)
        
        for base, cols in list(removed_by_base.items())[:10]:  # Show first 10
            kept_col = [c for c in base_name_groups[base] if c not in cols][0] if base_name_groups[base] else None
            print(f"     - Base name: '{base}'")
            print(f"       Keeping: {kept_col}")
            print(f"       Removing: {', '.join(cols)}")
        if len(removed_by_base) > 10:
            print(f"     ... and {len(removed_by_base) - 10} more base names")
    else:
        print("   No redundant columns with same base names found.")
    
    # Remove redundant columns
    print(f"\nRemoving {len(columns_to_remove)} redundant columns...")
    df_cleaned = df.drop(columns=[col for col in columns_to_remove if col in df.columns])
    
    # Generate output filenames if not provided
    if output_file is None:
        base_name = os.path.splitext(input_file)[0]
        output_file_xlsx = f"{base_name}_cleaned.xlsx"
        output_file_json = f"{base_name}_cleaned.json"
    else:
        base_name = os.path.splitext(output_file)[0]
        output_file_xlsx = output_file if output_file.endswith('.xlsx') else f"{output_file}.xlsx"
        output_file_json = f"{base_name}.json"
    
    # Save cleaned file to Excel
    print(f"\nSaving cleaned data to Excel: {output_file_xlsx}")
    df_cleaned.to_excel(output_file_xlsx, index=False, sheet_name='Consolidated')
    
    # Save cleaned file to JSON
    print(f"Saving cleaned data to JSON: {output_file_json}")
    # Convert DataFrame to records (list of dicts) for JSON
    json_data = df_cleaned.replace({pd.NaT: None}).to_dict('records')
    # Convert datetime objects to strings
    for record in json_data:
        for key, value in record.items():
            if isinstance(value, (pd.Timestamp, datetime)):
                record[key] = value.isoformat() if pd.notna(value) else None
            elif pd.isna(value):
                record[key] = None
    
    with open(output_file_json, 'w', encoding='utf-8') as f:
        json.dump(json_data, f, indent=2, ensure_ascii=False, default=str)
    
    print(f"\nCleaning complete!")
    print(f"Original columns: {original_cols}")
    print(f"Removed columns: {len(columns_to_remove)}")
    print(f"Final columns: {len(df_cleaned.columns)}")
    print(f"Rows: {len(df_cleaned):,}")
    print(f"Output files:")
    print(f"  - Excel: {output_file_xlsx}")
    print(f"  - JSON: {output_file_json}")

if __name__ == "__main__":
    # Default to the consolidated columns file
    input_file = "Applications_1186_final_consolidated_columns.xlsx"
    
    # Check if custom input/output files are provided as command line arguments
    if len(sys.argv) > 1:
        input_file = sys.argv[1]
    if len(sys.argv) > 2:
        output_file = sys.argv[2]
    else:
        output_file = None
    
    remove_redundant_columns(input_file, output_file)

