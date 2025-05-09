// Mission Management System
// This file handles all mission-related functionality for Pixel SQL Adventure

// Global state for missions
let currentMissionId = null; 
let currentMissionData = null;
let isMissionSolved = false;
let completedMissionIds = new Set();

// New: Flag to prevent multiple completions of the same mission
let isCompletionInProgress = false;

// New: Flag to prevent button reappearance after being pressed
let buttonHasBeenPressed = false;

// New: Mission transition logging
let missionTransitionLog = [];
const MAX_LOG_ENTRIES = 20;

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
// New: Answer form elements
let missionAnswerForm;
let missionAnswerInput;
let submitAnswerBtn;
let answerFeedback;
// New: Error sound for incorrect answers
let incorrectAnswerSound;

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
    
    // Initialize new answer form elements
    missionAnswerForm = document.getElementById('mission-answer-form');
    missionAnswerInput = document.getElementById('mission-answer-input');
    submitAnswerBtn = document.getElementById('submit-answer-btn');
    answerFeedback = document.getElementById('answer-feedback');
    
    // Initialize error sound - either through pool manager or directly
    if (window.AudioPoolManager) {
        // Use AudioPoolManager - the actual sound will be retrieved when needed
        window.AudioPoolManager.initPool('incorrectAnswer', './audio/619803__teh_bucket__error-fizzle.ogg', 3);
    } else {
        incorrectAnswerSound = new Audio('./audio/619803__teh_bucket__error-fizzle.ogg');
    }
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
    buttonHasBeenPressed = false;
    
    // BUTTON VISIBILITY DEBUG: Log initial button state
    console.log("Mission button initial state:", {
        element: completeMissionBtn ? "Found" : "Not found",
        display: completeMissionBtn ? completeMissionBtn.style.display : "N/A",
        visibility: completeMissionBtn ? window.getComputedStyle(completeMissionBtn).visibility : "N/A",
        classList: completeMissionBtn ? Array.from(completeMissionBtn.classList) : "N/A"
    });
    
    // Ensure the button is always visible but disabled by default
    if (completeMissionBtn) {
        completeMissionBtn.classList.remove('mission-solved');
        completeMissionBtn.style.display = 'block';
        completeMissionBtn.style.visibility = 'visible';
        completeMissionBtn.disabled = true; // Set disabled attribute
        
        // BUTTON VISIBILITY DEBUG: Log button state after our changes
        console.log("Mission button after init changes:", {
            display: completeMissionBtn.style.display,
            visibility: completeMissionBtn.style.visibility,
            disabled: completeMissionBtn.disabled
        });
    } else {
        console.error("Complete Mission button not found during initialization!");
    }
    
    // Set up event listeners for the answer form
    if (submitAnswerBtn) {
        submitAnswerBtn.addEventListener('click', checkMissionAnswer);
        
        // Also allow pressing Enter to submit answer
        if (missionAnswerInput) {
            missionAnswerInput.addEventListener('keypress', function(event) {
                if (event.key === 'Enter') {
                    event.preventDefault();
                    checkMissionAnswer();
                }
            });
        }
    }
    
    resetMissionDisplay();
    
    // Force visibility with a short delay to ensure it appears even after any other scripts run
    setTimeout(ensureButtonVisibility, 500);
    // Also set a longer interval to periodically check and restore button visibility
    setInterval(ensureButtonVisibility, 2000);
}

// New function to ensure button visibility
function ensureButtonVisibility() {
    if (completeMissionBtn) {
        // Only restore visibility if button hasn't been pressed for this mission
        if (!buttonHasBeenPressed) {
            if (completeMissionBtn.style.display === 'none') {
                console.warn("Mission button was hidden! Restoring visibility...");
                completeMissionBtn.style.display = 'block';
            }
            if (window.getComputedStyle(completeMissionBtn).visibility !== 'visible') {
                console.warn("Mission button visibility issue detected! Forcing visibility...");
                completeMissionBtn.style.visibility = 'visible';
            }
            
            // Keep the button disabled or enabled based on mission solved state
            completeMissionBtn.disabled = !isMissionSolved;
        }
    }
}

