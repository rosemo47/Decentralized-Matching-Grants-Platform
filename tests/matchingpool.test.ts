import { describe, it, expect, beforeEach } from "vitest";
import { stringUtf8CV, uintCV } from "@stacks/transactions";

const ERR_NOT_AUTHORIZED = 100;
const ERR_INSUFFICIENT_POOL = 101;
const ERR_INVALID_CAMPAIGN = 102;
const ERR_INVALID_AMOUNT = 103;
const ERR_INVALID_RATIO = 104;
const ERR_INVALID_CAP = 105;
const ERR_CAMPAIGN_NOT_ACTIVE = 106;
const ERR_MAX_MATCHED_EXCEEDED = 107;
const ERR_AUTHORITY_NOT_VERIFIED = 109;
const ERR_INVALID_POOL_TYPE = 115;
const ERR_INVALID_INTEREST = 116;
const ERR_INVALID_GRACE = 117;
const ERR_INVALID_LOCATION = 118;
const ERR_INVALID_CURRENCY = 119;
const ERR_INVALID_MIN_DEPOSIT = 121;
const ERR_INVALID_MAX_DEPOSIT = 122;
const ERR_MAX_POOLS_EXCEEDED = 114;
const ERR_INVALID_UPDATE_PARAM = 113;

interface CampaignMatch {
  matchedAmount: bigint;
  isActive: boolean;
  timestamp: bigint;
  totalDonations: bigint;
  poolType: string;
  interest: bigint;
  grace: bigint;
  location: string;
  currency: string;
  status: boolean;
  minDeposit: bigint;
  maxDeposit: bigint;
}

interface PoolUpdate {
  updateRatio: bigint;
  updateCap: bigint;
  updateTimestamp: bigint;
  updater: string;
}

interface Result<T> {
  ok: boolean;
  value: T;
}

class MatchingPoolMock {
  state: {
    poolBalance: bigint;
    totalMatched: bigint;
    nextPoolId: bigint;
    maxPools: bigint;
    adminFee: bigint;
    authorityContract: string | null;
    matchingRatio: bigint;
    maxMatchingCap: bigint;
    penaltyRate: bigint;
    campaignMatches: Map<bigint, CampaignMatch>;
    poolsByCampaign: Map<string, bigint>;
    poolUpdates: Map<bigint, PoolUpdate>;
  } = {
    poolBalance: 0n,
    totalMatched: 0n,
    nextPoolId: 0n,
    maxPools: 100n,
    adminFee: 100n,
    authorityContract: null,
    matchingRatio: 2n,
    maxMatchingCap: 1000000000n,
    penaltyRate: 5n,
    campaignMatches: new Map(),
    poolsByCampaign: new Map(),
    poolUpdates: new Map(),
  };
  blockHeight: bigint = 0n;
  caller: string = "ST1TEST";
  stxTransfers: Array<{ amount: bigint; from: string; to: string }> = [];

  constructor() {
    this.reset();
  }

  reset() {
    this.state = {
      poolBalance: 0n,
      totalMatched: 0n,
      nextPoolId: 0n,
      maxPools: 100n,
      adminFee: 100n,
      authorityContract: null,
      matchingRatio: 2n,
      maxMatchingCap: 1000000000n,
      penaltyRate: 5n,
      campaignMatches: new Map(),
      poolsByCampaign: new Map(),
      poolUpdates: new Map(),
    };
    this.blockHeight = 0n;
    this.caller = "ST1TEST";
    this.stxTransfers = [];
  }

  setAuthorityContract(contractPrincipal: string): Result<boolean> {
    if (contractPrincipal === this.caller) {
      return { ok: false, value: false };
    }
    if (this.state.authorityContract !== null) {
      return { ok: false, value: false };
    }
    this.state.authorityContract = contractPrincipal;
    return { ok: true, value: true };
  }

  setAdminFee(newFee: bigint): Result<boolean> {
    if (!this.state.authorityContract) return { ok: false, value: false };
    this.state.adminFee = newFee;
    return { ok: true, value: true };
  }

  fundPool(amount: bigint): Result<boolean> {
    if (amount <= 0n) return { ok: false, value: false };
    this.stxTransfers.push({ amount, from: this.caller, to: "contract" });
    this.state.poolBalance += amount;
    return { ok: true, value: true };
  }

