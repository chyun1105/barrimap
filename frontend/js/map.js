const map = new maplibregl.Map({
  container: 'map',
  style: 'https://tiles.openfreemap.org/styles/liberty',
  center: [126.9122, 35.1741],
  zoom: 15,
  attributionControl: true
});
map.on('style.load', () => {
  const koreanName = ['coalesce', ['get', 'name:ko'], ['get', 'name:nonlatin'], ''];
  map.getStyle().layers.forEach(layer => {
    const textField = layer.layout?.['text-field'];
    if (
      layer.type === 'symbol' &&
      Array.isArray(textField) &&
      (JSON.stringify(textField).includes('name:latin') || JSON.stringify(textField).includes('name_en'))
    ) {
      map.setLayoutProperty(layer.id, 'text-field', koreanName);
    }
  });
});
map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'bottom-right');
map.addControl(new maplibregl.ScaleControl({ maxWidth: 100, unit: 'metric' }), 'bottom-left');

let startCoord = null, endCoord = null;
let startMarker = null, endMarker = null;
let currentMode = null;
let selectedType = 'wheelchair';
let isGuiding = false;
const placeSearches = new Map();

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
  ['standard-route', 'accessible-route-halo', 'accessible-route'].forEach(id => {
    if (map.getLayer(id)) map.removeLayer(id);
    if (map.getSource(id)) map.removeSource(id);
  });
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
    properties.state
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
    const params = new URLSearchParams({
      q: query,
      limit: '5',
      lat: '37.5598',
      lon: '126.9369'
    });
    const response = await fetch(`https://photon.komoot.io/api/?${params}`, {
      signal: controller.signal,
      headers: { Accept: 'application/json' }
    });
    if (!response.ok) throw new Error(`장소 검색 서버 응답 오류 (${response.status})`);
    const data = await response.json();
    if (sequence !== search.sequence) return;

    search.features = data.features || [];
    if (!search.features.length) {
      showPlaceMessage(mode, '검색 결과가 없습니다. 다른 이름으로 검색해 주세요.');
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

async function requestRoute() {
  if (!startCoord || !endCoord) {
    alert("지도에서 출발지와 목적지를 먼저 선택해 주세요.");
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
  const drawRoutes = () => {
    ['standard-route', 'accessible-route-halo', 'accessible-route'].forEach(id => {
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
      paint: { 'line-color': '#8b9098', 'line-width': 4, 'line-opacity': 0.9, 'line-dasharray': [1, 2] }
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
      paint: { 'line-color': '#1685f8', 'line-width': 6, 'line-opacity': 1 }
    });

    const bounds = new maplibregl.LngLatBounds();
    accessibleCoordinates.forEach(([lat, lon]) => bounds.extend([lon, lat]));
    map.fitBounds(bounds, { padding: 50, maxZoom: 17 });
  };
  if (map.isStyleLoaded()) drawRoutes();
  else map.once('load', drawRoutes);

  document.getElementById('result-sheet').style.display = 'block';
  document.getElementById('std-dist').innerText = `거리: ${data.standard_route.distance_m}m`;
  document.getElementById('std-stairs').innerText = `계단 구간: ${data.standard_route.stairs_count}곳`;

  document.getElementById('acc-dist').innerText = `거리: ${data.accessible_route.distance_m}m`;
  document.getElementById('acc-stairs').innerText = `계단 구간: ${data.accessible_route.stairs_count}곳`;

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

async function startRouteGuidance() {
  isGuiding = true;
  document.getElementById('btn-guidance-start').style.display = 'none';
  document.getElementById('btn-guidance-stop').style.display = 'block';

  if (selectedType !== 'visually_impaired') return;

  document.getElementById('cam-container').style.display = 'block';
  try {
    await startCamera();
  } catch (error) {
    stopRouteGuidance();
    console.error("카메라를 시작하지 못했습니다.", error);
    alert("카메라를 시작할 수 없습니다. 카메라 권한과 HTTPS 연결을 확인해 주세요.");
  }
}

function stopRouteGuidance() {
  isGuiding = false;
  const camContainer = document.getElementById('cam-container');
  if (camContainer) camContainer.style.display = 'none';
  if (typeof stopCamera === 'function') stopCamera();

  const startButton = document.getElementById('btn-guidance-start');
  const stopButton = document.getElementById('btn-guidance-stop');
  if (startButton && stopButton) {
    startButton.style.display = 'block';
    stopButton.style.display = 'none';
  }
}
