import { useState, useEffect, useRef, Fragment } from "react"; // HMR Force Update
import { Link, useLocation, Navigate } from "react-router-dom";
import { AnimatePresence, motion, m } from "framer-motion";
import {
  Home,
  Users,
  BedDouble,
  CalendarCheck2,
  CalendarCheck,
  ConciergeBell,
  Settings,
  Menu,
  LogOut,
  Package,
  UserCircle,
  Utensils,
  ShieldCheck,
  PiggyBank,
  Grid,
  ChefHat,
  Receipt,
  Globe,
  Briefcase,
  Sun,
  Warehouse,
  Activity,
} from "lucide-react";
import { jwtDecode } from "jwt-decode";
import stayoneLogo from "../assets/stayonelogo.png";
import { NotificationBell } from "../contexts/NotificationContext";
import { useBranch } from "../contexts/BranchContext";
import { Building2, ChevronDown } from "lucide-react";
import { usePermissions } from "../hooks/usePermissions";

import { CreditCard, AlertCircle, Copy, Check, MessageSquare, Zap, ArrowUpRight, Clock, Calendar, CheckCircle2 } from "lucide-react";
import api from "../services/api";

// Define professional, high-end themes with a focus on harmony and readability.
const stayoneThemeConfig = {
  '--bg-primary': '#faf8f5', // Soft cream/ivory background
  '--bg-secondary': '#ffffff',
  '--text-primary': '#2d3748', // Deep charcoal
  '--text-secondary': '#718096', // Medium gray
  '--accent-bg': '#e8f5e9', // Light stayone green
  '--accent-text': '#2d5016', // Deep forest green
  '--bubble-color': 'rgba(139, 195, 74, 0.25)', // Soft stayone green bubbles
  '--primary-button': '#8bc34a', // Fresh stayone green
  '--primary-button-hover': '#7cb342', // Darker stayone green
  '--border-color': '#c5e1a5', // Light stayone green border
};

const themes = {
  'eco-friendly': {
    '--bg-primary': '#f0f7f4', // Soft mint green background
    '--bg-secondary': '#ffffff',
    '--text-primary': '#1a4d3a', // Deep forest green text
    '--text-secondary': '#5a7c6a', // Muted green-gray
    '--accent-bg': '#c8e6d5', // Light sage green accent (slightly more vibrant)
    '--accent-text': '#2d6a4f', // Medium green for active items
    '--bubble-color': 'rgba(76, 175, 80, 0.3)', // Soft green bubbles
    '--primary-button': '#22c55e', // Green for primary actions
    '--primary-button-hover': '#16a34a', // Darker green on hover
    '--border-color': '#a7d4b8', // Light green borders
  },
  'platinum': {
    '--bg-primary': '#f4f7f9',
    '--bg-secondary': '#ffffff',
    '--text-primary': '#2c3e50',
    '--text-secondary': '#7f8c8d',
    '--accent-bg': '#e7edf1', // A light, clean accent
    '--accent-text': '#34495e',
    '--bubble-color': 'rgba(175, 215, 255, 0.4)', // Soft blue bubbles
    '--primary-button': '#6366f1',
    '--primary-button-hover': '#4f46e5',
    '--border-color': '#e2e8f0',
  },
  'onyx': {
    '--bg-primary': '#1c1c1c',
    '--bg-secondary': '#2b2b2b',
    '--text-primary': '#ecf0f1',
    '--text-secondary': '#bdc3c7',
    '--accent-bg': '#34495e', // A deep blue-gray accent
    '--accent-text': '#f1c40f',
    '--bubble-color': 'rgba(255, 223, 186, 0.2)', // Faint gold bubbles
    '--primary-button': '#f1c40f',
    '--primary-button-hover': '#f39c12',
    '--border-color': '#34495e',
  },
  'gilded-age': {
    '--bg-primary': '#fdf8f0', // A warm, off-white
    '--bg-secondary': '#ffffff',
    '--text-primary': '#4a4a4a',
    '--text-secondary': '#8b7c6c',
    '--accent-bg': '#f5ecde',
    '--accent-text': '#4a4a4a',
    '--bubble-color': 'rgba(212, 172, 97, 0.3)',
    '--primary-button': '#d4ac61',
    '--primary-button-hover': '#b8945f',
    '--border-color': '#e8dcc6',
  },
  'stayone-signature': stayoneThemeConfig,
};

// Helper function to apply the theme's CSS variables to the document root
const applyTheme = (themeName) => {
  const selectedTheme = themes[themeName];
  if (selectedTheme) {
    Object.keys(selectedTheme).forEach(key => {
      document.documentElement.style.setProperty(key, selectedTheme[key]);
    });
    // Set data attribute for theme-specific styling
    document.documentElement.setAttribute('data-theme', themeName);
    localStorage.setItem('dashboard-theme', themeName);
  }
};

