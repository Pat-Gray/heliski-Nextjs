import { NextRequest, NextResponse } from 'next/server';
import { caltopoRequest } from '../../../../utils/caltopo';

interface CalTopoMap {
  id: string;
  title: string;
  accountId: string;
}

interface CalTopoAccountResponse {
  success: boolean;
  maps: CalTopoMap[];
  message?: string;
}

export async function POST(request: NextRequest) {
  

  try {
    const body = await request.json();
    const { teamId } = body;

    

    if (!teamId) {
      console.log('❌ Missing teamId in request body');
      return NextResponse.json({ error: 'Missing teamId in request body.' }, { status: 400 });
    }

    const credentialId = process.env.CALTOPO_CREDENTIAL_ID;
    const credentialSecret = process.env.CALTOPO_CREDENTIAL_SECRET;

  

    if (!credentialId || !credentialSecret) {
      console.error('❌ Missing CalTopo credentials in environment');
      return NextResponse.json({ error: 'Server configuration error: Missing credentials in .env.local.' }, { status: 500 });
    }



    
    const accountData = await caltopoRequest(
      'GET',
      `/api/v1/acct/${teamId}/since/0`,
      credentialId,
      credentialSecret
    );



    const collaborativeMaps = accountData.features
      .filter((feature: any) => feature.properties?.class === 'CollaborativeMap')
      .map((map: any) => ({
        id: map.id,
        title: map.properties?.title || 'Unnamed Map',
        accountId: map.properties?.accountId,
      }));

  

    const response = {
      success: true,
      maps: collaborativeMaps,
      message: collaborativeMaps.length === 0 ? `No collaborative maps found for team ${teamId}.` : undefined,
    };

    console.log('✅ Fetch Account API Success:', response);
    return NextResponse.json(response);
  } catch (error: any) {
    console.error('❌ Fetch Account API Error:', {
      errorMessage: error.message,
      errorStack: error.stack,
      errorName: error.name,
      errorType: typeof error,
      timestamp: new Date().toISOString()
    });

    if (error.message.includes('status 404')) {
      console.log('🔍 404 Error - Team not found or no admin permission');
      return NextResponse.json({
        error: `Team ID not found or service account lacks ADMIN permission. Verify team_id and permissions at https://caltopo.com/group/admin/details.`,
      }, { status: 404 });
    }
    if (error.message.includes('Expected JSON')) {
      console.log('🔍 JSON Error - Invalid response format');
      return NextResponse.json({
        error: `Invalid response from CalTopo API. Check credentials and permissions.`,
      }, { status: 500 });
    }
    if (error.message.includes('Missing CalTopo credentials')) {
      console.log('🔍 Credentials Error - Environment variables missing');
      return NextResponse.json({
        error: 'Server configuration error: Missing CalTopo credentials in environment variables.',
      }, { status: 500 });
    }
    
    console.log('🔍 Generic Error - Unknown error type');
    return NextResponse.json({ error: `Failed to fetch maps: ${error.message}` }, { status: 500 });
  }
}
