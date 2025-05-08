// Database Engine for SQL Adventure Game
// This file handles all database operations including SQL execution, mounting/unmounting databases,
// database visualization and schema map rendering

// Fallback sound settings in case main settings not loaded yet
const DEFAULT_SOUND_SETTINGS = {
    masterVolume: 0.5,
    effectsVolume: 0.5,
    effectsEnabled: true
};

// Global state for database management
let alasqlInitialized = false;
let mountedDbAliases = new Set();
let dbMetadataVis = {};
let lastParsedInfoVis = null;
const ARROWHEAD_ADJUSTMENT = 5;

// Database system initialization
function initializeDatabase() {
    console.log("Initializing database engine...");
    alasqlInitialized = false;
    mountedDbAliases = new Set();
    dbMetadataVis = {};
    
    try { 
        if (typeof alasql !== 'undefined') { 
            alasql('DROP DATABASE IF EXISTS gameDB;'); 
            alasql('CREATE DATABASE gameDB;'); 
            alasql('USE gameDB;'); 
            console.log("Clean AlaSQL DB environment created."); 
            alasqlInitialized = true; 
            
            // Initialize database schemas using SchemaLoader
            if (window.SchemaLoader) {
                SchemaLoader.initialize().then(() => {
                    console.log("Database schemas initialized");
                }).catch(error => {
                    console.error("Failed to initialize database schemas:", error);
                    // Fall back to hardcoded schemas
                    SchemaLoader.registerHardcoded();
                });
            } else {
                console.warn("Schema Loader module not available");
            }
            
        } else { 
            throw new Error("AlaSQL library not loaded.")
        } 
    } catch(e) { 
        console.error("Critical AlaSQL Initialization Error:", e);
        if (window.GameSystem) {
            GameSystem.showError("Failed to initialize core database system. Please refresh.");
        } 
        return false; 
    }
    
    return true;
}

// Mount a database by alias
function mountDatabase(dbAlias) { 
    // Get database schema from SchemaLoader or fallback to GameSystem
    const dbData = window.SchemaLoader ? SchemaLoader.get(dbAlias) : null;
    const gameData = window.GameSystem ? window.GameSystem.gameData : null;
    
    if (!dbData && (!gameData || !gameData.databases[dbAlias])) { 
        if (window.GameSystem) {
            GameSystem.showError(`Database definition "${dbAlias}" not found.`);
        }
        return false; 
    } 
    
    if (typeof alasql === 'undefined' || !alasqlInitialized) { 
        if (window.GameSystem) {
            GameSystem.showError(`Base AlaSQL system not ready.`);
        }
        console.error("Mount attempt failed: AlaSQL not initialized."); 
        return false; 
    } 
    
    try { 
        console.log(`Attempting to mount database: ${dbAlias}`);
        const schemaToUse = dbData || gameData.databases[dbAlias];
        
        for (const tableName in schemaToUse) { 
            alasql(`DROP TABLE IF EXISTS ${tableName};`); 
            const schema = schemaToUse[tableName]; 
            let columnsSql = Object.entries(schema.columns).map(([colName, colType]) => `${colName} ${colType}`).join(', '); 
            let createTableSql = `CREATE TABLE ${tableName} (${columnsSql});`; 
            alasql(createTableSql); 
            
            if (schema.data && schema.data.length > 0) { 
                alasql(`INSERT INTO ${tableName} SELECT * FROM ?;`, [schema.data]); 
            } 
            // console.log(`Table ${tableName} created for DB ${dbAlias}.`); 
        } 
        
        mountedDbAliases.add(dbAlias);
        // console.log(`Successfully mounted ${dbAlias}. Mounted Set:`, mountedDbAliases);
        
        // Show map button if maps database is mounted
        if (dbAlias === 'maps') {
            const openMapBtn = document.getElementById('open-map-header-btn');
            if (openMapBtn) {
                // console.log("Maps database mounted, showing interactive map button");
                openMapBtn.style.display = 'block';
            }
        }
        
        // Check if this database mount completes a mission
        if (window.MissionSystem && 
            window.MissionSystem.currentMissionId !== null && 
            window.MissionSystem.currentMissionData) {
            
            const mission = window.MissionSystem.currentMissionData;
            let criteria = mission.validationCriteria;
            
            // If this is a database mounting mission and the required database was mounted
            if (criteria && criteria.databaseMounted && criteria.requiredDatabase === dbAlias) {
                // console.log(`Database ${dbAlias} mounted - this completes the current mission!`);
                window.MissionSystem.isMissionSolved = true;
                
                // Show and update the complete mission button
                const completeMissionBtn = document.getElementById('complete-mission-btn');
                if (completeMissionBtn) {
                    completeMissionBtn.textContent = 'Complete Mission';
                    completeMissionBtn.style.display = 'block';
                    completeMissionBtn.disabled = false;
                    completeMissionBtn.classList.add('mission-solved');
                }
                
                // Display success message
                if (window.GameSystem && window.GameSystem.displayMessage) {
                    window.GameSystem.displayMessage("Database mounted successfully! Click 'Complete Mission' to continue.", "status-success");
                }
            }
        }
        
        return true; 
    } catch (e) { 
        console.error(`Database Mount Error for ${dbAlias}:`, e); 
        unmountDatabase(dbAlias, false); 
        if (window.GameSystem) {
            GameSystem.showError(`Failed to mount database ${dbAlias}. Error: ${e.message}.`);
        }
        mountedDbAliases.delete(dbAlias); 
        return false; 
    } 
}

// Unmount a database by alias
function unmountDatabase(dbAlias, showMessages = true) { 
    // Get database schema from SchemaLoader or fallback to GameSystem
    const dbData = window.SchemaLoader ? SchemaLoader.get(dbAlias) : null;
    const gameData = window.GameSystem ? window.GameSystem.gameData : null;
    
    if (!dbData && (!gameData || !gameData.databases[dbAlias])) { 
        if(showMessages && window.GameSystem) {
            GameSystem.showError(`Database definition "${dbAlias}" not found for unmount.`);
        }
        return false; 
    } 
    
    if (typeof alasql === 'undefined') { 
        if(showMessages && window.GameSystem) {
            GameSystem.showError(`AlaSQL library not loaded.`);
        }
        return false; 
    } 
    
    try { 
        // console.log(`Unmounting database: ${dbAlias}`);
        const schemaToUse = dbData || gameData.databases[dbAlias];
        
        for (const tableName in schemaToUse) { 
            alasql(`DROP TABLE IF EXISTS ${tableName};`); 
            // console.log(`Table ${tableName} dropped (if existed) for DB ${dbAlias}.`); 
        } 
        mountedDbAliases.delete(dbAlias); 
        // console.log(`Successfully processed unmount for ${dbAlias}. Mounted Set:`, mountedDbAliases); 
        return true; 
    } catch(e) { 
        console.error(`Database Unmount Error for ${dbAlias}:`, e); 
        if(showMessages && window.GameSystem) {
            GameSystem.showError(`Error during unmount of ${dbAlias}. Error: ${e.message}.`);
        }
        mountedDbAliases.delete(dbAlias); 
        return false; 
    } 
}