// Map routes to internal module IDs
const routeToModuleMap = {
  "/dashboard": "dashboard",
  "/account": ["account", "finance"],
  "/bookings": "bookings",
  "/rooms": "rooms",
  "/services": ["services", "concierge"],
  "/food-orders": "food_orders",
  "/food-orders/orders": "food_orders_list",
  "/food-orders/requests": "food_orders_requests",
  "/food-orders/management": "food_orders_management",
  "/expenses": "expenses",
  "/employee-management": ["employee_management", "employees"],
  "/inventory": ["inventory", "warehouse"],
  "/day-audit": ["day_audit", "settings_group"],
  "/settings": ["settings_group", "settings"],
  "/roles": "roles",
  "/branch-management": ["settings_group", "branches"],
  "/activity-logs": ["settings_group", "activity_logs"],
  "/guestprofiles": ["guest_profiles", "guests"],
  "/billing": "billing",
  "/subscription": ["billing", "subscription", "settings", "dashboard"],
  "/package": ["packages", "promotions"],
  "/Userfrontend_data": ["web_management", "website"],
  "/report": ["reports_global", "reports"]
};

export const ProtectedRoute = ({ children, requiredPermission, superAdminOnly = false }) => {
  const { isSuperadmin: isSuper, isBranchAdmin, hasModuleAccess, permissions } = usePermissions();

  if (superAdminOnly && !isSuper) {
    return <Navigate to="/dashboard" replace />;
  }

  const hasAccess = isSuper || isBranchAdmin || (requiredPermission ? hasModuleAccess(routeToModuleMap[requiredPermission] || requiredPermission) : true);

  if (!hasAccess) {
    return <div className="flex items-center justify-center h-screen text-red-600 font-bold text-xl">Access Denied: Insufficient Privileges</div>;
  }

  return <>{children}</>;
};

