// Global variables
let csvData = null;
let currentChart = null;

// DOM elements
document.addEventListener('DOMContentLoaded', function() {
    // Add animation delay to sections
    document.querySelectorAll('section').forEach((section, index) => {
        section.style.setProperty('--section-index', index);
    });
    
    // File upload handling
    const fileInput = document.getElementById('csv-file');
    const fileInfo = document.querySelector('.file-info');
    const loadSampleBtn = document.getElementById('load-sample');
    const uploadLoading = document.getElementById('upload-loading');
    const sampleLoading = document.getElementById('sample-loading');
    
    // Chart controls
    const chartTypeSelect = document.getElementById('chart-type-select');
    const xAxisSelect = document.getElementById('x-axis-select');
    const yAxisSelect = document.getElementById('y-axis-select');
    const generateChartBtn = document.getElementById('generate-chart');
    
    // Analysis buttons
    const detectPatternsBtn = document.getElementById('detect-patterns');
    const findAnomaliesBtn = document.getElementById('find-anomalies');
    const calculateStatsBtn = document.getElementById('calculate-stats');
    
    // Export buttons
    const exportChartBtn = document.getElementById('export-chart');
    const exportDataBtn = document.getElementById('export-data');
    const exportAnalysisBtn = document.getElementById('export-analysis');
    
    // Cost calculator elements
    const tariffStructure = document.getElementById('tariff-structure');
    const calculateCostBtn = document.getElementById('calculate-cost');
    const flatRateSettings = document.querySelector('.flat-rate-settings');
    const timeOfUseSettings = document.querySelector('.time-of-use-settings');
    
    // Event listeners
    fileInput.addEventListener('change', handleFileUpload);
    loadSampleBtn.addEventListener('click', loadSampleData);
    generateChartBtn.addEventListener('click', function() {
        generateChart();
        // Scroll to visualization section
        document.getElementById('visualization-section').scrollIntoView({behavior: 'smooth'});
    });
    
    detectPatternsBtn.addEventListener('click', () => performAnalysis('patterns'));
    findAnomaliesBtn.addEventListener('click', () => performAnalysis('anomalies'));
    calculateStatsBtn.addEventListener('click', () => performAnalysis('statistics'));
    
    exportChartBtn.addEventListener('click', exportChart);
    exportDataBtn.addEventListener('click', exportData);
    exportAnalysisBtn.addEventListener('click', exportAnalysis);
    
    // Tariff structure change event
    tariffStructure.addEventListener('change', function() {
        if (this.value === 'flat') {
            flatRateSettings.style.display = 'block';
            timeOfUseSettings.style.display = 'none';
        } else {
            flatRateSettings.style.display = 'none';
            timeOfUseSettings.style.display = 'block';
        }
    });
    
    // Calculate cost button event
    calculateCostBtn.addEventListener('click', calculateCost);
    
    // Initialize Chart.js
    Chart.defaults.font.family = "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif";
    Chart.defaults.color = '#555';
});

// Handle file upload
function handleFileUpload(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    const fileInfo = document.querySelector('.file-info');
    const uploadLoading = document.getElementById('upload-loading');
    
    fileInfo.textContent = `Selected file: ${file.name}`;
    
    const formData = new FormData();
    formData.append('file', file);
    
    // Show loading state
    fileInfo.textContent = 'Uploading and processing...';
    uploadLoading.classList.add('active');
    
    fetch('/upload', {
        method: 'POST',
        body: formData
    })
    .then(response => response.json())
    .then(data => {
        uploadLoading.classList.remove('active');
        if (data.success) {
            processUploadedData(data);
            fileInfo.textContent = `Processed: ${file.name} (${data.row_count} rows)`;
            showSuccessToast('File uploaded successfully!');
        } else {
            fileInfo.textContent = `Error: ${data.error}`;
            showErrorToast('Upload failed: ' + data.error);
        }
    })
    .catch(error => {
        console.error('Error:', error);
        uploadLoading.classList.remove('active');
        fileInfo.textContent = 'Error uploading file. Please try again.';
        showErrorToast('Upload failed. Please try again.');
    });
}

