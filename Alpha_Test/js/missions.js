// Mission Management System
// This file handles all mission-related functionality for Pixel SQL Adventure

// Global state for missions
let currentMissionId = null; 
let currentMissionData = null;
let isMissionSolved = false;
let completedMissionIds = new Set();

// New: Track submissions within a mission
let currentSubmissionIndex = 0; 
let submissionsData = [];

// DOM elements cache
let missionTitle;
let missionDesc;
let missionDifficulty;
let hintToggler;
let hintContent;
let hintToggleIcon;
let completeMissionBtn;
let missionCompletePopup;
let resultsDiv;

// Initialize DOM element references
function initDomElements() {
    missionTitle = document.getElementById('mission-title');
    missionDesc = document.getElementById('mission-description');
    missionDifficulty = document.getElementById('mission-difficulty');
    hintToggler = document.getElementById('hint-toggler');
    hintContent = document.getElementById('hint-content');
    hintToggleIcon = document.getElementById('hint-toggle');
    completeMissionBtn = document.getElementById('complete-mission-btn');
    missionCompletePopup = document.getElementById('mission-complete');
    resultsDiv = document.getElementById('query-results');
}

// Mission system initialization
function initializeMissions() {
    console.log("Initializing mission system...");
    // Initialize DOM element references first
    initDomElements();
    
    currentMissionId = null;
    currentMissionData = null;
    isMissionSolved = false;
    completedMissionIds = new Set();
    currentSubmissionIndex = 0;
    submissionsData = [];
    resetMissionDisplay();
}

