// ==================================================
    // MAP INTEGRATION MODULE
    // ==================================================
    window.MapIntegration = (() => {
        // --- Map State ---
        let worldMap = null;
        let countriesLayer = null;
        let countrySource = null;
        let missionsLayer = null; // New layer for mission markers
        let currentView = 'countries';
        let selectInteraction = null;
        let isMapInitialized = false;
        let isMapVisible = false;
        let debugMode = false;
        let mapOverlayElement = null; // <<< ADDED: Reference to overlay
        let mapBackdropElement = null; // <<< ADDED: Reference to backdrop
        let missionLocations = []; // Will be populated from game data

        // --- Map Config ---
        const GEOJSON_FILE_URL = 'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_50m_admin_0_countries.geojson';
        const GEOJSON_LINK_PROPERTY = 'ISO_A3';
        const GEOJSON_NAME_PROPERTY = 'ADMIN';
        const GEOJSON_REGION_PROPERTY = 'REGION_WB';
        const GEOJSON_CONTINENT_PROPERTY = 'CONTINENT';
        const GEOJSON_POPULATION_PROPERTY = 'POP_EST';

        // --- Map Styling ---
        const continentColors = { 'North America': '#8FBC8F', 'South America': '#6B8E23', 'Europe': '#4682B4', 'Africa': '#D2691E', 'Asia': '#9370DB', 'Oceania': '#20B2AA', 'Antarctica': '#B0C4DE' };
        const defaultFillColor = 'rgba(85, 85, 85, 0.6)';
        const defaultStroke = new ol.style.Stroke({ color: '#aaaaaa', width: 1 });
        const hoverStroke = new ol.style.Stroke({ color: '#4CAF50', width: 2.5 });
        const hoverStyle = new ol.style.Style({ stroke: hoverStroke, fill: new ol.style.Fill({ color: 'rgba(76, 175, 80, 0.2)' }) });

        // Add these new style definitions
        const missionPointStyle = new ol.style.Style({
            image: new ol.style.Circle({
                radius: 8,
                fill: new ol.style.Fill({
                    color: '#FF4500' // Orange-red color for the mission point
                }),
                stroke: new ol.style.Stroke({
                    color: '#FFFFFF',
                    width: 2
                })
            })
        });

        // Function to load mission locations from game data
        function loadMissionLocations() {
            // Reset mission locations array
            missionLocations = [];
            
            // Check if required databases are mounted
            const isMissionControlMounted = window.DatabaseEngine && 
                window.DatabaseEngine.mountedDbAliases && 
                window.DatabaseEngine.mountedDbAliases.has('mission_control');
                
            if (!isMissionControlMounted) {
                console.log("Mission points not loaded: mission_control database not mounted");
                return [];
            }
            
            // First, ensure mission data has map details when mission_control is mounted
            injectMapDetailsIntoMissions();
            
            // Check if game data is available
            if (!window.GameSystem?.gameData?.databases?.mission_control?.missions?.data) {
                console.warn("Mission data not available in gameData");
                return [];
            }
            
            // Get all missions from game data
            const missionsData = window.GameSystem.gameData.databases.mission_control.missions.data;
            console.log("Loading mission locations, found missions:", missionsData.length);
            
            // Filter and map missions that have map details and showOnMap=true
            missionsData.forEach(mission => {
                console.log(`Checking mission ${mission.id}: showOnMap=`, 
                    mission.mapDetails?.showOnMap, 
                    "location=", mission.mapDetails?.location);
                
                // First, check if this mission should show on the map
                if (mission.mapDetails && mission.mapDetails.showOnMap === true) {
                    // Extract coordinates from location data
                    let coordinates = mission.mapDetails.location;
                    
                    if (coordinates && Array.isArray(coordinates) && coordinates.length === 2) {
                        // If coordinates are provided as strings, convert them to numbers
                        if (typeof coordinates[0] === 'string') coordinates[0] = parseFloat(coordinates[0]);
                        if (typeof coordinates[1] === 'string') coordinates[1] = parseFloat(coordinates[1]);
                        
                        // Validate coordinates are valid numbers
                        if (!isNaN(coordinates[0]) && !isNaN(coordinates[1])) {
                            console.log(`Adding mission ${mission.id} at [${coordinates}]`);
                            missionLocations.push({
                                name: mission.title || `Mission ${mission.id}`,
                                location: coordinates, // [longitude, latitude]
                                country: mission.mapDetails.country || "Unknown",
                                description: mission.mapDetails.description || mission.description || mission.title,
                                missionId: mission.id.toString(),
                                difficulty: mission.difficulty || 1
                            });
                        } else {
                            console.warn(`Invalid coordinates for mission ${mission.id}: [${coordinates}]`);
                        }
                    } else if (mission.latitude && mission.longitude) {
                        // Alternative format: separate lat/long properties
                        const lon = parseFloat(mission.longitude);
                        const lat = parseFloat(mission.latitude);
                        
                        if (!isNaN(lon) && !isNaN(lat)) {
                            console.log(`Adding mission ${mission.id} at [${lon}, ${lat}]`);
                            missionLocations.push({
                                name: mission.title || `Mission ${mission.id}`,
                                location: [lon, lat],
                                country: mission.country || "Unknown",
                                description: mission.description || mission.title,
                                missionId: mission.id.toString(),
                                difficulty: mission.difficulty || 1
                            });
                        } else {
                            console.warn(`Invalid lat/long for mission ${mission.id}: lat=${mission.latitude}, lon=${mission.longitude}`);
                        }
                    } else {
                        console.warn(`Mission ${mission.id} has showOnMap=true but no valid location data`);
                    }
                }
            });
            
            console.log(`Loaded ${missionLocations.length} mission locations from schema`);
            return missionLocations;
        }
        
        // Function to inject map details directly into mission data
        function injectMapDetailsIntoMissions() {
            if (!window.GameSystem?.gameData?.databases?.mission_control?.missions?.data) {
                console.warn("Cannot inject map details: Mission data not available");
                return;
            }
            
            const missionsData = window.GameSystem.gameData.databases.mission_control.missions.data;
            console.log("Injecting map details into", missionsData.length, "missions");
            
            // Define map details for ONLY the Paris mission
            const missionMapDetails = {
                7: {
                    showOnMap: true,
                    country: "France",
                    location: [2.3522, 48.8566],
                    description: "Paris With Love - A special mission in the beautiful city of Paris"
                }
            };
            
            // First, make sure no missions show on map by default
            missionsData.forEach(mission => {
                if (mission.mapDetails) {
                    mission.mapDetails.showOnMap = false;
                }
            });
            
            // Then inject map details only for Paris mission
            missionsData.forEach(mission => {
                const id = mission.id;
                // Check if this is the Paris mission (id 7) or has title containing "Paris"
                if (missionMapDetails[id] || 
                    (mission.title && mission.title.toLowerCase().includes('paris'))) {
                    
                    console.log(`Injecting map details for Paris mission: ${mission.title || id}`);
                    
                    // If it's mission 7 or has Paris in the title, use our defined details
                    if (missionMapDetails[id]) {
                        mission.mapDetails = missionMapDetails[id];
                    } else {
                        // For any mission with "Paris" in the title that doesn't have id 7
                        mission.mapDetails = {
                            showOnMap: true,
                            country: "France",
                            location: [2.3522, 48.8566],
                            description: "Paris With Love - A special mission in the beautiful city of Paris"
                        };
                    }
                }
            });
            
            console.log("Map details injection complete");
        }

        // Create mission points layer with enhanced styling
        function createMissionPointsLayer() {
            const features = [];
            
            // Load mission locations from game data
            loadMissionLocations();
            
            console.log("Creating mission points layer with", missionLocations.length, "missions");
            
            // Create point features for each mission location
            missionLocations.forEach(mission => {
                // Validate coordinates before creating feature
                if (!mission.location || 
                    !Array.isArray(mission.location) || 
                    mission.location.length !== 2 ||
                    isNaN(mission.location[0]) || 
                    isNaN(mission.location[1])) {
                    console.warn(`Invalid coordinates for mission ${mission.name}: ${JSON.stringify(mission.location)}`);
                    return;
                }
                
                try {
                    const feature = new ol.Feature({
                        geometry: new ol.geom.Point(
                            ol.proj.fromLonLat(mission.location)
                        ),
                        name: mission.name,
                        country: mission.country,
                        description: mission.description,
                        missionId: mission.missionId,
                        difficulty: mission.difficulty
                    });
                    
                    // Create custom style based on difficulty
                    const missionStyle = new ol.style.Style({
                        image: new ol.style.Circle({
                            radius: 8,
                            fill: new ol.style.Fill({
                                // Color based on difficulty (1-5)
                                color: getDifficultyColor(mission.difficulty)
                            }),
                            stroke: new ol.style.Stroke({
                                color: '#FFFFFF',
                                width: 2
                            })
                        })
                    });
                    
                    // Set style for the mission point
                    feature.setStyle(missionStyle);
                    features.push(feature);
                } catch (error) {
                    console.error(`Error creating mission point for ${mission.name}:`, error);
                }
            });
            
            // Create vector source with the features
            const missionSource = new ol.source.Vector({
                features: features
            });
            
            // Create and return the vector layer
            return new ol.layer.Vector({
                source: missionSource,
                zIndex: 100 // Make sure mission points appear above other layers
            });
        }
        
        // Helper function to get color based on mission difficulty
        function getDifficultyColor(difficulty) {
            // Default to medium difficulty if not specified
            const level = parseInt(difficulty) || 3;
            
            // Color gradient from green (easy) to red (hard)
            switch(level) {
                case 1: return '#4CAF50'; // Green - Very Easy
                case 2: return '#8BC34A'; // Light Green - Easy
                case 3: return '#FFC107'; // Yellow - Medium
                case 4: return '#FF9800'; // Orange - Hard
                case 5: return '#FF5722'; // Red - Very Hard
                default: return '#FFC107'; // Default to medium difficulty color
            }
        }

        // --- Helper Functions ---
        function debugLog(message, object) { if (!debugMode) return; console.log(`[MAP DEBUG] ${message}`, object !== undefined ? object : ''); }
        function setLoadingState(isLoading, message = "Loading...", isError = false) {
            const loadingIndicator = document.querySelector('#interactive-map-area #loading'); // Target within overlay
            if (!loadingIndicator) return;
            loadingIndicator.style.display = isLoading ? 'block' : 'none';
            loadingIndicator.textContent = message;
            loadingIndicator.classList.toggle('error', isError);
        }
        function hashStringToColor(str) { let hash = 0; for (let i = 0; i < str.length; i++) { hash = str.charCodeAt(i) + ((hash << 5) - hash); } let color = '#'; for (let i = 0; i < 3; i++) { const value = (hash >> (i * 8)) & 0xFF; color += ('00' + value.toString(16)).substr(-2); } return color; }
        function getUniqueValues(propertyName) { if (!countrySource) return []; const features = countrySource.getFeatures(); const uniqueValues = new Set(); features.forEach(feature => { const value = feature.get(propertyName); if (value) uniqueValues.add(value); }); return Array.from(uniqueValues).sort(); }
        function addLegendItem(label, color) { const legendContent = document.querySelector('#interactive-map-area #legend-content'); if (!legendContent) return; const item = document.createElement('div'); item.className = 'legend-item'; const colorBox = document.createElement('div'); colorBox.className = 'color-box'; colorBox.style.backgroundColor = color; const labelText = document.createElement('span'); labelText.textContent = label; item.appendChild(colorBox); item.appendChild(labelText); legendContent.appendChild(item); }
        function updateLegend() { const legendContent = document.querySelector('#interactive-map-area #legend-content'); if (!legendContent) return; legendContent.innerHTML = ''; if (!countrySource || !countriesLayer) { addLegendItem('No data available', '#555'); return; } let propertyName, colorFunction; switch (currentView) { case 'continents': propertyName = GEOJSON_CONTINENT_PROPERTY; colorFunction = (value) => continentColors[value] || hashStringToColor(value); break; case 'regions': propertyName = GEOJSON_REGION_PROPERTY; colorFunction = hashStringToColor; break; case 'countries': default: addLegendItem('Countries', defaultFillColor); addLegendItem('Selected', 'rgba(76, 175, 80, 0.2)'); return; } const uniqueValues = getUniqueValues(propertyName); uniqueValues.forEach(value => { if (value) addLegendItem(value, colorFunction(value)); }); }
        function featureStyleFunction(feature) { let fillColor = defaultFillColor; if (currentView === 'continents') { const continent = feature.get(GEOJSON_CONTINENT_PROPERTY); fillColor = continent && continentColors[continent] ? continentColors[continent] : hashStringToColor(continent || 'unknown'); } else if (currentView === 'regions') { const region = feature.get(GEOJSON_REGION_PROPERTY); fillColor = region ? hashStringToColor(region) : defaultFillColor; } return new ol.style.Style({ fill: new ol.style.Fill({ color: fillColor }), stroke: defaultStroke }); }
        function updateInfoBox(feature) {
            const infoTitle = document.querySelector('#interactive-map-area #info-title');
            const infoContent = document.querySelector('#interactive-map-area #info-content');
            
            if (!infoTitle || !infoContent) return;
            
            // Always clear any existing mission details section first
            const existingMissionDetails = infoContent.querySelector('.mission-details');
            if (existingMissionDetails) {
                existingMissionDetails.remove();
            }
            
            if (!feature) { 
                infoTitle.textContent = 'Select a Feature'; 
                infoContent.innerHTML = `
                    <p><strong>Name:</strong> <span id="info-name">N/A</span></p>
                    <p><strong>Code:</strong> <span id="info-code">N/A</span></p>
                    <p><strong>Region:</strong> <span id="info-region">N/A</span></p>
                    <p><strong>Continent:</strong> <span id="info-continent">N/A</span></p>
                    <p><strong>Population:</strong> <span id="info-population">N/A</span></p>
                `;
                return; 
            }
            
            const name = feature.get(GEOJSON_NAME_PROPERTY) || 'Unknown'; 
            const code = feature.get(GEOJSON_LINK_PROPERTY) || 'N/A'; 
            const region = feature.get(GEOJSON_REGION_PROPERTY) || 'N/A'; 
            const continent = feature.get(GEOJSON_CONTINENT_PROPERTY) || 'N/A'; 
            const population = feature.get(GEOJSON_POPULATION_PROPERTY) || 'N/A';
            
            infoTitle.textContent = name;
            
            // Rebuild the info content HTML
            infoContent.innerHTML = `
                <p><strong>Name:</strong> <span id="info-name">${name}</span></p>
                <p><strong>Code:</strong> <span id="info-code">${code}</span></p>
                <p><strong>Region:</strong> <span id="info-region">${region}</span></p>
                <p><strong>Continent:</strong> <span id="info-continent">${continent}</span></p>
                <p><strong>Population:</strong> <span id="info-population">${population.toLocaleString()}</span></p>
            `;
        }
        function getFeatureName(feature) { if (!feature) return 'none'; return feature.get(GEOJSON_NAME_PROPERTY) || 'Unknown'; }

        // --- Core Map Functions ---
        // Unified map interactions setup that handles both country selection and mission points
        function setupMapInteractions() {
            debugLog('Setting up map interactions');
            if (selectInteraction) { worldMap.removeInteraction(selectInteraction); }
            selectInteraction = new ol.interaction.Select({ 
                condition: ol.events.condition.click, 
                style: function(feature) {
                    // Check if the feature is a mission point
                    if (feature.getGeometry() instanceof ol.geom.Point) {
                        return missionPointStyle;
                    }
                    return hoverStyle;
                },
                multi: false 
            });
            
            worldMap.addInteraction(selectInteraction);
            
            selectInteraction.on('select', (event) => { 
                // Handle deselection
                if (event.deselected.length > 0) { 
                    event.deselected.forEach(feature => { 
                        feature.setStyle(undefined); 
                    }); 
                } 
                
                // Handle selection
                if (event.selected.length > 0) {
                    const selectedFeature = event.selected[0];
                    const currentFeatures = selectInteraction.getFeatures();
                    
                    if (currentFeatures.getLength() > 1) { 
                        currentFeatures.clear();
                        currentFeatures.push(selectedFeature);
                    }
                    
                    // Check if the selected feature is a mission point
                    if (selectedFeature.getGeometry() instanceof ol.geom.Point) {
                        showMissionInfo(selectedFeature);
                    } else {
                        updateInfoBox(selectedFeature);
                        
                        // Check if there are missions in this country
                        showCountryMissions(selectedFeature.get(GEOJSON_NAME_PROPERTY));
                    }
                } else if (event.deselected.length > 0) { 
                    updateInfoBox(null); 
                } 
            });
            
            // Hover effect for map features
            let hoveredFeature = null;
            worldMap.on('pointermove', (evt) => { 
                if (evt.dragging) return; 
                const pixel = worldMap.getEventPixel(evt.originalEvent); 
                let hitFeature = worldMap.forEachFeatureAtPixel(pixel, feature => feature); 
                const selectedFeatures = selectInteraction.getFeatures().getArray(); 
                const isHitFeatureSelected = hitFeature && selectedFeatures.includes(hitFeature); 
                
                if (isHitFeatureSelected) { 
                    hitFeature = null; 
                } 
                
                if (hitFeature !== hoveredFeature) { 
                    if (hoveredFeature && !selectedFeatures.includes(hoveredFeature)) { 
                        hoveredFeature.setStyle(undefined); 
                    } 
                    hoveredFeature = hitFeature; 
                    if (hitFeature && !selectedFeatures.includes(hitFeature)) { 
                        hitFeature.setStyle(hoverStyle); 
                    } 
                } 
                
                worldMap.getTargetElement().style.cursor = hitFeature ? 'pointer' : ''; 
            });
            
            // Clear selection when clicking on empty space
            worldMap.on('click', (evt) => { 
                const pixel = evt.pixel; 
                const hasFeature = worldMap.hasFeatureAtPixel(pixel); 
                if (!hasFeature) { 
                    if (selectInteraction.getFeatures().getLength() > 0) { 
                        selectInteraction.getFeatures().getArray().forEach(feature => { 
                            feature.setStyle(undefined); 
                        }); 
                        selectInteraction.getFeatures().clear(); 
                        updateInfoBox(null); 
                    } 
                    
                    if (hoveredFeature) { 
                        hoveredFeature.setStyle(undefined); 
                        hoveredFeature = null; 
                    } 
                    
                    // Hide mission info box when clicking on empty space
                    hideMissionInfoBox();
                } 
            });
        }

        async function addFeatureLayerFromGeoJSON() {
            setLoadingState(true, "Loading Map Data...");
            countrySource = new ol.source.Vector({ url: GEOJSON_FILE_URL, format: new ol.format.GeoJSON() });
            countrySource.on('featuresloadstart', () => setLoadingState(true, "Loading Map Data..."));
            countrySource.on('featuresloadend', (event) => { console.log(`Loaded ${event.features.length} map features`); setLoadingState(false); updateLegend(); });
            countrySource.on('featuresloaderror', (event) => { console.error("Error loading GeoJSON:", event); setLoadingState(true, "Error loading map data.", true); });
            countriesLayer = new ol.layer.Vector({ source: countrySource, style: featureStyleFunction });
            worldMap.addLayer(countriesLayer);
        }
        async function initializeMapInternal() {
            if (isMapInitialized) return;

            // <<< UPDATED: Get overlay and backdrop elements >>>
            mapOverlayElement = document.getElementById('interactive-map-area');
            mapBackdropElement = document.querySelector('.map-overlay-backdrop');
            const mapElement = document.getElementById('map'); // The actual map div inside

            if (!mapOverlayElement || !mapBackdropElement || !mapElement) {
                console.error("Map overlay, backdrop, or map container element not found!"); return;
            }

            try {
                debugLog('Initializing map');
                const worldExtent = ol.proj.transformExtent([-180, -90, 180, 90], 'EPSG:4326', 'EPSG:3857');
                worldMap = new ol.Map({
                     target: mapElement, // Target the div inside the overlay
                     layers: [ new ol.layer.Tile({ source: new ol.source.XYZ({ url: 'https://cartodb-basemaps-{a-d}.global.ssl.fastly.net/dark_all/{z}/{x}/{y}.png', attributions: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>' }) }) ],
                     view: new ol.View({ center: ol.proj.fromLonLat([0, 20]), zoom: 2, extent: worldExtent, maxZoom: 8, minZoom: 1 }),
                     controls: [ new ol.control.Zoom(), new ol.control.Attribution(), new ol.control.ScaleLine() ]
                 });

                await addFeatureLayerFromGeoJSON();
                
                // Add the missions layer with points
                missionsLayer = createMissionPointsLayer();
                worldMap.addLayer(missionsLayer);
                
                setupMapInteractions();
                setupMapViewButtonListeners();
                updateViewButtons(); // Initialize button state

                // <<< ADDED: Setup close button listener specifically for the overlay >>>
                const closeMapBtn = mapOverlayElement.querySelector('#close-map-btn');
                if (closeMapBtn) {
                    closeMapBtn.addEventListener('click', () => MapIntegration.hide());
                } else { console.warn("Close map button not found within map overlay."); }

                isMapInitialized = true;
                debugLog('Map initialized successfully (within overlay structure)');

            } catch (error) {
                console.error("Failed to initialize map:", error);
                setLoadingState(true, "Error initializing map", true);
            }
        }
        function switchView(view) { if (currentView === view) return; currentView = view; updateViewButtons(); if (countriesLayer) { countriesLayer.setStyle(featureStyleFunction); } updateLegend(); }
        function updateViewButtons() { document.querySelectorAll('#interactive-map-area .btn-group button').forEach(btn => { btn.classList.remove('active'); }); const activeBtn = document.querySelector(`#interactive-map-area #${currentView}-view`); if (activeBtn) { activeBtn.classList.add('active'); } }
        function setupMapViewButtonListeners() {
            const countriesBtn = document.querySelector('#interactive-map-area #countries-view');
            const regionsBtn = document.querySelector('#interactive-map-area #regions-view');
            const continentsBtn = document.querySelector('#interactive-map-area #continents-view');
            if (countriesBtn) { countriesBtn.addEventListener('click', () => switchView('countries')); }
            if (regionsBtn) { regionsBtn.addEventListener('click', () => switchView('regions')); }
            if (continentsBtn) { continentsBtn.addEventListener('click', () => switchView('continents')); }
        }

        // Add a new function to show mission information
        function showMissionInfo(missionFeature) {
            const infoTitle = document.querySelector('#interactive-map-area #info-title');
            const infoContent = document.querySelector('#interactive-map-area #info-content');
            
            if (!infoTitle || !infoContent) return;
            
            const name = missionFeature.get('name') || 'Unknown Mission';
            const country = missionFeature.get('country') || 'Unknown Country';
            const description = missionFeature.get('description') || 'No description available';
            const missionId = missionFeature.get('missionId');
            const difficulty = missionFeature.get('difficulty') || 1;
            
            infoTitle.textContent = name;
            
            // Update info content with mission information and activate button
            infoContent.innerHTML = `
                <p><strong>Type:</strong> Mission</p>
                <p><strong>Location:</strong> ${country}</p>
                <div class="mission-details">
                    <h4>${name}</h4>
                    <div class="mission-difficulty">${'★'.repeat(difficulty)}${'☆'.repeat(5-difficulty)}</div>
                    <p class="mission-description">${description}</p>
                    <div class="activate-mission-btn" data-mission-id="${missionId}">ACTIVATE MISSION</div>
                </div>
            `;
            
            // Add event listener to the activate button
            const activateBtn = infoContent.querySelector('.activate-mission-btn');
            if (activateBtn && missionId) {
                activateBtn.addEventListener('click', () => {
                    activateMission(missionId);
                });
            }
            
            // Also update the dedicated mission info box if it exists
            updateMissionInfoBox(missionFeature);
        }

        // Add a new function to update the dedicated mission info box
        function updateMissionInfoBox(feature) {
            const missionInfoBox = document.getElementById('mission-info-box');
            if (!missionInfoBox) return;
            
            const properties = feature.getProperties();
            const missionId = properties.missionId;
            const missionName = properties.name || 'Unknown mission';
            const country = properties.country || 'Unknown location';
            const description = properties.description || 'No description available';
            const difficulty = properties.difficulty || 3;
            
            // Get difficulty label
            let difficultyLabel = '';
            switch(parseInt(difficulty)) {
                case 1: difficultyLabel = 'Very Easy'; break;
                case 2: difficultyLabel = 'Easy'; break;
                case 3: difficultyLabel = 'Medium'; break;
                case 4: difficultyLabel = 'Hard'; break;
                case 5: difficultyLabel = 'Very Hard'; break;
                default: difficultyLabel = 'Medium';
            }
            
            // Create HTML content for the info box
            let content = `
                <div class="mission-info">
                    <h3>${missionName}</h3>
                    <p><strong>Location:</strong> ${country}</p>
                    <p><strong>Difficulty:</strong> <span class="difficulty-${difficulty}">${difficultyLabel}</span></p>
                    <p>${description}</p>
                    <button class="mission-select-btn" data-mission-id="${missionId}">SELECT MISSION</button>
                </div>
            `;
            
            // Update the info box contents
            missionInfoBox.innerHTML = content;
            missionInfoBox.style.display = 'block';
            
            // Position the info box
            const mapSize = worldMap.getSize();
            const pixelCoord = worldMap.getPixelFromCoordinate(
                feature.getGeometry().getCoordinates()
            );
            
            if (pixelCoord) {
                // Calculate position to avoid overflow
                const boxWidth = 300; // Approximate width of info box
                const boxHeight = 200; // Approximate height of info box
                
                let left = pixelCoord[0] + 15;
                let top = pixelCoord[1] - (boxHeight / 2);
                
                // Adjust if it would go off the right edge
                if (left + boxWidth > mapSize[0]) {
                    left = pixelCoord[0] - boxWidth - 15;
                }
                
                // Adjust if it would go off the top or bottom
                if (top < 10) {
                    top = 10;
                } else if (top + boxHeight > mapSize[1] - 10) {
                    top = mapSize[1] - boxHeight - 10;
                }
                
                missionInfoBox.style.left = `${left}px`;
                missionInfoBox.style.top = `${top}px`;
            }
            
            // Add event listener to the Select Mission button
            const selectBtn = missionInfoBox.querySelector('.mission-select-btn');
            if (selectBtn) {
                selectBtn.addEventListener('click', function() {
                    activateMission(missionId);
                });
            }
        }

        // Add a new function to show missions for a country
        function showCountryMissions(countryName) {
            if (!countryName) return;
            
            const missionsForCountry = missionLocations.filter(mission => 
                mission.country && mission.country.toLowerCase() === countryName.toLowerCase()
            );
            
            const infoContent = document.querySelector('#interactive-map-area #info-content');
            if (!infoContent) return;
            
            // If missions exist for this country, add mission details to the infobox
            if (missionsForCountry.length > 0) {
                // Clear any existing mission details section first to prevent duplicates
                const existingMissionDetails = infoContent.querySelector('.mission-details');
                if (existingMissionDetails) {
                    existingMissionDetails.remove();
                }
                
                let missionHTML = `<div class="mission-details">
                    <h4>Available Missions</h4>`;
                
                missionsForCountry.forEach(mission => {
                    missionHTML += `
                        <div class="mission-item">
                            <h4>${mission.name}</h4>
                            <div class="mission-difficulty">${'★'.repeat(mission.difficulty || 1)}${'☆'.repeat(5-(mission.difficulty || 1))}</div>
                            <p class="mission-description">${mission.description}</p>
                            <div class="activate-mission-btn" data-mission-id="${mission.missionId}">ACTIVATE MISSION</div>
                        </div>
                    `;
                });
                
                missionHTML += `</div>`;
                
                // Add mission information to the infobox
                infoContent.innerHTML += missionHTML;
                
                // Add event listeners to all activate buttons
                const activateBtns = infoContent.querySelectorAll('.activate-mission-btn');
                activateBtns.forEach(btn => {
                    const missionId = btn.getAttribute('data-mission-id');
                    btn.addEventListener('click', () => {
                        activateMission(missionId);
                    });
                });
            }
        }

        // Add a new function to activate a mission
        function activateMission(missionId) {
            if (!missionId) return;
            
            // Hide the map overlay
            MapIntegration.hide();
            
            console.log(`Attempting to activate mission with ID ${missionId}`);
            
            // Check if mission_control database is mounted, if not mount it automatically
            if (window.DatabaseEngine && 
                window.GameSystem && 
                (!window.DatabaseEngine.mountedDbAliases || 
                 !window.DatabaseEngine.mountedDbAliases.has('mission_control'))) {
                
                console.log("mission_control database not mounted, attempting to mount it now");
                window.DatabaseEngine.mount('mission_control');
                console.log("Mount status:", window.DatabaseEngine.mountedDbAliases.has('mission_control'));
            }
            
            // Directly load the mission using MissionSystem
            if (window.MissionSystem && typeof window.MissionSystem.load === 'function') {
                // Convert to number if it's a string
                const id = parseInt(missionId, 10) || missionId;
                
                // Check if mission exists in gameData
                console.log("Checking if mission exists in gameData...");
                if (window.GameSystem?.gameData?.databases?.mission_control?.missions?.data) {
                    const missionData = window.GameSystem.gameData.databases.mission_control.missions.data;
                    console.log("Available missions:", missionData.map(m => m.id));
                    
                    const missionExists = missionData.some(m => m.id == id);
                    console.log("Mission exists:", missionExists);
                    
                    if (missionExists) {
                        // Load the mission
                        console.log("Loading mission...");
                        window.MissionSystem.load(id);
                        console.log(`Mission ${id} activated from map`);
                    } else {
                        console.error(`Mission with ID ${id} not found in gameData`);
                        if (window.GameSystem.showError) {
                            window.GameSystem.showError(`Mission ${id} not found in database. Make sure missions are properly loaded.`);
                        }
                    }
                } else {
                    console.error("Mission data not available in gameData");
                    if (window.GameSystem.showError) {
                        window.GameSystem.showError("Mission data not available. Check mission_control database.");
                    }
                }
            } else {
                console.error("MissionSystem not available for activating mission");
                if (window.GameSystem && window.GameSystem.showError) {
                    window.GameSystem.showError("Unable to activate mission: MissionSystem not available");
                }
            }
        }

        // Function to hide the mission info box
        function hideMissionInfoBox() {
            const missionInfoBox = document.getElementById('mission-info-box');
            if (missionInfoBox) {
                missionInfoBox.style.display = 'none';
            }
        }

        // --- Public Methods ---
        return {
            show: async function() {
                // <<< UPDATED show logic >>>
                if (!mapOverlayElement) mapOverlayElement = document.getElementById('interactive-map-area');
                if (!mapBackdropElement) mapBackdropElement = document.querySelector('.map-overlay-backdrop');
                if (!mapOverlayElement || !mapBackdropElement) { console.error("Map overlay or backdrop element not found!"); return; }
                console.log("Showing Interactive Map Overlay...");

                if (!isMapInitialized) { console.log("Map not initialized yet, initializing now..."); await initializeMapInternal(); }
                
                // Check if mission_control database is mounted and refresh markers
                this.refreshMissionMarkers();

                mapOverlayElement.style.display = 'flex';
                mapBackdropElement.style.display = 'block';
                isMapVisible = true;

                if (worldMap) {
                    setTimeout(() => { console.log("Updating map size for overlay."); worldMap.updateSize(); }, 0);
                }
            },
            hide: function() {
                // <<< UPDATED hide logic >>>
                if (!mapOverlayElement) mapOverlayElement = document.getElementById('interactive-map-area');
                if (!mapBackdropElement) mapBackdropElement = document.querySelector('.map-overlay-backdrop');
                if (!mapOverlayElement || !mapBackdropElement) { console.error("Map overlay or backdrop element not found!"); return; }
                console.log("Hiding Interactive Map Overlay...");

                mapOverlayElement.style.display = 'none';
                mapBackdropElement.style.display = 'none';
                isMapVisible = false;
            },
            isVisible: function() { return isMapVisible; },
            debug: function(enable) { debugMode = enable; return `Debug mode ${enable ? 'enabled' : 'disabled'}`; },
            // Add method to focus on a specific mission
            focusOnMission: function(missionName) {
                return focusOnMission(missionName);
            },
            // Add new method to activate a mission
            activateMission: function(missionId) {
                activateMission(missionId);
            },
            // Add new function to refresh mission markers on the map
            refreshMissionMarkers: function() {
                if (!worldMap || !isMapInitialized) return false;
                
                // Check if mission_control database is mounted
                const isMissionControlMounted = window.DatabaseEngine && 
                    window.DatabaseEngine.mountedDbAliases && 
                    window.DatabaseEngine.mountedDbAliases.has('mission_control');
                
                console.log("Refreshing mission markers. Mission control database mounted:", isMissionControlMounted);
                
                // Remove existing missions layer
                if (missionsLayer) {
                    worldMap.removeLayer(missionsLayer);
                }
                
                // Create and add a new missions layer with updated data
                missionsLayer = createMissionPointsLayer();
                worldMap.addLayer(missionsLayer);
                
                return true;
            }
        };
    })(); // END OF MAP INTEGRATION MODULE

// Add database mounting listener to refresh mission markers when databases change
document.addEventListener('DOMContentLoaded', function() {
    // Wait for DatabaseEngine to be available
    const checkInterval = setInterval(() => {
        if (window.DatabaseEngine) {
            clearInterval(checkInterval);
            
            // Set up a listener for database mounting events
            if (typeof window.DatabaseEngine.onDatabaseMounted !== 'function') {
                window.DatabaseEngine.onDatabaseMounted = function(callback) {
                    if (!this._dbMountListeners) {
                        this._dbMountListeners = [];
                    }
                    this._dbMountListeners.push(callback);
                };
                
                // Add trigger mechanism for the mount event
                const originalMount = window.DatabaseEngine.mount;
                window.DatabaseEngine.mount = function(dbAlias) {
                    const result = originalMount.apply(this, arguments);
                    
                    if (this._dbMountListeners && Array.isArray(this._dbMountListeners)) {
                        this._dbMountListeners.forEach(callback => {
                            try {
                                callback(dbAlias);
                            } catch (e) {
                                console.error('Error in database mount listener:', e);
                            }
                        });
                    }
                    
                    return result;
                };
                
                // Add unmount listener as well
                const originalUnmount = window.DatabaseEngine.unmount;
                window.DatabaseEngine.unmount = function(dbAlias) {
                    const wasMounted = this.mountedDbAliases && this.mountedDbAliases.has(dbAlias);
                    const result = originalUnmount.apply(this, arguments);
                    
                    if (wasMounted && this._dbMountListeners && Array.isArray(this._dbMountListeners)) {
                        this._dbMountListeners.forEach(callback => {
                            try {
                                // Pass a special signature for unmount events
                                callback(`unmount:${dbAlias}`);
                            } catch (e) {
                                console.error('Error in database unmount listener:', e);
                            }
                        });
                    }
                    
                    return result;
                };
            }
            
            // Listen for database mounting events
            window.DatabaseEngine.onDatabaseMounted((dbAlias) => {
                console.log(`Database mounted or unmounted: ${dbAlias}`);
                
                // For maps database, toggle map button visibility
                if (dbAlias === 'maps') {
                    // Show map button when maps database is mounted
                    const mapButton = document.getElementById('open-map-header-btn');
                    if (mapButton) {
                        console.log('Maps database mounted, showing map button');
                        mapButton.style.display = 'block';
                    }
                } else if (dbAlias === 'unmount:maps') {
                    // Hide map button when maps database is unmounted
                    const mapButton = document.getElementById('open-map-header-btn');
                    if (mapButton) {
                        console.log('Maps database unmounted, hiding map button');
                        mapButton.style.display = 'none';
                    }
                }
                
                // If mission_control database is mounted, refresh mission markers
                if (dbAlias === 'mission_control' && window.MapIntegration) {
                    console.log('Mission control database mounted, refreshing mission markers');
                    // Small delay to ensure data is loaded
                    setTimeout(() => window.MapIntegration.refreshMissionMarkers(), 100);
                }
            });
        }
    }, 100);
});