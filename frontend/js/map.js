const map = new maplibregl.Map({
  container: 'map',
  style: 'https://tiles.openfreemap.org/styles/liberty',
  center: [129.0354, 35.1159],
  zoom: 13,
  attributionControl: true
});
map.on('styleimagemissing', event => {
  if (map.hasImage(event.id)) return;

  const canvas = document.createElement('canvas');
  canvas.width = 24;
  canvas.height = 24;
  const context = canvas.getContext('2d');
  if (!context) return;

  context.fillStyle = '#087d78';
  context.beginPath();
  context.arc(12, 12, 10, 0, Math.PI * 2);
  context.fill();
  context.fillStyle = '#ffffff';
  context.beginPath();
  context.arc(12, 12, 3, 0, Math.PI * 2);
  context.fill();
  map.addImage(event.id, context.getImageData(0, 0, 24, 24));
});
map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'bottom-right');
map.addControl(new maplibregl.ScaleControl({ maxWidth: 100, unit: 'metric' }), 'bottom-left');

let startCoord = null, endCoord = null;
let startMarker = null, endMarker = null;
let currentMode = null;
let selectedType = 'wheelchair';
let isGuiding = false;
let currentLocationWatch = null;
let currentLocationMarker = null;
let currentLocationElement = null;
let currentHeading = null;
let routeGuidance = null;
const placeSearches = new Map();
const ROUTE_AREAS = [
  { label: '부산 초량·산복도로', latitude: 35.1159, longitude: 129.0354, radiusMeters: 3000 },
  { label: '서울 시청', latitude: 37.5665, longitude: 126.9780, radiusMeters: 3000 },
  { label: '광주 첨단·광주과학고', latitude: 35.2280544, longitude: 126.8483814, radiusMeters: 3000 }
];

function distanceMeters(latitude1, longitude1, latitude2, longitude2) {
  const toRadians = degrees => degrees * Math.PI / 180;
  const latitudeDelta = toRadians(latitude2 - latitude1);
  const longitudeDelta = toRadians(longitude2 - longitude1);
  const haversine = Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(toRadians(latitude1)) *
    Math.cos(toRadians(latitude2)) *
    Math.sin(longitudeDelta / 2) ** 2;
  return 6371000 * 2 * Math.atan2(
    Math.sqrt(haversine),
    Math.sqrt(1 - haversine)
  );
}

function routeAreaForPoint(latitude, longitude) {
  return ROUTE_AREAS.find(area =>
    distanceMeters(latitude, longitude, area.latitude, area.longitude) <= area.radiusMeters
  );
}

function isWithinRouteArea(latitude, longitude) {
  return Boolean(routeAreaForPoint(latitude, longitude));
}

function showOutsideCoverageMessage() {
  const areas = ROUTE_AREAS.map(area => `${area.label} 중심 약 3km`).join(', ');
  alert(`현재 경로 데이터 범위 밖입니다. ${areas} 안의 장소를 선택해 주세요.`);
}

function createPinMarker(label, type) {
  const element = document.createElement('div');
  element.className = `map-pin map-pin-${type}`;
  element.innerHTML = `<span>${label}</span>`;
  return new maplibregl.Marker({ element, anchor: 'bottom' });
}

function updatePinButton(mode, isSet, placeName) {
  const button = document.getElementById(mode === 'start' ? 'btn-start' : 'btn-end');
  const input = document.getElementById(`${mode}-search`);
  const coord = mode === 'start' ? startCoord : endCoord;
  if (placeName) input.value = placeName;
  else if (isSet) input.value = `${coord.lat.toFixed(5)}, ${coord.lng.toFixed(5)}`;
  button.classList.toggle('setting', currentMode === mode);
}

function clearRoutes() {
  [
    'standard-route',
    'accessible-route-halo',
    'accessible-route',
    'tactile-route-segments'
  ].forEach(id => {
    if (map.getLayer(id)) map.removeLayer(id);
    if (map.getSource(id)) map.removeSource(id);
  });
  document.getElementById('tactile-legend').style.display = 'none';
  document.getElementById('tactile-summary').style.display = 'none';
  document.getElementById('result-sheet').style.display = 'none';
}

