from flask import Flask, render_template, request, jsonify, send_from_directory, make_response
import pandas as pd
import numpy as np
import os
import json
from werkzeug.utils import secure_filename
import io
import csv
from datetime import datetime
from reportlab.lib.pagesizes import letter
from reportlab.pdfgen import canvas
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer

app = Flask(__name__, static_folder='static', template_folder='templates')
app.config['UPLOAD_FOLDER'] = 'uploads'
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024  # 16MB max upload size
app.config['ALLOWED_EXTENSIONS'] = {'csv'}

# Create upload folder if it doesn't exist
os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)

def process_meter_data(df):
    """
    Process electricity meter data to ensure consistent format
    
    Args:
        df: DataFrame containing electricity meter data
    
    Returns:
        DataFrame with processed data
    """
    # Make a copy to avoid modifying the original
    result_df = df.copy()
    
    # Check if we have consumption data directly
    if 'Electricity_Consumption_kWh' not in df.columns:
        if '3_Phase_Active_Power' in df.columns:
            # Calculate consumption from 3-phase active power (kW to kWh conversion)
            # Assuming the data is hourly, we divide by 1000 to convert W to kW
            result_df['Electricity_Consumption_kWh'] = df['3_Phase_Active_Power'] / 1000
        elif all(f'{phase}_Phase_Active_Power' in df.columns for phase in ['R', 'Y', 'B']):
            # Sum the three phases to get total consumption
            result_df['Electricity_Consumption_kWh'] = (
                df['R_Phase_Active_Power'] + 
                df['Y_Phase_Active_Power'] + 
                df['B_Phase_Active_Power']
            ) / 1000  # Convert W to kW
    
    return result_df

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in app.config['ALLOWED_EXTENSIONS']

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/upload', methods=['POST'])
def upload_file():
    if 'file' not in request.files:
        return jsonify({'error': 'No file part'}), 400
    
    file = request.files['file']
    
    if file.filename == '':
        return jsonify({'error': 'No selected file'}), 400
    
    if file and allowed_file(file.filename):
        # Read the file into a pandas DataFrame
        try:
            # Save the file temporarily
            filename = secure_filename(file.filename)
            filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)
            file.save(filepath)
            
            # Read the CSV file with error handling
            try:
                df = pd.read_csv(filepath)
            except pd.errors.EmptyDataError:
                return jsonify({'error': 'The uploaded CSV file is empty'}), 400
            except pd.errors.ParserError:
                return jsonify({'error': 'Unable to parse the CSV file. Please check the file format'}), 400
            
            # Check if DataFrame is empty
            if df.empty:
                return jsonify({'error': 'The uploaded CSV file contains no data'}), 400
                
            # Process the meter data
            df = process_meter_data(df)
            
            # Get basic info about the data
            columns = df.columns.tolist()
            preview = df.head(10).to_dict('records')
            
            # Get data types for each column
            dtypes = {col: str(df[col].dtype) for col in columns}
            
            return jsonify({
                'success': True,
                'filename': filename,
                'columns': columns,
                'preview': preview,
                'dtypes': dtypes,
                'row_count': len(df)
            })
            
        except Exception as e:
            # More detailed error handling
            error_message = str(e)
            print(f"File upload error: {error_message}")
            return jsonify({
                'error': f"Error processing file: {error_message}",
                'details': "Please ensure your CSV file is properly formatted with valid data"
            }), 500
    
    return jsonify({'error': 'File type not allowed. Please upload a CSV file'}), 400

