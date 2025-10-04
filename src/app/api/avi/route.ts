import { NextRequest, NextResponse } from 'next/server';
import { caltopoRequest } from '../../../utils/caltopo';

interface CalTopoFeature {
  id?: string;
  type?: string;
  geometry?: {
    type: string;
    coordinates: number[][][] | number[][] | number[];
  };
  properties?: {
    title?: string;
    class?: string;
    folderId?: string;
    color?: string;
    parentId?: string;
    backendMediaId?: string;
    description?: string;
    comment?: string;
    notes?: string;
    details?: string;
    'marker-color'?: string;
    'marker-size'?: string;
    'marker-symbol'?: string;
    created?: number;
    updated?: number;
    creator?: string;
    [key: string]: unknown;
  };
}

interface CalTopoGroup {
  id: string;
  name: string;
  color?: string;
}

interface CalTopoMapResponse {
  state: {
    groups?: CalTopoGroup[];
    features?: CalTopoFeature[];
  };
  [key: string]: unknown;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { mapId } = body;

    // Use provided mapId or fall back to environment variable
    const avalancheMapId = mapId || process.env.CALTOPO_AVALANCHE_MAP_ID;

    if (!avalancheMapId) {
      return NextResponse.json({ 
        error: 'Missing mapId in request body and CALTOPO_AVALANCHE_MAP_ID not configured in environment variables' 
      }, { status: 400 });
    }

    const credentialId = process.env.CALTOPO_CREDENTIAL_ID;
    const credentialSecret = process.env.CALTOPO_CREDENTIAL_SECRET;

    if (!credentialId || !credentialSecret) {
      return NextResponse.json({ 
        error: 'Missing CalTopo credentials in environment' 
      }, { status: 500 });
    }

    // Fetch map data (GET /api/v1/map/{map_id}/since/0)
    const mapDataResponse = await caltopoRequest(
      'GET',
      `/api/v1/map/${avalancheMapId}/since/0`,
      credentialId,
      credentialSecret
    );
    
    // Type guard to ensure we have the expected structure
    if (!mapDataResponse || typeof mapDataResponse !== 'object') {
      return NextResponse.json({ 
        success: false, 
        error: 'Invalid response structure from CalTopo' 
      }, { status: 500 });
    }
    
    const mapData = mapDataResponse as CalTopoMapResponse;

    if (!mapData) {
      return NextResponse.json({ 
        success: false, 
        error: 'Failed to fetch map data from CalTopo' 
      }, { status: 500 });
    }

    console.log('🗺️ Raw map data from CalTopo:', JSON.stringify(mapData, null, 2));
    console.log('📁 Available groups:', mapData.state.groups);
    console.log('🎯 Available features count:', mapData.state.features?.length || 0);
    
    // Log the first few features to see their structure
    if (mapData.state.features && mapData.state.features.length > 0) {
      console.log('🔍 First 3 features structure:', mapData.state.features.slice(0, 3).map(f => ({
        id: f.id,
        type: f.type,
        properties: f.properties,
        geometry: f.geometry
      })));
    }
    
    // Log all folder features
    const folderFeatures = mapData.state.features?.filter((feature: CalTopoFeature) => feature.properties?.class === 'Folder') || [];
    console.log('📂 All folder features:', folderFeatures.map(f => ({ id: f.id, title: f.properties?.title, class: f.properties?.class })));

    // Find the "avalanche paths" folder/group
    console.log('🔍 Searching for avalanche paths folder...');
    
    // Try multiple search patterns for avalanche paths
    const avalanchePathsGroup = mapData.state.groups?.find(
      group => {
        const name = group.name.toLowerCase();
        return (name.includes('avalanche') && name.includes('path')) ||
               name.includes('avalanche') ||
               name.includes('avi');
      }
    ) || mapData.state.features?.find(
      feature => {
        if (feature.properties?.class !== 'Folder') return false;
        const title = feature.properties?.title?.toLowerCase() || '';
        return (title.includes('avalanche') && title.includes('path')) ||
               title.includes('avalanche') ||
               title.includes('avi');
      }
    );

    console.log('🎯 Found avalanche paths group:', avalanchePathsGroup);

