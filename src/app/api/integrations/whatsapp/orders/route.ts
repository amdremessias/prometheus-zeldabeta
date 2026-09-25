import { NextResponse } from 'next/server';
import { pool } from '@/lib/server/db';
export async function GET(){try{const r=await pool.query('SELECT * FROM pedidos_web ORDER BY id DESC LIMIT 500');return NextResponse.json({orders:r.rows});}catch(e){console.error(e);return NextResponse.json({orders:[],error:'report_unavailable'},{status:500});}}
