const path = require('path');
const fs = require('fs');
const express = require('express');
const { parseStringPromise } = require('xml2js');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;
const SERVICE_STATUS_URL = process.env.MTA_SERVICE_STATUS_URL || 'https://api.mta.info/serviceStatus';
const SAMPLE_STATUS_PATH = path.join(__dirname, 'data', 'sample-service-status.xml');
const PARSE_OPTIONS = { explicitArray: false, trim: true };

app.use(express.static(path.join(__dirname, 'public')));

function extractDescription(textField) {
  if (!textField) return '';
  if (typeof textField === 'string') return textField;
  if (Array.isArray(textField)) return extractDescription(textField[0]);
  if (typeof textField === 'object') {
    const nested = Object.values(textField)
      .flat()
      .map(extractDescription)
      .filter(Boolean);
    return nested.join(' ');
  }
  return '';
}

/**
 * Normalize the XML structure returned by the MTA service status feed into a
 * simple array of lines with a consistent shape for the frontend.
 */
function normalizeServiceStatus(xml) {
  const service = xml?.service || xml || {};
  const timestamp = service.timestamp || service.TimeStamp || service.timeStamp || '';
  const subwayLines = service.subway?.line || [];
  const lines = Array.isArray(subwayLines) ? subwayLines : subwayLines ? [subwayLines] : [];

  return {
    updatedAt: timestamp,
    lines: lines
      .filter(Boolean)
      .map((line) => {
        const time = line.Time || line.time || line.TimeStamp || '';
        const description = extractDescription(line.text);
        const statusValue = (line.status || 'Unknown').toUpperCase();
        return {
          name: (line.name || 'Unknown line').trim(),
          status: statusValue,
          lastUpdated: line.Date && time ? `${line.Date} ${time}` : timestamp,
          description: description.trim(),
        };
      }),
  };
}

async function fetchLiveStatus() {
  const headers = {};
  if (process.env.MTA_API_KEY) {
    headers['x-api-key'] = process.env.MTA_API_KEY;
  }

  const response = await fetch(SERVICE_STATUS_URL, { headers });

  if (!response.ok) {
    throw new Error(`MTA service returned ${response.status}`);
  }

  const xmlText = await response.text();
  const xml = await parseStringPromise(xmlText, PARSE_OPTIONS);
  return { source: 'live', ...normalizeServiceStatus(xml) };
}

async function fetchSampleStatus() {
  const xmlText = fs.readFileSync(SAMPLE_STATUS_PATH, 'utf-8');
  const xml = await parseStringPromise(xmlText, PARSE_OPTIONS);
  return { source: 'sample', ...normalizeServiceStatus(xml) };
}

app.get('/api/status', async (_req, res) => {
  try {
    const data = await fetchLiveStatus();
    res.json(data);
  } catch (error) {
    console.error('Falling back to sample service status:', error.message);
    try {
      const sample = await fetchSampleStatus();
      res.json(sample);
    } catch (fallbackError) {
      console.error('Sample data failed:', fallbackError.message);
      res.status(500).json({ message: 'Unable to load subway status right now.' });
    }
  }
});

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.use((_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Subway status app listening on http://localhost:${PORT}`);
});