// Load sample data
function loadSampleData() {
    const fileInfo = document.querySelector('.file-info');
    const sampleLoading = document.getElementById('sample-loading');
    
    fileInfo.textContent = 'Loading sample data...';
    sampleLoading.classList.add('active');
    
    fetch('/sample')
    .then(response => response.json())
    .then(data => {
        sampleLoading.classList.remove('active');
        if (data.success) {
            processUploadedData(data);
            fileInfo.textContent = `Loaded: Sample meter data (${data.row_count} rows)`;
            showSuccessToast('Sample data loaded successfully!');
        } else {
            fileInfo.textContent = `Error: ${data.error}`;
            showErrorToast('Loading sample data failed: ' + data.error);
        }
    })
    .catch(error => {
        console.error('Error:', error);
        sampleLoading.classList.remove('active');
        fileInfo.textContent = 'Error loading sample data. Please try again.';
        showErrorToast('Loading sample data failed. Please try again.');
    });
}

// Toast notification functions
function showToast(message, type) {
    // Create toast container if it doesn't exist
    let toastContainer = document.getElementById('toast-container');
    if (!toastContainer) {
        toastContainer = document.createElement('div');
        toastContainer.id = 'toast-container';
        document.body.appendChild(toastContainer);
    }
    
    // Create toast element
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    
    // Add to container
    toastContainer.appendChild(toast);
    
    // Animate in
    setTimeout(() => {
        toast.classList.add('show');
    }, 10);
    
    // Remove after delay
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => {
            toastContainer.removeChild(toast);
        }, 300);
    }, 3000);
}

function showSuccessToast(message) {
    showToast(message, 'success');
}

function showErrorToast(message) {
    showToast(message, 'error');
}

// Process uploaded data
function processUploadedData(data) {
    csvData = data;
    
    // Update data preview table
    updateDataPreview(data.preview, data.columns);
    
    // Update axis selectors
    populateAxisSelectors(data.columns, data.dtypes);
    
    // Enable controls
    document.getElementById('x-axis-select').disabled = false;
    document.getElementById('y-axis-select').disabled = false;
    document.getElementById('generate-chart').disabled = false;
    document.getElementById('detect-patterns').disabled = false;
    document.getElementById('find-anomalies').disabled = false;
    document.getElementById('calculate-stats').disabled = false;
    document.getElementById('export-data').disabled = false;
}



// Update data preview table
function updateDataPreview(data, columns) {
    const table = document.getElementById('data-preview');
    
    // Create header
    let headerHTML = '<tr>';
    columns.forEach(column => {
        headerHTML += `<th>${column}</th>`;
    });
    headerHTML += '</tr>';
    
    // Create rows
    let rowsHTML = '';
    data.forEach(row => {
        rowsHTML += '<tr>';
        columns.forEach(column => {
            rowsHTML += `<td>${row[column]}</td>`;
        });
        rowsHTML += '</tr>';
    });
    
    table.innerHTML = `<thead>${headerHTML}</thead><tbody>${rowsHTML}</tbody>`;
}

// Populate axis selectors
function populateAxisSelectors(columns, dtypes) {
    const xAxisSelect = document.getElementById('x-axis-select');
    const yAxisSelect = document.getElementById('y-axis-select');
    
    // Clear existing options
    xAxisSelect.innerHTML = '<option value="">Select column</option>';
    yAxisSelect.innerHTML = '<option value="">Select column</option>';
    
    // Add options for each column
    columns.forEach(column => {
        const xOption = document.createElement('option');
        xOption.value = column;
        xOption.textContent = column;
        xAxisSelect.appendChild(xOption);
        
        const yOption = document.createElement('option');
        yOption.value = column;
        yOption.textContent = column;
        yAxisSelect.appendChild(yOption);
    });
    
    // Try to auto-select appropriate columns
    // For X-axis, prefer date/time columns
    for (let i = 0; i < columns.length; i++) {
        const col = columns[i];
        const dtype = dtypes[col];
        
        if (col.toLowerCase().includes('date') || col.toLowerCase().includes('time')) {
            xAxisSelect.value = col;
            break;
        }
    }
    
    // For Y-axis, prefer numeric columns
    for (let i = 0; i < columns.length; i++) {
        const col = columns[i];
        const dtype = dtypes[col];
        
        if (dtype.includes('float') || dtype.includes('int')) {
            if (col.toLowerCase().includes('consumption') || 
                col.toLowerCase().includes('usage') || 
                col.toLowerCase().includes('value')) {
                yAxisSelect.value = col;
                break;
            }
        }
    }
    
    // If no specific column was selected, choose the first numeric column
    if (!yAxisSelect.value) {
        for (let i = 0; i < columns.length; i++) {
            const col = columns[i];
            const dtype = dtypes[col];
            
            if (dtype.includes('float') || dtype.includes('int')) {
                yAxisSelect.value = col;
                break;
            }
        }
    }
}

