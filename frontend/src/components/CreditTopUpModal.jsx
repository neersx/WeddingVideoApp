import { useEffect, useState } from "react";
import axios from "axios";
import { toast } from "sonner";
import { CreditCard, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || "http://localhost:8001";
const API = `${BACKEND_URL}/api`;
const RAZORPAY_SCRIPT_URL = "https://checkout.razorpay.com/v1/checkout.js";

let razorpayScriptPromise = null;
function loadRazorpayScript() {
  if (window.Razorpay) return Promise.resolve(true);
  if (!razorpayScriptPromise) {
    razorpayScriptPromise = new Promise((resolve) => {
      const script = document.createElement("script");
      script.src = RAZORPAY_SCRIPT_URL;
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.body.appendChild(script);
    });
  }
  return razorpayScriptPromise;
}

const formatPrice = (minorUnits, currency) => {
  const symbol = currency === "USD" ? "$" : "₹";
  return `${symbol}${(minorUnits / 100).toFixed(2)}`;
};

/**
 * Modal checkout for topping up the credit wallet via RazorPay. Purely a
 * money -> credits bridge: it knows nothing about templates or renders —
 * the caller decides when insufficient credits should trigger this.
 */
export const CreditTopUpModal = ({ open, onClose, credential, userEmail, requiredCredits, onSuccess }) => {
  const [packs, setPacks] = useState(null);
  const [currency, setCurrency] = useState("INR");
  const [payingPackId, setPayingPackId] = useState(null);
  const authHeader = { headers: { Authorization: `Bearer ${credential}` } };

  useEffect(() => {
    if (!open) return;
    axios.get(`${API}/credit-packs`).then((r) => setPacks(r.data)).catch(() => setPacks([]));
  }, [open]);

  const pay = async (pack) => {
    setPayingPackId(pack.id);
    try {
      const scriptReady = await loadRazorpayScript();
      if (!scriptReady) {
        toast.error("Could not load the payment gateway. Check your connection and try again.");
        return;
      }
      const { data: order } = await axios.post(`${API}/payments/topup`, { packId: pack.id, currency }, authHeader);
      const razorpay = new window.Razorpay({
        key: order.keyId,
        amount: order.amount,
        currency: order.currency,
        order_id: order.razorpayOrderId,
        name: "Invita Videos",
        description: `${pack.credits + (pack.bonusCredits || 0)} credits`,
        prefill: { email: userEmail || "" },
        theme: { color: "#C80A76" },
        handler: async (response) => {
          try {
            const { data: verified } = await axios.post(`${API}/payments/verify`, {
              paymentId: order.paymentId,
              razorpayPaymentId: response.razorpay_payment_id,
              razorpayOrderId: response.razorpay_order_id,
              razorpaySignature: response.razorpay_signature,
            }, authHeader);
            toast.success("Credits added to your wallet");
            onSuccess?.(verified.balance);
          } catch {
            toast.error("Payment could not be verified. If you were charged, contact support.");
          } finally {
            setPayingPackId(null);
          }
        },
        modal: { ondismiss: () => setPayingPackId(null) },
      });
      razorpay.on("payment.failed", () => {
        toast.error("Payment failed. Please try again.");
        setPayingPackId(null);
      });
      razorpay.open();
    } catch (error) {
      toast.error(error?.response?.data?.detail || "Could not start checkout");
      setPayingPackId(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose?.()}>
      <DialogContent className="max-w-lg rounded-3xl border-[#EBD3E0] bg-white p-0 shadow-[0_24px_80px_rgba(50,17,58,0.22)]">
        <div className="rounded-t-3xl bg-[#FFF6FA] px-6 py-5">
          <DialogHeader>
            <DialogTitle className="font-heading text-2xl font-extrabold text-[#32113A]">
              Top up your credits
            </DialogTitle>
            <DialogDescription className="pt-2 leading-6 text-neutral-600">
              {requiredCredits
                ? `This video needs ${requiredCredits} credits. Choose a pack below to continue.`
                : "Choose a credit pack to purchase via RazorPay."}
            </DialogDescription>
          </DialogHeader>
        </div>
        <div className="space-y-4 px-6 pb-6">
          <div className="flex gap-2 pt-4">
            {["INR", "USD"].map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setCurrency(c)}
                className={`rounded-full border px-3 py-1.5 text-xs font-bold transition ${currency === c ? "border-[#C80A76] bg-[#FFF0F7] text-[#8D1B63]" : "border-[#ECD5E2] text-neutral-500 hover:border-[#D9A9C6]"}`}
              >
                {c === "INR" ? "₹ INR" : "$ USD"}
              </button>
            ))}
          </div>
          {packs === null && <div className="rounded-2xl border border-[#ECD5E2] bg-white p-6 text-sm text-neutral-500">Loading credit packs…</div>}
          {packs !== null && !packs.length && <div className="rounded-2xl border border-[#ECD5E2] bg-white p-6 text-sm text-neutral-500">No credit packs are available right now.</div>}
          {packs?.filter((p) => p.prices?.[currency] != null).map((pack) => (
            <div key={pack.id} className="flex items-center justify-between gap-3 rounded-2xl border border-[#ECD5E2] bg-white p-4">
              <div>
                <div className="font-heading text-lg font-extrabold text-[#32113A]">
                  {pack.credits} credits{pack.bonusCredits ? <span className="ml-1 text-sm font-semibold text-emerald-600">+{pack.bonusCredits} bonus</span> : null}
                </div>
                <div className="text-sm text-neutral-500">{pack.name} · {formatPrice(pack.prices[currency], currency)}</div>
              </div>
              <button
                type="button"
                disabled={payingPackId === pack.id}
                onClick={() => pay(pack)}
                className="flex items-center gap-2 rounded-full bg-[#C80A76] px-4 py-2 text-sm font-bold text-white shadow-sm transition hover:bg-[#A4176D] disabled:opacity-60"
              >
                {payingPackId === pack.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <CreditCard className="h-4 w-4" />}
                {payingPackId === pack.id ? "Processing…" : "Buy"}
              </button>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
};
