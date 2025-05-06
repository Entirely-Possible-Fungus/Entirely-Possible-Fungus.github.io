// Add randomized CRT flicker intensity
 document.addEventListener('DOMContentLoaded', () => {
    // Splash screen handling
    const splashScreen = document.getElementById('splash-screen');
    const gameContainer = document.querySelector('.game-container');
    let gameInitialized = false;
    
    // Hide game content until splash screen is dismissed
    if (gameContainer) {
        gameContainer.style.visibility = 'hidden';
    }
    
    // Function to handle splash screen click and start the game
    function startGame() {
        if (splashScreen) {
            // Play system boot sound
            try {
                
                
                // Start background music if enabled
                if (soundSettings.musicEnabled && backgroundMusic) {
                    backgroundMusic.play().catch(err => {
                        console.error("Background music failed to play:", err);
                    });
                }
            } catch (err) {
                console.error("Error creating boot sound:", err);
            }
            
            // Add booting animation class
            splashScreen.classList.add('booting');
            
            // After animation completes, remove splash screen and show game
            setTimeout(() => {
                splashScreen.style.display = 'none';
                if (gameContainer) {
                    gameContainer.style.visibility = 'visible';
                }
                
                // Only initialize the game once
                if (!gameInitialized) {
                    initializeGame();
                    gameInitialized = true;
                }
            }, 2000); // Match this with the animation duration
            
            // Remove event listeners
            splashScreen.removeEventListener('click', startGame);
            document.removeEventListener('keydown', startGame);
        }
    }
    
    // Add event listeners to start game on click or keypress
    if (splashScreen) {
        splashScreen.addEventListener('click', startGame);
        document.addEventListener('keydown', startGame);
    }
    
    // Create more intense random flicker occasionally
    setInterval(() => {
        const flickerElement = document.querySelector('.flicker');
        if (Math.random() > 0.97) {
            flickerElement.style.background = 'rgba(0,0,0,0.1)';
            setTimeout(() => {
                flickerElement.style.background = 'transparent';
            }, 100);
        }
    }, 500);

    // Sound settings
    const soundSettings = {
        masterVolume: 0.5,
        musicVolume: 0.3,
        effectsVolume: 0.5,
        typingVolume: 0.5,
        musicEnabled: true,
        effectsEnabled: true,
        typingSoundEnabled: true,
        
        // Methods for managing sound
        updateMasterVolume: function(value) {
            this.masterVolume = value;
            if (backgroundMusic) {
                backgroundMusic.volume = this.musicVolume * this.masterVolume;
            }
        },
        
        updateMusicVolume: function(value) {
            this.musicVolume = value;
            if (backgroundMusic) {
                backgroundMusic.volume = this.musicVolume * this.masterVolume;
            }
        },
        
        toggleMusic: function(enabled) {
            this.musicEnabled = enabled;
            if (backgroundMusic) {
                if (enabled) {
                    backgroundMusic.play().catch(err => {
                        console.error("Background music failed to play:", err);
                    });
                } else {
                    backgroundMusic.pause();
                }
            }
        },
        
        toggleEffects: function(enabled) {
            this.effectsEnabled = enabled;
        },
        
        toggleTypingSound: function(enabled) {
            this.typingSoundEnabled = enabled;
        },
        
        // Save settings to localStorage
        saveSettings: function() {
            localStorage.setItem('sqlAdventureSoundSettings', JSON.stringify({
                masterVolume: this.masterVolume,
                musicVolume: this.musicVolume,
                effectsVolume: this.effectsVolume,
                typingVolume: this.typingVolume,
                musicEnabled: this.musicEnabled,
                effectsEnabled: this.effectsEnabled,
                typingSoundEnabled: this.typingSoundEnabled
            }));
        },
        
        // Load settings from localStorage
        loadSettings: function() {
            const saved = localStorage.getItem('sqlAdventureSoundSettings');
            if (saved) {
                const settings = JSON.parse(saved);
                this.masterVolume = settings.masterVolume;
                this.musicVolume = settings.musicVolume;
                this.effectsVolume = settings.effectsVolume;
                this.typingVolume = settings.typingVolume;
                this.musicEnabled = settings.musicEnabled;
                this.effectsEnabled = settings.effectsEnabled;
                this.typingSoundEnabled = settings.typingSoundEnabled;
            }
        }
    };
    
    // Try to load settings from localStorage
    soundSettings.loadSettings();

    // Background music setup
    const backgroundMusic = new Audio('./audio/Observation.ogg');
    backgroundMusic.loop = true;
    backgroundMusic.volume = soundSettings.musicVolume * soundSettings.masterVolume;
    
    // Audio setup for sound effects
    const clickSound = document.getElementById('click-sound');
    const possiblePaths = [
        "./audio/mixkit-old-camera-shutter-click-1137.ogg", // Parent directory
    ];
    
    // Add the hover sound path - using the .ogg version as requested
    const hoverSoundPath = "./audio/423167__plasterbrain__minimalist-sci-fi-ui-cancel.ogg";
    
    // Add mission completion sound path - UPDATED TO USE SCI-FI BLEEP SOUND
    const missionCompleteSoundPath = "./audio/mixkit-water-sci-fi-bleep-902.ogg";
    
    // Add SQL error sound path
    const sqlErrorSoundPath = "./audio/619803__teh_bucket__error-fizzle.ogg";

    // Add keyboard typing sound path
    const typingSoundPath = "./audio/typing-keyboard-sound-254462.ogg";
    
    // Pre-load audio objects for better performance
    const errorSound = new Audio(sqlErrorSoundPath);
    errorSound.volume = soundSettings.effectsVolume * soundSettings.masterVolume; // Volume based on settings
    window.errorSound = errorSound; // Make it globally available

    // Pre-load the typing sound for keyboard effect
    const typingSound = new Audio(typingSoundPath);
    
    // Function to play random typing sound samples
    function playRandomTypingSound() {
        if (!soundSettings.typingSoundEnabled) return;
        
        // Create a new audio element each time for overlapping sounds
        const tempTypingSound = new Audio(typingSoundPath);
        
        // Set a random start time between 0 and max (minus 2 seconds to ensure we have enough audio)
        tempTypingSound.addEventListener('loadedmetadata', () => {
            const maxStartTime = Math.max(0, tempTypingSound.duration - 2);
            const randomStartTime = Math.random() * maxStartTime;
            
            // Set the start time and volume
            tempTypingSound.currentTime = randomStartTime;
            tempTypingSound.volume = soundSettings.typingVolume * soundSettings.masterVolume;
            
            // Play the sound for a short duration
            tempTypingSound.play().catch(err => {
                console.error("Typing sound play failed:", err);
            });
            
            // Stop after ~0.5 seconds to get a quick tap sound
            setTimeout(() => {
                tempTypingSound.pause();
                tempTypingSound.src = '';
            }, 200);
        });
        
        tempTypingSound.load();
    }

    function tryLoadAudio() {
        let currentPathIndex = 0;
        function tryNextPath() {
            if (currentPathIndex >= possiblePaths.length) {
                console.error("All audio paths failed to load"); return;
            }
            const path = possiblePaths[currentPathIndex];
            console.log(`Attempting to load audio from: ${path}`);
            clickSound.src = path;
            clickSound.load();
            clickSound.onerror = () => {
                console.error(`Failed to load audio from: ${path}`);
                currentPathIndex++; tryNextPath();
            };
            clickSound.onloadeddata = () => { console.log(`Successfully loaded audio from: ${path}`); };
        }
        tryNextPath();
    }
    tryLoadAudio();
    console.log("Audio element found:", clickSound !== null);

    const typewriterSoundPaths = [
        "./audio/mixkit-typewriter-soft-click-1125_r.wav"
    ];
    
    // Add hover sound to all buttons
    function setupButtonHoverSound() {
        // Create a shared audio object for hover sounds
        const hoverSound = new Audio(hoverSoundPath);
        hoverSound.volume = soundSettings.effectsVolume * soundSettings.masterVolume;
        
        // Get all buttons in the document
        const buttons = document.querySelectorAll('button, .nav-button, .pixel-btn');
        
        // Add hover event listeners to all buttons
        buttons.forEach(button => {
            button.addEventListener('mouseenter', () => {
                if (!soundSettings.effectsEnabled) return;
                
                // Create a new instance each time to allow for rapid hovering
                const tempHoverSound = new Audio(hoverSoundPath);
                tempHoverSound.volume = 0.15 * soundSettings.effectsVolume * soundSettings.masterVolume;
                tempHoverSound.play().catch(err => { 
                    console.error("Button hover audio play failed:", err);
                });
                tempHoverSound.onended = () => { tempHoverSound.src = ''; };
            });
            
            // Add click sound to buttons
            button.addEventListener('click', () => {
                if (!soundSettings.effectsEnabled) return;
                
                const clickSound = new Audio('./audio/766611__stavsounds__keyboard_clicky_15.ogg');
                clickSound.volume = 0.55 * soundSettings.effectsVolume * soundSettings.masterVolume;
                clickSound.play().catch(err => {
                    console.error("Button click audio play failed:", err);
                });
                clickSound.onended = () => { clickSound.src = ''; };
            });
        });
        
        console.log(`Hover sound added to ${buttons.length} buttons`);
    }
    
    // Call the setup function to add hover sounds
    setupButtonHoverSound();

    // --- Main Game Logic ---
    console.log("Pixel SQL Adventure - Initializing...");

    // --- Game State ---
    let score = 0;
    let lastResults = null;

    // --- Game Data (Databases) ---
    const gameData = {
        databases: {
            mission_control: {
                missions: {
                    columns: { id: 'INT PRIMARY KEY', title: 'STRING', difficulty: 'INT', points: 'INT', dbAlias: 'STRING' },
                    data: [ 
                        { id: 0, title: "Alien Tutorial: SQL Basics", difficulty: 1, points: 25, dbAlias: "mission_control" },
                        { id: 1, title: "Find Planets", difficulty: 1, points: 50, dbAlias: "galaxy1" }, 
                        { id: 2, title: "Valuable Resources", difficulty: 2, points: 75, dbAlias: "galaxy1" }, 
                        { id: 3, title: "Sort by Power", difficulty: 2, points: 75, dbAlias: "galaxy1" }, 
                        { id: 4, title: "Planet & Species Report", difficulty: 3, points: 100, dbAlias: "galaxy1" }, 
                        { id: 7, title: "Paris With Love", difficulty: 1, points: 50, dbAlias: "france" },
                        { id: 101, title: "SDG Tutorial: Education Access Data", difficulty: 1, points: 40, dbAlias: "sdg_education" }, 
                        { id: 102, title: "SDG Tutorial: Education Access Filtering", difficulty: 2, points: 60, dbAlias: "sdg_education" }, 
                    ]
                },
            },
            galaxy1: {
                planets: { columns: { id: 'INT PRIMARY KEY', name: 'STRING', type: 'STRING', atmosphere: 'STRING', distance_from_sun: 'INT' }, data: [ { id: 1, name: 'Terra Prime', type: 'Terrestrial', atmosphere: 'Nitrogen', distance_from_sun: 100 }, { id: 2, name: 'Xylos', type: 'Jungle', atmosphere: 'Oxygen Rich', distance_from_sun: 150 }, { id: 3, name: 'Cryonia', type: 'Ice Giant', atmosphere: 'Methane', distance_from_sun: 400 }, { id: 4, name: 'Vulcanis', type: 'Volcanic', atmosphere: 'Sulfur', distance_from_sun: 80 }, { id: 5, name: 'Aetheria', type: 'Gas Giant', atmosphere: 'Hydrogen', distance_from_sun: 600 } ] },
                species: { columns: { id: 'INT PRIMARY KEY', name: 'STRING', home_planet_id: 'INT', intelligence_level: 'INT', temperament: 'STRING' }, data: [ { id: 101, name: 'Humans', home_planet_id: 1, intelligence_level: 7, temperament: 'Neutral' }, { id: 102, name: 'Grox', home_planet_id: 4, intelligence_level: 8, temperament: 'Aggressive' }, { id: 103, name: 'Florans', home_planet_id: 2, intelligence_level: 5, temperament: 'Peaceful' }, { id: 104, name: 'Cryonians', home_planet_id: 3, intelligence_level: 9, temperament: 'Neutral' }, { id: 105, name: 'Void Spawn', home_planet_id: null, intelligence_level: 10, temperament: 'Aggressive'} ] },
                ships: { columns: { id: 'INT PRIMARY KEY', name: 'STRING', '`class`': 'STRING', captain_species_id: 'INT', cargo_capacity: 'INT' }, data: [ { id: 501, name: 'Stardust', '`class`': 'Freighter', captain_species_id: 101, cargo_capacity: 5000 }, { id: 502, name: 'Void Ripper', '`class`': 'Fighter', captain_species_id: 102, cargo_capacity: 50 }, { id: 503, name: 'Leaf on the Wind', '`class`': 'Frigate', captain_species_id: 103, cargo_capacity: 1000 }, { id: 504, name: 'Nebula Voyager', '`class`': 'Freighter', captain_species_id: 101, cargo_capacity: 7500 }, { id: 505, name: 'Icebreaker', '`class`': 'Frigate', captain_species_id: 104, cargo_capacity: 1200 } ] },
                resources: { columns: { id: 'INT PRIMARY KEY', name: 'STRING', planet_id: 'INT', rarity: 'STRING', market_value: 'INT' }, data: [ { id: 801, name: 'Iron Ore', planet_id: 1, rarity: 'Common', market_value: 10 }, { id: 802, name: 'Bio-Lumber', planet_id: 2, rarity: 'Common', market_value: 15 }, { id: 803, name: 'Helium-3', planet_id: 5, rarity: 'Uncommon', market_value: 50 }, { id: 804, name: 'Magma Crystals', planet_id: 4, rarity: 'Rare', market_value: 250 }, { id: 805, name: 'Zero-Point Ice', planet_id: 3, rarity: 'Exotic', market_value: 1000 }, { id: 806, name: 'Adamantium', planet_id: 4, rarity: 'Rare', market_value: 500 }, ] }
            },
            sdg_education: {
               education_metrics: { columns: { country_name: 'STRING', region: 'STRING', primary_enrollment_rate: 'FLOAT', secondary_enrollment_rate: 'FLOAT' }, data: [ { country_name: 'South Sudan', region: 'Sub-Saharan Africa', primary_enrollment_rate: 32.1, secondary_enrollment_rate: 10.3 }, { country_name: 'Niger', region: 'Sub-Saharan Africa', primary_enrollment_rate: 38.4, secondary_enrollment_rate: 12.8 }, { country_name: 'Chad', region: 'Sub-Saharan Africa', primary_enrollment_rate: 43.8, secondary_enrollment_rate: 22.6 }, { country_name: 'Mali', region: 'Sub-Saharan Africa', primary_enrollment_rate: 58.7, secondary_enrollment_rate: 33.9 }, { country_name: 'Burkina Faso', region: 'Sub-Saharan Africa', primary_enrollment_rate: 62.3, secondary_enrollment_rate: 29.5 }, { country_name: 'Guinea', region: 'Sub-Saharan Africa', primary_enrollment_rate: 65.1, secondary_enrollment_rate: 38.9 }, { country_name: 'Senegal', region: 'Sub-Saharan Africa', primary_enrollment_rate: 68.7, secondary_enrollment_rate: 41.2 } ] }
           },
           france: {
                paris_metrics: { 
                    columns: { 
                        year: 'INT', 
                        metric: 'STRING', 
                        value: 'FLOAT', 
                        target_2030: 'FLOAT', 
                        status: 'STRING' 
                    }, 
                    data: [ 
                        { year: 2022, metric: 'Carbon Emissions (MT)', value: 12.5, target_2030: 6.0, status: 'Behind Target' },
                        { year: 2022, metric: 'Green Space (% of city)', value: 9.5, target_2030: 15.0, status: 'Progress Needed' },
                        { year: 2022, metric: 'Renewable Energy (%)', value: 21.3, target_2030: 60.0, status: 'Progress Needed' },
                        { year: 2022, metric: 'Public Transit Usage (%)', value: 68.2, target_2030: 80.0, status: 'On Track' },
                        { year: 2022, metric: 'Waste Recycled (%)', value: 31.7, target_2030: 65.0, status: 'Behind Target' }
                    ] 
                }
            },
           maps: { // Added for map command functionality
                earth: { columns: { id: 'NUMBER', name: 'STRING', type: 'STRING' }, data: [{ id: 1, name: 'Earth', type: 'Planet' }] }
            },
            // Add other database structures here...
            health_metrics: { /* Placeholder */ }, climate_data: { /* Placeholder */ }, economic_indicators: { /* Placeholder */ }, infrastructure: { /* Placeholder */ }, biodiversity_critical: { /* Placeholder */ }, conflict_zones: { /* Placeholder */ }
        }
    };

    // --- DOM Elements ---
    const sqlInput = document.getElementById('sql-input'); 
    const submitBtn = document.getElementById('submit-query'); 
    const clearBtn = document.getElementById('clear-query'); 
    const resultsDiv = document.getElementById('query-results'); 
    const errorDiv = document.getElementById('error-message'); 
    const mapCanvas = document.getElementById('map-canvas'); 
    const svgContainer = document.getElementById('line-svg-container'); 
    const sqlConsoleWindow = document.getElementById('sql-console'); 
    const consoleDragHandle = document.getElementById('console-drag-handle'); 
    const scoreDisplay = document.getElementById('score'); 
    const missionTitle = document.getElementById('mission-title'); 
    const missionDesc = document.getElementById('mission-description'); 
    const missionDifficulty = document.getElementById('mission-difficulty'); 
    const hintToggler = document.getElementById('hint-toggler'); 
    const hintContent = document.getElementById('hint-content'); 
    const hintToggleIcon = document.getElementById('hint-toggle'); 
    const completeMissionBtn = document.getElementById('complete-mission-btn'); 
    const missionCompletePopup = document.getElementById('mission-complete'); 
    const nextMissionBtn = document.getElementById('next-mission-btn'); 
    const mapContainer = document.getElementById('db-map-container'); 
    const toggleMapBtn = document.getElementById('toggle-map-btn'); 
    const resultStatusContainer = document.getElementById('result-status-container');
    const openMapBtn = document.getElementById('open-map-header-btn'); // Map button

    // --- Initialization ---
    function initializeGame() {
        updateScore(0);
        lastResults = null;
        showMapPlaceholder("No database mounted. Use DB REGISTRY."); // Schema map placeholder
        
        // Initialize the database system
        if (window.DatabaseEngine) {
            DatabaseEngine.initialize();
        } else {
            console.error("Database engine not available!");
            showError("Failed to initialize database system. Please refresh.");
            return;
        }
        
        // Hide map button initially - only show when maps database is mounted
        if (openMapBtn) {
            openMapBtn.style.display = 'none';
        }
        
        // Make panels resizable
        initializeResizablePanels();
        
        // Setup the central multidirectional resize handle
        window.centralHandleController = setupCentralResizeHandle();
        
        // Mission data is now directly loaded from mission_control.json schema
        // through the schemaLoader.js file, no need to load it separately
        
        displayMessage("Mount the `mission_control` database from the DB REGISTRY, then query `SELECT * FROM missions;`", "status-success");
        makeConsoleDraggable(sqlConsoleWindow, consoleDragHandle);
        setupEventListeners();
        
        // Initialize database browser and visualizations
        if (window.DatabaseEngine) {
            DatabaseEngine.renderDatabaseBrowserItems();
            DatabaseEngine.setupBrowserEvents(mapCanvas, svgContainer);
        }
        
        // Hide the map overlay initially
        if (window.MapIntegration) {
            MapIntegration.hide();
        }
        
        // Initialize mission system
        if (window.MissionSystem) {
            MissionSystem.initialize();
        }
        
        console.log("Game Initialized. Systems ready.");
    }

    function showMapPlaceholder(message) { 
        let placeholder = mapCanvas.querySelector('#map-placeholder'); 
        if (!placeholder) { 
            placeholder = document.createElement('div'); 
            placeholder.id = 'map-placeholder'; 
            placeholder.style.cssText = 'position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); text-align: center; color: #888; font-size: 1.1em;'; 
            mapCanvas.appendChild(placeholder); 
        } 
        placeholder.textContent = message; 
        placeholder.style.display = 'block'; 
        mapCanvas.querySelectorAll('.db-table-vis').forEach(el => el.style.display = 'none'); 
        if (svgContainer) svgContainer.style.display = 'none'; 
    }
    
    function hideMapPlaceholder() { 
        const placeholder = mapCanvas.querySelector('#map-placeholder'); 
        if (placeholder) { 
            placeholder.style.display = 'none'; 
        } 
        mapCanvas.querySelectorAll('.db-table-vis').forEach(el => el.style.display = ''); 
        if (svgContainer) svgContainer.style.display = ''; 
    }

    // --- SQL Query Execution ---
    function executeQueryAndVisualize() {
        const query = sqlInput.value.trim();
        clearResults();
        if (!query) return;

        const lowerQuery = query.toLowerCase().trim();
        
        // Map Command Handling
        if (lowerQuery === 'select earth from maps;') {
            if (typeof window.MapIntegration === 'undefined') { 
                showError("Map integration module not available."); 
                return; 
            }
            window.MapIntegration.show(); // Show the overlay
            displayMessage("Displaying Interactive World Map Overlay...", "status-success");
            resultsDiv.innerHTML = '<p style="padding: 10px; color: #aaa;">Map controls active. Use map overlay or type `HIDE MAP;`</p>';
            return;
        } else if (lowerQuery === 'hide map;') {
            if (typeof window.MapIntegration === 'undefined') { 
                showError("Map integration module not available."); 
                return; 
            }
            window.MapIntegration.hide(); // Hide the overlay
            displayMessage("Interactive World Map overlay hidden.", "status-success");
            return;
        }

        // Execute the query using DatabaseEngine
        if (window.DatabaseEngine) {
            const results = DatabaseEngine.executeQuery(query);
            
            if (results !== null) {
                lastResults = results;
                displayResults(results, resultsDiv);
                
                // Check if mission is solved
                if (window.MissionSystem && 
                    MissionSystem.currentMissionId !== null && 
                    MissionSystem.currentMissionData && 
                    Array.isArray(results)) {
                    
                    MissionSystem.isMissionSolved = false;
                    completeMissionBtn.style.display = 'none';
                    
                    if (MissionSystem.validate(query, results, MissionSystem.currentMissionData.validationCriteria)) {
                        MissionSystem.isMissionSolved = true;
                        completeMissionBtn.style.display = 'block';
                        displayMessage("Validation successful! Ready to complete mission.", "status-success");
                    }
                }
                
                // Update visualization
                if (window.DatabaseEngine) {
                    const parsedInfo = DatabaseEngine.parseQueryForVis(query);
                    DatabaseEngine.updateVisualization(parsedInfo, mapCanvas, svgContainer);
                }
            }
        } else {
            showError("Database system not available.");
            completeMissionBtn.style.display = 'none';
            if (window.MissionSystem) {
                MissionSystem.isMissionSolved = false;
            }
        }
    }

    // --- UI Functions (Display & Errors) ---
    function displayResults(data, container) { 
        container.innerHTML = ''; 
        resultStatusContainer.innerHTML = ''; 
        
        if (typeof data === 'number') { 
            displayMessage(`Query OK. Rows affected: ${data}`, "status-success"); 
            return; 
        } 
        
        if (!Array.isArray(data)) { 
            displayMessage("Query executed, but no tabular results returned.", "status-success"); 
            return; 
        } 
        
        if (data.length === 0) { 
            displayMessage("Query executed successfully. No matching rows found.", "status-success"); 
            return; 
        } 
        
        const table = document.createElement('table'); 
        table.className = 'pixel-results-table'; 
        const thead = document.createElement('thead'); 
        const tbody = document.createElement('tbody'); 
        const headerRow = document.createElement('tr'); 
        const columns = Object.keys(data[0]); 
        
        columns.forEach(col => { 
            const th = document.createElement('th'); 
            th.textContent = col.replace(/`/g,''); 
            headerRow.appendChild(th); 
        }); 
        
        thead.appendChild(headerRow); 
        
        // Check if this is a missions table from either database
        const expectedMissionCols = ['id', 'title', 'difficulty', 'points']; 
        const isMissionList = expectedMissionCols.every(col => columns.includes(col));
        
        if (isMissionList) { 
            table.classList.add('missions-table'); 
        }
        
        data.forEach(rowData => { 
            const tr = document.createElement('tr'); 
            
            if (isMissionList) { 
                tr.className = 'mission-row'; 
                tr.dataset.missionId = rowData.id; 
                
                if (window.MissionSystem && MissionSystem.completedMissionIds.has(rowData.id)) { 
                    tr.style.textDecoration = 'line-through'; 
                    tr.style.color = '#888'; 
                    tr.style.cursor = 'default'; 
                } else { 
                    tr.onclick = () => window.MissionSystem.load(rowData.id); 
                } 
            } 
            
            columns.forEach(col => { 
                const td = document.createElement('td'); 
                let value = rowData[col]; 
                
                if (isMissionList && col === 'difficulty') { 
                    td.textContent = '★'.repeat(value) + '☆'.repeat(5 - value); 
                    td.className = 'difficulty-stars'; 
                } else if (value === null || typeof value === 'undefined') { 
                    td.textContent = 'NULL'; 
                    td.className = 'null-value'; 
                } else if (typeof value === 'object') { 
                    td.textContent = JSON.stringify(value); 
                } else { 
                    td.textContent = value; 
                } 
                
                tr.appendChild(td); 
            }); 
            
            tbody.appendChild(tr); 
        }); 
        
        table.appendChild(thead); 
        table.appendChild(tbody); 
        container.appendChild(table); 
        
        let statusText = `Query OK. ${data.length} row(s) returned.`; 
        if (isMissionList) {
            const dbName = window.DatabaseEngine && window.DatabaseEngine.mountedDbAliases.has('mainQuest') ? 
                'mainQuest' : 'mission_control';
            
            if (dbName === 'mainQuest') {
                statusText += " These are main story missions. Click a mission row to begin your investigation.";
            } else {
                statusText += " Click an available mission row to load the tutorial mission.";
            }
        }
        
        displayMessage(statusText, "status-success"); 
    }
    
    function showError(message) { 
        const errorMsg = document.createElement('div'); 
        errorMsg.className = 'result-status status-error'; 
        errorMsg.textContent = message; 
        resultStatusContainer.innerHTML = ''; 
        resultStatusContainer.appendChild(errorMsg); 
        
        // Play cancel sound when showing an error in the SQL console
        try {
            if (soundSettings.effectsEnabled) {
                const cancelSound = new Audio('./audio/423167__plasterbrain__minimalist-sci-fi-ui-cancel.ogg');
                cancelSound.volume = soundSettings.effectsVolume * soundSettings.masterVolume;
                cancelSound.play().catch(err => {
                    console.error("Cancel sound failed to play:", err);
                });
            }
        } catch (err) {
            console.error("Error creating cancel sound:", err);
        }
    }
    
    function displayMessage(message, type = "status-success", clearAfterMs = 0) { 
        const msgDiv = document.createElement('div'); 
        msgDiv.className = `result-status ${type}`; 
        msgDiv.textContent = message; 
        resultStatusContainer.innerHTML = ''; 
        resultStatusContainer.appendChild(msgDiv); 
        
        if (clearAfterMs > 0) { 
            setTimeout(() => { 
                if (msgDiv.parentNode === resultStatusContainer) { 
                    resultStatusContainer.innerHTML = ''; 
                } 
            }, clearAfterMs); 
        } 
    }
    
    function clearResults() { 
        resultsDiv.innerHTML = ''; 
        errorDiv.textContent = ''; 
        errorDiv.style.display = 'none'; 
        resultStatusContainer.innerHTML = ''; 
        completeMissionBtn.style.display = 'none'; 
        if (window.MissionSystem) {
            MissionSystem.isMissionSolved = false;
        }
    }
    
    function updateScore(newScore) { 
        score = newScore; 
        scoreDisplay.textContent = score; 
    }
    
    function togglePanel(panelElement) { 
        panelElement.classList.toggle('collapsed'); 
        const isCollapsed = panelElement.classList.contains('collapsed'); 
        toggleMapBtn.textContent = isCollapsed ? '>' : '<'; 
        if (!isCollapsed && window.DatabaseEngine) { 
            setTimeout(() => DatabaseEngine.updateAllJoinLines(mapCanvas), 350); 
        } 
    }

    // --- Draggable Console Logic ---
    function makeConsoleDraggable(element, handle) { 
        let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0; 
        handle.onmousedown = dragMouseDown; 
        
        function dragMouseDown(e) { 
            e = e || window.event; 
            if (e.button !== 0) return; 
            e.preventDefault(); 
            pos3 = e.clientX; 
            pos4 = e.clientY; 
            const rect = element.getBoundingClientRect(); 
            element.style.bottom = 'auto'; 
            element.style.top = rect.top + 'px'; 
            document.addEventListener('mouseup', closeDragElement, { once: true }); 
            document.addEventListener('mousemove', elementDrag); 
            handle.style.cursor = 'grabbing'; 
            element.style.zIndex = 101; 
        } 
        
        function elementDrag(e) { 
            e = e || window.event; 
            e.preventDefault(); 
            pos1 = pos3 - e.clientX; 
            pos2 = pos4 - e.clientY; 
            pos3 = e.clientX; 
            pos4 = e.clientY; 
            let newTop = element.offsetTop - pos2; 
            let newLeft = element.offsetLeft - pos1; 
            const elmRect = element.getBoundingClientRect(); 
            newTop = Math.max(0, Math.min(newTop, window.innerHeight - elmRect.height)); 
            newLeft = Math.max(0, Math.min(newLeft, window.innerWidth - elmRect.width)); 
            element.style.top = newTop + "px"; 
            element.style.left = newLeft + "px"; 
        } 
        
        function closeDragElement() { 
            document.removeEventListener('mousemove', elementDrag); 
            handle.style.cursor = 'grab'; 
            element.style.zIndex = 100; 
        } 
    }
    
    // --- Panel Resizing Logic ---
    function setupResizablePanels() {
        // Mission panel resize
        const missionPanel = document.getElementById('mission-area');
        const missionResizeHandle = document.getElementById('mission-resize-handle');
        
        // Results panel resize
        const resultsPanel = document.querySelector('.results-area');
        const resultsResizeHandle = document.getElementById('results-resize-handle');
        
        // Schema panel resize
        const schemaPanel = document.getElementById('db-map-container');
        const schemaResizeHandle = document.getElementById('schema-resize-handle');
        
        // Set initial heights
        let initialMissionHeight = parseInt(getComputedStyle(missionPanel).height);
        let initialResultsHeight = parseInt(getComputedStyle(resultsPanel).height);
        
        // Mission panel resize handler
        if (missionResizeHandle && missionPanel) {
            makeResizable(missionResizeHandle, missionPanel, 'vertical');
        }
        
        // Results panel resize handler
        if (resultsResizeHandle && resultsPanel) {
            makeResizable(resultsResizeHandle, resultsPanel, 'vertical');
        }
        
        // Schema panel resize handler
        if (schemaResizeHandle && schemaPanel) {
            makeResizable(schemaResizeHandle, schemaPanel, 'horizontal');
        }
        
        // Generic function to make an element resizable
        function makeResizable(handle, panel, direction) {
            let startPos = 0;
            let startSize = 0;
            
            handle.addEventListener('mousedown', function(e) {
                startPos = direction === 'vertical' ? e.clientY : e.clientX;
                startSize = direction === 'vertical' ? panel.offsetHeight : panel.offsetWidth;
                
                document.body.classList.add(direction === 'vertical' ? 'resizing-vertical' : 'resizing');
                document.addEventListener('mousemove', resize);
                document.addEventListener('mouseup', stopResize);
                
                e.preventDefault(); // Prevent text selection during resize
            });
            
            function resize(e) {
                if (direction === 'vertical') {
                    const newHeight = startSize + (e.clientY - startPos);
                    
                    // Set minimum and maximum heights
                    if (newHeight >= 100 && newHeight <= window.innerHeight * 0.8) {
                        panel.style.height = newHeight + 'px';
                        
                        // If this is the mission panel, adjust map lines
                        if (panel.id === 'mission-area' && window.DatabaseEngine) {
                            window.DatabaseEngine.updateAllJoinLines(document.getElementById('map-canvas'));
                        }
                    }
                } else {
                    // Horizontal resize for schema panel
                    const parentWidth = panel.parentElement.offsetWidth;
                    const deltaX = e.clientX - startPos;
                    // For schema panel we need to convert size to percentage
                    const currentWidth = panel.offsetWidth;
                    const newWidth = startSize - deltaX;
                    
                    // Calculate percentage of parent width
                    const newWidthPercent = (newWidth / parentWidth) * 100;
                    
                    // Set minimum and maximum widths in percentage
                    if (newWidthPercent >= 10 && newWidthPercent <= 80) {
                        panel.style.width = newWidthPercent + '%';
                        
                        // Update DB map lines after resize
                        if (window.DatabaseEngine) {
                            window.DatabaseEngine.updateAllJoinLines(document.getElementById('map-canvas'));
                        }
                    }
                }
            }
            
            function stopResize() {
                document.removeEventListener('mousemove', resize);
                document.body.classList.remove('resizing', 'resizing-vertical');
                
                // Save the panel sizes to localStorage to preserve user preferences
                localStorage.setItem('missionPanelHeight', missionPanel.offsetHeight);
                localStorage.setItem('resultsPanelHeight', resultsPanel.offsetHeight);
                localStorage.setItem('schemaPanelWidth', schemaPanel.offsetWidth);
            }
        }
        
        // Load saved sizes from localStorage if available
        function loadSavedPanelSizes() {
            const savedMissionHeight = localStorage.getItem('missionPanelHeight');
            const savedResultsHeight = localStorage.getItem('resultsPanelHeight');
            const savedSchemaWidth = localStorage.getItem('schemaPanelWidth');
            
            if (savedMissionHeight && missionPanel) {
                missionPanel.style.height = savedMissionHeight + 'px';
            }
            
            if (savedResultsHeight && resultsPanel) {
                resultsPanel.style.height = savedResultsHeight + 'px';
            }
            
            if (savedSchemaWidth && schemaPanel) {
                // Calculate width as percentage of parent width
                const parentWidth = schemaPanel.parentElement.offsetWidth;
                const widthPercent = (savedSchemaWidth / parentWidth) * 100;
                schemaPanel.style.width = widthPercent + '%';
            }
        }
        
        // Try to load saved sizes
        loadSavedPanelSizes();
    }

    // --- Helper Functions ---
    function debounce(func, delay) { 
        let debounceTimer; 
        return function(...args) { 
            clearTimeout(debounceTimer); 
            debounceTimer = setTimeout(() => { 
                func.apply(this, args); 
            }, delay); 
        }; 
    }

    // --- Event Listeners Setup ---
    function setupEventListeners() {
        submitBtn.addEventListener('click', executeQueryAndVisualize);
        clearBtn.addEventListener('click', () => { 
            sqlInput.value = ''; 
            clearResults(); 
            if (window.DatabaseEngine) {
                DatabaseEngine.updateVisualization(null, mapCanvas, svgContainer);
            }
        });
        
        // DB Registry button event listener - FIXED
        const dbRegistryBtn = document.getElementById('open-db-browser-header-btn');
        if (dbRegistryBtn) {
            dbRegistryBtn.addEventListener('click', () => {
                const dbBrowser = document.getElementById('db-browser-overlay');
                const dbBackdrop = document.querySelector('.db-browser-backdrop');
                if (window.DatabaseEngine) {
                    DatabaseEngine.renderDatabaseBrowserItems();
                }
                if (dbBrowser) dbBrowser.style.display = 'flex';
                if (dbBackdrop) dbBackdrop.style.display = 'block';
            });
            console.log('DB Registry button listener attached');
        } else {
            console.error('DB Registry button not found!');
        }
        
        // Play typing sound on SQL input
        sqlInput.addEventListener('input', () => {
            playRandomTypingSound();
        });
        
        // Settings panel functionality
        const settingsBtn = document.getElementById('open-settings-btn');
        const settingsOverlay = document.getElementById('settings-overlay');
        const settingsBackdrop = document.querySelector('.settings-backdrop');
        const settingsClose = document.querySelector('.settings-close');
        const saveSettingsBtn = document.getElementById('save-settings');
        const resetSettingsBtn = document.getElementById('reset-settings');
        
        // Sound settings controls
        const masterVolumeSlider = document.getElementById('master-volume');
        const musicVolumeSlider = document.getElementById('music-volume');
        const effectsVolumeSlider = document.getElementById('effects-volume');
        const typingVolumeSlider = document.getElementById('typing-volume');
        const musicToggle = document.getElementById('music-toggle');
        const effectsToggle = document.getElementById('effects-toggle');
        const typingToggle = document.getElementById('typing-toggle');
        
        // Volume value displays
        const volumeDisplays = document.querySelectorAll('.volume-value');
        
        // Initialize sliders with current settings
        masterVolumeSlider.value = soundSettings.masterVolume;
        musicVolumeSlider.value = soundSettings.musicVolume;
        effectsVolumeSlider.value = soundSettings.effectsVolume;
        typingVolumeSlider.value = soundSettings.typingVolume;
        
        // Initialize toggles with current settings
        musicToggle.checked = soundSettings.musicEnabled;
        effectsToggle.checked = soundSettings.effectsEnabled;
        typingToggle.checked = soundSettings.typingSoundEnabled;
        
        // Update volume displays
        volumeDisplays[0].textContent = `${Math.round(soundSettings.masterVolume * 100)}%`;
        volumeDisplays[1].textContent = `${Math.round(soundSettings.musicVolume * 100)}%`;
        volumeDisplays[2].textContent = `${Math.round(soundSettings.effectsVolume * 100)}%`;
        volumeDisplays[3].textContent = `${Math.round(soundSettings.typingVolume * 100)}%`;
        
        // Add event listeners for the settings panel
        settingsBtn.addEventListener('click', () => {
            settingsOverlay.style.display = 'block';
            settingsBackdrop.style.display = 'block';
        });
        
        const closeSettings = () => {
            settingsOverlay.style.display = 'none';
            settingsBackdrop.style.display = 'none';
        };
        
        settingsClose.addEventListener('click', closeSettings);
        settingsBackdrop.addEventListener('click', closeSettings);
        
        // Real-time volume slider updates
        masterVolumeSlider.addEventListener('input', (e) => {
            const value = parseFloat(e.target.value);
            volumeDisplays[0].textContent = `${Math.round(value * 100)}%`;
            soundSettings.updateMasterVolume(value);
        });
        
        musicVolumeSlider.addEventListener('input', (e) => {
            const value = parseFloat(e.target.value);
            volumeDisplays[1].textContent = `${Math.round(value * 100)}%`;
            soundSettings.updateMusicVolume(value);
        });
        
        effectsVolumeSlider.addEventListener('input', (e) => {
            const value = parseFloat(e.target.value);
            volumeDisplays[2].textContent = `${Math.round(value * 100)}%`;
            soundSettings.effectsVolume = value;
            if (window.errorSound) {
                window.errorSound.volume = value * soundSettings.masterVolume;
            }
        });
        
        typingVolumeSlider.addEventListener('input', (e) => {
            const value = parseFloat(e.target.value);
            volumeDisplays[3].textContent = `${Math.round(value * 100)}%`;
            soundSettings.typingVolume = value;
        });
        
        // Toggle switches
        musicToggle.addEventListener('change', (e) => {
            soundSettings.toggleMusic(e.target.checked);
        });
        
        effectsToggle.addEventListener('change', (e) => {
            soundSettings.toggleEffects(e.target.checked);
        });
        
        typingToggle.addEventListener('change', (e) => {
            soundSettings.toggleTypingSound(e.target.checked);
        });
        
        // Save and reset buttons
        saveSettingsBtn.addEventListener('click', () => {
            soundSettings.saveSettings();
            displayMessage("Sound settings saved.", "status-success", 2000);
            closeSettings();
        });
        
        resetSettingsBtn.addEventListener('click', () => {
            // Reset to defaults
            soundSettings.masterVolume = 0.5;
            soundSettings.musicVolume = 0.3;
            soundSettings.effectsVolume = 0.5;
            soundSettings.typingVolume = 0.5;
            soundSettings.musicEnabled = true;
            soundSettings.effectsEnabled = true;
            soundSettings.typingSoundEnabled = true;
            
            // Update UI
            masterVolumeSlider.value = soundSettings.masterVolume;
            musicVolumeSlider.value = soundSettings.musicVolume;
            effectsVolumeSlider.value = soundSettings.effectsVolume;
            typingVolumeSlider.value = soundSettings.typingVolume;
            musicToggle.checked = soundSettings.musicEnabled;
            effectsToggle.checked = soundSettings.effectsEnabled;
            typingToggle.checked = soundSettings.typingSoundEnabled;
            
            volumeDisplays[0].textContent = `${Math.round(soundSettings.masterVolume * 100)}%`;
            volumeDisplays[1].textContent = `${Math.round(soundSettings.musicVolume * 100)}%`;
            volumeDisplays[2].textContent = `${Math.round(soundSettings.effectsVolume * 100)}%`;
            volumeDisplays[3].textContent = `${Math.round(soundSettings.typingVolume * 100)}%`;
            
            // Apply settings
            soundSettings.updateMasterVolume(soundSettings.masterVolume);
            soundSettings.updateMusicVolume(soundSettings.musicVolume);
            soundSettings.toggleMusic(soundSettings.musicEnabled);
            
            displayMessage("Sound settings reset to defaults.", "status-success", 2000);
        });
        
        // ...existing event listeners for SQL console and other components...
        sqlInput.addEventListener('keydown', (e) => { 
            if (e.key === 'Enter' && !e.shiftKey) { 
                e.preventDefault(); 
                executeQueryAndVisualize(); 
            } 
        });
        
        sqlInput.addEventListener('input', debounce(() => { 
            const currentQuery = sqlInput.value.trim(); 
            if (currentQuery && window.DatabaseEngine) { 
                try { 
                    const parsedInfo = DatabaseEngine.parseQueryForVis(currentQuery); 
                    DatabaseEngine.updateVisualization(parsedInfo, mapCanvas, svgContainer); 
                } catch(e) { 
                    console.error("Error parsing for schema vis on input:", e); 
                    DatabaseEngine.updateVisualization(null, mapCanvas, svgContainer); 
                } 
            } else if (window.DatabaseEngine) { 
                DatabaseEngine.updateVisualization(null, mapCanvas, svgContainer); 
            } 
        }, 500));
        
        // Connect mission system event handlers
        if (window.MissionSystem) {
            hintToggler.addEventListener('click', MissionSystem.toggleHint);
            completeMissionBtn.addEventListener('click', MissionSystem.complete);
            nextMissionBtn.addEventListener('click', MissionSystem.next);
            const solutionToggler = document.getElementById('solution-toggler'); 
            if (solutionToggler) { 
                solutionToggler.addEventListener('click', MissionSystem.toggleSolution); 
            }
        }
        
        toggleMapBtn.addEventListener('click', () => togglePanel(mapContainer)); // Schema map toggle

        // Map header button
        if (openMapBtn) {
            openMapBtn.addEventListener('click', () => {
                if (window.MapIntegration) {
                    MapIntegration.show();
                }
            });
        } else { 
            console.error("Open Map Header Button not found!"); 
        }

        // Review overlay functionality
        const openReviewBtn = document.getElementById('open-review-btn');
        const reviewOverlay = document.getElementById('review-overlay');
        const reviewBackdrop = document.querySelector('.review-backdrop');
        const reviewCloseBtn = document.querySelector('.review-close');
        const reviewForm = document.getElementById('review-form');
        const cancelReviewBtn = document.getElementById('cancel-review');
        const stars = document.querySelectorAll('.star');
        const ratingValue = document.getElementById('rating-value');
        const reviewThankyouMessage = document.getElementById('review-thankyou-message');

        // Track the current review number from localStorage
        let reviewNumber = parseInt(localStorage.getItem('etlReviewCount') || 2);

        // Set the initial subject with the current review number
        document.getElementById('review-email-subject').value = `ETL-Review[${reviewNumber}]`;

        // Open review overlay
        if (openReviewBtn) {
            openReviewBtn.addEventListener('click', () => {
                reviewOverlay.style.display = 'block';
                reviewBackdrop.style.display = 'block';
                playButtonClickSound();
            });
        }

        // Close review overlay
        function closeReviewOverlay() {
            reviewOverlay.style.display = 'none';
            reviewBackdrop.style.display = 'none';
            playButtonClickSound();
        }

        if (reviewCloseBtn) {
            reviewCloseBtn.addEventListener('click', closeReviewOverlay);
        }

        if (cancelReviewBtn) {
            cancelReviewBtn.addEventListener('click', closeReviewOverlay);
        }

        // Handle star rating
        if (stars) {
            stars.forEach(star => {
                star.addEventListener('click', () => {
                    const rating = star.getAttribute('data-rating');
                    ratingValue.value = rating;
                    
                    // Reset all stars
                    stars.forEach(s => s.classList.remove('active'));
                    
                    // Highlight stars up to the selected one
                    stars.forEach(s => {
                        if (parseInt(s.getAttribute('data-rating')) <= parseInt(rating)) {
                            s.classList.add('active');
                        }
                    });
                    
                    playButtonClickSound();
                });
            });
        }

        // Handle review form submission
        if (reviewForm) {
            reviewForm.addEventListener('submit', (e) => {
                e.preventDefault();
                
                // Add timestamp
                const now = new Date();
                document.getElementById('review-timestamp').value = now.toISOString();
                
                // Increment the review counter for next time
                reviewNumber++;
                localStorage.setItem('etlReviewCount', reviewNumber);
                
                // Get the form data
                const formData = new FormData(reviewForm);
                
                // Send the data using fetch
                fetch(reviewForm.action, {
                    method: 'POST',
                    body: formData,
                    headers: {
                        'Accept': 'application/json'
                    }
                })
                .then(response => {
                    // Show thank you message and hide the form
                    reviewForm.style.display = 'none';
                    reviewThankyouMessage.style.display = 'block';
                    
                    // Close overlay after delay
                    setTimeout(() => {
                        closeReviewOverlay();
                        // Reset form for next use
                        reviewForm.reset();
                        reviewForm.style.display = 'block';
                        reviewThankyouMessage.style.display = 'none';
                        stars.forEach(s => s.classList.remove('active'));
                        ratingValue.value = 0;
                    }, 3000);
                })
                .catch(error => {
                    console.error('Error submitting review:', error);
                });
            });
        }
    }

    // --- Make functions available globally ---
    window.GameSystem = {
        displayMessage,
        showError,
        clearResults,
        showMapPlaceholder,
        hideMapPlaceholder,
        updateScore,
        get gameData() { return gameData; }
    };

    // --- Start Game ---
    initializeGame();
    
    
    // --- Resizable Panel Functionality ---
    function initializeResizablePanels() {
        // Panel elements
        const missionPanel = document.querySelector('.mission-display');
        const resultsPanel = document.querySelector('.results-area');
        const schemaPanel = document.getElementById('db-map-container');
        const mainContent = document.querySelector('.main-content');
        
        // Resize handles
        const missionResizeHandle = document.getElementById('mission-resize-handle');
        const resultsResizeHandle = document.getElementById('results-resize-handle');
        const schemaResizeHandle = document.getElementById('schema-resize-handle');
        
        // Store initial sizes from localStorage or defaults
        const savedSizes = JSON.parse(localStorage.getItem('panelSizes') || '{}');
        
        if (savedSizes.missionHeight) {
            missionPanel.style.height = savedSizes.missionHeight + 'px';
        }
        
        if (savedSizes.schemaWidth) {
            schemaPanel.style.width = savedSizes.schemaWidth + 'px';
        }
        
        // Variables to track resize state
        let isResizing = false;
        let currentPanel = null;
        let initialSize = 0;
        let initialMousePos = 0;
        let resizeTimer = null;
        
        // Mission panel resizing - now the handle is in a separate container
        if (missionResizeHandle) {
            missionResizeHandle.addEventListener('mousedown', (e) => {
                e.preventDefault();
                startResize(e, missionPanel, 'height');
            });
        }
        
        // Results panel resizing
        if (resultsResizeHandle) {
            resultsResizeHandle.addEventListener('mousedown', (e) => {
                e.preventDefault();
                startResize(e, resultsPanel, 'height');
            });
        }
        
        // Schema panel resizing
        if (schemaResizeHandle) {
            schemaResizeHandle.addEventListener('mousedown', (e) => {
                e.preventDefault();
                startResize(e, schemaPanel, 'width');
            });
        }
        
        function startResize(e, panel, dimension) {
            isResizing = true;
            currentPanel = panel;
            initialSize = dimension === 'height' ? panel.offsetHeight : panel.offsetWidth;
            initialMousePos = dimension === 'height' ? e.clientY : e.clientX;
            
            // Add resizing class to body
            document.body.classList.add(dimension === 'height' ? 'resizing-vertical' : 'resizing');
            
            // Set up mouse move and mouse up events
            document.addEventListener('mousemove', handleResize);
            document.addEventListener('mouseup', stopResize);
        }
        
        function handleResize(e) {
            if (!isResizing || !currentPanel) return;
            
            // Throttle updates for better performance
            if (resizeTimer) return;
            
            resizeTimer = setTimeout(() => {
                if (currentPanel === missionPanel) {
                    const newHeight = initialSize + (e.clientY - initialMousePos);
                    // Set min and max constraints
                    const constrainedHeight = Math.max(100, Math.min(mainContent.offsetHeight * 0.7, newHeight));
                    currentPanel.style.height = constrainedHeight + 'px';
                    // Save size to localStorage
                    saveSize('missionHeight', constrainedHeight);
                } else if (currentPanel === resultsPanel) {
                    const newHeight = initialSize + (e.clientY - initialMousePos);
                    const constrainedHeight = Math.max(100, Math.min(mainContent.offsetHeight * 0.7, newHeight));
                    currentPanel.style.height = constrainedHeight + 'px';
                    // Save size to localStorage
                    saveSize('resultsHeight', constrainedHeight);
                } else if (currentPanel === schemaPanel) {
                    const newWidth = initialSize - (e.clientX - initialMousePos);
                    // Set min and max constraints
                    const constrainedWidth = Math.max(100, Math.min(window.innerWidth * 0.8, newWidth));
                    currentPanel.style.width = constrainedWidth + 'px';
                    // Save size to localStorage
                    saveSize('schemaWidth', constrainedWidth);
                }
                
                // Update schema join lines if needed
                if (window.DatabaseEngine) {
                    // Use requestAnimationFrame for smoother updates of join lines
                    requestAnimationFrame(() => {
                        window.DatabaseEngine.updateAllJoinLines(mapCanvas);
                    });
                }
                
                resizeTimer = null;
            }, 16); // ~60fps timing
        }
        
        function stopResize() {
            isResizing = false;
            currentPanel = null;
            
            // Clear any pending timer
            if (resizeTimer) {
                clearTimeout(resizeTimer);
                resizeTimer = null;
            }
            
            // Remove resizing classes from body
            document.body.classList.remove('resizing', 'resizing-vertical');
            
            // Remove event listeners
            document.removeEventListener('mousemove', handleResize);
            document.removeEventListener('mouseup', stopResize);
            
            // Final update of schema join lines
            if (window.DatabaseEngine) {
                window.DatabaseEngine.updateAllJoinLines(mapCanvas);
            }
        }
        
        function saveSize(key, value) {
            // Load current saved sizes
            const currentSizes = JSON.parse(localStorage.getItem('panelSizes') || '{}');
            // Update the specified size
            currentSizes[key] = value;
            // Save back to localStorage
            localStorage.setItem('panelSizes', JSON.stringify(currentSizes));
        }
    }
    
    // Position the central handle at the fixed bottom of the main content area
    function repositionCentralHandle() {
        if (!centralHandle || !mainContent || !schemaPanel) return;
        
        // Calculate position based on current panel layout
        const contentRect = contentArea.getBoundingClientRect();
        const mainRect = mainContent.getBoundingClientRect();
        const schemaRect = schemaPanel.getBoundingClientRect();
        
        // Position at the intersection of main content and schema panel horizontally
        const xPosition = mainRect.right;
        
        // Position at the bottom of the main content container (not tied to mission panel)
        // This ensures it stays at the bottom even when mission content scrolls
        const yPosition = mainRect.bottom - 20; // 20px from the bottom for better visibility
        
        // Position relative to the content area
        centralHandle.style.left = (xPosition - contentRect.left) + 'px';
        centralHandle.style.top = (yPosition - contentRect.top) + 'px';
    }
    
    // --- Multidirectional Central Resize Handle Logic ---
    function setupCentralResizeHandle() {
        const centralHandle = document.getElementById('central-resize-handle');
        const contentArea = document.querySelector('.content-area');
        const mainContent = document.querySelector('.main-content');
        const schemaPanel = document.getElementById('db-map-container');
        const missionPanel = document.querySelector('.mission-display');
        const resultsPanel = document.querySelector('.results-area');
        
        if (!centralHandle || !contentArea || !mainContent || !schemaPanel) {
            console.error('Central resize handle or required elements not found');
            return;
        }
        
        // Variables for resize state
        let isResizing = false;
        let startX = 0;
        let startY = 0;
        let startMainWidth = 0;
        let startSchemaWidth = 0;
        let startMissionHeight = 0;
        
        // Handle mouse events
        centralHandle.addEventListener('mousedown', startResize);
        
        function startResize(e) {
            e.preventDefault();
            e.stopPropagation();
            
            isResizing = true;
            centralHandle.classList.add('dragging');
            document.body.style.cursor = 'move';
            
            // Get the starting position of pointer
            startX = e.clientX;
            startY = e.clientY;
            
            // Measure initial sizes
            startMainWidth = mainContent.offsetWidth;
            startSchemaWidth = schemaPanel.offsetWidth;
            startMissionHeight = missionPanel.offsetHeight;
            
            // Add event listeners for resize
            document.addEventListener('mousemove', handleResize);
            document.addEventListener('mouseup', stopResize);
        }
        
        // Control update frequency
        let lastUpdateTime = 0;
        const minUpdateInterval = 16; // ~60fps
        
        function handleResize(e) {
            if (!isResizing) return;
            
            // Throttle updates
            const now = Date.now();
            if (now - lastUpdateTime < minUpdateInterval) return;
            lastUpdateTime = now;
            
            // Calculate delta movements
            const deltaX = e.clientX - startX;
            const deltaY = e.clientY - startY;
            
            // Horizontal resize - adjust main content and schema widths
            if (Math.abs(deltaX) > 3) {
                const contentWidth = contentArea.offsetWidth;
                const newMainWidth = startMainWidth + deltaX;
                const newSchemaWidth = contentWidth - newMainWidth;
                
                // Apply constraints
                if (newMainWidth >= 250 && newSchemaWidth >= 100) {
                    const mainPercent = (newMainWidth / contentWidth) * 100;
                    const schemaPercent = 100 - mainPercent;
                    
                    mainContent.style.flexBasis = `${mainPercent}%`;
                    schemaPanel.style.width = `${schemaPercent}%`;
                    
                    // Save sizes
                    localStorage.setItem('mainContentWidth', mainPercent);
                    localStorage.setItem('schemaPanelWidth', schemaPercent);
                }
            }
            
            // Vertical resize - adjust mission panel height
            if (Math.abs(deltaY) > 3) {
                const mainHeight = mainContent.offsetHeight;
                const newMissionHeight = startMissionHeight + deltaY;
                
                // Apply constraints
                if (newMissionHeight >= 100 && newMissionHeight <= mainHeight * 0.7) {
                    missionPanel.style.height = `${newMissionHeight}px`;
                    
                    // Save size
                    localStorage.setItem('missionPanelHeight', newMissionHeight);
                }
            }
            
            // Update schema join lines with the smoothest possible performance
            if (window.DatabaseEngine) {
                requestAnimationFrame(() => {
                    window.DatabaseEngine.updateAllJoinLines(mapCanvas);
                });
            }
        }
        
        function stopResize() {
            if (!isResizing) return;
            
            isResizing = false;
            centralHandle.classList.remove('dragging');
            document.body.style.cursor = '';
            
            // Clean up event listeners
            document.removeEventListener('mousemove', handleResize);
            document.removeEventListener('mouseup', stopResize);
            
            // Final update of schema join lines
            if (window.DatabaseEngine) {
                window.DatabaseEngine.updateAllJoinLines(mapCanvas);
            }
        }
        
        // Load saved sizes if available
        function loadSavedSizes() {
            const mainPercent = localStorage.getItem('mainContentWidth');
            const schemaPercent = localStorage.getItem('schemaPanelWidth');
            const missionHeight = localStorage.getItem('missionPanelHeight');
            
            if (mainPercent && schemaPercent) {
                mainContent.style.flexBasis = `${mainPercent}%`;
                schemaPanel.style.width = `${schemaPercent}%`;
            }
            
            if (missionHeight) {
                missionPanel.style.height = `${missionHeight}px`;
            }
        }
        
        // Initialize with saved sizes
        loadSavedSizes();
        
        // Handle window resize events to ensure handle stays in position
        window.addEventListener('resize', debounce(() => {
            // No need to reposition, CSS handles this
        }, 100));
    }
    
}); // End DOMContentLoaded