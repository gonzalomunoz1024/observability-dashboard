const PROXY_URL = process.env.REACT_APP_PROXY_URL || 'http://localhost:3001';

export async function checkHealth(service) {
  const { url, method = 'GET', timeout = 5000, expectedStatus = 200 } = service;

  try {
    const response = await fetch(`${PROXY_URL}/api/health-check`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ url, method, timeout, expectedStatus }),
    });

    if (!response.ok) {
      throw new Error(`Proxy server error: ${response.status}`);
    }

    const result = await response.json();

    return {
      ...result,
      lastChecked: new Date().toISOString(),
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      statusCode: null,
      responseTime: null,
      error: error.message,
      lastChecked: new Date().toISOString(),
    };
  }
}
