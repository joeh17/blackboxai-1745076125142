# DataLexis

This is a data analysis dashboard web app inspired by Microsoft Power BI. It allows you to upload CSV files, view statistical summaries, and interactive charts.

## How to Run

1. Make sure you have Python 3 installed.

2. Install backend dependencies:

```bash
pip install -r backend/requirements.txt
```

3. Run the backend server:

```bash
python3 backend/app.py
```

4. Start a local HTTP server for the frontend in the project directory:

```bash
python3 -m http.server 8000
```

5. Open your web browser and go to:

[http://localhost:8000/landing.html](http://localhost:8000/landing.html)

6. The landing page will load. Click "Enter Dashboard" to access the main app.

## Features

- Responsive dashboard UI with Tailwind CSS
- CSV file upload and client-side data processing
- Statistical summaries: mean, median, correlation matrix
- Interactive charts: bar, line, pie charts using Chart.js
- Google Fonts and Font Awesome icons for modern UI

Enjoy exploring your data!