function hideSuggestions(mode) {
  const input = document.getElementById(`${mode}-search`);
  const list = document.getElementById(`${mode}-suggestions`);
  list.classList.remove('show');
  list.replaceChildren();
  input.setAttribute('aria-expanded', 'false');
}

function formatPlace(feature) {
  const properties = feature.properties;
  const name = properties.name || properties.street || properties.city || '이름 없는 장소';
  const address = [
    properties.housenumber,
    properties.street,
    properties.district,
    properties.city,
    properties.state,
    properties.route_area
  ].filter(Boolean);
  const detail = [...new Set(address)].filter(part => part !== name).join(', ');
  return { name, detail };
}

function showPlaceMessage(mode, message) {
  const input = document.getElementById(`${mode}-search`);
  const list = document.getElementById(`${mode}-suggestions`);
  const item = document.createElement('div');
  item.className = 'place-message';
  item.textContent = message;
  list.replaceChildren(item);
  list.classList.add('show');
  input.setAttribute('aria-expanded', 'true');
}

async function findPlaces(mode, query) {
  const search = placeSearches.get(mode);
  if (search.controller) search.controller.abort();
  const controller = new AbortController();
  search.controller = controller;
  const sequence = ++search.sequence;
  const input = document.getElementById(`${mode}-search`);
  showPlaceMessage(mode, '장소를 찾고 있어요...');

  try {
    const regionFeatures = await Promise.all(ROUTE_AREAS.map(async area => {
      const latitudeDelta = area.radiusMeters / 111320;
      const longitudeDelta = area.radiusMeters / (111320 * Math.cos(area.latitude * Math.PI / 180));
      const params = new URLSearchParams({
        q: query,
        limit: '15',
        lat: String(area.latitude),
        lon: String(area.longitude),
        bbox: [
          area.longitude - longitudeDelta,
          area.latitude - latitudeDelta,
          area.longitude + longitudeDelta,
          area.latitude + latitudeDelta
        ].join(',')
      });
      const response = await fetch(`https://photon.komoot.io/api/?${params}`, {
        signal: controller.signal,
        headers: { Accept: 'application/json' }
      });
      if (!response.ok) throw new Error(`장소 검색 서버 응답 오류 (${response.status})`);
      const data = await response.json();
      return (data.features || [])
        .filter(feature => {
          const [longitude, latitude] = feature.geometry.coordinates;
          return distanceMeters(latitude, longitude, area.latitude, area.longitude) <= area.radiusMeters;
        })
        .map(feature => ({
          ...feature,
          properties: { ...feature.properties, route_area: area.label }
        }));
    }));
    if (sequence !== search.sequence) return;

    const uniqueFeatures = new Map();
    regionFeatures.flat().forEach(feature => {
      const properties = feature.properties;
      const key = properties.osm_id
        ? `${properties.osm_type}-${properties.osm_id}`
        : `${properties.route_area}-${feature.geometry.coordinates.join(',')}`;
      if (!uniqueFeatures.has(key)) uniqueFeatures.set(key, feature);
    });
    search.features = Array.from(uniqueFeatures.values());
    if (!search.features.length) {
      showPlaceMessage(mode, '부산 초량·산복도로, 서울 시청, 광주 첨단의 경로 데이터 범위에서 검색 결과가 없습니다.');
      return;
    }

    const list = document.getElementById(`${mode}-suggestions`);
    list.replaceChildren();
    search.features.forEach((feature, index) => {
      const { name, detail } = formatPlace(feature);
      const option = document.createElement('button');
      option.type = 'button';
      option.className = 'place-option';
      option.setAttribute('role', 'option');
      option.dataset.index = String(index);

      const icon = document.createElement('span');
      icon.className = 'place-option-icon';
      icon.setAttribute('aria-hidden', 'true');
      icon.textContent = '⌖';
      const copy = document.createElement('span');
      copy.className = 'place-option-copy';
      const title = document.createElement('span');
      title.className = 'place-option-name';
      title.textContent = name;
      copy.append(title);
      if (detail) {
        const subtitle = document.createElement('span');
        subtitle.className = 'place-option-detail';
        subtitle.textContent = detail;
        copy.append(subtitle);
      }
      option.append(icon, copy);
      list.append(option);
    });
    list.classList.add('show');
    input.setAttribute('aria-expanded', 'true');
  } catch (error) {
    if (error.name === 'AbortError' || sequence !== search.sequence) return;
    console.error('장소 검색에 실패했습니다.', error);
    showPlaceMessage(mode, '검색에 실패했습니다. 잠시 후 다시 시도해 주세요.');
  }
}

