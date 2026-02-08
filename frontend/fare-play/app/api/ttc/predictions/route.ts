import { NextRequest, NextResponse } from 'next/server';

// GET /api/ttc/predictions?route=501&stop=24211
// Proxies to Flask backend to avoid CORS
export async function GET(request: NextRequest) {
  const route = request.nextUrl.searchParams.get('route');
  const stop = request.nextUrl.searchParams.get('stop');

  if (!route || !stop) {
    return NextResponse.json({ error: 'route and stop parameters required' }, { status: 400 });
  }

  try {
    const resp = await fetch(`http://localhost:5000/stop/${route}/${stop}`, {
      cache: 'no-store',
    });

    if (!resp.ok) {
      return NextResponse.json(
        { error: `TTC backend returned ${resp.status}` },
        { status: resp.status }
      );
    }

    const data = await resp.json();
    return NextResponse.json(data);
  } catch {
    return NextResponse.json(
      { error: 'Failed to connect to TTC backend (is it running on port 5000?)' },
      { status: 502 }
    );
  }
}
