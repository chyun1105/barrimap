# ♿ 교통약자 맞춤형 내비게이션 시스템 (Mobility Impaired Navigation System)

이동이 불편한 교통약자(휠체어/유모차 사용자, 시각장애인, 거동 불편 노약자)를 위한 맞춤형 경로 탐색 웹 내비게이션 서비스입니다.

## 🌟 주요 기능
1. **유형별 맞춤 경로 탐색**:
   - **휠체어/유모차**: 계단(`steps`) 전면 차단, 급경사 및 불량 노면 회피
   - **시각장애인**: 점자블록 우선 경로 선택 토글, 점자블록 미설치 구간 경고 안내
   - **거동 불편 노약자**: 완만한 평지 경로 우대 및 계단 패널티
2. **이중 경로 동시 비교**: 일반 최단 경로 vs 교통약자 맞춤 경로 지도 동시 시각화 및 비교 통계 (거리, 계단 수, 점자 미설치 수)
3. **장소 검색**: Photon 지오코더로 출발지와 목적지를 검색; API 키 없이 사용 가능
4. **스마트폰 모바일 최적화 UI**: MapLibre GL JS와 OpenFreeMap 벡터 지도 기반 반응형 인터페이스, 지도에서 위치 선택 지원
5. **카메라 AI 위험물 인식**: 시각장애인 경로 안내를 시작한 동안 TensorFlow.js COCO-SSD 기반 실시간 장애물 인지; 안내 종료 시 카메라 자동 종료
6. **센서 이상 움직임 감지**: 가속도 센서 활용 낙상/충격 감지 및 비상 경보

## 🛠 기술 스택
- **Backend**: Python 3.10, FastAPI, OSMnx, NetworkX, Geopy, Uvicorn
- **Frontend**: HTML5, CSS3, JavaScript (ES6+), MapLibre GL JS, OpenFreeMap, TensorFlow.js
- **Deployment**: Render.com (Backend), Vercel (Frontend)

## 📁 프로젝트 구조
```
mobility-nav-system/
├── backend/                # FastAPI + OSMnx 파이썬 백엔드
│   ├── app/
│   │   ├── api/v1/         # API 엔드포인트 라우터
│   │   ├── core/           # 가중치 설정 및 환경변수
│   │   ├── models/         # Pydantic 데이터 검증 규격
│   │   ├── services/       # OSMnx 지도 로딩 및 다익스트라 엔진
│   │   └── utils/          # 좌표 계산 헬퍼
│   ├── data/               # OSM 지도 그래프 캐시
│   ├── Dockerfile
│   ├── main.py
│   └── requirements.txt
└── frontend/               # MapLibre GL JS 웹 프론트엔드
    ├── css/
    ├── js/
    └── index.html
```

## 🚀 빠른 시작 (Local Quick Start)

### 백엔드 실행
```bash
cd backend
pip install -r requirements.txt
python main.py
```
* 백엔드 API: `http://localhost:8000`
* Swagger API 문서: `http://localhost:8000/docs`

### 프론트엔드 실행
`frontend/index.html` 파일을 브라우저로 열거나, VS Code Live Server로 실행합니다.
