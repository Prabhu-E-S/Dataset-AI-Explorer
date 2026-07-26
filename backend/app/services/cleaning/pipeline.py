import pandas as pd
from typing import Dict, Any, List, Tuple

from app.services.cleaning.duplicate_cleaner import DuplicateCleaner
from app.services.cleaning.missing_value_cleaner import MissingValueCleaner
from app.services.cleaning.datatype_cleaner import DatatypeCleaner
from app.services.cleaning.text_cleaner import TextCleaner
from app.services.cleaning.outlier_cleaner import OutlierCleaner
from app.services.cleaning.datetime_cleaner import DatetimeCleaner
from app.services.cleaning.validator import ValidatorCleaner

class CleaningPipeline:
    def __init__(self):
        # Register cleaner handlers
        self.cleaners = {
            "duplicate_cleaner": DuplicateCleaner(),
            "missing_value_cleaner": MissingValueCleaner(),
            "datatype_cleaner": DatatypeCleaner(),
            "text_cleaner": TextCleaner(),
            "outlier_cleaner": OutlierCleaner(),
            "datetime_cleaner": DatetimeCleaner(),
            "validator": ValidatorCleaner()
        }

    def execute(self, df: pd.DataFrame, operations: Dict[str, Any]) -> Tuple[pd.DataFrame, List[Dict[str, Any]]]:
        """
        Runs clean steps in sequence.
        operations parameter structure:
        {
            "duplicate_cleaner": true or {"columns": [...], "keep": "first"},
            "missing_value_cleaner": {"strategy": "median"},
            ...
        }
        Returns:
            - df_cleaned (pd.DataFrame)
            - applied_operations (List[dict]): logs specifying operations applied and rows affected.
        """
        df_cleaned = df.copy()
        applied_operations = []

        # Order matters!
        # Standard sequential flow:
        # 1. Duplicates removal
        # 2. Text clean conversion
        # 3. Email & phone value validations
        # 4. Standardize mixed datetimes
        # 5. Handle numerical outliers
        # 6. Fill missing values (using mean/median)
        # 7. Convert types & Downcast memory size footprint
        clean_order = [
            "duplicate_cleaner",
            "text_cleaner",
            "validator",
            "datetime_cleaner",
            "outlier_cleaner",
            "missing_value_cleaner",
            "datatype_cleaner"
        ]

        for cleaner_name in clean_order:
            if cleaner_name not in operations:
                continue

            config = operations[cleaner_name]
            # If set to False or not true-ish, skip
            if not config:
                continue
                
            cleaner = self.cleaners.get(cleaner_name)
            if not cleaner:
                continue

            # Ensure config is dict params mapping
            params = config if isinstance(config, dict) else {}
            
            try:
                df_cleaned, rows_affected = cleaner.clean(df_cleaned, params)
                applied_operations.append({
                    "cleaner_name": cleaner_name,
                    "parameters": params,
                    "rows_affected": int(rows_affected)
                })
            except Exception as e:
                print(f"Exception during cleaner running step {cleaner_name}: {e}")
                continue

        return df_cleaned, applied_operations
