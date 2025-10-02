'use client';

import Head from 'next/head';
import { useState } from 'react';

interface Map {
  id: string;
  title: string;
  accountId: string;
}

interface GPXTrack {
  id: string;
  title: string;
  coordinates: number[][];
  properties: Record<string, unknown>;
  pointCount: number;
}

export default function Home() {
  const [teamId, setTeamId] = useState('');
  const [maps, setMaps] = useState<Map[]>([]);
  const [selectedMapId, setSelectedMapId] = useState<string | null>(null);
  const [gpxTracks, setGpxTracks] = useState<GPXTrack[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [debugInfo, setDebugInfo] = useState<{
    lastAction: string;
    success: boolean;
    mapsCount?: number;
    tracksCount?: number;
    timestamp: string;
    teamId?: string;
    mapId?: string;
  } | null>(null);
  const [showDebug, setShowDebug] = useState(false);

  // Fetch maps using team_id
  const handleFetchMaps = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log('🚀 Frontend: Starting fetch maps process', { teamId, timestamp: new Date().toISOString() });
    
    setLoading(true);
    setError(null);
    setMaps([]);
    setGpxTracks([]);
    setSelectedMapId(null);

    try {
      console.log('📡 Frontend: Making API request to fetch-account', {
        url: '/api/caltopo/fetch-account',
        method: 'POST',
        body: { teamId },
        teamIdLength: teamId.length,
        teamIdType: typeof teamId
      });

      const response = await fetch('/api/caltopo/fetch-account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ teamId }),
      });

      console.log('📥 Frontend: Received response from fetch-account', {
        status: response.status,
        statusText: response.statusText,
        ok: response.ok,
        headers: Object.fromEntries(response.headers.entries()),
        url: response.url
      });

      // Check if response is HTML instead of JSON
      const contentType = response.headers.get('content-type');
      console.log('🔍 Response Content-Type:', contentType);
      
      if (!contentType || !contentType.includes('application/json')) {
        const htmlText = await response.text();
        console.error('❌ Frontend: Received HTML instead of JSON', {
          contentType,
          htmlPreview: htmlText.slice(0, 500),
          fullUrl: response.url,
          status: response.status
        });
        throw new Error(`Expected JSON but received ${contentType || 'unknown content type'}. This usually means the API route wasn't found.`);
      }

      const data = await response.json();

      console.log('📊 Frontend: Parsed response data', {
        success: data.success,
        mapsCount: data.maps ? data.maps.length : 0,
        message: data.message,
        error: data.error,
        dataKeys: Object.keys(data),
        maps: data.maps ? data.maps.map((map: { id: string; title: string }) => ({ id: map.id, title: map.title })) : []
      });

      if (!response.ok) {
        console.error('❌ Frontend: API request failed', {
          status: response.status,
          error: data.error,
          fullData: data
        });
        throw new Error(data.error || 'Failed to fetch maps.');
      }

      console.log('✅ Frontend: Successfully fetched maps', { mapsCount: data.maps.length });
      setMaps(data.maps);
      
      // Update debug info
      setDebugInfo({
        lastAction: 'fetchMaps',
        success: true,
        mapsCount: data.maps.length,
        timestamp: new Date().toISOString(),
        teamId
      });
    } catch (err: unknown) {
      const error = err as Error;
      console.error('❌ Frontend: Error in handleFetchMaps', {
        error: error.message,
        errorType: typeof err,
        errorName: error.name,
        stack: error.stack,
        teamId
      });
      setError(error.message);
    } finally {
      console.log('🏁 Frontend: Finished fetch maps process', { loading: false });
      setLoading(false);
    }
  };

  // Fetch GPX tracks for a selected map
  const handleFetchTracks = async (mapId: string) => {
    console.log('🚀 Frontend: Starting fetch tracks process', { mapId, timestamp: new Date().toISOString() });
    
    setLoading(true);
    setError(null);
    setGpxTracks([]);
    setSelectedMapId(mapId);

    try {
      console.log('📡 Frontend: Making API request to fetch-map', {
        url: '/api/caltopo/fetch-map',
        method: 'POST',
        body: { mapId },
        mapIdLength: mapId.length,
        mapIdType: typeof mapId
      });

      const response = await fetch('/api/caltopo/fetch-map', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mapId }),
      });

      console.log('📥 Frontend: Received response from fetch-map', {
        status: response.status,
        statusText: response.statusText,
        ok: response.ok,
        headers: Object.fromEntries(response.headers.entries()),
        url: response.url
      });

      const data = await response.json();

      console.log('📊 Frontend: Parsed response data', {
        success: data.success,
        mapId: data.mapId,
        tracksCount: data.gpxTracks ? data.gpxTracks.length : 0,
        error: data.error,
        dataKeys: Object.keys(data),
        tracks: data.gpxTracks ? data.gpxTracks.map((track: { id: string; title: string; pointCount: number }) => ({ 
          id: track.id, 
          title: track.title, 
          pointCount: track.pointCount 
        })) : []
      });

      if (!response.ok) {
        console.error('❌ Frontend: API request failed', {
          status: response.status,
          error: data.error,
          fullData: data
        });
        throw new Error(data.error || 'Failed to fetch tracks.');
      }

      console.log('✅ Frontend: Successfully fetched tracks', { tracksCount: data.gpxTracks.length });
      setGpxTracks(data.gpxTracks);
      
      // Update debug info
      setDebugInfo({
        lastAction: 'fetchTracks',
        success: true,
        tracksCount: data.gpxTracks.length,
        timestamp: new Date().toISOString(),
        mapId
      });
    } catch (err: unknown) {
      const error = err as Error;
      console.error('❌ Frontend: Error in handleFetchTracks', {
        error: error.message,
        errorType: typeof err,
        errorName: error.name,
        stack: error.stack,
        mapId
      });
      setError(error.message);
    } finally {
      console.log('🏁 Frontend: Finished fetch tracks process', { loading: false });
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 py-8 px-4">
      <Head>
        <title>CalTopo GPX Track Viewer</title>
      </Head>
      <div className="max-w-3xl mx-auto bg-white p-6 rounded-lg shadow-md">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold">View Your CalTopo GPX Tracks</h1>
          <button
            onClick={() => setShowDebug(!showDebug)}
            className="bg-gray-500 text-white px-3 py-1 rounded text-sm hover:bg-gray-600"
          >
            {showDebug ? 'Hide Debug' : 'Show Debug'}
          </button>
        </div>

        {/* Debug Panel */}
        {showDebug && (
          <div className="mb-6 p-4 bg-gray-100 rounded-md">
            <h3 className="text-lg font-semibold mb-3">🐛 Debug Information</h3>
            <div className="space-y-2 text-sm">
              <div><strong>Current State:</strong></div>
              <div>• Team ID: {teamId || 'Not set'}</div>
              <div>• Maps Count: {maps.length}</div>
              <div>• Selected Map ID: {selectedMapId || 'None'}</div>
              <div>• GPX Tracks Count: {gpxTracks.length}</div>
              <div>• Loading: {loading ? 'Yes' : 'No'}</div>
              <div>• Error: {error || 'None'}</div>
              
              {debugInfo && (
                <div className="mt-3">
                  <div><strong>Last Action:</strong></div>
                  <div>• Action: {debugInfo.lastAction}</div>
                  <div>• Success: {debugInfo.success ? 'Yes' : 'No'}</div>
                  <div>• Timestamp: {debugInfo.timestamp}</div>
                  {debugInfo.mapsCount !== undefined && <div>• Maps Found: {debugInfo.mapsCount}</div>}
                  {debugInfo.tracksCount !== undefined && <div>• Tracks Found: {debugInfo.tracksCount}</div>}
                </div>
              )}
              
              <div className="mt-3">
                <div><strong>Environment Check:</strong></div>
                <div>• Check browser console for detailed logs</div>
                <div>• Look for 🔍, ❌, ✅ emoji indicators</div>
                <div>• API calls logged with full request/response details</div>
              </div>
            </div>
          </div>
        )}

        {/* Team ID Form */}
        <form onSubmit={handleFetchMaps} className="mb-6">
          <label htmlFor="teamId" className="block text-sm font-medium text-gray-700 mb-2">
            Enter Team ID
          </label>
          <input
            type="text"
            id="teamId"
            value={teamId}
            onChange={(e) => setTeamId(e.target.value)}
            className="w-full p-2 border border-gray-300 rounded-md mb-3"
            placeholder="e.g., ABC123"
            required
          />
          <button
            type="submit"
            className="w-full bg-blue-500 text-white p-2 rounded-md hover:bg-blue-600 disabled:bg-gray-400"
            disabled={loading}
          >
            {loading ? 'Loading...' : 'Fetch Maps'}
          </button>
        </form>

        {/* Error Message */}
        {error && (
          <div className="mb-4 p-3 bg-red-100 text-red-700 rounded-md text-sm">
            <p><strong>Error:</strong> {error}</p>
          </div>
        )}

        {/* Maps List */}
        {maps.length > 0 && (
          <div className="mb-6">
            <h2 className="text-xl font-semibold mb-3">Available Maps</h2>
            <ul className="space-y-2">
              {maps.map((map) => (
                <li key={map.id} className="flex justify-between items-center p-2 bg-gray-50 rounded-md">
                  <span>{map.title} (ID: {map.id})</span>
                  <button
                    onClick={() => handleFetchTracks(map.id)}
                    className="bg-green-500 text-white px-3 py-1 rounded hover:bg-green-600 disabled:bg-gray-400 text-sm"
                    disabled={loading || selectedMapId === map.id}
                  >
                    {loading && selectedMapId === map.id ? 'Loading...' : 'View Tracks'}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* GPX Tracks Display */}
        {gpxTracks.length > 0 && (
          <div>
            <h2 className="text-xl font-semibold mb-3">GPX Tracks (Map ID: {selectedMapId})</h2>
            {gpxTracks.map((track) => (
              <div key={track.id} className="mb-4 p-4 border border-gray-200 rounded-md bg-gray-50">
                <h3 className="text-lg font-medium">{track.title}</h3>
                <p className="text-sm"><strong>Track ID:</strong> {track.id}</p>
                <p className="text-sm"><strong>Points:</strong> {track.pointCount}</p>
                <p className="text-sm"><strong>Properties:</strong></p>
                <pre className="bg-white p-2 rounded text-xs overflow-auto max-h-32">
                  {JSON.stringify(track.properties, null, 2)}
                </pre>
                <p className="text-sm"><strong>Coordinates (Longitude, Latitude):</strong></p>
                <pre className="bg-white p-2 rounded text-xs overflow-auto max-h-32">
                  {JSON.stringify(track.coordinates, null, 2)}
                </pre>
              </div>
            ))}
          </div>
        )}

        {selectedMapId && gpxTracks.length === 0 && !loading && !error && (
          <div className="p-3 bg-yellow-100 text-yellow-700 rounded-md text-sm">
            No GPX tracks found in this map.
          </div>
        )}
      </div>
    </div>
  );
}