// Execute SQL query with AlaSQL
function executeQuery(query) {
    // Always save the last query text
    window.lastQueryText = query;
    
    try {
        // Clean up the query and handle special commands
        query = query.trim();
        
        // Handle special commands
        if (query.toLowerCase() === 'help') {
            return [{ command: 'HELP', description: 'Shows available commands' },
                    { command: 'DB REGISTRY', description: 'Opens the database registry' },
                    { command: 'MAP', description: 'Opens the interactive world map' }];
        }
        
        if (query.toLowerCase() === 'db registry') {
            // Open the database registry UI
            const dbBrowser = document.getElementById('db-browser-overlay');
            const dbBackdrop = document.querySelector('.db-browser-backdrop');
            if (dbBrowser) dbBrowser.style.display = 'flex';
            if (dbBackdrop) dbBackdrop.style.display = 'block';
            return [{ status: 'Database Registry opened' }];
        }
        
        // Process query with AlaSQL
        const results = alasql(query);
        
        // Update global last results for mission checking
        window.lastResults = results;
        
        // Pass query results to the graph module if available
        if (window.visualizeQueryResults && Array.isArray(results) && results.length > 0) {
            window.visualizeQueryResults(results);
        }
        
        return results;
    } catch (error) {
        console.error('SQL Error:', error);
        
        // Try to play error sound
        if (window.errorSound) {
            window.errorSound.play().catch(err => console.error("Error playing sound:", err));
        }
        
        if (error.message.includes('Cannot read')) {
            document.getElementById('error-message').textContent = 'Error: Database not mounted. Use the DB REGISTRY to mount a database.';
        } else {
            document.getElementById('error-message').textContent = `SQL Error: ${error.message}`;
        }
        document.getElementById('error-message').style.display = 'block';
        return null;
    }
}

// Helper function to play error sound
function playErrorSound() {
    try {
        // Use either global sound settings or our default fallback
        const soundConfig = window.soundSettings || DEFAULT_SOUND_SETTINGS;
        
        if (soundConfig.effectsEnabled) {
            // Create audio context for filters
            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
            const errorSound = new Audio('./audio/619803__teh_bucket__error-fizzle.ogg');
            
            // Create media element source from our audio element
            const source = audioContext.createMediaElementSource(errorSound);
            
            // Create high-pass filter to reduce low frequencies (bass)
            const highPassFilter = audioContext.createBiquadFilter();
            highPassFilter.type = "highpass";
            highPassFilter.frequency.value = 300; // Cut frequencies below 300Hz
            
            // Create low-pass filter to reduce high frequencies (treble)
            const lowPassFilter = audioContext.createBiquadFilter();
            lowPassFilter.type = "lowpass";
            lowPassFilter.frequency.value = 3000; // Cut frequencies above 3000Hz
            
            // Create gain node to control volume more precisely
            const gainNode = audioContext.createGain();
            gainNode.gain.value = 0.5; // Additional volume reduction
            
            // Connect nodes: source -> highpass -> lowpass -> gain -> output
            source.connect(highPassFilter);
            highPassFilter.connect(lowPassFilter);
            lowPassFilter.connect(gainNode);
            gainNode.connect(audioContext.destination);
            
            // Calculate volume using either window.soundSettings or our DEFAULT_SOUND_SETTINGS
            const masterVolume = soundConfig.masterVolume || 0.5;
            const effectsVolume = soundConfig.effectsVolume || 0.5;
            errorSound.volume = 0.4 * effectsVolume * masterVolume;
            
            // console.log("Playing SQL error sound with filters");
            errorSound.play().catch(err => {
                console.error("SQL error sound failed to play:", err);
            });
        }
    } catch (err) {
        console.error("Error playing SQL error sound:", err);
    }
}

// Helper function to suggest which database a table might belong to
function getSuggestedDatabase(tableName) {
    const tableToDbMap = {
        // Map lowercase table names to their database aliases
        "missions": "mission_control",
        "planets": "galaxy1",
        "species": "galaxy1",
        "ships": "galaxy1",
        "resources": "galaxy1",
        "education_metrics": "sdg_education",
        "paris_metrics": "france",
        "earth": "maps",
        "solsystemplanets": "solar_system_archive",
        "solaratmosphericgases": "solar_system_archive",
        "deepspaceobjects": "deep_space_catalog"
    };
    
    return tableToDbMap[tableName.toLowerCase()] || null;
}

