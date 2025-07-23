import os
from PIL import Image

# Source and destination directories
SRC_DIR = 'images'
DST_DIR = os.path.join(SRC_DIR, 'optimized')

# Create destination directory if it doesn't exist
os.makedirs(DST_DIR, exist_ok=True)

# Supported image extensions
EXTENSIONS = ('.jpg', '.jpeg', '.png', '.JPG', '.PNG')

# Compression settings
JPEG_QUALITY = 75  # Adjust as needed (lower = smaller file, 60-85 is typical)
PNG_OPTIMIZE = True

for filename in os.listdir(SRC_DIR):
    if not filename.endswith(EXTENSIONS):
        continue
    src_path = os.path.join(SRC_DIR, filename)
    dst_path = os.path.join(DST_DIR, filename)
    if os.path.exists(dst_path):
        print(f"Skipping already optimized: {filename}")
        continue
    try:
        with Image.open(src_path) as img:
            if img.format == 'JPEG' or filename.lower().endswith('.jpg') or filename.lower().endswith('.jpeg'):
                img.save(dst_path, 'JPEG', quality=JPEG_QUALITY, optimize=True)
            elif img.format == 'PNG' or filename.lower().endswith('.png'):
                img.save(dst_path, 'PNG', optimize=PNG_OPTIMIZE)
            print(f"Compressed: {filename}")
    except Exception as e:
        print(f"Error processing {filename}: {e}")

print("Batch compression complete. Optimized images are in 'images/optimized/'.") 