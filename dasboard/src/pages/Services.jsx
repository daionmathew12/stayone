import React, { useEffect, useState } from "react";
import DashboardLayout from "../layout/DashboardLayout";
import api from "../services/api";
import {
  PieChart, Pie, Cell, Tooltip, Legend,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer
} from "recharts";
import {
  Loader2, X, Activity, Box, Zap, Users, IndianRupee,
  LayoutDashboard, Plus, ClipboardList, Package, Clock,
  ArrowRight, Search, Filter, RefreshCw, ChevronRight,
  TrendingUp, Star, Archive, Layers, AlertCircle, CheckCircle,
  Radio, AlertTriangle, Map, PieChart as PieIcon, BarChart3 as BarIcon,
  Trash2, Play
} from "lucide-react";
import { getMediaBaseUrl } from "../utils/env";
import { getImageUrl } from "../utils/imageUtils";
import { formatDateIST, formatDateTimeIST, formatTimeIST, ensureUTC } from "../utils/dateUtils";
import BannerMessage from "../components/BannerMessage";

// Reusable card component for a premium look
const Card = React.memo(({ title, subtitle, icon, className = "", children, glass = false }) => {
  const isGradient = className.includes("gradient");
  return (
    <div className={`
      relative overflow-hidden rounded-2xl transition-all duration-300
      ${glass ? 'bg-white/80 backdrop-blur-xl border border-white/20' : isGradient ? '' : 'bg-white border border-slate-100'} 
      ${isGradient ? '' : 'shadow-sm hover:shadow-xl hover:-translate-y-1'}
      p-6 ${className}
    `}>
      {title && (
        <div className="flex justify-between items-start mb-4">
          <div>
            <h2 className={`text-lg font-bold tracking-tight ${isGradient ? 'text-white' : 'text-slate-800'}`}>{title}</h2>
            {subtitle && <p className={`text-xs mt-1 ${isGradient ? 'text-white/70' : 'text-slate-500'}`}>{subtitle}</p>}
          </div>
          {icon && <div className={`p-2 rounded-xl ${isGradient ? 'bg-white/20' : 'bg-slate-50 text-indigo-600'}`}>{icon}</div>}
        </div>
      )}
      {children}
    </div>
  );
});
Card.displayName = 'Card';

const COLORS = ["#4F46E5", "#6366F1", "#A78BFA", "#F472B6"];

// Utility for currency formatting
const formatCurrency = (amount) => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2
  }).format(amount || 0);
};

