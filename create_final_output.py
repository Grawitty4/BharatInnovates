#!/usr/bin/env python3
"""
Script to create final output with:
1. Only specified columns
2. Nested JSON structure for one-to-many relationships
3. One row per ApplicationId with nested arrays for team members, awards, and media coverage
"""

import pandas as pd
import sys
import os
import json
from datetime import datetime
from collections import defaultdict

# Define the columns to retain
COLUMNS_TO_RETAIN = [
    'ApplicationId',
    'Stage 1 Registration_Application Email',
    'Stage 1 Registration_Name',
    'Stage 1 Registration_Contact Number',
    'Stage 1 Registration_Role',
    'Stage 1 Registration_Institution Name',
    'Stage 1 Registration_Venture Name',
    'Stage 1 Registration_Website Link or Link to Social Media Handle',
    'Stage 2 Application_Startup/Company Legal Name',
    'Stage 2 Application_Startup/Company Popular (Brand) Name (if any)',
    'Stage 2 Application_Date of Incorporation',
    'Stage 2 Application_Company Registration Number (CIN/LLPIN)',
    'Stage 2 Application_Registered Address',
    'Stage 2 Application_DPIIT Certificate Number',
    'Stage 2 Application_Team Size (full-time equivalents)',
    'Stage 2 Application_Innovation Title',
    'Stage 2 Application_Technology Readiness Level (TRL)',
    'Stage 2 Application_Intellectual Property Status',
    'Stage 2 Application_Patent Details',
    'Stage 2 Application_Select the primary segment for your innovation: (Select only one)',
    'Stage 2 Application_Problem Clarity',
    'Stage 2 Application_Solution Strength',
    'Stage 2 Application_Innovation/Originality',
    'Stage 2 Application_Impact Potential',
    'Stage 2 Application_Scalability/Replicability',
    'Stage 2 Application_Execution Feasibility',
    'Stage 2 Application_Team Capacity',
    'Stage 2 Application_Intellectual Property',
    'Stage 2 Application_Are you funded by any VC/Angel/Govt?',
    'Stage 2 Application_Total Funding Raised',
    'Stage 2 Application_Lead Investors',
    'Stage 2 Application_Have you received any grants or institutional support?',
    'Stage 2 Application_Total Amount Received',
    'Stage 2 Application_Fund Source',
    'Stage 2 Application_Innovation/Product Demo Video',
    'Stage 2 Application_Link to high resolution video file',
    'Stage 2 Application_Presentation Deck (Max 15 slides)',
    'Stage 2 Application_Patent Documentation',
    'Stage 2 Application_Publications',
    'Stage 2 Application_Prototype Images/Videos',
    'Stage 2 Application_Team CVs (One single PDF)',
    'Stage 2 Application_Company Registration Certificate (for startups)',
    'Stage 2 Application_Equity holding pattern (Upload cap table showing Indian founders hold >51%).',
    'Stage 2 A-Other Team Members_Name',
    'Stage 2 A-Other Team Members_Gender',
    'Stage 2 A-Other Team Members_Date of Birth',
    'Stage 2 A-Other Team Members_Email',
    'Stage 2 A-Other Team Members_Mobile Number',
    'Stage 2 A-Other Team Members_Role',
    'Stage 2 A-Award Recognition_Award/Recognition',
    'Stage 2 A-Award Recognition_Awarding Body',
    'Stage 2 A-Award Recognition_Year',
    'Stage 2 A-Award Recognition_Details',
    'Stage 2 A-Media Coverage & Pub_Type',
    'Stage 2 A-Media Coverage & Pub_Website links',
    'Stage 2 A-Media Coverage & Pub_Year',
    'Stage 2 A-Media Coverage & Pub_Details',
]

# Define one-to-many relationship columns (these will be nested as arrays)
ONE_TO_MANY_COLUMNS = {
    'team_members': [
        'Stage 2 A-Other Team Members_Name',
        'Stage 2 A-Other Team Members_Gender',
        'Stage 2 A-Other Team Members_Date of Birth',
        'Stage 2 A-Other Team Members_Email',
        'Stage 2 A-Other Team Members_Mobile Number',
        'Stage 2 A-Other Team Members_Role',
    ],
    'awards': [
        'Stage 2 A-Award Recognition_Award/Recognition',
        'Stage 2 A-Award Recognition_Awarding Body',
        'Stage 2 A-Award Recognition_Year',
        'Stage 2 A-Award Recognition_Details',
    ],
    'media_coverage': [
        'Stage 2 A-Media Coverage & Pub_Type',
        'Stage 2 A-Media Coverage & Pub_Website links',
        'Stage 2 A-Media Coverage & Pub_Year',
        'Stage 2 A-Media Coverage & Pub_Details',
    ],
}

