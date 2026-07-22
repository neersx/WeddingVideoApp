from pydantic import BaseModel, Field
from typing import Dict, Optional


class WalletOut(BaseModel):
    userId: str
    balance: int
    currency: str = "CREDITS"
    updated_at: Optional[str] = None


class WalletTransactionOut(BaseModel):
    id: str
    type: str
    amount: int
    balanceAfter: int
    status: str
    refType: str
    refId: str
    created_at: str


class AdminWalletAdjustRequest(BaseModel):
    userId: str
    amount: int  # signed: positive to grant, negative to deduct
    reason: str = Field(min_length=1)


class TopupRequest(BaseModel):
    packId: str
    currency: str = "INR"


class VerifyPaymentRequest(BaseModel):
    paymentId: str
    razorpayPaymentId: str
    razorpayOrderId: str
    razorpaySignature: str


class AdminCreditPackRequest(BaseModel):
    name: str = Field(min_length=1)
    credits: int
    bonusCredits: int = 0
    prices: Dict[str, int]  # currency -> minor units, e.g. {"INR": 10000, "USD": 200}
    isActive: bool = True
    sortOrder: int = 100
