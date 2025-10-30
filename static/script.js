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
    
    // Event listeners
    fileInput.addEventListener('change', handleFileUpload);
    loadSampleBtn.addEventListener('click', loadSampleData);
    generateChartBtn.addEventListener('click', function() {
        generateChart();
        // Scroll to bill calculation section
        document.getElementById('bill-calculation-section').scrollIntoView({behavior: 'smooth'});
    });
    
    // Event listener for the generate bill PDF button
    document.getElementById('generate-bill-pdf').addEventListener('click', function() {
        generateBillPDF();
    });
    
    // Function to calculate energy charges based on Maharashtra tariff
     function calculateEnergyCharges(units) {
         let charges = 0;
         
         if (units <= 100) {
             charges = units * 3.05;
         } else if (units <= 300) {
             charges = 100 * 3.05 + (units - 100) * 6.40;
         } else if (units <= 500) {
             charges = 100 * 3.05 + 200 * 6.40 + (units - 300) * 8.50;
         } else {
             charges = 100 * 3.05 + 200 * 6.40 + 200 * 8.50 + (units - 500) * 9.50;
         }
         
         return charges;
     }

     // Function to generate bill PDF
     function generateBillPDF() {
         if (!csvData) {
             showErrorToast('Please upload data first');
             return;
         }
         
         // Calculate total consumption
         let totalConsumption = 0;
         csvData.preview.forEach(row => {
             if (row['Electricity_Consumption_kWh']) {
                 totalConsumption += parseFloat(row['Electricity_Consumption_kWh']);
             }
         });
         
         // Calculate energy charges based on Maharashtra tariff
         let energyCharges = calculateEnergyCharges(totalConsumption);
         let fixedCharges = 90; // Fixed charge for residential customers
        
        // Prepare data for PDF generation
        const billData = {
            total_consumption: totalConsumption,
            billing_days: csvData.preview.length,
            energy_charges: energyCharges,
            fixed_charges: fixedCharges,
            tariff_type: 'Residential',
            filename: csvData.filename
        };
        
        // Show loading notification
        showSuccessToast('Generating PDF bill...');
        
        // Send request to generate PDF
        fetch('/generate_bill_pdf', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(billData)
        })
        .then(response => {
            if (response.ok) {
                return response.blob();
            }
            throw new Error('Failed to generate PDF');
        })
        .then(blob => {
            // Create a URL for the blob
            const url = window.URL.createObjectURL(blob);
            
            // Create a link and trigger download
            const a = document.createElement('a');
            a.style.display = 'none';
            a.href = url;
            a.download = 'electricity_bill.pdf';
            document.body.appendChild(a);
            a.click();
            
            // Clean up
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
            
            showSuccessToast('Bill PDF generated successfully!');
        })
        .catch(error => {
            console.error('Error generating PDF:', error);
            showErrorToast('Failed to generate PDF bill');
        });
    }
    
    detectPatternsBtn.addEventListener('click', () => performAnalysis('patterns'));
    findAnomaliesBtn.addEventListener('click', () => performAnalysis('anomalies'));
    calculateStatsBtn.addEventListener('click', () => performAnalysis('statistics'));
    
    exportChartBtn.addEventListener('click', exportChart);
    exportDataBtn.addEventListener('click', exportData);
    exportAnalysisBtn.addEventListener('click', exportAnalysis);
    
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
    
    // Update bill calculation section if available
    updateBillCalculation(data);
    
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
    document.getElementById('generate-bill-pdf').disabled = false;
}