// Database visualization functions
function generateVisualizerMetadata() {
    const combinedMetadata = { tables: {}, relationships: [] }; 
    let totalTables = 0; 
    const positions = [ { top: 20, left: 20 }, { top: 20, left: 200 }, { top: 180, left: 20 }, { top: 180, left: 200 }, { top: 340, left: 20 }, { top: 340, left: 200 } ]; 
    console.log("Generating schema map metadata for mounted DBs:", mountedDbAliases); 
    
    mountedDbAliases.forEach(alias => { 
        // Try to get schema from SchemaLoader first, then fallback to GameSystem
        const dbSchema = window.SchemaLoader ? SchemaLoader.get(alias) : null;
        const gameData = window.GameSystem ? window.GameSystem.gameData : null;
        const schemaToUse = dbSchema || (gameData ? gameData.databases[alias] : null);
        
        if (!schemaToUse) { 
            console.warn(`Schema not found for mounted alias: ${alias}`); 
            return; 
        } 
        
        for (const tableName in schemaToUse) { 
            if (combinedMetadata.tables[tableName]) { 
                console.warn(`Table name conflict: "${tableName}" exists in multiple mounted databases.`); 
            } 
            
            const schema = schemaToUse[tableName]; 
            const columns = Object.keys(schema.columns).map(c => c.replace(/`/g, '')); 
            combinedMetadata.tables[tableName] = { position: positions[totalTables % positions.length], columns: columns, dbAlias: alias }; 
            
            columns.forEach(colName => { 
                if (colName.endsWith('_id') && colName !== 'id') { 
                    const targetTable = colName.substring(0, colName.length - 3) + 's'; 
                    if (schemaToUse[targetTable]) { 
                        combinedMetadata.relationships.push({ from: `${tableName}.${colName}`, to: `${targetTable}.id` }); 
                    } 
                } 
            }); 
            
            totalTables++; 
        } 
    }); 
    
    // console.log("Generated Combined Schema Metadata:", combinedMetadata); 
    dbMetadataVis = combinedMetadata; 
}

function setupMap(mapCanvas, svgContainer) { 
    // console.log("setupMap (Schema) called."); 
    if (!mapCanvas) { 
        console.error("setupMap: mapCanvas not found!"); 
        return; 
    } 
    
    mapCanvas.querySelectorAll('.db-table-vis').forEach(el => el.remove()); 
    if (svgContainer) svgContainer.innerHTML = ''; 
    setupSvgDefs(svgContainer); 
    
    if (!dbMetadataVis || !dbMetadataVis.tables || typeof dbMetadataVis.tables !== 'object') { 
        console.warn("setupMap: dbMetadataVis.tables is invalid or empty. Skipping table drawing."); 
        if (mountedDbAliases.size === 0) {
            if (window.GameSystem) { 
                GameSystem.showMapPlaceholder("No database mounted. Use DB REGISTRY.");
            }
        } else { 
            if (window.GameSystem) {
                GameSystem.showMapPlaceholder("Error generating schema map data.");
            }
        } 
        return; 
    } 
    
    if (Object.keys(dbMetadataVis.tables).length > 0) { 
        if (window.GameSystem) {
            GameSystem.hideMapPlaceholder();
        }
    } else if (mountedDbAliases.size === 0) { 
        if (window.GameSystem) {
            GameSystem.showMapPlaceholder("No database mounted. Use DB REGISTRY.");
        }
    } 
    
    Object.entries(dbMetadataVis.tables).forEach(([tableName, tableData]) => { 
        const tableEl = document.createElement('div'); 
        tableEl.className = 'db-table-vis'; 
        tableEl.id = `vis-table-${tableName}`; 
        tableEl.style.top = `${tableData.position.top}px`; 
        tableEl.style.left = `${tableData.position.left}px`; 
        tableEl.dataset.tableName = tableName; 
        
        // Add collapse/expand button to each table
        const collapseBtn = document.createElement('div');
        collapseBtn.className = 'table-collapse-btn';
        collapseBtn.textContent = '-';
        collapseBtn.title = 'Collapse/Expand';
        collapseBtn.addEventListener('click', function(e) {
            e.stopPropagation(); // Prevent triggering drag
            tableEl.classList.toggle('collapsed');
            this.textContent = tableEl.classList.contains('collapsed') ? '+' : '-';
            // Update join lines if table state changes
            if (!tableEl.classList.contains('collapsed')) {
                updateAllJoinLines(mapCanvas);
            }
        });
        tableEl.appendChild(collapseBtn);
        
        const headerEl = document.createElement('div'); 
        headerEl.className = 'table-header-vis'; 
        const nameSpan = document.createElement('span'); 
        nameSpan.textContent = tableName; 
        const seqSpan = document.createElement('span'); 
        seqSpan.className = 'table-sequence-number'; 
        seqSpan.id = `seq-${tableName}`; 
        headerEl.appendChild(nameSpan); 
        headerEl.appendChild(seqSpan); 
        tableEl.appendChild(headerEl); 
        
        const colListEl = document.createElement('ul'); 
        colListEl.className = 'column-list-vis'; 
        tableData.columns.forEach(colName => { 
            const colItemEl = document.createElement('li'); 
            colItemEl.className = 'column-item-vis'; 
            colItemEl.id = `vis-col-${tableName}-${colName.replace(/`/g, '')}`; 
            colItemEl.textContent = colName.replace(/`/g, ''); 
            colListEl.appendChild(colItemEl); 
        }); 
        
        tableEl.appendChild(colListEl); 
        mapCanvas.appendChild(tableEl); 
        makeMapElementDraggable(tableEl, mapCanvas); 
    }); 
    
    console.log("setupMap (Schema) completed."); 
}

function setupSvgDefs(svgContainer) { 
    if (!svgContainer || svgContainer.querySelector('defs')) return; 
    const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs'); 
    defs.innerHTML = ` <marker id="arrowhead-active-cyan" viewBox="-1 -5 12 10" refX="10" refY="0" markerUnits="strokeWidth" markerWidth="8" markerHeight="8" orient="auto-start-reverse"><path d="M 0 -4 L 10 0 L 0 4 Z" fill="#00ffcc"></path></marker> <marker id="arrowhead-inactive" viewBox="-1 -5 12 10" refX="10" refY="0" markerUnits="strokeWidth" markerWidth="8" markerHeight="8" orient="auto-start-reverse"><path d="M 0 -4 L 10 0 L 0 4 Z" fill="#888"></path></marker> `; 
    svgContainer.appendChild(defs); 
}

// SQL Query parsing for visualization
function parseQueryForVis(query) { 
    // console.log("Parsing query for schema visualization:", query);
    
    const info = {
        selectColumns: new Set(),
        tablesInvolved: [],
        joinConditions: [],
        aliases: {}
    };
    
    try {
        // Clean up the query - remove comments, normalize whitespace
        query = query.replace(/--.*$/gm, '')
                     .replace(/\/\*[\s\S]*?\*\//g, '')
                     .replace(/\s+/g, ' ')
                     .trim();
        
        // Convert to lowercase for case-insensitive matching, but preserve quoted strings
        // This is a simplification - a real SQL parser would be more sophisticated
        
        // Extract table names - includes basic support for FROM clause with joins
        const fromMatch = query.match(/\bFROM\s+([^;]*?)(?:\bWHERE\b|\bGROUP BY\b|\bHAVING\b|\bORDER BY\b|\bLIMIT\b|$)/i);
        
        if (fromMatch) {
            const fromClause = fromMatch[1].trim();
            
            // Handle simple comma-separated tables
            if (fromClause.includes(',')) {
                const tablesList = fromClause.split(',');
                tablesList.forEach(tableRef => {
                    // Handle potential aliases: "table AS alias" or "table alias"
                    const tableRefParts = tableRef.trim().split(/\s+(?:AS\s+)?/i);
                    const tableName = tableRefParts[0].trim().replace(/`|"|'/g, '');
                    if (tableRefParts.length > 1) {
                        const alias = tableRefParts[1].trim().replace(/`|"|'/g, '');
                        info.aliases[alias] = tableName;
                    }
                    info.tablesInvolved.push(tableName);
                });
            } 
            // Handle JOINs
            else if (/\bJOIN\b/i.test(fromClause)) {
                // Get the first table in the FROM clause
                const firstTableMatch = fromClause.match(/^([^`\s]+|\`[^`]+\`|"[^"]+"|'[^']+')(?:\s+(?:AS\s+)?([^`\s]+|\`[^`]+\`|"[^"]+"|'[^']+')\s+)?/i);
                
                if (firstTableMatch) {
                    let firstTableName = firstTableMatch[1].replace(/`|"|'/g, '');
                    info.tablesInvolved.push(firstTableName);
                    
                    // Handle alias for first table
                    if (firstTableMatch[2]) {
                        let firstTableAlias = firstTableMatch[2].replace(/`|"|'/g, '');
                        info.aliases[firstTableAlias] = firstTableName;
                    }
                }
                
                // Extract tables and conditions from JOIN clauses
                const joinPattern = /(\w+\s+)?JOIN\s+([^`\s]+|\`[^`]+\`|"[^"]+"|'[^']+')\s+(?:AS\s+)?([^`\s]+|\`[^`]+\`|"[^"]+"|'[^']+')?.*?ON\s+(.+?)(?:\s+(?:LEFT|RIGHT|INNER|OUTER|JOIN|WHERE|GROUP|HAVING|ORDER|LIMIT)\s+|$)/ig;
                let joinMatch;
                
                // Reset lastIndex to start from beginning
                joinPattern.lastIndex = 0;
                
                while ((joinMatch = joinPattern.exec(fromClause)) !== null) {
                    const joinTableName = joinMatch[2].replace(/`|"|'/g, '');
                    info.tablesInvolved.push(joinTableName);
                    
                    // Handle alias
                    if (joinMatch[3]) {
                        const joinAlias = joinMatch[3].replace(/`|"|'/g, '');
                        info.aliases[joinAlias] = joinTableName;
                    }
                    
                    // Extract join conditions
                    if (joinMatch[4]) {
                        const condition = joinMatch[4].trim();
                        const conditionMatch = condition.match(/([^`\s.]+|\`[^`]+\`|"[^"]+"|'[^']+')\.([^`\s.]+|\`[^`]+\`|"[^"]+"|'[^']+')\s*=\s*([^`\s.]+|\`[^`]+\`|"[^"]+"|'[^']+')\.([^`\s.]+|\`[^`]+\`|"[^"]+"|'[^']+')/i);
                        
                        if (conditionMatch) {
                            const joinInfo = {
                                leftTable: conditionMatch[1].replace(/`|"|'/g, ''),
                                leftColumn: conditionMatch[2].replace(/`|"|'/g, ''),
                                rightTable: conditionMatch[3].replace(/`|"|'/g, ''),
                                rightColumn: conditionMatch[4].replace(/`|"|'/g, '')
                            };
                            info.joinConditions.push(joinInfo);
                        }
                    }
                }
            } 
            // Single table with no joins
            else {
                const tableRefParts = fromClause.trim().split(/\s+(?:AS\s+)?/i);
                const tableName = tableRefParts[0].trim().replace(/`|"|'/g, '');
                info.tablesInvolved.push(tableName);
                
                if (tableRefParts.length > 1) {
                    const alias = tableRefParts[1].trim().replace(/`|"|'/g, '');
                    info.aliases[alias] = tableName;
                }
            }
        }
        
        // Special handling for JOIN without explicit ON clause
        if (!info.joinConditions.length && info.tablesInvolved.length > 1) {
            // Look for WHERE clause with potential join conditions
            const whereMatch = query.match(/\bWHERE\s+(.+?)(?:\bGROUP BY\b|\bHAVING\b|\bORDER BY\b|\bLIMIT\b|$)/i);
            if (whereMatch) {
                const whereConditions = whereMatch[1].split(/\bAND\b/i);
                whereConditions.forEach(condition => {
                    // Look for conditions like "table1.col = table2.col"
                    const condMatch = condition.match(/([^`\s.]+|\`[^`]+\`|"[^"]+"|'[^']+')\.([^`\s.]+|\`[^`]+\`|"[^"]+"|'[^']+')\s*=\s*([^`\s.]+|\`[^`]+\`|"[^"]+"|'[^']+')\.([^`\s.]+|\`[^`]+\`|"[^"]+"|'[^']+')/i);
                    if (condMatch) {
                        const joinInfo = {
                            leftTable: condMatch[1].replace(/`|"|'/g, ''),
                            leftColumn: condMatch[2].replace(/`|"|'/g, ''),
                            rightTable: condMatch[3].replace(/`|"|'/g, ''),
                            rightColumn: condMatch[4].replace(/`|"|'/g, '')
                        };
                        info.joinConditions.push(joinInfo);
                    }
                });
            }
        }
        
        // Extract SELECT columns
        const selectMatch = query.match(/SELECT\s+(.+?)\s+FROM/i);
        if (selectMatch) {
            const selectClause = selectMatch[1].trim();
            
            // Handle * case
            if (selectClause === '*') {
                info.selectColumns.add('*');
            } else {
                // Split on commas, but be careful with function calls like COUNT(col)
                let inParentheses = 0;
                let currentCol = '';
                
                for (let i = 0; i < selectClause.length; i++) {
                    const char = selectClause[i];
                    
                    if (char === '(') {
                        inParentheses++;
                        currentCol += char;
                    } else if (char === ')') {
                        inParentheses--;
                        currentCol += char;
                    } else if (char === ',' && inParentheses === 0) {
                        // End of column definition
                        info.selectColumns.add(currentCol.trim());
                        currentCol = '';
                    } else {
                        currentCol += char;
                    }
                }
                
                // Add the last column
                if (currentCol.trim()) {
                    info.selectColumns.add(currentCol.trim());
                }
                
                // Process aggregation functions and aliases in SELECT columns
                info.selectColumns.forEach(col => {
                    // Handle aliases in SELECT: "col AS alias" or "function(col) AS alias"
                    const aliasMatch = col.match(/(.+?)\s+AS\s+([^,]+)$/i);
                    if (aliasMatch) {
                        const colName = aliasMatch[1].trim();
                        const aliasName = aliasMatch[2].trim().replace(/`|"|'/g, '');
                        
                        // Store the alias mapping
                        info.aliases[aliasName] = colName;
                    }
                });
            }
        }
        
        // Additional handling for complex JOIN conditions with table aliases
        if (info.joinConditions.length > 0) {
            info.joinConditions = info.joinConditions.map(condition => {
                // Resolve table aliases
                if (info.aliases[condition.leftTable]) {
                    condition.leftTable = info.aliases[condition.leftTable];
                }
                if (info.aliases[condition.rightTable]) {
                    condition.rightTable = info.aliases[condition.rightTable];
                }
                return condition;
            });
        }
        
        // console.log("Parsed Info for Schema Vis:", info);
        return info;
    } catch (err) {
        console.error("Error parsing query for visualization:", err);
        return info; // Return empty info or what was parsed so far
    }
}