    if (!avalanchePathsGroup) {
      console.log('❌ No avalanche paths folder found. Available folder names:');
      console.log('Groups:', mapData.state.groups?.map(g => g.name) || []);
      console.log('Folder features:', folderFeatures.map(f => f.properties?.title).filter(Boolean));
      return NextResponse.json({ 
        success: false, 
        error: 'Avalanche paths folder not found in map' 
      }, { status: 404 });
    }

    const avalanchePathsGroupId = avalanchePathsGroup.id;
    console.log('🆔 Avalanche paths group ID:', avalanchePathsGroupId);

    // Extract all features from the avalanche paths folder
    const avalancheFeatures = mapData.state.features
      ?.filter((feature: CalTopoFeature) => {
        const isInFolder = feature.properties?.folderId === avalanchePathsGroupId ||
                          feature.properties?.parentId === avalanchePathsGroupId;
        console.log(`🔍 Checking feature ${feature.id} (${feature.properties?.title}):`, {
          folderId: feature.properties?.folderId,
          parentId: feature.properties?.parentId,
          targetId: avalanchePathsGroupId,
          isInFolder
        });
        return isInFolder;
      })
      ?.map((feature: CalTopoFeature) => {
        // Try to get ID from different possible locations
        const featureId = feature.id || 
                         feature.properties?.id || 
                         feature.properties?.featureId ||
                         `feature-${Math.random().toString(36).substr(2, 9)}`; // Fallback ID
        
        console.log(`🔍 Processing feature:`, {
          id: featureId,
          originalId: feature.id,
          propertiesId: feature.properties?.id,
          title: feature.properties?.title,
          class: feature.properties?.class,
          folderId: feature.properties?.folderId,
          parentId: feature.properties?.parentId,
          fullFeature: feature
        });
        
        // Find images associated with this feature
        const associatedImages = mapData.state.features?.filter((imgFeature: CalTopoFeature) => 
          imgFeature.properties?.class === 'MapMediaObject' && 
          (imgFeature.properties?.parentId === `Shape:${featureId}` || 
           imgFeature.properties?.parentId === featureId)
        ) || [];

        console.log(`🔍 Checking images for feature ${featureId} (${feature.properties?.title}):`);
        console.log(`🔍   Looking for parentId: "Shape:${featureId}" or "${featureId}"`);
        
        // Log all MapMediaObject features to see what's available
        const allMediaObjects = mapData.state.features?.filter((f: CalTopoFeature) => 
          f.properties?.class === 'MapMediaObject'
        ) || [];
        console.log(`🔍   All MapMediaObject features:`, allMediaObjects.map(f => ({
          id: f.id,
          parentId: f.properties?.parentId,
          title: f.properties?.title
        })));

        const hasImages = associatedImages.length > 0;
        console.log(`🔍   Found ${associatedImages.length} associated images for feature ${featureId}`);

        // Extract coordinates based on geometry type
        let coordinates: number[][] = [];
        let pointCount = 0;
        
        if (feature.geometry?.coordinates) {
          if (feature.geometry.type === 'Polygon') {
            // For Polygon, coordinates are [ring1, ring2, ...] where each ring is [point1, point2, ...]
            const polygonCoords = feature.geometry.coordinates as unknown as number[][][];
            const firstRing = polygonCoords[0] || [];
            coordinates = firstRing;
            pointCount = coordinates.length;
          } else if (feature.geometry.type === 'LineString') {
            // For LineString, coordinates are [point1, point2, ...]
            coordinates = feature.geometry.coordinates as unknown as number[][];
            pointCount = coordinates.length;
          } else if (feature.geometry.type === 'Point') {
            // For Point, coordinates are [lon, lat]
            const point = feature.geometry.coordinates as unknown as number[];
            coordinates = [point];
            pointCount = 1;
          }
        }

        const result = {
          id: featureId,
          title: feature.properties?.title || 'Unnamed Feature',
          coordinates: coordinates,
          properties: feature.properties,
          pointCount: pointCount,
          groupId: feature.properties?.folderId || avalanchePathsGroupId,
          hasImages: hasImages,
          geometryType: feature.geometry?.type || 'Unknown',
          class: feature.properties?.class || 'Unknown',
          images: associatedImages.map(img => ({
            id: img.id || `img-${Math.random().toString(36).substr(2, 9)}`,
            title: img.properties?.title || 'Unnamed Image',
            backendMediaId: img.properties?.backendMediaId,
            parentId: img.properties?.parentId,
            description: img.properties?.description,
            comment: img.properties?.comment,
            notes: img.properties?.notes,
            details: img.properties?.details,
            markerColor: img.properties?.['marker-color'],
            markerSize: img.properties?.['marker-size'],
            markerSymbol: img.properties?.['marker-symbol'],
            created: img.properties?.created,
            updated: img.properties?.updated,
            creator: img.properties?.creator,
            // Add download URL for the image
            downloadUrl: img.properties?.backendMediaId ? 
              `/api/caltopo/media/${img.properties.backendMediaId}` : null
          }))
        };
        
        console.log(`🔍 Created feature result for ${featureId}:`, {
          id: result.id,
          title: result.title,
          hasImages: result.hasImages,
          imageCount: result.images.length
        });
        
        return result;
      }) || [];

