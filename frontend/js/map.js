let map = L.map('map').setView([37.5598, 126.9369], 15);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(map);

let startCoord = null, endCoord = null;
let startMarker = null, endMarker = null;
let stdPolyline = null, accPolyline = null;
let currentMode = null;
let selectedType = 'wheelchair';

function selectType(type, btn) {
  selectedType = type;
  document.querySelectorAll('.type-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');

  const toggle = document.getElementById('tactile-toggle');
  const camContainer = document.getElementById('cam-container');

  if (type === 'visually_impaired') {
    toggle.classList.add('show');
    camContainer.style.display = 'block';
    if (typeof startCamera === 'function') startCamera();
  } else {
    toggle.classList.remove('show');
    camContainer.style.display = 'none';
  }
}

function setPinMode(mode) {
  currentMode = mode;
  document.getElementById('btn-start').classList.toggle('setting', mode === 'start');
  document.getElementById('btn-end').classList.toggle('setting', mode === 'end');
}

map.on('click', function(e) {
  if (!currentMode) return;

  if (currentMode === 'start') {
    startCoord = e.latlng;
    if (startMarker) map.removeLayer(startMarker);
    startMarker = L.marker(startCoord, {title: "출발지"}).addTo(map).bindPopup("출발지").openPopup();
    document.getElementById('btn-start').innerText = `📍 출발지 설정됨`;
  } else if (currentMode === 'end') {
    endCoord = e.latlng;
    if (endMarker) map.removeLayer(endMarker);
    endMarker = L.marker(endCoord, {title: "목적지"}).addTo(map).bindPopup("목적지").openPopup();
    document.getElementById('btn-end').innerText = `🏁 목적지 설정됨`;
  }

  setPinMode(null);
});

async function requestRoute() {
  if (!startCoord || !endCoord) {
    alert("지도에서 출발지와 목적지를 먼저 선택해 주세요.");
    return;
  }

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
  if (stdPolyline) map.removeLayer(stdPolyline);
  if (accPolyline) map.removeLayer(accPolyline);

  const stdCoords = data.standard_route.coordinates;
  const accCoords = data.accessible_route.coordinates;

  stdPolyline = L.polyline(stdCoords, {color: '#ef4444', weight: 5, dashArray: '8, 8', opacity: 0.7}).addTo(map);
  accPolyline = L.polyline(accCoords, {color: '#10b981', weight: 7, opacity: 0.9}).addTo(map);

  map.fitBounds(accPolyline.getBounds(), {padding: [50, 50]});

  document.getElementById('result-sheet').style.display = 'block';
  document.getElementById('std-dist').innerText = `거리: ${data.standard_route.distance_m}m`;
  document.getElementById('std-stairs').innerText = `계단 구간: ${data.standard_route.stairs_count}곳`;

  document.getElementById('acc-dist').innerText = `거리: ${data.accessible_route.distance_m}m`;
  document.getElementById('acc-stairs').innerText = `계단 구간: ${data.accessible_route.stairs_count}곳`;

  const warnBox = document.getElementById('warning-text');
  if (data.warnings && data.warnings.length > 0) {
    warnBox.style.display = 'block';
    warnBox.innerText = "⚠️ " + data.warnings.join("
");
  } else {
    warnBox.style.display = 'none';
  }
}
