const statusGrid = document.getElementById('status-grid');
const updatedAtEl = document.getElementById('updated-at');
const refreshBtn = document.getElementById('refresh-btn');
const emptyState = document.getElementById('empty-state');
const sourceLabel = document.getElementById('source-label');

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
  sourceLabel.textContent = status.source === 'sample' ? 'Using sample data' : 'Live MTA feed';

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

refreshBtn.addEventListener('click', fetchStatus);

fetchStatus();
setInterval(fetchStatus, 90_000);
