import { NextRequest, NextResponse } from 'next/server';
import { getProgramDerivedAddress, getBytesEncoder } from '@solana/kit';
import type { Address } from '@solana/kit';
import { VAULT_PROGRAM_ADDRESS } from '@/app/generated/vault';
import {
  getMarketById,
  getBetsForMarket,
  resolveMarket,
  updateBetPayout,
  createMarketResolution,
} from '@/lib/supabase/queries';

interface PayoutCalculation {
  betId: string;
  userVaultAddress: string;
  prediction: number;
  error: number;
  accuracyScore: number;
  payout: bigint;
}

// POST /api/betting/markets/resolve
// Resolves a market by distributing payouts proportionally
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { marketId, actualArrivalSeconds, adminSignature } = body;

    // Validate inputs
    if (!marketId || actualArrivalSeconds === undefined) {
      return NextResponse.json(
        { error: 'Missing required fields: marketId, actualArrivalSeconds' },
        { status: 400 }
      );
    }

    // Get market
    const market = await getMarketById(marketId);
    if (!market) {
      return NextResponse.json({ error: 'Market not found' }, { status: 404 });
    }

    if (market.status !== 'FROZEN') {
      return NextResponse.json(
        { error: `Market must be frozen to resolve (current status: ${market.status})` },
        { status: 400 }
      );
    }

    // Get all bets
    const bets = await getBetsForMarket(marketId);

    if (bets.length === 0) {
      // No bets, just mark as resolved
      await resolveMarket({
        marketId,
        actualArrivalSeconds,
        resolutionSignature: 'NO_BETS',
      });

      return NextResponse.json({
        success: true,
        message: 'Market resolved with no bets',
        winnerCount: 0,
      });
    }

    // Calculate proportional payouts
    const payouts = calculatePayouts(bets, actualArrivalSeconds, market.total_pool_lamports);

    // Build distribute_payouts instruction
    const marketIdString = `${market.route}-${market.stop_tag}-${market.vehicle_id}-${new Date(market.created_at).getTime()}`;

    const [marketVaultPda] = await getProgramDerivedAddress({
      programAddress: VAULT_PROGRAM_ADDRESS,
      seeds: [
        getBytesEncoder().encode(new Uint8Array([109, 97, 114, 107, 101, 116])), // "market"
        getBytesEncoder().encode(new TextEncoder().encode(marketIdString)),
      ],
    });

    // Create payout array for Solana instruction
    const solanaPayouts = payouts.map(p => ({
      winnerVault: p.userVaultAddress as Address,
      amount: p.payout,
    }));

    // Build instruction manually (admin needs to sign and send this)
    const { getDistributePayoutsInstructionDataEncoder } = await import('@/app/generated/vault');

    const instruction = {
      programAddress: VAULT_PROGRAM_ADDRESS,
      accounts: [
        { address: process.env.ADMIN_WALLET_ADDRESS as Address, role: 3 }, // WritableSigner (admin)
        { address: marketVaultPda, role: 1 }, // Writable (market vault)
        { address: "11111111111111111111111111111111" as Address, role: 0 }, // Readonly (system program)
        // Remaining accounts are winner vaults (added dynamically)
        ...payouts.map(p => ({ address: p.userVaultAddress as Address, role: 1 })), // Writable (winner vaults)
      ],
      data: getDistributePayoutsInstructionDataEncoder().encode({
        marketId: marketIdString,
        payouts: solanaPayouts,
      }),
    };

    // Calculate total accuracy score
    const totalAccuracyScore = payouts.reduce((sum, p) => sum + p.accuracyScore, 0);
    const totalPayoutLamports = payouts.reduce((sum, p) => sum + p.payout, BigInt(0));

    // If adminSignature is provided, update database
    if (adminSignature) {
      // Update each bet with payout info
      await Promise.all(
        payouts.map(payout =>
          updateBetPayout({
            betId: payout.betId,
            errorSeconds: payout.error,
            accuracyScore: payout.accuracyScore,
            payoutLamports: payout.payout,
            payoutSignature: adminSignature,
          })
        )
      );

      // Create resolution record
      await createMarketResolution({
        marketId,
        actualArrivalSeconds,
        totalPayoutLamports,
        winnerCount: payouts.length,
        totalAccuracyScore,
        resolutionSignature: adminSignature,
      });

      // Mark market as resolved
      await resolveMarket({
        marketId,
        actualArrivalSeconds,
        resolutionSignature: adminSignature,
      });

      return NextResponse.json({
        success: true,
        resolved: true,
        signature: adminSignature,
        winnerCount: payouts.length,
        totalPayout: totalPayoutLamports.toString(),
      });
    }

    // Return unsigned instruction for admin to sign
    return NextResponse.json({
      success: true,
      resolved: false,
      instruction: {
        programAddress: instruction.programAddress,
        accounts: instruction.accounts,
        data: Array.from(instruction.data),
      },
      payouts: payouts.map(p => ({
        betId: p.betId,
        userVault: p.userVaultAddress,
        prediction: p.prediction,
        error: p.error,
        accuracyScore: p.accuracyScore,
        payout: p.payout.toString(),
      })),
      summary: {
        winnerCount: payouts.length,
        totalPayout: totalPayoutLamports.toString(),
        totalAccuracyScore,
        actualArrival: actualArrivalSeconds,
      },
    });

  } catch (error: any) {
    console.error('Error resolving market:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to resolve market' },
      { status: 500 }
    );
  }
}

