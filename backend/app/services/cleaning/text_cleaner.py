import pandas as pd
import re
from typing import Dict, Any, Tuple

class TextCleaner:
    def clean(self, df: pd.DataFrame, params: Dict[str, Any]) -> Tuple[pd.DataFrame, int]:
        """
        Normalizes and cleans text in object/string columns.
        Params:
            - columns (List[str]): Columns to clean, defaults to all object columns.
            - trim_spaces (bool): Strips leading/trailing spaces. Default True.
            - case (str): 'lower', 'upper', 'title', or None. Default None.
            - remove_special_char (bool): If True, retains only alphanumeric and spaces. Default False.
            - remove_extra_spaces (bool): Collapse multiple inner spaces. Default True.
        """
        columns = params.get("columns", [])
        trim_spaces = params.get("trim_spaces", True)
        case = params.get("case", None)
        remove_special_char = params.get("remove_special_char", False)
        remove_extra_spaces = params.get("remove_extra_spaces", True)

        if not columns:
            columns = [col for col in df.columns if df[col].dtype == 'object']

        df_cleaned = df.copy()
        total_modified = 0

        for col in columns:
            if col not in df_cleaned.columns:
                continue

            # Ensure column is treated as string where not null
            col_series = df_cleaned[col].astype(str)
            mask = df_cleaned[col].notnull()
            
            cleaned_series = col_series.copy()
            
            if trim_spaces:
                cleaned_series = cleaned_series.str.strip()
            
            if remove_extra_spaces:
                cleaned_series = cleaned_series.apply(lambda x: re.sub(r'\s+', ' ', x) if isinstance(x, str) else x)
                
            if case == "lower":
                cleaned_series = cleaned_series.str.lower()
            elif case == "upper":
                cleaned_series = cleaned_series.str.upper()
            elif case == "title":
                cleaned_series = cleaned_series.str.title()
                
            if remove_special_char:
                cleaned_series = cleaned_series.apply(lambda x: re.sub(r'[^a-zA-Z0-9\s]', '', x) if isinstance(x, str) else x)

            # Compare to identify rows affected
            comparison = (df_cleaned[col] != cleaned_series) & mask
            affected = comparison.sum()
            
            # Put clean strings back, maintaining NaNs where active
            df_cleaned.loc[mask, col] = cleaned_series[mask]
            total_modified += affected

        return df_cleaned, total_modified
