import pandas as pd
import numpy as np
import traceback
import re
from typing import Dict, Any, Union

def sanitize_pandas_code(code_str: str) -> str:
    """
    Cleans up the Python package code returned by the LLM.
    Removes markdown code blocks if present and bans system commands.
    """
    # Remove markdown formatting if any
    code_str = re.sub(r"^```python\s*", "", code_str, flags=re.IGNORECASE)
    code_str = re.sub(r"^```\s*", "", code_str, flags=re.IGNORECASE)
    code_str = re.sub(r"```$", "", code_str)
    
    # Simple check for forbidden commands/modules to secure runtime environment
    forbidden = ["os.", "sys.", "subprocess", "import shutil", "eval(", "open(", "socket", "exec(", "globals(", "locals("]
    for word in forbidden:
        if word in code_str:
            raise ValueError(f"Security Warning: Code contains a banned term '{word}'")
            
    return code_str.strip()

def execute_pandas_calculations(df: pd.DataFrame, code_str: str) -> Dict[str, Any]:
    """
    Executes pandas query mapping in a restricted scope.
    Returns calculated values or descriptive statistics.
    """
    try:
        clean_code = sanitize_pandas_code(code_str)
    except ValueError as e:
        return {
            "success": False,
            "error": str(e),
            "result_summary": "Security exception triggered"
        }
    
    # Establish dynamic sandboxed local scope
    local_scope = {
        'df': df,
        'pd': pd,
        'np': np,
        'result': None
    }
    
    # Execute calculations
    try:
        # We target code execution
        exec(clean_code, {}, local_scope)
        result = local_scope.get('result')
        
        # Format the result nicely
        if result is None:
            # Check if df was modified or if they just didn't set result
            result_summary = "Query completed. Result returned empty."
            result_formatted = ""
        elif isinstance(result, (pd.DataFrame, pd.Series)):
            # Convert NaN/Inf to float/None for serialization
            cleaned_result = result.replace({np.nan: None, np.inf: None, -np.inf: None})
            result_summary = f"Structure loaded successfully ({type(result).__name__})."
            
            if isinstance(result, pd.DataFrame):
                # Output head preview for Gemini reasoning context
                result_formatted = cleaned_result.head(30).to_dict(orient='records')
            else:
                result_formatted = cleaned_result.to_dict()
        else:
            # It's a scalar value, dictionary, or list
            result_formatted = result
            result_summary = f"Scalar calculations resulted in value: {result}"
            
        return {
            "success": True,
            "result": result_formatted,
            "result_summary": result_summary
        }
    except Exception as e:
        tb = traceback.format_exc()
        return {
            "success": False,
            "error": str(e),
            "traceback": tb,
            "result_summary": "Execution error during Pandas operations."
        }