// Load mission details 
function loadMission(missionIdToLoad) {
    console.log(`Attempting to load mission ${missionIdToLoad}`);
    
    // Get gameData from the global GameSystem object
    const gameData = window.GameSystem ? window.GameSystem.gameData : null;
    if (!gameData) {
        console.error("GameSystem or gameData not available");
        return;
    }
    
    // Initialize missionDetails safely - check if the property exists before accessing it
    const missionDetails = gameData.missionDetails && gameData.missionDetails[missionIdToLoad] 
        ? gameData.missionDetails[missionIdToLoad] 
        : null;
    
    console.log(`Mission details from gameData:`, missionDetails ? "Found" : "Not found");
    
    // Try to get mission data from SchemaLoader first - check both mission_control and mainQuest
    let missionBaseData = null;
    let missionSource = null;
    
    if (window.SchemaLoader) {
        // Try to find mission in mission_control
        const missionControlSchema = SchemaLoader.get('mission_control');
        if (missionControlSchema && missionControlSchema.missions && Array.isArray(missionControlSchema.missions.data)) {
            missionBaseData = missionControlSchema.missions.data.find(m => m.id === missionIdToLoad);
            if (missionBaseData) {
                missionSource = 'mission_control';
                console.log(`Found mission ${missionIdToLoad} in mission_control database`);
            }
        }
        
        // If not found, try in mainQuest (check both 'missions' and 'quests' tables)
        if (!missionBaseData) {
            const mainQuestSchema = SchemaLoader.get('mainQuest');
            if (mainQuestSchema) {
                // Check 'missions' table first (if it exists)
                if (mainQuestSchema.missions && Array.isArray(mainQuestSchema.missions.data)) {
                    missionBaseData = mainQuestSchema.missions.data.find(m => m.id === missionIdToLoad);
                    if (missionBaseData) {
                        missionSource = 'mainQuest';
                        console.log(`Found mission ${missionIdToLoad} in mainQuest.missions table`);
                    }
                }
                
                // If still not found, check 'quests' table
                if (!missionBaseData && mainQuestSchema.quests && Array.isArray(mainQuestSchema.quests.data)) {
                    missionBaseData = mainQuestSchema.quests.data.find(m => m.id === missionIdToLoad);
                    if (missionBaseData) {
                        missionSource = 'mainQuest';
                        console.log(`Found mission ${missionIdToLoad} in mainQuest.quests table`);
                    }
                }
            }
        }
    }
    
    // Fallback to gameData if SchemaLoader didn't find it
    if (!missionBaseData) {
        if (gameData.databases && gameData.databases.mission_control && 
            gameData.databases.mission_control.missions && 
            Array.isArray(gameData.databases.mission_control.missions.data)) {
            
            missionBaseData = gameData.databases.mission_control.missions.data.find(m => m.id === missionIdToLoad);
            if (missionBaseData) {
                missionSource = 'mission_control';
            }
        }
    }
    
    if (!missionDetails && !missionBaseData) {
        // Use GameSystem.showError instead of direct showError call
        if (window.GameSystem && window.GameSystem.showError) {
            window.GameSystem.showError(`Mission data or details for ID ${missionIdToLoad} not found!`);
        } else {
            console.error(`Mission data or details for ID ${missionIdToLoad} not found!`);
        }
        
        resetMissionDisplay();
        return;
    }
    
    // DATA CONSISTENCY CHECK: This fixes the database alias mismatch for mission 1
    let requiredDbAlias = missionBaseData ? missionBaseData.dbAlias : null;
    
    // CRITICAL FIX: Ensure mission 1 uses mission_control database
    if (missionIdToLoad === 1) {
        console.log(`Ensuring mission 1 uses mission_control database (was: ${requiredDbAlias})`);
        requiredDbAlias = "mission_control";
    }
    
    // Only skip auto-mounting in specific cases where we want player to manually mount
    const skipAutoMount = (
        (missionIdToLoad === 2 && requiredDbAlias === 'galaxy1') ||
        (missionIdToLoad === 3 && requiredDbAlias === 'maps')
    );
    
    console.log(`Mission ${missionIdToLoad} DB mounting check:
        Required DB: ${requiredDbAlias}
        Already mounted: ${window.DatabaseEngine.mountedDbAliases.has(requiredDbAlias)}
        Skip auto-mount: ${skipAutoMount}
        Submissions count: ${missionBaseData.submissions ? missionBaseData.submissions.length : 0}
    `);
    
    // Function to check and mount required database if needed
    function checkRequiredDatabase(dbAlias) {
        // Important: Don't auto-mount if we want the player to manually mount the database
        if (!skipAutoMount && !window.DatabaseEngine.mountedDbAliases.has(dbAlias)) {
            console.log(`DB ${dbAlias} not mounted for mission task. Attempting auto-mount...`);
            // Use window.DatabaseEngine instead of direct call
            if (window.DatabaseEngine && typeof window.DatabaseEngine.mount === 'function') {
                if (!window.DatabaseEngine.mount(dbAlias)) {
                    // Use GameSystem.showError instead of direct showError call
                    if (window.GameSystem && window.GameSystem.showError) {
                        window.GameSystem.showError(`Mission ${missionIdToLoad} requires database "${dbAlias}" for its task. Mount failed. Try mounting manually.`);
                    } else {
                        console.error(`Mission ${missionIdToLoad} requires database "${dbAlias}" for its task. Mount failed. Try mounting manually.`);
                    }
                } else {
                    if (window.DatabaseEngine.generateVisualizerMetadata) window.DatabaseEngine.generateVisualizerMetadata();
                    if (window.DatabaseEngine.setupMap) window.DatabaseEngine.setupMap(document.getElementById('map-canvas'), document.getElementById('line-svg-container'));
                    if (window.GameSystem && window.GameSystem.hideMapPlaceholder) window.GameSystem.hideMapPlaceholder();
                    if (window.DatabaseEngine.renderDatabaseBrowserItems) window.DatabaseEngine.renderDatabaseBrowserItems();
                }
            } else {
                console.error("DatabaseEngine or mount function not available");
            }
        } else if (skipAutoMount) {
            console.log(`⭐ SKIPPING AUTO-MOUNT for mission ${missionIdToLoad}. Player needs to mount ${dbAlias} manually.`);
        } else {
            console.log(`Required task DB ${dbAlias} is already mounted.`);
            if (window.DatabaseEngine && window.DatabaseEngine.generateVisualizerMetadata) window.DatabaseEngine.generateVisualizerMetadata();
            if (window.DatabaseEngine && window.DatabaseEngine.setupMap) window.DatabaseEngine.setupMap(document.getElementById('map-canvas'), document.getElementById('line-svg-container'));
            if (window.GameSystem && window.GameSystem.hideMapPlaceholder) window.GameSystem.hideMapPlaceholder();
        }
    }
    
    // If we have mission data but no details, we can still show some information
    if (!missionDetails && missionBaseData) {
        console.log(`Mission ${missionIdToLoad} found in ${missionSource} but no details in gameData`);
        missionTitle.textContent = missionBaseData.title || `Mission ${missionIdToLoad}`;
        missionDesc.innerHTML = missionBaseData.description || "No detailed description available.";
        missionDifficulty.textContent = '★'.repeat(missionBaseData.difficulty || 0) + '☆'.repeat(5 - (missionBaseData.difficulty || 0));
        
        hintToggler.closest('.hint-section').style.display = 'block';
        hintContent.innerHTML = missionBaseData.hint || "No hint provided.";
        hintContent.style.display = 'none';
        hintToggleIcon.textContent = '+';
        
        const solutionSection = document.querySelector('.solution-section');
        const solutionContent = document.getElementById('solution-content');
        const solutionToggleIcon = document.getElementById('solution-toggle');
        
        if (solutionSection) solutionSection.style.display = 'block';
        if (missionBaseData.solution) {
            solutionContent.innerHTML = `<code>${missionBaseData.solution.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</code>`;
        } else {
            solutionContent.innerHTML = "No solution available.";
        }
        solutionContent.style.display = 'none';
        solutionToggleIcon.textContent = '+';
        
        currentMissionId = missionIdToLoad;
        currentMissionData = { ...missionBaseData };
        
        checkRequiredDatabase(requiredDbAlias);
        return;
    }
    
    // Log the detailed mission info for debugging
    console.log(`Mission ${missionIdToLoad} loaded from ${missionSource} database:`, {
        title: missionBaseData.title,
        originalDbAlias: missionBaseData.dbAlias
    });
    
    // Check required database
    checkRequiredDatabase(requiredDbAlias);
    
    currentMissionId = missionIdToLoad;
    
    // If it's a mainQuest mission, use all data from the database directly
    // This allows mainQuest missions to work without needing entries in gameData.missionDetails
    if (missionSource === 'mainQuest') {
        currentMissionData = {
            ...missionBaseData
        };
    } else {
        // For mission_control, combine both sources of mission data - safely with missionDetails
        currentMissionData = { 
            ...(missionDetails || {}),  // Only use missionDetails if it exists
            ...missionBaseData  // Ensure database values take precedence
        };
    }
    
    // Explicitly log the nextMissionId for debugging
    if (missionBaseData.nextMissionId !== undefined) {
        console.log(`Mission ${missionIdToLoad} has nextMissionId: ${missionBaseData.nextMissionId}`);
    }
    
    isMissionSolved = false;
    
    // Reset submission tracking when loading a new mission
    currentSubmissionIndex = 0;
    
    // Check if mission has submissions - load from the database schema
    if (missionBaseData.submissions && Array.isArray(missionBaseData.submissions)) {
        submissionsData = missionBaseData.submissions;
        console.log(`Mission ${missionIdToLoad} has ${submissionsData.length} submissions. Loading the first one.`);
        // Load the first submission
        loadSubmission(0);
    } else {
        submissionsData = [];
        console.log(`Mission ${missionIdToLoad} has no submissions, using regular mission display.`);
        
        // Check if this is the tutorial mission and trigger tutorial system
        if (currentMissionData.isTutorial && window.tutorialSystem && !window.tutorialSystem.isComplete) {
            window.tutorialSystem.startTutorial();
        }
        
        missionTitle.textContent = currentMissionData.title;
        missionDesc.innerHTML = currentMissionData.description;
        missionDifficulty.textContent = '★'.repeat(currentMissionData.difficulty) + '☆'.repeat(5 - currentMissionData.difficulty);
        
        hintToggler.closest('.hint-section').style.display = 'block';
        hintContent.innerHTML = currentMissionData.hint || "No hint provided.";
        hintContent.style.display = 'none';
        hintToggleIcon.textContent = '+';
        
        const solutionSection = document.querySelector('.solution-section');
        const solutionContent = document.getElementById('solution-content');
        const solutionToggleIcon = document.getElementById('solution-toggle');
        
        if (solutionSection) solutionSection.style.display = 'block';
        solutionContent.innerHTML = currentMissionData.solution ? 
            `<code>${currentMissionData.solution.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</code>` : 
            "No solution available.";
        solutionContent.style.display = 'none';
        solutionToggleIcon.textContent = '+';
    }
    
    completeMissionBtn.style.display = 'none';
    
    // Use GameSystem.clearResults instead of direct clearResults call
    if (window.GameSystem && window.GameSystem.clearResults) {
        window.GameSystem.clearResults();
    }
    
    // Refresh map mission markers to ensure they are up-to-date with the loaded mission
    if (window.MapIntegration && typeof window.MapIntegration.refreshMissionMarkers === 'function') {
        console.log("Refreshing map mission markers");
        window.MapIntegration.refreshMissionMarkers();
    }
    
    // Use GameSystem.displayMessage instead of direct displayMessage call
    if (window.GameSystem && window.GameSystem.displayMessage) {
        const messageText = skipAutoMount ? 
            `Mission ${currentMissionData.id} loaded. You need to mount the "${requiredDbAlias}" database to complete this mission.` :
            `Mission ${currentMissionData.id} loaded. Task requires database: ${requiredDbAlias}. Good luck!`;
        
        window.GameSystem.displayMessage(messageText, "status-success");
    } else {
        console.log(`Mission ${currentMissionData.id} loaded. Task requires database: ${requiredDbAlias}. Good luck!`);
    }
}

