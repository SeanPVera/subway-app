const path = require('path');
const fs = require('fs');
const express = require('express');
const { parseStringPromise } = require('xml2js');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;
const SERVICE_STATUS_URL = process.env.MTA_SERVICE_STATUS_URL || 'https://api.mta.info/serviceStatus';
const SAMPLE_STATUS_PATH = path.join(__dirname, 'data', 'sample-service-status.xml');
const STATIONS_PATH = path.join(__dirname, 'data', 'stations.json');
const PARSE_OPTIONS = { explicitArray: false, trim: true };
const FETCH_TIMEOUT_MS = Number(process.env.FETCH_TIMEOUT_MS || 7000);
const FETCH_RETRIES = Number(process.env.FETCH_RETRIES || 3);
const RETRY_BASE_DELAY_MS = Number(process.env.RETRY_BASE_DELAY_MS || 400);

const providerHealth = {
  serviceStatus: { state: 'unknown', lastAttemptAt: null, lastSuccessAt: null, lastError: null },
};

let lastKnownGoodStatus = null;
let lastKnownGoodFetchedAt = null;

const stations = JSON.parse(fs.readFileSync(STATIONS_PATH, 'utf-8'));

app.use(express.static(path.join(__dirname, 'public')));

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

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

function parseRoutesFromLineName(name = '') {
  return name
    .split(',')
    .map((route) => route.trim().toUpperCase())
    .filter(Boolean);
}

function addStatusMetadata(payload, source, fetchedAt, stale = false) {
  return {
    ...payload,
    source,
    fetchedAt,
    stale,
    ageSeconds: Math.max(0, Math.floor((Date.now() - new Date(fetchedAt).getTime()) / 1000)),
  };
}

async function fetchWithRetry(url, options, retries = FETCH_RETRIES) {
  let lastError;

  for (let attempt = 1; attempt <= retries; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    providerHealth.serviceStatus.lastAttemptAt = new Date().toISOString();

    try {
      const response = await fetch(url, { ...options, signal: controller.signal });
      clearTimeout(timeout);

      if (!response.ok) {
        throw new Error(`MTA service returned ${response.status}`);
      }

      providerHealth.serviceStatus.state = 'ok';
      providerHealth.serviceStatus.lastSuccessAt = new Date().toISOString();
      providerHealth.serviceStatus.lastError = null;

      return response;
    } catch (error) {
      clearTimeout(timeout);
      lastError = error;
      providerHealth.serviceStatus.state = 'degraded';
      providerHealth.serviceStatus.lastError = error.message;

      if (attempt < retries) {
        await sleep(RETRY_BASE_DELAY_MS * 2 ** (attempt - 1));
      }
    }
  }

  throw lastError;
}

async function fetchLiveStatus() {
  const headers = {};
  if (process.env.MTA_API_KEY) {
    headers['x-api-key'] = process.env.MTA_API_KEY;
  }

  const response = await fetchWithRetry(SERVICE_STATUS_URL, { headers });
  const xmlText = await response.text();
  const xml = await parseStringPromise(xmlText, PARSE_OPTIONS);
  const normalized = normalizeServiceStatus(xml);

  lastKnownGoodStatus = normalized;
  lastKnownGoodFetchedAt = new Date().toISOString();

  return addStatusMetadata(normalized, 'live', lastKnownGoodFetchedAt, false);
}

async function fetchSampleStatus() {
  const xmlText = fs.readFileSync(SAMPLE_STATUS_PATH, 'utf-8');
  const xml = await parseStringPromise(xmlText, PARSE_OPTIONS);
  const normalized = normalizeServiceStatus(xml);
  return addStatusMetadata(normalized, 'sample', new Date().toISOString(), true);
}

async function resolveStatus() {
  try {
    return await fetchLiveStatus();
  } catch (error) {
    console.error('Live status failed, trying fallbacks:', error.message);

    if (lastKnownGoodStatus && lastKnownGoodFetchedAt) {
      return addStatusMetadata(lastKnownGoodStatus, 'cache', lastKnownGoodFetchedAt, true);
    }

    return fetchSampleStatus();
  }
}

app.get('/api/status', async (_req, res) => {
  try {
    const data = await resolveStatus();
    res.json(data);
  } catch (fallbackError) {
    console.error('All data sources failed:', fallbackError.message);
    res.status(500).json({ message: 'Unable to load subway status right now.' });
  }
});

app.get('/api/stations', (req, res) => {
  const query = (req.query.query || '').toString().trim().toLowerCase();

  const filtered = stations.filter((station) => {
    if (!query) return true;
    return (
      station.name.toLowerCase().includes(query)
      || station.borough.toLowerCase().includes(query)
      || station.routes.some((route) => route.toLowerCase().includes(query))
    );
  });

  res.json({ total: filtered.length, stations: filtered.slice(0, 25) });
});

app.get('/api/alerts', async (req, res) => {
  try {
    const routeFilter = (req.query.route || '').toString().trim().toUpperCase();
    const stationId = (req.query.stationId || '').toString().trim();
    const station = stationId ? stations.find((item) => item.id === stationId) : null;

    const status = await resolveStatus();

    const routePool = new Set();
    if (routeFilter) routePool.add(routeFilter);
    if (station) {
      station.routes.forEach((route) => routePool.add(route));
    }

    const alerts = status.lines
      .filter((line) => line.status !== 'GOOD SERVICE')
      .map((line) => ({
        ...line,
        routes: parseRoutesFromLineName(line.name),
      }))
      .filter((line) => {
        if (!routePool.size) return true;
        return line.routes.some((route) => routePool.has(route));
      });

    res.json({
      source: status.source,
      fetchedAt: status.fetchedAt,
      stale: status.stale,
      total: alerts.length,
      alerts,
      station: station || null,
    });
  } catch (error) {
    res.status(500).json({ message: 'Unable to load alerts right now.' });
  }
});

app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    providers: providerHealth,
    cache: {
      available: Boolean(lastKnownGoodStatus),
      fetchedAt: lastKnownGoodFetchedAt,
    },
  });
});

app.use((_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Subway status app listening on http://localhost:${PORT}`);
});
