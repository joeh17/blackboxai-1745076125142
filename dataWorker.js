// Web worker for processing CSV data

self.onmessage = function(event) {
  const text = event.data;
  const lines = text.trim().split('\\n');
  const headers = lines[0].split(',').map(h => h.trim());
  const rawData = lines.slice(1).map(line => {
    const values = line.split(',').map(v => v.trim());
    const obj = {};
    headers.forEach((header, i) => {
      obj[header] = isNaN(values[i]) ? values[i] : parseFloat(values[i]);
    });
    return obj;
  });

  const numericColumns = headers.filter(h => typeof rawData[0][h] === 'number');

  self.postMessage({ headers, rawData, numericColumns });
};