  createCampaignPool(
    campaignName: string,
    poolType: string,
    interest: bigint,
    grace: bigint,
    location: string,
    currency: string,
    minDeposit: bigint,
    maxDeposit: bigint
  ): Result<bigint> {
    if (this.state.nextPoolId >= this.state.maxPools) return { ok: false, value: ERR_MAX_POOLS_EXCEEDED };
    if (!["charity", "grant", "fund"].includes(poolType)) return { ok: false, value: ERR_INVALID_POOL_TYPE };
    if (interest > 20n) return { ok: false, value: ERR_INVALID_INTEREST };
    if (grace > 30n) return { ok: false, value: ERR_INVALID_GRACE };
    if (!location || location.length > 100) return { ok: false, value: ERR_INVALID_LOCATION };
    if (!["STX", "USD", "BTC"].includes(currency)) return { ok: false, value: ERR_INVALID_CURRENCY };
    if (minDeposit <= 0n) return { ok: false, value: ERR_INVALID_MIN_DEPOSIT };
    if (maxDeposit <= 0n) return { ok: false, value: ERR_INVALID_MAX_DEPOSIT };
    if (this.state.poolsByCampaign.has(campaignName)) return { ok: false, value: ERR_INVALID_CAMPAIGN };
    if (!this.state.authorityContract) return { ok: false, value: ERR_AUTHORITY_NOT_VERIFIED };

    this.stxTransfers.push({ amount: this.state.adminFee, from: this.caller, to: this.state.authorityContract });

    const id = this.state.nextPoolId;
    const match: CampaignMatch = {
      matchedAmount: 0n,
      isActive: true,
      timestamp: this.blockHeight,
      totalDonations: 0n,
      poolType,
      interest,
      grace,
      location,
      currency,
      status: true,
      minDeposit,
      maxDeposit,
    };
    this.state.campaignMatches.set(id, match);
    this.state.poolsByCampaign.set(campaignName, id);
    this.state.nextPoolId++;
    return { ok: true, value: id };
  }

  matchDonation(campaignId: bigint, donationAmount: bigint): Result<bigint> {
    const campaign = this.state.campaignMatches.get(campaignId);
    if (!campaign) return { ok: false, value: ERR_INVALID_CAMPAIGN };
    if (!campaign.isActive) return { ok: false, value: ERR_CAMPAIGN_NOT_ACTIVE };
    if (donationAmount <= 0n) return { ok: false, value: ERR_INVALID_AMOUNT };
    const matchAmount = donationAmount * this.state.matchingRatio;
    if (matchAmount > this.state.maxMatchingCap) return { ok: false, value: ERR_MAX_MATCHED_EXCEEDED };
    if (matchAmount > this.state.poolBalance) return { ok: false, value: ERR_INSUFFICIENT_POOL };

    this.stxTransfers.push({ amount: matchAmount, from: "contract", to: this.caller });
    this.state.poolBalance -= matchAmount;
    this.state.totalMatched += matchAmount;
    const updated: CampaignMatch = {
      ...campaign,
      matchedAmount: campaign.matchedAmount + matchAmount,
      totalDonations: campaign.totalDonations + donationAmount,
      timestamp: this.blockHeight,
    };
    this.state.campaignMatches.set(campaignId, updated);
    return { ok: true, value: matchAmount };
  }

  updatePoolRatio(newRatio: bigint): Result<boolean> {
    if (!this.state.authorityContract) return { ok: false, value: false };
    if (newRatio <= 0n || newRatio > 10n) return { ok: false, value: false };
    this.state.matchingRatio = newRatio;
    return { ok: true, value: true };
  }

  withdrawFromPool(amount: bigint): Result<boolean> {
    if (this.caller !== this.state.authorityContract) return { ok: false, value: false };
    if (amount <= 0n) return { ok: false, value: false };
    if (amount > this.state.poolBalance) return { ok: false, value: false };
    this.stxTransfers.push({ amount, from: "contract", to: this.caller });
    this.state.poolBalance -= amount;
    return { ok: true, value: true };
  }

  deactivateCampaign(campaignId: bigint): Result<boolean> {
    const campaign = this.state.campaignMatches.get(campaignId);
    if (!campaign) return { ok: false, value: false };
    if (this.caller !== this.state.authorityContract) return { ok: false, value: false };
    const updated: CampaignMatch = { ...campaign, isActive: false, status: false };
    this.state.campaignMatches.set(campaignId, updated);
    return { ok: true, value: true };
  }

  getPoolCount(): Result<bigint> {
    return { ok: true, value: this.state.nextPoolId };
  }

  checkCampaignExistence(name: string): Result<boolean> {
    return { ok: true, value: this.state.poolsByCampaign.has(name) };
  }
}

