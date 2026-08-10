import {NextResponse} from 'next/server';import {learningStatus} from '@/lib/learning/client';export async function GET(){return NextResponse.json(await learningStatus())}