function updateVisualization(parsedInfo, mapCanvas, svgContainer) { 
    // console.log("updateVisualization (Schema) called with:", parsedInfo); 
    lastParsedInfoVis = parsedInfo; 
    
    if (!mapCanvas) {
        console.error("Map canvas not provided for visualization update");
        return;
    }
    
    document.querySelectorAll('.db-table-vis').forEach(el => { 
        el.classList.remove('highlight-table'); 
        const seqNumEl = el.querySelector('.table-sequence-number'); 
        if(seqNumEl) { 
            seqNumEl.textContent = ''; 
            seqNumEl.style.opacity = '0'; 
        } 
    }); 
    
    document.querySelectorAll('.column-item-vis').forEach(el => { 
        el.classList.remove('highlight-column'); 
    }); 
    
    if (svgContainer) { 
        svgContainer.querySelectorAll('line.join-line-vis').forEach(el => el.remove()); 
    } 
    
    if (!parsedInfo || !parsedInfo.tablesInvolved || !parsedInfo.aliases || parsedInfo.tablesInvolved.length === 0) { 
        // console.log("Resetting schema visualization (invalid info or no tables)."); 
        return; 
    } 
    
    parsedInfo.tablesInvolved.forEach((tableName, index) => { 
        const tableEl = document.getElementById(`vis-table-${tableName}`); 
        if (tableEl) { 
            tableEl.classList.add('highlight-table'); 
            const seqNumEl = tableEl.querySelector(`#seq-${tableName}`); 
            if(seqNumEl) { 
                seqNumEl.textContent = index + 1; 
                seqNumEl.style.opacity = '1'; 
            } 
        } else { 
            console.warn(`Vis element not found for table: vis-table-${tableName}`); 
        } 
    }); 
    
    const findColElement = (colIdRaw) => { 
        if (!colIdRaw) return null;
        
        let el = null; 
        // Handle functions/aggregations - extract the innermost column reference
        // For example: SUM(resources.market_value) → resources.market_value
        let colId = colIdRaw;
        const functionMatch = colId.match(/\w+\s*\(\s*([^)]+)\s*\)/i);
        if (functionMatch && functionMatch[1]) {
            colId = functionMatch[1].trim();
        }
        
        // Remove aliases (text after AS keyword)
        colId = colId.replace(/\s+as\s+.+$/i, "").trim();
        
        // Remove backticks or quotes
        colId = colId.replace(/`|"|'/g, '');
        
        const tableAliases = parsedInfo.aliases || {}; 
        
        if (colId.includes('.')) { 
            const [prefix, colName] = colId.split('.'); 
            const realTable = tableAliases[prefix]; 
            if (realTable) { 
                el = document.getElementById(`vis-col-${realTable}-${colName}`); 
            } else if (dbMetadataVis.tables && dbMetadataVis.tables[prefix]) { 
                el = document.getElementById(`vis-col-${prefix}-${colName}`); 
            } else { 
                console.warn(`Vis Element: Cannot resolve table/alias "${prefix}" for column "${colIdRaw}"`); 
            } 
        } else { 
            for (const involvedTable of parsedInfo.tablesInvolved) { 
                el = document.getElementById(`vis-col-${involvedTable}-${colId}`); 
                if (el) break; 
            } 
            if (!el) console.warn(`Vis Element: Could not find table for column "${colIdRaw}"`); 
        } 
        
        return el; 
    }; 
    
    parsedInfo.selectColumns.forEach(colIdentifier => { 
        colIdentifier = colIdentifier.trim(); 
        if (colIdentifier === '*') { 
            parsedInfo.tablesInvolved.forEach(tableName => { 
                const tableMeta = dbMetadataVis.tables[tableName]; 
                if (tableMeta) { 
                    tableMeta.columns.forEach(colName => { 
                        const colEl = document.getElementById(`vis-col-${tableName}-${colName.replace(/`|"|'/g, '')}`); 
                        if (colEl) colEl.classList.add('highlight-column'); 
                    }); 
                } 
            }); 
        } else { 
            const colEl = findColElement(colIdentifier); 
            if (colEl) colEl.classList.add('highlight-column'); 
        } 
    }); 
    
    // Use a more robust approach to create join lines for tables
    if (parsedInfo.tablesInvolved.length > 1) {
        // console.log("Drawing join lines...");
        setTimeout(() => {
            if (!svgContainer) return;
            svgContainer.querySelectorAll('line.join-line-vis').forEach(el => el.remove());
            
            // For explicit join conditions, use those
            if (parsedInfo.joinConditions && parsedInfo.joinConditions.length > 0) {
                parsedInfo.joinConditions.forEach(condition => {
                    // Only if we have valid left and right table fields
                    if (condition && condition.leftTable && condition.rightTable) {
                        const fromStr = `${condition.leftTable}.${condition.leftColumn}`;
                        const toStr = `${condition.rightTable}.${condition.rightColumn}`;
                        // console.log(`Attempting to draw line for: ${fromStr} = ${toStr}`);
                        drawSimpleJoinLine(fromStr, toStr, mapCanvas, svgContainer);
                    } else {
                        console.log("Skipping invalid join condition:", condition);
                    }
                });
            } 
            // If no explicit join conditions but multiple tables, infer possible joins
            else {
                // console.log("No explicit join conditions found, inferring from table relationships");
                // Try to infer join conditions from common ID patterns (table_id columns)
                const tables = parsedInfo.tablesInvolved;
                
                for (let i = 0; i < tables.length; i++) {
                    const mainTable = tables[i];
                    
                    // Check if any other table potentially joins to this one
                    for (let j = 0; j < tables.length; j++) {
                        if (i === j) continue; // Skip self
                        const otherTable = tables[j];
                        
                        // Common patterns:
                        // 1. tableA has id, tableB has tableA_id
                        const possibleFkCol = `${mainTable}_id`;
                        
                        // Check if tables are in the dbMetadataVis
                        if (dbMetadataVis.tables && 
                            dbMetadataVis.tables[mainTable] && 
                            dbMetadataVis.tables[otherTable]) {
                            
                            // Check if foreign key column exists in the other table
                            const otherColumns = dbMetadataVis.tables[otherTable].columns;
                            
                            if (otherColumns.includes(possibleFkCol)) {
                                const fromStr = `${mainTable}.id`;
                                const toStr = `${otherTable}.${possibleFkCol}`;
                                // console.log(`Inferred join: ${fromStr} = ${toStr}`);
                                drawSimpleJoinLine(fromStr, toStr, mapCanvas, svgContainer);
                            }
                        }
                    }
                }
                
                // If we still have no lines, just connect the tables directly for visual reference
                const allLines = svgContainer.querySelectorAll('line.join-line-vis');
                if (allLines.length === 0 && tables.length > 1) {
                    // console.log("No join lines created by inference, connecting first two tables directly");
                    // Just connect the first two tables as a fallback for visualization
                    const fromStr = `${tables[0]}.id`;
                    const toStr = `${tables[1]}.id`;
                    drawSimpleJoinLine(fromStr, toStr, mapCanvas, svgContainer);
                }
            }
        }, 50);
    } else {
        console.log("No join conditions to draw lines for.");
    }
}

