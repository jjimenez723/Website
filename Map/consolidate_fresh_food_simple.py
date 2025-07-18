import pandas as pd
import json

def consolidate_fresh_food_simple():
    # Read the existing fresh_food.csv
    fresh_food_df = pd.read_csv('fresh_food.csv')
    
    # Read the verified fast food spots CSV
    verified_df = pd.read_csv('Verified_Newark_Fast_Food_Spots (1).csv', encoding='latin-1')
    
    # Filter verified_df to only include fresh food related types
    fresh_food_types = ['Deli', 'Bodega', 'Supermarket']
    verified_fresh = verified_df[verified_df['type'].isin(fresh_food_types)].copy()
    
    # Manual coordinates for verified locations (approximate coordinates for Newark addresses)
    manual_coordinates = {
        'Big Rocs Deli': (40.7233, -74.2136),
        'Bragman\'s Delicatessen': (40.7417, -74.1742),
        'Cooper\'s Liquors & Deli': (40.7507, -74.1981),
        'Hanna\'s Deli & Grill': (40.7417, -74.1742),
        'Hobby\'s Delicatessen & Restaurant': (40.7417, -74.1742),
        'Manny\'s Deli Restaurant': (40.7233, -74.2136),
        'Manny\'s Restaurant BBQ & Deli': (40.7233, -74.2136),
        'Manny\'s Deli & Restaurant II': (40.7507, -74.1981),
        'Sahara Deli': (40.7233, -74.2136),
        'Bodega La Chiquita': (40.7233, -74.2136),
        'Casa dPaco': (40.7233, -74.2136),
        'Fornos of Spain Restaurant': (40.7233, -74.2136),
        'La Bodega': (40.7233, -74.2136),
        'Food Depot Supermarket': (40.7507, -74.1981),
        'Golden Farm Market': (40.7233, -74.2136),
        'Market Street Traders': (40.7417, -74.1742),
        'Nevada Supermarket': (40.7417, -74.1742),
        'Norfolk Food Mart': (40.7233, -74.2136),
        'Seabra Foods': (40.7233, -74.2136),
        'ShopRite of Newark': (40.7233, -74.2136),
        'The Lion Supermarket': (40.7233, -74.2136),
        'Whole Foods Market': (40.7417, -74.1742),
        'Bergen Supermarket': (40.7233, -74.2136)
    }
    
    # Add coordinates to verified_fresh
    latitudes = []
    longitudes = []
    
    for name in verified_fresh['name']:
        if name in manual_coordinates:
            lat, lng = manual_coordinates[name]
            latitudes.append(lat)
            longitudes.append(lng)
        else:
            # Use default Newark coordinates if not found
            latitudes.append(40.7233)
            longitudes.append(-74.2136)
    
    verified_fresh['Latitude'] = latitudes
    verified_fresh['Longitude'] = longitudes
    
    # Add description column with default values
    verified_fresh['description'] = 'Fresh food location in Newark'
    verified_fresh['Distance from Rutgers 1'] = ''
    verified_fresh['Distances from Rutgers 2'] = ''
    
    # Select only the columns that exist in fresh_food.csv
    verified_fresh = verified_fresh[['name', 'type', 'Latitude', 'Longitude', 'description', 'Distance from Rutgers 1', 'Distances from Rutgers 2']]
    
    # Combine the dataframes
    consolidated_df = pd.concat([fresh_food_df, verified_fresh], ignore_index=True)
    
    # Remove duplicates based on name and coordinates
    consolidated_df = consolidated_df.drop_duplicates(subset=['name', 'Latitude', 'Longitude'], keep='first')
    
    # Remove rows with missing coordinates
    consolidated_df = consolidated_df.dropna(subset=['Latitude', 'Longitude'])
    
    # Save consolidated CSV
    consolidated_df.to_csv('consolidated_fresh_food.csv', index=False)
    print(f"Consolidated CSV saved with {len(consolidated_df)} locations")
    
    # Convert to GeoJSON
    geojson_features = []
    
    for _, row in consolidated_df.iterrows():
        feature = {
            "type": "Feature",
            "geometry": {
                "type": "Point",
                "coordinates": [float(row['Longitude']), float(row['Latitude'])]
            },
            "properties": {
                "name": str(row['name']),
                "type": str(row['type']),
                "description": str(row['description']) if pd.notna(row['description']) else "",
                "distance_rutgers_1": str(row['Distance from Rutgers 1']) if pd.notna(row['Distance from Rutgers 1']) else "",
                "distance_rutgers_2": str(row['Distances from Rutgers 2']) if pd.notna(row['Distances from Rutgers 2']) else ""
            }
        }
        geojson_features.append(feature)
    
    geojson = {
        "type": "FeatureCollection",
        "features": geojson_features
    }
    
    # Save GeoJSON
    with open('consolidated_fresh_food.geojson', 'w') as f:
        json.dump(geojson, f, indent=2)
    
    print(f"GeoJSON saved with {len(geojson_features)} features")
    
    return consolidated_df

if __name__ == "__main__":
    consolidate_fresh_food_simple() 