#!/usr/bin/env python3
"""
Script to consolidate multiple Excel tabs by columns using ApplicationId as join key.
This joins all sheets on the ApplicationId column, creating one row per ApplicationId with all information.
"""

import pandas as pd
import sys
import os
import json
from datetime import datetime

def consolidate_excel_tabs_by_columns(input_file, output_file=None, join_key='ApplicationId'):
    """
    Consolidate all tabs from an Excel file by columns using ApplicationId as join key.
    Each row will contain all information from all sheets for a single ApplicationId.
    
    Args:
        input_file: Path to the input Excel file
        output_file: Path to the output Excel file (optional)
        join_key: Column name to use for joining (default: 'ApplicationId')
    """
    if not os.path.exists(input_file):
        print(f"Error: File '{input_file}' not found.")
        return
    
    # Read all sheets from the Excel file
    print(f"Reading Excel file: {input_file}")
    excel_file = pd.ExcelFile(input_file)
    sheet_names = excel_file.sheet_names
    print(f"Found {len(sheet_names)} tabs: {', '.join(sheet_names)}")
    
    # List to store all dataframes with their join key info
    all_dataframes = []
    sheets_without_key = []
    
    # Read each sheet and check for join key
    for sheet_name in sheet_names:
        print(f"\nProcessing tab: {sheet_name}...")
        df = pd.read_excel(excel_file, sheet_name=sheet_name)
        print(f"  - Rows: {len(df)}, Columns: {len(df.columns)}")
        
        # Check if join key exists (case-insensitive)
        df_columns_lower = [col.lower() for col in df.columns]
        join_key_lower = join_key.lower()
        
        if join_key_lower not in df_columns_lower:
            # Try to find similar column names
            possible_keys = [col for col in df.columns if join_key_lower in col.lower() or 'application' in col.lower() and 'id' in col.lower()]
            if possible_keys:
                actual_key = possible_keys[0]
                print(f"  - Found similar key column: '{actual_key}' (using this instead of '{join_key}')")
                df = df.rename(columns={actual_key: join_key})
            else:
                print(f"  - WARNING: '{join_key}' column not found in this sheet!")
                sheets_without_key.append(sheet_name)
                # Skip this sheet or continue without it
                continue
        
        # Ensure join key is the correct name (handle case differences)
        for col in df.columns:
            if col.lower() == join_key_lower and col != join_key:
                df = df.rename(columns={col: join_key})
        
        # Prefix all column names with the sheet name to avoid conflicts (except join key)
        rename_dict = {}
        for col in df.columns:
            if col != join_key:
                rename_dict[col] = f"{sheet_name}_{col}"
        
        df = df.rename(columns=rename_dict)
        
        all_dataframes.append((sheet_name, df))
        print(f"  - Unique {join_key}s: {df[join_key].nunique()}")
    
    if sheets_without_key:
        print(f"\nWARNING: The following sheets don't have '{join_key}' and were skipped:")
        for sheet in sheets_without_key:
            print(f"  - {sheet}")
    
    if not all_dataframes:
        print(f"\nError: No sheets found with '{join_key}' column. Cannot perform join.")
        return
    
    # Perform left join starting with the first dataframe
    print(f"\nJoining all sheets on '{join_key}' column...")
    
    # Start with the first dataframe
    result_df = all_dataframes[0][1]
    print(f"  - Starting with: {all_dataframes[0][0]} ({len(result_df)} rows)")
    
    # Join with each subsequent dataframe
    for i, (sheet_name, df) in enumerate(all_dataframes[1:], 1):
        print(f"  - Joining with: {sheet_name} ({len(df)} rows)...")
        # Use outer join to keep all ApplicationIds from both sides
        result_df = result_df.merge(df, on=join_key, how='outer', suffixes=('', f'_dup_{i}'))
        print(f"    Result after join: {len(result_df)} rows")
    
    # Generate output filenames if not provided
    if output_file is None:
        base_name = os.path.splitext(input_file)[0]
        output_file_xlsx = f"{base_name}_consolidated_columns.xlsx"
        output_file_json = f"{base_name}_consolidated_columns.json"
    else:
        base_name = os.path.splitext(output_file)[0]
        output_file_xlsx = output_file if output_file.endswith('.xlsx') else f"{output_file}.xlsx"
        output_file_json = f"{base_name}.json"
    
    # Save to Excel file
    print(f"\nSaving consolidated data to Excel: {output_file_xlsx}")
    result_df.to_excel(output_file_xlsx, index=False, sheet_name='Consolidated')
    
    # Save to JSON file
    print(f"Saving consolidated data to JSON: {output_file_json}")
    # Convert DataFrame to records (list of dicts) for JSON
    json_data = result_df.replace({pd.NaT: None}).to_dict('records')
    # Convert datetime objects to strings
    for record in json_data:
        for key, value in record.items():
            if isinstance(value, (pd.Timestamp, datetime)):
                record[key] = value.isoformat() if pd.notna(value) else None
            elif pd.isna(value):
                record[key] = None
    
    with open(output_file_json, 'w', encoding='utf-8') as f:
        json.dump(json_data, f, indent=2, ensure_ascii=False, default=str)
    
    print(f"\nConsolidation complete!")
    print(f"Total rows: {len(result_df):,}")
    print(f"Total columns: {len(result_df.columns)}")
    print(f"Unique {join_key}s: {result_df[join_key].nunique():,}")
    print(f"Output files:")
    print(f"  - Excel: {output_file_xlsx}")
    print(f"  - JSON: {output_file_json}")

if __name__ == "__main__":
    input_file = "Applications_1186_final.xlsx"
    
    # Check if custom output file is provided as command line argument
    output_file = None
    if len(sys.argv) > 1:
        output_file = sys.argv[1]
    
    consolidate_excel_tabs_by_columns(input_file, output_file)