function getTableCenter(tableId, mapCanvas) { 
    const tableEl = document.getElementById(tableId); 
    if (!tableEl || !mapCanvas) return null; 
    const tableRect = tableEl.getBoundingClientRect(); 
    const canvasRect = mapCanvas.getBoundingClientRect(); 
    const x = Math.round(tableRect.left - canvasRect.left + tableRect.width / 2); 
    const y = Math.round(tableRect.top - canvasRect.top + tableRect.height / 2); 
    return { x, y }; 
}

function drawSimpleJoinLine(fromColFullId, toColFullId, mapCanvas, svgContainer) { 
    if (!svgContainer || !mapCanvas) return;
    
    // Validate inputs to prevent "replace" errors on undefined values
    if (!fromColFullId || !toColFullId || typeof fromColFullId !== 'string' || typeof toColFullId !== 'string') {
        console.warn("Invalid join condition format:", { from: fromColFullId, to: toColFullId });
        return;
    }
    
    const cleanFrom = fromColFullId.replace(/`/g, ''); 
    const cleanTo = toColFullId.replace(/`/g, ''); 
    
    // Ensure both sides have the expected table.column format
    if (!cleanFrom.includes('.') || !cleanTo.includes('.')) {
        console.warn("Join condition missing table.column format:", { from: cleanFrom, to: cleanTo });
        return;
    }
    
    // Extract table names
    const [fromTable, fromCol] = cleanFrom.split('.'); 
    const [toTable, toCol] = cleanTo.split('.'); 
    
    // Validate extracted table names are not empty
    if (!fromTable || !toTable) {
        console.warn("Empty table name in join condition:", { from: fromTable, to: toTable });
        return;
    }
    
    const fromTableElId = `vis-table-${fromTable}`; 
    const toTableElId = `vis-table-${toTable}`; 
    
    // Get table positions
    const startPos = getTableCenter(fromTableElId, mapCanvas); 
    const endPos = getTableCenter(toTableElId, mapCanvas); 
    
    if (startPos && endPos && (startPos.x !== endPos.x || startPos.y !== endPos.y)) { 
        const dx = endPos.x - startPos.x; 
        const dy = endPos.y - startPos.y; 
        const angle = Math.atan2(dy, dx); 
        const length = Math.sqrt(dx*dx + dy*dy); 
        const adjustedLength = Math.max(0, length - (ARROWHEAD_ADJUSTMENT * 1.5)); 
        const endXAdjusted = startPos.x + adjustedLength * Math.cos(angle); 
        const endYAdjusted = startPos.y + adjustedLength * Math.sin(angle); 
        const line = document.createElementNS('http://www.w3.org/2000/svg', 'line'); 
        line.setAttribute('x1', startPos.x); 
        line.setAttribute('y1', startPos.y); 
        line.setAttribute('x2', endXAdjusted); 
        line.setAttribute('y2', endYAdjusted); 
        line.classList.add('join-line-vis'); 
        line.setAttribute('marker-end', 'url(#arrowhead-inactive)'); 
        svgContainer.appendChild(line); 
        requestAnimationFrame(() => { 
            line.classList.add('active'); 
            line.setAttribute('marker-end', 'url(#arrowhead-active-cyan)'); 
        }); 
        // console.log(`Simple line drawn for ${fromColFullId} -> ${toColFullId}`); 
    } else if (!startPos || !endPos) { 
        console.warn(`Could not get center points for tables ${fromTable} or ${toTable}`); 
    } 
}