// Calculate proportional payouts based on accuracy
function calculatePayouts(
  bets: any[],
  actualArrival: number,
  totalPool: bigint
): PayoutCalculation[] {
  // Calculate error and accuracy score for each bet
  const betsWithScores = bets.map(bet => {
    const error = Math.abs(bet.predicted_arrival_seconds - actualArrival);
    const accuracyScore = 1 / (1 + error);

    return {
      betId: bet.id,
      userVaultAddress: bet.wallet_address, // TODO: Should store vault address in bet
      prediction: bet.predicted_arrival_seconds,
      error,
      accuracyScore,
    };
  });

  // Calculate total accuracy score
  const totalAccuracyScore = betsWithScores.reduce((sum, b) => sum + b.accuracyScore, 0);

  // Calculate proportional payout for each bet
  const payouts: PayoutCalculation[] = betsWithScores.map(bet => {
    const payoutAmount = (BigInt(Math.floor((bet.accuracyScore / totalAccuracyScore) * Number(totalPool))));

    return {
      ...bet,
      payout: payoutAmount,
    };
  });

  // Handle rounding: distribute remaining lamports to highest scorer
  const distributedTotal = payouts.reduce((sum, p) => sum + p.payout, BigInt(0));
  const remaining = totalPool - distributedTotal;

  if (remaining > 0 && payouts.length > 0) {
    // Find bet with highest accuracy score
    const bestBet = payouts.reduce((best, current) =>
      current.accuracyScore > best.accuracyScore ? current : best
    );
    bestBet.payout += remaining;
  }

  return payouts;
}

// GET /api/betting/markets/resolve
// Returns frozen markets awaiting resolution
export async function GET() {
  try {
    const { getFrozenMarketsAwaitingResolution } = await import('@/lib/supabase/queries');
    const markets = await getFrozenMarketsAwaitingResolution();

    return NextResponse.json({
      count: markets.length,
      markets: markets.map(m => ({
        id: m.id,
        route: m.route,
        stopTag: m.stop_tag,
        vehicleId: m.vehicle_id,
        freezeTime: m.freeze_time,
        betCount: m.bet_count,
        totalPool: m.total_pool_lamports.toString(),
      })),
    });

  } catch (error: any) {
    console.error('Error fetching markets to resolve:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch markets' },
      { status: 500 }
    );
  }
}
