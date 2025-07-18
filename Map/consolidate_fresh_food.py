import pandas as pd
import geocoder
import json
import time

def geocode_address(address):
    """Geocode an address and return coordinates"""
    try:
        # Add Newark, NJ to the address for better geocoding
        full_address = f"{address}, Newark, NJ"
        g = geocoder.osm(full_address)
        if g.ok:
            return g.lat, g.lng
        else:
            print(f"Could not geocode: {address}")
            return None, None
    except Exception as e:
        print(f"Error geocoding {address}: {e}")
        return None, None

def consolidate_fresh_food():
    # Read the existing fresh_food.csv
    fresh_food_df = pd.read_csv('fresh_food.csv')
    
    # Read the verified fast food spots CSV
    verified_df = pd.read_csv('Verified_Newark_Fast_Food_Spots (1).csv', encoding='latin-1')
    
    # Filter verified_df to only include fresh food related types
    fresh_food_types = ['Deli', 'Bodega', 'Supermarket']
    verified_fresh = verified_df[verified_df['type'].isin(fresh_food_types)].copy()
    
    # Geocode addresses from verified_fresh
    print("Geocoding addresses from verified fast food spots...")
    latitudes = []
    longitudes = []
    
    for address in verified_fresh['address']:
        lat, lng = geocode_address(address)
        latitudes.append(lat)
        longitudes.append(lng)
        time.sleep(1)  # Rate limiting for geocoding service
    
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
                "coordinates": [row['Longitude'], row['Latitude']]
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
    consolidate_fresh_food() 