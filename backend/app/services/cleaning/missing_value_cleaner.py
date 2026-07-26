import pandas as pd
from typing import Dict, Any, Tuple

class MissingValueCleaner:
    def clean(self, df: pd.DataFrame, params: Dict[str, Any]) -> Tuple[pd.DataFrame, int]:
        """
        Fills missing values in specified columns.
        Params:
            - columns (List[str]): columns to fill, default to all columns with missing values.
            - strategy (str): 'mean', 'median', 'mode', 'ffill', 'bfill', 'constant'. Default 'median'.
            - constant_value (Any): value to fill if strategy is 'constant'.
        """
        columns = params.get("columns", [])
        strategy = params.get("strategy", "median")
        constant_value = params.get("constant_value", None)

        if not columns:
            columns = [col for col in df.columns if df[col].isnull().any()]

        df_cleaned = df.copy()
        total_filled = 0

        for col in columns:
            if col not in df_cleaned.columns:
                continue
            
            null_count = df_cleaned[col].isnull().sum()
            if null_count == 0:
                continue
                
            total_filled += null_count
            
            # Apply fill strategy
            if strategy == 'constant':
                df_cleaned[col] = df_cleaned[col].fillna(constant_value)
            elif strategy == 'mean':
                if pd.api.types.is_numeric_dtype(df_cleaned[col]):
                    val = df_cleaned[col].mean()
                    df_cleaned[col] = df_cleaned[col].fillna(val)
                else:
                    # Fallback to mode for categorical
                    mode_val = df_cleaned[col].mode()
                    val = mode_val.iloc[0] if not mode_val.empty else ""
                    df_cleaned[col] = df_cleaned[col].fillna(val)
            elif strategy == 'median':
                if pd.api.types.is_numeric_dtype(df_cleaned[col]):
                    val = df_cleaned[col].median()
                    df_cleaned[col] = df_cleaned[col].fillna(val)
                else:
                    mode_val = df_cleaned[col].mode()
                    val = mode_val.iloc[0] if not mode_val.empty else ""
                    df_cleaned[col] = df_cleaned[col].fillna(val)
            elif strategy == 'mode':
                mode_val = df_cleaned[col].mode()
                val = mode_val.iloc[0] if not mode_val.empty else ""
                df_cleaned[col] = df_cleaned[col].fillna(val)
            elif strategy == 'ffill':
                df_cleaned[col] = df_cleaned[col].ffill().fillna("")
            elif strategy == 'bfill':
                df_cleaned[col] = df_cleaned[col].bfill().fillna("")

        return df_cleaned, total_filled
