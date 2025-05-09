/**
 * Graph Visualization Module
 * Provides functionality for visualizing SQL query results with different chart types
 */

// Initialize the Graph Module when the document is ready
document.addEventListener('DOMContentLoaded', () => {
    console.log("DOM Content Loaded - Initializing Graph Module");
    initializeGraphModule();
});

/**
 * Main initialization function for the Graph Module
 */
function initializeGraphModule() {
    console.log("Graph Module initialization started");
    
    // DOM Elements
    const graphToggleBtn = document.getElementById('toggle-graph-btn');
    const graphContainer = document.getElementById('graph-container');
    const mapCanvas = document.getElementById('map-canvas');
    const chartTypeButtons = document.querySelectorAll('.chart-type-btn');
    const noDataMessage = document.getElementById('no-data-message');
    
    console.log("Graph elements:", {
        toggleBtn: graphToggleBtn ? "Found" : "Not Found",
        container: graphContainer ? "Found" : "Not Found",
        mapCanvas: mapCanvas ? "Found" : "Not Found"
    });
    
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
    
    // Make sure we have default initial display styles
    if (mapCanvas) mapCanvas.style.display = 'block';
    if (graphContainer) graphContainer.style.display = 'none';
    
    // Graph toggle button click handler
    if (graphToggleBtn) {
        console.log("Setting up graph toggle button click handler");
        
        // Remove any existing event listeners to prevent duplicates
        const newBtn = graphToggleBtn.cloneNode(true);
        graphToggleBtn.parentNode.replaceChild(newBtn, graphToggleBtn);
        
        // Add event listener to the fresh button
        newBtn.addEventListener('click', function() {
            console.log("Graph toggle button clicked");
            
            // Ensure we have references to the necessary elements
            const mapCanvas = document.getElementById('map-canvas');
            const graphContainer = document.getElementById('graph-container');
            
            if (!mapCanvas || !graphContainer) {
                console.error("Required elements not found:", {
                    mapCanvas: mapCanvas ? "Found" : "Not Found",
                    graphContainer: graphContainer ? "Found" : "Not Found"
                });
                return;
            }
            
            // Toggle between schema and graph views
            if (mapCanvas.style.display !== 'none') {
                console.log("Switching to graph view");
                // Switch to graph view
                mapCanvas.style.display = 'none';
                graphContainer.style.display = 'flex';
                newBtn.textContent = 'SCHEMA';
                newBtn.classList.add('active');
                
                // Try to visualize data if we have results
                if (window.lastResults) {
                    console.log("Visualizing last results");
                    visualizeData(window.lastResults);
                } else {
                    console.log("No results to visualize");
                }
            } else {
                console.log("Switching to schema view");
                // Switch back to schema view
                mapCanvas.style.display = 'block';
                graphContainer.style.display = 'none';
                newBtn.textContent = 'GRAPH';
                newBtn.classList.remove('active');
            }
            
            // Play click sound
            playClickSound();
        });
        
        // Add the button hover sound effect
        newBtn.addEventListener('mouseenter', function() {
            try {
                if (window.soundSettings && window.soundSettings.effectsEnabled) {
                    const hoverSound = new Audio('./audio/423167__plasterbrain__minimalist-sci-fi-ui-cancel.ogg');
                    hoverSound.volume = 0.15 * window.soundSettings.effectsVolume * window.soundSettings.masterVolume;
                    hoverSound.play().catch(err => console.error("Button hover sound failed:", err));
                }
            } catch (err) {
                console.error("Error playing hover sound:", err);
            }
        });
        
        console.log("Graph toggle button handler setup complete");
    } else {
        console.error("Graph toggle button not found in DOM");
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
            playClickSound();
        });
    });
    
    /**
     * Main function to visualize data from query results
     * @param {Array} results - SQL query results as an array of objects
     */
    function visualizeData(results) {
        console.log("Visualizing data:", results);
        
        if (!results || !Array.isArray(results) || results.length === 0) {
            console.log("No data to visualize");
            noDataMessage.style.display = 'block';
            destroyChart();
            return;
        }
        
        // Store the last results in window scope for reuse
        window.lastResults = results;
        
        // Hide no data message
        noDataMessage.style.display = 'none';
        
        // Store results for reuse when changing chart types
        lastQueryResults = results;
        
        // Destroy previous chart if it exists
        destroyChart();
        
        // Ensure the canvas is properly sized for all chart types
        const container = document.querySelector('.chart-canvas-container');
        const canvas = document.getElementById('data-chart');
        
        if (container && canvas) {
            // Remove any previous classes
            container.classList.remove('treemap-mode');
            
            // Set dimensions for the canvas based on container size
            const parentWidth = container.clientWidth;
            const parentHeight = container.clientHeight;
            
            // Set canvas dimensions to match container
            canvas.width = parentWidth || 800;
            canvas.height = parentHeight || 400;
        }
        
        // Prepare chart data based on results
        const chartData = prepareChartData(results, currentChartType);
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
                if (chartData.datasets && chartData.datasets[0]) {
                    const labelParts = chartData.datasets[0].label.split(' vs ');
                    options.scales.x.title = { 
                        display: true, 
                        text: labelParts[0] || 'X-Axis',
                        color: '#e0e0e0'
                    };
                    options.scales.y.title = { 
                        display: true, 
                        text: labelParts[1] || 'Y-Axis',
                        color: '#e0e0e0'
                    };
                }
                break;
                
            case 'treemap':
                // Treemap does not use standard scales
                delete options.scales;
                // Add treemap specific class
                if (container) {
                    container.classList.add('treemap-mode');
                }
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
    function prepareChartData(results, chartType) {
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