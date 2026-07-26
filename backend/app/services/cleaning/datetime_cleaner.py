import pandas as pd
from typing import Dict, Any, Tuple

class DatetimeCleaner:
    def clean(self, df: pd.DataFrame, params: Dict[str, Any]) -> Tuple[pd.DataFrame, int]:
        """
        Parses and standardizes datetime columns to standard ISO dates formats.
        Params:
            - columns (List[str]): Columns containing dates.
            - output_format (str): Desired string format, e.g. '%Y-%m-%d' or ISO string format (defaults to ISO string date-only).
        """
        columns = params.get("columns", [])
        output_format = params.get("output_format", "%Y-%m-%d")

        df_cleaned = df.copy()
        
        # If no columns specified, auto-detect object/string columns containing "date" or "time" in header
        if not columns:
            columns = []
            for col in df_cleaned.columns:
                if df_cleaned[col].dtype == 'object':
                    col_lower = col.lower()
                    if 'date' in col_lower or 'time' in col_lower or 'created' in col_lower:
                        columns.append(col)

        total_parsed = 0

        for col in columns:
            if col not in df_cleaned.columns:
                continue

            try:
                # Store original values
                mask = df_cleaned[col].notnull()
                inits = df_cleaned[col].copy()
                
                # Convert using pandas mixed formats
                converted = pd.to_datetime(df_cleaned[col], errors='coerce', utc=True)
                
                # If everything becomes NaT mock-revert to avoid destroying data
                if converted.isnull().sum() == len(df_cleaned) and mask.sum() > 0:
                    continue
                
                # Format output strings
                formatted = converted.dt.strftime(output_format)
                
                # Identify rows actually changed
                changed_mask = (inits.astype(str) != formatted.astype(str)) & mask
                changed_count = changed_mask.sum()
                
                # Overwrite values back, leaving NaTs
                df_cleaned[col] = formatted
                total_parsed += changed_count
            except Exception as e:
                print(f"Datetime conversion failed for column {col}: {e}")
                continue

        return df_cleaned, total_parsed