function selectPlace(mode, feature) {
  const [longitude, latitude] = feature.geometry.coordinates;
  const { name } = formatPlace(feature);
  const coord = { lat: latitude, lng: longitude };
  if (mode === 'start') {
    startCoord = coord;
    if (startMarker) startMarker.remove();
    startMarker = createPinMarker('A', 'start')
      .setLngLat([longitude, latitude])
      .setPopup(new maplibregl.Popup({ offset: 28 }).setText(`출발지: ${name}`))
      .addTo(map);
  } else {
    endCoord = coord;
    if (endMarker) endMarker.remove();
    endMarker = createPinMarker('B', 'end')
      .setLngLat([longitude, latitude])
      .setPopup(new maplibregl.Popup({ offset: 28 }).setText(`도착지: ${name}`))
      .addTo(map);
  }
  updatePinButton(mode, true, name);
  hideSuggestions(mode);
  map.flyTo({ center: [longitude, latitude], zoom: Math.max(map.getZoom(), 16) });
  setPinMode(null);
}

function setupPlaceSearch(mode) {
  const input = document.getElementById(`${mode}-search`);
  const list = document.getElementById(`${mode}-suggestions`);
  const search = { sequence: 0, timer: null, controller: null, features: [] };
  placeSearches.set(mode, search);

  input.addEventListener('input', () => {
    stopRouteGuidance();
    clearRoutes();
    document.querySelector('.guidance-actions').style.display = 'none';
    if (mode === 'start') {
      startCoord = null;
      if (startMarker) startMarker.remove();
      startMarker = null;
    } else {
      endCoord = null;
      if (endMarker) endMarker.remove();
      endMarker = null;
    }
    if (search.timer) clearTimeout(search.timer);
    if (search.controller) search.controller.abort();
    search.sequence += 1;
    const query = input.value.trim();
    if (query.length < 2) {
      hideSuggestions(mode);
      return;
    }
    search.timer = setTimeout(() => findPlaces(mode, query), 350);
  });

  input.addEventListener('keydown', event => {
    if (event.key === 'Escape') hideSuggestions(mode);
    if (event.key === 'Enter' && input.value.trim().length >= 2) {
      event.preventDefault();
      if (search.timer) clearTimeout(search.timer);
      findPlaces(mode, input.value.trim());
    }
    if (event.key === 'ArrowDown') {
      const firstOption = list.querySelector('.place-option');
      if (firstOption) {
        event.preventDefault();
        firstOption.focus();
      }
    }
  });

  list.addEventListener('click', event => {
    const option = event.target.closest('.place-option');
    if (!option) return;
    const feature = search.features[Number(option.dataset.index)];
    if (feature) selectPlace(mode, feature);
  });
}

setupPlaceSearch('start');
setupPlaceSearch('end');

document.addEventListener('click', event => {
  if (event.target.closest('.location-field')) return;
  hideSuggestions('start');
  hideSuggestions('end');
});