// Make schema visualization elements draggable
function makeMapElementDraggable(element, mapCanvas) { 
    let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;
    
    // Make the entire element draggable, not just the header
    element.style.cursor = 'grab';
    element.onmousedown = dragMouseDown;
    
    // Also set up header events as before (in case user expects header to work)
    const header = element.querySelector('.table-header-vis');
    if (header) {
        header.onmousedown = dragMouseDown;
    }
    
    // Remove the mouseenter event - we only want z-index to change on drag
    
    function dragMouseDown(e) { 
        e = e || window.event; 
        if (e.button !== 0) return; 
        e.preventDefault(); 
        pos3 = e.clientX; 
        pos4 = e.clientY; 
        document.addEventListener('mouseup', closeDragElement, { once: true }); 
        document.addEventListener('mousemove', elementDrag); 
        element.style.cursor = 'grabbing'; 
        
        // Set highest z-index only when actively dragging
        document.querySelectorAll('.db-table-vis').forEach(table => {
            if (table !== element) {
                table.style.zIndex = '10';
            }
        });
        element.style.zIndex = '20';
    } 
    
    function elementDrag(e) { 
        e = e || window.event; 
        e.preventDefault(); 
        pos1 = pos3 - e.clientX; 
        pos2 = pos4 - e.clientY; 
        pos3 = e.clientX; 
        pos4 = e.clientY; 
        const mapBounds = mapCanvas.getBoundingClientRect(); 
        const elmBounds = element.getBoundingClientRect(); 
        let newTop = element.offsetTop - pos2; 
        let newLeft = element.offsetLeft - pos1; 
        const parentPadding = 10; 
        newTop = Math.max(0, Math.min(newTop, mapBounds.height - elmBounds.height - parentPadding)); 
        newLeft = Math.max(0, Math.min(newLeft, mapBounds.width - elmBounds.width - parentPadding)); 
        element.style.top = newTop + "px"; 
        element.style.left = newLeft + "px"; 
        updateAllJoinLines(mapCanvas); 
    } 
    
    function closeDragElement() { 
        document.removeEventListener('mousemove', elementDrag); 
        element.style.cursor = 'grab'; 
        // We keep the element at a higher z-index after dragging is complete
        // This ensures the one you've just dragged stays on top
    } 
}

function updateAllJoinLines(mapCanvas) { 
    const svgContainer = mapCanvas ? mapCanvas.querySelector('#line-svg-container') : null;
    if (!svgContainer) return; 
    
    // First clear any existing join lines
    svgContainer.querySelectorAll('line.join-line-vis').forEach(el => el.remove());
    
    // If we don't have parsed info yet, nothing to do
    if (!lastParsedInfoVis) return;
    
    setTimeout(() => { 
        // Check if we have valid join conditions
        if (lastParsedInfoVis.joinConditions && lastParsedInfoVis.joinConditions.length > 0) {
            lastParsedInfoVis.joinConditions.forEach(cond => { 
                // Only process join conditions that have from/to properties
                if (cond && (cond.from || (cond.leftTable && cond.leftColumn && cond.rightTable && cond.rightColumn))) {
                    // Handle both formats of join conditions
                    if (cond.from && cond.to) {
                        // Direct from/to format
                        drawSimpleJoinLine(cond.from, cond.to, mapCanvas, svgContainer);
                    } else {
                        // Format with separate table and column properties
                        const fromStr = `${cond.leftTable}.${cond.leftColumn}`;
                        const toStr = `${cond.rightTable}.${cond.rightColumn}`;
                        drawSimpleJoinLine(fromStr, toStr, mapCanvas, svgContainer);
                    }
                }
            });
        } 
        // If no valid join conditions but we have multiple tables, try to infer connections
        else if (lastParsedInfoVis.tablesInvolved && lastParsedInfoVis.tablesInvolved.length > 1) {
            // Get tables from the last parsed info
            const tables = lastParsedInfoVis.tablesInvolved;
            
            // Look for conventional relationships (table_id pattern)
            for (let i = 0; i < tables.length; i++) {
                const mainTable = tables[i];
                
                for (let j = 0; j < tables.length; j++) {
                    if (i === j) continue; // Skip self
                    const otherTable = tables[j];
                    
                    // Common pattern: tableA has id, tableB has tableA_id
                    if (dbMetadataVis.tables && 
                        dbMetadataVis.tables[mainTable] && 
                        dbMetadataVis.tables[otherTable]) {
                        
                        const possibleFkCol = `${mainTable}_id`;
                        const otherColumns = dbMetadataVis.tables[otherTable].columns;
                        
                        if (otherColumns.includes(possibleFkCol)) {
                            const fromStr = `${mainTable}.id`;
                            const toStr = `${otherTable}.${possibleFkCol}`;
                            drawSimpleJoinLine(fromStr, toStr, mapCanvas, svgContainer);
                        }
                    }
                }
            }
            
            // If still no lines, just draw a simple line between the first two tables as a fallback
            if (svgContainer.querySelectorAll('line.join-line-vis').length === 0) {
                const fromStr = `${tables[0]}.id`;
                const toStr = `${tables[1]}.id`;
                drawSimpleJoinLine(fromStr, toStr, mapCanvas, svgContainer);
            }
        }
    }, 10);
}

// Database browser interface functions
function renderDatabaseBrowserItems() {
    const gameData = window.GameSystem ? window.GameSystem.gameData : null;
    if (!gameData) {
        console.warn("Game data not available for rendering DB browser - will use default values");
        // Continue with default values instead of returning early
    }
    
    const itemsContainer = document.querySelector('#db-browser-overlay .db-browser-items');
    if (!itemsContainer) {
        console.error("DB browser items container not found");
        return;
    }
    
    itemsContainer.innerHTML = ''; // Clear existing items
    const descriptions = { 
        mission_control: "Core tutorial missions and system tables.", 
        maps: "Geographic and location data for the interactive map.",
        galaxy1: "Star system data with planets, species and resources.",
        mainQuest: "Main storyline missions and alien investigation data.",
        deep_space_catalog: "Deep space objects and celestial bodies catalog.",
        solar_system_archive: "Detailed information about planets in the Sol system."
    };
    const sizes = { 
        mission_control: "5MB", 
        maps: "50MB",
        galaxy1: "50MB",
        mainQuest: "100MB",
        deep_space_catalog: "75MB",
        solar_system_archive: "30MB"
    };
    const accessLevels = { 
        mission_control: 1, 
        maps: 1,
        galaxy1: 1,
        mainQuest: 2,
        deep_space_catalog: 1,
        solar_system_archive: 1
    };

    // Get available schemas list from SchemaLoader
    let availableSchemas = [];
    
    // Method 1: Use SchemaLoader's getAvailableSchemasList function (preferred)
    if (window.SchemaLoader && typeof window.SchemaLoader.getAvailableSchemasList === 'function') {
        availableSchemas = window.SchemaLoader.getAvailableSchemasList();
        // console.log("Got available schemas from SchemaLoader:", availableSchemas);
    } 
    // Method 2: Fallback to looking at loaded schemas
    else if (window.SchemaLoader && typeof window.SchemaLoader.getAll === 'function') {
        availableSchemas = Object.keys(window.SchemaLoader.getAll() || {});
        // console.log("Using loaded schemas as fallback:", availableSchemas);
    }
    // Method 3: Last resort - use schemas from gameData
    else if (gameData && gameData.databases) {
        availableSchemas = Object.keys(gameData.databases);
        // console.log("Using gameData schemas as last resort:", availableSchemas);
    }
    
    // If we still don't have any schemas, use a hardcoded list
    if (!availableSchemas || availableSchemas.length === 0) {
        console.warn("No schemas found, using hardcoded fallback list");
        availableSchemas = ["mission_control", "maps", "galaxy1"];
    }
    
    // console.log("Rendering database items for schemas:", availableSchemas);

    // Render each database item
    availableSchemas.forEach(dbAlias => {
        const dbItem = document.createElement('div');
        dbItem.className = 'db-item';
        dbItem.dataset.dbAlias = dbAlias;
        const level = accessLevels[dbAlias] || 1;
        const size = sizes[dbAlias] || '25MB';
        const description = descriptions[dbAlias] || 'Database with tables and records.';
        const isCurrentlyMounted = mountedDbAliases.has(dbAlias);
        const buttonText = isCurrentlyMounted ? "UNMOUNT" : "MOUNT";
        const buttonClass = isCurrentlyMounted ? "db-unmount-button" : "db-mount-button";
        
        dbItem.innerHTML = ` 
            <div class="db-item-header"> 
                <div class="db-item-name">${dbAlias}.db</div> 
                <div class="db-item-size">${size}</div> 
            </div> 
            <div class="db-item-description">${description}</div> 
            <div class="db-item-footer"> 
                <div class="db-access-level access-level-${level}">Level ${level}</div> 
                <button class="db-item-button ${buttonClass}" data-mounted="${isCurrentlyMounted}">${buttonText}</button> 
            </div> 
        `;
        
        if (isCurrentlyMounted) { 
            dbItem.style.boxShadow = "0 0 8px rgba(39, 215, 251, 0.4)"; // Highlight mounted
        } 
        
        itemsContainer.appendChild(dbItem);
        
        // Add hover sound to the newly created mount/unmount button
        const buttonEl = dbItem.querySelector('.db-item-button');
        if (buttonEl) {
            buttonEl.addEventListener('mouseenter', () => {
                try {
                    if (window.soundSettings && window.soundSettings.effectsEnabled) {
                        const tempHoverSound = new Audio('./audio/423167__plasterbrain__minimalist-sci-fi-ui-cancel.ogg');
                        // Use the same volume calculation as other buttons (0.15 * effects * master)
                        tempHoverSound.volume = 0.15 * window.soundSettings.effectsVolume * window.soundSettings.masterVolume;
                        tempHoverSound.play().catch(err => { 
                            console.error("DB button hover audio play failed:", err);
                        });
                        tempHoverSound.onended = () => { tempHoverSound.src = ''; };
                    }
                } catch (err) {
                    console.error("Error creating button hover sound:", err);
                }
            });
        }
        
        // console.log(`Rendered database item for: ${dbAlias}, mounted: ${isCurrentlyMounted}`);
    });
    
    updateActiveDbCount(mountedDbAliases.size);
}