def convert_value(value):
    """Convert pandas values to JSON-serializable format."""
    if pd.isna(value):
        return None
    if isinstance(value, (pd.Timestamp, datetime)):
        return value.isoformat()
    if isinstance(value, (int, float)) and pd.isna(value):
        return None
    return value

def create_final_output(input_file, output_file=None, join_key='ApplicationId'):
    """
    Create final output with filtered columns and nested JSON structure.
    
    Args:
        input_file: Path to the input Excel file (original or consolidated)
        output_file: Path prefix for output files (optional)
        join_key: Column name to use for joining (default: 'ApplicationId')
    """
    if not os.path.exists(input_file):
        print(f"Error: File '{input_file}' not found.")
        return
    
    print(f"Reading Excel file: {input_file}")
    excel_file = pd.ExcelFile(input_file)
    sheet_names = excel_file.sheet_names
    print(f"Found {len(sheet_names)} tabs: {', '.join(sheet_names)}")
    
    # Read each sheet
    sheets_data = {}
    for sheet_name in sheet_names:
        print(f"\nProcessing tab: {sheet_name}...")
        df = pd.read_excel(excel_file, sheet_name=sheet_name)
        print(f"  - Rows: {len(df)}, Columns: {len(df.columns)}")
        
        # Check if join key exists (case-insensitive)
        df_columns_lower = [col.lower() for col in df.columns]
        join_key_lower = join_key.lower()
        
        if join_key_lower not in df_columns_lower:
            # Try to find similar column names
            possible_keys = [col for col in df.columns if join_key_lower in col.lower() or ('application' in col.lower() and 'id' in col.lower())]
            if possible_keys:
                actual_key = possible_keys[0]
                print(f"  - Found similar key column: '{actual_key}' (using this instead of '{join_key}')")
                df = df.rename(columns={actual_key: join_key})
            else:
                print(f"  - WARNING: '{join_key}' column not found, skipping this sheet")
                continue
        
        # Ensure join key is the correct name (handle case differences)
        for col in df.columns:
            if col.lower() == join_key_lower and col != join_key:
                df = df.rename(columns={col: join_key})
        
        # Prefix all column names with the sheet name to avoid conflicts (except join key)
        # Also strip trailing spaces from column names to match COLUMNS_TO_RETAIN
        rename_dict = {}
        for col in df.columns:
            if col != join_key:
                # Strip trailing spaces and prefix with sheet name
                clean_col = col.rstrip()
                rename_dict[col] = f"{sheet_name}_{clean_col}"
        
        df = df.rename(columns=rename_dict)
        
        # Clean up invalid entries - only remove rows where ALL fields are empty/invalid
        original_count = len(df)
        
        if sheet_name == 'Stage 2 A-Media Coverage & Pub':
            year_col = f"{sheet_name}_Year"
            type_col = f"{sheet_name}_Type"
            website_col = f"{sheet_name}_Website links"
            details_col = f"{sheet_name}_Details"
            
            # Only remove rows where ALL fields are empty/invalid (not just Year)
            if all(col in df.columns for col in [type_col, website_col, details_col, year_col]):
                all_empty_mask = (
                    (df[type_col].isna() | df[type_col].astype(str).str.strip().eq('')) &
                    (df[website_col].isna() | df[website_col].astype(str).str.strip().eq('')) &
                    (df[details_col].isna() | df[details_col].astype(str).str.strip().eq('')) &
                    (df[year_col].isna() | df[year_col].astype(str).str.strip().eq('') | 
                     df[year_col].astype(str).str.contains('invalid', case=False, na=False))
                )
                df = df[~all_empty_mask]
        
        elif sheet_name == 'Stage 2 A-Other Team Members':
            name_col = f"{sheet_name}_Name"
            email_col = f"{sheet_name}_Email"
            role_col = f"{sheet_name}_Role"
            gender_col = f"{sheet_name}_Gender"
            dob_col = f"{sheet_name}_Date of Birth"
            mobile_col = f"{sheet_name}_Mobile Number"
            
            # Only remove rows where ALL key fields are empty
            if all(col in df.columns for col in [name_col, email_col, role_col]):
                all_empty_mask = (
                    (df[name_col].isna() | df[name_col].astype(str).str.strip().eq('')) &
                    (df[email_col].isna() | df[email_col].astype(str).str.strip().eq('')) &
                    (df[role_col].isna() | df[role_col].astype(str).str.strip().eq(''))
                )
                # Also check optional fields
                if gender_col in df.columns:
                    all_empty_mask = all_empty_mask & (
                        df[gender_col].isna() | df[gender_col].astype(str).str.strip().eq('')
                    )
                if dob_col in df.columns:
                    all_empty_mask = all_empty_mask & (
                        df[dob_col].isna() | df[dob_col].astype(str).str.strip().eq('')
                    )
                if mobile_col in df.columns:
                    all_empty_mask = all_empty_mask & (
                        df[mobile_col].isna() | df[mobile_col].astype(str).str.strip().eq('')
                    )
                df = df[~all_empty_mask]
        
        elif sheet_name == 'Stage 2 A-Award Recognition':
            award_col = f"{sheet_name}_Award/Recognition"
            body_col = f"{sheet_name}_Awarding Body"
            year_col = f"{sheet_name}_Year"
            details_col = f"{sheet_name}_Details"
            
            # Only remove rows where ALL fields are empty/invalid
            if all(col in df.columns for col in [award_col, body_col, year_col, details_col]):
                all_empty_mask = (
                    (df[award_col].isna() | df[award_col].astype(str).str.strip().eq('')) &
                    (df[body_col].isna() | df[body_col].astype(str).str.strip().eq('')) &
                    (df[details_col].isna() | df[details_col].astype(str).str.strip().eq('')) &
                    (df[year_col].isna() | df[year_col].astype(str).str.strip().eq('') | 
                     df[year_col].astype(str).str.contains('invalid', case=False, na=False))
                )
                df = df[~all_empty_mask]
        
        cleaned_count = len(df)
        if original_count != cleaned_count:
            print(f"  - Cleaned: Removed {original_count - cleaned_count} completely empty entries")
        
        sheets_data[sheet_name] = df
        print(f"  - Unique {join_key}s: {df[join_key].nunique()}")
    
    # Get all unique ApplicationIds
    all_application_ids = set()
    for df in sheets_data.values():
        all_application_ids.update(df[join_key].dropna().unique())
    
    print(f"\nTotal unique {join_key}s: {len(all_application_ids)}")
    
    # Build the final structure
    print("\nBuilding final structure with nested relationships...")
    
    # Get one-to-one data (Stage 1 and Stage 2 Application)
    stage1_df = sheets_data.get('Stage 1 Registration', pd.DataFrame())
    stage2_df = sheets_data.get('Stage 2 Application', pd.DataFrame())
    
    # Get one-to-many data
    team_members_df = sheets_data.get('Stage 2 A-Other Team Members', pd.DataFrame())
    awards_df = sheets_data.get('Stage 2 A-Award Recognition', pd.DataFrame())
    media_df = sheets_data.get('Stage 2 A-Media Coverage & Pub', pd.DataFrame())
    
    # Create flat structure for Excel (all combinations of one-to-many relationships)
    print("Creating flat structure for Excel with all combinations...")
    excel_records = []
    
    for app_id in sorted(all_application_ids):
        # Get one-to-one data (same for all rows of this ApplicationId)
        base_record = {join_key: app_id}
        
        # Add Stage 1 Registration data (one-to-one)
        if not stage1_df.empty:
            stage1_row = stage1_df[stage1_df[join_key] == app_id]
            if not stage1_row.empty:
                for col in COLUMNS_TO_RETAIN:
                    if col.startswith('Stage 1 Registration_'):
                        value = stage1_row[col].iloc[0] if col in stage1_row.columns else None
                        base_record[col] = convert_value(value)
        
        # Add Stage 2 Application data (one-to-one)
        if not stage2_df.empty:
            stage2_row = stage2_df[stage2_df[join_key] == app_id]
            if not stage2_row.empty:
                for col in COLUMNS_TO_RETAIN:
                    if col.startswith('Stage 2 Application_'):
                        # Try exact match first, then try with stripped column names
                        if col in stage2_row.columns:
                            value = stage2_row[col].iloc[0]
                        else:
                            # Try to find column by stripping trailing spaces from both
                            matching_col = None
                            for df_col in stage2_row.columns:
                                if df_col.rstrip() == col.rstrip():
                                    matching_col = df_col
                                    break
                            if matching_col:
                                value = stage2_row[matching_col].iloc[0]
                            else:
                                value = None
                        base_record[col] = convert_value(value)
        
        # Get all one-to-many data for this ApplicationId
        team_rows = team_members_df[team_members_df[join_key] == app_id] if not team_members_df.empty else pd.DataFrame()
        award_rows = awards_df[awards_df[join_key] == app_id] if not awards_df.empty else pd.DataFrame()
        media_rows = media_df[media_df[join_key] == app_id] if not media_df.empty else pd.DataFrame()
        
        # Prepare lists for Cartesian product
        team_list = [team_rows.iloc[i] for i in range(len(team_rows))] if not team_rows.empty else [None]
        award_list = [award_rows.iloc[i] for i in range(len(award_rows))] if not award_rows.empty else [None]
        media_list = [media_rows.iloc[i] for i in range(len(media_rows))] if not media_rows.empty else [None]
        
        # Create all combinations (Cartesian product)
        for team_item in team_list:
            for award_item in award_list:
                for media_item in media_list:
                    record = base_record.copy()
                    
                    # Add team member data
                    if team_item is not None:
                        for col in COLUMNS_TO_RETAIN:
                            if col.startswith('Stage 2 A-Other Team Members_'):
                                value = team_item[col] if col in team_item.index else None
                                record[col] = convert_value(value)
                    else:
                        for col in COLUMNS_TO_RETAIN:
                            if col.startswith('Stage 2 A-Other Team Members_'):
                                record[col] = None
                    
                    # Add award data
                    if award_item is not None:
                        for col in COLUMNS_TO_RETAIN:
                            if col.startswith('Stage 2 A-Award Recognition_'):
                                value = award_item[col] if col in award_item.index else None
                                record[col] = convert_value(value)
                    else:
                        for col in COLUMNS_TO_RETAIN:
                            if col.startswith('Stage 2 A-Award Recognition_'):
                                record[col] = None
                    
                    # Add media coverage data
                    if media_item is not None:
                        for col in COLUMNS_TO_RETAIN:
                            if col.startswith('Stage 2 A-Media Coverage & Pub_'):
                                value = media_item[col] if col in media_item.index else None
                                record[col] = convert_value(value)
                    else:
                        for col in COLUMNS_TO_RETAIN:
                            if col.startswith('Stage 2 A-Media Coverage & Pub_'):
                                record[col] = None
                    
                    excel_records.append(record)
    
    # Create nested structure for JSON
    print("Creating nested structure for JSON...")
    json_records = []
    
    for app_id in sorted(all_application_ids):
        record = {join_key: app_id}
        
        # Add Stage 1 Registration data (one-to-one)
        if not stage1_df.empty:
            stage1_row = stage1_df[stage1_df[join_key] == app_id]
            if not stage1_row.empty:
                for col in COLUMNS_TO_RETAIN:
                    if col.startswith('Stage 1 Registration_'):
                        value = stage1_row[col].iloc[0] if col in stage1_row.columns else None
                        # Remove prefix for cleaner JSON
                        clean_col = col.replace('Stage 1 Registration_', '')
                        record[clean_col] = convert_value(value)
        
        # Add Stage 2 Application data (one-to-one)
        if not stage2_df.empty:
            stage2_row = stage2_df[stage2_df[join_key] == app_id]
            if not stage2_row.empty:
                for col in COLUMNS_TO_RETAIN:
                    if col.startswith('Stage 2 Application_'):
                        # Try exact match first, then try with stripped column names
                        if col in stage2_row.columns:
                            value = stage2_row[col].iloc[0]
                        else:
                            # Try to find column by stripping trailing spaces from both
                            matching_col = None
                            for df_col in stage2_row.columns:
                                if df_col.rstrip() == col.rstrip():
                                    matching_col = df_col
                                    break
                            if matching_col:
                                value = stage2_row[matching_col].iloc[0]
                            else:
                                value = None
                        # Remove prefix for cleaner JSON
                        clean_col = col.replace('Stage 2 Application_', '')
                        record[clean_col] = convert_value(value)
        
        # Add team members as nested array
        if not team_members_df.empty:
            team_rows = team_members_df[team_members_df[join_key] == app_id]
            team_members = []
            for _, row in team_rows.iterrows():
                team_member = {}
                for col in ONE_TO_MANY_COLUMNS['team_members']:
                    if col in team_rows.columns:
                        clean_col = col.replace('Stage 2 A-Other Team Members_', '')
                        team_member[clean_col] = convert_value(row[col])
                if any(v is not None for v in team_member.values()):  # Only add if has data
                    team_members.append(team_member)
            record['team_members'] = team_members if team_members else []
        
        # Add awards as nested array
        if not awards_df.empty:
            award_rows = awards_df[awards_df[join_key] == app_id]
            awards = []
            for _, row in award_rows.iterrows():
                award = {}
                for col in ONE_TO_MANY_COLUMNS['awards']:
                    if col in award_rows.columns:
                        clean_col = col.replace('Stage 2 A-Award Recognition_', '')
                        award[clean_col] = convert_value(row[col])
                if any(v is not None for v in award.values()):  # Only add if has data
                    awards.append(award)
            record['awards'] = awards if awards else []
        
        # Add media coverage as nested array
        if not media_df.empty:
            media_rows = media_df[media_df[join_key] == app_id]
            media_coverage = []
            for _, row in media_rows.iterrows():
                media_item = {}
                has_valid_data = False
                for col in ONE_TO_MANY_COLUMNS['media_coverage']:
                    if col in media_rows.columns:
                        clean_col = col.replace('Stage 2 A-Media Coverage & Pub_', '')
                        value = convert_value(row[col])
                        media_item[clean_col] = value
                        # Check if this field has valid data (not empty and not just "invalid date" for Year)
                        if value is not None:
                            value_str = str(value).strip()
                            if value_str != '' and not (clean_col == 'Year' and 'invalid' in value_str.lower() and len(value_str) < 20):
                                has_valid_data = True
                
                # Only add if has at least one valid field (Type, Website links, or Details)
                # Year can be "invalid date" as long as other fields are valid
                if has_valid_data:
                    media_coverage.append(media_item)
            record['media_coverage'] = media_coverage if media_coverage else []
        
        json_records.append(record)
    
    # Create DataFrame for Excel (with all columns from COLUMNS_TO_RETAIN)
    excel_df = pd.DataFrame(excel_records)
    # Ensure all columns are present (fill missing with None)
    for col in COLUMNS_TO_RETAIN:
        if col not in excel_df.columns:
            excel_df[col] = None
    
    # Reorder columns to match COLUMNS_TO_RETAIN order
    excel_df = excel_df[[col for col in COLUMNS_TO_RETAIN if col in excel_df.columns]]
    
    # Generate output filenames
    if output_file is None:
        base_name = os.path.splitext(input_file)[0]
        output_file_xlsx = f"{base_name}_final.xlsx"
        output_file_json = f"{base_name}_final.json"
    else:
        base_name = os.path.splitext(output_file)[0]
        output_file_xlsx = f"{output_file}.xlsx" if not output_file.endswith('.xlsx') else output_file
        output_file_json = f"{base_name}.json"
    
    # Save Excel file
    print(f"\nSaving Excel file: {output_file_xlsx}")
    excel_df.to_excel(output_file_xlsx, index=False, sheet_name='Final')
    
    # Save JSON file
    print(f"Saving JSON file: {output_file_json}")
    with open(output_file_json, 'w', encoding='utf-8') as f:
        json.dump(json_records, f, indent=2, ensure_ascii=False, default=str)
    
    print(f"\nFinal output complete!")
    print(f"Total ApplicationIds: {len(json_records):,}")
    print(f"Excel columns: {len(excel_df.columns)}")
    print(f"Output files:")
    print(f"  - Excel: {output_file_xlsx}")
    print(f"  - JSON: {output_file_json}")
    print(f"\nJSON structure:")
    print(f"  - One record per ApplicationId")
    print(f"  - One-to-one fields at top level")
    print(f"  - team_members: nested array")
    print(f"  - awards: nested array")
    print(f"  - media_coverage: nested array")

if __name__ == "__main__":
    input_file = "Applications_1186_final.xlsx"
    
    # Check if custom input/output files are provided
    if len(sys.argv) > 1:
        input_file = sys.argv[1]
    if len(sys.argv) > 2:
        output_file = sys.argv[2]
    else:
        output_file = None
    
    create_final_output(input_file, output_file)

