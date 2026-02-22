const statusGrid = document.getElementById('status-grid');
const updatedAtEl = document.getElementById('updated-at');
const refreshBtn = document.getElementById('refresh-btn');
const emptyState = document.getElementById('empty-state');
const sourceLabel = document.getElementById('source-label');
const staleIndicator = document.getElementById('stale-indicator');
const stationQuery = document.getElementById('station-query');
const stationSearchBtn = document.getElementById('station-search-btn');
const stationResults = document.getElementById('station-results');
const loadAlertsBtn = document.getElementById('load-alerts-btn');
const alertsList = document.getElementById('alerts-list');

const ROUTE_COLORS = {
  '1': 'red',
  '2': 'red',
  '3': 'red',
  '4': 'green',
  '5': 'green',
  '6': 'green',
  '7': 'purple',
  A: 'blue',
  C: 'blue',
  E: 'blue',
  B: 'orange',
  D: 'orange',
  F: 'orange',
  M: 'orange',
  G: 'lime',
  J: 'brown',
  Z: 'brown',
  L: 'gray',
  N: 'yellow',
  Q: 'yellow',
  R: 'yellow',
  W: 'yellow',
  S: 'gray-dark',
};

const STATUS_CLASSES = {
  'GOOD SERVICE': 'good',
  DELAYS: 'delays',
  'SERVICE CHANGE': 'delays',
  'PLANNED WORK': 'planned',
  SUSPENDED: 'bad',
};

function getRoutes(name) {
  return name
    .split(',')
    .map((route) => route.trim().toUpperCase())
    .filter(Boolean);
}

function getRouteClass(route) {
  return ROUTE_COLORS[route] ? `route-${ROUTE_COLORS[route]}` : 'route-default';
}

function renderStatus(status) {
  statusGrid.innerHTML = '';

  if (!status?.lines?.length) {
    emptyState.classList.remove('hidden');
    return;
  }

  emptyState.classList.add('hidden');
  sourceLabel.textContent = status.source === 'sample' ? 'Using sample data' : status.source === 'cache' ? 'Using cached data' : 'Live MTA feed';
  staleIndicator.textContent = status.stale ? `Stale (${status.ageSeconds}s old)` : 'Fresh';

  status.lines.forEach((line) => {
    const routes = getRoutes(line.name);
    const card = document.createElement('article');
    card.className = 'card';

    const header = document.createElement('div');
    header.className = 'card-header';

    const routesWrap = document.createElement('div');
    routesWrap.className = 'routes';

    routes.forEach((route) => {
      const bullet = document.createElement('span');
      bullet.className = `route-bullet ${getRouteClass(route)}`;
      bullet.textContent = route;
      routesWrap.appendChild(bullet);
    });

    const badge = document.createElement('div');
    badge.className = `badge ${STATUS_CLASSES[line.status] || 'planned'}`;
    badge.textContent = line.status;

    const lineInfo = document.createElement('div');
    lineInfo.className = 'line-info';
    lineInfo.appendChild(routesWrap);

    if (!routes.length) {
      const name = document.createElement('div');
      name.className = 'line-name';
      name.textContent = line.name;
      lineInfo.appendChild(name);
    }

    header.appendChild(lineInfo);
    header.appendChild(badge);

    const desc = document.createElement('div');
    desc.className = 'description';
    desc.textContent = line.description || 'No additional updates.';

    const time = document.createElement('p');
    time.className = 'timestamp';
    time.textContent = line.lastUpdated ? `Updated ${line.lastUpdated}` : 'Updated recently';

    card.appendChild(header);
    card.appendChild(desc);
    card.appendChild(time);

    statusGrid.appendChild(card);
  });

  updatedAtEl.textContent = status.updatedAt || 'Just now';
}

async function fetchStatus() {
  refreshBtn.disabled = true;
  refreshBtn.textContent = 'Refreshing…';
  try {
    const response = await fetch('/api/status');
    if (!response.ok) {
      throw new Error(`Request failed: ${response.status}`);
    }
    const payload = await response.json();
    renderStatus(payload);
  } catch (error) {
    console.error('Failed to load status', error);
    emptyState.classList.remove('hidden');
  } finally {
    refreshBtn.disabled = false;
    refreshBtn.textContent = 'Refresh now';
  }
}

function renderStationOptions(stations) {
  stationResults.innerHTML = '';
  stations.forEach((station) => {
    const option = document.createElement('option');
    option.value = station.id;
    option.textContent = `${station.name} (${station.routes.join(', ')})`;
    stationResults.appendChild(option);
  });
}

async function searchStations() {
  const query = stationQuery.value.trim();
  const response = await fetch(`/api/stations?query=${encodeURIComponent(query)}`);
  const data = await response.json();
  renderStationOptions(data.stations || []);
}

async function loadStationAlerts() {
  const stationId = stationResults.value;
  alertsList.innerHTML = '';

  if (!stationId) {
    alertsList.textContent = 'Choose a station first.';
    return;
  }

  const response = await fetch(`/api/alerts?stationId=${encodeURIComponent(stationId)}`);
  const data = await response.json();

  if (!data.alerts?.length) {
    alertsList.textContent = 'No active disruptions found for that station.';
    return;
  }

  data.alerts.forEach((alert) => {
    const item = document.createElement('div');
    item.className = 'alert-item';

    const title = document.createElement('div');
    title.className = 'alert-title';
    title.textContent = `${alert.name} — ${alert.status}`;

    const desc = document.createElement('div');
    desc.textContent = alert.description || 'No details provided.';

    item.appendChild(title);
    item.appendChild(desc);
    alertsList.appendChild(item);
  });
}

refreshBtn.addEventListener('click', fetchStatus);
stationSearchBtn.addEventListener('click', searchStations);
loadAlertsBtn.addEventListener('click', loadStationAlerts);

fetchStatus();
searchStations();
setInterval(fetchStatus, 90_000);