describe("MatchingPool", () => {
  let contract: MatchingPoolMock;

  beforeEach(() => {
    contract = new MatchingPoolMock();
    contract.reset();
  });

  it("funds the pool successfully", () => {
    const result = contract.fundPool(1000n);
    expect(result.ok).toBe(true);
    expect(contract.state.poolBalance).toBe(1000n);
  });

  it("creates a campaign pool successfully", () => {
    contract.setAuthorityContract("ST2TEST");
    const result = contract.createCampaignPool(
      "Campaign1",
      "charity",
      10n,
      7n,
      "LocationX",
      "STX",
      50n,
      1000n
    );
    expect(result.ok).toBe(true);
    expect(result.value).toBe(0n);
    const match = contract.state.campaignMatches.get(0n);
    expect(match?.poolType).toBe("charity");
    expect(contract.stxTransfers).toEqual([{ amount: 100n, from: "ST1TEST", to: "ST2TEST" }]);
  });

  it("rejects duplicate campaign names", () => {
    contract.setAuthorityContract("ST2TEST");
    contract.createCampaignPool(
      "Campaign1",
      "charity",
      10n,
      7n,
      "LocationX",
      "STX",
      50n,
      1000n
    );
    const result = contract.createCampaignPool(
      "Campaign1",
      "grant",
      15n,
      14n,
      "LocationY",
      "USD",
      100n,
      2000n
    );
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_INVALID_CAMPAIGN);
  });

  it("matches a donation successfully", () => {
    contract.setAuthorityContract("ST2TEST");
    contract.createCampaignPool(
      "Campaign1",
      "charity",
      10n,
      7n,
      "LocationX",
      "STX",
      50n,
      1000n
    );
    contract.fundPool(10000n);
    const result = contract.matchDonation(0n, 1000n);
    expect(result.ok).toBe(true);
    expect(result.value).toBe(2000n);
    expect(contract.state.poolBalance).toBe(8000n);
    expect(contract.state.totalMatched).toBe(2000n);
  });


  it("updates pool ratio successfully", () => {
    contract.setAuthorityContract("ST2TEST");
    const result = contract.updatePoolRatio(3n);
    expect(result.ok).toBe(true);
    expect(contract.state.matchingRatio).toBe(3n);
  });

  it("returns correct pool count", () => {
    contract.setAuthorityContract("ST2TEST");
    contract.createCampaignPool(
      "Campaign1",
      "charity",
      10n,
      7n,
      "LocationX",
      "STX",
      50n,
      1000n
    );
    contract.createCampaignPool(
      "Campaign2",
      "grant",
      15n,
      14n,
      "LocationY",
      "USD",
      100n,
      2000n
    );
    const result = contract.getPoolCount();
    expect(result.ok).toBe(true);
    expect(result.value).toBe(2n);
  });

  it("checks campaign existence correctly", () => {
    contract.setAuthorityContract("ST2TEST");
    contract.createCampaignPool(
      "Campaign1",
      "charity",
      10n,
      7n,
      "LocationX",
      "STX",
      50n,
      1000n
    );
    const result = contract.checkCampaignExistence("Campaign1");
    expect(result.ok).toBe(true);
    expect(result.value).toBe(true);
    const result2 = contract.checkCampaignExistence("NonExistent");
    expect(result2.ok).toBe(true);
    expect(result2.value).toBe(false);
  });

  it("parses campaign parameters with Clarity types", () => {
    const name = stringUtf8CV("Campaign1");
    const minDeposit = uintCV(50);
    expect(name.value).toBe("Campaign1");
    expect(minDeposit.value).toEqual(50n);
  });

  it("rejects creation without authority contract", () => {
    const result = contract.createCampaignPool(
      "NoAuth",
      "charity",
      10n,
      7n,
      "LocationX",
      "STX",
      50n,
      1000n
    );
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_AUTHORITY_NOT_VERIFIED);
  });

  it("rejects invalid pool type", () => {
    contract.setAuthorityContract("ST2TEST");
    const result = contract.createCampaignPool(
      "InvalidType",
      "invalid",
      10n,
      7n,
      "LocationX",
      "STX",
      50n,
      1000n
    );
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_INVALID_POOL_TYPE);
  });

  it("rejects max pools exceeded", () => {
    contract.setAuthorityContract("ST2TEST");
    contract.state.maxPools = 1n;
    contract.createCampaignPool(
      "Campaign1",
      "charity",
      10n,
      7n,
      "LocationX",
      "STX",
      50n,
      1000n
    );
    const result = contract.createCampaignPool(
      "Campaign2",
      "grant",
      15n,
      14n,
      "LocationY",
      "USD",
      100n,
      2000n
    );
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_MAX_POOLS_EXCEEDED);
  });
});