// New: Load a specific submission within a mission
function loadSubmission(submissionIndex) {
    if (!submissionsData || submissionIndex >= submissionsData.length) {
        console.log("No submissions data or index out of bounds");
        return;
    }

    const submission = submissionsData[submissionIndex];
    currentSubmissionIndex = submissionIndex;
    
    // Update the mission display with submission details
    if (submission.title) {
        missionTitle.textContent = submission.title;
    } else {
        missionTitle.textContent = currentMissionData.title + ` (Part ${submissionIndex + 1}/${submissionsData.length})`;
    }
    
    missionDesc.innerHTML = submission.description || currentMissionData.description;
    missionDifficulty.textContent = '★'.repeat(currentMissionData.difficulty) + '☆'.repeat(5 - currentMissionData.difficulty);
    
    // Update hint if available
    hintToggler.closest('.hint-section').style.display = 'block';
    hintContent.innerHTML = submission.hint || currentMissionData.hint || "No hint provided.";
    hintContent.style.display = 'none';
    hintToggleIcon.textContent = '+';
    
    // Update solution if available
    const solutionSection = document.querySelector('.solution-section');
    const solutionContent = document.getElementById('solution-content');
    const solutionToggleIcon = document.getElementById('solution-toggle');
    
    if (solutionSection) solutionSection.style.display = 'block';
    
    const solutionText = submission.solution || currentMissionData.solution;
    solutionContent.innerHTML = solutionText ? 
        `<code>${solutionText.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</code>` : 
        "No solution available.";
    solutionContent.style.display = 'none';
    solutionToggleIcon.textContent = '+';
    
    // Reset mission solved state
    isMissionSolved = false;
    completeMissionBtn.style.display = 'none';
    
    console.log(`Loaded submission ${submissionIndex} for mission ${currentMissionId}`);
}

