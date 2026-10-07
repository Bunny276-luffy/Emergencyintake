import pandas as pd
import numpy as np
import os

def generate_synthetic_eta_data(num_samples=2000, seed=42):
    np.random.seed(seed)
    
    # distance_km
    distance_km = np.random.uniform(0.5, 40.0, num_samples)
    
    # route_distance_km is typically a bit longer than straight line distance
    route_distance_km = distance_km * np.random.uniform(1.1, 1.5, num_samples)
    
    # time_of_day (0 to 23.99)
    time_of_day = np.random.uniform(0.0, 24.0, num_samples)
    
    # day_of_week (0=Monday to 6=Sunday)
    day_of_week = np.random.randint(0, 7, num_samples)
    
    # traffic_factor (1.0 = normal, >1 means worse traffic)
    traffic_factor = np.random.uniform(0.8, 2.5, num_samples)
    
    # average_speed_kmh (baseline speed)
    average_speed_kmh = np.random.uniform(20, 80, num_samples)
    
    # road_complexity (1 to 5)
    road_complexity = np.random.randint(1, 6, num_samples)
    
    # weather_factor (1.0 = clear, >1 means rain/snow)
    weather_factor = np.random.choice([1.0, 1.2, 1.5, 2.0], num_samples, p=[0.7, 0.15, 0.1, 0.05])
    
    # ambulance_load_factor (0 to 1, how busy the fleet is)
    ambulance_load_factor = np.random.uniform(0.1, 1.0, num_samples)
    
    # pickup_delay_minutes (time taken before starting to move)
    pickup_delay_minutes = np.random.exponential(1.5, num_samples)
    
    # Calculate ETA in minutes based on distance and speed, modified by factors
    # Base travel time in hours = route_distance / average_speed
    # Base travel time in minutes = (route_distance / average_speed) * 60
    base_time_minutes = (route_distance_km / average_speed_kmh) * 60
    
    # Modified by traffic, weather, road complexity
    actual_travel_time = base_time_minutes * traffic_factor * weather_factor * (1 + (road_complexity - 1) * 0.05)
    
    # Add delay and some noise
    eta_minutes = actual_travel_time + pickup_delay_minutes + np.random.normal(0, 1.5, num_samples)
    
    # Ensure ETA is non-negative
    eta_minutes = np.maximum(eta_minutes, 1.0)
    
    df = pd.DataFrame({
        "distance_km": distance_km,
        "route_distance_km": route_distance_km,
        "time_of_day": time_of_day,
        "day_of_week": day_of_week,
        "traffic_factor": traffic_factor,
        "average_speed_kmh": average_speed_kmh,
        "road_complexity": road_complexity,
        "weather_factor": weather_factor,
        "ambulance_load_factor": ambulance_load_factor,
        "pickup_delay_minutes": pickup_delay_minutes,
        "eta_minutes": eta_minutes
    })
    
    os.makedirs(os.path.join(os.path.dirname(__file__), "..", "data"), exist_ok=True)
    out_path = os.path.join(os.path.dirname(__file__), "..", "data", "synthetic_eta_dataset.csv")
    df.to_csv(out_path, index=False)
    print(f"Generated synthetic ETA dataset with {num_samples} samples at {out_path}")

if __name__ == "__main__":
    generate_synthetic_eta_data()