export default function DashboardLayout({ children }) {
  const [collapsed, setCollapsed] = useState(false);
  const location = useLocation();
  const [currentTheme, setCurrentTheme] = useState('stayone-signature'); // Default theme - stayone-signature

  const navRef = useRef(null);

  // Load theme from localStorage on initial render
  useEffect(() => {
    const savedTheme = localStorage.getItem('dashboard-theme');
    if (savedTheme && themes[savedTheme]) {
      setCurrentTheme(savedTheme);
      applyTheme(savedTheme);
    } else {
      // Set stayone-signature as default theme
      setCurrentTheme('stayone-signature');
      applyTheme('stayone-signature');
    }
  }, []);


  // Effect to create and manage the animated bubble background
  useEffect(() => {
    const bubbleContainer = document.getElementById('bubble-background');
    if (!bubbleContainer) return;
    bubbleContainer.innerHTML = ''; // Clear existing bubbles on theme change

    const createBubble = () => {
      const bubble = document.createElement('span');
      const size = Math.random() * 60 + 20; // Bubble size between 20px and 80px
      const animationDuration = Math.random() * 10 + 10; // Duration between 10s and 20s
      const delay = Math.random() * 5; // Start delay up to 5s
      const left = Math.random() * 100; // Horizontal start position

      bubble.style.width = `${size}px`;
      bubble.style.height = `${size}px`;
      bubble.style.left = `${left}%`;
      bubble.style.animationDuration = `${animationDuration}s`;
      bubble.style.animationDelay = `${delay}s`;
      bubble.style.backgroundColor = `var(--bubble-color)`; // Use theme color

      bubble.classList.add('bubble');
      bubbleContainer.appendChild(bubble);
    };

    for (let i = 0; i < 30; i++) { // Create 30 bubbles
      createBubble();
    }
  }, [currentTheme]);


  const { role, permissions, user, isSuperadmin: isSuper, isBranchAdmin, hasModuleAccess } = usePermissions();
  // Sync activeBranchId for non-superadmins and refresh branches on mount
  const { branches, activeBranchId, switchBranch, activeBranch, refreshBranches } = useBranch();
  
  useEffect(() => {
    refreshBranches(); // Ensure branches are loaded after login
  }, []);

  useEffect(() => {
    if (user && user.branch_id) {
      if (activeBranchId.toString() !== user.branch_id.toString()) {
        switchBranch(user.branch_id);
      }
    }
  }, [user, activeBranchId, switchBranch]);
  const [showBranchMenu, setShowBranchMenu] = useState(false);

  // Tenant subscription status for pending-approval banner
  const [tenantProfile, setTenantProfile] = useState(null);
  const [billingInfo, setBillingInfo] = useState(null);
  const [showBillingModal, setShowBillingModal] = useState(false);
  const [payingBill, setPayingBill] = useState(false);
  const [copiedUpi, setCopiedUpi] = useState(false);

  useEffect(() => {
    const fetchTenantProfile = async () => {
      try {
        const res = await api.get("/saas/tenant-profile");
        setTenantProfile(res.data);
      } catch (e) {
        // Not a SaaS tenant or not authenticated — ignore
      }
    };
    const fetchBilling = async () => {
      try {
        const res = await api.get("/saas/billing");
        setBillingInfo(res.data);
      } catch (e) { /* ignore */ }
    };
    fetchTenantProfile();
    fetchBilling();
  }, []);

  const isPendingApproval = tenantProfile?.subscription_status === "pending_approval";
  const isOverdue = billingInfo?.is_overdue || (billingInfo?.days_until_due !== undefined && billingInfo.days_until_due < 0);
  const isDueSoon = billingInfo?.is_due_soon || (billingInfo?.days_until_due !== undefined && billingInfo.days_until_due >= 0 && billingInfo.days_until_due <= 7);
  const isUnpaid = billingInfo?.payment_status === "unpaid" || billingInfo?.payment_status === "overdue";
  const isPaymentRaised = billingInfo?.payment_status === "payment_raised";
  const expiryDateFormatted = billingInfo?.expiry_date || (billingInfo?.next_billing_date ? new Date(billingInfo.next_billing_date).toLocaleDateString("en-IN", { day: 'numeric', month: 'short', year: 'numeric' }) : null);
  const daysUntilDue = billingInfo?.days_until_due !== undefined ? billingInfo.days_until_due : null;

  // Show due/expiry alert banner automatically at the time of due date or when payment is unpaid/raised
  const showDueBanner = !isSuper && !isPendingApproval && (isOverdue || isDueSoon || isUnpaid || isPaymentRaised);

  const handlePayBill = async () => {
    setPayingBill(true);
    try {
      await api.post("/saas/pay-bill", {
        payment_method: "Simulated Quick Pay",
        transaction_ref: `TXN-${Date.now()}`
      });
      alert("✅ Payment raised! Verification is in progress by Super Admin.");
      const res = await api.get("/saas/billing");
      setBillingInfo(res.data);
    } catch (e) {
      alert(e.response?.data?.detail || "Payment failed. Please try again.");
    } finally {
      setPayingBill(false);
    }
  };

  const allMenuItems = [
    ...(isSuper ? [{ label: "Enterprise Dashboard", icon: <Home size={18} />, to: "/superadmin-dashboard" }] : []),
    { label: "Dashboard", icon: <Home size={18} />, to: "/dashboard" },
    { label: "Finance", icon: <UserCircle size={18} />, to: "/account" },
    { label: "Bookings", icon: <CalendarCheck2 size={18} />, to: "/bookings" },
    { label: "Services", icon: <ConciergeBell size={18} />, to: "/services" },
    { label: "Expenses", icon: <PiggyBank size={18} />, to: "/expenses" },
    { label: "Food Management", icon: <Grid size={18} />, to: "/food-orders" },
    { label: "Billing", icon: <Receipt size={18} />, to: "/billing" },
    { label: "Monthly Bill & Plan", icon: <CreditCard size={18} />, to: "/subscription" },
    { label: "WEB Management", icon: <Globe size={18} />, to: "/Userfrontend_data" },
    { label: "Reports", icon: <Sun size={18} />, to: "/report" },
    { label: "GuestProfiles", icon: <Sun size={18} />, to: "/guestprofiles" },
    { label: "Employee Mgt", icon: <Briefcase size={18} />, to: "/employee-management" },
    { label: "Inventory", icon: <Warehouse size={18} />, to: "/inventory" },
    { label: "Day Audit", icon: <CalendarCheck size={18} />, to: "/day-audit" },
    { label: "Settings", icon: <Settings size={18} />, to: "/settings" },
    ...(isSuper ? [{ label: "Branch Mgt", icon: <Building2 size={18} />, to: "/branch-management" }] : []),
    { label: "Activity Logs", icon: <Activity size={18} />, to: "/activity-logs" },
  ];

  const menuItems = allMenuItems.filter((item) => {
    // Both SuperAdmin and Branch Admin get all operational pages
    if (isSuper || isBranchAdmin) return true;
    if (item.to === "/subscription") return !isSuper; // Always permanently available for property users
    
    const moduleId = routeToModuleMap[item.to];
    if (!moduleId) return permissions.includes(item.to);
    
    return hasModuleAccess(moduleId);
  });

  return (
    <div
      className="flex h-screen overflow-hidden transition-colors duration-300 font-sans"
      style={{
        backgroundColor: 'var(--bg-primary)',
        color: 'var(--text-primary)'
      }}
    >
      {/* Mobile overlay for sidebar */}
      {!collapsed && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
          onClick={() => setCollapsed(true)}
        />
      )}

      {/* Bubble animation styles */}
      <style>
        {`
        @keyframes moveBubbles {
          0% { transform: translateY(0) rotate(0deg); opacity: 0; border-radius: 0; }
          50% { opacity: 1; border-radius: 50%; }
          100% { transform: translateY(-100vh) rotate(720deg); opacity: 0; }
        }

        .bubble {
          position: absolute;
          bottom: -150px;
          animation: moveBubbles infinite ease-in;
          filter: blur(2px);
          border-radius: 50%;
        }

        @media (max-width: 1024px) {
          .bubble {
            display: none; /* Hide bubbles on mobile for better performance */
          }
        }
        `}
      </style>

      {/* Bubble container */}
      <div id="bubble-background" className="absolute top-0 left-0 w-full h-full pointer-events-none overflow-hidden z-0"></div>

      <div className="flex h-full w-full relative z-10">

        {/* Sidebar container */}
        <div
          className={`shadow-xl transition-all duration-300 ${collapsed ? "w-16 lg:w-20" : "w-72"
            } flex flex-col flex-shrink-0 z-50 rounded-r-2xl overflow-hidden fixed lg:relative h-full ${collapsed ? "-translate-x-full lg:translate-x-0" : "translate-x-0"
            }`}
          style={{ backgroundColor: 'var(--bg-secondary)' }}
        >
          {/* Header section with logo, app name, and menu toggle */}
          <div className="flex items-center justify-between p-6 border-b" style={{ borderColor: 'var(--accent-bg)' }}>
            {/* Left side: App Logo and Branch Switcher */}
            <div className="flex flex-col items-center gap-4 w-full">
              <div className="p-0 rounded-xl flex items-center justify-center w-full">
                <img src={stayoneLogo} className="h-32 md:h-40 w-auto object-contain drop-shadow-2xl" alt="Stayone Hospitality Logo" />
              </div>

              {/* Branch name/switcher section */}
              <div className="w-full mt-2">
                {isSuper && !user?.branch_id && branches.length > 1 ? (
                  /* Branch Switcher for universal superadmins only */
                  <div className="relative w-full">
                    <button
                      onClick={() => setShowBranchMenu(!showBranchMenu)}
                      className="flex items-center justify-between w-full px-4 py-2.5 rounded-lg bg-gray-100/80 hover:bg-gray-200 transition-colors text-sm font-semibold border border-gray-200 shadow-sm"
                    >
                      <div className="flex items-center gap-2 overflow-hidden">
                        <Building2 size={16} className="text-[#2d5016] shrink-0" />
                        <span className="truncate">
                          {activeBranchId === 'all' ? "Enterprise View" : (activeBranch?.name || "Select Property")}
                        </span>
                      </div>
                      <ChevronDown size={14} className={`shrink-0 transition-transform ${showBranchMenu ? 'rotate-180' : ''}`} />
                    </button>

                    {showBranchMenu && (
                      <div className="absolute left-0 mt-2 w-full bg-white rounded-xl shadow-2xl border border-gray-100 py-2 z-[100] animate-in zoom-in-95 duration-200 origin-top">
                        <div className="px-4 py-2 text-xs font-semibold text-gray-500 border-b mb-1 uppercase tracking-wider">Switch Property</div>

                        {/* Global View Option */}
                        <button
                          onClick={() => {
                            switchBranch('all');
                            setShowBranchMenu(false);
                          }}
                          className={`w-full text-left px-4 py-2.5 text-sm flex items-center justify-between hover:bg-gray-50 transition-colors ${activeBranchId === 'all' ? 'bg-[#e8f5e9] text-[#2d5016] font-bold' : 'text-gray-700'}`}
                        >
                          <div className="flex items-center gap-3">
                            <Globe size={16} className="text-blue-500 shrink-0" />
                            <span className="truncate">All Branches</span>
                          </div>
                          {activeBranchId === 'all' && <div className="w-1.5 h-1.5 rounded-full bg-[#2d5016] shrink-0"></div>}
                        </button>

                        <div className="h-px bg-gray-100 my-1"></div>

                        {branches.map(branch => (
                          <button
                            key={branch.id}
                            onClick={() => {
                              switchBranch(branch.id);
                              setShowBranchMenu(false);
                            }}
                            className={`w-full text-left px-4 py-2.5 text-sm flex items-center justify-between hover:bg-[#e8f5e9] transition-colors ${activeBranchId.toString() === branch.id.toString() ? 'bg-[#e8f5e9] text-[#2d5016] font-bold' : 'text-gray-700'}`}
                          >
                            <div className="flex items-center gap-3 overflow-hidden">
                              <span className="w-2 h-2 rounded-full bg-[#8bc34a] shrink-0"></span>
                              <span className="truncate">{branch.name}</span>
                            </div>
                            {activeBranchId.toString() === branch.id.toString() && <div className="w-1.5 h-1.5 rounded-full bg-[#2d5016] shrink-0"></div>}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  /* Fixed Branch Name for managers/employees */
                  <div className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-gray-100/80 text-sm font-semibold border border-gray-200 shadow-sm w-full">
                    <Building2 size={16} className="text-[#2d5016] shrink-0" />
                    <span className="truncate uppercase tracking-wide">
                      {activeBranch?.name || branches.find(b => b.id.toString() === user?.branch_id?.toString())?.name || "My Branch"}
                    </span>
                  </div>
                )}
              </div>
            </div>
            {/* Right side: Notification Bell and Menu Toggle */}
            <div className="flex items-center gap-4 ml-auto">
              {!collapsed && <NotificationBell />}
              <button
                onClick={() => setCollapsed(!collapsed)}
                className="p-2 rounded-full transition-colors duration-200"
                style={{ color: 'var(--text-secondary)' }}
              >
                <Menu size={20} />
              </button>
            </div>
          </div>

          {/* Theme Switcher UI with image previews */}
          <div className={`p-4 transition-all duration-300 flex justify-center gap-2 border-b`} style={{ borderColor: 'var(--accent-bg)' }}>
            <motion.button
              animate={{ scale: currentTheme === 'stayone-signature' ? 1.15 : 1, y: currentTheme === 'stayone-signature' ? -2 : 0 }}
              whileHover={{ scale: 1.2, y: -2 }} whileTap={{ scale: 1.1 }} transition={{ type: 'spring', stiffness: 300 }}
              className={`w-8 h-8 rounded-full overflow-hidden ${currentTheme === 'stayone-signature' ? 'shadow-lg border-2 border-[#8bc34a]' : ''}`}
              onClick={() => { setCurrentTheme('stayone-signature'); applyTheme('stayone-signature'); }}
              title="Stayone Signature"
            >
              <img src={stayoneLogo} alt="Stayone Theme" className="w-full h-full object-cover" />
            </motion.button>
            <motion.button
              animate={{ scale: currentTheme === 'eco-friendly' ? 1.15 : 1, y: currentTheme === 'eco-friendly' ? -2 : 0 }}
              whileHover={{ scale: 1.2, y: -2 }} whileTap={{ scale: 1.1 }} transition={{ type: 'spring', stiffness: 300 }}
              className={`w-8 h-8 rounded-full overflow-hidden ${currentTheme === 'eco-friendly' ? 'shadow-lg border-2 border-green-500' : ''}`}
              onClick={() => { setCurrentTheme('eco-friendly'); applyTheme('eco-friendly'); }}
              title="Eco-Friendly"
            >
              <div className="w-full h-full bg-gradient-to-br from-green-400 to-emerald-600 flex items-center justify-center text-white font-bold text-xs">🌿</div>
            </motion.button>
            <motion.button
              animate={{ scale: currentTheme === 'platinum' ? 1.15 : 1, y: currentTheme === 'platinum' ? -2 : 0 }}
              whileHover={{ scale: 1.2, y: -2 }} whileTap={{ scale: 1.1 }} transition={{ type: 'spring', stiffness: 300 }}
              className={`w-8 h-8 rounded-full overflow-hidden ${currentTheme === 'platinum' ? 'shadow-lg border-2 border-gray-400' : ''}`}
              onClick={() => { setCurrentTheme('platinum'); applyTheme('platinum'); }}
              title="Platinum"
            >
              <img src="https://placehold.co/32x32/f4f7f9/2c3e50?text=P" alt="Platinum Theme" className="w-full h-full object-cover" />
            </motion.button>
            <motion.button
              animate={{ scale: currentTheme === 'onyx' ? 1.15 : 1, y: currentTheme === 'onyx' ? -2 : 0 }}
              whileHover={{ scale: 1.2, y: -2 }} whileTap={{ scale: 1.1 }} transition={{ type: 'spring', stiffness: 300 }}
              className={`w-8 h-8 rounded-full overflow-hidden ${currentTheme === 'onyx' ? 'shadow-lg border-2 border-yellow-600' : ''}`}
              onClick={() => { setCurrentTheme('onyx'); applyTheme('onyx'); }}
              title="Onyx"
            >
              <img src="https://placehold.co/32x32/1c1c1c/f1c40f?text=O" alt="Onyx Theme" className="w-full h-full object-cover" />
            </motion.button>
            <motion.button
              animate={{ scale: currentTheme === 'gilded-age' ? 1.15 : 1, y: currentTheme === 'gilded-age' ? -2 : 0 }}
              whileHover={{ scale: 1.2, y: -2 }} whileTap={{ scale: 1.1 }} transition={{ type: 'spring', stiffness: 300 }}
              className={`w-8 h-8 rounded-full overflow-hidden ${currentTheme === 'gilded-age' ? 'shadow-lg border-2 border-yellow-800' : ''}`}
              onClick={() => { setCurrentTheme('gilded-age'); applyTheme('gilded-age'); }}
              title="Gilded Age"
            >
              <img src="https://placehold.co/32x32/fdf8f0/d4ac61?text=G" alt="Gilded Age Theme" className="w-full h-full object-cover" />
            </motion.button>
          </div>

          {/* Main navigation menu */}
          <nav
            ref={navRef}
            className="flex-1 p-4 space-y-2 z-30 overflow-y-auto premium-scrollbar"
            style={{ 
              scrollBehavior: 'smooth'
            }}
          >
            {menuItems.map((item, idx) => {
              // Improved active state detection - check exact match or if path starts with the route
              const exactMatch = location.pathname === item.to;
              const startsWithMatch = item.to !== '/dashboard' && location.pathname.startsWith(item.to);
              const isActive = exactMatch || startsWithMatch;

              return (
                <Link
                  key={idx}
                  to={item.to}
                  className={`
                    group block flex items-center gap-4 p-3 rounded-xl
                    transition-colors duration-200 cursor-pointer
                  `}
                  style={{
                    backgroundColor: isActive ? 'var(--accent-bg)' : 'transparent',
                    color: isActive ? 'var(--accent-text)' : 'var(--text-secondary)',
                    boxShadow: isActive ? '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)' : 'none',
                    fontWeight: isActive ? 600 : 400, // Explicit font weight without class
                  }}
                >
                  <motion.span whileHover={{ scale: isActive ? 1 : 1.1, rotate: isActive ? 0 : -5 }} className="transition-transform duration-200">
                    {item.icon}
                  </motion.span>
                  {!collapsed && (
                    <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }} className="transition-opacity duration-200">{item.label}</motion.span>
                  )}
                </Link>
              );
            })}
          </nav>

          {/* Logout section at the bottom */}
          <div className="p-4 border-t" style={{ borderColor: 'var(--accent-bg)' }}>
            <Link
              to="/"
              className="group block flex items-center gap-4 p-3 rounded-xl transition-all duration-200 cursor-pointer hover:opacity-75"
              style={{
                backgroundColor: 'transparent',
                color: 'var(--text-secondary)',
              }}
            >
              <span className="group-hover:scale-110 transition-transform duration-200">
                <LogOut size={18} />
              </span>
              {!collapsed && <span className="transition-opacity duration-200">Log Out</span>}
            </Link>
          </div>

          {/* User Info section */}
          <div className="p-6 border-t z-20" style={{ borderColor: 'var(--accent-bg)' }}>
            {!collapsed && (
              <div className="text-sm mb-2" style={{ color: 'var(--text-secondary)' }}>
                {user ? `Logged in as: ${user.name || user.email || role}` : "Not logged in"}
              </div>
            )}
          </div>
        </div>

        {/* Mobile menu button - always visible on small screens */}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="lg:hidden fixed top-4 left-4 z-[60] p-3 rounded-xl shadow-lg transition-all duration-200 hover:scale-110"
          style={{
            backgroundColor: 'var(--accent-bg)',
            color: 'var(--accent-text)'
          }}
        >
          <Menu size={24} />
        </button>

        {/* Main content area */}
        <main className="flex-1 overflow-y-auto p-2 sm:p-4 md:p-6 lg:p-8 z-10 lg:ml-0 ml-0" style={{ backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)' }}>

          {/* Pending Approval Banner */}
          {isPendingApproval && (
            <div className="mb-4 p-4 rounded-2xl bg-amber-50 border-2 border-amber-300 flex items-start gap-3 shadow-sm">
              <AlertCircle className="w-6 h-6 text-amber-500 shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="font-bold text-amber-800 text-sm">Registration Pending Approval</p>
                <p className="text-amber-700 text-xs mt-0.5">Your property is under review by the StayOne admin team. Once approved, full app features will be unlocked. You can already view your monthly bill below.</p>
              </div>
              <button
                onClick={() => setShowBillingModal(true)}
                className="shrink-0 px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5"
              >
                <CreditCard size={14} /> View Bill
              </button>
            </div>
          )}

          {/* Automatic Payment Due / Expiry Date Banner */}
          {showDueBanner && (
            <div className={`mb-5 p-4 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm border-2 transition-all ${
              isOverdue
                ? "bg-gradient-to-r from-rose-50 via-red-50 to-orange-50 border-rose-300 text-rose-950"
                : isPaymentRaised
                ? "bg-gradient-to-r from-amber-50 via-indigo-50/40 to-blue-50 border-indigo-200 text-indigo-950"
                : isDueSoon
                ? "bg-gradient-to-r from-amber-50 via-orange-50 to-yellow-50 border-amber-300 text-amber-950"
                : "bg-gradient-to-r from-amber-50 to-slate-50 border-amber-200 text-amber-950"
            }`}>
              <div className="flex items-start gap-3.5">
                <div className={`p-2.5 rounded-xl shrink-0 ${
                  isOverdue ? "bg-rose-500 text-white animate-pulse" : isPaymentRaised ? "bg-indigo-600 text-white" : "bg-amber-500 text-white"
                }`}>
                  {isOverdue ? <AlertCircle size={22} /> : isPaymentRaised ? <Zap size={22} /> : <Clock size={22} />}
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h4 className="font-extrabold text-sm sm:text-base leading-tight">
                      {isOverdue
                        ? `🚨 Subscription Expired on ${expiryDateFormatted}`
                        : isPaymentRaised
                        ? "⚡ Payment Verification in Progress"
                        : isDueSoon
                        ? `⏳ Subscription Due ${daysUntilDue === 0 ? "TODAY" : `in ${daysUntilDue} day${daysUntilDue > 1 ? 's' : ''}`} (Expiry: ${expiryDateFormatted})`
                        : `⚠️ Monthly Subscription Payment Due (Expiry: ${expiryDateFormatted || 'Due Soon'})`}
                    </h4>
                    <span className={`text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full ${
                      isOverdue ? "bg-rose-200 text-rose-900 border border-rose-300" : isPaymentRaised ? "bg-indigo-200 text-indigo-900" : "bg-amber-200 text-amber-900 border border-amber-300"
                    }`}>
                      {isOverdue ? "Immediate Action Required" : isPaymentRaised ? "Awaiting Acceptance" : daysUntilDue === 0 ? "Due Today" : "Due Soon"}
                    </span>
                  </div>
                  <p className="text-xs opacity-90 leading-relaxed max-w-2xl">
                    {isOverdue
                      ? `Your property subscription ended on ${expiryDateFormatted}. Please pay your monthly renewal of ₹${(billingInfo?.monthly_amount || 0).toLocaleString()} to keep your property workspace active.`
                      : isPaymentRaised
                      ? `Payment of ₹${(billingInfo?.monthly_amount || 0).toLocaleString()} (Ref: ${billingInfo?.payment_ref || "Submitted"}) has been raised and is awaiting Super Admin verification.`
                      : `Your property subscription expires on ${expiryDateFormatted}. Pay your monthly renewal of ₹${(billingInfo?.monthly_amount || 0).toLocaleString()} to ensure continuous, uninterrupted access.`}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0 self-start sm:self-center">
                <button
                  onClick={() => setShowBillingModal(true)}
                  className={`px-4 py-2 text-xs font-bold rounded-xl shadow-sm transition-all flex items-center gap-1.5 ${
                    isOverdue
                      ? "bg-rose-600 hover:bg-rose-700 text-white shadow-rose-200"
                      : isPaymentRaised
                      ? "bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-200"
                      : "bg-amber-600 hover:bg-amber-700 text-white shadow-amber-200"
                  }`}
                >
                  <CreditCard size={14} />
                  <span>{isPaymentRaised ? "View Payment Details" : `Pay Now (₹${(billingInfo?.monthly_amount || 0).toLocaleString()})`}</span>
                </button>
                <Link
                  to="/subscription"
                  className="px-3 py-2 bg-white/90 hover:bg-white text-gray-700 border border-gray-200 text-xs font-semibold rounded-xl transition-colors shadow-xs"
                >
                  Details &rarr;
                </Link>
              </div>
            </div>
          )}

          {/* Monthly Bill & Expiry bar (always permanently visible for all property admins) */}
          {!isSuper && (
            <div className="flex justify-end mb-4 gap-2 flex-wrap items-center">
              {/* Payment / Expiry Status Badge */}
              <div className={`px-3 py-1.5 rounded-xl border text-xs font-bold flex items-center gap-2 shadow-2xs ${
                isOverdue
                  ? "bg-rose-50 border-rose-300 text-rose-700 animate-pulse"
                  : isDueSoon
                  ? "bg-amber-50 border-amber-300 text-amber-800"
                  : isPaymentRaised
                  ? "bg-indigo-50 border-indigo-300 text-indigo-800"
                  : "bg-emerald-50 border-emerald-200 text-emerald-800"
              }`}>
                {isOverdue ? (
                  <AlertCircle size={14} className="text-rose-600" />
                ) : isPaymentRaised ? (
                  <Zap size={14} className="text-indigo-600" />
                ) : isDueSoon ? (
                  <Clock size={14} className="text-amber-600" />
                ) : (
                  <CheckCircle2 size={14} className="text-emerald-600" />
                )}
                <span>
                  {isOverdue
                    ? `Payment Overdue (₹${(billingInfo?.monthly_amount || 0).toLocaleString()})`
                    : isPaymentRaised
                    ? `Payment Raised • Under Verification`
                    : isDueSoon
                    ? `Monthly Bill Due Soon (${daysUntilDue === 0 ? "Today" : `in ${daysUntilDue}d`})`
                    : `Monthly Bill: Paid`}
                </span>
                {expiryDateFormatted && (
                  <span className="text-[11px] opacity-75 font-normal">
                    • {isOverdue ? "Expired: " : "Valid until: "}{expiryDateFormatted}
                  </span>
                )}
              </div>

              {/* Monthly Bill Action Button (Always Accessible) */}
              <button
                onClick={() => setShowBillingModal(true)}
                className={`flex items-center gap-2 px-3.5 py-1.5 text-xs font-bold rounded-xl shadow-xs transition-all ${
                  isOverdue || isUnpaid
                    ? "bg-gradient-to-r from-rose-600 to-amber-600 hover:from-rose-700 hover:to-amber-700 text-white shadow-rose-200"
                    : isPaymentRaised
                    ? "bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs"
                    : "bg-white hover:bg-gray-50 border border-gray-200 text-gray-800 hover:border-gray-300 shadow-2xs"
                }`}
              >
                <CreditCard size={14} className={isOverdue || isUnpaid || isPaymentRaised ? "text-white" : "text-emerald-600"} />
                <span>{isOverdue || isUnpaid ? `Pay Monthly Bill (₹${(billingInfo?.monthly_amount || 0).toLocaleString()})` : "Monthly Bill & Invoices"}</span>
              </button>

              <Link
                to="/subscription"
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-xl border border-indigo-200 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 transition-colors shadow-2xs"
              >
                <Zap size={13} className="text-indigo-600" />
                <span>Plan Details</span>
              </Link>
            </div>
          )}

          {/* Billing Modal */}
          {showBillingModal && (
            <div className="fixed inset-0 z-[200] bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
              <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full max-h-[92vh] overflow-y-auto p-6 md:p-7 border border-gray-100">
                <div className="flex items-center justify-between mb-5 pb-3 border-b border-gray-100">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
                      <CreditCard size={20} />
                    </div>
                    <div>
                      <h2 className="text-lg font-bold text-gray-900 leading-tight">Property Billing</h2>
                      <p className="text-xs text-gray-500">Subscription &amp; activation details</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Link
                      to="/subscription"
                      onClick={() => setShowBillingModal(false)}
                      className="px-2.5 py-1 text-xs font-bold text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors flex items-center gap-1"
                    >
                      <span>Full Page</span>
                      <ArrowUpRight size={13} />
                    </Link>
                    <button 
                      onClick={() => setShowBillingModal(false)} 
                      className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-500 hover:text-gray-800 flex items-center justify-center text-lg font-bold transition-colors"
                    >
                      &times;
                    </button>
                  </div>
                </div>

                {billingInfo ? (
                  <div className="space-y-4">
                    {/* Current Plan Overview */}
                    <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-2.5">
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-gray-500 font-medium">Plan</span>
                        <span className="font-bold text-gray-900 capitalize">
                          {(typeof billingInfo.plan === 'object' ? billingInfo.plan?.name || billingInfo.plan?.code : billingInfo.plan) || tenantProfile?.plan_code || (typeof tenantProfile?.plan === 'object' ? tenantProfile.plan?.name : tenantProfile?.plan) || 'starter'}
                        </span>
                      </div>
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-gray-500 font-medium">Property Code</span>
                        <span className="font-mono font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100">
                          {billingInfo.branch_code || '—'}
                        </span>
                      </div>
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-gray-500 font-medium">Monthly Fee</span>
                        <span className="font-extrabold text-gray-900 text-base">₹{billingInfo.monthly_amount?.toLocaleString() || '0'}</span>
                      </div>
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-gray-500 font-medium">Status</span>
                        <span className={`font-bold px-2 py-0.5 rounded-full text-xs ${billingInfo.payment_status === 'paid' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                          {billingInfo.payment_status === 'paid' ? '✅ Paid' : '⚠️ Unpaid'}
                        </span>
                      </div>
                      {billingInfo.next_billing_date && (
                        <div className="flex justify-between items-center text-sm">
                          <span className="text-gray-500 font-medium">Next Billing Date</span>
                          <span className="font-semibold text-gray-700 text-xs">{billingInfo.next_billing_date.split('T')[0] || billingInfo.next_billing_date}</span>
                        </div>
                      )}
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-gray-500 font-medium">Account Status</span>
                        <span className={`font-bold capitalize text-xs ${
                          billingInfo.subscription_status === 'active' ? 'text-emerald-600' :
                          billingInfo.subscription_status === 'pending_approval' ? 'text-amber-600' : 'text-red-500'
                        }`}>{billingInfo.subscription_status?.replace('_', ' ')}</span>
                      </div>
                    </div>

                    {/* Pay at Teqmates & Instant Activation Box */}
                    <div className="rounded-2xl border-2 border-indigo-200 bg-gradient-to-br from-indigo-50/90 via-purple-50/60 to-emerald-50/50 p-4 space-y-3 shadow-xs">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="flex h-7 w-7 items-center justify-center rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-sm">
                            <Zap size={15} className="fill-white" />
                          </span>
                          <div>
                            <h4 className="text-sm font-bold text-gray-900">Pay at Teqmates</h4>
                            <p className="text-[11px] text-indigo-700 font-semibold">Official Payment & Activation Partner</p>
                          </div>
                        </div>
                        <span className="text-[10px] font-extrabold uppercase tracking-wide bg-emerald-100 text-emerald-800 px-2.5 py-1 rounded-full border border-emerald-200 flex items-center gap-1 shadow-2xs">
                          ⚡ Activates in Minutes
                        </span>
                      </div>

                      <div className="bg-white/90 backdrop-blur-xs p-3 rounded-xl border border-indigo-100 space-y-2 text-xs">
                        <p className="text-gray-700 leading-relaxed font-medium">
                          👉 <strong className="text-indigo-950 font-bold">Pay at Teqmates and share screenshot</strong> which activates your property within minutes!
                        </p>
                        
                        <div className="pt-2 border-t border-gray-100 space-y-1.5">
                          <div className="flex items-center justify-between">
                            <span className="text-gray-500">Payee:</span>
                            <span className="font-bold text-gray-800">Teqmates Technologies Pvt Ltd</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-gray-500">Teqmates UPI ID:</span>
                            <div className="flex items-center gap-1.5">
                              <span className="font-mono font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
                                teqmates@upi
                              </span>
                              <button
                                type="button"
                                onClick={() => {
                                  navigator.clipboard.writeText("teqmates@upi");
                                  setCopiedUpi(true);
                                  setTimeout(() => setCopiedUpi(false), 2000);
                                }}
                                className="px-2 py-0.5 text-[11px] font-bold text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 rounded border border-indigo-200 transition-colors flex items-center gap-1"
                              >
                                {copiedUpi ? <><Check size={12} className="text-emerald-600" /> Copied!</> : <><Copy size={12} /> Copy</>}
                              </button>
                            </div>
                          </div>
                          <div className="flex items-center justify-between text-[11px] text-gray-400 pt-1">
                            <span>Supported:</span>
                            <span className="font-medium text-gray-600">GPay • PhonePe • Paytm • BHIM • NetBanking</span>
                          </div>
                        </div>
                      </div>

                      {/* WhatsApp Share Button */}
                      <a
                        href={`https://api.whatsapp.com/send?phone=919876543210&text=${encodeURIComponent(
                          `Hi Teqmates, I have completed the payment for property "${tenantProfile?.name || billingInfo?.business_name || 'My Property'}" (Code: ${billingInfo?.branch_code || ''}). Here is my payment screenshot for instant activation.`
                        )}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-bold text-xs rounded-xl shadow-md shadow-emerald-200 transition-all flex items-center justify-center gap-2 group"
                      >
                        <MessageSquare size={16} />
                        <span>Share Screenshot on WhatsApp (+91 98765 43210)</span>
                        <ArrowUpRight size={14} className="group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                      </a>
                    </div>

                    {billingInfo.payment_status !== 'paid' && (
                      <button
                        onClick={handlePayBill}
                        disabled={payingBill}
                        className="w-full py-3 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 disabled:opacity-60 text-white font-bold rounded-xl transition-all shadow-md flex items-center justify-center gap-2 text-sm"
                      >
                        {payingBill ? (
                          <>
                            <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                            </svg>
                            Confirming Payment...
                          </>
                        ) : (
                          <>
                            <CreditCard size={16} />
                            Mark Monthly Bill as Paid
                          </>
                        )}
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-400">Loading billing info...</div>
                )}
              </div>
            </div>
          )}

          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 15 }}
              transition={{ duration: 0.2, ease: "easeInOut" }}
            >
              {children}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}