function selectType(type, btn) {
  if (type !== selectedType) {
    stopRouteGuidance();
    document.querySelector('.guidance-actions').style.display = 'none';
    clearRoutes();
  }
  selectedType = type;
  document.querySelectorAll('.type-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');

  const toggle = document.getElementById('tactile-toggle');

  if (type === 'visually_impaired') {
    toggle.classList.add('show');
  } else {
    toggle.classList.remove('show');
  }
}

function setPinMode(mode) {
  if (mode) {
    stopRouteGuidance();
    clearRoutes();
    document.querySelector('.guidance-actions').style.display = 'none';
  }
  currentMode = mode;
  document.getElementById('btn-start').classList.toggle('setting', mode === 'start');
  document.getElementById('btn-end').classList.toggle('setting', mode === 'end');
}

map.on('click', function(e) {
  if (!currentMode) return;
  if (!isWithinRouteArea(e.lngLat.lat, e.lngLat.lng)) {
    showOutsideCoverageMessage();
    return;
  }

  if (currentMode === 'start') {
    startCoord = { lat: e.lngLat.lat, lng: e.lngLat.lng };
    if (startMarker) startMarker.remove();
    startMarker = createPinMarker('A', 'start')
      .setLngLat([startCoord.lng, startCoord.lat])
      .setPopup(new maplibregl.Popup({ offset: 28 }).setText("출발지"))
      .addTo(map);
    updatePinButton('start', true);
  } else if (currentMode === 'end') {
    endCoord = { lat: e.lngLat.lat, lng: e.lngLat.lng };
    if (endMarker) endMarker.remove();
    endMarker = createPinMarker('B', 'end')
      .setLngLat([endCoord.lng, endCoord.lat])
      .setPopup(new maplibregl.Popup({ offset: 28 }).setText("목적지"))
      .addTo(map);
    updatePinButton('end', true);
  }

  setPinMode(null);
});

map.on('click', function(e) {
  if (!map.getLayer('tactile-route-segments')) return;
  const [feature] = map.queryRenderedFeatures(e.point, {
    layers: ['tactile-route-segments']
  });
  if (!feature) return;

  const labels = {
    yes: '점자블록 있음',
    no: '점자블록 없음으로 등록됨',
    unknown: '점자블록 정보 없음'
  };
  new maplibregl.Popup({ closeButton: false, offset: 8 })
    .setLngLat(e.lngLat)
    .setText(labels[feature.properties.tactile_status] || labels.unknown)
    .addTo(map);
});

async function requestRoute() {
  if (!startCoord || !endCoord) {
    alert("지도에서 출발지와 목적지를 먼저 선택해 주세요.");
    return;
  }
  if (
    !isWithinRouteArea(startCoord.lat, startCoord.lng) ||
    !isWithinRouteArea(endCoord.lat, endCoord.lng)
  ) {
    showOutsideCoverageMessage();
    return;
  }
  if (distanceMeters(startCoord.lat, startCoord.lng, endCoord.lat, endCoord.lng) > 10000) {
    alert('출발지와 목적지 사이의 직선거리가 10km를 초과했습니다. 10km 이내의 경로를 선택해 주세요.');
    return;
  }

  stopRouteGuidance();
  document.querySelector('.guidance-actions').style.display = 'none';
  const tactilePriority = document.getElementById('tactile-chk').checked;
  const params = {
    start_lat: startCoord.lat,
    start_lon: startCoord.lng,
    end_lat: endCoord.lat,
    end_lon: endCoord.lng,
    user_type: selectedType,
    tactile_priority: tactilePriority
  };

  try {
    const data = await fetchCustomRoute(params);
    if (data.status === "success") {
      renderRoutes(data);
    }
  } catch (err) {
    alert(err.message);
  }
}

