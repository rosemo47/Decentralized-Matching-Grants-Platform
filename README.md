# 🌟 Decentralized Matching Grants Platform

Welcome to a revolutionary way to fund real-world causes with transparent, automated matching grants on the Stacks blockchain! This project addresses the lack of trust and efficiency in traditional philanthropy by using blockchain to ensure donations are verified, matched automatically, and disbursed transparently. Donors can contribute knowing their impact is doubled for verified campaigns, solving issues like opaque fund allocation and donor fatigue in crowdfunding.

## ✨ Features

🔄 Create and manage grant campaigns for causes like education, environment, or health  
💰 Donate STX or tokens with automatic matching from a shared pool  
✅ Verify contributions via on-chain oracles for authenticity  
x2 Double verified donations through smart contract logic  
📊 Track campaign progress and matching ratios in real-time  
🛡️ Govern matching rules via decentralized voting  
🔒 Secure escrow for funds until milestones are met  
📝 Immutable audit logs for full transparency  
🚀 Withdraw funds only after community verification  

## 🛠 How It Works

**For Campaign Creators**  
- Deploy a new campaign with details like goal amount, cause description, and milestones  
- Use the Verification contract to submit proof (e.g., via oracle feeds)  
- Attract donors who know their contributions will be matched  

Boom! Your cause gets funded with doubled impact from the matching pool.  

**For Donors**  
- Browse active campaigns and donate STX/tokens  
- The Donation contract verifies and triggers matching from the pool  
- See your donation doubled instantly on-chain  

That's it! Your giving goes further with blockchain assurance.  

**For Verifiers/Governors**  
- Use the Oracle contract to confirm real-world milestones  
- Vote on matching ratios via the Governance contract  
- Audit all transactions for transparency  

## 📂 Smart Contracts (Written in Clarity)

This project involves 8 smart contracts to handle the complexity of secure, decentralized grant matching:  
1. **CampaignManager**: Creates and manages grant campaigns, storing details like goals, descriptions, and status.  
2. **DonationHandler**: Processes incoming donations, tracks contributors, and emits events for matching.  
3. **MatchingPool**: Manages the pool of funds for matching, enforcing rules like doubling verified contributions up to a cap.  
4. **VerificationOracle**: Integrates with external oracles to verify real-world contributions and milestones (e.g., proof of impact).  
5. **EscrowVault**: Holds donated and matched funds in escrow until conditions are met, preventing premature withdrawals.  
6. **GovernanceDAO**: Allows token holders to vote on matching parameters, like ratios or eligible causes.  
7. **TokenUtility**: A custom SIP-10 fungible token for governance and rewards (e.g., rewarding verifiers).  
8. **AuditLogger**: Records all transactions, verifications, and disbursements immutably for auditing and transparency.  

These contracts interact seamlessly: A donation triggers verification, pools matching funds, and releases via escrow after governance approval. Deploy them on Stacks for a trustless philanthropy ecosystem!