document.addEventListener('DOMContentLoaded', () => {
  const csvFileInput = document.getElementById('csvFile');
  const statsContainer = document.getElementById('stats');
  const filtersContainer = document.getElementById('filters');

  let rawData = [];
  let headers = [];
  let numericColumns = [];

  let barChart, lineChart, pieChart;

  // Web worker for data processing
  let dataWorker;

  // Debounce utility function
  function debounce(func, wait) {
    let timeout;
    return function(...args) {
      clearTimeout(timeout);
      timeout = setTimeout(() => func.apply(this, args), wait);
    };
  }

  csvFileInput.addEventListener('change', (event) => {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const text = e.target.result;
        if (dataWorker) {
          dataWorker.terminate();
        }
        dataWorker = new Worker('dataWorker.js');
        dataWorker.postMessage(text);
        dataWorker.onmessage = (event) => {
          const { headers: h, rawData: rd, numericColumns: nc } = event.data;
          headers = h;
          rawData = rd;
          numericColumns = nc;
          renderFilters();
          renderStats();
          renderCharts();
          updatePagination();
          loadLayout();
          addDragAndDrop();
        };
      };
      reader.readAsText(file);
    }
  });

  function processCSV(text) {
    // This function is now handled by the web worker
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

      // Debounced event listeners for inputs
      inputMin.addEventListener('change', debounce(() => {
        if (parseFloat(inputMin.value) > parseFloat(inputMax.value)) {
          inputMin.value = inputMax.value;
        }
        renderStats();
        renderCharts();
        saveLayout();
      }, 300));

      inputMax.addEventListener('change', debounce(() => {
        if (parseFloat(inputMax.value) < parseFloat(inputMin.value)) {
          inputMax.value = inputMin.value;
        }
        renderStats();
        renderCharts();
        saveLayout();
      }, 300));

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
      const stddev = calculateStdDev(values, mean);
      const variance = stddev * stddev;
      const statDiv = document.createElement('div');
      statDiv.className = 'bg-white p-4 rounded shadow';

      statDiv.innerHTML = `
        <h4 class="font-semibold mb-2">${col}</h4>
        <p>Mean: ${mean.toFixed(2)}</p>
        <p>Median: ${median.toFixed(2)}</p>
        <p>Standard Deviation: ${stddev.toFixed(2)}</p>
        <p>Variance: ${variance.toFixed(2)}</p>
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

  function calculateStdDev(arr, mean) {
    const n = arr.length;
    const variance = arr.reduce((acc, val) => acc + (val - mean) ** 2, 0) / n;
    return Math.sqrt(variance);
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

  // Pagination state
  const pagination = {
    currentPage: 1,
    pageSize: 50,
  };

  function updatePagination() {
    const data = getFilteredData();
    const totalPages = Math.ceil(data.length / pagination.pageSize);
    if (pagination.currentPage > totalPages) {
      pagination.currentPage = totalPages || 1;
    }
    renderPaginationControls(totalPages);
    renderCharts();
  }

  function renderPaginationControls(totalPages) {
    let paginationContainer = document.getElementById('paginationControls');
    if (!paginationContainer) {
      paginationContainer = document.createElement('div');
      paginationContainer.id = 'paginationControls';
      paginationContainer.className = 'flex justify-center space-x-2 mt-4';
      document.querySelector('main').appendChild(paginationContainer);
    }
    paginationContainer.innerHTML = '';

    const prevBtn = document.createElement('button');
    prevBtn.textContent = 'Previous';
    prevBtn.disabled = pagination.currentPage === 1;
    prevBtn.className = 'px-3 py-1 bg-gray-300 rounded disabled:opacity-50';
    prevBtn.addEventListener('click', () => {
      if (pagination.currentPage > 1) {
        pagination.currentPage--;
        updatePagination();
      }
    });
    paginationContainer.appendChild(prevBtn);

    const pageInfo = document.createElement('span');
    pageInfo.textContent = `Page ${pagination.currentPage} of ${totalPages}`;
    pageInfo.className = 'px-3 py-1';
    paginationContainer.appendChild(pageInfo);

    const nextBtn = document.createElement('button');
    nextBtn.textContent = 'Next';
    nextBtn.disabled = pagination.currentPage === totalPages;
    nextBtn.className = 'px-3 py-1 bg-gray-300 rounded disabled:opacity-50';
    nextBtn.addEventListener('click', () => {
      if (pagination.currentPage < totalPages) {
        pagination.currentPage++;
        updatePagination();
      }
    });
    paginationContainer.appendChild(nextBtn);
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

  // Export filtered data as CSV
  const exportCsvBtn = document.getElementById('exportCsvBtn');
  exportCsvBtn.addEventListener('click', () => {
    const data = getFilteredData();
    if (data.length === 0) {
      alert('No data to export.');
      return;
    }
    const csvContent = convertToCSV(data);
    downloadFile(csvContent, 'datalexis_export.csv', 'text/csv');
  });

  // Export filtered data as PDF (simple text-based)
  const exportPdfBtn = document.getElementById('exportPdfBtn');
  exportPdfBtn.addEventListener('click', () => {
    const data = getFilteredData();
    if (data.length === 0) {
      alert('No data to export.');
      return;
    }
    const pdfContent = convertToPDFText(data);
    downloadFile(pdfContent, 'datalexis_export.txt', 'text/plain');
  });

  // Theme toggle
  const themeToggleBtn = document.getElementById('themeToggleBtn');
  themeToggleBtn.addEventListener('click', () => {
    document.documentElement.classList.toggle('dark');
  });

  function convertToCSV(data) {
    if (data.length === 0) return '';
    const keys = Object.keys(data[0]);
    const lines = data.map(row => keys.map(k => `"${row[k]}"`).join(','));
    return keys.join(',') + '\n' + lines.join('\n');
  }

  function convertToPDFText(data) {
    if (data.length === 0) return '';
    const keys = Object.keys(data[0]);
    let text = keys.join('\t') + '\n';
    data.forEach(row => {
      text += keys.map(k => row[k]).join('\t') + '\n';
    });
    return text;
  }

  function downloadFile(content, filename, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  // Save layout preferences to localStorage
  function saveLayout() {
    const statsContainer = document.getElementById('stats');
    const chartsContainer = document.getElementById('chartsContainer');

    const statsOrder = Array.from(statsContainer.children).map(child => child.textContent.trim());
    const chartsOrder = Array.from(chartsContainer.children).map(child => child.id);

    const layout = {
      statsOrder,
      chartsOrder
    };
    localStorage.setItem('datalexis_layout', JSON.stringify(layout));
  }

  // Load layout preferences from localStorage
  function loadLayout() {
    const layoutStr = localStorage.getItem('datalexis_layout');
    if (!layoutStr) return;

    const layout = JSON.parse(layoutStr);
    const statsContainer = document.getElementById('stats');
    const chartsContainer = document.getElementById('chartsContainer');

    // Reorder stats
    if (layout.statsOrder) {
      const statsMap = {};
      Array.from(statsContainer.children).forEach(child => {
        statsMap[child.textContent.trim()] = child;
      });
      layout.statsOrder.forEach(text => {
        if (statsMap[text]) {
          statsContainer.appendChild(statsMap[text]);
        }
      });
    }

    // Reorder charts
    if (layout.chartsOrder) {
      const chartsMap = {};
      Array.from(chartsContainer.children).forEach(child => {
        chartsMap[child.id] = child;
      });
      layout.chartsOrder.forEach(id => {
        if (chartsMap[id]) {
          chartsContainer.appendChild(chartsMap[id]);
        }
      });
    }
  }

  // Drag and drop handlers
  function addDragAndDrop() {
    const statsContainer = document.getElementById('stats');
    const chartsContainer = document.getElementById('chartsContainer');

    let dragSrcEl = null;

    function handleDragStart(e) {
      dragSrcEl = this;
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/html', this.outerHTML);
      this.classList.add('opacity-50');
    }

    function handleDragOver(e) {
      if (e.preventDefault) {
        e.preventDefault();
      }
      e.dataTransfer.dropEffect = 'move';
      return false;
    }

    function handleDragEnter() {
      this.classList.add('border-4', 'border-indigo-500');
    }

    function handleDragLeave() {
      this.classList.remove('border-4', 'border-indigo-500');
    }

    function handleDrop(e) {
      if (e.stopPropagation) {
        e.stopPropagation();
      }
      if (dragSrcEl !== this) {
        this.parentNode.removeChild(dragSrcEl);
        const dropHTML = e.dataTransfer.getData('text/html');
        this.insertAdjacentHTML('beforebegin', dropHTML);
        const dropElem = this.previousSibling;
        addDnDHandlers(dropElem);
        saveLayout();
      }
      this.classList.remove('border-4', 'border-indigo-500');
      return false;
    }

    function handleDragEnd() {
      this.classList.remove('opacity-50');
      const items = [...statsContainer.children, ...chartsContainer.children];
      items.forEach(item => item.classList.remove('border-4', 'border-indigo-500'));
    }

    function addDnDHandlers(elem) {
      elem.addEventListener('dragstart', handleDragStart, false);
      elem.addEventListener('dragenter', handleDragEnter, false);
      elem.addEventListener('dragover', handleDragOver, false);
      elem.addEventListener('dragleave', handleDragLeave, false);
      elem.addEventListener('drop', handleDrop, false);
      elem.addEventListener('dragend', handleDragEnd, false);
    }

    Array.from(statsContainer.children).forEach(addDnDHandlers);
    Array.from(chartsContainer.children).forEach(addDnDHandlers);
  }

  // Initialize drag and drop and load layout on DOMContentLoaded
  document.addEventListener('DOMContentLoaded', () => {
    loadLayout();
    addDragAndDrop();
  });
});
