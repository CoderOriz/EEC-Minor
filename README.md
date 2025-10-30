# CSV-to-Graphical Representation

A Flask-based web application that converts meter data stored in CSV format into interactive graphs. The system makes large datasets easy to analyze, helping in detecting usage patterns and anomalies.

## Features

- CSV file upload and parsing
- Interactive data visualization with multiple chart types
- Automatic pattern detection
- Anomaly identification
- Statistical analysis
- Export functionality for graphs and analysis results
- Sample data generation for testing

## Installation

1. Clone this repository
2. Install the required dependencies:

```
pip install -r requirements.txt
```

## Usage

1. Start the Flask server:

```
python app.py
```

2. Open your web browser and navigate to `http://127.0.0.1:5000`
3. Upload a CSV file or use the sample data
4. Select chart type and axes
5. Generate visualizations
6. Analyze the data using the provided tools

## Project Structure

- `app.py` - Flask application with backend logic
- `templates/` - HTML templates
- `static/` - CSS, JavaScript, and other static files
- `uploads/` - Directory for uploaded CSV files

## Requirements

- Python 3.7+
- Flask
- Pandas
- NumPy

## License

This project is open source and available under the MIT License.