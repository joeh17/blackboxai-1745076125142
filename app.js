document.addEventListener('DOMContentLoaded', () => {
  const csvFileInput = document.getElementById('csvFile');
  const statsContainer = document.getElementById('stats');
  const filtersContainer = document.getElementById('filters');

  let rawData = [];
  let headers = [];
  let numericColumns = [];

  let barChart, lineChart, pieChart;

  csvFileInput.addEventListener('change', (event) => {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const text = e.target.result;
        processCSV(text);
      };
      reader.readAsText(file);
    }
  });

  function processCSV(text) {
    const lines = text.trim().split('\n');
    headers = lines[0].split(',').map(h => h.trim());
    rawData = lines.slice(1).map(line => {
      const values = line.split(',').map(v => v.trim());
      const obj = {};
      headers.forEach((header, i) => {
        obj[header] = isNaN(values[i]) ? values[i] : parseFloat(values[i]);
      });
      return obj;
    });

    numericColumns = headers.filter(h => typeof rawData[0][h] === 'number');

    renderFilters();
    renderStats();
    renderCharts();
  }

  function renderFilters() {
    filtersContainer.innerHTML = '';
    if (numericColumns.length === 0) {
      filtersContainer.classList.add('hidden');
      return;
    }
    filtersContainer.classList.remove('hidden');
    filtersContainer.innerHTML = '<h3 class="font-semibold mb-2">Filters</h3>';

    numericColumns.forEach(col => {
      const div = document.createElement('div');
      div.className = 'mb-4';

      const label = document.createElement('label');
      label.className = 'block mb-1 font-medium text-gray-700';
      label.textContent = col;

      const min = Math.min(...rawData.map(d => d[col]));
      const max = Math.max(...rawData.map(d => d[col]));

      const inputMin = document.createElement('input');
      inputMin.type = 'number';
      inputMin.value = min;
      inputMin.min = min;
      inputMin.max = max;
      inputMin.className = 'w-20 p-1 border border-gray-300 rounded mr-2';

      const inputMax = document.createElement('input');
      inputMax.type = 'number';
      inputMax.value = max;
      inputMax.min = min;
      inputMax.max = max;
      inputMax.className = 'w-20 p-1 border border-gray-300 rounded';

      inputMin.addEventListener('change', () => {
        if (parseFloat(inputMin.value) > parseFloat(inputMax.value)) {
          inputMin.value = inputMax.value;
        }
        renderStats();
        renderCharts();
      });

      inputMax.addEventListener('change', () => {
        if (parseFloat(inputMax.value) < parseFloat(inputMin.value)) {
          inputMax.value = inputMin.value;
        }
        renderStats();
        renderCharts();
      });

      div.appendChild(label);
      div.appendChild(inputMin);
      div.appendChild(inputMax);
      filtersContainer.appendChild(div);
    });
  }

  function getFilteredData() {
    const filters = {};
    const filterDivs = filtersContainer.querySelectorAll('div.mb-4');
    filterDivs.forEach(div => {
      const label = div.querySelector('label').textContent;
      const inputs = div.querySelectorAll('input');
      filters[label] = {
        min: parseFloat(inputs[0].value),
        max: parseFloat(inputs[1].value)
      };
    });

    return rawData.filter(row => {
      return Object.entries(filters).every(([col, range]) => {
        const val = row[col];
        return val >= range.min && val <= range.max;
      });
    });
  }

  function renderStats() {
    const data = getFilteredData();
    statsContainer.innerHTML = '';

    if (numericColumns.length === 0) {
      statsContainer.innerHTML = '<p class="text-gray-600">No numeric data available for statistics.</p>';
      return;
    }

    numericColumns.forEach(col => {
      const values = data.map(d => d[col]);
      const mean = (values.reduce((a, b) => a + b, 0) / values.length) || 0;
      const median = calculateMedian(values);
      const statDiv = document.createElement('div');
      statDiv.className = 'bg-white p-4 rounded shadow';

      statDiv.innerHTML = `
        <h4 class="font-semibold mb-2">${col}</h4>
        <p>Mean: ${mean.toFixed(2)}</p>
        <p>Median: ${median.toFixed(2)}</p>
      `;
      statsContainer.appendChild(statDiv);
    });

    // Correlation matrix (pairwise)
    if (numericColumns.length > 1) {
      const corrDiv = document.createElement('div');
      corrDiv.className = 'bg-white p-4 rounded shadow col-span-full';
      corrDiv.innerHTML = '<h4 class="font-semibold mb-2">Correlation Matrix</h4>';
      const table = document.createElement('table');
      table.className = 'table-auto border-collapse border border-gray-300 w-full text-sm';

      // Header row
      const thead = document.createElement('thead');
      const headerRow = document.createElement('tr');
      headerRow.appendChild(document.createElement('th')); // empty corner cell
      numericColumns.forEach(col => {
        const th = document.createElement('th');
        th.className = 'border border-gray-300 px-2 py-1';
        th.textContent = col;
        headerRow.appendChild(th);
      });
      thead.appendChild(headerRow);
      table.appendChild(thead);

      // Body rows
      const tbody = document.createElement('tbody');
      numericColumns.forEach(rowCol => {
        const tr = document.createElement('tr');
        const th = document.createElement('th');
        th.className = 'border border-gray-300 px-2 py-1 font-semibold text-left';
        th.textContent = rowCol;
        tr.appendChild(th);
        numericColumns.forEach(col => {
          const td = document.createElement('td');
          td.className = 'border border-gray-300 px-2 py-1 text-center';
          if (rowCol === col) {
            td.textContent = '1.00';
          } else {
            const corr = calculateCorrelation(data.map(d => d[rowCol]), data.map(d => d[col]));
            td.textContent = corr.toFixed(2);
          }
          tr.appendChild(td);
        });
        tbody.appendChild(tr);
      });
      table.appendChild(tbody);
      corrDiv.appendChild(table);
      statsContainer.appendChild(corrDiv);
    }
  }

  function calculateMedian(arr) {
    const sorted = arr.slice().sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    if (sorted.length % 2 === 0) {
      return (sorted[mid - 1] + sorted[mid]) / 2;
    } else {
      return sorted[mid];
    }
  }

  function calculateCorrelation(x, y) {
    const n = x.length;
    const meanX = x.reduce((a, b) => a + b, 0) / n;
    const meanY = y.reduce((a, b) => a + b, 0) / n;
    let numerator = 0;
    let denomX = 0;
    let denomY = 0;
    for (let i = 0; i < n; i++) {
      const dx = x[i] - meanX;
      const dy = y[i] - meanY;
      numerator += dx * dy;
      denomX += dx * dx;
      denomY += dy * dy;
    }
    return numerator / Math.sqrt(denomX * denomY);
  }

  function renderCharts() {
    const data = getFilteredData();
    if (data.length === 0) {
      clearCharts();
      return;
    }

    // Prepare data for charts
    // For simplicity, use first numeric column for bar and line charts
    // Use categorical column (first non-numeric) for labels if available
    const numericCol = numericColumns[0];
    const labels = data.map((d, i) => i + 1);
    const values = data.map(d => d[numericCol]);

    // Bar Chart
    if (barChart) {
      barChart.destroy();
    }
    const barCtx = document.getElementById('barChart').getContext('2d');
    barChart = new Chart(barCtx, {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          label: numericCol,
          data: values,
          backgroundColor: 'rgba(59, 130, 246, 0.7)',
          borderColor: 'rgba(59, 130, 246, 1)',
          borderWidth: 1
        }]
      },
      options: {
        responsive: true,
        plugins: {
          legend: { display: true },
          tooltip: { enabled: true }
        },
        scales: {
          y: { beginAtZero: true }
        }
      }
    });

    // Line Chart
    if (lineChart) {
      lineChart.destroy();
    }
    const lineCtx = document.getElementById('lineChart').getContext('2d');
    lineChart = new Chart(lineCtx, {
      type: 'line',
      data: {
        labels,
        datasets: [{
          label: numericCol,
          data: values,
          fill: false,
          borderColor: 'rgba(16, 185, 129, 1)',
          tension: 0.1
        }]
      },
      options: {
        responsive: true,
        plugins: {
          legend: { display: true },
          tooltip: { enabled: true }
        },
        scales: {
          y: { beginAtZero: true }
        }
      }
    });

    // Pie Chart
    if (pieChart) {
      pieChart.destroy();
    }
    const pieCtx = document.getElementById('pieChart').getContext('2d');

    // For pie chart, use first categorical column or first column if none categorical
    const categoricalCol = headers.find(h => typeof rawData[0][h] === 'string') || headers[0];
    const pieDataMap = {};
    data.forEach(d => {
      const key = d[categoricalCol];
      pieDataMap[key] = (pieDataMap[key] || 0) + 1;
    });
    const pieLabels = Object.keys(pieDataMap);
    const pieValues = Object.values(pieDataMap);

    pieChart = new Chart(pieCtx, {
      type: 'pie',
      data: {
        labels: pieLabels,
        datasets: [{
          label: categoricalCol,
          data: pieValues,
          backgroundColor: pieLabels.map(() => getRandomColor()),
          borderWidth: 1
        }]
      },
      options: {
        responsive: true,
        plugins: {
          legend: { position: 'right' },
          tooltip: { enabled: true }
        }
      }
    });
  }

  function clearCharts() {
    if (barChart) {
      barChart.destroy();
      barChart = null;
    }
    if (lineChart) {
      lineChart.destroy();
      lineChart = null;
    }
    if (pieChart) {
      pieChart.destroy();
      pieChart = null;
    }
  }

  function getRandomColor() {
    const r = Math.floor(Math.random() * 200) + 30;
    const g = Math.floor(Math.random() * 200) + 30;
    const b = Math.floor(Math.random() * 200) + 30;
    return `rgba(${r},${g},${b},0.7)`;
  }
});
