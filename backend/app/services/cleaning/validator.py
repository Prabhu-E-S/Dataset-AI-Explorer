import pandas as pd
import re
from typing import Dict, Any, Tuple

class ValidatorCleaner:
    EMAIL_REGEX = re.compile(r'^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$')
    PHONE_REGEX = re.compile(r'^\+?[\d\s\-()]{7,15}$')

    def clean(self, df: pd.DataFrame, params: Dict[str, Any]) -> Tuple[pd.DataFrame, int]:
        """
        Validates columns containing email addresses or phone numbers.
        If an entry is invalid, replaces it with None/NaN.
        Params:
            - email_columns (List[str]): Columns to validate as emails. Default: auto-detect by header.
            - phone_columns (List[str]): Columns to validate as phone numbers. Default: auto-detect by header.
        """
        email_cols = params.get("email_columns", [])
        phone_cols = params.get("phone_columns", [])

        df_cleaned = df.copy()
        
        # Auto-detect email columns
        if not email_cols:
            email_cols = [col for col in df_cleaned.columns if 'email' in col.lower()]
            
        # Auto-detect phone columns
        if not phone_cols:
            phone_cols = [col for col in df_cleaned.columns if 'phone' in col.lower() or 'mobile' in col.lower() or 'tel' in col.lower()]

        total_invalidated = 0

        # 1. Clean Emails
        for col in email_cols:
            if col not in df_cleaned.columns or df_cleaned[col].dtype != 'object':
                continue
                
            mask = df_cleaned[col].notnull()
            def validate_email(val):
                if pd.isnull(val):
                    return val
                val_str = str(val).strip()
                if self.EMAIL_REGEX.match(val_str):
                    return val_str
                return None

            cleaned_vals = df_cleaned[col].apply(validate_email)
            comparison = (df_cleaned[col].astype(str) != cleaned_vals.astype(str)) & mask
            total_invalidated += comparison.sum()
            df_cleaned[col] = cleaned_vals

        # 2. Clean Phones
        for col in phone_cols:
            if col not in df_cleaned.columns:
                continue
                
            mask = df_cleaned[col].notnull()
            def validate_phone(val):
                if pd.isnull(val):
                    return val
                val_str = str(val).strip()
                if self.PHONE_REGEX.match(val_str):
                    return val_str
                return None

            cleaned_vals = df_cleaned[col].astype(str).apply(validate_phone)
            comparison = (df_cleaned[col].astype(str) != cleaned_vals.astype(str)) & mask
            total_invalidated += comparison.sum()
            df_cleaned[col] = cleaned_vals

        return df_cleaned, total_invalidated
