import { NextRequest, NextResponse } from 'next/server';
import { evaluateLicense, isLicensingEnabled } from '@/lib/server/licensing';

export async function GET() {
    const enabled = isLicensingEnabled();
    const evaluation = await evaluateLicense();
    const now = Math.floor(Date.now() / 1000);
    return NextResponse.json({
        licensing_enabled: enabled,
        status: evaluation.status,
        reason: evaluation.reason || null,
        exp: evaluation.exp || null,
        grace_until: evaluation.graceUntil || null,
        now,
        blocked: enabled && (evaluation.status === 'blocked'),
        details: enabled ? evaluation.payload || null : null,
    });
}