function renderRoutes(data) {
  routeGuidance = createRouteGuidance(data.accessible_route);
  const drawRoutes = () => {
    [
      'standard-route',
      'accessible-route-halo',
      'accessible-route',
      'tactile-route-segments'
    ].forEach(id => {
      if (map.getLayer(id)) map.removeLayer(id);
      if (map.getSource(id)) map.removeSource(id);
    });

    const toGeoJson = coordinates => ({
      type: 'Feature',
      properties: {},
      geometry: {
        type: 'LineString',
        coordinates: coordinates.map(([lat, lon]) => [lon, lat])
      }
    });
    const standardCoordinates = data.standard_route.coordinates;
    const accessibleCoordinates = data.accessible_route.coordinates;

    map.addSource('standard-route', { type: 'geojson', data: toGeoJson(standardCoordinates) });
    map.addLayer({
      id: 'standard-route',
      type: 'line',
      source: 'standard-route',
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-color': '#64748b', 'line-width': 4, 'line-opacity': 0.85, 'line-dasharray': [1, 2] }
    });
    map.addSource('accessible-route-halo', { type: 'geojson', data: toGeoJson(accessibleCoordinates) });
    map.addLayer({
      id: 'accessible-route-halo',
      type: 'line',
      source: 'accessible-route-halo',
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-color': '#ffffff', 'line-width': 11, 'line-opacity': 0.95 }
    });
    map.addSource('accessible-route', { type: 'geojson', data: toGeoJson(accessibleCoordinates) });
    map.addLayer({
      id: 'accessible-route',
      type: 'line',
      source: 'accessible-route',
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: {
        'line-color': '#1685f8',
        'line-width': 6,
        'line-opacity': selectedType === 'visually_impaired' ? 0.25 : 1
      }
    });
    if (selectedType === 'visually_impaired' && data.accessible_route.tactile_segments?.length) {
      const tactileFeatures = data.accessible_route.tactile_segments.map(segment => ({
        type: 'Feature',
        properties: { tactile_status: segment.tactile_status },
        geometry: {
          type: 'LineString',
          coordinates: segment.coordinates.map(([lat, lon]) => [lon, lat])
        }
      }));
      map.addSource('tactile-route-segments', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: tactileFeatures }
      });
      map.addLayer({
        id: 'tactile-route-segments',
        type: 'line',
        source: 'tactile-route-segments',
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: {
          'line-color': [
            'match',
            ['get', 'tactile_status'],
            'yes', '#138a5b',
            'no', '#d83b3b',
            '#e2a327'
          ],
          'line-width': 6
        }
      });
    }

    const bounds = new maplibregl.LngLatBounds();
    accessibleCoordinates.forEach(([lat, lon]) => bounds.extend([lon, lat]));
    map.fitBounds(bounds, { padding: 50, maxZoom: 17 });
  };
  if (map.getStyle()) drawRoutes();
  else map.once('style.load', drawRoutes);

  document.getElementById('result-sheet').style.display = 'block';
  document.getElementById('std-dist').innerText = `거리: ${data.standard_route.distance_m}m`;
  document.getElementById('std-stairs').innerText = `계단 구간: ${data.standard_route.stairs_count}곳`;

  document.getElementById('acc-dist').innerText = `거리: ${data.accessible_route.distance_m}m`;
  document.getElementById('acc-stairs').innerText = `계단 구간: ${data.accessible_route.stairs_count}곳`;
  document.getElementById('acc-grade').innerText =
    `경사 8% 초과: ${data.accessible_route.steep_segments_count}구간 · 최대 ${data.accessible_route.max_grade_percent}%`;
  const tactileSummary = document.getElementById('tactile-summary');
  tactileSummary.style.display = selectedType === 'visually_impaired' ? 'block' : 'none';
  tactileSummary.textContent =
    `점자블록 있음 ${data.accessible_route.tactile_yes_count}구간 · ` +
    `없음 ${data.accessible_route.tactile_no_count}구간 · ` +
    `정보 없음 ${data.accessible_route.tactile_unknown_count}구간`;
  document.getElementById('tactile-legend').style.display =
    selectedType === 'visually_impaired' ? 'flex' : 'none';

  const warnBox = document.getElementById('warning-text');
  if (data.warnings && data.warnings.length > 0) {
    warnBox.style.display = 'block';
    warnBox.innerText = "⚠️ " + data.warnings.join("\n");
  } else {
    warnBox.style.display = 'none';
  }

  document.querySelector('.guidance-actions').style.display = 'flex';
  document.getElementById('btn-guidance-start').style.display = 'block';
  document.getElementById('btn-guidance-stop').style.display = 'none';
}

