#!/usr/bin/env python3
"""
Script to consolidate multiple Excel tabs into a single consolidated file.
"""

import pandas as pd
import sys
import os
import json
from datetime import datetime

def consolidate_excel_tabs(input_file, output_file=None):
    """
    Consolidate all tabs from an Excel file into a single sheet.
    
    Args:
        input_file: Path to the input Excel file
        output_file: Path to the output Excel file (optional)
    """
    if not os.path.exists(input_file):
        print(f"Error: File '{input_file}' not found.")
        return
    
    # Read all sheets from the Excel file
    print(f"Reading Excel file: {input_file}")
    excel_file = pd.ExcelFile(input_file)
    sheet_names = excel_file.sheet_names
    print(f"Found {len(sheet_names)} tabs: {', '.join(sheet_names)}")
    
    # List to store all dataframes
    all_dataframes = []
    
    # Read each sheet and add a column to identify the source sheet
    for sheet_name in sheet_names:
        print(f"Processing tab: {sheet_name}")
        df = pd.read_excel(excel_file, sheet_name=sheet_name)
        
        # Add a column to identify which sheet this data came from
        df.insert(0, 'Source_Sheet', sheet_name)
        
        all_dataframes.append(df)
    
    # Concatenate all dataframes
    print("Consolidating all tabs...")
    consolidated_df = pd.concat(all_dataframes, ignore_index=True)
    
    # Generate output filenames if not provided
    if output_file is None:
        base_name = os.path.splitext(input_file)[0]
        output_file_xlsx = f"{base_name}_consolidated.xlsx"
        output_file_json = f"{base_name}_consolidated.json"
    else:
        base_name = os.path.splitext(output_file)[0]
        output_file_xlsx = output_file if output_file.endswith('.xlsx') else f"{output_file}.xlsx"
        output_file_json = f"{base_name}.json"
    
    # Save to Excel file
    print(f"\nSaving consolidated data to Excel: {output_file_xlsx}")
    consolidated_df.to_excel(output_file_xlsx, index=False, sheet_name='Consolidated')
    
    # Save to JSON file
    print(f"Saving consolidated data to JSON: {output_file_json}")
    # Convert DataFrame to records (list of dicts) for JSON
    json_data = consolidated_df.replace({pd.NaT: None}).to_dict('records')
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
    print(f"Total rows: {len(consolidated_df)}")
    print(f"Total columns: {len(consolidated_df.columns)}")
    print(f"Output files:")
    print(f"  - Excel: {output_file_xlsx}")
    print(f"  - JSON: {output_file_json}")

if __name__ == "__main__":
    input_file = "Applications_1186_final.xlsx"
    
    # Check if custom output file is provided as command line argument
    output_file = None
    if len(sys.argv) > 1:
        output_file = sys.argv[1]
    
    consolidate_excel_tabs(input_file, output_file)