// Generate chart
function generateChart() {
    if (!csvData) return;
    
    const chartType = document.getElementById('chart-type-select').value;
    const xColumn = document.getElementById('x-axis-select').value;
    const yColumn = document.getElementById('y-axis-select').value;
    
    if (!xColumn || !yColumn) {
        alert('Please select both X and Y axis columns');
        return;
    }
    
    // Fetch the data for the selected columns
    fetch(`/data/${csvData.filename}?x=${xColumn}&y=${yColumn}`)
    .then(response => response.json())
    .then(result => {
        if (result.success) {
            createChart(result.data, chartType);
            
            // Enable export chart button
            document.getElementById('export-chart').disabled = false;
            document.getElementById('export-analysis').disabled = false;
        } else {
            alert(`Error: ${result.error}`);
        }
    })
    .catch(error => {
        console.error('Error:', error);
        alert('Error generating chart. Please try again.');
    });
}

// Create chart
function createChart(data, chartType) {
    const ctx = document.getElementById('chart-area').getContext('2d');
    
    // Destroy existing chart if it exists
    if (currentChart) {
        currentChart.destroy();
    }
    
    // Prepare data
    const chartData = {
        labels: data.x,
        datasets: [{
            label: data.y_label,
            data: data.y,
            backgroundColor: 'rgba(74, 111, 165, 0.2)',
            borderColor: 'rgba(74, 111, 165, 1)',
            borderWidth: 1,
            pointRadius: chartType === 'scatter' ? 4 : 2,
            pointHoverRadius: 6,
            tension: 0.1
        }]
    };
    
    // Chart options
    const options = {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
            x: {
                title: {
                    display: true,
                    text: data.x_label
                }
            },
            y: {
                title: {
                    display: true,
                    text: data.y_label
                }
            }
        },
        plugins: {
            title: {
                display: true,
                text: `${data.y_label} vs ${data.x_label}`,
                font: {
                    size: 16
                }
            },
            tooltip: {
                callbacks: {
                    label: function(context) {
                        return `${data.y_label}: ${context.parsed.y}`;
                    }
                }
            }
        }
    };
    
    // Create chart based on selected type
    currentChart = new Chart(ctx, {
        type: chartType === 'scatter' ? 'scatter' : chartType,
        data: chartData,
        options: options
    });
}

// Perform analysis
function performAnalysis(analysisType) {
    if (!csvData) return;
    
    const analysisOutput = document.getElementById('analysis-output');
    analysisOutput.innerHTML = '<p>Analyzing data...</p>';
    
    fetch('/analyze', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            filename: csvData.filename,
            analysis_type: analysisType
        })
    })
    .then(response => response.json())
    .then(result => {
        if (result.success) {
            displayAnalysisResults(result.analysis_type, result.results);
        } else {
            analysisOutput.innerHTML = `<p>Error: ${result.error}</p>`;
        }
    })
    .catch(error => {
        console.error('Error:', error);
        analysisOutput.innerHTML = '<p>Error performing analysis. Please try again.</p>';
    });
}

