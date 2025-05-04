// Database Schema Management and Loading System
// This file handles loading and registering all database schemas from JSON files

// Store loaded database schemas
let databaseSchemas = {};

// Load a database schema from JSON file
async function loadDatabaseSchema(dbAlias, jsonPath) {
    try {
        console.log(`Attempting to load schema for ${dbAlias} from ${jsonPath}`);
        const response = await fetch(jsonPath);
        if (!response.ok) {
            console.error(`Failed to load ${dbAlias} - HTTP status: ${response.status}`);
            throw new Error(`Failed to load database schema for ${dbAlias}`);
        }
        
        const data = await response.json();
        databaseSchemas[dbAlias] = data;
        console.log(`Database schema for ${dbAlias} loaded successfully:`, Object.keys(data));
        return data;
    } catch (error) {
        console.error(`Error loading ${dbAlias} database schema:`, error);
        return null;
    }
}

// Initialize all database schemas
async function initializeDatabaseSchemas() {
    console.log("Loading database schemas...");
    
    // Define the core databases with their schema paths
    // Updated to include mainQuest database
    const coreDbPaths = {
        'mission_control': './data/db_schemas/mission_control.json',
        'maps': './data/db_schemas/maps.json',
        'galaxy1': './data/db_schemas/galaxy1.json',
        'mainQuest': './data/db_schemas/mainQuest.json'
    };
    
    console.log("Core DB paths to load:", coreDbPaths);
    
    // Load core databases (required for the game)
    const coreDbPromises = Object.entries(coreDbPaths).map(
        ([alias, path]) => loadDatabaseSchema(alias, path)
    );
    
    try {
        await Promise.all(coreDbPromises);
        console.log("Core database schemas loaded successfully");
        console.log("Available databases:", Object.keys(databaseSchemas));
        
        // Debug: Log all loaded schema structures
        Object.entries(databaseSchemas).forEach(([dbName, schema]) => {
            console.log(`Database ${dbName} schema structure:`, Object.keys(schema));
        });
    } catch (error) {
        console.error("Failed to load core database schemas:", error);
    }
}

// Get all loaded database schemas
function getAllDatabaseSchemas() {
    return databaseSchemas;
}

// Get a specific database schema
function getDatabaseSchema(dbAlias) {
    return databaseSchemas[dbAlias] || null;
}

// Register hardcoded schemas (fallback if JSON loading fails)
function registerHardcodedSchemas() {
    // Minimal required schemas for the game to function
    databaseSchemas = {
        mission_control: {
            missions: {
                columns: { 
                    id: 'INT PRIMARY KEY', 
                    title: 'STRING', 
                    difficulty: 'INT', 
                    points: 'INT', 
                    dbAlias: 'STRING',
                    mapDetails: 'JSON' 
                },
                data: [
                    { 
                        id: 1, 
                        title: "Find Planets", 
                        difficulty: 1, 
                        points: 50, 
                        dbAlias: "galaxy1",
                        mapDetails: {
                            showOnMap: true,
                            country: "United States",
                            location: [-74.0060, 40.7128],
                            description: "Find Planets mission in New York"
                        }
                    },
                    { 
                        id: 2, 
                        title: "Valuable Resources", 
                        difficulty: 2, 
                        points: 75, 
                        dbAlias: "galaxy1",
                        mapDetails: {
                            showOnMap: true,
                            country: "United Kingdom",
                            location: [-0.1278, 51.5074],
                            description: "Valuable Resources mission in London"
                        }
                    },
                    { 
                        id: 3, 
                        title: "Sort by Power", 
                        difficulty: 2, 
                        points: 75, 
                        dbAlias: "galaxy1",
                        mapDetails: {
                            showOnMap: true,
                            country: "Japan",
                            location: [139.6917, 35.6895],
                            description: "Sort by Power mission in Tokyo"
                        }
                    },
                    { 
                        id: 4, 
                        title: "Planet & Species Report", 
                        difficulty: 3, 
                        points: 100, 
                        dbAlias: "galaxy1",
                        mapDetails: {
                            showOnMap: true,
                            country: "Australia",
                            location: [151.2093, -33.8688],
                            description: "Planet & Species Report mission in Sydney"
                        }
                    },
                    { 
                        id: 7, 
                        title: "Paris With Love", 
                        difficulty: 3, 
                        points: 200, 
                        dbAlias: "galaxy1",
                        mapDetails: {
                            showOnMap: true,
                            country: "France",
                            location: [2.3522, 48.8566],
                            description: "Active mission in Paris"
                        }
                    }
                ]
            }
        },
        maps: {
            earth: { 
                columns: { 
                    id: 'NUMBER', 
                    name: 'STRING', 
                    type: 'STRING' 
                }, 
                data: [
                    { id: 1, name: 'Earth', type: 'Planet' }
                ] 
            }
        },
        galaxy1: {
            planets: { 
                columns: { 
                    id: 'INT PRIMARY KEY', 
                    name: 'STRING', 
                    type: 'STRING', 
                    atmosphere: 'STRING', 
                    distance_from_sun: 'INT' 
                }, 
                data: [ 
                    { "id": 1, "name": "Terra Prime", "type": "Terrestrial", "atmosphere": "Nitrogen", "distance_from_sun": 100 }, 
                    { "id": 2, "name": "Xylos", "type": "Jungle", "atmosphere": "Oxygen Rich", "distance_from_sun": 150 }, 
                    { "id": 3, "name": "Cryonia", "type": "Ice Giant", "atmosphere": "Methane", "distance_from_sun": 400 }, 
                    { "id": 4, "name": "Vulcanis", "type": "Volcanic", "atmosphere": "Sulfur", "distance_from_sun": 80 }, 
                    { "id": 5, "name": "Aetheria", "type": "Gas Giant", "atmosphere": "Hydrogen", "distance_from_sun": 600 } 
                ] 
            },
            species: { 
                columns: { 
                    id: 'INT PRIMARY KEY', 
                    name: 'STRING', 
                    home_planet_id: 'INT', 
                    intelligence_level: 'INT', 
                    temperament: 'STRING' 
                },
                data: [ 
                    { "id": 101, "name": "Humans", "home_planet_id": 1, "intelligence_level": 7, "temperament": "Neutral" },
                    { "id": 102, "name": "Grox", "home_planet_id": 4, "intelligence_level": 8, "temperament": "Aggressive" },
                    { "id": 103, "name": "Florans", "home_planet_id": 2, "intelligence_level": 5, "temperament": "Peaceful" },
                    { "id": 104, "name": "Cryonians", "home_planet_id": 3, "intelligence_level": 9, "temperament": "Neutral" },
                    { "id": 105, "name": "Void Spawn", "home_planet_id": null, "intelligence_level": 10, "temperament": "Aggressive"} 
                ]
            }
        }
    };
    
    console.log("Registered hardcoded fallback schemas");
    return databaseSchemas;
}

