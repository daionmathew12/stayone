import React, { useEffect, useState, useMemo } from "react";
import { useLocation } from "react-router-dom";
import DashboardLayout from "../layout/DashboardLayout";
import api from "../services/api";
import API from "../services/api";
import { Bar, Line } from "react-chartjs-2";
import "chart.js/auto";
import { ChefHat, X, Package, Home, UtensilsCrossed, Truck, CreditCard, CheckCircle, XCircle, Clock, TrendingUp, Plus, Trash2, ShoppingCart, Printer } from "lucide-react";
import CountUp from "react-countup";
import { toast } from "react-hot-toast";
import { getImageUrl } from "../utils/imageUtils";
import { getMediaBaseUrl } from "../utils/env";
import { formatDateTimeIST, formatDateIST } from "../utils/dateUtils";
import { normalizeQuantity } from "../utils/quantityValidation";
import { usePermissions } from "../hooks/usePermissions";

export default function FoodOrders() {
  const location = useLocation();
  const { hasPermission, isAdmin } = usePermissions();

  const foodTabs = [
    { id: "dashboard", label: "Analytics", icon: <TrendingUp className="w-5 h-5" />, permission: "food_orders_dashboard:view" },
    { id: "orders", label: "Room & Dine-in Orders", icon: <ShoppingCart className="w-5 h-5" />, permission: "food_orders_list:view" },
    { id: "requests", label: "Order Requests", icon: <Truck className="w-5 h-5" />, permission: "food_orders_requests:view" },
    { id: "management", label: "Menu Management", icon: <ChefHat className="w-5 h-5" />, permission: "food_orders_management:view" },
  ].filter(tab => hasPermission(tab.permission) || isAdmin);

  const [activeTab, setActiveTab] = useState(() => foodTabs[0]?.id || "dashboard");

  // Set active tab based on route
  useEffect(() => {
    if (location.pathname.includes("/food-categories") || location.pathname.includes("/food-items")) {
      setActiveTab("management");
    } else if (location.pathname.includes("/food-orders")) {
      // Keep current if valid, else default
    }
  }, [location.pathname]);

  useEffect(() => {
    if (foodTabs.length > 0 && !foodTabs.find(t => t.id === activeTab)) {
      setActiveTab(foodTabs[0].id);
    }
  }, [foodTabs, activeTab]);

  // Food Order Requests state
  const [foodOrderRequests, setFoodOrderRequests] = useState([]);
  const [assigningRequestId, setAssigningRequestId] = useState(null);
  const [selectedEmployeeForRequest, setSelectedEmployeeForRequest] = useState("");

  // Dashboard state
  const [dashboardData, setDashboardData] = useState({
    totalRevenue: 0,
    totalOrders: 0,
    completedOrders: 0,
    pendingOrders: 0,
    deliveryOrders: 0,
    dineInOrders: 0,
    totalItemsSold: 0,
    topItems: [],
    salesByDate: [],
    ordersByStatus: [],
    employeePerformance: [],
    revenueByType: [],
    itemsUsage: [],
    // Business metrics (initialized to prevent undefined errors)
    totalCOGS: 0,
    totalProfit: 0,
    profitMargin: 0,
    averageOrderValue: 0,
    averageCOGS: 0,
    averageProfit: 0,
    orderCosts: []
  });
  const [dashboardFilters, setDashboardFilters] = useState({
    fromDate: "",
    toDate: "",
    orderType: "all"
  });
  const [allOrdersForDashboard, setAllOrdersForDashboard] = useState([]);
  const [recipesData, setRecipesData] = useState({});
  const [orders, setOrders] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [foodItems, setFoodItems] = useState([]);
  const [selectedItems, setSelectedItems] = useState([]);
  const [roomId, setRoomId] = useState("");
  const [employeeId, setEmployeeId] = useState("");
  const [preparedById, setPreparedById] = useState("");
  const [amount, setAmount] = useState(0);
  const [orderType, setOrderType] = useState("dine_in"); // "dine_in" or "room_service"
  const [deliveryRequest, setDeliveryRequest] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [dateFilter, setDateFilter] = useState("");
  const [hasMore, setHasMore] = useState(true);
  const [isFetchingMore, setIsFetchingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [viewingIngredients, setViewingIngredients] = useState(null);
  const [ingredientsData, setIngredientsData] = useState({});
  const [loadingIngredients, setLoadingIngredients] = useState(false);
  const [recipesCache, setRecipesCache] = useState({}); // Cache recipes by food_item_id
  const [showDeliveryRequestModal, setShowDeliveryRequestModal] = useState(null);
  const [deliveryRequestText, setDeliveryRequestText] = useState("");
  const [showCompleteModal, setShowCompleteModal] = useState(null);
  const [showRequestCompleteModal, setShowRequestCompleteModal] = useState(null);
  const [viewingFoodItemDetails, setViewingFoodItemDetails] = useState(null);
  const [paymentStatus, setPaymentStatus] = useState("unpaid");
  const [paymentMode, setPaymentMode] = useState("Cash");
  const [paymentFilter, setPaymentFilter] = useState("");

  // Food Management states (from FoodCategory.jsx)
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState(""); // Base price for dine-in
  const [roomServicePrice, setRoomServicePrice] = useState(""); // Price for room service/parcel
  const [images, setImages] = useState([]);
  const [imagePreviews, setImagePreviews] = useState([]);
  const [editingItemId, setEditingItemId] = useState(null);
  const [available, setAvailable] = useState(true);
  const [alwaysAvailable, setAlwaysAvailable] = useState(false); // Always available option
  const [filters, setFilters] = useState({ search: "", category: "all", availability: "all" });
  const [categoryName, setCategoryName] = useState("");
  const [categoryImageFile, setCategoryImageFile] = useState(null);
  const [categoryPreviewUrl, setCategoryPreviewUrl] = useState(null);
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState("");
  const [editCategoryId, setEditCategoryId] = useState(null);

  // Modal states for creation forms
  const [showFoodOrderModal, setShowFoodOrderModal] = useState(false);
  const [showFoodItemModal, setShowFoodItemModal] = useState(false);

  // Extra inventory items for food item
  const [extraInventoryItems, setExtraInventoryItems] = useState([]);
  const [inventoryItemsList, setInventoryItemsList] = useState([]);

  // Available time for food item
  const [availableFromTime, setAvailableFromTime] = useState("");
  const [availableToTime, setAvailableToTime] = useState("");

  // Time-wise pricing
  const [timeWisePrices, setTimeWisePrices] = useState([]);

  // Pagination states for Food Items and Categories
  const [foodItemPage, setFoodItemPage] = useState(1);
  const [totalFoodItemsCount, setTotalFoodItemsCount] = useState(0);
  const [availableFoodItemsCount, setAvailableFoodItemsCount] = useState(0);
  const [categoryPage, setCategoryPage] = useState(1);
  const [totalCategoriesCount, setTotalCategoriesCount] = useState(0);
  const itemsPerPage = 20;

  const statusColors = {
    pending: "bg-yellow-100 text-yellow-800",
    in_progress: "bg-blue-100 text-blue-800",
    ready: "bg-purple-100 text-purple-800",
    completed: "bg-green-100 text-green-800",
    cancelled: "bg-red-100 text-red-800",
    scheduled: "bg-orange-100 text-orange-800",
  };

  const token = localStorage.getItem("token");

  // Helper function for image URLs
  // Utility moved to utils/imageUtils.js

  // KPI Card component
  const KpiCard = ({ title, value, icon, color }) => (
    <div className={`p-6 rounded-2xl text-white shadow-lg flex items-center justify-between transition-transform duration-300 transform hover:scale-105 ${color}`}>
      <div>
        <h4 className="text-lg font-medium">{title}</h4>
        <p className="text-3xl font-bold mt-1">{value}</p>
      </div>
      <div className="text-4xl opacity-80">{icon}</div>
    </div>
  );

  useEffect(() => {
    fetchAll();
    if (activeTab === "management") {
      fetchCategories();
      fetchFoodItems();
      fetchInventoryItems();
    } else if (activeTab === "requests") {
      fetchFoodOrderRequests();
    } else if (activeTab === "dashboard") {
      fetchAllOrdersForDashboard();
    }
  }, [activeTab]);

  // Fetch inventory items for extra items selection
  const fetchInventoryItems = async () => {
    try {
      const res = await api.get("/inventory/items?limit=1000");
      setInventoryItemsList(res.data || []);
    } catch (error) {
      console.error("Failed to fetch inventory items:", error);
      setInventoryItemsList([]);
    }
  };

  // Handle extra inventory items
  const handleAddExtraInventoryItem = () => {
    setExtraInventoryItems([...extraInventoryItems, { inventory_item_id: "", quantity: 1 }]);
  };

  const handleUpdateExtraInventoryItem = (index, field, value) => {
    const updated = [...extraInventoryItems];
    if (field === "quantity") {
      const invItem = inventoryItemsList.find(item => item.id === parseInt(updated[index].inventory_item_id));
      updated[index][field] = normalizeQuantity(value, invItem?.unit);
    } else {
      updated[index][field] = value;
    }
    setExtraInventoryItems(updated);
  };

  const handleRemoveExtraInventoryItem = (index) => {
    setExtraInventoryItems(extraInventoryItems.filter((_, i) => i !== index));
  };

  // Handle time-wise pricing
  const handleAddTimeWisePrice = () => {
    setTimeWisePrices([...timeWisePrices, { from_time: "", to_time: "", price: "" }]);
  };

  const handleUpdateTimeWisePrice = (index, field, value) => {
    const updated = [...timeWisePrices];
    updated[index][field] = value;
    setTimeWisePrices(updated);
  };

  const handleRemoveTimeWisePrice = (index) => {
    setTimeWisePrices(timeWisePrices.filter((_, i) => i !== index));
  };

  useEffect(() => {
    if (activeTab === "dashboard") {
      calculateDashboardData();
    }
  }, [activeTab, allOrdersForDashboard, dashboardFilters, recipesData]);

  // Fetch all orders for dashboard analysis
  const fetchAllOrdersForDashboard = async () => {
    try {
      // Fetch orders, food items, employees, and inventory items in parallel
      const [ordersRes, foodItemsRes, employeesRes, inventoryRes] = await Promise.all([
        api.get("/food-orders?limit=10000").catch(err => {
          console.error("Error fetching orders:", err);
          return { data: [] };
        }),
        api.get("/food-items?limit=10000").catch(err => {
          console.error("Error fetching food items:", err);
          return { data: [] };
        }),
        api.get("/employees").catch(err => {
          console.error("Error fetching employees:", err);
          return { data: [] };
        }),
        api.get("/inventory/items?limit=10000").catch(err => {
          console.error("Error fetching inventory items:", err);
          return { data: [] };
        })
      ]);

      const orders = ordersRes.data || [];
      const foodItems = foodItemsRes.data || [];
      const employees = employeesRes.data || [];
      const inventoryItems = inventoryRes.data || [];

      // Create lookup maps
      const foodItemsMap = {};
      foodItems.forEach(item => {
        foodItemsMap[item.id] = item;
      });

      const employeesMap = {};
      employees.forEach(emp => {
        employeesMap[emp.id] = emp;
      });

      const inventoryItemsMap = {};
      inventoryItems.forEach(item => {
        inventoryItemsMap[item.id] = item;
      });

      // Store inventory items map for cost calculations
      setInventoryItemsList(inventoryItems);

      // Enrich orders with food item and employee details
      const enrichedOrders = orders.map(order => {
        const enrichedOrder = { ...order };

        // Enrich items with food item details
        if (enrichedOrder.items && Array.isArray(enrichedOrder.items)) {
          enrichedOrder.items = enrichedOrder.items.map(item => {
            const foodItem = foodItemsMap[item.food_item_id];
            return {
              ...item,
              food_item: foodItem || { id: item.food_item_id, name: `Item ${item.food_item_id}`, price: 0 }
            };
          });
        }

        // Enrich employee details
        if (enrichedOrder.assigned_employee_id) {
          enrichedOrder.assigned_employee = employeesMap[enrichedOrder.assigned_employee_id] || {
            id: enrichedOrder.assigned_employee_id,
            name: `Employee ${enrichedOrder.assigned_employee_id}`
          };
        }

        return enrichedOrder;
      });

      setAllOrdersForDashboard(enrichedOrders);

      // Also fetch recipes for inventory usage tracking
      fetchRecipesForInventory(foodItems);
    } catch (error) {
      console.error("Failed to fetch orders for dashboard:", error);
      setAllOrdersForDashboard([]);
    }
  };

  // Fetch recipes for inventory usage tracking
  const fetchRecipesForInventory = async (foodItems) => {
    try {
      const recipePromises = foodItems.map(item =>
        api.get(`/recipes?food_item_id=${item.id}`).catch(() => ({ data: [] }))
      );
      const recipeResponses = await Promise.all(recipePromises);

      const recipesMap = {};
      recipeResponses.forEach((res, idx) => {
        const recipes = res.data || [];
        if (recipes.length > 0) {
          recipesMap[foodItems[idx].id] = recipes[0]; // Take first recipe if multiple
        }
      });

      setRecipesData(recipesMap);
    } catch (error) {
      console.error("Failed to fetch recipes:", error);
    }
  };

  // Calculate dashboard metrics
  const calculateDashboardData = () => {
    let filteredOrders = [...allOrdersForDashboard];

    // Apply date filters
    if (dashboardFilters.fromDate) {
      filteredOrders = filteredOrders.filter(order =>
        order.created_at && order.created_at >= dashboardFilters.fromDate
      );
    }
    if (dashboardFilters.toDate) {
      filteredOrders = filteredOrders.filter(order =>
        order.created_at && order.created_at <= `${dashboardFilters.toDate}T23:59:59`
      );
    }
    if (dashboardFilters.orderType !== "all") {
      filteredOrders = filteredOrders.filter(order =>
        order.order_type === dashboardFilters.orderType
      );
    }

    // Calculate totals
    const totalRevenue = filteredOrders
      .filter(o => o.status === "completed")
      .reduce((sum, o) => sum + (parseFloat(o.amount) || 0), 0);

    const totalOrders = filteredOrders.length;
    const completedOrders = filteredOrders.filter(o => o.status === "completed").length;
    const pendingOrders = filteredOrders.filter(o => o.status === "pending").length;
    const deliveryOrders = filteredOrders.filter(o => o.order_type === "room_service").length;
    const dineInOrders = filteredOrders.filter(o => o.order_type === "dine_in").length;

    // Calculate items sold
    const itemsMap = {};
    let totalItemsSold = 0;
    filteredOrders.forEach(order => {
      if (order.items && Array.isArray(order.items)) {
        order.items.forEach(item => {
          const itemId = item.food_item_id;
          const quantity = item.quantity || 0;
          totalItemsSold += quantity;

          if (!itemsMap[itemId]) {
            itemsMap[itemId] = {
              food_item_id: itemId,
              food_item_name: item.food_item?.name || `Item ${itemId}`,
              quantity: 0,
              revenue: 0
            };
          }
          itemsMap[itemId].quantity += quantity;
          if (order.status === "completed") {
            const itemPrice = item.food_item?.price || 0;
            itemsMap[itemId].revenue += itemPrice * quantity;
          }
        });
      }
    });

    // Top items by quantity
    const topItems = Object.values(itemsMap)
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 10);

    // Sales by date
    const salesByDateMap = {};
    filteredOrders
      .filter(o => o.status === "completed")
      .forEach(order => {
        const date = order.created_at ? order.created_at.split('T')[0] : '';
        if (date) {
          if (!salesByDateMap[date]) {
            salesByDateMap[date] = { date, revenue: 0, orders: 0 };
          }
          salesByDateMap[date].revenue += parseFloat(order.amount) || 0;
          salesByDateMap[date].orders += 1;
        }
      });
    const salesByDate = Object.values(salesByDateMap)
      .sort((a, b) => new Date(a.date) - new Date(b.date))
      .slice(-30); // Last 30 days

    // Orders by status
    const statusCounts = {};
    filteredOrders.forEach(order => {
      const status = order.status || "unknown";
      statusCounts[status] = (statusCounts[status] || 0) + 1;
    });
    const ordersByStatus = Object.entries(statusCounts).map(([status, count]) => ({
      name: status.replace("_", " ").toUpperCase(),
      value: count
    }));

    // Employee performance
    const employeeMap = {};
    filteredOrders
      .filter(o => o.status === "completed" && o.assigned_employee_id)
      .forEach(order => {
        const empId = order.assigned_employee_id;
        if (!employeeMap[empId]) {
          employeeMap[empId] = {
            employee_id: empId,
            employee_name: order.assigned_employee?.name || `Employee ${empId}`,
            orders: 0,
            revenue: 0
          };
        }
        employeeMap[empId].orders += 1;
        employeeMap[empId].revenue += parseFloat(order.amount) || 0;
      });
    const employeePerformance = Object.values(employeeMap)
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10);

    // Revenue by type
    const revenueByType = [
      {
        name: "Dine In",
        value: filteredOrders
          .filter(o => o.order_type === "dine_in" && o.status === "completed")
          .reduce((sum, o) => sum + (parseFloat(o.amount) || 0), 0)
      },
      {
        name: "Room Service",
        value: filteredOrders
          .filter(o => o.order_type === "room_service" && o.status === "completed")
          .reduce((sum, o) => sum + (parseFloat(o.amount) || 0), 0)
      }
    ];

    // Items usage (inventory items used in food items)
    const itemsUsageMap = {};
    filteredOrders.forEach(order => {
      if (order.items && Array.isArray(order.items)) {
        order.items.forEach(item => {
          // Get recipe from recipesData map
          const foodItemId = item.food_item_id;
          const recipe = recipesData[foodItemId];

          if (recipe && recipe.ingredients && Array.isArray(recipe.ingredients)) {
            recipe.ingredients.forEach(ing => {
              const invId = ing.inventory_item_id;
              const quantity = (parseFloat(ing.quantity) || 0) * (item.quantity || 0);
              if (!itemsUsageMap[invId]) {
                itemsUsageMap[invId] = {
                  inventory_item_id: invId,
                  inventory_item_name: ing.inventory_item?.name || ing.inventory_item_name || `Item ${invId}`,
                  quantity: 0,
                  unit: ing.inventory_item?.unit || ing.unit || "unit"
                };
              }
              itemsUsageMap[invId].quantity += quantity;
            });
          }
        });
      }
    });
    const itemsUsage = Object.values(itemsUsageMap)
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 20);

    // Calculate Cost of Goods Sold (COGS) and Profit
    const completedOrdersList = filteredOrders.filter(o => o.status === "completed");
    let totalCOGS = 0;
    let totalProfit = 0;
    const orderCosts = [];

    completedOrdersList.forEach(order => {
      let orderCOGS = 0;
      if (order.items && Array.isArray(order.items)) {
        order.items.forEach(item => {
          const foodItemId = item.food_item_id;
          const quantity = item.quantity || 0;
          const recipe = recipesData[foodItemId];

          if (recipe && recipe.ingredients && Array.isArray(recipe.ingredients)) {
            const servings = recipe.servings || 1;
            const recipeMultiplier = quantity / servings;

            recipe.ingredients.forEach(ing => {
              const invItem = inventoryItemsList.find(inv => inv.id === ing.inventory_item_id);
              if (invItem && invItem.unit_price) {
                const ingredientCost = (ing.quantity || 0) * invItem.unit_price * recipeMultiplier;
                orderCOGS += ingredientCost;
              }
            });
          }

          // Add extra inventory items cost for room service
          if (order.order_type === "room_service" && item.food_item?.extra_inventory_items) {
            item.food_item.extra_inventory_items.forEach(extra => {
              const invItem = inventoryItemsList.find(inv => inv.id === extra.inventory_item_id);
              if (invItem && invItem.unit_price) {
                orderCOGS += (extra.quantity || 0) * invItem.unit_price * quantity;
              }
            });
          }
        });
      }

      const orderRevenue = parseFloat(order.amount) || 0;
      const orderProfit = orderRevenue - orderCOGS;
      totalCOGS += orderCOGS;
      totalProfit += orderProfit;

      orderCosts.push({
        orderId: order.id,
        revenue: orderRevenue,
        cost: orderCOGS,
        profit: orderProfit,
        margin: orderRevenue > 0 ? ((orderProfit / orderRevenue) * 100) : 0
      });
    });

    const profitMargin = totalRevenue > 0 ? ((totalProfit / totalRevenue) * 100) : 0;
    const averageOrderValue = completedOrders > 0 ? totalRevenue / completedOrders : 0;
    const averageCOGS = completedOrders > 0 ? totalCOGS / completedOrders : 0;
    const averageProfit = completedOrders > 0 ? totalProfit / completedOrders : 0;

    // Calculate item costs and profits
    Object.keys(itemsMap).forEach(itemId => {
      const item = itemsMap[itemId];
      const recipe = recipesData[itemId];
      let itemCost = 0;

      if (recipe && recipe.ingredients && Array.isArray(recipe.ingredients)) {
        const servings = recipe.servings || 1;
        const recipeMultiplier = item.quantity / servings;
        recipe.ingredients.forEach(ing => {
          const invItem = inventoryItemsList.find(inv => inv.id === ing.inventory_item_id);
          if (invItem && invItem.unit_price) {
            itemCost += (ing.quantity || 0) * invItem.unit_price * recipeMultiplier;
          }
        });
      }

      item.cost = itemCost;
      item.profit = item.revenue - itemCost;
      item.margin = item.revenue > 0 ? ((item.profit / item.revenue) * 100) : 0;
    });

    setDashboardData({
      totalRevenue,
      totalOrders,
      completedOrders,
      pendingOrders,
      deliveryOrders,
      dineInOrders,
      totalItemsSold,
      topItems,
      salesByDate,
      ordersByStatus,
      employeePerformance,
      revenueByType,
      itemsUsage,
      // Business metrics
      totalCOGS,
      totalProfit,
      profitMargin,
      averageOrderValue,
      averageCOGS,
      averageProfit,
      orderCosts
    });
  };

  // Calculate specific food item stats
  const getFoodItemStats = (foodItemId) => {
    const itemOrders = allOrdersForDashboard.filter(order =>
      order.status === "completed" &&
      order.items && order.items.some(it => it.food_item_id === foodItemId)
    );

    let totalQuantity = 0;
    let totalRevenue = 0;
    const hourlySales = new Array(24).fill(0);
    const dailySales = {};

    itemOrders.forEach(order => {
      const item = order.items.find(it => it.food_item_id === foodItemId);
      if (item) {
        const qty = item.quantity || 0;
        totalQuantity += qty;
        totalRevenue += (item.food_item?.price || 0) * qty;

        if (order.created_at) {
          const dateObj = new Date(order.created_at);
          const hour = dateObj.getHours();
          hourlySales[hour] += qty;

          const dateStr = dateObj.toISOString().split('T')[0];
          dailySales[dateStr] = (dailySales[dateStr] || 0) + qty;
        }
      }
    });

    const topDay = Object.entries(dailySales).sort((a, b) => b[1] - a[1])[0];
    const peakHour = hourlySales.indexOf(Math.max(...hourlySales));

    return {
      totalQuantity,
      totalRevenue,
      hourlySales,
      dailySales: Object.entries(dailySales).sort((a, b) => a[0].localeCompare(b[0])).slice(-7), // Last 7 days
      topDay: topDay ? topDay[0] : "N/A",
      peakHour: peakHour !== -1 ? `${peakHour}:00` : "N/A"
    };
  };

  // Fetch food order requests (service requests with food_order_id)
  const fetchFoodOrderRequests = async () => {
    try {
      const res = await api.get("/service-requests?limit=1000");
      // Filter to only show requests with food_order_id (food order requests)
      const foodRequests = (res.data || []).filter(req => req.food_order_id);
      setFoodOrderRequests(foodRequests);
    } catch (error) {
      console.error("Failed to fetch food order requests:", error);
      setFoodOrderRequests([]);
    }
  };

  // Accept a food order request (change status to in_progress)
  const handleAcceptRequest = async (requestId) => {
    try {
      await api.put(`/service-requests/${requestId}`, {
        status: "in_progress"
      });
      toast.success("Request accepted successfully!");
      fetchFoodOrderRequests();
      fetchAll(); // Refresh orders list
    } catch (error) {
      console.error("Failed to accept request:", error);
      toast.error("Failed to accept request.");
    }
  };

  // Assign employee to a food order request
  const handleAssignEmployeeToRequest = async (requestId) => {
    if (!selectedEmployeeForRequest) {
      toast.error("Please select an employee.");
      return;
    }
    try {
      await api.put(`/service-requests/${requestId}`, {
        employee_id: parseInt(selectedEmployeeForRequest),
        status: "in_progress"
      });
      toast.success("Employee assigned successfully!");
      setAssigningRequestId(null);
      setSelectedEmployeeForRequest("");
      fetchFoodOrderRequests();
      fetchAll(); // Refresh orders list
    } catch (error) {
      console.error("Failed to assign employee:", error);
      toast.error("Failed to assign employee.");
    }
  };

  // Update request status
  const handleUpdateRequestStatus = async (requestId, newStatus) => {
    // Use loose comparison for IDs to avoid string/number mismatch
    const request = foodOrderRequests.find(r => String(r.id) === String(requestId));

    if (!request) {
      console.error("Could not find request with ID:", requestId);
      return;
    }

    // If completing a request that has a linked food order (object or ID), always show the modal 
    // so the user can verify/set payment status and mode.
    if (newStatus === "completed" && (request.food_order_id || request.food_order)) {
      const order = request.food_order || {};
      setPaymentStatus(order.billing_status === "paid" ? "paid" : "unpaid");
      setPaymentMode(order.payment_method || "Cash");
      setShowRequestCompleteModal(request);
      return;
    }

    try {
      await api.put(`/service-requests/${requestId}`, {
        status: newStatus
      });
      toast.success(`Status updated to ${newStatus}`);
      fetchFoodOrderRequests();
      fetchAll();
    } catch (error) {
      console.error("Failed to update status:", error);
      toast.error("Failed to update status");
    }
  };

  // Add handler for completing requests via modal
  const handleCompleteRequest = async () => {
    if (!showRequestCompleteModal) return;

    const request = showRequestCompleteModal;
    try {
      await api.put(`/service-requests/${request.id}`, {
        status: "completed",
        billing_status: paymentStatus,
        payment_mode: paymentStatus === "paid" ? paymentMode : null
      });

      toast.success(`Request marked as completed (${paymentStatus})`);
      setShowRequestCompleteModal(null);
      setPaymentStatus("unpaid");
      setPaymentMode("Cash");
      fetchFoodOrderRequests();
      fetchAll();
    } catch (error) {
      console.error("Failed to complete request:", error);
      toast.error("Failed to complete request.");
    }
  };

  // Delete a food order request
  const handleDeleteRequest = async (requestId) => {
    if (!window.confirm("Are you sure you want to delete this request?")) return;
    try {
      await api.delete(`/service-requests/${requestId}`);
      toast.success("Request deleted successfully!");
      fetchFoodOrderRequests();
    } catch (error) {
      console.error("Failed to delete request:", error);
      toast.error("Failed to delete request.");
    }
  };

  // Food Management functions
  const fetchCategoriesCount = async () => {
    try {
      const res = await API.get("/food-categories/count", {
        headers: { Authorization: `Bearer ${token}` },
      });
      setTotalCategoriesCount(res.data);
    } catch (err) {
      console.error("Failed to load categories count:", err);
    }
  };

  const fetchCategories = async (p = categoryPage) => {
    try {
      const res = await API.get(`/food-categories?skip=${(p - 1) * itemsPerPage}&limit=${itemsPerPage}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setCategories(res.data);
      fetchCategoriesCount();
    } catch (err) {
      console.error("Failed to load categories:", err);
    }
  };

  const fetchFoodItemsCount = async () => {
    try {
      const res = await API.get("/food-items/count", {
        headers: { Authorization: `Bearer ${token}` },
      });
      setTotalFoodItemsCount(res.data);
    } catch (err) {
      console.error("Failed to fetch food items count:", err);
    }
  };

  const fetchAvailableFoodItemsCount = async () => {
    try {
      const res = await API.get("/food-items/count?available=true", {
        headers: { Authorization: `Bearer ${token}` },
      });
      setAvailableFoodItemsCount(res.data);
    } catch (err) {
      console.error("Failed to fetch available food items count:", err);
    }
  };

  const fetchFoodItems = async (p = foodItemPage) => {
    try {
      const res = await API.get(`/food-items?skip=${(p - 1) * itemsPerPage}&limit=${itemsPerPage}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setFoodItems(res.data);
      fetchFoodItemsCount();
      fetchAvailableFoodItemsCount();
    } catch (err) {
      console.error("Failed to fetch items", err);
    }
  };

  useEffect(() => {
    if (activeTab === "management") {
      fetchFoodItems(foodItemPage);
    }
  }, [foodItemPage, activeTab]);

  useEffect(() => {
    if (activeTab === "management") {
      fetchCategories(categoryPage);
    }
  }, [categoryPage, activeTab]);

  const handleFoodImageChange = (e) => {
    const newFiles = Array.from(e.target.files);
    setImages((prevImages) => [...prevImages, ...newFiles]);
    const newPreviews = newFiles.map((file) => URL.createObjectURL(file));
    setImagePreviews((prev) => [...prev, ...newPreviews]);
  };

  const handleRemoveFoodImage = (index) => {
    setImages((prev) => prev.filter((_, i) => i !== index));
    setImagePreviews((prev) => prev.filter((_, i) => i !== index));
  };

  const handleFoodEdit = (item) => {
    setEditingItemId(item.id);
    setName(item.name);
    setDescription(item.description);
    setPrice(item.price || "");
    setRoomServicePrice(item.room_service_price || "");
    setSelectedCategory(item.category_id);
    setAvailable(item.available);
    setAlwaysAvailable(item.always_available === true);
    setImagePreviews(item.images?.map((img) => getImageUrl(img.image_url)) || []);
    setImages([]);
    setAvailableFromTime(item.available_from_time || "");
    setAvailableToTime(item.available_to_time || "");

    // Parse extra inventory items if it's a string
    let extraItems = item.extra_inventory_items || [];
    if (typeof extraItems === 'string') {
      try { extraItems = JSON.parse(extraItems); } catch (e) { extraItems = []; }
    }
    setExtraInventoryItems(extraItems);

    // Parse time wise prices if it's a string
    let twp = item.time_wise_prices || [];
    if (typeof twp === 'string') {
      try { twp = JSON.parse(twp); } catch (e) { twp = []; }
    }
    setTimeWisePrices(twp);
    setShowFoodItemModal(true); // Open modal for editing
  };

  const resetFoodForm = () => {
    setName("");
    setDescription("");
    setPrice("");
    setRoomServicePrice("");
    setSelectedCategory("");
    setImages([]);
    setImagePreviews([]);
    setEditingItemId(null);
    setAvailable(true);
    setAlwaysAvailable(false);
    setExtraInventoryItems([]);
    setAvailableFromTime("");
    setAvailableToTime("");
    setTimeWisePrices([]);
    setShowFoodItemModal(false); // Close modal on reset/cancel
  };

  const handleFoodSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    const formData = new FormData();
    formData.append("name", name);
    formData.append("description", description);
    formData.append("price", price);
    // Add room service price if provided
    if (roomServicePrice) {
      formData.append("room_service_price", roomServicePrice);
    }
    formData.append("category_id", selectedCategory);
    formData.append("available", available);
    formData.append("always_available", alwaysAvailable);
    images.forEach((img) => formData.append("images", img));

    // Add available time (only if not always available)
    if (!alwaysAvailable) {
      if (availableFromTime) {
        formData.append("available_from_time", availableFromTime);
      }
      if (availableToTime) {
        formData.append("available_to_time", availableToTime);
      }
    }

    // Add extra inventory items (only for parcel/room service)
    // These are automatically applied to room service orders only
    if (extraInventoryItems.length > 0) {
      formData.append("extra_inventory_items", JSON.stringify(
        extraInventoryItems.map(item => ({
          inventory_item_id: parseInt(item.inventory_item_id),
          quantity: parseFloat(item.quantity) || 0,
          for_room_service: true // Mark as room service only
        }))
      ));
    }

    // Add time-wise pricing
    if (timeWisePrices.length > 0) {
      formData.append("time_wise_prices", JSON.stringify(
        timeWisePrices.map(tp => ({
          from_time: tp.from_time,
          to_time: tp.to_time,
          price: parseFloat(tp.price) || 0
        }))
      ));
    }

    try {
      if (editingItemId) {
        await API.put(`/food-items/${editingItemId}/`, formData, {
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "multipart/form-data" },
        });
        toast.success("Food item updated successfully!");
      } else {
        await API.post("/food-items/", formData, {
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "multipart/form-data" },
        });
        toast.success("Food item added successfully!");
      }
      fetchFoodItems();
      resetFoodForm();
      setShowFoodItemModal(false); // Ensure modal is closed
    } catch (err) {
      console.error("Failed to save food item", err);
      toast.error("Failed to save food item.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleFoodDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this item?")) return;
    setIsLoading(true);
    try {
      await API.delete(`/food-items/${id}`, { headers: { Authorization: `Bearer ${token}` } });
      fetchFoodItems();
      toast.success("Food item deleted successfully!");
    } catch (err) {
      console.error("Delete failed", err);
      toast.error("Failed to delete food item.");
    } finally {
      setIsLoading(false);
    }
  };

  const toggleFoodAvailability = async (item) => {
    setIsLoading(true);
    try {
      await API.patch(
        `/food-items/${item.id}/toggle-availability?available=${!item.available}`,
        null,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      fetchFoodItems();
      toast.success(`Item status toggled to ${item.available ? 'Not Available' : 'Available'}`);
    } catch (err) {
      console.error("Failed to toggle availability", err);
      toast.error("Failed to toggle availability.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCategoryImageChange = (e) => {
    const file = e.target.files[0];
    setCategoryImageFile(file);
    if (file) {
      setCategoryPreviewUrl(URL.createObjectURL(file));
    } else {
      setCategoryPreviewUrl(null);
    }
  };

  const handleCategorySubmit = async (e) => {
    e.preventDefault();
    if (!categoryName) {
      toast.error("Please fill in the category name.");
      return;
    }
    setIsLoading(true);
    const formData = new FormData();
    formData.append("name", categoryName);
    if (categoryImageFile) formData.append("image", categoryImageFile);

    try {
      if (editCategoryId) {
        await API.put(`/food-categories/${editCategoryId}`, formData, {
          headers: { Authorization: `Bearer ${token}` },
        });
        setEditCategoryId(null);
        toast.success("Category updated successfully!");
      } else {
        if (!categoryImageFile) {
          toast.error("Please select an image for the new category.");
          setIsLoading(false);
          return;
        }
        await API.post("/food-categories", formData, {
          headers: { Authorization: `Bearer ${token}` },
        });
        toast.success("Category added successfully!");
      }
      setCategoryName("");
      setCategoryImageFile(null);
      setCategoryPreviewUrl(null);
      fetchCategories();
    } catch (err) {
      console.error("Failed to save category:", err);
      const errorMessage = err.response?.data?.detail || err.response?.data?.message || err.message || "Failed to save category.";
      toast.error(`Failed to save category: ${errorMessage}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCategoryEdit = (cat) => {
    setEditCategoryId(cat.id);
    setCategoryName(cat.name);
    setCategoryPreviewUrl(getImageUrl(`uploads/food_categories/${cat.image}`));
    setCategoryImageFile(null);
  };

  const handleCategoryDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this category?")) return;
    setIsLoading(true);
    try {
      await API.delete(`/food-categories/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      fetchCategories();
      toast.success("Category deleted successfully!");
    } catch (err) {
      console.error("Failed to delete:", err);
      toast.error("Failed to delete category. Check if it's in use.");
    } finally {
      setIsLoading(false);
    }
  };

  const fetchAll = async () => {
    try {
      // Fetch initial page of orders, rooms, bookings, and other data
      const [ordersRes, roomsRes, employeesRes, foodItemsRes, bookingsRes, packageBookingsRes, inventoryRes] = await Promise.all([
        api.get("/food-orders?skip=0&limit=20").catch(err => {
          console.error("Error fetching food orders:", err);
          return { data: [] };
        }),
        api.get("/rooms?limit=1000").catch(err => {
          console.error("Error fetching rooms:", err);
          return { data: [] };
        }),
        api.get("/employees?limit=1000").catch(err => {
          console.error("Error fetching employees:", err);
          return { data: [] };
        }),
        api.get("/food-items?limit=10000").catch(err => {
          console.error("Error fetching food items:", err);
          return { data: [] };
        }),
        api.get("/bookings?limit=1000").catch(err => {
          console.error("Error fetching bookings:", err);
          return { data: { bookings: [] } };
        }),
        api.get("/packages/bookingsall?limit=1000").catch(err => {
          console.error("Error fetching package bookings:", err);
          return { data: [] };
        }),
        api.get("/inventory/items?limit=10000").catch(err => {
          console.error("Error fetching inventory items:", err);
          return { data: [] };
        })
      ]);
      setOrders(ordersRes?.data || []);
      setHasMore((ordersRes?.data || []).length === 20);
      console.log("Food Orders - Employees fetched:", employeesRes?.data);
      setEmployees(Array.isArray(employeesRes?.data) ? employeesRes.data : []);
      setFoodItems(foodItemsRes?.data || []);
      setInventoryItemsList(inventoryRes?.data || []);

      // Fetch recipes for profitability calculation
      if (foodItemsRes.data && foodItemsRes.data.length > 0) {
        fetchRecipesForInventory(foodItemsRes.data);
      }

      try {
        // Filter rooms to only show checked-in rooms (similar to Services page)
        const allRooms = roomsRes?.data || [];
        const regularBookings = bookingsRes?.data?.bookings || [];
        const packageBookings = (packageBookingsRes?.data || []).map(pb => ({ ...pb, is_package: true }));

        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const checkedInRoomIds = new Set();
        const roomGuestNames = {};

        // Helper function to normalize status
        const normalizeStatus = (status) => {
          if (!status) return '';
          return status.toLowerCase().replace(/[-_\s]/g, '');
        };

        // Helper function to check if status is checked-in or booked (active booking)
        const isActiveBooking = (status) => {
          if (!status) return false;
          const normalized = status.toLowerCase().replace(/[-_\s]/g, '');
          return (normalized === 'checkedin' || normalized === 'booked' || normalized === 'occupied') &&
            normalized !== 'cancelled' &&
            !normalized.includes('checkedout');
        };

        // Get room IDs from active regular bookings
        regularBookings.forEach(booking => {
          if (isActiveBooking(booking.status)) {
            try {
              const checkInDate = new Date(booking.check_in);
              const checkOutDate = new Date(booking.check_out);
              checkInDate.setHours(0, 0, 0, 0);
              checkOutDate.setHours(0, 0, 0, 0);

              const normalizedStatus = normalizeStatus(booking.status);

              // If checked-in, we are more lenient with dates (handle overstays)
              const isActuallyCheckedIn = normalizedStatus === 'checkedin';

              if ((checkInDate <= today && checkOutDate >= today) || isActuallyCheckedIn) {
                if (booking.rooms && Array.isArray(booking.rooms)) {
                  booking.rooms.forEach(room => {
                    if (room && room.id) {
                      checkedInRoomIds.add(room.id);
                      roomGuestNames[room.id] = booking.guest_name;
                    }
                  });
                }
              }
            } catch (e) {
              console.error("Error processing regular booking:", e);
            }
          }
        });

        // Get room IDs from active package bookings
        packageBookings.forEach(booking => {
          if (isActiveBooking(booking.status)) {
            try {
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
                    const roomId = room?.id || roomLink.room_id;
                    if (roomId) {
                      checkedInRoomIds.add(roomId);
                      roomGuestNames[roomId] = booking.guest_name;
                    }
                  });
                }
              }
            } catch (e) {
              console.error("Error processing package booking:", e);
            }
          }
        });

        // Also check room status directly as a reliable fallback
        allRooms.forEach(room => {
          const roomStatusNormalized = normalizeStatus(room.status);
          if (roomStatusNormalized === 'checkedin' ||
            roomStatusNormalized === 'booked' ||
            roomStatusNormalized === 'occupied' ||
            roomStatusNormalized.includes('checkedin')) {
            checkedInRoomIds.add(room.id);
          }
        });

        const checkedInRooms = allRooms.filter(room => {
          const roomStatusNormalized = normalizeStatus(room.status);
          return checkedInRoomIds.has(room.id) ||
            roomStatusNormalized === 'checkedin' ||
            roomStatusNormalized === 'occupied';
        }).map(room => ({
          ...room,
          guest_name: roomGuestNames[room.id] || ''
        }));
        setRooms(checkedInRooms);
      } catch (roomFilterError) {
        console.error("Error during room filtering:", roomFilterError);
        setRooms([]);
      }
    } catch (error) {
      console.error("Failed to fetch data:", error);
      // Only clear orders if the main call failed
      setOrders(prev => prev.length ? prev : []);
    }
  };

  const fetchOrders = async () => {
    try {
      const ordersRes = await api.get("/food-orders?skip=0&limit=20");
      setOrders(ordersRes.data || []);
      setPage(1);
      setHasMore(ordersRes.data?.length === 20);
    } catch (error) {
      console.error("Failed to fetch orders:", error);
      setOrders([]);
    }
  };

  const loadMoreOrders = async () => {
    if (isFetchingMore || !hasMore) return;
    setIsFetchingMore(true);
    const nextPage = page + 1;
    try {
      const res = await api.get(`/food-orders?skip=${(nextPage - 1) * 20}&limit=20`);
      const newOrders = res.data || [];
      setOrders(prev => [...prev, ...newOrders]);
      setPage(nextPage);
      setHasMore(newOrders.length === 20);
    } catch (err) {
      console.error("Failed to load more orders:", err);
    } finally {
      setIsFetchingMore(false);
    }
  };

  const handleAddItem = () => {
    setSelectedItems([...selectedItems, { food_item_id: "", quantity: 1 }]);
  };

  const handleItemChange = (index, field, value) => {
    const updated = [...selectedItems];
    // Food quantities are always whole numbers (pcs)
    updated[index][field] = field === "quantity" ? Math.round(parseFloat(value) || 0) : value;
    setSelectedItems(updated);
    calculateAmount(updated);
  };

  // Helper to get active price based on time
  const getItemPriceAtTime = (food, oType = "dine_in") => {
    if (!food) return 0;

    // Check if time-wise prices exist
    let twp = food.time_wise_prices;
    if (twp) {
      if (typeof twp === 'string') {
        try { twp = JSON.parse(twp); } catch (e) { twp = []; }
      }

      if (Array.isArray(twp) && twp.length > 0) {
        const now = new Date();
        const currentTimeString = now.getHours().toString().padStart(2, '0') + ":" + now.getMinutes().toString().padStart(2, '0');

        for (const rule of twp) {
          const { from_time, to_time, price: rulePrice } = rule;

          if (from_time <= to_time) {
            if (currentTimeString >= from_time && currentTimeString <= to_time) {
              return parseFloat(rulePrice);
            }
          } else {
            // Over midnight range (e.g., 22:00 to 02:00)
            if (currentTimeString >= from_time || currentTimeString <= to_time) {
              return parseFloat(rulePrice);
            }
          }
        }
      }
    }

    // Return order type specific price if no time-wise match
    if (oType === "room_service" && food.room_service_price) {
      return parseFloat(food.room_service_price);
    }

    return parseFloat(food.price) || 0;
  };

  const calculateAmount = (items, oType = orderType) => {
    let total = 0;
    items.forEach((item) => {
      const food = foodItems.find((f) => f.id === parseInt(item.food_item_id));
      if (food) total += getItemPriceAtTime(food, oType) * item.quantity;
    });
    setAmount(total);
  };

  const handleSubmit = async () => {
    if (!roomId || !preparedById || (orderType === "room_service" && !employeeId) || selectedItems.length === 0) {
      alert("Please select room, kitchen assignment, " + (orderType === "room_service" ? "delivery person, " : "") + "and at least one food item.");
      return;
    }

    const payload = {
      room_id: parseInt(roomId),
      billing_status: "unbilled",
      assigned_employee_id: orderType === "room_service" && employeeId ? parseInt(employeeId) : null,
      prepared_by_id: parseInt(preparedById),
      amount,
      order_type: orderType,
      delivery_request: orderType === "room_service" && deliveryRequest ? deliveryRequest : null,
      items: selectedItems.map((item) => ({
        food_item_id: parseInt(item.food_item_id),
        quantity: item.quantity,
      })),
    };

    try {
      const res = await api.post("/food-orders/", payload);
      toast.success("Order created successfully!");

      // Manually add to state to ensure immediate visibility
      if (res.data) {
        setOrders(prev => [res.data, ...prev]);
      }

      // Only refresh orders table, not all data
      fetchOrders();
      // Also refresh dashboard data if on dashboard tab
      if (activeTab === "dashboard") {
        fetchAllOrdersForDashboard();
      }
      setSelectedItems([]);
      setRoomId("");
      setEmployeeId("");
      setPreparedById("");
      setAmount(0);
      setOrderType("dine_in");
      setDeliveryRequest("");
      setShowFoodOrderModal(false); // Close modal on success

      // Clear filters to ensure visibility
      setStatusFilter("");
      setDateFilter("");

      // Auto-scroll to the orders list to show the new order
      setTimeout(() => {
        const ordersSection = document.getElementById("orders-list-section");
        if (ordersSection) {
          ordersSection.scrollIntoView({ behavior: "smooth", block: "start" });
        }
      }, 100);
    } catch (err) {
      console.error(err);
      toast.error("Failed to submit order.");
    }
  };

  const handleAssignDeliveryPerson = async (orderId, employeeId) => {
    try {
      await api.put(`/food-orders/${orderId}`, {
        assigned_employee_id: employeeId ? parseInt(employeeId) : null
      });
      toast.success("Delivery agent assigned successfully!");
      fetchOrders();
      if (activeTab === "dashboard") {
        fetchAllOrdersForDashboard();
      }
    } catch (err) {
      console.error("Failed to assign delivery agent:", err);
      toast.error("Failed to assign delivery agent.");
    }
  };

  const handleAssignChef = async (orderId, chefId) => {
    try {
      await api.put(`/food-orders/${orderId}`, {
        prepared_by_id: chefId ? parseInt(chefId) : null
      });
      toast.success("Chef assigned successfully!");
      fetchOrders();
      if (activeTab === "dashboard") {
        fetchAllOrdersForDashboard();
      }
    } catch (err) {
      console.error("Failed to assign chef:", err);
      toast.error("Failed to assign chef.");
    }
  };

  const handleStatusChange = async (id, newStatus) => {
    // If completing, show modal for paid/unpaid selection
    if (newStatus === "completed") {
      const order = orders.find(o => o.id === id);
      setShowCompleteModal(order);
      setPaymentStatus(order.billing_status === "paid" ? "paid" : "unpaid");
      return;
    }


    // Optimistically update UI immediately
    setOrders(prev => prev.map(o => o.id === id ? { ...o, status: newStatus } : o));

    // For other status changes, update directly
    try {
      await api.put(`/food-orders/${id}`, { status: newStatus });
      toast.success("Order status updated successfully!");
      fetchOrders();
      // Also refresh dashboard data if on dashboard tab
      if (activeTab === "dashboard") {
        fetchAllOrdersForDashboard();
      }
    } catch (error) {
      console.error("Failed to update status:", error);
      toast.error("Failed to update order status.");
      // Revert optimistic update on error
      fetchOrders();
    }
  };

  const handleCompleteOrder = async () => {
    if (!showCompleteModal) return;

    const orderId = showCompleteModal.id;
    // Optimistic update
    setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: "completed", billing_status: paymentStatus } : o));
    setShowCompleteModal(null);
    const mode = paymentMode; // Capture current mode before reset
    setPaymentStatus("unpaid");
    setPaymentMode("Cash");

    try {
      await api.put(`/food-orders/${orderId}`, {
        status: "completed",
        billing_status: paymentStatus,
        payment_method: paymentStatus === "paid" ? mode : null
      });

      toast.success("Order completed successfully!");
      fetchOrders();
      // Also refresh dashboard data if on dashboard tab
      if (activeTab === "dashboard") {
        fetchAllOrdersForDashboard();
      }
    } catch (error) {
      console.error("Failed to complete order:", error);
      toast.error("Failed to complete order.");
      fetchOrders(); // Revert optimistic update
    }
  };

  const handleTogglePaymentStatus = async (order) => {
    const newBillingStatus = order.billing_status === "paid" ? "unpaid" : "paid";

    if (newBillingStatus === "paid") {
      // If marking as paid, open the modal to select payment mode
      setPaymentStatus("paid");
      setPaymentMode("Cash");
      setShowCompleteModal(order);
      return;
    }

    try {
      // Optimistic update for unpaying
      setOrders(prev => prev.map(o => o.id === order.id ? { ...o, billing_status: "unpaid" } : o));

      await api.put(`/food-orders/${order.id}`, {
        billing_status: "unpaid"
      });
      toast.success(`Order marked as unpaid`);
      fetchOrders();
      if (activeTab === "dashboard") {
        fetchAllOrdersForDashboard();
      }
    } catch (error) {
      console.error("Failed to update billing status:", error);
      toast.error("Failed to update billing status.");
      fetchOrders(); // Revert
    }
  };

  const handlePrintOrder = (order) => {
    const roomData = rooms.find((r) => r.id === order.room_id);
    const roomNumber = roomData?.number || roomData?.room_number || order.room_number || order.room_id;
    const printWindow = window.open("", "_blank", "width=800,height=600");

    const itemsHtml = (order.items || []).map(item => `
      <tr>
        <td style="padding: 8px; border-bottom: 1px solid #eee;">${item.food_item_name}</td>
        <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: center;">${item.quantity}</td>
        <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: right;">₹${(item.price || 0).toLocaleString()}</td>
        <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: right;">₹${(item.subtotal || 0).toLocaleString()}</td>
      </tr>
    `).join("");

    printWindow.document.write(`
      <html>
        <head>
          <title>Invoice - Order #${order.id}</title>
          <style>
            body { font-family: sans-serif; padding: 40px; color: #333; }
            .header { text-align: center; border-bottom: 2px solid #4f46e5; padding-bottom: 20px; margin-bottom: 30px; }
            .resort-name { font-size: 24px; font-bold; color: #4f46e5; margin-bottom: 5px; }
            .details { display: flex; justify-content: space-between; margin-bottom: 30px; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
            th { background-color: #f9fafb; padding: 12px 8px; text-align: left; border-bottom: 2px solid #eee; }
            .total-section { text-align: right; border-top: 2px solid #eee; padding-top: 20px; }
            .total-row { display: flex; justify-content: flex-end; gap: 40px; margin-bottom: 10px; }
            .grand-total { font-size: 20px; font-weight: bold; color: #4f46e5; }
            @media print { .no-print { display: none; } }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="resort-name">ORCHID RESORT</div>
            <div>FOOD & BEVERAGE INVOICE</div>
          </div>
          
          <div class="details">
            <div>
              <p><strong>Order ID:</strong> #${order.id}</p>
              <p><strong>Room:</strong> ${roomNumber}</p>
              <p><strong>Guest:</strong> ${order.guest_name || 'N/A'}</p>
            </div>
            <div style="text-align: right;">
              <p><strong>Date:</strong> ${formatDateIST(order.created_at)}</p>
              <p><strong>Status:</strong> ${order.billing_status.toUpperCase()}</p>
              <p><strong>Payment Mode:</strong> ${order.payment_method || 'Cash'}</p>
            </div>
          </div>

          <table>
            <thead>
              <tr>
                <th>Item</th>
                <th style="text-align: center;">Qty</th>
                <th style="text-align: right;">Price</th>
                <th style="text-align: right;">Subtotal</th>
              </tr>
            </thead>
            <tbody>
              ${itemsHtml}
            </tbody>
          </table>

          <div class="total-section">
            <div class="total-row">
              <span>Subtotal:</span>
              <span>₹${(order.amount || 0).toLocaleString()}</span>
            </div>
            <div class="total-row">
              <span>GST (5%):</span>
              <span>₹${(order.gst_amount || 0).toLocaleString()}</span>
            </div>
            <div class="total-row grand-total">
              <span>Grand Total:</span>
              <span>₹${(order.total_with_gst || order.amount).toLocaleString()}</span>
            </div>
          </div>

          <div style="margin-top: 50px; text-align: center; font-size: 12px; color: #999;">
            <p>Thank you for dining with us!</p>
          </div>

          <div class="no-print" style="margin-top: 30px; text-align: center;">
            <button onclick="window.print()" style="padding: 10px 20px; background: #4f46e5; color: white; border: none; rounded: 5px; cursor: pointer;">Print Invoice</button>
          </div>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const handleRaiseDeliveryRequest = (order) => {
    setShowDeliveryRequestModal(order.id);
    setDeliveryRequestText(order.delivery_request || "");
  };

  const handleSubmitDeliveryRequest = async (orderId) => {
    try {
      await api.put(`/food-orders/${orderId}`, {
        delivery_request: deliveryRequestText
      });
      setShowDeliveryRequestModal(null);
      setDeliveryRequestText("");
      toast.success("Delivery request updated successfully!");
      fetchOrders();
    } catch (error) {
      console.error("Failed to update delivery request:", error);
      toast.error("Failed to update delivery request.");
    }
  };

  // Fetch recipes for a food item (with caching)
  const fetchRecipeForFoodItem = async (foodItemId) => {
    // Check cache first
    if (recipesCache[foodItemId]) {
      return recipesCache[foodItemId];
    }

    try {
      const response = await api.get(`/recipes?food_item_id=${foodItemId}`);
      const recipes = response.data || [];
      // Cache the result
      setRecipesCache(prev => ({ ...prev, [foodItemId]: recipes }));
      return recipes;
    } catch (error) {
      console.error(`Failed to fetch recipe for food item ${foodItemId}:`, error);
      return [];
    }
  };

  // Calculate aggregated ingredients for an order
  const calculateOrderIngredients = async (order) => {
    setLoadingIngredients(true);
    try {
      const ingredientMap = new Map(); // inventory_item_id -> { name, code, totalQuantity, unit, notes }

      // Fetch recipes for all food items in the order
      const recipePromises = order.items.map(item =>
        fetchRecipeForFoodItem(item.food_item_id)
      );
      const recipeArrays = await Promise.all(recipePromises);

      // Process each item and its recipes
      order.items.forEach((item, itemIndex) => {
        const recipes = recipeArrays[itemIndex];
        const itemQuantity = item.quantity || 1;

        // Use the first recipe found for this food item
        if (recipes && recipes.length > 0) {
          const recipe = recipes[0]; // Use first recipe
          const servings = recipe.servings || 1;

          // Calculate multiplier: how many times to multiply the recipe
          const recipeMultiplier = itemQuantity / servings;

          // Aggregate ingredients
          recipe.ingredients?.forEach(ingredient => {
            const invId = ingredient.inventory_item_id;
            const totalQty = (ingredient.quantity || 0) * recipeMultiplier;

            if (ingredientMap.has(invId)) {
              const existing = ingredientMap.get(invId);
              existing.totalQuantity += totalQty;
            } else {
              ingredientMap.set(invId, {
                name: ingredient.inventory_item_name || 'Unknown',
                code: ingredient.inventory_item_code || '',
                totalQuantity: totalQty,
                unit: ingredient.unit || 'pcs',
                notes: ingredient.notes || ''
              });
            }
          });
        }
      });

      // Convert map to array and sort by name
      const aggregatedIngredients = Array.from(ingredientMap.values())
        .sort((a, b) => a.name.localeCompare(b.name));

      setIngredientsData(prev => ({
        ...prev,
        [order.id]: aggregatedIngredients
      }));

      return aggregatedIngredients;
    } catch (error) {
      console.error("Failed to calculate ingredients:", error);
      return [];
    } finally {
      setLoadingIngredients(false);
    }
  };

  // Handle view ingredients button click
  const handleViewIngredients = async (order) => {
    setViewingIngredients(order.id);

    // If already calculated, use cached data
    if (ingredientsData[order.id]) {
      return;
    }

    // Otherwise calculate
    await calculateOrderIngredients(order);
  };

  // KPI Calculations
  const totalOrders = orders.length;
  const totalRevenue = orders.reduce((sum, o) => sum + o.amount, 0);
  const completedOrders = orders.filter((o) => o.status === "completed").length;

  // Chart Data
  const dailyOrdersData = {
    labels: Array.from({ length: 7 }, (_, i) => `Day ${i + 1}`),
    datasets: [
      {
        label: "Orders",
        data: Array.from({ length: 7 }, () => Math.floor(Math.random() * 10 + 1)),
        backgroundColor: "#4f46e5",
      },
    ],
  };

  const revenueTrendData = {
    labels: ["Week 1", "Week 2", "Week 3", "Week 4"],
    datasets: [
      {
        label: "Revenue (₹)",
        data: Array.from({ length: 4 }, () => Math.floor(Math.random() * 5000 + 2000)),
        borderColor: "#16a34a",
        backgroundColor: "rgba(22,163,74,0.2)",
        tension: 0.3,
      },
    ],
  };

  const chartOptionsSmall = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false }, tooltip: { enabled: true } },
    scales: {
      x: { grid: { display: false }, ticks: { font: { size: 10 } } },
      y: { grid: { display: false }, ticks: { font: { size: 10 } } },
    },
  };

  const filteredOrders = orders.filter((order) => {
    const matchStatus = statusFilter ? order.status === statusFilter : true;
    const matchDate = dateFilter ? order.created_at?.startsWith(dateFilter) : true;
    const matchPayment = paymentFilter ? (
      paymentFilter === "paid" ? order.billing_status === "paid" : order.billing_status !== "paid"
    ) : true;
    return matchStatus && matchDate && matchPayment;
  }).sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

  // Food Management calculations
  const totalItems = foodItems.length;
  const totalCategories = categories.length;
  const availableItemsCount = availableFoodItemsCount;
  const filteredFoodItems = foodItems.filter(item => {
    const searchMatch = item.name.toLowerCase().includes(filters.search.toLowerCase());
    const categoryMatch = filters.category === 'all' || item.category_id === parseInt(filters.category);
    const availabilityMatch = filters.availability === 'all' ||
      (filters.availability === 'available' && item.available) ||
      (filters.availability === 'unavailable' && !item.available);
    return searchMatch && categoryMatch && availabilityMatch;
  });

  return (
    <DashboardLayout>
      <div className="p-6 space-y-8">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-3xl font-extrabold text-indigo-700">🍽 Food & Beverage Management</h2>
        </div>




        {/* Tabs Navigation */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 mb-6">
          <div className="flex border-b border-gray-200">
            {foodTabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-6 py-3 font-medium transition-colors ${activeTab === tab.id
                  ? "text-indigo-600 border-b-2 border-indigo-600"
                  : "text-gray-600 hover:text-gray-900"
                  }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Dashboard Tab */}
        {activeTab === "dashboard" && (
          <div className="space-y-6">
            {/* Filters */}
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">Filters</h3>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">From Date</label>
                  <input
                    type="date"
                    value={dashboardFilters.fromDate}
                    onChange={(e) => setDashboardFilters({ ...dashboardFilters, fromDate: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">To Date</label>
                  <input
                    type="date"
                    value={dashboardFilters.toDate}
                    onChange={(e) => setDashboardFilters({ ...dashboardFilters, toDate: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Order Type</label>
                  <select
                    value={dashboardFilters.orderType}
                    onChange={(e) => setDashboardFilters({ ...dashboardFilters, orderType: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="all">All Types</option>
                    <option value="dine_in">Dine In</option>
                    <option value="room_service">Room Service</option>
                  </select>
                </div>
                <div className="flex items-end">
                  <button
                    onClick={() => setDashboardFilters({ fromDate: "", toDate: "", orderType: "all" })}
                    className="w-full bg-gray-200 hover:bg-gray-300 text-gray-700 font-semibold py-2 px-4 rounded-lg transition-colors"
                  >
                    Clear Filters
                  </button>
                </div>
              </div>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="bg-gradient-to-r from-green-500 to-green-700 rounded-xl shadow-lg p-6 text-white">
                <div className="flex justify-between items-center">
                  <div>
                    <p className="text-sm font-medium opacity-90">Total Revenue</p>
                    <p className="text-3xl font-bold mt-1">₹{(dashboardData.totalRevenue || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}</p>
                  </div>
                  <div className="text-4xl opacity-80">💰</div>
                </div>
              </div>
              <div className="bg-gradient-to-r from-blue-500 to-blue-700 rounded-xl shadow-lg p-6 text-white">
                <div className="flex justify-between items-center">
                  <div>
                    <p className="text-sm font-medium opacity-90">Total Orders</p>
                    <p className="text-3xl font-bold mt-1">{dashboardData.totalOrders}</p>
                  </div>
                  <div className="text-4xl opacity-80">📦</div>
                </div>
              </div>
              <div className="bg-gradient-to-r from-purple-500 to-purple-700 rounded-xl shadow-lg p-6 text-white">
                <div className="flex justify-between items-center">
                  <div>
                    <p className="text-sm font-medium opacity-90">Completed Orders</p>
                    <p className="text-3xl font-bold mt-1">{dashboardData.completedOrders}</p>
                    <p className="text-xs opacity-75 mt-1">
                      {dashboardData.totalOrders > 0
                        ? ((dashboardData.completedOrders / dashboardData.totalOrders) * 100).toFixed(1)
                        : 0}% completion rate
                    </p>
                  </div>
                  <div className="text-4xl opacity-80">✅</div>
                </div>
              </div>
              <div className="bg-gradient-to-r from-orange-500 to-orange-700 rounded-xl shadow-lg p-6 text-white">
                <div className="flex justify-between items-center">
                  <div>
                    <p className="text-sm font-medium opacity-90">Items Sold</p>
                    <p className="text-3xl font-bold mt-1">{dashboardData.totalItemsSold}</p>
                  </div>
                  <div className="text-4xl opacity-80">🍽️</div>
                </div>
              </div>
            </div>

            {/* Business Performance KPIs */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="bg-gradient-to-r from-emerald-500 to-emerald-700 rounded-xl shadow-lg p-6 text-white">
                <div className="flex justify-between items-center">
                  <div>
                    <p className="text-sm font-medium opacity-90">Total Profit</p>
                    <p className="text-3xl font-bold mt-1">₹{(dashboardData.totalProfit || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}</p>
                    <p className="text-xs opacity-75 mt-1">
                      {(dashboardData.profitMargin || 0).toFixed(1)}% margin
                    </p>
                  </div>
                  <div className="text-4xl opacity-80">💵</div>
                </div>
              </div>
              <div className="bg-gradient-to-r from-red-500 to-red-700 rounded-xl shadow-lg p-6 text-white">
                <div className="flex justify-between items-center">
                  <div>
                    <p className="text-sm font-medium opacity-90">Total COGS</p>
                    <p className="text-3xl font-bold mt-1">₹{(dashboardData.totalCOGS || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}</p>
                    <p className="text-xs opacity-75 mt-1">
                      Cost of goods sold
                    </p>
                  </div>
                  <div className="text-4xl opacity-80">📊</div>
                </div>
              </div>
              <div className="bg-gradient-to-r from-teal-500 to-teal-700 rounded-xl shadow-lg p-6 text-white">
                <div className="flex justify-between items-center">
                  <div>
                    <p className="text-sm font-medium opacity-90">Avg Order Value</p>
                    <p className="text-3xl font-bold mt-1">₹{(dashboardData.averageOrderValue || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}</p>
                    <p className="text-xs opacity-75 mt-1">
                      Per completed order
                    </p>
                  </div>
                  <div className="text-4xl opacity-80">📈</div>
                </div>
              </div>
              <div className="bg-gradient-to-r from-amber-500 to-amber-700 rounded-xl shadow-lg p-6 text-white">
                <div className="flex justify-between items-center">
                  <div>
                    <p className="text-sm font-medium opacity-90">Avg Profit</p>
                    <p className="text-3xl font-bold mt-1">₹{(dashboardData.averageProfit || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}</p>
                    <p className="text-xs opacity-75 mt-1">
                      Per order
                    </p>
                  </div>
                  <div className="text-4xl opacity-80">🎯</div>
                </div>
              </div>
            </div>

            {/* Secondary KPIs */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
              <div className="bg-white rounded-xl shadow-lg p-6">
                <div className="flex justify-between items-center">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Pending Orders</p>
                    <p className="text-2xl font-bold text-yellow-600 mt-1">{dashboardData.pendingOrders}</p>
                  </div>
                  <div className="text-3xl">⏳</div>
                </div>
              </div>
              <div className="bg-white rounded-xl shadow-lg p-6">
                <div className="flex justify-between items-center">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Dine In Orders</p>
                    <p className="text-2xl font-bold text-blue-600 mt-1">{dashboardData.dineInOrders}</p>
                    <p className="text-xs text-gray-500 mt-1">
                      {dashboardData.totalOrders > 0
                        ? ((dashboardData.dineInOrders / dashboardData.totalOrders) * 100).toFixed(1)
                        : 0}% of total
                    </p>
                  </div>
                  <div className="text-3xl">🍴</div>
                </div>
              </div>
              <div className="bg-white rounded-xl shadow-lg p-6">
                <div className="flex justify-between items-center">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Room Service</p>
                    <p className="text-2xl font-bold text-indigo-600 mt-1">{dashboardData.deliveryOrders}</p>
                    <p className="text-xs text-gray-500 mt-1">
                      {dashboardData.totalOrders > 0
                        ? ((dashboardData.deliveryOrders / dashboardData.totalOrders) * 100).toFixed(1)
                        : 0}% of total
                    </p>
                  </div>
                  <div className="text-3xl">🚚</div>
                </div>
              </div>
            </div>

            {/* Charts Row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Sales Trend Chart */}
              <div className="bg-white rounded-xl shadow-lg p-6">
                <h3 className="text-xl font-bold text-gray-800 mb-4">Sales Trend</h3>
                <div className="h-64">
                  <Line
                    data={{
                      labels: dashboardData.salesByDate.map(d => new Date(d.date).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })),
                      datasets: [
                        {
                          label: 'Revenue (₹)',
                          data: dashboardData.salesByDate.map(d => d.revenue),
                          borderColor: 'rgb(99, 102, 241)',
                          backgroundColor: 'rgba(99, 102, 241, 0.1)',
                          tension: 0.4
                        },
                        {
                          label: 'Orders',
                          data: dashboardData.salesByDate.map(d => d.orders),
                          borderColor: 'rgb(16, 185, 129)',
                          backgroundColor: 'rgba(16, 185, 129, 0.1)',
                          tension: 0.4,
                          yAxisID: 'y1'
                        }
                      ]
                    }}
                    options={{
                      responsive: true,
                      maintainAspectRatio: false,
                      plugins: {
                        legend: { display: true },
                        tooltip: { mode: 'index', intersect: false }
                      },
                      scales: {
                        y: {
                          type: 'linear',
                          display: true,
                          position: 'left',
                          title: { display: true, text: 'Revenue (₹)' }
                        },
                        y1: {
                          type: 'linear',
                          display: true,
                          position: 'right',
                          title: { display: true, text: 'Orders' },
                          grid: { drawOnChartArea: false }
                        }
                      }
                    }}
                  />
                </div>
              </div>

              {/* Order Status Distribution */}
              <div className="bg-white rounded-xl shadow-lg p-6">
                <h3 className="text-xl font-bold text-gray-800 mb-4">Order Status Distribution</h3>
                <div className="h-64">
                  <Bar
                    data={{
                      labels: dashboardData.ordersByStatus.map(s => s.name),
                      datasets: [{
                        label: 'Orders',
                        data: dashboardData.ordersByStatus.map(s => s.value),
                        backgroundColor: [
                          'rgba(234, 179, 8, 0.8)',
                          'rgba(59, 130, 246, 0.8)',
                          'rgba(16, 185, 129, 0.8)',
                          'rgba(239, 68, 68, 0.8)'
                        ]
                      }]
                    }}
                    options={{
                      responsive: true,
                      maintainAspectRatio: false,
                      plugins: {
                        legend: { display: false },
                        tooltip: { enabled: true }
                      },
                      scales: {
                        y: {
                          beginAtZero: true,
                          ticks: { stepSize: 1 }
                        }
                      }
                    }}
                  />
                </div>
              </div>
            </div>

            {/* Revenue by Type and Top Items */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Revenue by Type */}
              <div className="bg-white rounded-xl shadow-lg p-6">
                <h3 className="text-xl font-bold text-gray-800 mb-4">Revenue by Order Type</h3>
                <div className="h-64">
                  <Bar
                    data={{
                      labels: dashboardData.revenueByType.map(t => t.name),
                      datasets: [{
                        label: 'Revenue (₹)',
                        data: dashboardData.revenueByType.map(t => t.value),
                        backgroundColor: [
                          'rgba(59, 130, 246, 0.8)',
                          'rgba(139, 92, 246, 0.8)'
                        ]
                      }]
                    }}
                    options={{
                      responsive: true,
                      maintainAspectRatio: false,
                      plugins: {
                        legend: { display: false },
                        tooltip: {
                          callbacks: {
                            label: function (context) {
                              return '₹' + context.parsed.y.toLocaleString('en-IN');
                            }
                          }
                        }
                      },
                      scales: {
                        y: {
                          beginAtZero: true,
                          ticks: {
                            callback: function (value) {
                              return '₹' + value.toLocaleString('en-IN');
                            }
                          }
                        }
                      }
                    }}
                  />
                </div>
                <div className="mt-4 space-y-2">
                  {dashboardData.revenueByType.map((type, idx) => (
                    <div key={idx} className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">{type.name}</span>
                      <span className="font-semibold text-gray-800">
                        ₹{type.value.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Top Selling Items with Profitability */}
              <div className="bg-white rounded-xl shadow-lg p-6">
                <h3 className="text-xl font-bold text-gray-800 mb-4">Top 10 Selling Items (Profitability)</h3>
                <div className="space-y-3 max-h-64 overflow-y-auto">
                  {dashboardData.topItems.length === 0 ? (
                    <p className="text-gray-500 text-center py-8">No data available</p>
                  ) : (
                    dashboardData.topItems.map((item, idx) => (
                      <div key={idx} className="p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-600 font-bold text-sm">
                              {idx + 1}
                            </div>
                            <div>
                              <p className="font-medium text-gray-800">{item.food_item_name}</p>
                              <p className="text-xs text-gray-500">Qty: {item.quantity}</p>
                            </div>
                          </div>
                        </div>
                        <div className="grid grid-cols-3 gap-2 mt-2 text-xs">
                          <div>
                            <p className="text-gray-500">Revenue</p>
                            <p className="font-semibold text-green-600">
                              ₹{item.revenue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                            </p>
                          </div>
                          <div>
                            <p className="text-gray-500">Cost</p>
                            <p className="font-semibold text-red-600">
                              ₹{((item.cost || 0)).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                            </p>
                          </div>
                          <div>
                            <p className="text-gray-500">Profit</p>
                            <p className={`font-semibold ${(item.profit || 0) >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                              ₹{((item.profit || 0)).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                            </p>
                            <p className="text-gray-400 text-xs">
                              {(item.margin || 0).toFixed(1)}%
                            </p>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            {/* Employee Performance and Items Usage */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Employee Performance */}
              <div className="bg-white rounded-xl shadow-lg p-6">
                <h3 className="text-xl font-bold text-gray-800 mb-4">Top Employee Performance</h3>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="py-2 px-4 text-left text-sm font-semibold text-gray-700">Employee</th>
                        <th className="py-2 px-4 text-left text-sm font-semibold text-gray-700">Orders</th>
                        <th className="py-2 px-4 text-left text-sm font-semibold text-gray-700">Revenue</th>
                        <th className="py-2 px-4 text-left text-sm font-semibold text-gray-700">Avg/Order</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {dashboardData.employeePerformance.length === 0 ? (
                        <tr>
                          <td colSpan="4" className="py-4 text-center text-gray-500">No data available</td>
                        </tr>
                      ) : (
                        dashboardData.employeePerformance.map((emp, idx) => (
                          <tr key={idx} className="hover:bg-gray-50">
                            <td className="py-2 px-4 text-sm font-medium">{emp.employee_name}</td>
                            <td className="py-2 px-4 text-sm">{emp.orders}</td>
                            <td className="py-2 px-4 text-sm font-semibold text-green-600">
                              ₹{emp.revenue.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                            </td>
                            <td className="py-2 px-4 text-sm text-gray-600">
                              ₹{((emp.revenue / emp.orders) || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Items Usage with Cost */}
              <div className="bg-white rounded-xl shadow-lg p-6">
                <h3 className="text-xl font-bold text-gray-800 mb-4">Top Inventory Items Used (Cost Analysis)</h3>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="py-2 px-4 text-left text-sm font-semibold text-gray-700">Item</th>
                        <th className="py-2 px-4 text-left text-sm font-semibold text-gray-700">Quantity</th>
                        <th className="py-2 px-4 text-left text-sm font-semibold text-gray-700">Unit</th>
                        <th className="py-2 px-4 text-left text-sm font-semibold text-gray-700">Total Cost</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {dashboardData.itemsUsage.length === 0 ? (
                        <tr>
                          <td colSpan="4" className="py-4 text-center text-gray-500">No data available</td>
                        </tr>
                      ) : (
                        dashboardData.itemsUsage.map((item, idx) => {
                          const invItem = inventoryItemsList.find(inv => inv.id === item.inventory_item_id);
                          const itemCost = (item.quantity || 0) * (invItem?.unit_price || 0);
                          return (
                            <tr key={idx} className="hover:bg-gray-50">
                              <td className="py-2 px-4 text-sm font-medium">{item.inventory_item_name}</td>
                              <td className="py-2 px-4 text-sm">{item.quantity.toFixed(2)}</td>
                              <td className="py-2 px-4 text-sm text-gray-500">{item.unit}</td>
                              <td className="py-2 px-4 text-sm font-semibold text-red-600">
                                ₹{itemCost.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Profitability Analysis */}
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h3 className="text-xl font-bold text-gray-800 mb-4">Profitability Analysis</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="text-center p-4 bg-gradient-to-br from-green-50 to-green-100 rounded-lg">
                  <p className="text-sm text-gray-600 mb-1">Profit Margin</p>
                  <p className="text-3xl font-bold text-green-600">{dashboardData.profitMargin.toFixed(1)}%</p>
                  <p className="text-xs text-gray-500 mt-1">Overall margin</p>
                </div>
                <div className="text-center p-4 bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg">
                  <p className="text-sm text-gray-600 mb-1">Revenue to Cost Ratio</p>
                  <p className="text-3xl font-bold text-blue-600">
                    {dashboardData.totalCOGS > 0
                      ? (dashboardData.totalRevenue / dashboardData.totalCOGS).toFixed(2)
                      : '0.00'}x
                  </p>
                  <p className="text-xs text-gray-500 mt-1">For every ₹1 cost</p>
                </div>
                <div className="text-center p-4 bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg">
                  <p className="text-sm text-gray-600 mb-1">Avg Cost per Order</p>
                  <p className="text-3xl font-bold text-purple-600">
                    ₹{(dashboardData.averageCOGS || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">Average COGS</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Food Orders Tab */}
        {activeTab === "orders" && (
          <div className="space-y-6">
            {/* Overview Section */}
            <div className="bg-gradient-to-br from-indigo-50 to-blue-50 rounded-xl p-6 border border-indigo-100">
              <h3 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
                <span className="w-1 h-6 bg-indigo-600 rounded"></span>
                Order Overview
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-white rounded-lg p-4 shadow-sm border border-gray-200">
                  <p className="text-xs text-gray-500 mb-1">Total Orders</p>
                  <p className="text-2xl font-bold text-indigo-600">{totalOrders}</p>
                </div>
                <div className="bg-white rounded-lg p-4 shadow-sm border border-gray-200">
                  <p className="text-xs text-gray-500 mb-1">Total Revenue</p>
                  <p className="text-2xl font-bold text-green-600">₹{totalRevenue.toLocaleString('en-IN')}</p>
                </div>
                <div className="bg-white rounded-lg p-4 shadow-sm border border-gray-200">
                  <p className="text-xs text-gray-500 mb-1">Completed</p>
                  <p className="text-2xl font-bold text-blue-600">{completedOrders}</p>
                  <p className="text-xs text-gray-400 mt-1">
                    {totalOrders > 0 ? ((completedOrders / totalOrders) * 100).toFixed(0) : 0}% rate
                  </p>
                </div>
                <div className="bg-white rounded-lg p-4 shadow-sm border border-gray-200">
                  <p className="text-xs text-gray-500 mb-1">Pending</p>
                  <p className="text-2xl font-bold text-orange-600">{totalOrders - completedOrders}</p>
                  <p className="text-xs text-gray-400 mt-1">Needs attention</p>
                </div>
              </div>
            </div>

            {/* Performance Metrics */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-lg p-5 text-white shadow-md">
                <p className="text-sm font-medium opacity-90 mb-1">Average Order Value</p>
                <p className="text-2xl font-bold">
                  ₹{totalOrders > 0 ? (totalRevenue / totalOrders).toLocaleString('en-IN', { maximumFractionDigits: 0 }) : '0'}
                </p>
                <p className="text-xs opacity-75 mt-1">Per order</p>
              </div>
              <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-lg p-5 text-white shadow-md">
                <p className="text-sm font-medium opacity-90 mb-1">Items per Order</p>
                <p className="text-2xl font-bold">
                  {(() => {
                    const totalItems = orders.reduce((sum, o) => sum + (o.items?.length || 0), 0);
                    return totalOrders > 0 ? (totalItems / totalOrders).toFixed(1) : '0.0';
                  })()}
                </p>
                <p className="text-xs opacity-75 mt-1">Average items</p>
              </div>
              <div className="bg-gradient-to-br from-pink-500 to-pink-600 rounded-lg p-5 text-white shadow-md">
                <p className="text-sm font-medium opacity-90 mb-1">Fulfillment Rate</p>
                <p className="text-2xl font-bold">
                  {totalOrders > 0 ? ((completedOrders / totalOrders) * 100).toFixed(0) : 0}%
                </p>
                <p className="text-xs opacity-75 mt-1">Completion rate</p>
              </div>
              <div className="bg-gradient-to-br from-cyan-500 to-cyan-600 rounded-lg p-5 text-white shadow-md">
                <p className="text-sm font-medium opacity-90 mb-1">Revenue/Hour</p>
                <p className="text-2xl font-bold">
                  ₹{(() => {
                    const hours = Math.max(1, Math.floor((new Date() - new Date(orders[0]?.created_at || Date.now())) / (1000 * 60 * 60)));
                    return (totalRevenue / hours).toLocaleString('en-IN', { maximumFractionDigits: 0 });
                  })()}
                </p>
                <p className="text-xs opacity-75 mt-1">Hourly average</p>
              </div>
            </div>

            {/* Create New Order Button */}
            <div className="flex justify-end">
              <button
                onClick={() => setShowFoodOrderModal(true)}
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-6 rounded-xl shadow-lg hover:shadow-xl transition-all flex items-center gap-2 group"
              >
                <div className="bg-white/20 p-1.5 rounded-lg group-hover:rotate-12 transition-transform">
                  <Plus size={20} />
                </div>
                <span>Create New Order</span>
              </button>
            </div>

            {/* Create New Order Modal */}
            {showFoodOrderModal && (
              <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[70] p-4 text-black">
                <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
                  {/* Modal Header */}
                  <div className="bg-indigo-700 p-6 text-white flex justify-between items-center shrink-0">
                    <div className="flex items-center gap-3">
                      <div className="bg-white/20 p-2 rounded-lg">
                        <UtensilsCrossed size={24} />
                      </div>
                      <div>
                        <h3 className="text-2xl font-bold">Create New Food Order</h3>
                        <p className="text-indigo-100 text-sm">Create orders for checked-in guests</p>
                      </div>
                    </div>
                    <button
                      onClick={() => setShowFoodOrderModal(false)}
                      className="bg-white/20 hover:bg-white/30 p-2 rounded-full transition-colors"
                    >
                      <X size={20} />
                    </button>
                  </div>

                  {/* Modal Content */}
                  <div className="overflow-y-auto p-6 space-y-6">
                    {/* Room and Employee Selection */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
                        <label className="block text-sm font-bold text-gray-700 mb-2">Select Room *</label>
                        <select
                          value={roomId}
                          onChange={(e) => setRoomId(e.target.value)}
                          className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-indigo-500 transition text-black"
                        >
                          <option value="">Choose a room...</option>
                          {rooms.length === 0 ? (
                            <option disabled>No checked-in rooms available</option>
                          ) : (
                            rooms.map((room) => (
                              <option key={room.id} value={room.id}>
                                Room {room.number || room.room_number || room.id} {room.guest_name ? `(${room.guest_name})` : ''}
                              </option>
                            ))
                          )}
                        </select>
                      </div>
                      <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
                        <label className="block text-sm font-bold text-gray-700 mb-2">
                          Assign to Kitchen * {employees.length > 0 && (
                            <span className="text-xs text-gray-400 font-normal">
                              ({(() => {
                                const count = employees.filter(e => {
                                  const r = (e.role || '').toLowerCase();
                                  const n = (e.name || '').toLowerCase();
                                  return r.includes('kitchen') || r.includes('kicthen') || r.includes('chef') || r.includes('cook') || r.includes('kitch') || r.includes('f&b') || r.includes('pantry') ||
                                         n.includes('kitchen') || n.includes('kicthen') || n.includes('chef') || n.includes('cook') || n.includes('kitch');
                                }).length;
                                return count > 0 ? `${count} found` : `${employees.length} staff available`;
                              })()})
                            </span>
                          )}
                        </label>
                        <select
                          value={preparedById}
                          onChange={(e) => setPreparedById(e.target.value)}
                          className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-indigo-500 transition text-black font-medium"
                        >
                          <option value="">{employees.length === 0 ? "Searching for employees..." : "Choose a chef / kitchen staff..."}</option>
                          {(() => {
                            const isKitchen = (e) => {
                              if (!e || !e.id) return false;
                              const r = (e.role || '').toLowerCase();
                              const n = (e.name || '').toLowerCase();
                              return r.includes('kitchen') || r.includes('kicthen') || r.includes('chef') || r.includes('cook') || r.includes('kitch') || r.includes('f&b') || r.includes('pantry') ||
                                     n.includes('kitchen') || n.includes('kicthen') || n.includes('chef') || n.includes('cook') || n.includes('kitch');
                            };
                            const kitchenStaff = employees.filter(isKitchen);
                            const otherStaff = employees.filter(e => !isKitchen(e));
                            
                            if (kitchenStaff.length > 0) {
                              return (
                                <>
                                  <optgroup label="Kitchen Staff &amp; Chefs">
                                    {kitchenStaff.map(emp => {
                                      const isOnline = emp.status === 'on_duty' || emp.is_clocked_in;
                                      return (
                                        <option key={emp.id} value={emp.id} style={{ color: isOnline ? "#16a34a" : "inherit", fontWeight: isOnline ? "bold" : "normal" }}>
                                          {emp.name || `Chef ${emp.id}`} ({emp.role || 'Kitchen'}) {isOnline ? " 🟢 (Online)" : `(${emp.status || 'off_duty'})`}
                                        </option>
                                      );
                                    })}
                                  </optgroup>
                                  {otherStaff.length > 0 && (
                                    <optgroup label="Other Staff">
                                      {otherStaff.map(emp => (
                                        <option key={emp.id} value={emp.id}>
                                          {emp.name} ({emp.role || 'Staff'})
                                        </option>
                                      ))}
                                    </optgroup>
                                  )}
                                </>
                              );
                            }
                            return employees.map(emp => (
                              <option key={emp.id} value={emp.id}>
                                {emp.name} ({emp.role || 'Staff'})
                              </option>
                            ));
                          })()}
                        </select>
                      </div>
                      {orderType === "room_service" && (
                        <div className="md:col-span-2 bg-indigo-50/50 p-4 rounded-xl border border-indigo-100">
                          <label className="block text-sm font-bold text-indigo-900 mb-2">
                            Assign Delivery Person * {employees.length > 0 && (
                              <span className="text-xs text-indigo-700 font-normal">
                                ({employees.length} staff available)
                              </span>
                            )}
                          </label>
                          <select
                            value={employeeId}
                            onChange={(e) => setEmployeeId(e.target.value)}
                            className="w-full border border-indigo-200 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-indigo-500 transition text-black font-medium bg-white"
                          >
                            <option value="">{employees.length === 0 ? "Searching for employees..." : "Choose a delivery person..."}</option>
                            {(() => {
                              const isDelivery = (e) => {
                                if (!e || !e.id) return false;
                                const r = (e.role || '').toLowerCase();
                                const n = (e.name || '').toLowerCase();
                                return r.includes('waiter') || r.includes('house') || r.includes('service') || r.includes('delivery') || r.includes('staff') || r.includes('operational') || r.includes('room') || r.includes('boy') ||
                                       n.includes('waiter') || n.includes('delivery') || n.includes('room') || n.includes('boy');
                              };
                              const deliveryStaff = employees.filter(isDelivery);
                              const otherStaff = employees.filter(e => !isDelivery(e));

                              if (deliveryStaff.length > 0) {
                                return (
                                  <>
                                    <optgroup label="Service &amp; Delivery Staff">
                                      {deliveryStaff.map(emp => {
                                        const isOnline = emp.status === 'on_duty' || emp.is_clocked_in;
                                        return (
                                          <option key={emp.id} value={emp.id} style={{ color: isOnline ? "#16a34a" : "inherit", fontWeight: isOnline ? "bold" : "normal" }}>
                                            {emp.name} ({emp.role || 'Staff'}) {isOnline ? " 🟢 (Online)" : `(${emp.status || 'off_duty'})`}
                                          </option>
                                        );
                                      })}
                                    </optgroup>
                                    {otherStaff.length > 0 && (
                                      <optgroup label="Other Staff">
                                        {otherStaff.map(emp => (
                                          <option key={emp.id} value={emp.id}>
                                            {emp.name} ({emp.role || 'Staff'})
                                          </option>
                                        ))}
                                      </optgroup>
                                    )}
                                  </>
                                );
                              }
                              return employees.map(emp => (
                                <option key={emp.id} value={emp.id}>
                                  {emp.name} ({emp.role || 'Staff'})
                                </option>
                              ));
                            })()}
                          </select>
                        </div>
                      )}
                    </div>

                    {/* Order Type Selection */}
                    <div>
                      <label className="block text-sm font-bold text-gray-700 mb-3">Order Type *</label>
                      <div className="grid grid-cols-2 gap-4">
                        <button
                          type="button"
                          onClick={() => {
                            setOrderType("dine_in");
                            setDeliveryRequest("");
                            calculateAmount(selectedItems, "dine_in");
                          }}
                          className={`flex items-center justify-center gap-3 p-4 border-2 rounded-xl transition-all ${orderType === "dine_in"
                            ? "border-indigo-600 bg-indigo-50 text-indigo-700 shadow-md ring-2 ring-indigo-200"
                            : "border-gray-200 hover:border-indigo-300 text-gray-600 bg-white"
                            }`}
                        >
                          <UtensilsCrossed size={20} />
                          <span className="font-bold">Dine In</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setOrderType("room_service");
                            calculateAmount(selectedItems, "room_service");
                          }}
                          className={`flex items-center justify-center gap-3 p-4 border-2 rounded-xl transition-all ${orderType === "room_service"
                            ? "border-indigo-600 bg-indigo-50 text-indigo-700 shadow-md ring-2 ring-indigo-200"
                            : "border-gray-200 hover:border-indigo-300 text-gray-600 bg-white"
                            }`}
                        >
                          <Home size={20} />
                          <span className="font-bold">Room Service</span>
                        </button>
                      </div>
                    </div>

                    {/* Delivery Request */}
                    {orderType === "room_service" && (
                      <div className="bg-blue-50/50 p-4 rounded-xl border border-blue-100">
                        <label className="block text-sm font-bold text-blue-900 mb-2 flex items-center gap-2">
                          <Truck size={16} />
                          Delivery Instructions (Optional)
                        </label>
                        <textarea
                          placeholder="Add delivery instructions, timing preferences, or special notes..."
                          className="w-full border border-blue-200 rounded-lg px-4 py-3 focus:ring-2 focus:ring-indigo-500 transition resize-none bg-white"
                          rows="2"
                          value={deliveryRequest}
                          onChange={(e) => setDeliveryRequest(e.target.value)}
                        />
                      </div>
                    )}

                    {/* Food Items Selection */}
                    <div className="bg-gray-50 p-6 rounded-2xl border border-gray-100">
                      <div className="flex justify-between items-center mb-4">
                        <label className="text-sm font-bold text-gray-700 uppercase tracking-wider">Food Items *</label>
                        <button
                          onClick={handleAddItem}
                          type="button"
                          className="text-indigo-600 hover:text-indigo-700 font-bold text-sm flex items-center gap-1 bg-white px-3 py-1.5 rounded-lg border border-indigo-100 shadow-sm transition-all"
                        >
                          <Plus size={16} />
                          Add Choice
                        </button>
                      </div>
                      <div className="space-y-3">
                        {selectedItems.map((item, index) => (
                          <div key={index} className="flex gap-3 items-center bg-white p-3 rounded-xl shadow-sm border border-gray-100 animate-in fade-in slide-in-from-left-2 duration-200">
                            <div className="flex-1">
                              <div className="relative">
                                <input
                                  type="text"
                                  placeholder="Type to search food item..."
                                  value={item.searchQuery !== undefined ? item.searchQuery : (foodItems.find(f => String(f.id) === String(item.food_item_id))?.name || "")}
                                  onChange={(e) => {
                                    handleItemChange(index, "searchQuery", e.target.value);
                                    handleItemChange(index, "isOpen", true);
                                  }}
                                  onFocus={() => {
                                    const currentItem = foodItems.find(f => String(f.id) === String(item.food_item_id));
                                    handleItemChange(index, "searchQuery", currentItem ? currentItem.name : "");
                                    handleItemChange(index, "isOpen", true);
                                  }}
                                  onBlur={() => {
                                    // Use a short timeout to allow onMouseDown to fire first
                                    setTimeout(() => {
                                      handleItemChange(index, "isOpen", false);
                                      const currentItem = foodItems.find(f => String(f.id) === String(item.food_item_id));
                                      handleItemChange(index, "searchQuery", currentItem ? currentItem.name : "");
                                    }, 200);
                                  }}
                                  className="w-full border border-gray-200 rounded-lg px-4 py-2 focus:ring-2 focus:ring-indigo-500 text-black font-medium outline-none"
                                />
                                {item.isOpen && (
                                  <div className="absolute z-50 left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg max-h-60 overflow-y-auto">
                                    {foodItems
                                      .filter((f) => {
                                        const q = (item.searchQuery || "").toLowerCase();
                                        return f.name.toLowerCase().includes(q);
                                      })
                                      .map((f) => (
                                        <div
                                          key={f.id}
                                          onMouseDown={() => {
                                            handleItemChange(index, "food_item_id", String(f.id));
                                            handleItemChange(index, "searchQuery", f.name);
                                            handleItemChange(index, "isOpen", false);
                                          }}
                                          className="px-4 py-2.5 hover:bg-indigo-50 cursor-pointer text-sm text-gray-700 flex justify-between items-center transition-colors border-b border-gray-50 last:border-b-0"
                                        >
                                          <span className="font-semibold text-gray-800">{f.name}</span>
                                          <span className="text-indigo-600 font-bold">₹{f.price}</span>
                                        </div>
                                      ))}
                                    {foodItems.filter((f) => f.name.toLowerCase().includes((item.searchQuery || "").toLowerCase())).length === 0 && (
                                      <div className="px-4 py-3 text-sm text-gray-500 italic text-center">No matching food items</div>
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>
                            <div className="w-24">
                              <input
                                type="number"
                                min={1}
                                value={item.quantity}
                                onChange={(e) => handleItemChange(index, "quantity", e.target.value)}
                                placeholder="Qty"
                                className="w-full border border-gray-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500 text-center font-bold"
                              />
                            </div>
                            <button
                              onClick={() => {
                                const newItems = [...selectedItems];
                                newItems.splice(index, 1);
                                setSelectedItems(newItems);
                                calculateAmount(newItems, orderType);
                              }}
                              className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                            >
                              <Trash2 size={18} />
                            </button>
                          </div>
                        ))}
                        {selectedItems.length === 0 && (
                          <div className="text-center py-8 border-2 border-dashed border-gray-200 rounded-xl bg-gray-50/50">
                            <p className="text-gray-400 text-sm">No items added to this order yet</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Modal Footer */}
                  <div className="p-6 border-t border-gray-100 shrink-0 bg-gray-50 flex flex-col sm:flex-row justify-between items-center gap-4">
                    <div className="flex flex-col">
                      <span className="text-xs font-bold text-gray-500 uppercase tracking-widest">Grand Total</span>
                      <span className="text-3xl font-black text-indigo-700">₹{amount.toLocaleString('en-IN')}</span>
                    </div>
                    <div className="flex gap-3 w-full sm:w-auto">
                      <button
                        onClick={() => setShowFoodOrderModal(false)}
                        className="flex-1 sm:flex-none px-6 py-3 border border-gray-300 rounded-xl text-gray-700 font-bold hover:bg-gray-100 transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleSubmit}
                        disabled={!roomId || (orderType === "room_service" && !employeeId) || selectedItems.length === 0}
                        className="flex-1 sm:flex-none px-10 py-3 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-bold rounded-xl shadow-lg shadow-indigo-200 transition-all flex items-center justify-center gap-2"
                      >
                        <ShoppingCart size={20} />
                        Confirm Order
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Filters */}
            <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-5">
              <div className="flex flex-wrap items-center gap-4">
                <div className="flex-1 min-w-[200px]">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Filter by Status</label>
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-black"
                  >
                    <option value="">All Status</option>
                    <option value="pending">Pending</option>
                    <option value="in_progress">In Progress</option>
                    <option value="ready">Ready</option>
                    <option value="completed">Completed</option>
                    <option value="cancelled">Cancelled</option>
                    <option value="scheduled">Scheduled</option>
                  </select>
                </div>
                <div className="flex-1 min-w-[200px]">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Filter by Date</label>
                  <input
                    type="date"
                    value={dateFilter}
                    onChange={(e) => setDateFilter(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>
                <div className="flex-1 min-w-[200px]">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Filter by Payment</label>
                  <select
                    value={paymentFilter}
                    onChange={(e) => setPaymentFilter(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-black"
                  >
                    <option value="">All Payment Status</option>
                    <option value="paid">Paid</option>
                    <option value="unpaid">Unpaid</option>
                  </select>
                </div>
                {(statusFilter || dateFilter || paymentFilter) && (
                  <div className="flex items-end">
                    <button
                      onClick={() => {
                        setStatusFilter("");
                        setDateFilter("");
                        setPaymentFilter("");
                      }}
                      className="px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors text-sm font-medium"
                    >
                      Clear Filters
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Orders List */}
            <div id="orders-list-section">
              <div className="mb-4">
                <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                  <span className="w-1 h-6 bg-indigo-600 rounded"></span>
                  All Orders ({filteredOrders.length})
                </h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredOrders.length === 0 ? (
                  <div className="col-span-full text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
                    <p className="text-gray-500">No orders found</p>
                    <p className="text-sm text-gray-400 mt-1">Try adjusting your filters</p>
                  </div>
                ) : (
                  filteredOrders.map((order) => {
                    const roomData = rooms.find((r) => r.id === order.room_id);
                    // Normalize status to lowercase for robust matching
                    const rawStatus = (order.status || "").toLowerCase().trim();
                    const normalizedStatus = rawStatus === 'active' ? 'pending' : rawStatus;
                    return (
                      <div
                        key={order.id}
                        className="bg-white rounded-lg shadow-md border border-gray-200 p-5 hover:shadow-lg transition-all"
                      >
                        {/* Header */}
                        <div className="flex justify-between items-start mb-3">
                          <div>
                            <h4 className="font-bold text-lg text-gray-800">
                              Room {roomData?.number || roomData?.room_number || order.room_number || order.room_id}
                            </h4>
                            <p className="text-xs text-gray-500 mt-1">
                              {order.created_at ? formatDateTimeIST(order.created_at) : 'N/A'}
                            </p>
                          </div>
                          <div className="flex flex-col gap-2 items-end">
                            <span
                              className={`px-2.5 py-1 rounded-full text-xs font-semibold ${order.order_type === "room_service"
                                ? "bg-purple-100 text-purple-700"
                                : "bg-blue-100 text-blue-700"
                                }`}
                            >
                              {order.order_type === "room_service" ? "Room Service" : "Dine In"}
                            </span>
                            {normalizedStatus !== "cancelled" && (
                              <div className="flex items-center gap-1.5">
                                <span
                                  className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-widest flex items-center gap-1 shadow-sm border ${order.billing_status === "paid"
                                    ? "bg-emerald-500 text-white border-emerald-600"
                                    : "bg-red-600 text-white border-red-700"
                                    }`}
                                >
                                  {order.billing_status === "paid" ? <CheckCircle size={10} /> : <XCircle size={10} />}
                                  {order.billing_status === "paid" ? "PAID" : "UNPAID"}
                                </span>
                                {order.billing_status === "paid" && (
                                  <span className="px-2 py-1 bg-white text-emerald-700 rounded-full text-[10px] font-black border border-emerald-200 shadow-sm uppercase">
                                    {order.payment_method || 'Cash'}
                                  </span>
                                )}
                              </div>
                            )}
                            <span
                              className={`px-2.5 py-1 rounded-full text-xs font-semibold ${statusColors[normalizedStatus] || "bg-gray-100 text-gray-800"
                                }`}
                            >
                              {normalizedStatus.replace("_", " ")}
                            </span>
                          </div>
                        </div>

                        {/* Order Details */}
                        <div className="space-y-2 mb-3 text-sm">
                          <div className="flex justify-between items-center">
                            <span className="text-gray-500">Guest:</span>
                            <span className="font-medium text-gray-800">{order.guest_name || "N/A"}</span>
                          </div>
                          <div className="flex justify-between items-center gap-2">
                            <span className="text-gray-500">Delivery:</span>
                            <select
                              value={order.assigned_employee_id || ""}
                              onChange={(e) => handleAssignDeliveryPerson(order.id, e.target.value)}
                              className="border border-gray-200 rounded px-2 py-0.5 text-xs font-medium text-gray-700 focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-white max-w-[150px] truncate"
                            >
                              <option value="">Not Assigned</option>
                              {Array.isArray(employees) && employees
                                .filter(emp => {
                                  if (!emp || !emp.id) return false;
                                  if (emp.id === order.assigned_employee_id) return true;
                                  const r = (emp.role || '').toLowerCase();
                                  const n = (emp.name || '').toLowerCase();
                                  return r.includes('waiter') || r.includes('house') || r.includes('service') || r.includes('delivery') || r.includes('staff') || r.includes('operational') || r.includes('room') || r.includes('boy') ||
                                         n.includes('waiter') || n.includes('delivery') || n.includes('room') || n.includes('boy');
                                })
                                .map((emp) => (
                                  <option key={emp.id} value={emp.id}>
                                    {emp.name}
                                  </option>
                                ))
                              }
                              {order.assigned_employee_id && !employees.some(emp => emp.id === order.assigned_employee_id) && (
                                <option value={order.assigned_employee_id}>
                                  {order.employee_name || `Employee #${order.assigned_employee_id}`}
                                </option>
                              )}
                            </select>
                          </div>
                          <div className="flex justify-between items-center gap-2">
                            <span className="text-gray-500">Chef:</span>
                            <select
                              value={order.prepared_by_id || ""}
                              onChange={(e) => handleAssignChef(order.id, e.target.value)}
                              className="border border-gray-200 rounded px-2 py-0.5 text-xs font-medium text-gray-700 focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-white max-w-[150px] truncate"
                            >
                              <option value="">Not Assigned</option>
                              {Array.isArray(employees) && employees
                                .filter(emp => {
                                  if (!emp || !emp.id) return false;
                                  if (emp.id === order.prepared_by_id) return true;
                                  const r = (emp.role || '').toLowerCase();
                                  const n = (emp.name || '').toLowerCase();
                                  return r.includes('kitchen') || r.includes('kicthen') || r.includes('chef') || r.includes('cook') || r.includes('kitch') || r.includes('f&b') || r.includes('pantry') ||
                                         n.includes('kitchen') || n.includes('kicthen') || n.includes('chef') || n.includes('cook') || n.includes('kitch');
                                })
                                .map((emp) => (
                                  <option key={emp.id} value={emp.id}>
                                    {emp.name}
                                  </option>
                                ))
                              }
                              {order.prepared_by_id && !employees.some(emp => emp.id === order.prepared_by_id) && (
                                <option value={order.prepared_by_id}>
                                  {order.chef_name || `Chef #${order.prepared_by_id}`}
                                </option>
                              )}
                            </select>
                          </div>
                        </div>
                        {/* Delivery Request */}
                        {order.order_type === "room_service" && order.delivery_request && (
                          <div className="mb-3 p-2 bg-purple-50 border border-purple-200 rounded-lg">
                            <div className="flex items-start gap-2">
                              <Truck size={14} className="text-purple-600 mt-0.5 flex-shrink-0" />
                              <div className="flex-1">
                                <p className="text-xs font-semibold text-purple-700 mb-1">Delivery Instructions:</p>
                                <p className="text-xs text-purple-600">{order.delivery_request}</p>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Scheduled Order Info */}
                        {/* Scheduled Order Info */}
                        {normalizedStatus === "scheduled" && order.delivery_request && order.delivery_request.includes("SCHEDULED_FOR:") && (
                          <div className="mb-4 p-3 bg-amber-50 border-l-4 border-amber-500 rounded-r-lg shadow-sm">
                            <div className="flex items-center gap-3">
                              <div className="bg-amber-100 p-2 rounded-full">
                                <span className="text-xl" role="img" aria-label="clock">⏰</span>
                              </div>
                              <div className="flex-1">
                                <p className="text-xs font-bold text-amber-600 uppercase tracking-wider mb-0.5">Scheduled Delivery</p>
                                <p className="text-lg font-extrabold text-gray-800 font-mono">
                                  {order.delivery_request.split("--")[0].replace("SCHEDULED_FOR:", "").trim()}
                                </p>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Order Items */}
                        <div className="mb-3">
                          <p className="text-xs font-semibold text-gray-700 mb-1">Items ({order.items?.length || 0}):</p>
                          <ul className="space-y-1">
                            {order.items?.slice(0, 3).map((item, i) => (
                              <li key={i} className="text-xs text-gray-600 flex justify-between">
                                <span>{item.food_item_name}</span>
                                <span className="font-medium">×{item.quantity}</span>
                              </li>
                            ))}
                            {order.items?.length > 3 && (
                              <li className="text-xs text-gray-400 italic">+{order.items.length - 3} more items</li>
                            )}
                          </ul>
                        </div>

                        <div className="mb-3 p-2 bg-gray-50 rounded-lg border border-gray-100">
                          <div className="flex justify-between items-center">
                            <div className="flex flex-col">
                              <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">Order Total</span>
                              <span className={`text-[10px] font-black uppercase ${order.billing_status === 'paid' ? 'text-emerald-600' : 'text-red-600'}`}>
                               {order.billing_status === 'paid' ? `Settled - ${order.payment_method || 'Cash'}` : 'Unpaid - Due'}
                              </span>                            </div>
                            <span className="text-xl font-bold text-indigo-600">₹{parseFloat(order.total_with_gst || order.amount || 0).toLocaleString('en-IN')}</span>
                          </div>
                        </div>
                        {/* Cost and Profit (Estimated Cost for all orders) */}
                        {(() => {
                          let orderCost = 0;
                          order.items?.forEach(item => {
                            const recipe = recipesCache[item.food_item_id]?.[0] || recipesData[item.food_item_id];
                            if (recipe && recipe.ingredients) {
                              const servings = recipe.servings || 1;
                              const multiplier = (item.quantity || 0) / servings;
                              recipe.ingredients.forEach(ing => {
                                const invItem = inventoryItemsList.find(inv => inv.id === ing.inventory_item_id);
                                if (invItem && invItem.unit_price) {
                                  orderCost += (ing.quantity || 0) * invItem.unit_price * multiplier;
                                }
                              });
                            }
                            if (order.order_type === "room_service" && item.food_item?.extra_inventory_items) {
                              item.food_item.extra_inventory_items.forEach(extra => {
                                const invItem = inventoryItemsList.find(inv => inv.id === extra.inventory_item_id);
                                if (invItem && invItem.unit_price) {
                                  orderCost += (extra.quantity || 0) * invItem.unit_price * (item.quantity || 0);
                                }
                              });
                            }
                          });

                          if (orderCost > 0) {
                            return (
                              <div className="mt-2 text-xs text-gray-500 bg-gray-50 p-2 rounded border border-gray-100 flex justify-between">
                                <span className="font-medium">Recipe Cost (Est):</span>
                                <span className="font-bold text-gray-700">₹{orderCost.toFixed(2)}</span>
                              </div>
                            );
                          }
                          return null;
                        })()}


                        {/* Actions */}
                        <div className="space-y-2">
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleViewIngredients(order)}
                              className="flex-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-sm font-medium px-3 py-2 rounded-lg transition-colors flex items-center justify-center gap-2 border border-indigo-100"
                            >
                              <ChefHat size={16} />
                              Ingredients
                            </button>
                            <button
                              onClick={() => handlePrintOrder(order)}
                              className="flex-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-sm font-medium px-3 py-2 rounded-lg transition-colors flex items-center justify-center gap-2 border border-emerald-100"
                            >
                              <Printer size={16} />
                              Print Bill
                            </button>
                          </div>

                          {normalizedStatus === "completed" && (
                            <button
                              onClick={() => handleTogglePaymentStatus(order)}
                              className={`w-full text-sm font-medium px-3 py-2 rounded-lg transition-colors flex items-center justify-center gap-2 border ${order.billing_status === "paid"
                                ? "bg-orange-50 text-orange-700 border-orange-200 hover:bg-orange-100"
                                : "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100"
                                }`}
                            >
                              <CreditCard size={16} />
                              Mark as {order.billing_status === "paid" ? "Unpaid" : "Paid"}
                            </button>
                          )}

                          <select
                            value={normalizedStatus}
                            onChange={(e) => handleStatusChange(order.id, e.target.value)}
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-black focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white"
                          >
                            <option value="pending">Pending</option>
                            <option value="in_progress">In Progress</option>
                            <option value="ready">Ready</option>
                            <option value="completed">Completed</option>
                            <option value="cancelled">Cancelled</option>
                          </select>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Load More Orders Button */}
            {hasMore && (
              <div className="text-center mt-6">
                <button
                  onClick={loadMoreOrders}
                  disabled={isFetchingMore}
                  className="bg-indigo-100 text-indigo-700 font-semibold px-6 py-2 rounded-lg hover:bg-indigo-200 transition-colors disabled:bg-gray-200 disabled:text-gray-500"
                >
                  {isFetchingMore ? "Loading..." : "Load More Orders"}
                </button>
              </div>
            )}
          </div>
        )}

        {/* Ingredients View Modal */}
        {viewingIngredients && (() => {
          const order = orders.find(o => o.id === viewingIngredients);
          const ingredients = ingredientsData[viewingIngredients] || [];
          const roomData = rooms.find((r) => r.id === order?.room_id);

          return (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
              <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col">
                {/* Header */}
                <div className="bg-indigo-600 text-white p-6 flex justify-between items-center">
                  <div>
                    <h3 className="text-2xl font-bold flex items-center gap-2">
                      <ChefHat size={24} />
                      Order Ingredients
                    </h3>
                    <p className="text-indigo-100 mt-1">
                      Room: {roomData?.number || roomData?.room_number || order?.room_id} |
                      Order #{order?.id} |
                      {order?.items?.length || 0} item(s)
                    </p>
                  </div>
                  <button
                    onClick={() => setViewingIngredients(null)}
                    className="text-white hover:text-gray-200 transition-colors"
                  >
                    <X size={24} />
                  </button>
                </div>

                {/* Content */}
                <div className="p-6 overflow-y-auto flex-1">
                  {loadingIngredients ? (
                    <div className="text-center py-8">
                      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
                      <p className="mt-4 text-gray-600">Calculating ingredients...</p>
                    </div>
                  ) : ingredients.length === 0 ? (
                    <div className="text-center py-8">
                      <Package size={48} className="mx-auto text-gray-400 mb-4" />
                      <p className="text-gray-600">No recipes found for the items in this order.</p>
                      <p className="text-sm text-gray-500 mt-2">
                        Please add recipes for the food items in the Inventory → Recipe section.
                      </p>
                    </div>
                  ) : (
                    <>
                      {/* Order Items Summary */}
                      <div className="mb-6 p-4 bg-gray-50 rounded-lg">
                        <h4 className="font-semibold text-gray-700 mb-2">Order Items:</h4>
                        <ul className="space-y-1">
                          {order?.items?.map((item, i) => (
                            <li key={i} className="text-sm text-gray-600">
                              • {item.food_item_name} × {item.quantity}
                            </li>
                          ))}
                        </ul>
                      </div>

                      {/* Aggregated Ingredients */}
                      <div className="mb-4">
                        <h4 className="font-semibold text-gray-700 mb-3 flex items-center gap-2">
                          <Package size={20} />
                          Required Ingredients (Total):
                        </h4>
                        <div className="space-y-2">
                          {ingredients.map((ing, index) => (
                            <div
                              key={index}
                              className="flex items-center justify-between p-3 bg-indigo-50 rounded-lg hover:bg-indigo-100 transition-colors"
                            >
                              <div className="flex-1">
                                <div className="font-medium text-gray-800">
                                  {ing.name}
                                  {ing.code && (
                                    <span className="text-xs text-gray-500 ml-2">({ing.code})</span>
                                  )}
                                </div>
                                {ing.notes && (
                                  <div className="text-xs text-gray-600 mt-1">{ing.notes}</div>
                                )}
                              </div>
                              <div className="text-right">
                                <div className="font-bold text-indigo-700">
                                  {ing.totalQuantity.toFixed(2)} {ing.unit}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Summary Stats */}
                      <div className="mt-6 p-4 bg-indigo-50 rounded-lg">
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <span className="text-gray-600">Total Ingredients:</span>
                            <span className="font-semibold ml-2">{ingredients.length}</span>
                          </div>
                          <div>
                            <span className="text-gray-600">Total Quantity:</span>
                            <span className="font-semibold ml-2">
                              {ingredients.reduce((sum, ing) => sum + ing.totalQuantity, 0).toFixed(2)}
                            </span>
                          </div>
                        </div>
                      </div>
                    </>
                  )}
                </div>

                {/* Footer */}
                <div className="bg-gray-50 p-4 flex justify-end">
                  <button
                    onClick={() => setViewingIngredients(null)}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-6 py-2 rounded-lg transition-colors"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          );
        })()}

        {/* Delivery Request Modal */}
        {showDeliveryRequestModal && (() => {
          const order = orders.find(o => o.id === showDeliveryRequestModal);
          const roomData = rooms.find((r) => r.id === order?.room_id);
          return (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
              <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
                {/* Header */}
                <div className="bg-purple-600 text-white p-6 flex justify-between items-center">
                  <div>
                    <h3 className="text-2xl font-bold flex items-center gap-2">
                      <Truck size={24} />
                      Delivery Request
                    </h3>
                    <p className="text-purple-100 mt-1">
                      Room: {roomData?.number || roomData?.room_number || order?.room_id} |
                      Order #{order?.id} | Room Service
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      setShowDeliveryRequestModal(null);
                      setDeliveryRequestText("");
                    }}
                    className="text-white hover:text-gray-200 transition-colors"
                  >
                    <X size={24} />
                  </button>
                </div>

                {/* Content */}
                <div className="p-6 overflow-y-auto flex-1">
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Delivery Instructions / Special Requests
                      </label>
                      <textarea
                        placeholder="Enter delivery instructions, timing preferences, special requests, or any notes for the room service delivery..."
                        className="w-full border rounded-xl px-4 py-3 focus:ring-2 focus:ring-purple-500 transition resize-none"
                        rows="6"
                        value={deliveryRequestText}
                        onChange={(e) => setDeliveryRequestText(e.target.value)}
                      />
                      <p className="text-xs text-gray-500 mt-2">
                        Add any special delivery instructions, timing preferences, or notes for the room service order.
                      </p>
                    </div>

                    {order?.delivery_request && (
                      <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                        <p className="text-xs font-semibold text-gray-600 mb-1">Current Request:</p>
                        <p className="text-sm text-gray-700">{order.delivery_request}</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Footer */}
                <div className="bg-gray-50 p-4 flex justify-end gap-3">
                  <button
                    onClick={() => {
                      setShowDeliveryRequestModal(null);
                      setDeliveryRequestText("");
                    }}
                    className="bg-gray-200 hover:bg-gray-300 text-gray-700 font-semibold px-6 py-2 rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => handleSubmitDeliveryRequest(showDeliveryRequestModal)}
                    className="bg-purple-600 hover:bg-purple-700 text-white font-semibold px-6 py-2 rounded-lg transition-colors"
                  >
                    {order?.delivery_request ? "Update Request" : "Submit Request"}
                  </button>
                </div>
              </div>
            </div>
          );
        })()}

        {/* Requested Orders Tab */}
        {activeTab === "requests" && (
          <div className="space-y-6">
            {/* KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="bg-white rounded-xl shadow-lg p-6">
                <h3 className="text-sm font-medium text-gray-600 mb-2">Total Requests</h3>
                <p className="text-3xl font-bold text-indigo-600">{foodOrderRequests.length}</p>
              </div>
              <div className="bg-white rounded-xl shadow-lg p-6">
                <h3 className="text-sm font-medium text-gray-600 mb-2">Pending</h3>
                <p className="text-3xl font-bold text-yellow-600">
                  {foodOrderRequests.filter(r => r.status === "pending").length}
                </p>
              </div>
              <div className="bg-white rounded-xl shadow-lg p-6">
                <h3 className="text-sm font-medium text-gray-600 mb-2">In Progress</h3>
                <p className="text-3xl font-bold text-blue-600">
                  {foodOrderRequests.filter(r => r.status === "in_progress").length}
                </p>
              </div>
              <div className="bg-white rounded-xl shadow-lg p-6">
                <h3 className="text-sm font-medium text-gray-600 mb-2">Completed</h3>
                <p className="text-3xl font-bold text-green-600">
                  {foodOrderRequests.filter(r => r.status === "completed").length}
                </p>
              </div>
            </div>

            {/* Performance Metrics */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
              <div className="bg-gradient-to-r from-emerald-500 to-emerald-700 rounded-xl shadow-lg p-6 text-white">
                <h3 className="text-sm font-medium opacity-90 mb-2">Avg Fulfillment Time</h3>
                <p className="text-2xl font-bold">
                  {(() => {
                    const completed = foodOrderRequests.filter(r => r.status === "completed" && r.created_at && r.completed_at);
                    if (completed.length === 0) return "N/A";
                    const avgTime = completed.reduce((sum, r) => {
                      const created = new Date(r.created_at);
                      const completed = new Date(r.completed_at);
                      return sum + (completed - created);
                    }, 0) / completed.length;
                    const minutes = Math.floor(avgTime / (1000 * 60));
                    return minutes < 60 ? `${minutes}m` : `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
                  })()}
                </p>
                <p className="text-xs opacity-75 mt-1">Time to complete</p>
              </div>
              <div className="bg-gradient-to-r from-blue-500 to-blue-700 rounded-xl shadow-lg p-6 text-white">
                <h3 className="text-sm font-medium opacity-90 mb-2">Completion Rate</h3>
                <p className="text-2xl font-bold">
                  {foodOrderRequests.length > 0
                    ? ((foodOrderRequests.filter(r => r.status === "completed").length / foodOrderRequests.length) * 100).toFixed(1)
                    : 0}%
                </p>
                <p className="text-xs opacity-75 mt-1">Requests completed</p>
              </div>
              <div className="bg-gradient-to-r from-purple-500 to-purple-700 rounded-xl shadow-lg p-6 text-white">
                <h3 className="text-sm font-medium opacity-90 mb-2">Assigned Rate</h3>
                <p className="text-2xl font-bold">
                  {foodOrderRequests.length > 0
                    ? ((foodOrderRequests.filter(r => r.employee_id).length / foodOrderRequests.length) * 100).toFixed(1)
                    : 0}%
                </p>
                <p className="text-xs opacity-75 mt-1">With assigned employee</p>
              </div>
            </div>

            {/* Requests Table */}
            <div className="bg-white rounded-xl shadow-lg overflow-hidden">
              <div className="p-6 border-b border-gray-200">
                <h2 className="text-2xl font-bold text-gray-800">Food Order Requests</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="py-3 px-4 text-left text-sm font-semibold text-gray-700">ID</th>
                      <th className="py-3 px-4 text-left text-sm font-semibold text-gray-700">Room</th>
                      <th className="py-3 px-4 text-left text-sm font-semibold text-gray-700">Food Order</th>
                      <th className="py-3 px-4 text-left text-sm font-semibold text-gray-700">Request Type</th>
                      <th className="py-3 px-4 text-left text-sm font-semibold text-gray-700">Description</th>
                      <th className="py-3 px-4 text-left text-sm font-semibold text-gray-700">Employee</th>
                      <th className="py-3 px-4 text-left text-sm font-semibold text-gray-700">Status</th>
                      <th className="py-3 px-4 text-left text-sm font-semibold text-gray-700">Created At</th>
                      <th className="py-3 px-4 text-left text-sm font-semibold text-gray-700">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {foodOrderRequests.length === 0 ? (
                      <tr>
                        <td colSpan="9" className="py-8 text-center text-gray-500">
                          No food order requests found
                        </td>
                      </tr>
                    ) : (
                      foodOrderRequests.map((request) => (
                        <tr key={request.id} className="hover:bg-gray-50">
                          <td className="py-3 px-4 text-sm">{request.id}</td>
                          <td className="py-3 px-4 text-sm">
                            {request.room?.number || request.room_number || "N/A"}
                          </td>
                          <td className="py-3 px-4 text-sm">
                            {request.food_order ? (
                              <div>
                                <div className="font-medium">Order #{request.food_order.id}</div>
                                {request.food_order.items && request.food_order.items.length > 0 && (
                                  <div className="text-gray-600 text-[10px] leading-tight mt-1">
                                    {request.food_order.items.map(item => `${item.food_item_name} (x${item.quantity})`).join(", ")}
                                  </div>
                                )}
                                <div className="text-gray-500 text-xs mt-1 flex items-center gap-2">
                                  ₹{request.food_order.amount || request.food_order_amount || "0"}
                                  {request.food_order.billing_status && (
                                    <span className={`px-1.5 py-0.5 rounded text-[8px] font-black uppercase ${request.food_order.billing_status === 'paid' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                                      {request.food_order.billing_status === 'paid' ? 'Paid' : 'Unpaid'}
                                    </span>
                                  )}
                                </div>
                              </div>
                            ) : (
                              "N/A"
                            )}
                          </td>
                          <td className="py-3 px-4 text-sm capitalize">{request.request_type || "delivery"}</td>
                          <td className="py-3 px-4 text-sm max-w-xs truncate">
                            {request.description || "No description"}
                          </td>
                          <td className="py-3 px-4 text-sm">
                            {request.employee?.name || request.employee_name || (
                              <span className="text-gray-400">Unassigned</span>
                            )}
                          </td>
                          <td className="py-3 px-4">
                            <span
                              className={`px-2 py-1 rounded-full text-xs font-medium ${request.status === "pending"
                                ? "bg-yellow-100 text-yellow-800"
                                : request.status === "in_progress"
                                  ? "bg-blue-100 text-blue-800"
                                  : request.status === "completed"
                                    ? "bg-green-100 text-green-800"
                                    : request.status === "scheduled"
                                      ? "bg-purple-100 text-purple-800"
                                      : "bg-red-100 text-red-800"
                                }`}
                            >
                              {request.status?.replace("_", " ").toUpperCase() || "PENDING"}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-sm text-gray-600">
                            {request.created_at
                              ? new Date(request.created_at).toLocaleString()
                              : "N/A"}
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex gap-2">
                              {request.status === "pending" && (
                                <>
                                  <button
                                    onClick={() => handleAcceptRequest(request.id)}
                                    className="bg-green-500 hover:bg-green-600 text-white text-xs py-1 px-3 rounded transition-colors"
                                  >
                                    Accept
                                  </button>
                                  <button
                                    onClick={() => setAssigningRequestId(request.id)}
                                    className="bg-blue-500 hover:bg-blue-600 text-white text-xs py-1 px-3 rounded transition-colors"
                                  >
                                    Assign
                                  </button>
                                </>
                              )}
                              {request.status === "in_progress" && (
                                <button
                                  onClick={() => handleUpdateRequestStatus(request.id, "completed")}
                                  className="bg-purple-500 hover:bg-purple-600 text-white text-xs py-1 px-3 rounded transition-colors"
                                >
                                  Complete
                                </button>
                              )}
                              {request.status === "completed" && request.food_order?.billing_status === "unpaid" && (
                                <button
                                  onClick={() => handleTogglePaymentStatus(request.food_order)}
                                  className="bg-emerald-500 hover:bg-emerald-600 text-white text-xs py-1 px-3 rounded transition-colors"
                                >
                                  Mark as Paid
                                </button>
                              )}
                              {!request.employee_id && request.status !== "pending" && (
                                <button
                                  onClick={() => setAssigningRequestId(request.id)}
                                  className="bg-indigo-500 hover:bg-indigo-600 text-white text-xs py-1 px-3 rounded transition-colors"
                                >
                                  Assign Employee
                                </button>
                              )}
                              <button
                                onClick={() => handleDeleteRequest(request.id)}
                                className="bg-red-500 hover:bg-red-600 text-white text-xs py-1 px-3 rounded transition-colors"
                              >
                                Delete
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Assign Employee Modal */}
            {assigningRequestId && (
              <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                <div className="bg-white rounded-xl shadow-2xl p-6 max-w-md w-full mx-4">
                  <h3 className="text-xl font-bold text-gray-800 mb-4">Assign Employee</h3>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Select Employee
                      </label>
                      <select
                        value={selectedEmployeeForRequest}
                        onChange={(e) => setSelectedEmployeeForRequest(e.target.value)}
                        className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-indigo-500 text-black font-medium"
                      >
                        <option value="">Choose an employee...</option>
                        {[...employees]
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
                              <option
                                key={emp.id}
                                value={emp.id}
                                style={{ color: isOnline ? "#16a34a" : "inherit", fontWeight: isOnline ? "bold" : "normal" }}
                              >
                                {emp.name} {isOnline ? " 🟢 (Online)" : `(${emp.status || 'off_duty'})`}
                              </option>
                            );
                          })}
                      </select>
                    </div>
                    <div className="flex gap-3">
                      <button
                        onClick={() => {
                          setAssigningRequestId(null);
                          setSelectedEmployeeForRequest("");
                        }}
                        className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-700 font-semibold py-2 px-4 rounded-lg transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={() => handleAssignEmployeeToRequest(assigningRequestId)}
                        className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2 px-4 rounded-lg transition-colors"
                      >
                        Assign
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Food Management Tab */}
        {activeTab === "management" && (
          <div className="space-y-6">
            {error && <div className="p-4 mb-4 text-center text-red-700 bg-red-100 border border-red-200 rounded-lg">{error}</div>}

            {/* KPI Section */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              <KpiCard title="Total Food Items" value={<CountUp end={totalFoodItemsCount} duration={1.5} />} color="bg-gradient-to-r from-green-500 to-green-700" icon={<UtensilsCrossed />} />
              <KpiCard title="Item Categories" value={<CountUp end={totalCategoriesCount} duration={1.5} />} color="bg-gradient-to-r from-blue-500 to-blue-700" icon={<Package />} />
              <KpiCard title="Items Available" value={<CountUp end={availableItemsCount} duration={1.5} />} color="bg-gradient-to-r from-purple-500 to-purple-700" icon={<CheckCircle />} />
            </div>

            {/* Business Performance KPIs */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="bg-gradient-to-r from-emerald-500 to-emerald-700 rounded-xl shadow-lg p-6 text-white">
                <div className="flex justify-between items-center">
                  <div>
                    <p className="text-sm font-medium opacity-90">Avg Item Price</p>
                    <p className="text-3xl font-bold mt-1">
                      ₹{totalItems > 0
                        ? (foodItems.reduce((sum, item) => sum + (parseFloat(item.price) || 0), 0) / totalItems).toLocaleString('en-IN', { maximumFractionDigits: 2 })
                        : '0.00'}
                    </p>
                  </div>
                  <div className="text-4xl opacity-80">💰</div>
                </div>
              </div>
              <div className="bg-gradient-to-r from-orange-500 to-orange-700 rounded-xl shadow-lg p-6 text-white">
                <div className="flex justify-between items-center">
                  <div>
                    <p className="text-sm font-medium opacity-90">Items with Recipes</p>
                    <p className="text-3xl font-bold mt-1">
                      {Object.keys(recipesData).length}
                    </p>
                    <p className="text-xs opacity-75 mt-1">
                      {totalItems > 0 ? ((Object.keys(recipesData).length / totalItems) * 100).toFixed(1) : 0}% coverage
                    </p>
                  </div>
                  <div className="text-4xl opacity-80">📋</div>
                </div>
              </div>
              <div className="bg-gradient-to-r from-pink-500 to-pink-700 rounded-xl shadow-lg p-6 text-white">
                <div className="flex justify-between items-center">
                  <div>
                    <p className="text-sm font-medium opacity-90">Time-based Pricing</p>
                    <p className="text-3xl font-bold mt-1">
                      {foodItems.filter(item => item.time_wise_prices && item.time_wise_prices.length > 0).length}
                    </p>
                    <p className="text-xs opacity-75 mt-1">Items with time pricing</p>
                  </div>
                  <div className="text-4xl opacity-80">⏰</div>
                </div>
              </div>
              <div className="bg-gradient-to-r from-cyan-500 to-cyan-700 rounded-xl shadow-lg p-6 text-white">
                <div className="flex justify-between items-center">
                  <div>
                    <p className="text-sm font-medium opacity-90">Room Service Items</p>
                    <p className="text-3xl font-bold mt-1">
                      {foodItems.filter(item => item.room_service_price).length}
                    </p>
                    <p className="text-xs opacity-75 mt-1">With room service pricing</p>
                  </div>
                  <div className="text-4xl opacity-80">🚚</div>
                </div>
              </div>
            </div>

            {/* Food Item Management Section */}
            <div className="flex justify-between items-center bg-white p-6 rounded-xl shadow-lg border border-gray-100">
              <div>
                <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                  <div className="bg-indigo-100 p-2 rounded-lg">
                    <ChefHat className="text-indigo-600" size={24} />
                  </div>
                  Food Item Management
                </h2>
                <p className="text-sm text-gray-500 mt-1">Manage your restaurant menu items and pricing</p>
              </div>
              <button
                onClick={() => {
                  resetFoodForm();
                  setShowFoodItemModal(true);
                }}
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-6 rounded-xl shadow-lg hover:shadow-xl transition-all flex items-center gap-2 group"
              >
                <div className="bg-white/20 p-1 rounded-md group-hover:rotate-90 transition-transform">
                  <Plus size={18} />
                </div>
                <span>Add New Food Item</span>
              </button>
            </div>

            {/* Food Item Management Modal */}
            {showFoodItemModal && (
              <div className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center z-[80] p-4 text-black">
                <div className="bg-white rounded-2xl shadow-2xl max-w-5xl w-full max-h-[95vh] overflow-hidden flex flex-col scale-in-center">
                  {/* Modal Header */}
                  <div className="bg-gradient-to-r from-indigo-700 to-violet-800 p-6 text-white flex justify-between items-center shrink-0">
                    <div className="flex items-center gap-4">
                      <div className="bg-white/20 p-3 rounded-xl backdrop-blur-sm">
                        <ChefHat size={28} />
                      </div>
                      <div>
                        <h3 className="text-2xl font-black tracking-tight">
                          {editingItemId ? "Edit Food Item" : "Create New Food Item"}
                        </h3>
                        <p className="text-indigo-100 text-sm opacity-90">
                          {editingItemId ? `Updating: ${name}` : "Add a new dish to your menu"}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={resetFoodForm}
                      className="bg-white/10 hover:bg-white/20 p-2.5 rounded-full transition-all hover:rotate-90"
                    >
                      <X size={24} />
                    </button>
                  </div>

                  {/* Modal Content - Scrollable */}
                  <div className="overflow-y-auto p-8 bg-gray-50/50">
                    <form onSubmit={handleFoodSubmit} className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                      {/* Left Column: Basic Info & Pricing */}
                      <div className="space-y-6">
                        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                          <h4 className="text-sm font-black text-gray-400 uppercase tracking-widest mb-6 flex items-center gap-2">
                            <div className="w-1.5 h-4 bg-indigo-500 rounded-full"></div>
                            Basic Details
                          </h4>
                          <div className="space-y-5">
                            <div>
                              <label className="block text-sm font-bold text-gray-700 mb-2">Item Name *</label>
                              <input
                                type="text"
                                placeholder="e.g. Butter Chicken"
                                className="w-full border border-gray-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-indigo-500 transition-all font-medium bg-gray-50/50"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                required
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-bold text-gray-700 mb-2">Category *</label>
                              <select
                                className="w-full border border-gray-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-indigo-500 transition-all font-medium bg-gray-50/50"
                                value={selectedCategory}
                                onChange={(e) => setSelectedCategory(e.target.value)}
                                required
                              >
                                <option value="">Select Category</option>
                                {categories.map((cat) => (
                                  <option key={cat.id} value={cat.id}>{cat.name}</option>
                                ))}
                              </select>
                            </div>
                            <div>
                              <label className="block text-sm font-bold text-gray-700 mb-2">Description *</label>
                              <textarea
                                placeholder="Describe the flavors, ingredients..."
                                className="w-full border border-gray-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-indigo-500 transition-all font-medium bg-gray-50/50"
                                rows="3"
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                required
                              />
                            </div>
                          </div>
                        </div>

                        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                          <h4 className="text-sm font-black text-gray-400 uppercase tracking-widest mb-6 flex items-center gap-2">
                            <div className="w-1.5 h-4 bg-emerald-500 rounded-full"></div>
                            Pricing Options
                          </h4>
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <label className="block text-xs font-bold text-gray-500 mb-1.5 uppercase">Dine In (₹)</label>
                              <div className="relative">
                                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-bold">₹</span>
                                <input
                                  type="number"
                                  className="w-full border border-gray-200 rounded-xl pl-9 pr-4 py-3 focus:ring-2 focus:ring-emerald-500 transition-all font-bold text-emerald-700 bg-gray-50/50"
                                  value={price}
                                  onChange={(e) => setPrice(e.target.value)}
                                  placeholder="0.00"
                                  required
                                />
                              </div>
                            </div>
                            <div>
                              <label className="block text-xs font-bold text-gray-500 mb-1.5 uppercase">Room Service (₹)</label>
                              <div className="relative">
                                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-bold">₹</span>
                                <input
                                  type="number"
                                  className="w-full border border-gray-200 rounded-xl pl-9 pr-4 py-3 focus:ring-2 focus:ring-blue-500 transition-all font-bold text-blue-700 bg-gray-50/50"
                                  value={roomServicePrice}
                                  onChange={(e) => setRoomServicePrice(e.target.value)}
                                  placeholder="Optional"
                                />
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Right Column: Availability & Media & Extras */}
                      <div className="space-y-6">
                        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                          <h4 className="text-sm font-black text-gray-400 uppercase tracking-widest mb-6 flex items-center gap-2">
                            <div className="w-1.5 h-4 bg-orange-500 rounded-full"></div>
                            Availability & Media
                          </h4>
                          <div className="space-y-4">
                            <div className="flex gap-4">
                              <label className="flex-1 flex items-center gap-3 p-4 border-2 rounded-xl cursor-pointer transition-all hover:bg-gray-50 font-bold">
                                <input
                                  type="checkbox"
                                  checked={available}
                                  onChange={(e) => setAvailable(e.target.checked)}
                                  className="w-6 h-6 rounded-lg text-indigo-600 focus:ring-indigo-500 border-gray-300"
                                />
                                <span className={available ? "text-gray-900" : "text-gray-400 line-through"}>Active for ordering</span>
                              </label>
                              <label className="flex-1 flex items-center gap-3 p-4 border-2 rounded-xl cursor-pointer transition-all hover:bg-gray-50 font-bold">
                                <input
                                  type="checkbox"
                                  checked={alwaysAvailable}
                                  onChange={(e) => setAlwaysAvailable(e.target.checked)}
                                  className="w-6 h-6 rounded-lg text-amber-500 focus:ring-amber-500 border-gray-300"
                                />
                                <span className={alwaysAvailable ? "text-gray-900" : "text-gray-400 line-through"}>Available 24/7</span>
                              </label>
                            </div>

                            {!alwaysAvailable && (
                              <div className="grid grid-cols-2 gap-4 animate-in slide-in-from-top-2">
                                <div>
                                  <label className="block text-xs font-bold text-gray-500 mb-1">From</label>
                                  <input type="time" className="w-full border border-gray-200 rounded-xl px-4 py-2" value={availableFromTime} onChange={(e) => setAvailableFromTime(e.target.value)} />
                                </div>
                                <div>
                                  <label className="block text-xs font-bold text-gray-500 mb-1">To</label>
                                  <input type="time" className="w-full border border-gray-200 rounded-xl px-4 py-2" value={availableToTime} onChange={(e) => setAvailableToTime(e.target.value)} />
                                </div>
                              </div>
                            )}

                            <div>
                              <label className="block text-sm font-bold text-gray-700 mb-2">Item Photos</label>
                              <div className="border-2 border-dashed border-gray-200 rounded-xl p-4 hover:border-indigo-300 transition-colors bg-gray-50/30">
                                <input
                                  type="file"
                                  multiple
                                  accept="image/*"
                                  onChange={handleFoodImageChange}
                                  className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-bold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
                                />
                                {imagePreviews.length > 0 && (
                                  <div className="grid grid-cols-5 gap-2 mt-4">
                                    {imagePreviews.map((preview, idx) => (
                                      <div key={idx} className="relative aspect-square">
                                        <img src={preview} className="w-full h-full object-cover rounded-lg border shadow-sm" />
                                        <button onClick={() => handleRemoveFoodImage(idx)} className="absolute -top-1.5 -right-1.5 bg-red-500 text-white rounded-full p-1 shadow-md hover:bg-red-600 transition-colors">
                                          <X size={12} />
                                        </button>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Extra Inventory Items */}
                        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                          <div className="flex justify-between items-center mb-4">
                            <h4 className="text-sm font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
                              <div className="w-1.5 h-4 bg-teal-500 rounded-full"></div>
                              Room Service Extras
                            </h4>
                            <button
                              type="button"
                              onClick={handleAddExtraInventoryItem}
                              className="text-teal-600 hover:text-teal-700 font-bold text-xs bg-teal-50 px-2.5 py-1.5 rounded-lg transition-all"
                            >
                              + Add Item
                            </button>
                          </div>
                          <div className="space-y-2">
                            {extraInventoryItems.map((item, idx) => (
                              <div key={idx} className="flex gap-2 items-center bg-gray-50 p-2 rounded-xl group animate-in slide-in-from-right-2">
                                <select
                                  value={item.inventory_item_id}
                                  onChange={(e) => handleUpdateExtraInventoryItem(idx, "inventory_item_id", e.target.value)}
                                  className="flex-1 border-none bg-transparent font-medium text-sm focus:ring-0"
                                >
                                  <option value="">Select Package/Item</option>
                                  {inventoryItemsList.map(inv => <option key={inv.id} value={inv.id}>{inv.name}</option>)}
                                </select>
                                <input
                                  type="number"
                                  value={item.quantity}
                                  onChange={(e) => handleUpdateExtraInventoryItem(idx, "quantity", e.target.value)}
                                  className="w-16 border-none bg-white rounded-lg px-2 py-1 text-sm font-bold shadow-sm"
                                />
                                <button onClick={() => handleRemoveExtraInventoryItem(idx)} className="p-1.5 text-red-400 hover:text-red-600 transition-colors">
                                  <Trash2 size={16} />
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>

                      {/* Time-wise Pricing (Full Width Section) */}
                      <div className="lg:col-span-2 bg-indigo-50/30 p-8 rounded-3xl border border-indigo-100">
                        <div className="flex justify-between items-center mb-6">
                          <div>
                            <h4 className="text-lg font-black text-indigo-900">Time-based Variable Pricing</h4>
                            <p className="text-indigo-600 text-sm font-medium">Define different prices for Breakfast, Lunch, Dinner etc.</p>
                          </div>
                          <button
                            type="button"
                            onClick={handleAddTimeWisePrice}
                            className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-5 py-2.5 rounded-xl shadow-md transition-all flex items-center gap-2"
                          >
                            <Plus size={18} />
                            Add Pricing Tier
                          </button>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                          {timeWisePrices.map((tp, idx) => (
                            <div key={idx} className="bg-white p-4 rounded-2xl shadow-sm border border-indigo-100 flex flex-col gap-3 relative animate-in zoom-in-95 duration-200">
                              <button
                                onClick={() => handleRemoveTimeWisePrice(idx)}
                                className="absolute -top-2 -right-2 bg-red-100 text-red-600 rounded-full p-1.5 hover:bg-red-600 hover:text-white shadow-sm transition-all"
                              >
                                <X size={14} />
                              </button>
                              <div className="flex gap-2">
                                <div className="flex-1">
                                  <label className="block text-[10px] uppercase font-black text-gray-400 mb-1">From</label>
                                  <input type="time" className="w-full border-gray-100 rounded-lg text-sm bg-gray-50/50" value={tp.from_time} onChange={(e) => handleUpdateTimeWisePrice(idx, "from_time", e.target.value)} />
                                </div>
                                <div className="flex-1">
                                  <label className="block text-[10px] uppercase font-black text-gray-400 mb-1">To</label>
                                  <input type="time" className="w-full border-gray-100 rounded-lg text-sm bg-gray-50/50" value={tp.to_time} onChange={(e) => handleUpdateTimeWisePrice(idx, "to_time", e.target.value)} />
                                </div>
                              </div>
                              <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-bold">₹</span>
                                <input
                                  type="number"
                                  className="w-full border-indigo-50 rounded-lg pl-7 py-2 font-black text-indigo-700 bg-indigo-50/30"
                                  value={tp.price}
                                  onChange={(e) => handleUpdateTimeWisePrice(idx, "price", e.target.value)}
                                  placeholder="0.00"
                                />
                              </div>
                            </div>
                          ))}
                        </div>
                        {timeWisePrices.length === 0 && (
                          <div className="text-center py-12 border-2 border-dashed border-indigo-200 rounded-2xl">
                            <Clock className="mx-auto text-indigo-200 mb-3" size={40} />
                            <p className="text-indigo-400 font-bold">No variable pricing set</p>
                            <p className="text-indigo-300 text-xs">The base Dine-In price will apply at all times</p>
                          </div>
                        )}
                      </div>

                      {/* Action Buttons */}
                      <div className="lg:col-span-2 flex gap-4 pt-6 border-t border-gray-100">
                        <button
                          type="button"
                          onClick={resetFoodForm}
                          className="flex-1 px-8 py-4 border-2 border-gray-200 rounded-2xl text-gray-600 font-black hover:bg-gray-50 transition-all uppercase tracking-widest text-sm"
                        >
                          Discard Changes
                        </button>
                        <button
                          type="submit"
                          disabled={isLoading}
                          className="flex-[2] bg-indigo-700 hover:bg-indigo-800 text-white font-black py-4 rounded-2xl shadow-xl shadow-indigo-100 transition-all uppercase tracking-widest text-sm flex items-center justify-center gap-3 disabled:bg-gray-400"
                        >
                          {isLoading ? (
                            <div className="w-6 h-6 border-4 border-white border-t-transparent rounded-full animate-spin"></div>
                          ) : (
                            <>
                              <CheckCircle size={20} />
                              {editingItemId ? "Update Menu Item" : "Publish to Menu"}
                            </>
                          )}
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              </div>
            )}

            {/* Food Items List */}
            <div className="mt-8">
              <div className="mb-6">
                <h3 className="text-xl font-semibold text-gray-800 mb-4">All Food Items</h3>
                <div className="flex flex-wrap gap-3">
                  <div className="flex-1 min-w-[200px]">
                    <input
                      type="text"
                      placeholder="🔍 Search items..."
                      className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition"
                      value={filters.search}
                      onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                    />
                  </div>
                  <select
                    className="border border-gray-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition min-w-[150px]"
                    value={filters.category}
                    onChange={(e) => setFilters({ ...filters, category: e.target.value })}
                  >
                    <option value="all">All Categories</option>
                    {categories.map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.name}
                      </option>
                    ))}
                  </select>
                  <select
                    className="border border-gray-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition min-w-[150px]"
                    value={filters.availability}
                    onChange={(e) => setFilters({ ...filters, availability: e.target.value })}
                  >
                    <option value="all">All Status</option>
                    <option value="available">Available</option>
                    <option value="unavailable">Unavailable</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredFoodItems.length === 0 ? (
                  <div className="col-span-full text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
                    <p className="text-gray-500">No food items found</p>
                    <p className="text-sm text-gray-400 mt-1">Try adjusting your filters</p>
                  </div>
                ) : (
                  filteredFoodItems.map((item) => (
                    <div key={item.id} className="bg-white border border-gray-200 rounded-lg overflow-hidden hover:shadow-md transition-shadow">
                      {/* Item Image */}
                      {item.images && item.images.length > 0 && (
                        <div className="relative h-40 bg-gray-100">
                          <img
                            src={getImageUrl(item.images[0].image_url)}
                            alt={item.name}
                            className="w-full h-full object-cover"
                          />
                          <span className={`absolute top-2 right-2 px-2 py-1 rounded-full text-xs font-medium ${item.available ? 'bg-green-500 text-white' : 'bg-red-500 text-white'
                            }`}>
                            {item.available ? 'Available' : 'Unavailable'}
                          </span>
                        </div>
                      )}

                      {/* Item Details */}
                      <div className="p-4">
                        <h3 className="font-semibold text-lg text-gray-800 mb-1">{item.name}</h3>
                        <p className="text-sm text-gray-600 mb-3 line-clamp-2">{item.description}</p>

                        {/* Pricing */}
                        <div className="mb-3 space-y-2">
                          <div className="flex justify-between items-center">
                            <span className="text-sm text-gray-500">Dine In:</span>
                            <span className="font-semibold text-indigo-600">₹{item.price || 0}</span>
                          </div>
                          {item.room_service_price && (
                            <div className="flex justify-between items-center">
                              <span className="text-sm text-gray-500">Room Service:</span>
                              <span className="font-semibold text-purple-600">₹{item.room_service_price}</span>
                            </div>
                          )}
                        </div>

                        {/* Cost & Profit (if recipe exists) */}
                        {(() => {
                          const recipe = recipesData[item.id];
                          let itemCost = 0;
                          if (recipe && recipe.ingredients && Array.isArray(recipe.ingredients)) {
                            const servings = recipe.servings || 1;
                            recipe.ingredients.forEach(ing => {
                              const invItem = inventoryItemsList.find(inv => inv.id === ing.inventory_item_id);
                              if (invItem && invItem.unit_price) {
                                itemCost += (ing.quantity || 0) * invItem.unit_price / servings;
                              }
                            });
                          }
                          const itemProfit = parseFloat(item.price || 0) - itemCost;
                          const margin = parseFloat(item.price || 0) > 0 ? ((itemProfit / parseFloat(item.price || 0)) * 100) : 0;
                          return itemCost > 0 ? (
                            <div className="mb-3 p-2 bg-gray-50 rounded border border-gray-200">
                              <div className="grid grid-cols-3 gap-2 text-xs">
                                <div className="text-center">
                                  <p className="text-gray-500 mb-1">Cost</p>
                                  <p className="font-semibold text-red-600">₹{itemCost.toFixed(0)}</p>
                                </div>
                                <div className="text-center">
                                  <p className="text-gray-500 mb-1">Profit</p>
                                  <p className={`font-semibold ${itemProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                    ₹{itemProfit.toFixed(0)}
                                  </p>
                                </div>
                                <div className="text-center">
                                  <p className="text-gray-500 mb-1">Margin</p>
                                  <p className={`font-semibold ${margin >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                    {margin.toFixed(0)}%
                                  </p>
                                </div>
                              </div>
                            </div>
                          ) : null;
                        })()}

                        {/* Actions */}
                        <div className="flex flex-wrap gap-2 mt-4">
                          <button
                            onClick={() => setViewingFoodItemDetails(item)}
                            className="flex-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-sm py-2 px-3 rounded-lg transition-colors font-bold border border-indigo-200"
                          >
                            Details
                          </button>
                          <button
                            onClick={() => handleFoodEdit(item)}
                            className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white text-sm py-2 px-3 rounded-lg transition-colors font-medium text-center"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => toggleFoodAvailability(item)}
                            className="bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm py-2 px-3 rounded-lg transition-colors font-medium"
                          >
                            {item.available ? 'Hide' : 'Show'}
                          </button>
                          <button
                            onClick={() => handleFoodDelete(item.id)}
                            className="bg-red-50 hover:bg-red-100 text-red-600 text-sm py-2 px-3 rounded-lg transition-colors font-medium text-center"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
              {/* Food Items Pagination */}
              {totalFoodItemsCount > itemsPerPage && (
                <div className="mt-8 flex justify-center items-center gap-2">
                  <button
                    onClick={() => setFoodItemPage(p => Math.max(1, p - 1))}
                    disabled={foodItemPage === 1}
                    className="px-4 py-2 border rounded-lg disabled:opacity-50 hover:bg-gray-50 transition-colors"
                  >
                    Previous
                  </button>
                  {Array.from({ length: Math.ceil(totalFoodItemsCount / itemsPerPage) }, (_, i) => (
                    <button
                      key={i + 1}
                      onClick={() => setFoodItemPage(i + 1)}
                      className={`w-10 h-10 rounded-lg border transition-all ${foodItemPage === i + 1
                        ? "bg-indigo-600 text-white border-indigo-600 shadow-md"
                        : "hover:bg-gray-50 text-gray-600"
                        }`}
                    >
                      {i + 1}
                    </button>
                  ))}
                  <button
                    onClick={() => setFoodItemPage(p => Math.min(Math.ceil(totalFoodItemsCount / itemsPerPage), p + 1))}
                    disabled={foodItemPage === Math.ceil(totalFoodItemsCount / itemsPerPage)}
                    className="px-4 py-2 border rounded-lg disabled:opacity-50 hover:bg-gray-50 transition-colors"
                  >
                    Next
                  </button>
                </div>
              )}
            </div>


            {/* Food Item Details Modal */}
            {viewingFoodItemDetails && (() => {
              const item = { ...viewingFoodItemDetails };

              // Safely parse JSON strings from backend if needed
              if (item.time_wise_prices && typeof item.time_wise_prices === 'string') {
                try {
                  item.time_wise_prices = JSON.parse(item.time_wise_prices);
                } catch (e) {
                  item.time_wise_prices = [];
                }
              }
              if (item.extra_inventory_items && typeof item.extra_inventory_items === 'string') {
                try {
                  item.extra_inventory_items = JSON.parse(item.extra_inventory_items);
                } catch (e) {
                  item.extra_inventory_items = [];
                }
              }

              const stats = getFoodItemStats(item.id);
              const recipe = recipesData[item.id];

              return (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[60] p-4 text-black">
                  <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
                    {/* Header */}
                    <div className="bg-indigo-700 p-6 text-white flex justify-between items-center shrink-0">
                      <div className="flex items-center gap-3">
                        <div className="bg-white/20 p-2 rounded-lg">
                          <UtensilsCrossed size={24} />
                        </div>
                        <div>
                          <h3 className="text-2xl font-bold">{item.name}</h3>
                          <p className="text-indigo-100 text-sm">{item.category?.name || "General"}</p>
                        </div>
                      </div>
                      <button
                        onClick={() => setViewingFoodItemDetails(null)}
                        className="bg-white/20 hover:bg-white/30 p-2 rounded-full transition-colors"
                      >
                        <X size={20} />
                      </button>
                    </div>

                    {/* Content */}
                    <div className="overflow-y-auto p-6 space-y-8">
                      {/* Grid for basics and stats */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        {/* Description and Basics */}
                        <div className="space-y-6">
                          <div>
                            <h4 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-2">Description</h4>
                            <p className="text-gray-700 leading-relaxed">{item.description}</p>
                          </div>

                          <div className="grid grid-cols-2 gap-4">
                            <div className="bg-blue-50 p-4 rounded-xl border border-blue-100">
                              <p className="text-xs text-blue-600 font-bold uppercase">Dine-In Price</p>
                              <p className="text-2xl font-bold text-blue-900">₹{item.price}</p>
                            </div>
                            <div className="bg-purple-50 p-4 rounded-xl border border-purple-100">
                              <p className="text-xs text-purple-600 font-bold uppercase">Room Service</p>
                              <p className="text-2xl font-bold text-purple-900">₹{item.room_service_price || item.price}</p>
                            </div>
                          </div>

                          {/* Availability details */}
                          <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
                            <h4 className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
                              <span className="text-indigo-600">⏰</span>
                              Availability Timings
                            </h4>
                            {item.always_available ? (
                              <p className="text-sm text-green-700 font-medium">✨ Always available (24/7)</p>
                            ) : (
                              <div className="flex items-center gap-4 text-sm">
                                <div className="bg-white px-3 py-1 rounded-lg border border-gray-200">
                                  <span className="text-gray-500 mr-2">From:</span>
                                  <span className="font-bold text-gray-800">{item.available_from_time || "00:00"}</span>
                                </div>
                                <div className="bg-white px-3 py-1 rounded-lg border border-gray-200">
                                  <span className="text-gray-500 mr-2">Until:</span>
                                  <span className="font-bold text-gray-800">{item.available_to_time || "23:59"}</span>
                                </div>
                              </div>
                            )}

                            {item.time_wise_prices && item.time_wise_prices.length > 0 && (
                              <div className="mt-4 pt-4 border-t border-gray-200">
                                <p className="text-xs font-bold text-gray-500 mb-2 uppercase">Time-based Pricing</p>
                                <div className="space-y-2">
                                  {item.time_wise_prices.map((tp, idx) => (
                                    <div key={idx} className="flex justify-between items-center bg-white p-2 rounded-lg text-xs border border-gray-100">
                                      <span>{tp.from_time} - {tp.to_time}</span>
                                      <span className="font-bold text-indigo-600 font-medium">₹{tp.price}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Performance Stats */}
                        <div className="bg-gray-900 rounded-2xl p-6 text-white">
                          <h4 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-6 flex items-center gap-2">
                            <span className="text-green-400">📈</span>
                            Time-Based Analytics
                          </h4>

                          <div className="grid grid-cols-2 gap-6 mb-8">
                            <div>
                              <p className="text-xs text-gray-400 mb-1">Total Quantity Sold</p>
                              <p className="text-3xl font-bold">{stats.totalQuantity}</p>
                            </div>
                            <div>
                              <p className="text-xs text-gray-400 mb-1">Total Revenue Generated</p>
                              <p className="text-3xl font-bold text-green-400">₹{stats.totalRevenue.toLocaleString()}</p>
                            </div>
                            <div>
                              <p className="text-xs text-gray-400 mb-1">Peak Popularity Time</p>
                              <p className="text-xl font-bold text-yellow-400">{stats.peakHour}</p>
                            </div>
                            <div>
                              <p className="text-xs text-gray-400 mb-1">Best Selling Day</p>
                              <p className="text-xl font-bold">{stats.topDay}</p>
                            </div>
                          </div>

                          {/* Simple Hourly Map (Horizontal Visualization) */}
                          <div>
                            <p className="text-xs text-gray-400 mb-3 text-black">Popularity by Hour (24h)</p>
                            <div className="flex items-end gap-1 h-24">
                              {stats.hourlySales.map((qty, i) => {
                                const max = Math.max(...stats.hourlySales) || 1;
                                const height = (qty / max) * 100;
                                return (
                                  <div
                                    key={i}
                                    title={`${i}:00 - ${qty} items`}
                                    className="flex-1 bg-indigo-500/30 rounded-t-sm hover:bg-indigo-400 transition-colors group relative"
                                    style={{ height: `${Math.max(height, 5)}%` }}
                                  >
                                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 bg-black text-[10px] p-1 rounded opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-10 transition-opacity">
                                      {i}:00 ({qty})
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                            <div className="flex justify-between mt-1 text-[10px] text-gray-500">
                              <span>00:00</span>
                              <span>06:00</span>
                              <span>12:00</span>
                              <span>18:00</span>
                              <span>23:00</span>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Recipe and Extra Items */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-8 border-t border-gray-100">
                        {/* Recipe Section */}
                        <div>
                          <h4 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                            <ChefHat size={20} className="text-orange-500" />
                            Recipe & Cost Breakdown
                          </h4>
                          {recipe ? (
                            <div className="space-y-4">
                              <div className="grid grid-cols-2 gap-3 text-xs">
                                <div className="bg-gray-100 p-2 rounded">
                                  <span className="text-gray-500 block mb-1">Servings</span>
                                  <span className="font-bold">{recipe.servings || 1} Person(s)</span>
                                </div>
                                <div className="bg-gray-100 p-2 rounded">
                                  <span className="text-gray-500 block mb-1">Cook Time</span>
                                  <span className="font-bold">{recipe.cook_time_minutes || "--"} mins</span>
                                </div>
                              </div>
                              <div className="border rounded-xl overflow-hidden overflow-x-auto">
                                <table className="w-full text-sm">
                                  <thead className="bg-gray-50">
                                    <tr className="text-left text-xs uppercase text-gray-500 tracking-wider">
                                      <th className="px-3 py-2">Ingredient</th>
                                      <th className="px-3 py-2">Qty</th>
                                      <th className="px-3 py-2">Cost</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-gray-100">
                                    {recipe.ingredients.map((ing, idx) => {
                                      const invItem = inventoryItemsList.find(inv => inv.id === ing.inventory_item_id);
                                      const cost = (ing.quantity || 0) * (invItem?.unit_price || 0);
                                      return (
                                        <tr key={idx}>
                                          <td className="px-3 py-2 text-gray-700">{invItem?.name || ing.inventory_item_name}</td>
                                          <td className="px-3 py-2 font-medium">{ing.quantity} {ing.unit}</td>
                                          <td className="px-3 py-2 text-red-600">₹{cost.toFixed(1)}</td>
                                        </tr>
                                      );
                                    })}
                                  </tbody>
                                  <tfoot className="bg-gray-50 font-bold border-t">
                                    <tr>
                                      <td colSpan="2" className="px-3 py-2 text-right">Total Recipe Cost:</td>
                                      <td className="px-3 py-2 text-red-700">
                                        ₹{recipe.ingredients.reduce((sum, ing) => {
                                          const invItem = inventoryItemsList.find(inv => inv.id === ing.inventory_item_id);
                                          return sum + ((ing.quantity || 0) * (invItem?.unit_price || 0));
                                        }, 0).toFixed(1)}
                                      </td>
                                    </tr>
                                  </tfoot>
                                </table>
                              </div>
                            </div>
                          ) : (
                            <div className="bg-yellow-50 p-4 rounded-xl border border-yellow-100 text-yellow-800 text-sm">
                              No recipe associated with this item yet. Cost metrics will be limited.
                            </div>
                          )}
                        </div>

                        {/* Extra Items for Room Service */}
                        <div>
                          <h4 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                            <Truck size={20} className="text-indigo-600" />
                            Delivery/Parcel Extras
                          </h4>
                          {item.extra_inventory_items && item.extra_inventory_items.length > 0 ? (
                            <div className="space-y-3">
                              <p className="text-xs text-gray-500 italic">These items are automatically consumed during room service or parcel orders.</p>
                              {item.extra_inventory_items.map((extra, idx) => {
                                const invItem = inventoryItemsList.find(inv => inv.id === extra.inventory_item_id);
                                return (
                                  <div key={idx} className="flex justify-between items-center bg-gray-50 p-3 rounded-xl border border-gray-100">
                                    <div className="flex items-center gap-3">
                                      <div className="bg-white p-2 rounded shadow-sm text-indigo-600">
                                        <Package size={14} />
                                      </div>
                                      <span className="text-sm font-medium">{invItem?.name || "Extra Item"}</span>
                                    </div>
                                    <span className="text-sm font-bold bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full">
                                      {extra.quantity} {invItem?.unit || "pcs"}
                                    </span>
                                  </div>
                                );
                              })}
                            </div>
                          ) : (
                            <p className="text-sm text-gray-500 italic py-4">No automatic extra items configured for delivery/parcel.</p>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Footer */}
                    <div className="p-6 bg-gray-50 border-t flex justify-end shrink-0">
                      <button
                        onClick={() => setViewingFoodItemDetails(null)}
                        className="bg-gray-800 hover:bg-black text-white px-8 py-3 rounded-xl font-bold transition-all transform hover:scale-105"
                      >
                        Close Details
                      </button>
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* Food Category Management Section */}
            <div className="bg-white p-8 rounded-2xl shadow-lg">
              <h2 className="text-2xl font-bold mb-6 text-gray-800">📁 Category Management</h2>
              <form onSubmit={handleCategorySubmit} className="mb-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <input
                    type="text"
                    placeholder="Category Name"
                    className="border border-gray-300 rounded-xl px-4 py-3 focus:ring-2 focus:ring-indigo-500"
                    value={categoryName}
                    onChange={(e) => setCategoryName(e.target.value)}
                    required
                  />
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleCategoryImageChange}
                    className="border border-gray-300 rounded-xl px-4 py-3 focus:ring-2 focus:ring-indigo-500"
                    required={!editCategoryId}
                  />
                  <div className="flex gap-2">
                    <button
                      type="submit"
                      className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-3 px-6 rounded-xl"
                    >
                      {editCategoryId ? "Update Category" : "Add Category"}
                    </button>
                    {editCategoryId && (
                      <button
                        type="button"
                        onClick={() => {
                          setEditCategoryId(null);
                          setCategoryName("");
                          setCategoryImageFile(null);
                          setCategoryPreviewUrl(null);
                        }}
                        className="bg-gray-500 hover:bg-gray-600 text-white font-semibold py-3 px-6 rounded-xl"
                      >
                        Cancel
                      </button>
                    )}
                  </div>
                </div>
                {categoryPreviewUrl && (
                  <img src={categoryPreviewUrl} alt="Preview" className="mt-4 w-32 h-32 object-cover rounded border" />
                )}
              </form>
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                {categories.map((cat) => (
                  <div key={cat.id} className="border border-gray-200 rounded-lg p-4 text-center hover:shadow-lg transition-shadow">
                    <img src={getImageUrl(`uploads/food_categories/${cat.image}`)} alt={cat.name} className="w-full h-24 object-cover rounded mb-2" />
                    <h3 className="font-semibold mb-2">{cat.name}</h3>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleCategoryEdit(cat)}
                        className="flex-1 bg-blue-500 hover:bg-blue-600 text-white text-xs py-1 px-2 rounded"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleCategoryDelete(cat.id)}
                        className="flex-1 bg-red-500 hover:bg-red-600 text-white text-xs py-1 px-2 rounded"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              {/* Categories Pagination */}
              {totalCategoriesCount > itemsPerPage && (
                <div className="mt-8 flex justify-center items-center gap-2">
                  <button
                    onClick={() => setCategoryPage(p => Math.max(1, p - 1))}
                    disabled={categoryPage === 1}
                    className="px-4 py-2 border rounded-lg disabled:opacity-50 hover:bg-gray-50 transition-colors"
                  >
                    Previous
                  </button>
                  {Array.from({ length: Math.ceil(totalCategoriesCount / itemsPerPage) }, (_, i) => (
                    <button
                      key={i + 1}
                      onClick={() => setCategoryPage(i + 1)}
                      className={`w-10 h-10 rounded-lg border transition-all ${categoryPage === i + 1
                        ? "bg-indigo-600 text-white border-indigo-600 shadow-md"
                        : "hover:bg-gray-50 text-gray-600"
                        }`}
                    >
                      {i + 1}
                    </button>
                  ))}
                  <button
                    onClick={() => setCategoryPage(p => Math.min(Math.ceil(totalCategoriesCount / itemsPerPage), p + 1))}
                    disabled={categoryPage === Math.ceil(totalCategoriesCount / itemsPerPage)}
                    className="px-4 py-2 border rounded-lg disabled:opacity-50 hover:bg-gray-50 transition-colors"
                  >
                    Next
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* --- Global Modals (Rendered outside tabs) --- */}

        {/* Complete Order Modal (from orders list) */}
        {showCompleteModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[100] p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full animate-in fade-in zoom-in-95 duration-200 overflow-hidden">
              <div className="bg-indigo-600 text-white p-6">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="text-xl font-bold">Complete Food Order</h3>
                    <p className="text-indigo-100 mt-1 text-sm font-medium">
                      Order #{showCompleteModal.id} | Room: {rooms.find(r => r.id === showCompleteModal.room_id)?.number || showCompleteModal.room_id}
                    </p>
                    <p className="text-indigo-200 text-[10px] mt-1 uppercase tracking-wider font-bold">
                      Created: {showCompleteModal.created_at ? formatDateTimeIST(showCompleteModal.created_at) : new Date().toLocaleString()}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="text-xs font-bold text-indigo-200 block uppercase">Total Amount</span>
                    <span className="text-2xl font-black">₹{parseFloat(showCompleteModal.total_with_gst || showCompleteModal.amount || 0).toLocaleString('en-IN')}</span>
                  </div>
                </div>
              </div>
              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-3">
                    Payment Status *
                  </label>
                  {parseFloat(showCompleteModal.total_with_gst || showCompleteModal.amount || 0) > 0 ? (
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-3">
                        <button
                          type="button"
                          onClick={() => setPaymentStatus("paid")}
                          className={`p-3 border-2 rounded-xl transition-all ${paymentStatus === "paid"
                            ? "border-green-500 bg-green-50 text-green-700 shadow-sm"
                            : "border-gray-200 hover:border-green-200 text-gray-600"
                            }`}
                        >
                          <span className="font-bold">Paid</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setPaymentStatus("unpaid")}
                          className={`p-3 border-2 rounded-xl transition-all ${paymentStatus === "unpaid"
                            ? "border-red-500 bg-red-50 text-red-700 shadow-sm"
                            : "border-gray-200 hover:border-red-200 text-gray-600"
                            }`}
                        >
                          <span className="font-bold">Unpaid</span>
                        </button>
                      </div>

                      {paymentStatus === "paid" && (
                        <div className="animate-in slide-in-from-top-2 duration-300">
                          <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2">
                            Mode of Payment
                          </label>
                          <div className="grid grid-cols-2 gap-2">
                            {["Cash", "UPI", "Card", "Other"].map((mode) => (
                              <button
                                key={mode}
                                type="button"
                                onClick={() => setPaymentMode(mode)}
                                className={`py-2 px-3 border rounded-xl text-sm font-bold transition-all ${paymentMode === mode
                                  ? "bg-indigo-600 text-white border-indigo-600 shadow-md"
                                  : "bg-white text-gray-500 border-gray-100 hover:bg-gray-50"
                                  }`}
                              >
                                {mode}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="p-4 bg-green-50 border border-green-100 rounded-xl text-center shadow-sm">
                      <span className="font-black text-green-700 text-xs uppercase tracking-wider">Free / Package Order</span>
                      <p className="text-xs text-green-600 mt-1 font-medium">No payment required for this service.</p>
                    </div>
                  )}
                </div>
                {showCompleteModal.order_type === "room_service" && (
                  <div className="bg-purple-50 border border-purple-100 rounded-xl p-3 flex gap-3 items-center">
                    <div className="bg-white p-2 rounded-lg shadow-sm text-purple-600">
                      <Truck size={16} />
                    </div>
                    <p className="text-[10px] text-purple-700 font-medium leading-tight">
                      A delivery service request will be automatically created.
                    </p>
                  </div>
                )}
                <div className="flex gap-3 pt-2">
                  <button
                    onClick={() => {
                      setShowCompleteModal(null);
                      setPaymentStatus("unpaid");
                    }}
                    className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-600 font-bold py-3 rounded-xl transition-colors text-sm"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleCompleteOrder}
                    className="flex-[2] bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded-xl shadow-lg shadow-indigo-100 transition-all text-sm"
                  >
                    Confirm & Complete
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Complete Request Modal (from Food Order Requests table) */}
        {showRequestCompleteModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[100] p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full animate-in fade-in zoom-in-95 duration-200 overflow-hidden">
              <div className="bg-purple-600 text-white p-6">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="text-xl font-bold">Complete Food Request</h3>
                    <p className="text-purple-100 mt-1 text-sm font-medium">
                      Request #{showRequestCompleteModal.id} | Room: {showRequestCompleteModal.room_number || showRequestCompleteModal.room?.number || "N/A"}
                    </p>
                    <p className="text-purple-200 text-[10px] mt-1 uppercase tracking-wider font-bold">
                      Created: {showRequestCompleteModal.created_at ? formatDateTimeIST(showRequestCompleteModal.created_at) : new Date().toLocaleString()}
                    </p>
                  </div>
                  {showRequestCompleteModal.food_order && (
                    <div className="text-right">
                      <span className="text-xs font-bold text-purple-200 block uppercase">Order Total</span>
                      <span className="text-2xl font-black">₹{parseFloat(showRequestCompleteModal.food_order.total_with_gst || showRequestCompleteModal.food_order.amount || 0).toLocaleString('en-IN')}</span>
                    </div>
                  )}
                </div>
              </div>
              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-3">
                    Update Payment Status
                  </label>
                  {(showRequestCompleteModal.food_order_id || showRequestCompleteModal.food_order) ? (
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-3">
                        <button
                          type="button"
                          onClick={() => setPaymentStatus("paid")}
                          className={`p-3 border-2 rounded-xl transition-all ${paymentStatus === "paid"
                            ? "border-green-500 bg-green-50 text-green-700 shadow-sm"
                            : "border-gray-200 hover:border-green-200 text-gray-600"
                            }`}
                        >
                          <span className="font-bold">Paid</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setPaymentStatus("unpaid")}
                          className={`p-3 border-2 rounded-xl transition-all ${paymentStatus === "unpaid"
                            ? "border-red-500 bg-red-50 text-red-700 shadow-sm"
                            : "border-gray-200 hover:border-red-200 text-gray-600"
                            }`}
                        >
                          <span className="font-bold">Unpaid</span>
                        </button>
                      </div>

                      {paymentStatus === "paid" && (
                        <div className="animate-in slide-in-from-top-2 duration-300">
                          <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2">
                            Mode of Payment
                          </label>
                          <div className="grid grid-cols-2 gap-2">
                            {["Cash", "UPI", "Card", "Other"].map((mode) => (
                              <button
                                key={mode}
                                type="button"
                                onClick={() => setPaymentMode(mode)}
                                className={`py-2 px-3 border rounded-xl text-sm font-bold transition-all ${paymentMode === mode
                                  ? "bg-purple-600 text-white border-purple-600 shadow-md"
                                  : "bg-white text-gray-500 border-gray-100 hover:bg-gray-50"
                                  }`}
                              >
                                {mode}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="p-4 bg-gray-50 border border-gray-100 rounded-xl text-center">
                      <p className="text-xs text-gray-500 font-medium">This request is not linked to a specific billable order.</p>
                    </div>
                  )}
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    onClick={() => {
                      setShowRequestCompleteModal(null);
                      setPaymentStatus("unpaid");
                    }}
                    className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-600 font-bold py-3 rounded-xl transition-colors text-sm"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleCompleteRequest}
                    className="flex-[2] bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 rounded-xl shadow-lg shadow-purple-100 transition-all text-sm"
                  >
                    Confirm & Complete
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

      </div>
    </DashboardLayout >
  );
}