// New: Move to the next submission in the current mission
function nextSubmission() {
    if (submissionsData.length === 0 || currentSubmissionIndex >= submissionsData.length - 1) {
        // No more submissions, complete the mission
        console.log("No more submissions, completing mission");
        completeMission();
        return;
    }
    
    // Move to the next submission
    currentSubmissionIndex++;
    loadSubmission(currentSubmissionIndex);
    
    // Show a message
    if (window.GameSystem && window.GameSystem.displayMessage) {
        window.GameSystem.displayMessage(`Great job! Moving to next step (${currentSubmissionIndex + 1}/${submissionsData.length})`, "status-success");
    }
}

// Validate if the query successfully completes the mission
function validateMissionQuery(query, results, criteria) {
    if (!criteria) {
        console.warn("No validation criteria for this mission.");
        return true;
    }
    
    // Check if we should validate against a specific submission
    let validationCriteria = criteria;
    if (submissionsData.length > 0 && currentSubmissionIndex < submissionsData.length) {
        validationCriteria = submissionsData[currentSubmissionIndex].validationCriteria || criteria;
    }
    
    // Special case for database mounting missions
    if (validationCriteria.databaseMounted) {
        const requiredDb = validationCriteria.requiredDatabase || '';
        if (window.DatabaseEngine && window.DatabaseEngine.mountedDbAliases) {
            const isMounted = window.DatabaseEngine.mountedDbAliases.has(requiredDb);
            console.log(`Database ${requiredDb} mount status: ${isMounted ? 'Mounted' : 'Not Mounted'}`);
            if (isMounted) {
                // If this is part of a multi-step submission, we'll show "Next Step" instead of "Complete Mission"
                if (submissionsData.length > 0 && currentSubmissionIndex < submissionsData.length - 1) {
                    completeMissionBtn.textContent = 'Next Step';
                } else {
                    completeMissionBtn.textContent = 'Complete Mission';
                }
                
                completeMissionBtn.style.display = 'block';
                isMissionSolved = true; // IMPORTANT: Mark mission as solved
                
                if (window.GameSystem && window.GameSystem.displayMessage) {
                    window.GameSystem.displayMessage("Database mounted successfully! Click 'Next Step' to continue.", "status-success");
                }
                return true;
            }
            return false;
        }
        return false;
    }
    
    if (!Array.isArray(results)) {
        console.log("Validation requires array results.");
        return false;
    }
    
    let isValid = true;
    const queryLower = query.toLowerCase();

    // SPECIAL CASE: For mission ID 1 and mission ID 0 (step 2) - we need to be more flexible with missions table rows
    // as the number could change when more missions are added
    const isMissionSelectQuery = (currentMissionId === 1 || 
        (currentMissionId === 0 && submissionsData.length > 0 && currentSubmissionIndex === 1)) && 
        queryLower.includes('select') && 
        queryLower.includes('from missions');

    if (isMissionSelectQuery) {
        console.log("Special case for missions table query: accepting any non-empty result set");
        // For mission 1, only check that we have results and the right columns, not the exact row count
        if (results.length === 0) {
            console.log("Validation Fail: No results returned");
            isValid = false;
        } else if (validationCriteria.mustContainColumns) {
            const firstRow = results[0];
            const resultColumnNames = Object.keys(firstRow);
            if (!validationCriteria.mustContainColumns.every(requiredCol => {
                const baseRequiredCol = requiredCol.split('.').pop();
                return resultColumnNames.some(resCol => resCol.toLowerCase() === baseRequiredCol.toLowerCase());
            })) {
                console.log(`Validation Fail: Missing required columns (or aliases). Need base columns like: ${validationCriteria.mustContainColumns.join(', ')}`);
                isValid = false;
            }
        }
        
        if (validationCriteria.keywords && !validationCriteria.keywords.every(kw => queryLower.includes(kw.toLowerCase()))) {
            console.log(`Validation Fail: Missing keywords: ${validationCriteria.keywords.join(', ')}`);
            isValid = false;
        }
    } else {
        // Regular mission validation with strict row count checking
        if (validationCriteria.expectedRows !== undefined && results.length !== validationCriteria.expectedRows) {
            console.log(`Validation Fail: Expected ${validationCriteria.expectedRows} rows, got ${results.length}`);
            isValid = false;
        }
        
        if (results.length > 0) {
            const firstRow = results[0];
            const resultColumnNames = Object.keys(firstRow);
            
            if (isValid && validationCriteria.mustContainColumns) {
                if (!validationCriteria.mustContainColumns.every(requiredCol => {
                    const baseRequiredCol = requiredCol.split('.').pop();
                    return resultColumnNames.some(resCol => resCol.toLowerCase() === baseRequiredCol.toLowerCase());
                })) {
                    console.log(`Validation Fail: Missing required columns (or aliases). Need base columns like: ${validationCriteria.mustContainColumns.join(', ')}`);
                    isValid = false;
                }
            }
            
            if (isValid && validationCriteria.filters) {
                for (const filter of validationCriteria.filters) {
                    if (!results.every(row => checkFilterCondition(row[filter.column], filter.operator, filter.value))) {
                        console.log(`Validation Fail: Filter: ${filter.column} ${filter.operator} ${filter.value}`);
                        isValid = false;
                        break;
                    }
                }
            }
            
            if (isValid && validationCriteria.ordered && validationCriteria.orderColumn) {
                const col = validationCriteria.orderColumn;
                const desc = validationCriteria.orderDirection === 'desc';
                if (!checkOrdering(results, col, desc)) {
                    console.log(`Validation Fail: Order by ${col} ${desc ? 'DESC' : 'ASC'}`);
                    isValid = false;
                }
            } else if (isValid && validationCriteria.ordered && validationCriteria.ordered.column) {
                // Legacy format support
                const col = validationCriteria.ordered.column;
                const desc = validationCriteria.ordered.direction === 'desc';
                if (!checkOrdering(results, col, desc)) {
                    console.log(`Validation Fail: Order by ${col} ${desc ? 'DESC' : 'ASC'}`);
                    isValid = false;
                }
            }
            
            if (isValid && validationCriteria.exactMatch) {
                if (!deepEqual(results, validationCriteria.exactMatch)) {
                    console.log(`Validation Fail: Exact match failed.`);
                    isValid = false;
                }
            }
        } else if (validationCriteria.expectedRows !== undefined && validationCriteria.expectedRows > 0) {
            console.log(`Validation Fail: Expected ${validationCriteria.expectedRows} rows, got 0`);
            isValid = false;
        }
    }
    
    if (isValid && validationCriteria.keywords) {
        if (!validationCriteria.keywords.every(kw => queryLower.includes(kw.toLowerCase()))) {
            console.log(`Validation Fail: Missing keywords: ${validationCriteria.keywords.join(', ')}`);
            isValid = false;
        }
    }
    
    console.log("Validation Result:", isValid);
    
    if (isValid) {
        // IMPORTANT: Mark mission as solved
        isMissionSolved = true;
        
        // If this is part of a multi-step submission, we'll show "Next Step" instead of "Complete Mission"
        if (submissionsData.length > 0 && currentSubmissionIndex < submissionsData.length - 1) {
            completeMissionBtn.textContent = 'Next Step';
        } else {
            completeMissionBtn.textContent = 'Complete Mission';
        }
        completeMissionBtn.style.display = 'block';
        
        // Add success message for SQL queries
        if (window.GameSystem && window.GameSystem.displayMessage) {
            window.GameSystem.displayMessage("Query successful! Click the button to continue.", "status-success");
        }
    }
    
    return isValid;
}

