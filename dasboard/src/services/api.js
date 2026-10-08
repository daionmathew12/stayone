// src/services/api.js
import axios from "axios";
import { getApiBaseUrl } from "../utils/env";

// Set your backend API base URL
const apiBaseUrl = getApiBaseUrl();
console.log("API Base URL:", apiBaseUrl); // Debug log
const API = axios.create({
  baseURL: apiBaseUrl,
  timeout: 60000, // 60 second timeout (increased for large queries)
  headers: {
    "Accept": "application/json",
  },
});

// Automatically add token and branch ID to headers and prevent caching
API.interceptors.request.use((req) => {
  const token = localStorage.getItem("token");
  if (token) req.headers.Authorization = `Bearer ${token}`;

  const branchId = localStorage.getItem("activeBranchId");
  if (branchId && !req.headers["X-Branch-ID"]) {
    // Always send the header — send 'all' for enterprise view, numeric id for specific branch
    req.headers["X-Branch-ID"] = branchId; // 'all' or a numeric branch id
  }

  // Add cache-busting headers for GET requests to prevent browser caching
  if (req.method === 'get') {
    req.headers['Cache-Control'] = 'no-cache, no-store, must-revalidate';
    req.headers['Pragma'] = 'no-cache';
    req.headers['Expires'] = '0';
  }

  console.log("API Request:", req.method, req.url, "Branch ID:", branchId);
  return req;
});

// Response interceptor to handle errors gracefully
API.interceptors.response.use(
  (response) => response,
  (error) => {
    // Handle timeout errors
    if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
      console.error("Request timeout:", error.config?.url);
      return Promise.reject({
        ...error,
        message: "Request timed out. The server is taking too long to respond.",
        isTimeout: true,
      });
    }

    // Handle network errors
    if (!error.response) {
      console.error("Network error:", error.message);
      console.error("Request URL:", error.config?.url);
      console.error("Base URL:", error.config?.baseURL);
      console.error("Full error:", error);
      return Promise.reject({
        ...error,
        message: `Network error. Please check your connection. (${error.message || 'Unable to reach server'})`,
        isNetworkError: true,
      });
    }

    // Handle 401 (Unauthorized) - Redirect to login
    if (error.response?.status === 401) {
      console.warn("Unauthorized access - redirecting to login");
      localStorage.removeItem("token");

      // Determine the correct login path based on current URL structure
      const path = window.location.pathname;
      let loginPath = '/'; // Default fallback

      if (path.startsWith("/stayone/admin")) loginPath = "/stayone/admin";
      else if (path.startsWith("/stayoneadmin")) loginPath = "/stayoneadmin";
      else if (path.startsWith("/orchid/admin")) loginPath = "/orchid/admin";
      else if (path.startsWith("/orchidadmin")) loginPath = "/orchidadmin";
      else if (path.startsWith("/inventory/admin")) loginPath = "/inventory/admin";
      else if (path.startsWith("/pommaadmin")) loginPath = "/pommaadmin";

      const isLoginPath = path === loginPath || path === `${loginPath}/`;
      if (!isLoginPath) {
        window.location.href = loginPath;
      }
      return Promise.reject({
        ...error,
        message: "Session expired. Please log in again.",
        isUnauthorized: true,
      });
    }

    // Handle 503 (Service Unavailable) - database connection issues
    if (error.response?.status === 503) {
      console.error("Service unavailable:", error.response?.data);
      return Promise.reject({
        ...error,
        message: "Service temporarily unavailable. Please try again in a moment.",
        isServiceUnavailable: true,
      });
    }

    // Format FastAPI / Pydantic validation errors so components never receive raw object/array in detail
    if (error.response?.data?.detail) {
      const detail = error.response.data.detail;
      if (Array.isArray(detail)) {
        const formatted = detail
          .map((item) => {
            if (typeof item === "string") return item;
            if (item && item.msg) {
              const field = Array.isArray(item.loc) && item.loc.length > 0 ? item.loc[item.loc.length - 1] : "";
              return field && field !== "body" ? `${field}: ${item.msg}` : item.msg;
            }
            return JSON.stringify(item);
          })
          .filter(Boolean)
          .join(", ");
        error.response.data.detail = formatted || "Validation error occurred.";
      } else if (typeof detail === "object" && detail !== null) {
        error.response.data.detail = detail.msg || detail.message || JSON.stringify(detail);
      }
    }

    // For other errors, return as-is
    return Promise.reject(error);
  }
);

export default API;
