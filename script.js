// Declare all map layer variables at the top
let produceHeat, fastFoodHeat, produceCluster, fastFoodCluster;
let produceHeatDataOriginal = [], fastFoodHeatDataOriginal = [];

document.addEventListener('DOMContentLoaded', function() {
  if (typeof L !== 'undefined' && document.getElementById('map')) {
    // Define bounds for Newark area
    const newarkBounds = L.latLngBounds(
      [40.70, -74.25],  // Southwest corner
      [40.58, -72.12]   // Northeast corner
    );
    // 1) Initialize map
    const map = L.map('map', {
      minZoom: 12,
      maxZoom: 16,
      center: [40.7357, -74.1724],
      zoom: 13,
      maxBounds: L.latLngBounds([40.65, -74.30], [40.85, -74.05]),
      maxBoundsViscosity: 1.0,
      scrollWheelZoom: false // Disable scroll wheel zoom
    });
    window.map = map;

    // Add the base tile layer
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors'
    }).addTo(map);

    // --- RE-ENABLED: overlays, heatmaps, clusters, GeoJSON, etc. ---

    // Helper to update heatmap options if visible (moved to global scope)
    function updateHeatmapOptions() {
      if (!showHeatmap) return;
      const intensitySlider = document.getElementById('intensitySlider');
      const sizeSlider = document.getElementById('sizeSlider');
      const intensity = intensitySlider ? parseFloat(intensitySlider.value) : 1;
      const size = sizeSlider ? parseInt(sizeSlider.value, 10) : 6;
      
      // Debug logging
      console.log('Slider values:', { intensity, size });
      console.log('Intensity slider element:', intensitySlider);
      console.log('Size slider element:', sizeSlider);
      
      // Update produce heatmap
      if (produceHeat && produceHeatDataOriginal.length > 0) {
        produceHeat.setLatLngs(produceHeatDataOriginal);
        produceHeat.setOptions({ radius: size });
      }
      // Update fast food heatmap
      if (fastFoodHeat && fastFoodHeatDataOriginal.length > 0) {
        fastFoodHeat.setLatLngs(fastFoodHeatDataOriginal);
        fastFoodHeat.setOptions({ radius: size });
      }
      // Set canvas opacity for both heatmaps
      setTimeout(() => {
        setHeatmapCanvasOpacity(intensity);
        disconnectHeatmapObserver();
        observeHeatmapCanvas(intensity);
      }, 0);
    }

    // Helper to set heatmap canvas opacity (moved to global scope)
    function setHeatmapCanvasOpacity(opacity) {
      const mapDiv = document.getElementById('map');
      if (!mapDiv) return;
      // Find all canvas elements inside the leaflet-overlay-pane (where Leaflet.heat draws)
      const canvases = mapDiv.querySelectorAll('div.leaflet-overlay-pane > canvas');
      canvases.forEach(canvas => {
        canvas.style.opacity = opacity;
      });
    }

    // MutationObserver to re-apply opacity when heatmap canvas is added/replaced (moved to global scope)
    function observeHeatmapCanvas(intensity) {
      const mapDiv = document.getElementById('map');
      if (!mapDiv) return;
      const overlayPane = mapDiv.querySelector('div.leaflet-overlay-pane');
      if (!overlayPane) return;
      const observer = new MutationObserver(() => {
        setHeatmapCanvasOpacity(intensity);
      });
      observer.observe(overlayPane, { childList: true, subtree: false });
      // Store observer for later disconnect if needed
      window._heatmapObserver = observer;
    }
    
    function disconnectHeatmapObserver() {
      if (window._heatmapObserver) {
        window._heatmapObserver.disconnect();
        window._heatmapObserver = null;
      }
    }

    // Wait for DOM to be fully loaded before accessing slider elements
    function initializeSliders() {
      // 1. Get the slider element
      const intensitySlider = document.getElementById('intensitySlider');
      const sizeSlider = document.getElementById('sizeSlider');

      if (!intensitySlider || !sizeSlider) {
        console.error('Slider elements not found. Retrying in 100ms...');
        setTimeout(initializeSliders, 100);
        return;
      }

      console.log('Slider elements found:', { intensitySlider, sizeSlider });

      // Also re-apply opacity after map events that could redraw the heatmap
      if (typeof map !== 'undefined') {
        map.on('layeradd layerremove zoomend moveend', () => {
          if (showHeatmap && intensitySlider) {
            setTimeout(() => setHeatmapCanvasOpacity(parseFloat(intensitySlider.value)), 0);
          }
        });
      }

      // 2. Add an event listener for input changes
      if (intensitySlider) {
        intensitySlider.addEventListener('input', function() {
          updateHeatmapOptions();
        });
      }

      // 3. Add an event listener for the size slider
      if (sizeSlider) {
        sizeSlider.addEventListener('input', function() {
          updateHeatmapOptions();
        });
      }
    }

    // Initialize sliders after a short delay to ensure DOM is ready
    setTimeout(initializeSliders, 100);

    // 4) Load local produce.geojson
    // When creating the heatmap layers, use the same default as the slider (e.g., 40)
    fetch('produce.geojson')
      .then(r => r.json())
      .then(data => {
        // heatmap data
        produceHeatDataOriginal = data.features.map(f => [f.geometry.coordinates[1], f.geometry.coordinates[0], 0.5]);
        produceHeat = L.heatLayer(produceHeatDataOriginal, { radius: 40, gradient: {0.4: 'blue', 1: 'cyan'} }).addTo(map);

        // clusters
        produceCluster = L.markerClusterGroup({ chunkedLoading: true });
        data.features.forEach(f => {
          const [lon, lat] = f.geometry.coordinates;
          const m = L.circleMarker([lat, lon], { radius: 6, color: 'blue' })
            .bindPopup(`<strong>${f.properties.name}</strong><br>${f.properties.address}
                        <br><a href="https://www.google.com/maps/dir/?api=1&destination=${lat},${lon}"
                           target="_blank">Directions</a>`);
          produceCluster.addLayer(m);
        });
        // After initializing, sync heatmap with slider value
        setTimeout(() => {
          updateHeatmapOptions();
          updateLayerMode();
        }, 200);
      });

    // 5) Fetch fast food from Overpass
    const overpassQ = `
      [out:json][timeout:25];
      area[name="Newark"]->.a;
      node["amenity"="fast_food"](area.a);
      out center;
    `;
    fetch('https://overpass-api.de/api/interpreter', {
      method: 'POST',
      body: overpassQ
    })
      .then(r => r.json())
      .then(osm => {
        fastFoodHeatDataOriginal = [];
        fastFoodCluster = L.markerClusterGroup({ chunkedLoading: true });
        osm.elements.forEach(el => {
          const lat = el.lat || el.center.lat;
          const lon = el.lon || el.center.lon;
          fastFoodHeatDataOriginal.push([lat, lon, 0.5]);
          const name = el.tags.name || 'Fast Food';
          const addr = [el.tags['addr:street'], el.tags['addr:housenumber'], el.tags['addr:city']]
            .filter(Boolean).join(' ');
          const m = L.circleMarker([lat, lon], { radius: 6, color: 'red' })
            .bindPopup(`<strong>${name}</strong><br>${addr}
                        <br><a href="https://www.google.com/maps/dir/?api=1&destination=${lat},${lon}"
                           target="_blank">Directions</a>`);
          fastFoodCluster.addLayer(m);
        });
        fastFoodHeat = L.heatLayer(fastFoodHeatDataOriginal, { radius: 40, gradient: {0.4:'red',1:'orange'} }).addTo(map);
        setTimeout(() => {
          updateHeatmapOptions();
          updateLayerMode();
        }, 200);
      });

    // 6) Distance filter
    const filterBtn = document.getElementById('filterBtn');
    if (filterBtn) {
      filterBtn.onclick = () => {
        const addr = document.getElementById('address').value;
        const km   = parseFloat(document.getElementById('radius').value);
        if (!addr) return alert('Enter an address.');
        fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(addr)}`)
          .then(r => r.json())
          .then(res => {
            if (!res.length) return alert('Address not found.');
            const { lat, lon } = res[0];
            const center = L.latLng(lat, lon);
            map.setView(center, 14);
            L.circle(center, { radius: km*1000, color: '#333', dashArray: '4' }).addTo(map);
            [produceCluster, fastFoodCluster].forEach(cl => {
              cl.clearLayers();
              cl.eachLayer(m => {
                if (center.distanceTo(m.getLatLng()) <= km*1000) {
                  cl.addLayer(m);
                }
              });
            });
          });
      };
    }

    // 7) Accessibility toggle
    const accessToggle = document.getElementById('accessToggle');
    if (accessToggle) {
      accessToggle.onchange = e => {
        if (e.target.checked) {
          map.removeLayer(osmStandard);
          osmGray.addTo(map);
          produceHeat.setOptions({ gradient: {0.4:'#00429d',1:'#73a2c6'} });
          fastFoodHeat.setOptions({ gradient: {0.4:'#b10026',1:'#f4a582'} });
        } else {
          map.removeLayer(osmGray);
          osmStandard.addTo(map);
          produceHeat.setOptions({ gradient: {0.4:'blue',1:'cyan'} });
          fastFoodHeat.setOptions({ gradient: {0.4:'red',1:'orange'} });
        }
      };
    }

    // After your map and layers are initialized...

    // 1. Add Leaflet legend control
    const legendControl = L.control({ position: 'bottomleft' });
    legendControl.onAdd = function(map) {
      const div = L.DomUtil.create('div', 'map-legend');
      div.innerHTML = `
        <div><span class="legend-color" style="background:#2563eb"></span> Fresh Food (marker/heat)</div>
        <div><span class="legend-color" style="background:#e11d48"></span> Fast Food (marker/heat)</div>
        <div><span class="legend-line" style="border-color:#008000"></span> Newark boundary</div>
        <div><span class="legend-circle"></span> Filter radius</div>
        <div><span class="legend-cluster"></span> Cluster: Multiple locations</div>
      `;
      return div;
    };
    legendControl.addTo(map);

    // Remove html2canvas export button and logic
    const exportImgLegendBtn = document.getElementById('exportImgLegendBtn');
    if (exportImgLegendBtn) exportImgLegendBtn.remove();

    // 4. Update size slider to control heatmap radius
    // This block is now redundant as sizeSlider is handled by updateHeatmapOptions
    // if (sizeSlider) {
    //   sizeSlider.addEventListener('input', function() {
    //     const value = parseInt(this.value, 10);
    //     // Update heatmap radius
    //     if (produceHeat) produceHeat.setOptions({ radius: value });
    //     if (fastFoodHeat) fastFoodHeat.setOptions({ radius: value });
    //     // Helper to update cluster
    //     function updateCluster(cluster, color) {
    //       if (!cluster) return;
    //       const newMarkers = [];
    //       cluster.eachLayer(marker => {
    //         if (marker instanceof L.CircleMarker) {
    //           const latlng = marker.getLatLng();
    //           const popup = marker.getPopup();
    //           const newMarker = L.circleMarker(latlng, {
    //             radius: value,
    //             color: color,
    //             fillOpacity: marker.options.fillOpacity,
    //             opacity: marker.options.opacity
    //           });
    //           if (popup) newMarker.bindPopup(popup.getContent());
    //           newMarkers.push(newMarker);
    //         }
    //       });
    //       cluster.clearLayers();
    //       newMarkers.forEach(m => cluster.addLayer(m));
    //     }
    //     updateCluster(produceCluster, 'blue');
    //     updateCluster(fastFoodCluster, 'red');
    //   });
    // }

    // 8) Display Newark border from municipal boundaries GeoJSON

    // 9) Layer toggles for checkboxes
    const produceToggle = document.getElementById('produceToggle');
    const fastfoodToggle = document.getElementById('fastfoodToggle');

    function updateProduceLayer() {
      if (!produceHeat || !produceCluster) return;
      if (produceToggle && produceToggle.checked) {
        produceHeat.addTo(map);
        produceCluster.addTo(map);
      } else {
        map.removeLayer(produceHeat);
        map.removeLayer(produceCluster);
      }
    }
    function updateFastFoodLayer() {
      if (!fastFoodHeat || !fastFoodCluster) return;
      if (fastfoodToggle && fastfoodToggle.checked) {
        fastFoodHeat.addTo(map);
        fastFoodCluster.addTo(map);
      } else {
        map.removeLayer(fastFoodHeat);
        map.removeLayer(fastFoodCluster);
      }
    }
    if (produceToggle) produceToggle.addEventListener('change', updateProduceLayer);
    if (fastfoodToggle) fastfoodToggle.addEventListener('change', updateFastFoodLayer);

    // Ensure layers are updated after data loads
    function tryInitLayerToggles() {
      updateProduceLayer();
      updateFastFoodLayer();
    }
    // After produce loads
    fetch('produce.geojson')
      .then(r => r.json())
      .then(data => {
        // ... existing code ...
        tryInitLayerToggles();
      });
    // After fast food loads
    fetch('https://overpass-api.de/api/interpreter', {
      method: 'POST',
      body: overpassQ
    })
      .then(r => r.json())
      .then(osm => {
        // ... existing code ...
        tryInitLayerToggles();
      });

    // Center/Radius Filter Logic
    const addressInput = document.getElementById('addressInput');
    const latInput = document.getElementById('latInput');
    const lngInput = document.getElementById('lngInput');
    const radiusInput = document.getElementById('radiusInput');
    const centerFilterBtn = document.getElementById('centerFilterBtn');
    let radiusCircle = null;
    let newarkPolygon = null;

    // Helper: Check if a point is inside Newark polygon
    function isInNewark(lat, lng) {
      if (!newarkPolygon) return true; // fallback: allow all if not loaded
      return leafletPip.pointInLayer([lng, lat], newarkPolygon).length > 0;
    }

    // Helper: Filter and update layers
    function filterLocations(center, radiusKm) {
      // Remove previous circle
      if (radiusCircle) map.removeLayer(radiusCircle);
      radiusCircle = L.circle(center, { radius: radiusKm * 1000, color: '#333', dashArray: '4' }).addTo(map);

      // Filter clusters
      if (produceCluster) {
        produceCluster.clearLayers();
        produceHeat.setLatLngs([]);
        fetch('produce.geojson')
          .then(r => r.json())
          .then(data => {
            const filtered = data.features.filter(f => {
              const [lon, lat] = f.geometry.coordinates;
              return center.distanceTo([lat, lon]) <= radiusKm * 1000 && isInNewark(lat, lon);
            });
            filtered.forEach(f => {
              const [lon, lat] = f.geometry.coordinates;
              const m = L.circleMarker([lat, lon], { radius: 6, color: 'blue' })
                .bindPopup(`<strong>${f.properties.name}</strong><br>${f.properties.address}`);
              produceCluster.addLayer(m);
            });
            // Update heatmap
            const pHeat = filtered.map(f => [f.geometry.coordinates[1], f.geometry.coordinates[0], 0.5]);
            produceHeat.setLatLngs(pHeat);
          });
      }
      if (fastFoodCluster) {
        fastFoodCluster.clearLayers();
        fastFoodHeat.setLatLngs([]);
        // Re-fetch fast food data
        fetch('https://overpass-api.de/api/interpreter', {
          method: 'POST',
          body: overpassQ
        })
          .then(r => r.json())
          .then(osm => {
            const filtered = osm.elements.filter(el => {
              const lat = el.lat || el.center.lat;
              const lon = el.lon || el.center.lon;
              return center.distanceTo([lat, lon]) <= radiusKm * 1000 && isInNewark(lat, lon);
            });
            filtered.forEach(el => {
              const lat = el.lat || el.center.lat;
              const lon = el.lon || el.center.lon;
              const name = el.tags.name || 'Fast Food';
              const addr = [el.tags['addr:street'], el.tags['addr:housenumber'], el.tags['addr:city']].filter(Boolean).join(' ');
              const m = L.circleMarker([lat, lon], { radius: 6, color: 'red' })
                .bindPopup(`<strong>${name}</strong><br>${addr}`);
              fastFoodCluster.addLayer(m);
            });
            // Update heatmap
            const ffHeatData = filtered.map(el => [el.lat || el.center.lat, el.lon || el.center.lon, 0.5]);
            fastFoodHeat.setLatLngs(ffHeatData);
          });
      }
    }

    // Load Newark polygon for boundary filter
    fetch('newark_boundary_corrected.geojson')
      .then(r => r.json())
      .then(geojson => {
        const newarkFeature = geojson.features.find(f =>
          f.properties && f.properties.NAME && f.properties.NAME.toLowerCase() === 'newark'
        );
        if (newarkFeature) {
          newarkPolygon = L.geoJSON(newarkFeature, { style: { opacity: 0 } }).addTo(map);
        }
      });

    // Center/Filter button logic
    if (centerFilterBtn) {
      centerFilterBtn.onclick = () => {
        let center = null;
        if (latInput.value && lngInput.value) {
          center = L.latLng(parseFloat(latInput.value), parseFloat(lngInput.value));
          map.setView(center, 14);
        } else if (addressInput.value) {
          fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(addressInput.value)}`)
            .then(r => r.json())
            .then(res => {
              if (!res.length) return alert('Address not found.');
              center = L.latLng(res[0].lat, res[0].lon);
              map.setView(center, 14);
              filterLocations(center, parseFloat(radiusInput.value));
            });
          return;
        } else {
          alert('Enter an address or latitude/longitude.');
          return;
        }
        filterLocations(center, parseFloat(radiusInput.value));
      };
    }

    // leaflet-pip for point-in-polygon
    // Add leaflet-pip library via CDN in map.html:
    // <script src="https://unpkg.com/leaflet-pip/leaflet-pip.min.js"></script>

    // Layer/Border Toggle Logic
    const layerModeBtn = document.getElementById('layerModeBtn');
    const borderToggleBtn = document.getElementById('borderToggleBtn');
    let showHeatmap = true;
    let showBorder = true;
    let newarkBorderLayer = null;

    // Helper: Show/hide heatmap or clusters
    function updateLayerMode() {
      console.log('[updateLayerMode] showHeatmap:', showHeatmap);
      if (showHeatmap) {
        if (produceHeat) {
          produceHeat.addTo(map);
          console.log('[updateLayerMode] produceHeat added');
        }
        if (fastFoodHeat) {
          fastFoodHeat.addTo(map);
          console.log('[updateLayerMode] fastFoodHeat added');
        }
        // Keep clusters visible for export
        if (produceCluster && !window.isExporting) {
          map.removeLayer(produceCluster);
          console.log('[updateLayerMode] produceCluster removed');
        }
        if (fastFoodCluster && !window.isExporting) {
          map.removeLayer(fastFoodCluster);
          console.log('[updateLayerMode] fastFoodCluster removed');
        }
        if (layerModeBtn) layerModeBtn.textContent = 'Switch to Cluster View';
        // Force re-apply heatmap options after a short delay to ensure layers are added
        setTimeout(() => {
          updateHeatmapOptions();
        }, 100);
      } else {
        if (produceCluster) {
          produceCluster.addTo(map);
          console.log('[updateLayerMode] produceCluster added');
        }
        if (fastFoodCluster) {
          fastFoodCluster.addTo(map);
          console.log('[updateLayerMode] fastFoodCluster added');
        }
        if (produceHeat) {
          map.removeLayer(produceHeat);
          console.log('[updateLayerMode] produceHeat removed');
        }
        if (fastFoodHeat) {
          map.removeLayer(fastFoodHeat);
          console.log('[updateLayerMode] fastFoodHeat removed');
        }
        if (layerModeBtn) layerModeBtn.textContent = 'Switch to Heatmap View';
      }
    }

    // Helper: Show/hide Newark border
    function updateBorder() {
      if (showBorder) {
        if (newarkBorderLayer) newarkBorderLayer.addTo(map);
        if (borderToggleBtn) borderToggleBtn.textContent = 'Hide Newark Border';
      } else {
        if (newarkBorderLayer) map.removeLayer(newarkBorderLayer);
        if (borderToggleBtn) borderToggleBtn.textContent = 'Show Newark Border';
      }
    }

    // Load Newark border for toggling
    fetch('newark_boundary_corrected.geojson')
      .then(r => r.json())
      .then(geojson => {
        const newarkFeature = geojson.features.find(f =>
          f.properties && f.properties.NAME && f.properties.NAME.toLowerCase() === 'newark'
        );
        if (newarkFeature) {
          newarkBorderLayer = L.geoJSON(newarkFeature, {
            style: {
              color: '#008000',
              weight: 4,
              fillColor: '#008000',
              fillOpacity: 0.04
            }
          });
          if (showBorder) newarkBorderLayer.addTo(map);
        }
      });

    if (layerModeBtn) {
      layerModeBtn.onclick = () => {
        showHeatmap = !showHeatmap;
        updateLayerMode();
      };
    }
    if (borderToggleBtn) {
      borderToggleBtn.onclick = () => {
        showBorder = !showBorder;
        updateBorder();
      };
    }
    // Initial state
    updateLayerMode();
    updateBorder();

    // Export/Share/Print Logic
    const exportImgBtn = document.getElementById('exportImgBtn');
    const shareLinkBtn = document.getElementById('shareLinkBtn');
    const printBtn = document.getElementById('printBtn');
    const legendPositionSelect = document.getElementById('legendPosition');
    const exportSpinner = document.getElementById('exportSpinner');
    let isExporting = false;

    console.log('Export button element:', exportImgBtn);
    console.log('Share button element:', shareLinkBtn);
    console.log('Print button element:', printBtn);

    // Control panel toggle logic
    const controlPanel = document.getElementById('control-panel');
    const controlPanelToggle = document.getElementById('control-panel-toggle');
    if (controlPanel && controlPanelToggle) {
      controlPanelToggle.onclick = () => {
        controlPanel.classList.toggle('collapsed');
        // Move the toggle button to the correct side if needed
        // (No DOM move needed if using adjacent sibling selector in CSS)
        if (typeof map !== 'undefined') {
          setTimeout(() => map.invalidateSize(), 350);
        }
      };
    }
    // Optionally collapse by default on mobile
    if (window.innerWidth < 700) {
      controlPanel.classList.add('collapsed');
    }
    window.addEventListener('resize', () => {
      if (window.innerWidth < 700) {
        controlPanel.classList.add('collapsed');
      } else {
        controlPanel.classList.remove('collapsed');
      }
    });

    // Update the sizeSlider min/max for heatmap marker size
    const sizeSlider = document.getElementById('sizeSlider');
    if (sizeSlider) {
      sizeSlider.min = 5;
      sizeSlider.max = 60;
    }

    // --- Export logic: html2canvas only, no leaflet-image ---
    if (exportImgBtn) {
      exportImgBtn.onclick = () => {
        exportImgBtn.setAttribute('disabled', 'disabled');
        if (exportSpinner) exportSpinner.style.display = 'block';
        // Hide control panel for export
        controlPanel.classList.add('collapsed');
        // Force map to resize after panel collapse
        setTimeout(() => {
          map.invalidateSize();
          // Remove overlays for export
          let borderWasVisible = false, radiusWasVisible = false, polygonWasVisible = false;
          if (typeof newarkBorderLayer !== 'undefined' && newarkBorderLayer) {
            borderWasVisible = map.hasLayer(newarkBorderLayer);
            map.removeLayer(newarkBorderLayer);
          }
          if (typeof radiusCircle !== 'undefined' && radiusCircle) {
            radiusWasVisible = map.hasLayer(radiusCircle);
            map.removeLayer(radiusCircle);
          }
          if (typeof newarkPolygon !== 'undefined' && newarkPolygon) {
            polygonWasVisible = map.hasLayer(newarkPolygon);
            map.removeLayer(newarkPolygon);
          }
          // Wait longer for overlays to redraw
          setTimeout(() => {
            // Hide specific legend items for export
            const legend = document.querySelector('.map-legend');
            let hiddenLegendItems = [];
            if (legend) {
              hiddenLegendItems = Array.from(legend.children).filter(div => {
                return div.textContent.includes('Newark boundary') ||
                       div.textContent.includes('Filter radius') ||
                       div.textContent.includes('Cluster: Multiple locations');
              });
              hiddenLegendItems.forEach(div => div.style.display = 'none');
            }
            // Add a temporary title for export
            const mapContainer = document.getElementById('map');
            const tempTitle = document.createElement('div');
            tempTitle.style.cssText = `
              position: absolute;
              top: 1.5rem;
              left: 50%;
              transform: translateX(-50%);
              background: rgba(255,255,255,0.95);
              padding: 8px 16px;
              border-radius: 8px;
              font-weight: bold;
              font-size: 16px;
              color: #2563eb;
              z-index: 2002;
              box-shadow: 0 2px 8px rgba(0,0,0,0.1);
            `;
            tempTitle.textContent = 'Newark Food Access Map';
            mapContainer.appendChild(tempTitle);
            html2canvas(mapContainer, {
              backgroundColor: '#ffffff',
              scale: 2,
              useCORS: true,
              allowTaint: true,
              foreignObjectRendering: false,
              logging: false,
              width: mapContainer.offsetWidth,
              height: mapContainer.offsetHeight
            }).then(function(canvas) {
              // Download the image
              const link = document.createElement('a');
              link.download = 'newark-food-map-export.png';
              link.href = canvas.toDataURL();
              link.click();
              // Remove temporary title
              if (tempTitle && tempTitle.parentNode) {
                tempTitle.parentNode.removeChild(tempTitle);
              }
              // Restore legend items
              hiddenLegendItems.forEach(div => div.style.display = '');
              // Restore overlays
              if (borderWasVisible && typeof newarkBorderLayer !== 'undefined' && newarkBorderLayer) {
                map.addLayer(newarkBorderLayer);
              }
              if (radiusWasVisible && typeof radiusCircle !== 'undefined' && radiusCircle) {
                map.addLayer(radiusCircle);
              }
              if (polygonWasVisible && typeof newarkPolygon !== 'undefined' && newarkPolygon) {
                map.addLayer(newarkPolygon);
              }
              if (exportSpinner) exportSpinner.style.display = 'none';
              exportImgBtn.removeAttribute('disabled');
              controlPanel.classList.remove('collapsed');
            }).catch(function(error) {
              if (tempTitle && tempTitle.parentNode) {
                tempTitle.parentNode.removeChild(tempTitle);
              }
              // Restore legend items
              hiddenLegendItems.forEach(div => div.style.display = '');
              // Restore overlays
              if (borderWasVisible && typeof newarkBorderLayer !== 'undefined' && newarkBorderLayer) {
                map.addLayer(newarkBorderLayer);
              }
              if (radiusWasVisible && typeof radiusCircle !== 'undefined' && radiusCircle) {
                map.addLayer(radiusCircle);
              }
              if (polygonWasVisible && typeof newarkPolygon !== 'undefined' && newarkPolygon) {
                map.addLayer(newarkPolygon);
              }
              if (exportSpinner) exportSpinner.style.display = 'none';
              exportImgBtn.removeAttribute('disabled');
              controlPanel.classList.remove('collapsed');
              alert('Export failed: ' + error.message);
            });
          }, 1500); // Wait 1500ms after invalidateSize and overlay redraw
        }, 350); // Wait 350ms for panel transition
      };
    }
    if (shareLinkBtn) {
      shareLinkBtn.onclick = () => {
        const url = window.location.href;
        if (navigator.share) {
          navigator.share({ title: document.title, url });
        } else if (navigator.clipboard) {
          navigator.clipboard.writeText(url).then(() => {
            alert('Map link copied to clipboard!');
          }, () => {
            prompt('Copy this link:', url);
          });
        } else {
          prompt('Copy this link:', url);
        }
      };
    }
    // Improve print centering
    if (printBtn) {
      printBtn.onclick = () => {
        const prevShowHeatmap = showHeatmap;
        const prevShowBorder = showBorder;
        const prevCenter = map.getCenter();
        const prevZoom = map.getZoom();
        showHeatmap = true;
        showBorder = true;
        updateLayerMode();
        updateBorder();
        // Use far right center and zoom for print
        const printCenter = [40.7357, -734.13]; // Much further east
        const printZoom = 13;
        setTimeout(() => {
          map.setView(printCenter, printZoom, { animate: false });
          map.invalidateSize();
          document.getElementById('map').scrollIntoView({ behavior: 'instant', block: 'start' });
          setTimeout(() => {
            window.print();
            setTimeout(() => {
              showHeatmap = prevShowHeatmap;
              showBorder = prevShowBorder;
              map.setView(prevCenter, prevZoom, { animate: false });
             updateLayerMode();
              updateBorder();
            }, 1000);
          }, 400);
        }, 200);
      };
    }
    // Keyboard accessibility for panel toggle
    if (controlPanelToggle) {
      controlPanelToggle.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          controlPanelToggle.click();
        }
      });
    }
  }
});