function updateActiveDbCount(count) { 
    const maxDatabases = 5; 
    const countElement = document.getElementById('active-db-count');
    
    if (countElement) {
        countElement.textContent = `${count}/${maxDatabases}`; 
    }
    
    document.querySelectorAll('#db-browser-overlay .db-mount-button').forEach(btn => { 
        btn.disabled = (count >= maxDatabases); 
    }); 
}

function setupDatabaseBrowserEvents(mapCanvas, svgContainer) {
    const dbBrowser = document.getElementById('db-browser-overlay');
    const dbBackdrop = document.querySelector('.db-browser-backdrop');
    const dbClose = document.querySelector('#db-browser-overlay .db-browser-close');
    const itemsContainer = document.querySelector('#db-browser-overlay .db-browser-items');
    
    // Make sure the DB browser elements exist
    if (!dbBrowser || !dbBackdrop || !dbClose || !itemsContainer) {
        console.error("DB Browser elements not found in DOM. Registry functionality may be limited.");
    }
    
    // Function to play hover sound with diagnostic logging
    function playDbButtonHoverSound(buttonName) {
        // console.log(`Hover event triggered on ${buttonName || 'DB button'}`);
        
        try {
            if (window.soundSettings && window.soundSettings.effectsEnabled) {
                // console.log("Sound settings OK, preparing to play hover sound");
                const tempHoverSound = new Audio('./audio/423167__plasterbrain__minimalist-sci-fi-ui-cancel.ogg');
                tempHoverSound.volume = 0.15 * window.soundSettings.effectsVolume * window.soundSettings.masterVolume;
                
                // Log before playing
                // console.log(`Playing hover sound for ${buttonName}, volume: ${tempHoverSound.volume}`);
                
                // Play and handle errors properly
                tempHoverSound.play().then(() => {
                    // console.log("Hover sound played successfully");
                }).catch(err => {
                    console.error(`DB button hover sound failed: ${err.message}`);
                });
                
                // Cleanup
                tempHoverSound.addEventListener('ended', () => {
                    tempHoverSound.src = '';
                });
            } else {
                console.warn("Sound settings unavailable or effects disabled");
            }
        } catch (err) {
            console.error(`Error creating hover sound: ${err.message}`);
        }
    }
    
    // Make the hover sound function globally accessible
    window.playDbButtonHoverSound = playDbButtonHoverSound;
    
    // Attach click event to DB Registry button directly
    const dbHeaderButton = document.getElementById('open-db-browser-header-btn');
    if (dbHeaderButton) {
        // Remove any existing event listeners first to avoid duplicates
        const newButton = dbHeaderButton.cloneNode(true);
        if (dbHeaderButton.parentNode) {
            dbHeaderButton.parentNode.replaceChild(newButton, dbHeaderButton);
        }
        
        // Add hover sound manually
        newButton.addEventListener('mouseenter', () => {
            playDbButtonHoverSound('DB Registry header button');
        });
        
        // Add the click event listener to the fresh button
        newButton.addEventListener('click', () => {
            // console.log("DB Registry button clicked, showing browser overlay");
            renderDatabaseBrowserItems();
            if (dbBrowser) dbBrowser.style.display = 'flex';
            if (dbBackdrop) dbBackdrop.style.display = 'block';
        });
    } else {
        console.error("DB Registry button not found!");
    }
    
    // Close button handler
    if (dbClose) {
        dbClose.addEventListener('click', () => {
            dbBrowser.style.display = 'none';
            dbBackdrop.style.display = 'none';
        });
    }
    
    // Backdrop click handler
    if (dbBackdrop) {
        dbBackdrop.addEventListener('click', () => {
            dbBrowser.style.display = 'none';
            dbBackdrop.style.display = 'none';
        });
    }

    // Item mounting/unmounting using event delegation
    if (itemsContainer) {
        // Remove any existing click handlers to avoid duplicates
        const newItemsContainer = itemsContainer.cloneNode(true);
        itemsContainer.parentNode.replaceChild(newItemsContainer, itemsContainer);
        
        // Directly apply hover listeners to all mount/unmount buttons after rendering
        function applyHoverSoundsToButtons() {
            // console.log("Applying hover sounds to DB mount/unmount buttons");
            
            const buttons = newItemsContainer.querySelectorAll('.db-item-button');
            buttons.forEach((btn, index) => {
                // Remove any existing listeners
                const newBtn = btn.cloneNode(true);
                if (btn.parentNode) {
                    btn.parentNode.replaceChild(newBtn, btn);
                }
                
                // Add hover sound
                newBtn.addEventListener('mouseenter', () => {
                    const dbName = newBtn.closest('.db-item')?.dataset?.dbAlias || 'unknown';
                    const buttonType = newBtn.classList.contains('db-mount-button') ? 'mount' : 'unmount';
                    playDbButtonHoverSound(`${dbName} ${buttonType} button #${index}`);
                });
            });
            
            // console.log(`Applied hover sounds to ${buttons.length} DB buttons`);
        }
        
        // Call this after items are rendered
        setTimeout(applyHoverSoundsToButtons, 100);
        
        newItemsContainer.addEventListener('click', (event) => {
            if (!event.target.matches('.db-item-button')) return;
            
            const button = event.target;
            const dbItem = button.closest('.db-item');
            if (!dbItem) return;
            
            const dbAlias = dbItem.dataset.dbAlias;
            const isMounted = button.dataset.mounted === 'true';
            
            // console.log(`Button clicked for ${dbAlias}. Currently Mounted: ${isMounted}`);
            
            // Play button click sound
            try {
                const clickSound = new Audio('./audio/button-202966.ogg');
                let dbButtonVolume = 0.15;
                if (window.soundSettings) {
                    dbButtonVolume = 0.15 * window.soundSettings.effectsVolume * window.soundSettings.masterVolume;
                }
                clickSound.volume = dbButtonVolume;
                clickSound.play().catch(err => console.error("Button click audio play failed:", err));
            } catch (err) {
                console.error("Error creating button click sound:", err);
            }
            
            if (button.classList.contains('db-restricted-button')) {
                if (window.GameSystem) {
                    GameSystem.displayMessage("Access to this database requires special clearance.", "status-error", 3000);
                }
                return;
            }
            
            if (!isMounted) {
                // --- MOUNT DATABASE ---
                const maxDatabases = 5;
                if (mountedDbAliases.size >= maxDatabases) {
                    if (window.GameSystem) {
                        GameSystem.displayMessage(
                            `Cannot mount ${dbAlias}.db. Max limit (${maxDatabases}) reached.`,
                            "status-error",
                            4000
                        );
                    }
                    return;
                }
                
                if (mountDatabase(dbAlias)) {
                    // Update UI
                    button.textContent = "UNMOUNT";
                    button.classList.remove('db-mount-button');
                    button.classList.add('db-unmount-button');
                    button.dataset.mounted = 'true';
                    dbItem.style.boxShadow = "0 0 8px rgba(39, 215, 251, 0.4)";
                    
                    // Update schema visualization
                    generateVisualizerMetadata();
                    setupMap(mapCanvas, svgContainer);
                    
                    // Update active DB count
                    updateActiveDbCount(mountedDbAliases.size);
                    
                    if (window.GameSystem) {
                        GameSystem.hideMapPlaceholder();
                        GameSystem.displayMessage(
                            `Database ${dbAlias}.db mounted. Schema Map updated.`,
                            "status-success",
                            3000
                        );
                    }
                    
                    // Re-apply hover sounds after mounting
                    setTimeout(applyHoverSoundsToButtons, 100);
                    
                } else {
                    if (window.GameSystem) {
                        GameSystem.displayMessage(
                            `Failed to mount ${dbAlias}.db.`,
                            "status-error",
                            4000
                        );
                    }
                }
            } else {
                // --- UNMOUNT DATABASE ---
                if (unmountDatabase(dbAlias)) {
                    // Update UI
                    button.textContent = "MOUNT";
                    button.classList.remove('db-unmount-button');
                    button.classList.add('db-mount-button');
                    button.dataset.mounted = 'false';
                    dbItem.style.boxShadow = "none";
                    
                    // Update schema visualization
                    generateVisualizerMetadata();
                    setupMap(mapCanvas, svgContainer);
                    
                    // Update active DB count
                    updateActiveDbCount(mountedDbAliases.size);
                    
                    if (mountedDbAliases.size === 0 && window.GameSystem) {
                        GameSystem.showMapPlaceholder("No database mounted. Use DB REGISTRY.");
                    }
                    
                    // Handle mission reset if applicable
                    if (window.MissionSystem && 
                        MissionSystem.currentMissionData && 
                        MissionSystem.currentMissionData.dbAlias === dbAlias) {
                        if (typeof MissionSystem.reset === 'function') {
                            MissionSystem.reset();
                        }
                    }
                    
                    if (window.GameSystem) {
                        GameSystem.displayMessage(
                            `Database ${dbAlias}.db unmounted. Schema Map updated.`,
                            "status-success",
                            3000
                        );
                    }
                    
                    // Re-apply hover sounds after unmounting
                    setTimeout(applyHoverSoundsToButtons, 100);
                    
                } else {
                    if (window.GameSystem) {
                        GameSystem.displayMessage(
                            `Failed to unmount ${dbAlias}.db.`,
                            "status-error",
                            4000
                        );
                    }
                }
            }
        });
    }
    
    // Search functionality for database browser
    const searchInput = document.getElementById('db-search-input');
    const searchButton = document.getElementById('db-search-button');
    
    if (searchInput && searchButton) {
        const filterItems = () => {
            const searchTerm = searchInput.value.toLowerCase();
            newItemsContainer.querySelectorAll('.db-item').forEach(item => {
                const name = item.querySelector('.db-item-name').textContent.toLowerCase();
                const desc = item.querySelector('.db-item-description').textContent.toLowerCase();
                item.style.display = (name.includes(searchTerm) || desc.includes(searchTerm)) ? 'flex' : 'none';
            });
        };
        
        searchButton.addEventListener('click', filterItems);
        searchInput.addEventListener('keyup', filterItems);
        
        // Add hover sound to search button
        searchButton.addEventListener('mouseenter', () => {
            playDbButtonHoverSound('Search button');
        });
    }
}