// --- Missing Component Re-implementation ---
const InventoryRecoveryModal = ({ assignedServiceId, requestId, onClose, onComplete }) => {
  const [inventory, setInventory] = useState([]);
  const [returnQtys, setReturnQuantities] = useState({});
  const [damageQtys, setDamageQuantities] = useState({});
  const [returnLocs, setReturnLocations] = useState({});
  const [loading, setLoading] = useState(true);
  const [locations, setLocations] = useState([]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        // Fetch specific service details to get current assignments
        const res = await api.get(`/services/assigned?skip=0&limit=100`);
        const service = (res.data || []).find(s => s.id === assignedServiceId);
        
        const items = service?.debug_items || service?.inventory_items_used || [];
        setInventory(items);
        
        // Fetch locations for return selection
        const locRes = await api.get("/inventory/locations?limit=100");
        const invLocs = (locRes.data || []).filter(l => l.is_inventory_point);
        setLocations(invLocs);
        
        // Initialize return locations with default warehouse
        const defaultLoc = invLocs.find(l => l.location_type === 'MAIN_INVENTORY' || l.location_type === 'WAREHOUSE' || l.location_type === 'CENTRAL_WAREHOUSE' || l.location_type === 'BRANCH_STORE') || invLocs[0];
        const initialLocs = {};
        items.forEach(item => {
          if (defaultLoc) initialLocs[item.id] = defaultLoc.id;
        });
        setReturnLocations(initialLocs);
        
      } catch (err) {
        console.error("Failed to fetch recovery data", err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [assignedServiceId]);

  const handleSubmit = async () => {
    try {
      const returns = inventory.map(item => ({
        assignment_id: item.id,
        quantity_returned: returnQtys[item.id] || 0,
        quantity_damaged: damageQtys[item.id] || 0,
        return_location_id: returnLocs[item.id] || null,
        notes: "Verified via dashboard"
      }));

      await api.patch(`/services/assigned/${assignedServiceId}`, {
        status: "completed",
        inventory_returns: returns
      });

      toast.success("Inventory recovery completed");
      onComplete();
    } catch (err) {
      console.error("Failed to submit returns", err);
      toast.error("Failed to complete inventory recovery");
    }
  };

  if (!loading && inventory.length === 0) {
    // Auto-complete if no inventory to recover
    handleSubmit();
    return null;
  }

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
      <div className="bg-white rounded-[2.5rem] shadow-2xl max-w-2xl w-full overflow-hidden border border-slate-100 animate-in fade-in zoom-in-95 duration-300">
        <div className="p-8 bg-slate-50/50 border-b border-slate-100 flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-black text-slate-800 tracking-tight">Inventory Verification</h2>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">Finalize equipment and stock returns</p>
          </div>
          <button onClick={onClose} className="p-3 hover:bg-white hover:shadow-md rounded-2xl transition-all text-slate-400 hover:text-slate-900">
            <X size={20} />
          </button>
        </div>

        <div className="p-8 max-h-[60vh] overflow-y-auto">
          {loading ? (
             <div className="flex flex-col items-center py-20 opacity-20">
                <Activity size={48} className="animate-spin mb-4" />
                <p className="font-black text-xs uppercase tracking-widest">Processing Data...</p>
             </div>
          ) : (
            <div className="space-y-6">
              {inventory.map((item, idx) => (
                <div key={idx} className="p-6 bg-slate-50/30 rounded-3xl border border-slate-100 group hover:border-indigo-100 transition-colors">
                   <div className="flex justify-between items-start mb-4">
                      <div>
                        <h4 className="font-black text-slate-800 text-sm uppercase tracking-tight">{item.item?.name || item.name}</h4>
                        <p className="text-[10px] font-bold text-slate-400 mt-0.5">Assigned: {item.issued_quantity || item.quantity} {item.item?.unit || item.unit}</p>
                      </div>
                   </div>
                   <div className="grid grid-cols-3 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Return</label>
                        <input 
                          type="number" 
                          className="w-full bg-white border-none ring-1 ring-slate-200 rounded-xl px-3 py-2 text-xs font-black focus:ring-2 focus:ring-indigo-500 transition-all"
                          value={returnQtys[item.id] || ''}
                          onChange={(e) => setReturnQuantities({...returnQtys, [item.id]: e.target.value})}
                          placeholder="0"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[9px] font-black text-rose-300 uppercase tracking-widest ml-1">Damage</label>
                        <input 
                          type="number" 
                          className="w-full bg-white border-none ring-1 ring-rose-100 rounded-xl px-3 py-2 text-xs font-black text-rose-600 focus:ring-2 focus:ring-rose-500 transition-all"
                          value={damageQtys[item.id] || ''}
                          onChange={(e) => setDamageQuantities({...damageQtys, [item.id]: e.target.value})}
                          placeholder="0"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Location</label>
                        <select 
                          className="w-full bg-white border-none ring-1 ring-slate-200 rounded-xl px-3 py-2 text-[10px] font-black focus:ring-2 focus:ring-indigo-500 transition-all"
                          value={returnLocs[item.id] || ''}
                          onChange={(e) => setReturnLocations({...returnLocs, [item.id]: e.target.value})}
                        >
                          <option value="">Select...</option>
                          {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                        </select>
                      </div>
                   </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="p-8 bg-slate-50/50 border-t border-slate-100 flex gap-4">
          <button onClick={onClose} className="flex-1 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-900 transition-all">
            Dismiss
          </button>
          <button onClick={handleSubmit} className="flex-[2] py-4 bg-slate-900 hover:bg-indigo-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-[0.3em] shadow-xl shadow-slate-200 transition-all active:scale-95">
            Confirm & Complete Cycle
          </button>
        </div>
      </div>
    </div>
  );
};

const Services = () => {
  const [services, setServices] = useState([]);
  const [assignedServices, setAssignedServices] = useState([]);
  const [form, setForm] = useState({ name: "", description: "", charges: "", is_visible_to_guest: false, average_completion_time: "" });
  const [selectedImages, setSelectedImages] = useState([]);
  const [imagePreviews, setImagePreviews] = useState([]);
  const [existingImages, setExistingImages] = useState([]);
  const [imagesToRemove, setImagesToRemove] = useState([]);
  const [inventoryItems, setInventoryItems] = useState([]);
  const [selectedInventoryItems, setSelectedInventoryItems] = useState([]); // Array of {inventory_item_id, quantity}
  const [assignForm, setAssignForm] = useState({
    service_id: "",
    employee_id: "",
    room_id: "",
    status: "pending",
  });
  const [extraInventoryItems, setExtraInventoryItems] = useState([]); // Extra inventory items for assignment
  const [selectedServiceDetails, setSelectedServiceDetails] = useState(null); // Store selected service details
  const [rooms, setRooms] = useState([]);
  const [occupiedRoomIds, setOccupiedRoomIds] = useState(new Set());
  const [allRooms, setAllRooms] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [filters, setFilters] = useState({
    room: "",
    employee: "",
    status: "",
    from: "",
    to: "",
  });
  const [serviceFilters, setServiceFilters] = useState({
    search: "",
    visible: "",
    hasInventory: "",
    hasImages: "",
  });
  const [itemFilters, setItemFilters] = useState({
    search: "",
    service: "",
    category: "",
  });
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(1);
  const [isFetchingMore, setIsFetchingMore] = useState(false);
  const [editingServiceId, setEditingServiceId] = useState(null);
  const [viewingAssignedService, setViewingAssignedService] = useState(null);
  const [completingServiceId, setCompletingServiceId] = useState(null);
  const [completingRequestId, setCompletingRequestId] = useState(null);
  const [completingBillingStatus, setCompletingBillingStatus] = useState(null);
  const [completingPaymentMode, setCompletingPaymentMode] = useState(null); // NEW: Persistent mode for completion
  const [inventoryAssignments, setInventoryAssignments] = useState([]);
  const [returnQuantities, setReturnQuantities] = useState({});
  const [usedQuantities, setUsedQuantities] = useState({}); // Track used quantities for each assignment
  const [returnLocationId, setReturnLocationId] = useState(null); // Location to return items to
  const [returnLocations, setReturnLocations] = useState({}); // Per-item return location {assignmentId: locationId}
  const [damageQuantities, setDamageQuantities] = useState({}); // Track damaged items for waste reporting
  const [locations, setLocations] = useState([]); // Available locations for returns
  const [returnedItems, setReturnedItems] = useState([]);
  const [showServiceReport, setShowServiceReport] = useState(false);
  const [quickAssignModal, setQuickAssignModal] = useState(null); // { request, serviceId, employeeId }
  const [serviceReport, setServiceReport] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [reportLoading, setReportLoading] = useState(false);
  const [reportFilters, setReportFilters] = useState({
    from_date: '',
    to_date: '',
    room_number: '',
    guest_name: '',
    location_id: ''
  });
  const [activeTab, setActiveTab] = useState("dashboard"); // "dashboard", "create", "assign", "assigned", "requests", "report"
  const [serviceRequests, setServiceRequests] = useState([]);
  const [paymentModal, setPaymentModal] = useState(null); // { orderId, amount }
  const [paymentMode, setPaymentMode] = useState("Cash"); // NEW: Default payment mode
  const [isSelectingPaymentMode, setIsSelectingPaymentMode] = useState(false); // NEW: Step control
  const [selectedActivity, setSelectedActivity] = useState(null);
  const [returnRequestModal, setReturnRequestModal] = useState(null); // { requestId, items }

  useEffect(() => {
    if (paymentModal) {
      setIsSelectingPaymentMode(false);
      setPaymentMode("Cash");
    }
  }, [paymentModal]);

  const [bannerMessage, setBannerMessage] = useState({ type: null, text: "" });
  const showBannerMessage = (type, text) => setBannerMessage({ type, text });
  const closeBannerMessage = () => setBannerMessage({ type: null, text: "" });

  // Fetch service requests
  const fetchServiceRequests = async () => {
    try {
      const res = await api.get("/service-requests?limit=100");
      setServiceRequests(res.data || []);
    } catch (error) {
      console.error("Failed to fetch service requests:", error);
      setServiceRequests([]);
    }
  };

  // Fetch all data
  const fetchAll = async (showLoading = true) => {
    if (showLoading) setLoading(true);
    try {
      const [sRes, aRes, rRes, eRes, bRes, pbRes, invRes, locRes] = await Promise.all([
        api.get("/services?limit=100").catch(() => ({ data: [] })),
        api.get("/services/assigned?skip=0&limit=100").catch(() => ({ data: [] })),
        api.get("/rooms?limit=100").catch(() => ({ data: [] })),
        api.get("/employees?limit=100").catch(() => ({ data: [] })),
        api.get("/bookings?limit=100").catch(() => ({ data: { bookings: [] } })),
        api.get("/packages/bookingsall?limit=100").catch(() => ({ data: [] })),
        api.get("/inventory/items?limit=100").catch(() => ({ data: [] })),
        api.get("/inventory/locations?limit=100").catch(() => ({ data: [] })), 
      ]);

      const [srRes, employeesRes, asRes] = await Promise.all([
        api.get("/service-requests?limit=100&include_checkout_requests=true").catch(() => ({ data: [] })),
        api.get("/employees?limit=200").catch(() => ({ data: [] })),
        api.get("/dashboard/kpis").catch(() => ({ data: [{}] }))
      ]);

      console.log("[DEBUG-FRONTEND] Service Requests Response:", srRes.data);
      setServiceRequests(srRes.data || []);
      setServices(sRes?.data || []);
      setAssignedServices((aRes?.data || []).sort((a, b) => new Date(b.assigned_at) - new Date(a.assigned_at)));
      setAllRooms(rRes?.data || []);
      setEmployees(eRes?.data || []);
      setInventoryItems(invRes?.data || []);
      setServiceRequests(srRes?.data || []);
      setLocations(locRes?.data || []); // Set locations

      // Fetch service requests if on requests tab (refresh)
      if (activeTab === "requests") {
        fetchServiceRequests();
      }

      // Combine regular and package bookings
      const regularBookings = bRes.data?.bookings || [];
      const packageBookings = (pbRes.data || []).map(pb => ({ ...pb, is_package: true }));
      setBookings([...regularBookings, ...packageBookings]);

      // Filter rooms to only show checked-in rooms
      const today = new Date();
      today.setHours(0, 0, 0, 0); // Set to start of day for comparison
      const checkedInRoomIds = new Set();

      // Helper function to normalize status (handle all variations)
      const normalizeStatus = (status) => {
        if (!status) return '';
        return status.toLowerCase().replace(/[-_\s]/g, '');
      };

      // Helper function to check if status is checked-in
      const isCheckedIn = (status) => {
        const normalized = normalizeStatus(status);
        return normalized === 'checkedin';
      };

      // Get room IDs from checked-in regular bookings
      regularBookings.forEach(booking => {
        if (isCheckedIn(booking.status) || normalizeStatus(booking.status) === 'booked') {
          // Parse dates properly
          const checkInDate = new Date(booking.check_in);
          const checkOutDate = new Date(booking.check_out);
          checkInDate.setHours(0, 0, 0, 0);
          checkOutDate.setHours(0, 0, 0, 0);

          const normalizedStatus = normalizeStatus(booking.status);
          const isActuallyCheckedIn = normalizedStatus === 'checkedin';

          // Check if booking is active (today is between check-in and check-out)
          // Also allow if checked-in (to handle overstays)
          if ((checkInDate <= today && checkOutDate >= today) || isActuallyCheckedIn) {
            if (booking.rooms && Array.isArray(booking.rooms)) {
              booking.rooms.forEach(room => {
                if (room && room.id) {
                  checkedInRoomIds.add(room.id);
                }
              });
            }
          }
        }
      });

      // Get room IDs from checked-in package bookings
      packageBookings.forEach(booking => {
        if (isCheckedIn(booking.status) || normalizeStatus(booking.status) === 'booked') {
          const checkInDate = new Date(booking.check_in);
          const checkOutDate = new Date(booking.check_out);
          checkInDate.setHours(0, 0, 0, 0);
          checkOutDate.setHours(0, 0, 0, 0);

          const normalizedStatus = normalizeStatus(booking.status);
          const isActuallyCheckedIn = normalizedStatus === 'checkedin';

          if ((checkInDate <= today && checkOutDate >= today) || isActuallyCheckedIn) {
            if (booking.rooms && Array.isArray(booking.rooms)) {
              booking.rooms.forEach(roomLink => {
                const room = roomLink.room || roomLink;
                if (room && room.id) {
                  checkedInRoomIds.add(room.id);
                }
              });
            }
          }
        }
      });

      // Also check room status directly as a fallback
      rRes.data.forEach(room => {
        const roomStatusNormalized = normalizeStatus(room.status);
        if (roomStatusNormalized === 'checkedin' || roomStatusNormalized === 'occupied') {
          checkedInRoomIds.add(room.id);
        }
      });

      // Filter rooms to only show checked-in rooms
      const checkedInRooms = (rRes?.data || []).filter(room => {
        const roomStatusNormalized = normalizeStatus(room.status);
        return checkedInRoomIds.has(room.id) ||
          roomStatusNormalized === 'checkedin' ||
          roomStatusNormalized === 'occupied';
      });
      setRooms(checkedInRooms);
      setOccupiedRoomIds(checkedInRoomIds);
    } catch (error) {
      // Set default values on error
      setHasMore(false);
      setPage(1);
      setServices([]);
      setAssignedServices([]);
      setRooms([]);
      setEmployees([]);
      setBookings([]);
      setInventoryItems([]);
      console.error("Error fetching data:", error);
      showBannerMessage("error", "Failed to load services data. Please refresh the page.");
    } finally {
      if (showLoading) setLoading(false);
    }
  };

  useEffect(() => {
    fetchAll();
  }, []);

  useEffect(() => {
    if (activeTab === "requests") {
      fetchServiceRequests();
    }
  }, [activeTab]);

  const loadMoreAssigned = async () => {
    if (isFetchingMore || !hasMore) return;
    setIsFetchingMore(true);
    const nextPage = page + 1;
    try {
      const res = await api.get(`/services/assigned?skip=${(nextPage - 1) * 20}&limit=20`);
      const newAssigned = res.data || [];
      setAssignedServices(prev => [...prev, ...newAssigned]);
      setPage(nextPage);
      setHasMore(newAssigned.length === 20);
    } catch (err) {
      console.error("Failed to load more assigned services:", err);
    } finally {
      setIsFetchingMore(false);
    }
  };

  // State for inventory source selection
  const [itemStockData, setItemStockData] = useState({}); // { itemId: [stocks] }
  const [inventorySourceSelections, setInventorySourceSelections] = useState({}); // { itemId: locationId }
  const [isLoadingStock, setIsLoadingStock] = useState(false);

  const fetchItemStocks = async (items) => {
    if (!items || items.length === 0) return;
    setIsLoadingStock(true);
    const uniqueIds = [...new Set(items.map(i => i.id || i.inventory_item_id))];
    const stockMap = {};

    try {
      await Promise.all(uniqueIds.map(async (id) => {
        try {
          const res = await api.get(`/inventory/items/${id}/stocks`);
          stockMap[id] = res.data || [];
        } catch (e) {
          console.warn(`Failed to fetch stock for item ${id}`, e);
          stockMap[id] = [];
        }
      }));

      setItemStockData(prev => ({ ...prev, ...stockMap }));

      // Auto-select logic
      const newSelections = { ...inventorySourceSelections };
      uniqueIds.forEach(id => {
        const stocks = stockMap[id] || [];
        if (stocks.length > 0) {
          // Sort by quantity desc
          const sorted = [...stocks].sort((a, b) => b.quantity - a.quantity);
          // Select max stock location by default if not already selected
          if (!newSelections[id] && sorted[0].quantity > 0) {
            newSelections[id] = sorted[0].location_id;
          }
        }
      });
      setInventorySourceSelections(newSelections);

    } catch (err) {
      console.error("Error fetching stocks", err);
    } finally {
      setIsLoadingStock(false);
    }
  };

  // Handle image selection
  const handleImageChange = (e) => {
    const files = Array.from(e.target.files);
    setSelectedImages(files);
    // Create preview URLs
    const previews = files.map(file => URL.createObjectURL(file));
    setImagePreviews(previews);
  };

  // Utility moved to utils/imageUtils.js

  // Add inventory item to service
  const handleAddInventoryItem = () => {
    setSelectedInventoryItems([...selectedInventoryItems, { inventory_item_id: "", quantity: 1.0 }]);
  };

  // Remove inventory item from service
  const handleRemoveInventoryItem = (index) => {
    setSelectedInventoryItems(selectedInventoryItems.filter((_, i) => i !== index));
  };

  // Update inventory item selection
  const handleUpdateInventoryItem = (index, field, value) => {
    const updated = [...selectedInventoryItems];
    updated[index] = { ...updated[index], [field]: field === 'quantity' ? parseFloat(value) || 0 : value };
    setSelectedInventoryItems(updated);
  };

  const resetServiceForm = () => {
    setForm({ name: "", description: "", charges: "", is_visible_to_guest: false, average_completion_time: "" });
    setSelectedImages([]);
    setImagePreviews([]);
    setExistingImages([]);
    setImagesToRemove([]);
    setSelectedInventoryItems([]);
    setEditingServiceId(null);
  };

  const handleEditService = (service) => {
    setForm({
      name: service.name || "",
      description: service.description || "",
      charges:
        service.charges !== undefined && service.charges !== null
          ? service.charges.toString()
          : "",
      is_visible_to_guest: !!service.is_visible_to_guest,
      average_completion_time: service.average_completion_time || "",
    });
    setSelectedInventoryItems(
      (service.inventory_items || []).map((item) => ({
        inventory_item_id: item.id,
        quantity: item.quantity || 1,
      }))
    );
    setExistingImages(service.images || []);
    setImagesToRemove([]);
    setSelectedImages([]);
    setImagePreviews([]);
    setEditingServiceId(service.id);
    setShowCreateModal(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleCancelEdit = () => {
    resetServiceForm();
    setShowCreateModal(false);
  };

  const handleToggleExistingImage = (imageId) => {
    setImagesToRemove((prev) =>
      prev.includes(imageId) ? prev.filter((id) => id !== imageId) : [...prev, imageId]
    );
  };

  const handleDeleteService = async (serviceId) => {
    if (!window.confirm("Are you sure you want to delete this service? It will be marked as inactive.")) {
      return;
    }
    try {
      // Soft delete: Mark service as inactive instead of deleting
      // First, get the current service data
      const service = services.find(s => s.id === serviceId);
      if (!service) {
        alert("Service not found");
        return;
      }

      // Use PUT to update the service with is_active = false
      const formData = new FormData();
      formData.append('name', service.name);
      formData.append('description', service.description);
      formData.append('charges', service.charges);
      formData.append('is_visible_to_guest', service.is_visible_to_guest ? 'true' : 'false');
      formData.append('is_active', 'false'); // Mark as inactive
      if (service.average_completion_time) {
        formData.append('average_completion_time', service.average_completion_time);
      }

      // Include existing inventory items
      if (service.inventory_items && service.inventory_items.length > 0) {
        const inventoryItems = service.inventory_items.map(item => ({
          inventory_item_id: item.id,
          quantity: item.quantity || 1
        }));
        formData.append('inventory_items', JSON.stringify(inventoryItems));
      }

      await api.put(`/services/${serviceId}`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      if (editingServiceId === serviceId) {
        resetServiceForm();
      }
      fetchAll();
      showBannerMessage("success", "Service has been marked as inactive.");
    } catch (err) {
      console.error("Failed to delete service", err);
      const errorMsg = err.response?.data?.detail || err.message || "Unknown error";
      showBannerMessage("error", `Failed to delete service: ${errorMsg}`);
    }
  };

  // Create or update service
  const handleSaveService = async () => {
    if (!form.name || !form.description || !form.charges) {
      alert("All fields are required");
      return;
    }
    try {
      const formData = new FormData();
      formData.append('name', form.name);
      formData.append('description', form.description);
      formData.append('charges', parseFloat(form.charges));
      formData.append('is_visible_to_guest', form.is_visible_to_guest ? 'true' : 'false');
      if (form.average_completion_time) {
        formData.append('average_completion_time', form.average_completion_time);
      }

      // Append images
      selectedImages.forEach((image) => {
        formData.append('images', image);
      });

      // Append inventory items as JSON (filter out empty selections)
      const validInventoryItems = selectedInventoryItems.filter(
        item => item.inventory_item_id && item.quantity > 0
      );
      if (editingServiceId || validInventoryItems.length > 0) {
        formData.append('inventory_items', JSON.stringify(validInventoryItems));
      }

      if (editingServiceId && imagesToRemove.length > 0) {
        formData.append('remove_image_ids', JSON.stringify(imagesToRemove));
      }

      if (editingServiceId) {
        await api.put(`/services/${editingServiceId}`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
      } else {
        await api.post("/services", formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
      }

      resetServiceForm();
      setShowCreateModal(false);
      fetchAll();
      showBannerMessage("success", `Service ${editingServiceId ? 'updated' : 'created'} successfully!`);
    } catch (err) {
      console.error("Failed to save service", err);
      const errorMsg = err.response?.data?.detail || err.message || "Unknown error";
      console.error("Error details:", err.response?.data);
      showBannerMessage("error", `Failed to save service: ${errorMsg}`);
    }
  };

  // Fetch service details when service is selected
  const handleServiceSelect = async (serviceId) => {
    if (!serviceId) {
      setSelectedServiceDetails(null);
      setAssignForm({ ...assignForm, service_id: serviceId });
      setInventorySourceSelections({});
      setItemStockData({});
      return;
    }

    try {
      let serviceDetails = null;
      // Always fetch fresh service data from API to ensure inventory items are loaded
      const cachedService = services.find(s => s.id === parseInt(serviceId));
      if (cachedService && cachedService.inventory_items && cachedService.inventory_items.length > 0) {
        serviceDetails = cachedService;
      } else {
        const response = await api.get(`/services?limit=50`);
        const allServices = response.data || [];
        const foundService = allServices.find(s => s.id === parseInt(serviceId));
        if (foundService) {
          serviceDetails = foundService;
          // Also update the cached services list with fresh data
          setServices(prevServices => {
            const updated = [...prevServices];
            const index = updated.findIndex(s => s.id === parseInt(serviceId));
            if (index >= 0) {
              updated[index] = foundService;
            }
            return updated;
          });
        } else if (cachedService) {
          serviceDetails = cachedService;
        }
      }

      setSelectedServiceDetails(serviceDetails);
      setAssignForm({ ...assignForm, service_id: serviceId });
      setExtraInventoryItems([]); // Clear extra items when service changes

      // Fetch stocks for inventory items
      if (serviceDetails && serviceDetails.inventory_items && serviceDetails.inventory_items.length > 0) {
        setInventorySourceSelections({});
        fetchItemStocks(serviceDetails.inventory_items);
      } else {
        setInventorySourceSelections({});
        setItemStockData({});
      }

    } catch (err) {
      console.error("Failed to fetch service details", err);
      const cachedService = services.find(s => s.id === parseInt(serviceId));
      if (cachedService) {
        setSelectedServiceDetails(cachedService);
      } else {
        setSelectedServiceDetails(null);
      }
      setExtraInventoryItems([]); // Clear extra items on error too
      setItemStockData({});
      setInventorySourceSelections({});
    }
  };

  // Assign service
  const handleAddExtraInventoryItem = () => {
    setExtraInventoryItems([...extraInventoryItems, { inventory_item_id: "", quantity: 1 }]);
  };

  const handleUpdateExtraInventoryItem = (index, field, value) => {
    const updated = [...extraInventoryItems];
    updated[index] = { ...updated[index], [field]: field === 'quantity' ? parseFloat(value) || 0 : value };
    setExtraInventoryItems(updated);

    if (field === 'inventory_item_id') {
      const itemId = parseInt(value);
      if (itemId) {
        fetchItemStocks([{ id: itemId }]);
        // Reset source selection for this row if item changes
        updated[index].source_location_id = "";
        setExtraInventoryItems(updated);
      }
    }
  };

  const handleRemoveExtraInventoryItem = (index) => {
    setExtraInventoryItems(extraInventoryItems.filter((_, i) => i !== index));
  };

  const handleAssign = async () => {
    if (!assignForm.service_id || !assignForm.employee_id || !assignForm.room_id) {
      alert("Please select service, employee, and deployment target");
      return;
    }
    try {
      const selectedLocId = parseInt(assignForm.room_id);
      const matchingRoom = allRooms.find(r => r.inventory_location_id === selectedLocId);
      
      const payload = {
        service_id: parseInt(assignForm.service_id),
        employee_id: parseInt(assignForm.employee_id),
        location_id: selectedLocId,
        room_id: matchingRoom ? matchingRoom.id : null,
      };

      // Add extra inventory items if any
      const validExtraItems = extraInventoryItems.filter(
        item => item.inventory_item_id && item.quantity > 0
      );
      if (validExtraItems.length > 0) {
        payload.extra_inventory_items = validExtraItems.map(item => ({
          inventory_item_id: parseInt(item.inventory_item_id),
          quantity: item.quantity
        }));
      }

      // Add inventory source selections
      let sourceSelections = [];
      if (Object.keys(inventorySourceSelections).length > 0) {
        sourceSelections = Object.entries(inventorySourceSelections).map(([itemId, locId]) => ({
          item_id: parseInt(itemId),
          location_id: parseInt(locId)
        }));
      }

      // Add sources from extra items
      extraInventoryItems.forEach(item => {
        if (item.inventory_item_id && item.source_location_id) {
          sourceSelections.push({
            item_id: parseInt(item.inventory_item_id),
            location_id: parseInt(item.source_location_id)
          });
        }
      });

      if (sourceSelections.length > 0) {
        payload.inventory_source_selections = sourceSelections;
      }

      const response = await api.post("/services/assign", payload);
      showBannerMessage("success", "Service assigned successfully!");

      if (response.data) {
        setAssignedServices(prev => [response.data, ...prev]);
      }

      setAssignForm({ service_id: "", employee_id: "", room_id: "", status: "pending" });
      setShowAssignModal(false);
      setSelectedServiceDetails(null);
      setExtraInventoryItems([]);
      fetchAll(false);
    } catch (err) {
      console.error("Failed to assign service", err);
      console.error("Error details:", {
        message: err.message,
        response: err.response,
        config: err.config,
        isNetworkError: err.isNetworkError,
        isTimeout: err.isTimeout
      });

      let errorMsg = "Failed to assign service. ";
      if (err.isNetworkError) {
        errorMsg += "Network error - please check if the backend server is running on port 8011.";
      } else if (err.isTimeout) {
        errorMsg += "Request timed out - the server is taking too long to respond.";
      } else if (err.response?.data?.detail) {
        errorMsg = err.response.data.detail;
      } else if (err.message) {
        errorMsg += err.message;
      }

      alert(`Error: ${errorMsg}`);
    }
  };

  // Toggle service visibility to guests
  const handleToggleVisibility = async (serviceId, currentVisibility) => {
    try {
      await api.patch(`/services/${serviceId}/visibility`, {
        is_visible_to_guest: !currentVisibility
      });
      fetchAll(); // Refresh the list
      showBannerMessage("success", "Visibility updated successfully!");
    } catch (err) {
      console.error("Failed to toggle service visibility", err);
      showBannerMessage("error", "Failed to update service visibility. Please try again.");
    }
  };

  const [statusChangeTimes, setStatusChangeTimes] = useState({});

  const [paymentModalReturnsChecked, setPaymentModalReturnsChecked] = useState(false); // New State for Modal Checkbox

  const handleStatusChange = async (id, newStatus, skipOrRequestId = false, billingStatus = null, forceReturn = false, paymentMode = null) => {
    const skipInventory = skipOrRequestId === true;
    const triggeringRequestId = typeof skipOrRequestId === "number" ? skipOrRequestId : null;

    // Close payment modal if we're processing a status change with billing info
    if (billingStatus) {
      setPaymentModal(null);
    }

    const changeTime = new Date().toISOString();
    setStatusChangeTimes(prev => ({ ...prev, [id]: changeTime }));
    try {
      // If changing to completed, check for inventory items to return
      if (newStatus === "completed" && !skipInventory) {
        // Fetch employee inventory assignments for this service
        try {
          // Fetch specific assigned service details to ensure we have the latest inventory/debug items
          // This fixes the issue where completing a service immediately after assignment might rely on stale list data
          let assignedService = assignedServices.find(s => s.id === id);
          try {
            // Force refresh this specific service data to be sure
            const freshRes = await api.get(`/services/assigned?skip=0&limit=100`); // Ideally filter by ID but our API list doesn't support it well, so we rely on find. 
            // Actually, let's just rely on the fallback logic if locally missing, 
            // BUT we can check if the found service has items.
            const freshList = freshRes.data || [];
            const fresh = freshList.find(s => s.id === id);
            if (fresh) assignedService = fresh;
          } catch (e) { console.warn("Failed to refresh individual service", e); }

          // NEW: Skip inventory recovery modal for food/milk orders OR Billable services - go to payment instead
          const serviceRequest = serviceRequests.find(r =>
            (triggeringRequestId && r.id === triggeringRequestId) ||
            r.assigned_service_id === id ||
            r.id === id + 2000000
          );

          let isBillable = (serviceRequest && serviceRequest.food_order_id) ||
            (assignedService?.service?.charges > 0) || // ANY service with charges triggers payment flow
            (assignedService?.service?.name?.toLowerCase().includes('milk')) ||
            (assignedService?.service?.name?.toLowerCase().includes('food')) ||
            (assignedService?.service?.name?.toLowerCase().includes('delivery')) ||
            (assignedService?.service?.name?.toLowerCase().includes('breakfast')) ||
            (assignedService?.service?.name?.toLowerCase().includes('lunch')) ||
            (assignedService?.service?.name?.toLowerCase().includes('dinner')) ||
            (assignedService?.service?.name?.toLowerCase().includes('room service')) ||
            (serviceRequest?.description?.toLowerCase().includes('milk')) ||
            (serviceRequest?.description?.toLowerCase().includes('food')) ||
            (serviceRequest?.description?.toLowerCase().includes('order')) ||
            (serviceRequest?.request_type === "delivery");

          // If we don't have a payment status yet (neither passed nor in DB), check if it's billable to show the choice
          const effectiveBilling = billingStatus || (assignedService?.billing_status !== "unbilled" ? assignedService?.billing_status : null);

          if (!effectiveBilling) {
            // isBillable already covers food orders and other paid services
            if (isBillable) {
              console.log("[DEBUG v2.5] Billable service detected, showing payment/status choice modal.");
              setPaymentModal({ requestId: triggeringRequestId || id + 2000000, newStatus });
              return;
            }
          }

          const employeeId = assignedService?.employee?.id || assignedService?.employee_id || serviceRequest?.employee_id;

          // Prefer debug_items if available as it may contain richer data assignments
          let serviceAssignments = assignedService?.debug_items || assignedService?.inventory_items_used || [];

          if (employeeId && serviceAssignments.length === 0) { // Only fetch from API if no assignments found in assignedService
            const empInvRes = await api.get(`/services/employee-inventory/${employeeId}?status=assigned,in_use,completed`);
            const allAssignments = empInvRes.data || [];

            // Filter assignments for this specific service
            serviceAssignments = allAssignments.filter(
              a => a.assigned_service_id === id && a.balance_quantity > 0
            );

            // If no specific service matches found, but employee has items, show them as fallback
            if (serviceAssignments.length === 0) {
              serviceAssignments = allAssignments.filter(a => a.balance_quantity > 0);
            }

            // CRITICAL: Refine isFood detection based on the actual items assigned
            const hasFoodItems = serviceAssignments.some(a =>
              a.item?.category?.toLowerCase().includes('food') ||
              a.item?.category?.toLowerCase().includes('beverage') ||
              a.item?.category?.toLowerCase().includes('service') || // Catch items wrongly categorized as service
              a.item?.name?.toLowerCase().includes('milk') ||
              a.item?.name?.toLowerCase().includes('food') ||
              a.item?.name?.toLowerCase().includes('water') ||
              a.item?.name?.toLowerCase().includes('tea') ||
              a.item?.name?.toLowerCase().includes('coffee') ||
              a.item?.name?.toLowerCase().includes('snack') ||
              a.item?.name?.toLowerCase().includes('order')
            );

            if (hasFoodItems) {
              console.log("[DEBUG v2.3] Food items detected in assignments (hasFoodItems=true) for service", id);
              isBillable = true;
            }

            // Now decide if we show payment modal or proceed
            if (isBillable && (billingStatus === null || billingStatus === undefined || billingStatus === "")) {
              console.log("[DEBUG v2.3] Billable service detected, skipping inventory and showing payment modal.");
              setPaymentModal({ requestId: triggeringRequestId || id + 2000000, newStatus });
              return;
            }

            if (serviceAssignments.length === 0) {
              if (forceReturn) {
                alert("No inventory items found assigned to this service. Cannot perform returns.");
                // Stop here to avoid completing without verification if forceReturn was requested
                return;
              }
              // If not forced (normal completion), we proceed to complete without modal
              // But maybe we should warn? "Completing service with NO inventory items..."
              console.log("Completing service with 0 inventory items.");
            }

            if (serviceAssignments.length > 0) {
              // ALWAYS show return inventory modal, even for food/paid items
              // This satisfies the requirement to show "items used in this service" and "inventory return option"
              // regardless of billing status.
              // Auto-consume is removed to force verification.

              /* REPLACED AUTO-CONSUME LOGIC WITH FALLTHROUGH */

              // Normal flow: Show return inventory modal
              setInventoryAssignments(serviceAssignments);
              setCompletingServiceId(id);
              // Handle optional requestId if we came from ServiceRequest table
              setCompletingRequestId(triggeringRequestId);
              setCompletingBillingStatus(billingStatus); // Store billing status for completion

              // If forceReturn is true (Inline), we DON'T want to stop here and return.
              // We want to fall through to the API call at the bottom.
              // But we need to prep the state for the bottom logic to pick up?
              // No, if forceReturn is true, we already have the state from the PaymentModal!
              // So we should SKIP this block entirely if forceReturn is true and we already have data?

              // Actually, logic flow:
              // 1. PaymentModal sets `returnQuantities` and calls handleStatusChange with `forceReturn=true`.
              // 2. This function runs.
              // 3. We detect `serviceAssignments.length > 0`.
              // 4. If we enter this block, we `return;` waiting for user confirmation. 
              //    THIS IS THE BUG. We don't want to wait if it's already confirmed (forceReturn).

              if (!forceReturn) {
                const initialReturns = {};
                const initialLocations = {};
                // ... (existing logic to calculate defaults) ...
                // ...
                // setReturnQuantities(...);
                // return;
              }
              // If forceReturn is true, we skip initialization (assuming it's done or we do it inline) 
              // and fall through to the API call below.

              if (!forceReturn) {
                const initialReturns = {};
                const initialLocations = {};

                serviceAssignments.forEach(a => {
                  initialReturns[a.id] = 0; // Default to 0
                  let match = null;

                  const noteSourceMatch = a.notes ? a.notes.match(/\(LocID:\s*(\d+)\)/) : null;
                  const assignedSourceId = noteSourceMatch ? parseInt(noteSourceMatch[1]) : null;
                  if (assignedSourceId) {
                    match = locations.find(l => l.id === assignedSourceId);
                  }

                  if (!match && a.item?.stock_locations?.length > 0 && a.item?.location) {
                    const masterInStock = a.item.stock_locations.find(s =>
                      s.name?.trim().toLowerCase() === a.item.location?.trim().toLowerCase() ||
                      s.location_code === a.item.location
                    );
                    if (masterInStock) {
                      match = locations.find(l => l.id === masterInStock.id);
                    }
                  }

                  // ... (rest of matching logic)
                  if (!match && a.item?.stock_locations?.length > 0) {
                    const firstStockLoc = a.item.stock_locations[0];
                    match = locations.find(l => l.id === firstStockLoc.id);
                  }

                  if (!match && a.item?.location) {
                    match = locations.find(l =>
                      l.name?.trim().toLowerCase() === a.item.location?.trim().toLowerCase() ||
                      l.location_code === a.item.location
                    );
                  }

                  if (!match) {
                    match = locations.find(l =>
                      l.location_type === 'WAREHOUSE' ||
                      l.location_type === 'CENTRAL_WAREHOUSE' ||
                      l.is_inventory_point === true
                    );
                  }

                  if (match) {
                    initialLocations[a.id] = match.id;
                  }
                });

                setReturnQuantities(initialReturns);
                setReturnLocations(initialLocations);

                // Open the second modal
                setInventoryAssignments(serviceAssignments);
                setCompletingServiceId(id);
                setCompletingRequestId(triggeringRequestId);

                return; // Wait for user to confirm returns in second modal
              }
              // If forceReturn is true, we proceed to update status below.
            }
          }
        } catch (invError) {
          console.warn("Could not fetch inventory assignments:", invError);
        }
      }

      // Update status - Check for inline returns first
      let payload = {
        status: newStatus,
        billing_status: billingStatus
      };

      if (paymentMode) {
        payload.payment_mode = paymentMode;
      }

      // If we have inline return data (from PaymentModal) and forceReturn is true, include it in the payload
      const hasInlineReturns = forceReturn && Object.keys(returnQuantities).length > 0;

      if (hasInlineReturns) {
        console.log("Processing inline inventory returns:", returnQuantities);

        // Robustly resolve the items associated with this service to alias IDs correctly
        let serviceItems = [];

        // 1. Try to get from state first
        const curService = assignedServices.find(s => s.id === id);
        if (curService) {
          // Prefer debug_items (Assignments) over inventory_items_used (Items)
          serviceItems = curService.debug_items || curService.inventory_items_used || [];
        }

        // 2. If no items or only template items, and we have an employee, try to fetch specific assignments
        // This mirrors logic at start of function, but ensures we have data for payload mapping
        const needsFetch = serviceItems.length === 0 || (curService && !curService.debug_items && curService.inventory_items_used);

        if (needsFetch && (curService?.employee?.id || curService?.employee_id)) {
          try {
            const empId = curService?.employee?.id || curService?.employee_id;
            console.log("Fetching fresh assignments for payload mapping, employee:", empId);
            const empInvRes = await api.get(`/services/employee-inventory/${empId}?status=assigned,in_use,completed`);
            const allAssignments = empInvRes.data || [];
            // Filter for this service
            const fetchedAssignments = allAssignments.filter(a => a.assigned_service_id === id);
            if (fetchedAssignments.length > 0) {
              serviceItems = fetchedAssignments;
              console.log("Found specific assignments:", serviceItems);
            }
          } catch (e) {
            console.warn("Retrying fetch assignments failed:", e);
          }
        }

        const inventory_returns = Object.entries(returnQuantities).map(([idStr, qty]) => {
          const keyId = parseInt(idStr);
          const numQty = parseFloat(qty);

          // Find the original item object to determine what valid ID this key represents
          // The keyId comes from the Modal render, which iterates 'serviceItems'.
          // However, the 'serviceItems' used in Modal might differ if we just fetched new ones above?
          // The Modal uses `svc?.debug_items || svc?.inventory_items_used`.
          // If Modal used `inventory_items_used` (ItemIDs), and we fetched assignments (AssignmentIDs),
          // we need to cross-reference.

          // 1. Try to find by direct ID match (Assuming Key is same as ID in our current list)
          let matchedItem = serviceItems.find(i => i.id === keyId);

          let assignmentId = null;
          let itemId = null;
          let quantityAssigned = 0;

          if (matchedItem) {
            // We found the object corresponding to the key.
            // Does it look like an Assignment or an Item?
            if (matchedItem.assignment_id) {
              assignmentId = matchedItem.assignment_id;
              itemId = matchedItem.item_id || matchedItem.inventory_item_id;
            } else if (matchedItem.quantity_assigned !== undefined) {
              // Likely an assignment object where id is assignment_id
              assignmentId = matchedItem.id;
              itemId = matchedItem.item_id || matchedItem.inventory_item_id;
            } else {
              // Likely an InventoryItem (template)
              itemId = matchedItem.id;
              // Attempt to find a matching assignment for this Item ID if we have assignments loaded
              // This handles case where Modal used ItemID but we want to send AssignmentID
              const relatedAssignment = serviceItems.find(i =>
                (i.item_id === itemId || i.inventory_item_id === itemId) &&
                i.quantity_assigned !== undefined
              );
              if (relatedAssignment) {
                assignmentId = relatedAssignment.id || relatedAssignment.assignment_id;
                matchedItem = relatedAssignment; // Switch context to assignment for calc
              }
            }

            // Calculate assigned quantity for 'used' calculation
            quantityAssigned = matchedItem.quantity_assigned || matchedItem.quantity || matchedItem.balance_quantity || 0;
          } else {
            // Fallback: If we couldn't match the object, assume key IS the assignment ID if it's large?
            // Or Item ID if small? Risky.
            // Let's assume it's assignment ID if we can't find it, provided we have assignments.
            if (keyId > 1000) assignmentId = keyId;
            else itemId = keyId;
          }

          // Calculate used. Backend handles it if missing, but better to send.
          const damageQty = parseFloat(damageQuantities[keyId] || 0);
          const quantityUsed = Math.max(0, quantityAssigned - numQty - damageQty);

          // Construct payload item
          const retItem = {
            quantity_returned: numQty,
            quantity_used: quantityUsed,
            quantity_damaged: damageQty,
            notes: "Inline return",
            return_location_id: (returnLocations[keyId] && returnLocations[keyId] !== "") ? parseInt(returnLocations[keyId]) : null
          };

          if (assignmentId) retItem.assignment_id = assignmentId;
          if (itemId) retItem.inventory_item_id = itemId;

          return retItem;
        });

        payload.inventory_returns = inventory_returns;
      }

      await api.patch(`/services/assigned/${id}`, payload);

      // Also update the linked service request in DB
      if (triggeringRequestId && triggeringRequestId < 1000000) {
        const reqPayload = { status: newStatus };
        if (billingStatus) reqPayload.billing_status = billingStatus;
        await api.put(`/service-requests/${triggeringRequestId}`, reqPayload);
      }

      setAssignedServices(prev => prev.map(s => s.id === id ? { ...s, status: newStatus, billing_status: billingStatus } : s));
      fetchAll(false);

      // If we successfully processed inline returns, show a success message
      if (forceReturn && Object.keys(returnQuantities).length > 0) {
        alert("Service completed and inventory returns processed successfully.");
        // Clear return state
        setReturnQuantities({});
        setReturnLocations({});
      }

    } catch (error) {
      console.error("Failed to update status:", error);
      alert(`Failed to update status: ${error.response?.data?.detail || error.message}`);
    }
  };

  const handleCompleteWithReturns = async () => {
    if (!completingServiceId) return;
    if (!completingServiceId) return;

    // Validation is handled per-item if needed, or by backend


    try {
      // Build inventory returns array - include all items to update used status
      const inventory_returns = inventoryAssignments.map(a => {
        const qty = returnQuantities[a.id] || 0;
        const numQty = parseFloat(qty);

        // Calculate used quantity automatically
        // Used = Assigned - Already Returned - Currently Returning
        const assignedQty = a.quantity_assigned || 0;
        const alreadyReturned = a.quantity_returned || 0;
        const currentReturn = isNaN(numQty) ? 0 : numQty;
        const usedQty = Math.max(0, assignedQty - alreadyReturned - currentReturn);

        return {
          assignment_id: a.assignment_id || parseInt(a.id), // Prefer explicit assignment_id
          inventory_item_id: a.assignment_id ? undefined : parseInt(a.id), // Fallback to item_id if assignment_id missing
          quantity_returned: parseFloat(currentReturn),
          quantity_used: parseFloat(usedQty),
          quantity_damaged: parseFloat(damageQuantities[a.id] || 0),
          notes: `Return inventory on service completion`,
          return_location_id: (returnLocations[a.id] && returnLocations[a.id] !== "") ? parseInt(returnLocations[a.id]) : null
        };
      });

      // Validate that returns don't exceed balance
      // Validate that returns don't exceed balance
      const invalidReturns = inventory_returns.filter(ret => {
        // Fix: Ensure we match the correct assignment ID, handling both naming conventions
        const assignment = inventoryAssignments.find(a => (a.assignment_id || parseInt(a.id)) === ret.assignment_id);

        // If we can't find the original assignment in our list, something is wrong with our mapping logic
        // But throwing an error here blocks the user. Better to warn and maybe skip validation for this item?
        // For safety, let's assume if we can't find it, we can't validate it, so let it pass (backend will catch it)
        if (!assignment) {
          console.warn("Validation warning: Could not find original assignment for return item", ret);
          return false;
        }

        const assignedQty = assignment.quantity_assigned || 0;
        const alreadyReturned = assignment.quantity_returned || 0;
        const usedQty = ret.quantity_used;

        // Use epsilon for float comparison to avoid 0.00000001 errors
        const epsilon = 0.0001;
        const balance = Math.max(0, assignedQty - usedQty - alreadyReturned);

        return (ret.quantity_returned - balance) > epsilon;
      });

      if (invalidReturns.length > 0) {
        showBannerMessage("error", "Error: Return quantities cannot exceed available balance. Please check your quantities.");
        return;
      }

      // Update status with inventory returns
      const payload = {
        status: "completed",
        inventory_returns: inventory_returns
      };
      if (completingBillingStatus) {
        payload.billing_status = completingBillingStatus;
      }
      if (completingPaymentMode) {
        payload.payment_mode = completingPaymentMode;
      }
      await api.patch(`/services/assigned/${completingServiceId}`, payload);

      setAssignedServices(prev => prev.map(s => s.id === completingServiceId ? { ...s, status: "completed" } : s));

      // If we have a linked requestId, update its status too
      if (completingRequestId) {
        setServiceRequests(prev => prev.map(r => r.id === completingRequestId ? { ...r, status: "completed", completed_at: new Date().toISOString() } : r));
      }

      // Close modal and refresh
      setCompletingServiceId(null);
      setCompletingBillingStatus(null);
      setCompletingRequestId(null);
      setInventoryAssignments([]);
      setReturnQuantities({});
      setDamageQuantities({});
      setUsedQuantities({});
      setReturnLocations({});
      setReturnLocationId(null);
      fetchAll(false);

      showBannerMessage("success", "Service marked as completed and inventory updated successfully!");
    } catch (error) {
      console.error("Failed to complete service with returns:", error);

      let errorMsg = error.message;
      if (error.response?.data?.detail) {
        const detail = error.response.data.detail;
        if (Array.isArray(detail)) {
          errorMsg = detail.map((d, i) => {
            if (typeof d === 'string') return d;
            if (d && typeof d === 'object') {
              const loc = d.loc ? d.loc.join('.') : `Error[${i}]`;
              const msg = d.msg || JSON.stringify(d);
              return `${loc}: ${msg}`;
            }
            return String(d);
          }).join('\n');
        } else if (typeof detail === 'object') {
          errorMsg = JSON.stringify(detail, null, 2);
        } else {
          errorMsg = String(detail);
        }
      } else if (error.response?.data?.message) {
        errorMsg = error.response.data.message;
      }

      showBannerMessage("error", `Failed to complete service:\n${errorMsg}`);
    }
  };

  const handleViewAssignedService = async (assignedService) => {
    try {
      console.log("[DEBUG] Viewing assigned service:", assignedService);
      console.log("[DEBUG] Service data:", assignedService.service);
      console.log("[DEBUG] Inventory items in assigned service:", assignedService.service?.inventory_items);

      // Always fetch fresh service details to ensure we have inventory items
      const serviceResponse = await api.get(`/services?limit=50`);
      const allServices = serviceResponse.data || [];
      const serviceId = assignedService.service_id || assignedService.service?.id;
      const service = allServices.find(s => s.id === serviceId);

      console.log("[DEBUG] Found service from API:", service);
      console.log("[DEBUG] Service inventory items from API:", service?.inventory_items);

      // Fetch actual assigned inventory items AND returned items for this service
      let assignedInventoryItems = [];
      let returnedItemsData = [];
      if (assignedService.employee && assignedService.employee.id) {
        try {
          // Fetch ALL inventory assignments for this employee
          const empInvRes = await api.get(`/services/employee-inventory/${assignedService.employee.id}`);
          const allAssignments = empInvRes.data || [];

          // Filter assignments for this specific assigned service
          const serviceAssignments = allAssignments.filter(
            a => a.assigned_service_id === assignedService.id
          );

          // Separate into assigned (active) and returned items
          assignedInventoryItems = serviceAssignments.filter(
            a => a.status === 'assigned' || a.status === 'in_use'
          );
          returnedItemsData = serviceAssignments.filter(
            a => a.quantity_returned > 0
          );

          console.log("[DEBUG] Found assigned inventory items:", assignedInventoryItems);
          console.log("[DEBUG] Found returned items:", returnedItemsData);
        } catch (invError) {
          console.warn("Could not fetch inventory items:", invError);
        }
      }

      if (service) {
        setViewingAssignedService({
          ...assignedService,
          service: {
            ...service,
            // Replace template inventory_items with ACTUAL assigned inventory (including extra items)
            inventory_items: assignedInventoryItems.length > 0 ? assignedInventoryItems.map(a => ({
              id: a.item_id,
              name: a.item_name,
              item_code: a.item_code,
              quantity: a.quantity_assigned,
              unit: a.unit,
              unit_price: a.item?.unit_price || 0
            })) : service.inventory_items // Fallback to template if no assignments
          }
        });
        setReturnedItems(returnedItemsData);
      } else {
        // Fallback to assigned service data if service not found
        console.warn("[WARNING] Service not found, using assigned service data");
        setViewingAssignedService(assignedService);
        setReturnedItems(returnedItemsData);
      }
    } catch (error) {
      console.error("Failed to fetch service details:", error);
      // Still show the assigned service even if we can't fetch full details
      setViewingAssignedService(assignedService);
      setReturnedItems([]);
    }
  };

  const handleDeleteAssignedService = async (assignedId) => {
    if (!window.confirm("Remove this assigned service? This cannot be undone.")) {
      return;
    }
    try {
      await api.delete(`/services/assigned/${assignedId}`);
      setAssignedServices(prev => prev.filter(s => s.id !== assignedId));
      fetchAll(false);
    } catch (error) {
      console.error("Failed to delete assigned service:", error);
      const msg = error.response?.data?.detail || error.message || "Unknown error";
      showBannerMessage("error", `Failed to delete assigned service: ${msg}`);
    }
  };

  const handleReassignEmployee = (assignedService) => {
    if (employees.length === 0) {
      showBannerMessage("error", "No employees available. Please add employees first.");
      return;
    }
    // Open modal with current employee pre-selected
    setQuickAssignModal({
      assignedService: assignedService,
      employeeId: assignedService.employee_id ? assignedService.employee_id.toString() : "",
      isReassignment: true
    });
  };

  const handleClearAllServices = async () => {
    const confirmMessage = `⚠️ WARNING: This will delete ALL services and assigned services!\n\n` +
      `This includes:\n` +
      `- All services\n` +
      `- All assigned services\n` +
      `- All service images\n` +
      `- All service inventory item links\n\n` +
      `This action CANNOT be undone!\n\n` +
      `Type "DELETE ALL" to confirm:`;

    const userInput = window.prompt(confirmMessage);
    if (userInput !== "DELETE ALL") {
      showBannerMessage("error", "Deletion cancelled.");
      return;
    }

    try {
      const response = await api.delete("/services/clear-all");
      showBannerMessage("success", `✅ Success! Cleared:\n- ${response.data.deleted.assigned_services} assigned services\n- ${response.data.deleted.services} services\n- ${response.data.deleted.service_images} service images\n- ${response.data.deleted.service_inventory_items} inventory item links`);
      fetchAll(); // Refresh the page
    } catch (error) {
      console.error("Failed to clear all services:", error);
      const msg = error.response?.data?.detail || error.message || "Unknown error";
      showBannerMessage("error", `Failed to clear all services: ${msg}`);
    }
  };

  const filteredAssigned = assignedServices.filter((s) => {
    const assignedDate = new Date(s.assigned_at);
    const fromDate = filters.from ? new Date(filters.from) : null;
    const toDate = filters.to ? new Date(filters.to) : null;
    return (
      (!filters.room || s.room_id === parseInt(filters.room)) &&
      (!filters.employee || s.employee_id === parseInt(filters.employee)) &&
      (!filters.status || s.status === filters.status) &&
      (!fromDate || assignedDate >= fromDate) &&
      (!toDate || assignedDate <= toDate)
    );
  });

  // Dashboard Data Processing
  const getDashboardData = () => {
    // Service-wise statistics
    const serviceStats = services.map(service => {
      const assigned = assignedServices.filter(a => (a.service_id || a.service?.id) === service.id);
      const completed = assigned.filter(a => a.status === 'completed').length;
      const pending = assigned.filter(a => a.status === 'pending').length;
      const inProgress = assigned.filter(a => a.status === 'in_progress').length;

      // Calculate inventory usage for this service
      const inventoryUsage = {};
      // Get inventory items from service definition
      const serviceInventoryItems = service.inventory_items || [];

      assigned.forEach(assignment => {
        // Use service inventory items or fallback to assignment service inventory items
        const items = serviceInventoryItems.length > 0
          ? serviceInventoryItems
          : (assignment.service?.inventory_items || []);

        items.forEach(item => {
          const itemId = item.id || item.inventory_item_id;
          if (!inventoryUsage[itemId]) {
            inventoryUsage[itemId] = {
              name: item.name,
              item_code: item.item_code,
              unit: item.unit || 'pcs',
              quantity_used: 0,
              total_cost: 0,
              assignments: 0
            };
          }
          const qty = item.quantity || 1;
          inventoryUsage[itemId].quantity_used += qty;
          inventoryUsage[itemId].total_cost += (item.unit_price || 0) * qty;
          inventoryUsage[itemId].assignments += 1;
        });
      });

      return {
        service_id: service.id,
        service_name: service.name,
        service_charges: service.charges,
        total_assignments: assigned.length,
        completed,
        pending,
        in_progress: inProgress,
        total_revenue: completed * service.charges,
        inventory_items: Object.values(inventoryUsage),
        inventory_count: Object.keys(inventoryUsage).length
      };
    });

    // Overall inventory usage
    const overallInventoryUsage = {};
    assignedServices.forEach(assignment => {
      const serviceId = assignment.service_id || assignment.service?.id;
      // Find the service in services array to get inventory items
      const serviceData = services.find(s => s.id === serviceId);
      const items = serviceData?.inventory_items || assignment.service?.inventory_items || [];

      items.forEach(item => {
        const itemId = item.id || item.inventory_item_id;
        if (!overallInventoryUsage[itemId]) {
          overallInventoryUsage[itemId] = {
            id: itemId,
            name: item.name,
            item_code: item.item_code,
            unit: item.unit || 'pcs',
            unit_price: item.unit_price || 0,
            quantity_used: 0,
            total_cost: 0,
            services_used_in: new Set(),
            assignments_count: 0
          };
        }
        const qty = item.quantity || 1;
        overallInventoryUsage[itemId].quantity_used += qty;
        overallInventoryUsage[itemId].total_cost += (item.unit_price || 0) * qty;
        overallInventoryUsage[itemId].services_used_in.add(serviceId);
        overallInventoryUsage[itemId].assignments_count += 1;
      });
    });

    // Convert Set to Array for services_used_in
    Object.values(overallInventoryUsage).forEach(item => {
      item.services_count = item.services_used_in.size;
      item.services_used_in = Array.from(item.services_used_in);
    });

    // Employee performance
    const employeeStats = {};
    assignedServices.forEach(assignment => {
      if (assignment.employee_id && assignment.employee) {
        const empId = assignment.employee_id;
        if (!employeeStats[empId]) {
          employeeStats[empId] = {
            employee_id: empId,
            employee_name: assignment.employee.name,
            total_assignments: 0,
            completed: 0,
            in_progress: 0,
            pending: 0
          };
        }
        employeeStats[empId].total_assignments += 1;
        if (assignment.status === 'completed') employeeStats[empId].completed += 1;
        else if (assignment.status === 'in_progress') employeeStats[empId].in_progress += 1;
        else employeeStats[empId].pending += 1;
      }
    });

    // Room-wise statistics
    const roomStats = {};
    assignedServices.forEach(assignment => {
      if (assignment.room_id && assignment.room) {
        const roomId = assignment.room_id;
        if (!roomStats[roomId]) {
          roomStats[roomId] = {
            room_id: roomId,
            room_number: assignment.room.number,
            total_services: 0,
            total_revenue: 0,
            services: []
          };
        }
        roomStats[roomId].total_services += 1;
        if (assignment.status === 'completed') {
          roomStats[roomId].total_revenue += assignment.service?.charges || 0;
        }
        const serviceId = assignment.service_id || assignment.service?.id;
        if (!roomStats[roomId].services.find(s => s.id === serviceId)) {
          roomStats[roomId].services.push({
            id: serviceId,
            name: assignment.service?.name
          });
        }
      }
    });

    return {
      serviceStats,
      overallInventoryUsage: Object.values(overallInventoryUsage).sort((a, b) => b.quantity_used - a.quantity_used),
      employeeStats: Object.values(employeeStats).sort((a, b) => b.total_assignments - a.total_assignments),
      roomStats: Object.values(roomStats).sort((a, b) => b.total_services - a.total_services)
    };
  };

  const dashboardData = getDashboardData();

  // KPI Data
  const totalServices = services.length;
  const totalAssigned = assignedServices.length;
  const completedCount = assignedServices.filter(s => s.status === "completed").length;
  const pendingCount = assignedServices.filter(s => s.status === "pending").length;

  // Pie chart for status
  const pieData = [
    { name: "Pending", value: pendingCount },
    { name: "Completed", value: completedCount },
    { name: "In Progress", value: totalAssigned - pendingCount - completedCount },
  ];

  // Bar chart for service assignments
  const barData = services.map(s => ({
    name: s.name,
    assigned: assignedServices.filter(a => (a.service_id || a.service?.id) === s.id).length,
  }));

  const fetchServiceReport = async () => {
    setReportLoading(true);
    try {
      const params = new URLSearchParams();
      if (reportFilters.from_date) params.append('from_date', reportFilters.from_date);
      if (reportFilters.to_date) params.append('to_date', reportFilters.to_date);
      if (reportFilters.room_number) params.append('room_number', reportFilters.room_number);
      if (reportFilters.guest_name) params.append('guest_name', reportFilters.guest_name);
      if (reportFilters.location_id) params.append('location_id', reportFilters.location_id);

      const response = await api.get(`/reports/services/detailed-usage?${params.toString()}`);
      setServiceReport(response.data);
    } catch (error) {
      console.error("Failed to fetch service report:", error);
      alert(`Failed to load report: ${error.response?.data?.detail || error.message}`);
    } finally {
      setReportLoading(false);
    }
  };

  // Service Request Handlers
  const handleUpdateRequestStatus = async (requestId, newStatus, billingStatus = null, forceReturn = false, paymentModeParam = null) => {
    const numericId = parseInt(requestId);
    // If it's an AssignedService (encoded in ID offset), redirect to handleStatusChange
    if (numericId >= 2000000) {
      setPaymentModal(null);
      setIsSelectingPaymentMode(false);
      return handleStatusChange(numericId - 2000000, newStatus, numericId, billingStatus, forceReturn, paymentModeParam);
    }

    const request = serviceRequests.find(r => r.id === requestId);

    if (request && request.is_checkout_request && newStatus === "completed") {
      const checkoutRequestId = request.checkout_request_id || request.id - 1000000;
      handleViewCheckoutInventory(checkoutRequestId);
      return;
    }

    // For regular requests being completed, check if they have a linked assignment to trigger the modal
    if (newStatus === "completed" && request) {
      const linkedAssigned = assignedServices.find(as =>
        as.room?.id === request.room_id &&
        (as.employee_id === request.employee_id || !as.employee_id)
      );

      const descLower = (request.description || "").toLowerCase();
      const isFoodRequest = request.food_order_id ||
        request.request_type === "delivery" ||
        descLower.includes("food") ||
        descLower.includes("milk") ||
        descLower.includes("water") ||
        descLower.includes("tea") ||
        descLower.includes("coffee") ||
        descLower.includes("breakfast") ||
        descLower.includes("lunch") ||
        descLower.includes("dinner") ||
        descLower.includes("cleaning") ||
        descLower.includes("room service");

      const isAlreadyPaid = 
        (request.billing_status || "").toLowerCase() === 'paid' || 
        (request.food_order_billing_status || "").toLowerCase() === 'paid' ||
        (request.food_order?.billing_status || "").toLowerCase() === 'paid';

      if (isFoodRequest && !isAlreadyPaid && (billingStatus === null || billingStatus === undefined || billingStatus === "")) {
        setPaymentModal({ requestId, newStatus });
        return;
      }

      if (linkedAssigned) {
        setPaymentModal(null);
        setIsSelectingPaymentMode(false);
        return handleStatusChange(linkedAssigned.id, newStatus, requestId, billingStatus, forceReturn, paymentModeParam);
      }
    }

    if (newStatus === "completed" && (billingStatus === null || billingStatus === undefined || billingStatus === "")) {
      const isAlreadyPaid = 
        (request.billing_status || "").toLowerCase() === 'paid' || 
        (request.food_order_billing_status || "").toLowerCase() === 'paid' ||
        (request.food_order?.billing_status || "").toLowerCase() === 'paid';
      if (request && request.food_order_id && !isAlreadyPaid) {
        setPaymentModal({ requestId, newStatus });
        return;
      }
      if (request && request.request_type === "return_items") {
        setReturnRequestModal({
          requestId,
          newStatus,
          items: request.refill_data ? (typeof request.refill_data === 'string' ? JSON.parse(request.refill_data) : request.refill_data) : []
        });
        return;
      }
    }

    setServiceRequests(prev =>
      prev.map(r => r.id === requestId ? { ...r, status: newStatus } : r)
    );

    try {
      const payload = { status: newStatus };
      if (billingStatus) payload.billing_status = billingStatus;
      if (paymentModeParam) payload.payment_mode = paymentModeParam;
      
      await api.put(`/service-requests/${requestId}`, payload);
      await fetchServiceRequests();
      setPaymentModal(null);
      setIsSelectingPaymentMode(false);
    } catch (error) {
      console.error("Failed to update request status:", error);
      const msg = error.response?.data?.detail || error.message || "Unknown error";
      alert(`Failed to update request status: ${msg}`);
      await fetchServiceRequests();
    }
  };


  const handleAssignEmployeeToRequest = async (requestId, employeeId, pickupLocationId = null, currentStatus = null) => {
    try {
      const idNum = parseInt(requestId);
      const parsedEmpId = employeeId ? parseInt(employeeId) : null;
      // Determine request type based on ID ranges
      if (idNum >= 2000000) {
        // Assigned Service
        const asvcId = idNum - 2000000;
        await api.put(`/services/assigned/${asvcId}`, { employee_id: parsedEmpId });
      } else if (idNum >= 1000000) {
        // Checkout Request
        const checkoutRequestId = idNum - 1000000;
        await api.put(`/bill/checkout-request/${checkoutRequestId}/assign?employee_id=${employeeId || ""}`);
      } else {
        // Regular Service Request
        const payload = { employee_id: parsedEmpId };
        if (pickupLocationId) {
          payload.pickup_location_id = parseInt(pickupLocationId);
        }
        if (parsedEmpId && currentStatus === "pending") {
          payload.status = "in_progress";
        }
        await api.put(`/service-requests/${requestId}`, payload);
      }
      await fetchServiceRequests();
      if (typeof fetchAll === 'function') {
        await fetchAll(false);
      }
    } catch (error) {
      console.error("Failed to assign employee:", error);
      const msg = error.response?.data?.detail || error.message || "Unknown error";
      alert(`Failed to assign employee: ${msg}`);
    }
  };

  const [checkoutInventoryModal, setCheckoutInventoryModal] = useState(null);
  const [checkoutInventoryDetails, setCheckoutInventoryDetails] = useState(null);

  const handleViewCheckoutInventory = async (checkoutRequestId) => {
    try {
      const res = await api.get(`/bill/checkout-request/${checkoutRequestId}/inventory-details`);
      const details = res.data;

      // Initialize UI state fields for ALL items
      // The backend now returns a comprehensive list of items (LocationStock + Assets + Registry)
      // with correct flags (is_fixed_asset, is_rentable, etc.)
      if (details.items) {
        details.items = details.items.map(item => ({
          ...item,
          // Common UI fields
          total_assigned: item.current_stock,
          available_stock: item.current_stock,

          // For Consumables logic
          used_qty: 0,
          missing_qty: 0,
          is_returned: item.is_rentable || item.track_laundry_cycle || false,

          // For Asset logic
          is_damaged: false,
          is_returned: item.track_laundry_cycle || false,
          damage_notes: ""
        }));

        // Derive fixed_assets for the specific rendering section
        details.fixed_assets = details.items.filter(item => item.is_fixed_asset);
      }

      setCheckoutInventoryDetails(details);
      setCheckoutInventoryModal(checkoutRequestId);
    } catch (error) {
      console.error("Failed to fetch inventory details:", error);
      alert(`Failed to load inventory details: ${error.response?.data?.detail || error.message}`);
    }
  };

  const handleUpdateInventoryVerification = (index, field, value) => {
    const newItems = [...checkoutInventoryDetails.items];
    const item = newItems[index];

    if (['return_location_id', 'laundry_location_id', 'waste_location_id', 'damage_location_id'].includes(field)) {
      newItems[index][field] = value ? parseInt(value) : null;
    } else if (['is_laundry', 'is_waste', 'request_replacement'].includes(field)) {
      newItems[index][field] = value; // Boolean value
    } else {
      // Numeric fields
      const val = parseFloat(value) || 0;
      newItems[index][field] = val;

      // Auto-calculate used/missing based on Available Stock or Damaged Qty
      if (field === 'available_stock' || field === 'damage_qty') {
        const current = Number(item.current_stock || 0);
        const available = field === 'available_stock' ? val : Number(item.available_stock || 0);
        const damaged = field === 'damage_qty' ? val : Number(item.damage_qty || 0);

        if (item.is_rentable || item.track_laundry_cycle) {
          // For Rentals: Missing = Current - Available - Damaged
          let missing = current - available - damaged;
          if (missing < 0) missing = 0;
          newItems[index].missing_qty = missing;
          newItems[index].used_qty = 0;
        } else {
          // For Consumables: Used = Current - Available
          let used = current - available;
          if (used < 0) used = 0;
          newItems[index].used_qty = used;
          newItems[index].missing_qty = 0;
        }
      }
    }

    setCheckoutInventoryDetails({
      ...checkoutInventoryDetails,
      items: newItems
    });
  };

  const handleUpdateAssetDamage = (index, field, value) => {
    const newAssets = [...(checkoutInventoryDetails.fixed_assets || [])];

    if (['return_location_id', 'laundry_location_id', 'waste_location_id', 'damage_location_id'].includes(field)) {
      newAssets[index][field] = value ? parseInt(value) : null;
    } else {
      newAssets[index][field] = value;
    }

    setCheckoutInventoryDetails({
      ...checkoutInventoryDetails,
      fixed_assets: newAssets
    });
  };

  const handleCompleteCheckoutRequest = async (checkoutRequestId, notes) => {
    try {
      const items = checkoutInventoryDetails.items.map(item => ({
        item_id: item.item_id || item.id,
        used_qty: Number(item.used_qty || 0),
        missing_qty: Number(item.missing_qty || 0),
        damage_qty: Number(item.damage_qty || 0),
        is_returned: !!item.is_returned,
        is_rentable: !!item.is_rentable,
        is_fixed_asset: !!item.is_fixed_asset,
        return_location_id: item.return_location_id,
        is_laundry: !!item.is_laundry,
        laundry_location_id: item.laundry_location_id,
        is_waste: !!item.is_waste,
        waste_location_id: item.waste_location_id,
        request_replacement: !!item.request_replacement
      }));

      // Collect asset damages (Damaged OR Missing OR Marked for Laundry/Waste)
      const assetDamages = (checkoutInventoryDetails.fixed_assets || [])
        .filter(asset => asset.is_damaged || (asset.available_stock || 0) < (asset.current_stock || 0) || asset.is_laundry || asset.is_waste || asset.is_returned)
        .map(asset => ({
          asset_registry_id: asset.asset_registry_id,
          item_id: asset.item_id,
          item_name: asset.item_name,
          replacement_cost: Number(asset.replacement_cost || 0),
          notes: asset.damage_notes || ((asset.available_stock || 0) < (asset.current_stock || 0) ? "Missing at checkout" : ""),
          is_laundry: !!asset.is_laundry,
          laundry_location_id: asset.laundry_location_id,
          is_waste: !!asset.is_waste,
          waste_location_id: asset.waste_location_id,
          request_replacement: !!asset.request_replacement,
          is_damaged: !!asset.is_damaged,
          is_returned: !!asset.is_returned,
          return_location_id: asset.return_location_id
        }));

      await api.post(`/bill/checkout-request/${checkoutRequestId}/check-inventory`, {
        inventory_notes: notes || "",
        items: items,
        asset_damages: assetDamages
      });
      alert("Checkout request completed successfully!");
      setCheckoutInventoryModal(null);
      setCheckoutInventoryDetails(null);
      // Immediately refresh service requests to update the table
      await fetchServiceRequests();
    } catch (error) {
      console.error("Failed to complete checkout request:", error);
      alert(`Failed to complete checkout request: ${error.response?.data?.detail || error.message}`);
    }
  };

  const handleUpdateCheckoutRequestStatus = async (requestId, newStatus) => {
    const checkoutRequestId = requestId > 1000000 ? requestId - 1000000 : requestId;
    try {
      if (newStatus === "completed") {
        // For completed status, show the inventory modal to collect data
        await handleViewCheckoutInventory(checkoutRequestId);
      } else if (newStatus === "in_progress" || newStatus === "pending") {
        // Use the new status update endpoint
        await api.put(`/bill/checkout-request/${checkoutRequestId}/status?status=${newStatus}`);
        alert(`Checkout request status updated to ${newStatus}`);
        fetchServiceRequests();
      }
    } catch (error) {
      console.error("Failed to update checkout request status:", error);
      const msg = error.response?.data?.detail || error.message || "Unknown error";
      alert(`Failed to update status: ${msg}`);
    }
  };

  const handleDeleteRequest = async (requestId) => {
    if (!window.confirm("Are you sure you want to delete this service request?")) {
      return;
    }
    try {
      await api.delete(`/service-requests/${requestId}`);
      fetchServiceRequests();
    } catch (error) {
      console.error("Failed to delete request:", error);
      const msg = error.response?.data?.detail || error.message || "Unknown error";
      alert(`Failed to delete request: ${msg}`);
    }
  };

  const handleCompleteReturnRequest = async (requestId, newStatus, locationId) => {
    try {
      if (!locationId) {
        alert("Please select a return location.");
        return;
      }

      await api.put(`/service-requests/${requestId}`, {
        status: newStatus,
        return_location_id: parseInt(locationId)
      });

      setReturnRequestModal(null);
      fetchServiceRequests();
      alert("Items returned successfully and request completed.");
    } catch (error) {
      console.error("Failed to complete return request:", error);
      alert(`Error: ${error.response?.data?.detail || error.message}`);
    }
  };

  const handleQuickAssignFromRequest = async (request) => {
    if (employees.length === 0) {
      alert("No employees available. Please add employees first.");
      return;
    }

    // Open modal with employee selection
    setQuickAssignModal({
      request: request,
      employeeId: request.employee_id ? request.employee_id.toString() : "",
      pickupLocationId: request.pickup_location_id ? request.pickup_location_id.toString() : "",
    });
  };

  const handleQuickAssignSubmit = async () => {
    if (!quickAssignModal) return;

    if (!quickAssignModal.employeeId) {
      alert("Please select an employee");
      return;
    }

    try {
      // Check if this is a reassignment
      if (quickAssignModal.isReassignment && quickAssignModal.assignedService) {
        // Update the employee for an existing assigned service
        const assignedService = quickAssignModal.assignedService;
        const empId = parseInt(quickAssignModal.employeeId);
        const emp = employees.find(e => e.id === empId);

        setAssignedServices(prev => prev.map(s =>
          s.id === assignedService.id
            ? { ...s, employee_id: empId, employee: emp || s.employee }
            : s
        ));

        showBannerMessage("success", "Employee reassigned successfully!");
        setQuickAssignModal(null);
        fetchAll(false);
        return;
      }

      // Check if this is a checkout request
      const isCheckoutRequest = quickAssignModal.request && (
        quickAssignModal.request.is_checkout_request ||
        quickAssignModal.request.id > 1000000 ||
        quickAssignModal.request.request_type === 'checkout_verification' ||
        quickAssignModal.request.request_type === 'checkout_settlement'
      );

      if (isCheckoutRequest) {
        // For checkout requests, only assign employee (no service needed)
        if (quickAssignModal.request.id) {
          await handleAssignEmployeeToRequest(quickAssignModal.request.id, parseInt(quickAssignModal.employeeId));
        }

        showBannerMessage("success", "Employee assigned to checkout verification successfully!");
        setQuickAssignModal(null);
        // Immediately refresh data to show in activity
        await fetchServiceRequests();
        await fetchAll(false);
        return;
      }

      // Otherwise, this is a regular service assignment from a request
      // For service requests, just assign the employee to the request
      // The service type is already defined in the request
      if (quickAssignModal.request.id) {
        await handleAssignEmployeeToRequest(quickAssignModal.request.id, parseInt(quickAssignModal.employeeId), quickAssignModal.pickupLocationId);
      }

      showBannerMessage("success", "Employee assigned successfully!");
      setQuickAssignModal(null);

      // Immediately refresh data to show in activity
      await fetchServiceRequests();
      await fetchAll(false);
    } catch (err) {
      console.error("Failed to assign service", err);
      let errorMsg = "Failed to assign service. ";
      if (err.response?.data?.detail) {
        errorMsg = err.response.data.detail;
      } else if (err.message) {
        errorMsg += err.message;
      }
      showBannerMessage("error", `Error: ${errorMsg}`);
    }
  };

  const handleMarkOrderPaid = (request) => {
    setPaymentModal({
      orderId: request.food_order_id,
      amount: request.food_order_amount,
      paymentMethod: "cash"
    });
  };

  const handlePaymentSubmit = async () => {
    if (!paymentModal) return;

    try {
      await api.post(`/food-orders/${paymentModal.orderId}/mark-paid?payment_method=${paymentModal.paymentMethod}`);
      showBannerMessage("success", "Order marked as paid successfully!");
      setPaymentModal(null);
      fetchServiceRequests();
    } catch (err) {
      console.error("Failed to mark order as paid", err);
      showBannerMessage("error", `Error: ${err.response?.data?.detail || err.message}`);
    }
  };

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-3xl font-bold text-gray-800">Service Management Dashboard</h2>
        </div>

        {/* Tabs Navigation */}
        <div className="flex items-center gap-2 p-1.5 bg-slate-100/50 backdrop-blur-md rounded-2xl border border-slate-200 w-fit mb-8">
          {[
            { id: "dashboard", label: "Overview", icon: <LayoutDashboard size={18} /> },
            { id: "create", label: "Master List", icon: <Package size={18} /> },
            { id: "assign", label: "Assign Work", icon: <Zap size={18} /> },
            { id: "items", label: "Consumption", icon: <Layers size={18} /> },
            { id: "requests", label: "Live Requests", icon: <ClipboardList size={18} /> }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`
                flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-semibold transition-all duration-300
                ${activeTab === tab.id
                  ? "bg-white text-indigo-600 shadow-md ring-1 ring-slate-200"
                  : "text-slate-500 hover:text-slate-900 hover:bg-white/40"
                }
              `}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>

        {/* Dashboard Tab */}
        {activeTab === "dashboard" && (
          <div className="space-y-8 animate-fadeIn">
            {/* Key Metrics Overview */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <Card
                title="Total Services"
                subtitle="Active in catalog"
                icon={<Archive size={20} />}
                className="bg-white border-l-4 border-indigo-500"
              >
                <div className="flex items-end justify-between mt-2">
                  <div className="text-4xl font-extrabold text-slate-800 tracking-tight">{totalServices}</div>
                  <div className="text-emerald-500 flex items-center gap-1 text-sm font-bold bg-emerald-50 px-2 py-1 rounded-lg">
                    <TrendingUp size={14} />
                    Live
                  </div>
                </div>
              </Card>

              <Card
                title="Total Assignments"
                subtitle="Work flow status"
                icon={<ClipboardList size={20} />}
                className="bg-white border-l-4 border-amber-500"
              >
                <div className="text-4xl font-extrabold text-slate-800 tracking-tight mb-2">{totalAssigned}</div>
                <div className="flex gap-3">
                  <span className="flex items-center gap-1 text-xs font-bold text-emerald-600">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    {completedCount} Done
                  </span>
                  <span className="flex items-center gap-1 text-xs font-bold text-amber-600">
                    <div className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                    {pendingCount} Pending
                  </span>
                </div>
              </Card>

              <Card
                title="Total Revenue"
                subtitle="Billing volume"
                icon={<IndianRupee size={20} />}
                className="bg-indigo-600 text-white"
              >
                <div className="text-4xl font-extrabold tracking-tight mt-2">
                  ₹{dashboardData.serviceStats.reduce((sum, s) => sum + s.total_revenue, 0).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                </div>
                <p className="text-xs text-white/70 mt-3 font-medium flex items-center gap-1">
                  <TrendingUp size={12} />
                  Net collection from completed
                </p>
              </Card>

              <Card
                title="Inventory Consumption"
                subtitle="Resources utilized"
                icon={<Package size={20} />}
                className="bg-slate-900 text-white"
              >
                <div className="text-4xl font-extrabold tracking-tight mt-2">{dashboardData.overallInventoryUsage.length}</div>
                <p className="text-xs text-slate-400 mt-3 font-medium">Distinct units assigned</p>
              </Card>
            </div>

            {/* Charts Row */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <Card
                title="Status Distribution"
                subtitle="Service lifecycle breakdown"
                icon={<PieIcon size={18} />}
              >
                <div className="h-[300px] w-full mt-4">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={pieData}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={90}
                        paddingAngle={5}
                        stroke="none"
                      >
                        {pieData.map((entry, index) => (
                          <Cell key={index} fill={COLORS[index % COLORS.length]} cornerRadius={4} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                      />
                      <Legend verticalAlign="bottom" height={36} iconType="circle" />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </Card>

              <Card
                title="Service Volume"
                subtitle="Assignments per category"
                icon={<BarIcon size={18} />}
              >
                <div className="h-[300px] w-full mt-4">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={barData}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis
                        dataKey="name"
                        axisLine={false}
                        tickLine={false}
                        tick={{ fill: '#64748b', fontSize: 12 }}
                        angle={-45}
                        textAnchor="end"
                        height={80}
                      />
                      <YAxis
                        axisLine={false}
                        tickLine={false}
                        tick={{ fill: '#64748b', fontSize: 12 }}
                        allowDecimals={false}
                      />
                      <Tooltip
                        cursor={{ fill: '#f8fafc' }}
                        contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                      />
                      <Bar dataKey="assigned" fill="#6366f1" radius={[4, 4, 0, 0]} barSize={32} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </Card>
            </div>

            {/* Service-Wise Statistics */}
            <Card
              title="Service Performance Data"
              subtitle="Revenue and inventory utilization per service type"
              icon={<TrendingUp size={18} />}
            >
              <div className="overflow-x-auto -mx-6">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50/50">
                      <th className="py-4 px-6 text-xs font-bold text-slate-500 uppercase tracking-widest border-b border-slate-100">Service</th>
                      <th className="py-4 px-6 text-xs font-bold text-slate-500 uppercase tracking-widest border-b border-slate-100 text-center">Velocity</th>
                      <th className="py-4 px-6 text-xs font-bold text-slate-500 uppercase tracking-widest border-b border-slate-100 text-center">Status</th>
                      <th className="py-4 px-6 text-xs font-bold text-slate-500 uppercase tracking-widest border-b border-slate-100 text-right">Revenue</th>
                      <th className="py-4 px-6 text-xs font-bold text-slate-500 uppercase tracking-widest border-b border-slate-100 text-center">Usage</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {dashboardData.serviceStats.length === 0 ? (
                      <tr>
                        <td colSpan="5" className="py-12 text-center text-slate-400 font-medium">
                          No service performance data found
                        </td>
                      </tr>
                    ) : (
                      dashboardData.serviceStats.map((stat) => (
                        <tr key={stat.service_id} className="hover:bg-slate-50/50 transition-colors group">
                          <td className="py-5 px-6">
                            <div className="font-bold text-slate-800">{stat.service_name}</div>
                            <div className="text-xs text-slate-400 mt-0.5 tracking-wide uppercase">ID: {stat.service_id}</div>
                          </td>
                          <td className="py-5 px-6">
                            <div className="flex flex-col items-center">
                              <div className="text-lg font-black text-slate-700">{stat.total_assignments}</div>
                              <div className="text-[10px] font-bold text-slate-400 uppercase">Assigned</div>
                            </div>
                          </td>
                          <td className="py-5 px-6">
                            <div className="flex justify-center gap-1.5">
                              {stat.completed > 0 && <span title="Completed" className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]" />}
                              {stat.in_progress > 0 && <span title="In Progress" className="w-2.5 h-2.5 rounded-full bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.4)]" />}
                              {stat.pending > 0 && <span title="Pending" className="w-2.5 h-2.5 rounded-full bg-slate-300" />}
                            </div>
                            <div className="text-[10px] font-bold text-slate-400 uppercase text-center mt-2">
                              {stat.completed}C / {stat.in_progress}P
                            </div>
                          </td>
                          <td className="py-5 px-6 text-right">
                            <div className="text-sm font-bold text-slate-900">₹{stat.total_revenue.toLocaleString('en-IN')}</div>
                            <div className="text-[10px] font-bold text-emerald-500 uppercase">Gross Revenue</div>
                          </td>
                          <td className="py-5 px-6">
                            <div className="flex justify-center">
                              {stat.inventory_items.length > 0 ? (
                                <details className="relative">
                                  <summary className="list-none cursor-pointer">
                                    <div className="px-3 py-1.5 bg-indigo-50 text-indigo-700 rounded-lg text-xs font-bold hover:bg-indigo-100 transition-colors border border-indigo-100 flex items-center gap-1.5">
                                      <Package size={12} />
                                      {stat.inventory_count} Units
                                    </div>
                                  </summary>
                                  <div className="absolute right-0 top-full mt-2 w-64 bg-white shadow-2xl rounded-xl p-4 z-20 border border-slate-100 animate-fadeIn">
                                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3 border-b border-slate-50 pb-2">Inventory Breakdown</h4>
                                    <div className="space-y-3 max-h-48 overflow-y-auto custom-scrollbar">
                                      {stat.inventory_items.map((item, itemIdx) => (
                                        <div key={itemIdx} className="flex justify-between items-start gap-2">
                                          <div className="flex-1 min-w-0">
                                            <div className="text-[11px] font-bold text-slate-700 truncate">{item.name}</div>
                                            <div className="text-[9px] text-slate-400 font-medium">₹{item.unit_price} / {item.unit}</div>
                                          </div>
                                          <div className="text-right">
                                            <div className="text-[10px] font-black text-indigo-600">{item.quantity_used}</div>
                                            <div className="text-[9px] font-bold text-slate-400 tracking-tighter">₹{item.total_cost.toFixed(0)}</div>
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                </details>
                              ) : (
                                <div className="text-[10px] font-bold text-slate-300 uppercase italic">Clean Service</div>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </Card>

            {/* Inventory Usage Breakdown */}
            <Card title="Overall Inventory Usage (Item-Wise)">
              <div className="overflow-x-auto">
                <table className="min-w-full border border-gray-200 rounded-lg">
                  <thead className="bg-gray-100 text-gray-700 uppercase tracking-wider">
                    <tr>
                      <th className="py-3 px-4 text-left">Item Name</th>
                      <th className="py-3 px-4 text-left">Item Code</th>
                      <th className="py-3 px-4 text-center">Total Quantity Used</th>
                      <th className="py-3 px-4 text-center">Unit</th>
                      <th className="py-3 px-4 text-center">Unit Price</th>
                      <th className="py-3 px-4 text-right">Total Cost (₹)</th>
                      <th className="py-3 px-4 text-center">Used In Services</th>
                      <th className="py-3 px-4 text-center">Assignments</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dashboardData.overallInventoryUsage.length === 0 ? (
                      <tr>
                        <td colSpan="8" className="py-8 text-center text-gray-500">
                          No inventory items used
                        </td>
                      </tr>
                    ) : (
                      dashboardData.overallInventoryUsage.map((item, idx) => (
                        <tr key={item.id} className={`${idx % 2 === 0 ? "bg-white" : "bg-gray-50"} hover:bg-gray-100 transition-colors`}>
                          <td className="py-3 px-4 font-semibold">{item.name}</td>
                          <td className="py-3 px-4 text-gray-600">{item.item_code || '-'}</td>
                          <td className="py-3 px-4 text-center font-semibold text-blue-600">
                            {item.quantity_used.toFixed(2)}
                          </td>
                          <td className="py-3 px-4 text-center text-gray-600">{item.unit}</td>
                          <td className="py-3 px-4 text-center">₹{item.unit_price.toFixed(2)}</td>
                          <td className="py-3 px-4 text-right font-semibold text-green-600">
                            ₹{item.total_cost.toFixed(2)}
                          </td>
                          <td className="py-3 px-4 text-center">
                            <span className="px-3 py-1 bg-purple-100 text-purple-800 rounded-full text-sm font-medium">
                              {item.services_count} services
                            </span>
                          </td>
                          <td className="py-3 px-4 text-center">
                            <span className="px-3 py-1 bg-indigo-100 text-indigo-800 rounded-full text-sm font-medium">
                              {item.assignments_count}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </Card>

            {/* Employee Performance */}
            {dashboardData.employeeStats.length > 0 && (
              <Card title="Employee Performance">
                <div className="overflow-x-auto">
                  <table className="min-w-full border border-gray-200 rounded-lg">
                    <thead className="bg-gray-100 text-gray-700 uppercase tracking-wider">
                      <tr>
                        <th className="py-3 px-4 text-left">Employee Name</th>
                        <th className="py-3 px-4 text-center">Total Assignments</th>
                        <th className="py-3 px-4 text-center">Completed</th>
                        <th className="py-3 px-4 text-center">In Progress</th>
                        <th className="py-3 px-4 text-center">Pending</th>
                        <th className="py-3 px-4 text-center">Completion Rate</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dashboardData.employeeStats.map((emp, idx) => {
                        const completionRate = emp.total_assignments > 0
                          ? ((emp.completed / emp.total_assignments) * 100).toFixed(1)
                          : 0;
                        return (
                          <tr key={emp.employee_id} className={`${idx % 2 === 0 ? "bg-white" : "bg-gray-50"} hover:bg-gray-100 transition-colors`}>
                            <td className="py-3 px-4 font-semibold">{emp.employee_name}</td>
                            <td className="py-3 px-4 text-center">
                              <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-medium">
                                {emp.total_assignments}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-center">
                              <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm font-medium">
                                {emp.completed}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-center">
                              <span className="px-3 py-1 bg-yellow-100 text-yellow-800 rounded-full text-sm font-medium">
                                {emp.in_progress}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-center">
                              <span className="px-3 py-1 bg-gray-100 text-gray-800 rounded-full text-sm font-medium">
                                {emp.pending}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-center">
                              <div className="flex items-center justify-center">
                                <div className="w-24 bg-gray-200 rounded-full h-2.5 mr-2">
                                  <div
                                    className="bg-green-600 h-2.5 rounded-full"
                                    style={{ width: `${completionRate}%` }}
                                  ></div>
                                </div>
                                <span className="text-sm font-semibold">{completionRate}%</span>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </Card>
            )}

            {/* Room-Wise Statistics */}
            {dashboardData.roomStats.length > 0 && (
              <Card title="Room-Wise Service Statistics">
                <div className="overflow-x-auto">
                  <table className="min-w-full border border-gray-200 rounded-lg">
                    <thead className="bg-gray-100 text-gray-700 uppercase tracking-wider">
                      <tr>
                        <th className="py-3 px-4 text-left">Room Number</th>
                        <th className="py-3 px-4 text-center">Total Services</th>
                        <th className="py-3 px-4 text-right">Revenue (₹)</th>
                        <th className="py-3 px-4 text-left">Services Used</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dashboardData.roomStats.map((room, idx) => (
                        <tr key={room.room_id} className={`${idx % 2 === 0 ? "bg-white" : "bg-gray-50"} hover:bg-gray-100 transition-colors`}>
                          <td className="py-3 px-4 font-semibold">Room {room.room_number}</td>
                          <td className="py-3 px-4 text-center">
                            <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-medium">
                              {room.total_services}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right font-semibold text-green-600">
                            ₹{room.total_revenue.toFixed(2)}
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex flex-wrap gap-1">
                              {room.services.slice(0, 3).map((service) => (
                                <span key={service.id} className="px-2 py-1 bg-indigo-100 text-indigo-800 rounded text-xs">
                                  {service.name}
                                </span>
                              ))}
                              {room.services.length > 3 && (
                                <span className="px-2 py-1 bg-gray-100 text-gray-600 rounded text-xs">
                                  +{room.services.length - 3} more
                                </span>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            )}

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Card title="Top Performing Service">
                {dashboardData.serviceStats.length > 0 ? (() => {
                  const topService = dashboardData.serviceStats.sort((a, b) => b.total_assignments - a.total_assignments)[0];
                  return (
                    <div className="space-y-2">
                      <div className="text-2xl font-bold text-indigo-600">{topService.service_name}</div>
                      <div className="text-sm text-gray-600">
                        <div>Assignments: <span className="font-semibold">{topService.total_assignments}</span></div>
                        <div>Revenue: <span className="font-semibold text-green-600">₹{topService.total_revenue.toFixed(2)}</span></div>
                        <div>Inventory Items: <span className="font-semibold">{topService.inventory_count}</span></div>
                      </div>
                    </div>
                  );
                })() : (
                  <p className="text-gray-500">No data available</p>
                )}
              </Card>

              <Card title="Most Used Inventory Item">
                {dashboardData.overallInventoryUsage.length > 0 ? (() => {
                  const topItem = dashboardData.overallInventoryUsage[0];
                  return (
                    <div className="space-y-2">
                      <div className="text-lg font-bold text-indigo-600">{topItem.name}</div>
                      <div className="text-sm text-gray-600">
                        <div>Quantity: <span className="font-semibold">{topItem.quantity_used.toFixed(2)} {topItem.unit}</span></div>
                        <div>Total Cost: <span className="font-semibold text-red-600">₹{topItem.total_cost.toFixed(2)}</span></div>
                        <div>Used in: <span className="font-semibold">{topItem.services_count} services</span></div>
                      </div>
                    </div>
                  );
                })() : (
                  <p className="text-gray-500">No data available</p>
                )}
              </Card>

              <Card title="Total Inventory Cost">
                <div className="space-y-2">
                  <div className="text-3xl font-bold text-red-600">
                    ₹{dashboardData.overallInventoryUsage.reduce((sum, item) => sum + item.total_cost, 0).toFixed(2)}
                  </div>
                  <div className="text-sm text-gray-600">
                    <div>Items: <span className="font-semibold">{dashboardData.overallInventoryUsage.length}</span></div>
                    <div>Total Quantity: <span className="font-semibold">
                      {dashboardData.overallInventoryUsage.reduce((sum, item) => sum + item.quantity_used, 0).toFixed(2)}
                    </span></div>
                  </div>
                </div>
              </Card>
            </div>

            {/* Recent Service Activity (Combined) */}
            <Card title="Recent Service Activity (Assigned & Requests)">
              <div className="overflow-x-auto">
                <table className="min-w-full border border-gray-200 rounded-lg">
                  <thead className="bg-gray-100 text-gray-700 uppercase tracking-wider">
                    <tr>
                      <th className="py-3 px-4 text-left">Type</th>
                      <th className="py-3 px-4 text-left">Service / Description</th>
                      <th className="py-3 px-4 text-left">Room</th>
                      <th className="py-3 px-4 text-left">Employee</th>
                      <th className="py-3 px-4 text-left">Status</th>
                      <th className="py-3 px-4 text-left">Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      ...assignedServices.map(s => ({
                        id: `as-${s.id}`,
                        type: 'Assigned',
                        name: s.service?.name || s.service_name || 'Service',
                        room: s.room?.number || s.room_number || '-',
                        employee: s.employee?.name || s.employee_name || '-',
                        status: s.status,
                        date: s.assigned_at,
                        isRequest: false,
                        original: s
                      })),
                      ...serviceRequests.map(r => ({
                        id: `req-${r.id}`,
                        type: r.request_type === 'cleaning' ? 'Cleaning' : r.request_type === 'refill' ? 'Refill' : r.request_type === 'replenishment' ? 'Replacement' : 'Request',
                        name: r.description || r.request_type,
                        room: r.room_number || '-',
                        employee: r.employee_name || '-',
                        status: r.status,
                        date: r.created_at,
                        isRequest: true,
                        original: r
                      }))
                    ]
                      .sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0))
                      .slice(0, 50) // Increased limit for better visibility
                      .map((item, idx) => (
                        <tr
                          key={item.id}
                          className={`${idx % 2 === 0 ? "bg-white" : "bg-gray-50"} hover:bg-gray-100 transition-colors cursor-pointer`}
                          onClick={() => setSelectedActivity(item)}
                        >
                          <td className="py-3 px-4">
                            <span className={`px-2 py-1 rounded text-xs font-medium ${item.type === 'Assigned' ? 'bg-blue-100 text-blue-800' :
                              item.type === 'Cleaning' ? 'bg-orange-100 text-orange-800' :
                                item.type === 'Replacement' ? 'bg-indigo-100 text-indigo-800' :
                                  'bg-purple-100 text-purple-800'
                              }`}>
                              {item.type}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            <div className="max-w-xs truncate" title={item.name}>{item.name}</div>
                          </td>
                          <td className="py-3 px-4 font-medium">Room {item.room}</td>
                          <td className="py-3 px-4 text-gray-600">{item.employee}</td>
                          <td className="py-3 px-4">
                            <span className={`px-2 py-1 rounded text-xs font-medium ${item.status === 'completed' ? 'bg-green-100 text-green-800' :
                              item.status === 'in_progress' ? 'bg-yellow-100 text-yellow-800' :
                                item.status === 'cancelled' ? 'bg-red-100 text-red-800' :
                                  'bg-gray-100 text-gray-800'
                              }`}>
                              {item.status}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-sm text-gray-500">
                            {item.date ? new Date(item.date).toLocaleString() : '-'}
                          </td>
                        </tr>
                      ))}
                    {[...assignedServices, ...serviceRequests].length === 0 && (
                      <tr>
                        <td colSpan="6" className="py-8 text-center text-gray-500">
                          No recent activity found
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </Card>

            {/* Service Requests Section */}
            <Card title={`Service Requests (${serviceRequests.length})`}>
              <div className="mb-4 flex justify-between items-center">
                <div className="flex gap-2">
                  <span className="px-3 py-1 rounded-full text-sm font-medium bg-yellow-100 text-yellow-800">
                    Pending: {serviceRequests.filter(r => r.status === 'pending').length}
                  </span>
                  <span className="px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800">
                    In Progress: {serviceRequests.filter(r => r.status === 'in_progress').length}
                  </span>
                  <span className="px-3 py-1 rounded-full text-sm font-medium bg-purple-100 text-purple-800">
                    Inventory Checked: {serviceRequests.filter(r => r.status === 'inventory_checked').length}
                  </span>
                  <span className="px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800">
                    Completed: {serviceRequests.filter(r => r.status === 'completed').length}
                  </span>
                  <span className="px-3 py-1 rounded-full text-sm font-medium bg-orange-100 text-orange-800">
                    Checkout Requests: {serviceRequests.filter(r => r.is_checkout_request || r.id > 1000000).length}
                  </span>
                </div>
                <button
                  onClick={() => setActiveTab("requests")}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium"
                >
                  View All Requests
                </button>
              </div>
              {loading ? (
                <div className="flex justify-center items-center h-48">
                  <Loader2 size={48} className="animate-spin text-indigo-500" />
                </div>
              ) : serviceRequests.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  No service requests found
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full border border-gray-200 rounded-lg">
                    <thead className="bg-gray-100 text-gray-700 uppercase tracking-wider">
                      <tr>
                        <th className="py-3 px-4 text-left">ID</th>
                        <th className="py-3 px-4 text-left">Room</th>
                        <th className="py-3 px-4 text-left">Food Order</th>
                        <th className="py-3 px-4 text-left">Request Type</th>
                        <th className="py-3 px-4 text-left">Description</th>
                        <th className="py-3 px-4 text-left">Employee</th>
                        <th className="py-3 px-4 text-left">Status</th>
                        <th className="py-3 px-4 text-left">Avg. Completion Time</th>
                        <th className="py-3 px-4 text-left">Created At</th>
                        <th className="py-3 px-4 text-left">Completed At</th>
                        <th className="py-3 px-4 text-left">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {serviceRequests.sort((a, b) => {
                        // Sort: pending first, then in_progress, then others
                        const statusOrder = { 'pending': 0, 'in_progress': 1, 'inventory_checked': 2, 'completed': 3, 'cancelled': 4 };
                        const aOrder = statusOrder[a.status] ?? 5;
                        const bOrder = statusOrder[b.status] ?? 5;
                        if (aOrder !== bOrder) return aOrder - bOrder;
                        // If same status, sort by created_at (newest first)
                        return new Date(b.created_at || 0) - new Date(a.created_at || 0);
                      }).map((request, idx) => {
                        const isCheckoutRequest = request.is_checkout_request;
                        const checkoutRequestId = isCheckoutRequest ? (request.checkout_request_id || request.id - 1000000) : null;

                        return (
                          <tr key={request.id} className={`${idx % 2 === 0 ? "bg-white" : "bg-gray-50"} hover:bg-gray-100 transition-colors ${isCheckoutRequest ? 'bg-yellow-50' : ''}`}>
                            <td className="p-3 border-t border-gray-200">
                              #{isCheckoutRequest ? checkoutRequestId :
                                (request.is_assigned_service || request.id >= 2000000 ?
                                  (request.assigned_service_id || request.id - 2000000) :
                                  request.id)}
                              {isCheckoutRequest && <span className="ml-2 text-xs text-yellow-600">(Checkout)</span>}
                            </td>
                            <td className="p-3 border-t border-gray-200">
                              {request.room_number ? `Room ${request.room_number}` : `Room ID: ${request.room_id}`}
                              {isCheckoutRequest && request.guest_name && (
                                <div className="text-xs text-gray-600 mt-1">Guest: {request.guest_name}</div>
                              )}
                            </td>
                            <td className="p-3 border-t border-gray-200">
                              {request.request_type === "cleaning" ? (
                                <span className="text-sm text-orange-600 font-medium">🧹 Cleaning Service</span>
                              ) : request.request_type === "refill" ? (
                                <span className="text-sm text-purple-600 font-medium">🔄 Refill Service</span>
                              ) : isCheckoutRequest ? (
                                <span className="text-sm text-gray-600">Checkout Verification</span>
                              ) : (
                                <div className="text-sm">
                                  {request.food_order_id ? (
                                    <>
                                      <div>Order #{request.food_order_id}</div>
                                      {request.food_order_amount && (
                                        <div className="text-gray-600">₹{request.food_order_amount.toFixed(2)}</div>
                                      )}
                                      {request.food_order_status && (
                                        <span className={`px-2 py-1 rounded text-xs ${request.food_order_status === 'completed' ? 'bg-green-100 text-green-800' :
                                          request.food_order_status === 'in_progress' ? 'bg-blue-100 text-blue-800' :
                                            'bg-gray-100 text-gray-800'
                                          }`}>
                                          {request.food_order_status}
                                        </span>
                                      )}
                                    </>
                                  ) : (
                                    <span className="text-gray-400 text-xs">No food order</span>
                                  )}
                                </div>
                              )}
                            </td>
                            <td className="p-3 border-t border-gray-200">
                              <span className={`px-2 py-1 rounded text-xs capitalize ${request.request_type === "cleaning" ? 'bg-orange-100 text-orange-800' :
                                request.request_type === "refill" ? 'bg-purple-100 text-purple-800' :
                                  isCheckoutRequest ? 'bg-yellow-100 text-yellow-800' : 'bg-blue-100 text-blue-800'
                                }`}>
                                {request.request_type === "cleaning" ? "🧹 cleaning" :
                                  request.request_type === "refill" ? "🔄 refill" :
                                    isCheckoutRequest ? 'checkout_verification' : (request.request_type || 'delivery')}
                              </span>
                            </td>
                            <td className="p-3 border-t border-gray-200">
                              <div className="max-w-xs truncate" title={request.description}>
                                {request.description || '-'}
                              </div>
                            </td>
                            <td className="p-3 border-t border-gray-200">
                              {request.employee_name || request.employee_id ? (
                                <span className="text-sm">{request.employee_name || `Employee #${request.employee_id}`}</span>
                              ) : (
                                <span className="text-gray-400 text-sm">Not assigned</span>
                              )}
                            </td>
                            <td className="p-3 border-t border-gray-200">
                              {(isCheckoutRequest || (request.status || "").toLowerCase() === "completed") ? (
                                <div className="flex flex-col gap-1 items-start">
                                  <span className={`px-2 py-1 rounded text-[10px] font-black uppercase tracking-widest ${(request.status || "").toLowerCase() === "completed" ? "bg-emerald-50 text-emerald-600 border border-emerald-100" :
                                    "bg-indigo-50 text-indigo-600 border border-indigo-100"
                                    }`}>
                                    {request.status || "pending"}
                                  </span>
                                  {request.billing_status && request.billing_status !== "unbilled" && (
                                    <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-tighter shadow-sm border ${request.billing_status === 'paid' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-rose-50 text-rose-600 border-rose-100'}`}>
                                      {request.billing_status}
                                    </span>
                                  )}
                                  {(request.status || "").toLowerCase() === "completed" && (
                                    <button
                                      onClick={() => {
                                        const asId = request.assigned_service_id || (request.is_assigned_service ? request.id - 2000000 : null);
                                        const linked = assignedServices.find(as => as.room?.id === request.room_id && (as.employee_id === request.employee_id || !as.employee_id));
                                        const targetId = asId || (linked ? linked.id : null);
                                        if (targetId) handleStatusChange(targetId, "completed");
                                        else showBannerMessage("error", "No linked mission telemetry found for this unit.");
                                      }}
                                      className="text-[9px] font-black text-indigo-500 hover:text-indigo-700 uppercase tracking-tighter"
                                    >
                                      Record Returns
                                    </button>
                                  )}
                                </div>
                              ) : (
                                <select
                                  value={request.status}
                                  onChange={(e) => handleUpdateRequestStatus(request.id, e.target.value)}
                                  className={`border p-2 rounded-lg bg-white text-sm ${request.status === 'completed' ? 'bg-green-50' :
                                    request.status === 'in_progress' ? 'bg-yellow-50' :
                                      request.status === 'cancelled' ? 'bg-red-50' :
                                        'bg-gray-50'
                                    }`}
                                >
                                  <option value="pending">Pending</option>
                                  <option value="in_progress">In Progress</option>
                                  <option value="completed">Completed</option>
                                  <option value="cancelled">Cancelled</option>
                                </select>
                              )}
                            </td>
                            <td className="p-3 border-t border-gray-200 text-sm">
                              {(request.status || "").toLowerCase() === "completed" && request.completed_at && request.created_at ? (
                                <div className="flex flex-col">
                                  <span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest leading-tight">Total Duration</span>
                                  <span className="font-bold text-slate-700">
                                    {(() => {
                                      const diff = new Date(request.completed_at) - new Date(request.created_at);
                                      const hours = Math.floor(diff / (1000 * 60 * 60));
                                      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
                                      if (hours > 0) return `${hours}h ${minutes}m`;
                                      return `${minutes}m`;
                                    })()}
                                  </span>
                                </div>
                              ) : request.service?.average_completion_time ? (
                                <span className="text-indigo-600 font-medium">{request.service.average_completion_time}</span>
                              ) : (
                                <span className="text-gray-400 italic">-</span>
                              )}
                            </td>
                            <td className="p-3 border-t border-gray-200 text-sm">
                              {request.created_at ? new Date(request.created_at).toLocaleString() : '-'}
                            </td>
                            <td className="p-3 border-t border-gray-200 text-sm">
                              {request.completed_at ? (
                                <span className="text-green-600">
                                  {new Date(request.completed_at).toLocaleString()}
                                </span>
                              ) : (
                                <span className="text-gray-400">-</span>
                              )}
                            </td>
                            <td className="p-3 border-t border-gray-200">
                              <div className="flex gap-2">
                                {isCheckoutRequest ? (
                                  <>
                                    {((request.status || "").toLowerCase() === "pending" || (request.status || "").toLowerCase() === "in_progress" || (request.status || "").toLowerCase() === "inventory_checked") ? (
                                      <>
                                        {!request.employee_id ? (
                                          <button
                                            onClick={() => handleQuickAssignFromRequest(request)}
                                            className="px-4 py-2 rounded-lg text-sm font-semibold bg-orange-500 hover:bg-orange-600 text-white shadow-md hover:shadow-lg transition-all duration-200"
                                            title="Assign employee first before verification"
                                          >
                                            ⚠ Assign Employee First
                                          </button>
                                        ) : (
                                          <button
                                            onClick={() => handleViewCheckoutInventory(checkoutRequestId)}
                                            className="px-4 py-2 rounded-lg text-sm font-semibold bg-blue-600 hover:bg-blue-700 text-white shadow-md hover:shadow-lg transition-all duration-200"
                                            title="View inventory details and verify"
                                          >
                                            ✓ Verify Inventory
                                          </button>
                                        )}
                                      </>
                                    ) : (request.status || "").toLowerCase() === "completed" ? (
                                      <span className="px-3 py-1 rounded text-sm font-medium bg-green-100 text-green-800">
                                        ✓ Completed
                                      </span>
                                    ) : null}
                                  </>
                                ) : (
                                  <div className="flex gap-2">
                                    {(request.status || "").toLowerCase() === "pending" && (
                                      <button
                                        onClick={!request.employee_id ? () => handleQuickAssignFromRequest(request) : () => handleUpdateRequestStatus(request.id, 'in_progress')}
                                        className={`px-3 py-1 rounded text-sm font-medium ${!request.employee_id ? 'bg-green-500 hover:bg-green-600' : 'bg-blue-500 hover:bg-blue-600'} text-white`}
                                        title={!request.employee_id ? "Assign Service" : "Accept & Start Request"}
                                      >
                                        {!request.employee_id ? "Assign" : "Accept"}
                                      </button>
                                    )}

                                    {(request.status || "").toLowerCase() === "in_progress" && (
                                      <div className="flex gap-1">
                                        <button
                                          onClick={() => handleUpdateRequestStatus(request.id, 'completed')}
                                          className="px-3 py-1 rounded text-sm font-medium bg-green-600 hover:bg-green-700 text-white"
                                          title="Mark as Completed (with return check)"
                                        >
                                          Complete
                                        </button>
                                        {request.is_assigned_service && (
                                          <button
                                            onClick={() => handleStatusChange(request.assigned_service_id, 'completed', true)}
                                            className="px-2 py-1 rounded text-[10px] font-bold bg-slate-200 hover:bg-slate-300 text-slate-700"
                                            title="Quick Complete without returns"
                                          >
                                            Quick
                                          </button>
                                        )}
                                      </div>
                                    )}

                                    {(request.status || "").toLowerCase() === "completed" && (
                                      <button
                                        onClick={() => {
                                          const asId = request.assigned_service_id || (request.is_assigned_service ? request.id - 2000000 : null);
                                          const linked = asId ? null : assignedServices.find(as => as.room?.id === request.room_id && (as.employee_id === request.employee_id || !as.employee_id));
                                          const targetId = asId || (linked ? linked.id : null);

                                          if (targetId) {
                                            handleStatusChange(targetId, 'completed');
                                          } else {
                                            showBannerMessage("error", "No linked inventory assignment found for this specific room/agent.");
                                          }
                                        }}
                                        className="px-2 py-1 rounded text-[11px] font-black uppercase tracking-tight bg-indigo-500 hover:bg-indigo-600 text-white flex items-center gap-1 shadow-sm active:scale-95 transition-all"
                                        title="Record inventory returns"
                                      >
                                        <Box size={10} /> Recovery
                                      </button>
                                    )}

                                    <button
                                      onClick={() => handleDeleteRequest(request.id)}
                                      className="px-3 py-1 rounded text-sm font-medium bg-red-500 hover:bg-red-600 text-white"
                                      title="Delete Request"
                                    >
                                      Delete
                                    </button>
                                  </div>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  {serviceRequests.length > 10 && (
                    <div className="mt-4 text-center">
                      <button
                        onClick={() => setActiveTab("requests")}
                        className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg text-sm font-medium"
                      >
                        View All {serviceRequests.length} Requests →
                      </button>
                    </div>
                  )}
                </div>
              )}
            </Card>
          </div>
        )}

        {/* Service Usage Report Section */}
        {showServiceReport && (
          <Card title="📊 Detailed Service Usage Report" className="mb-6">
            <div className="space-y-4">
              {/* Filters */}
              <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-4">
                <input
                  type="date"
                  value={reportFilters.from_date}
                  onChange={(e) => setReportFilters({ ...reportFilters, from_date: e.target.value })}
                  placeholder="From Date"
                  className="border p-2 rounded-lg"
                />
                <input
                  type="date"
                  value={reportFilters.to_date}
                  onChange={(e) => setReportFilters({ ...reportFilters, to_date: e.target.value })}
                  placeholder="To Date"
                  className="border p-2 rounded-lg"
                />
                <input
                  type="text"
                  value={reportFilters.room_number}
                  onChange={(e) => setReportFilters({ ...reportFilters, room_number: e.target.value })}
                  placeholder="Room Number"
                  className="border p-2 rounded-lg"
                />
                <input
                  type="text"
                  value={reportFilters.guest_name}
                  onChange={(e) => setReportFilters({ ...reportFilters, guest_name: e.target.value })}
                  placeholder="Guest Name"
                  className="border p-2 rounded-lg"
                />
                <button
                  onClick={fetchServiceReport}
                  disabled={reportLoading}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium disabled:opacity-50"
                >
                  {reportLoading ? "Loading..." : "Generate Report"}
                </button>
              </div>

              {/* Report Summary */}
              {serviceReport && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <span className="text-sm text-gray-600">Total Services:</span>
                      <p className="text-2xl font-bold text-gray-800">{serviceReport.total_services}</p>
                    </div>
                    <div>
                      <span className="text-sm text-gray-600">Total Charges:</span>
                      <p className="text-2xl font-bold text-green-600">₹{serviceReport.total_charges.toFixed(2)}</p>
                    </div>
                    <div>
                      <span className="text-sm text-gray-600">Date Range:</span>
                      <p className="text-lg font-semibold text-gray-800">
                        {serviceReport.from_date ? formatDateIST(serviceReport.from_date) : 'All'} -
                        {serviceReport.to_date ? formatDateIST(serviceReport.to_date) : 'All'}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Report Tabs */}
              {serviceReport && (
                <div className="space-y-4">
                  <div className="border-b border-gray-200">
                    <div className="flex space-x-4">
                      <button className="px-4 py-2 border-b-2 border-indigo-600 text-indigo-600 font-medium">
                        All Services ({serviceReport.services.length})
                      </button>
                    </div>
                  </div>

                  {/* Services Table */}
                  <div className="overflow-x-auto">
                    <table className="min-w-full border border-gray-200 rounded-lg">
                      <thead className="bg-gray-100 text-gray-700 uppercase tracking-wider">
                        <tr>
                          <th className="py-3 px-4 text-left">Service</th>
                          <th className="py-3 px-4 text-left">Guest</th>
                          <th className="py-3 px-4 text-left">Room</th>
                          <th className="py-3 px-4 text-left">Location</th>
                          <th className="py-3 px-4 text-left">Employee</th>
                          <th className="py-3 px-4 text-left">Charges</th>
                          <th className="py-3 px-4 text-left">Status</th>
                          <th className="py-3 px-4 text-left">Assigned</th>
                          <th className="py-3 px-4 text-left">Last Used</th>
                        </tr>
                      </thead>
                      <tbody>
                        {serviceReport.services.map((s, idx) => (
                          <tr key={idx} className={`${idx % 2 === 0 ? "bg-white" : "bg-gray-50"} hover:bg-gray-100`}>
                            <td className="p-3 border-t border-gray-200">
                              <div>
                                <span className="font-medium">{s.service_name}</span>
                                {s.service_description && (
                                  <p className="text-xs text-gray-500">{s.service_description}</p>
                                )}
                              </div>
                            </td>
                            <td className="p-3 border-t border-gray-200">
                              {s.guest_name || <span className="text-gray-400 italic">N/A</span>}
                            </td>
                            <td className="p-3 border-t border-gray-200">Room {s.room_number}</td>
                            <td className="p-3 border-t border-gray-200">
                              {s.location_name ? (
                                <div>
                                  <span className="font-medium">{s.location_name}</span>
                                  {s.location_type && (
                                    <p className="text-xs text-gray-500">{s.location_type}</p>
                                  )}
                                </div>
                              ) : (
                                <span className="text-gray-400 italic">N/A</span>
                              )}
                            </td>
                            <td className="p-3 border-t border-gray-200">{s.employee_name}</td>
                            <td className="p-3 border-t border-gray-200 font-semibold">₹{s.service_charges}</td>
                            <td className="p-3 border-t border-gray-200">
                              <span className={`px-2 py-1 rounded text-xs ${s.status === 'completed' ? 'bg-green-100 text-green-800' :
                                s.status === 'in_progress' ? 'bg-yellow-100 text-yellow-800' :
                                  'bg-gray-100 text-gray-800'
                                }`}>
                                {s.status}
                              </span>
                            </td>
                            <td className="p-3 border-t border-gray-200 text-sm">
                              {formatDateTimeIST(s.assigned_at)}
                            </td>
                            <td className="p-3 border-t border-gray-200 text-sm">
                              {s.last_used_at ? (
                                <span className="text-green-600 font-medium">
                                  {formatDateTimeIST(s.last_used_at)}
                                </span>
                              ) : (
                                <span className="text-gray-400 italic">Never</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Grouped Views */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
                    {/* By Room */}
                    {Object.keys(serviceReport.by_room).length > 0 && (
                      <div className="bg-white border border-gray-200 rounded-lg p-4">
                        <h3 className="font-semibold text-lg mb-3">By Room</h3>
                        <div className="space-y-2 max-h-64 overflow-y-auto">
                          {Object.entries(serviceReport.by_room).map(([room, services]) => (
                            <div key={room} className="border-b pb-2">
                              <div className="font-medium text-blue-600">Room {room}</div>
                              <div className="text-sm text-gray-600">{services.length} service(s)</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* By Guest */}
                    {Object.keys(serviceReport.by_guest).length > 0 && (
                      <div className="bg-white border border-gray-200 rounded-lg p-4">
                        <h3 className="font-semibold text-lg mb-3">By Guest</h3>
                        <div className="space-y-2 max-h-64 overflow-y-auto">
                          {Object.entries(serviceReport.by_guest).map(([guest, services]) => (
                            <div key={guest} className="border-b pb-2">
                              <div className="font-medium text-green-600">{guest}</div>
                              <div className="text-sm text-gray-600">{services.length} service(s)</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* By Location */}
                    {Object.keys(serviceReport.by_location).length > 0 && (
                      <div className="bg-white border border-gray-200 rounded-lg p-4">
                        <h3 className="font-semibold text-lg mb-3">By Location/Store</h3>
                        <div className="space-y-2 max-h-64 overflow-y-auto">
                          {Object.entries(serviceReport.by_location).map(([location, services]) => (
                            <div key={location} className="border-b pb-2">
                              <div className="font-medium text-purple-600">{location}</div>
                              <div className="text-sm text-gray-600">{services.length} service(s)</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {!serviceReport && !reportLoading && (
                <div className="text-center py-8 text-gray-500">
                  Click "Generate Report" to view detailed service usage report
                </div>
              )}
            </div>
          </Card>
        )}

        {/* Create Service Tab */}
        {activeTab === "create" && (
          <div className="space-y-6">
            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <Card
                title="Service Types"
                subtitle="Unique definitions"
                icon={<Layers size={20} />}
                className="bg-white"
              >
                <div className="text-4xl font-extrabold text-slate-800 tracking-tight">{totalServices}</div>
              </Card>
              <Card
                title="Guest Exposure"
                subtitle="Visible on mobile"
                icon={<Users size={20} />}
                className="bg-white"
              >
                <div className="text-4xl font-extrabold text-emerald-600 tracking-tight">{services.filter(s => s.is_visible_to_guest).length}</div>
              </Card>
              <Card
                title="Visual Catalog"
                subtitle="Services with media"
                icon={<Star size={20} />}
                className="bg-white"
              >
                <div className="text-4xl font-extrabold text-indigo-600 tracking-tight">{services.filter(s => s.images && s.images.length > 0).length}</div>
              </Card>
              <Card
                title="Resource Tied"
                subtitle="Linked to inventory"
                icon={<Box size={20} />}
                className="bg-white"
              >
                <div className="text-4xl font-extrabold text-amber-500 tracking-tight">{services.filter(s => s.inventory_items && s.inventory_items.length > 0).length}</div>
              </Card>
            </div>

            {/* Filters Section */}
            <div className="flex flex-wrap items-center gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-100">
              <div className="flex-1 min-w-[300px] relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input
                  type="text"
                  placeholder="Search master catalog..."
                  value={serviceFilters.search}
                  onChange={(e) => setServiceFilters({ ...serviceFilters, search: e.target.value })}
                  className="w-full bg-white border-none ring-1 ring-slate-200 focus:ring-2 focus:ring-indigo-500 pl-10 pr-4 py-2.5 rounded-xl text-sm transition-all"
                />
              </div>
              <div className="flex items-center gap-2">
                <Filter size={16} className="text-slate-400" />
                <select
                  value={serviceFilters.visible}
                  onChange={(e) => setServiceFilters({ ...serviceFilters, visible: e.target.value })}
                  className="bg-white border-none ring-1 ring-slate-200 focus:ring-2 focus:ring-indigo-500 px-4 py-2.5 rounded-xl text-sm transition-all min-w-[140px]"
                >
                  <option value="">Visibility: All</option>
                  <option value="true">Guest Visible</option>
                  <option value="false">Hidden</option>
                </select>
                <select
                  value={serviceFilters.hasInventory}
                  onChange={(e) => setServiceFilters({ ...serviceFilters, hasInventory: e.target.value })}
                  className="bg-white border-none ring-1 ring-slate-200 focus:ring-2 focus:ring-indigo-500 px-4 py-2.5 rounded-xl text-sm transition-all min-w-[140px]"
                >
                  <option value="">Type: All</option>
                  <option value="true">Inventory Tied</option>
                  <option value="false">Standard</option>
                </select>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    handleCancelEdit();
                    setShowCreateModal(true);
                  }}
                  className="flex items-center gap-2 px-6 py-2.5 bg-slate-900 hover:bg-indigo-600 text-white rounded-xl text-sm font-bold transition-all shadow-lg active:scale-95"
                >
                  <Plus size={18} />
                  Deploy New Service
                </button>
                <button
                  onClick={() => setServiceFilters({ search: "", visible: "", hasInventory: "", hasImages: "" })}
                  className="p-2.5 bg-white text-slate-500 hover:text-red-500 rounded-xl border border-slate-200 transition-colors"
                  title="Reset Filters"
                >
                  <RefreshCw size={18} />
                </button>
              </div>
            </div>

            <div className="space-y-6">

              {/* All Services Table */}
              <Card title="Master Service Catalog" icon={<Layers size={20} />}>
                {loading ? (
                  <div className="flex justify-center items-center h-48">
                    <Loader2 size={48} className="animate-spin text-indigo-500" />
                  </div>
                ) : (
                  <div className="overflow-x-auto -mx-6">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-50/50">
                          <th className="py-4 px-6 text-xs font-bold text-slate-500 uppercase tracking-widest border-b border-slate-100">Service Reference</th>
                          <th className="py-4 px-6 text-xs font-bold text-slate-500 uppercase tracking-widest border-b border-slate-100 text-right">Value (₹)</th>
                          <th className="py-4 px-6 text-xs font-bold text-slate-500 uppercase tracking-widest border-b border-slate-100 text-center">Efficiency</th>
                          <th className="py-4 px-6 text-xs font-bold text-slate-500 uppercase tracking-widest border-b border-slate-100 text-center">Status</th>
                          <th className="py-4 px-6 text-xs font-bold text-slate-500 uppercase tracking-widest border-b border-slate-100 text-right pr-8">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {(() => {
                          const filteredServices = services.filter(s => {
                            if (serviceFilters.search && !s.name.toLowerCase().includes(serviceFilters.search.toLowerCase()) && !s.description?.toLowerCase().includes(serviceFilters.search.toLowerCase())) return false;
                            if (serviceFilters.visible !== "" && s.is_visible_to_guest !== (serviceFilters.visible === "true")) return false;
                            if (serviceFilters.hasInventory !== "" && ((s.inventory_items && s.inventory_items.length > 0) !== (serviceFilters.hasInventory === "true"))) return false;
                            if (serviceFilters.hasImages !== "" && ((s.images && s.images.length > 0) !== (serviceFilters.hasImages === "true"))) return false;
                            return true;
                          });
                          return filteredServices.length === 0 ? (
                            <tr>
                              <td colSpan="5" className="py-20 text-center">
                                <div className="flex flex-col items-center gap-2">
                                  <Box className="text-slate-200" size={48} />
                                  <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">No records found in current view</p>
                                </div>
                              </td>
                            </tr>
                          ) : (
                            filteredServices.map((s) => (
                              <tr key={s.id} className="hover:bg-slate-50/50 transition-colors group">
                                <td className="py-5 px-6">
                                  <div className="flex items-center gap-4">
                                    <div className="relative flex-shrink-0 w-16 h-12 rounded-xl border border-slate-100 overflow-hidden bg-slate-50">
                                      {s.images && s.images.length > 0 ? (
                                        <img src={getImageUrl(s.images[0].image_url)} className="w-full h-full object-cover" />
                                      ) : (
                                        <div className="w-full h-full flex items-center justify-center text-slate-300"><Box size={16} /></div>
                                      )}
                                    </div>
                                    <div>
                                      <div className="font-black text-slate-800 tracking-tight">{s.name}</div>
                                      <div className="text-xs text-slate-400 font-medium truncate max-w-xs">{s.description || 'No description assigned'}</div>
                                    </div>
                                  </div>
                                </td>
                                <td className="py-5 px-6 text-right">
                                  <div className="text-sm font-black text-slate-900 tracking-tight">₹{s.charges.toLocaleString('en-IN')}</div>
                                  <div className="text-[10px] font-bold text-emerald-500 uppercase">Unit Price</div>
                                </td>
                                <td className="py-5 px-6 text-center">
                                  <div className="flex flex-col items-center">
                                    <div className="text-xs font-black text-slate-600 flex items-center gap-1">
                                      <Clock size={12} className="text-slate-400" />
                                      {s.average_completion_time || 'N/A'}
                                    </div>
                                    <div className="text-[9px] font-bold text-slate-400 uppercase mt-0.5 tracking-tighter">Est. Duration</div>
                                  </div>
                                </td>
                                <td className="py-5 px-6 text-center">
                                  <div className="flex flex-col items-center gap-1.5">
                                    <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${s.is_visible_to_guest ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-slate-100 text-slate-500 border border-slate-200'}`}>
                                      {s.is_visible_to_guest ? 'Public' : 'Hidden'}
                                    </span>
                                    {s.inventory_items && s.inventory_items.length > 0 && (
                                      <span className="text-[9px] font-bold text-indigo-500 flex items-center gap-1">
                                        <Package size={10} /> {s.inventory_items.length} Res linked
                                      </span>
                                    )}
                                  </div>
                                </td>
                                <td className="py-5 px-6 text-right">
                                  <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity translate-x-2 group-hover:translate-x-0 transition-transform">
                                    <button
                                      onClick={() => handleEditService(s)}
                                      className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-xl transition-colors border border-transparent hover:border-indigo-100"
                                      title="Edit Configuration"
                                    >
                                      <Plus size={18} className="rotate-45" />
                                    </button>
                                    <button
                                      onClick={() => handleDeleteService(s.id)}
                                      className="p-2 text-red-600 hover:bg-red-50 rounded-xl transition-colors border border-transparent hover:border-red-100"
                                      title="Mark Inactive"
                                    >
                                      <Archive size={18} />
                                    </button>
                                    <button
                                      onClick={() => handleToggleVisibility(s.id, s.is_visible_to_guest)}
                                      className={`p-2 rounded-xl transition-colors border border-transparent ${s.is_visible_to_guest ? 'text-amber-500 hover:bg-amber-50 hover:border-amber-100' : 'text-emerald-500 hover:bg-emerald-50 hover:border-emerald-100'}`}
                                      title={s.is_visible_to_guest ? 'Hide from Guests' : 'Publish to Guests'}
                                    >
                                      {s.is_visible_to_guest ? <X size={18} /> : <TrendingUp size={18} />}
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            ))
                          );
                        })()}
                      </tbody>
                    </table>
                  </div>
                )}
              </Card>
            </div>
          </div>
        )}

        {/* Items Used Tab */}
        {activeTab === "items" && (
          <div className="space-y-6">
            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <Card
                title="Unique Resources"
                subtitle="Active consumption"
                icon={<Layers size={20} />}
                className="bg-white"
              >
                <div className="text-4xl font-extrabold text-slate-800 tracking-tight">{dashboardData.overallInventoryUsage.length}</div>
              </Card>
              <Card
                title="Aggregate Volume"
                subtitle="Total throughput"
                icon={<Box size={20} />}
                className="bg-white border-l-4 border-indigo-500"
              >
                <div className="text-4xl font-extrabold text-indigo-600 tracking-tight">
                  {dashboardData.overallInventoryUsage.reduce((sum, item) => sum + item.quantity_used, 0).toFixed(0)}
                </div>
              </Card>
              <Card
                title="Resource Valuation"
                subtitle="Market value of usage"
                icon={<IndianRupee size={20} />}
                className="bg-white border-l-4 border-emerald-500"
              >
                <div className="text-4xl font-extrabold text-emerald-600 tracking-tight">
                  ₹{dashboardData.overallInventoryUsage.reduce((sum, item) => sum + item.total_cost, 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                </div>
              </Card>
              <Card
                title="Service Affinity"
                subtitle="Active integration"
                icon={<Activity size={20} />}
                className="bg-white border-l-4 border-amber-500"
              >
                <div className="text-4xl font-extrabold text-amber-600 tracking-tight">
                  {new Set(dashboardData.overallInventoryUsage.flatMap(item => item.services_used_in || [])).size}
                </div>
              </Card>
            </div>

            {/* Filters */}
            <Card title="Query Console" icon={<Search size={20} />}>
              <div className="flex flex-wrap gap-4">
                <div className="flex-1 min-w-[300px] relative">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <input
                    type="text"
                    placeholder="Identify Resource by Name or Serial..."
                    value={itemFilters.search}
                    onChange={(e) => setItemFilters({ ...itemFilters, search: e.target.value })}
                    className="w-full bg-slate-50 border-none ring-1 ring-slate-200 focus:ring-2 focus:ring-indigo-500 pl-11 pr-4 py-3 rounded-xl text-sm transition-all"
                  />
                </div>
                <select
                  value={itemFilters.service}
                  onChange={(e) => setItemFilters({ ...itemFilters, service: e.target.value })}
                  className="bg-slate-50 border-none ring-1 ring-slate-200 p-3 rounded-xl text-sm font-bold transition-all min-w-[200px]"
                >
                  <option value="">Filter by Linked Service</option>
                  {services.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
                <button
                  onClick={() => setItemFilters({ search: "", service: "", category: "" })}
                  className="px-6 py-3 bg-white hover:bg-slate-50 text-slate-400 hover:text-slate-600 rounded-xl text-xs font-black uppercase tracking-widest border border-slate-200 transition-all shadow-sm"
                >
                  Reset Parameters
                </button>
              </div>
            </Card>

            {/* Items Used Table */}
            <Card title="Resource Utilization Report" subtitle="Analytical breakdown of item consumption across service architecture" icon={<PieIcon size={20} />}>
              <div className="overflow-x-auto -mx-6">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50/50">
                      <th className="py-4 px-6 text-xs font-bold text-slate-500 uppercase tracking-widest border-b border-slate-100">Resource Unit / Code</th>
                      <th className="py-4 px-6 text-xs font-bold text-slate-500 uppercase tracking-widest border-b border-slate-100 text-center">Throughput</th>
                      <th className="py-4 px-6 text-xs font-bold text-slate-500 uppercase tracking-widest border-b border-slate-100 text-center">Unit Val.</th>
                      <th className="py-4 px-6 text-xs font-bold text-slate-500 uppercase tracking-widest border-b border-slate-100 text-right">Aggregate (₹)</th>
                      <th className="py-4 px-6 text-xs font-bold text-slate-500 uppercase tracking-widest border-b border-slate-100 text-right pr-8">Service Affinity</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {(() => {
                      const filteredItems = dashboardData.overallInventoryUsage.filter(item => {
                        if (itemFilters.search && !item.name.toLowerCase().includes(itemFilters.search.toLowerCase()) && !item.item_code?.toLowerCase().includes(itemFilters.search.toLowerCase())) return false;
                        if (itemFilters.service && !item.services_used_in.includes(parseInt(itemFilters.service))) return false;
                        return true;
                      });
                      return filteredItems.length === 0 ? (
                        <tr>
                          <td colSpan="5" className="py-20 text-center">
                            <div className="flex flex-col items-center gap-2 opacity-40">
                              <Box size={48} className="text-slate-200" />
                              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">No consumption data detected</p>
                            </div>
                          </td>
                        </tr>
                      ) : (
                        filteredItems.map((item) => (
                          <tr key={item.id} className="hover:bg-slate-50/50 transition-colors group">
                            <td className="py-5 px-6">
                              <div className="flex flex-col">
                                <span className="font-black text-slate-800 tracking-tight">{item.name}</span>
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{item.item_code || 'S-CODE-NA'}</span>
                              </div>
                            </td>
                            <td className="py-5 px-6 text-center">
                              <div className="text-xs font-black text-slate-700">{item.quantity_used.toFixed(1)} <span className="text-slate-400 font-medium">{item.unit}</span></div>
                              <div className="text-[9px] font-bold text-indigo-500 uppercase tracking-tighter">{item.assignments_count} DISPATCHES</div>
                            </td>
                            <td className="py-5 px-6 text-center">
                              <span className="text-xs font-bold text-slate-500">₹{item.unit_price.toFixed(0)}</span>
                            </td>
                            <td className="py-5 px-6 text-right">
                              <div className="text-sm font-black text-slate-900 tracking-tight">₹{item.total_cost.toLocaleString('en-IN')}</div>
                              <div className="text-[9px] font-bold text-emerald-500 uppercase tracking-widest">Gross Value</div>
                            </td>
                            <td className="py-5 px-6 text-right pr-8">
                              <div className="flex flex-wrap gap-1 justify-end">
                                {item.services_used_in?.slice(0, 2).map(serviceId => {
                                  const service = services.find(s => s.id === serviceId);
                                  return service ? (
                                    <span key={serviceId} className="px-2 py-0.5 bg-indigo-50 text-indigo-600 rounded text-[9px] font-black uppercase tracking-tighter border border-indigo-100">
                                      {service.name}
                                    </span>
                                  ) : null;
                                })}
                                {item.services_count > 2 && <span className="text-[9px] font-bold text-slate-400 border border-slate-100 rounded px-1.5 py-0.5">+{item.services_count - 2}</span>}
                              </div>
                            </td>
                          </tr>
                        ))
                      );
                    })()}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>
        )}

        {/* Assign & Manage Tab - Combined */}
        {activeTab === "assign" && (
          <div className="space-y-6">
            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <Card
                title="Active Missions"
                subtitle="Lifecycle total"
                icon={<Activity size={20} />}
                className="bg-white"
              >
                <div className="text-4xl font-extrabold text-slate-800 tracking-tight">{totalAssigned}</div>
              </Card>
              <Card
                title="Await Dispatch"
                subtitle="High priority"
                icon={<Clock size={20} />}
                className="bg-white border-l-4 border-amber-500"
              >
                <div className="text-4xl font-extrabold text-amber-600 tracking-tight">{pendingCount}</div>
              </Card>
              <Card
                title="Ground Operations"
                subtitle="In progress"
                icon={<Zap size={20} />}
                className="bg-white border-l-4 border-indigo-500"
              >
                <div className="text-4xl font-extrabold text-indigo-600 tracking-tight">{totalAssigned - pendingCount - completedCount}</div>
              </Card>
              <Card
                title="Success Rate"
                subtitle="Fulfilled tasks"
                icon={<IndianRupee size={20} />}
                className="bg-white border-l-4 border-emerald-500"
              >
                <div className="text-4xl font-extrabold text-emerald-600 tracking-tight">{completedCount}</div>
              </Card>
            </div>

            <div className="flex items-center justify-between">
              <h3 className="text-sm font-black text-slate-400 uppercase tracking-[0.2em]">Deployment Console</h3>
              <button
                onClick={() => {
                  setAssignForm({ service_id: "", employee_id: "", room_id: "", status: "pending" });
                  setSelectedServiceDetails(null);
                  setShowAssignModal(true);
                }}
                className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 hover:bg-slate-900 text-white rounded-xl text-sm font-bold transition-all shadow-lg active:scale-95 group"
              >
                <Zap size={18} className="text-amber-400 group-hover:scale-125 transition-transform" />
                Dispatch New Mission
              </button>
            </div>

            {/* Assigned Services Table */}
            <Card title="Active Operations Log" icon={<ClipboardList size={20} />}>
              <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Location Filter</label>
                  <select value={filters.room} onChange={(e) => setFilters({ ...filters, room: e.target.value })} className="w-full bg-slate-50 border-none ring-1 ring-slate-200 p-2.5 rounded-xl text-xs font-bold transition-all">
                    <option value="">All Regions</option>
                    {assignedServices.map((s) => s.room ? <option key={s.room.id} value={s.room.id}>Unit {s.room.number}</option> : null).filter(Boolean)}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Agent Filter</label>
                  <select value={filters.employee} onChange={(e) => setFilters({ ...filters, employee: e.target.value })} className="w-full bg-slate-50 border-none ring-1 ring-slate-200 p-2.5 rounded-xl text-xs font-bold transition-all">
                    <option value="">All Personnel</option>
                    {employees.map((e) => (
                      <option key={e.id} value={e.id}>{e.name} {e.is_clocked_in ? "•" : ""}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Status Filter</label>
                  <select value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })} className="w-full bg-slate-50 border-none ring-1 ring-slate-200 p-2.5 rounded-xl text-xs font-bold transition-all">
                    <option value="">All States</option>
                    <option value="pending">Await Dispatch</option>
                    <option value="in_progress">Ground Ops</option>
                    <option value="completed">Fulfilled</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">From Alpha</label>
                  <input type="date" value={filters.from} onChange={(e) => setFilters({ ...filters, from: e.target.value })} className="w-full bg-slate-50 border-none ring-1 ring-slate-200 p-2 text-xs font-bold rounded-xl" />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">To Omega</label>
                  <input type="date" value={filters.to} onChange={(e) => setFilters({ ...filters, to: e.target.value })} className="w-full bg-slate-50 border-none ring-1 ring-slate-200 p-2 text-xs font-bold rounded-xl" />
                </div>
              </div>

              {loading ? (
                <div className="flex justify-center items-center h-48">
                  <Loader2 size={48} className="animate-spin text-indigo-500" />
                </div>
              ) : (
                <div className="overflow-x-auto -mx-6">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50/50">
                        <th className="py-4 px-6 text-xs font-bold text-slate-500 uppercase tracking-widest border-b border-slate-100">Operation / Target</th>
                        <th className="py-4 px-6 text-xs font-bold text-slate-500 uppercase tracking-widest border-b border-slate-100">Designated Agent</th>
                        <th className="py-4 px-6 text-xs font-bold text-slate-500 uppercase tracking-widest border-b border-slate-100 text-center">Current Phase</th>
                        <th className="py-4 px-6 text-xs font-bold text-slate-500 uppercase tracking-widest border-b border-slate-100 text-right">Chronology</th>
                        <th className="py-4 px-6 text-xs font-bold text-slate-500 uppercase tracking-widest border-b border-slate-100 text-right pr-8">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredAssigned.length === 0 ? (
                        <tr>
                          <td colSpan="5" className="py-20 text-center">
                            <div className="flex flex-col items-center gap-2 opacity-40">
                              <Activity size={48} className="text-slate-200" />
                              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">No active operations found</p>
                            </div>
                          </td>
                        </tr>
                      ) : (
                        filteredAssigned.map((s) => (
                          <tr key={s.id} className="hover:bg-slate-50/50 transition-colors group">
                            <td className="py-5 px-6">
                              <div className="flex items-center gap-3">
                                <div className={`p-2 rounded-lg ${s.status === 'completed' ? 'bg-emerald-50 text-emerald-600' : 'bg-indigo-50 text-indigo-600'}`}>
                                  <Zap size={16} />
                                </div>
                                <div>
                                  <div className="font-black text-slate-800 tracking-tight">{s.service?.name}</div>
                                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1">
                                    <Package size={10} /> UNIT {s.room?.number}
                                  </div>
                                </div>
                              </div>
                            </td>
                            <td className="py-5 px-6">
                              <div className="flex flex-col">
                                <span className="text-sm font-black text-slate-700">{s.employee?.name}</span>
                                <button onClick={() => handleReassignEmployee(s)} className="text-[9px] font-black text-indigo-500 uppercase tracking-tighter hover:underline text-left">Re-route Mission</button>
                              </div>
                            </td>
                            <td className="py-5 px-6 text-center">
                              <select
                                value={s.status}
                                disabled={s.status === 'completed'}
                                onChange={(e) => handleStatusChange(s.id, e.target.value)}
                                className={`text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-lg border-none ring-1 transition-all appearance-none ${s.status === 'completed' ? 'bg-emerald-50 text-emerald-600 ring-emerald-100 cursor-not-allowed opacity-80' :
                                  s.status === 'in_progress' ? 'bg-indigo-50 text-indigo-600 ring-indigo-100 cursor-pointer' : 'bg-amber-50 text-amber-600 ring-amber-100 cursor-pointer'
                                  }`}
                              >
                                <option value="pending">Wait</option>
                                <option value="in_progress">Active</option>
                                <option value="completed">Done</option>
                              </select>
                            </td>
                            <td className="py-5 px-6 text-right">
                              <div className="flex flex-col">
                                <span className="text-[11px] font-black text-slate-800">{s.assigned_at ? new Date(ensureUTC(s.assigned_at)).toLocaleTimeString([], { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit' }) : 'N/A'}</span>
                                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">{s.assigned_at ? new Date(ensureUTC(s.assigned_at)).toLocaleDateString('en-GB', { timeZone: 'Asia/Kolkata' }) : 'NO TIMESTAMP'}</span>
                              </div>
                            </td>
                            <td className="py-5 px-6 text-right">
                              <div className="flex justify-end gap-2">
                                <button onClick={() => handleViewAssignedService(s)} className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-white rounded-xl transition-all shadow-sm" title="View Details">
                                  <LayoutDashboard size={14} />
                                </button>
                                <div className="flex gap-1">
                                  {(s.status || "").toLowerCase() !== 'completed' ? (
                                    <>
                                      <button
                                        onClick={() => handleStatusChange(s.id, 'completed')}
                                        className="p-2 text-slate-400 hover:text-emerald-600 hover:bg-white rounded-xl transition-all shadow-sm"
                                        title="Complete with Inventory Recovery"
                                      >
                                        <CheckCircle size={14} />
                                      </button>
                                      <button
                                        onClick={() => handleStatusChange(s.id, 'completed', true)}
                                        className="p-2 text-slate-400 hover:text-amber-600 hover:bg-white rounded-xl transition-all shadow-sm"
                                        title="Quick Complete (No Returns)"
                                      >
                                        <Zap size={14} />
                                      </button>
                                    </>
                                  ) : (
                                    <button
                                      onClick={() => handleStatusChange(s.id, 'completed')}
                                      className="p-2 text-indigo-500 hover:text-indigo-700 hover:bg-white rounded-xl transition-all shadow-sm border border-indigo-100 bg-indigo-50/30"
                                      title="Re-verify / Return Inventory"
                                    >
                                      <Box size={14} />
                                    </button>
                                  )}
                                </div>
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          </div>
        )}

        {/* Service Requests Tab */}
        {activeTab === "requests" && (
          <div className="space-y-6">
            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <Card
                title="Live Signals"
                subtitle="All active telemetry"
                icon={<Radio size={20} />}
                className="bg-white"
              >
                <div className="text-4xl font-extrabold text-slate-800 tracking-tight">{serviceRequests.length}</div>
              </Card>
              <Card
                title="Pending Triage"
                subtitle="High urgency"
                icon={<AlertTriangle size={20} />}
                className="bg-white border-l-4 border-amber-500"
              >
                <div className="text-4xl font-extrabold text-amber-600 tracking-tight">{serviceRequests.filter(r => r.status === 'pending').length}</div>
              </Card>
              <Card
                title="Current Processing"
                subtitle="Resource active"
                icon={<Activity size={20} />}
                className="bg-white border-l-4 border-indigo-500"
              >
                <div className="text-4xl font-extrabold text-indigo-600 tracking-tight">{serviceRequests.filter(r => r.status === 'in_progress').length}</div>
              </Card>
              <Card
                title="Resolved Cycles"
                subtitle="Fulfilled requests"
                icon={<CheckCircle size={20} />}
                className="bg-white border-l-4 border-emerald-500"
              >
                <div className="text-4xl font-extrabold text-emerald-600 tracking-tight">{serviceRequests.filter(r => r.status === 'completed').length}</div>
              </Card>
            </div>

            <Card title="Live Service Telemetry" subtitle="Real-time monitoring of guest and system requests" icon={<Radio size={20} />}>
              {loading ? (
                <div className="flex justify-center items-center h-48">
                  <Loader2 size={48} className="animate-spin text-indigo-500" />
                </div>
              ) : (
                <div className="overflow-x-auto -mx-6">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50/50">
                        <th className="py-4 px-6 text-xs font-bold text-slate-500 uppercase tracking-widest border-b border-slate-100">Signal ID</th>
                        <th className="py-4 px-6 text-xs font-bold text-slate-500 uppercase tracking-widest border-b border-slate-100">Origin / Unit</th>
                        <th className="py-4 px-6 text-xs font-bold text-slate-500 uppercase tracking-widest border-b border-slate-100">Request Vector</th>
                        <th className="py-4 px-6 text-xs font-bold text-slate-500 uppercase tracking-widest border-b border-slate-100">Assigned Agent</th>
                        <th className="py-4 px-6 text-xs font-bold text-slate-500 uppercase tracking-widest border-b border-slate-100 text-center">Protocol State</th>
                        <th className="py-4 px-6 text-xs font-bold text-slate-500 uppercase tracking-widest border-b border-slate-100 text-right pr-8">Control</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {serviceRequests.length === 0 ? (
                        <tr>
                          <td colSpan="6" className="py-20 text-center">
                            <div className="flex flex-col items-center gap-2 opacity-40">
                              <Radio size={48} className="text-slate-200" />
                              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">No active signals detected</p>
                            </div>
                          </td>
                        </tr>
                      ) : (
                        [...serviceRequests].sort((a, b) => {
                          const statusOrder = { 'pending': 0, 'in_progress': 1, 'inventory_checked': 2, 'completed': 3, 'cancelled': 4 };
                          const aOrder = statusOrder[a.status] ?? 5;
                          const bOrder = statusOrder[b.status] ?? 5;
                          if (aOrder !== bOrder) return aOrder - bOrder;
                          return new Date(b.created_at || 0) - new Date(a.created_at || 0);
                        }).map((request) => {
                          const isCheckoutRequest = request.is_checkout_request;
                          const checkoutRequestId = isCheckoutRequest ? (request.checkout_request_id || (parseInt(request.id) - 1000000)) : null;

                          return (
                            <tr key={request.id} className={`hover:bg-slate-50/50 transition-colors group ${isCheckoutRequest ? 'bg-amber-50/30' : ''}`}>
                              <td className="py-5 px-6">
                                <div className="flex flex-col">
                                  <span className="text-xs font-black text-slate-900 tracking-tight">#{isCheckoutRequest ? checkoutRequestId : request.id}</span>
                                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">{request.created_at ? new Date(request.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'LIVE'}</span>
                                </div>
                              </td>
                              <td className="py-5 px-6">
                                <div className="flex items-center gap-3">
                                  <div className={`p-2 rounded-lg ${isCheckoutRequest ? 'bg-amber-100 text-amber-600' : 'bg-slate-100 text-slate-600'}`}>
                                    <Zap size={14} />
                                  </div>
                                  <div>
                                    <div className="font-black text-slate-800 tracking-tight">{request.room_number ? `Unit ${request.room_number}` : `ID: ${request.room_id}`}</div>
                                    <div className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{request.guest_name || 'Anonymous Guest'}</div>
                                  </div>
                                </div>
                              </td>
                              <td className="py-5 px-6">
                                <div className="flex flex-col gap-1">
                                  <div className="flex items-center gap-2">
                                    {request.request_type === "cleaning" ? (
                                      <span className="px-2 py-0.5 rounded-md bg-orange-50 text-orange-600 text-[10px] font-black uppercase tracking-widest border border-orange-100">Sanitation</span>
                                    ) : request.request_type === "refill" ? (
                                      <span className="px-2 py-0.5 rounded-md bg-purple-50 text-purple-600 text-[10px] font-black uppercase tracking-widest border border-purple-100">Logistics</span>
                                    ) : isCheckoutRequest ? (
                                      <span className="px-2 py-0.5 rounded-md bg-amber-50 text-amber-600 text-[10px] font-black uppercase tracking-widest border border-amber-100">Exit Audit</span>
                                    ) : (
                                      <span className="px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-600 text-[10px] font-black uppercase tracking-widest border border-indigo-100">Service</span>
                                    )}
                                    <span className="text-xs font-bold text-slate-700">{request.request_type || 'General'}</span>
                                  </div>
                                  {request.request_type === "refill" && request.refill_data?.length > 0 && (
                                    <div className="text-[9px] font-bold text-slate-400 bg-slate-50 p-1 rounded border border-slate-100 mt-1">
                                      {request.refill_data.length} RESOURCE NODES REQD
                                    </div>
                                  )}
                                  {request.food_order_id && (
                                    <div className="flex flex-col gap-1 mt-1">
                                      <div className="flex items-center gap-2">
                                        <span className={`px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-widest border ${request.food_order_billing_status === 'paid'
                                          ? 'bg-emerald-50 text-emerald-600 border-emerald-100'
                                          : 'bg-orange-50 text-orange-600 border-orange-100'
                                          }`}>
                                          {request.food_order_billing_status === 'paid' ? 'PAID' : 'UNPAID'}
                                        </span>
                                        <span className="text-[10px] font-bold text-slate-500">₹{request.food_order_amount}</span>
                                      </div>
                                      {request.food_items && request.food_items.length > 0 && (
                                        <div className="text-[9px] text-slate-400 bg-slate-50/50 p-1 rounded border border-slate-100/50">
                                          {request.food_items.map(item => `${item.food_item_name} x${item.quantity}`).join(', ')}
                                        </div>
                                      )}
                                    </div>
                                  )}
                                </div>
                              </td>
                              <td className="py-5 px-6">
                                <select
                                  value={request.employee_id || ""}
                                  onChange={(e) => handleAssignEmployeeToRequest(request.id, e.target.value, null, request.status)}
                                  className="border border-slate-200 rounded-lg px-2 py-1 text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white max-w-[180px] truncate"
                                >
                                  <option value="">AWAIT ASSIGNMENT</option>
                                  {Array.isArray(employees) && [...employees]
                                    .sort((a, b) => {
                                      const aOnline = a.status === 'on_duty' || a.is_clocked_in;
                                      const bOnline = b.status === 'on_duty' || b.is_clocked_in;
                                      if (aOnline && !bOnline) return -1;
                                      if (!aOnline && bOnline) return 1;
                                      return 0;
                                    })
                                    .map((emp) => {
                                      const isOnline = emp.status === 'on_duty' || emp.is_clocked_in;
                                      return (
                                        <option key={emp.id} value={emp.id}>
                                          {emp.name} {isOnline ? "• ONLINE" : `• ${emp.status || 'OFFLINE'}`}
                                        </option>
                                      );
                                    })
                                  }
                                  {request.employee_id && !employees.some(emp => emp.id === request.employee_id) && (
                                    <option value={request.employee_id}>
                                      {request.employee_name || `Employee #${request.employee_id}`}
                                    </option>
                                  )}
                                </select>
                              </td>
                              <td className="py-5 px-6 text-center">
                                <div className="flex justify-center">
                                  <select
                                    value={request.status || 'pending'}
                                    onChange={(e) => handleUpdateRequestStatus(request.id, e.target.value)}
                                    className={`appearance-none text-center cursor-pointer px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border outline-none ${request.status === 'completed' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' :
                                      request.status === 'in_progress' ? 'bg-indigo-50 text-indigo-600 border-indigo-100' :
                                        request.status === 'cancelled' ? 'bg-red-50 text-red-600 border-red-100' : 'bg-amber-50 text-amber-600 border-amber-100'
                                      }`}
                                  >
                                    <option value="pending">PENDING</option>
                                    <option value="in_progress">IN PROGRESS</option>
                                    <option value="completed">COMPLETED</option>
                                    <option value="cancelled">CANCELLED</option>
                                  </select>
                                </div>
                              </td>
                              <td className="py-5 px-6 text-right">
                                <div className="flex justify-end gap-2 transition-all">
                                  {!request.employee_id && (
                                    <button
                                      onClick={() => setQuickAssignModal({ request: request, isReassignment: false, employeeId: '', pickupLocationId: '' })}
                                      className="p-2 bg-indigo-50 text-indigo-600 hover:bg-indigo-600 hover:text-white rounded-xl shadow-sm border border-indigo-100 transition-all"
                                      title="Dispatch Agent"
                                    >
                                      <Zap size={14} />
                                    </button>
                                  )}
                                  {isCheckoutRequest && request.employee_id && request.status !== 'completed' && request.status !== 'cancelled' && (
                                    <button
                                      onClick={() => handleViewCheckoutInventory(checkoutRequestId)}
                                      className="p-2 bg-emerald-50 text-emerald-600 hover:bg-emerald-600 hover:text-white rounded-xl shadow-sm border border-emerald-100 transition-all"
                                      title="Verify Inventory"
                                    >
                                      <ClipboardList size={14} />
                                    </button>
                                  )}
                                  <button
                                    onClick={() => setSelectedActivity({
                                      type: 'Request',
                                      name: request.request_type,
                                      room: request.room_number ? `Unit ${request.room_number}` : `ID: ${request.room_id}`,
                                      employee: request.employee_name || '-',
                                      date: request.created_at,
                                      status: request.status,
                                      id: request.id,
                                      original: request
                                    })}
                                    className="p-2 bg-white text-slate-400 hover:text-indigo-600 rounded-xl shadow-sm border border-slate-100 transition-all"
                                    title="View Details"
                                  >
                                    <LayoutDashboard size={14} />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          </div>
        )}

        {/* Quick Assign Service Modal */}
        {quickAssignModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full">
              <div className="p-6">
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-2xl font-bold text-gray-800">
                    {quickAssignModal.isReassignment
                      ? "Reassign Employee"
                      : (quickAssignModal.request && (quickAssignModal.request.is_checkout_request || quickAssignModal.request.id > 1000000 || quickAssignModal.request.request_type === 'checkout_verification' || quickAssignModal.request.request_type === 'checkout_settlement'))
                        ? "Assign Employee to Checkout Verification"
                        : "Assign Employee"}
                  </h2>
                  <button
                    onClick={() => setQuickAssignModal(null)}
                    className="text-gray-400 hover:text-gray-600 text-2xl font-bold"
                  >
                    ×
                  </button>
                </div>

                <div className="space-y-4">
                  {quickAssignModal.isReassignment ? (
                    <>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Service
                        </label>
                        <input
                          type="text"
                          value={quickAssignModal.assignedService?.service?.name || "N/A"}
                          disabled
                          className="w-full border p-3 rounded-lg bg-gray-100 text-gray-600"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Room
                        </label>
                        <input
                          type="text"
                          value={`Room ${quickAssignModal.assignedService?.room?.number || "N/A"}`}
                          disabled
                          className="w-full border p-3 rounded-lg bg-gray-100 text-gray-600"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Current Employee
                        </label>
                        <input
                          type="text"
                          value={quickAssignModal.assignedService?.employee?.name || "N/A"}
                          disabled
                          className="w-full border p-3 rounded-lg bg-gray-100 text-gray-600"
                        />
                      </div>
                    </>
                  ) : (
                    <>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Room
                        </label>
                        <input
                          type="text"
                          value={`Room ${quickAssignModal.request.room_number || quickAssignModal.request.room_id}`}
                          disabled
                          className="w-full border p-3 rounded-lg bg-gray-100 text-gray-600"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Description
                        </label>
                        <div className="w-full border p-3 rounded-lg bg-indigo-50/50 text-indigo-900 text-xs font-semibold">
                          {quickAssignModal.request.description || "No description provided."}
                        </div>
                      </div>

                      {/* Food Order Details */}
                      {quickAssignModal.request.food_items && quickAssignModal.request.food_items.length > 0 && (
                        <div className="bg-orange-50 p-4 rounded-xl border border-orange-100 mt-2">
                          <h3 className="text-[10px] font-black text-orange-600 uppercase tracking-widest mb-3 flex items-center gap-2">
                            <Zap size={14} />
                            Order Payload
                          </h3>
                          <div className="space-y-1">
                            {quickAssignModal.request.food_items.map((item, idx) => (
                              <div key={idx} className="flex justify-between text-[11px] py-1 border-b border-orange-100/50 last:border-0">
                                <span className="text-slate-800 font-bold">{item.food_item_name}</span>
                                <span className="text-orange-700 font-black">x{item.quantity}</span>
                              </div>
                            ))}
                          </div>
                          <div className="mt-3 pt-2 border-t border-orange-200 flex justify-between items-center">
                            <span className="text-[10px] font-black text-orange-400 uppercase tracking-widest">Total Valuation</span>
                            <span className="text-sm font-black text-orange-700">₹{quickAssignModal.request.food_order_amount || 0}</span>
                          </div>
                        </div>
                      )}
                    </>
                  )}

                  {/* Pickup Location for Replenishment */}
                  {quickAssignModal.request?.request_type === 'replenishment' && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Pickup Location <span className="text-red-500">*</span>
                      </label>
                      <select
                        value={quickAssignModal.pickupLocationId || ""}
                        onChange={(e) => setQuickAssignModal({ ...quickAssignModal, pickupLocationId: e.target.value })}
                        className="w-full border p-3 rounded-lg focus:ring-2 focus:ring-indigo-400"
                      >
                        <option value="">-- Select Pickup Location --</option>
                        {locations.filter(l => l.location_type === 'STORE' || l.location_type === 'LAUNDRY' || l.location_type === 'WAREHOUSE' || l.location_type === 'CENTRAL_WAREHOUSE' || l.location_type?.includes('WAREHOUSE')).map((loc) => (
                          <option key={loc.id} value={loc.id}>{loc.name} ({loc.location_type})</option>
                        ))}
                      </select>
                    </div>
                  )}

                  {/* Restock Details */}
                  {quickAssignModal.request?.refill_data && (
                    <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 mt-2">
                      <h3 className="text-[10px] font-black text-blue-600 uppercase tracking-widest mb-3 flex items-center gap-2">
                        <Package size={14} />
                        Restock Details
                      </h3>
                      <div className="space-y-2">
                        {(() => {
                          try {
                            const data = typeof quickAssignModal.request.refill_data === 'string'
                              ? JSON.parse(quickAssignModal.request.refill_data)
                              : quickAssignModal.request.refill_data;

                            const items = Array.isArray(data) ? data : [];

                            if (items.length === 0) return <p className="text-[10px] text-blue-400 italic">No specific items listed</p>;

                            return items.map((item, idx) => (
                              <div key={idx} className="flex justify-between items-center text-[11px] py-1 border-b border-blue-100/50 last:border-0 pb-1">
                                <div className="flex flex-col">
                                  <span className="text-slate-800 font-black">{item.item_name || 'Unknown Item'}</span>
                                  <span className="text-[8px] text-blue-500 font-bold uppercase">{item.is_fixed_asset ? 'Fixed Asset' : 'Consumable'}</span>
                                </div>
                                <div className="text-right">
                                  <span className="text-blue-700 font-black px-2 py-0.5 bg-blue-100 rounded-lg">{item.quantity} {item.unit || 'pcs'}</span>
                                </div>
                              </div>
                            ));
                          } catch (e) {
                            return <p className="text-[10px] text-red-400 italic">Error parsing items</p>;
                          }
                        })()}
                      </div>
                    </div>
                  )}

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      {quickAssignModal.isReassignment ? "New Employee" : "Select Employee"} <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={quickAssignModal.employeeId}
                      onChange={(e) => setQuickAssignModal({ ...quickAssignModal, employeeId: e.target.value })}
                      className="w-full border p-3 rounded-lg focus:ring-2 focus:ring-indigo-400"
                    >
                      <option value="">-- Select Employee --</option>
                      {employees.map((employee) => (
                        <option key={employee.id} value={employee.id}>
                          {employee.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="mt-6 flex justify-end gap-3">
                  <button
                    onClick={() => setQuickAssignModal(null)}
                    className="px-6 py-2 rounded-lg text-sm font-medium bg-gray-200 hover:bg-gray-300 text-gray-700"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleQuickAssignSubmit}
                    className="px-6 py-2 rounded-lg text-sm font-medium bg-indigo-600 hover:bg-indigo-700 text-white"
                  >
                    {quickAssignModal.isReassignment ? "Reassign Employee" : "Assign Employee"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* View Assigned Service Modal */}
        {viewingAssignedService && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
              <div className="p-6">
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-2xl font-bold text-gray-800">Assigned Service Details</h2>
                  <button
                    onClick={() => setViewingAssignedService(null)}
                    className="text-gray-500 hover:text-gray-700 text-2xl font-bold"
                  >
                    ×
                  </button>
                </div>

                <div className="space-y-6">
                  {/* Service Information */}
                  {viewingAssignedService.service && (
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                      <h3 className="font-semibold text-lg text-gray-800 mb-3">Service Information</h3>
                      <div className="space-y-2">
                        <div>
                          <span className="font-medium text-gray-700">Name:</span>
                          <span className="ml-2 text-gray-900">{viewingAssignedService.service.name}</span>
                        </div>
                        {viewingAssignedService.service.description && (
                          <div>
                            <span className="font-medium text-gray-700">Description:</span>
                            <p className="ml-2 text-gray-900 mt-1">{viewingAssignedService.service.description}</p>
                          </div>
                        )}
                        <div>
                          <span className="font-medium text-gray-700">Charges:</span>
                          <span className="ml-2 text-gray-900 font-semibold">₹{viewingAssignedService.service.charges}</span>
                        </div>
                        {viewingAssignedService.service.images && viewingAssignedService.service.images.length > 0 && (
                          <div className="mt-2">
                            <span className="font-medium text-gray-700">Images:</span>
                            <div className="flex gap-2 mt-2">
                              {viewingAssignedService.service.images.slice(0, 3).map((img, idx) => (
                                <img
                                  key={idx}
                                  src={getImageUrl(img.image_url)}
                                  alt={`${viewingAssignedService.service.name} ${idx + 1}`}
                                  className="w-20 h-20 object-cover rounded border"
                                  onError={(e) => {
                                    e.target.src = '/placeholder-image.png';
                                  }}
                                />
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Assignment Information */}
                  {/* Assignment Information */}
                  <div className="bg-slate-50/50 border border-slate-100 rounded-2xl p-6">
                    <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                      <Zap size={14} /> Mission Parameters
                    </h3>
                    <div className="grid grid-cols-2 gap-6">
                      <div className="space-y-1">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Designated Agent</span>
                        <div className="font-black text-slate-800">{viewingAssignedService.employee?.name || 'UNASSIGNED'}</div>
                      </div>
                      <div className="space-y-1">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Target Vector</span>
                        <div className="font-black text-slate-800">Unit {viewingAssignedService.room?.number || 'EXT-LOC'}</div>
                      </div>
                      <div className="space-y-1">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Protocol State</span>
                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-widest border ${viewingAssignedService.status === 'completed' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-indigo-50 text-indigo-600 border-indigo-100'
                            }`}>
                            {viewingAssignedService.status || 'PENDING'}
                          </span>
                        </div>
                      </div>
                      <div className="space-y-1">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Dispatch Time</span>
                        <div className="font-black text-slate-800">
                          {viewingAssignedService.assigned_at ? formatDateTimeIST(viewingAssignedService.assigned_at) : 'N/A'}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Inventory Items Needed */}
                  {/* Inventory Items Needed */}
                  {(() => {
                    const inventoryItems = viewingAssignedService.service?.inventory_items;
                    if (inventoryItems && Array.isArray(inventoryItems) && inventoryItems.length > 0) {
                      return (
                        <div className="bg-indigo-50/30 border border-indigo-100/50 rounded-2xl p-6">
                          <h3 className="text-xs font-black text-indigo-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                            <Box size={14} /> Allocated Resources
                          </h3>
                          <div className="space-y-3">
                            {inventoryItems.map((item, idx) => (
                              <div key={idx} className="flex items-center justify-between p-4 bg-white/60 backdrop-blur-md rounded-xl border border-white shadow-sm">
                                <div className="flex flex-col">
                                  <span className="font-black text-slate-800 text-sm tracking-tight">{item.name}</span>
                                  {item.item_code && <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{item.item_code}</span>}
                                </div>
                                <div className="text-right">
                                  <div className="text-sm font-black text-indigo-600">
                                    {item.quantity} <span className="text-[10px] uppercase font-bold text-slate-400">{item.unit}</span>
                                  </div>
                                  {item.unit_price > 0 && <div className="text-[9px] font-bold text-slate-400">@ ₹{item.unit_price.toFixed(0)}</div>}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    }
                    return (
                      <div className="bg-slate-50/50 border border-slate-100 rounded-2xl p-6 text-center">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">No additional resource nodes required</p>
                      </div>
                    );
                  })()}

                  {/* Returned Inventory Items */}
                  {returnedItems && returnedItems.length > 0 && (
                    <div className="bg-emerald-50/30 border border-emerald-100/50 rounded-2xl p-6">
                      <h3 className="text-xs font-black text-emerald-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                        <CheckCircle size={14} /> Telemetry Verification
                      </h3>
                      <div className="space-y-3">
                        {returnedItems.map((item, idx) => (
                          <div key={idx} className="p-4 bg-white/60 backdrop-blur-md rounded-xl border border-white shadow-sm">
                            <div className="flex items-center justify-between mb-3 pb-3 border-b border-emerald-50">
                              <div className="flex flex-col">
                                <span className="font-black text-slate-800 text-sm">{item.item?.name || item.item_name}</span>
                                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{item.item?.item_code || 'S-UNIT-VAL'}</span>
                              </div>
                              <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-widest ${item.status === 'returned' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                                {item.status?.replace('_', ' ')}
                              </span>
                            </div>
                            <div className="grid grid-cols-3 gap-2">
                              <div className="text-center p-2 bg-slate-50 rounded-lg">
                                <div className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">Assigned</div>
                                <div className="text-xs font-black text-slate-700">{item.quantity_assigned}</div>
                              </div>
                              <div className="text-center p-2 bg-slate-50 rounded-lg">
                                <div className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">Consumption</div>
                                <div className="text-xs font-black text-indigo-600">{item.quantity_used}</div>
                              </div>
                              <div className="text-center p-2 bg-emerald-50 rounded-lg">
                                <div className="text-[9px] font-bold text-emerald-600 uppercase tracking-widest mb-1">Recovery</div>
                                <div className="text-xs font-black text-emerald-700">{item.quantity_returned}</div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {(!returnedItems || returnedItems.length === 0) && viewingAssignedService.status === "completed" && (
                    <div className="bg-slate-50 border border-slate-100 rounded-2xl p-6 text-center">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">No recovery telemetry recorded</p>
                    </div>
                  )}
                </div>

                <div className="mt-6 flex justify-between gap-2">
                  <button
                    onClick={() => {
                      const svcId = viewingAssignedService.id;
                      setViewingAssignedService(null);
                      setReturnedItems([]);
                      handleStatusChange(svcId, 'completed');
                    }}
                    className="px-6 py-2 rounded-lg text-xs font-black uppercase tracking-widest bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg active:scale-95 transition-all"
                  >
                    Inventory Returns / Recovery
                  </button>
                  <button
                    onClick={() => {
                      setViewingAssignedService(null);
                      setReturnedItems([]);
                    }}
                    className="px-6 py-2 rounded-lg text-sm font-medium bg-slate-200 hover:bg-slate-300 text-slate-700"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Return Inventory Modal - When completing service */}
        {completingServiceId && inventoryAssignments.length > 0 && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col border border-slate-100">
              <div className="p-8 border-b border-slate-50 flex justify-between items-center bg-slate-50/30">
                <div>
                  <h2 className="text-2xl font-black text-slate-800 tracking-tight">Resource Recovery <span className="text-[10px] text-indigo-500 font-normal">v2.4-FIXED-VALIDATION</span></h2>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">Finalizing mission & returning units</p>
                </div>
                <button
                  onClick={() => {
                    setCompletingServiceId(null);
                    setInventoryAssignments([]);
                    setReturnQuantities({});
                    setUsedQuantities({});
                    setReturnLocationId(null);
                  }}
                  className="p-2 hover:bg-white rounded-xl transition-colors text-slate-400 hover:text-slate-600 border border-transparent hover:border-slate-100"
                >
                  <X size={24} />
                </button>
              </div>

              <div className="p-8 overflow-y-auto space-y-6">
                <div className="p-4 bg-indigo-50 border border-indigo-100 rounded-2xl flex items-start gap-4">
                  <div className="p-2 bg-white rounded-xl shadow-sm text-indigo-600"><AlertCircle size={20} /></div>
                  <div className="space-y-1">
                    <p className="text-sm font-black text-indigo-900">Telemetry Calibration Required</p>
                    <p className="text-[11px] font-medium text-indigo-700 leading-relaxed">
                      Confirm recovery of unconsumed nodes. Items not returned will be logged as consumed.
                    </p>
                  </div>
                </div>

                <div className="space-y-4">
                  {inventoryAssignments.map((assignment) => {
                    // Handle both nested and flat structures
                    const itemName = assignment.item?.name || assignment.name || 'NODE-UNDEFINED';
                    const itemUnit = assignment.item?.unit || assignment.unit || 'pcs';
                    const itemCode = assignment.item?.item_code || assignment.item_code || 'S-UNIT';

                    // Fallback to 'quantity' if 'quantity_assigned' is missing
                    const assignedQty = assignment.quantity_assigned !== undefined ? assignment.quantity_assigned : (assignment.quantity || 0);
                    const alreadyReturned = assignment.quantity_returned || 0;
                    const maxReturnable = Math.max(0, assignedQty - alreadyReturned);
                    const currentReturnVal = returnQuantities[assignment.id];
                    const currentReturn = currentReturnVal !== undefined && currentReturnVal !== '' ? parseFloat(currentReturnVal) : 0;
                    const damageQtyVal = parseFloat(damageQuantities[assignment.id] || 0);
                    const calculatedUsedRaw = Math.max(0, assignedQty - alreadyReturned - currentReturn - damageQtyVal);
                    const isPcs = (assignment.item?.unit || 'pcs').toLowerCase() === 'pcs';
                    const calculatedUsed = isPcs ? Math.round(calculatedUsedRaw) : Number(calculatedUsedRaw.toFixed(3));

                    return (
                      <div key={assignment.id} className="p-6 rounded-2xl border border-slate-100 bg-white hover:border-indigo-100 transition-all group">
                        <div className="flex justify-between items-start mb-6 pb-6 border-b border-slate-50">
                          <div className="space-y-1">
                            <h4 className="font-black text-slate-800 tracking-tight group-hover:text-indigo-600 transition-colors">
                              {itemName}
                            </h4>
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{itemCode}</span>
                              <span className="w-1 h-1 bg-slate-200 rounded-full"></span>
                              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{assignment.assigned_service?.service?.name || 'SERVICE'}</span>
                            </div>
                          </div>
                          <div className="text-right space-y-1">
                            <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Allocated</div>
                            <div className="text-sm font-black text-slate-800">{assignedQty} <span className="text-[10px] font-bold text-slate-400">{itemUnit}</span></div>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-6">
                          <div className="space-y-2">
                            <label className="text-[10px] font-black text-emerald-500 uppercase tracking-widest flex items-center gap-1.5">
                              <CheckCircle size={10} /> Recovery Node
                            </label>
                            <input
                              type="number"
                              min="0"
                              max={maxReturnable}
                              step={isPcs ? "1" : "0.01"}
                              value={currentReturn}
                              onKeyDown={(e) => {
                                if (isPcs && (e.key === '.' || e.key === ',' || e.key === 'e')) e.preventDefault();
                              }}
                              onChange={(e) => {
                                let val = parseFloat(e.target.value);
                                if (isNaN(val)) val = 0;
                                if (isPcs) val = Math.floor(val);
                                val = Math.max(0, Math.min(val, maxReturnable));
                                setReturnQuantities({ ...returnQuantities, [assignment.id]: val });
                              }}
                              className="w-full bg-slate-50 border-none ring-1 ring-slate-200 focus:ring-2 focus:ring-emerald-500 p-3 rounded-xl text-sm font-black text-emerald-700 transition-all"
                            />
                            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Available for recovery: {maxReturnable}</p>
                          </div>

                          <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                              <Zap size={10} /> Consumed Nodes
                            </label>
                            <input
                              type="number"
                              min="0"
                              max={assignedQty - alreadyReturned}
                              step={isPcs ? "1" : "0.01"}
                              value={calculatedUsed}
                              onKeyDown={(e) => {
                                if (isPcs && (e.key === '.' || e.key === ',' || e.key === 'e')) e.preventDefault();
                              }}
                              onChange={(e) => {
                                let val = parseFloat(e.target.value);
                                if (isNaN(val)) val = 0;
                                if (isPcs) val = Math.floor(val);
                                // Ensure used qty doesn't exceed available
                                val = Math.max(0, Math.min(val, assignedQty - alreadyReturned));

                                // Calculate return qty based on used qty
                                // Returned = Total - Used - AlreadyReturned
                                const newReturnVal = Math.max(0, assignedQty - alreadyReturned - val);
                                setReturnQuantities({ ...returnQuantities, [assignment.id]: newReturnVal });
                              }}
                              className="w-full bg-slate-50 border-none ring-1 ring-slate-200 focus:ring-2 focus:ring-emerald-500 p-3 rounded-xl text-sm font-black text-slate-800 transition-all"
                            />
                            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Mark as used/consumed</p>
                          </div>
                        </div>

                        {/* Damage Input Section */}
                        <div className="mt-6 pt-6 border-t border-slate-50 flex items-center gap-6">
                            <div className="flex-1 space-y-2">
                                <label className="text-[10px] font-black text-rose-500 uppercase tracking-widest flex items-center gap-1.5">
                                    <AlertTriangle size={10} /> Damage Node
                                </label>
                                <div className="flex items-center gap-3">
                                    <input
                                        type="number"
                                        min="0"
                                        max={maxReturnable - currentReturn}
                                        step={isPcs ? "1" : "0.01"}
                                        value={damageQuantities[assignment.id] || 0}
                                        onChange={(e) => {
                                            let val = parseFloat(e.target.value);
                                            if (isNaN(val)) val = 0;
                                            if (isPcs) val = Math.floor(val);
                                            // Max damage is what's left after clean returns
                                            const maxDamage = Math.max(0, maxReturnable - currentReturn);
                                            val = Math.max(0, Math.min(val, maxDamage));
                                            setDamageQuantities({ ...damageQuantities, [assignment.id]: val });
                                        }}
                                        className="w-full bg-rose-50 border-none ring-1 ring-rose-100 focus:ring-2 focus:ring-rose-500 p-3 rounded-xl text-sm font-black text-rose-700 transition-all"
                                    />
                                    <div className="flex flex-col">
                                        <span className="text-[10px] font-black text-rose-900 leading-none">RECORD WASTE</span>
                                        <span className="text-[8px] font-bold text-rose-400 uppercase tracking-widest mt-1">LOGS AUTOMATICALLY</span>
                                    </div>
                                </div>
                            </div>
                            <div className="flex-1">
                                <p className="text-[10px] text-slate-400 font-medium leading-relaxed italic">
                                    Items marked here will be removed from stock and recorded in the system's damage/waste logs for this room.
                                </p>
                            </div>
                        </div>

                        <div style={{ marginTop: '24px', padding: '16px', backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '16px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                            <span style={{ fontSize: '10px', fontWeight: '900', color: '#64748b', textTransform: 'uppercase' }}>
                              📍 Item Destination
                            </span>
                            <button
                              onClick={() => {
                                const laundry = locations?.find(l => l.location_type?.toLowerCase().includes('laundry') || l.name?.toLowerCase().includes('laundry'));
                                if (laundry) setReturnLocations({ ...returnLocations, [assignment.id]: laundry.id });
                              }}
                              style={{ fontSize: '9px', fontWeight: '900', color: '#4f46e5', backgroundColor: 'white', border: '1px solid #e2e8f0', padding: '2px 8px', borderRadius: '6px', cursor: 'pointer' }}
                            >
                              SEND TO LAUNDRY
                            </button>
                          </div>
                          <select
                            style={{ width: '100%', padding: '12px', border: '1px solid #cbd5e1', borderRadius: '12px', fontSize: '12px', fontWeight: '900', backgroundColor: 'white' }}
                            value={returnLocations[assignment.id] || ""}
                            onChange={(e) => {
                              const val = e.target.value ? parseInt(e.target.value) : "";
                              setReturnLocations({ ...returnLocations, [assignment.id]: val });
                            }}
                          >
                            <option value="">Select Return Destination...</option>
                            {locations?.map(loc => (
                              <option key={loc.id} value={loc.id}>{loc.name} {loc.location_type ? `(${loc.location_type})` : ''}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="p-8 border-t border-slate-50 bg-slate-50/30 flex justify-end gap-3">
                <button
                  onClick={() => {
                    setCompletingServiceId(null);
                    setInventoryAssignments([]);
                    setReturnQuantities({});
                    setUsedQuantities({});
                    setReturnLocations({});
                    setReturnLocationId(null);
                  }}
                  className="px-6 py-3 rounded-xl text-xs font-black uppercase tracking-widest text-slate-400 hover:text-slate-600 bg-white border border-slate-200 hover:border-slate-300 transition-all font-bold"
                >
                  ABORT
                </button>
                <button
                  onClick={async () => {
                    if (!completingServiceId) return;
                    try {
                      // Include billing status if present (e.g. from payment modal)
                      const payload = { status: "completed", inventory_returns: [] };
                      if (completingBillingStatus) {
                        payload.billing_status = completingBillingStatus;
                      }
                      await api.patch(`/services/assigned/${completingServiceId}`, payload);

                      setCompletingServiceId(null);
                      setCompletingBillingStatus(null);
                      setInventoryAssignments([]);
                      setCompletingRequestId(null);
                      fetchAll();
                    } catch (error) {
                      showBannerMessage("error", `Failed: ${error.message}`);
                    }
                  }}
                  className="px-6 py-3 rounded-xl text-xs font-black uppercase tracking-widest text-slate-500 hover:text-slate-900 transition-all"
                >
                  VERIFY ALL CONSUMED
                </button>
                <button
                  onClick={handleCompleteWithReturns}
                  className="px-8 py-3 rounded-xl text-xs font-black uppercase tracking-widest text-white bg-indigo-600 hover:bg-indigo-700 shadow-lg shadow-indigo-200 active:scale-95 transition-all"
                >
                  EXECUTE RECOVERY
                </button>
              </div>
            </div>
          </div>
        )
        }
        {/* Checkout Inventory Verification Modal */}
        {
          checkoutInventoryModal && checkoutInventoryDetails && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
              <div className="bg-white rounded-lg p-6 max-w-4xl w-full max-h-[90vh] overflow-y-auto">
                <h2 className="text-2xl font-bold mb-4">Checkout Inventory Verification</h2>
                <div className="mb-4">
                  <p><strong>Room:</strong> {checkoutInventoryDetails.room_number}</p>
                  <p><strong>Guest:</strong> {checkoutInventoryDetails.guest_name}</p>
                  {checkoutInventoryDetails.location_name && (
                    <p><strong>Location:</strong> {checkoutInventoryDetails.location_name}</p>
                  )}
                </div>

                {/* Fixed Assets Section */}
                {checkoutInventoryDetails.fixed_assets && checkoutInventoryDetails.fixed_assets.length > 0 && (
                  <div className="mb-6">
                    <h3 className="text-lg font-semibold mb-3 text-red-700">Fixed Assets Check</h3>
                    <div className="bg-red-50 p-4 rounded-lg border border-red-100">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-red-200">
                            <th className="text-left py-2 font-medium text-red-800 w-1/5">Asset Name</th>
                            <th className="text-left py-2 font-medium text-red-800 w-1/6">Serial No.</th>
                            <th className="text-center py-2 font-medium text-red-800 w-1/12">Current</th>
                            <th className="text-center py-2 font-medium text-red-800 w-1/12">Available</th>
                            <th className="text-right py-2 font-medium text-red-800 w-1/12">Cost</th>
                            <th className="text-center py-2 font-medium text-red-800 w-1/12">Damaged?</th>
                            <th className="text-left py-2 font-medium text-red-800 w-1/6">Return / Action</th>
                            <th className="text-center py-2 font-medium text-red-800 w-1/12">Replace?</th>
                          </tr>
                        </thead>
                        <tbody>
                          {checkoutInventoryDetails.fixed_assets.map((asset, idx) => (
                            <tr key={idx} className="border-b border-red-100 last:border-0 hover:bg-red-50 transition-colors">
                              <td className="py-2 text-gray-800 font-medium">
                                {asset.item_name}
                                <div className="text-xs text-gray-500">{asset.asset_tag}</div>
                              </td>
                              <td className="py-2 text-gray-600 border-l border-r border-red-100 px-2 font-mono text-xs">
                                {asset.serial_number || '-'}
                              </td>
                              <td className="py-2 text-center text-gray-600">{asset.current_stock}</td>
                              <td className="py-2 text-center">
                                <input
                                  type="number"
                                  min="0"
                                  max="1"
                                  className={`w-12 border rounded p-1 text-center font-bold ${asset.available_stock < asset.current_stock ? 'text-red-600 bg-red-50 border-red-300' : 'text-green-600 border-gray-300'}`}
                                  value={asset.available_stock}
                                  onChange={(e) => handleUpdateAssetDamage(idx, 'available_stock', e.target.value)}
                                />
                              </td>
                              <td className="py-2 text-gray-600 text-right">₹{asset.replacement_cost}</td>
                              <td className="py-2 text-center">
                                <input
                                  type="checkbox"
                                  checked={asset.is_damaged || false}
                                  onChange={(e) => handleUpdateAssetDamage(idx, 'is_damaged', e.target.checked)}
                                  className="w-5 h-5 text-red-600 rounded focus:ring-red-500 border-gray-300"
                                />
                              </td>
                              <td className="py-2 px-2">
                                <div className="space-y-3">
                                  {/* Option 1: Return (Missing/Moved/Explicit) */}
                                  {(asset.available_stock < asset.current_stock || asset.is_rentable || asset.is_returned || asset.track_laundry_cycle || (asset.item_name || "").toLowerCase().includes("towel") || (asset.item_name || "").toLowerCase().includes("sheet") || (asset.item_name || "").toLowerCase().includes("linen")) && !asset.is_damaged && (
                                    <div>
                                      <div className="flex flex-col gap-2">
                                        <div className="flex items-center gap-2">
                                          <input
                                            type="checkbox"
                                            checked={asset.is_returned || false}
                                            onChange={(e) => handleUpdateAssetDamage(idx, 'is_returned', e.target.checked)}
                                            className="rounded text-blue-600 focus:ring-blue-500"
                                            id={`fa-return-${idx}`}
                                          />
                                          <label htmlFor={`fa-return-${idx}`} className="text-[10px] text-blue-800 font-bold uppercase cursor-pointer">Return to Stock</label>
                                        </div>

                                        <div className="flex items-center gap-2">
                                          <input
                                            type="checkbox"
                                            checked={asset.is_laundry || false}
                                            onChange={(e) => handleUpdateAssetDamage(idx, 'is_laundry', e.target.checked)}
                                            className="rounded text-green-600 focus:ring-green-500"
                                            id={`fa-laundry-${idx}`}
                                          />
                                          <label htmlFor={`fa-laundry-${idx}`} className="text-[10px] text-green-800 font-bold uppercase cursor-pointer">Mark Laundry</label>
                                        </div>
                                      </div>

                                      {(asset.is_returned || asset.is_laundry || asset.available_stock < asset.current_stock) && (
                                        <select
                                          className="w-full border rounded p-1 text-xs bg-white focus:ring-1 focus:ring-blue-500 outline-none mt-2"
                                          value={asset.is_laundry ? (asset.laundry_location_id || "") : (asset.return_location_id || "")}
                                          onChange={(e) => {
                                            const field = asset.is_laundry ? 'laundry_location_id' : 'return_location_id';
                                            handleUpdateAssetDamage(idx, field, e.target.value);
                                          }}
                                        >
                                          <option value="">-- To {asset.is_laundry ? 'Laundry' : 'Location'} --</option>
                                          {locations.filter(l =>
                                            asset.is_laundry
                                              ? l.location_type?.includes('LAUNDRY')
                                              : (l.is_inventory_point || l.location_type?.toUpperCase().includes('WAREHOUSE') || l.location_type?.toUpperCase().includes('REPAIR'))
                                          ).map(loc => (
                                            <option key={loc.id} value={loc.id}>To {loc.name}</option>
                                          ))}
                                        </select>
                                      )}
                                    </div>
                                  )}

                                  {/* Option 2: Damaged/Waste */}
                                  {asset.is_damaged && (
                                    <div className="bg-red-50/50 p-2 rounded border border-red-100 mt-2">
                                      <div className="flex items-center gap-2 mb-1">
                                        <input
                                          type="checkbox"
                                          checked={asset.is_waste !== false}
                                          onChange={(e) => handleUpdateAssetDamage(idx, 'is_waste', e.target.checked)}
                                          className="rounded text-red-600 focus:ring-red-500"
                                          id={`fa-waste-${idx}`}
                                        />
                                        <label htmlFor={`fa-waste-${idx}`} className="text-[10px] text-red-800 font-bold uppercase cursor-pointer">Mark Waste</label>
                                      </div>

                                      <select
                                        className="w-full border rounded p-1 text-xs bg-white focus:ring-red-500 outline-none"
                                        value={asset.waste_location_id || ""}
                                        onChange={(e) => handleUpdateAssetDamage(idx, 'waste_location_id', e.target.value)}
                                        disabled={!asset.is_waste}
                                      >
                                        <option value="">-- Select Waste Loc --</option>
                                        {locations.filter(l => l.location_type?.includes('WASTE') || l.location_type?.includes('REPAIR')).map(loc => (
                                          <option key={loc.id} value={loc.id}>{loc.name}</option>
                                        ))}
                                      </select>

                                      <input
                                        type="text"
                                        placeholder="Describe damage..."
                                        value={asset.damage_notes || ""}
                                        onChange={(e) => handleUpdateAssetDamage(idx, 'damage_notes', e.target.value)}
                                        className="w-full border p-1 rounded text-xs focus:ring-1 focus:ring-red-500 outline-none mt-1"
                                      />
                                    </div>
                                  )}
                                </div>
                              </td>
                              <td className="py-2 text-center">
                                <div className="flex flex-col items-center gap-1">
                                  <input
                                    type="checkbox"
                                    checked={asset.request_replacement || false}
                                    onChange={(e) => handleUpdateAssetDamage(idx, 'request_replacement', e.target.checked)}
                                    className="w-5 h-5 text-red-600 rounded focus:ring-red-500 border-gray-300"
                                  />
                                  {asset.request_replacement && (
                                    <span className="text-[9px] font-bold text-red-600 bg-red-100 px-1.5 py-0.5 rounded uppercase tracking-wide">
                                      Request
                                    </span>
                                  )}
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {(() => {
                  console.log("[DEBUG RENDER] Processing Checkout Inventory Items:", checkoutInventoryDetails.items);

                  const consumableItems = (checkoutInventoryDetails.items || []).filter(item => {
                    // Rely strictly on backend flags - no hardcoded name checks
                    const isFixedItem = item.is_fixed_asset;
                    // Override: Force known consumables to NOT be rentable
                    const isKnownConsumable = ["coca", "cola", "water", "chips", "juice", "biscuit"].some(k => (item.item_name || "").toLowerCase().includes(k));
                    const isRentable = !isKnownConsumable && (item.is_rentable || item.track_laundry_cycle);

                    if (item.item_name.includes("Coca")) {
                      console.log(`[DEBUG RENDER] Item ${item.item_name}: isFixed=${isFixedItem}, isRentable=${item.is_rentable}, laundry=${item.track_laundry_cycle} -> IsRentalFilter=${isRentable}`);
                    }

                    return !isFixedItem && !isRentable; // Pure consumables
                  });

                  const rentalItems = (checkoutInventoryDetails.items || []).filter(item => {
                    const isFixedItem = item.is_fixed_asset;
                    // Override: Force known consumables to NOT be rentable
                    const isKnownConsumable = ["coca", "cola", "water", "chips", "juice", "biscuit"].some(k => (item.item_name || "").toLowerCase().includes(k));
                    const isRentable = !isKnownConsumable && (item.is_rentable || item.track_laundry_cycle);
                    return isRentable && !isFixedItem; // Rentals & Laundry (non-fixed)
                  });

                  const fixedItems = (checkoutInventoryDetails.items || []).filter(item => {
                    const isFixedItem = item.is_fixed_asset;
                    return isFixedItem; // Fixed assets
                  });

                  return (
                    <>
                      {/* Consumables Section - Simple tracking */}
                      {consumableItems.length > 0 && (
                        <div className="mb-6">
                          <h3 className="text-lg font-semibold mb-3 text-gray-800">Consumables Inventory Check</h3>
                          <div className="mb-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                            <p className="text-sm text-blue-800">
                              📦 <strong>For Consumables:</strong> Enter the remaining quantity (balance) in the "Available Stock" field.
                              The system will auto-calculate how much was consumed. No damage reporting needed for consumables.
                            </p>
                          </div>
                          <div className="overflow-x-auto border rounded-lg">
                            <table className="min-w-full text-sm">
                              <thead className="bg-gray-100 uppercase tracking-wider text-gray-700">
                                <tr>
                                  <th className="py-3 px-4 text-left w-1/4">Item Details</th>
                                  <th className="py-3 px-4 text-center w-1/6">Stock / Free</th>
                                  <th className="py-3 px-4 text-center w-1/6">Remaining</th>
                                  <th className="py-3 px-4 text-center w-1/6">Consumed</th>
                                  <th className="py-3 px-4 text-center w-1/12">Return?</th>
                                  <th className="py-3 px-4 text-left w-1/6">Return To</th>
                                  <th className="py-3 px-4 text-right w-1/12">Charge</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-gray-200">
                                {consumableItems.map((item, idx) => {
                                  const originalIdx = checkoutInventoryDetails.items.indexOf(item);
                                  const price = item.charge_per_unit || item.unit_price || 0;
                                  const isPcs = (item.unit || 'pcs').toLowerCase();
                                  const isDiscreteUnit = ['pcs', 'pc', 'can', 'bottle', 'unit', 'nos', 'number', 'pkt', 'pack', 'box', 'tray', 'piece', 'pieces'].includes(isPcs);
                                  const totalQty = isDiscreteUnit ? Math.floor(item.current_stock || 0) : (item.current_stock || 0);
                                  const availableQty = isDiscreteUnit ? Math.floor(item.available_stock || 0) : (item.available_stock || 0);

                                  let consumedQty = Math.max(0, totalQty - availableQty);
                                  if (isDiscreteUnit) consumedQty = Math.round(consumedQty);
                                  else consumedQty = parseFloat(consumedQty.toFixed(2));

                                  // Fix: Ensure consumedQty doesn't exceed total (sanity check)
                                  consumedQty = Math.min(consumedQty, totalQty);

                                  const freeLimit = item.complimentary_qty || 0;
                                  let chargeable;

                                  // Fix logic: Only charge if item is payable or exceeds limit
                                  if (item.is_payable) {
                                    chargeable = Math.max(0, consumedQty - freeLimit);
                                  } else {
                                    chargeable = 0;
                                  }

                                  const chargeAmount = chargeable * price;

                                  return (
                                    <tr key={idx} className="hover:bg-gray-50 transition-colors">
                                      <td className="py-3 px-4">
                                        <div className="flex flex-col">
                                          <span className="font-medium text-gray-900">{item.item_name}</span>
                                          <div className="flex items-center gap-2 mt-1">
                                            {item.is_payable && <span className="text-[10px] bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded border border-amber-200">PAYABLE</span>}
                                            <span className="text-xs text-gray-500">₹{price}/unit</span>
                                          </div>
                                        </div>
                                      </td>
                                      <td className="py-3 px-4 text-center">
                                        <div className="text-sm font-semibold text-gray-700">{isPcs ? Math.floor(totalQty) : totalQty} <span className="text-xs font-normal text-gray-500">Total</span></div>
                                        {freeLimit > 0 && <div className="text-xs text-green-600 font-medium">{isDiscreteUnit ? Math.floor(freeLimit) : freeLimit} Free</div>}
                                      </td>
                                      <td className="py-3 px-4 text-center">
                                        <input
                                          type="number"
                                          min="0"
                                          max={totalQty}
                                          step={isDiscreteUnit ? "1" : "0.01"}
                                          className="w-20 border rounded-lg p-2 text-center font-bold text-gray-800 bg-white border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all shadow-sm"
                                          value={availableQty}
                                          onKeyDown={(e) => {
                                            if (isDiscreteUnit && (e.key === '.' || e.key === 'e')) {
                                              e.preventDefault();
                                            }
                                          }}
                                          onChange={(e) => {
                                            let val = parseFloat(e.target.value);
                                            if (isNaN(val)) val = 0;
                                            if (isDiscreteUnit) val = Math.floor(val);
                                            val = Math.min(totalQty, Math.max(0, val));

                                            handleUpdateInventoryVerification(originalIdx, 'available_stock', val);
                                            handleUpdateInventoryVerification(originalIdx, 'used_qty', isDiscreteUnit ? Math.round(totalQty - val) : parseFloat((totalQty - val).toFixed(2)));
                                          }}
                                        />
                                      </td>
                                      <td className="py-3 px-4 text-center">
                                        {consumedQty > 0 ? (
                                          <div className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-orange-100 text-orange-700 font-bold text-sm">
                                            {consumedQty}
                                          </div>
                                        ) : (
                                          <span className="text-gray-400">-</span>
                                        )}
                                      </td>
                                      <td className="py-3 px-4 text-center">
                                        {availableQty > 0 && (
                                          <input
                                            type="checkbox"
                                            checked={item.is_returned || false}
                                            onChange={(e) => handleUpdateInventoryVerification(originalIdx, 'is_returned', e.target.checked)}
                                            className="rounded text-blue-600 focus:ring-blue-500"
                                          />
                                        )}
                                      </td>
                                      <td className="py-3 px-4">
                                        {availableQty > 0 ? (
                                          <select
                                            className="w-full border rounded p-1.5 text-sm bg-white focus:ring-2 focus:ring-blue-500 outline-none text-gray-700"
                                            value={item.return_location_id || ""}
                                            onChange={(e) => handleUpdateInventoryVerification(originalIdx, 'return_location_id', e.target.value)}
                                          >
                                            <option value="">Stay in Room</option>
                                            {locations.filter(l => l.is_inventory_point || l.location_type?.includes('WAREHOUSE')).map(loc => (
                                              <option key={loc.id} value={loc.id}>Return to {loc.name}</option>
                                            ))}
                                          </select>
                                        ) : (
                                          <span className="text-xs text-gray-400 italic">None to return</span>
                                        )}
                                      </td>
                                      <td className="py-3 px-4 text-right">
                                        {chargeAmount > 0 ? (
                                          <div className="font-bold text-red-600 bg-red-50 py-1 px-2 rounded inline-block">
                                            +₹{chargeAmount.toFixed(2)}
                                          </div>
                                        ) : (
                                          <span className="text-gray-400">-</span>
                                        )}
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}

                      {/* Rent / Laundry Items Section */}
                      {rentalItems.length > 0 && (
                        <div className="mb-6">
                          <h3 className="text-lg font-semibold mb-3 text-purple-700">Rent / Laundry Items Check</h3>
                          <div className="mb-3 p-3 bg-purple-50 border border-purple-200 rounded-lg">
                            <p className="text-sm text-purple-800">
                              🧺 <strong>For Rent/Laundry Items:</strong> Track returns to laundry, damage handling, and replacement requests.
                            </p>
                          </div>
                          <div className="overflow-x-auto border rounded-lg">
                            <table className="min-w-full text-sm">
                              <thead className="bg-purple-50 uppercase tracking-wider text-purple-800">
                                <tr>
                                  <th className="py-3 px-4 text-left w-1/5">Item Details</th>
                                  <th className="py-3 px-4 text-center w-1/12">Total</th>
                                  <th className="py-3 px-4 text-center w-1/6">Good (Laundry)</th>
                                  <th className="py-3 px-4 text-center w-1/6">Damaged/Waste</th>
                                  <th className="py-3 px-4 text-center w-1/12">Missing</th>
                                  <th className="py-3 px-4 text-left w-1/6">Return To</th>
                                  <th className="py-3 px-4 text-center w-1/12">Replace?</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-gray-200">
                                {rentalItems.map((item, idx) => {
                                  const originalIdx = checkoutInventoryDetails.items.indexOf(item);
                                  const price = item.charge_per_unit || item.unit_price || 0;
                                  const damagePrice = item.cost_per_unit || price;

                                  const totalQty = Math.floor(item.current_stock || 0);

                                  // Good = Available Stock (User Input)
                                  const good = Math.floor(item.available_stock || 0);
                                  // Damaged = Damage Qty (User Input)
                                  const damaged = Math.floor(item.damage_qty || 0);

                                  // Calculate Missing
                                  let missing = totalQty - good - damaged;
                                  if (missing < 0) missing = 0;
                                  missing = Math.round(missing);

                                  const chargeAmount = (damaged * damagePrice) + (missing * damagePrice);

                                  return (
                                    <tr key={idx} className="hover:bg-purple-50 transition-colors">
                                      <td className="py-3 px-4">
                                        <div className="font-medium text-gray-900">{item.item_name}</div>
                                        <div className="text-xs text-gray-500">{item.item_code}</div>
                                        {chargeAmount > 0 && (
                                          <div className="mt-1 text-xs text-red-600 font-bold">
                                            Charge: ₹{chargeAmount.toFixed(2)}
                                          </div>
                                        )}
                                      </td>
                                      <td className="py-3 px-4 text-center font-bold text-gray-700">{totalQty}</td>

                                      {/* Good (Laundry) Input */}
                                      <td className="py-3 px-4 text-center">
                                        <div className="flex flex-col gap-2">
                                          <input
                                            type="number"
                                            min="0"
                                            max={totalQty}
                                            className="w-full border rounded-lg p-2 text-center font-bold text-green-700 border-green-200 focus:ring-green-500"
                                            value={good}
                                            onChange={(e) => {
                                              let val = Math.max(0, parseInt(e.target.value) || 0);
                                              handleUpdateInventoryVerification(originalIdx, 'available_stock', val);
                                            }}
                                            placeholder="Good"
                                          />
                                          <span className="text-[10px] text-gray-500 uppercase tracking-wide">To Laundry/Stock</span>
                                        </div>
                                      </td>

                                      {/* Damaged Input */}
                                      <td className="py-3 px-4 text-center">
                                        <div className="flex flex-col gap-2">
                                          <input
                                            type="number"
                                            min="0"
                                            max={totalQty}
                                            className="w-full border rounded-lg p-2 text-center font-bold text-red-700 border-red-200 focus:ring-red-500"
                                            value={damaged}
                                            onChange={(e) => {
                                              let val = Math.max(0, parseInt(e.target.value) || 0);
                                              handleUpdateInventoryVerification(originalIdx, 'damage_qty', val);
                                            }}
                                            placeholder="Damaged"
                                          />
                                          <span className="text-[10px] text-gray-500 uppercase tracking-wide">To Waste/Repair</span>
                                        </div>
                                      </td>

                                      {/* Missing Display */}
                                      <td className="py-3 px-4 text-center">
                                        <div className={`font-bold ${missing > 0 ? 'text-red-600' : 'text-gray-400'}`}>
                                          {missing}
                                        </div>
                                      </td>

                                      {/* Return Location Logic */}
                                      <td className="py-3 px-4">
                                        <div className="space-y-3">
                                          {/* For Good items -> Laundry or Stock */}
                                          {good > 0 && (
                                            <div className="bg-green-50/50 p-2 rounded border border-green-100">
                                              <div className="flex flex-col gap-2 mb-1">
                                                <div className="flex items-center gap-2">
                                                  <input
                                                    type="checkbox"
                                                    checked={item.is_returned || false}
                                                    onChange={(e) => handleUpdateInventoryVerification(originalIdx, 'is_returned', e.target.checked)}
                                                    className="rounded text-blue-600 focus:ring-blue-500"
                                                    id={`return-${idx}`}
                                                  />
                                                  <label htmlFor={`return-${idx}`} className="text-[10px] text-blue-800 font-bold uppercase cursor-pointer">Return Stock</label>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                  <input
                                                    type="checkbox"
                                                    checked={item.is_laundry || false}
                                                    onChange={(e) => handleUpdateInventoryVerification(originalIdx, 'is_laundry', e.target.checked)}
                                                    className="rounded text-green-600 focus:ring-green-500"
                                                    id={`laundry-${idx}`}
                                                  />
                                                  <label htmlFor={`laundry-${idx}`} className="text-[10px] text-green-800 font-bold uppercase cursor-pointer">Mark Laundry</label>
                                                </div>
                                              </div>

                                              <select
                                                className="w-full border rounded p-1.5 text-xs bg-white focus:ring-green-500 outline-none"
                                                value={item.is_laundry ? (item.laundry_location_id || "") : (item.return_location_id || "")}
                                                onChange={(e) => {
                                                  const field = item.is_laundry ? 'laundry_location_id' : 'return_location_id';
                                                  handleUpdateInventoryVerification(originalIdx, field, e.target.value);
                                                }}
                                              >
                                                <option value="">-- Select {item.is_laundry ? 'Laundry' : 'Stock'} --</option>
                                                {locations.filter(l =>
                                                  item.is_laundry
                                                    ? l.location_type?.includes('LAUNDRY')
                                                    : (l.is_inventory_point || l.location_type?.includes('WAREHOUSE'))
                                                ).map(loc => (
                                                  <option key={loc.id} value={loc.id}>{loc.name}</option>
                                                ))}
                                              </select>
                                            </div>
                                          )}

                                          {/* For Damaged items -> Waste */}
                                          {damaged > 0 && (
                                            <div className="bg-red-50/50 p-2 rounded border border-red-100">
                                              <div className="flex items-center gap-2 mb-1">
                                                <input
                                                  type="checkbox"
                                                  checked={item.is_waste !== false} // Default to true if undefined for damaged items? Let's verify user intent. User said "damage mark to waste option". So simple checkbox.
                                                  onChange={(e) => handleUpdateInventoryVerification(originalIdx, 'is_waste', e.target.checked)}
                                                  className="rounded text-red-600 focus:ring-red-500"
                                                  id={`waste-${idx}`}
                                                />
                                                <label htmlFor={`waste-${idx}`} className="text-[10px] text-red-800 font-bold uppercase cursor-pointer">Mark Waste</label>
                                              </div>

                                              <select
                                                className="w-full border rounded p-1.5 text-xs bg-white focus:ring-red-500 outline-none"
                                                value={item.waste_location_id || ""}
                                                onChange={(e) => handleUpdateInventoryVerification(originalIdx, 'waste_location_id', e.target.value)}
                                                disabled={!item.is_waste}
                                              >
                                                <option value="">-- Select Waste Loc --</option>
                                                {locations.filter(l => l.location_type?.includes('WASTE') || l.location_type?.includes('REPAIR')).map(loc => (
                                                  <option key={loc.id} value={loc.id}>{loc.name}</option>
                                                ))}
                                              </select>
                                            </div>
                                          )}
                                        </div>
                                      </td>

                                      {/* Replace Request */}
                                      <td className="py-3 px-4 text-center">
                                        <div className="flex flex-col items-center gap-1">
                                          <input
                                            type="checkbox"
                                            checked={item.request_replacement || false}
                                            onChange={(e) => handleUpdateInventoryVerification(originalIdx, 'request_replacement', e.target.checked)}
                                            className="w-5 h-5 text-purple-600 rounded focus:ring-purple-500 border-gray-300"
                                          />
                                          {item.request_replacement && (
                                            <span className="text-[9px] font-bold text-purple-600 bg-purple-100 px-1.5 py-0.5 rounded uppercase tracking-wide">
                                              Request
                                            </span>
                                          )}
                                        </div>
                                      </td>
                                    </tr>
                                  );
                                })}

                              </tbody>
                            </table >
                          </div>
                        </div>
                      )}

                      {/* Fixed Assets Section - REMOVED DUPLICATE */}
                      {/* The primary Fixed Assets Check is rendered at the top of the modal using checkoutInventoryDetails.fixed_assets */}
                      {/* Fixed Assets Section - REMOVED DUPLICATE: Primary section is at top */}
                    </>
                  );
                })()}

                {
                  (!checkoutInventoryDetails.items || checkoutInventoryDetails.items.length === 0) && (
                    <div className="mb-4 text-gray-500">
                      {checkoutInventoryDetails.message || "No inventory items found"}
                    </div>
                  )
                }

                {/* Remaining sections are handled by the dynamic processing logic above */}

                <div className="mb-4">
                  <label className="block text-sm font-medium mb-2">Inventory Verification Notes (Optional):</label>
                  <textarea
                    id="inventory-notes"
                    className="w-full border p-2 rounded-lg"
                    rows="3"
                    placeholder="Add any notes about inventory verification..."
                  />
                </div>

                <div className="flex gap-2 justify-end">
                  <button
                    onClick={() => {
                      setCheckoutInventoryModal(null);
                      setCheckoutInventoryDetails(null);
                    }}
                    className="px-4 py-2 bg-gray-300 hover:bg-gray-400 text-gray-700 rounded-lg"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => {
                      const notes = document.getElementById('inventory-notes')?.value || '';
                      handleCompleteCheckoutRequest(checkoutInventoryModal, notes);
                    }}
                    className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg"
                  >
                    Complete Verification
                  </button>
                </div>
              </div>
            </div>
          )
        }

        {/* Payment / Completion Status Modal */}
        {
          paymentModal && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
              <div className="bg-white rounded-lg p-6 max-w-md w-full">
                <h2 className="text-xl font-bold mb-4">Complete Service</h2>

                <div className="mb-6">
                  <p className="text-gray-700 mb-4 font-medium">
                    Please select the billing status for this service:
                  </p>

                  {/* Display Items Used in this Service with INLINE RETURN OPTIONS */}
                  {(() => {
                    // Find the relevant service to show items
                    const reqId = paymentModal.requestId;
                    const assignedId = reqId > 2000000 ? reqId - 2000000 : null;

                    let items = [];
                    if (assignedId) {
                      const svc = assignedServices.find(s => s.id === assignedId);
                      items = svc?.debug_items || svc?.inventory_items_used || [];
                    } else {
                      const req = serviceRequests.find(r => r.id === reqId);
                      if (req && req.assigned_service_id) {
                        const svc = assignedServices.find(s => s.id === req.assigned_service_id);
                        items = svc?.debug_items || svc?.inventory_items_used || [];
                      }
                    }

                    if (items && items.length > 0) {
                      return (
                        <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 mb-4">
                          <h4 className="text-xs font-bold text-slate-700 mb-2 uppercase tracking-wide flex justify-between items-center">
                            <span>Inventory Actions ({items.length})</span>
                            <span className="text-[10px] bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded">Update Usage Below</span>
                          </h4>
                          <div className="space-y-3 max-h-60 overflow-y-auto pr-1">
                            {items.map((item, idx) => {
                              const assignedQty = item.quantity_assigned || item.quantity || 0;
                              const currentRet = returnQuantities[item.id] !== undefined ? returnQuantities[item.id] : 0;
                              // Default to 0 return (all consumed) unless changed

                              return (
                                <div key={idx} className="bg-white p-2 rounded border border-slate-200 shadow-sm text-xs">
                                  <div className="flex justify-between font-bold text-slate-700 mb-1">
                                    <span>{item.item?.name || item.name}</span>
                                    <span>Total: {assignedQty} {item.item?.unit || item.unit}</span>
                                  </div>

                                  <div className="grid grid-cols-3 gap-2 mt-2">
                                    <div>
                                      <label className="block text-[9px] text-slate-500 uppercase font-bold mb-0.5">Return Qty</label>
                                      <input
                                        type="number"
                                        min="0"
                                        max={assignedQty}
                                        step="0.01"
                                        className="w-full border border-slate-300 rounded px-2 py-1 text-xs font-bold"
                                        placeholder="0"
                                        value={returnQuantities[item.id] || ''}
                                        onChange={(e) => {
                                          const val = Math.min(parseFloat(e.target.value) || 0, assignedQty);
                                          setReturnQuantities(prev => ({ ...prev, [item.id]: val }));
                                        }}
                                      />
                                    </div>
                                    <div>
                                      <label className="block text-[9px] text-rose-500 uppercase font-bold mb-0.5">Damage Qty</label>
                                      <input
                                        type="number"
                                        min="0"
                                        max={assignedQty - (returnQuantities[item.id] || 0)}
                                        step="0.01"
                                        className="w-full border border-rose-200 bg-rose-50/30 rounded px-2 py-1 text-xs font-bold text-rose-700"
                                        placeholder="0"
                                        value={damageQuantities[item.id] || ''}
                                        onChange={(e) => {
                                          const val = Math.min(parseFloat(e.target.value) || 0, assignedQty - (returnQuantities[item.id] || 0));
                                          setDamageQuantities(prev => ({ ...prev, [item.id]: val }));
                                        }}
                                      />
                                    </div>
                                    <div>
                                      <label className="block text-[9px] text-slate-500 uppercase font-bold mb-0.5">Return To</label>
                                      <select
                                        className="w-full border border-slate-300 rounded px-1 py-1 text-[10px]"
                                        value={returnLocations[item.id] || ""}
                                        onChange={(e) => setReturnLocations(prev => ({ ...prev, [item.id]: e.target.value }))}
                                      >
                                        <option value="">(Stock)</option>
                                        {locations.filter(l => l.is_inventory_point).map(l => (
                                          <option key={l.id} value={l.id}>{l.name}</option>
                                        ))}
                                      </select>
                                    </div>
                                  </div>
                                  <div className="flex justify-between mt-1 text-[10px]">
                                    <span className="text-rose-500 font-bold">
                                      {damageQuantities[item.id] > 0 ? `${damageQuantities[item.id]} damaged` : ''}
                                    </span>
                                    <span className="text-slate-500">
                                      {Math.max(0, assignedQty - (returnQuantities[item.id] || 0) - (damageQuantities[item.id] || 0))} consumed
                                    </span>
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                        </div>
                      );
                    }
                    return null;
                  })()}

                </div>

                <div className="flex flex-col gap-3">
                  {!isSelectingPaymentMode ? (
                    <>
                      <button
                        onClick={() => {
                          setIsSelectingPaymentMode(true);
                        }}
                        className="w-full px-4 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors shadow-sm flex items-center justify-center gap-2"
                      >
                        <span>✓</span> Confirm Payment & Inventory
                      </button>

                      <button
                        onClick={() => handleUpdateRequestStatus(paymentModal.requestId, paymentModal.newStatus, "unpaid", true)}
                        className="w-full px-4 py-3 bg-orange-600 hover:bg-orange-700 text-white rounded-lg font-medium transition-colors shadow-sm"
                      >
                        Confirm Unpaid & Inventory
                      </button>
                    </>
                  ) : (
                    <div className="animate-in slide-in-from-top-2 duration-300 space-y-4">
                      <div className="p-4 bg-green-50 border border-green-100 rounded-xl">
                        <label className="block text-xs font-black text-green-700 uppercase tracking-widest mb-3 text-center">
                          Select Mode of Payment
                        </label>
                        <div className="grid grid-cols-2 gap-2">
                          {["Cash", "UPI", "Card", "Other"].map((mode) => (
                            <button
                              key={mode}
                              type="button"
                              onClick={() => {
                                setPaymentMode(mode);
                                handleUpdateRequestStatus(paymentModal.requestId, paymentModal.newStatus, "paid", true, mode);
                              }}
                              className={`py-3 px-4 border-2 rounded-xl text-sm font-bold transition-all ${paymentMode === mode
                                ? "bg-green-600 text-white border-green-600 shadow-md"
                                : "bg-white text-gray-600 border-gray-200 hover:border-green-300"
                                }`}
                            >
                              {mode}
                            </button>
                          ))}
                        </div>
                        <button
                          onClick={() => setIsSelectingPaymentMode(false)}
                          className="w-full mt-4 text-xs text-gray-500 hover:text-gray-700 font-medium text-center underline"
                        >
                          Go Back
                        </button>
                      </div>
                    </div>
                  )}

                  <button
                    onClick={() => {
                      setPaymentModal(null);
                      setPaymentModalReturnsChecked(false);
                      setIsSelectingPaymentMode(false);
                    }}
                    className="w-full px-4 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-medium transition-colors"
                  >
                    Cancel
                  </button>
                </div>

                <div className="mt-4 p-3 bg-blue-50 rounded-lg">
                  <p className="text-xs text-blue-800">
                    <strong>Note:</strong> The food order will be marked as completed.
                    If marked as unpaid, you can collect payment later from the billing section.
                  </p>
                </div>
              </div>
            </div>
          )
        }

        {/* Return Items Modal - For 'return_items' Service Request Completion */}
        {
          returnRequestModal && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
              <div className="bg-white rounded-lg p-6 max-w-3xl w-full max-h-[90vh] overflow-y-auto">
                <h2 className="text-xl font-bold mb-4 text-purple-800 flex items-center gap-2">
                  🔄 Return Unconsumed Items (Updated v2)
                </h2>

                <div className="mb-6">
                  <p className="text-gray-700 mb-4">
                    Select the return location for each item individually:
                  </p>

                  {returnRequestModal.items.length === 0 ? (
                    <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                      <p className="text-sm text-gray-500 italic">No specific items listed, returning general inventory.</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {returnRequestModal.items.map((item, idx) => {
                        // Initialize return location for this item if not set
                        if (!returnLocations[`return_item_${idx}`]) {
                          // Try to find default location (warehouse/store)
                          const defaultLoc = locations.find(loc =>
                            loc.location_type === 'WAREHOUSE' ||
                            loc.location_type === 'CENTRAL_WAREHOUSE' ||
                            loc.is_inventory_point === true
                          );
                          if (defaultLoc) {
                            setTimeout(() => {
                              setReturnLocations(prev => ({
                                ...prev,
                                [`return_item_${idx}`]: defaultLoc.id
                              }));
                            }, 0);
                          }
                        }

                        return (
                          <div key={idx} className="bg-purple-50 p-4 rounded-lg border border-purple-200">
                            <div className="flex justify-between items-start mb-3">
                              <div>
                                <p className="font-semibold text-gray-800">{item.item_name}</p>
                                <p className="text-sm text-gray-600">
                                  Quantity: <span className="font-bold text-purple-700">{item.quantity_to_return} {item.unit}</span>
                                </p>
                              </div>
                            </div>

                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">
                                Return Location for this Item:
                              </label>
                              <select
                                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                                value={returnLocations[`return_item_${idx}`] || ""}
                                onChange={(e) => {
                                  const val = e.target.value ? parseInt(e.target.value) : "";
                                  setReturnLocations({
                                    ...returnLocations,
                                    [`return_item_${idx}`]: val
                                  });
                                }}
                              >
                                <option value="">Select Location...</option>
                                {locations.map(loc => {
                                  const isDefault = (
                                    loc.location_type?.toUpperCase() === 'WAREHOUSE' ||
                                    loc.location_type?.toUpperCase() === 'CENTRAL_WAREHOUSE' ||
                                    loc.location_type?.toUpperCase() === 'BRANCH_STORE' ||
                                    loc.is_inventory_point === true
                                  );

                                  return (
                                    <option key={loc.id} value={loc.id} className={isDefault ? "font-bold" : ""}>
                                      {isDefault ? '📦 ' : ''}
                                      {loc.name} {loc.location_type ? `(${loc.location_type})` : ''}
                                      {isDefault ? ' (Default)' : ''}
                                    </option>
                                  );
                                })}
                              </select>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div className="flex flex-col gap-3">
                  <button
                    onClick={() => {
                      // Validate that all items have a location selected
                      if (Object.keys(returnLocations).length !== inventoryAssignments.length) {
                        showBannerMessage("error", "Please select a return location for all items.");
                        return;
                      }

                      // For now, we'll use the first item's location as the primary location
                      // In the future, the backend should support per-item locations
                      const primaryLocationId = returnLocations[`return_item_0`];
                      handleCompleteReturnRequest(returnRequestModal.requestId, returnRequestModal.newStatus, primaryLocationId);
                    }}
                    disabled={returnRequestModal.items.length > 0 && !returnRequestModal.items.every((item, idx) => returnLocations[`return_item_${idx}`])}
                    className={`w-full px-4 py-3 text-white rounded-lg font-medium transition-colors ${(returnRequestModal.items.length === 0 || returnRequestModal.items.every((item, idx) => returnLocations[`return_item_${idx}`]))
                      ? 'bg-purple-600 hover:bg-purple-700'
                      : 'bg-gray-300 cursor-not-allowed'
                      }`}
                  >
                    Confirm & Complete Return
                  </button>

                  <button
                    onClick={() => {
                      setReturnRequestModal(null);
                      setReturnLocationId(null);
                      setReturnLocations({});
                    }}
                    className="w-full px-4 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-medium transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )
        }
        {/* Activity Details Modal */}
        {
          selectedActivity && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
              <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto animate-fade-in-up">
                <div className="p-6">
                  <div className="flex justify-between items-start mb-6 border-b pb-4">
                    <div>
                      <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                        {selectedActivity.type === 'Assigned' ? 'Service Assigment Details' : 'Service Request Details'}
                        <span className={`px-2 py-1 text-sm rounded-full ${selectedActivity.status === 'completed' ? 'bg-green-100 text-green-800' :
                          selectedActivity.status === 'in_progress' ? 'bg-blue-100 text-blue-800' :
                            'bg-yellow-100 text-yellow-800'
                          }`}>
                          {selectedActivity.status}
                        </span>
                      </h2>
                      <p className="text-gray-500 mt-1">ID: {selectedActivity.id}</p>
                    </div>
                    <button
                      onClick={() => setSelectedActivity(null)}
                      className="text-gray-400 hover:text-gray-600 transition-colors"
                    >
                      <X size={24} />
                    </button>
                  </div>

                  <div className="space-y-6">
                    {/* Core Info */}
                    <div className="grid grid-cols-2 gap-4">
                      <div className="p-4 bg-gray-50 rounded-lg">
                        <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider mb-1">Service / Description</p>
                        <p className="font-semibold text-gray-900">{selectedActivity.name}</p>
                      </div>
                      <div className="p-4 bg-gray-50 rounded-lg">
                        <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider mb-1">Room / Unit</p>
                        <p className="font-semibold text-gray-900">{selectedActivity.room}</p>
                      </div>
                      <div className="p-4 bg-gray-50 rounded-lg">
                        <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider mb-1">Assigned Agent</p>
                        <p className="font-semibold text-gray-900">
                          {selectedActivity.employee !== '-'
                            ? selectedActivity.employee
                            : (selectedActivity.original?.inventory_checked_by || 'Unassigned')}
                        </p>
                        {selectedActivity.original?.employee_id && (
                          <p className="text-[10px] text-gray-400 mt-1">ID: #{selectedActivity.original.employee_id}</p>
                        )}
                      </div>
                      <div className="p-4 bg-gray-50 rounded-lg">
                        <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider mb-1">Target Protocol</p>
                        <p className="font-semibold text-indigo-600">
                          {selectedActivity.original?.service?.average_completion_time || 'No Target Set'}
                        </p>
                        <p className="text-[10px] text-gray-400 mt-1">Expected Completion</p>
                      </div>
                    </div>

                    {/* Operational Timestamps */}
                    <div className="bg-gray-50 p-4 rounded-lg border border-gray-100">
                      <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3">Operational Timeline</h3>
                      <div className="grid grid-cols-3 gap-2">
                        <div className="flex flex-col">
                          <span className="text-[9px] font-bold text-gray-500 uppercase">Assigned</span>
                          <span className="text-xs font-semibold text-gray-700">
                            {selectedActivity.date ? formatTimeIST(selectedActivity.date) : '-'}
                          </span>
                        </div>
                        <div className="flex flex-col">
                          <span className="text-[9px] font-bold text-gray-500 uppercase">Started</span>
                          <span className="text-xs font-semibold text-gray-700">
                            {selectedActivity.original?.started_at ? formatTimeIST(selectedActivity.original.started_at) : (selectedActivity.status !== 'pending' ? 'Ongoing' : '-')}
                          </span>
                        </div>
                        <div className="flex flex-col">
                          <span className="text-[9px] font-bold text-gray-500 uppercase">Completed</span>
                          <span className="text-xs font-semibold text-gray-700">
                            {(selectedActivity.original?.completed_at || selectedActivity.original?.last_used_at) ? 
                              formatTimeIST(selectedActivity.original.completed_at || selectedActivity.original.last_used_at) : '-'}
                          </span>
                        </div>
                      </div>

                      {(selectedActivity.original?.completed_at || selectedActivity.original?.last_used_at) && (
                        <div className="mt-3 pt-3 border-t border-gray-200 flex justify-between items-center">
                          <span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">Total Mission Duration</span>
                          <span className="text-sm font-black text-slate-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100">
                            {(() => {
                              const endStr = String(selectedActivity.original.completed_at || selectedActivity.original.last_used_at);
                              const startStr = String(selectedActivity.original.started_at || selectedActivity.date);
                              
                              const end = new Date(ensureUTC(endStr));
                              const start = new Date(ensureUTC(startStr));
                              
                              const diff = end - start;
                              const mins = Math.max(0, Math.floor(diff / (1000 * 60)));
                              const hours = Math.floor(mins / 60);
                              return hours > 0 ? `${hours}h ${mins % 60}m` : `${mins}m`;
                            })()}
                          </span>
                        </div>
                      )}
                    </div>



                    {/* Content Section */}
                    {selectedActivity.original && (
                      <div className="space-y-4">
                        {/* Food Order Details */}
                        {selectedActivity.original.food_order_id && (
                          <div className="bg-indigo-50 p-4 rounded-lg border border-indigo-100">
                            <h3 className="text-md font-semibold text-indigo-800 mb-2 font-black uppercase tracking-widest text-[11px]">Food Deliverable Logic</h3>
                            <div className="grid grid-cols-2 gap-4 mb-4">
                              <div className="bg-white/50 p-3 rounded-lg border border-indigo-100">
                                <p className="text-[10px] text-indigo-400 font-black uppercase tracking-widest mb-1">Billing Signal</p>
                                <p className={`text-sm font-black uppercase tracking-wider ${selectedActivity.original.food_order_billing_status === 'paid' ? 'text-emerald-600' : 'text-orange-600'}`}>
                                  {selectedActivity.original.food_order_billing_status === 'paid' ? 'SETTLED' : 'OUTSTANDING'}
                                </p>
                              </div>
                              <div className="bg-white/50 p-3 rounded-lg border border-indigo-100">
                                <p className="text-[10px] text-indigo-400 font-black uppercase tracking-widest mb-1">Vector Value</p>
                                <p className="text-sm font-black text-slate-800 tracking-tight">₹{selectedActivity.original.food_order_amount}</p>
                              </div>
                            </div>
                            {selectedActivity.original.food_items && selectedActivity.original.food_items.length > 0 && (
                              <div className="overflow-x-auto rounded-lg border border-indigo-100">
                                <table className="min-w-full text-xs">
                                  <thead className="bg-indigo-100/50 text-indigo-900">
                                    <tr>
                                      <th className="px-3 py-2 text-left font-black uppercase tracking-widest">Resource Node</th>
                                      <th className="px-3 py-2 text-center font-black uppercase tracking-widest">Qty</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {selectedActivity.original.food_items.map((item, idx) => (
                                      <tr key={idx} className="border-t border-indigo-100 bg-white/30">
                                        <td className="px-3 py-2 font-bold text-slate-700">{item.food_item_name}</td>
                                        <td className="px-3 py-2 text-center font-black text-indigo-600">x{item.quantity}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            )}
                          </div>
                        )}

                        {/* Asset Damages */}
                        {selectedActivity.original.asset_damages && selectedActivity.original.asset_damages.length > 0 && (
                          <div className="bg-red-50 p-4 rounded-lg border border-red-100">
                            <h3 className="text-xs font-black text-red-800 mb-2 uppercase tracking-widest">Asset Damage Reports</h3>
                            <div className="overflow-x-auto">
                              <table className="min-w-full text-xs">
                                <thead className="bg-red-100 text-red-900">
                                  <tr>
                                    <th className="px-3 py-2 text-left uppercase font-black">Item</th>
                                    <th className="px-3 py-2 text-center uppercase font-black">Cost</th>
                                    <th className="px-3 py-2 text-left uppercase font-black">Signal Log</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {selectedActivity.original.asset_damages.map((asset, idx) => (
                                    <tr key={idx} className="border-t border-red-200">
                                      <td className="px-3 py-2 font-medium">{asset.item_name}</td>
                                      <td className="px-3 py-2 text-center font-bold">₹{asset.replacement_cost}</td>
                                      <td className="px-3 py-2 text-gray-700">{asset.notes || '-'}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        )}

                        {/* Inventory Items Used (Unified for both types) */}
                        {(() => {
                          const inventory = selectedActivity.original.inventory_data_with_charges ||
                            selectedActivity.original.inventory_items_used ||
                            [];

                          if (inventory.length === 0) return null;

                          return (
                            <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                              <h3 className="text-xs font-black text-slate-500 mb-2 uppercase tracking-widest">Resource Allocation Ledger</h3>
                              <div className="overflow-x-auto">
                                <table className="min-w-full text-xs">
                                  <thead className="bg-slate-200 text-slate-700">
                                    <tr>
                                      <th className="px-3 py-2 text-left uppercase font-black">Inventory Node</th>
                                      <th className="px-3 py-2 text-center uppercase font-black">Allotted</th>
                                      <th className="px-3 py-2 text-center uppercase font-black">Used</th>
                                      <th className="px-3 py-2 text-center uppercase font-black">Loss/Dam.</th>
                                      <th className="px-3 py-2 text-right uppercase font-black">Pricing Signal</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {inventory.map((item, idx) => {
                                      const charge = item.missing_item_charge || (item.missing_qty > 0 ? (item.missing_qty * (item.unit_price || 0)) : 0);
                                      return (
                                        <tr key={idx} className="border-t border-slate-200">
                                          <td className="px-3 py-2 font-black text-slate-700">
                                            {item.item_name || item.name}
                                            <div className="text-[9px] text-gray-400 font-normal">Code: {item.item_code || '-'}</div>
                                          </td>
                                          <td className="px-3 py-2 text-center font-bold">
                                            {item.quantity_assigned || item.quantity || 0}
                                          </td>
                                          <td className="px-3 py-2 text-center font-bold text-blue-600">
                                            {item.used_qty || 0}
                                          </td>
                                          <td className="px-3 py-2 text-center font-bold text-red-600">
                                            {item.missing_qty > 0 ? item.missing_qty : '-'}
                                          </td>
                                          <td className="px-3 py-2 text-right font-black">
                                            {charge > 0 ? <span className="text-red-600">₹{charge.toFixed(2)}</span> : <span className="text-emerald-600 text-[10px] uppercase">Allocated</span>}
                                          </td>
                                        </tr>
                                      );
                                    })}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          );
                        })()}
                      </div>
                    )}

                    {/* Cancel/Close Actions */}
                    <div className="flex justify-end pt-4 border-t">
                      <button
                        onClick={() => setSelectedActivity(null)}
                        className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium"
                      >
                        Close
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )
        }

        {/* Create / Edit Service Modal */}
        {
          showCreateModal && (
            <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fadeIn">
              <div className="bg-white rounded-3xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col border border-slate-100">
                <div className="p-8 border-b border-slate-50 flex justify-between items-center bg-slate-50/30">
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-indigo-600 rounded-2xl shadow-lg shadow-indigo-100 text-white">
                      <Box size={24} />
                    </div>
                    <div>
                      <h2 className="text-2xl font-black text-slate-800 tracking-tight">
                        {editingServiceId ? "Refine Definition" : "Construct Service"}
                      </h2>
                      <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">
                        {editingServiceId ? `System Item ID #${editingServiceId}` : "Deploy new architecture to the catalog"}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={handleCancelEdit}
                    className="p-3 hover:bg-white rounded-2xl transition-all text-slate-400 hover:text-red-500 border border-transparent hover:border-slate-100 hover:rotate-90"
                  >
                    <X size={24} />
                  </button>
                </div>

                <div className="p-8 overflow-y-auto custom-scrollbar space-y-8">
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                    {/* Left Column: Form Fields */}
                    <div className="space-y-6">
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Service Identity</label>
                        <input
                          type="text"
                          placeholder="Corporate Spa, Deluxe Room Service..."
                          value={form.name}
                          onChange={(e) => setForm({ ...form, name: e.target.value })}
                          className="w-full bg-slate-50 border-none ring-1 ring-slate-200 focus:ring-2 focus:ring-indigo-500 p-4 rounded-2xl text-sm font-bold transition-all shadow-sm"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Rate (₹)</label>
                          <div className="relative">
                            <IndianRupee size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input
                              type="number"
                              placeholder="0.00"
                              value={form.charges}
                              onChange={(e) => setForm({ ...form, charges: e.target.value })}
                              className="w-full bg-slate-50 border-none ring-1 ring-slate-200 focus:ring-2 focus:ring-indigo-500 pl-10 pr-4 py-4 rounded-2xl text-sm font-black text-slate-800 transition-all shadow-sm"
                            />
                          </div>
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Duration</label>
                          <div className="relative">
                            <Clock size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input
                              type="text"
                              placeholder="e.g. 45 min"
                              value={form.average_completion_time}
                              onChange={(e) => setForm({ ...form, average_completion_time: e.target.value })}
                              className="w-full bg-slate-50 border-none ring-1 ring-slate-200 focus:ring-2 focus:ring-indigo-500 pl-12 pr-4 py-4 rounded-2xl text-sm font-bold transition-all shadow-sm"
                            />
                          </div>
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Description</label>
                        <textarea
                          placeholder="Define the scope and deliverables of this service..."
                          value={form.description}
                          onChange={(e) => setForm({ ...form, description: e.target.value })}
                          rows={4}
                          className="w-full bg-slate-50 border-none ring-1 ring-slate-200 focus:ring-2 focus:ring-indigo-500 p-4 rounded-2xl text-sm leading-relaxed transition-all shadow-sm resize-none"
                        />
                      </div>

                      <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex items-center justify-between group cursor-pointer hover:bg-white hover:shadow-md transition-all">
                        <div className="flex items-center gap-3">
                          <div className={`p-2 rounded-xl transition-colors ${form.is_visible_to_guest ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-200 text-slate-500'}`}>
                            <Radio size={18} className={form.is_visible_to_guest ? "animate-pulse" : ""} />
                          </div>
                          <div>
                            <p className="text-[11px] font-black text-slate-800 uppercase tracking-tight">Network Visibility</p>
                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Available for guest request</p>
                          </div>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            className="sr-only peer"
                            checked={form.is_visible_to_guest}
                            onChange={(e) => setForm({ ...form, is_visible_to_guest: e.target.checked })}
                          />
                          <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                        </label>
                      </div>
                    </div>

                    {/* Right Column: Assets & Resources */}
                    <div className="space-y-8">
                      {/* Media Management */}
                      <div className="space-y-4">
                        <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2">
                          <Star size={14} className="text-amber-400" /> Visual Manifest
                        </h4>
                        <div className="grid grid-cols-2 gap-4">
                          <label className="flex flex-col items-center justify-center h-40 border-2 border-dashed border-slate-200 rounded-2xl cursor-pointer hover:bg-slate-50 hover:border-indigo-300 transition-all transition-colors group bg-slate-50/50">
                            <Plus size={32} className="text-slate-300 group-hover:text-indigo-500 group-hover:scale-125 transition-transform mb-2" />
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Inject Asset</span>
                            <input type="file" multiple accept="image/*" onChange={handleImageChange} className="hidden" />
                          </label>

                          {imagePreviews.map((preview, idx) => (
                            <div key={idx} className="relative group rounded-2xl overflow-hidden aspect-video shadow-md ring-1 ring-slate-100">
                              <img src={preview} className="w-full h-full object-cover" />
                              <div className="absolute inset-0 bg-indigo-600/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                <span className="text-[10px] font-black text-white uppercase tracking-[0.2em]">Staged</span>
                              </div>
                            </div>
                          ))}

                          {editingServiceId && existingImages.map((img) => {
                            const marked = imagesToRemove.includes(img.id);
                            return (
                              <div key={img.id} className="relative group rounded-2xl overflow-hidden aspect-video shadow-sm ring-1 ring-slate-100">
                                <img src={getImageUrl(img.image_url)} className={`w-full h-full object-cover transition-all duration-500 ${marked ? 'grayscale opacity-20 scale-110' : ''}`} />
                                <button
                                  onClick={() => handleToggleExistingImage(img.id)}
                                  className={`absolute inset-0 flex items-center justify-center transition-all ${marked ? 'bg-red-500/20' : 'bg-slate-900/40 opacity-0 group-hover:opacity-100'}`}
                                >
                                  <div className={`p-3 rounded-full ${marked ? 'bg-white text-red-600 shadow-xl' : 'bg-red-600 text-white shadow-xl'} transform hover:scale-110 transition-transform`}>
                                    {marked ? <Plus size={20} className="rotate-45" /> : <X size={20} />}
                                  </div>
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* Inventory Links */}
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2">
                            <Package size={14} className="text-indigo-500" /> Resource Dependencies
                          </h4>
                          <button
                            onClick={handleAddInventoryItem}
                            className="text-[10px] font-black text-indigo-600 hover:text-indigo-800 uppercase tracking-widest flex items-center gap-1 group"
                          >
                            <Plus size={10} className="group-hover:rotate-90 transition-transform" /> Bind Resource
                          </button>
                        </div>

                        <div className="space-y-3 max-h-[300px] overflow-y-auto custom-scrollbar pr-2">
                          {selectedInventoryItems.length === 0 && (
                            <div className="bg-slate-50/50 border border-slate-100 border-dashed rounded-2xl py-12 flex flex-col items-center justify-center text-slate-300">
                              <Box size={32} className="opacity-20 mb-2" />
                              <p className="text-[10px] font-bold uppercase tracking-[0.2em]">No dependencies mapped</p>
                            </div>
                          )}
                          {selectedInventoryItems.map((item, index) => (
                            <div key={index} className="flex gap-2 group animate-fadeIn bg-slate-50 p-3 rounded-2xl border border-slate-100 hover:bg-white hover:shadow-md transition-all">
                              <select
                                value={item.inventory_item_id}
                                onChange={(e) => handleUpdateInventoryItem(index, 'inventory_item_id', e.target.value)}
                                className="flex-1 bg-white border-none ring-1 ring-slate-100 focus:ring-2 focus:ring-indigo-500 px-3 py-2.5 rounded-xl text-xs font-black text-slate-700"
                              >
                                <option value="">Select Resource Node...</option>
                                {inventoryItems.map((invItem) => (
                                  <option key={invItem.id} value={invItem.id}>{invItem.name}</option>
                                ))}
                              </select>
                              <div className="flex items-center gap-2 bg-white px-3 py-2.5 rounded-xl ring-1 ring-slate-100">
                                <input
                                  type="number"
                                  value={item.quantity}
                                  onChange={(e) => handleUpdateInventoryItem(index, 'quantity', e.target.value)}
                                  className="w-12 bg-transparent border-none text-xs font-black text-center focus:outline-none"
                                />
                                <span className="text-[9px] font-black text-slate-400 uppercase">Qty</span>
                              </div>
                              <button
                                onClick={() => handleRemoveInventoryItem(index)}
                                className="p-2.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                              >
                                <X size={16} />
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="p-8 border-t border-slate-50 bg-slate-50/30 flex justify-end items-center gap-4">
                  <button
                    onClick={handleCancelEdit}
                    className="px-8 py-4 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 hover:text-slate-600 transition-all"
                  >
                    Discard Changes
                  </button>
                  <button
                    onClick={handleSaveService}
                    className="px-12 py-4 rounded-2xl bg-indigo-600 hover:bg-slate-900 text-white text-[10px] font-black uppercase tracking-[0.2em] shadow-xl shadow-indigo-100 active:scale-95 transition-all flex items-center gap-3"
                  >
                    {editingServiceId ? <RefreshCw size={16} /> : <Zap size={16} className="text-amber-400" />}
                    {editingServiceId ? "Apply System Updates" : "Initialize Service Deployment"}
                  </button>
                </div>
              </div>
            </div>
          )
        }

        {/* Dispatch Service Modal */}
        {
          showAssignModal && (
            <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fadeIn">
              <div className="bg-white rounded-[2.5rem] shadow-2xl max-w-5xl w-full max-h-[90vh] overflow-hidden flex flex-col border border-slate-100">
                <div className="p-10 border-b border-slate-50 flex justify-between items-center bg-slate-50/20">
                  <div className="flex items-center gap-6">
                    <div className="p-4 bg-slate-900 rounded-[1.5rem] shadow-2xl text-white">
                      <Zap size={28} className="text-amber-400" />
                    </div>
                    <div>
                      <h2 className="text-3xl font-black text-slate-800 tracking-tight">Mission Triage</h2>
                      <p className="text-xs font-bold text-slate-400 uppercase tracking-[0.3em] mt-1.5 flex items-center gap-2">
                        <Activity size={12} className="text-indigo-500" /> Service Resource Orchestration
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setShowAssignModal(false)}
                    className="p-4 hover:bg-white rounded-3xl transition-all text-slate-400 hover:text-red-500 border border-transparent hover:border-slate-100"
                  >
                    <X size={32} />
                  </button>
                </div>

                <div className="p-10 overflow-y-auto custom-scrollbar">
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
                    {/* Left: Configuration */}
                    <div className="lg:col-span-7 space-y-8">
                      <div className="grid grid-cols-1 gap-8">
                        <div className="space-y-2.5">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] px-2">Operation Protocol</label>
                          <div className="relative group">
                            <Package className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors" size={20} />
                            <select
                              value={assignForm.service_id}
                              onChange={(e) => handleServiceSelect(e.target.value)}
                              className="w-full bg-slate-50 border-none ring-1 ring-slate-200 focus:ring-2 focus:ring-indigo-500 pl-14 pr-6 py-5 rounded-[1.5rem] text-sm font-black text-slate-800 transition-all appearance-none shadow-sm"
                            >
                              <option value="">Search Architecture Catalog...</option>
                              {services.map((s) => (
                                <option key={s.id} value={s.id}>{s.name} (₹{s.charges})</option>
                              ))}
                            </select>
                            <ChevronRight className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-300 pointer-events-none rotate-90" size={18} />
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-8">
                          <div className="space-y-2.5">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] px-2">Assigned Agent</label>
                            <div className="relative group">
                              <Users className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors" size={20} />
                              <select
                                value={assignForm.employee_id}
                                onChange={(e) => setAssignForm({ ...assignForm, employee_id: e.target.value })}
                                className="w-full bg-slate-50 border-none ring-1 ring-slate-200 focus:ring-2 focus:ring-indigo-500 pl-14 pr-6 py-5 rounded-[1.5rem] text-sm font-black text-slate-800 transition-all shadow-sm"
                              >
                                <option value="">Select Personnel...</option>
                                {employees
                                  .sort((a, b) => {
                                    const aOnline = a.status === 'on_duty' || a.is_clocked_in;
                                    const bOnline = b.status === 'on_duty' || b.is_clocked_in;
                                    if (aOnline && !bOnline) return -1;
                                    if (!aOnline && bOnline) return 1;
                                    return 0;
                                  })
                                  .map((e) => {
                                    const isOnline = e.status === 'on_duty' || e.is_clocked_in;
                                    return (
                                      <option key={e.id} value={e.id}>
                                        {e.name} {isOnline ? "• ONLINE" : `• ${e.status || 'OFFLINE'}`}
                                      </option>
                                    );
                                  })}
                              </select>
                            </div>
                          </div>

                          <div className="space-y-2.5">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] px-2">Deployment Target</label>
                            <div className="relative group">
                              <Box className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors" size={20} />
                              <select
                                value={assignForm.room_id}
                                onChange={(e) => setAssignForm({ ...assignForm, room_id: e.target.value })}
                                className="w-full bg-slate-50 border-none ring-1 ring-slate-200 focus:ring-2 focus:ring-indigo-500 pl-14 pr-6 py-5 rounded-[1.5rem] text-sm font-black text-slate-800 transition-all shadow-sm"
                              >
                                <option value="">Select Target Location...</option>
                                {locations
                                  .sort((a, b) => {
                                    // Sort guest rooms first, then other locations alphabetically
                                    const aIsRoom = a.location_type === 'GUEST_ROOM';
                                    const bIsRoom = b.location_type === 'GUEST_ROOM';
                                    if (aIsRoom && !bIsRoom) return -1;
                                    if (!aIsRoom && bIsRoom) return 1;
                                    return a.name.localeCompare(b.name);
                                  })
                                  .map((loc) => {
                                    const matchingRoom = allRooms.find(r => r.inventory_location_id === loc.id);
                                    const isOccupied = matchingRoom ? occupiedRoomIds.has(matchingRoom.id) : false;
                                    
                                    let label = "";
                                    if (loc.location_type === 'GUEST_ROOM') {
                                      label = `Room ${loc.name} ${isOccupied ? "🟢 OCCUPIED" : "⚪ VACANT"}`;
                                    } else {
                                      label = `${loc.name} (${loc.location_type || 'LOCATION'})`;
                                    }
                                    
                                    return (
                                      <option key={loc.id} value={loc.id}>
                                        {label}
                                      </option>
                                    );
                                  })}
                              </select>
                            </div>
                          </div>
                        </div>

                        <div className="space-y-3">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] px-2">Mission Priority</label>
                          <div className="flex gap-4 p-1.5 bg-slate-100/50 rounded-2xl ring-1 ring-slate-200">
                            {['pending', 'in_progress', 'completed'].map((status) => (
                              <button
                                key={status}
                                onClick={() => setAssignForm({ ...assignForm, status })}
                                className={`flex-1 py-3.5 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] transition-all duration-300 ${assignForm.status === status
                                  ? status === 'completed' ? 'bg-emerald-600 text-white shadow-lg' :
                                    status === 'in_progress' ? 'bg-indigo-600 text-white shadow-lg' : 'bg-amber-500 text-white shadow-lg'
                                  : 'text-slate-400 hover:text-slate-600 hover:bg-white/50'
                                  }`}
                              >
                                {status.replace('_', ' ')}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Right: Logistics Manifest */}
                    <div className="lg:col-span-5 h-full">
                      <div className="bg-slate-50/50 rounded-[2rem] p-8 border border-slate-100 flex flex-col min-h-full h-full">
                        {selectedServiceDetails ? (
                          <div className="space-y-8 flex-1 flex flex-col">
                            <div className="flex justify-between items-start bg-white p-5 rounded-2xl shadow-sm ring-1 ring-slate-100">
                              <div>
                                <h3 className="font-black text-slate-800 text-xl tracking-tight leading-tight">{selectedServiceDetails.name}</h3>
                                <p className="text-[10px] text-indigo-500 font-black uppercase tracking-[0.2em] mt-1.5">Rate: ₹{selectedServiceDetails.charges.toLocaleString()}</p>
                              </div>
                              {selectedServiceDetails.images?.[0] && (
                                <img src={getImageUrl(selectedServiceDetails.images[0].image_url)} className="w-20 h-16 object-cover rounded-xl border-2 border-white shadow-md" />
                              )}
                            </div>

                            <div className="flex-1 space-y-6">
                              {selectedServiceDetails.inventory_items?.length > 0 ? (
                                <div className="space-y-4">
                                  <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2">
                                    <ClipboardList size={14} className="text-indigo-500" /> Standard Payload Manifest
                                  </h4>
                                  <div className="space-y-3">
                                    {selectedServiceDetails.inventory_items.map((item, idx) => (
                                      <div key={idx} className="bg-white p-4 rounded-2xl ring-1 ring-slate-100 shadow-sm hover:ring-indigo-200 transition-all">
                                        <div className="flex justify-between items-center mb-3">
                                          <span className="text-xs font-black text-slate-700">{item.name} <span className="text-slate-400 font-bold ml-1">x{item.quantity}</span></span>
                                          <span className="text-[9px] font-black text-indigo-500 uppercase tracking-widest bg-indigo-50 px-2 py-1 rounded-md">Required</span>
                                        </div>
                                        <select
                                          className={`w-full bg-slate-50 border-none ring-1 text-[11px] font-bold py-2.5 px-3 rounded-xl transition-all ${!inventorySourceSelections[item.id] ? 'ring-red-200 text-red-500' : 'ring-slate-100'}`}
                                          value={inventorySourceSelections[item.id] || ""}
                                          onChange={(e) => setInventorySourceSelections(prev => ({ ...prev, [item.id]: parseInt(e.target.value) }))}
                                        >
                                          <option value="">Select Resource Origin Node...</option>
                                          {itemStockData[item.id]?.map(stock => (
                                            <option key={stock.location_id} value={stock.location_id}>
                                              {stock.location_name} (Stock: {stock.quantity})
                                            </option>
                                          ))}
                                        </select>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              ) : (
                                <div className="bg-white/60 p-10 rounded-3xl border border-dashed border-slate-200 text-center flex flex-col items-center justify-center">
                                  <Activity size={32} className="text-slate-200 mb-3" />
                                  <p className="text-[10px] text-slate-400 font-black uppercase tracking-[0.2em]">Zero Dependencies</p>
                                  <p className="text-[9px] text-slate-300 font-bold mt-1 uppercase">Autonomous definition detected</p>
                                </div>
                              )}

                              {/* Supplementary Logistics */}
                              <div className="pt-6 border-t border-slate-100">
                                <div className="flex items-center justify-between mb-4">
                                  <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Auxiliary Supply Nodes</h4>
                                  <button onClick={handleAddExtraInventoryItem} className="text-[10px] font-black text-indigo-600 hover:text-indigo-800 uppercase tracking-[0.2em] flex items-center gap-1 group">
                                    <Plus size={10} className="group-hover:rotate-90 transition-transform" /> Add Row
                                  </button>
                                </div>
                                <div className="space-y-2.5 max-h-[220px] overflow-y-auto custom-scrollbar pr-2">
                                  {extraInventoryItems.map((item, index) => (
                                    <div key={index} className="flex gap-2 animate-fadeIn bg-indigo-50/30 p-2.5 rounded-2xl shadow-sm border border-indigo-100">
                                      <select
                                        value={item.inventory_item_id}
                                        onChange={(e) => handleUpdateExtraInventoryItem(index, 'inventory_item_id', e.target.value)}
                                        className="flex-1 bg-white border-none text-[10px] font-black p-2 rounded-xl ring-1 ring-slate-100 shadow-sm"
                                      >
                                        <option value="">Select Item...</option>
                                        {inventoryItems.map((invItem) => (
                                          <option key={invItem.id} value={invItem.id}>{invItem.name}</option>
                                        ))}
                                      </select>
                                      <div className="flex items-center gap-2 bg-white px-2 rounded-xl ring-1 ring-slate-100 shadow-sm w-16">
                                        <input
                                          type="number"
                                          value={item.quantity}
                                          onChange={(e) => handleUpdateExtraInventoryItem(index, 'quantity', e.target.value)}
                                          className="w-full bg-transparent border-none text-[10px] font-black text-center focus:outline-none"
                                        />
                                      </div>
                                      <button onClick={() => handleRemoveExtraInventoryItem(index)} className="text-slate-300 hover:text-red-500 p-2 transition-colors">
                                        <X size={16} />
                                      </button>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="flex-1 flex flex-col items-center justify-center opacity-30 py-20">
                            <Activity size={64} className="text-slate-200 mb-6 animate-pulse" />
                            <p className="text-xs font-black text-slate-400 uppercase tracking-[0.3em]">Awaiting Selection</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="p-10 border-t border-slate-50 bg-slate-50/20 flex justify-end gap-6">
                  <button
                    onClick={() => setShowAssignModal(false)}
                    className="px-10 py-5 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 hover:text-slate-900 transition-all font-bold"
                  >
                    Terminate
                  </button>
                  <button
                    onClick={handleAssign}
                    className="px-16 py-5 rounded-[1.5rem] bg-slate-900 hover:bg-emerald-600 text-white text-[10px] font-black uppercase tracking-[0.3em] shadow-2xl active:scale-95 transition-all flex items-center gap-4 group"
                  >
                    <Zap size={18} className="text-amber-400 group-hover:scale-125 transition-transform" />
                    Initiate Deployment Cycle
                  </button>
                </div>
              </div>
            </div>
          )
        }

        {completingRequestId && (
          <InventoryRecoveryModal
            assignedServiceId={completingServiceId}
            requestId={completingRequestId}
            onClose={() => { setCompletingRequestId(null); setCompletingServiceId(null); }}
            onComplete={() => { setCompletingRequestId(null); setCompletingServiceId(null); fetchAll(); }}
          />
        )}

        <BannerMessage
          message={bannerMessage}
          onClose={closeBannerMessage}
          autoDismiss={true}
          duration={5000}
        />
      </div >
    </DashboardLayout >
  );
};

export default Services;
