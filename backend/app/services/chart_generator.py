import pandas as pd
import numpy as np
from typing import Dict, Any, Optional

def generate_plotly_spec(df: pd.DataFrame, chart_config: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    """
    Safely generates a Plotly JSON-serializable chart specification dictionary
    from a pandas DataFrame, complete with custom dark-themed layout matching
    the explorer system workspace design.
    """
    if not chart_config:
        return None

    chart_type = chart_config.get("type", "bar").lower()
    x_col = chart_config.get("x")
    y_col = chart_config.get("y")
    title = chart_config.get("title", f"{chart_type.capitalize()} Chart")

    if not x_col or x_col not in df.columns:
        return None

    # Limit payload sizes to keep frontend execution light
    max_scatter_points = 1000
    max_categorical_categories = 25

    # Core dark-theme styles configuration
    layout_theme = {
        "autosize": True,
        "paper_bgcolor": "rgba(30, 41, 59, 0.7)", # matches glassmorphism card
        "plot_bgcolor": "rgba(15, 23, 42, 0.5)",  # slightly darker background
        "font": {
            "family": "Inter, system-ui, sans-serif",
            "color": "#F8FAFC" # Slate 50 text
        },
        "title": {
            "text": title,
            "font": {"size": 16, "weight": "bold", "color": "#3B82F6"}
        },
        "margin": {"l": 50, "r": 30, "t": 60, "b": 50},
        "xaxis": {
            "gridcolor": "#334155", # Dark borders
            "linecolor": "#334155",
            "zerolinecolor": "#334155"
        },
        "yaxis": {
            "gridcolor": "#334155",
            "linecolor": "#334155",
            "zerolinecolor": "#334155"
        }
    }

    # Helper clean list converters to map numpy NaNs to JSON nulls
    def clean_series(series: pd.Series) -> list:
        return [None if pd.isna(v) else v for v in series.tolist()]

    data_traces = []

    try:
        if chart_type == "bar":
            if y_col and y_col in df.columns:
                # If both axes defined, aggregate data by x mean
                agg_df = df.groupby(x_col)[y_col].mean().reset_index()
                # Limit categories
                if len(agg_df) > max_categorical_categories:
                    agg_df = agg_df.sort_values(by=y_col, ascending=False).head(max_categorical_categories)
                
                data_traces.append({
                    "x": clean_series(agg_df[x_col]),
                    "y": clean_series(agg_df[y_col]),
                    "type": "bar",
                    "marker": {"color": "#3B82F6"} # Brand primary blue
                })
                layout_theme["yaxis"]["title"] = f"Average {y_col}"
            else:
                # Value counts frequency bar
                counts = df[x_col].value_counts().head(max_categorical_categories)
                data_traces.append({
                    "x": clean_series(counts.index.to_series()),
                    "y": clean_series(counts),
                    "type": "bar",
                    "marker": {"color": "#10B981"} # Accent green
                })
                layout_theme["yaxis"]["title"] = "Frequency"
            layout_theme["xaxis"]["title"] = x_col

        elif chart_type == "pie":
            counts = df[x_col].value_counts().head(10) # 10 slices max
            data_traces.append({
                "labels": clean_series(counts.index.to_series()),
                "values": clean_series(counts),
                "type": "pie",
                "hole": 0.4, # Donut chart style
                "marker": {
                    "colors": ["#3B82F6", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6", "#EC4899", "#14B8A6", "#64748B"]
                }
            })

        elif chart_type == "line":
            # If line, group by x time/indexed and average y values
            if y_col and y_col in df.columns:
                agg_df = df.groupby(x_col)[y_col].mean().reset_index()
                agg_df = agg_df.sort_values(by=x_col)
                if len(agg_df) > 100: # Limit points for line charts
                    agg_df = agg_df.sample(100).sort_values(by=x_col)
                
                data_traces.append({
                    "x": clean_series(agg_df[x_col]),
                    "y": clean_series(agg_df[y_col]),
                    "type": "scatter",
                    "mode": "lines+markers",
                    "line": {"color": "#3B82F6", "width": 2},
                    "marker": {"color": "#10B981", "size": 6}
                })
                layout_theme["yaxis"]["title"] = y_col
            else:
                # simple index trend line
                sorted_vals = df[x_col].head(200) # limit to 200 values
                data_traces.append({
                    "y": clean_series(sorted_vals),
                    "type": "scatter",
                    "mode": "lines",
                    "line": {"color": "#3B82F6"}
                })
            layout_theme["xaxis"]["title"] = x_col

        elif chart_type == "histogram":
            # Show distributions
            data_traces.append({
                "x": clean_series(df[x_col]),
                "type": "histogram",
                "nbinsx": 30,
                "marker": {"color": "#3B82F6", "line": {"color": "#0F172A", "width": 1}}
            })
            layout_theme["xaxis"]["title"] = x_col
            layout_theme["yaxis"]["title"] = "Density Count"

        elif chart_type == "scatter":
            # Needs X and Y columns
            if not y_col or y_col not in df.columns:
                y_col = df.select_dtypes(include=[np.number]).columns[0] # Fallback to first numeric column if none specified

            # Sample large datasets for scatter performance
            sample_df = df.sample(min(max_scatter_points, len(df)))
            data_traces.append({
                "x": clean_series(sample_df[x_col]),
                "y": clean_series(sample_df[y_col]),
                "type": "scatter",
                "mode": "markers",
                "marker": {
                    "color": "#10B981",
                    "size": 7,
                    "opacity": 0.7,
                    "line": {"width": 1, "color": "#0F172A"}
                }
            })
            layout_theme["xaxis"]["title"] = x_col
            layout_theme["yaxis"]["title"] = y_col

        elif chart_type == "box":
            # Optionally split box by grouping categories
            if y_col and y_col in df.columns:
                # Box of y split by x categories
                # sample for box plotting
                sample_df = df.sample(min(2000, len(df)))
                data_traces.append({
                    "x": clean_series(sample_df[x_col]),
                    "y": clean_series(sample_df[y_col]),
                    "type": "box",
                    "marker": {"color": "#8B5CF6"} # purple marker
                })
                layout_theme["xaxis"]["title"] = x_col
                layout_theme["yaxis"]["title"] = y_col
            else:
                data_traces.append({
                    "y": clean_series(df[x_col]),
                    "type": "box",
                    "marker": {"color": "#8B5CF6"}
                })
                layout_theme["yaxis"]["title"] = x_col
        else:
            return None

        return {
            "data": data_traces,
            "layout": layout_theme
        }
    except Exception as e:
        print(f"Error mapping chart config data: {e}")
        return None