    console.log('🏔️ Found avalanche features:', avalancheFeatures.length);
    console.log('🏔️ Avalanche features details:', avalancheFeatures.map(f => ({ 
      id: f.id, 
      title: f.title, 
      geometryType: f.geometryType, 
      class: f.class,
      pointCount: f.pointCount,
      coordinates: f.coordinates,
      hasImages: f.hasImages,
      imageCount: f.images?.length || 0,
      rawGeometry: f.properties?.geometry || 'No raw geometry'
    })));
    
    // Log detailed image information for each feature
    avalancheFeatures.forEach((feature, index) => {
      console.log(`📸 Feature ${index + 1}: ${feature.title} (${feature.id})`);
      console.log(`📸   Has Images: ${feature.hasImages}`);
      console.log(`📸   Image Count: ${feature.images?.length || 0}`);
      if (feature.images && feature.images.length > 0) {
        feature.images.forEach((img, imgIndex) => {
          console.log(`📸   Image ${imgIndex + 1}: ${img.title} (${img.id})`);
          console.log(`📸     Backend Media ID: ${img.backendMediaId}`);
          console.log(`📸     Parent ID: ${img.parentId}`);
          console.log(`📸     Download URL: ${img.downloadUrl}`);
        });
      }
    });
    
    // Log the raw feature data from CalTopo to understand the structure
    const rawAvalancheFeatures = mapData.state.features?.filter((feature: CalTopoFeature) => 
      feature.properties?.folderId === avalanchePathsGroupId ||
      feature.properties?.parentId === avalanchePathsGroupId
    ) || [];
    console.log('🔍 Raw avalanche features from CalTopo:', rawAvalancheFeatures.map(f => ({
      id: f.id,
      title: f.properties?.title,
      geometry: f.geometry,
      properties: f.properties
    })));

    // Extract images associated with avalanche features
    const avalancheImages = mapData.state.features
      ?.filter((feature: CalTopoFeature) => 
        feature.properties?.class === 'MapMediaObject' &&
        avalancheFeatures.some(avFeature => 
          feature.properties?.parentId === `Shape:${avFeature.id}` || 
          feature.properties?.parentId === avFeature.id
        )
      )
      ?.map((image: CalTopoFeature) => ({
        id: image.id,
        title: image.properties?.title || 'Unnamed Image',
        backendMediaId: image.properties?.backendMediaId,
        parentId: image.properties?.parentId,
        markerColor: image.properties?.['marker-color'],
        markerSize: image.properties?.['marker-size'],
        markerSymbol: image.properties?.['marker-symbol'],
        created: image.properties?.created,
        updated: image.properties?.updated,
        creator: image.properties?.creator,
        properties: image.properties
      })) || [];

    const response = {
      success: true,
      mapId: avalancheMapId,
      avalancheFeatures,
      groups: [avalanchePathsGroup],
      images: avalancheImages,
      totalFeatures: avalancheFeatures.length,
      featureTypes: [...new Set(avalancheFeatures.map(f => f.geometryType))]
    };

    return NextResponse.json(response);
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    if (errorMessage.includes('status 404')) {
      return NextResponse.json({
        error: `Avalanche map not found or service account lacks access permission.`,
      }, { status: 404 });
    }
    if (errorMessage.includes('Expected JSON')) {
      return NextResponse.json({
        error: `Invalid response from CalTopo API. Check credentials and permissions.`,
      }, { status: 500 });
    }
    if (errorMessage.includes('Missing CalTopo credentials')) {
      return NextResponse.json({
        error: 'Server configuration error: Missing CalTopo credentials in environment variables.',
      }, { status: 500 });
    }
    
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