// Update bill calculation section
function updateBillCalculation(data) {
    const billResultsDiv = document.getElementById('bill-calculation-results');
    const billDataTable = document.getElementById('bill-data-table');
    
    if (data.has_bill_calculation) {
        // Find bill-related columns in the data
        const billColumns = data.columns.filter(col => 
            col.includes('Bill_INR') || 
            col.includes('Fixed_Charge') || 
            col.includes('Total_Bill')
        );
        
        if (billColumns.length > 0) {
            // Create bill summary from the first 10 rows
            let html = '<h3>Maharashtra Electricity Bill Calculation</h3>';
            
            // Calculate total consumption and bill
            let totalConsumption = 0;
            let totalEnergyCharges = 0;
            let totalFixedCharges = 0;
            let totalBill = 0;
            let count = 0;
            
            data.preview.forEach(row => {
                if (row['Electricity_Consumption_kWh'] && row['Total_Bill_INR']) {
                    totalConsumption += parseFloat(row['Electricity_Consumption_kWh']);
                    totalEnergyCharges += parseFloat(row['Bill_INR'] || 0);
                    totalFixedCharges += parseFloat(row['Fixed_Charge_INR'] || 0);
                    totalBill += parseFloat(row['Total_Bill_INR']);
                    count++;
                }
            });
            
            // Calculate averages
            const avgConsumption = count > 0 ? (totalConsumption / count).toFixed(2) : 0;
            const avgBill = count > 0 ? (totalBill / count).toFixed(2) : 0;
            
            // Tariff rates section
            html += '<div class="bill-section">';
            html += '<h4>Maharashtra Electricity Tariff Rates</h4>';
            html += '<div class="tariff-rates">';
            html += '<table class="rates-table">';
            html += '<thead><tr><th>Consumption Slab</th><th>Rate (₹/unit)</th></tr></thead>';
            html += '<tbody>';
            html += '<tr><td>0-100 units</td><td>₹4.16</td></tr>';
            html += '<tr><td>101-300 units</td><td>₹7.34</td></tr>';
            html += '<tr><td>301-500 units</td><td>₹10.37</td></tr>';
            html += '<tr><td>Above 500 units</td><td>₹12.51</td></tr>';
            html += '</tbody></table>';
            html += '<p><strong>Fixed Charge:</strong> ₹90.00 per month</p>';
            html += '</div>';
            html += '</div>';
            
            // Consumption summary
            html += '<div class="bill-section">';
            html += '<h4>Consumption Summary</h4>';
            html += '<div class="bill-summary">';
            html += `<p><strong>Average Daily Consumption:</strong> ${avgConsumption} kWh</p>`;
            html += `<p><strong>Total Consumption (Preview):</strong> ${totalConsumption.toFixed(2)} kWh</p>`;
            html += '</div>';
            html += '</div>';
            
            // Bill breakdown
            html += '<div class="bill-section">';
            html += '<h4>Bill Breakdown</h4>';
            html += '<div class="bill-breakdown">';
            html += `<p><strong>Energy Charges:</strong> ₹${totalEnergyCharges.toFixed(2)}</p>`;
            html += `<p><strong>Fixed Charges:</strong> ₹${totalFixedCharges.toFixed(2)}</p>`;
            html += `<p class="total-amount"><strong>Total Bill Amount:</strong> ₹${totalBill.toFixed(2)}</p>`;
            html += '</div>';
            html += '</div>';
            
            // Detailed bill table
            html += '<div class="bill-section">';
            html += '<h4>Detailed Bill Information</h4>';
            html += '<table class="bill-table">';
            html += '<thead><tr>';
            html += '<th>Date</th>';
            html += '<th>Units Consumed</th>';
            html += '<th>Rate (₹/unit)</th>';
            html += '<th>Energy Charges (₹)</th>';
            html += '<th>Fixed Charges (₹)</th>';
            html += '<th>Total Bill (₹)</th>';
            html += '</tr></thead>';
            html += '<tbody>';
            
            data.preview.slice(0, 5).forEach(row => {
                // Calculate effective rate
                const consumption = parseFloat(row['Electricity_Consumption_kWh'] || 0);
                const energyCharges = parseFloat(row['Bill_INR'] || 0);
                const effectiveRate = consumption > 0 ? (energyCharges / consumption).toFixed(2) : '-';
                
                html += '<tr>';
                html += `<td>${row['Date'] || '-'}</td>`;
                html += `<td>${row['Electricity_Consumption_kWh'] || '-'}</td>`;
                html += `<td>${effectiveRate}</td>`;
                html += `<td>${row['Bill_INR'] ? row['Bill_INR'].toFixed(2) : '-'}</td>`;
                html += `<td>${row['Fixed_Charge_INR'] || '-'}</td>`;
                html += `<td>${row['Total_Bill_INR'] ? row['Total_Bill_INR'].toFixed(2) : '-'}</td>`;
                html += '</tr>';
            });
            
            html += '</tbody></table>';
            html += '</div>';
            
            // Final bill section
            html += '<div class="final-bill-section">';
            html += '<h4>Final Bill</h4>';
            html += '<div class="final-bill">';
            html += `<div class="bill-row"><span>Total Units Consumed:</span><span>${totalConsumption.toFixed(2)} kWh</span></div>`;
            html += `<div class="bill-row"><span>Energy Charges:</span><span>₹${totalEnergyCharges.toFixed(2)}</span></div>`;
            html += `<div class="bill-row"><span>Fixed Charges:</span><span>₹${totalFixedCharges.toFixed(2)}</span></div>`;
            html += `<div class="bill-row total"><span>Total Amount Due:</span><span>₹${totalBill.toFixed(2)}</span></div>`;
            html += '</div>';
            html += '</div>';
            
            billResultsDiv.innerHTML = html;
            
            // Populate the bill data table with all available data
            let tableHTML = '<thead><tr>';
            tableHTML += '<th>Date</th>';
            tableHTML += '<th>Units Consumed</th>';
            tableHTML += '<th>Rate (₹/unit)</th>';
            tableHTML += '<th>Energy Charges (₹)</th>';
            tableHTML += '<th>Fixed Charges (₹)</th>';
            tableHTML += '<th>Total Bill (₹)</th>';
            tableHTML += '</tr></thead><tbody>';
            
            // Add rows for each day's data (use all available preview data)
            data.preview.forEach(row => {
                // Calculate effective rate
                const consumption = parseFloat(row['Electricity_Consumption_kWh'] || 0);
                const energyCharges = parseFloat(row['Bill_INR'] || 0);
                const effectiveRate = consumption > 0 ? (energyCharges / consumption).toFixed(2) : '-';
                
                tableHTML += '<tr>';
                tableHTML += `<td>${row['Date'] || '-'}</td>`;
                tableHTML += `<td>${row['Electricity_Consumption_kWh'] || '-'}</td>`;
                tableHTML += `<td>${effectiveRate}</td>`;
                tableHTML += `<td>${row['Bill_INR'] ? row['Bill_INR'].toFixed(2) : '-'}</td>`;
                tableHTML += `<td>${row['Fixed_Charge_INR'] || '-'}</td>`;
                tableHTML += `<td>${row['Total_Bill_INR'] ? row['Total_Bill_INR'].toFixed(2) : '-'}</td>`;
                tableHTML += '</tr>';
            });
            
            tableHTML += '</tbody>';
            billDataTable.innerHTML = tableHTML;
            billDataTable.style.display = 'table'; // Make sure table is visible
        } else {
            billResultsDiv.innerHTML = '<p>Bill calculation data is available but no bill columns were found.</p>';
            billDataTable.innerHTML = '';
            billDataTable.style.display = 'none';
        }
    } else {
        billResultsDiv.innerHTML = '<p>Upload a CSV file with electrical parameters to see bill calculation.</p>';
        billDataTable.innerHTML = '';
        billDataTable.style.display = 'none';
    }
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