# Map Graph Cache

`map_cache.graphml`은 2026-10-27 Geofabrik 대한민국 OSM 추출본에서 부산 초량·산복도로 중심(위도 35.1159, 경도 129.0354) 반경 3km의 보행 네트워크를 추출한 그래프입니다. 보행 접근 태그와 계단, 노면, 점자블록 관련 태그를 포함합니다. SRTM 1 arc-second(약 30m) 고도 타일을 평활화해 노드 고도와 도로 구간별 `grade`/`grade_abs`를 계산했습니다. SRTM은 지형의 추정치이며 개별 보도 경사 측정값은 아닙니다.

지도 데이터 © OpenStreetMap contributors, ODbL 1.0. 데이터 출처: [Geofabrik South Korea](https://download.geofabrik.de/asia/south-korea.html). 고도 데이터: [SRTM 1 arc-second global elevation data](https://www.earthdata.nasa.gov/data/instruments/srtm).

점자블록 태그가 없는 구간은 미설치가 아니라 `정보 없음`으로 처리합니다. 이 영역의 OSM 태그가 드물기 때문에 실제 점자블록 현황을 완전하게 나타내지 않을 수 있습니다.
