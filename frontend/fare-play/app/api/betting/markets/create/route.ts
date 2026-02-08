import { NextRequest, NextResponse } from 'next/server';
import { getProgramDerivedAddress, getAddressEncoder, getBytesEncoder } from '@solana/kit';
import type { Address } from '@solana/kit';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { createMarket, getMarketsForVehicle } from '@/lib/supabase/queries';
import { VAULT_PROGRAM_ADDRESS } from '@/app/generated/vault';

// POST /api/betting/markets/create
// Creates a new prediction market for a vehicle arrival
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { route, stopTag, vehicleId, predictedArrivalSeconds } = body;

    // Validate inputs
    if (!route || !stopTag || !vehicleId || !predictedArrivalSeconds) {
      return NextResponse.json(
        { error: 'Missing required fields: route, stopTag, vehicleId, predictedArrivalSeconds' },
        { status: 400 }
      );
    }

    if (predictedArrivalSeconds < 60) {
      return NextResponse.json(
        { error: 'Predicted arrival must be at least 60 seconds in the future' },
        { status: 400 }
      );
    }

    // Check if market already exists for this vehicle
    const existingMarkets = await getMarketsForVehicle(route, stopTag, vehicleId);
    const activeMarket = existingMarkets.find(m => m.status === 'ACTIVE' || m.status === 'FROZEN');

    if (activeMarket) {
      return NextResponse.json({
        marketId: activeMarket.id,
        marketVaultAddress: activeMarket.market_vault_address,
        freezeTime: activeMarket.freeze_time,
        existing: true,
      });
    }

    // Generate unique market ID
    const marketId = `${route}-${stopTag}-${vehicleId}-${Date.now()}`;

    // Derive market vault PDA
    const [marketVaultPda] = await getProgramDerivedAddress({
      programAddress: VAULT_PROGRAM_ADDRESS,
      seeds: [
        getBytesEncoder().encode(new Uint8Array([109, 97, 114, 107, 101, 116])), // "market"
        getBytesEncoder().encode(new TextEncoder().encode(marketId)),
      ],
    });

    // Calculate freeze time (5 minutes before predicted arrival)
    const freezeTime = new Date(Date.now() + (predictedArrivalSeconds - 300) * 1000);

    // Create market in database
    const market = await createMarket({
      route,
      stopTag,
      vehicleId,
      marketVaultAddress: marketVaultPda,
      marketIdString: marketId,  // Store the exact string used for PDA derivation
      freezeTime,
      predictedArrivalSeconds,
    });

    return NextResponse.json({
      marketId: market.id,
      marketVaultAddress: market.market_vault_address,
      freezeTime: market.freeze_time,
      predictedArrivalSeconds: market.predicted_arrival_seconds,
      status: market.status,
    });

  } catch (error: any) {
    console.error('Error creating market:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create market' },
      { status: 500 }
    );
  }
}

// GET /api/betting/markets/create
// Returns info about market creation (for debugging)
export async function GET() {
  return NextResponse.json({
    endpoint: 'POST /api/betting/markets/create',
    description: 'Create a new prediction market for vehicle arrival',
    requiredFields: ['route', 'stopTag', 'vehicleId', 'predictedArrivalSeconds'],
  });
}
