#!/usr/bin/env python3
"""
Script to convert PDF to Excel/CSV
Supports multiple PDF extraction methods
"""

import sys
import os
import pandas as pd
from pathlib import Path

def convert_pdf_to_excel(pdf_path, output_format='excel'):
    """
    Convert PDF to Excel or CSV
    
    Args:
        pdf_path: Path to PDF file
        output_format: 'excel' or 'csv'
    """
    pdf_path = Path(pdf_path)
    
    if not pdf_path.exists():
        print(f"Error: PDF file not found: {pdf_path}")
        return False
    
    print(f"Converting PDF: {pdf_path.name}")
    
    # Try different PDF extraction methods
    tables = None
    
    # Method 1: Try tabula-py (best for tables)
    try:
        import tabula
        print("Attempting extraction with tabula-py...")
        tables = tabula.read_pdf(str(pdf_path), pages='all', multiple_tables=True)
        if tables:
            print(f"  ✓ Extracted {len(tables)} table(s) using tabula-py")
    except ImportError:
        print("  - tabula-py not available")
    except Exception as e:
        print(f"  - tabula-py failed: {e}")
    
    # Method 2: Try pdfplumber (good for structured data)
    if not tables or len(tables) == 0:
        try:
            import pdfplumber
            print("Attempting extraction with pdfplumber...")
            tables = []
            with pdfplumber.open(str(pdf_path)) as pdf:
                for page_num, page in enumerate(pdf.pages, 1):
                    page_tables = page.extract_tables()
                    if page_tables:
                        for table in page_tables:
                            if table and len(table) > 0:
                                # Convert to DataFrame
                                df = pd.DataFrame(table[1:], columns=table[0] if table[0] else None)
                                tables.append(df)
            if tables:
                print(f"  ✓ Extracted {len(tables)} table(s) using pdfplumber")
        except ImportError:
            print("  - pdfplumber not available")
        except Exception as e:
            print(f"  - pdfplumber failed: {e}")
    
    # Method 3: Try camelot (good for tables with borders)
    if not tables or len(tables) == 0:
        try:
            import camelot
            print("Attempting extraction with camelot...")
            tables = camelot.read_pdf(str(pdf_path), pages='all')
            if tables:
                dfs = [table.df for table in tables]
                tables = dfs
                print(f"  ✓ Extracted {len(tables)} table(s) using camelot")
        except ImportError:
            print("  - camelot not available")
        except Exception as e:
            print(f"  - camelot failed: {e}")
    
    if not tables or len(tables) == 0:
        print("\nError: Could not extract tables from PDF.")
        print("Please install one of the following libraries:")
        print("  pip install tabula-py")
        print("  pip install pdfplumber")
        print("  pip install camelot-py[cv]")
        return False
    
    # Process and save tables
    base_name = pdf_path.stem
    
    if len(tables) == 1:
        # Single table - save directly
        df = tables[0]
        if output_format == 'excel':
            output_file = f"{base_name}.xlsx"
            df.to_excel(output_file, index=False, sheet_name='Data')
            print(f"\n✓ Saved to: {output_file}")
        else:
            output_file = f"{base_name}.csv"
            df.to_csv(output_file, index=False)
            print(f"\n✓ Saved to: {output_file}")
    else:
        # Multiple tables - save to Excel with multiple sheets
        if output_format == 'excel':
            output_file = f"{base_name}.xlsx"
            with pd.ExcelWriter(output_file, engine='openpyxl') as writer:
                for i, df in enumerate(tables, 1):
                    sheet_name = f'Table_{i}' if len(df.columns) > 0 else f'Sheet_{i}'
                    df.to_excel(writer, index=False, sheet_name=sheet_name)
            print(f"\n✓ Saved {len(tables)} tables to: {output_file}")
        else:
            # For CSV, save each table separately
            for i, df in enumerate(tables, 1):
                output_file = f"{base_name}_table_{i}.csv"
                df.to_csv(output_file, index=False)
                print(f"  ✓ Saved table {i} to: {output_file}")
    
    return True

if __name__ == "__main__":
    # Look for the PDF file
    pdf_name = "BI_2026_-_Phase_1_Shortlist_-_29_Nov.pdf"
    pdf_path = Path(pdf_name)
    
    if not pdf_path.exists():
        # Try to find it with different case or variations
        current_dir = Path(".")
        pdf_files = list(current_dir.glob("*shortlist*.pdf")) + list(current_dir.glob("*29_Nov*.pdf"))
        if pdf_files:
            pdf_path = pdf_files[0]
            print(f"Found PDF: {pdf_path.name}")
        else:
            print(f"Error: Could not find PDF file: {pdf_name}")
            print("\nPlease ensure the PDF file is in the current directory.")
            sys.exit(1)
    
    # Convert to Excel
    print("Converting to Excel format...\n")
    success = convert_pdf_to_excel(pdf_path, output_format='excel')
    
    if success:
        print("\nConversion complete!")
    else:
        print("\nConversion failed. Please check the error messages above.")
        sys.exit(1)

