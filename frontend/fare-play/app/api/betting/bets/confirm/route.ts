import { NextRequest, NextResponse } from 'next/server';
import { createBet } from '@/lib/supabase/queries';

// POST /api/betting/bets/confirm
// Records a bet in the database after successful Solana transaction
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      marketId,
      userId,
      walletAddress,
      predictedArrivalSeconds,
      amountLamports,
      signature
    } = body;

    // Validate inputs
    if (!marketId || !userId || !walletAddress || !predictedArrivalSeconds || !amountLamports || !signature) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Create bet record in database
    const bet = await createBet({
      marketId,
      userId,
      walletAddress,
      predictedArrivalSeconds: parseInt(predictedArrivalSeconds),
      amountLamports: BigInt(amountLamports),
      placementSignature: signature,
    });

    return NextResponse.json({
      success: true,
      betId: bet.id,
      signature,
    });

  } catch (error: any) {
    console.error('Error confirming bet:', error);

    // Check for unique constraint violation (user already has bet in this market)
    if (error.code === '23505') {
      return NextResponse.json(
        { error: 'You have already placed a bet in this market' },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: error.message || 'Failed to confirm bet' },
      { status: 500 }
    );
  }
}