// Complete mission and award points
function completeMission() {
    if (!isMissionSolved || !currentMissionData) return;
    
    console.log(`Completing mission ${currentMissionId}`);
    const pointsEarned = currentMissionData.points || 0;
    
    // Play the mission completion sound with appropriate volume
    try {
        const missionCompleteSound = new Audio('./audio/mixkit-water-sci-fi-bleep-902.ogg');
        missionCompleteSound.volume = 0.15;
        if (window.soundSettings) {
            missionCompleteSound.volume = 0.15 * window.soundSettings.effectsVolume * window.soundSettings.masterVolume;
        }
        missionCompleteSound.play().catch(err => {
            console.error("Mission complete sound failed to play:", err);
        });
    } catch (err) {
        console.error("Error creating mission complete sound:", err);
    }
    
    // Update score
    if (window.GameSystem && typeof window.GameSystem.updateScore === 'function') {
        const currentScore = parseInt(document.getElementById('score').textContent) || 0;
        window.GameSystem.updateScore(currentScore + pointsEarned);
    }
    
    // Mark mission as completed
    completedMissionIds.add(currentMissionId);
    console.log("Completed Missions:", completedMissionIds);
    
    // Refresh map markers
    if (window.MapIntegration && typeof window.MapIntegration.refreshMissionMarkers === 'function') {
        console.log("Refreshing map mission markers after completing mission");
        window.MapIntegration.refreshMissionMarkers();
    }
    
    // Update mission table UI if visible
    try {
        const missionTable = resultsDiv.querySelector('table.missions-table');
        if (missionTable) {
            const completedRow = missionTable.querySelector(`tr[data-mission-id="${currentMissionId}"]`);
            if (completedRow) {
                completedRow.style.textDecoration = 'line-through';
                completedRow.style.color = '#888';
                completedRow.style.cursor = 'default';
                completedRow.onclick = null;
                console.log(`Styled mission row ${currentMissionId} as completed.`);
            } else {
                console.log(`Mission row ${currentMissionId} not found in the current results table.`);
            }
        } else {
            console.log("Mission table not currently displayed, skipping row style update.");
        }
    } catch (e) {
        console.error("Error updating completed mission row style:", e);
    }
    
    // Show completion popup
    missionCompletePopup.style.display = 'block';
    const descEl = missionCompletePopup.querySelector('.mission-complete-description');
    
    // Get appropriate success message
    let successMessage = currentMissionData.successMessage;
    if (submissionsData.length > 0 && currentSubmissionIndex < submissionsData.length) {
        successMessage = submissionsData[currentSubmissionIndex].successMessage || successMessage;
    }
    
    descEl.innerHTML = `${successMessage}<br><br><strong>+${pointsEarned} points earned!</strong>`;
    completeMissionBtn.style.display = 'none';
    isMissionSolved = false;
    
    // ROBUST AUTO-PROGRESSION SYSTEM
    console.log("Current mission data on completion:", currentMissionData);
    let nextMissionIdToLoad = null;
    
    // APPROACH 1: Special handling for tutorial progression
    if (currentMissionId === 0) {
        console.log("Tutorial mission completed (ID 0), hardcoding next mission to 1");
        nextMissionIdToLoad = 1;
    } 
    else if (currentMissionId === 1) {
        console.log("First query mission completed (ID 1), hardcoding next mission to 2");
        nextMissionIdToLoad = 2;
    }
    // For other missions, try different approaches to find next mission ID
    else {
        // APPROACH 2: Use nextMissionId directly from currentMissionData
        if (currentMissionData.nextMissionId !== undefined && 
            typeof currentMissionData.nextMissionId === 'number') {
            console.log(`Found nextMissionId ${currentMissionData.nextMissionId} directly in currentMissionData`);
            nextMissionIdToLoad = currentMissionData.nextMissionId;
        }
        
        // APPROACH 3: Look up mission in schema data
        if (nextMissionIdToLoad === null && window.SchemaLoader && window.SchemaLoader.getAll) {
            try {
                const allSchemas = window.SchemaLoader.getAll();
                if (allSchemas && allSchemas.mission_control && 
                    allSchemas.mission_control.missions && 
                    Array.isArray(allSchemas.mission_control.missions.data)) {
                    
                    const missionData = allSchemas.mission_control.missions.data.find(
                        m => m.id === currentMissionId
                    );
                    
                    if (missionData && missionData.nextMissionId !== undefined) {
                        console.log(`Found nextMissionId ${missionData.nextMissionId} in schema data`);
                        nextMissionIdToLoad = missionData.nextMissionId;
                    }
                }
            } catch (e) {
                console.error("Error accessing schema data:", e);
            }
        }
        
        // APPROACH 4: Sequential progression as fallback
        if (nextMissionIdToLoad === null) {
            const nextSequentialId = currentMissionId + 1;
            
            // Check if the next sequential mission exists in SchemaLoader
            if (window.SchemaLoader && window.SchemaLoader.getAll) {
                try {
                    const allSchemas = window.SchemaLoader.getAll();
                    if (allSchemas && allSchemas.mission_control && 
                        allSchemas.mission_control.missions && 
                        Array.isArray(allSchemas.mission_control.missions.data)) {
                        
                        const nextMissionExists = allSchemas.mission_control.missions.data.some(
                            m => m.id === nextSequentialId
                        );
                        
                        if (nextMissionExists) {
                            console.log(`Using sequential progression: ${currentMissionId} -> ${nextSequentialId}`);
                            nextMissionIdToLoad = nextSequentialId;
                        }
                    }
                } catch (e) {
                    console.error("Error checking for sequential mission:", e);
                }
            }
        }
    }
    
    // Add debug logging to help diagnose issues
    console.log(`Mission progression determination: From mission ${currentMissionId} -> ${nextMissionIdToLoad}`);
    
    // Proceed with next mission if determined and not already completed
    if (nextMissionIdToLoad !== null && !completedMissionIds.has(nextMissionIdToLoad)) {
        // Add a note about the next mission
        descEl.innerHTML += `<br><br><em>Next mission will load automatically... (Mission ${nextMissionIdToLoad})</em>`;
        
        console.log(`Auto-progressing to mission ${nextMissionIdToLoad} after 3 seconds...`);
        
        // Set a timeout to load the next mission
        setTimeout(() => {
            // Make sure we first hide the mission complete popup before loading the next mission
            missionCompletePopup.style.display = 'none';
            if (window.MapIntegration) {
                MapIntegration.hide();
            }
            
            // Now load the next mission
            console.log(`Loading next mission ${nextMissionIdToLoad}...`);
            loadMission(nextMissionIdToLoad);
        }, 3000);
    } else {
        if (nextMissionIdToLoad !== null && completedMissionIds.has(nextMissionIdToLoad)) {
            console.log(`Next mission ${nextMissionIdToLoad} is already completed.`);
            
            // Try to find another not-completed mission as a fallback
            if (window.SchemaLoader && window.SchemaLoader.getAll) {
                try {
                    const allSchemas = window.SchemaLoader.getAll();
                    if (allSchemas && allSchemas.mission_control && 
                        allSchemas.mission_control.missions && 
                        Array.isArray(allSchemas.mission_control.missions.data)) {
                        
                        // Find first non-completed mission
                        const availableMission = allSchemas.mission_control.missions.data.find(
                            m => !completedMissionIds.has(m.id)
                        );
                        
                        if (availableMission) {
                            console.log(`Found alternative non-completed mission ${availableMission.id}`);
                            
                            descEl.innerHTML += `<br><br><em>Loading alternative mission... (Mission ${availableMission.id})</em>`;
                            
                            setTimeout(() => {
                                missionCompletePopup.style.display = 'none';
                                if (window.MapIntegration) {
                                    MapIntegration.hide();
                                }
                                loadMission(availableMission.id);
                            }, 3000);
                            
                            return;
                        }
                    }
                } catch (e) {
                    console.error("Error finding alternative mission:", e);
                }
            }
        } else if (nextMissionIdToLoad === null) {
            console.log("No next mission found to auto-progress to.");
        }
        
        // If no valid next mission, just reset the display
        setTimeout(() => {
            nextMission();
        }, 3000);
    }
}

