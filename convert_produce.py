import os
import pandas as pd
import json

# 1) ensure the folder exists (even if you run from the “wrong” directory)
os.makedirs('public', exist_ok=True)

# 2) load your CSV (your absolute path is fine)
df = pd.read_csv(r'c:\Users\jensy\Documents\BCC\USDA\Bodega Project\Website\Fresh Produce Bodegas Master.csv')

features = []
for _, row in df.iterrows():
    name    = row['Store Name']
    address = row['Address']
    lon, lat = map(float, row['Location'].strip('()').split())
    features.append({
      "type": "Feature",
      "properties": {"name": name, "address": address, "type": "produce"},
      "geometry": {"type": "Point", "coordinates": [lon, lat]}
    })

geojson = {"type":"FeatureCollection", "features": features}

# 3) write into that freshly-made folder
with open('public/produce.geojson', 'w') as f:
    json.dump(geojson, f, indent=2)

# 4) print the path to the file
print('public/produce.geojson')