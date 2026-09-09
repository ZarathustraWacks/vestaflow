import { NextResponse } from 'next/server';

export function learningHeaders(json = false): HeadersInit {
  return {
    ...(json ? { 'content-type': 'application/json' } : {}),
    ...(process.env.VESTA_LEARNING_API_KEY
      ? { authorization: `Bearer ${process.env.VESTA_LEARNING_API_KEY}` }
      : {}),
  };
}

export async function learningResponse(response: Response): Promise<NextResponse> {
  const text = await response.text();
  if (!text) return NextResponse.json({}, { status: response.status });
  try {
    return NextResponse.json(JSON.parse(text), { status: response.status });
  } catch {
    return NextResponse.json(
      { ok: false, error: response.ok ? 'Learning service returned an unreadable response.' : 'Learning service request failed.' },
      { status: response.ok ? 502 : response.status },
    );
  }
}
