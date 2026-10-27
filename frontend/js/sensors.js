let cameraStream = null;
let cameraDetectionTimer = null;
let cameraDetectionModel = null;
let cameraRunId = 0;

async function startCamera() {
  if (cameraStream) return;
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error("이 브라우저는 카메라 접근을 지원하지 않습니다.");
  }

  const video = document.getElementById('webcam');
  const runId = ++cameraRunId;
  const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
  if (runId !== cameraRunId) {
    stream.getTracks().forEach(track => track.stop());
    return;
  }

  cameraStream = stream;
  video.srcObject = stream;
  await video.play();

  if (window.cocoSsd) {
    cameraDetectionModel ??= await cocoSsd.load();
    if (runId !== cameraRunId) return;

    const detectObjects = async () => {
      if (runId !== cameraRunId || !cameraStream) return;
      try {
        const predictions = await cameraDetectionModel.detect(video);
        const danger = predictions.find(p => ['car', 'chair', 'person', 'bicycle'].includes(p.class));
        if (danger) console.warn("전방 장애물 감지:", danger.class);
      } catch (error) {
        if (runId === cameraRunId) {
          console.error("카메라 객체 인식에 실패했습니다.", error);
          stopCamera();
        }
      } finally {
        if (runId === cameraRunId && cameraStream) {
          cameraDetectionTimer = setTimeout(detectObjects, 2000);
        }
      }
    };
    detectObjects();
  }
}

function stopCamera() {
  cameraRunId += 1;
  if (cameraDetectionTimer) {
    clearTimeout(cameraDetectionTimer);
    cameraDetectionTimer = null;
  }
  if (cameraStream) {
    cameraStream.getTracks().forEach(track => track.stop());
    cameraStream = null;
  }

  const video = document.getElementById('webcam');
  if (video) {
    video.pause();
    video.srcObject = null;
  }
}

window.addEventListener('devicemotion', (e) => {
  const acc = e.accelerationIncludingGravity;
  if (acc) {
    const totalAcc = Math.sqrt(acc.x**2 + acc.y**2 + acc.z**2);
    if (totalAcc > 30) {
      alert("⚠️ 급격한 충격/낙상이 감지되었습니다!");
    }
  }
});