@app.route('/sample')
def get_sample_data():
    # Generate sample meter data
    dates = pd.date_range(start='2023-01-01', end='2023-12-31', freq='D')
    
    # Create sample electricity consumption data with seasonal patterns
    np.random.seed(42)
    base_consumption = 20 + 15 * np.sin(np.linspace(0, 2*np.pi, len(dates)))  # Seasonal pattern
    random_variation = np.random.normal(0, 3, len(dates))  # Random daily variation
    weekday_effect = [2 if d.weekday() < 5 else -3 for d in dates]  # Weekday vs weekend effect
    
    consumption = base_consumption + random_variation + weekday_effect
    
    # Add some anomalies
    anomaly_indices = [30, 90, 180, 270]
    for idx in anomaly_indices:
        consumption[idx] += 25  # Spike in consumption
    
    # Generate electrical parameters
    np.random.seed(42)
    voltage_base = 230  # Base voltage for single phase
    
    # Create DataFrame with electrical parameters
    df = pd.DataFrame({
        'Date': dates.strftime('%Y-%m-%d'),
        'Electricity_Consumption_kWh': np.round(consumption, 2),
        'Ambient_Temperature_C': np.round(15 + 10 * np.sin(np.linspace(0, 2*np.pi, len(dates))) + np.random.normal(0, 2, len(dates)), 1),
        
        # Phase voltages
        'R_Ph_Voltage': np.round(voltage_base + np.random.normal(0, 5, len(dates)), 1),
        'Y_Ph_Voltage': np.round(voltage_base + np.random.normal(0, 5, len(dates)), 1),
        'B_Ph_Voltage': np.round(voltage_base + np.random.normal(0, 5, len(dates)), 1),
        
        # Power factors
        'R_PF': np.round(0.92 + np.random.normal(0, 0.03, len(dates)), 2),
        'Y_PF': np.round(0.93 + np.random.normal(0, 0.03, len(dates)), 2),
        'B_PF': np.round(0.91 + np.random.normal(0, 0.03, len(dates)), 2),
        'Total_PF': np.round(0.92 + np.random.normal(0, 0.02, len(dates)), 2),
        
        # Currents
        'R_Phase_Active_Current': np.round(consumption / voltage_base * 0.9, 2),
        'Y_Phase_Active_Current': np.round(consumption / voltage_base * 0.85, 2),
        'B_Phase_Active_Current': np.round(consumption / voltage_base * 0.95, 2),
        
        # Active power
        'R_Phase_Active_Power': np.round(consumption * 1000 / 3 * 0.9, 2),  # in Watts
        'Y_Phase_Active_Power': np.round(consumption * 1000 / 3 * 0.85, 2),  # in Watts
        'B_Phase_Active_Power': np.round(consumption * 1000 / 3 * 0.95, 2),  # in Watts
        '3_Phase_Active_Power': np.round(consumption * 1000, 2),  # in Watts
    })
    
    # Calculate derived values
    df['Average_Phase_Voltage'] = np.round((df['R_Ph_Voltage'] + df['Y_Ph_Voltage'] + df['B_Ph_Voltage']) / 3, 1)
    df['Neutral_Line_current'] = np.round(np.abs(df['R_Phase_Active_Current'] + df['Y_Phase_Active_Current'] + df['B_Phase_Active_Current']) * 0.1, 2)
    
    # Calculate reactive currents
    for phase in ['R', 'Y', 'B']:
        pf = df[f'{phase}_PF']
        active_current = df[f'{phase}_Phase_Active_Current']
        df[f'{phase}_Phase_Reactive_Current'] = np.round(active_current * np.tan(np.arccos(pf)), 2)
    
    # Calculate reactive powers
    for phase in ['R', 'Y', 'B']:
        active_power = df[f'{phase}_Phase_Active_Power']
        pf = df[f'{phase}_PF']
        df[f'{phase}_Phase_Reactive_Power'] = np.round(active_power * np.tan(np.arccos(pf)), 2)
        df[f'{phase}_Phase_Apparent_Power'] = np.round(active_power / pf, 2)
    
    # Calculate 3-phase reactive and apparent power
    df['3_Phase_Reactive_Power'] = df['R_Phase_Reactive_Power'] + df['Y_Phase_Reactive_Power'] + df['B_Phase_Reactive_Power']
    df['3_Phase_Apparent_Power'] = df['R_Phase_Apparent_Power'] + df['Y_Phase_Apparent_Power'] + df['B_Phase_Apparent_Power']
    
    # Save to a CSV file
    sample_file = os.path.join(app.config['UPLOAD_FOLDER'], 'sample_meter_data.csv')
    df.to_csv(sample_file, index=False)
    
    # Return the same format as the upload endpoint
    return jsonify({
        'success': True,
        'filename': 'sample_meter_data.csv',
        'columns': df.columns.tolist(),
        'preview': df.head(10).to_dict('records'),
        'dtypes': {col: str(df[col].dtype) for col in df.columns},
        'row_count': len(df)
    })

