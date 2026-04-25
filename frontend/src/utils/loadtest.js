const PROXY_URL = process.env.REACT_APP_PROXY_URL || 'http://localhost:3001';

export async function runLoadTest(file, config) {
  // Convert file to base64
  const fileContent = await fileToBase64(file);

  const response = await fetch(`${PROXY_URL}/api/loadtest/run`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      fileContent,
      fileName: file.name,
      threads: config.threads,
      rampUp: config.rampUp,
      duration: config.duration,
      loops: config.loops,
      criteria: config.criteria,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Load test failed');
  }

  return response.json();
}

export async function checkJMeterAvailable() {
  try {
    const response = await fetch(`${PROXY_URL}/api/loadtest/check`);
    const data = await response.json();
    return data.available;
  } catch {
    return false;
  }
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
