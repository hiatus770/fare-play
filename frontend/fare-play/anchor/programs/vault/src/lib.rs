use anchor_lang::prelude::*;
use anchor_lang::system_program::{transfer, Transfer};

#[cfg(test)]
mod tests;

declare_id!("EBngoQ315cEWJoeqg8RTBzDnhSuE7BswEtHQ9ou9MSXe");

#[program]
pub mod vault {
    use super::*;

    pub fn deposit(ctx: Context<VaultAction>, amount: u64) -> Result<()> {
        require!(amount > 0, VaultError::InvalidAmount);

        transfer(
            CpiContext::new(
                ctx.accounts.system_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.signer.to_account_info(),
                    to: ctx.accounts.vault.to_account_info(),
                },
            ),
            amount,
        )?;

        Ok(())
    }

    pub fn withdraw(ctx: Context<VaultAction>) -> Result<()> {
        require!(ctx.accounts.vault.lamports() > 0, VaultError::InvalidAmount);

        let bump = ctx.bumps.vault;
        let signer_key = ctx.accounts.signer.key();
        let signer_seeds: &[&[&[u8]]] = &[&[b"vault", signer_key.as_ref(), &[bump]]];

        transfer(
            CpiContext::new_with_signer(
                ctx.accounts.system_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.vault.to_account_info(),
                    to: ctx.accounts.signer.to_account_info(),
                },
                signer_seeds,
            ),
            ctx.accounts.vault.lamports(),
        )?;

        Ok(())
    }

    pub fn place_bet(ctx: Context<PlaceBet>, market_id: String, amount: u64) -> Result<()> {
        require!(amount > 0, VaultError::InvalidAmount);
        require!(market_id.len() <= 64, VaultError::InvalidMarketId);

        // Transfer from user's personal vault to market vault
        let bump = ctx.bumps.user_vault;
        let signer_key = ctx.accounts.signer.key();
        let signer_seeds: &[&[&[u8]]] = &[&[b"vault", signer_key.as_ref(), &[bump]]];

        transfer(
            CpiContext::new_with_signer(
                ctx.accounts.system_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.user_vault.to_account_info(),
                    to: ctx.accounts.market_vault.to_account_info(),
                },
                signer_seeds,
            ),
            amount,
        )?;

        Ok(())
    }

    pub fn distribute_payouts<'info>(ctx: Context<'_, '_, '_, 'info, DistributePayouts<'info>>, market_id: String, payouts: Vec<Payout>) -> Result<()> {
        require!(payouts.len() > 0, VaultError::InvalidAmount);
        require!(payouts.len() <= 100, VaultError::TooManyPayouts); // Limit to 100 winners per tx
        require!(market_id.len() <= 64, VaultError::InvalidMarketId);

        let bump = ctx.bumps.market_vault;
        let market_id_bytes = market_id.as_bytes();
        let signer_seeds: &[&[&[u8]]] = &[&[b"market", market_id_bytes, &[bump]]];

        let mut total_distributed = 0u64;

        for payout in payouts.iter() {
            require!(payout.amount > 0, VaultError::InvalidAmount);
            total_distributed = total_distributed.checked_add(payout.amount)
                .ok_or(VaultError::Overflow)?;
        }

        // Verify we have enough funds in market vault
        require!(
            ctx.accounts.market_vault.lamports() >= total_distributed,
            VaultError::InsufficientFunds
        );

        // Distribute payouts to each winner
        for (idx, payout) in payouts.iter().enumerate() {
            let winner_vault = &ctx.remaining_accounts[idx];

            transfer(
                CpiContext::new_with_signer(
                    ctx.accounts.system_program.to_account_info(),
                    Transfer {
                        from: ctx.accounts.market_vault.to_account_info(),
                        to: winner_vault.to_account_info(),
                    },
                    signer_seeds,
                ),
                payout.amount,
            )?;
        }

        Ok(())
    }

    pub fn refund_market<'info>(ctx: Context<'_, '_, '_, 'info, RefundMarket<'info>>, market_id: String, refunds: Vec<Refund>) -> Result<()> {
        require!(refunds.len() > 0, VaultError::InvalidAmount);
        require!(refunds.len() <= 100, VaultError::TooManyPayouts);
        require!(market_id.len() <= 64, VaultError::InvalidMarketId);

        let bump = ctx.bumps.market_vault;
        let market_id_bytes = market_id.as_bytes();
        let signer_seeds: &[&[&[u8]]] = &[&[b"market", market_id_bytes, &[bump]]];

        let mut total_refunded = 0u64;

        for refund in refunds.iter() {
            require!(refund.amount > 0, VaultError::InvalidAmount);
            total_refunded = total_refunded.checked_add(refund.amount)
                .ok_or(VaultError::Overflow)?;
        }

        require!(
            ctx.accounts.market_vault.lamports() >= total_refunded,
            VaultError::InsufficientFunds
        );

        for (idx, refund) in refunds.iter().enumerate() {
            let user_vault = &ctx.remaining_accounts[idx];

            transfer(
                CpiContext::new_with_signer(
                    ctx.accounts.system_program.to_account_info(),
                    Transfer {
                        from: ctx.accounts.market_vault.to_account_info(),
                        to: user_vault.to_account_info(),
                    },
                    signer_seeds,
                ),
                refund.amount,
            )?;
        }

        Ok(())
    }
}

#[derive(Accounts)]
pub struct VaultAction<'info> {
    #[account(mut)]
    pub signer: Signer<'info>,
    /// CHECK: PDA account for user's vault
    #[account(
        mut,
        seeds = [b"vault", signer.key().as_ref()],
        bump,
    )]
    pub vault: UncheckedAccount<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(market_id: String)]
pub struct PlaceBet<'info> {
    #[account(mut)]
    pub signer: Signer<'info>,
    /// CHECK: PDA account for user's vault
    #[account(
        mut,
        seeds = [b"vault", signer.key().as_ref()],
        bump,
    )]
    pub user_vault: UncheckedAccount<'info>,
    /// CHECK: PDA account for market escrow
    #[account(
        mut,
        seeds = [b"market", market_id.as_bytes()],
        bump,
    )]
    pub market_vault: UncheckedAccount<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(market_id: String)]
pub struct DistributePayouts<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,
    /// CHECK: PDA account for market escrow
    #[account(
        mut,
        seeds = [b"market", market_id.as_bytes()],
        bump,
    )]
    pub market_vault: UncheckedAccount<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(market_id: String)]
pub struct RefundMarket<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,
    /// CHECK: PDA account for market escrow
    #[account(
        mut,
        seeds = [b"market", market_id.as_bytes()],
        bump,
    )]
    pub market_vault: UncheckedAccount<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct Payout {
    pub winner_vault: Pubkey,
    pub amount: u64,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct Refund {
    pub user_vault: Pubkey,
    pub amount: u64,
}

#[error_code]
pub enum VaultError {
    #[msg("Invalid amount")]
    InvalidAmount,
    #[msg("Invalid market ID")]
    InvalidMarketId,
    #[msg("Too many payouts in single transaction")]
    TooManyPayouts,
    #[msg("Insufficient funds")]
    InsufficientFunds,
    #[msg("Arithmetic overflow")]
    Overflow,
}
