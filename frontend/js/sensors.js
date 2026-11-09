const WARNING_COOLDOWN_MS = 8000;
const SHOCK_THRESHOLD = 10;
const OBSTACLE_CONFIDENCE_THRESHOLD = 0.6;

let cameraStream = null;
let detectionTimer = null;
let detectionInProgress = false;
let motionMonitoring = false;
const lastWarningAt = new Map();

function speakWarning(key, message) {
  if (!('speechSynthesis' in window) || !('SpeechSynthesisUtterance' in window)) {
    console.warn('이 브라우저는 음성 안내를 지원하지 않습니다:', message);
    return;
  }

  const now = Date.now();
  if (now - (lastWarningAt.get(key) || 0) < WARNING_COOLDOWN_MS) return;
  lastWarningAt.set(key, now);

  const utterance = new SpeechSynthesisUtterance(message);
  utterance.lang = 'ko-KR';
  utterance.rate = 1;
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(utterance);
}

async function startCamera() {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error('이 브라우저에서는 카메라를 사용할 수 없습니다.');
  }
  if (!window.cocoSsd) {
    throw new Error('장애물 감지 모델을 불러오지 못했습니다.');
  }

  const video = document.getElementById('webcam');
  cameraStream = await navigator.mediaDevices.getUserMedia({
    video: { facingMode: 'environment' }
  });
  video.srcObject = cameraStream;

  try {
    await video.play();
    const model = await window.cocoSsd.load();
    detectionTimer = setInterval(async () => {
      if (detectionInProgress || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) return;
      detectionInProgress = true;
      try {
        const predictions = await model.detect(video);
        const danger = predictions.find(prediction =>
          ['car', 'chair', 'person', 'bicycle'].includes(prediction.class) &&
          prediction.score >= OBSTACLE_CONFIDENCE_THRESHOLD
        );
        if (danger) {
          console.warn('전방 장애물 감지:', danger.class, danger.score);
          speakWarning('obstacle', '전방에 장애물이 감지되었습니다. 주의하세요.');
        }
      } catch (error) {
        console.error('카메라 장애물 분석에 실패했습니다.', error);
        stopCamera();
      } finally {
        detectionInProgress = false;
      }
    }, 2000);
  } catch (error) {
    stopCamera();
    throw error;
  }
}

function stopCamera() {
  if (detectionTimer) {
    clearInterval(detectionTimer);
    detectionTimer = null;
  }
  if (cameraStream) {
    cameraStream.getTracks().forEach(track => track.stop());
    cameraStream = null;
  }
  const video = document.getElementById('webcam');
  if (video) video.srcObject = null;
}

function handleDeviceMotion(event) {
  const acceleration = event.accelerationIncludingGravity || event.acceleration;
  if (!acceleration) return;

  const { x, y, z } = acceleration;
  if (![x, y, z].every(Number.isFinite)) return;

  const totalAcceleration = Math.hypot(x, y, z);
  if (totalAcceleration > SHOCK_THRESHOLD) {
    console.warn('급격한 충격이 감지되었습니다:', totalAcceleration);
    speakWarning('shock', '급격한 충격이 감지되었습니다. 안전을 확인해 주세요.');
  }
}

async function startMotionMonitoring() {
  if (motionMonitoring) return;
  if (!('DeviceMotionEvent' in window)) {
    console.warn('이 브라우저에서는 동작 센서를 사용할 수 없습니다.');
    return;
  }

  if (typeof DeviceMotionEvent.requestPermission === 'function') {
    const permission = await DeviceMotionEvent.requestPermission();
    if (permission !== 'granted') {
      console.warn('동작 센서 권한이 허용되지 않아 충격 감지를 시작하지 못했습니다.');
      return;
    }
  }

  window.addEventListener('devicemotion', handleDeviceMotion);
  motionMonitoring = true;
}

function stopMotionMonitoring() {
  if (!motionMonitoring) return;
  window.removeEventListener('devicemotion', handleDeviceMotion);
  motionMonitoring = false;
}
