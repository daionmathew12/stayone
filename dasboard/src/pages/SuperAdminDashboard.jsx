import React, { useEffect, useState, useMemo } from "react";
import DashboardLayout from "../layout/DashboardLayout";
import { formatCurrency } from '../utils/currency';
import API from "../services/api";
import toast from "react-hot-toast";
import { Building2, Users, Receipt, PiggyBank, Briefcase, Activity, CheckCircle, Clock, Shield, Hash, Ban, Power, Search, Filter, X, RotateCcw, Edit2, Camera, Upload, Loader2, Lock, Eye, EyeOff, CreditCard, Calendar, Layers, Sparkles, CheckCircle2, ChevronRight, Tag, Trash2, AlertCircle, AlertTriangle } from "lucide-react";

// Premium styles imported
import "../styles/premium-dashboard.css";
import "../styles/bubble-animation.css";

// A premium KPI Card component specifically for Super Admin
const SuperAdminKPICard = ({ label, value, sub, icon: Icon, colorClass }) => (
    <div className={`relative overflow-hidden rounded-2xl bg-white p-6 shadow-sm border border-gray-100 hover:shadow-lg transition-all duration-300 group`}>
        <div className={`absolute -right-4 -top-4 w-24 h-24 rounded-full opacity-10 transition-transform group-hover:scale-150 ${colorClass}`}></div>
        <div className="flex items-start justify-between">
            <div>
                <p className="text-sm font-medium text-gray-500 mb-1">{label}</p>
                <h3 className="text-2xl font-bold text-gray-800 tracking-tight">{value}</h3>
                {sub && <p className="text-xs text-gray-400 mt-2 font-medium">{sub}</p>}
            </div>
            <div className={`p-3 rounded-xl ${colorClass} bg-opacity-20 text-gray-700 shadow-inner`}>
                <Icon size={24} />
            </div>
        </div>
    </div>
);

const renderLocationLink = (branch, defaultText = "N/A") => {
    if (!branch) return defaultText;
    const loc = (branch.location || "").trim();
    const addr = (branch.address || "").trim();
    
    const isUrl = (str) => {
        if (!str) return false;
        const s = str.toLowerCase();
        return s.startsWith("http://") || 
               s.startsWith("https://") || 
               s.startsWith("www.") ||
               s.includes("google.com/maps") ||
               s.includes("maps.google") ||
               s.includes("maps.app.goo.gl");
    };
    
    const getHref = (str) => {
        if (!str) return "";
        let s = str.trim();
        if (s.toLowerCase().startsWith("http://") || s.toLowerCase().startsWith("https://")) {
            return s;
        }
        return `https://${s}`;
    };
    
    // Check if either is a URL
    let url = "";
    if (isUrl(loc)) {
        url = getHref(loc);
    } else if (isUrl(addr)) {
        url = getHref(addr);
    }
    
    // Determine display text for location name
    let locDisplay = "";
    if (loc && !isUrl(loc)) {
        locDisplay = loc;
    }
    
    // Determine display text for address
    let addrDisplay = "";
    if (addr && !isUrl(addr)) {
        addrDisplay = addr;
    }
    
    if (url) {
        return (
            <div className="flex flex-col">
                {locDisplay && <span className="font-bold text-gray-800 text-xs uppercase tracking-wider">{locDisplay}</span>}
                <a 
                    href={url} 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    className="text-indigo-600 hover:text-indigo-800 underline font-medium text-sm transition-colors mt-0.5 inline-block"
                    onClick={(e) => e.stopPropagation()}
                >
                    {addrDisplay || "View on Google Maps"}
                </a>
            </div>
        );
    }
    
    return (
        <div className="flex flex-col">
            {locDisplay && <span className="font-bold text-gray-800 text-xs uppercase tracking-wider">{locDisplay}</span>}
            <span className="text-sm text-gray-600">{addrDisplay || defaultText}</span>
        </div>
    );
};