@app.route('/analyze', methods=['POST'])
def analyze_data():
    data = request.json
    filename = data.get('filename')
    analysis_type = data.get('analysis_type')
    
    if not filename or not analysis_type:
        return jsonify({'error': 'Missing required parameters'}), 400
    
    filepath = os.path.join(app.config['UPLOAD_FOLDER'], secure_filename(filename))
    
    try:
        df = pd.read_csv(filepath)
        results = {}
        
        if analysis_type == 'statistics':
            # Calculate basic statistics
            numeric_cols = df.select_dtypes(include=[np.number]).columns.tolist()
            stats = {}
            for col in numeric_cols:
                stats[col] = {
                    'mean': float(df[col].mean()),
                    'median': float(df[col].median()),
                    'std': float(df[col].std()),
                    'min': float(df[col].min()),
                    'max': float(df[col].max()),
                    'q1': float(df[col].quantile(0.25)),
                    'q3': float(df[col].quantile(0.75))
                }
            results['statistics'] = stats
            
        elif analysis_type == 'correlation':
            # Calculate correlation matrix
            numeric_cols = df.select_dtypes(include=[np.number]).columns.tolist()
            corr_matrix = df[numeric_cols].corr().round(3)
            # Convert to dictionary format
            corr_dict = {}
            for col in corr_matrix.columns:
                corr_dict[col] = corr_matrix[col].to_dict()
            results['correlation'] = corr_dict
            
        elif analysis_type == 'time_series':
            # Check if there's a date column
            date_cols = [col for col in df.columns if 'date' in col.lower() or 'time' in col.lower()]
            if not date_cols:
                return jsonify({'error': 'No date or time column found for time series analysis'}), 400
            
            date_col = date_cols[0]
            # Convert to datetime if not already
            try:
                df[date_col] = pd.to_datetime(df[date_col])
            except:
                return jsonify({'error': f'Could not convert {date_col} to datetime'}), 400
            
            # Get numeric columns for analysis
            numeric_cols = df.select_dtypes(include=[np.number]).columns.tolist()
            # Calculate monthly averages
            df['month'] = df[date_col].dt.to_period('M')
            monthly_avg = df.groupby('month')[numeric_cols].mean().reset_index()
            monthly_avg['month'] = monthly_avg['month'].astype(str)
            results['time_series'] = {
                'monthly_averages': monthly_avg.to_dict('records')
            }
            
        elif analysis_type == 'anomaly_detection':
            # Simple anomaly detection using Z-score
            numeric_cols = df.select_dtypes(include=[np.number]).columns.tolist()
            anomalies = {}
            for col in numeric_cols:
                mean = df[col].mean()
                std = df[col].std()
                # Consider values beyond 3 standard deviations as anomalies
                lower_bound = mean - 3 * std
                upper_bound = mean + 3 * std
                anomaly_indices = df[(df[col] < lower_bound) | (df[col] > upper_bound)].index.tolist()
                if anomaly_indices:
                    anomalies[col] = {
                        'indices': anomaly_indices[:10],  # Limit to first 10 anomalies
                        'values': df.loc[anomaly_indices[:10], col].tolist(),
                        'lower_bound': float(lower_bound),
                        'upper_bound': float(upper_bound)
                    }
            results['anomalies'] = anomalies
            
        elif analysis_type == 'patterns':
            # Detect patterns - simple trend analysis
            numeric_cols = df.select_dtypes(include=[np.number]).columns.tolist()
            patterns = {}
            # Check for date columns
            date_col = None
            for col in df.columns:
                try:
                    pd.to_datetime(df[col])
                    date_col = col
                    break
                except:
                    continue
            
            if date_col:
                df['temp_date'] = pd.to_datetime(df[date_col])
                df = df.sort_values('temp_date')
                for col in numeric_cols:
                    # Calculate trend (simple linear regression)
                    x = np.arange(len(df))
                    y = df[col].values
                    # Calculate slope using numpy's polyfit
                    try:
                        slope, intercept = np.polyfit(x, y, 1)
                        patterns[col] = {
                            'trend': 'increasing' if slope > 0.01 else 'decreasing' if slope < -0.01 else 'stable',
                            'slope': float(slope),
                            'trend_strength': abs(float(slope)) / df[col].std() if df[col].std() > 0 else 0
                        }
                    except Exception as e:
                        patterns[col] = {
                            'trend': 'unknown',
                            'error': str(e)
                        }
                df = df.drop('temp_date', axis=1)
                results['patterns'] = patterns
            else:
                results['patterns'] = {'error': 'No date column found for pattern analysis'}
        
        else:
            return jsonify({'error': f'Unknown analysis type: {analysis_type}'}), 400
        
        return jsonify({
            'success': True,
            'analysis_type': analysis_type,
            'results': results
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/data/<filename>')
def get_data(filename):
    filepath = os.path.join(app.config['UPLOAD_FOLDER'], secure_filename(filename))
    
    try:
        df = pd.read_csv(filepath)
        
        # Get columns requested in query parameters
        x_col = request.args.get('x')
        y_col = request.args.get('y')
        
        if not x_col or not y_col:
            return jsonify({'error': 'Missing x or y column parameters'}), 400
        
        if x_col not in df.columns or y_col not in df.columns:
            return jsonify({'error': 'Requested columns not found in data'}), 400
        
        # Extract the data for the requested columns
        data = {
            'x': df[x_col].tolist(),
            'y': df[y_col].tolist(),
            'x_label': x_col,
            'y_label': y_col
        }
        
        return jsonify({
            'success': True,
            'data': data
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# Generate PDF bill
@app.route('/generate_bill_pdf', methods=['POST'])
def generate_bill_pdf():
    try:
        data = request.json
        
        # Create a PDF in memory
        buffer = io.BytesIO()
        doc = SimpleDocTemplate(buffer, pagesize=letter)
        elements = []
        
        # Styles
        styles = getSampleStyleSheet()
        title_style = styles['Heading1']
        subtitle_style = styles['Heading2']
        normal_style = styles['Normal']
        
        # Title
        elements.append(Paragraph("Electricity Bill", title_style))
        elements.append(Spacer(1, 12))
        
        # Customer Information
        elements.append(Paragraph("Customer Information", subtitle_style))
        elements.append(Spacer(1, 6))
        
        customer_info = [
            ["Customer Name:", "Sample Customer"],
            ["Account Number:", "MAHA" + str(random.randint(10000000, 99999999))],
            ["Billing Period:", data.get('billing_period', 'Current Month')],
            ["Bill Date:", datetime.now().strftime("%d-%m-%Y")]
        ]
        
        t = Table(customer_info, colWidths=[150, 350])
        t.setStyle(TableStyle([
            ('FONTNAME', (0, 0), (-1, -1), 'Helvetica'),
            ('FONTSIZE', (0, 0), (-1, -1), 10),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
        ]))
        elements.append(t)
        elements.append(Spacer(1, 12))
        
        # Tariff Information
        elements.append(Paragraph("Maharashtra Electricity Tariff Rates", subtitle_style))
        elements.append(Spacer(1, 6))
        
        tariff_info = [
            ["Tariff Category:", data.get('tariff_type', 'Residential')],
            ["Energy Charge (0-100 units):", "₹3.05/unit"],
            ["Energy Charge (101-300 units):", "₹6.40/unit"],
            ["Energy Charge (301-500 units):", "₹8.50/unit"],
            ["Energy Charge (501+ units):", "₹9.50/unit"],
            ["Fixed Charge:", "₹90.00/month"]
        ]
        
        t = Table(tariff_info, colWidths=[200, 300])
        t.setStyle(TableStyle([
            ('FONTNAME', (0, 0), (-1, -1), 'Helvetica'),
            ('FONTSIZE', (0, 0), (-1, -1), 10),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
        ]))
        elements.append(t)
        elements.append(Spacer(1, 12))
        
        # Consumption Summary
        elements.append(Paragraph("Consumption Summary", subtitle_style))
        elements.append(Spacer(1, 6))
        
        total_consumption = data.get('total_consumption', 0)
        billing_days = data.get('billing_days', 30)
        
        consumption_summary = [
            ["Total Consumption:", f"{total_consumption} kWh"],
            ["Billing Period:", f"{billing_days} days"],
            ["Average Daily Consumption:", f"{round(total_consumption/billing_days, 2)} kWh"]
        ]
        
        t = Table(consumption_summary, colWidths=[200, 300])
        t.setStyle(TableStyle([
            ('FONTNAME', (0, 0), (-1, -1), 'Helvetica'),
            ('FONTSIZE', (0, 0), (-1, -1), 10),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
        ]))
        elements.append(t)
        elements.append(Spacer(1, 12))
        
        # Bill Breakdown
        elements.append(Paragraph("Bill Breakdown", subtitle_style))
        elements.append(Spacer(1, 6))
        
        energy_charges = data.get('energy_charges', 0)
        fixed_charges = data.get('fixed_charges', 0)
        total_bill = energy_charges + fixed_charges
        
        bill_data = [
            ["Description", "Units", "Rate (₹)", "Amount (₹)"],
            ["Energy Charges", f"{total_consumption} kWh", "Variable", f"{energy_charges:.2f}"],
            ["Fixed Charges", "1 month", "90.00", f"{fixed_charges:.2f}"],
            ["Total Amount Due", "", "", f"{total_bill:.2f}"]
        ]
        
        t = Table(bill_data, colWidths=[150, 100, 100, 150])
        t.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.lightgrey),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.black),
            ('ALIGN', (0, 0), (-1, 0), 'CENTER'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, 0), 10),
            ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
            ('BACKGROUND', (0, -1), (-1, -1), colors.lightgrey),
            ('FONTNAME', (0, -1), (-1, -1), 'Helvetica-Bold'),
            ('GRID', (0, 0), (-1, -1), 1, colors.black),
            ('ALIGN', (1, 1), (-1, -1), 'RIGHT'),
        ]))
        elements.append(t)
        
        # Build PDF
        doc.build(elements)
        
        # Get PDF from buffer
        pdf_data = buffer.getvalue()
        buffer.close()
        
        # Create response
        response = make_response(pdf_data)
        response.headers['Content-Type'] = 'application/pdf'
        response.headers['Content-Disposition'] = 'attachment; filename=electricity_bill.pdf'
        
        return response
    
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)})

if __name__ == '__main__':
    app.run(debug=True)