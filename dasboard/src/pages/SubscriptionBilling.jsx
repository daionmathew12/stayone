import React, { useState, useEffect } from "react";
import DashboardLayout from "../layout/DashboardLayout";
import api from "../services/api";
import { useBranch } from "../contexts/BranchContext";
import {
  CreditCard,
  CheckCircle2,
  Clock,
  AlertCircle,
  Zap,
  MessageSquare,
  Copy,
  Check,
  ArrowUpRight,
  ShieldCheck,
  Download,
  RefreshCw,
  Sparkles,
  Building2,
  Calendar,
  Lock,
  Layers,
  ChevronRight,
  Send
} from "lucide-react";
import toast from "react-hot-toast";

export default function SubscriptionBilling() {
  const { activeBranch } = useBranch();
  const [billingInfo, setBillingInfo] = useState(null);
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [payingBill, setPayingBill] = useState(false);
  const [copiedUpi, setCopiedUpi] = useState(false);
  const [copiedBank, setCopiedBank] = useState(false);

  // Manual payment submission state
  const [paymentForm, setPaymentForm] = useState({
    transaction_ref: "",
    payment_method: "UPI (Google Pay / PhonePe / Paytm)",
    notes: ""
  });
  const [submittingPayment, setSubmittingPayment] = useState(false);

  const fetchBillingData = async () => {
    try {
      setLoading(true);
      const [billingRes, plansRes] = await Promise.allSettled([
        api.get("/saas/billing"),
        api.get("/saas/plans")
      ]);

      if (billingRes.status === "fulfilled") {
        setBillingInfo(billingRes.value.data);
      }
      if (plansRes.status === "fulfilled") {
        setPlans(plansRes.value.data || []);
      }
    } catch (err) {
      console.error("Failed to load subscription data", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBillingData();
  }, []);

  const handleCopyUpi = () => {
    navigator.clipboard.writeText("teqmates@upi");
    setCopiedUpi(true);
    toast.success("Teqmates UPI ID copied to clipboard!");
    setTimeout(() => setCopiedUpi(false), 2000);
  };

  const handleCopyBank = () => {
    const bankDetails = "A/C: 50200088921822 | IFSC: HDFC0001234 | Bank: HDFC Bank | Name: Teqmates Technologies Pvt Ltd";
    navigator.clipboard.writeText(bankDetails);
    setCopiedBank(true);
    toast.success("Bank details copied to clipboard!");
    setTimeout(() => setCopiedBank(false), 2000);
  };

  const handleQuickPay = async () => {
    try {
      setPayingBill(true);
      const res = await api.post("/saas/pay-bill", {
        payment_method: "Simulated Quick Pay",
        transaction_ref: `TXN-${Date.now()}`
      });
      toast.success(res.data?.message || "Payment recorded successfully!");
      fetchBillingData();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Payment failed. Please try again.");
    } finally {
      setPayingBill(false);
    }
  };

  const handleSubmitTransaction = async (e) => {
    e.preventDefault();
    if (!paymentForm.transaction_ref.trim()) {
      toast.error("Please enter the Transaction ID / UTR number");
      return;
    }

    try {
      setSubmittingPayment(true);
      const res = await api.post("/saas/raise-payment", {
        tenant_id: billingInfo?.tenant_id,
        payment_method: paymentForm.payment_method,
        transaction_ref: paymentForm.transaction_ref.trim()
      });
      toast.success("Payment reference raised! Super Admin can now verify and accept your payment.");
      setPaymentForm({
        transaction_ref: "",
        payment_method: "UPI (Google Pay / PhonePe / Paytm)",
        notes: ""
      });
      fetchBillingData();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to submit verification.");
    } finally {
      setSubmittingPayment(false);
    }
  };

  const currentPlanName = typeof billingInfo?.plan === "object"
    ? billingInfo?.plan?.name || billingInfo?.plan?.code
    : billingInfo?.plan || "Starter Plan";

  const isPaid = billingInfo?.payment_status === "paid";
  const isPaymentRaised = billingInfo?.payment_status === "payment_raised";
  const isActive = billingInfo?.subscription_status === "active";
  const expiryDateFormatted = billingInfo?.expiry_date || (billingInfo?.next_billing_date ? new Date(billingInfo.next_billing_date).toLocaleDateString("en-IN", { day: 'numeric', month: 'short', year: 'numeric' }) : null);

  // Pre-filled WhatsApp message
  const whatsappUrl = `https://api.whatsapp.com/send?phone=919876543210&text=${encodeURIComponent(
    `Hi Teqmates, I have completed the subscription payment for property "${billingInfo?.business_name || activeBranch?.name || "My Property"}" (Code: ${billingInfo?.branch_code || ""}). Please find my payment screenshot attached for instant activation.`
  )}`;

  return (
    <DashboardLayout>
      <div className="max-w-7xl mx-auto space-y-7 pb-12">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-6 rounded-3xl border border-gray-100 shadow-xs">
          <div className="flex items-center gap-4">
            <div className="p-3.5 bg-gradient-to-br from-indigo-600 to-purple-600 text-white rounded-2xl shadow-md shadow-indigo-100">
              <CreditCard size={28} />
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-2xl font-extrabold text-gray-900 tracking-tight">
                  Monthly Subscription &amp; Payments
                </h1>
                <span className="px-2.5 py-0.5 text-xs font-bold rounded-full bg-indigo-50 text-indigo-700 border border-indigo-100">
                  Property SaaS
                </span>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Property: <strong className="text-gray-800">{billingInfo?.business_name || activeBranch?.name || "Stayone Resort"}</strong>
                {billingInfo?.branch_code && (
                  <> • Hotel Code: <span className="font-mono font-bold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded text-[11px]">{billingInfo.branch_code}</span></>
                )}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={fetchBillingData}
              disabled={loading}
              className="p-2.5 bg-gray-50 hover:bg-gray-100 text-gray-600 rounded-xl transition-colors border border-gray-200"
              title="Refresh"
            >
              <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
            </button>
            <a
              href={whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-sm transition-all flex items-center gap-2"
            >
              <MessageSquare size={16} />
              <span>WhatsApp Support</span>
            </a>
          </div>
        </div>

        {/* 4 Summary KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Plan Card */}
          <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-xs relative overflow-hidden group hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between text-xs text-gray-500 mb-2 font-medium">
              <span>Active Plan</span>
              <Layers size={18} className="text-indigo-600" />
            </div>
            <h3 className="text-xl font-bold text-gray-900 capitalize tracking-tight">
              {currentPlanName}
            </h3>
            <p className="text-xs text-gray-500 mt-1">
              Monthly Recurring Subscription
            </p>
            <div className="absolute -bottom-6 -right-6 w-20 h-20 bg-indigo-50 rounded-full opacity-50 group-hover:scale-125 transition-transform" />
          </div>

          {/* Monthly Amount */}
          <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-xs relative overflow-hidden group hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between text-xs text-gray-500 mb-2 font-medium">
              <span>Monthly Subscription Fee</span>
              <Sparkles size={18} className="text-amber-500" />
            </div>
            <h3 className="text-2xl font-black text-gray-900">
              ₹{(billingInfo?.monthly_amount || 0).toLocaleString()}
              <span className="text-xs text-gray-400 font-normal ml-1">/ month</span>
            </h3>
            <p className="text-xs text-emerald-600 mt-1 font-semibold">
              {billingInfo?.monthly_amount === 0 ? "✨ Active Free Trial Period" : "Standard Tier"}
            </p>
          </div>

          {/* Payment Status */}
          <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-xs relative overflow-hidden group hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between text-xs text-gray-500 mb-2 font-medium">
              <span>Payment Status</span>
              {isPaid ? <CheckCircle2 size={18} className="text-emerald-500" /> : isPaymentRaised ? <Sparkles size={18} className="text-amber-500" /> : <AlertCircle size={18} className="text-rose-500" />}
            </div>
            <div className="flex items-center gap-2">
              <span className={`px-3 py-1 rounded-full text-xs font-extrabold uppercase tracking-wider ${
                isPaid 
                  ? "bg-emerald-100 text-emerald-700 border border-emerald-200" 
                  : isPaymentRaised 
                  ? "bg-amber-100 text-amber-800 border border-amber-300"
                  : "bg-rose-100 text-rose-700 border border-rose-200 animate-pulse"
              }`}>
                {isPaid ? "✅ Paid" : isPaymentRaised ? "⚡ Payment Raised" : "⚠️ Payment Due"}
              </span>
            </div>
            <p className="text-xs text-gray-400 mt-2 truncate" title={isPaymentRaised ? `UTR: ${billingInfo?.payment_ref || "Submitted"} - Awaiting Super Admin Acceptance` : ""}>
              {isPaid 
                ? "Up to date for this cycle" 
                : isPaymentRaised 
                ? `UTR: ${billingInfo?.payment_ref || "Submitted"} (Awaiting Acceptance)` 
                : "Immediate payment required"}
            </p>
          </div>

          {/* Next Billing / Expiry Date */}
          <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-xs relative overflow-hidden group hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between text-xs text-gray-500 mb-2 font-medium">
              <span>Subscription Expiry / Due Date</span>
              <Calendar size={18} className={billingInfo?.is_overdue ? "text-rose-600" : "text-purple-600"} />
            </div>
            <h3 className="text-lg font-bold text-gray-900 font-mono">
              {billingInfo?.expiry_date || (billingInfo?.next_billing_date ? billingInfo.next_billing_date.split("T")[0] : "Next Cycle")}
            </h3>
            <p className="text-xs font-semibold flex items-center gap-1 mt-1">
              {billingInfo?.is_overdue ? (
                <span className="text-rose-600 font-bold">🚨 Expired ({Math.abs(billingInfo.days_until_due || 0)}d ago)</span>
              ) : billingInfo?.days_until_due !== undefined ? (
                <span className="text-indigo-600">⏳ {billingInfo.days_until_due === 0 ? "Due Today" : `${billingInfo.days_until_due} days left`}</span>
              ) : (
                <span className="text-indigo-600">Status: {isActive ? "Fully Operational" : "Pending Verification"}</span>
              )}
            </p>
          </div>
        </div>

        {/* HERO SECTION: Pay at Teqmates & Instant Activation */}
        <div className="rounded-3xl border-2 border-indigo-200 bg-gradient-to-br from-indigo-50/90 via-purple-50/60 to-emerald-50/60 p-6 md:p-8 shadow-sm">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
            <div className="space-y-3 max-w-2xl">
              <div className="flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-sm">
                  <Zap size={18} className="fill-white" />
                </span>
                <span className="text-xs font-bold text-indigo-900 uppercase tracking-widest bg-indigo-100/80 px-3 py-1 rounded-full border border-indigo-200">
                  Official SaaS Billing Partner
                </span>
                <span className="text-xs font-extrabold text-emerald-800 bg-emerald-100 px-3 py-1 rounded-full border border-emerald-200 flex items-center gap-1">
                  ⚡ Fast-Track Activation
                </span>
              </div>

              <h2 className="text-2xl md:text-3xl font-extrabold text-gray-950 tracking-tight">
                Pay at Teqmates &amp; Activate Within Minutes
              </h2>

              <p className="text-sm text-gray-700 leading-relaxed font-medium bg-white/80 backdrop-blur-xs p-3.5 rounded-2xl border border-indigo-100">
                👉 <strong className="text-indigo-950 font-bold">Pay at Teqmates and share screenshot which activates your property within minutes!</strong> Once the payment is made via UPI or bank transfer, send your receipt on WhatsApp for instant verification and activation.
              </p>
            </div>

            {/* Instant WhatsApp Action Card */}
            <div className="bg-white p-5 rounded-2xl border border-indigo-100 shadow-md flex flex-col justify-center gap-3 shrink-0 lg:w-80">
              <div className="text-center">
                <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider block mb-1">Fast-Track Verification</span>
                <p className="text-xs text-gray-600 font-medium">Instant property activation via WhatsApp support</p>
              </div>
              <a
                href={whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-extrabold text-xs rounded-xl shadow-md shadow-emerald-200 transition-all flex items-center justify-center gap-2 group"
              >
                <MessageSquare size={18} />
                <span>Share Screenshot on WhatsApp</span>
                <ArrowUpRight size={15} className="group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
              </a>
              <p className="text-[11px] text-gray-400 text-center">
                Direct Helpdesk: <strong className="text-gray-700">+91 98765 43210</strong>
              </p>
            </div>
          </div>

          {/* Payment Credentials Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6 pt-6 border-t border-indigo-100/80">
            {/* UPI Option */}
            <div className="bg-white/95 p-4 rounded-2xl border border-indigo-100 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold text-xs">
                    UPI
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-gray-900">UPI Instant Payment</h4>
                    <p className="text-[11px] text-gray-500">Google Pay • PhonePe • Paytm • BHIM</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleCopyUpi}
                  className="px-2.5 py-1 text-xs font-bold text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 rounded-lg border border-indigo-200 transition-colors flex items-center gap-1.5"
                >
                  {copiedUpi ? <><Check size={13} className="text-emerald-600" /> Copied!</> : <><Copy size={13} /> Copy UPI</>}
                </button>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 space-y-1.5 text-xs">
                <div className="flex justify-between">
                  <span className="text-gray-500">UPI ID:</span>
                  <span className="font-mono font-bold text-indigo-700 bg-white px-2 py-0.5 rounded border border-slate-200">
                    teqmates@upi
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Payee Name:</span>
                  <span className="font-bold text-gray-800">Teqmates Technologies Pvt Ltd</span>
                </div>
              </div>
            </div>

            {/* Bank Transfer Option */}
            <div className="bg-white/95 p-4 rounded-2xl border border-indigo-100 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center font-bold text-xs">
                    NEFT
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-gray-900">Direct Bank Transfer</h4>
                    <p className="text-[11px] text-gray-500">IMPS • NEFT • RTGS (Current Account)</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleCopyBank}
                  className="px-2.5 py-1 text-xs font-bold text-purple-600 hover:text-purple-800 bg-purple-50 hover:bg-purple-100 rounded-lg border border-purple-200 transition-colors flex items-center gap-1.5"
                >
                  {copiedBank ? <><Check size={13} className="text-emerald-600" /> Copied!</> : <><Copy size={13} /> Copy Details</>}
                </button>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 space-y-1 text-xs font-mono">
                <div className="flex justify-between">
                  <span className="text-gray-500 font-sans">Account No:</span>
                  <span className="font-bold text-gray-800">50200088921822</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500 font-sans">IFSC Code:</span>
                  <span className="font-bold text-purple-700">HDFC0001234</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500 font-sans">Bank:</span>
                  <span className="font-bold text-gray-700 font-sans">HDFC Bank, Commercial Branch</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Two Column Section: Manual Transaction Form & Subscription Breakdown */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Submit Transaction Verification Form */}
          <div className="bg-white p-6 md:p-7 rounded-3xl border border-gray-100 shadow-xs space-y-5">
            <div className="flex items-center gap-3 pb-4 border-b border-gray-100">
              <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl">
                <Send size={20} />
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900">Record Payment &amp; Verify</h3>
                <p className="text-xs text-gray-500">Submit transaction UTR for automated receipt matching</p>
              </div>
            </div>

            {isPaid ? (
              <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-start gap-3">
                <CheckCircle2 size={18} className="text-emerald-600 mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs font-extrabold text-emerald-900">Current Cycle: Verified &amp; Paid (₹{(billingInfo?.monthly_amount || 0).toLocaleString()})</p>
                  <p className="text-[11px] text-emerald-700 mt-0.5">
                    Your monthly subscription is active and verified by Super Admin. {billingInfo?.payment_ref ? `(Last Ref: ${billingInfo.payment_ref})` : ''}
                  </p>
                </div>
              </div>
            ) : isPaymentRaised ? (
              <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-300 flex items-start gap-3">
                <Clock size={18} className="text-amber-600 mt-0.5 shrink-0 animate-pulse" />
                <div>
                  <p className="text-xs font-extrabold text-amber-900">Payment Verification in Progress</p>
                  <p className="text-[11px] text-amber-800 mt-0.5">
                    Transaction Ref <span className="font-mono font-bold">{billingInfo?.payment_ref || "Submitted"}</span> is under review by Super Admin. Your workspace will remain active.
                  </p>
                </div>
              </div>
            ) : null}

            <form onSubmit={handleSubmitTransaction} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                  Payment Method
                </label>
                <select
                  value={paymentForm.payment_method}
                  onChange={(e) => setPaymentForm({ ...paymentForm, payment_method: e.target.value })}
                  className="w-full px-3.5 py-2.5 text-sm border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 outline-none transition-all"
                >
                  <option value="UPI (Google Pay / PhonePe / Paytm)">UPI (Google Pay / PhonePe / Paytm)</option>
                  <option value="Bank Transfer (IMPS / NEFT / RTGS)">Bank Transfer (IMPS / NEFT / RTGS)</option>
                  <option value="Debit / Credit Card">Debit / Credit Card</option>
                  <option value="Cheque / Demand Draft">Cheque / Demand Draft</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                  Transaction Reference / UTR Number *
                </label>
                <input
                  type="text"
                  required
                  value={paymentForm.transaction_ref}
                  onChange={(e) => setPaymentForm({ ...paymentForm, transaction_ref: e.target.value })}
                  placeholder="e.g. 427819283719 or UPI Ref ID"
                  className="w-full px-3.5 py-2.5 text-sm font-mono border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 outline-none transition-all"
                />
                <p className="text-[11px] text-gray-400 mt-1">Found in your Google Pay, PhonePe, or NetBanking statement.</p>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                  Payer Name / Remarks (Optional)
                </label>
                <input
                  type="text"
                  value={paymentForm.notes}
                  onChange={(e) => setPaymentForm({ ...paymentForm, notes: e.target.value })}
                  placeholder="Account holder name or note"
                  className="w-full px-3.5 py-2.5 text-sm border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 outline-none transition-all"
                />
              </div>

              <div className="pt-2 flex flex-col sm:flex-row gap-3">
                <button
                  type="submit"
                  disabled={submittingPayment}
                  className="flex-1 py-3 px-5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-bold rounded-xl shadow-md shadow-indigo-100 transition-all flex items-center justify-center gap-2 text-sm disabled:opacity-60"
                >
                  {submittingPayment ? "Submitting..." : "Submit Transaction for Verification"}
                </button>

                {!isPaid && (
                  <button
                    type="button"
                    onClick={handleQuickPay}
                    disabled={payingBill}
                    className="py-3 px-5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-md shadow-emerald-100 transition-all flex items-center justify-center gap-2 text-sm disabled:opacity-60"
                  >
                    {payingBill ? "Processing..." : "Quick Pay Simulation"}
                  </button>
                )}
              </div>
            </form>
          </div>

          {/* Current Subscription Breakdown Table */}
          <div className="bg-white p-6 md:p-7 rounded-3xl border border-gray-100 shadow-xs space-y-5 flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-3 pb-4 border-b border-gray-100 mb-4">
                <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-xl">
                  <ShieldCheck size={20} />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900">Subscription Specification</h3>
                  <p className="text-xs text-gray-500">Current tier allowances and limits</p>
                </div>
              </div>

              <div className="divide-y divide-gray-100 border border-gray-100 rounded-2xl overflow-hidden text-xs">
                <div className="flex items-center justify-between p-3.5 bg-slate-50">
                  <span className="text-gray-500 font-medium">Business / Property</span>
                  <span className="font-bold text-gray-900">{billingInfo?.business_name || "Stayone Resort"}</span>
                </div>
                <div className="flex items-center justify-between p-3.5 bg-white">
                  <span className="text-gray-500 font-medium">Hotel Sync Code</span>
                  <span className="font-mono font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100">
                    {billingInfo?.branch_code || "—"}
                  </span>
                </div>
                <div className="flex items-center justify-between p-3.5 bg-slate-50">
                  <span className="text-gray-500 font-medium">Billing Period</span>
                  <span className="font-bold text-gray-800 capitalize">{billingInfo?.billing_cycle || "Monthly"}</span>
                </div>
                <div className="flex items-center justify-between p-3.5 bg-white">
                  <span className="text-gray-500 font-medium">Monthly Amount</span>
                  <span className="font-extrabold text-gray-900 text-sm">₹{(billingInfo?.monthly_amount || 0).toLocaleString()}</span>
                </div>
                <div className="flex items-center justify-between p-3.5 bg-slate-50">
                  <span className="text-gray-500 font-medium">Payment Status</span>
                  <span className={`font-bold px-2 py-0.5 rounded-full text-[11px] ${isPaid ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"}`}>
                    {isPaid ? "✅ Paid" : "⚠️ Unpaid"}
                  </span>
                </div>
                <div className="flex items-center justify-between p-3.5 bg-white">
                  <span className="text-gray-500 font-medium">Account Activation</span>
                  <span className={`font-bold capitalize ${isActive ? "text-emerald-600" : "text-amber-600"}`}>
                    {billingInfo?.subscription_status?.replace(/_/g, " ") || "Active"}
                  </span>
                </div>
              </div>
            </div>

            <div className="p-4 bg-indigo-50/70 border border-indigo-100 rounded-2xl text-xs text-indigo-950 flex items-start gap-2.5">
              <Zap size={16} className="text-indigo-600 shrink-0 mt-0.5" />
              <p className="leading-relaxed">
                Need to upgrade rooms, connect additional channel managers, or switch to an annual plan with discounts? Contact Teqmates support anytime.
              </p>
            </div>
          </div>
        </div>

        {/* Payment History & Verification Summary */}
        <div className="bg-white p-6 md:p-7 rounded-3xl border border-gray-100 shadow-xs space-y-4">
          <div className="flex items-center justify-between gap-3 pb-3 border-b border-gray-100 flex-wrap">
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
                <ShieldCheck size={20} />
              </div>
              <div>
                <h3 className="text-base font-bold text-gray-900">Payment Verification &amp; Invoicing Details</h3>
                <p className="text-xs text-gray-500">Record of current subscription cycle, transaction reference, and platform activation</p>
              </div>
            </div>
            <span className={`px-3 py-1 rounded-full text-xs font-extrabold uppercase tracking-wider ${
              isPaid
                ? "bg-emerald-100 text-emerald-700 border border-emerald-200"
                : isPaymentRaised
                ? "bg-amber-100 text-amber-800 border border-amber-300"
                : "bg-rose-100 text-rose-700 border border-rose-200"
            }`}>
              {isPaid ? "✅ Verified by Super Admin" : isPaymentRaised ? "⚡ Verification Pending" : "⚠️ Payment Overdue / Required"}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 pt-1">
            <div className="p-3.5 bg-gray-50 rounded-2xl border border-gray-100">
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Billing Amount</span>
              <span className="text-base font-extrabold text-gray-900 mt-0.5 block">
                ₹{(billingInfo?.monthly_amount || 0).toLocaleString()} <span className="text-xs font-normal text-gray-500">/ mo</span>
              </span>
            </div>
            <div className="p-3.5 bg-gray-50 rounded-2xl border border-gray-100">
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Recorded UTR / Ref</span>
              <span className="text-sm font-mono font-bold text-indigo-700 mt-0.5 block truncate" title={billingInfo?.payment_ref || "None"}>
                {billingInfo?.payment_ref || "Direct Bank / Advance"}
              </span>
            </div>
            <div className="p-3.5 bg-gray-50 rounded-2xl border border-gray-100">
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Payment Method</span>
              <span className="text-sm font-semibold text-gray-800 mt-0.5 block truncate">
                {billingInfo?.payment_method || "UPI (Teqmates)"}
              </span>
            </div>
            <div className="p-3.5 bg-gray-50 rounded-2xl border border-gray-100">
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Next Renewal / Expiry</span>
              <span className="text-sm font-bold text-gray-900 mt-0.5 block">
                {expiryDateFormatted || "Due Soon"}
              </span>
            </div>
          </div>
        </div>

        {/* Available SaaS Plans Grid */}
        <div className="space-y-4">
          <div>
            <h3 className="text-xl font-extrabold text-gray-900">Available SaaS Plans</h3>
            <p className="text-xs text-gray-500">Compare features and contact support to switch plans</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {(plans && plans.filter(p => p.code !== "trial" && p.is_active !== false).length > 0
              ? plans.filter(p => p.code !== "trial" && p.is_active !== false)
              : [
                  {
                    code: "starter",
                    name: "Starter",
                    price_monthly: 2999,
                    max_rooms: 25,
                    badge: "POPULAR",
                    description: "Ideal for boutique resorts and homestays",
                    features: [
                      "Up to 25 Rooms Management",
                      "1 Branch Location",
                      "Up to 10 Staff Users",
                      "Dashboard & Room Management",
                      "Booking Engine & QR Menu",
                      "Guest Portal & Basic Reports"
                    ]
                  },
                  {
                    code: "growth",
                    name: "Growth Pro",
                    price_monthly: 6999,
                    max_rooms: 75,
                    badge: "MOST POPULAR",
                    description: "For growing resorts and multi-branch properties",
                    features: [
                      "Up to 75 Rooms Management",
                      "Up to 3 Branches",
                      "Up to 30 Staff Users",
                      "OTA Channel Manager 2-Way Sync",
                      "POS, Food Orders & Inventory",
                      "Comprehensive Reports"
                    ]
                  },
                  {
                    code: "enterprise",
                    name: "Enterprise Chain",
                    price_monthly: 14999,
                    max_rooms: 9999,
                    badge: "ENTERPRISE",
                    description: "For enterprise chains and large hotel groups",
                    features: [
                      "Unlimited Rooms & Branches",
                      "Unlimited Staff Users",
                      "Multi-Property Command Center",
                      "Custom Accounting & Ledger",
                      "Dedicated Support & Custom Domain"
                    ]
                  }
                ]
            ).map((plan) => {
              const isPopular = plan.badge?.toLowerCase().includes("popular") || plan.code === "growth";
              const isEnterprise = plan.code === "enterprise" || plan.price_monthly === 0;
              const formattedPrice = plan.price_monthly > 0 ? `₹${plan.price_monthly.toLocaleString()}` : (isEnterprise ? "Custom" : "Free");
              const priceUnit = plan.price_monthly > 0 ? "/ mo" : (isEnterprise ? "/ tailored" : "");

              return (
                <div
                  key={plan.id || plan.code}
                  className={`rounded-3xl p-6 relative flex flex-col justify-between transition-all ${
                    isPopular
                      ? "bg-gradient-to-b from-indigo-900 to-slate-900 text-white shadow-xl border-2 border-indigo-500"
                      : "bg-white border border-gray-100 shadow-xs hover:shadow-md text-gray-900"
                  }`}
                >
                  {isPopular && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3.5 py-0.5 bg-gradient-to-r from-amber-400 to-amber-500 text-gray-950 font-black text-[10px] uppercase tracking-wider rounded-full shadow-sm">
                      {plan.badge || "Most Popular"}
                    </div>
                  )}

                  <div className="space-y-4 pt-1">
                    <div className="flex items-center justify-between">
                      <h4 className={`text-lg font-bold ${isPopular ? "text-white" : "text-gray-900"}`}>{plan.name}</h4>
                      <span className={`text-xs px-2.5 py-0.5 rounded-full font-semibold ${
                        isPopular ? "bg-indigo-800 text-indigo-200" : isEnterprise ? "bg-purple-100 text-purple-700" : "bg-slate-100 text-slate-700"
                      }`}>
                        {plan.badge && !isPopular ? plan.badge : plan.max_rooms >= 999 ? "Unlimited" : `Up to ${plan.max_rooms || 15} Rooms`}
                      </span>
                    </div>

                    <div>
                      <div className={`text-3xl font-black ${isPopular ? "text-white" : "text-gray-900"}`}>
                        {formattedPrice}{" "}
                        <span className={`text-xs font-normal ${isPopular ? "text-indigo-300" : "text-gray-400"}`}>
                          {priceUnit}
                        </span>
                      </div>
                      <p className={`text-xs mt-1 ${isPopular ? "text-indigo-200" : "text-gray-500"}`}>
                        {plan.description || (plan.code === 'starter' ? "Ideal for boutique resorts and homestays" : "Tailored resort operations package")}
                      </p>
                    </div>

                    <ul className={`space-y-2 text-xs pt-2 border-t ${isPopular ? "text-indigo-100 border-indigo-800/80" : "text-gray-600 border-gray-100"}`}>
                      {(plan.features || []).map((feat, idx) => (
                        <li key={idx} className="flex items-center gap-2">
                          <CheckCircle2 size={14} className={isPopular ? "text-emerald-400" : isEnterprise ? "text-purple-600" : "text-emerald-500"} />
                          <span>{feat}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="pt-6">
                    <a
                      href={`https://api.whatsapp.com/send?phone=919876543210&text=${encodeURIComponent(`Hi Teqmates, I want to inquire about switching to the ${plan.name}.`)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`w-full py-2.5 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 ${
                        isPopular
                          ? "bg-indigo-500 hover:bg-indigo-600 text-white shadow-md shadow-indigo-900"
                          : "bg-gray-100 hover:bg-gray-200 text-gray-800"
                      }`}
                    >
                      <span>{isEnterprise ? "Contact Sales" : `Select ${plan.name}`}</span>
                      <ChevronRight size={14} />
                    </a>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Payment History & Receipt Table */}
        <div className="bg-white p-6 md:p-7 rounded-3xl border border-gray-100 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-gray-100">
            <div>
              <h3 className="text-lg font-bold text-gray-900">Payment History &amp; Receipts</h3>
              <p className="text-xs text-gray-500">Record of subscription statements and payment transactions</p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-gray-100 text-gray-400 font-semibold uppercase tracking-wider">
                  <th className="py-3 px-4">Invoice / Ref ID</th>
                  <th className="py-3 px-4">Billing Period</th>
                  <th className="py-3 px-4">Plan</th>
                  <th className="py-3 px-4">Amount</th>
                  <th className="py-3 px-4">Payment Method</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Receipt</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-gray-700">
                <tr className="hover:bg-slate-50/70 transition-colors">
                  <td className="py-3.5 px-4 font-mono font-bold text-indigo-600">
                    INV-{new Date().getFullYear()}-{String(new Date().getMonth() + 1).padStart(2, "0")}-001
                  </td>
                  <td className="py-3.5 px-4 font-medium">
                    {new Date().toLocaleString("default", { month: "long", year: "numeric" })}
                  </td>
                  <td className="py-3.5 px-4 capitalize font-semibold">
                    {currentPlanName}
                  </td>
                  <td className="py-3.5 px-4 font-bold text-gray-900">
                    ₹{(billingInfo?.monthly_amount || 0).toLocaleString()}
                  </td>
                  <td className="py-3.5 px-4 text-gray-500">
                    UPI / Teqmates Pay
                  </td>
                  <td className="py-3.5 px-4">
                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase ${isPaid ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"}`}>
                      {isPaid ? "Paid" : "Due"}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 text-right">
                    <button
                      type="button"
                      onClick={() => window.print()}
                      className="px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition-colors inline-flex items-center gap-1.5"
                    >
                      <Download size={13} />
                      <span>Invoice</span>
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
