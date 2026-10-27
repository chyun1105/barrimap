async function startCamera() {
  const video = document.getElementById('webcam');
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
    video.srcObject = stream;
    if (window.cocoSsd) {
      const model = await cocoSsd.load();
      setInterval(async () => {
        const predictions = await model.detect(video);
        if (predictions.length > 0) {
          const danger = predictions.find(p => ['car', 'chair', 'person', 'bicycle'].includes(p.class));
          if (danger) {
            console.warn("전방 장애물 감지:", danger.class);
          }
        }
      }, 2000);
    }
  } catch (e) {
    console.log("카메라 접근 권한이 없거나 지원되지 않는 기기입니다.");
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
