import pandas as pd
from typing import Dict, Any, Tuple

class DuplicateCleaner:
    def clean(self, df: pd.DataFrame, params: Dict[str, Any]) -> Tuple[pd.DataFrame, int]:
        """
        Deduplicates rows in a pandas DataFrame.
        Params:
            - columns (List[str]): columns to check, default None (all columns)
            - keep (str): 'first', 'last', or False. Default 'first'.
        """
        subset = params.get("columns", None)
        keep = params.get("keep", "first")
        
        # Guard against columns not present
        if subset:
            subset = [col for col in subset if col in df.columns]
            if len(subset) == 0:
                subset = None

        initial_rows = len(df)
        df_cleaned = df.drop_duplicates(subset=subset, keep=keep)
        rows_affected = initial_rows - len(df_cleaned)
        
        return df_cleaned, rows_affected