// Complete current submission or mission
function completeCurrentStep() {
    if (!isMissionSolved) return;
    
    // If we have more submissions, go to the next one
    if (submissionsData.length > 0 && currentSubmissionIndex < submissionsData.length - 1) {
        nextSubmission();
    } else {
        // Otherwise complete the mission
        completeMission();
    }
}

// Move to next mission after completion
function nextMission() {
    missionCompletePopup.style.display = 'none';
    if (window.MapIntegration) {
        MapIntegration.hide(); // Ensure map overlay is hidden
    }
    
    // Get gameData from the global GameSystem object
    const gameData = window.GameSystem ? window.GameSystem.gameData : null;
    if (!gameData) {
        console.error("GameSystem or gameData not available in nextMission");
        return;
    }
    
    const totalMissions = gameData.databases.mission_control?.missions?.data?.length || 0;
    if (totalMissions > 0 && completedMissionIds.size === totalMissions) {
        missionTitle.textContent = "All Missions Complete!";
        
        // Get current score from the DOM instead of using direct variable
        const currentScore = parseInt(document.getElementById('score').textContent) || 0;
        missionDesc.innerHTML = `Congratulations, SQL Commander! You've mastered all available missions.<br><br><strong>Final Score: ${currentScore}</strong>`;
        
        missionDifficulty.textContent = "🏆";
        hintToggler.closest('.hint-section').style.display = 'none';
        document.querySelector('.solution-section').style.display = 'none';
        
        // Use GameSystem.clearResults instead of direct call
        if (window.GameSystem && window.GameSystem.clearResults) {
            window.GameSystem.clearResults();
        }
        
        // Use DatabaseEngine.updateVisualization instead of direct call
        if (window.DatabaseEngine && window.DatabaseEngine.updateVisualization) {
            window.DatabaseEngine.updateVisualization(null, document.getElementById('map-canvas'), document.getElementById('line-svg-container'));
        }
        
        currentMissionId = null;
        currentMissionData = null;
        
        // Use GameSystem.displayMessage instead of direct call
        if (window.GameSystem && window.GameSystem.displayMessage) {
            window.GameSystem.displayMessage("You finished all missions!", "status-success");
        }
        
        console.log("All missions completed!");
    } else {
        resetMissionDisplay();
        
        // Use GameSystem.displayMessage instead of direct call
        if (window.GameSystem && window.GameSystem.displayMessage) {
            window.GameSystem.displayMessage("Mission complete! Query `missions` again to choose your next task.", "status-success", 4000);
        }
    }
}

