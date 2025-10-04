import { NextRequest, NextResponse } from 'next/server';
import { caltopoRequestBinary } from '../../../../../utils/caltopo';

export async function GET(
  request: NextRequest,
  { params }: { params: { mediaId: string } }
) {
  try {
    const { mediaId } = params;

    if (!mediaId) {
      return NextResponse.json({ error: 'Missing mediaId' }, { status: 400 });
    }

    const credentialId = process.env.CALTOPO_CREDENTIAL_ID;
    const credentialSecret = process.env.CALTOPO_CREDENTIAL_SECRET;

    if (!credentialId || !credentialSecret) {
      return NextResponse.json({ 
        error: 'Missing CalTopo credentials' 
      }, { status: 500 });
    }

    // Download the image from CalTopo
    const result = await caltopoRequestBinary(
      `/api/v1/media/${mediaId}/1024.jpeg`, // 1024px for good quality
      credentialId,
      credentialSecret
    );

    const { arrayBuffer, contentType } = result;

    // Return the image as a response
    return new NextResponse(arrayBuffer, {
      status: 200,
      headers: {
        'Content-Type': contentType || 'image/jpeg',
        'Cache-Control': 'public, max-age=3600', // Cache for 1 hour
      },
    });

  } catch (error) {
    console.error('Error downloading CalTopo media:', error);
    return NextResponse.json(
      { 
        error: 'Failed to download media', 
        details: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    );
  }
}