// Extract country codes from SQL query results
function getCountryCodesFromSqlResults(sqlResult) {
    if (!sqlResult?.columns || !sqlResult?.rows?.length) { 
        // console.log("(Map) getCountryCodes: No columns or values found."); 
        return []; 
    }
    
    const originalColumns = sqlResult.columns;
    const lowerCaseColumns = originalColumns.map(c => c.toLowerCase());
    const resultRows = sqlResult.rows;
    const codes = new Set();
    
    // First try to find exact column matches for country codes
    const exactMatchPriority = ['iso3', 'country_code', 'code'];
    let codeIndex = -1;
    
    for (const priorityCol of exactMatchPriority) {
        codeIndex = lowerCaseColumns.indexOf(priorityCol);
        if (codeIndex !== -1) {
            // console.log(`(Map) Found exact code column: "${originalColumns[codeIndex]}"`);
            break;
        }
    }
    
    // If no exact match, try to find columns ending with known patterns
    const aliasPatterns = ['_iso3', '_country_code', '_code']; // Define the variable here
    if (codeIndex === -1) {
        for (let i = 0; i < lowerCaseColumns.length; i++) {
            const lcCol = lowerCaseColumns[i];
            for (const pattern of aliasPatterns) {
                if (lcCol.endsWith(pattern)) {
                    codeIndex = i;
                    // console.log(`(Map) Found code column by alias pattern ("${pattern}"): "${originalColumns[codeIndex]}"`);
                    break;
                }
            }
            if (codeIndex !== -1) break;
        }
    }
    
    // Extract country codes from the identified column
    if (codeIndex !== -1) {
        const colName = originalColumns[codeIndex];
        console.log(`(Map) Extracting codes from: "${colName}"`);
        
        resultRows.forEach(row => {
            const code = row[codeIndex];
            if (code && typeof code === 'string' && code.trim()) {
                codes.add(code.trim().toUpperCase());
            }
        });
        
        // console.log(`(Map) Extracted ${codes.size} country codes.`);
    } else {
        console.log(`(Map) No suitable code column found. Looked for [${exactMatchPriority.join(',')}] or ending with [${aliasPatterns.join(',')}]. Available columns: [${originalColumns.join(',')}]`);
    }
    
    return Array.from(codes);
}

// Export the database system functions
window.DatabaseEngine = {
    initialize: initializeDatabase,
    mount: mountDatabase,
    unmount: unmountDatabase,
    executeQuery: executeQuery,
    generateVisualizerMetadata: generateVisualizerMetadata,
    setupMap: setupMap,
    parseQueryForVis: parseQueryForVis,
    updateVisualization: updateVisualization,
    renderDatabaseBrowserItems: renderDatabaseBrowserItems,
    setupBrowserEvents: setupDatabaseBrowserEvents,
    getCountryCodesFromSqlResults: getCountryCodesFromSqlResults,
    get mountedDbAliases() { return mountedDbAliases; },
    get dbMetadataVis() { return dbMetadataVis; }
};