// Reset mission display to default state
function resetMissionDisplay() {
    if (window.MapIntegration) {
        MapIntegration.hide(); // Ensure map overlay is hidden
    }
    
    // IMPORTANT: Reset mission state
    isMissionSolved = false;
    completeMissionBtn.style.display = 'none';
    
    // Try to load the first mission from schema data first
    let firstMissionData = null;
    
    if (window.SchemaLoader && window.SchemaLoader.get) {
        const missionControlSchema = window.SchemaLoader.get('mission_control');
        if (missionControlSchema && 
            missionControlSchema.missions && 
            Array.isArray(missionControlSchema.missions.data) && 
            missionControlSchema.missions.data.length > 0) {
            
            // Find mission with id 0 (the tutorial mission)
            firstMissionData = missionControlSchema.missions.data.find(m => m.id === 0);
            
            // If not found, just use the first mission in the array
            if (!firstMissionData) {
                firstMissionData = missionControlSchema.missions.data[0];
            }
        }
    }
    
    // If we found mission data from SchemaLoader, use it
    if (firstMissionData) {
        missionTitle.textContent = firstMissionData.title || "Tutorial: Mount Database";
        missionDesc.innerHTML = firstMissionData.description || "Mount the database to begin.";
        missionDifficulty.textContent = '★'.repeat(firstMissionData.difficulty || 1) + '☆'.repeat(5 - (firstMissionData.difficulty || 1));
        
        hintToggler.closest('.hint-section').style.display = 'block';
        hintContent.innerHTML = firstMissionData.hint || "No hint provided.";
        hintContent.style.display = 'none';
        hintToggleIcon.textContent = '+';
        
        const solutionSection = document.querySelector('.solution-section');
        if (solutionSection) solutionSection.style.display = 'block';
        
        const solutionContent = document.getElementById('solution-content');
        solutionContent.innerHTML = firstMissionData.solution ? 
            `<code>${firstMissionData.solution.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</code>` : 
            "No solution available.";
        solutionContent.style.display = 'none';
        document.getElementById('solution-toggle').textContent = '+';
        
        // Set the current mission to the first one, but don't trigger a full load
        currentMissionId = firstMissionData.id;
        currentMissionData = firstMissionData;
        
        // Check if the mission's database is mounted, and if so, show the complete button
        if (firstMissionData.validationCriteria && firstMissionData.validationCriteria.databaseMounted) {
            const requiredDb = firstMissionData.validationCriteria.requiredDatabase || '';
            if (window.DatabaseEngine && window.DatabaseEngine.mountedDbAliases) {
                const isMounted = window.DatabaseEngine.mountedDbAliases.has(requiredDb);
                if (isMounted) {
                    isMissionSolved = true;
                    completeMissionBtn.style.display = 'block';
                    if (window.GameSystem && window.GameSystem.displayMessage) {
                        window.GameSystem.displayMessage("Database mounted successfully! Click 'Complete Mission' to continue.", "status-success");
                    }
                } else {
                    isMissionSolved = false;
                    completeMissionBtn.style.display = 'none';
                }
            }
        }
    } else {
        // Fallback to the original default text
        missionTitle.textContent = "No Mission Loaded";
        missionDesc.innerHTML = "Mount the <code class='pixel-inline-code'>mission_control</code> database from the <strong>DB REGISTRY</strong>. Then query <code class='pixel-inline-code'>SELECT * FROM missions;</code> and click a mission row to load it.";
        missionDifficulty.textContent = "☆☆☆☆☆";
        
        hintToggler.closest('.hint-section').style.display = 'none';
        document.querySelector('.solution-section').style.display = 'none';
        document.getElementById('hint-content').style.display = 'none';
        document.getElementById('solution-content').style.display = 'none';
        document.getElementById('hint-toggle').textContent = '+';
        document.getElementById('solution-toggle').textContent = '+';
        
        currentMissionId = null;
        currentMissionData = null;
        isMissionSolved = false;
        completeMissionBtn.style.display = 'none';
    }
}