export default function SuperAdminDashboard() {
    const [tenants, setTenants] = useState([]);
    const [tenantsLoading, setTenantsLoading] = useState(false);
    const [approvingId, setApprovingId] = useState(null);
    const [togglingTenantId, setTogglingTenantId] = useState(null);
    const [togglingBranchId, setTogglingBranchId] = useState(null);
    const [hotelCodes, setHotelCodes] = useState({});
    const [err, setErr] = useState(null);
    const [loading, setLoading] = useState(true);
    const [branches, setBranches] = useState([]);
    const [globalSummary, setGlobalSummary] = useState({
        total_revenue: 0,
        total_expenses: 0,
        active_employees: 0,
        occupied_rooms: 0,
        total_rooms: 0
    });

    // Property Approvals Search & Filter State
    const [tenantSearch, setTenantSearch] = useState("");
    const [tenantStatusFilter, setTenantStatusFilter] = useState("all"); // 'all' | 'pending' | 'active' | 'disabled'
    const [tenantPlanFilter, setTenantPlanFilter] = useState("all");

    // Branches Search & Filter State
    const [branchSearch, setBranchSearch] = useState("");
    const [branchStatusFilter, setBranchStatusFilter] = useState("all"); // 'all' | 'active' | 'disabled'

    const fetchTenants = async () => {
        setTenantsLoading(true);
        try {
            const res = await API.get("/saas/admin/tenants");
            const data = res.data || [];
            setTenants(data);
            const codes = {};
            data.forEach(t => {
                codes[t.id] = (t.branch_code && t.branch_code !== 'N/A') ? t.branch_code : '';
            });
            setHotelCodes(prev => ({ ...codes, ...prev }));
        } catch (e) {
            // ignore if not superadmin or endpoint unavailable
        } finally {
            setTenantsLoading(false);
        }
    };

    // SaaS Plans Management State & Handlers
    const [saasPlans, setSaasPlans] = useState([]);
    const [plansLoading, setPlansLoading] = useState(false);
    const [editingPlan, setEditingPlan] = useState(null);
    const [isPlanModalOpen, setIsPlanModalOpen] = useState(false);
    const [savingPlan, setSavingPlan] = useState(false);
    const [planFormData, setPlanFormData] = useState({
        name: "",
        code: "",
        price_monthly: 0,
        price_yearly: 0,
        max_rooms: 15,
        max_branches: 1,
        max_staff_users: 5,
        description: "",
        badge: "",
        features: "",
        is_active: true,
        update_existing_tenants: false
    });

    const fetchSaasPlans = async () => {
        setPlansLoading(true);
        try {
            const res = await API.get("/saas/admin/plans");
            setSaasPlans(res.data || []);
        } catch (e) {
            console.error("Failed to load SaaS plans:", e);
        } finally {
            setPlansLoading(false);
        }
    };

    const handleOpenEditPlanModal = (plan) => {
        if (!plan) return;
        setEditingPlan(plan);
        setPlanFormData({
            name: plan.name || "",
            code: plan.code || "",
            price_monthly: plan.price_monthly !== undefined ? plan.price_monthly : 0,
            price_yearly: plan.price_yearly !== undefined ? plan.price_yearly : 0,
            max_rooms: plan.max_rooms !== undefined ? plan.max_rooms : 15,
            max_branches: plan.max_branches !== undefined ? plan.max_branches : 1,
            max_staff_users: plan.max_staff_users !== undefined ? plan.max_staff_users : 5,
            description: plan.description || "",
            badge: plan.badge || "",
            features: Array.isArray(plan.features) ? plan.features.join("\n") : "",
            is_active: plan.is_active !== false,
            update_existing_tenants: false
        });
        setIsPlanModalOpen(true);
    };

    // Premium Interactive Dialog State
    const [dialogState, setDialogState] = useState({
        isOpen: false,
        type: 'success', // 'success' | 'danger' | 'warning' | 'info'
        title: '',
        message: '',
        confirmText: 'Continue',
        cancelText: 'Cancel',
        inputValue: '',
        inputLabel: '',
        inputPlaceholder: '',
        onConfirm: null,
        onCancel: null,
        isPrompt: false,
        isConfirm: false
    });

    const showSuccessModal = (title, message) => {
        toast.success(title);
        setDialogState({
            isOpen: true,
            type: 'success',
            title,
            message,
            confirmText: 'Awesome',
            isConfirm: false,
            isPrompt: false,
            onConfirm: () => setDialogState(prev => ({ ...prev, isOpen: false }))
        });
    };

    const showErrorModal = (title, message) => {
        toast.error(title);
        setDialogState({
            isOpen: true,
            type: 'danger',
            title,
            message: message || "An unexpected error occurred.",
            confirmText: 'Dismiss',
            isConfirm: false,
            isPrompt: false,
            onConfirm: () => setDialogState(prev => ({ ...prev, isOpen: false }))
        });
    };

    const showConfirmModal = ({ title, message, type = 'warning', confirmText = 'Confirm', cancelText = 'Cancel', onConfirm, onCancel }) => {
        setDialogState({
            isOpen: true,
            type,
            title,
            message,
            confirmText,
            cancelText,
            isConfirm: true,
            isPrompt: false,
            onConfirm: () => {
                setDialogState(prev => ({ ...prev, isOpen: false }));
                if (onConfirm) onConfirm();
            },
            onCancel: () => {
                setDialogState(prev => ({ ...prev, isOpen: false }));
                if (onCancel) onCancel();
            }
        });
    };

    const showPromptModal = ({ title, message, inputLabel, defaultValue = '', placeholder = '', confirmText = 'Confirm', cancelText = 'Cancel', onConfirm, onCancel }) => {
        setDialogState({
            isOpen: true,
            type: 'info',
            title,
            message,
            inputLabel,
            inputValue: defaultValue,
            inputPlaceholder: placeholder,
            confirmText,
            cancelText,
            isConfirm: true,
            isPrompt: true,
            onConfirm: (val) => {
                setDialogState(prev => ({ ...prev, isOpen: false }));
                if (onConfirm) onConfirm(val);
            },
            onCancel: () => {
                setDialogState(prev => ({ ...prev, isOpen: false }));
                if (onCancel) onCancel();
            }
        });
    };

    const handleSavePlan = async (e) => {
        e.preventDefault();
        if (!editingPlan) return;
        setSavingPlan(true);
        try {
            const featureArray = (planFormData.features || "")
                .split("\n")
                .map(f => f.trim())
                .filter(f => f.length > 0);

            const payload = {
                name: planFormData.name,
                price_monthly: parseFloat(planFormData.price_monthly) || 0,
                price_yearly: parseFloat(planFormData.price_yearly) || 0,
                max_rooms: parseInt(planFormData.max_rooms) || 1,
                max_branches: parseInt(planFormData.max_branches) || 1,
                max_staff_users: parseInt(planFormData.max_staff_users) || 1,
                description: planFormData.description,
                badge: planFormData.badge,
                features: featureArray,
                is_active: planFormData.is_active,
                update_existing_tenants: planFormData.update_existing_tenants
            };

            const res = await API.put(`/saas/admin/plans/${editingPlan.id}`, payload);
            showSuccessModal(
                "Plan Updated Successfully!",
                `The plan "${planFormData.name}" has been updated. Pricing and quota changes are active across the platform.`
            );
            setIsPlanModalOpen(false);
            fetchSaasPlans();
            fetchTenants();
        } catch (err) {
            console.error("Save plan error:", err);
            showErrorModal("Failed to Update Plan", err.response?.data?.detail || "Could not update the SaaS plan.");
        } finally {
            setSavingPlan(false);
        }
    };

    const [deletingPlanId, setDeletingPlanId] = useState(null);

    const handleDeletePlan = (plan) => {
        if (!plan || !plan.id) return;
        const subCount = plan.subscriber_count || 0;
        let confirmText = `Are you sure you want to permanently delete the "${plan.name}" plan?`;
        if (subCount > 0) {
            confirmText = `⚠️ WARNING: ${subCount} property tenant(s) are currently subscribed to the "${plan.name}" plan.\n\nDeleting this plan will remove it from future selections and safely unlink existing subscribers without deleting their data.\n\nAre you sure you want to proceed?`;
        }

        showConfirmModal({
            title: `Delete "${plan.name}" Plan?`,
            message: confirmText,
            type: 'danger',
            confirmText: 'Yes, Delete Plan',
            cancelText: 'Keep Plan',
            onConfirm: async () => {
                setDeletingPlanId(plan.id);
                try {
                    const res = await API.delete(`/saas/admin/plans/${plan.id}`);
                    showSuccessModal(
                        "Plan Deleted Successfully",
                        res.data?.message || `The "${plan.name}" plan has been deleted.`
                    );
                    if (editingPlan && editingPlan.id === plan.id) {
                        setIsPlanModalOpen(false);
                    }
                    fetchSaasPlans();
                    fetchTenants();
                } catch (err) {
                    console.error("Delete plan error:", err);
                    showErrorModal("Failed to Delete Plan", err.response?.data?.detail || "Could not delete this SaaS plan.");
                } finally {
                    setDeletingPlanId(null);
                }
            }
        });
    };

    const handleApproveTenant = async (tenantId) => {
        const enteredCode = (hotelCodes[tenantId] !== undefined ? hotelCodes[tenantId] : "").trim().toUpperCase();
        setApprovingId(tenantId);
        try {
            const payload = enteredCode ? { branch_code: enteredCode } : {};
            const res = await API.post(`/saas/admin/approve-tenant/${tenantId}`, payload);
            showSuccessModal(
                "Property Approved & Activated!",
                res.data?.message || "Property approved and activated! Property admin can now log in and operate."
            );
            fetchTenants();
            // Refresh global branches
            const config = { headers: { "X-Branch-ID": "all" } };
            const bRes = await API.get("/branches?include_inactive=true", config);
            setBranches(bRes.data || []);
        } catch (e) {
            showErrorModal("Approval Failed", e.response?.data?.detail || "Approval failed. Please try again.");
        } finally {
            setApprovingId(null);
        }
    };

    const [acceptingPaymentId, setAcceptingPaymentId] = useState(null);

    const executeAcceptPayment = async (tenant, targetStatus, transactionRef) => {
        try {
            setAcceptingPaymentId(tenant.id);
            const res = await API.post(`/saas/admin/accept-payment/${tenant.id}`, {
                payment_status: targetStatus,
                payment_method: tenant.payment_method || "Accepted by SuperAdmin",
                transaction_ref: transactionRef,
                activate_property: true
            });
            showSuccessModal("Payment Status Updated", res.data?.message || "Payment status updated successfully!");
            fetchTenants();
            // Refresh global branches
            const config = { headers: { "X-Branch-ID": "all" } };
            const bRes = await API.get("/branches?include_inactive=true", config);
            setBranches(bRes.data || []);
        } catch (err) {
            console.error("Accept payment error:", err);
            showErrorModal("Payment Update Failed", err.response?.data?.detail || "Failed to update payment status.");
        } finally {
            setAcceptingPaymentId(null);
        }
    };

    const handleAcceptPayment = async (tenant, targetStatus = "paid") => {
        if (!tenant || !tenant.id) return;
        const isMarkingPaid = targetStatus === "paid";

        if (isMarkingPaid) {
            if (tenant.payment_status === "payment_raised") {
                showConfirmModal({
                    title: "Accept Verified Payment?",
                    message: `Payment of ₹${(tenant.monthly_amount || 0).toLocaleString()} was raised by "${tenant.business_name || tenant.name}".\n\n• UTR / Ref: ${tenant.payment_ref || "N/A"}\n• Method: ${tenant.payment_method || "UPI (Teqmates)"}\n\nAccepting this will record the monthly bill as Paid and keep the property workspace active.`,
                    type: 'info',
                    confirmText: 'Accept & Activate',
                    cancelText: 'Cancel',
                    onConfirm: () => executeAcceptPayment(tenant, targetStatus, tenant.payment_ref || "")
                });
            } else {
                showPromptModal({
                    title: "Raise & Accept Payment",
                    message: `This property has not submitted payment online yet. You can accept payment now on their behalf:`,
                    inputLabel: "UTR / Transaction Reference (or leave default for cash/direct)",
                    defaultValue: `TXN-${Date.now()}`,
                    placeholder: "Enter transaction reference",
                    confirmText: "Raise & Accept",
                    cancelText: "Cancel",
                    onConfirm: (val) => {
                        const transactionRef = (val || "").trim() || `TXN-${Date.now()}`;
                        executeAcceptPayment(tenant, targetStatus, transactionRef);
                    }
                });
            }
        } else {
            showConfirmModal({
                title: "Mark Payment as Unpaid?",
                message: `Are you sure you want to mark payment as UNPAID for "${tenant.business_name || tenant.name}"?\n\nThe property admin will see a renewal reminder banner on their dashboard.`,
                type: 'warning',
                confirmText: 'Mark Unpaid',
                cancelText: 'Cancel',
                onConfirm: () => executeAcceptPayment(tenant, targetStatus, "")
            });
        }
    };

    const executeToggleTenant = async (tenant, action) => {
        setTogglingTenantId(tenant.id);
        try {
            const res = await API.post(`/saas/admin/toggle-tenant-status/${tenant.id}`);
            showSuccessModal(
                `Property ${action === "disable" ? "Disabled" : "Enabled"}`,
                res.data?.message || `Property has been ${action}d successfully.`
            );
            fetchTenants();
            const config = { headers: { "X-Branch-ID": "all" } };
            const bRes = await API.get("/branches?include_inactive=true", config);
            setBranches(bRes.data || []);
        } catch (e) {
            showErrorModal("Action Failed", e.response?.data?.detail || `Failed to ${action} property.`);
        } finally {
            setTogglingTenantId(null);
        }
    };

    const handleToggleTenantStatus = (tenant) => {
        const isCurrentlyActive = tenant.is_active !== false;
        const action = isCurrentlyActive ? "disable" : "enable";
        const propertyName = tenant.business_name || tenant.name;

        if (isCurrentlyActive) {
            showConfirmModal({
                title: `Disable Property "${propertyName}"?`,
                message: `Staff and users of this property will not be able to log in or use the workspace until re-enabled.\n\nAll existing data and records are safely preserved.`,
                type: 'danger',
                confirmText: 'Disable Property',
                cancelText: 'Keep Active',
                onConfirm: () => executeToggleTenant(tenant, action)
            });
        } else {
            executeToggleTenant(tenant, action);
        }
    };

    const executeToggleBranch = async (branch, action) => {
        setTogglingBranchId(branch.id);
        try {
            await API.patch(`/branches/${branch.id}/toggle-status`);
            showSuccessModal(
                `Branch ${action === "disable" ? "Disabled" : "Enabled"}`,
                `Branch "${branch.name}" has been ${action}d.`
            );
            const config = { headers: { "X-Branch-ID": "all" } };
            const bRes = await API.get("/branches?include_inactive=true", config);
            setBranches(bRes.data || []);
            fetchTenants();
        } catch (e) {
            showErrorModal("Action Failed", e.response?.data?.detail || `Failed to ${action} branch.`);
        } finally {
            setTogglingBranchId(null);
        }
    };

    const handleToggleBranchStatus = (branch) => {
        const isCurrentlyActive = branch.is_active !== false;
        const action = isCurrentlyActive ? "disable" : "enable";

        if (isCurrentlyActive) {
            showConfirmModal({
                title: `Disable Branch "${branch.name}"?`,
                message: `Staff will not be able to operate or switch to this branch until re-enabled.`,
                type: 'danger',
                confirmText: 'Disable Branch',
                cancelText: 'Keep Active',
                onConfirm: () => executeToggleBranch(branch, action)
            });
        } else {
            executeToggleBranch(branch, action);
        }
    };

    // Edit Property Modal State & Handlers
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [editingBranch, setEditingBranch] = useState(null);
    const [isSubmittingEdit, setIsSubmittingEdit] = useState(false);
    const [editImageFile, setEditImageFile] = useState(null);
    const [editImagePreview, setEditImagePreview] = useState(null);
    const [showEditPassword, setShowEditPassword] = useState(false);
    const [editFormData, setEditFormData] = useState({
        name: '',
        code: '',
        address: '',
        phone: '',
        email: '',
        password: '',
        payment_status: 'paid',
        monthly_amount: 2999,
        gst_number: '',
        facebook: '',
        instagram: '',
        twitter: '',
        linkedin: '',
        location: ''
    });

    const validateEmail = (email) => {
        if (!email) return true;
        const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return re.test(String(email).toLowerCase());
    };

    const handleOpenEditModal = (target) => {
        if (!target) return;
        
        let branchToEdit = target;
        // If target is tenant, find matching branch in branches list or construct fallback
        if (!target.code && (target.branch_code || target.branch_id)) {
            const found = branches.find(b => 
                (target.branch_id && b.id === target.branch_id) || 
                (b.tenant_id && b.tenant_id === target.id) ||
                (b.code && target.branch_code && b.code.toUpperCase() === target.branch_code.toUpperCase())
            );
            if (found) {
                branchToEdit = found;
            } else {
                branchToEdit = {
                    id: target.branch_id,
                    name: target.business_name || target.name || '',
                    code: target.branch_code && target.branch_code !== 'N/A' ? target.branch_code : '',
                    phone: target.contact_phone || '',
                    email: target.contact_email || target.email || '',
                    address: '',
                    location: '',
                    gst_number: '',
                    payment_status: target.payment_status || 'paid',
                    monthly_amount: target.monthly_amount !== undefined ? target.monthly_amount : 2999,
                    tenant_id: target.id
                };
            }
        }

        setEditingBranch(branchToEdit);
        setEditFormData({
            name: branchToEdit.name || '',
            code: branchToEdit.code || '',
            address: branchToEdit.address || '',
            phone: branchToEdit.phone || '',
            email: branchToEdit.email || '',
            password: '',
            payment_status: target.payment_status || branchToEdit.payment_status || 'paid',
            monthly_amount: target.monthly_amount !== undefined ? target.monthly_amount : (branchToEdit.monthly_amount !== undefined ? branchToEdit.monthly_amount : 2999),
            next_billing_date: target.next_billing_date ? target.next_billing_date.split('T')[0] : (branchToEdit.next_billing_date ? branchToEdit.next_billing_date.split('T')[0] : ''),
            gst_number: branchToEdit.gst_number || '',
            facebook: branchToEdit.facebook || '',
            instagram: branchToEdit.instagram || '',
            twitter: branchToEdit.twitter || '',
            linkedin: branchToEdit.linkedin || '',
            location: branchToEdit.location || ''
        });
        setShowEditPassword(false);
        setEditImageFile(null);
        if (branchToEdit.image_url) {
            setEditImagePreview(
                branchToEdit.image_url.startsWith('http') 
                    ? branchToEdit.image_url 
                    : `${API.defaults.baseURL.replace('/api', '')}${branchToEdit.image_url}`
            );
        } else {
            setEditImagePreview(null);
        }
        setIsEditModalOpen(true);
    };

    const handleEditImageChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            setEditImageFile(file);
            const reader = new FileReader();
            reader.onloadend = () => {
                setEditImagePreview(reader.result);
            };
            reader.readAsDataURL(file);
        }
    };

    const handleSubmitEdit = async (e) => {
        e.preventDefault();
        if (!editingBranch || !editingBranch.id) {
            toast.error("No branch ID associated with this property yet.");
            return;
        }

        if (editFormData.email && !validateEmail(editFormData.email)) {
            toast.error('Please enter a valid email address');
            return;
        }

        if (!editFormData.name || !editFormData.name.trim()) {
            toast.error('Property name is required');
            return;
        }

        if (!editFormData.code || !editFormData.code.trim()) {
            toast.error('Hotel / Branch Code is required');
            return;
        }

        if (editFormData.password && editFormData.password.trim().length > 0 && editFormData.password.trim().length < 6) {
            toast.error('Password must be at least 6 characters long');
            return;
        }

        try {
            setIsSubmittingEdit(true);
            const data = new FormData();
            Object.keys(editFormData).forEach(key => {
                if (key === 'password') {
                    if (editFormData.password && editFormData.password.trim().length > 0) {
                        data.append('password', editFormData.password.trim());
                    }
                } else if (editFormData[key] !== null && editFormData[key] !== undefined) {
                    data.append(key, editFormData[key]);
                }
            });

            if (editImageFile) {
                data.append('image', editImageFile);
            }

            await API.put(`/branches/${editingBranch.id}`, data, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });

            showSuccessModal("Property Updated Successfully!", `Property "${editFormData.name}" profile and credentials updated.`);
            setIsEditModalOpen(false);

            // Refresh data
            fetchTenants();
            const config = { headers: { "X-Branch-ID": "all" } };
            const bRes = await API.get("/branches?include_inactive=true", config);
            setBranches(bRes.data || []);
        } catch (error) {
            showErrorModal("Update Failed", error.response?.data?.detail || 'Failed to update property details.');
        } finally {
            setIsSubmittingEdit(false);
        }
    };

    // Derived Counts & Options
    const uniquePlans = useMemo(() => {
        const plans = new Set();
        tenants.forEach(t => {
            const p = (t.plan_code || t.plan_name || '').toLowerCase().trim();
            if (p) plans.add(p);
        });
        return Array.from(plans);
    }, [tenants]);

    const pendingTenants = useMemo(() => tenants.filter(t => t.subscription_status === 'pending_approval'), [tenants]);
    const pendingTenantsCount = pendingTenants.length;
    const paymentRaisedCount = useMemo(() => tenants.filter(t => t.payment_status === 'payment_raised').length, [tenants]);
    const activeTenantsCount = useMemo(() => tenants.filter(t => t.subscription_status === 'active' && t.is_active !== false).length, [tenants]);
    const disabledTenantsCount = useMemo(() => tenants.filter(t => t.is_active === false).length, [tenants]);

    const filteredTenants = useMemo(() => {
        return tenants.filter(tenant => {
            // Status filter
            if (tenantStatusFilter === "pending") {
                if (tenant.subscription_status !== 'pending_approval') return false;
            } else if (tenantStatusFilter === "payment_raised") {
                if (tenant.payment_status !== 'payment_raised') return false;
            } else if (tenantStatusFilter === "active") {
                if (tenant.subscription_status !== 'active' || tenant.is_active === false) return false;
            } else if (tenantStatusFilter === "disabled") {
                if (tenant.is_active !== false) return false;
            }

            // Plan filter
            if (tenantPlanFilter !== "all") {
                const p = (tenant.plan_code || tenant.plan_name || '').toLowerCase().trim();
                if (p !== tenantPlanFilter.toLowerCase()) return false;
            }

            // Search query
            if (tenantSearch.trim()) {
                const q = tenantSearch.toLowerCase().trim();
                const name = (tenant.business_name || tenant.name || '').toLowerCase();
                const slug = (tenant.slug || '').toLowerCase();
                const owner = (tenant.owner_name || '').toLowerCase();
                const email = (tenant.email || tenant.contact_email || '').toLowerCase();
                const phone = (tenant.contact_phone || '').toLowerCase();
                const code = (hotelCodes[tenant.id] || tenant.branch_code || '').toLowerCase();
                const plan = (tenant.plan_code || tenant.plan_name || '').toLowerCase();

                const match = name.includes(q) || slug.includes(q) || owner.includes(q) ||
                              email.includes(q) || phone.includes(q) || code.includes(q) || plan.includes(q);
                if (!match) return false;
            }

            return true;
        });
    }, [tenants, tenantStatusFilter, tenantPlanFilter, tenantSearch, hotelCodes]);

    const activeBranchesCount = useMemo(() => branches.filter(b => b.is_active !== false).length, [branches]);
    const disabledBranchesCount = useMemo(() => branches.filter(b => b.is_active === false).length, [branches]);

    const filteredBranches = useMemo(() => {
        return branches.filter(branch => {
            // Status filter
            if (branchStatusFilter === "active") {
                if (branch.is_active === false) return false;
            } else if (branchStatusFilter === "disabled") {
                if (branch.is_active !== false) return false;
            }

            // Search query
            if (branchSearch.trim()) {
                const q = branchSearch.toLowerCase().trim();
                const name = (branch.name || '').toLowerCase();
                const code = (branch.code || '').toLowerCase();
                const loc = (branch.location || '').toLowerCase();
                const addr = (branch.address || '').toLowerCase();
                const gst = (branch.gst_number || '').toLowerCase();

                const match = name.includes(q) || code.includes(q) || loc.includes(q) || addr.includes(q) || gst.includes(q);
                if (!match) return false;
            }

            return true;
        });
    }, [branches, branchStatusFilter, branchSearch]);

    useEffect(() => {
        let mounted = true;

        const fetchGlobalData = async (showLoading = true) => {
            try {
                if (showLoading || (branches.length === 0 && globalSummary.total_revenue === 0)) {
                    setLoading(true);
                }
                // Force headers to NOT use a specific branch so we get all branch data
                const config = { headers: { "X-Branch-ID": "all" } };

                const [branchesRes, overviewRes] = await Promise.allSettled([
                    API.get("/branches?include_inactive=true", config),
                    API.get("/saas/admin/overview", config)
                ]);

                if (!mounted) return;

                // Process branches
                if (branchesRes.status === "fulfilled") {
                    setBranches(branchesRes.value.data || []);
                }

                // Process high-speed aggregate summary
                if (overviewRes.status === "fulfilled" && overviewRes.value.data) {
                    const d = overviewRes.value.data;
                    setGlobalSummary({
                        total_revenue: d.total_revenue || 0,
                        total_expenses: d.total_expenses || 0,
                        active_employees: d.active_employees || 0,
                        occupied_rooms: d.occupied_rooms || 0,
                        total_rooms: d.total_rooms || 0
                    });
                }

            } catch (error) {
                console.error("Super Admin fetch error:", error);
                setErr("Failed to load global data. Please try again.");
            } finally {
                if (mounted) setLoading(false);
            }
        };

        fetchGlobalData(true);
        fetchTenants();
        fetchSaasPlans();
        const interval = setInterval(() => fetchGlobalData(false), 300000); // 5 min
        return () => { mounted = false; clearInterval(interval); };
    }, []);

    const netProfit = globalSummary.total_revenue - globalSummary.total_expenses;
    const margin = globalSummary.total_revenue > 0 ? (netProfit / globalSummary.total_revenue * 100).toFixed(1) : 0;

    if (loading) {
        return (
            <DashboardLayout>
                <div className="flex bg-gray-50 items-center justify-center min-h-[60vh]">
                    <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-600"></div>
                </div>
            </DashboardLayout>
        );
    }

    if (err) {
        return (
            <DashboardLayout>
                <div className="p-8 text-center bg-red-50 text-red-600 rounded-xl my-8 mx-auto max-w-2xl border border-red-200 shadow-sm">
                    <h2 className="text-xl font-bold mb-2">Error Loading Enterprise Dashboard</h2>
                    <p>{err}</p>
                </div>
            </DashboardLayout>
        );
    }

    return (
        <DashboardLayout>
            {/* Background Animation */}
            <div className="bubbles-container">
                {[...Array(10)].map((_, i) => <li key={i}></li>)}
            </div>

            <div className="relative max-w-[1400px] mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-8 z-10">
                <header className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-gray-200 pb-6">
                    <div>
                        <h1 className="text-2xl sm:text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-indigo-700 to-purple-600 tracking-tight">
                            Enterprise Command Center
                        </h1>
                        <p className="text-sm sm:text-base text-gray-500 mt-1 font-medium">Global Multi-Branch Executive Overview</p>
                    </div>
                    <div className="flex items-center gap-3 bg-white px-4 py-2 rounded-full shadow-sm border border-gray-100">
                        <span className="relative flex h-3 w-3">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
                        </span>
                        <span className="text-sm font-semibold text-gray-600">Global Sync Active</span>
                    </div>
                </header>

                {/* Top Tier KPIs */}
                <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    <SuperAdminKPICard
                        label="Total Network Revenue"
                        value={formatCurrency(globalSummary.total_revenue)}
                        sub="Across all branches"
                        icon={Receipt}
                        colorClass="bg-emerald-500 text-emerald-100"
                    />
                    <SuperAdminKPICard
                        label="Total Network Expenses"
                        value={formatCurrency(globalSummary.total_expenses)}
                        sub="Global operating costs"
                        icon={PiggyBank}
                        colorClass="bg-rose-500 text-rose-100"
                    />
                    <SuperAdminKPICard
                        label="Enterprise Net Profit"
                        value={formatCurrency(netProfit)}
                        sub={`Global Margin: ${margin}%`}
                        icon={Activity}
                        colorClass="bg-blue-500 text-blue-100"
                    />
                    <SuperAdminKPICard
                        label="Total Active Branches"
                        value={branches.length}
                        sub="Managed properties"
                        icon={Building2}
                        colorClass="bg-purple-500 text-purple-100"
                    />
                    <SuperAdminKPICard
                        label="Global Workforce"
                        value={globalSummary.active_employees}
                        sub="Active employees"
                        icon={Users}
                        colorClass="bg-amber-500 text-amber-100"
                    />
                    <SuperAdminKPICard
                        label="Global Room Occupancy"
                        value={`${globalSummary.occupied_rooms} / ${globalSummary.total_rooms}`}
                        sub="Occupied vs Total Rooms"
                        icon={Briefcase}
                        colorClass="bg-cyan-500 text-cyan-100"
                    />
                </section>

                {/* SaaS Subscription Plans Management Section */}
                <section className="bg-white rounded-2xl shadow-sm border border-indigo-100 overflow-hidden">
                    <div className="px-6 py-5 border-b border-indigo-100 bg-gradient-to-r from-indigo-50/70 via-purple-50/40 to-slate-50 flex flex-wrap items-center justify-between gap-3">
                        <div className="flex items-center gap-2.5">
                            <div className="p-2 bg-indigo-600 text-white rounded-xl shadow-xs">
                                <Layers size={18} />
                            </div>
                            <div>
                                <div className="flex items-center gap-2">
                                    <h3 className="text-lg font-bold text-gray-900">SaaS Subscription Plans</h3>
                                    <span className="px-2.5 py-0.5 rounded-full text-[11px] font-black uppercase tracking-wider bg-indigo-100 text-indigo-800 border border-indigo-200">
                                        Super Admin Control
                                    </span>
                                </div>
                                <p className="text-xs text-gray-500 mt-0.5">
                                    Configure pricing, room limits, features, and badges for Starter, Growth, Enterprise, and Trial plans
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={fetchSaasPlans}
                                disabled={plansLoading}
                                className="px-3.5 py-1.5 bg-white hover:bg-gray-50 text-indigo-700 border border-indigo-200 text-xs font-bold rounded-xl transition-all shadow-xs flex items-center gap-1.5"
                            >
                                <RotateCcw size={13} className={plansLoading ? "animate-spin" : ""} /> Refresh Plans
                            </button>
                        </div>
                    </div>

                    <div className="p-5 sm:p-6 bg-slate-50/60">
                        {plansLoading && saasPlans.length === 0 ? (
                            <div className="py-12 flex flex-col items-center justify-center text-gray-400">
                                <Loader2 className="animate-spin text-indigo-600 mb-2" size={28} />
                                <span className="text-xs font-semibold">Loading subscription plans...</span>
                            </div>
                        ) : saasPlans.length === 0 ? (
                            <div className="text-center py-8 text-sm text-gray-500">
                                No SaaS plans found in database.
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5">
                                {saasPlans.map((plan) => {
                                    const isStarter = plan.code === "starter";
                                    const isGrowth = plan.code === "growth";
                                    const isEnterprise = plan.code === "enterprise";

                                    return (
                                        <div
                                            key={plan.id}
                                            className={`rounded-2xl p-5 relative flex flex-col justify-between transition-all bg-white border shadow-xs hover:shadow-md ${
                                                isGrowth
                                                    ? "border-indigo-300 ring-2 ring-indigo-500/10"
                                                    : isStarter
                                                    ? "border-emerald-200"
                                                    : isEnterprise
                                                    ? "border-purple-200"
                                                    : "border-gray-200"
                                            }`}
                                        >
                                            {/* Ribbon/Badge */}
                                            {plan.badge && (
                                                <div className="absolute -top-2.5 right-4 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider shadow-xs bg-amber-400 text-amber-950">
                                                    {plan.badge}
                                                </div>
                                            )}

                                            <div className="space-y-3">
                                                {/* Header & Code */}
                                                <div className="flex items-center justify-between">
                                                    <span className={`text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded-md ${
                                                        isGrowth
                                                            ? "bg-indigo-100 text-indigo-800"
                                                            : isStarter
                                                            ? "bg-emerald-100 text-emerald-800"
                                                            : isEnterprise
                                                            ? "bg-purple-100 text-purple-800"
                                                            : "bg-gray-100 text-gray-700"
                                                    }`}>
                                                        {plan.code}
                                                    </span>
                                                    <span className={`text-[10px] font-semibold flex items-center gap-1 ${
                                                        plan.is_active ? "text-emerald-600" : "text-gray-400"
                                                    }`}>
                                                        <span className={`w-1.5 h-1.5 rounded-full ${plan.is_active ? "bg-emerald-500" : "bg-gray-400"}`}></span>
                                                        {plan.is_active ? "Active" : "Disabled"}
                                                    </span>
                                                </div>

                                                {/* Plan Name & Price */}
                                                <div>
                                                    <h4 className="text-base font-extrabold text-gray-900 leading-tight">
                                                        {plan.name}
                                                    </h4>
                                                    <div className="flex items-baseline gap-1 mt-1">
                                                        <span className="text-2xl font-black text-gray-900">
                                                            {plan.price_monthly > 0
                                                                ? `₹${plan.price_monthly.toLocaleString()}`
                                                                : isEnterprise
                                                                ? "Custom"
                                                                : "Free"}
                                                        </span>
                                                        <span className="text-xs text-gray-400 font-medium">
                                                            {plan.price_monthly > 0 ? "/ month" : isEnterprise ? "/ tailored" : ""}
                                                        </span>
                                                    </div>
                                                    {plan.description && (
                                                        <p className="text-xs text-gray-500 mt-1 line-clamp-2">
                                                            {plan.description}
                                                        </p>
                                                    )}
                                                </div>

                                                {/* Quotas & Limits Grid */}
                                                <div className="grid grid-cols-2 gap-2 p-2.5 rounded-xl bg-slate-50 border border-slate-100 text-xs">
                                                    <div>
                                                        <span className="text-[10px] text-gray-400 block font-medium">Max Rooms</span>
                                                        <span className="font-bold text-gray-800">
                                                            {plan.max_rooms >= 999 ? "Unlimited" : `${plan.max_rooms} Rooms`}
                                                        </span>
                                                    </div>
                                                    <div>
                                                        <span className="text-[10px] text-gray-400 block font-medium">Max Branches</span>
                                                        <span className="font-bold text-gray-800">
                                                            {plan.max_branches >= 99 ? "Unlimited" : `${plan.max_branches} Branch`}
                                                        </span>
                                                    </div>
                                                    <div>
                                                        <span className="text-[10px] text-gray-400 block font-medium">Staff Users</span>
                                                        <span className="font-bold text-gray-800">
                                                            {plan.max_staff_users >= 999 ? "Unlimited" : `${plan.max_staff_users} Users`}
                                                        </span>
                                                    </div>
                                                    <div>
                                                        <span className="text-[10px] text-gray-400 block font-medium">Subscribers</span>
                                                        <span className="font-bold text-indigo-600">
                                                            {plan.subscriber_count || 0} Properties
                                                        </span>
                                                    </div>
                                                </div>

                                                {/* Features Preview */}
                                                <div className="pt-2 border-t border-gray-100 space-y-1.5">
                                                    <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 block">
                                                        Features ({Array.isArray(plan.features) ? plan.features.length : 0})
                                                    </span>
                                                    <ul className="space-y-1 text-xs text-gray-600">
                                                        {(Array.isArray(plan.features) ? plan.features.slice(0, 3) : []).map((feat, idx) => (
                                                            <li key={idx} className="flex items-center gap-1.5 truncate" title={feat}>
                                                                <CheckCircle2 size={12} className="text-emerald-500 shrink-0" />
                                                                <span className="truncate">{feat}</span>
                                                            </li>
                                                        ))}
                                                        {Array.isArray(plan.features) && plan.features.length > 3 && (
                                                            <li className="text-[11px] text-indigo-600 font-semibold pl-4">
                                                                +{plan.features.length - 3} more features
                                                            </li>
                                                        )}
                                                    </ul>
                                                </div>
                                            </div>

                                            {/* Action Buttons */}
                                            <div className="pt-4 mt-3 border-t border-gray-100 flex items-center gap-2">
                                                <button
                                                    onClick={() => handleOpenEditPlanModal(plan)}
                                                    className="flex-1 py-2 px-3 bg-indigo-50 hover:bg-indigo-600 text-indigo-700 hover:text-white font-bold text-xs rounded-xl transition-all shadow-2xs flex items-center justify-center gap-1.5 group"
                                                >
                                                    <Edit2 size={13} className="group-hover:scale-110 transition-transform" />
                                                    <span>Edit {plan.name}</span>
                                                </button>
                                                <button
                                                    onClick={() => handleDeletePlan(plan)}
                                                    disabled={deletingPlanId === plan.id}
                                                    title={`Delete ${plan.name} Plan`}
                                                    className="p-2 bg-gray-50 hover:bg-rose-50 text-gray-400 hover:text-rose-600 rounded-xl border border-gray-200 hover:border-rose-200 transition-all flex items-center justify-center disabled:opacity-50"
                                                >
                                                    {deletingPlanId === plan.id ? (
                                                        <Loader2 className="animate-spin" size={14} />
                                                    ) : (
                                                        <Trash2 size={14} />
                                                    )}
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </section>

                {/* Property Approvals & Subscription Payments Section */}
                <section className="bg-white rounded-2xl shadow-sm border border-amber-200 overflow-hidden">
                    <div className="px-6 py-5 border-b border-amber-100 bg-amber-50/50 flex flex-wrap items-center justify-between gap-3">
                        <div className="flex items-center gap-2 flex-wrap">
                            <Shield className="text-amber-600" size={20} />
                            <h3 className="text-lg font-bold text-gray-800">Property Approvals &amp; Subscription Payments</h3>
                            {pendingTenantsCount > 0 && (
                                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-400 text-white animate-pulse">
                                    {pendingTenantsCount} Registrations Pending
                                </span>
                            )}
                            {paymentRaisedCount > 0 && (
                                <span className="px-2.5 py-0.5 rounded-full text-xs font-extrabold bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-xs animate-bounce flex items-center gap-1">
                                    ⚡ {paymentRaisedCount} Payment{paymentRaisedCount > 1 ? 's' : ''} to Verify
                                </span>
                            )}
                            <span className="text-xs text-gray-400 font-medium ml-1">
                                (Showing {filteredTenants.length} of {tenants.length})
                            </span>
                        </div>
                        <div className="flex items-center gap-3">
                            {(tenantSearch || tenantStatusFilter !== "all" || tenantPlanFilter !== "all") && (
                                <button
                                    onClick={() => {
                                        setTenantSearch("");
                                        setTenantStatusFilter("all");
                                        setTenantPlanFilter("all");
                                    }}
                                    className="text-xs text-gray-500 hover:text-gray-800 font-medium flex items-center gap-1 transition-colors"
                                >
                                    <RotateCcw size={12} /> Reset Filters
                                </button>
                            )}
                            <button onClick={fetchTenants} className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold">
                                Refresh
                            </button>
                        </div>
                    </div>

                    {/* Search & Filter Toolbar */}
                    <div className="p-4 sm:p-5 bg-white border-b border-gray-100 flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
                        {/* Search Input */}
                        <div className="relative flex-1 max-w-md">
                            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                            <input
                                type="text"
                                value={tenantSearch}
                                onChange={(e) => setTenantSearch(e.target.value)}
                                placeholder="Search property, owner, email, hotel code, plan, UTR..."
                                className="w-full pl-10 pr-9 py-2 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500 transition-all text-gray-800 placeholder-gray-400 shadow-sm"
                            />
                            {tenantSearch && (
                                <button
                                    onClick={() => setTenantSearch("")}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-0.5 rounded-full hover:bg-gray-200"
                                >
                                    <X size={14} />
                                </button>
                            )}
                        </div>

                        {/* Status Tabs & Plan Filter */}
                        <div className="flex flex-wrap items-center gap-2">
                            {/* Status Filter Tabs */}
                            <div className="flex items-center bg-gray-100 p-1 rounded-xl text-xs font-semibold flex-wrap">
                                <button
                                    onClick={() => setTenantStatusFilter("all")}
                                    className={`px-3 py-1.5 rounded-lg transition-all ${
                                        tenantStatusFilter === "all"
                                            ? "bg-white text-gray-900 shadow-sm"
                                            : "text-gray-600 hover:text-gray-900"
                                    }`}
                                >
                                    All ({tenants.length})
                                </button>
                                <button
                                    onClick={() => setTenantStatusFilter("payment_raised")}
                                    className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
                                        tenantStatusFilter === "payment_raised"
                                            ? "bg-amber-600 text-white shadow-sm font-bold"
                                            : paymentRaisedCount > 0
                                            ? "bg-amber-100 text-amber-900 font-bold hover:bg-amber-200"
                                            : "text-amber-800 hover:text-amber-950 font-bold"
                                    }`}
                                >
                                    <CreditCard size={12} />
                                    <span>Verify Payments ({paymentRaisedCount})</span>
                                </button>
                                <button
                                    onClick={() => setTenantStatusFilter("pending")}
                                    className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
                                        tenantStatusFilter === "pending"
                                            ? "bg-amber-500 text-white shadow-sm font-bold"
                                            : "text-amber-700 hover:text-amber-900"
                                    }`}
                                >
                                    <Clock size={12} /> Pending Approval ({pendingTenantsCount})
                                </button>
                                <button
                                    onClick={() => setTenantStatusFilter("active")}
                                    className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
                                        tenantStatusFilter === "active"
                                            ? "bg-emerald-600 text-white shadow-sm font-bold"
                                            : "text-emerald-700 hover:text-emerald-900"
                                    }`}
                                >
                                    <CheckCircle size={12} /> Active ({activeTenantsCount})
                                </button>
                                <button
                                    onClick={() => setTenantStatusFilter("disabled")}
                                    className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
                                        tenantStatusFilter === "disabled"
                                            ? "bg-rose-600 text-white shadow-sm font-bold"
                                            : "text-rose-700 hover:text-rose-900"
                                    }`}
                                >
                                    <Ban size={12} /> Disabled ({disabledTenantsCount})
                                </button>
                            </div>

                            {/* Plan Filter */}
                            {uniquePlans.length > 0 && (
                                <select
                                    value={tenantPlanFilter}
                                    onChange={(e) => setTenantPlanFilter(e.target.value)}
                                    className="text-xs font-semibold text-gray-700 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500 shadow-sm cursor-pointer capitalize"
                                >
                                    <option value="all">All Plans</option>
                                    {uniquePlans.map(plan => (
                                        <option key={plan} value={plan} className="capitalize">
                                            {plan.charAt(0).toUpperCase() + plan.slice(1)} Plan
                                        </option>
                                    ))}
                                </select>
                            )}
                        </div>
                    </div>

                    {tenantsLoading ? (
                        <div className="px-6 py-10 text-center text-gray-400">Loading tenants...</div>
                    ) : tenants.length === 0 ? (
                        <div className="px-6 py-10 text-center text-gray-400">No registered properties found.</div>
                    ) : filteredTenants.length === 0 ? (
                        <div className="px-6 py-12 text-center">
                            <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center text-gray-400 mx-auto mb-3">
                                <Search size={22} />
                            </div>
                            <p className="text-sm font-bold text-gray-800">No properties matched your search</p>
                            <p className="text-xs text-gray-500 mt-1">Try refining your search keyword or clearing the status filter.</p>
                            <button
                                onClick={() => {
                                    setTenantSearch("");
                                    setTenantStatusFilter("all");
                                    setTenantPlanFilter("all");
                                }}
                                className="mt-3 px-3.5 py-1.5 text-xs font-semibold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors inline-flex items-center gap-1.5"
                            >
                                <RotateCcw size={12} /> Clear all filters
                            </button>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm text-left">
                                <thead className="bg-gray-50 text-gray-600 font-semibold border-b border-gray-100">
                                    <tr>
                                        <th className="px-5 py-4">Property / Business</th>
                                        <th className="px-5 py-4">Owner</th>
                                        <th className="px-5 py-4">Hotel Code</th>
                                        <th className="px-5 py-4">Plan</th>
                                        <th className="px-5 py-4">Payment</th>
                                        <th className="px-5 py-4">Status</th>
                                        <th className="px-5 py-4">Action</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-50">
                                    {filteredTenants.map(tenant => (
                                        <tr key={tenant.id} className={`hover:bg-gray-50/50 transition-colors ${tenant.subscription_status === 'pending_approval' ? 'bg-amber-50/30' : ''}`}>
                                            <td className="px-5 py-4">
                                                <p className="font-semibold text-gray-900">{tenant.business_name || tenant.name}</p>
                                                <p className="text-xs text-gray-400 font-mono">{tenant.slug}</p>
                                            </td>
                                            <td className="px-5 py-4">
                                                <p className="text-gray-700">{tenant.owner_name || '—'}</p>
                                                <p className="text-xs text-gray-400">{tenant.email || tenant.contact_email}</p>
                                            </td>
                                            <td className="px-5 py-4">
                                                {tenant.subscription_status === 'pending_approval' ? (
                                                    <div className="flex flex-col gap-1">
                                                        <div className="relative flex items-center">
                                                            <span className="absolute left-2.5 text-xs text-gray-400 font-mono">#</span>
                                                            <input
                                                                type="text"
                                                                value={hotelCodes[tenant.id] !== undefined ? hotelCodes[tenant.id] : (tenant.branch_code && tenant.branch_code !== 'N/A' ? tenant.branch_code : '')}
                                                                onChange={(e) => {
                                                                    const val = e.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, "");
                                                                    setHotelCodes(prev => ({ ...prev, [tenant.id]: val }));
                                                                }}
                                                                placeholder="e.g. HCC001"
                                                                className="pl-6 pr-2.5 py-1.5 w-36 text-xs font-mono font-bold tracking-wider uppercase border border-amber-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500 text-indigo-900 shadow-sm"
                                                            />
                                                        </div>
                                                        <span className="text-[10px] text-amber-700 font-medium">Enter at approval</span>
                                                    </div>
                                                ) : (
                                                    <span className="font-mono font-bold text-indigo-700 text-sm tracking-wider">{tenant.branch_code || '—'}</span>
                                                )}
                                            </td>
                                            <td className="px-5 py-4 capitalize text-gray-600">{tenant.plan_code || tenant.plan_name || 'starter'}</td>
                                            <td className="px-5 py-4">
                                                <div className="flex flex-col gap-1">
                                                    <span className="font-bold text-gray-900 text-xs">
                                                        ₹{(tenant.monthly_amount || 0).toLocaleString()} <span className="text-[10px] text-gray-400 font-normal">/ mo</span>
                                                    </span>
                                                    <div>
                                                        {tenant.payment_status === 'paid' ? (
                                                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-emerald-100 text-emerald-700 border border-emerald-200">
                                                                ✅ Paid
                                                            </span>
                                                        ) : tenant.payment_status === 'payment_raised' ? (
                                                            <div className="flex flex-col gap-0.5">
                                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-extrabold bg-amber-100 text-amber-800 border border-amber-300">
                                                                    ⚡ Payment Raised
                                                                </span>
                                                                {tenant.payment_ref && (
                                                                    <span className="text-[10px] font-mono text-gray-600 truncate max-w-[130px]" title={`UTR: ${tenant.payment_ref}`}>
                                                                        UTR: {tenant.payment_ref}
                                                                    </span>
                                                                )}
                                                            </div>
                                                        ) : (
                                                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-gray-100 text-gray-500 border border-gray-200">
                                                                ⚠️ Not Raised
                                                            </span>
                                                        )}
                                                    </div>
                                                    {tenant.expiry_date && (
                                                        <div className={`flex items-center gap-1 text-[10px] font-medium mt-0.5 ${
                                                            tenant.is_overdue
                                                                ? "text-rose-600 font-bold"
                                                                : tenant.is_due_soon
                                                                ? "text-amber-700 font-bold"
                                                                : "text-gray-500"
                                                        }`} title={`Billing Due Date: ${tenant.next_billing_date}`}>
                                                            <Calendar size={11} className="shrink-0" />
                                                            <span>Due: {tenant.expiry_date}</span>
                                                            {tenant.days_until_due !== null && tenant.days_until_due !== undefined && (
                                                                <span className="text-[9px] font-mono">
                                                                    ({tenant.is_overdue ? `${Math.abs(tenant.days_until_due)}d overdue` : tenant.days_until_due === 0 ? "Today" : `${tenant.days_until_due}d left`})
                                                                </span>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-5 py-4">
                                                {tenant.subscription_status === 'pending_approval' ? (
                                                    <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-700">
                                                        <Clock size={12} /> Pending Approval
                                                    </span>
                                                ) : tenant.is_active === false ? (
                                                    <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-700">
                                                        <Ban size={12} /> Disabled
                                                    </span>
                                                ) : (
                                                    <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-700">
                                                        <CheckCircle size={12} /> Active
                                                    </span>
                                                )}
                                            </td>
                                            <td className="px-5 py-4">
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <button
                                                        onClick={() => handleOpenEditModal(tenant)}
                                                        className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-xs font-bold rounded-lg transition-colors flex items-center gap-1.5 shadow-xs"
                                                        title="Edit property details, code, and address"
                                                    >
                                                        <Edit2 size={12} /> Edit
                                                    </button>
                                                    {tenant.payment_status === 'payment_raised' ? (
                                                        <button
                                                            onClick={() => handleAcceptPayment(tenant, 'paid')}
                                                            disabled={acceptingPaymentId === tenant.id}
                                                            className="px-3.5 py-1.5 bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 hover:from-emerald-700 hover:to-teal-700 disabled:opacity-60 text-white text-xs font-extrabold rounded-lg transition-all flex items-center gap-1.5 shadow-sm hover:shadow ring-2 ring-emerald-400/50"
                                                            title={`Accept payment of ₹${tenant.monthly_amount || 2999} (UTR: ${tenant.payment_ref || 'N/A'}) and activate property`}
                                                        >
                                                            {acceptingPaymentId === tenant.id ? (
                                                                <><Loader2 className="animate-spin" size={12} /> Confirming...</>
                                                            ) : (
                                                                <><CreditCard size={12} /> Accept Payment</>
                                                            )}
                                                        </button>
                                                    ) : tenant.payment_status === 'paid' ? (
                                                        <button
                                                            onClick={() => handleAcceptPayment(tenant, 'unpaid')}
                                                            disabled={acceptingPaymentId === tenant.id}
                                                            className="px-2.5 py-1.5 bg-gray-50 hover:bg-rose-50 text-gray-500 hover:text-rose-700 text-[11px] font-semibold rounded-lg transition-colors border border-gray-200"
                                                            title="Revert payment status to unpaid"
                                                        >
                                                            Mark Unpaid
                                                        </button>
                                                    ) : (
                                                        <button
                                                            onClick={() => handleAcceptPayment(tenant, 'paid')}
                                                            disabled={acceptingPaymentId === tenant.id}
                                                            className="px-2.5 py-1.5 bg-gray-100 hover:bg-amber-50 text-gray-400 hover:text-amber-800 border border-gray-200 hover:border-amber-300 text-xs font-semibold rounded-lg transition-all flex items-center gap-1 shadow-xs"
                                                            title="Payment not raised by property yet. Click to manually raise and accept payment on their behalf."
                                                        >
                                                            <CreditCard size={12} className="text-gray-400" />
                                                            <span className="text-[11px]">Raise &amp; Accept</span>
                                                        </button>
                                                    )}
                                                    {tenant.subscription_status === 'pending_approval' ? (
                                                        <button
                                                            onClick={() => handleApproveTenant(tenant.id)}
                                                            disabled={approvingId === tenant.id}
                                                            className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white text-xs font-bold rounded-lg transition-colors flex items-center gap-1.5 shadow-sm hover:shadow"
                                                        >
                                                            {approvingId === tenant.id ? (
                                                                <><svg className="animate-spin w-3 h-3" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg> Approving...</>
                                                            ) : (
                                                                <><CheckCircle size={13} /> Approve Property</>
                                                            )}
                                                        </button>
                                                    ) : (
                                                        <button
                                                            onClick={() => handleToggleTenantStatus(tenant)}
                                                            disabled={togglingTenantId === tenant.id}
                                                            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 shadow-sm ${
                                                                tenant.is_active === false
                                                                    ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                                                                    : "bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200"
                                                            }`}
                                                            title={tenant.is_active === false ? "Enable this property workspace" : "Disable this property workspace"}
                                                        >
                                                            {togglingTenantId === tenant.id ? (
                                                                <><svg className="animate-spin w-3 h-3" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg> Updating...</>
                                                            ) : tenant.is_active === false ? (
                                                                <><Power size={13} /> Enable Property</>
                                                            ) : (
                                                                <><Ban size={13} /> Disable Property</>
                                                            )}
                                                        </button>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </section>

                {/* Global Branches Overview */}
                <section className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                    <div className="px-6 py-5 border-b border-gray-100 bg-gray-50/50 flex flex-wrap items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                            <Building2 className="text-indigo-600" size={20} />
                            <h3 className="text-lg font-bold text-gray-800">Active Properties</h3>
                            <span className="text-xs text-gray-400 font-medium ml-2">
                                (Showing {filteredBranches.length} of {branches.length})
                            </span>
                        </div>
                        {(branchSearch || branchStatusFilter !== "all") && (
                            <button
                                onClick={() => {
                                    setBranchSearch("");
                                    setBranchStatusFilter("all");
                                }}
                                className="text-xs text-gray-500 hover:text-gray-800 font-medium flex items-center gap-1 transition-colors"
                            >
                                <RotateCcw size={12} /> Reset Filters
                            </button>
                        )}
                    </div>

                    {/* Branches Search & Filter Toolbar */}
                    <div className="p-4 sm:p-5 bg-white border-b border-gray-100 flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
                        {/* Search Input */}
                        <div className="relative flex-1 max-w-md">
                            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                            <input
                                type="text"
                                value={branchSearch}
                                onChange={(e) => setBranchSearch(e.target.value)}
                                placeholder="Search branch name, hotel code, location, GST..."
                                className="w-full pl-10 pr-9 py-2 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 transition-all text-gray-800 placeholder-gray-400 shadow-sm"
                            />
                            {branchSearch && (
                                <button
                                    onClick={() => setBranchSearch("")}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-0.5 rounded-full hover:bg-gray-200"
                                >
                                    <X size={14} />
                                </button>
                            )}
                        </div>

                        {/* Status Filter Tabs */}
                        <div className="flex items-center bg-gray-100 p-1 rounded-xl text-xs font-semibold">
                            <button
                                onClick={() => setBranchStatusFilter("all")}
                                className={`px-3 py-1.5 rounded-lg transition-all ${
                                    branchStatusFilter === "all"
                                        ? "bg-white text-gray-900 shadow-sm"
                                        : "text-gray-600 hover:text-gray-900"
                                }`}
                            >
                                All ({branches.length})
                            </button>
                            <button
                                onClick={() => setBranchStatusFilter("active")}
                                className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
                                    branchStatusFilter === "active"
                                        ? "bg-emerald-600 text-white shadow-sm font-bold"
                                        : "text-emerald-700 hover:text-emerald-900"
                                }`}
                            >
                                <CheckCircle size={12} /> Active ({activeBranchesCount})
                            </button>
                            <button
                                onClick={() => setBranchStatusFilter("disabled")}
                                className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
                                    branchStatusFilter === "disabled"
                                        ? "bg-rose-600 text-white shadow-sm font-bold"
                                        : "text-rose-700 hover:text-rose-900"
                                }`}
                            >
                                <Ban size={12} /> Disabled ({disabledBranchesCount})
                            </button>
                        </div>
                    </div>

                    {filteredBranches.length === 0 ? (
                        <div className="px-6 py-12 text-center">
                            <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center text-gray-400 mx-auto mb-3">
                                <Search size={22} />
                            </div>
                            <p className="text-sm font-bold text-gray-800">No properties matched your search</p>
                            <p className="text-xs text-gray-500 mt-1">Try adjusting your keyword or clearing the filter.</p>
                            <button
                                onClick={() => {
                                    setBranchSearch("");
                                    setBranchStatusFilter("all");
                                }}
                                className="mt-3 px-3.5 py-1.5 text-xs font-semibold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors inline-flex items-center gap-1.5"
                            >
                                <RotateCcw size={12} /> Clear search
                            </button>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm text-left">
                                <thead className="bg-gray-50 text-gray-600 font-semibold border-b border-gray-100">
                                    <tr>
                                        <th className="px-6 py-4">Branch Name</th>
                                        <th className="px-6 py-4">Hotel Code</th>
                                        <th className="px-6 py-4">Location</th>
                                        <th className="px-6 py-4">GST Number</th>
                                        <th className="px-6 py-4">Status</th>
                                        <th className="px-6 py-4">Action</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-50">
                                    {filteredBranches.map(branch => (
                                        <tr key={branch.id} className="hover:bg-gray-50/50 transition-colors">
                                            <td className="px-6 py-4 font-medium text-gray-900">{branch.name}</td>
                                            <td className="px-6 py-4">
                                                <span className="font-mono font-bold text-indigo-700 text-sm tracking-wider">{branch.code || '—'}</span>
                                            </td>
                                            <td className="px-6 py-4 text-gray-600">
                                                {renderLocationLink(branch, "N/A")}
                                            </td>
                                            <td className="px-6 py-4 text-gray-600 font-mono text-xs">{branch.gst_number || "N/A"}</td>
                                            <td className="px-6 py-4">
                                                {branch.is_active === false ? (
                                                    <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold bg-rose-100 text-rose-700">
                                                        <Ban size={11} /> Disabled
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700">
                                                        <CheckCircle size={11} /> Active
                                                    </span>
                                                )}
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-2">
                                                    <button
                                                        onClick={() => handleOpenEditModal(branch)}
                                                        className="px-3 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-xs font-bold rounded-lg transition-colors flex items-center gap-1.5 shadow-sm"
                                                        title="Edit property details, code, and address"
                                                    >
                                                        <Edit2 size={12} /> Edit
                                                    </button>
                                                    <button
                                                        onClick={() => handleToggleBranchStatus(branch)}
                                                        disabled={togglingBranchId === branch.id}
                                                        className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5 ${
                                                            branch.is_active === false
                                                                ? "bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200"
                                                                : "bg-gray-50 hover:bg-rose-50 text-gray-700 hover:text-rose-700 border border-gray-200 hover:border-rose-200"
                                                        }`}
                                                        title={branch.is_active === false ? "Enable this branch" : "Disable this branch"}
                                                    >
                                                        {togglingBranchId === branch.id ? (
                                                            <svg className="animate-spin w-3 h-3" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg>
                                                        ) : branch.is_active === false ? (
                                                            <><Power size={12} /> Enable</>
                                                        ) : (
                                                            <><Ban size={12} /> Disable</>
                                                        )}
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </section>

                {/* Edit Property Details Modal */}
                {isEditModalOpen && (
                    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
                        <div className="bg-white rounded-2xl max-w-3xl w-full p-6 sm:p-8 shadow-2xl relative my-8 animate-in fade-in zoom-in duration-200 max-h-[92vh] overflow-y-auto border border-gray-100">
                            {/* Modal Header */}
                            <div className="flex items-center justify-between border-b border-gray-100 pb-5 mb-6">
                                <div>
                                    <h2 className="text-xl sm:text-2xl font-black text-gray-900 flex items-center gap-2.5">
                                        <div className="w-9 h-9 rounded-xl bg-indigo-50 border border-indigo-100 text-indigo-600 flex items-center justify-center">
                                            <Edit2 size={18} />
                                        </div>
                                        Edit Property Details
                                    </h2>
                                    <p className="text-xs text-gray-500 mt-1 font-medium">
                                        Update property configuration, hotel sync code, and contact information
                                    </p>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setIsEditModalOpen(false)}
                                    className="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-xl transition-all"
                                >
                                    <X size={20} />
                                </button>
                            </div>

                            <form onSubmit={handleSubmitEdit} className="space-y-6">
                                {/* Banner / Profile Image */}
                                <div>
                                    <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">
                                        Property Banner Image
                                    </label>
                                    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5 p-4 rounded-xl bg-gray-50 border border-gray-200">
                                        <div className="h-28 w-44 rounded-xl border-2 border-dashed border-gray-300 bg-white overflow-hidden flex items-center justify-center relative group flex-shrink-0 shadow-inner">
                                            {editImagePreview ? (
                                                <img
                                                    src={editImagePreview}
                                                    alt="Property Banner"
                                                    className="w-full h-full object-cover"
                                                />
                                            ) : (
                                                <Building2 className="text-gray-300" size={36} />
                                            )}
                                            <label className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer text-white text-xs font-bold gap-1">
                                                <Camera size={14} /> Change
                                                <input
                                                    type="file"
                                                    className="hidden"
                                                    onChange={handleEditImageChange}
                                                    accept="image/*"
                                                />
                                            </label>
                                        </div>
                                        <div className="flex-1 text-xs text-gray-500">
                                            <p className="font-bold text-gray-800 text-sm mb-0.5">High-resolution banner</p>
                                            <p className="text-gray-500">Recommended 1200x600px (JPG, PNG, or WEBP)</p>
                                            <label className="mt-2.5 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-600 font-bold cursor-pointer transition-colors border border-indigo-200 text-xs">
                                                <Upload size={12} /> Choose Image
                                                <input
                                                    type="file"
                                                    className="hidden"
                                                    onChange={handleEditImageChange}
                                                    accept="image/*"
                                                />
                                            </label>
                                        </div>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                    {/* Basic Info */}
                                    <div className="space-y-4">
                                        <h3 className="text-xs font-bold text-indigo-600 uppercase tracking-wider flex items-center gap-1.5">
                                            <Building2 size={14} /> Core Information
                                        </h3>
                                        <div>
                                            <label className="block text-xs font-bold text-gray-600 mb-1">
                                                Property Name <span className="text-rose-500">*</span>
                                            </label>
                                            <input
                                                type="text"
                                                required
                                                value={editFormData.name}
                                                onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
                                                className="w-full px-3.5 py-2 text-sm border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 outline-none transition-all"
                                                placeholder="e.g. Stayone Wild Villa"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-gray-600 mb-1">
                                                Hotel / Branch Code <span className="text-rose-500">*</span>
                                            </label>
                                            <div className="relative">
                                                <Hash className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
                                                <input
                                                    type="text"
                                                    required
                                                    value={editFormData.code}
                                                    onChange={(e) => setEditFormData({ ...editFormData, code: e.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, "") })}
                                                    className="w-full pl-8 pr-3.5 py-2 text-sm font-mono font-bold uppercase tracking-wider border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 outline-none transition-all text-indigo-950"
                                                    placeholder="e.g. PBR, GML, SWV"
                                                />
                                            </div>
                                            <p className="text-[11px] text-gray-400 mt-1">
                                                Required for OTA Channel Manager synchronization.
                                            </p>
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-gray-600 mb-1">Location</label>
                                            <input
                                                type="text"
                                                value={editFormData.location}
                                                onChange={(e) => setEditFormData({ ...editFormData, location: e.target.value })}
                                                className="w-full px-3.5 py-2 text-sm border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 outline-none transition-all"
                                                placeholder="e.g. Sultan Bathery, Wayanad"
                                            />
                                        </div>
                                    </div>

                                    {/* Contact Details */}
                                    <div className="space-y-4">
                                        <h3 className="text-xs font-bold text-indigo-600 uppercase tracking-wider flex items-center gap-1.5">
                                            <Users size={14} /> Contact Information
                                        </h3>
                                        <div>
                                            <label className="block text-xs font-bold text-gray-600 mb-1">Contact Phone</label>
                                            <input
                                                type="text"
                                                value={editFormData.phone}
                                                onChange={(e) => setEditFormData({ ...editFormData, phone: e.target.value })}
                                                className="w-full px-3.5 py-2 text-sm border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 outline-none transition-all"
                                                placeholder="+91 98765 43210"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-gray-600 mb-1">Contact Email</label>
                                            <input
                                                type="email"
                                                value={editFormData.email}
                                                onChange={(e) => setEditFormData({ ...editFormData, email: e.target.value })}
                                                className="w-full px-3.5 py-2 text-sm border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 outline-none transition-all"
                                                placeholder="resort@stayone.com"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-gray-600 mb-1">GST Registration No.</label>
                                            <input
                                                type="text"
                                                value={editFormData.gst_number}
                                                onChange={(e) => setEditFormData({ ...editFormData, gst_number: e.target.value.toUpperCase() })}
                                                className="w-full px-3.5 py-2 text-sm font-mono border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 outline-none transition-all"
                                                placeholder="e.g. 32BLUPS54887K1Z1"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-gray-600 mb-1 flex items-center justify-between">
                                                <span>Admin Account Password</span>
                                                <span className="text-[10px] text-gray-400 font-normal">Leave blank to keep unchanged</span>
                                            </label>
                                            <div className="relative">
                                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                                                    <Lock size={15} />
                                                </div>
                                                <input
                                                    type={showEditPassword ? "text" : "password"}
                                                    value={editFormData.password || ''}
                                                    onChange={(e) => setEditFormData({ ...editFormData, password: e.target.value })}
                                                    className="w-full pl-9 pr-10 py-2 text-sm border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 outline-none transition-all placeholder:text-gray-400"
                                                    placeholder="Enter new admin password"
                                                    autoComplete="new-password"
                                                />
                                                <button
                                                    type="button"
                                                    onClick={() => setShowEditPassword(!showEditPassword)}
                                                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 focus:outline-none"
                                                    tabIndex={-1}
                                                >
                                                    {showEditPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                                                </button>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Subscription & Payment Status */}
                                    <div className="col-span-1 md:col-span-2 space-y-3 pt-3 border-t border-gray-100">
                                        <h3 className="text-xs font-bold text-indigo-600 uppercase tracking-wider flex items-center gap-1.5">
                                            <CreditCard size={14} /> Subscription &amp; Payment Status
                                        </h3>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                            <div>
                                                <label className="block text-xs font-bold text-gray-600 mb-1">Payment Status</label>
                                                <select
                                                    value={editFormData.payment_status}
                                                    onChange={(e) => setEditFormData({ ...editFormData, payment_status: e.target.value })}
                                                    className="w-full px-3.5 py-2 text-sm border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 outline-none transition-all font-semibold"
                                                >
                                                    <option value="paid">✅ Paid (Active Subscription)</option>
                                                    <option value="unpaid">⚠️ Unpaid / Due</option>
                                                    <option value="overdue">❌ Overdue</option>
                                                </select>
                                            </div>
                                            <div>
                                                <label className="block text-xs font-bold text-gray-600 mb-1">Monthly Subscription Fee (₹)</label>
                                                <input
                                                    type="number"
                                                    value={editFormData.monthly_amount}
                                                    onChange={(e) => setEditFormData({ ...editFormData, monthly_amount: parseFloat(e.target.value) || 0 })}
                                                    className="w-full px-3.5 py-2 text-sm border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 outline-none transition-all font-bold"
                                                    placeholder="2500"
                                                />
                                            </div>
                                            <div className="col-span-1 sm:col-span-2">
                                                <div className="flex items-center justify-between mb-1">
                                                    <label className="block text-xs font-bold text-gray-600">
                                                        Subscription Due Date (Next Billing Cycle)
                                                    </label>
                                                    <div className="flex items-center gap-1.5 text-[11px]">
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                const tmrw = new Date();
                                                                tmrw.setDate(tmrw.getDate() + 1);
                                                                setEditFormData(prev => ({ ...prev, next_billing_date: tmrw.toISOString().split('T')[0] }));
                                                            }}
                                                            className="px-2 py-0.5 font-bold text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-md transition-colors"
                                                        >
                                                            Tomorrow
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                const today = new Date();
                                                                setEditFormData(prev => ({ ...prev, next_billing_date: today.toISOString().split('T')[0] }));
                                                            }}
                                                            className="px-2 py-0.5 font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-md transition-colors"
                                                        >
                                                            Today
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                const in30 = new Date();
                                                                in30.setDate(in30.getDate() + 30);
                                                                setEditFormData(prev => ({ ...prev, next_billing_date: in30.toISOString().split('T')[0] }));
                                                            }}
                                                            className="px-2 py-0.5 font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-md transition-colors"
                                                        >
                                                            +30 Days
                                                        </button>
                                                    </div>
                                                </div>
                                                <input
                                                    type="date"
                                                    value={editFormData.next_billing_date || ''}
                                                    onChange={(e) => setEditFormData({ ...editFormData, next_billing_date: e.target.value })}
                                                    className="w-full px-3.5 py-2 text-sm border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 outline-none transition-all font-mono font-medium text-gray-800"
                                                />
                                                <p className="text-[11px] text-gray-400 mt-1">
                                                    Changing this date updates the countdown banner, overdue alerts, and billing renewal timing for the property.
                                                </p>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Full Address */}
                                    <div className="col-span-1 md:col-span-2">
                                        <label className="block text-xs font-bold text-gray-600 mb-1">Full Property Address / Google Maps Link</label>
                                        <textarea
                                            value={editFormData.address}
                                            onChange={(e) => setEditFormData({ ...editFormData, address: e.target.value })}
                                            className="w-full px-3.5 py-2 text-sm border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 outline-none transition-all"
                                            rows="2"
                                            placeholder="Karapothadi, Kulukunnu, Sultan Bathery, near Thottamoola, Kerala 673595 or Google Maps link"
                                        />
                                    </div>

                                    {/* Social Links */}
                                    <div className="col-span-1 md:col-span-2 space-y-3 pt-2 border-t border-gray-100">
                                        <h3 className="text-xs font-bold text-indigo-600 uppercase tracking-wider">Social Links (Optional)</h3>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                                            <div>
                                                <label className="block text-[11px] font-semibold text-gray-500 mb-1">Facebook</label>
                                                <input
                                                    type="text"
                                                    value={editFormData.facebook}
                                                    onChange={(e) => setEditFormData({ ...editFormData, facebook: e.target.value })}
                                                    className="w-full px-3 py-1.5 text-xs border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500/30 outline-none"
                                                    placeholder="Profile URL"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-[11px] font-semibold text-gray-500 mb-1">Instagram</label>
                                                <input
                                                    type="text"
                                                    value={editFormData.instagram}
                                                    onChange={(e) => setEditFormData({ ...editFormData, instagram: e.target.value })}
                                                    className="w-full px-3 py-1.5 text-xs border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500/30 outline-none"
                                                    placeholder="Profile or @handle"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-[11px] font-semibold text-gray-500 mb-1">Twitter / X</label>
                                                <input
                                                    type="text"
                                                    value={editFormData.twitter}
                                                    onChange={(e) => setEditFormData({ ...editFormData, twitter: e.target.value })}
                                                    className="w-full px-3 py-1.5 text-xs border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500/30 outline-none"
                                                    placeholder="Profile or @handle"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-[11px] font-semibold text-gray-500 mb-1">LinkedIn</label>
                                                <input
                                                    type="text"
                                                    value={editFormData.linkedin}
                                                    onChange={(e) => setEditFormData({ ...editFormData, linkedin: e.target.value })}
                                                    className="w-full px-3 py-1.5 text-xs border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500/30 outline-none"
                                                    placeholder="Profile URL"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Modal Actions */}
                                <div className="flex items-center justify-end gap-3 pt-5 border-t border-gray-100">
                                    <button
                                        type="button"
                                        onClick={() => setIsEditModalOpen(false)}
                                        disabled={isSubmittingEdit}
                                        className="px-5 py-2.5 text-gray-600 hover:bg-gray-100 rounded-xl font-bold text-sm transition-all disabled:opacity-50"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={isSubmittingEdit}
                                        className="px-7 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white rounded-xl hover:shadow-lg transition-all font-bold text-sm flex items-center justify-center gap-2 shadow-md disabled:opacity-70"
                                    >
                                        {isSubmittingEdit ? (
                                            <>
                                                <Loader2 className="animate-spin" size={16} />
                                                Saving...
                                            </>
                                        ) : (
                                            <>
                                                <CheckCircle size={16} />
                                                Save Changes
                                            </>
                                        )}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}

                {/* Edit SaaS Plan Modal */}
                {isPlanModalOpen && editingPlan && (
                    <div className="fixed inset-0 z-[150] bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
                        <div className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full max-h-[92vh] overflow-y-auto border border-gray-100 p-6 md:p-8">
                            <div className="flex items-center justify-between pb-4 border-b border-gray-100">
                                <div className="flex items-center gap-3">
                                    <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl shadow-xs">
                                        <Layers size={22} />
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <h3 className="text-lg font-bold text-gray-900">Edit {editingPlan.name}</h3>
                                            <span className="text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded-md bg-indigo-100 text-indigo-800">
                                                {editingPlan.code}
                                            </span>
                                        </div>
                                        <p className="text-xs text-gray-500 mt-0.5">
                                            Modify pricing, room and user quotas, features, and marketing badges
                                        </p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => setIsPlanModalOpen(false)}
                                    className="p-2 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100 transition-colors"
                                >
                                    <X size={18} />
                                </button>
                            </div>

                            <form onSubmit={handleSavePlan} className="space-y-5 pt-5">
                                {/* Plan Name & Code */}
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                    <div className="sm:col-span-2">
                                        <label className="block text-xs font-bold text-gray-700 mb-1">Plan Display Name *</label>
                                        <input
                                            type="text"
                                            required
                                            value={planFormData.name}
                                            onChange={(e) => setPlanFormData({ ...planFormData, name: e.target.value })}
                                            className="w-full px-3.5 py-2 text-sm border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 outline-none transition-all font-semibold"
                                            placeholder="e.g. Starter Plan"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-gray-700 mb-1">System Code</label>
                                        <div className="relative">
                                            <input
                                                type="text"
                                                disabled
                                                value={planFormData.code}
                                                className="w-full pl-8 pr-3 py-2 text-sm border border-gray-200 rounded-xl bg-gray-50 text-gray-500 font-mono font-bold uppercase cursor-not-allowed"
                                            />
                                            <Lock className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
                                        </div>
                                    </div>
                                </div>

                                {/* Pricing */}
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded-2xl bg-slate-50 border border-slate-100">
                                    <div>
                                        <label className="block text-xs font-bold text-gray-700 mb-1">Monthly Subscription Fee (₹) *</label>
                                        <div className="relative">
                                            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 font-bold">₹</span>
                                            <input
                                                type="number"
                                                min="0"
                                                step="1"
                                                required
                                                value={planFormData.price_monthly}
                                                onChange={(e) => setPlanFormData({ ...planFormData, price_monthly: e.target.value })}
                                                className="w-full pl-8 pr-3.5 py-2 text-sm border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 outline-none transition-all font-black text-gray-900 bg-white"
                                                placeholder="2500"
                                            />
                                        </div>
                                        <span className="text-[10px] text-gray-400 mt-1 block">Set 0 for Custom / Free plans</span>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-gray-700 mb-1">Yearly Subscription Fee (₹)</label>
                                        <div className="relative">
                                            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 font-bold">₹</span>
                                            <input
                                                type="number"
                                                min="0"
                                                step="1"
                                                value={planFormData.price_yearly}
                                                onChange={(e) => setPlanFormData({ ...planFormData, price_yearly: e.target.value })}
                                                className="w-full pl-8 pr-3.5 py-2 text-sm border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 outline-none transition-all font-black text-gray-900 bg-white"
                                                placeholder="25000"
                                            />
                                        </div>
                                        <span className="text-[10px] text-gray-400 mt-1 block">Optional discounted annual billing</span>
                                    </div>
                                </div>

                                {/* Quotas / Limits */}
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                    <div>
                                        <label className="block text-xs font-bold text-gray-700 mb-1">Max Rooms Limit</label>
                                        <input
                                            type="number"
                                            min="1"
                                            value={planFormData.max_rooms}
                                            onChange={(e) => setPlanFormData({ ...planFormData, max_rooms: e.target.value })}
                                            className="w-full px-3.5 py-2 text-sm border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 outline-none transition-all font-semibold"
                                            placeholder="15"
                                        />
                                        <span className="text-[10px] text-gray-400 mt-0.5 block">Use 999 for unlimited</span>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-gray-700 mb-1">Max Branches</label>
                                        <input
                                            type="number"
                                            min="1"
                                            value={planFormData.max_branches}
                                            onChange={(e) => setPlanFormData({ ...planFormData, max_branches: e.target.value })}
                                            className="w-full px-3.5 py-2 text-sm border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 outline-none transition-all font-semibold"
                                            placeholder="1"
                                        />
                                        <span className="text-[10px] text-gray-400 mt-0.5 block">Use 99 for chain networks</span>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-gray-700 mb-1">Staff User Accounts</label>
                                        <input
                                            type="number"
                                            min="1"
                                            value={planFormData.max_staff_users}
                                            onChange={(e) => setPlanFormData({ ...planFormData, max_staff_users: e.target.value })}
                                            className="w-full px-3.5 py-2 text-sm border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 outline-none transition-all font-semibold"
                                            placeholder="5"
                                        />
                                        <span className="text-[10px] text-gray-400 mt-0.5 block">Use 999 for unlimited</span>
                                    </div>
                                </div>

                                {/* Marketing Badge & Tagline */}
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-bold text-gray-700 mb-1">Badge / Ribbon Text</label>
                                        <input
                                            type="text"
                                            value={planFormData.badge}
                                            onChange={(e) => setPlanFormData({ ...planFormData, badge: e.target.value })}
                                            className="w-full px-3.5 py-2 text-sm border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 outline-none transition-all"
                                            placeholder="e.g. 10-15 Rooms, Most Popular, Unlimited"
                                        />
                                        <span className="text-[10px] text-gray-400 mt-0.5 block">Highlight pill shown above or beside card</span>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-gray-700 mb-1">Tagline / Short Description</label>
                                        <input
                                            type="text"
                                            value={planFormData.description}
                                            onChange={(e) => setPlanFormData({ ...planFormData, description: e.target.value })}
                                            className="w-full px-3.5 py-2 text-sm border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 outline-none transition-all"
                                            placeholder="e.g. Ideal for boutique resorts and homestays"
                                        />
                                    </div>
                                </div>

                                {/* Features List */}
                                <div>
                                    <div className="flex items-center justify-between mb-1">
                                        <label className="block text-xs font-bold text-gray-700">Plan Features &amp; Inclusions</label>
                                        <span className="text-[11px] text-indigo-600 font-semibold">1 feature bullet per line</span>
                                    </div>
                                    <textarea
                                        rows={5}
                                        value={planFormData.features}
                                        onChange={(e) => setPlanFormData({ ...planFormData, features: e.target.value })}
                                        className="w-full px-3.5 py-2.5 text-xs font-mono border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 outline-none transition-all"
                                        placeholder="Up to 15 Rooms Management&#10;Unlimited Guest Bookings &amp; Check-ins&#10;POS &amp; Food Order System&#10;QR Digital Menu for Guests&#10;WhatsApp Payment Support"
                                    />
                                    <p className="text-[11px] text-gray-400 mt-1">
                                        Enter each feature on a separate line. Properties will see these bullet points on their subscription page.
                                    </p>
                                </div>

                                {/* Toggles */}
                                <div className="space-y-2 pt-2 border-t border-gray-100">
                                    <label className="flex items-center gap-2.5 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={planFormData.is_active}
                                            onChange={(e) => setPlanFormData({ ...planFormData, is_active: e.target.checked })}
                                            className="w-4 h-4 text-indigo-600 rounded-md border-gray-300 focus:ring-indigo-500"
                                        />
                                        <span className="text-xs font-bold text-gray-700">Plan is Active &amp; Available for Properties</span>
                                    </label>

                                    <label className="flex items-center gap-2.5 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={planFormData.update_existing_tenants}
                                            onChange={(e) => setPlanFormData({ ...planFormData, update_existing_tenants: e.target.checked })}
                                            className="w-4 h-4 text-indigo-600 rounded-md border-gray-300 focus:ring-indigo-500"
                                        />
                                        <span className="text-xs font-medium text-gray-600">
                                            Also update monthly billing fee for current properties subscribed to this plan
                                        </span>
                                    </label>
                                </div>

                                {/* Actions */}
                                <div className="flex items-center justify-between gap-3 pt-5 border-t border-gray-100">
                                    <button
                                        type="button"
                                        onClick={() => handleDeletePlan(editingPlan)}
                                        disabled={savingPlan || deletingPlanId === editingPlan?.id}
                                        className="px-4 py-2.5 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-xs sm:text-sm rounded-xl border border-rose-200 transition-all flex items-center gap-1.5 disabled:opacity-50"
                                    >
                                        {deletingPlanId === editingPlan?.id ? (
                                            <>
                                                <Loader2 className="animate-spin" size={16} />
                                                Deleting Plan...
                                            </>
                                        ) : (
                                            <>
                                                <Trash2 size={16} />
                                                Delete Plan
                                            </>
                                        )}
                                    </button>

                                    <div className="flex items-center gap-3">
                                        <button
                                            type="button"
                                            onClick={() => setIsPlanModalOpen(false)}
                                            disabled={savingPlan || deletingPlanId === editingPlan?.id}
                                            className="px-5 py-2.5 text-gray-600 hover:bg-gray-100 rounded-xl font-bold text-sm transition-all disabled:opacity-50"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            type="submit"
                                            disabled={savingPlan || deletingPlanId === editingPlan?.id}
                                            className="px-7 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white rounded-xl hover:shadow-lg transition-all font-bold text-sm flex items-center justify-center gap-2 shadow-md disabled:opacity-70"
                                        >
                                            {savingPlan ? (
                                                <>
                                                    <Loader2 className="animate-spin" size={16} />
                                                    Saving Plan...
                                                </>
                                            ) : (
                                                <>
                                                    <CheckCircle size={16} />
                                                    Save Plan
                                                </>
                                            )}
                                        </button>
                                    </div>
                                </div>
                            </form>
                        </div>
                    </div>
                )}

                {/* State-of-the-Art Luxury Confirmation & Action Modal */}
                {dialogState.isOpen && (
                    <div className="fixed inset-0 z-[250] flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-md animate-in fade-in duration-200">
                        <div className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl border border-gray-100 p-6 sm:p-7 overflow-hidden text-center transform transition-all animate-in zoom-in-95 duration-200">
                            {/* Top decorative gradient bar */}
                            <div className={`absolute top-0 left-0 right-0 h-2 bg-gradient-to-r ${
                                dialogState.type === 'danger'
                                    ? 'from-rose-500 via-red-500 to-orange-500'
                                    : dialogState.type === 'warning'
                                    ? 'from-amber-400 via-orange-500 to-yellow-500'
                                    : dialogState.type === 'info'
                                    ? 'from-indigo-500 via-blue-500 to-cyan-500'
                                    : 'from-emerald-400 via-teal-500 to-cyan-500'
                            }`} />

                            {/* Glowing Icon Container */}
                            <div className="flex justify-center mb-4 mt-2">
                                <div className={`p-4 rounded-2xl shadow-inner relative flex items-center justify-center ${
                                    dialogState.type === 'danger'
                                        ? 'bg-rose-50 text-rose-600 border border-rose-100 ring-8 ring-rose-50/50'
                                        : dialogState.type === 'warning'
                                        ? 'bg-amber-50 text-amber-600 border border-amber-100 ring-8 ring-amber-50/50'
                                        : dialogState.type === 'info'
                                        ? 'bg-indigo-50 text-indigo-600 border border-indigo-100 ring-8 ring-indigo-50/50'
                                        : 'bg-emerald-50 text-emerald-600 border border-emerald-100 ring-8 ring-emerald-50/50'
                                }`}>
                                    {dialogState.type === 'danger' ? (
                                        <Trash2 size={36} className="text-rose-600" />
                                    ) : dialogState.type === 'warning' ? (
                                        <AlertTriangle size={36} className="text-amber-600" />
                                    ) : dialogState.type === 'info' ? (
                                        <CreditCard size={36} className="text-indigo-600" />
                                    ) : (
                                        <CheckCircle2 size={36} className="text-emerald-600" />
                                    )}
                                </div>
                            </div>

                            {/* Title */}
                            <h3 className="text-xl font-extrabold text-gray-900 tracking-tight mb-2">
                                {dialogState.title}
                            </h3>

                            {/* Message Body */}
                            <div className="text-sm text-gray-600 leading-relaxed mb-6 whitespace-pre-line text-left bg-gray-50/80 p-4 rounded-2xl border border-gray-100 font-medium">
                                {dialogState.message}
                            </div>

                            {/* If Prompt Input */}
                            {dialogState.isPrompt && (
                                <div className="mb-6 text-left">
                                    <label className="block text-xs font-bold text-gray-700 mb-1.5">
                                        {dialogState.inputLabel || "Input"}
                                    </label>
                                    <input
                                        type="text"
                                        value={dialogState.inputValue}
                                        onChange={(e) => setDialogState(prev => ({ ...prev, inputValue: e.target.value }))}
                                        placeholder={dialogState.inputPlaceholder}
                                        className="w-full px-4 py-2.5 text-sm border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all font-mono"
                                        autoFocus
                                    />
                                </div>
                            )}

                            {/* Action Buttons */}
                            <div className={`flex gap-3 ${dialogState.isConfirm ? 'justify-end' : 'justify-center'}`}>
                                {dialogState.isConfirm && (
                                    <button
                                        type="button"
                                        onClick={() => {
                                            if (dialogState.onCancel) dialogState.onCancel();
                                            setDialogState(prev => ({ ...prev, isOpen: false }));
                                        }}
                                        className="flex-1 px-5 py-2.5 rounded-xl border border-gray-200 text-gray-700 font-semibold hover:bg-gray-100 transition-all text-sm"
                                    >
                                        {dialogState.cancelText || 'Cancel'}
                                    </button>
                                )}
                                <button
                                    type="button"
                                    onClick={() => {
                                        const val = dialogState.inputValue;
                                        if (dialogState.onConfirm) {
                                            dialogState.onConfirm(val);
                                        } else {
                                            setDialogState(prev => ({ ...prev, isOpen: false }));
                                        }
                                    }}
                                    className={`px-6 py-2.5 rounded-xl font-bold text-sm shadow-md transition-all ${
                                        dialogState.isConfirm ? 'flex-1' : 'w-full'
                                    } ${
                                        dialogState.type === 'danger'
                                            ? 'bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-700 hover:to-red-700 text-white shadow-rose-200'
                                            : dialogState.type === 'warning'
                                            ? 'bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white shadow-amber-200'
                                            : dialogState.type === 'info'
                                            ? 'bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white shadow-indigo-200'
                                            : 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white shadow-emerald-200'
                                    }`}
                                >
                                    {dialogState.confirmText || (dialogState.isConfirm ? 'Confirm' : 'Got it')}
                                </button>
                            </div>
                        </div>
                    </div>
                )}

            </div>
        </DashboardLayout>
    );
}
