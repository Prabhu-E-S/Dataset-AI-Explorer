import pandas as pd
import numpy as np
from typing import Dict, Any

def profile_dataset(file_path: str, file_type: str) -> Dict[str, Any]:
    """
    Read CSV or Excel dataset using pandas and calculate:
    - Rows count, columns count
    - Column details: data type, missing values count, percentage, unique values count
    - Duplicate rows count
    - Numeric vs categorical columns lists
    - Memory usage in bytes
    - Descriptive stats (mean, std, min, max, quartiles for numeric; mode, value counts for categorical)
    """
    try:
        if file_type.lower() == "csv":
            # Attempt comma first, fallback to semicolon if needed, read preview or first chunk to test,
            # but for profiling we read the entire file. We can set low_memory=False to avoid mixed type warnings.
            df = pd.read_csv(file_path, low_memory=False)
        elif file_type.lower() in ("xlsx", "xls", "excel"):
            df = pd.read_excel(file_path)
        else:
            raise ValueError(f"Unsupported file type: {file_type}")
    except Exception as e:
        raise ValueError(f"Could not parse file: {str(e)}")

    # 1. Dimensions
    num_rows, num_cols = df.shape
    columns_list = list(df.columns)
    
    # 2. Memory Usage (total in bytes)
    memory_usage = int(df.memory_usage(deep=True).sum())
    
    # 3. Duplicate Rows Count
    duplicate_rows = int(df.duplicated().sum())

    # 4. Identify Numeric and Categorical Columns
    numeric_cols = []
    categorical_cols = []
    
    for col in df.columns:
        if pd.api.types.is_numeric_dtype(df[col]):
            numeric_cols.append(col)
        else:
            categorical_cols.append(col)

    # 5. Build Column Profile Information
    columns_profile = {}
    missing_total = 0

    for col in df.columns:
        col_series = df[col]
        missing_count = int(col_series.isnull().sum())
        missing_total += missing_count
        missing_pct = float((missing_count / num_rows) * 100) if num_rows > 0 else 0.0
        unique_count = int(col_series.nunique(dropna=True))
        
        # Determine logical type
        inferred_type = str(col_series.dtype)
        
        col_stats = {
            "data_type": inferred_type,
            "missing_count": missing_count,
            "missing_percentage": round(missing_pct, 2),
            "unique_values_count": unique_count,
        }

        # Calculate statistics
        if pd.api.types.is_numeric_dtype(col_series):
            # Clean numeric series from NaNs for calculations
            clean_series = col_series.dropna()
            if not clean_series.empty:
                col_stats["stats"] = {
                    "mean": float(clean_series.mean()) if not np.isnan(clean_series.mean()) else None,
                    "std": float(clean_series.std()) if len(clean_series) > 1 and not np.isnan(clean_series.std()) else None,
                    "min": float(clean_series.min()),
                    "25%": float(clean_series.quantile(0.25)),
                    "50%": float(clean_series.median()),
                    "75%": float(clean_series.quantile(0.75)),
                    "max": float(clean_series.max()),
                }
            else:
                col_stats["stats"] = {
                    "mean": None, "std": None, "min": None, "25%": None, "50%": None, "75%": None, "max": None
                }
        else:
            # Categorical/Object Statistics
            # Compute top 5 value counts
            value_counts = col_series.value_counts(dropna=True).head(5)
            top_values = []
            for val, count in value_counts.items():
                top_values.append({
                    "value": str(val),
                    "count": int(count)
                })
            
            mode_val = col_series.mode()
            mode_str = str(mode_val.iloc[0]) if not mode_val.empty else None
            
            col_stats["stats"] = {
                "top_values": top_values,
                "mode": mode_str
            }

        columns_profile[col] = col_stats

    # 6. Overall Profile Structure
    profile = {
        "dimensions": {
            "rows": num_rows,
            "columns": num_cols,
        },
        "file_type": file_type,
        "memory_usage_bytes": memory_usage,
        "duplicate_rows": duplicate_rows,
        "missing_values_total": missing_total,
        "column_lists": {
            "all": columns_list,
            "numeric": numeric_cols,
            "categorical": categorical_cols,
        },
        "columns": columns_profile
    }

    # Replace NaNs or infinite values with None to guarantee proper JSON serialization
    return json_clean(profile)

def json_clean(obj: Any) -> Any:
    """Recursively clean objects of NaN, Inf, and other non-serializable items"""
    if isinstance(obj, dict):
        return {k: json_clean(v) for k, v in obj.items()}
    elif isinstance(obj, list):
        return [json_clean(x) for x in obj]
    elif isinstance(obj, float):
        if np.isnan(obj) or np.isinf(obj):
            return None
        return obj
    elif isinstance(obj, np.integer):
        return int(obj)
    elif isinstance(obj, np.floating):
        if np.isnan(obj) or np.isinf(obj):
            return None
        return float(obj)
    elif isinstance(obj, np.bool_):
        return bool(obj)
    return obj
