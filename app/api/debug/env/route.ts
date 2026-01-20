
import { NextResponse } from 'next/server';

export async function GET() {
    const key = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
    return NextResponse.json({
        hasKey: !!key,
        keyLength: key ? key.length : 0,
        envKeys: Object.keys(process.env).filter(k => k.includes('GOOGLE') || k.includes('AI')),
        nodeEnv: process.env.NODE_ENV,
    });
}
