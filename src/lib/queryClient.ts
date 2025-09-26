export async function apiRequest(method: string, url: string, data?: unknown) {
  // Ensure the URL starts with /api if it doesn't already
  const fullUrl = url.startsWith('/api') ? url : `/api${url}`;
  
  const response = await fetch(fullUrl, {
    method,
    headers: {
      'Content-Type': 'application/json',
    },
    body: data ? JSON.stringify(data) : undefined,
  });
  
  return response;
}

// Query function for React Query
export async function queryFn(url: string) {
  const response = await apiRequest('GET', url);
  if (!response.ok) {
    throw new Error(`Failed to fetch data from ${url}`);
  }
  return response.json();
}
