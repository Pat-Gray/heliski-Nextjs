import crypto from 'crypto';
import fetch from 'node-fetch';

const DEFAULT_TIMEOUT_MS = 2 * 60 * 1000;

function sign(method: string, url: string, expires: number, payloadString: string, credentialSecret: string): string {
  const message = `${method} ${url}\n${expires}\n${payloadString}`;
  const secret = Buffer.from(credentialSecret, 'base64');
  // Match CalTopo Python exactly: digest first, then base64 encode
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(message);
  const digest = hmac.digest(); // Binary digest
  const signature = digest.toString('base64'); // Base64 encode
  return signature;
}

export async function caltopoRequest(
  method: string, 
  endpoint: string, 
  credentialId: string, 
  credentialSecret: string, 
  payload: any = null
): Promise<any> {
  // Enhanced debugging for environment and parameters

  // Validate credentials before proceeding
  if (!credentialId || !credentialSecret) {
    const error = 'Missing CalTopo credentials';
    console.error('❌ CalTopo Credential Error:', {
      credentialId: credentialId ? 'Present' : 'MISSING',
      credentialSecret: credentialSecret ? 'Present' : 'MISSING',
      error
    });
    throw new Error(error);
  }

  const payloadString = payload ? JSON.stringify(payload) : '';
  const expires = Date.now() + DEFAULT_TIMEOUT_MS;
  const fullUrl = `https://caltopo.com${endpoint}`;
  
  

  const signature = sign(method, endpoint, expires, payloadString, credentialSecret);
  
  

  const parameters = {
    id: credentialId,
    expires: expires.toString(),
    signature,
  };

  let url = fullUrl;
  let body: string | null = null;

  if (method.toUpperCase() === 'POST' && payload) {
    parameters.json = payloadString;
    body = new URLSearchParams(parameters).toString();
  } else {
    const queryString = new URLSearchParams(parameters).toString();
    url += `?${queryString}`;
  }

  const headers = {
    'Content-Type': 'application/x-www-form-urlencoded',
  };

  

  const response = await fetch(url, {
    method: method.toUpperCase(),
    headers,
    body: body || undefined,
  });



  if (!response.ok) {
    const contentType = response.headers.get('content-type');
    const errorText = await response.text();
    console.error('❌ CalTopo API Error Details:', {
      endpoint,
      status: response.status,
      statusText: response.statusText,
      contentType,
      responseSnippet: errorText.slice(0, 500), // Log first 500 chars
      fullErrorText: errorText, // Log full error for debugging
      requestUrl: url,
      requestMethod: method.toUpperCase(),
      requestHeaders: headers,
      requestBody: body
    });
    throw new Error(`CalTopo API failed with status ${response.status}: ${errorText.slice(0, 200)}`);
  }

  const contentType = response.headers.get('content-type');
  if (!contentType || !contentType.includes('application/json')) {
    const errorText = await response.text();
    console.error('CalTopo API non-JSON response:', {
      endpoint,
      contentType,
      responseSnippet: errorText.slice(0, 200),
    });
    throw new Error(`Expected JSON but received ${contentType || 'unknown content type'}: ${errorText.slice(0, 200)}`);
  }

  const data = await response.json();
  
  

  return data.result || data;
}