// Add logging function to debug mission database aliases
function validateMissionDatabaseAliases() {
    console.log("Validating mission database aliases...");
    if (window.GameSystem && window.GameSystem.gameData && 
        window.GameSystem.gameData.databases && 
        window.GameSystem.gameData.databases.mission_control &&
        window.GameSystem.gameData.databases.mission_control.missions) {
        
        const missions = window.GameSystem.gameData.databases.mission_control.missions.data;
        if (Array.isArray(missions)) {
            console.log("Mission database aliases:");
            missions.forEach(mission => {
                console.log(`Mission ${mission.id}: ${mission.title} => dbAlias: ${mission.dbAlias}`);
            });
        }
    } else {
        console.warn("Mission data not available for validation");
    }
    
    // Also validate mainQuest missions if loaded
    if (window.GameSystem && window.GameSystem.gameData && 
        window.GameSystem.gameData.databases && 
        window.GameSystem.gameData.databases.mainQuest &&
        window.GameSystem.gameData.databases.mainQuest.missions) {
        
        const missions = window.GameSystem.gameData.databases.mainQuest.missions.data;
        if (Array.isArray(missions)) {
            console.log("MainQuest database aliases:");
            missions.forEach(mission => {
                console.log(`Mission ${mission.id}: ${mission.title} => dbAlias: ${mission.dbAlias}`);
            });
        }
    }
}

// Call validation after schemas are loaded
async function initializeSchemas() {
    try {
        // First fetch the list of available schemas
        const response = await fetch('./data/db_schemas/available_schemas.json');
        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }
        
        const schemaList = await response.json();
        const schemaPromises = [];
        
        // Load each schema file
        for (const schemaName of schemaList) {
            const schemaPromise = fetch(`./data/db_schemas/${schemaName}.json`)
                .then(response => {
                    if (!response.ok) {
                        throw new Error(`Failed to load schema: ${schemaName}`);
                    }
                    return response.json();
                })
                .then(schemaData => {
                    schemas[schemaName] = schemaData;
                    console.log(`Database schema for ${schemaName} loaded successfully`);
                    return schemaName;
                })
                .catch(error => {
                    console.error(`Error loading schema ${schemaName}:`, error);
                });
            
            schemaPromises.push(schemaPromise);
        }
        
        // Wait for all schemas to load
        await Promise.all(schemaPromises);
        console.log("Core database schemas loaded successfully");
        
        // Call validation function after schemas are loaded
        setTimeout(() => {
            validateMissionDatabaseAliases();
        }, 1000);
        
        return schemas;
    } catch (error) {
        console.error('Failed to initialize schemas:', error);
        throw error;
    }
}

// Export schema loader functions
window.SchemaLoader = {
    initialize: initializeDatabaseSchemas,
    getAll: getAllDatabaseSchemas,
    get: getDatabaseSchema,
    registerHardcoded: registerHardcodedSchemas
};