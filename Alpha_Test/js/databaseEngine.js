// Database Engine for SQL Adventure Game
// This file handles all database operations including SQL execution, mounting/unmounting databases,
// database visualization and schema map rendering

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
            console.log(`Table ${tableName} created for DB ${dbAlias}.`); 
        } 
        
        mountedDbAliases.add(dbAlias);
        console.log(`Successfully mounted ${dbAlias}. Mounted Set:`, mountedDbAliases);
        
        // Show map button if maps database is mounted
        if (dbAlias === 'maps') {
            const openMapBtn = document.getElementById('open-map-header-btn');
            if (openMapBtn) {
                console.log("Maps database mounted, showing interactive map button");
                openMapBtn.style.display = 'block';
            }
        }
        
        // Check if this database mount completes a mission
        if (window.MissionSystem && 
            window.MissionSystem.currentMissionId !== null && 
            window.MissionSystem.currentMissionData) {
            
            const mission = window.MissionSystem.currentMissionData;
            const criteria = mission.validationCriteria;
            
            // If this is a database mounting mission and the required database was mounted
            if (criteria && criteria.databaseMounted && criteria.requiredDatabase === dbAlias) {
                console.log(`Database ${dbAlias} mounted - this completes the current mission!`);
                window.MissionSystem.isMissionSolved = true;
                
                // Show the complete mission button
                const completeMissionBtn = document.getElementById('complete-mission-btn');
                if (completeMissionBtn) {
                    completeMissionBtn.style.display = 'block';
                }
                
                // Display success message
                if (window.GameSystem && window.GameSystem.displayMessage) {
                    window.GameSystem.displayMessage(
                        "Database mounted successfully! Click 'Complete Mission' to continue.", 
                        "status-success"
                    );
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
        console.log(`Unmounting database: ${dbAlias}`);
        const schemaToUse = dbData || gameData.databases[dbAlias];
        
        for (const tableName in schemaToUse) { 
            alasql(`DROP TABLE IF EXISTS ${tableName};`); 
            console.log(`Table ${tableName} dropped (if existed) for DB ${dbAlias}.`); 
        } 
        mountedDbAliases.delete(dbAlias); 
        console.log(`Successfully processed unmount for ${dbAlias}. Mounted Set:`, mountedDbAliases); 
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
    if (!alasqlInitialized || mountedDbAliases.size === 0) { 
        if (window.GameSystem) {
            GameSystem.showError("No database mounted. Please mount a database from the DB Registry.");
        }
        return null; 
    }
    
    console.log("Executing SQL Query:", query);
    try {
        const results = alasql(query);
        console.log("AlaSQL Result:", results);
        return results;
    } catch (e) {
        console.error("SQL Error:", e);
        
        // Play the error sound when SQL query fails
        try {
            // Use the pre-loaded error sound from the window object if available
            if (window.errorSound) {
                const sound = window.errorSound.cloneNode();
                sound.volume = 0.5; // Increase volume to make sure it's audible
                sound.play().catch(err => {
                    console.error("SQL error sound failed to play:", err);
                });
            } else {
                // Fallback to creating a new Audio object
                const errorSound = new Audio('./audio/619803__teh_bucket__error-fizzle.ogg');
                errorSound.volume = 0.5;
                errorSound.play().catch(err => { 
                    console.error("SQL error sound failed to play:", err);
                });
            }
        } catch (err) {
            console.error("Error creating SQL error sound:", err);
        }
        
        if (window.GameSystem) {
            if (e.message.toLowerCase().includes("table does not exist")) { 
                GameSystem.showError(`SQL Error: ${e.message}. Is the correct database mounted?`);
            } else {
                GameSystem.showError(`SQL Error: ${e.message}`);
            }
        }
        
        return null;
    }
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
    
    console.log("Generated Combined Schema Metadata:", combinedMetadata); 
    dbMetadataVis = combinedMetadata; 
}

function setupMap(mapCanvas, svgContainer) { 
    console.log("setupMap (Schema) called."); 
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
    console.log("Parsing query for schema visualization:", query); 
    const qLower = query.toLowerCase(); 
    const tableAliases = {}; 
    const info = { selectColumns: new Set(), tablesInvolved: [], joinConditions: [], aliases: tableAliases }; 
    const cleanQuery = query.replace(/`/g, ''); 
    const cleanQLower = cleanQuery.toLowerCase(); 
    const selectMatch = cleanQuery.match(/SELECT\s+(.*?)\s+FROM/i); 
    
    if (selectMatch && selectMatch[1]) { 
        const colsString = selectMatch[1].trim(); 
        if (colsString === '*') { 
            info.selectColumns.add('*'); 
        } else { 
            colsString.split(',').forEach(c => { 
                let colPart = c.trim().split(/\s+as\s+/i)[0].trim(); 
                const funcMatch = colPart.match(/\w+\(([\w.*]+)\)/i); 
                if (funcMatch && funcMatch[1] !== '*') { 
                    info.selectColumns.add(funcMatch[1]); 
                } else if (!funcMatch) { 
                    info.selectColumns.add(colPart); 
                } 
                info.selectColumns.add(c.trim()); 
            }); 
        } 
    } else { 
        console.warn("VisParser: Could not find SELECT/FROM structure."); 
        return null; 
    } 
    
    const fromJoinPartMatch = cleanQLower.match(/from\s+([\s\S]*?)(?:where|group by|order by|limit|$)/); 
    if (fromJoinPartMatch && fromJoinPartMatch[1]) { 
        let fromJoinString = fromJoinPartMatch[1].trim(); 
        const firstTableRegex = /^(\w+)(?:\s+(?:as\s+)?(\w+))?/; 
        const firstTableMatch = fromJoinString.match(firstTableRegex); 
        
        if (firstTableMatch) { 
            const fromTable = firstTableMatch[1]; 
            const alias = firstTableMatch[2]; 
            if (dbMetadataVis.tables && dbMetadataVis.tables[fromTable]) { 
                info.tablesInvolved.push(fromTable); 
                if (alias) { 
                    tableAliases[alias] = fromTable; 
                } else { 
                    tableAliases[fromTable] = fromTable; 
                } 
                fromJoinString = fromJoinString.substring(firstTableMatch[0].length).trim(); 
            } else { 
                console.warn(`VisParser: FROM table "${fromTable}" not in metadata (not mounted or invalid).`); 
                return info; 
            } 
        } else { 
            console.warn("VisParser: Could not parse FROM table."); 
            return info; 
        } 
        
        const joinRegex = /(?:inner\s+|left\s+|right\s+)?join\s+(\w+)(?:\s+(?:as\s+)?(\w+))?\s+on\s+([\w.]+)\s*=\s*([\w.]+)/gi; 
        let joinMatch; 
        
        while ((joinMatch = joinRegex.exec(fromJoinString)) !== null) { 
            const joinTable = joinMatch[1]; 
            const alias = joinMatch[2]; 
            const conditionLeft = joinMatch[3]; 
            const conditionRight = joinMatch[4]; 
            
            if (dbMetadataVis.tables && dbMetadataVis.tables[joinTable]) { 
                if (!info.tablesInvolved.includes(joinTable)) { 
                    info.tablesInvolved.push(joinTable); 
                } 
                
                if (alias) { 
                    tableAliases[alias] = joinTable; 
                } else { 
                    tableAliases[joinTable] = joinTable; 
                } 
                
                const resolveAlias = (colIdentifier) => { 
                    if (colIdentifier.includes('.')) { 
                        const [prefix, colName] = colIdentifier.split('.'); 
                        const realTable = tableAliases[prefix]; 
                        if (realTable) { 
                            return `${realTable}.${colName}`; 
                        } 
                        if (dbMetadataVis.tables && dbMetadataVis.tables[prefix]) { 
                            return colIdentifier; 
                        } 
                        console.warn(`VisParser: Cannot resolve prefix "${prefix}" in JOIN.`); 
                        return null; 
                    } 
                    console.warn(`VisParser: Ambiguous column "${colIdentifier}" in JOIN.`); 
                    return null; 
                }; 
                
                const resolvedLeft = resolveAlias(conditionLeft); 
                const resolvedRight = resolveAlias(conditionRight); 
                
                if (resolvedLeft && resolvedRight) { 
                    info.joinConditions.push({ from: resolvedLeft, to: resolvedRight }); 
                    info.selectColumns.add(resolvedLeft); 
                    info.selectColumns.add(resolvedRight); 
                } else { 
                    console.warn(`VisParser: Failed to resolve JOIN: ${conditionLeft}=${conditionRight}`); 
                } 
            } else { 
                console.warn(`VisParser: Unknown JOIN table "${joinTable}" (not mounted or invalid).`); 
            } 
        } 
    } else { 
        console.warn("VisParser: Could not parse FROM/JOIN clause."); 
        return info; 
    } 
    
    info.tablesInvolved = [...new Set(info.tablesInvolved)]; 
    console.log("Parsed Info for Schema Vis:", info); 
    return info; 
}

function updateVisualization(parsedInfo, mapCanvas, svgContainer) { 
    console.log("updateVisualization (Schema) called with:", parsedInfo); 
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
        console.log("Resetting schema visualization (invalid info or no tables)."); 
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
        let el = null; 
        const colId = colIdRaw.replace(/`/g, '').split(/\s+as\s+/i)[0].trim(); 
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
                        const colEl = document.getElementById(`vis-col-${tableName}-${colName.replace(/`/g, '')}`); 
                        if (colEl) colEl.classList.add('highlight-column'); 
                    }); 
                } 
            }); 
        } else { 
            const colEl = findColElement(colIdentifier); 
            if (colEl) colEl.classList.add('highlight-column'); 
        } 
    }); 
    
    if (parsedInfo.joinConditions.length > 0) { 
        console.log("Drawing join lines..."); 
        setTimeout(() => { 
            if (!svgContainer) return; 
            svgContainer.querySelectorAll('line.join-line-vis').forEach(el => el.remove()); 
            parsedInfo.joinConditions.forEach(cond => { 
                console.log(`Attempting to draw line for: ${cond.from} = ${cond.to}`); 
                drawSimpleJoinLine(cond.from, cond.to, mapCanvas, svgContainer); 
            }); 
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
    if (!svgContainer) return; 
    const cleanFrom = fromColFullId.replace(/`/g, ''); 
    const cleanTo = toColFullId.replace(/`/g, ''); 
    if (!cleanFrom.includes('.') || !cleanTo.includes('.')) return; 
    const [fromTable, ] = cleanFrom.split('.'); 
    const [toTable, ] = cleanTo.split('.'); 
    const fromTableElId = `vis-table-${fromTable}`; 
    const toTableElId = `vis-table-${toTable}`; 
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
        console.log(`Simple line drawn for ${fromColFullId} -> ${toColFullId}`); 
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
    if (!svgContainer || !lastParsedInfoVis || !lastParsedInfoVis.joinConditions) return; 
    svgContainer.querySelectorAll('line.join-line-vis').forEach(el => el.remove()); 
    setTimeout(() => { 
        lastParsedInfoVis.joinConditions.forEach(cond => { 
            drawSimpleJoinLine(cond.from, cond.to, mapCanvas, svgContainer); 
        }); 
    }, 0); 
}

// Database browser interface functions
function renderDatabaseBrowserItems() {
    const gameData = window.GameSystem ? window.GameSystem.gameData : null;
    if (!gameData) {
        console.error("Game data not available for rendering DB browser");
        return;
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
        mainQuest: "Main storyline missions and alien investigation data."
    };
    const sizes = { 
        mission_control: "5MB", 
        maps: "50MB",
        galaxy1: "50MB",
        mainQuest: "100MB"
    };
    const accessLevels = { 
        mission_control: 1, 
        maps: 1,
        galaxy1: 1,
        mainQuest: 2
    };

    // Defined order for database display - updated to include mainQuest
    const dbOrder = ['mission_control', 'maps', 'galaxy1', 'mainQuest'];
    
    console.log("Rendering database browser items. Available schemas:", dbOrder);
    console.log("Currently mounted databases:", [...mountedDbAliases]);

    // First, make sure we have schemas for all databases either from SchemaLoader or gameData
    const availableSchemas = new Set();
    
    // Check SchemaLoader first
    if (window.SchemaLoader && typeof window.SchemaLoader.getAll === 'function') {
        const schemaLoaderDbs = Object.keys(window.SchemaLoader.getAll() || {});
        schemaLoaderDbs.forEach(db => availableSchemas.add(db));
    }
    
    // Also check gameData as fallback
    if (gameData && gameData.databases) {
        Object.keys(gameData.databases).forEach(db => availableSchemas.add(db));
    }
    
    console.log("Available schemas for rendering:", [...availableSchemas]);

    dbOrder.forEach(dbAlias => {
        // Check if this database exists in either SchemaLoader or gameData
        if (availableSchemas.has(dbAlias)) {
            const dbItem = document.createElement('div');
            dbItem.className = 'db-item';
            dbItem.dataset.dbAlias = dbAlias;
            const level = accessLevels[dbAlias] || 1;
            const size = sizes[dbAlias] || 'N/A';
            const description = descriptions[dbAlias] || 'No description available.';
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
            
            console.log(`Rendered database item for: ${dbAlias}, mounted: ${isCurrentlyMounted}`);
        } else {
            console.warn(`Skipping database ${dbAlias} - not found in available schemas`);
        }
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
    
    // Attach click event to DB Registry button directly
    const dbHeaderButton = document.getElementById('open-db-browser-header-btn');
    if (dbHeaderButton) {
        // Remove any existing event listeners first to avoid duplicates
        const newButton = dbHeaderButton.cloneNode(true);
        if (dbHeaderButton.parentNode) {
            dbHeaderButton.parentNode.replaceChild(newButton, dbHeaderButton);
        }
        
        // Add the event listener to the fresh button
        newButton.addEventListener('click', () => {
            console.log("DB Registry button clicked, showing browser overlay");
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
        
        newItemsContainer.addEventListener('click', (event) => {
            if (!event.target.matches('.db-item-button')) return;
            
            const button = event.target;
            const dbItem = button.closest('.db-item');
            if (!dbItem) return;
            
            const dbAlias = dbItem.dataset.dbAlias;
            const isMounted = button.dataset.mounted === 'true';
            
            console.log(`Button clicked for ${dbAlias}. Currently Mounted: ${isMounted}`);
            
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
    }
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
    get mountedDbAliases() { return mountedDbAliases; },
    get dbMetadataVis() { return dbMetadataVis; }
};