// Load mission details 
function loadMission(missionIdToLoad) {
    console.log(`Attempting to load mission ${missionIdToLoad}`);
    
    // CRITICAL: Reset mission state when loading a new mission to prevent carryover
    isMissionSolved = false;
    buttonHasBeenPressed = false; // Reset the button pressed state for new mission
    completeMissionBtn.classList.remove('mission-solved');
    completeMissionBtn.disabled = true;
    
    // Reset answer form
    if (missionAnswerForm) {
        missionAnswerForm.style.display = 'none';
        missionAnswerInput.value = '';
        answerFeedback.textContent = '';
        answerFeedback.className = 'answer-feedback';
    }
    
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
    
    // Check if this is a map-based mission that should only be accessible via the map
    // If so, verify that it was activated through the map interface
    if (missionBaseData && missionBaseData.mapDetails && missionBaseData.mapDetails.showOnMap === true) {
        // Check if this mission was activated from the map
        const activatedFromMap = window.MissionSystem && 
                                window.MissionSystem.mapActivatedMissions && 
                                window.MissionSystem.mapActivatedMissions.has(missionIdToLoad);
        
        if (!activatedFromMap) {
            console.log(`Mission ${missionIdToLoad} is a map-based mission that can only be accessed through the map`);
            
            // Show an error message to the user
            if (window.GameSystem && window.GameSystem.showError) {
                window.GameSystem.showError(`Mission ${missionIdToLoad} can only be accessed through the interactive map. 
                    Please use the map interface to find and activate this mission.`);
            }
            
            // Reset mission display and exit the function
            resetMissionDisplay();
            return;
        }
        
        // Clear the mission from the activated missions list to enforce using the map again next time
        if (window.MissionSystem.mapActivatedMissions) {
            window.MissionSystem.mapActivatedMissions.delete(missionIdToLoad);
        }
        
        console.log(`Map-based mission ${missionIdToLoad} was properly activated from the map interface`);
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
        (missionIdToLoad === 0) || 
        (missionIdToLoad === 2 && (requiredDbAlias === 'galaxy1' || requiredDbAlias === 'deep_space_catalog')) ||
        (missionIdToLoad === 7 && requiredDbAlias === 'maps') ||
        (missionIdToLoad === 3 && requiredDbAlias === 'maps')
    );
    
    console.log(`Mission ${missionIdToLoad} DB mounting check:
        Required DB: ${requiredDbAlias}
        Already mounted: ${window.DatabaseEngine.mountedDbAliases.has(requiredDbAlias)}
        Skip auto-mount: ${skipAutoMount}
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
        
        // Check if this is a question-based mission and show the answer form if needed
        if (missionBaseData.validationCriteria && 
            missionBaseData.validationCriteria.answerToQuestion && 
            missionAnswerForm) {
            missionAnswerForm.style.display = 'block';
            console.log("Showing answer form for question-based mission");
        }
        
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
    
    completeMissionBtn.style.display = 'none';
    
    // Check if this mission uses the answer form (question-based) or SQL validation
    if (currentMissionData.validationCriteria && 
        currentMissionData.validationCriteria.answerToQuestion && 
        missionAnswerForm) {
        // This is a question-based mission, show the answer form
        missionAnswerForm.style.display = 'block';
        console.log("Showing answer form for question-based mission");
    } else {
        // This is a SQL-based mission, hide the answer form
        if (missionAnswerForm) {
            missionAnswerForm.style.display = 'none';
        }
    }
    
    // Use GameSystem.clearResults instead of direct clearResults call
    if (window.GameSystem && window.GameSystem.clearResults) {
        window.GameSystem.clearResults();
    }
    
    // Refresh map mission markers to ensure they are up-to-date with the loaded mission
    if (window.MapIntegration && typeof window.MapIntegration.refreshMissionMarkers === 'function') {
        console.log("Refreshing map mission markers");
        window.MapIntegration.refreshMissionMarkers();
    }
    
    // SPECIAL FIX FOR MISSION 1: Check if missions table data is already available in the results area
    // This allows users to complete the mission if they already ran the query before
    if (missionIdToLoad === 1 && window.lastResults && Array.isArray(window.lastResults) && window.lastResults.length > 0) {
        console.log("Checking if mission 1 can be auto-validated from previous query results");
        const lastResults = window.lastResults;
        
        // Check if results look like missions data
        if (lastResults[0] && lastResults[0].id !== undefined && lastResults[0].title !== undefined) {
            console.log("Found existing missions table results, auto-validating mission 1");
            isMissionSolved = true;
            completeMissionBtn.textContent = 'Complete Mission';
            completeMissionBtn.classList.add('mission-solved');
            completeMissionBtn.style.display = 'block';
            completeMissionBtn.disabled = false;
            
            if (window.GameSystem && window.GameSystem.displayMessage) {
                window.GameSystem.displayMessage("Mission criteria already met! Click 'Complete Mission' to continue.", "status-success");
            }
        }
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

// Validate if the query successfully completes the mission
function validateMissionQuery(query, results, criteria) {
    if (!criteria) {
        console.warn("No validation criteria for this mission.");
        return true;
    }
    
    // Don't auto-validate through standard SQL for question-based missions
    if (criteria.answerToQuestion !== undefined) {
        console.log("This is a question-based mission, must use the answer form.");
        if (window.GameSystem && window.GameSystem.displayMessage) {
            window.GameSystem.displayMessage("This mission requires an answer. Please use the answer form below.", "status-info");
        }
        return false;
    }
    
    // Special case for database mounting missions
    if (criteria.databaseMounted) {
        const requiredDb = criteria.requiredDatabase || '';
        if (window.DatabaseEngine && window.DatabaseEngine.mountedDbAliases) {
            const isMounted = window.DatabaseEngine.mountedDbAliases.has(requiredDb);
            console.log(`Database ${requiredDb} mount status: ${isMounted ? 'Mounted' : 'Not Mounted'}`);
            if (isMounted) {
                completeMissionBtn.textContent = 'Complete Mission';
                completeMissionBtn.style.display = 'block';
                isMissionSolved = true; // IMPORTANT: Mark mission as solved
                
                if (window.GameSystem && window.GameSystem.displayMessage) {
                    window.GameSystem.displayMessage("Database mounted successfully! Click 'Complete Mission' to continue.", "status-success");
                }
                return true;
            }
            return false;
        }
        return false;
    }
    
    // SPECIAL CASE FOR MISSION 1: Allow completion even if results array is from a previous query
    // or not currently shown in the results table
    if (currentMissionId === 1) {
        const queryLower = query.toLowerCase();
        
        // If this is a fresh execution of the missions query, process normally
        if (queryLower.includes('select') && queryLower.includes('from missions')) {
            console.log("Mission 1: Valid SELECT FROM missions query detected");
            
            // Check if we have valid results
            if (Array.isArray(results) && results.length > 0) {
                console.log("Mission 1: Query returned results, validating mission");
                isMissionSolved = true;
                completeMissionBtn.textContent = 'Complete Mission';
                completeMissionBtn.classList.add('mission-solved');
                completeMissionBtn.style.display = 'block';
                completeMissionBtn.disabled = false;
                
                if (window.GameSystem && window.GameSystem.displayMessage) {
                    window.GameSystem.displayMessage("Query successful! Click 'Complete Mission' to continue.", "status-success");
                }
                return true;
            }
        }
        
        // If no results or not the right query but we're on mission 1, check window.lastResults
        if (window.lastResults && Array.isArray(window.lastResults) && window.lastResults.length > 0) {
            // Check if lastResults looks like mission data
            if (window.lastResults[0] && window.lastResults[0].id !== undefined && window.lastResults[0].title !== undefined) {
                console.log("Mission 1: Found existing missions data in lastResults, validating mission");
                isMissionSolved = true;
                completeMissionBtn.textContent = 'Complete Mission';
                completeMissionBtn.classList.add('mission-solved');
                completeMissionBtn.style.display = 'block';
                completeMissionBtn.disabled = false;
                
                if (window.GameSystem && window.GameSystem.displayMessage) {
                    window.GameSystem.displayMessage("Previous query returned missions data! Click 'Complete Mission' to continue.", "status-success");
                }
                return true;
            }
        }
        
        // Final check - look at the current results table
        const missionTable = resultsDiv ? resultsDiv.querySelector('table.missions-table') : null;
        if (missionTable) {
            console.log("Mission 1: Found missions table in results, validating mission");
            isMissionSolved = true;
            completeMissionBtn.textContent = 'Complete Mission';
            completeMissionBtn.classList.add('mission-solved');
            completeMissionBtn.style.display = 'block';
            completeMissionBtn.disabled = false;
            
            if (window.GameSystem && window.GameSystem.displayMessage) {
                window.GameSystem.displayMessage("Missions data is displayed! Click 'Complete Mission' to continue.", "status-success");
            }
            return true;
        }
        
        // If we're still here, let's try a more direct approach - add a special button for Mission 1
        console.log("Mission 1: Adding special completion option");
        if (window.GameSystem && window.GameSystem.displayMessage) {
            window.GameSystem.displayMessage("Run 'SELECT * FROM missions;' or click 'Complete Mission' to continue.", "status-info");
        }
        
        // Just enable the button for this tutorial mission to avoid frustration
        isMissionSolved = true;
        completeMissionBtn.textContent = 'Complete Mission';
        completeMissionBtn.classList.add('mission-solved');
        completeMissionBtn.style.display = 'block';
        completeMissionBtn.disabled = false;
        
        return true;
    }
    
    if (!Array.isArray(results)) {
        console.log("Validation requires array results.");
        return false;
    }
    
    let isValid = true;
    const queryLower = query.toLowerCase();

    // SPECIAL CASE: For mission ID 8 (which also deals with mission data) - we need to be flexible with missions table rows
    // as the number could change when more missions are added
    const isMissionSelectQuery = currentMissionId === 8 && 
        queryLower.includes('select') && 
        queryLower.includes('from missions');

    if (isMissionSelectQuery) {
        console.log("Special case for missions table query: accepting any non-empty result set");
        // For mission 8, only check that we have results and the right columns, not the exact row count
        if (results.length === 0) {
            console.log("Validation Fail: No results returned");
            isValid = false;
        } else if (criteria.mustContainColumns) {
            const firstRow = results[0];
            const resultColumnNames = Object.keys(firstRow);
            if (!criteria.mustContainColumns.every(requiredCol => {
                const baseRequiredCol = requiredCol.split('.').pop();
                return resultColumnNames.some(resCol => resCol.toLowerCase() === baseRequiredCol.toLowerCase());
            })) {
                console.log(`Validation Fail: Missing required columns (or aliases). Need base columns like: ${criteria.mustContainColumns.join(', ')}`);
                isValid = false;
            }
        }
        
        if (criteria.keywords && !criteria.keywords.every(kw => queryLower.includes(kw.toLowerCase()))) {
            console.log(`Validation Fail: Missing keywords: ${criteria.keywords.join(', ')}`);
            isValid = false;
        }
    } else {
        // Regular mission validation with strict row count checking
        if (criteria.expectedRows !== undefined && results.length !== criteria.expectedRows) {
            console.log(`Validation Fail: Expected ${criteria.expectedRows} rows, got ${results.length}`);
            isValid = false;
        }
        
        if (results.length > 0) {
            const firstRow = results[0];
            const resultColumnNames = Object.keys(firstRow);
            
            if (isValid && criteria.mustContainColumns) {
                if (!criteria.mustContainColumns.every(requiredCol => {
                    const baseRequiredCol = requiredCol.split('.').pop();
                    return resultColumnNames.some(resCol => resCol.toLowerCase() === baseRequiredCol.toLowerCase());
                })) {
                    console.log(`Validation Fail: Missing required columns (or aliases). Need base columns like: ${criteria.mustContainColumns.join(', ')}`);
                    isValid = false;
                }
            }
            
            if (isValid && criteria.filters) {
                for (const filter of criteria.filters) {
                    if (!results.every(row => checkFilterCondition(row[filter.column], filter.operator, filter.value))) {
                        console.log(`Validation Fail: Filter: ${filter.column} ${filter.operator} ${filter.value}`);
                        isValid = false;
                        break;
                    }
                }
            }
            
            if (isValid && criteria.ordered && criteria.orderColumn) {
                const col = criteria.orderColumn;
                const desc = criteria.orderDirection === 'desc';
                if (!checkOrdering(results, col, desc)) {
                    console.log(`Validation Fail: Order by ${col} ${desc ? 'DESC' : 'ASC'}`);
                    isValid = false;
                }
            } else if (isValid && criteria.ordered && criteria.ordered.column) {
                // Legacy format support
                const col = criteria.ordered.column;
                const desc = criteria.ordered.direction === 'desc';
                if (!checkOrdering(results, col, desc)) {
                    console.log(`Validation Fail: Order by ${col} ${desc ? 'DESC' : 'ASC'}`);
                    isValid = false;
                }
            }
            
            if (isValid && criteria.exactMatch) {
                if (!deepEqual(results, criteria.exactMatch)) {
                    console.log(`Validation Fail: Exact match failed.`);
                    isValid = false;
                }
            }
        } else if (criteria.expectedRows !== undefined && criteria.expectedRows > 0) {
            console.log(`Validation Fail: Expected ${criteria.expectedRows} rows, got 0`);
            isValid = false;
        }
    }
    
    if (isValid && criteria.keywords) {
        if (!criteria.keywords.every(kw => queryLower.includes(kw.toLowerCase()))) {
            console.log(`Validation Fail: Missing keywords: ${criteria.keywords.join(', ')}`);
            isValid = false;
        }
    }
    
    console.log("Validation Result:", isValid);
    
    if (isValid) {
        // IMPORTANT: Mark mission as solved
        isMissionSolved = true;
        completeMissionBtn.textContent = 'Complete Mission';
        completeMissionBtn.classList.add('mission-solved');
        completeMissionBtn.style.display = 'block';
        completeMissionBtn.disabled = false;
        
        // Add success message for SQL queries
        if (window.GameSystem && window.GameSystem.displayMessage) {
            window.GameSystem.displayMessage("Query successful! Click 'Complete Mission' to continue.", "status-success");
        }
    } else {
        completeMissionBtn.classList.remove('mission-solved');
    }
    
    return isValid;
}

// Complete current mission
function completeCurrentStep() {
    // Prevent multiple clicks if mission isn't solved
    if (!isMissionSolved) {
        console.log("Complete button clicked, but mission is not yet solved");
        return;
    }
    
    // IMMEDIATE BUTTON HANDLING:
    // 1. Log the mission transition
    const previousMission = currentMissionId;
    logMissionTransition('button_click', previousMission);

    // 2. Store mission solved state locally to prevent race conditions
    const wasMissionSolved = isMissionSolved;
    
    // 3. Hide the button completely and mark as pressed
    completeMissionBtn.style.display = 'none';
    buttonHasBeenPressed = true;
    
    // Complete the mission
    completeMission();
    
    // Now it's safe to set mission as not solved for future validations
    // This happens after completeMission has executed
    isMissionSolved = false;
}

// Complete mission and award points
function completeMission() {
    // Multiple safeguards to prevent exploitation
    if (!isMissionSolved || !currentMissionData || isCompletionInProgress) {
        console.log(`Mission completion prevented - solved: ${isMissionSolved}, data exists: ${!!currentMissionData}, in progress: ${isCompletionInProgress}`);
        return;
    }
    
    // Set flag to prevent multiple completions
    isCompletionInProgress = true;
    
    console.log(`Completing mission ${currentMissionId}`);
    const pointsEarned = currentMissionData.points || 0;
    
    // Log the mission completion for debugging
    logMissionTransition('mission_complete', currentMissionId);
    
    // Play the mission completion sound using the audio pool
    try {
        if (window.AudioPoolManager) {
            window.AudioPoolManager.playSound('missionComplete', './audio/mixkit-water-sci-fi-bleep-902.ogg', 0.15);
        } else {
            // Fallback to traditional method if AudioPoolManager isn't available
            const missionCompleteSound = new Audio('./audio/mixkit-water-sci-fi-bleep-902.ogg');
            missionCompleteSound.volume = 0.15;
            if (window.soundSettings) {
                missionCompleteSound.volume = 0.15 * window.soundSettings.effectsVolume * window.soundSettings.masterVolume;
            }
            missionCompleteSound.play().catch(err => {
                console.error("Mission complete sound failed to play:", err);
            });
        }
    } catch (err) {
        console.error("Error playing mission complete sound:", err);
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
    
    // Get success message
    let successMessage = currentMissionData.successMessage || "Mission completed successfully!";
    
    descEl.innerHTML = `${successMessage}<br><br><strong>+${pointsEarned} points earned!</strong>`;
    completeMissionBtn.style.display = 'none';
    isMissionSolved = false;
    
    // IMPORTANT: Reset the completion-in-progress flag to prevent multiple rewards exploit
    isCompletionInProgress = false;
    // Reset button state for next mission
    completeMissionBtn.disabled = false;
    completeMissionBtn.style.opacity = "1";
    completeMissionBtn.style.cursor = "pointer";
    completeMissionBtn.textContent = "Complete Mission";
    
    // ROBUST NEXT MISSION DETECTION - we now store this for the next mission button
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
    
    // Store the next mission ID in a data attribute on the Next Mission button
    const nextMissionBtn = document.getElementById('next-mission-btn');
    if (nextMissionBtn) {
        nextMissionBtn.dataset.nextMissionId = nextMissionIdToLoad || '';
        
        // Update the button text to indicate what's next
        if (nextMissionIdToLoad !== null) {
            // Add a note about the next mission
            nextMissionBtn.textContent = `Next Mission (${nextMissionIdToLoad})`;
        } else {
            nextMissionBtn.textContent = "Continue";
        }
    }
}

// Move to next mission after completion
function nextMission() {
    missionCompletePopup.style.display = 'none';
    if (window.MapIntegration) {
        MapIntegration.hide(); // Ensure map overlay is hidden
    }
    
    // Get the next mission ID from the button's data attribute
    const nextMissionBtn = document.getElementById('next-mission-btn');
    const nextMissionIdToLoad = nextMissionBtn && nextMissionBtn.dataset.nextMissionId ? 
        parseInt(nextMissionBtn.dataset.nextMissionId, 10) : null;
    
    // If we have a valid next mission ID, load it
    if (nextMissionIdToLoad !== null && !isNaN(nextMissionIdToLoad)) {
        console.log(`Loading next mission ${nextMissionIdToLoad}...`);
        loadMission(nextMissionIdToLoad);
        return;
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
    buttonHasBeenPressed = false; // Reset the button pressed state
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
                    console.log(`Database ${requiredDb} is already mounted - enabling Complete Mission button`);
                    isMissionSolved = true;
                    completeMissionBtn.style.display = 'block';
                    completeMissionBtn.disabled = false;
                    completeMissionBtn.classList.add('mission-solved');
                    
                    if (window.GameSystem && window.GameSystem.displayMessage) {
                        window.GameSystem.displayMessage("Database mounted successfully! Click 'Complete Mission' to continue.", "status-success");
                    }
                } else {
                    isMissionSolved = false;
                    completeMissionBtn.style.display = 'block';
                    completeMissionBtn.disabled = true;
                    completeMissionBtn.classList.remove('mission-solved');
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

// Log mission transitions to help debug any issues with mission progression
function logMissionTransition(trigger, previousMissionId) {
    const timestamp = new Date().toISOString();
    const entry = {
        timestamp,
        trigger,
        from: {
            missionId: previousMissionId
        },
        to: {
            missionId: currentMissionId
        },
        isMissionSolved: isMissionSolved
    };
    
    // Add to our transition log
    missionTransitionLog.push(entry);
    
    // Trim the log if it gets too large
    if (missionTransitionLog.length > MAX_LOG_ENTRIES) {
        missionTransitionLog.shift();
    }
    
    // Output to console for easier debugging
    console.log(`MISSION TRANSITION [${trigger}]: Mission ${previousMissionId} → Mission ${currentMissionId}`);
    console.log(`Mission solved state: ${isMissionSolved}`);
}

// Check the answer provided for question-based missions
function checkMissionAnswer() {
    if (!currentMissionData || !currentMissionData.validationCriteria) {
        console.error("No current mission or validation criteria available");
        return;
    }
    
    // Get the expected answer from validationCriteria
    const expectedAnswer = currentMissionData.validationCriteria.answerToQuestion;
    if (!expectedAnswer) {
        console.error("No expected answer defined for this mission");
        return;
    }
    
    // Get the user's answer and normalize for comparison
    const userAnswer = missionAnswerInput.value.trim();
    
    // Check if the answer is correct (case-insensitive)
    if (userAnswer.toLowerCase() === expectedAnswer.toLowerCase()) {
        // Answer is correct!
        answerFeedback.textContent = "Correct! Well done!";
        answerFeedback.className = "answer-feedback success";
        
        // Mark mission as solved
        isMissionSolved = true;
        
        // Show the complete mission button
        completeMissionBtn.classList.add('mission-solved');
        completeMissionBtn.style.display = 'block';
        completeMissionBtn.disabled = false;
        
        // Add success message
        if (window.GameSystem && window.GameSystem.displayMessage) {
            window.GameSystem.displayMessage("Correct answer! Click 'Complete Mission' to continue.", "status-success");
        }
    } else {
        // Answer is incorrect
        answerFeedback.textContent = "Incorrect. Please try again.";
        answerFeedback.className = "answer-feedback error";
        
        // Play error sound
        playIncorrectSound();
        
        // Clear the input for another attempt
        missionAnswerInput.value = "";
        
        // Add error message
        if (window.GameSystem && window.GameSystem.displayMessage) {
            window.GameSystem.displayMessage("Incorrect answer. Please try again.", "status-error");
        }
    }
}

// Play sound for incorrect answers
function playIncorrectSound() {
    try {
        if (window.AudioPoolManager) {
            // Use the audio pool to play the sound
            window.AudioPoolManager.playSound('incorrectAnswer', './audio/619803__teh_bucket__error-fizzle.ogg', 0.2);
        } else {
            // Fallback to traditional method
            // Set appropriate volume
            incorrectAnswerSound.volume = 0.2;
            if (window.soundSettings) {
                incorrectAnswerSound.volume = 0.2 * window.soundSettings.effectsVolume * window.soundSettings.masterVolume;
            }
            
            // Play the sound
            incorrectAnswerSound.currentTime = 0; // Restart the sound if it's already playing
            incorrectAnswerSound.play().catch(err => {
                console.error("Error sound failed to play:", err);
            });
        }
    } catch (err) {
        console.error("Error playing incorrect answer sound:", err);
    }
}

// Export mission system functions
window.MissionSystem = {
    initialize: initializeMissions,
    load: loadMission,
    validate: validateMissionQuery,
    complete: completeCurrentStep,
    next: nextMission,
    reset: resetMissionDisplay,
    toggleHint: toggleHint,
    toggleSolution: toggleSolution,
    
    // Add the missing checkSolution function that connects SQL execution to mission validation
    checkSolution: function(query, results) {
        console.log("MissionSystem.checkSolution called with query:", query);
        if (currentMissionId === null || !currentMissionData) {
            console.log("No active mission to validate");
            return false;
        }
        
        const criteria = currentMissionData.validationCriteria;
        if (!criteria) {
            console.log("No validation criteria for current mission");
            return false;
        }
        
        // Call the existing validateMissionQuery function with our query and results
        const isValid = validateMissionQuery(query, results, criteria);
        console.log(`Mission ${currentMissionId} validation result:`, isValid);
        
        // Update the Complete Mission button if the query is valid
        if (isValid) {
            isMissionSolved = true;
            completeMissionBtn.disabled = false;
            completeMissionBtn.classList.add('mission-solved');
            completeMissionBtn.style.display = 'block';
        }
        
        return isValid;
    },
    
    get currentMissionId() { return currentMissionId; },
    get currentMissionData() { return currentMissionData; },
    get isMissionSolved() { return isMissionSolved; },
    set isMissionSolved(value) { isMissionSolved = value; },
    get completedMissionIds() { return completedMissionIds; }
};