// Toggle hint visibility
function toggleHint() {
    const isHidden = hintContent.style.display === 'none';
    hintContent.style.display = isHidden ? 'block' : 'none';
    hintToggleIcon.textContent = isHidden ? '-' : '+';
}

// Toggle solution visibility
function toggleSolution() {
    const solutionContent = document.getElementById('solution-content');
    const solutionToggleIcon = document.getElementById('solution-toggle');
    const isHidden = solutionContent.style.display === 'none';
    solutionContent.style.display = isHidden ? 'block' : 'none';
    solutionToggleIcon.textContent = isHidden ? '-' : '+';
}

// Helper functions for mission validation
function checkFilterCondition(value, operator, criteriaValue) {
    if (value === null || value === undefined) return false;
    
    switch(operator) {
        case '>': return value > criteriaValue;
        case '>=': return value >= criteriaValue;
        case '<': return value < criteriaValue;
        case '<=': return value <= criteriaValue;
        case '=': return value == criteriaValue;
        case '!=': return value != criteriaValue;
        default: 
            console.warn(`Unsupported filter operator: ${operator}`);
            return false;
    }
}

// Check if results are ordered correctly
function checkOrdering(results, column, descending = false) {
    for (let i = 1; i < results.length; i++) {
        const prev = results[i - 1][column];
        const current = results[i][column];
        
        if (prev === null || current === null) continue;
        
        if (descending) {
            if (prev < current) return false;
        } else {
            if (prev > current) return false;
        }
    }
    return true;
}

// Deep comparison helper
function deepEqual(obj1, obj2) {
    return JSON.stringify(obj1) === JSON.stringify(obj2);
}

// Export mission system functions
window.MissionSystem = {
    initialize: initializeMissions,
    load: loadMission,
    validate: validateMissionQuery,
    complete: completeCurrentStep, // Changed to handle both submissions and missions
    next: nextMission,
    reset: resetMissionDisplay,
    toggleHint: toggleHint,
    toggleSolution: toggleSolution,
    get currentMissionId() { return currentMissionId; },
    get currentMissionData() { return currentMissionData; },
    get isMissionSolved() { return isMissionSolved; },
    set isMissionSolved(value) { isMissionSolved = value; },
    get completedMissionIds() { return completedMissionIds; },
    get currentSubmissionIndex() { return currentSubmissionIndex; },
    get submissionsData() { return submissionsData; }
};