function bearingBetween(from, to) {
  const toRadians = degrees => degrees * Math.PI / 180;
  const toDegrees = radians => radians * 180 / Math.PI;
  const latitude1 = toRadians(from[0]);
  const latitude2 = toRadians(to[0]);
  const longitudeDelta = toRadians(to[1] - from[1]);
  const y = Math.sin(longitudeDelta) * Math.cos(latitude2);
  const x = Math.cos(latitude1) * Math.sin(latitude2) -
    Math.sin(latitude1) * Math.cos(latitude2) * Math.cos(longitudeDelta);
  return (toDegrees(Math.atan2(y, x)) + 360) % 360;
}

function coordinateAtDistance(coordinates, cumulativeDistances, distance) {
  let low = 0;
  let high = cumulativeDistances.length - 1;
  while (low < high) {
    const middle = Math.floor((low + high) / 2);
    if (cumulativeDistances[middle] < distance) low = middle + 1;
    else high = middle;
  }

  const endIndex = Math.max(1, low);
  const startIndex = endIndex - 1;
  const segmentDistance = cumulativeDistances[endIndex] - cumulativeDistances[startIndex];
  const ratio = segmentDistance
    ? (distance - cumulativeDistances[startIndex]) / segmentDistance
    : 0;
  return [
    coordinates[startIndex][0] + (coordinates[endIndex][0] - coordinates[startIndex][0]) * ratio,
    coordinates[startIndex][1] + (coordinates[endIndex][1] - coordinates[startIndex][1]) * ratio
  ];
}

function createRouteGuidance(route) {
  const coordinates = route.coordinates;
  const cumulativeDistances = [0];
  for (let index = 1; index < coordinates.length; index += 1) {
    cumulativeDistances.push(
      cumulativeDistances[index - 1] + distanceMeters(
        coordinates[index - 1][0],
        coordinates[index - 1][1],
        coordinates[index][0],
        coordinates[index][1]
      )
    );
  }

  const totalDistance = cumulativeDistances.at(-1) || 0;
  const maneuvers = [];
  let lastManeuverAt = -Infinity;
  for (let distance = 40; distance < totalDistance - 40; distance += 10) {
    const before = coordinateAtDistance(coordinates, cumulativeDistances, distance - 20);
    const turnPoint = coordinateAtDistance(coordinates, cumulativeDistances, distance);
    const after = coordinateAtDistance(coordinates, cumulativeDistances, distance + 20);
    const incoming = bearingBetween(before, turnPoint);
    const outgoing = bearingBetween(turnPoint, after);
    const turn = ((outgoing - incoming + 540) % 360) - 180;
    if (Math.abs(turn) >= 50 && Math.abs(turn) <= 150 && distance - lastManeuverAt >= 70) {
      maneuvers.push({
        distance,
        direction: turn > 0 ? '오른쪽' : '왼쪽',
        announced: false,
        turning: false
      });
      lastManeuverAt = distance;
    }
  }

  return { coordinates, cumulativeDistances, totalDistance, maneuvers, progressMeters: 0, arrived: false };
}

