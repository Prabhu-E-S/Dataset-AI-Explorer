import pandas as pd
from typing import Dict, Any, Tuple

class DatatypeCleaner:
    def clean(self, df: pd.DataFrame, params: Dict[str, Any]) -> Tuple[pd.DataFrame, int]:
        """
        Downcasts numeric types, resolves boolean conventions, and eliminates constant columns.
        Params:
            - normalize_booleans (bool): Maps Y/N/True/False/1/0 to real booleans. Default True.
            - downcast_numeric (bool): Downcasts floats & ints to smaller footprint equivalents. Default True.
            - category_conversion (bool): Converts objects with low uniqueness ratios to Categorical. Default True.
            - remove_constants (bool): Drops columns containing only one unique value. Default True.
        """
        normalize_booleans = params.get("normalize_booleans", True)
        downcast_numeric = params.get("downcast_numeric", True)
        category_conversion = params.get("category_conversion", True)
        remove_constants = params.get("remove_constants", True)

        df_cleaned = df.copy()
        initial_bytes = df_cleaned.memory_usage(deep=True).sum()
        cols_originally = list(df_cleaned.columns)

        # 1. Remove constant columns
        if remove_constants:
            constant_cols = []
            for col in df_cleaned.columns:
                if df_cleaned[col].nunique(dropna=True) <= 1:
                    constant_cols.append(col)
            if constant_cols:
                df_cleaned = df_cleaned.drop(columns=constant_cols)

        # 2. Normalize typical boolean columns
        if normalize_booleans:
            bool_mapping = {
                'yes': True, 'no': False,
                'true': True, 'false': False,
                'y': True, 'n': False,
                '1': True, '0': False,
                1: True, 0: False,
                1.0: True, 0.0: False
            }
            for col in df_cleaned.columns:
                if df_cleaned[col].dtype == 'object' or pd.api.types.is_numeric_dtype(df_cleaned[col]):
                    uniq = df_cleaned[col].dropna().unique()
                    if len(uniq) > 0 and len(uniq) <= 2:
                        # Check matches typical bool values
                        uniq_lower = [str(x).lower().strip() for x in uniq]
                        if all(loc in ['yes', 'no', 'true', 'false', 'y', 'n', '1', '0'] for loc in uniq_lower):
                            df_cleaned[col] = df_cleaned[col].apply(
                                lambda val: bool_mapping[str(val).lower().strip()] if pd.notnull(val) and str(val).lower().strip() in bool_mapping else val
                            ).astype(bool)

        # 3. Downcast numeric types
        if downcast_numeric:
            for col in df_cleaned.columns:
                if pd.api.types.is_integer_dtype(df_cleaned[col]):
                    df_cleaned[col] = pd.to_numeric(df_cleaned[col], downcast='integer')
                elif pd.api.types.is_float_dtype(df_cleaned[col]):
                    df_cleaned[col] = pd.to_numeric(df_cleaned[col], downcast='float')

        # 4. Turn object text into Category type if cardinality is low
        if category_conversion:
            for col in df_cleaned.columns:
                if df_cleaned[col].dtype == 'object':
                    num_uniq = df_cleaned[col].nunique()
                    total_rows = len(df_cleaned)
                    if total_rows > 10 and (num_uniq / total_rows) < 0.5:
                        df_cleaned[col] = df_cleaned[col].astype('category')

        # Calculate affected count as column diff + memory footprints optimization ratio
        final_bytes = df_cleaned.memory_usage(deep=True).sum()
        cols_removed = len(cols_originally) - len(df_cleaned.columns)
        
        # Estimate affected changes scale (1 affected unit per column removed, plus 1 matching major downcast size reduction)
        affected = cols_removed
        memory_saved_pct = (initial_bytes - final_bytes) / max(1, initial_bytes)
        if memory_saved_pct > 0.05:
            # Let's count downcasting as modifying rows
            affected += int(len(df_cleaned) * memory_saved_pct)

        return df_cleaned, max(1, affected)
