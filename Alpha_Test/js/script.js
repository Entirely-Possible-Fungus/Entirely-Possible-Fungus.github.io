// Add randomized CRT flicker intensity
document.addEventListener('DOMContentLoaded', () => {
    // Function to properly initialize Web Audio API (requires user interaction)
    function setupWebAudio() {
        // Remove this event listener once executed
        document.removeEventListener('click', setupWebAudio, true);
        document.removeEventListener('keydown', setupWebAudio, true);
        
        // Initialize audio context if not already done
        if (window.AudioPoolManager && (!AudioPoolManager.audioContext || 
            AudioPoolManager.audioContext.state === 'suspended')) {
            
            console.log("Setting up Web Audio API after user interaction");
            AudioPoolManager.initAudioContext();
            
            if (AudioPoolManager.audioContext) {
                AudioPoolManager.audioContext.resume().then(() => {
                    console.log("AudioContext started successfully");
                }).catch(err => {
                    console.warn("Failed to start AudioContext:", err);
                });
            }
        }
    }
    
    // Add event listeners for first interaction
    document.addEventListener('click', setupWebAudio, true);
    document.addEventListener('keydown', setupWebAudio, true);

    // Enhanced Audio Pool Manager to handle sound effects efficiently with no stuttering
    window.AudioPoolManager = {
        pools: {}, // Will hold our audio pools for different sound types
        audioContext: null, // Web Audio API context
        masterGainNode: null, // Master volume control
        
        // Initialize the Audio Context for better performance
        initAudioContext: function() {
            if (this.audioContext) return this.audioContext;
            
            try {
                // Create audio context with fallback
                const AudioContext = window.AudioContext || window.webkitAudioContext;
                this.audioContext = new AudioContext();
                
                // Create master gain node for volume control
                this.masterGainNode = this.audioContext.createGain();
                this.masterGainNode.connect(this.audioContext.destination);
                
                console.log("Audio context initialized successfully");
                return this.audioContext;
            } catch (err) {
                console.error("Failed to initialize audio context:", err);
                return null;
            }
        },
        
        // Initialize a pool of audio buffer sources for a specific sound
        initPool: function(soundType, path, size = 5) {
            // If pool already exists, just return it
            if (this.pools[soundType]) {
                return this.pools[soundType];
            }
            
            // Initialize audio context if needed
            this.initAudioContext();
            
            // Create the pool structure
            this.pools[soundType] = {
                path: path,
                buffer: null,
                size: size,
                isLoading: true,
                loadError: null
            };
            
            // Load the audio file as a buffer (more efficient than Audio elements)
            fetch(path)
                .then(response => {
                    if (!response.ok) {
                        throw new Error(`HTTP error! status: ${response.status}`);
                    }
                    return response.arrayBuffer();
                })
                .then(arrayBuffer => this.audioContext.decodeAudioData(arrayBuffer))
                .then(audioBuffer => {
                    this.pools[soundType].buffer = audioBuffer;
                    this.pools[soundType].isLoading = false;
                    console.log(`Audio pool for ${soundType} loaded successfully`);
                })
                .catch(err => {
                    this.pools[soundType].loadError = err;
                    this.pools[soundType].isLoading = false;
                    console.error(`Failed to load audio for ${soundType}:`, err);
                    
                    // Create a backup method using traditional Audio elements
                    this.initFallbackPool(soundType, path, size);
                });
            
            console.log(`Audio pool for ${soundType} initialized with buffer-based approach`);
            return this.pools[soundType];
        },
        
        // Fallback to traditional Audio elements if buffer loading fails
        initFallbackPool: function(soundType, path, size) {
            console.log(`Using fallback Audio elements for ${soundType}`);
            
            this.pools[soundType] = {
                path: path,
                available: [],
                inUse: [],
                size: size,
                useFallback: true
            };
            
            // Pre-create Audio elements
            for (let i = 0; i < size; i++) {
                const audio = new Audio(path);
                audio.preload = 'auto';
                this.pools[soundType].available.push(audio);
            }
        },
        
        // Play a sound with Web Audio API (more efficient)
        playSound: function(soundType, path, volume = 0.5, customPlayFunction = null) {
            // Check if sound should be played
            if (window.soundSettings && !window.soundSettings.effectsEnabled && soundType !== 'typing') {
                return null;
            }
            
            if (soundType === 'typing' && window.soundSettings && !window.soundSettings.typingSoundEnabled) {
                return null;
            }
            
            // Initialize pool if it doesn't exist
            if (!this.pools[soundType]) {
                this.initPool(soundType, path, soundType === 'typing' ? 15 : 5);
            }
            
            // Get the pool
            const pool = this.pools[soundType];
            
            // Calculate appropriate volume
            let adjustedVolume = volume;
            if (window.soundSettings) {
                if (soundType === 'typing') {
                    adjustedVolume = window.soundSettings.typingVolume * window.soundSettings.masterVolume * volume;
                } else {
                    adjustedVolume = window.soundSettings.effectsVolume * window.soundSettings.masterVolume * volume;
                }
            }
            
            // If the buffer is loaded, use Web Audio API for better performance
            if (pool.buffer && !pool.useFallback) {
                try {
                    // Create source node
                    const source = this.audioContext.createBufferSource();
                    source.buffer = pool.buffer;
                    
                    // Create gain node for this sound's volume
                    const gainNode = this.audioContext.createGain();
                    gainNode.gain.value = adjustedVolume;
                    
                    // Connect nodes: source → gain → master → output
                    source.connect(gainNode);
                    gainNode.connect(this.masterGainNode);
                    
                    // Handle custom play function for special cases like typing
                    if (customPlayFunction) {
                        customPlayFunction({
                            play: () => source.start(0),
                            stop: () => {
                                try {
                                    source.stop(0);
                                } catch (e) {
                                    // Ignore errors from stopping already stopped sources
                                }
                            },
                            volume: adjustedVolume,
                            // For typing sound random position
                            setPosition: (time) => {
                                source.start(0, time);
                                // Auto-stop after a reasonable time to avoid memory leaks
                                setTimeout(() => {
                                    try {
                                        if (source && source.context.state !== 'closed') {
                                            source.stop(0);
                                        }
                                    } catch (e) {
                                        // Ignore errors from stopping already stopped sources
                                    }
                                }, 300);
                            }
                        });
                    } else {
                        // Start immediately for normal sounds
                        source.start(0);
                    }
                    
                    return source;
                } catch (err) {
                    console.error(`Error playing ${soundType} with Web Audio API:`, err);
                    // Fall back to Audio element approach
                    pool.useFallback = true;
                }
            }
            
            // Fallback: Use Audio elements if buffer not loaded or there was an error
            if (pool.useFallback) {
                let audio;
                
                // Get available audio or reuse the oldest one
                if (pool.available && pool.available.length > 0) {
                    audio = pool.available.pop();
                    pool.inUse.push(audio);
                } else if (pool.inUse && pool.inUse.length > 0) {
                    // Reuse the oldest sound
                    audio = pool.inUse.shift();
                    pool.inUse.push(audio);
                    
                    // Reset it
                    audio.pause();
                    audio.currentTime = 0;
                } else {
                    // Create new as last resort
                    audio = new Audio(path);
                }
                
                // Set volume
                audio.volume = adjustedVolume;
                
                // Setup cleanup
                const returnToPool = () => {
                    if (pool.inUse) {
                        const index = pool.inUse.indexOf(audio);
                        if (index !== -1) {
                            pool.inUse.splice(index, 1);
                            if (pool.available) {
                                pool.available.push(audio);
                            }
                        }
                    }
                    audio.removeEventListener('ended', returnToPool);
                };
                
                audio.addEventListener('ended', returnToPool);
                
                // Play with custom function or directly
                if (customPlayFunction) {
                    customPlayFunction(audio);
                } else {
                    audio.play().catch(err => {
                        console.error(`Error playing ${soundType} sound:`, err);
                    });
                }
                
                return audio;
            }
            
            return null;
        }
    };

    // Initialize sound settings immediately at the beginning to ensure they're available
    window.soundSettings = {
        masterVolume: 0.2,
        musicVolume: 0.1,
        effectsVolume: 0.5,
        typingVolume: 0.5,
        musicEnabled: true,
        effectsEnabled: true,
        typingSoundEnabled: true,
        
        // Methods for managing sound
        updateMasterVolume: function(value) {
            this.masterVolume = value;
            
            // Update background music volume
            if (backgroundMusic) {
                backgroundMusic.volume = this.musicVolume * this.masterVolume;
            }
            
            // Update Web Audio API master volume if available
            if (AudioPoolManager && AudioPoolManager.masterGainNode) {
                AudioPoolManager.masterGainNode.gain.value = this.masterVolume;
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
    
    // Try to load settings from localStorage immediately
    window.soundSettings.loadSettings();
    
    // console.log("Sound settings initialized early in page load");

    // IMMEDIATE BUTTON SETUP - Run this even before splash screen code
    const earlyButtonSetup = () => {
        const completeMissionBtns = document.querySelectorAll('#complete-mission-btn');
        const sqlConsole = document.getElementById('sql-console');
        
        if (completeMissionBtns.length > 0 && sqlConsole) {
            // console.log("EARLY BUTTON SETUP - Setting initial visibility");
            // Set both buttons to visible initially, but they'll be disabled until mission is solved
            completeMissionBtns.forEach(btn => {
                btn.style.display = 'block';
                btn.style.visibility = 'visible';
                btn.disabled = true; // Disabled by default until mission is solved
            });
            
            sqlConsole.style.visibility = 'visible';
            sqlConsole.style.display = 'flex';
        } else {
            // console.log("EARLY BUTTON SETUP - Elements not found");
        }
    };
    
    earlyButtonSetup();
    
    // Splash screen handling
    const splashScreen = document.getElementById('splash-screen');
    const gameContainer = document.querySelector('.game-container');
    let gameInitialized = false;
    
    // Hide game content until splash screen is dismissed, BUT preserve SQL console visibility
    if (gameContainer) {
        gameContainer.style.visibility = 'hidden';
        
        // Ensure SQL console stays visible
        const sqlConsole = document.getElementById('sql-console');
        if (sqlConsole) {
            sqlConsole.style.visibility = 'visible';
        }
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
        musicVolume: 0.1,
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
    
    // Initialize Web Audio API context first
    AudioPoolManager.initAudioContext();
    
    // Pre-initialize all audio pools for better performance
    // Group sounds by priority and frequency of use
    
    // High priority/frequent sounds - load these first
    AudioPoolManager.initPool('typing', typingSoundPath, 3);  // Reduced pool size since we're using buffer-based playback
    AudioPoolManager.initPool('hover', hoverSoundPath, 2);
    AudioPoolManager.initPool('click', './audio/766611__stavsounds__keyboard_clicky_15.ogg', 2);
    
    // Medium priority sounds
    setTimeout(() => {
        AudioPoolManager.initPool('error', sqlErrorSoundPath, 2);
        AudioPoolManager.initPool('incorrectAnswer', './audio/619803__teh_bucket__error-fizzle.ogg', 2);
    }, 500);
    
    // Lower priority sounds - load these last
    setTimeout(() => {
        AudioPoolManager.initPool('dbClick', './audio/button-202966.ogg', 2);
        AudioPoolManager.initPool('missionComplete', missionCompleteSoundPath, 1);
    }, 1000);
    
    // Create a compatibility wrapper for backward compatibility
    window.errorSound = {
        play: function() {
            // Return a promise-like object with catch method
            const audioEl = AudioPoolManager.playSound('error', sqlErrorSoundPath, 1.0);
            return {
                catch: function(callback) {
                    // Handle both cases - if audioEl is a real promise or not
                    if (audioEl && typeof audioEl.catch === 'function') {
                        return audioEl.catch(callback);
                    }
                    // Return a thenable object to keep promise chain working
                    return {
                        then: function() {
                            return this;
                        },
                        catch: function() {
                            return this;
                        }
                    };
                }
            };
        },
        volume: soundSettings.effectsVolume * soundSettings.masterVolume
    };
    
    console.log("Audio pool system initialized with appropriate pool sizes");
    
    // Function to play random typing sound samples using Web Audio API for better performance
    // Use throttling to prevent excessive typing sounds that cause stuttering
    const playRandomTypingSoundThrottled = (() => {
        let lastTypingTime = 0;
        const minInterval = 50; // Minimum 50ms between typing sounds
        let typingSoundCounter = 0;
        
        return function() {
            if (!soundSettings.typingSoundEnabled) return;
            
            const now = Date.now();
            // Skip if we're typing too fast
            if (now - lastTypingTime < minInterval) {
                return;
            }
            
            // We'll play sound for every other keystroke at most when typing very fast
            typingSoundCounter++;
            if (typingSoundCounter % 2 !== 0 && now - lastTypingTime < 100) {
                return;
            }
            
            lastTypingTime = now;
            
            // Use the enhanced audio pool with optimized buffer playback
            AudioPoolManager.playSound('typing', typingSoundPath, 0.8, (sound) => {
                // For buffer-based playback
                if (sound.setPosition) {
                    // Get a random position in the buffer for variety
                    const typingSoundDuration = 2.0; // Approximate duration of typing sound in seconds
                    const maxStartTime = Math.max(0, typingSoundDuration - 0.3);
                    const randomStartTime = Math.random() * maxStartTime;
                    
                    try {
                        // Play from random position with automatic cleanup
                        sound.setPosition(randomStartTime);
                    } catch (err) {
                        console.error("Error setting position for typing sound:", err);
                    }
                    return;
                }
                
                // Fallback for Audio element-based playback
                try {
                    // Create shorter, more natural key press sounds
                    if (sound.duration) {
                        const maxStartTime = Math.max(0, sound.duration - 0.3);
                        const randomStartTime = Math.random() * maxStartTime;
                        
                        // Set the start time
                        sound.currentTime = randomStartTime;
                    }
                    
                    // Apply short duration for typing sounds
                    sound.play().catch(err => {
                        console.error("Typing sound play failed:", err);
                    });
                    
                    // Ensure sound stops after a shorter duration to prevent overlap
                    setTimeout(() => {
                        if (!sound.paused) {
                            sound.pause();
                        }
                    }, 120); // Even shorter duration further reduces overlapping issues
                } catch (err) {
                    console.error("Error playing typing sound:", err);
                }
            });
        };
    })();
    
    // Original function now calls the throttled version
    function playRandomTypingSound() {
        playRandomTypingSoundThrottled();
    }

    function tryLoadAudio() {
        let currentPathIndex = 0;
        function tryNextPath() {
            if (currentPathIndex >= possiblePaths.length) {
                console.error("All audio paths failed to load"); return;
            }
            const path = possiblePaths[currentPathIndex];
            // console.log(`Attempting to load audio from: ${path}`);
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
    // console.log("Audio element found:", clickSound !== null);

    const typewriterSoundPaths = [
        "./audio/mixkit-typewriter-soft-click-1125_r.wav"
    ];
    
    // Add hover sound to all buttons - optimized with buffer-based audio and throttling
    function setupButtonHoverSound() {
        // We'll use the already initialized audio pools
        
        // Add throttling to prevent too many sounds playing at once
        const throttledHover = throttle(() => {
            AudioPoolManager.playSound('hover', hoverSoundPath, 0.15);
        }, 50); // Minimum 50ms between hover sounds
        
        const throttledClick = throttle(() => {
            AudioPoolManager.playSound('click', './audio/766611__stavsounds__keyboard_clicky_15.ogg', 0.55);
        }, 80); // Minimum 80ms between click sounds
        
        // Get all buttons in the document
        const buttons = document.querySelectorAll('button, .nav-button, .pixel-btn');
        
        // Add hover event listeners to all buttons with improved event delegation
        document.addEventListener('mouseover', (event) => {
            // Check if the target or its parent is a button
            const button = event.target.closest('button, .nav-button, .pixel-btn');
            if (button) {
                throttledHover();
            }
        });
        
        // Add click sound with delegation to reduce event listeners
        document.addEventListener('click', (event) => {
            const button = event.target.closest('button, .nav-button, .pixel-btn');
            if (button) {
                throttledClick();
            }
        });
        
        console.log(`Optimized hover and click sounds added using event delegation`);
        
        // Make the hover sound function globally accessible with throttling
        window.playHoverSound = throttledHover;
        
        // Make button click sound globally accessible with throttling
        window.playButtonClickSound = throttledClick;
    }
    
    // Throttle function to prevent too many sounds playing at once
    function throttle(func, limit) {
        let inThrottle = false;
        return function() {
            if (!inThrottle) {
                func.apply(this, arguments);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        };
    }
    
    // Call the setup function to add hover sounds
    setupButtonHoverSound();

    // --- Main Game Logic ---
    // console.log("ETL - Initializing...");

    // --- Game State ---
    let score = 0;
    let lastResults = null;
    let liveQueryEnabled = true; // Default to enabled for live query updates

    // --- Game Data (Databases) ---
    let gameData = {
        databases: {}  // Will hold loaded database schemas
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
        
        // Resume audio context if suspended (needed for browsers that require user interaction)
        if (window.AudioPoolManager && AudioPoolManager.audioContext && 
            AudioPoolManager.audioContext.state === 'suspended') {
            AudioPoolManager.audioContext.resume().then(() => {
                console.log("AudioContext resumed successfully");
            }).catch(err => {
                console.warn("Failed to resume AudioContext:", err);
            });
        }
        
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
        let query = sqlInput.value.trim();
        
        if (query.length === 0) {
            return;
        }
        
        // Attempt to execute the query on each active database
        let results = executeQueryOnActiveDatabases(query);
        
        // Store results globally for graph visualization
        window.lastResults = results;
        // console.log("Set window.lastResults:", window.lastResults);
        
        // Update the schema visualization
        updateSchemaVisualization(query);
        
        // If GraphModule is available, also update the visualization there
        if (window.GraphModule && window.GraphModule.visualizeData) {
            // console.log("Updating graph visualization with query results");
            window.GraphModule.visualizeData(results);
        }
    }

    /**
     * Execute a SQL query on all active databases
     * @param {string} query - The SQL query to execute
     * @returns {Array|number} - Query results array or rows affected count
     */
    function executeQueryOnActiveDatabases(query) {
        if (!window.DatabaseEngine) {
            showError("Database engine is not available.");
            return [];
        }
        
        // Clear errors first
        errorDiv.textContent = '';
        errorDiv.style.display = 'none';
        
        try {
            // Execute the query
            // console.log("Executing query on active databases:", query);
            const results = window.DatabaseEngine.executeQuery(query);
            
            // Display the results
            displayResults(results, resultsDiv);
            
            // If the mission system is available, check if this solves the mission
            if (window.MissionSystem && window.MissionSystem.currentMissionId !== null) {
                // Check if the checkSolution function exists before calling it
                if (typeof window.MissionSystem.checkSolution === 'function') {
                    window.MissionSystem.checkSolution(query, results);
                } else {
                    console.log("Mission system detected but checkSolution function is not defined");
                }
            }
            
            // Process for map visualization if map is open
            processMapQueryResults(query, results);
            
            // Return the results for further processing
            return results;
        } catch (error) {
            // Handle SQL errors
            console.error("SQL Query Error:", error);
            showError(`SQL Error: ${error.message || error}`);
            
            // Play error sound using the audio pool with throttling to prevent stuttering
            // when multiple errors happen in quick succession
            if (!window.lastErrorSoundTime || (Date.now() - window.lastErrorSoundTime) > 300) {
                AudioPoolManager.playSound('error', sqlErrorSoundPath, 1.0);
                window.lastErrorSoundTime = Date.now();
            }
            
            return [];
        }
    }

    // Function to update schema visualization based on the query
    function updateSchemaVisualization(query) {
        if (!window.DatabaseEngine) return;
        
        try {
            // Parse the query to determine which tables and columns are involved
            const queryInfo = window.DatabaseEngine.parseQueryForVis(query);
            
            // Update the schema visualization
            window.DatabaseEngine.updateVisualization(queryInfo, mapCanvas, svgContainer);
        } catch (error) {
            console.warn("Error updating schema visualization:", error);
            // Just reset the visualization but don't show an error
            window.DatabaseEngine.updateVisualization(null, mapCanvas, svgContainer);
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
        
        // Keep track of hidden mission count for notification
        let hiddenMissionCount = 0;
        
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
                    // Check if this mission should be hidden (map-only mission)
                    const shouldHideMapMission = rowData.mapDetails && 
                                                rowData.mapDetails.showOnMap === true && 
                                                rowData.id > 7; // Only hide missions after Mission 7
                    
                    if (shouldHideMapMission) {
                        // Skip adding this row to the table
                        hiddenMissionCount++;
                        return; // Skip to next iteration
                    }
                    
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
            
            // Add notification about map-based missions if any were hidden
            if (hiddenMissionCount > 0) {
                const mapNote = document.createElement('div');
                mapNote.className = 'map-mission-note';
                mapNote.innerHTML = `<strong>Note:</strong> ${hiddenMissionCount} additional mission${hiddenMissionCount > 1 ? 's are' : ' is'} available through the MAP interface. Complete Mission 7 to learn how to access them.`;
                
                // Style the note
                mapNote.style.marginTop = '10px';
                mapNote.style.padding = '8px';
                mapNote.style.backgroundColor = 'rgba(39, 215, 251, 0.2)';
                mapNote.style.borderLeft = '4px solid #27d7fb';
                mapNote.style.borderRadius = '3px';
                
                container.appendChild(mapNote);
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
        // Throttle error sounds to prevent stuttering when many errors occur rapidly
        if (!window.lastErrorUITime || (Date.now() - window.lastErrorUITime) > 200) {
            AudioPoolManager.playSound('error', './audio/423167__plasterbrain__minimalist-sci-fi-ui-cancel.ogg', 0.8);
            window.lastErrorUITime = Date.now();
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
        
        // Define resizeTimer variable
        let resizeTimer = null;
        
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
        
        // Live Query toggle functionality
        const liveQueryToggle = document.getElementById('live-query-toggle');
        if (liveQueryToggle) {
            // Set initial state from the variable
            liveQueryToggle.checked = liveQueryEnabled;
            
            // Add change event listener
            liveQueryToggle.addEventListener('change', (e) => {
                liveQueryEnabled = e.target.checked;
                // Save preference in localStorage
                localStorage.setItem('liveQueryEnabled', liveQueryEnabled);
                
                // Show visual feedback
                displayMessage(
                    liveQueryEnabled ? 
                    "Live Query mode enabled - results update as you type" : 
                    "Live Query mode disabled - use Ctrl+Enter or the Execute button to run queries", 
                    "status-success", 
                    3000
                );
            });
            
            // Load preference from localStorage on startup
            const savedPreference = localStorage.getItem('liveQueryEnabled');
            if (savedPreference !== null) {
                liveQueryEnabled = savedPreference === 'true';
                liveQueryToggle.checked = liveQueryEnabled;
            }
        }
        
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
            // console.log('DB Registry button listener attached');
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
            soundSettings.masterVolume = 0.2;
            soundSettings.musicVolume = 0.1;
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
            if (e.key === 'Enter') {
                if (e.ctrlKey || e.metaKey) {
                    // Ctrl+Enter or Command+Enter executes the query
                    e.preventDefault();
                    executeQueryAndVisualize();
                } else {
                    // Normal Enter adds a newline
                    // Default behavior, no need to do anything
                }
            }
        });
        
        // Create live SQL query execution handler - executes queries as you type
        const liveQueryExecutor = debounce(() => {
            if (!liveQueryEnabled) return;
            
            const currentQuery = sqlInput.value.trim();
            if (currentQuery && currentQuery.length > 10) { // Only execute if query is substantial
                executeQueryAndVisualize();
            }
        }, 800); // Longer debounce time for query execution (800ms)
        
        // Add live query execution to input event
        sqlInput.addEventListener('input', () => {
            if (liveQueryEnabled) {
                liveQueryExecutor();
            }
        });
        
        // Regular visualization update (separate from execution)
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

        // Graph toggle button functionality
        const graphToggleBtn = document.getElementById('toggle-graph-btn');
        if (graphToggleBtn) {
            graphToggleBtn.addEventListener('click', function() {
                const mapCanvas = document.getElementById('map-canvas');
                
                // Toggle graph mode class
                mapCanvas.classList.toggle('graph-mode');
                
                // Update button text based on mode
                if (mapCanvas.classList.contains('graph-mode')) {
                    graphToggleBtn.textContent = 'SCHEMA';
                    graphToggleBtn.classList.add('active');
                    // Here you would activate your graphing functionality
                    // console.log('Graph mode activated');
                } else {
                    graphToggleBtn.textContent = 'GRAPH';
                    graphToggleBtn.classList.remove('active');
                    // Here you would revert to schema display
                    // console.log('Schema mode activated');
                }
                
                // Play a sound if available
                playClickSound();
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
        gameData: gameData  // Direct reference instead of getter to avoid circular reference
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
        const contentArea = document.querySelector('.content-area');
        
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
        
        // Additional variables needed for handleResize function
        let startX = 0;
        let startY = 0;
        let startMainWidth = 0;
        let startSchemaWidth = 0;
        let startMissionHeight = 0;
        let contentWidth = 0;
        
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
            
            // Set variables needed for handleResize
            startX = e.clientX;
            startY = e.clientY;
            startMainWidth = mainContent.offsetWidth;
            startSchemaWidth = schemaPanel.offsetWidth;
            startMissionHeight = missionPanel.offsetHeight;
            contentWidth = contentArea ? contentArea.offsetWidth : document.body.offsetWidth;
            
            // Add resizing class to body
            document.body.classList.add(dimension === 'height' ? 'resizing-vertical' : 'resizing');
            
            // Set up mouse move and mouse up events
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
                    // Use updateVisualization instead of updateAllJoinLines
                    if (window.DatabaseEngine.updateVisualization) {
                        window.DatabaseEngine.updateVisualization(null, mapCanvas, svgContainer);
                    }
                });
            }
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
            if (window.DatabaseEngine && window.DatabaseEngine.updateVisualization) {
                window.DatabaseEngine.updateVisualization(null, mapCanvas, svgContainer);
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
        let currentPanel = null;
        let resizeTimer = null;
        let contentWidth = 0;
        
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
            
            // Get current content area width
            contentWidth = contentArea.offsetWidth;
            
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
                    // Use updateVisualization instead of updateAllJoinLines
                    if (window.DatabaseEngine.updateVisualization) {
                        window.DatabaseEngine.updateVisualization(null, mapCanvas, svgContainer);
                    }
                });
            }
        }
        
        function stopResize() {
            isResizing = false;
            centralHandle.classList.remove('dragging');
            document.body.style.cursor = '';
            
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
            if (window.DatabaseEngine && window.DatabaseEngine.updateVisualization) {
                window.DatabaseEngine.updateVisualization(null, mapCanvas, svgContainer);
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
    
    // Initialize the live query toggle event listener
    const liveQueryToggle = document.getElementById('live-query-toggle');
    if (liveQueryToggle) {
        // Load previous setting if available
        const savedLiveQueryPref = localStorage.getItem('sqlLiveQueryEnabled');
        if (savedLiveQueryPref !== null) {
            liveQueryEnabled = savedLiveQueryPref === 'true';
            liveQueryToggle.checked = liveQueryEnabled;
        }
        
        // Handle toggle changes
        liveQueryToggle.addEventListener('change', (e) => {
            liveQueryEnabled = e.target.checked;
            localStorage.setItem('sqlLiveQueryEnabled', liveQueryEnabled);
            
            // Play button click sound for feedback
            if (window.playButtonClickSound) {
                window.playButtonClickSound();
            }
        });
    }
    
    // Connect mission system event handlers
});

// Add graph toggle functionality
document.addEventListener('DOMContentLoaded', function() {
    // ...existing code...
    
    // Initialize graph visualization functionality
    initializeGraphModule();
    
    // ...existing code...
});

// Graph Visualization Module
function initializeGraphModule() {
    // DOM Elements
    const graphToggleBtn = document.getElementById('toggle-graph-btn');
    const graphContainer = document.getElementById('graph-container');
    const mapCanvas = document.getElementById('map-canvas');
    const chartTypeButtons = document.querySelectorAll('.chart-type-btn');
    const noDataMessage = document.getElementById('no-data-message');
    
    // Chart.js instance
    let chartInstance = null;
    let currentChartType = 'bar'; // Default chart type
    let lastQueryResults = null; // Store query results for reuse when changing chart types
    
    // Theme colors for charts
    const chartColors = {
        background: [
            'rgba(39, 215, 251, 0.7)',
            'rgba(255, 204, 0, 0.7)',
            'rgba(255, 99, 132, 0.7)',
            'rgba(75, 192, 192, 0.7)',
            'rgba(153, 102, 255, 0.7)',
            'rgba(255, 159, 64, 0.7)',
            'rgba(54, 162, 235, 0.7)',
            'rgba(255, 99, 255, 0.7)',
            'rgba(111, 210, 111, 0.7)',
            'rgba(200, 150, 100, 0.7)'
        ],
        border: [
            'rgba(39, 215, 251, 1)',
            'rgba(255, 204, 0, 1)',
            'rgba(255, 99, 132, 1)',
            'rgba(75, 192, 192, 1)',
            'rgba(153, 102, 255, 1)',
            'rgba(255, 159, 64, 1)',
            'rgba(54, 162, 235, 1)',
            'rgba(255, 99, 255, 1)',
            'rgba(111, 210, 111, 1)',
            'rgba(200, 150, 100, 1)'
        ]
    };
    
    // Chart options - shared styles across chart types
    const chartOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                labels: {
                    color: '#e0e0e0',
                    font: {
                        family: "'Share Tech Mono', monospace",
                        size: 14
                    }
                }
            },
            title: {
                display: true,
                text: 'SQL Query Visualization',
                color: '#27d7fb',
                font: {
                    family: "'Share Tech Mono', monospace",
                    size: 18,
                    weight: 'normal'
                }
            },
            tooltip: {
                backgroundColor: 'rgba(6, 16, 25, 0.8)',
                titleColor: '#27d7fb',
                bodyColor: '#e0e0e0',
                borderColor: '#27d7fb',
                borderWidth: 1,
                titleFont: {
                    family: "'Share Tech Mono', monospace",
                    size: 14
                },
                bodyFont: {
                    family: "'Share Tech Mono', monospace",
                    size: 12
                },
                displayColors: true
            }
        },
        scales: {
            x: {
                grid: {
                    color: 'rgba(255, 255, 255, 0.1)'
                },
                ticks: {
                    color: '#e0e0e0',
                    font: {
                        family: "'Share Tech Mono', monospace"
                    }
                }
            },
            y: {
                grid: {
                    color: 'rgba(255, 255, 255, 0.1)'
                },
                ticks: {
                    color: '#e0e0e0',
                    font: {
                        family: "'Share Tech Mono', monospace"
                    }
                }
            }
        }
    };
    
    // Graph toggle button click handler
    if (graphToggleBtn) {
        graphToggleBtn.addEventListener('click', function() {
            // Toggle between schema and graph views
            if (mapCanvas.style.display !== 'none') {
                // Switch to graph view
                mapCanvas.style.display = 'none';
                graphContainer.style.display = 'flex';
                graphToggleBtn.textContent = 'SCHEMA';
                graphToggleBtn.classList.add('active');
                
                // Show axis selectors when switching to graph mode
                const axisSelectors = document.getElementById('axis-selectors');
                if (axisSelectors) {
                    // console.log("Making axis selectors visible");
                    axisSelectors.style.display = 'flex';
                }
                
                // Try to visualize data if we have results
                if (window.lastResults) {
                    visualizeData(window.lastResults);
                }
            } else {
                // Switch back to schema view
                mapCanvas.style.display = 'block';
                graphContainer.style.display = 'none';
                graphToggleBtn.textContent = 'GRAPH';
                graphToggleBtn.classList.remove('active');
            }
            
            // Play click sound
            if (window.playButtonClickSound) {
                window.playButtonClickSound();
            }
        });
    }
    
    // Chart type button click handlers
    chartTypeButtons.forEach(button => {
        button.addEventListener('click', function() {
            // Remove active class from all buttons
            chartTypeButtons.forEach(btn => {
                btn.classList.remove('active');
            });
            
            // Add active class to clicked button
            this.classList.add('active');
            
            // Update current chart type
            currentChartType = this.dataset.type;
            
            // Re-visualize data with new chart type
            if (lastQueryResults) {
                visualizeData(lastQueryResults);
            }
            
            // Play click sound
            if (window.playButtonClickSound) {
                window.playButtonClickSound();
            }
        });
    });
    
    // Main function to visualize data from query results
    function visualizeData(results) {
        // console.log("visualizeData called with:", results);
        
        if (!results || !Array.isArray(results) || results.length === 0) {
            // console.log("No results to visualize");
            noDataMessage.style.display = 'block';
            destroyChart();
            return;
        }
        
        // Hide no data message
        noDataMessage.style.display = 'none';
        
        // Store results for reuse when changing chart types
        lastQueryResults = results;
        
        // Destroy previous chart if it exists
        destroyChart();

        // Get select elements
        const xAxisSelect = document.getElementById('x-axis-selector');
        const yAxisSelect = document.getElementById('y-axis-selector');
        const valueSelect = document.getElementById('value-selector');
        
        // Debug check if elements exist
        // console.log("Axis selectors found:", {
        //     xAxisSelect: !!xAxisSelect,
        //     yAxisSelect: !!yAxisSelect, 
        //     valueSelect: !!valueSelect
        // });

        // Populate dropdowns with available columns
        if (xAxisSelect && yAxisSelect && valueSelect) {
            // Get columns from results
            const columns = Object.keys(results[0]);
            // console.log("Available columns for chart:", columns);
            
            // Clear existing options
            xAxisSelect.innerHTML = '';
            yAxisSelect.innerHTML = '';
            valueSelect.innerHTML = '';
            
            // Identify numeric and non-numeric columns for better defaults
            const numericColumns = columns.filter(col => {
                return results.some(row => typeof row[col] === 'number' || !isNaN(Number(row[col])));
            });
            
            const nonNumericColumns = columns.filter(col => !numericColumns.includes(col));
            
            // console.log("Column types detected:", {
            //     numeric: numericColumns,
            //     nonNumeric: nonNumericColumns
            // });
            
            // Add options to dropdowns
            columns.forEach(column => {
                // X-axis (prefer non-numeric for labels)
                const xOption = document.createElement('option');
                xOption.value = column;
                xOption.textContent = column;
                if (column === nonNumericColumns[0]) xOption.selected = true;
                xAxisSelect.appendChild(xOption);
                
                // Y-axis (prefer numeric)
                const yOption = document.createElement('option');
                yOption.value = column;
                yOption.textContent = column;
                if (column === numericColumns[0]) yOption.selected = true;
                yAxisSelect.appendChild(yOption);
                
                // Value column (for pie charts, etc.)
                const vOption = document.createElement('option');
                vOption.value = column;
                vOption.textContent = column;
                if (column === numericColumns[0]) vOption.selected = true;
                valueSelect.appendChild(vOption);
            });
            
            // Add change event listeners if not already added
            if (!xAxisSelect.hasAttribute('data-listener-added')) {
                xAxisSelect.addEventListener('change', () => {
                    // console.log("X-axis changed to:", xAxisSelect.value);
                    if (lastQueryResults) visualizeData(lastQueryResults);
                });
                xAxisSelect.setAttribute('data-listener-added', 'true');
            }
            
            if (!yAxisSelect.hasAttribute('data-listener-added')) {
                yAxisSelect.addEventListener('change', () => {
                    // console.log("Y-axis changed to:", yAxisSelect.value);
                    if (lastQueryResults) visualizeData(lastQueryResults);
                });
                yAxisSelect.setAttribute('data-listener-added', 'true');
            }
            
            if (!valueSelect.hasAttribute('data-listener-added')) {
                valueSelect.addEventListener('change', () => {
                    // console.log("Value column changed to:", valueSelect.value);
                    if (lastQueryResults) visualizeData(lastQueryResults);
                });
                valueSelect.setAttribute('data-listener-added', 'true');
            }
        }
        
        // Get chart data and options based on the selected chart type
        const chartData = prepareChartData(results, currentChartType, xAxisSelect?.value, yAxisSelect?.value, valueSelect?.value);
        // console.log("Chart data prepared:", chartData);
        const options = { ...chartOptions };
        
        // Special configurations for different chart types
        switch (currentChartType) {
            case 'pie':
            case 'doughnut':
                // Remove scales for pie/doughnut charts
                delete options.scales;
                break;
                
            case 'histogram':
                // Set bin options for histogram
                options.scales.x.title = { 
                    display: true, 
                    text: 'Values',
                    color: '#e0e0e0'
                };
                options.scales.y.title = { 
                    display: true, 
                    text: 'Frequency',
                    color: '#e0e0e0'
                };
                break;
                
            case 'scatter':
                options.scales.x.title = { 
                    display: true, 
                    text: chartData.datasets[0].label.split(' vs ')[0],
                    color: '#e0e0e0'
                };
                options.scales.y.title = { 
                    display: true, 
                    text: chartData.datasets[0].label.split(' vs ')[1],
                    color: '#e0e0e0'
                };
                break;
                
            case 'treemap':
                // Treemap does not use standard scales
                delete options.scales;
                break;
                
            default:
                // For bar and line charts
                options.scales.x.title = { 
                    display: true, 
                    text: 'Categories',
                    color: '#e0e0e0'
                };
                options.scales.y.title = { 
                    display: true, 
                    text: 'Values',
                    color: '#e0e0e0'
                };
        }
        
        // Create chart based on the type
        const ctx = document.getElementById('data-chart').getContext('2d');
        
        // For treemap we use a different approach since Chart.js core doesn't support it
        if (currentChartType === 'treemap') {
            // console.log("Using treemap visualization");
            displaySimulatedTreemap(results);
            return;
        }
        
        // Create the chart
        chartInstance = new Chart(ctx, {
            type: currentChartType === 'histogram' ? 'bar' : currentChartType, // Histogram is a specialized bar chart
            data: chartData,
            options: options
        });
    }
    
    // Prepare data for charting based on the type
    function prepareChartData(results, chartType, xAxis, yAxis, valueColumn) {
        const columns = Object.keys(results[0]);
        
        // Skip columns that are clearly not numeric for value columns (except for labels)
        const numericColumns = columns.filter(col => {
            // Check if at least 50% of the values in this column are numbers
            const numericCount = results.reduce((count, row) => {
                const val = row[col];
                return (typeof val === 'number' || !isNaN(Number(val))) ? count + 1 : count;
            }, 0);
            
            return numericCount >= results.length * 0.5;
        });
        
        // Best guess for label column: first non-numeric column or first column
        const labelColumn = columns.find(col => !numericColumns.includes(col)) || columns[0];
        
        // Best guess for value column: first numeric column after label column or second column
        const valueColumns = numericColumns.length > 0 ? 
            numericColumns : 
            columns.filter(col => col !== labelColumn);
        
        // Special handling for different chart types
        switch (chartType) {
            case 'pie':
            case 'doughnut':
                return preparePieData(results, labelColumn, valueColumns[0] || columns[1]);
                
            case 'histogram':
                return prepareHistogramData(results, valueColumns[0] || columns[1]);
                
            case 'scatter':
                // We need two numeric columns for scatter plot
                if (numericColumns.length >= 2) {
                    return prepareScatterData(results, numericColumns[0], numericColumns[1]);
                } else {
                    // Fallback: use column index pairs for all rows
                    return prepareScatterData(results, columns[0], columns[1]);
                }
                
            case 'treemap':
                // Handled separately
                return {};
                
            case 'line':
                return prepareLineData(results, labelColumn, valueColumns);
                
            case 'bar':
            default:
                return prepareBarData(results, labelColumn, valueColumns);
        }
    }
    
    // Bar chart data preparation
    function prepareBarData(results, labelColumn, valueColumns) {
        const labels = results.map(row => row[labelColumn]?.toString() || 'null');
        
        const datasets = valueColumns.map((column, index) => {
            return {
                label: column,
                data: results.map(row => {
                    const val = row[column];
                    return typeof val === 'number' ? val : Number(val) || 0;
                }),
                backgroundColor: chartColors.background[index % chartColors.background.length],
                borderColor: chartColors.border[index % chartColors.border.length],
                borderWidth: 1
            };
        });
        
        return { labels, datasets };
    }
    
    // Line chart data preparation
    function prepareLineData(results, labelColumn, valueColumns) {
        const labels = results.map(row => row[labelColumn]?.toString() || 'null');
        
        const datasets = valueColumns.map((column, index) => {
            return {
                label: column,
                data: results.map(row => {
                    const val = row[column];
                    return typeof val === 'number' ? val : Number(val) || 0;
                }),
                borderColor: chartColors.border[index % chartColors.border.length],
                backgroundColor: chartColors.background[index % chartColors.background.length],
                fill: false,
                tension: 0.2,
                pointBackgroundColor: chartColors.border[index % chartColors.border.length],
                pointBorderColor: '#fff',
                pointRadius: 4
            };
        });
        
        return { labels, datasets };
    }
    
    // Pie chart data preparation
    function preparePieData(results, labelColumn, valueColumn) {
        const labels = results.map(row => row[labelColumn]?.toString() || 'null');
        
        const data = results.map(row => {
            const val = row[valueColumn];
            return typeof val === 'number' ? val : Number(val) || 0;
        });
        
        // Ensure all values are positive for pie charts
        const positiveData = data.map(val => Math.abs(val));
        
        const backgroundColors = chartColors.background.slice(0, labels.length);
        const borderColors = chartColors.border.slice(0, labels.length);
        
        const datasets = [{
            label: valueColumn,
            data: positiveData,
            backgroundColor: backgroundColors,
            borderColor: borderColors,
            borderWidth: 1
        }];
        
        return { labels, datasets };
    }
    
    // Histogram data preparation (specialized bar chart with binning)
    function prepareHistogramData(results, valueColumn) {
        // Extract numerical values
        const rawValues = results.map(row => {
            const val = row[valueColumn];
            return typeof val === 'number' ? val : Number(val) || 0;
        });
        
        // Simple binning algorithm
        const min = Math.min(...rawValues);
        const max = Math.max(...rawValues);
        
        // Determine bin count (Sturges' formula)
        const binCount = Math.ceil(1 + 3.322 * Math.log10(rawValues.length));
        const binWidth = (max - min) / binCount;
        
        // Create bins
        const bins = Array.from({ length: binCount }, (_, i) => ({
            start: min + i * binWidth,
            end: min + (i + 1) * binWidth,
            count: 0,
            label: `${(min + i * binWidth).toFixed(1)} - ${(min + (i + 1) * binWidth).toFixed(1)}`
        }));
        
        // Count values in bins
        rawValues.forEach(value => {
            if (value === max) {
                // Edge case: max value should go in the last bin
                bins[bins.length - 1].count++;
            } else {
                const binIndex = Math.floor((value - min) / binWidth);
                bins[binIndex].count++;
            }
        });
        
        // Prepare dataset
        const labels = bins.map(bin => bin.label);
        const data = bins.map(bin => bin.count);
        
        const datasets = [{
            label: `Distribution of ${valueColumn}`,
            data: data,
            backgroundColor: chartColors.background[0],
            borderColor: chartColors.border[0],
            borderWidth: 1
        }];
        
        return { labels, datasets };
    }
    
    // Scatter plot data preparation
    function prepareScatterData(results, xColumn, yColumn) {
        const data = results.map(row => ({
            x: typeof row[xColumn] === 'number' ? row[xColumn] : Number(row[xColumn]) || 0,
            y: typeof row[yColumn] === 'number' ? row[yColumn] : Number(row[yColumn]) || 0
        }));
        
        const datasets = [{
            label: `${xColumn} vs ${yColumn}`,
            data: data,
            backgroundColor: chartColors.background[0],
            borderColor: chartColors.border[0],
            pointRadius: 6,
            pointHoverRadius: 8
        }];
        
        return { datasets };
    }
    
    // Display a treemap visualization
    function displaySimulatedTreemap(results) {
        const canvas = document.getElementById('data-chart');
        const ctx = canvas.getContext('2d');
        
        // Add treemap-mode class to the container
        document.querySelector('.chart-canvas-container').classList.add('treemap-mode');
        
        // Clear the canvas
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        // Set background
        ctx.fillStyle = '#061019';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // Draw title
        ctx.fillStyle = '#27d7fb';
        ctx.font = '18px "Share Tech Mono"';
        ctx.textAlign = 'center';
        ctx.fillText('SQL Query Treemap Visualization', canvas.width / 2, 30);
        
        if (!results || !results.length) {
            ctx.fillStyle = '#e0e0e0';
            ctx.fillText('No data available for visualization', canvas.width / 2, canvas.height / 2);
            return;
        }
        
        // Try to find a numeric column for size values
        const columns = Object.keys(results[0]);
        const numericColumns = columns.filter(col => {
            return results.some(row => typeof row[col] === 'number' || !isNaN(Number(row[col])));
        });
        
        const numericColumn = numericColumns[0] || columns[0];
        
        // Label column (non-numeric if possible)
        const labelColumn = columns.find(col => !numericColumns.includes(col)) || columns[0];
        
        // Get values and ensure they're all positive (treemap requires positive values)
        const items = results.map(row => {
            const val = row[numericColumn];
            const numericVal = typeof val === 'number' ? val : Number(val) || 1; // Default to 1 if not numeric
            return {
                value: Math.abs(numericVal), // Ensure positive value
                label: row[labelColumn]?.toString() || 'Unnamed',
                color: null // Will be assigned later
            };
        });
        
        // Sort by value (largest first) to improve treemap layout
        items.sort((a, b) => b.value - a.value);
        
        // Assign colors
        items.forEach((item, index) => {
            item.color = chartColors.background[index % chartColors.background.length];
            item.borderColor = chartColors.border[index % chartColors.border.length];
        });
        
        // Calculate total area
        const totalValue = items.reduce((sum, item) => sum + item.value, 0);
        
        // Draw the treemap using squarified treemap algorithm
        const padding = 50; // Padding from edges
        const treemapArea = {
            x: padding,
            y: padding + 30, // Extra space for title
            width: canvas.width - padding * 2,
            height: canvas.height - padding * 2 - 50 // Extra space for legend
        };
        
        // Draw treemap using the squarified algorithm (simplified version)
        drawSquarifiedTreemap(ctx, items, treemapArea, totalValue);
        
        // Add legend
        const legendY = canvas.height - 25;
        ctx.fillStyle = '#e0e0e0';
        ctx.font = '14px "Share Tech Mono"';
        ctx.textAlign = 'left';
        ctx.fillText(`Size represents: ${numericColumn}`, padding, legendY);
        
        // Add note about data issues if needed
        if (items.some(item => item.value === 0)) {
            ctx.fillStyle = '#ff9f40';
            ctx.textAlign = 'right';
            ctx.fillText('Note: Zero values may not be visible', canvas.width - padding, legendY);
        }
    }
    
    // Helper function to draw treemap using squarified algorithm
    function drawSquarifiedTreemap(ctx, items, area, totalValue) {
        // Base case: no items to draw
        if (!items.length) return;
        
        // Base case: only one item - draw it and return
        if (items.length === 1) {
            drawTreemapItem(ctx, items[0], area);
            return;
        }
        
        const { x, y, width, height } = area;
        
        // Determine layout direction (horizontal or vertical)
        const isWide = width > height;
        
        // Calculate available area
        const shortEdge = isWide ? height : width;
        
        // Find best split to maintain aspect ratios close to 1
        let bestSplit = 1;
        let bestRatio = Infinity;
        let currentSum = 0;
        
        // Try different splits to find optimal one
        for (let i = 0; i < items.length; i++) {
            currentSum += items[i].value;
            const remainingSum = totalValue - currentSum;
            
            if (remainingSum <= 0) break; // Avoid division by zero
            
            // Calculate aspect ratios
            const currentArea = (currentSum / totalValue) * (isWide ? width * height : width * height);
            const maxItem = Math.max(...items.slice(0, i + 1).map(item => item.value));
            
            // Calculate aspect ratio of current worst rectangle
            let ratio;
            if (isWide) {
                const currentWidth = width * (currentSum / totalValue);
                ratio = Math.max(
                    (shortEdge * shortEdge * maxItem) / (currentArea * currentSum),
                    (currentArea * currentSum) / (shortEdge * shortEdge * maxItem)
                );
            } else {
                const currentHeight = height * (currentSum / totalValue);
                ratio = Math.max(
                    (shortEdge * shortEdge * maxItem) / (currentArea * currentSum),
                    (currentArea * currentSum) / (shortEdge * shortEdge * maxItem)
                );
            }
            
            // Update best split if this one is better
            if (ratio < bestRatio) {
                bestRatio = ratio;
                bestSplit = i + 1;
            }
        }
        
        // Calculate area for current group
        const currentGroup = items.slice(0, bestSplit);
        const currentGroupValue = currentGroup.reduce((sum, item) => sum + item.value, 0);
        const currentProportion = currentGroupValue / totalValue;
        
        // Calculate layout for current group
        let currentArea, remainingArea;
        
        if (isWide) {
            // Horizontal split
            const currentWidth = width * currentProportion;
            
            currentArea = {
                x,
                y,
                width: currentWidth,
                height
            };
            
            remainingArea = {
                x: x + currentWidth,
                y,
                width: width - currentWidth,
                height
            };
            
            // Layout current group (vertical layout within horizontal slice)
            layoutRow(ctx, currentGroup, currentArea, currentGroupValue);
        } else {
            // Vertical split
            const currentHeight = height * currentProportion;
            
            currentArea = {
                x,
                y,
                width,
                height: currentHeight
            };
            
            remainingArea = {
                x,
                y: y + currentHeight,
                width,
                height: height - currentHeight
            };
            
            // Layout current group (horizontal layout within vertical slice)
            layoutRow(ctx, currentGroup, currentArea, currentGroupValue);
        }
        
        // Recursively process remaining items
        const remainingItems = items.slice(bestSplit);
        const remainingValue = totalValue - currentGroupValue;
        
        if (remainingItems.length > 0 && remainingArea.width > 1 && remainingArea.height > 1) {
            drawSquarifiedTreemap(ctx, remainingItems, remainingArea, remainingValue);
        }
    }
    
    // Helper function to layout a row of treemap items
    function layoutRow(ctx, items, area, totalValue) {
        if (!items.length) return;
        
        const { x, y, width, height } = area;
        const isWide = width > height;
        
        let currentX = x;
        let currentY = y;
        
        if (isWide) {
            // Horizontal row, items stacked vertically
            items.forEach(item => {
                const itemHeight = (item.value / totalValue) * height;
                
                drawTreemapItem(ctx, item, {
                    x: currentX,
                    y: currentY,
                    width: width,
                    height: itemHeight
                });
                
                currentY += itemHeight;
            });
        } else {
            // Vertical row, items stacked horizontally
            items.forEach(item => {
                const itemWidth = (item.value / totalValue) * width;
                
                drawTreemapItem(ctx, item, {
                    x: currentX,
                    y: currentY,
                    width: itemWidth,
                    height: height
                });
                
                currentX += itemWidth;
            });
        }
    }
    
    // Helper function to draw a single treemap item
    function drawTreemapItem(ctx, item, area) {
        const { x, y, width, height } = area;
        
        // Only draw if the area is meaningful
        if (width < 1 || height < 1) return;
        
        // Draw rectangle
        ctx.fillStyle = item.color || 'rgba(39, 215, 251, 0.7)';
        ctx.strokeStyle = item.borderColor || '#061019';
        ctx.lineWidth = 2;
        
        ctx.beginPath();
        ctx.rect(x, y, width, height);
        ctx.fill();
        ctx.stroke();
        
        // Only draw text if rectangle is big enough
        if (width > 40 && height > 30) {
            ctx.fillStyle = '#ffffff';
            ctx.font = '14px "Share Tech Mono"';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            
            // Draw label
            let label = item.label;
            if (label.length > 10 && width < 100) {
                label = label.substring(0, 8) + '...';
            }
            
            // Position text in center of rectangle
            const centerX = x + width / 2;
            const centerY = y + height / 2;
            
            // Draw label and value if there's enough space
            if (height > 50) {
                ctx.fillText(label, centerX, centerY - 10);
                ctx.fillText(item.value.toString(), centerX, centerY + 15);
            } else {
                // Just draw label if space is limited
                ctx.fillText(label, centerX, centerY);
            }
        }
    }
    
    // Clean up previous chart
    function destroyChart() {
        if (chartInstance) {
            chartInstance.destroy();
            chartInstance = null;
        }
    }
    
    // Function to be called when new query results are available
    window.visualizeQueryResults = function(results) {
        if (graphContainer.style.display !== 'none') {
            visualizeData(results);
        }
        
        // Store the results for visualization when switching to graph mode
        lastQueryResults = results;
    };
    
    // Make the API public to allow other modules to use it
    window.GraphModule = {
        visualizeData,
        setChartType: function(type) {
            if (['bar', 'line', 'pie', 'histogram', 'treemap', 'scatter'].includes(type)) {
                currentChartType = type;
                
                // Update active class on button
                chartTypeButtons.forEach(btn => {
                    if (btn.dataset.type === type) {
                        btn.classList.add('active');
                    } else {
                        btn.classList.remove('active');
                    }
                });
                
                // Re-visualize if there's data
                if (lastQueryResults) {
                    visualizeData(lastQueryResults);
                }
            }
        },
        toggleView: function() {
            graphToggleBtn.click();
        },
        getCurrentChartType: function() {
            return currentChartType;
        }
    };
}

// Helper function to play a click sound
function playClickSound() {
    if (window.playButtonClickSound) {
        window.playButtonClickSound();
    }
}

// This code needs to be added where the document.addEventListener('DOMContentLoaded', ...) function is defined
document.addEventListener('DOMContentLoaded', function() {
    // ...existing code...
    
    // Special fix for Mission 1 - check when page is fully loaded
    // This ensures that Tutorial: First Query mission can be completed even if the query was run previously
    window.addEventListener('load', function() {
        setTimeout(function() {
            // Check if we're currently on Mission 1
            if (window.MissionSystem && window.MissionSystem.currentMissionId === 1) {
                // console.log("FIRST QUERY MISSION FIX: Detected Mission 1 active, applying special fix");
                
                // Force enable the complete mission button
                const completeBtn = document.getElementById('complete-mission-btn');
                if (completeBtn) {
                    completeBtn.disabled = false;
                    completeBtn.style.display = 'block';
                    completeBtn.classList.add('mission-solved');
                    
                    // Also update the mission state
                    if (window.MissionSystem) {
                        window.MissionSystem.isMissionSolved = true;
                    }
                    
                    if (window.GameSystem && window.GameSystem.displayMessage) {
                        window.GameSystem.displayMessage("You can now complete this mission. Click the 'Complete Mission' button.", "status-success");
                    }
                }
            }
        }, 1500); // Small delay to ensure everything is loaded
    });
});

// Add map integration functionality for SQL queries
function processMapQueryResults(query, results) {
    // Only process if map integration is available and the map is visible
    if (!window.MapIntegration || !window.MapIntegration.isVisible()) {
        return;
    }

    // console.log("Processing query results for map integration");
    
    // If no results, nothing to highlight
    if (!results || !Array.isArray(results) || results.length === 0) {
        return;
    }
    
    // Try to extract ISO3 country codes first - this is the most accurate method
    let countryCodes = [];
    
    if (window.DatabaseEngine && typeof window.DatabaseEngine.getCountryCodesFromSqlResults === 'function') {
        // Convert results to format expected by getCountryCodesFromSqlResults
        const formattedResults = {
            columns: Object.keys(results[0]),
            rows: results
        };
        
        // Extract country codes
        countryCodes = window.DatabaseEngine.getCountryCodesFromSqlResults(formattedResults);
        // console.log(`Found ${countryCodes.length} ISO3 codes in query results:`, countryCodes);
    }
    
    // If we found country codes, highlight them on the map
    if (countryCodes.length > 0) {
        // console.log(`Highlighting ${countryCodes.length} countries by ISO3 code:`, countryCodes);
        window.MapIntegration.highlightCountriesByCode(countryCodes);
        return;
    }
    
    // Fallback: Extract country names, regions, or continents from results
    const countryNames = [];
    const regionNames = [];
    const continentNames = [];
    
    // Check if results contain relevant geographic columns
    if (Array.isArray(results) && results.length > 0) {
        const firstRow = results[0];
        const columnKeys = Object.keys(firstRow).map(key => key.toLowerCase());
        
        // Check for country columns
        const hasCountryColumn = columnKeys.some(key => 
            key === 'country' || key === 'admin' || key === 'name'
        );
        
        // Check for region columns
        const hasRegionColumn = columnKeys.some(key =>
            key === 'region' || key === 'region_wb'
        );
        
        // Check for continent columns
        const hasContinentColumn = columnKeys.some(key =>
            key === 'continent'
        );
        
        // Process each row to extract geographic information
        results.forEach(row => {
            // Extract country information
            if (hasCountryColumn) {
                const countryValue = extractValueByPattern(row, ['country', 'admin', 'name']);
                if (countryValue) countryNames.push(countryValue);
            }
            
            // Extract region information
            if (hasRegionColumn) {
                const regionValue = extractValueByPattern(row, ['region', 'region_wb']);
                if (regionValue) regionNames.push(regionValue);
            }
            
            // Extract continent information
            if (hasContinentColumn) {
                const continentValue = extractValueByPattern(row, ['continent']);
                if (continentValue) continentNames.push(continentValue);
            }
        });
    }
    
    // Helper function to extract values by looking for different column name patterns
    function extractValueByPattern(row, patterns) {
        for (const pattern of patterns) {
            for (const key of Object.keys(row)) {
                if (key.toLowerCase() === pattern || key.toLowerCase().includes(pattern)) {
                    const value = row[key];
                    if (value && typeof value === 'string' && value.trim() !== '') {
                        return value.trim();
                    }
                }
            }
        }
        return null;
    }
    
    // First try countries (most specific)
    if (countryNames.length > 0) {
        // console.log(`Highlighting ${countryNames.length} countries by name:`, countryNames);
        window.MapIntegration.highlightCountries(countryNames);
        return;
    }
    
    // Then try regions (middle level)
    if (regionNames.length > 0) {
        // console.log(`Highlighting ${regionNames.length} regions:`, regionNames);
        window.MapIntegration.highlightRegions(regionNames);
        return;
    }
    
    // Finally try continents (most general)
    if (continentNames.length > 0) {
        // console.log(`Highlighting ${continentNames.length} continents:`, continentNames);
        window.MapIntegration.highlightContinents(continentNames);
        return;
    }
}

// Override the execute button click handler to include map functionality
function executeQuery() {
    const sqlInput = document.getElementById('sql-input');
    const query = sqlInput.value.trim();

    if (!query) {
        displayMessage("Please enter a SQL query.", "status-error");
        return;
    }

    try {
        // Execute the query using DatabaseEngine
        const results = window.DatabaseEngine.execute(query);
        
        // Process for map visualization if map is open
        processMapQueryResults(query, results);
        
        // Continue with existing query result handling...
        displayResults(results);
        
        // Validate mission if applicable
        if (window.MissionSystem) {
            window.MissionSystem.checkSolution(query, results);
        }
        
        // Store results for later reference
        window.lastResults = results;
        
        playSuccessSound();
        
    } catch (error) {
        console.error("Query execution error:", error);
        displayError(error.message || "Error executing query.");
        playErrorSound();
    }
}

// Add a map toggle button to the SQL console for easier access
function addMapToggleButton() {
    const consoleHeader = document.querySelector('.sql-console-window .console-header');
    if (!consoleHeader) return;
    
    // Check if button already exists
    if (consoleHeader.querySelector('#toggle-map-btn')) return;
    
    const toggleMapBtn = document.createElement('button');
    toggleMapBtn.id = 'toggle-map-btn';
    toggleMapBtn.className = 'pixel-btn';
    toggleMapBtn.textContent = 'MAP';
    toggleMapBtn.title = 'Toggle Map View';
    
    toggleMapBtn.addEventListener('click', function() {
        // Toggle map visibility
        if (window.MapIntegration) {
            if (window.MapIntegration.isVisible()) {
                window.MapIntegration.hide();
            } else {
                window.MapIntegration.show();
            }
        }
    });
    
    // Add it to the console header
    const consoleTitle = consoleHeader.querySelector('.pixel-h2');
    if (consoleTitle) {
        consoleHeader.insertBefore(toggleMapBtn, consoleTitle.nextSibling);
    } else {
        consoleHeader.appendChild(toggleMapBtn);
    }
}

// Initialize map integration when document is ready
document.addEventListener('DOMContentLoaded', function() {
    // ... existing code ...

    // Add Map toggle button to SQL console
    addMapToggleButton();
    
    // Override the execute button click handler
    const executeBtn = document.getElementById('execute-btn');
    if (executeBtn) {
        executeBtn.removeEventListener('click', window.executeQuery);
        executeBtn.addEventListener('click', executeQuery);
    }
    
    // Also update the SQL input keypress handler for Enter key
    const sqlInput = document.getElementById('sql-input');
    if (sqlInput) {
        sqlInput.removeEventListener('keypress', window.sqlInputKeyPressHandler);
        sqlInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                e.preventDefault();
                executeQuery();
            }
        });
    }
});

// Z-index Debugger - Helpful for troubleshooting overlay issues
function debugZIndex() {
    const elementsToDebug = [
        {selector: '#sql-console', name: 'SQL Console'},
        {selector: '#interactive-map-area', name: 'Map Area'},
        {selector: '.map-overlay-backdrop', name: 'Map Backdrop'}
    ];
    
    elementsToDebug.forEach(item => {
        const element = document.querySelector(item.selector);
        if (!element) return;
        
        // Get computed z-index
        const zIndex = window.getComputedStyle(element).zIndex;
        
        // Create or update debug label
        let debugLabel = element.querySelector('.z-debug');
        if (!debugLabel) {
            debugLabel = document.createElement('div');
            debugLabel.className = 'z-debug';
            debugLabel.style.position = 'absolute';
            debugLabel.style.top = '0';
            debugLabel.style.left = '0';
            debugLabel.style.padding = '2px 5px';
            debugLabel.style.background = 'red';
            debugLabel.style.color = 'white';
            debugLabel.style.fontSize = '10px';
            debugLabel.style.fontFamily = 'monospace';
            debugLabel.style.zIndex = '9999'; // Always on top
            element.appendChild(debugLabel);
        }
        
        debugLabel.textContent = `${item.name} z:${zIndex}`;
        
        // Also check if SQL console has over-map class when appropriate
        if (item.selector === '#sql-console') {
            const hasOverMapClass = element.classList.contains('over-map');
            debugLabel.textContent += ` class:${hasOverMapClass ? 'over-map' : 'normal'}`;
        }
    });
    
    // console.log('Z-index debug labels applied');
}

// Add keyboard shortcut to toggle the debug display (Press Ctrl+Alt+Z)
document.addEventListener('keydown', function(e) {
    if (e.ctrlKey && e.altKey && e.key === 'z') {
        debugZIndex();
    }
});

// Finally, create a global button for mobile testing
window.toggleZDebug = function() {
    debugZIndex();
};