// Display analysis results
function displayAnalysisResults(analysisType, results) {
    const analysisOutput = document.getElementById('analysis-output');
    
    if (analysisType === 'statistics') {
        let html = '<h4>Statistical Analysis</h4>';
        
        for (const column in results.statistics) {
            const stats = results.statistics[column];
            
            html += `
                <div class="stat-card">
                    <h5>${column}</h5>
                    <table class="stats-table">
                        <tr>
                            <td>Mean:</td>
                            <td>${stats.mean.toFixed(2)}</td>
                        </tr>
                        <tr>
                            <td>Median:</td>
                            <td>${stats.median.toFixed(2)}</td>
                        </tr>
                        <tr>
                            <td>Std Dev:</td>
                            <td>${stats.std.toFixed(2)}</td>
                        </tr>
                        <tr>
                            <td>Min:</td>
                            <td>${stats.min.toFixed(2)}</td>
                        </tr>
                        <tr>
                            <td>Max:</td>
                            <td>${stats.max.toFixed(2)}</td>
                        </tr>
                    </table>
                </div>
            `;
        }
        
        analysisOutput.innerHTML = html;
        
    } else if (analysisType === 'patterns') {
        let html = '<h4>Pattern Detection</h4>';
        
        if (Object.keys(results.patterns).length === 0) {
            html += '<p>No significant patterns detected in the data.</p>';
        } else {
            html += '<ul class="pattern-list">';
            
            for (const column in results.patterns) {
                const pattern = results.patterns[column];
                
                html += `
                    <li>
                        <strong>${column}:</strong> 
                        <span class="trend ${pattern.trend}">
                            ${pattern.trend.toUpperCase()} trend
                        </span> 
                        (strength: ${(pattern.trend_strength * 100).toFixed(1)}%)
                    </li>
                `;
            }
            
            html += '</ul>';
        }
        
        analysisOutput.innerHTML = html;
        
    } else if (analysisType === 'anomalies') {
        let html = '<h4>Anomaly Detection</h4>';
        
        if (Object.keys(results.anomalies).length === 0) {
            html += '<p>No anomalies detected in the data.</p>';
        } else {
            for (const column in results.anomalies) {
                const anomaly = results.anomalies[column];
                
                html += `
                    <div class="anomaly-card">
                        <h5>${column}</h5>
                        <p>Found ${anomaly.count} potential anomalies</p>
                `;
                
                if (anomaly.count > 0) {
                    html += '<table class="anomaly-table"><tr><th>Index</th><th>Value</th></tr>';
                    
                    for (let i = 0; i < anomaly.indices.length; i++) {
                        html += `
                            <tr>
                                <td>${anomaly.indices[i]}</td>
                                <td>${anomaly.values[i]}</td>
                            </tr>
                        `;
                    }
                    
                    html += '</table>';
                }
                
                html += '</div>';
            }
        }
        
        analysisOutput.innerHTML = html;
    }
}

// Export chart as image
function exportChart() {
    if (!currentChart) return;
    
    const canvas = document.getElementById('chart-area');
    const image = canvas.toDataURL('image/png');
    
    const link = document.createElement('a');
    link.href = image;
    link.download = 'chart_export.png';
    link.click();
}

// Export processed data
function exportData() {
    if (!csvData) return;
    
    // Create CSV content
    let csvContent = '';
    
    // Add header row
    csvContent += csvData.columns.join(',') + '\n';
    
    // Add data rows from preview (this is just a sample, in a real app you'd use the full dataset)
    csvData.preview.forEach(row => {
        const rowValues = csvData.columns.map(col => {
            let value = row[col];
            // Handle values with commas by quoting them
            if (typeof value === 'string' && value.includes(',')) {
                return `"${value}"`;
            }
            return value;
        });
        csvContent += rowValues.join(',') + '\n';
    });
    
    // Create and trigger download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'processed_data.csv';
    link.click();
}

