import pandas as pd
import numpy as np
from sklearn.pipeline import Pipeline
from sklearn.compose import ColumnTransformer
from sklearn.preprocessing import StandardScaler, OneHotEncoder
from sklearn.impute import SimpleImputer

def cast_bools_to_float(X):
    return np.where(pd.isna(X), np.nan, np.where(X == True, 1.0, 0.0))

def get_preprocessor():
    numeric_features = [
        "age", "heart_rate", "spo2", "systolic_bp", 
        "respiratory_rate", "temperature", "gcs", "injury_severity"
    ]
    numeric_transformer = Pipeline(steps=[
        ("imputer", SimpleImputer(strategy="median")),
        ("scaler", StandardScaler())
    ])

    categorical_features = ["incident_type"]
    categorical_transformer = Pipeline(steps=[
        ("imputer", SimpleImputer(strategy="constant", fill_value="UNKNOWN")),
        ("onehot", OneHotEncoder(handle_unknown="ignore"))
    ])

    boolean_features = ["bleeding", "breathing_difficulty", "chest_pain"]
    from sklearn.preprocessing import OrdinalEncoder
    from sklearn.preprocessing import FunctionTransformer
    boolean_transformer = Pipeline(steps=[
        ("cast_to_float", FunctionTransformer(cast_bools_to_float)),
        ("imputer", SimpleImputer(strategy="most_frequent"))
    ])

    preprocessor = ColumnTransformer(
        transformers=[
            ("num", numeric_transformer, numeric_features),
            ("cat", categorical_transformer, categorical_features),
            ("bool", boolean_transformer, boolean_features)
        ]
    )

    return preprocessor, numeric_features, categorical_features, boolean_features

def get_eta_preprocessor():
    numeric_features = [
        "distance_km", "route_distance_km", "time_of_day", 
        "traffic_factor", "average_speed_kmh", 
        "weather_factor", "ambulance_load_factor", "pickup_delay_minutes"
    ]
    numeric_transformer = Pipeline(steps=[
        ("imputer", SimpleImputer(strategy="median")),
        ("scaler", StandardScaler())
    ])

    categorical_features = ["day_of_week", "road_complexity"]
    categorical_transformer = Pipeline(steps=[
        ("imputer", SimpleImputer(strategy="most_frequent")),
        ("onehot", OneHotEncoder(handle_unknown="ignore"))
    ])

    preprocessor = ColumnTransformer(
        transformers=[
            ("num", numeric_transformer, numeric_features),
            ("cat", categorical_transformer, categorical_features)
        ]
    )

    return preprocessor, numeric_features, categorical_features
