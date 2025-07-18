import pandas as pd
import requests
import time
import json

def geocode_address(address):
    """Geocode an address using OpenStreetMap Nominatim"""
    base_url = "https://nominatim.openstreetmap.org/search"
    params = {
        'q': address,
        'format': 'json',
        'limit': 1
    }
    headers = {
        'User-Agent': 'jensyjimenez723@gmail.com'  # <-- Use your info here!
    }
    try:
        response = requests.get(base_url, params=params, headers=headers)
        response.raise_for_status()
        data = response.json()
        if data:
            return float(data[0]['lat']), float(data[0]['lon'])
        else:
            return None, None
    except Exception as e:
        print(f"Error geocoding {address}: {e}")
        return None, None

# Read the fast food CSV
df = pd.read_csv('Map/fast_food.csv')

# Add new columns for latitude and longitude
df['latitude'] = None
df['longitude'] = None

print("Geocoding addresses...")
for index, row in df.iterrows():
    address = row['Address']
    print(f"Processing {index + 1}/{len(df)}: {address}")
    
    lat, lon = geocode_address(address)
    df.at[index, 'latitude'] = lat
    df.at[index, 'longitude'] = lon
    
    # Be respectful to the Nominatim service - add a delay
    time.sleep(1)

# Save the updated CSV with coordinates
df.to_csv('Map/fast_food_with_coordinates.csv', index=False)

# Also create a GeoJSON file
features = []
for _, row in df.iterrows():
    if row['latitude'] is not None and row['longitude'] is not None:
        features.append({
            "type": "Feature",
            "properties": {
                "name": row['Name'],
                "type": row['Category']
            },
            "geometry": {
                "type": "Point",
                "coordinates": [float(row['longitude']), float(row['latitude'])]
            }
        })

geojson = {"type": "FeatureCollection", "features": features}

with open('Map/fast_food.geojson', 'w') as f:
    json.dump(geojson, f, indent=2)

print(f"Processed {len(df)} addresses")
print(f"Successfully geocoded {len(features)} locations")
print("Files saved:")
print("- Map/fast_food_with_coordinates.csv (CSV with coordinates)")
print("- Map/fast_food.geojson (GeoJSON for map)") 