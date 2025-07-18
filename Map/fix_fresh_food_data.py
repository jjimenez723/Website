import pandas as pd
import json
import re
from geopy.geocoders import Nominatim
from geopy.exc import GeocoderTimedOut, GeocoderUnavailable
import time

def clean_address(address):
    """Clean and format address for better geocoding"""
    if pd.isna(address) or address == '':
        return None
    
    # Remove extra spaces and normalize
    address = re.sub(r'\s+', ' ', address.strip())
    
    # Add Newark, NJ if not present
    if 'newark' not in address.lower() and 'nj' not in address.lower():
        address = f"{address}, Newark, NJ"
    
    return address

def geocode_address_safe(address, geolocator, max_retries=3):
    """Safely geocode an address with retries"""
    if not address:
        return None, None
    
    for attempt in range(max_retries):
        try:
            location = geolocator.geocode(address, timeout=10)
            if location:
                return location.latitude, location.longitude
            time.sleep(1)  # Rate limiting
        except (GeocoderTimedOut, GeocoderUnavailable) as e:
            print(f"Geocoding attempt {attempt + 1} failed for {address}: {e}")
            if attempt < max_retries - 1:
                time.sleep(2 ** attempt)  # Exponential backoff
            continue
        except Exception as e:
            print(f"Unexpected error geocoding {address}: {e}")
            break
    
    return None, None

def is_in_newark(lat, lng):
    """Check if coordinates are within Newark area (approximate bounds)"""
    if not lat or not lng:
        return False
    
    # Newark approximate bounds
    newark_bounds = {
        'min_lat': 40.70,
        'max_lat': 40.78,
        'min_lng': -74.25,
        'max_lng': -74.12
    }
    
    return (newark_bounds['min_lat'] <= lat <= newark_bounds['max_lat'] and
            newark_bounds['min_lng'] <= lng <= newark_bounds['max_lng'])

def fix_fresh_food_data():
    """Fix the fresh food data with proper geocoding and deduplication"""
    
    # Read the original fresh_food.csv
    fresh_food_df = pd.read_csv('fresh_food.csv')
    
    # Read the verified fast food spots CSV
    verified_df = pd.read_csv('Verified_Newark_Fast_Food_Spots (1).csv', encoding='latin-1')
    
    # Filter verified_df to only include fresh food related types
    fresh_food_types = ['Deli', 'Bodega', 'Supermarket']
    verified_fresh = verified_df[verified_df['type'].isin(fresh_food_types)].copy()
    
    print(f"Processing {len(fresh_food_df)} original locations and {len(verified_fresh)} verified locations")
    
    # Initialize geocoder
    geolocator = Nominatim(user_agent="newark_fresh_food_map")
    
    # Process original fresh food data
    print("Processing original fresh food data...")
    fresh_food_processed = []
    
    for idx, row in fresh_food_df.iterrows():
        name = row['name']
        lat = row['Latitude']
        lng = row['Longitude']
        
        # Fix coordinate order if needed (should be lat, lng)
        if lng > lat:  # If longitude is greater than latitude, they might be swapped
            lat, lng = lng, lat
        
        # Validate coordinates are in Newark
        if is_in_newark(lat, lng):
            fresh_food_processed.append({
                'name': name,
                'type': 'Fresh Food',
                'latitude': lat,
                'longitude': lng,
                'description': row.get('description', ''),
                'distance_rutgers_1': row.get('Distance from Rutgers 1', ''),
                'distance_rutgers_2': row.get('Distances from Rutgers 2', ''),
                'source': 'original'
            })
        else:
            print(f"Location {name} has coordinates outside Newark: {lat}, {lng}")
    
    # Process verified locations with proper geocoding
    print("Processing verified locations with geocoding...")
    verified_processed = []
    
    for idx, row in verified_fresh.iterrows():
        name = row['name']
        address = clean_address(row['address'])
        
        print(f"Geocoding: {name} - {address}")
        
        lat, lng = geocode_address_safe(address, geolocator)
        
        if lat and lng and is_in_newark(lat, lng):
            verified_processed.append({
                'name': name,
                'type': row['type'],
                'latitude': lat,
                'longitude': lng,
                'description': 'Fresh food location in Newark',
                'distance_rutgers_1': '',
                'distance_rutgers_2': '',
                'source': 'verified'
            })
            print(f"✓ Successfully geocoded: {name}")
        else:
            print(f"✗ Failed to geocode or outside Newark: {name}")
        
        time.sleep(1)  # Rate limiting
    
    # Combine all processed data
    all_locations = fresh_food_processed + verified_processed
    
    # Remove duplicates based on coordinates (within 100 meters)
    print("Removing duplicate locations...")
    unique_locations = []
    seen_coords = set()
    
    for loc in all_locations:
        lat, lng = loc['latitude'], loc['longitude']
        coord_key = f"{lat:.4f},{lng:.4f}"  # Round to ~100m precision
        
        if coord_key not in seen_coords:
            seen_coords.add(coord_key)
            unique_locations.append(loc)
        else:
            print(f"Duplicate found: {loc['name']} at {lat}, {lng}")
    
    print(f"Final count: {len(unique_locations)} unique locations")
    
    # Create DataFrame
    df = pd.DataFrame(unique_locations)
    
    # Save consolidated CSV
    df.to_csv('fixed_fresh_food.csv', index=False)
    print(f"Saved fixed CSV with {len(df)} locations")
    
    # Convert to GeoJSON
    geojson_features = []
    
    for _, row in df.iterrows():
        feature = {
            "type": "Feature",
            "geometry": {
                "type": "Point",
                "coordinates": [float(row['longitude']), float(row['latitude'])]
            },
            "properties": {
                "name": str(row['name']),
                "type": str(row['type']),
                "description": str(row['description']) if pd.notna(row['description']) else "",
                "distance_rutgers_1": str(row['distance_rutgers_1']) if pd.notna(row['distance_rutgers_1']) else "",
                "distance_rutgers_2": str(row['distance_rutgers_2']) if pd.notna(row['distance_rutgers_2']) else "",
                "source": str(row['source'])
            }
        }
        geojson_features.append(feature)
    
    geojson = {
        "type": "FeatureCollection",
        "features": geojson_features
    }
    
    # Save GeoJSON
    with open('fixed_fresh_food.geojson', 'w') as f:
        json.dump(geojson, f, indent=2)
    
    print(f"Saved GeoJSON with {len(geojson_features)} features")
    
    # Print summary
    print("\n=== SUMMARY ===")
    print(f"Original locations: {len(fresh_food_df)}")
    print(f"Verified locations: {len(verified_fresh)}")
    print(f"Successfully geocoded: {len(verified_processed)}")
    print(f"Final unique locations: {len(unique_locations)}")
    
    return df

if __name__ == "__main__":
    fix_fresh_food_data() 