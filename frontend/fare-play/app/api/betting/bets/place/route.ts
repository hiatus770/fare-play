import { NextRequest, NextResponse } from 'next/server';
import { getProgramDerivedAddress, getAddressEncoder, getBytesEncoder } from '@solana/kit';
import type { Address } from '@solana/kit';
import { VAULT_PROGRAM_ADDRESS } from '@/app/generated/vault';
import { getOrCreateUser, getMarketById } from '@/lib/supabase/queries';

// POST /api/betting/bets/place
// Creates a bet placement transaction (unsigned)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { walletAddress, marketId, predictedArrivalSeconds, amountLamports } = body;

    // Validate inputs
    if (!walletAddress || !marketId || !predictedArrivalSeconds || !amountLamports) {
      return NextResponse.json(
        { error: 'Missing required fields: walletAddress, marketId, predictedArrivalSeconds, amountLamports' },
        { status: 400 }
      );
    }

    if (amountLamports <= 0) {
      return NextResponse.json(
        { error: 'Bet amount must be greater than 0' },
        { status: 400 }
      );
    }

    if (predictedArrivalSeconds <= 0) {
      return NextResponse.json(
        { error: 'Predicted arrival must be greater than 0 seconds' },
        { status: 400 }
      );
    }

    // Get market and verify it's active
    const market = await getMarketById(marketId);
    if (!market) {
      return NextResponse.json({ error: 'Market not found' }, { status: 404 });
    }

    if (market.status !== 'ACTIVE') {
      return NextResponse.json(
        { error: `Market is ${market.status.toLowerCase()}, betting is closed` },
        { status: 400 }
      );
    }

    // Check if market is frozen
    const now = new Date();
    const freezeTime = new Date(market.freeze_time);
    if (now >= freezeTime) {
      return NextResponse.json(
        { error: 'Market has frozen, betting is closed' },
        { status: 400 }
      );
    }

    // Derive user vault PDA
    const userAddress = walletAddress as Address;
    const [userVaultPda] = await getProgramDerivedAddress({
      programAddress: VAULT_PROGRAM_ADDRESS,
      seeds: [
        getBytesEncoder().encode(new Uint8Array([118, 97, 117, 108, 116])), // "vault"
        getAddressEncoder().encode(userAddress),
      ],
    });

    // Get market vault address from database
    const marketVaultAddress = market.market_vault_address as Address;

    // Get or create user in database
    const user = await getOrCreateUser(walletAddress, userVaultPda);

    // Build place_bet instruction
    // Note: We'll use the market_id string that was used to derive the PDA
    const marketIdString = `${market.route}-${market.stop_tag}-${market.vehicle_id}-${new Date(market.created_at).getTime()}`;

    // Manually construct the instruction (like VaultCard does)
    const { getPlaceBetInstructionDataEncoder } = await import('@/app/generated/vault');

    const instruction = {
      programAddress: VAULT_PROGRAM_ADDRESS,
      accounts: [
        { address: userAddress, role: 3 }, // WritableSigner
        { address: userVaultPda, role: 1 }, // Writable (user vault)
        { address: marketVaultAddress, role: 1 }, // Writable (market vault)
        { address: "11111111111111111111111111111111" as Address, role: 0 }, // Readonly (system program)
      ],
      data: getPlaceBetInstructionDataEncoder().encode({
        marketId: marketIdString,
        amount: BigInt(amountLamports),
      }),
    };

    // Return unsigned transaction details
    // Frontend will sign and send, then call /api/betting/bets/confirm
    return NextResponse.json({
      instruction: {
        programAddress: instruction.programAddress,
        accounts: instruction.accounts,
        data: Array.from(instruction.data),
      },
      marketId: market.id,
      userId: user.id,
      userVaultAddress: userVaultPda,
      marketVaultAddress,
    });

  } catch (error: any) {
    console.error('Error creating bet transaction:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create bet transaction' },
      { status: 500 }
    );
  }
}

// GET /api/betting/bets/place
export async function GET() {
  return NextResponse.json({
    endpoint: 'POST /api/betting/bets/place',
    description: 'Create an unsigned bet placement transaction',
    requiredFields: ['walletAddress', 'marketId', 'predictedArrivalSeconds', 'amountLamports'],
  });
}