function updateRouteGuidance(latitude, longitude) {
  if (!isGuiding || !routeGuidance || routeGuidance.arrived) return;
  const { coordinates, cumulativeDistances, totalDistance, maneuvers } = routeGuidance;
  if (coordinates.length < 2) return;

  const metersPerLongitude = 111320 * Math.cos(latitude * Math.PI / 180);
  const metersPerLatitude = 110540;
  const minDistance = Math.max(0, routeGuidance.progressMeters - 15);
  const maxDistance = Math.min(totalDistance, routeGuidance.progressMeters + 500);
  let closestDistance = Infinity;
  let closestProgress = routeGuidance.progressMeters;
  for (let index = 0; index < coordinates.length - 1; index += 1) {
    const segmentStart = cumulativeDistances[index];
    const segmentEnd = cumulativeDistances[index + 1];
    if (segmentEnd < minDistance || segmentStart > maxDistance) continue;

    const startX = (coordinates[index][1] - longitude) * metersPerLongitude;
    const startY = (coordinates[index][0] - latitude) * metersPerLatitude;
    const endX = (coordinates[index + 1][1] - longitude) * metersPerLongitude;
    const endY = (coordinates[index + 1][0] - latitude) * metersPerLatitude;
    const deltaX = endX - startX;
    const deltaY = endY - startY;
    const segmentLengthSquared = deltaX * deltaX + deltaY * deltaY;
    const ratio = segmentLengthSquared
      ? Math.max(0, Math.min(1, -(startX * deltaX + startY * deltaY) / segmentLengthSquared))
      : 0;
    const distance = Math.hypot(startX + ratio * deltaX, startY + ratio * deltaY);
    if (distance < closestDistance) {
      closestDistance = distance;
      closestProgress = segmentStart + ratio * (segmentEnd - segmentStart);
    }
  }
  if (closestDistance > 100) return;

  routeGuidance.progressMeters = Math.max(routeGuidance.progressMeters, closestProgress);
  const remaining = Math.max(0, totalDistance - routeGuidance.progressMeters);
  if (remaining <= 25 && distanceMeters(
    latitude,
    longitude,
    coordinates.at(-1)[0],
    coordinates.at(-1)[1]
  ) <= 40) {
    routeGuidance.arrived = true;
    speakText('목적지에 도착했습니다.');
    return;
  }

  const maneuver = maneuvers.find(item => !item.turning);
  if (!maneuver) return;
  const untilTurn = maneuver.distance - routeGuidance.progressMeters;
  if (!maneuver.announced && untilTurn <= 80 && untilTurn > 25) {
    maneuver.announced = true;
    speakText(`약 ${Math.round(untilTurn / 10) * 10}미터 앞에서 ${maneuver.direction}으로 방향을 바꾸세요.`);
  } else if (untilTurn <= 25 && untilTurn >= -15) {
    maneuver.announced = true;
    maneuver.turning = true;
    speakText(`지금 ${maneuver.direction}으로 방향을 바꾸세요.`);
  } else if (untilTurn < -15) {
    maneuver.turning = true;
  }
}

function updateCurrentLocation(position) {
  if (!isGuiding) return;
  const { latitude, longitude } = position.coords;
  if (!currentLocationMarker) {
    currentLocationElement = document.createElement('div');
    currentLocationElement.className = 'current-location-marker';
    currentLocationElement.setAttribute('aria-label', '현재 위치와 방향');
    currentLocationElement.innerHTML =
      '<span class="current-location-dot"></span><span class="current-location-arrow"></span>';
    currentLocationMarker = new maplibregl.Marker({
      element: currentLocationElement,
      anchor: 'center'
    }).setLngLat([longitude, latitude]).addTo(map);
    map.easeTo({ center: [longitude, latitude], zoom: Math.max(map.getZoom(), 16), duration: 500 });
  } else {
    currentLocationMarker.setLngLat([longitude, latitude]);
  }
  if (currentHeading !== null) setCurrentHeading(currentHeading);
  if (Number.isFinite(position.coords.heading) && position.coords.heading >= 0) {
    setCurrentHeading(position.coords.heading);
  }
  updateRouteGuidance(latitude, longitude);
}

