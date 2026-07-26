import pandas as pd
from typing import Dict, Any, Tuple

class OutlierCleaner:
    def clean(self, df: pd.DataFrame, params: Dict[str, Any]) -> Tuple[pd.DataFrame, int]:
        """
        Handles outliers in numeric columns using Interquartile Range (IQR) boundaries.
        Params:
            - columns (List[str]): Numeric columns to process. Defaults to all numeric columns.
            - strategy (str): 'clamp' (cap at bounds) or 'drop' (delete matching rows). Default 'clamp'.
        """
        columns = params.get("columns", [])
        strategy = params.get("strategy", "clamp") # 'clamp' or 'drop'

        df_cleaned = df.copy()
        
        # Identify numeric columns if empty
        if not columns:
            columns = [col for col in df_cleaned.columns if pd.api.types.is_numeric_dtype(df_cleaned[col])]

        total_affected = 0
        rows_to_drop = set()

        for col in columns:
            if col not in df_cleaned.columns:
                continue
                
            q1 = df_cleaned[col].quantile(0.25)
            q3 = df_cleaned[col].quantile(0.75)
            iqr = q3 - q1
            
            lower_bound = q1 - 1.5 * iqr
            upper_bound = q3 + 1.5 * iqr

            # Find outliers
            outliers_mask = (df_cleaned[col] < lower_bound) | (df_cleaned[col] > upper_bound)
            outliers_count = outliers_mask.sum()
            
            if outliers_count == 0:
                continue

            if strategy == 'clamp':
                total_affected += outliers_count
                df_cleaned[col] = df_cleaned[col].clip(lower=lower_bound, upper=upper_bound)
            elif strategy == 'drop':
                indices = df_cleaned.index[outliers_mask].tolist()
                rows_to_drop.update(indices)

        if strategy == 'drop' and rows_to_drop:
            total_affected = len(rows_to_drop)
            df_cleaned = df_cleaned.drop(index=list(rows_to_drop))

        return df_cleaned, total_affected
