const API_BASE_URL = "https://barrimap.onrender.com";

async function fetchCustomRoute(params) {
  const query = new URLSearchParams(params).toString();
  const res = await fetch(`${API_BASE_URL}/route?${query}`);
  if (!res.ok) {
    const errorData = await res.json();
    throw new Error(errorData.detail || "경로 탐색 중 오류가 발생했습니다.");
  }
  return await res.json();
}