// Export analysis results
function exportAnalysis() {
    const analysisOutput = document.getElementById('analysis-output');
    
    if (!analysisOutput.textContent || analysisOutput.textContent.includes('No analysis performed yet')) {
        alert('Please perform an analysis first');
        return;
    }
    
    // Create text content from analysis results
    const analysisText = 'CSV to Graph - Analysis Results\n\n' + 
                         analysisOutput.textContent.replace(/<[^>]*>/g, '').trim();
    
    // Create and trigger download
    const blob = new Blob([analysisText], { type: 'text/plain;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'analysis_results.txt';
    link.click();
}

// Calculate electricity cost
function calculateCost() {
    if (!csvData) {
        showErrorToast('Please upload data first');
        return;
    }
    
    const costOutput = document.getElementById('cost-output');
    costOutput.innerHTML = '<p>Calculating costs...</p>';
    
    // Get tariff settings
    const tariffType = document.getElementById('tariff-structure').value;
    let totalConsumption = 0;
    let totalCost = 0;
    
    // Get consumption data from the uploaded file
    fetch(`/data/${csvData.filename}?x=Date&y=Electricity_Consumption_kWh`)
    .then(response => response.json())
    .then(result => {
        if (!result.success) {
            costOutput.innerHTML = `<p>Error: ${result.error}</p>`;
            return;
        }
        
        const consumptionData = result.data.y;
        const dates = result.data.x;
        
        // Calculate total consumption
        totalConsumption = consumptionData.reduce((sum, value) => sum + parseFloat(value), 0);
        
        // Calculate cost based on tariff type
        if (tariffType === 'flat') {
            // Flat rate calculation
            const baseRate = parseFloat(document.getElementById('base-rate').value);
            totalCost = totalConsumption * baseRate;
            
            // Display results as a table
            costOutput.innerHTML = `
                <div class="cost-summary">
                    <h4>Cost Summary (Flat Rate)</h4>
                    <table class="cost-table">
                        <thead>
                            <tr>
                                <th>Item</th>
                                <th>Value</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                                <td>Total Consumption (kWh)</td>
                                <td>${totalConsumption.toFixed(2)}</td>
                            </tr>
                            <tr>
                                <td>Rate (₹/kWh)</td>
                                <td>₹${baseRate.toFixed(2)}</td>
                            </tr>
                        </tbody>
                        <tfoot>
                            <tr>
                                <td>Total Cost</td>
                                <td>₹${totalCost.toFixed(2)}</td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
                <button id="generate-bill" class="btn btn-primary">Generate Bill PDF</button>
            `;
            
            // Add event listener for the generate bill button
            document.getElementById('generate-bill').addEventListener('click', () => generateBillPDF(totalConsumption, totalCost));
            
        } else {
            // Time of use calculation
            const peakRate = parseFloat(document.getElementById('peak-rate').value);
            const offPeakRate = parseFloat(document.getElementById('off-peak-rate').value);
            const peakStart = parseInt(document.getElementById('peak-hours-start').value);
            const peakEnd = parseInt(document.getElementById('peak-hours-end').value);
            
            // Assume data is hourly and has timestamps
            // For this demo, we'll just split the consumption evenly
            const peakHours = peakEnd - peakStart;
            const totalHours = 24;
            const offPeakHours = totalHours - peakHours;
            
            // Estimate peak and off-peak consumption
            const peakConsumption = totalConsumption * (peakHours / totalHours);
            const offPeakConsumption = totalConsumption * (offPeakHours / totalHours);
            
            // Calculate costs
            const peakCost = peakConsumption * peakRate;
            const offPeakCost = offPeakConsumption * offPeakRate;
            totalCost = peakCost + offPeakCost;
            
            // Display results as a table
            costOutput.innerHTML = `
                <div class="cost-summary">
                    <h4>Cost Summary (Time of Use)</h4>
                    <table class="cost-table">
                        <thead>
                            <tr>
                                <th>Segment</th>
                                <th>Consumption (kWh)</th>
                                <th>Rate (₹/kWh)</th>
                                <th>Cost (₹)</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                                <td>Peak (${peakStart}:00–${peakEnd}:00)</td>
                                <td>${peakConsumption.toFixed(2)}</td>
                                <td>₹${peakRate.toFixed(2)}</td>
                                <td>₹${peakCost.toFixed(2)}</td>
                            </tr>
                            <tr>
                                <td>Off-Peak</td>
                                <td>${offPeakConsumption.toFixed(2)}</td>
                                <td>₹${offPeakRate.toFixed(2)}</td>
                                <td>₹${offPeakCost.toFixed(2)}</td>
                            </tr>
                        </tbody>
                        <tfoot>
                            <tr>
                                <td colspan="3">Total Cost</td>
                                <td>₹${totalCost.toFixed(2)}</td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
                <button id="generate-bill" class="btn btn-primary">Generate Bill PDF</button>
            `;
            
            // Add event listener for the generate bill button
            document.getElementById('generate-bill').addEventListener('click', () => generateBillPDF(totalConsumption, totalCost));
        }
    })
    .catch(error => {
        console.error('Error:', error);
        costOutput.innerHTML = '<p>Error calculating costs. Please try again.</p>';
    });
}

// Generate bill PDF
function generateBillPDF(totalConsumption, totalCost) {
    const billingPeriod = csvData ? `${csvData.filename.replace('.csv', '')}` : 'Current Period';
    
    fetch('/generate_bill_pdf', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            total_consumption: totalConsumption,
            total_cost: totalCost,
            billing_period: billingPeriod,
            billing_days: 30, // Default to 30 days
            tariff_type: document.getElementById('tariff-structure').value
        })
    })
    .then(response => response.blob())
    .then(blob => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'electricity_bill.pdf';
        document.body.appendChild(a);
        a.click();
        a.remove();
        showSuccessToast('Bill PDF generated successfully!');
    })
    .catch(error => {
        console.error('Error:', error);
        showErrorToast('Error generating PDF bill. Please try again.');
    });
}
