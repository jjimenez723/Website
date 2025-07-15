import pandas as pd
import json

# Read the fresh food CSV (update the filename if needed)
df = pd.read_csv('Map/fresh_food.csv')

features = []
for _, row in df.iterrows():
    features.append({
        "type": "Feature",
        "properties": {
            "name": row['name'],
            "type": row['type']
        },
        "geometry": {
            "type": "Point",
            "coordinates": [float(row['longitude']), float(row['latitude'])]
        }
    })

geojson = {"type": "FeatureCollection", "features": features}

with open('Map/fresh_food.geojson', 'w') as f:
    json.dump(geojson, f, indent=2)

print('GeoJSON saved to Map/fresh_food.geojson') 