function startLocationTracking() {
  if (!navigator.geolocation) {
    alert('이 기기에서 위치 정보를 사용할 수 없습니다.');
    return;
  }
  if (currentLocationWatch !== null) navigator.geolocation.clearWatch(currentLocationWatch);
  currentLocationWatch = navigator.geolocation.watchPosition(
    updateCurrentLocation,
    error => {
      console.error('현재 위치를 가져오지 못했습니다.', error);
      if (error.code === error.PERMISSION_DENIED) {
        alert('현재 위치를 표시하려면 위치 권한을 허용해 주세요.');
      }
    },
    { enableHighAccuracy: true, maximumAge: 1000, timeout: 15000 }
  );
}

function setCurrentHeading(heading) {
  currentHeading = (heading + 360) % 360;
  if (currentLocationElement) {
    currentLocationElement.style.setProperty(
      '--heading',
      `${currentHeading - map.getBearing()}deg`
    );
  }
}

function updateDeviceHeading(event) {
  const heading = Number.isFinite(event.webkitCompassHeading)
    ? event.webkitCompassHeading
    : Number.isFinite(event.alpha) && event.absolute
      ? 360 - event.alpha
      : null;
  if (heading !== null) setCurrentHeading(heading);
}

function updateHeadingForMapBearing() {
  if (currentHeading !== null) setCurrentHeading(currentHeading);
}

async function startHeadingTracking() {
  if (!('DeviceOrientationEvent' in window)) return;
  if (typeof DeviceOrientationEvent.requestPermission === 'function') {
    const permission = await DeviceOrientationEvent.requestPermission();
    if (permission !== 'granted') {
      console.warn('방향 센서 권한이 허용되지 않아 현재 방향을 표시하지 못합니다.');
      return;
    }
  }
  window.addEventListener('deviceorientation', updateDeviceHeading, { passive: true });
  map.on('rotate', updateHeadingForMapBearing);
}

function stopHeadingTracking() {
  window.removeEventListener('deviceorientation', updateDeviceHeading);
  map.off('rotate', updateHeadingForMapBearing);
}

async function startRouteGuidance() {
  isGuiding = true;
  document.getElementById('btn-guidance-start').style.display = 'none';
  document.getElementById('btn-guidance-stop').style.display = 'block';

  speakText(`경로 안내를 시작합니다. 목적지까지 약 ${Math.round((routeGuidance?.totalDistance || 0) / 10) * 10}미터입니다.`);
  startLocationTracking();
  const headingTask = startHeadingTracking();
  const motionTask = startMotionMonitoring();
  const cameraTask = selectedType === 'visually_impaired'
    ? startCamera()
    : Promise.resolve();
  if (selectedType === 'visually_impaired') {
    document.getElementById('cam-container').style.display = 'block';
  }

  const results = await Promise.allSettled([headingTask, motionTask, cameraTask]);
  results.slice(0, 2).forEach(result => {
    if (result.status === 'rejected') console.error('경로 안내 센서를 시작하지 못했습니다.', result.reason);
  });
  if (results[2].status === 'rejected') {
    stopCamera();
    document.getElementById('cam-container').style.display = 'none';
    console.error('카메라를 시작하지 못했습니다.', results[2].reason);
    alert('카메라를 시작할 수 없습니다. 카메라 권한과 HTTPS 연결을 확인해 주세요.');
  }
}

function stopRouteGuidance() {
  isGuiding = false;
  if (currentLocationWatch !== null) {
    navigator.geolocation.clearWatch(currentLocationWatch);
    currentLocationWatch = null;
  }
  stopHeadingTracking();
  if (currentLocationMarker) currentLocationMarker.remove();
  currentLocationMarker = null;
  currentLocationElement = null;
  currentHeading = null;
  const camContainer = document.getElementById('cam-container');
  if (camContainer) camContainer.style.display = 'none';
  if (typeof stopCamera === 'function') stopCamera();
  if (typeof stopMotionMonitoring === 'function') stopMotionMonitoring();

  const startButton = document.getElementById('btn-guidance-start');
  const stopButton = document.getElementById('btn-guidance-stop');
  if (startButton && stopButton) {
    startButton.style.display = 'block';
    stopButton.style.display = 'none';
  }
}
