import React, { useState, useEffect, useCallback, useMemo } from "react";
import { usePermissions } from "../hooks/usePermissions";
import { formatCurrency } from "../utils/currency";
import { getQuantityStep, normalizeQuantity } from "../utils/quantityValidation";
import DashboardLayout from "../layout/DashboardLayout";
import API from "../services/api";
import { getMediaBaseUrl } from "../utils/env";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import CountUp from "react-countup";
import { Pie } from "react-chartjs-2";
import { useInfiniteScroll } from "./useInfiniteScroll";
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from "chart.js";
import BannerMessage from "../components/BannerMessage";
import { getImageUrl } from "../utils/imageUtils";
import Select from "react-select";
import Packages from "./Package";
import Rooms from "./CreateRooms";
import BookingCalendar from "../components/BookingCalendar";
import { getCurrentDateIST, getCurrentDateTimeIST, formatDateShort, formatDateTimeShort } from "../utils/dateUtils";
import {
  X, Plus, Calendar, User, Phone, Mail,
  Home, Package as PackageIcon, Info, ChevronRight,
  CheckCircle, AlertCircle, Users, LayoutDashboard,
  Clock, MapPin, Receipt, ArrowRight, Save, Trash2, Camera,
  RefreshCw, Grid, Coffee, ClipboardList, Package, ExternalLink,
  Utensils, Settings, ChevronDown, UserCheck, Box, PlusCircle,
  CheckCircle2, XCircle, Zap, LogOut, Star, Eye, MessageSquare, Building2,
  Briefcase, Heart, CreditCard, FileText, Edit, UserX
} from "lucide-react";

ChartJS.register(ArcElement, Tooltip, Legend);

// Reusable components (for better structure)
const KPI_Card = React.memo(({ title, value, unit = "", duration = 1.5, icon: Icon, color = "indigo" }) => {
  const colorMap = {
    indigo: "from-indigo-600 to-violet-600 shadow-indigo-100 ring-indigo-50",
    rose: "from-rose-600 to-pink-600 shadow-rose-100 ring-rose-50",
    emerald: "from-emerald-600 to-teal-600 shadow-emerald-100 ring-emerald-50",
    amber: "from-amber-600 to-orange-600 shadow-amber-100 ring-amber-50"
  };

  const selectedColor = colorMap[color] || colorMap.indigo;

  return (
    <motion.div
      whileHover={{ y: -10, scale: 1.02 }}
      className="bg-white/70 backdrop-blur-xl p-8 rounded-[2.5rem] shadow-2xl shadow-slate-200/50 flex flex-col items-center justify-center transition-all duration-500 cursor-pointer border border-white group relative overflow-hidden h-full"
    >
      <div className="absolute top-0 right-0 w-32 h-32 bg-slate-50 rounded-full blur-3xl -mr-16 -mt-16 group-hover:bg-indigo-50 transition-colors duration-700"></div>

      <div className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${selectedColor} flex items-center justify-center mb-6 shadow-2xl ring-4 group-hover:scale-110 transition-transform duration-500`}>
        {Icon && <Icon className="w-8 h-8 text-white" />}
      </div>

      <span className="text-xs font-semibold text-slate-500 mb-2 px-4 group-hover:text-amber-600 transition-colors">
        {title}
      </span>

      <div className="flex items-baseline gap-1">
        <CountUp
          end={value}
          duration={duration}
          separator=","
          className="text-3xl font-bold text-slate-800 tracking-tight"
        />
        <span className="text-sm font-semibold text-slate-400">{unit}</span>
      </div>

      <div className="mt-6 w-full h-1 bg-slate-100 rounded-full overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: "70%" }}
          transition={{ duration: 2, delay: 0.5 }}
          className={`h-full bg-gradient-to-r ${selectedColor.split(' ').slice(0, 2).join(' ')}`}
        />
      </div>
    </motion.div>
  );
});
KPI_Card.displayName = "KPI_Card";

// Utility moved to utils/imageUtils.js

export const determineBookingStatus = (booking) => {
  if (!booking) return "pending";
  const rawStatus = booking.status || "pending";
  const normalized = rawStatus.toLowerCase().trim().replace(/[-_]/g, "");
  if (normalized === "checkedin") {
    const rooms = booking.rooms || [];
    if (rooms.length > 0) {
      const checkedOutRooms = rooms.filter(room => {
        const r = booking.is_package ? room?.room : room;
        const statusStr = r?.status?.toLowerCase().trim();
        return statusStr === "available";
      });
      if (checkedOutRooms.length === rooms.length) {
        return "checked-out";
      } else if (checkedOutRooms.length > 0) {
        return "partially-checked-out";
      }
    }
  }
  return rawStatus;
};

const BookingStatusBadge = React.memo(({ status, isPackage, packageName, isConfirmed, advanceDeposit }) => {
  const normalizedStatus = status?.toLowerCase().trim().replace(/[-_]/g, "-") || "pending";

  const statusConfig = {
    booked: {
      label: "Confirmed",
      icon: CheckCircle2,
      className: "bg-emerald-50 text-emerald-600 border-emerald-100",
      dot: "bg-emerald-500"
    },
    cancelled: {
      label: "Cancelled",
      icon: XCircle,
      className: "bg-rose-50 text-rose-600 border-rose-100",
      dot: "bg-rose-500"
    },
    "checked-in": {
      label: "Checked In",
      icon: Zap,
      className: "bg-indigo-50 text-indigo-600 border-indigo-100",
      dot: "bg-indigo-500"
    },
    "partially-checked-out": {
      label: "Partially Checked Out",
      icon: LogOut,
      className: "bg-fuchsia-50 text-fuchsia-600 border-fuchsia-100",
      dot: "bg-fuchsia-500"
    },
    "checked-out": {
      label: "Checked Out",
      icon: LogOut,
      className: "bg-slate-50 text-slate-600 border-slate-100",
      dot: "bg-slate-500"
    },
    pending: {
      label: "Enquiry",
      icon: Clock,
      className: "bg-orange-50 text-orange-600 border-orange-200 animate-pulse",
      dot: "bg-orange-500"
    }
  };

  const config = statusConfig[normalizedStatus] || statusConfig.pending;
  const Icon = config.icon;

  return (
    <div className="flex flex-col gap-1.5">
      <div className={`flex items-center gap-3 px-4 py-2 rounded-2xl border shadow-sm transition-all duration-500 hover:shadow-md ${config.className}`}>
        <div className="relative">
          <Icon className="w-3.5 h-3.5" />
          <span className={`absolute -top-1 -right-1 w-2 h-2 rounded-full border-2 border-white ${config.dot} animate-pulse`}></span>
        </div>
        <span className="text-[10px] font-bold uppercase tracking-wide">{config.label}</span>
        {isPackage && (
          <div className="ml-1 pl-3 border-l border-current/20 flex items-center gap-1.5">
            <Star className="w-3 h-3 fill-current" />
            <span className="text-[9px] font-bold">{packageName || "PREMIUM"}</span>
          </div>
        )}
      </div>
      {isConfirmed && (
        <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-100 text-emerald-700 rounded-xl text-[8px] font-bold uppercase tracking-widest border border-emerald-200 shadow-sm w-fit">
          <CreditCard className="w-2.5 h-2.5" />
          Advance: {formatCurrency(advanceDeposit || 0)}
        </div>
      )}
    </div>
  );
});
BookingStatusBadge.displayName = "BookingStatusBadge";

const ImageModal = ({ imageUrl, onClose }) => {
  if (!imageUrl) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 flex justify-center items-center z-[60]">
      <div className="relative max-w-3xl w-full mx-4">
        <button
          onClick={onClose}
          className="absolute -top-8 right-0 text-white text-4xl font-bold hover:text-gray-300"
        >
          &times;
        </button>
        <img
          src={imageUrl}
          alt="Full size view"
          className="w-full h-auto rounded-2xl shadow-lg"
        />
      </div>
    </div>
  );
};
const BookingDetailsModal = ({
  booking,
  onClose,
  onImageClick,
  roomIdToRoom,
  onAddAllocation,
  onConfirm,
  onDownloadReceipt,
  inventoryItems = [],
  inventoryLocations = [],
  authHeader,
}) => {
  if (!booking) return null;

  const roomInfo =
    booking.rooms && booking.rooms.length > 0
      ? booking.rooms
        .map((room) => {
          if (booking.is_package) {
            if (room?.room?.number) return `${room.room.number} (${room.room.type || "Room"})`;
            if (room?.room_id && roomIdToRoom && roomIdToRoom[room.room_id]) {
              const r = roomIdToRoom[room.room_id];
              return `${r.number} (${r.type || "Room"})`;
            }
            return "-";
          } else {
            if (room?.number) return `${room.number} (${room.type || "Room"})`;
            if (room?.room_id && roomIdToRoom && roomIdToRoom[room.room_id]) {
              const r = roomIdToRoom[room.room_id];
              return `${r.number} (${r.type || "Room"})`;
            }
            return "-";
          }
        })
        .filter(Boolean)
        .join(", ") || "-"
      : booking.room_type_name
        ? `${booking.room_type_name}${booking.rate_plan_code ? ` (${booking.rate_plan_code})` : ""}`
        : "-";

  const roomBadges = booking.rooms && booking.rooms.length > 0 ? (
    <div className="flex flex-wrap gap-2 mt-1.5">
      {booking.rooms.map((room, idx) => {
        let r = booking.is_package ? room?.room : room;
        if (!r?.number && room?.room_id && roomIdToRoom && roomIdToRoom[room.room_id]) {
          r = roomIdToRoom[room.room_id];
        }
        const isRoomCheckedOut = r?.status?.toLowerCase().trim() === "available";
        const roomNumber = r?.number || "-";
        const roomType = r?.type || "Room";
        return (
          <span
            key={idx}
            className={`px-3 py-1.5 border rounded-xl text-[10px] font-bold shadow-sm transition-all duration-300 ${
              isRoomCheckedOut
                ? "bg-slate-100 text-slate-400 border-slate-200 line-through opacity-75 hover:opacity-100"
                : "bg-white text-slate-600 border-slate-100 hover:border-indigo-100"
            }`}
            title={isRoomCheckedOut ? `Room ${roomNumber} Checked Out` : `Room ${roomNumber} Active`}
          >
            {roomNumber} <span className="text-[8px] font-normal text-slate-400">({roomType})</span>
          </span>
        );
      })}
    </div>
  ) : booking.room_type_name ? (
    <span className="inline-block px-3 py-1.5 bg-slate-50 border border-slate-100 rounded-xl text-[10px] font-bold text-slate-600">
      {booking.room_type_name}{booking.rate_plan_code ? ` (${booking.rate_plan_code})` : ""}
    </span>
  ) : "-";

  const isCheckedIn =
    booking.status &&
    (booking.status.toLowerCase().replace(/[-_]/g, "") === "checkedin" ||
     determineBookingStatus(booking) === "partially-checked-out");

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-md flex items-center justify-center z-[150] p-4 sm:p-6 overflow-y-auto">
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 20 }}
        className="bg-white/95 backdrop-blur-xl rounded-[2.5rem] shadow-[0_32px_64px_-16px_rgba(0,0,0,0.2)] w-full max-w-2xl overflow-hidden flex flex-col border border-white/20 relative"
      >
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-rose-500 z-50"></div>

        {/* Header - Glassy Terminal Style */}
        <div className="px-8 py-6 flex justify-between items-center border-b border-gray-100/50 bg-white/50 backdrop-blur-sm relative z-10">
          <div className="flex items-center gap-4">
            <div className={`p-3.5 rounded-2xl shadow-lg ring-4 ${booking.is_package ? "bg-gradient-to-br from-violet-600 to-fuchsia-600 shadow-violet-200 ring-violet-50" : "bg-gradient-to-br from-indigo-600 to-violet-600 shadow-indigo-200 ring-indigo-50"}`}>
              {booking.is_package ? <PackageIcon className="w-6 h-6 text-white" /> : <Home className="w-6 h-6 text-white" />}
            </div>
            <div>
              <h2 className="text-xl sm:text-2xl font-bold text-slate-800 tracking-tight leading-none mb-1">Booking Details</h2>
              <div className="flex items-center gap-2">
                <BookingStatusBadge
                  status={determineBookingStatus(booking)}
                  isPackage={booking.is_package}
                  packageName={booking.package?.title}
                  isConfirmed={booking.is_confirmed}
                  advanceDeposit={booking.advance_deposit}
                />
                <span className="text-slate-400 text-[10px] font-bold uppercase tracking-wider leading-none">{booking.display_id || `#${booking.id}`}</span>
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="group p-2.5 bg-slate-50 hover:bg-rose-50 text-slate-400 hover:text-rose-500 rounded-xl transition-all duration-300 border border-slate-100"
          >
            <X className="w-5 h-5 group-hover:rotate-90 transition-transform" />
          </button>
        </div>

        <div className="p-8 space-y-8 overflow-y-auto max-h-[70vh] custom-scrollbar">
          {/* Section: Guest Identity */}
          <section className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="bg-indigo-50 p-2 rounded-xl">
                <User className="w-4 h-4 text-indigo-600" />
              </div>
              <h3 className="font-bold text-slate-800 uppercase tracking-widest text-xs">Primary Occupant</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-slate-50/80 rounded-2xl p-4 border border-slate-100">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Full Legal Name</p>
                <p className="font-bold text-slate-700">{booking.guest_name}</p>
              </div>
              <div className="bg-slate-50/80 rounded-2xl p-4 border border-slate-100">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Contact Terminal</p>
                <p className="font-bold text-slate-700">{booking.guest_mobile || "Unavailable"}</p>
              </div>
              <div className="md:col-span-2 bg-slate-50/80 rounded-2xl p-4 border border-slate-100">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Electronic Signature</p>
                <p className="font-bold text-slate-700">{booking.guest_email || "Unavailable"}</p>
              </div>
            </div>
          </section>

          {/* Section: Reservation Geometry */}
          <section className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="bg-rose-50 p-2 rounded-xl">
                <Calendar className="w-4 h-4 text-rose-600" />
              </div>
              <h3 className="font-bold text-slate-800 uppercase tracking-widest text-xs">Stay Details</h3>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-slate-50/80 rounded-2xl p-4 border border-slate-100">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Arrival Date</p>
                <p className="font-bold text-slate-700">{booking.check_in}</p>
              </div>
              <div className="bg-slate-50/80 rounded-2xl p-4 border border-slate-100">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Departure Date</p>
                <p className="font-bold text-slate-700">{booking.check_out}</p>
              </div>
              <div className="bg-slate-50/80 rounded-2xl p-4 border border-slate-100">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Units (Manifest)</p>
                {roomBadges}
              </div>
              <div className="bg-slate-50/80 rounded-2xl p-4 border border-slate-100">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Quantity (Rooms)</p>
                <p className="font-bold text-indigo-600 leading-tight">{booking.num_rooms || 1} Room(s)</p>
              </div>
              <div className="bg-slate-50/80 rounded-2xl p-4 border border-slate-100">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Group Quota</p>
                <p className="font-bold text-slate-700 leading-tight">{booking.adults} Adults - {booking.children} Children</p>
              </div>
              <div className="md:col-span-2 bg-slate-50/80 rounded-2xl p-4 border border-slate-100">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Booking Channel</p>
                <div className="flex items-center gap-3 flex-wrap">
                  {(booking.source === 'Guest' || booking.source === 'guest') ? (
                    <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-sky-50 border border-sky-200">
                      <span className="w-2 h-2 rounded-full bg-sky-500 animate-pulse"></span>
                      <span className="text-xs font-bold text-sky-700">Guest (Website)</span>
                    </span>
                  ) : booking.source && booking.source !== 'Admin' && booking.source !== 'Direct' && booking.source !== 'direct' && booking.source !== 'admin' ? (
                    <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-violet-50 border border-violet-200">
                      <span className="w-2 h-2 rounded-full bg-violet-500 animate-pulse"></span>
                      <span className="text-xs font-bold text-violet-700">{booking.source}</span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-50 border border-emerald-200">
                      <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                      <span className="text-xs font-bold text-emerald-700">Admin (Dashboard)</span>
                    </span>
                  )}
                  {booking.external_id && (
                    <span className="text-[10px] text-slate-400 font-mono bg-slate-100 px-2 py-1 rounded-lg">OTA Ref: #{booking.external_id}</span>
                  )}
                </div>
              </div>
            </div>
          </section>

          {/* Special Requests & Preferences */}
          {(booking.food_preferences || booking.special_requests) && (
            <motion.section
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-amber-50 rounded-[2rem] p-6 border border-amber-100 space-y-4"
            >
              <div className="flex items-center gap-3">
                <Info className="w-4 h-4 text-amber-600" />
                <h3 className="font-bold text-amber-900 uppercase tracking-widest text-xs">Custom Directives</h3>
              </div>
              <div className="grid grid-cols-1 gap-4">
                {booking.food_preferences && (
                  <div className="bg-white/60 p-4 rounded-2xl border border-amber-200">
                    <p className="text-[10px] font-bold text-amber-600 uppercase tracking-widest mb-1">Culinaries & Taste</p>
                    <p className="text-sm font-bold text-slate-700 leading-relaxed">{booking.food_preferences}</p>
                  </div>
                )}
                {booking.special_requests && (
                  <div className="bg-white/60 p-4 rounded-2xl border border-amber-200">
                    <p className="text-[10px] font-bold text-amber-600 uppercase tracking-widest mb-1">Logistics / Amenity Requests</p>
                    <p className="text-sm font-bold text-slate-700 leading-relaxed">{booking.special_requests}</p>
                  </div>
                )}
              </div>
            </motion.section>
          )}

          {/* Package Inclusions */}
          {booking.is_package && booking.package && (
            <motion.section
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-gradient-to-br from-violet-50 to-fuchsia-50 rounded-[2rem] p-6 border border-violet-100 relative overflow-hidden"
            >
              <div className="absolute -top-12 -right-12 w-32 h-32 bg-violet-500/10 rounded-full blur-2xl"></div>
              <div className="relative z-10 space-y-4">
                <div className="flex items-center gap-3">
                  <PackageIcon className="w-5 h-5 text-violet-600" />
                  <h3 className="font-bold text-violet-900 uppercase tracking-widest text-xs">{booking.package.title} Charter</h3>
                </div>
                <div className="space-y-4">
                  {booking.package.complimentary && (
                    <div className="bg-white/40 p-4 rounded-2xl border border-violet-200/50">
                      <p className="text-[10px] font-bold text-violet-400 uppercase tracking-wider mb-1">Complimentary Assets</p>
                      <p className="text-sm font-bold text-violet-900 leading-relaxed">{booking.package.complimentary}</p>
                    </div>
                  )}
                  {booking.package.food_included && (
                    <div className="bg-white/40 p-4 rounded-2xl border border-violet-200/50">
                      <p className="text-[10px] font-bold text-violet-400 uppercase tracking-wider mb-1">Culinary Integration</p>
                      <p className="text-sm font-bold text-violet-900 leading-relaxed">{booking.package.food_included}</p>
                    </div>
                  )}
                </div>
              </div>
            </motion.section>
          )}

          {/* Internal Details (Manager View) */}
          {booking.user && (
            <div className="bg-slate-50/50 p-4 rounded-2xl border border-slate-100 flex items-center justify-between">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Protocol Executed By</span>
              <span className="font-bold text-slate-600 text-sm flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-slate-300"></div>
                {booking.user.name}
              </span>
            </div>
          )}

          {/* Identification Assets */}
          {(booking.id_card_image_url || booking.guest_photo_url) && (
            <section className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="bg-emerald-50 p-2 rounded-xl">
                  <Camera className="w-4 h-4 text-emerald-600" />
                </div>
                <h3 className="font-bold text-slate-800 uppercase tracking-widest text-xs">Identity Verification</h3>
              </div>
              <div className="grid grid-cols-2 gap-6">
                {booking.id_card_image_url && (
                  <div className="group space-y-2 cursor-pointer"
                    onClick={() => onImageClick(getImageUrl(`/uploads/checkin_proofs/${booking.id_card_image_url}`))}>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center group-hover:text-indigo-600 transition-colors">ID Proof</p>
                    <div className="aspect-[4/3] rounded-2xl overflow-hidden border-2 border-slate-100 group-hover:border-indigo-200 transition-all group-hover:shadow-lg bg-slate-100">
                      <img
                        src={getImageUrl(`/uploads/checkin_proofs/${booking.id_card_image_url}`)}
                        alt="ID Card"
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        onError={(e) => { e.target.src = 'https://placehold.co/400x300/e2e8f0/a0aec0?text=Scan+Unavailable'; }}
                      />
                    </div>
                  </div>
                )}
                {booking.guest_photo_url && (
                  <div className="group space-y-2 cursor-pointer"
                    onClick={() => onImageClick(getImageUrl(`/uploads/checkin_proofs/${booking.guest_photo_url}`))}>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center group-hover:text-indigo-600 transition-colors">Guest Photo</p>
                    <div className="aspect-[4/3] rounded-2xl overflow-hidden border-2 border-slate-100 group-hover:border-indigo-200 transition-all group-hover:shadow-lg bg-slate-100">
                      <img
                        src={getImageUrl(`/uploads/checkin_proofs/${booking.guest_photo_url}`)}
                        alt="Guest Portrait"
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        onError={(e) => { e.target.src = 'https://placehold.co/400x300/e2e8f0/a0aec0?text=Profile+Unavailable'; }}
                      />
                    </div>
                  </div>
                )}
              </div>
            </section>
          )}

          {/* Payment History Protocol */}
          <div className="bg-white/40 backdrop-blur-xl rounded-[2.5rem] border border-slate-100/50 overflow-hidden shadow-2xl shadow-slate-200/20 relative">
            <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full blur-3xl -mr-16 -mt-16"></div>
            
            <div className="px-8 py-6 bg-slate-50/50 border-b border-slate-100 flex items-center justify-between relative z-10">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center border border-emerald-200 shadow-sm">
                  <Receipt className="w-5 h-5 text-emerald-600" />
                </div>
                <div>
                  <h3 className="text-xs font-bold text-slate-800 uppercase tracking-widest leading-none mb-1">Financial Transactions</h3>
                  <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">Full receipt audit trail</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="px-3 py-1 bg-white rounded-full border border-slate-100 text-[9px] font-bold text-emerald-600 uppercase tracking-widest shadow-sm">
                  {booking.payments?.length || 0} Records
                </span>
              </div>
            </div>

            <div className="overflow-x-auto relative z-10">
              <table className="w-full">
                <thead>
                  <tr className="bg-slate-50/20">
                    <th className="px-8 py-4 text-left text-[9px] font-bold text-slate-400 uppercase tracking-widest">Receipt</th>
                    <th className="px-8 py-4 text-left text-[9px] font-bold text-slate-400 uppercase tracking-widest">Temporal Log</th>
                    <th className="px-8 py-4 text-left text-[9px] font-bold text-slate-400 uppercase tracking-widest">Payment Mode</th>
                    <th className="px-8 py-4 text-right text-[9px] font-bold text-slate-400 uppercase tracking-widest">Fiscal Value</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {booking.payments && booking.payments.length > 0 ? (
                    booking.payments.map((p, idx) => {
                      const methodConfig = {
                        cash: { icon: "💵", label: "Hard Cash", color: "text-emerald-600 bg-emerald-50 border-emerald-100" },
                        upi: { icon: "📱", label: "UPI Digital", color: "text-indigo-600 bg-indigo-50 border-indigo-100" },
                        card: { icon: "💳", label: "Card Swiped", color: "text-blue-600 bg-blue-50 border-blue-100" },
                        bank_transfer: { icon: "🏦", label: "Bank Wire", color: "text-amber-600 bg-amber-50 border-amber-100" }
                      };
                      const config = methodConfig[p.method?.toLowerCase()] || { icon: "💰", label: p.method, color: "text-slate-600 bg-slate-50 border-slate-100" };
                      
                      return (
                        <tr key={idx} className="group hover:bg-slate-50/80 transition-all duration-300">
                          <td className="px-8 py-5">
                            <div className="flex flex-col">
                              <span className="text-[10px] font-bold text-slate-800 tracking-tight">RCP-{p.id || 'EXT'}</span>
                              <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">System Ref</span>
                            </div>
                          </td>
                          <td className="px-8 py-5">
                            <div className="flex flex-col">
                              <span className="text-[10px] font-bold text-slate-600">{new Date(p.created_at).toLocaleDateString()}</span>
                              <span className="text-[8px] font-bold text-slate-400">{new Date(p.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                            </div>
                          </td>
                          <td className="px-8 py-5">
                            <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border ${config.color} shadow-sm group-hover:scale-105 transition-transform`}>
                              <span className="text-xs">{config.icon}</span>
                              <span className="text-[9px] font-bold uppercase tracking-wider">{config.label}</span>
                            </div>
                          </td>
                          <td className="px-8 py-5 text-right">
                            <span className="text-sm font-bold text-slate-800 tracking-tight">{formatCurrency(p.amount)}</span>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan="4" className="px-8 py-16 text-center">
                        <div className="flex flex-col items-center gap-3">
                          <div className="w-12 h-12 rounded-2xl bg-slate-50 flex items-center justify-center border border-slate-100">
                            <ClipboardList className="w-6 h-6 text-slate-200" />
                          </div>
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest italic">No financial movements identified</p>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Action Center Footer */}
        <div className="px-8 py-6 bg-slate-50 border-t border-slate-100 flex flex-wrap gap-8 items-center justify-between z-10">
          <div className="flex-1 flex flex-wrap gap-8">
            <div>
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest leading-none mb-1.5">Booking Value</p>
              <p className="text-xl font-bold text-slate-800 tracking-tight">{formatCurrency(booking.total_amount || 0)}</p>
            </div>
            <div>
              <p className="text-[9px] font-bold text-emerald-500 uppercase tracking-widest leading-none mb-1.5">Advance Paid</p>
              <p className="text-xl font-bold text-emerald-600 tracking-tight">{formatCurrency(booking.advance_deposit || 0)}</p>
            </div>
            <div>
              <p className="text-[9px] font-bold text-indigo-500 uppercase tracking-widest leading-none mb-1.5">Balance Due</p>
              <p className="text-xl font-bold text-indigo-600 tracking-tight">{formatCurrency((booking.total_amount || 0) - (booking.advance_deposit || 0))}</p>
            </div>
          </div>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="px-8 py-3.5 bg-white text-slate-600 rounded-2xl font-bold uppercase tracking-wider text-[10px] border border-slate-200 hover:bg-slate-100 transition-all"
            >
              Exit Details
            </button>
            {isCheckedIn && onAddAllocation && (
              <button
                onClick={() => onAddAllocation(booking)}
                className="px-8 py-3.5 bg-gradient-to-r from-indigo-600 to-violet-600 text-white rounded-2xl font-bold uppercase tracking-wider text-[10px] hover:shadow-2xl hover:shadow-indigo-500/20 transition-all flex items-center gap-2 active:scale-95"
              >
                <Plus className="w-4 h-4" />
                Service Task
              </button>
            )}
            {!isCheckedIn && booking.status?.toLowerCase().replace(/[-_]/g, "") === "booked" && !booking.is_confirmed && onConfirm && (
              <button
                onClick={() => onConfirm(booking)}
                className="px-8 py-3.5 bg-gradient-to-r from-emerald-500 to-teal-500 text-white rounded-2xl font-bold uppercase tracking-wider text-[10px] hover:shadow-2xl hover:shadow-emerald-500/20 transition-all flex items-center gap-2 active:scale-95"
              >
                <CheckCircle2 className="w-4 h-4" />
                Confirm & Record Advance
              </button>
            )}
            {(booking.is_confirmed || booking.advance_deposit > 0) && (
              <button
                onClick={() => onDownloadReceipt(booking.id, booking.is_package)}
                className="px-8 py-3.5 bg-emerald-50 text-emerald-600 border border-emerald-200 rounded-2xl font-bold uppercase tracking-wider text-[10px] hover:bg-emerald-600 hover:text-white transition-all flex items-center gap-2 active:scale-95"
              >
                <FileText className="w-4 h-4" />
                Print Receipt
              </button>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
};

// Add Extra Allocation Modal
const AddExtraAllocationModal = ({
  booking,
  onClose,
  inventoryItems = [],
  inventoryLocations = [],
  onSuccess,
  authHeader,
  showBannerMessage,
}) => {
  const [allocationItems, setAllocationItems] = useState([
    {
      item_id: "",
      quantity: 1,
      is_payable: false,
      manual_override: false, // When true, use complimentary_qty and payable_qty
      complimentary_qty: 0,
      payable_qty: 0,
      notes: "",
    },
  ]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentRoomItems, setCurrentRoomItems] = useState([]);
  const [loadingCurrentItems, setLoadingCurrentItems] = useState(false);
  const [activeTab, setActiveTab] = useState("current"); // "current" or "add"
  const [selectedRoomIndex, setSelectedRoomIndex] = useState(0); // Track which room is being managed
  const [paidStatusMap, setPaidStatusMap] = useState({}); // Track paid status by item_id
  const [sourceLocationItems, setSourceLocationItems] = useState({});
  const [loadingSourceStock, setLoadingSourceStock] = useState(false);
  // State for Stock Counts in Row Dropdowns (Map<ItemId, Map<LocationId, Qty>>)
  const [itemStockCache, setItemStockCache] = useState({});

  // Helper to fetch stock for a specific item and cache it
  const ensureItemStock = async (itemId) => {
    if (!itemId) return;

    // Only skip if we have actual stock data cached (not just an empty object)
    if (itemStockCache[itemId] && Object.keys(itemStockCache[itemId]).length > 0) return;

    try {
      const res = await API.get(`/inventory/items/${itemId}/stocks`, authHeader());
      const stockMap = {};
      if (res.data) {
        res.data.forEach(s => {
          stockMap[s.location_id] = s.quantity;
        });
      }
      setItemStockCache(prev => ({ ...prev, [itemId]: stockMap }));
    } catch (error) {
      console.error(`Error fetching stock for item ${itemId}:`, error);
      // Set empty object to prevent repeated failed requests
      setItemStockCache(prev => ({ ...prev, [itemId]: {} }));
    }
  };





  // Stock View Modal State
  const [showStockModal, setShowStockModal] = useState(false);
  const [stockModalItem, setStockModalItem] = useState(null);
  const [itemStocks, setItemStocks] = useState([]);
  const [loadingItemStocks, setLoadingItemStocks] = useState(false);

  const fetchItemStocks = async (item) => {
    setStockModalItem(item);
    setShowStockModal(true);
    setLoadingItemStocks(true);
    try {
      const res = await API.get(`/inventory/items/${item.id}/stocks`, authHeader());
      setItemStocks(res.data);
    } catch (error) {
      console.error("Error fetching item stocks:", error);
      setItemStocks([]);
    } finally {
      setLoadingItemStocks(false);
    }
  };

  // Initialize default source location logic refactored
  // We want to set a default source for new rows, but not global state
  const getDefaultSourceLocationId = () => {
    if (inventoryLocations.length > 0) {
      const mainWarehouse = inventoryLocations.find((loc) => {
        const type = String(loc.location_type || "").toUpperCase();
        return (
          (loc.is_inventory_point === true &&
            (type === "CENTRAL_WAREHOUSE" ||
              type === "WAREHOUSE" ||
              type === "BRANCH_STORE")) ||
          type === "CENTRAL_WAREHOUSE" ||
          type === "WAREHOUSE" ||
          type === "BRANCH_STORE"
        );
      });
      return mainWarehouse ? mainWarehouse.id : inventoryLocations[0].id;
    }
    return "";
  };


  // Global source stock fetch removed - stocks are now row-specific

  // Generate unique booking ID for notes
  const generateBookingId = (booking) => {
    // Use display_id from API response if available (backend will provide BK-000001 or PK-000001)
    if (booking.display_id) {
      return booking.display_id;
    }
    // Fallback: generate it client-side if not provided
    const prefix = booking.is_package ? "PK" : "BK";
    const paddedId = String(booking.id).padStart(6, "0");
    return `${prefix}-${paddedId}`;
  };

  // Debug logging
  React.useEffect(() => {
    console.log("[AddExtraAllocationModal] Props received:");
    console.log("- booking:", booking);
    console.log("- inventoryItems:", inventoryItems?.length || 0, "items");
    console.log("- inventoryLocations:", inventoryLocations?.length || 0, "locations");
    console.log("- authHeader:", typeof authHeader);
  }, [booking, inventoryItems, inventoryLocations, authHeader]);

  if (!booking) return null;

  // Fetch current room items
  useEffect(() => {
    const fetchCurrentItems = async () => {
      // Get selected room from booking
      const roomForFetch = (booking.rooms && booking.rooms[selectedRoomIndex]) || null;
      const roomNumber =
        roomForFetch?.number || roomForFetch?.room?.number || null;

      console.log("=== Fetching Current Room Items ===");
      console.log("Booking:", booking);
      console.log("Booking ID:", booking?.id);
      console.log("Booking rooms:", booking.rooms);
      console.log("Room for fetch:", roomForFetch);
      console.log("Room number extracted:", roomNumber);
      console.log("Total locations available:", inventoryLocations.length);
      console.log(
        "GUEST_ROOM locations:",
        inventoryLocations
          .filter(
            (loc) =>
              String(loc.location_type || "").toUpperCase() === "GUEST_ROOM",
          )
          .map((loc) => ({
            id: loc.id,
            name: loc.name,
            room_area: loc.room_area,
            location_type: loc.location_type,
          })),
      );

      if (!roomNumber) {
        console.warn("No room number found for selected room index", selectedRoomIndex);
        setCurrentRoomItems([]);
        return;
      }

      let destinationLocation = null;
      if (roomNumber) {
        const searchStr = String(roomNumber).toLowerCase().replace(/^0+/, "") || "0";
        const searchStrPadded = String(roomNumber).toLowerCase();

        destinationLocation = inventoryLocations.find((loc) => {
          if (String(loc.location_type || "").toUpperCase() !== "GUEST_ROOM") return false;

          const area = String(loc.room_area || "").toLowerCase();
          const name = String(loc.name || "").toLowerCase();
          const areaNoZeros = area.replace(/^0+/, "") || area;
          const nameNoZeros = name.replace(/^0+/, "") || name;

          // 1. Exact match (with or without leading zeros)
          if (area === searchStrPadded || areaNoZeros === searchStr) return true;
          if (name === searchStrPadded || nameNoZeros === searchStr) return true;

          // 2. Specific pattern matches (Room 1, Room 001, etc.)
          const patterns = [
            `room ${searchStr}`,
            `room-${searchStr}`,
            `room_${searchStr}`,
            `room${searchStr}`,
            `room ${searchStrPadded}`,
            `room-${searchStrPadded}`,
            `room_${searchStrPadded}`,
            `room${searchStrPadded}`,
          ];
          if (patterns.some((p) => area === p || name === p)) return true;

          return false;
        });
      }

      console.log("Found destination location:", destinationLocation);

      if (!destinationLocation) {
        console.warn(
          `Room location not found for room ${roomNumber}. Available GUEST_ROOM locations:`,
          inventoryLocations
            .filter(
              (loc) =>
                String(loc.location_type || "").toUpperCase() === "GUEST_ROOM",
            )
            .map((loc) => ({
              id: loc.id,
              name: loc.name,
              room_area: loc.room_area,
              location_type: loc.location_type,
            })),
        );
        setCurrentRoomItems([]);
        return;
      }

      setLoadingCurrentItems(true);
      try {
        console.log(
          `Fetching items for location ${destinationLocation.id} (${destinationLocation.name || destinationLocation.room_area})`,
        );
        const bookingParam = booking.id ? `&booking_id=${booking.id}` : "";
        const res = await API.get(
          `/inventory/locations/${destinationLocation.id}/items?limit=1000${bookingParam}`,
          authHeader(),
        );
        console.log("Location items response:", res.data);
        setCurrentRoomItems(res.data?.items || []);
      } catch (error) {
        console.error("Error fetching current room items:", error);
        console.error("Error details:", error.response?.data);
        setCurrentRoomItems([]);
      } finally {
        setLoadingCurrentItems(false);
      }
    };

    // Only fetch if booking has been saved (has an ID) and has rooms assigned
    // This prevents showing inventory from previous bookings when creating a new booking
    if (booking && booking.id && booking.rooms && booking.rooms.length > 0 && inventoryLocations && inventoryLocations.length > 0) {
      fetchCurrentItems();
    } else {
      if (!booking?.id) {
        console.log("Skipping inventory fetch - booking not saved yet (no ID)");
      } else if (!booking?.rooms || booking.rooms.length === 0) {
        console.log("Skipping inventory fetch - booking has no rooms assigned yet");
      }
      setCurrentRoomItems([]);
    }
  }, [booking, inventoryLocations, selectedRoomIndex]);

  const addAllocationRow = () => {
    setAllocationItems([
      ...allocationItems,
      {
        item_id: "",
        quantity: 1,
        is_payable: false,
        manual_override: false,
        notes: "",
        source_location_id: getDefaultSourceLocationId(),
      },
    ]);
  };

  const removeAllocationRow = (index) => {
    if (allocationItems.length > 1) {
      setAllocationItems(allocationItems.filter((_, i) => i !== index));
    }
  };

  const updateAllocationItem = (index, field, value) => {
    const updated = [...allocationItems];
    updated[index] = { ...updated[index], [field]: value };

    // If item changed, fetch its stocks
    if (field === "item_id" && value) {
      ensureItemStock(value);
    }

    setAllocationItems(updated);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Filter out empty items and validate
    const validItems = allocationItems.filter(
      (item) => item.item_id && item.quantity > 0,
    );

    if (validItems.length === 0) {
      showBannerMessage("error", "Please add at least one item with a valid quantity");
      return;
    }

    setIsSubmitting(true);
    try {
      // Find main warehouse
      const mainWarehouse = inventoryLocations.find((loc) => {
        const type = String(loc.location_type || "").toUpperCase();
        return (
          (loc.is_inventory_point === true &&
            (type === "CENTRAL_WAREHOUSE" ||
              type === "WAREHOUSE" ||
              type === "BRANCH_STORE")) ||
          type === "CENTRAL_WAREHOUSE" ||
          type === "WAREHOUSE" ||
          type === "BRANCH_STORE"
        );
      });

      if (!mainWarehouse) {
        showBannerMessage(
          "error",
          "Main warehouse not found. Please create a main warehouse location first.",
        );
        setIsSubmitting(false);
        return;
      }

      // Get selected room from booking
      const selectedRoom = (booking.rooms && booking.rooms[selectedRoomIndex]) || null;
      const roomNumber = selectedRoom?.number || selectedRoom?.room?.number || null;

      let destinationLocation = null;
      if (roomNumber) {
        const searchStr = String(roomNumber).toLowerCase().replace(/^0+/, "") || "0";
        const searchStrPadded = String(roomNumber).toLowerCase();

        destinationLocation = inventoryLocations.find((loc) => {
          if (String(loc.location_type || "").toUpperCase() !== "GUEST_ROOM") return false;

          const area = String(loc.room_area || "").toLowerCase();
          const name = String(loc.name || "").toLowerCase();
          const areaNoZeros = area.replace(/^0+/, "") || area;
          const nameNoZeros = name.replace(/^0+/, "") || name;

          if (area === searchStrPadded || areaNoZeros === searchStr) return true;
          if (name === searchStrPadded || nameNoZeros === searchStr) return true;

          const patterns = [`room ${searchStr}`, `room-${searchStr}`, `room${searchStr}`, `room ${searchStrPadded}`];
          return patterns.some(p => area === p || name === p);
        });
      }

      if (!destinationLocation) {
        showBannerMessage(
          "error",
          `Room location not found for room ${roomNumber}. Please ensure the room is synced as a location.`,
        );
        setIsSubmitting(false);
        return;
      }

      // GROUP ITEMS BY SOURCE LOCATION
      const itemsBySource = {};

      validItems.forEach(item => {
        const sourceId = item.source_location_id || mainWarehouse.id;
        if (!itemsBySource[sourceId]) {
          itemsBySource[sourceId] = [];
        }
        itemsBySource[sourceId].push(item);
      });

      const sourceIds = Object.keys(itemsBySource);
      let successCount = 0;

      for (const sourceId of sourceIds) {
        const items = itemsBySource[sourceId];

        const issueDetails = items.map((item) => {
          if (item.manual_override && !item.notes) {
            showBannerMessage("error", "Please provide notes for manual override.");
            return null;
          }
          const selectedInvItem = inventoryItems.find(i => i.id === parseInt(item.item_id));
          const unit = selectedInvItem?.unit || "pcs";

          return {
            item_id: item.item_id,
            issued_quantity: parseFloat(item.quantity),
            unit: unit,
            is_payable: item.is_payable === true,
            notes: item.notes || "",
            // Extra fields for notes generation only, not sent to API if API ignores extra fields, 
            // BUT strict Pydantic might fail if extra fields are present and forbid_extra=True.
            // Better to keep payload clean.
          };
        });

        const totalPayableQty = issueDetails.reduce(
          (sum, d) => sum + (d.is_payable ? d.issued_quantity : 0),
          0,
        );
        const totalComplimentaryQty = issueDetails.reduce(
          (sum, d) => sum + (!d.is_payable ? d.issued_quantity : 0),
          0,
        );

        const issueData = {
          requisition_id: null,
          source_location_id: sourceId,
          destination_location_id: destinationLocation.id,
          issue_date: getCurrentDateTimeIST(),
          notes: `Extra allocation for booking ${generateBookingId(booking)} (${totalPayableQty} payable, ${totalComplimentaryQty} comp) - Source: ${sourceId}`,
          details: issueDetails,
          booking_id: booking.id,
          guest_id: booking.user_id
        };

        await API.post("/inventory/issues", issueData, authHeader());
        successCount += items.length;
      }

      showBannerMessage("success", `Successfully added ${successCount} item(s) to room from ${sourceIds.length} source(s)!`);
      setAllocationItems([
        {
          item_id: "",
          quantity: 1,
          is_payable: false,
          manual_override: false,
          notes: "",
          source_location_id: getDefaultSourceLocationId(),
        },
      ]);

      // Refresh current items and switch to current items tab
      // Reuse existing destinationLocation from above
      if (destinationLocation) {
        try {
          const bookingParamForRefresh = booking.id ? `?booking_id=${booking.id}` : "";
          const res = await API.get(
            `/inventory/locations/${destinationLocation.id}/items${bookingParamForRefresh}`,
            authHeader(),
          );
          setCurrentRoomItems(res.data?.items || []);
        } catch (error) {
          console.error("Error refreshing items:", error);
        } finally {
          setActiveTab("current"); // Switch to current items tab to show the new items
        }
      } else {
        setActiveTab("current");
      }

      if (onSuccess) {
        onSuccess();
      }
      // Don't close modal, just switch tabs
    } catch (error) {
      console.error("Error adding extra allocation:", error);
      showBannerMessage(
        "error",
        "Failed to add allocation: " +
        (error.response?.data?.detail || error.message),
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const updateItemPayableStatus = async (item, isPayable) => {
    if (!item.issue_detail_id || !item.issue_id) {
      showBannerMessage("error", "Cannot update: Issue detail information missing");
      return;
    }

    try {
      await API.patch(
        `/inventory/issues/${item.issue_id}/details/${item.issue_detail_id}`,
        { is_payable: isPayable },
        authHeader(),
      );

      // Refresh current items
      const roomForRefreshPayable = (booking.rooms && booking.rooms[selectedRoomIndex]) || null;
      const roomNumForRefreshPayable =
        roomForRefreshPayable?.number ||
        roomForRefreshPayable?.room?.number ||
        null;
      if (roomNumForRefreshPayable) {
        const searchStr = String(roomNumForRefreshPayable).toLowerCase().replace(/^0+/, "") || "0";
        const searchStrPadded = String(roomNumForRefreshPayable).toLowerCase();

        const destLocForRefreshPayable = inventoryLocations.find((loc) => {
          if (String(loc.location_type || "").toUpperCase() !== "GUEST_ROOM") return false;

          const area = String(loc.room_area || "").toLowerCase();
          const name = String(loc.name || "").toLowerCase();
          const areaNoZeros = area.replace(/^0+/, "") || area;
          const nameNoZeros = name.replace(/^0+/, "") || name;

          if (area === searchStrPadded || areaNoZeros === searchStr) return true;
          if (name === searchStrPadded || nameNoZeros === searchStr) return true;

          const patterns = [`room ${searchStr}`, `room-${searchStr}`, `room${searchStr}`, `room ${searchStrPadded}`];
          return patterns.some(p => area === p || name === p);
        });
        if (destLocForRefreshPayable) {
          const bookingParamForPayable = booking.id ? `?booking_id=${booking.id}` : "";
          const res = await API.get(
            `/inventory/locations/${destLocForRefreshPayable.id}/items${bookingParamForPayable}`,
            authHeader(),
          );
          setCurrentRoomItems(res.data?.items || []);
        }
      }
    } catch (error) {
      console.error("Error updating payable status:", error);
      showBannerMessage(
        "error",
        "Failed to update payable status: " +
        (error.response?.data?.detail || error.message),
      );
    }
  };

  const updateItemPaidStatus = async (item, isPaid) => {
    if (!item.issue_detail_id || !item.issue_id) {
      showBannerMessage("error", "Cannot update: Issue detail information missing");
      return;
    }

    try {
      await API.patch(
        `/inventory/issues/${item.issue_id}/details/${item.issue_detail_id}`,
        { is_paid: isPaid },
        authHeader(),
      );

      // Update local state immediately for better UX
      setPaidStatusMap({ ...paidStatusMap, [item.item_id]: isPaid });

      // Refresh current items
      const roomForRefreshPaid = (booking.rooms && booking.rooms[selectedRoomIndex]) || null;
      const roomNumForRefreshPaid =
        roomForRefreshPaid?.number || roomForRefreshPaid?.room?.number || null;
      if (roomNumForRefreshPaid) {
        const searchStr = String(roomNumForRefreshPaid).toLowerCase().replace(/^0+/, "") || "0";
        const searchStrPadded = String(roomNumForRefreshPaid).toLowerCase();

        const destLocForRefreshPaid = inventoryLocations.find((loc) => {
          if (String(loc.location_type || "").toUpperCase() !== "GUEST_ROOM") return false;

          const area = String(loc.room_area || "").toLowerCase();
          const name = String(loc.name || "").toLowerCase();
          const areaNoZeros = area.replace(/^0+/, "") || area;
          const nameNoZeros = name.replace(/^0+/, "") || name;

          if (area === searchStrPadded || areaNoZeros === searchStr) return true;
          if (name === searchStrPadded || nameNoZeros === searchStr) return true;

          const patterns = [`room ${searchStr}`, `room-${searchStr}`, `room${searchStr}`, `room ${searchStrPadded}`];
          return patterns.some(p => area === p || name === p);
        });
        if (destLocForRefreshPaid) {
          const bookingParamForPaid = booking.id ? `?booking_id=${booking.id}` : "";
          const res = await API.get(
            `/inventory/locations/${destLocForRefreshPaid.id}/items${bookingParamForPaid}`,
            authHeader(),
          );
          setCurrentRoomItems(res.data?.items || []);
        }
      }
    } catch (error) {
      console.error("Error updating paid status:", error);
      showBannerMessage(
        "error",
        "Failed to update paid status: " +
        (error.response?.data?.detail || error.message),
      );
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-md flex items-center justify-center z-[150] p-4 sm:p-6 overflow-y-auto">
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 20 }}
        className="bg-white/95 backdrop-blur-xl rounded-[2.5rem] shadow-[0_32px_64px_-16px_rgba(0,0,0,0.2)] w-full max-w-6xl overflow-hidden flex flex-col border border-white/20 relative"
      >
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-500 via-violet-500 to-rose-500 z-50"></div>

        {/* Header */}
        <div className="px-8 py-6 flex justify-between items-center border-b border-gray-100/50 bg-white/50 backdrop-blur-sm relative z-10">
          <div className="flex items-center gap-4 text-left">
            <div className="bg-gradient-to-br from-indigo-600 to-violet-600 p-3.5 rounded-2xl shadow-lg shadow-indigo-100 ring-4 ring-indigo-50">
              <Package className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-xl sm:text-2xl font-bold text-slate-800 tracking-tight leading-none mb-1">Inventory Management</h2>
              <div className="flex items-center gap-2">
                <span className="text-slate-400 text-[10px] font-bold uppercase tracking-wider leading-none">Booking ID: {booking.display_id || `#${booking.id}`}</span>
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="group p-2.5 bg-slate-50 hover:bg-rose-50 text-slate-400 hover:text-rose-500 rounded-xl transition-all duration-300 border border-slate-100"
          >
            <X className="w-5 h-5 group-hover:rotate-90 transition-transform" />
          </button>
        </div>
        {/* Room Selection Tabs (only if multi-room) */}
        {booking.rooms && booking.rooms.length > 1 && (
          <div className="px-8 py-4 bg-indigo-50/20 border-b border-indigo-100 flex items-center gap-3 overflow-x-auto relative z-10">
            <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest whitespace-nowrap">Select Room:</span>
            {booking.rooms.map((room, idx) => (
              <button
                key={idx}
                onClick={() => setSelectedRoomIndex(idx)}
                className={`px-5 py-2.5 rounded-2xl text-[10px] uppercase tracking-wider font-bold transition-all shadow-sm whitespace-nowrap ${selectedRoomIndex === idx
                    ? "bg-indigo-600 text-white shadow-indigo-200 border border-indigo-700"
                    : "bg-white text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 border border-slate-200"
                  }`}
              >
                Room {room.number || room.room?.number || `Room ${idx + 1}`}
              </button>
            ))}
          </div>
        )}


        {/* Tabs Navigation */}
        <div className="px-8 pt-4 bg-slate-50/30 border-b border-slate-100 flex items-center gap-1 overflow-x-auto no-scrollbar relative z-10">
          {[
            { id: 'current', label: 'Room Inventory', icon: LayoutDashboard, badge: currentRoomItems.length },
            { id: 'food', label: 'Food & Dining', icon: Coffee },
            { id: 'services', label: 'Service Tasks', icon: ClipboardList },
            { id: 'add', label: 'Add Items', icon: PlusCircle }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-3 px-8 py-4 rounded-t-3xl font-bold uppercase tracking-wide text-[10px] transition-all relative ${activeTab === tab.id
                ? "bg-white text-indigo-600 shadow-[0_-8px_24px_-8px_rgba(0,0,0,0.1)] border-t border-x border-slate-100"
                : "text-slate-400 hover:text-slate-600 hover:bg-slate-100/50"
                }`}
            >
              <tab.icon className={`w-4 h-4 ${activeTab === tab.id ? "text-indigo-600" : "text-slate-300"}`} />
              <span>{tab.label}</span>
              {tab.badge !== undefined && (
                <span className={`px-2 py-0.5 rounded-full text-[9px] ${activeTab === tab.id ? 'bg-indigo-600 text-white' : 'bg-slate-200 text-slate-500'}`}>
                  {tab.badge}
                </span>
              )}
              {activeTab === tab.id && (
                <motion.div
                  layoutId="activeTabAllocation"
                  className="absolute bottom-[-1px] left-0 right-0 h-[3px] bg-indigo-600 rounded-full z-20"
                />
              )}
            </button>
          ))}
        </div>

        <div className="p-8 space-y-8 overflow-y-auto max-h-[70vh] custom-scrollbar relative z-10 text-left">

          {/* Inventory List Tab */}
          {activeTab === "current" && (
            <div className="space-y-12">
              <div className="flex justify-between items-center bg-slate-50/50 p-4 rounded-3xl border border-slate-100">
                <div className="flex items-center gap-3">
                  <div className="bg-indigo-100 p-2.5 rounded-2xl">
                    <Grid className="w-5 h-5 text-indigo-600" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-800 uppercase tracking-widest text-xs leading-none">Inventory List</h3>
                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-tight mt-1">Live inventory audit for this sector</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={async () => {
                    const roomForFetch = (booking.rooms && booking.rooms[selectedRoomIndex]) || null;
                    const roomNumber = roomForFetch?.number || roomForFetch?.room?.number || null;
                    if (!roomNumber) { showBannerMessage("error", "Room ID mapping failed"); return; }
                    const searchStr = String(roomNumber).toLowerCase().replace(/^0+/, "") || "0";
                    const searchStrPadded = String(roomNumber).toLowerCase();

                    const destinationLocation = inventoryLocations.find((loc) => {
                      if (String(loc.location_type || "").toUpperCase() !== "GUEST_ROOM") return false;
                      const area = String(loc.room_area || "").toLowerCase();
                      const name = String(loc.name || "").toLowerCase();
                      const areaNoZeros = area.replace(/^0+/, "") || area;
                      const nameNoZeros = name.replace(/^0+/, "") || name;

                      if (area === searchStrPadded || areaNoZeros === searchStr) return true;
                      if (name === searchStrPadded || nameNoZeros === searchStr) return true;

                      const patterns = [`room ${searchStr}`, `room-${searchStr}`, `room${searchStr}`, `room ${searchStrPadded}`];
                      return patterns.some(p => area === p || name === p);
                    });
                    if (!destinationLocation) { showBannerMessage("error", `Sector ${roomNumber} not found in logic core`); return; }
                    setLoadingCurrentItems(true);
                    try {
                      const bookingParamForSync = booking.id ? `&booking_id=${booking.id}` : "";
                      const res = await API.get(`/inventory/locations/${destinationLocation.id}/items?limit=1000${bookingParamForSync}`, authHeader());
                      setCurrentRoomItems(res.data?.items || []);
                    } catch (error) {
                      console.error("Link failure:", error);
                      showBannerMessage("error", "System sync failed");
                    } finally { setLoadingCurrentItems(false); }
                  }}
                  disabled={loadingCurrentItems}
                  className="px-5 py-2.5 bg-white text-indigo-600 rounded-xl font-bold uppercase tracking-wider text-[10px] hover:shadow-lg hover:shadow-indigo-100 transition-all flex items-center gap-2 border border-indigo-100"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loadingCurrentItems ? "animate-spin" : ""}`} />
                  {loadingCurrentItems ? "Syncing..." : "Force Sync"}
                </button>
              </div>

              {/* Tabs */}
              <div className="flex border-b border-slate-100">
                <button
                  onClick={() => setActiveTab("current")}
                  className={`flex-1 py-4 text-[10px] font-bold uppercase tracking-[0.2em] transition-all relative ${activeTab === "current"
                      ? "text-indigo-600"
                      : "text-slate-400 hover:text-slate-600 bg-slate-50/50"
                    }`}
                >
                  Current Items
                  {activeTab === "current" && (
                    <motion.div
                      layoutId="activeTab"
                      className="absolute bottom-0 left-0 right-0 h-1 bg-indigo-500"
                    />
                  )}
                </button>
                <button
                  onClick={() => setActiveTab("add")}
                  className={`flex-1 py-4 text-[10px] font-bold uppercase tracking-[0.2em] transition-all relative ${activeTab === "add"
                      ? "text-indigo-600"
                      : "text-slate-400 hover:text-slate-600 bg-slate-50/50"
                    }`}
                >
                  Add Items
                  {activeTab === "add" && (
                    <motion.div
                      layoutId="activeTab"
                      className="absolute bottom-0 left-0 right-0 h-1 bg-indigo-500"
                    />
                  )}
                </button>
              </div>

              {loadingCurrentItems ? (
                <div className="py-32 flex flex-col items-center gap-5">
                  <div className="relative">
                    <div className="w-20 h-20 border-[6px] border-slate-50 rounded-full"></div>
                    <div className="absolute inset-0 w-20 h-20 border-[6px] border-indigo-500 rounded-full border-t-transparent animate-spin"></div>
                    <Box className="absolute inset-0 m-auto w-8 h-8 text-indigo-500" />
                  </div>
                  <div className="text-center">
                    <p className="text-xs font-bold text-slate-600 uppercase tracking-normal">System Syncing...</p>
                    <p className="text-[9px] font-bold text-slate-400 uppercase mt-2 tracking-widest">Fetching records...</p>
                  </div>
                </div>
              ) : (
                <div className="space-y-16">
                  {/* Consumables Section */}
                  <div className="space-y-6">
                    <div className="space-y-6">
                      <div className="flex items-center gap-2 px-1">
                        <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">General Items</h4>
                        <div className="h-px flex-1 bg-gradient-to-r from-slate-100 to-transparent"></div>
                      </div>
                      <div className="bg-white rounded-[2.5rem] border border-slate-100 overflow-hidden shadow-sm shadow-indigo-100/20">
                        <table className="w-full text-left border-collapse">
                          <thead>
                            <tr className="bg-slate-50/50">
                              <th className="px-8 py-5 text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Item Details</th>
                              <th className="px-8 py-5 text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Quantity</th>
                              <th className="px-8 py-5 text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Total</th>
                              <th className="px-8 py-5 text-[10px] font-semibold text-slate-500 uppercase tracking-wider text-center">Status</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {currentRoomItems.filter(i => i.type !== 'asset').length === 0 ? (
                              <tr><td colSpan="4" className="px-8 py-12 text-center text-[10px] font-bold text-slate-300 uppercase italic">No general items detected in sector</td></tr>
                            ) : (
                              currentRoomItems.filter(i => i.type !== 'asset').map((item, index) => {
                                const paidStatus = item.is_paid || paidStatusMap[item.item_id] || false;
                                const payableQty = parseFloat(item.payable_qty ?? (Math.max(0, (item.location_stock || 0) - (item.complimentary_qty || 0))));
                                return (
                                  <tr key={index} className="hover:bg-indigo-50/10 transition-colors group">
                                    <td className="px-8 py-6">
                                      <div className="font-bold text-slate-700 text-sm group-hover:text-indigo-600 transition-colors">{item.item_name}</div>
                                      <div className="text-[9px] font-bold text-slate-400 uppercase tracking-tight mt-1">Ref: {item.item_id}</div>
                                    </td>
                                    <td className="px-8 py-6">
                                      <div className="flex items-center gap-3">
                                        <span className="font-bold text-slate-600 text-sm tabular-nums">{item.location_stock} <span className="text-[10px] text-slate-400 uppercase">{item.unit}</span></span>
                                        <div className="flex items-center gap-1.5 grayscale group-hover:grayscale-0 transition-all opacity-60 group-hover:opacity-100">
                                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                                          <span className="text-[9px] font-bold text-emerald-600 uppercase">{item.complimentary_qty} Comp</span>
                                        </div>
                                      </div>
                                    </td>
                                    <td className="px-8 py-6">
                                      <div className="font-bold text-slate-800 text-sm tabular-nums">{formatCurrency((item.selling_price || item.unit_price || 0) * payableQty)}</div>
                                      <div className="text-[9px] font-bold text-slate-400 uppercase tracking-wide mt-1">Price: {formatCurrency(item.selling_price || item.unit_price || 0)}</div>
                                    </td>
                                    <td className="px-8 py-6">
                                      {payableQty > 0 ? (
                                        <div className="flex justify-center">
                                          <button
                                            onClick={() => {
                                              setPaidStatusMap({ ...paidStatusMap, [item.item_id]: !paidStatus });
                                              // updateItemPaidStatus(item, !paidStatus); // This function might need to be defined or imported if used
                                            }}
                                            className={`px-5 py-2.5 rounded-2xl text-[9px] font-bold uppercase tracking-wider transition-all border shadow-sm ${paidStatus ? "bg-emerald-50 text-emerald-600 border-emerald-100" : "bg-rose-50 text-rose-600 border-rose-100 shadow-rose-50"
                                              }`}
                                          >
                                            {paidStatus ? "Verified/Paid" : "Action Required"}
                                          </button>
                                        </div>
                                      ) : (
                                        <div className="text-center text-[9px] font-bold text-slate-300 uppercase tracking-widest italic">Standard Issuance</div>
                                      )}
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

                  {/* Fixed Assets Section */}
                  <div className="space-y-6">
                    <div className="flex items-center gap-2 px-1">
                      <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Fixed Assets</h4>
                      <div className="h-px flex-1 bg-gradient-to-r from-slate-100 to-transparent"></div>
                    </div>
                    <div className="bg-white rounded-[2.5rem] border border-slate-100 overflow-hidden shadow-sm shadow-slate-100/50">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-slate-50/50">
                            <th className="px-8 py-5 text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Asset Info</th>
                            <th className="px-8 py-5 text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Asset ID</th>
                            <th className="px-8 py-5 text-[10px] font-semibold text-slate-500 uppercase tracking-wider text-center">Condition</th>
                            <th className="px-8 py-5 text-[10px] font-semibold text-slate-500 uppercase tracking-wider text-right">Verification</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {currentRoomItems.filter(i => i.type === 'asset' && !(i.rental_price > 0 || i.is_rentable)).length === 0 ? (
                            <tr><td colSpan="4" className="px-8 py-12 text-center text-[10px] font-bold text-slate-300 uppercase italic">Sector infrastructure scanning negative</td></tr>
                          ) : (
                            currentRoomItems.filter(i => i.type === 'asset' && !(i.rental_price > 0 || i.is_rentable)).map((item, index) => {
                              const actualIndex = currentRoomItems.indexOf(item);
                              return (
                                <tr key={index} className="hover:bg-slate-50/50 transition-colors group">
                                  <td className="px-8 py-6">
                                    <div className="font-bold text-slate-700 text-sm group-hover:text-indigo-600 transition-colors">{item.item_name}</div>
                                    <div className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1">Origin: {item.source || 'Logic Core'}</div>
                                  </td>
                                  <td className="px-8 py-6">
                                    <code className="text-[10px] font-bold text-indigo-500 bg-indigo-50 px-3 py-1.5 rounded-xl border border-indigo-100 shadow-sm">{item.serial_number || item.asset_tag || 'UNIDENTIFIED'}</code>
                                  </td>
                                  <td className="px-8 py-6">
                                    <div className="flex items-center justify-center gap-5">
                                      <div className="flex flex-col items-center gap-1.5">
                                        <button onClick={() => { const up = [...currentRoomItems]; up[actualIndex].is_present = !item.is_present; setCurrentRoomItems(up); }} className={`p-2.5 rounded-2xl transition-all shadow-sm ${item.is_present !== false ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-slate-100 text-slate-300 border border-slate-200 opacity-40'}`} title="Verify Presence"><CheckCircle className="w-4 h-4" /></button>
                                        <span className="text-[8px] font-bold uppercase tracking-tight text-slate-400">{item.is_present !== false ? 'Verified' : 'Offline'}</span>
                                      </div>
                                    </div>
                                  </td>
                                  <td className="px-8 py-6 text-right">
                                    <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-emerald-50 text-emerald-600 rounded-xl border border-emerald-100">
                                      <div className="w-1 h-1 rounded-full bg-emerald-500 animate-pulse"></div>
                                      <span className="text-[9px] font-bold uppercase tracking-wider">Verified</span>
                                    </div>
                                  </td>
                                </tr>
                              );
                            })
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Rentable Assets Section */}
                  <div className="space-y-6">
                    <div className="flex justify-between items-center px-1">
                      <div className="flex items-center gap-2">
                        <h4 className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Rental Items</h4>
                        <span className="px-2.5 py-1 bg-indigo-50 text-indigo-600 rounded-lg text-[9px] font-bold border border-indigo-100 uppercase tracking-widest">Premium Services</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => { const n = { item_id: null, item_name: '', type: 'asset', location_stock: 1, is_rentable: true, is_new: true, rental_price: 0, is_present: true, is_damaged: false, damage_notes: '', source_location_id: inventoryLocations.find(l => l.is_inventory_point)?.id || '' }; setCurrentRoomItems([...currentRoomItems, n]); }}
                        className="px-5 py-2.5 bg-indigo-600 text-white rounded-2xl font-bold text-[10px] uppercase border border-indigo-700 hover:bg-indigo-700 shadow-xl shadow-indigo-100 transition-all flex items-center gap-2"
                      >
                        <PlusCircle className="w-4 h-4" />
                        Add Rental Item
                      </button>
                    </div>

                    <div className="bg-white rounded-[2.5rem] border border-slate-100 overflow-hidden shadow-sm shadow-indigo-100/10">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-indigo-50/30">
                            <th className="px-8 py-5 text-[10px] font-semibold text-slate-500 tracking-wider">Item Name</th>
                            <th className="px-8 py-5 text-[10px] font-semibold text-slate-500 tracking-wider text-center">Status</th>
                            <th className="px-8 py-5 text-[10px] font-semibold text-slate-500 tracking-wider text-center">Daily Rate</th>
                            <th className="px-8 py-5 text-[10px] font-semibold text-slate-500 tracking-wider text-right">Options</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {currentRoomItems.filter(i => i.type === 'asset' && (i.rental_price > 0 || i.is_rentable)).length === 0 ? (
                            <tr><td colSpan="4" className="px-8 py-12 text-center text-[10px] font-bold text-slate-300 uppercase italic">No active revenue streams in sector</td></tr>
                          ) : (
                            currentRoomItems.filter(i => i.type === 'asset' && (i.rental_price > 0 || i.is_rentable)).map((item, index) => {
                              const actualIndex = currentRoomItems.indexOf(item);
                              return (
                                <tr key={index} className="hover:bg-indigo-50/10 transition-colors group">
                                  <td className="px-8 py-6">
                                    {item.is_new ? (
                                      <div className="space-y-3">
                                        <select
                                          value={item.item_id || ''}
                                          onChange={(e) => {
                                            const sid = parseInt(e.target.value);
                                            const sit = inventoryItems.find(i => i.id === sid);
                                            if (sit) {
                                              const up = [...currentRoomItems];
                                              up[actualIndex] = { ...up[actualIndex], item_id: sid, item_name: sit.name, rental_price: sit.selling_price || 0 };
                                              setCurrentRoomItems(up);
                                              ensureItemStock(sid);
                                            }
                                          }}
                                          className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-[11px] font-bold uppercase tracking-wider shadow-inner focus:bg-white focus:ring-4 focus:ring-indigo-500/10 transition-all outline-none"
                                        >
                                          <option value="">Select Item Name...</option>
                                          {inventoryItems.filter(inv => {
                                            const catName = String(inv.category_name || inv.category?.name || "").toLowerCase();
                                            const itemName = String(inv.name || "").toLowerCase();

                                            // Blacklist of categories that are clearly consumables
                                            const isC =
                                              catName.includes("food") ||
                                              catName.includes("beverage") ||
                                              catName.includes("minibar") ||
                                              catName.includes("toiletries") ||
                                              catName.includes("grocery") ||
                                              catName.includes("bev") ||
                                              catName.includes("consumable");

                                            // Also exclude items explicitly marked as perishable or sellable (minibar)
                                            // Rental items should ideally be Linen or Fixed Assets
                                            const isConsumable = inv.is_perishable || inv.is_sellable_to_guest;

                                            return !isC && !isConsumable && inv.is_active !== false;
                                          }).map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
                                        </select>
                                        <div className="flex items-center gap-2">
                                          <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">Stock Source:</span>
                                          <select
                                            value={item.source_location_id}
                                            onChange={(e) => { const up = [...currentRoomItems]; up[actualIndex].source_location_id = e.target.value; setCurrentRoomItems(up); }}
                                            className="bg-transparent border-none text-[9px] font-bold text-indigo-500 uppercase tracking-widest outline-none cursor-pointer p-0"
                                          >
                                            {inventoryLocations.filter(loc => loc.is_inventory_point).map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                                          </select>
                                        </div>
                                      </div>
                                    ) : (
                                      <div>
                                        <div className="font-bold text-slate-700 text-sm group-hover:text-indigo-600 transition-colors">{item.item_name}</div>
                                        <div className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1">Source: {item.source || 'Standard'}</div>
                                      </div>
                                    )}
                                  </td>
                                  <td className="px-8 py-6">
                                    <button onClick={() => { const up = [...currentRoomItems]; up[actualIndex].is_present = !item.is_present; setCurrentRoomItems(up); }} className={`p-2.5 rounded-2xl shadow-sm transition-all ${item.is_present !== false ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-300 opacity-40'}`}><CheckCircle className="w-4 h-4" /></button>
                                  </td>
                                  <td className="px-8 py-6">
                                    <div className="relative flex justify-center">
                                      <span className="absolute left-1/4 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-[10px]">₹</span>
                                      <input
                                        type="number"
                                        value={item.rental_price || item.selling_price || item.unit_price || 0}
                                        disabled={!item.is_new}
                                        onChange={(e) => { const up = [...currentRoomItems]; up[actualIndex].rental_price = parseFloat(e.target.value) || 0; setCurrentRoomItems(up); }}
                                        className="w-24 pl-7 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-slate-700 text-[11px] text-center disabled:opacity-50 focus:bg-white focus:ring-4 focus:ring-indigo-500/10 transition-all outline-none"
                                      />
                                    </div>
                                  </td>
                                  <td className="px-8 py-6 text-right">
                                    {item.is_new ? (
                                      <button onClick={() => setCurrentRoomItems(currentRoomItems.filter((_, i) => i !== actualIndex))} className="p-3 bg-rose-50 text-rose-500 rounded-2xl hover:bg-rose-100 transition-all border border-rose-100"><Trash2 className="w-4.5 h-4.5" /></button>
                                    ) : (
                                      <div className="inline-flex items-center justify-center w-10 h-10 rounded-2xl bg-indigo-50 text-indigo-400 opacity-20 border border-indigo-100">
                                        <X className="w-4 h-4" />
                                      </div>
                                    )}
                                  </td>
                                </tr>
                              );
                            })
                          )}
                        </tbody>
                      </table>
                    </div>

                    {/* Commit Action */}
                    {currentRoomItems.some(i => i.is_new && i.item_id) && (
                      <div className="flex justify-end pt-4">
                        <motion.button
                          whileHover={{ scale: 1.02, y: -2 }}
                          whileActive={{ scale: 0.98 }}
                          onClick={async () => {
                            try {
                              const roomForFetch = (booking.rooms && booking.rooms[selectedRoomIndex]) || null;
                              const roomNumber = roomForFetch?.number || roomForFetch?.room?.number || null;
                              if (!roomNumber) { showBannerMessage("error", "Room mapping failed"); return; }
                              const searchStr = String(roomNumber).toLowerCase().replace(/^0+/, "") || "0";
                              const searchStrPadded = String(roomNumber).toLowerCase();

                              const dest = inventoryLocations.find(loc => {
                                if (String(loc.location_type || "").toUpperCase() !== "GUEST_ROOM") return false;
                                const area = String(loc.room_area || "").toLowerCase();
                                const name = String(loc.name || "").toLowerCase();
                                const areaNoZeros = area.replace(/^0+/, "") || area;
                                const nameNoZeros = name.replace(/^0+/, "") || name;

                                if (area === searchStrPadded || areaNoZeros === searchStr) return true;
                                if (name === searchStrPadded || nameNoZeros === searchStr) return true;

                                const patterns = [`room ${searchStr}`, `room-${searchStr}`, `room${searchStr}`, `room ${searchStrPadded}`];
                                return patterns.some(p => area === p || name === p);
                              });
                              if (!dest) { showBannerMessage("error", "Room destination lost"); return; }
                              const assets = currentRoomItems.filter(i => i.is_new && i.item_id);
                              for (const asset of assets) {
                                if (!asset.source_location_id) { showBannerMessage("error", `Select source for ${asset.item_name}`); return; }
                                await API.post('/inventory/issues', {
                                  source_location_id: asset.source_location_id,
                                  destination_location_id: dest.id,
                                  issue_date: new Date().toISOString(),
                                  notes: `Inventory Management Deployment: ${asset.item_name}`,
                                  details: [{ item_id: asset.item_id, issued_quantity: 1, unit: "pcs", rental_price: asset.rental_price, is_payable: true }]
                                }, authHeader());
                              }
                              showBannerMessage("success", "Protocol Commit Successful");
                              const res = await API.get(`/inventory/locations/${dest.id}/items`, authHeader());
                              setCurrentRoomItems(res.data?.items || []);
                            } catch (error) { showBannerMessage("error", "Commit Failed: " + (error.response?.data?.detail || error.message)); }
                          }}
                          className="px-10 py-5 bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-[2rem] text-xs font-bold uppercase tracking-wide shadow-xl shadow-emerald-100 flex items-center gap-3"
                        >
                          <CheckCircle className="w-5 h-5" />
                          Commit Allocations
                        </motion.button>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Food Orders Tab */}
          {activeTab === "food" && (
            <RoomFoodOrders
              booking={booking}
              authHeader={authHeader}
              API={API}
              formatCurrency={formatCurrency}
              selectedRoomIndex={selectedRoomIndex}
            />
          )}

          {/* Services Tab */}
          {activeTab === "services" && (
            <RoomServiceAssignments
              booking={booking}
              authHeader={authHeader}
              API={API}
              formatCurrency={formatCurrency}
              selectedRoomIndex={selectedRoomIndex}
            />
          )}

          {/* Add New Items Tab */}
          {activeTab === "add" && (
            <form onSubmit={handleSubmit} className="space-y-10">
              <div className="flex justify-between items-center bg-slate-50/50 p-6 rounded-[2rem] border border-slate-100">
                <div className="flex items-center gap-3">
                  <div className="bg-indigo-100 p-3 rounded-2xl">
                    <PlusCircle className="w-5 h-5 text-indigo-600" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-800 uppercase tracking-widest text-xs leading-none">Add Items <span className="text-[9px] font-normal text-indigo-400">v2.5-FIXED</span></h3>
                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-tight mt-1">Add Items into room</p>
                  </div>
                </div>
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileActive={{ scale: 0.95 }}
                  type="button"
                  onClick={addAllocationRow}
                  className="px-6 py-3 bg-white text-indigo-600 rounded-2xl font-bold text-[10px] uppercase border-2 border-indigo-50 hover:bg-indigo-50 transition-all flex items-center gap-2 shadow-sm"
                >
                  <PlusCircle className="w-4 h-4" />
                  Add Row
                </motion.button>
              </div>

              <div className="space-y-6 max-h-[50vh] overflow-y-auto pr-2 custom-scrollbar">
                {allocationItems.map((item, index) => (
                  <motion.div
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    key={index}
                    className="group bg-white rounded-[2.5rem] border-2 border-slate-50 p-8 relative hover:border-indigo-100 transition-all shadow-sm"
                  >
                    <div className="absolute top-6 right-8 flex items-center gap-4">
                      <span className="text-[10px] font-bold text-slate-300 uppercase tracking-wide">Room #{index + 1}</span>
                      {allocationItems.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeAllocationRow(index)}
                          className="p-2 bg-rose-50 text-rose-400 hover:text-rose-600 rounded-xl transition-all"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-start">
                      <div className="md:col-span-5 space-y-2">
                        <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-widest ml-1">Resource Selection</label>
                        <div className="relative">
                          <Select
                            value={item.item_id ? {
                              value: item.item_id,
                              label: (() => {
                                const invItem = inventoryItems.find((it) => it.id == item.item_id);
                                return invItem ? `${invItem.name} ${invItem.item_code ? `(${invItem.item_code})` : ""}` : "";
                              })()
                            } : null}
                            onChange={(option) => updateAllocationItem(index, "item_id", option ? option.value : "")}
                            options={inventoryItems
                              .filter((it) => it.is_active !== false)
                              .map((invItem) => ({
                                value: invItem.id,
                                label: `${invItem.name} ${invItem.item_code ? `(${invItem.item_code})` : ""}`
                              }))}
                            placeholder="Select an item"
                            isClearable
                            styles={{
                              control: (base) => ({
                                ...base,
                                padding: '0.25rem 0.5rem',
                                backgroundColor: '#f8fafc',
                                border: '2px solid transparent',
                                borderRadius: '1.25rem',
                                fontWeight: '700',
                                color: '#334155',
                                fontSize: '0.75rem',
                                boxShadow: 'none',
                                '&:hover': {
                                  borderColor: 'transparent',
                                },
                              }),
                              menuPortal: base => ({ ...base, zIndex: 99999 })
                            }}
                            menuPortalTarget={document.body}
                          />
                          <div className="absolute right-12 top-1/2 -translate-y-1/2 flex items-center gap-2">
                            {item.item_id && (
                              <button
                                type="button"
                                onClick={() => {
                                  const selectedItem = inventoryItems.find(i => i.id == item.item_id);
                                  if (selectedItem) fetchItemStocks(selectedItem);
                                }}
                                className="p-1.5 bg-indigo-50 text-indigo-500 rounded-lg hover:bg-indigo-100 transition-colors z-10 relative"
                                title="Visual Stock Map"
                              >
                                <ExternalLink className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </div>

                        <div className="md:col-span-4 space-y-2">
                          <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-widest ml-1 text-left">Logistics Source</label>
                          <div className="relative">
                            <select
                              value={item.source_location_id || getDefaultSourceLocationId()}
                              onChange={(e) => updateAllocationItem(index, "source_location_id", parseInt(e.target.value))}
                              className={`w-full px-5 py-4 rounded-[1.25rem] font-bold text-xs outline-none transition-all appearance-none border-2 ${(item.item_id && (itemStockCache[item.item_id]?.[item.source_location_id || getDefaultSourceLocationId()] || 0) < item.quantity)
                                ? "bg-rose-50 border-rose-100 text-rose-700"
                                : "bg-slate-50 border-transparent text-slate-700 focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10"
                                }`}
                            >
                              {inventoryLocations
                                .filter((loc) => {
                                  const type = String(loc.location_type || "").toUpperCase();
                                  return (loc.is_inventory_point === true) || ["CENTRAL_WAREHOUSE", "WAREHOUSE", "BRANCH_STORE", "STORE", "STORAGE"].includes(type);
                                })
                                .map((loc) => {
                                  const stock = item.item_id ? (itemStockCache[item.item_id]?.[loc.id]) : null;
                                  return (
                                    <option key={loc.id} value={loc.id}>
                                      {loc.name} {stock !== null ? `➡️ (Stock: ${stock})` : ""}
                                    </option>
                                  );
                                })}
                            </select>
                            <div className="absolute right-5 top-1/2 -translate-y-1/2 pointer-events-none">
                              <Box className={`w-4 h-4 ${(item.item_id && (itemStockCache[item.item_id]?.[item.source_location_id || getDefaultSourceLocationId()] || 0) < item.quantity) ? 'text-rose-400' : 'text-slate-300'}`} />
                            </div>
                          </div>
                        </div>
                        <div className="md:col-span-3 space-y-2">
                          <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-widest ml-1">Quantity</label>
                          <div className="relative">
                            <input
                              type="number"
                              value={item.quantity}
                              onChange={(e) => {
                                const selectedItem = inventoryItems.find(i => i.id == item.item_id);
                                const normalizedValue = normalizeQuantity(e.target.value, selectedItem?.unit);
                                updateAllocationItem(index, "quantity", normalizedValue);
                              }}
                              className={`w-full px-5 py-4 rounded-[1.25rem] font-bold text-sm text-center outline-none transition-all border-2 ${(item.item_id && (itemStockCache[item.item_id]?.[item.source_location_id || getDefaultSourceLocationId()] || 0) < item.quantity)
                                ? "bg-rose-50 border-rose-200 text-rose-700 focus:border-rose-500"
                                : "bg-slate-50 border-transparent text-slate-700 focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 shadow-inner"
                                }`}
                            />
                          </div>
                          {(item.item_id && (itemStockCache[item.item_id]?.[item.source_location_id || getDefaultSourceLocationId()] || 0) < item.quantity) && (
                            <p className="text-[8px] font-bold text-rose-500 uppercase tracking-tight text-center mt-1 animate-pulse">Critical: Stock Out!</p>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="mt-8 flex flex-wrap items-center justify-between gap-6 pt-6 border-t border-slate-50">
                      <div className="flex gap-4">
                        {[
                          { id: false, label: 'Complimentary', icon: Heart, color: 'text-emerald-500', bg: 'bg-emerald-50', active: 'bg-emerald-500' },
                          { id: true, label: 'Payable', icon: CreditCard, color: 'text-orange-500', bg: 'bg-orange-50', active: 'bg-orange-500' }
                        ].map(type => (
                          <button
                            key={type.label}
                            type="button"
                            onClick={() => updateAllocationItem(index, "is_payable", type.id)}
                            className={`flex items-center gap-3 px-6 py-3 rounded-2xl transition-all border-2 ${item.is_payable === type.id
                              ? `border-${type.active.split('-')[1]}-200 ${type.bg} shadow-sm`
                              : "border-transparent bg-slate-50 opacity-60 grayscale hover:grayscale-0 hover:opacity-100"
                              }`}
                          >
                            <type.icon className={`w-4 h-4 ${item.is_payable === type.id ? type.color : 'text-slate-400'}`} />
                            <span className={`text-[10px] font-bold uppercase tracking-wider ${item.is_payable === type.id ? 'text-slate-700' : 'text-slate-400'}`}>{type.label}</span>
                          </button>
                        ))}
                      </div>

                      <div className="flex-1 max-w-sm">
                        <div className="relative group/note">
                          <input
                            type="text"
                            value={item.notes}
                            onChange={(e) => updateAllocationItem(index, "notes", e.target.value)}
                            placeholder="Add protocol notes..."
                            className="w-full px-5 py-3.5 bg-slate-50 hover:bg-white border-2 border-transparent focus:border-indigo-100 rounded-2xl text-[10px] font-bold outline-none transition-all placeholder:text-slate-300"
                          />
                          <div className="absolute right-4 top-1/2 -translate-y-1/2 opacity-20 group-focus-within/note:opacity-100 transition-opacity">
                            <Settings className="w-3.5 h-3.5 text-indigo-400" />
                          </div>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>

              <div className="flex justify-end items-center gap-4 bg-slate-900 rounded-[2.5rem] p-6 shadow-2xl">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-8 py-4 text-slate-400 hover:text-white font-bold uppercase tracking-wider text-[10px] transition-colors"
                >
                  Discard Changes
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-12 py-4 bg-white text-slate-900 rounded-[1.5rem] font-bold uppercase tracking-wide text-[10px] hover:shadow-xl hover:shadow-white/10 transition-all flex items-center gap-3 disabled:opacity-30 disabled:grayscale"
                >
                  {isSubmitting ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <CheckCircle className="w-4 h-4" />
                  )}
                  {isSubmitting ? "Engaging Dynamics..." : `Deploy ${allocationItems.filter((i) => i.item_id && i.quantity > 0).length} Modules`}
                </button>
              </div>
            </form >
          )}

          {/* Stock View Modal */}
          {showStockModal && (
            <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center z-[200] p-4">
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-white rounded-[3rem] w-full max-w-2xl overflow-hidden shadow-[0_32px_64px_-12px_rgba(0,0,0,0.5)] border border-white/20"
              >
                {/* Header Section */}
                <div className="px-10 py-8 bg-slate-50/50 border-b border-slate-100 flex justify-between items-center">
                  <div className="flex items-center gap-4">
                    <div className="bg-indigo-600 p-3 rounded-2xl shadow-lg shadow-indigo-200">
                      <Box className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-slate-800 uppercase tracking-tight">Stock Topology</h3>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{stockModalItem?.name}</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowStockModal(false)}
                    className="p-3 bg-white text-slate-400 hover:text-rose-500 rounded-2xl border-2 border-slate-50 hover:border-rose-50 transition-all shadow-sm"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="p-10">
                  {loadingItemStocks ? (
                    <div className="flex flex-col items-center justify-center py-20 space-y-4">
                      <RefreshCw className="w-10 h-10 text-indigo-400 animate-spin" />
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-normal">Scanning Items...</span>
                    </div>
                  ) : itemStocks.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 space-y-4 bg-slate-50 rounded-[2.5rem] border-2 border-dashed border-slate-200">
                      <AlertCircle className="w-10 h-10 text-slate-300" />
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center px-10">No stock clusters detected in current system</span>
                    </div>
                  ) : (
                    <div className="space-y-8">
                      {/* Aggregate Indicator */}
                      <div className="bg-gradient-to-br from-indigo-50 to-violet-50 p-6 rounded-3xl border border-indigo-100 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
                          <span className="text-[10px] font-bold text-indigo-900 uppercase tracking-widest">Total System Stock</span>
                        </div>
                        <div className="flex items-baseline gap-1">
                          <span className="text-3xl font-bold text-indigo-900 leading-none">{stockModalItem?.current_stock}</span>
                          <span className="text-[10px] font-bold text-indigo-400 uppercase">Units</span>
                        </div>
                      </div>

                      {/* Distribution Table */}
                      <div className="bg-white border-2 border-slate-50 rounded-[2rem] overflow-hidden shadow-sm">
                        <table className="w-full text-left">
                          <thead>
                            <tr className="bg-slate-50/80">
                              <th className="px-6 py-5 text-[9px] font-bold text-slate-400 uppercase tracking-widest border-b border-slate-100">Storage Item</th>
                              <th className="px-6 py-5 text-[9px] font-bold text-slate-400 uppercase tracking-widest border-b border-slate-100">Classification</th>
                              <th className="px-6 py-5 text-[9px] font-bold text-slate-400 uppercase tracking-widest border-b border-slate-100 text-right">Magnitude</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-50">
                            {itemStocks.map((stock, idx) => (
                              <motion.tr
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: idx * 0.05 }}
                                key={idx}
                                className="group hover:bg-slate-50/50 transition-colors"
                              >
                                <td className="px-6 py-5">
                                  <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-xl bg-slate-100 flex items-center justify-center text-slate-400 group-hover:bg-indigo-100 group-hover:text-indigo-600 transition-colors">
                                      <Building2 className="w-4 h-4" />
                                    </div>
                                    <span className="text-sm font-bold text-slate-700">{stock.location_name}</span>
                                  </div>
                                </td>
                                <td className="px-6 py-5">
                                  <span className="px-3 py-1 bg-slate-100 text-slate-500 rounded-full text-[8px] font-bold uppercase tracking-wider border border-slate-200">
                                    {stock.location_type}
                                  </span>
                                </td>
                                <td className="px-6 py-5 text-right">
                                  <span className="text-sm font-bold text-slate-900">{stock.quantity}</span>
                                </td>
                              </motion.tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>

                {/* Footer Section */}
                <div className="px-10 py-8 bg-slate-50/50 border-t border-slate-100 flex justify-end">
                  <button
                    type="button"
                    onClick={() => setShowStockModal(false)}
                    className="px-10 py-4 bg-slate-900 text-white rounded-2xl font-bold uppercase tracking-wide text-[10px] hover:bg-slate-800 transition-all shadow-xl shadow-slate-200"
                  >
                    Acknowledge Stock
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
};

const ConfirmBookingModal = ({
  booking,
  onConfirm,
  onClose,
  isSubmitting,
}) => {
  const [payments, setPayments] = useState([{ amount: 0, method: 'cash' }]);
  const [notes, setNotes] = useState(booking?.confirmation_notes || "");

  if (!booking) return null;

  const handleConfirm = () => {
    onConfirm(booking.id, payments, notes, booking.is_package);
  };

  const addPaymentRow = () => setPayments([...payments, { amount: 0, method: 'cash' }]);
  const removePaymentRow = (index) => {
    if (payments.length > 1) {
      setPayments(payments.filter((_, i) => i !== index));
    }
  };
  const updatePayment = (index, field, value) => {
    const updated = [...payments];
    updated[index][field] = field === 'amount' ? (value === "" ? "" : parseFloat(value)) : value;
    setPayments(updated);
  };

  const totalAmount = payments.reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xl flex items-center justify-center p-6 z-[200]">
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 30 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 30 }}
        className="bg-white/95 rounded-[3.5rem] shadow-[0_50px_100px_-20px_rgba(0,0,0,0.3)] w-full max-w-2xl overflow-hidden flex flex-col border border-white relative"
      >
        <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-emerald-500 via-teal-500 to-indigo-500 z-50"></div>
        <div className="absolute -top-24 -right-24 w-64 h-64 bg-emerald-50 rounded-full blur-3xl opacity-50"></div>
        <div className="absolute -bottom-24 -left-24 w-64 h-64 bg-indigo-50 rounded-full blur-3xl opacity-50"></div>

        {/* Header */}
        <div className="px-12 py-10 flex justify-between items-center relative z-10">
          <div className="flex items-center gap-6">
            <div className="w-16 h-16 rounded-[2rem] bg-emerald-600 shadow-2xl shadow-emerald-200 flex items-center justify-center">
              <CheckCircle2 className="w-8 h-8 text-white" />
            </div>
            <div>
              <h2 className="text-3xl font-bold text-slate-800 tracking-tight uppercase leading-none mb-2">
                {booking?.status?.toLowerCase() === "pending" ? "Accept Enquiry" : "Confirm Booking"}
              </h2>
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                <span className="text-slate-400 text-[10px] font-bold uppercase tracking-normal">
                  {booking?.status?.toLowerCase() === "pending" ? "Accepting Guest Enquiry — Record Advance" : "Recording Advance Payment"}
                </span>
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="group w-12 h-12 bg-slate-50 hover:bg-rose-50 text-slate-400 hover:text-rose-500 rounded-2xl transition-all duration-500 border-2 border-slate-100 flex items-center justify-center"
          >
            <X className="w-5 h-5 group-hover:rotate-90 transition-transform" />
          </button>
        </div>

        <div className="px-12 pb-12 space-y-8 relative z-10 overflow-y-auto max-h-[60vh] custom-scrollbar">
          <div className="bg-slate-50/50 rounded-[2rem] p-8 border-2 border-slate-100 shadow-sm space-y-8">
            <div className="flex items-center justify-between border-b border-slate-100 pb-6">
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-2 px-1">Guest Identification</p>
                <div className="flex items-center gap-2 px-1">
                  <User className="w-4 h-4 text-indigo-400" />
                  <p className="font-bold text-slate-700 text-xl tracking-tight">{booking.guest_name}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-2 px-1">Booking Value</p>
                <p className="font-bold text-slate-800 text-xl tracking-tight">{formatCurrency(booking.total_amount || 0)}</p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-8">
              <div>
                <p className="text-[10px] font-bold text-emerald-400 uppercase tracking-wide mb-2 px-1">Previous Advance</p>
                <p className="font-bold text-emerald-500 text-2xl tracking-tighter">{formatCurrency(booking.advance_deposit || 0)}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold text-indigo-400 uppercase tracking-wide mb-2 px-1">New Payment</p>
                <p className="font-bold text-indigo-600 text-2xl tracking-tighter">{formatCurrency(totalAmount)}</p>
              </div>
              <div className="text-right">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-2 px-1">Balance Due</p>
                <p className="font-bold text-slate-800 text-2xl tracking-tighter">
                  {formatCurrency((booking.total_amount || 0) - (booking.advance_deposit || 0) - totalAmount)}
                </p>
              </div>
            </div>
          </div>

          {/* Payments List */}
          <div className="space-y-4">
            <div className="flex items-center justify-between px-2">
              <h3 className="font-bold text-slate-800 uppercase tracking-wide text-[10px]">Payment Breakdown</h3>
              <button
                onClick={addPaymentRow}
                className="flex items-center gap-2 text-[10px] font-bold text-indigo-600 hover:text-indigo-700 uppercase tracking-widest bg-indigo-50 px-4 py-2 rounded-xl border border-indigo-100 transition-all active:scale-95"
              >
                <Plus className="w-3.5 h-3.5" />
                Add Method
              </button>
            </div>

            <div className="space-y-4">
              {payments.map((payment, idx) => (
                <div key={idx} className="flex items-center gap-4 animate-fadeIn">
                  <div className="flex-1 relative group">
                    <input
                      type="number"
                      value={payment.amount}
                      onChange={(e) => updatePayment(idx, 'amount', e.target.value)}
                      placeholder="Amount"
                      className="w-full px-6 py-4 bg-white border-2 border-slate-100 rounded-2xl font-bold text-slate-800 focus:border-indigo-500 transition-all outline-none text-sm shadow-inner"
                    />
                    <div className="absolute left-[-2rem] top-1/2 -translate-y-1/2 text-slate-300 font-bold text-xs">
                      #{idx + 1}
                    </div>
                  </div>
                  <div className="flex-[0.8]">
                    <select
                      value={payment.method}
                      onChange={(e) => updatePayment(idx, 'method', e.target.value)}
                      className="w-full px-6 py-4 bg-slate-50 border-2 border-transparent focus:bg-white focus:border-indigo-100 rounded-2xl text-sm font-bold text-slate-700 outline-none transition-all appearance-none"
                    >
                      <option value="cash">💵 Cash</option>
                      <option value="upi">📱 UPI</option>
                      <option value="card">💳 Card</option>
                      <option value="bank_transfer">🏦 Bank</option>
                    </select>
                  </div>
                  {payments.length > 1 && (
                    <button
                      onClick={() => removePaymentRow(idx)}
                      className="p-4 bg-rose-50 text-rose-500 rounded-2xl hover:bg-rose-500 hover:text-white transition-all active:scale-95"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Previous Transaction Audit */}
          <div className="bg-slate-50/50 rounded-[2rem] border-2 border-slate-100 overflow-hidden shadow-sm">
            <div className="px-8 py-4 bg-slate-50/50 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Receipt className="w-4 h-4 text-emerald-500" />
                <h3 className="text-[10px] font-bold text-slate-800 uppercase tracking-wider">Payment History Protocol</h3>
              </div>
              <span className="px-3 py-1 bg-white rounded-full border border-slate-100 text-[8px] font-bold text-slate-400 uppercase tracking-widest">
                {booking.payments?.length || 0} Transactions
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-slate-50/30">
                    <th className="px-8 py-3 text-left text-[8px] font-bold text-slate-400 uppercase tracking-widest border-b border-slate-100">Receipt ID</th>
                    <th className="px-8 py-3 text-left text-[8px] font-bold text-slate-400 uppercase tracking-widest border-b border-slate-100">Date/Time</th>
                    <th className="px-8 py-3 text-left text-[8px] font-bold text-slate-400 uppercase tracking-widest border-b border-slate-100">Method</th>
                    <th className="px-8 py-3 text-right text-[8px] font-bold text-slate-400 uppercase tracking-widest border-b border-slate-100">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {booking.payments && booking.payments.length > 0 ? (
                    booking.payments.map((p, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-8 py-4 text-[10px] font-bold text-slate-800 uppercase">RCP-{p.id || 'N/A'}</td>
                        <td className="px-8 py-4 text-[10px] font-semibold text-slate-500">{new Date(p.created_at).toLocaleDateString()}</td>
                        <td className="px-8 py-4 uppercase">
                          <span className="px-2 py-1 bg-white border border-slate-100 rounded-lg text-[8px] font-bold text-slate-600">
                            {p.method}
                          </span>
                        </td>
                        <td className="px-8 py-4 text-right text-[10px] font-bold text-emerald-600">{formatCurrency(p.amount)}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="4" className="px-8 py-10 text-center">
                        <p className="text-[10px] font-bold text-slate-300 uppercase tracking-widest italic">No financial movements identified</p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-3">
            <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest ml-1">Confirmation Protocol Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add any specific details from the call (e.g. 'Confirmed lunch timing', 'Special bedding requested')..."
              className="w-full px-6 py-4 bg-slate-50 border-2 border-transparent focus:bg-white focus:border-indigo-100 rounded-[2rem] text-sm font-bold text-slate-700 outline-none transition-all placeholder:text-slate-300 resize-none h-32 shadow-inner"
            />
          </div>
        </div>

        {/* Actions */}
        <div className="px-12 py-10 bg-slate-50/50 border-t border-slate-100 flex flex-col sm:flex-row gap-6">
          <button
            onClick={onClose}
            className="flex-1 px-8 py-5 bg-white text-slate-400 rounded-[2rem] font-bold uppercase tracking-wide text-[10px] border-2 border-slate-100 hover:text-slate-600 hover:bg-slate-100 transition-all active:scale-95"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={isSubmitting}
            className="flex-[1.5] px-10 py-5 bg-emerald-600 text-white rounded-[2rem] font-bold uppercase tracking-normal text-[10px] shadow-2xl shadow-emerald-200 hover:bg-emerald-700 transition-all flex items-center justify-center gap-4 disabled:opacity-30 disabled:grayscale disabled:cursor-not-allowed group active:scale-95"
          >
            {isSubmitting ? (
              <RefreshCw className="w-5 h-5 animate-spin" />
            ) : (
              <CheckCircle className="w-5 h-5 group-hover:scale-110 transition-transform" />
            )}
          <span>{booking?.status?.toLowerCase() === "pending" ? "Accept Enquiry" : "Confirm Booking"}</span>
          </button>
        </div>
      </motion.div>
    </div>
  );
};

const ExtendBookingModal = ({
  booking,
  onSave,
  onClose,
  feedback,
  isSubmitting,
}) => {
  // Safety check: ensure booking exists and has required properties
  if (!booking || !booking.check_out || !booking.id) {
    return (
      <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-md flex items-center justify-center p-4 z-[200]">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-white/95 backdrop-blur-xl p-8 rounded-[2.5rem] shadow-2xl border border-rose-100 max-w-md w-full text-center"
        >
          <div className="bg-rose-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6">
            <AlertCircle className="w-8 h-8 text-rose-600" />
          </div>
          <h3 className="text-2xl font-bold text-slate-800 mb-2 tracking-tight">Data Integrity Error</h3>
          <p className="text-slate-500 font-semibold text-sm mb-8 leading-relaxed">
            The system encountered an inconsistency with this booking's metadata.
            Please refresh the system and re-attempt the extension.
          </p>
          <button
            onClick={onClose}
            className="w-full bg-slate-800 text-white font-bold py-4 rounded-2xl hover:bg-slate-900 transition-all uppercase tracking-widest text-[10px]"
          >
            Acknowledge & Close
          </button>
        </motion.div>
      </div>
    );
  }

  const [newCheckout, setNewCheckout] = useState(booking.check_out || "");
  const minDate = booking.check_out || "";

  const handleSave = () => {
    if (!booking.id || !newCheckout) return;
    onSave(booking.id, newCheckout);
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xl flex items-center justify-center p-6 z-[200]">
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 30 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 30 }}
        className="bg-white/95 rounded-[3.5rem] shadow-[0_50px_100px_-20px_rgba(0,0,0,0.3)] w-full max-w-xl overflow-hidden flex flex-col border border-white relative"
      >
        <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-indigo-500 via-violet-500 to-rose-500 z-50"></div>
        <div className="absolute -top-24 -right-24 w-64 h-64 bg-indigo-50 rounded-full blur-3xl opacity-50"></div>
        <div className="absolute -bottom-24 -left-24 w-64 h-64 bg-rose-50 rounded-full blur-3xl opacity-50"></div>

        {/* Header */}
        <div className="px-12 py-10 flex justify-between items-center relative z-10">
          <div className="flex items-center gap-6">
            <div className="w-16 h-16 rounded-[2rem] bg-indigo-600 shadow-2xl shadow-indigo-200 flex items-center justify-center">
              <Calendar className="w-8 h-8 text-white" />
            </div>
            <div>
              <h2 className="text-3xl font-bold text-slate-800 tracking-tight uppercase leading-none mb-2">Change Dates</h2>
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse"></div>
                <span className="text-slate-400 text-[10px] font-bold uppercase tracking-normal">Booking Info: BK-{booking.display_id || `#${booking.id}`}</span>
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="group w-12 h-12 bg-slate-50 hover:bg-rose-50 text-slate-400 hover:text-rose-500 rounded-2xl transition-all duration-500 border-2 border-slate-100 flex items-center justify-center"
          >
            <X className="w-5 h-5 group-hover:rotate-90 transition-transform" />
          </button>
        </div>

        <div className="px-12 pb-12 space-y-10 relative z-10">
          {/* Current Schedule Info */}
          <div className="grid grid-cols-2 gap-6">
            <div className="bg-slate-50/50 rounded-[2rem] p-6 border-2 border-slate-100 shadow-sm">
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wide mb-2 px-1">Check-in Origin</p>
              <div className="flex items-center gap-2 px-1">
                <MapPin className="w-3.5 h-3.5 text-indigo-400" />
                <p className="font-bold text-slate-700 text-lg tracking-tight">{booking.check_in}</p>
              </div>
            </div>
            <div className="bg-white rounded-[2rem] p-6 border-2 border-indigo-100 shadow-xl shadow-indigo-100/20">
              <p className="text-[9px] font-bold text-indigo-400 uppercase tracking-wide mb-2 px-1">Current Departure</p>
              <div className="flex items-center gap-2 px-1">
                <Clock className="w-3.5 h-3.5 text-rose-400" />
                <p className="font-bold text-slate-800 text-lg tracking-tight">{booking.check_out}</p>
              </div>
            </div>
          </div>

          {/* New Departure Input */}
          <div className="space-y-6">
            <div className="flex items-center justify-between px-2">
              <h3 className="font-bold text-slate-800 uppercase tracking-wide text-[10px]">Adjust Duration</h3>
              <span className="text-[9px] font-bold text-indigo-500 uppercase tracking-widest bg-indigo-50 px-3 py-1 rounded-full border border-indigo-100">Future Point Only</span>
            </div>

            <div className="relative group">
              <div className="absolute -inset-2 bg-gradient-to-r from-indigo-500 via-violet-500 to-rose-500 rounded-[2.5rem] blur opacity-10 group-hover:opacity-20 transition duration-1000"></div>
              <div className="relative">
                <input
                  type="date"
                  value={newCheckout || ""}
                  onChange={(e) => setNewCheckout(e.target.value)}
                  min={minDate || ""}
                  className="w-full px-10 py-6 bg-white border-2 border-slate-100 rounded-[2.5rem] font-bold text-slate-800 focus:border-indigo-500 transition-all outline-none text-xl shadow-inner appearance-none text-center"
                />
                <div className="absolute left-8 top-1/2 -translate-y-1/2 pointer-events-none">
                  <Calendar className="w-5 h-5 text-indigo-300" />
                </div>
              </div>
            </div>

            <div className="bg-slate-900 rounded-[2rem] p-6 shadow-2xl">
              <div className="flex gap-4 items-start">
                <div className="p-3 bg-indigo-500/20 rounded-xl">
                  <Info className="w-4 h-4 text-indigo-400" />
                </div>
                <p className="text-[10px] font-bold text-slate-400 leading-relaxed">
                  By extending the temporal span, you are adjusting the fiscal commitment of this record.
                  The system will recalibrate all taxes and service charges upon final commitment.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="px-12 py-10 bg-slate-50/50 border-t border-slate-100 flex flex-col sm:flex-row gap-6">
          <button
            onClick={onClose}
            className="flex-1 px-8 py-5 bg-white text-slate-400 rounded-[2rem] font-bold uppercase tracking-wide text-[10px] border-2 border-slate-100 hover:text-slate-600 hover:bg-slate-100 transition-all active:scale-95"
          >
            Abort Protocol
          </button>
          <button
            onClick={handleSave}
            disabled={isSubmitting || !newCheckout || !minDate || newCheckout <= minDate}
            className="flex-[1.5] px-10 py-5 bg-slate-900 text-white rounded-[2rem] font-bold uppercase tracking-normal text-[10px] shadow-2xl shadow-indigo-200 hover:bg-indigo-600 transition-all flex items-center justify-center gap-4 disabled:opacity-30 disabled:grayscale disabled:cursor-not-allowed group active:scale-95"
          >
            {isSubmitting ? (
              <RefreshCw className="w-5 h-5 animate-spin" />
            ) : (
              <Save className="w-5 h-5 group-hover:scale-110 transition-transform" />
            )}
            <span>Commit Update</span>
          </button>
        </div>
      </motion.div>
    </div>
  );
};

// Simple amenity defaults used when no custom configuration exists.
// These are editable by the user at check-in (quantities, payable toggle, etc.).
const DEFAULT_AMENITIES = [
  {
    id: "custom_1",
    name: "",
    frequency: "PER_STAY",
    complimentaryPerNight: 0,
    complimentaryPerStay: 0,
    extraPrice: 0,
    is_payable: false,
  }
];

const CheckInModal = ({
  booking,
  onSave,
  onClose,
  feedback,
  isSubmitting,
  inventoryItems = [],
  showBannerMessage,
  roomTypeObjects = [],
}) => {
  const [idCardImage, setIdCardImage] = useState(null);
  const [guestPhoto, setGuestPhoto] = useState(null);
  const [idCardPreview, setIdCardPreview] = useState(null);
  const [guestPhotoPreview, setGuestPhotoPreview] = useState(null);
  const [selectedFeatures, setSelectedFeatures] = useState({});
  const [featureTimes, setFeatureTimes] = useState({});
  const [featureDates, setFeatureDates] = useState({});
  const [foodItems, setFoodItems] = useState([]);
  const [featureMenuSelections, setFeatureMenuSelections] = useState({}); // { featureName: [{ foodItemId, quantity, name }] }
  const [activeTasks, setActiveTasks] = useState({ services: [], orders: [] });
  const [isLoadingTasks, setIsLoadingTasks] = useState(false);
  const [employees, setEmployees] = useState([]);
  const [featureEmployees, setFeatureEmployees] = useState({}); // { featureName: employeeId }
  const [selectedRoomIds, setSelectedRoomIds] = useState([]); // New state for room assignment
  const [availableRooms, setAvailableRooms] = useState([]); // Rooms available for this type

  useEffect(() => {
    const fetchEmployees = async () => {
      try {
        const token = localStorage.getItem("token");
        const res = await API.get("/employees?limit=1000", { headers: { Authorization: `Bearer ${token}` } });
        const data = Array.isArray(res.data) ? res.data : (res.data?.data || []);
        setEmployees(data);
      } catch (err) {
        console.error("Failed to fetch employees for check-in:", err);
      }
    };
    fetchEmployees();
  }, []);

  useEffect(() => {
    const fetchFoodItems = async () => {
      try {
        const token = localStorage.getItem("token");
        const res = await API.get("/food-items?limit=10000", { headers: { Authorization: `Bearer ${token}` } });
        const data = Array.isArray(res.data) ? res.data : (res.data?.data || []);
        setFoodItems(data);
      } catch (err) {
        console.error("Failed to fetch food items for check-in:", err);
      }
    };
    fetchFoodItems();
  }, []);

  useEffect(() => {
    const fetchAvailableRooms = async () => {
      try {
        const token = localStorage.getItem("token");
        const res = await API.get("/rooms/", { headers: { Authorization: `Bearer ${token}` } });
        const allRooms = res.data || [];
        // Filter by the booking's room type if it's a soft allocation
        const typeId = booking.room_type_id || (booking.rooms?.[0]?.room_type_id);
        
        // Parse typeId into allowed IDs or names (could be comma-separated for packages)
        const allowedTypeIds = typeId
          ? String(typeId).split(',').map(item => item.trim().toLowerCase())
          : [];

        const filtered = allRooms.filter(r => {
          if (r.status !== 'Available') return false;
          if (allowedTypeIds.length === 0) return true;
          
          const roomTypeIdStr = String(r.room_type_id).toLowerCase();
          const roomTypeNameStr = String(r.type || '').toLowerCase();
          
          return allowedTypeIds.some(id => 
            id === roomTypeIdStr || 
            id === roomTypeNameStr
          );
        });
        setAvailableRooms(filtered);
      } catch (err) {
        console.error("Failed to fetch available rooms for check-in:", err);
      }
    };
    if (booking.status?.toLowerCase() === 'booked' && (!booking.rooms || booking.rooms.length === 0)) {
      fetchAvailableRooms();
    }
  }, [booking]);

  useEffect(() => {
    const fetchActiveTasks = async () => {
      const roomIds = booking.rooms?.map(r => Number(r.room_id || r.id || r.room?.id)).filter(id => !isNaN(id)) || [];
      if (roomIds.length === 0) return;

      setIsLoadingTasks(true);
      try {
        const token = localStorage.getItem("token");
        const config = { headers: { Authorization: `Bearer ${token}` } };

        const [servicesRes, ordersRes] = await Promise.all([
          API.get("/service-requests?limit=1000", config).catch(() => ({ data: [] })),
          API.get("/food-orders/?limit=1000", config).catch(() => ({ data: [] }))
        ]);

        const filteredServices = (servicesRes.data || []).filter(s => {
          const sRoomId = Number(s.room_id);
          return roomIds.includes(sRoomId) &&
            s.status !== 'completed' && s.status !== 'cancelled' && s.status !== 'rejected' && s.status !== 'served';
        });

        const filteredOrders = (ordersRes.data || []).filter(o => {
          const oRoomId = Number(o.room_id);
          return roomIds.includes(oRoomId) &&
            o.status !== 'completed' && o.status !== 'cancelled' && o.status !== 'served' && o.status !== 'billed';
        });

        setActiveTasks({ services: filteredServices, orders: filteredOrders });
      } catch (error) {
        console.error("Failed to fetch active tasks for check-in warning:", error);
      } finally {
        setIsLoadingTasks(false);
      }
    };
    fetchActiveTasks();
  }, [booking.rooms]);

  const handleAddMenuItem = (featureName) => {
    setFeatureMenuSelections(prev => {
      const current = prev[featureName] || [];
      return { ...prev, [featureName]: [...current, { foodItemId: "", quantity: 1 }] };
    });
  };

  const handleUpdateMenuItem = (featureName, index, field, value) => {
    setFeatureMenuSelections(prev => {
      const current = [...(prev[featureName] || [])];
      if (field === "foodItemId") {
        const selectedFood = foodItems.find(f => f.id === Number(value));
        current[index] = { ...current[index], foodItemId: value, name: selectedFood ? selectedFood.name : "" };
      } else {
        current[index] = { ...current[index], [field]: value };
      }
      return { ...prev, [featureName]: current };
    });
  };

  const handleRemoveMenuItem = (featureName, index) => {
    setFeatureMenuSelections(prev => {
      const current = [...(prev[featureName] || [])];
      current.splice(index, 1);
      return { ...prev, [featureName]: current };
    });
  };

  const handleFileChange = (e, type) => {
    const file = e.target.files[0];
    if (!file) return;

    const previewUrl = URL.createObjectURL(file);
    if (type === "id") {
      setIdCardImage(file);
      setIdCardPreview(previewUrl);
    } else {
      setGuestPhoto(file);
      setGuestPhotoPreview(previewUrl);
    }
  };

  const handleSave = () => {
    const normalizedStatus = booking.status?.toLowerCase().replace(/[-_]/g, "");
    if (normalizedStatus !== "booked") {
      showBannerMessage("error", `Cannot check in. Booking status is: ${booking.status}`);
      return;
    }

    if (!idCardImage || !guestPhoto) {
      showBannerMessage("error", "Please upload both ID card and guest photo.");
      return;
    }

    // Only enforce room selection if booking has no pre-assigned rooms
    const hasAssignedRooms = booking.rooms && booking.rooms.length > 0;
    const requiredRooms = booking.num_rooms || 1;
    if (!hasAssignedRooms && selectedRoomIds.length !== requiredRooms) {
      showBannerMessage("error", `Please select exactly ${requiredRooms} room(s). Currently selected: ${selectedRoomIds.length}`);
      return;
    }

    let amenityAllocation = null;
    if (booking.is_package && booking.package && booking.package.food_included) {
      const features = [];
      const includedList = booking.package.food_included.split(",");

      includedList.forEach(f => {
        const name = f.trim();
        if (name && selectedFeatures[name] !== false) {
          features.push({
            name: name,
            frequency: "PER_NIGHT",
            complimentaryPerNight: (Number(booking.adults) || 1) + (Number(booking.children) || 0),
            complimentaryPerStay: 0,
            is_payable: false,
            extraPrice: 0,
            scheduledTime: featureTimes[name] || null,
            scheduledDate: featureDates[name] || null,
            assigned_employee_id: featureEmployees[name] || null,
            specificFoodItems: featureMenuSelections[name] || []
          });
        }
      });

      if (features.length > 0) {
        amenityAllocation = {
          items: features,
          nights: getNights()
        };
      }
    }

    onSave(booking.id, {
      id_card_image: idCardImage,
      guest_photo: guestPhoto,
      amenityAllocation: amenityAllocation,
      room_ids: JSON.stringify(selectedRoomIds) // Pass room assignments
    });
  };

  const getNights = () => {
    if (booking.check_in && booking.check_out) {
      const checkInDate = new Date(booking.check_in);
      const checkOutDate = new Date(booking.check_out);
      const diffMs = checkOutDate - checkInDate;
      const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
      return Math.max(diffDays, 1);
    }
    return 1;
  };

  const roomInfo = booking.rooms && booking.rooms.length > 0
    ? booking.rooms.map((room) => {
      const resolveType = (r) => {
        if (r?.type && r.type !== 'undefined') return r.type;
        const rtId = r?.room_type_id || r?.room?.room_type_id;
        return roomTypeObjects?.find(rt => rt.id === rtId)?.name || '';
      };
      if (booking.is_package) {
        const r = room?.room || room;
        return r?.number ? `${r.number}${resolveType(r) ? ` (${resolveType(r)})` : ''}` : '-';
      } else {
        return room?.number ? `${room.number}${resolveType(room) ? ` (${resolveType(room)})` : ''}` : '-';
      }
    }).join(", ")
    : "-";

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-md flex items-center justify-center z-[150] p-4 sm:p-6 overflow-y-auto">
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 20 }}
        className="bg-white/95 backdrop-blur-xl rounded-[2.5rem] shadow-[0_32px_64px_-16px_rgba(0,0,0,0.2)] w-full max-w-5xl overflow-hidden flex flex-col border border-white/20 relative"
      >
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-orange-500 via-rose-500 to-indigo-500 z-50"></div>

        {/* Header */}
        <div className="px-8 py-6 flex justify-between items-center border-b border-gray-100/50 bg-white/50 backdrop-blur-sm relative z-10">
          <div className="flex items-center gap-4">
            <div className="bg-gradient-to-br from-orange-600 to-rose-600 p-3.5 rounded-2xl shadow-lg shadow-orange-100 ring-4 ring-orange-50">
              <CheckCircle className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-xl sm:text-2xl font-bold text-slate-800 tracking-tight leading-none mb-1">Check-in Terminal</h2>
              <div className="flex items-center gap-2 mt-1.5">
                <span className="text-slate-400 text-[10px] font-bold uppercase tracking-wider leading-none pb-0.5">Activating Stay Details: {booking.display_id || `#${booking.id}`}</span>
                <span className={`text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-md border ${booking.is_package ? 'bg-indigo-50 text-indigo-600 border-indigo-200' : 'bg-blue-50 text-blue-600 border-blue-200'}`}>
                  {booking.is_package ? 'Package Stay' : 'Standard Stay'}
                </span>
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="group p-2.5 bg-slate-50 hover:bg-rose-50 text-slate-400 hover:text-rose-500 rounded-xl transition-all duration-300 border border-slate-100"
          >
            <X className="w-5 h-5 group-hover:rotate-90 transition-transform" />
          </button>
        </div>

        <div className="p-8 space-y-8 overflow-y-auto max-h-[75vh] custom-scrollbar relative z-10">
          {/* Active Tasks Warning */}
          {(activeTasks.services.length > 0 || activeTasks.orders.length > 0) && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-rose-50 border-2 border-rose-100 rounded-[2rem] p-6 mb-4 flex flex-col sm:flex-row items-center gap-6 shadow-xl shadow-rose-100/20"
            >
              <div className="w-14 h-14 rounded-2xl bg-rose-500 flex items-center justify-center shrink-0 shadow-lg shadow-rose-200">
                <AlertCircle className="w-8 h-8 text-white" />
              </div>
              <div className="flex-1">
                <h4 className="text-sm font-bold text-rose-800 uppercase tracking-tight mb-1">Unresolved Tasks for this Room</h4>
                <p className="text-[10px] font-bold text-rose-500 uppercase tracking-widest leading-relaxed">
                  System found {activeTasks.services.length} pending services and {activeTasks.orders.length} food orders from previous activity.
                  Please verify or clear these tasks before finalizing this check-in.
                </p>
              </div>
              <div className="flex gap-2">
                {activeTasks.services.length > 0 && (
                  <div className="px-4 py-2 bg-white rounded-xl border border-rose-100 text-[9px] font-bold text-rose-600 uppercase">
                    {activeTasks.services.length} SVCS
                  </div>
                )}
                {activeTasks.orders.length > 0 && (
                  <div className="px-4 py-2 bg-white rounded-xl border border-rose-100 text-[9px] font-bold text-orange-600 uppercase">
                    {activeTasks.orders.length} ORDERS
                  </div>
                )}
              </div>
            </motion.div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">

            {/* Left Section: Context & Credentials */}
            <div className="lg:col-span-5 space-y-6">
              <div className={`rounded-[2.5rem] p-8 border-2 transition-all duration-700 shadow-2xl relative overflow-hidden ${booking.is_package ? "bg-indigo-50/30 border-indigo-100 shadow-indigo-100/40" : "bg-blue-50/30 border-blue-100 shadow-blue-100/40"}`}>
                <div className="absolute top-0 right-0 w-32 h-32 bg-white/40 blur-3xl -mr-16 -mt-16"></div>

                <div className="relative z-10 space-y-6">
                  <div className="flex items-center gap-3">
                    <div className={`p-3 rounded-2xl shadow-sm ${booking.is_package ? "bg-indigo-500 text-white" : "bg-blue-500 text-white"}`}>
                      <LayoutDashboard className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="font-bold uppercase tracking-wider text-[10px] text-slate-800">Stay Details</h3>
                      <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">Core configuration</p>
                    </div>
                  </div>

                  <div className="space-y-6">
                    <div>
                      <p className="text-[9px] font-bold text-indigo-400 uppercase tracking-wide mb-2">Subject Identity</p>
                      <h4 className="font-bold text-slate-800 text-3xl tracking-tight leading-none">{booking.guest_name}</h4>
                    </div>

                    <div className="grid grid-cols-3 gap-2">
                      <div className="bg-white/60 p-4 rounded-2xl border border-white/50 shadow-sm">
                        <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest mb-1">Temporal Span</p>
                        <p className="font-bold text-slate-700 text-sm">{getNights()} Night(s)</p>
                      </div>
                      <div className="bg-white/60 p-4 rounded-2xl border border-white/50 shadow-sm text-center">
                        <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest mb-1">Rooms Booked</p>
                        <p className="font-bold text-emerald-600 text-sm">{booking.num_rooms || 1} Room(s)</p>
                      </div>
                      <div className="bg-white/60 p-4 rounded-2xl border border-white/50 shadow-sm text-right">
                        <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest mb-1">Room Category</p>
                        <p className="font-bold text-indigo-600 text-[10px] sm:text-sm">
                          {(() => {
                            if (booking.room_types_breakdown && Array.isArray(booking.room_types_breakdown) && booking.room_types_breakdown.length > 0) {
                              return booking.room_types_breakdown.map(b => `${b.count || 1}x ${b.name || 'Room'}`).join(', ');
                            }
                            if (booking.room_type_name) return booking.room_type_name;
                            const byTypeId = booking.room_type_id
                              ? roomTypeObjects?.find(rt => rt.id === booking.room_type_id)?.name
                              : null;
                            if (byTypeId) return byTypeId;
                            const firstRoom = booking.rooms?.[0];
                            const byRoomType = firstRoom?.room_type_id
                              ? roomTypeObjects?.find(rt => rt.id === firstRoom.room_type_id)?.name
                              : null;
                            if (byRoomType) return byRoomType;
                            if (firstRoom?.type && firstRoom.type !== 'undefined') return firstRoom.type;
                            return 'Any Category';
                          })()}
                        </p>
                      </div>
                    </div>

                    <div className="bg-slate-900 rounded-3xl p-5 shadow-xl">
                      <div className="flex items-center gap-2 mb-3">
                        <Home className="w-3 h-3 text-indigo-400" />
                        {(booking.rooms && booking.rooms.length > 0) ? (
                          <p className="text-[8px] font-bold text-emerald-400 uppercase tracking-wide">Allotted Sector(s) — Confirmed</p>
                        ) : (
                          <p className="text-[8px] font-bold text-orange-300 uppercase tracking-wide">Allotted Sector(s) — Assign {booking.num_rooms || 1} Room(s)</p>
                        )}
                      </div>
                      {(booking.rooms && booking.rooms.length > 0) ? (
                        <div className="space-y-1">
                          {booking.rooms.map((room, idx) => {
                            const resolveType = (r) => {
                              if (r?.type && r.type !== 'undefined') return r.type;
                              const rtId = r?.room_type_id;
                              return roomTypeObjects?.find(rt => rt.id === rtId)?.name || '';
                            };
                            const typeName = resolveType(room);
                            return (
                              <div key={idx} className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/30 rounded-xl px-3 py-2">
                                <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
                                <span className="font-bold text-white text-sm">Room {room.number}</span>
                                {typeName && <span className="text-[10px] text-emerald-400 font-bold uppercase tracking-widest">· {typeName}</span>}
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="space-y-3">
                          <p className="font-bold text-orange-400 text-[10px] uppercase tracking-widest">Action Required: Assign {booking.num_rooms || 1} Room(s)</p>
                          <div className="grid grid-cols-3 gap-2">
                            {availableRooms.map(room => (
                              <button
                                key={room.id}
                                onClick={() => {
                                  setSelectedRoomIds(prev =>
                                    prev.includes(room.id)
                                      ? prev.filter(id => id !== room.id)
                                      : [...prev, room.id]
                                  );
                                }}
                                className={`p-2 rounded-xl text-[10px] font-bold transition-all border ${selectedRoomIds.includes(room.id)
                                    ? "bg-indigo-600 text-white border-indigo-400"
                                    : "bg-slate-800 text-slate-400 border-slate-700 hover:border-indigo-500"
                                  }`}
                              >
                                {room.number}
                              </button>
                            ))}
                          </div>
                          {availableRooms.length === 0 && <p className="text-[9px] text-rose-400 font-bold">No available rooms of this type!</p>}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Biometric Evidence Zone */}
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="bg-emerald-100 p-2 rounded-xl">
                    <Camera className="w-4 h-4 text-emerald-600" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-800 uppercase tracking-widest text-[10px]">Credential Record</h3>
                    <p className="text-[8px] font-bold text-slate-400 uppercase tracking-tight">Digital verification of physical assets</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-6">
                  {/* ID Card */}
                  <div className="relative group">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => handleFileChange(e, "id")}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-30"
                    />
                    <div className={`p-6 rounded-[2.5rem] border-2 border-dashed transition-all duration-500 flex items-center justify-between group-hover:shadow-2xl group-hover:shadow-indigo-100 ${idCardPreview ? "bg-emerald-50/30 border-emerald-200" : "bg-slate-50 border-slate-200 group-hover:bg-white group-hover:border-indigo-400 group-hover:-translate-y-1"}`}>
                      <div className="flex items-center gap-5">
                        <div className={`w-16 h-16 rounded-2xl flex items-center justify-center shrink-0 shadow-lg ring-4 transition-all ${idCardPreview ? "bg-emerald-600 text-white ring-emerald-100" : "bg-white text-slate-400 ring-slate-100 group-hover:ring-indigo-50"}`}>
                          {idCardPreview ? <CheckCircle className="w-8 h-8" /> : <div className="text-sm font-bold">ID</div>}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-bold text-slate-800 uppercase tracking-widest truncate mb-0.5">{idCardPreview ? "ID Document Locked" : "Import ID Document"}</p>
                          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{idCardPreview ? "Verification Complete" : "Government Issued"}</p>
                        </div>
                      </div>

                      {idCardPreview ? (
                        <div className="relative group/preview w-20 h-16 rounded-2xl overflow-hidden border-2 border-white shadow-xl ring-2 ring-emerald-100">
                          <img src={idCardPreview} className="w-full h-full object-cover transition-transform duration-500 group-hover/preview:scale-110" alt="Preview" />
                          <div className="absolute inset-0 bg-black/20 opacity-0 group-hover/preview:opacity-100 transition-opacity flex items-center justify-center">
                            <RefreshCw className="w-4 h-4 text-white" />
                          </div>
                        </div>
                      ) : (
                        <div className="p-2 bg-indigo-50 text-indigo-600 rounded-full opacity-0 group-hover:opacity-100 transition-opacity">
                          <Plus className="w-4 h-4" />
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Portrait Capture */}
                  <div className="relative group">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => handleFileChange(e, "photo")}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-30"
                    />
                    <div className={`p-6 rounded-[2.5rem] border-2 border-dashed transition-all duration-500 flex items-center justify-between group-hover:shadow-2xl group-hover:shadow-rose-100 ${guestPhotoPreview ? "bg-rose-50/30 border-rose-200" : "bg-slate-50 border-slate-200 group-hover:bg-white group-hover:border-rose-400 group-hover:-translate-y-1"}`}>
                      <div className="flex items-center gap-5">
                        <div className={`w-16 h-16 rounded-2xl flex items-center justify-center shrink-0 shadow-lg ring-4 transition-all ${guestPhotoPreview ? "bg-rose-600 text-white ring-rose-100" : "bg-white text-slate-400 ring-slate-100 group-hover:ring-rose-50"}`}>
                          {guestPhotoPreview ? <CheckCircle className="w-8 h-8" /> : <Camera className="w-8 h-8" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-bold text-slate-800 uppercase tracking-widest truncate mb-0.5">{guestPhotoPreview ? "Portrait Captured" : "Secure Portrait"}</p>
                          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{guestPhotoPreview ? "Biometric Locked" : "Live Recognition"}</p>
                        </div>
                      </div>

                      {guestPhotoPreview ? (
                        <div className="relative group/preview w-20 h-16 rounded-2xl overflow-hidden border-2 border-white shadow-xl ring-2 ring-rose-100">
                          <img src={guestPhotoPreview} className="w-full h-full object-cover transition-transform duration-500 group-hover/preview:scale-110" alt="Preview" />
                          <div className="absolute inset-0 bg-black/20 opacity-0 group-hover/preview:opacity-100 transition-opacity flex items-center justify-center">
                            <RefreshCw className="w-4 h-4 text-white" />
                          </div>
                        </div>
                      ) : (
                        <div className="p-2 bg-rose-50 text-rose-600 rounded-full opacity-0 group-hover:opacity-100 transition-opacity">
                          <Plus className="w-4 h-4" />
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Section: Features & Allotment */}
            <div className="lg:col-span-7 space-y-6">
              {booking.is_package && booking.package && booking.package.food_included && (
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="bg-orange-50 p-2 rounded-xl">
                      <LayoutDashboard className="w-4 h-4 text-orange-600" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-bold text-slate-800 uppercase tracking-widest text-xs">Attribute Manifest</h3>
                      <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Configuration for complimentary units</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-6 max-h-[500px] overflow-y-auto px-1 custom-scrollbar">
                    {booking.package.food_included.split(",").map((feature) => {
                      const featureName = feature.trim();
                      if (!featureName) return null;
                      const isChecked = selectedFeatures[featureName] !== false;

                      return (
                        <div key={featureName} className={`rounded-[2.5rem] border-2 transition-all duration-500 overflow-hidden ${isChecked ? "bg-white border-orange-200 shadow-xl shadow-orange-100/30" : "bg-slate-50 border-slate-100 opacity-60 hover:opacity-100"}`}>
                          <div className="p-8 flex items-center justify-between">
                            <div className="flex items-center gap-5">
                              <div className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all ${isChecked ? "bg-orange-500 text-white shadow-lg shadow-orange-200" : "bg-slate-200 text-slate-400"}`}>
                                <Utensils className="w-6 h-6" />
                              </div>
                              <div>
                                <span className="block font-bold text-slate-800 uppercase tracking-tight text-sm leading-none mb-1">{featureName}</span>
                                <span className={`text-[9px] font-bold uppercase tracking-wider ${isChecked ? 'text-orange-500' : 'text-slate-400'}`}>
                                  {isChecked ? 'System Active' : 'Offline'}
                                </span>
                              </div>
                            </div>
                            <button
                              onClick={() => setSelectedFeatures((prev) => ({ ...prev, [featureName]: !isChecked }))}
                              className={`w-16 h-8 rounded-full relative transition-all duration-500 shadow-inner ${isChecked ? "bg-orange-500" : "bg-slate-300"}`}
                            >
                              <div className={`w-6 h-6 bg-white rounded-full absolute top-1 transition-all shadow-md duration-500 ${isChecked ? "right-1" : "left-1"}`}></div>
                            </button>
                          </div>

                          {isChecked && (
                            <motion.div
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: "auto" }}
                              className="px-8 pb-8 space-y-6 border-t border-slate-50 pt-8 bg-slate-50/30"
                            >
                              <div className="grid grid-cols-2 gap-6">
                                <div className="space-y-2">
                                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide ml-1">Spatial Date</label>
                                  <div className="relative">
                                    <input
                                      type="date"
                                      value={featureDates[featureName] || ""}
                                      min={new Date().toISOString().split('T')[0]}
                                      onChange={(e) => setFeatureDates(prev => ({ ...prev, [featureName]: e.target.value }))}
                                      className="w-full px-6 py-4 bg-white border-2 border-slate-100 rounded-2xl font-bold text-slate-700 text-xs focus:border-orange-500 outline-none transition-all shadow-sm"
                                    />
                                    <Calendar className="absolute right-5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300 pointer-events-none" />
                                  </div>
                                </div>
                                <div className="space-y-2">
                                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide ml-1">Temporal Time</label>
                                  <div className="relative">
                                    <input
                                      type="time"
                                      value={featureTimes[featureName] || ""}
                                      onChange={(e) => setFeatureTimes(prev => ({ ...prev, [featureName]: e.target.value }))}
                                      className="w-full px-6 py-4 bg-white border-2 border-slate-100 rounded-2xl font-bold text-slate-700 text-xs focus:border-orange-500 outline-none transition-all shadow-sm"
                                    />
                                    <Clock className="absolute right-5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300 pointer-events-none" />
                                  </div>
                                </div>
                              </div>

                              <div className="bg-white p-6 rounded-[2rem] border-2 border-slate-100 shadow-sm space-y-4">
                                <div className="flex items-center justify-between mb-2">
                                  <div className="flex items-center gap-2">
                                    <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" />
                                    <span className="text-[10px] font-bold text-slate-800 uppercase tracking-widest">Delicacy Manifest</span>
                                  </div>
                                  <button
                                    onClick={() => handleAddMenuItem(featureName)}
                                    className="px-4 py-2 bg-slate-900 text-white rounded-xl text-[9px] font-bold uppercase tracking-wider hover:bg-indigo-600 transition-all shadow-lg shadow-slate-200"
                                  >
                                    + Add Item
                                  </button>
                                </div>

                                <div className="space-y-3">
                                  {(featureMenuSelections[featureName] || []).map((item, idx) => (
                                    <motion.div
                                      initial={{ opacity: 0, x: -10 }}
                                      animate={{ opacity: 1, x: 0 }}
                                      key={idx}
                                      className="flex gap-3 items-center group"
                                    >
                                      <div className="flex-1 relative">
                                        <div className="relative w-full">
                                          <input
                                            type="text"
                                            placeholder="Choose Delicacy..."
                                            value={item.searchQuery !== undefined ? item.searchQuery : (foodItems.find(f => String(f.id) === String(item.foodItemId))?.name || "")}
                                            onChange={(e) => {
                                              handleUpdateMenuItem(featureName, idx, "searchQuery", e.target.value);
                                              handleUpdateMenuItem(featureName, idx, "isOpen", true);
                                            }}
                                            onFocus={() => {
                                              const currentFood = foodItems.find(f => String(f.id) === String(item.foodItemId));
                                              handleUpdateMenuItem(featureName, idx, "searchQuery", currentFood ? currentFood.name : "");
                                              handleUpdateMenuItem(featureName, idx, "isOpen", true);
                                            }}
                                            onBlur={() => {
                                              setTimeout(() => {
                                                handleUpdateMenuItem(featureName, idx, "isOpen", false);
                                                const currentFood = foodItems.find(f => String(f.id) === String(item.foodItemId));
                                                handleUpdateMenuItem(featureName, idx, "searchQuery", currentFood ? currentFood.name : "");
                                              }, 200);
                                            }}
                                            className="w-full px-5 py-3.5 bg-slate-50 border-2 border-transparent rounded-xl font-bold text-slate-700 text-[11px] outline-none focus:bg-white focus:border-indigo-500 transition-all"
                                          />
                                          {item.isOpen && (
                                            <div className="absolute z-50 left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-lg max-h-60 overflow-y-auto">
                                              {foodItems
                                                .filter(f => {
                                                  const q = (item.searchQuery || "").toLowerCase();
                                                  return f.name.toLowerCase().includes(q);
                                                })
                                                .map(f => (
                                                  <div
                                                    key={f.id}
                                                    onMouseDown={() => {
                                                      setFeatureMenuSelections(prev => {
                                                        const current = [...(prev[featureName] || [])];
                                                        current[idx] = { 
                                                          ...current[idx], 
                                                          foodItemId: String(f.id), 
                                                          name: f.name, 
                                                          searchQuery: f.name,
                                                          isOpen: false 
                                                        };
                                                        return { ...prev, [featureName]: current };
                                                      });
                                                    }}
                                                    className="px-4 py-2 hover:bg-slate-100 cursor-pointer text-slate-700 font-bold text-[10px] text-left border-b border-slate-50 last:border-0"
                                                  >
                                                    {f.name}
                                                  </div>
                                                ))}
                                              {foodItems.filter(f => f.name.toLowerCase().includes((item.searchQuery || "").toLowerCase())).length === 0 && (
                                                <div className="px-4 py-3 text-[10px] text-slate-400 italic text-center font-bold">No delicacies found</div>
                                              )}
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                      <input
                                        type="number"
                                        min="1"
                                        value={item.quantity}
                                        onChange={(e) => handleUpdateMenuItem(featureName, idx, "quantity", e.target.value)}
                                        className="w-20 px-3 py-3.5 bg-slate-50 border-2 border-transparent rounded-xl font-bold text-slate-700 text-center text-[11px] outline-none focus:bg-white focus:border-indigo-500 transition-all"
                                      />
                                      <button onClick={() => handleRemoveMenuItem(featureName, idx)} className="p-3 bg-rose-50 text-rose-500 hover:bg-rose-100 rounded-xl transition-all"><Trash2 className="w-4 h-4" /></button>
                                    </motion.div>
                                  ))}
                                  {(!featureMenuSelections[featureName] || featureMenuSelections[featureName].length === 0) && (
                                    <div className="text-center py-6 border-2 border-dashed border-slate-100 rounded-2xl">
                                      <p className="text-[10px] font-bold text-slate-300 uppercase tracking-widest italic">No delicacies allotted</p>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </motion.div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Control Center Footer */}
        <div className="px-10 py-8 bg-slate-900 border-t border-white/5 flex flex-col sm:flex-row gap-6 relative z-10">
          <button
            onClick={onClose}
            className="flex-1 px-8 py-5 bg-white/5 text-slate-400 rounded-2xl font-bold uppercase tracking-wide text-[10px] hover:text-white hover:bg-white/10 transition-all"
          >
            Abort Protocol
          </button>
          <button
            onClick={handleSave}
            disabled={isSubmitting || !idCardImage || !guestPhoto}
            className="flex-[2] px-12 py-5 bg-gradient-to-r from-orange-500 via-rose-500 to-indigo-600 text-white rounded-2xl font-bold uppercase tracking-wide text-[10px] hover:shadow-[0_20px_40px_-10px_rgba(244,63,94,0.4)] transition-all flex items-center justify-center gap-4 active:scale-95 disabled:opacity-20 disabled:grayscale disabled:cursor-not-allowed group shadow-xl"
          >
            {isSubmitting ? (
              <RefreshCw className="w-5 h-5 animate-spin" />
            ) : (
              <UserCheck className="w-5 h-5 group-hover:scale-110 transition-transform" />
            )}
            <span>Execute Final Activation</span>
          </button>
        </div>
      </motion.div>
    </div>
  );
};

const BookingStatusChart = React.memo(({ data }) => {
  const chartData = useMemo(() => {
    const statusCounts = data.reduce((acc, booking) => {
      const rawStatus = booking.status || "";
      const normalizedStatus = rawStatus.toLowerCase().trim().replace(/[-_]/g, "-");
      // Format status nicely, e.g., 'checked-in' -> 'Checked In', 'booked' -> 'Booked'
      const formattedStatus = normalizedStatus
        .split("-")
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" ");
      acc[formattedStatus] = (acc[formattedStatus] || 0) + 1;
      return acc;
    }, {});

    return {
      labels: Object.keys(statusCounts),
      datasets: [
        {
          data: Object.values(statusCounts),
          backgroundColor: [
            "rgba(79, 70, 229, 0.7)", // indigo
            "rgba(34, 197, 94, 0.7)", // green
            "rgba(239, 68, 68, 0.7)", // red
            "rgba(107, 114, 128, 0.7)", // gray
          ],
          borderColor: [
            "rgba(79, 70, 229, 1)",
            "rgba(34, 197, 94, 1)",
            "rgba(239, 68, 68, 1)",
            "rgba(107, 114, 128, 1)",
          ],
          borderWidth: 1,
        },
      ],
    };
  }, [data]);

  return (
    <div className="bg-white p-6 rounded-2xl shadow-lg flex-1">
      <h3 className="text-xl font-bold mb-4 text-gray-800">
        Bookings by Status
      </h3>
      <div className="w-full h-64 flex items-center justify-center">
        <Pie data={chartData} />
      </div>
    </div>
  );
});
BookingStatusChart.displayName = "BookingStatusChart";

// New Enhanced Booking Form Modal
const BookingFormModal = ({
  isOpen, onClose, bookingTab, setBookingTab,
  formData, handleChange, handleRoomTypeChange, handleSubmit,
  handleAddRoomType, handleRemoveRoomType,
  isSubmitting, isLoading, roomTypes, roomTypeObjects, filteredRooms, handleRoomNumberToggle,
  packageBookingForm, handlePackageBookingChange, handlePackageBookingSubmit,
  packages, packageRooms, handlePackageRoomSelect,
  today, formatCurrency, RoomSelection, feedback,
  showBannerMessage, gstSettings, isEditMode
}) => {
  if (!isOpen) return null;

  const selectedItems = formData.selectedRoomTypes || [];

  const nights = React.useMemo(() => {
    if (!formData.checkIn || !formData.checkOut) return 0;
    const from = new Date(formData.checkIn);
    const to = new Date(formData.checkOut);
    const diffTime = to.getTime() - from.getTime();
    return Math.max(1, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
  }, [formData.checkIn, formData.checkOut]);

  const currentUnsavedItem = React.useMemo(() => {
    if (!formData.room_type_id) return null;
    const selectedType = roomTypeObjects.find(rt => rt.id === Number(formData.room_type_id));
    if (!selectedType) return null;

    return {
      room_type_id: selectedType.id,
      room_type_name: selectedType.name,
      num_rooms: parseInt(formData.num_rooms) || 1,
      adults: parseInt(formData.adults) || 1,
      children: parseInt(formData.children) || 0,
      isUnsavedPreview: true
    };
  }, [formData.room_type_id, formData.num_rooms, formData.adults, formData.children, roomTypeObjects]);

  const allBookingItems = React.useMemo(() => {
    const list = [...selectedItems];
    if (currentUnsavedItem) {
      list.push(currentUnsavedItem);
    }
    return list;
  }, [selectedItems, currentUnsavedItem]);

  // Calculate total rooms for the entire reservation (cart + current preview)
  const totalRoomsForCalc = React.useMemo(() => {
    const cartRooms = (formData.selectedRoomTypes || []).reduce((sum, item) => sum + (parseInt(item.num_rooms) || 1), 0);
    const previewRooms = formData.room_type_id ? (parseInt(formData.num_rooms) || 1) : 0;
    return Math.max(1, cartRooms + previewRooms);
  }, [formData.selectedRoomTypes, formData.room_type_id, formData.num_rooms]);

  // Derived pricing totals
  const { totalBase, totalGST, grandTotal, isInclusiveGlobally } = React.useMemo(() => {
    const base = parseFloat(formData.custom_room_rate) || 0;
    
    // Distribute base and calculate GST based on backend slab logic
    const items = [...(formData.selectedRoomTypes || [])];
    if (formData.room_type_id) {
        items.push({ num_rooms: parseInt(formData.num_rooms) || 1 });
    }

    const isInclusive = gstSettings && String(gstSettings.gst_inclusive) === "true";

    const gstData = items.reduce((acc, item) => {
      const itemRooms = parseInt(item.num_rooms) || 1;
      // Item's share of the global base
      const itemBaseShare = (base / totalRoomsForCalc) * itemRooms;
      const dailyRatePerRoom = itemBaseShare / (Math.max(1, nights) * itemRooms);
      
      let taxRate = 0.18; // Default
      
      if (gstSettings) {
        if (gstSettings.gst_room_type === "MANUAL") {
          taxRate = parseFloat(gstSettings.room_gst_rate || 12) / 100;
        } else {
          const r1 = parseFloat(gstSettings.gst_slab_rate_1 || 5) / 100;
          const r2 = parseFloat(gstSettings.gst_slab_rate_2 || 12) / 100;
          const r3 = parseFloat(gstSettings.gst_slab_rate_3 || 18) / 100;

          if (dailyRatePerRoom < 5000) {
            taxRate = r1;
          } else if (dailyRatePerRoom < 7500) {
            taxRate = r2;
          } else {
            taxRate = r3;
          }
        }
      } else {
        // Fallback to legacy hardcoded logic if settings aren't loaded
        if (dailyRatePerRoom < 7500) taxRate = 0.12;
      }
      
      let itemGst = 0;
      let itemTrueBase = itemBaseShare;
      
      if (isInclusive) {
        itemGst = itemBaseShare - (itemBaseShare / (1 + taxRate));
        itemTrueBase = itemBaseShare - itemGst;
      } else {
        itemGst = itemBaseShare * taxRate;
      }
      
      return {
        gst: acc.gst + itemGst,
        trueBase: acc.trueBase + itemTrueBase
      };
    }, { gst: 0, trueBase: 0 });
    
    return { 
        totalBase: isInclusive ? gstData.trueBase : base, 
        totalGST: gstData.gst, 
        grandTotal: isInclusive ? base : base + gstData.gst,
        isInclusiveGlobally: isInclusive
    };
  }, [formData.custom_room_rate, formData.selectedRoomTypes, formData.room_type_id, formData.num_rooms, totalRoomsForCalc, nights, gstSettings]);

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-md flex items-center justify-center z-[100] p-2 sm:p-4 overflow-y-auto overflow-x-hidden">
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 40 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 40 }}
        transition={{ type: "spring", damping: 25, stiffness: 300 }}
        className="bg-white/95 backdrop-blur-xl rounded-[1.5rem] shadow-[0_32px_64px_-16px_rgba(0,0,0,0.2)] w-full max-w-6xl max-h-[95vh] overflow-hidden flex flex-col border border-white/20 relative"
        onClick={(e) => e.stopPropagation()}
      >

        {/* Animated Background Gradients */}
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-rose-500 z-50"></div>
        <div className="absolute -top-24 -right-24 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none"></div>
        <div className="absolute -bottom-24 -left-24 w-64 h-64 bg-rose-500/10 rounded-full blur-3xl pointer-events-none"></div>

        {/* Modal Header - Premium Glassy Version */}
        <div className="px-6 py-4 flex justify-between items-center border-b border-gray-100/50 shrink-0 bg-white/50 backdrop-blur-sm relative z-10">
          <div className="flex items-center gap-4">
            <div className="bg-gradient-to-br from-indigo-600 to-violet-600 p-2.5 rounded-xl shadow-lg shadow-indigo-200 ring-2 ring-indigo-50">
              <Plus className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-xl sm:text-2xl font-bold text-slate-800 tracking-tight leading-none mb-1">{isEditMode ? "Edit Reservation" : "Reservation Center"}</h2>
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                <p className="text-slate-500 text-xs font-semibold uppercase tracking-wider opacity-80">{isEditMode ? "Edit Booking Data" : "New Booking Terminal"}</p>
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="group p-2 bg-slate-50 hover:bg-rose-50 text-slate-400 hover:text-rose-500 rounded-xl transition-all duration-300 border border-slate-100 hover:border-rose-100"
          >
            <X className="w-5 h-5 group-hover:rotate-90 transition-transform duration-300" />
          </button>
        </div>

        {/* Dynamic Tab Navigation */}
        <div className="px-6 pt-4 relative z-10">
          <div className="bg-slate-100/80 backdrop-blur-sm p-1 rounded-xl flex gap-2 border border-slate-200/50">
            <button
              onClick={() => setBookingTab("room")}
              className={`flex-1 py-2.5 px-4 rounded-lg flex items-center justify-center gap-2 font-bold transition-all duration-500 relative overflow-hidden ${bookingTab === "room"
                ? "bg-white text-indigo-700 shadow-[0_8px_16px_-4px_rgba(79,70,229,0.15)] ring-1 ring-indigo-100"
                : "text-slate-500 hover:bg-white/50 hover:text-slate-700"
                }`}
            >
              <Home className={`w-4 h-4 relative z-10 ${bookingTab === "room" ? "text-indigo-600" : ""}`} />
              <span className="relative z-10 text-xs uppercase tracking-widest">Standard Suite</span>
            </button>
            <button
              onClick={() => setBookingTab("package")}
              className={`flex-1 py-2.5 px-4 rounded-lg flex items-center justify-center gap-2 font-bold transition-all duration-500 relative overflow-hidden ${bookingTab === "package"
                ? "bg-white text-violet-700 shadow-[0_8px_16px_-4px_rgba(139,92,246,0.15)] ring-1 ring-violet-100"
                : "text-slate-500 hover:bg-white/50 hover:text-slate-700"
                }`}
            >
              <PackageIcon className={`w-4 h-4 relative z-10 ${bookingTab === "package" ? "text-violet-600" : ""}`} />
              <span className="relative z-10 text-xs uppercase tracking-widest">Premium Package</span>
            </button>
          </div>
        </div>

        {/* Modal Body Container */}
        <div className="flex-1 overflow-y-auto p-6 custom-scrollbar relative z-10">
          <AnimatePresence mode="wait">
            {feedback.message && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: -20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: -20 }}
                className={`mb-8 p-5 rounded-3xl flex items-center gap-4 border-2 ${feedback.type === "success"
                  ? "bg-emerald-50/80 border-emerald-100 text-emerald-800"
                  : "bg-rose-50/80 border-rose-100 text-rose-800"
                  } backdrop-blur-md`}
              >
                <div className={`p-2 rounded-xl ${feedback.type === "success" ? "bg-emerald-500" : "bg-rose-500"} text-white`}>
                  {feedback.type === "success" ? <CheckCircle className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
                </div>
                <div className="flex-1">
                  <p className="font-bold text-sm uppercase tracking-wide leading-none mb-1">{feedback.type === "success" ? "Assignment Successful" : "Attention Required"}</p>
                  <p className="font-semibold text-sm opacity-90">
                    {typeof feedback.message === 'string' 
                      ? feedback.message 
                      : (Array.isArray(feedback.message) 
                          ? feedback.message.map(d => d?.msg || (typeof d === 'string' ? d : JSON.stringify(d))).join(', ') 
                          : (feedback.message?.msg || feedback.message?.message || JSON.stringify(feedback.message || '')))}
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence mode="wait">
            {bookingTab === "room" ? (
              <motion.form
                key="room-form"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                onSubmit={handleSubmit}
                className="grid grid-cols-1 lg:grid-cols-12 gap-6"
              >
                {/* Left Column: Guest Details */}
                <div className="lg:col-span-7 space-y-6">
                  <div className="space-y-4">
                    <div className="flex items-center gap-2">
                      <div className="bg-indigo-50 p-1.5 rounded-lg">
                        <User className="w-4 h-4 text-indigo-600" />
                      </div>
                      <h3 className="text-base font-bold text-slate-800 tracking-tight">Guest Profile</h3>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Full Legal Name</label>
                        <div className="group relative">
                          <User className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 group-focus-within:text-indigo-600 transition-colors" />
                          <input
                            type="text"
                            name="guestName"
                            value={formData.guestName}
                            onChange={handleChange}
                            placeholder="e.g. Alexander Pierce"
                            className="w-full pl-10 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 focus:bg-white transition-all outline-none font-bold text-slate-700 text-sm"
                            required
                          />
                        </div>
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Contact Hotline</label>
                        <div className="group relative">
                          <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 group-focus-within:text-indigo-600 transition-colors" />
                          <input
                            type="text"
                            name="guestMobile"
                            value={formData.guestMobile}
                            onChange={handleChange}
                            placeholder="+91 88000 00000"
                            className="w-full pl-10 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 focus:bg-white transition-all outline-none font-bold text-slate-700 text-sm"
                            required
                          />
                        </div>
                      </div>
                      <div className="md:col-span-1 space-y-1">
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Electronic Mail</label>
                        <div className="group relative">
                          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 group-focus-within:text-indigo-600 transition-colors" />
                          <input
                            type="email"
                            name="guestEmail"
                            value={formData.guestEmail}
                            onChange={handleChange}
                            placeholder="alexander@resort.com"
                            className="w-full pl-10 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 focus:bg-white transition-all outline-none font-bold text-slate-700 text-sm"
                          />
                        </div>
                      </div>
                      <div className="md:col-span-1 space-y-1">
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">GST Number (Optional)</label>
                        <div className="group relative">
                          <input
                            type="text"
                            name="gstNumber"
                            value={formData.gstNumber}
                            onChange={handleChange}
                            placeholder="Enter Guest GST Number"
                            className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 focus:bg-white transition-all outline-none font-bold text-slate-700 text-sm"
                          />
                        </div>
                      </div>
                      <div className="md:col-span-1 space-y-1">
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Booking Source</label>
                        <div className="group relative">
                          <ExternalLink className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 group-focus-within:text-indigo-600 transition-colors" />
                          <select
                            name="source"
                            value={formData.source}
                            onChange={handleChange}
                            className="w-full pl-10 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 focus:bg-white transition-all outline-none font-bold text-slate-700 text-sm appearance-none"
                            required
                          >
                            <option value="Admin">Direct Admin</option>
                            <option value="Web">Website</option>
                            <option value="OTA">OTA (Booking/Expedia)</option>
                            <option value="Call">Phone Call</option>
                            <option value="Direct">Walk-in Guest</option>
                          </select>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4 pt-4 border-t border-slate-100">
                    <div className="flex items-center gap-2">
                      <div className="bg-rose-50 p-1.5 rounded-lg">
                        <Calendar className="w-4 h-4 text-rose-600" />
                      </div>
                      <h3 className="text-base font-bold text-slate-800 tracking-tight">Stay Schedule</h3>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Arrival Date</label>
                        <div className="relative">
                          <input
                            type="date"
                            name="checkIn"
                            value={formData.checkIn}
                            onChange={handleChange}
                            min={today}
                            className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-4 focus:ring-rose-500/10 focus:border-rose-500 focus:bg-white transition-all outline-none font-bold text-slate-700 text-sm"
                            required
                          />
                        </div>
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Departure Date</label>
                        <div className="relative">
                          <input
                            type="date"
                            name="checkOut"
                            value={formData.checkOut}
                            onChange={handleChange}
                            min={formData.checkIn || today}
                            className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-4 focus:ring-rose-500/10 focus:border-rose-500 focus:bg-white transition-all outline-none font-bold text-slate-700 text-sm"
                            required
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Right Column: Room Selection & Capacity */}
                <div className="lg:col-span-5 flex flex-col gap-6">
                  {/* Configuration Input Card */}
                  <div className="bg-slate-50/50 rounded-[1.5rem] p-6 border border-slate-200/60 flex flex-col">
                    <div className="space-y-4 flex-1">
                      <div className="flex items-center justify-between">
                        <h3 className="text-base font-bold text-slate-800 tracking-tight font-sans">Configuration</h3>
                      </div>

                      <div className="space-y-4">
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide ml-1">Room Category</label>
                          <select
                            name="room_type_id"
                            value={formData.room_type_id || ""}
                            onChange={handleRoomTypeChange}
                            className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-xl focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all outline-none appearance-none font-bold text-slate-700 shadow-sm text-sm"
                            required={!formData.selectedRoomTypes || formData.selectedRoomTypes.length === 0}
                          >
                            <option value="">Choose Category</option>
                            {roomTypeObjects.map((type) => (
                              <option key={type.id} value={type.id}>{type.name}</option>
                            ))}
                          </select>
                        </div>

                        {formData.room_type_id && (
                          <>
                            <div className="space-y-1">
                              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide ml-1">Base Room Traffic ({isInclusiveGlobally ? 'Incl. GST' : 'Excl. GST'})</label>
                              <div className="group relative">
                                <div className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-slate-400 group-focus-within:text-indigo-600 transition-colors text-xs">₹</div>
                                <input
                                  type="number"
                                  name="custom_room_rate"
                                  value={formData.custom_room_rate}
                                  onChange={handleChange}
                                  placeholder="0.00"
                                  className="w-full pl-8 pr-3 py-2.5 bg-white border border-slate-200 rounded-xl focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all outline-none font-bold text-slate-700 shadow-sm text-sm"
                                />
                              </div>
                              <p className="text-[9px] text-slate-400 ml-1 font-medium italic">* Base amount for entire stay (all rooms & nights)</p>
                            </div>

                            <div className="grid grid-cols-3 gap-4">
                              <div className="space-y-1">
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide ml-1">No. of Rooms</label>
                                <input
                                  type="number"
                                  name="num_rooms"
                                  value={formData.num_rooms || 1}
                                  onChange={handleChange}
                                  min="1"
                                  className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-xl focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all outline-none font-bold text-slate-700 shadow-sm text-sm"
                                />
                              </div>
                              <div className="space-y-1">
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide ml-1">Adults</label>
                                <input
                                  type="number"
                                  name="adults"
                                  value={formData.adults}
                                  onChange={handleChange}
                                  min="1"
                                  className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-xl focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all outline-none font-bold text-slate-700 shadow-sm text-sm"
                                />
                              </div>
                              <div className="space-y-1">
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide ml-1">Children</label>
                                <input
                                type="number"
                                name="children"
                                value={formData.children}
                                onChange={handleChange}
                                min="0"
                                className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-xl focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all outline-none font-bold text-slate-700 shadow-sm text-sm"
                                />
                                </div>
                                </div>
                                </>
                                )}
                      </div>

                      {formData.room_type_id && (
                        <button
                          type="button"
                          onClick={handleAddRoomType}
                          className="w-full mt-4 py-2.5 px-4 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-extrabold rounded-xl transition-all duration-300 flex items-center justify-center gap-2 border border-indigo-100/50 hover:border-indigo-200 active:scale-95 text-xs uppercase tracking-wider"
                        >
                          <Plus className="w-4 h-4" />
                          Add Room Type
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Selections / Booking Summary Card */}
                  {allBookingItems.length > 0 && (
                    <div className="bg-slate-50/50 rounded-[1.5rem] p-6 border border-slate-200/60 flex flex-col gap-4">
                      <div className="flex items-center justify-between">
                        <h3 className="text-sm font-bold text-slate-800 tracking-tight font-sans">Selected Categories</h3>
                        <span className="px-2.5 py-1 bg-indigo-50 text-indigo-700 text-[10px] font-bold rounded-lg uppercase tracking-wide">
                          {totalRoomsForCalc} {totalRoomsForCalc === 1 ? "Room" : "Rooms"} • {nights} {nights === 1 ? "Night" : "Nights"}
                        </span>
                      </div>
                      
                      <div className="space-y-3 max-h-[220px] overflow-y-auto pr-1 custom-scrollbar">
                        {selectedItems.map((item) => {
                          const itemBase = totalRoomsForCalc > 0 ? (totalBase / totalRoomsForCalc) * (item.num_rooms || 1) : 0;
                          return (
                            <div key={item.id} className="bg-white p-3.5 rounded-xl border border-slate-100 shadow-sm flex items-center justify-between gap-3 group/item hover:border-slate-200 transition-all duration-300">
                              <div className="flex-1 min-w-0">
                                <p className="font-bold text-slate-700 text-sm truncate flex items-center gap-1.5">
                                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-500"></span>
                                  {item.room_type_name}
                                </p>
                                <p className="text-[10px] text-slate-400 font-semibold mt-0.5">
                                  {item.num_rooms} {item.num_rooms === 1 ? "Room" : "Rooms"} • {item.adults} Adults {item.children > 0 ? `, ${item.children} Children` : ""}
                                </p>
                                <p className="text-[10px] text-indigo-600 font-bold mt-1">
                                  Base Traffic (Pre-tax)
                                </p>
                                {itemBase > 0 && nights > 0 && (
                                  <p className="text-[9px] text-slate-500 font-medium mt-0.5">
                                    Calculation: {formatCurrency(itemBase)} / {item.num_rooms} {item.num_rooms === 1 ? 'room' : 'rooms'} / {nights} {nights === 1 ? 'night' : 'nights'} = 
                                    <span className="font-bold text-indigo-600 ml-1">
                                      {formatCurrency(itemBase / (item.num_rooms * nights))} / night
                                    </span>
                                  </p>
                                )}
                              </div>
                              <div className="text-right shrink-0 flex items-center gap-3">
                                <div>
                                  <p className="font-extrabold text-slate-800 text-sm">
                                    {formatCurrency ? formatCurrency(itemBase) : '₹' + Number(itemBase).toFixed(2)}
                                  </p>
                                  <p className="text-[8px] text-slate-400 font-bold uppercase tracking-wider">Subtotal</p>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => handleRemoveRoomType(item.id)}
                                  className="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-500 hover:text-rose-600 rounded-lg transition-colors border border-rose-100"
                                  title="Remove room type"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          );
                        })}

                        {currentUnsavedItem && (
                          <div className="bg-amber-50/40 p-3.5 rounded-xl border border-amber-100/70 border-dashed shadow-sm flex items-center justify-between gap-3 relative overflow-hidden">
                            {(() => {
                              const itemBase = totalRoomsForCalc > 0 ? (totalBase / totalRoomsForCalc) * (currentUnsavedItem.num_rooms || 1) : 0;
                              return (
                                <>
                                  <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/5 rounded-full blur-xl pointer-events-none"></div>
                                  <div className="flex-1 min-w-0">
                                    <p className="font-bold text-amber-800 text-sm truncate flex items-center gap-1.5">
                                      <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>
                                      {currentUnsavedItem.room_type_name}
                                    </p>
                                    <p className="text-[10px] text-amber-600 font-semibold mt-0.5">
                                      {currentUnsavedItem.num_rooms} {currentUnsavedItem.num_rooms === 1 ? "Room" : "Rooms"} • {currentUnsavedItem.adults} Guests (Configuring)
                                    </p>
                                    <p className="text-[10px] text-amber-700 font-bold mt-1">
                                      Base Traffic (Pre-tax)
                                    </p>
                                    {itemBase > 0 && nights > 0 && (
                                      <p className="text-[9px] text-amber-600/80 font-medium mt-0.5">
                                        Calculation: {formatCurrency(itemBase)} / {currentUnsavedItem.num_rooms} {currentUnsavedItem.num_rooms === 1 ? 'room' : 'rooms'} / {nights} {nights === 1 ? 'night' : 'nights'} = 
                                        <span className="font-bold text-amber-700 ml-1">
                                          {formatCurrency(itemBase / (currentUnsavedItem.num_rooms * nights))} / night
                                        </span>
                                      </p>
                                    )}
                                  </div>
                                  <div className="text-right shrink-0 flex flex-col items-end justify-center">
                                    <p className="font-extrabold text-amber-800 text-sm">
                                      {formatCurrency ? formatCurrency(itemBase) : '₹' + Number(itemBase).toFixed(2)}
                                    </p>
                                    <span className="px-1.5 py-0.5 mt-1 bg-amber-100 text-amber-800 text-[8px] font-bold rounded uppercase tracking-wider inline-block">Unsaved Preview</span>
                                  </div>
                                </>
                              );
                            })()}
                          </div>
                        )}
                      </div>

                      {/* Grand Total Glassmorphic Card */}
                      <div className="mt-2 bg-gradient-to-br from-slate-900 to-indigo-950 p-6 rounded-3xl text-white shadow-2xl relative overflow-hidden border border-slate-800 space-y-4">
                        <div className="absolute -right-10 -bottom-10 w-48 h-48 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none"></div>
                        <div className="absolute -left-10 -top-10 w-48 h-48 bg-rose-500/10 rounded-full blur-3xl pointer-events-none"></div>
                        
                        <div className="relative z-10 flex flex-col gap-3">
                          <div className="flex justify-between items-center text-slate-400">
                            <span className="text-[10px] font-bold uppercase tracking-widest">Base Room Traffic</span>
                            <span className="text-sm font-bold tracking-tight">{formatCurrency(totalBase)}</span>
                          </div>
                          <div className="flex justify-between items-center text-indigo-300">
                            <span className="text-[10px] font-bold uppercase tracking-widest">Calculated GST (Taxes)</span>
                            <span className="text-sm font-bold tracking-tight">+{formatCurrency(totalGST)}</span>
                          </div>
                          <div className="h-px bg-white/10 my-1"></div>
                          <div className="flex justify-between items-end">
                            <div>
                              <p className="text-[10px] text-slate-300 font-black uppercase tracking-widest leading-none mb-1">Final Booking Total</p>
                              <p className="text-[9px] text-indigo-400 font-bold uppercase tracking-wider leading-none">Net Payable for {nights} night(s)</p>
                            </div>
                            <div className="text-right">
                              <p className="text-3xl font-black tracking-tighter text-white leading-none">
                                {formatCurrency ? formatCurrency(grandTotal) : '₹' + grandTotal.toLocaleString()}
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Submit Action Bar */}
                <div className="lg:col-span-12 pt-6 flex flex-col sm:flex-row justify-end gap-3 border-t border-slate-100 sticky bottom-[-1.5rem] bg-white/90 backdrop-blur-xl -mx-6 px-6 pb-2 z-50">
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-6 py-3 bg-slate-100 text-slate-600 rounded-xl font-bold uppercase tracking-wider text-[10px] hover:bg-slate-200 transition-all duration-300"
                  >
                    Discard
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting || isLoading || (!formData.room_type_id && formData.roomNumbers.length === 0 && (!formData.selectedRoomTypes || formData.selectedRoomTypes.length === 0))}
                    className="group px-8 py-3 bg-gradient-to-r from-indigo-600 to-violet-600 text-white rounded-xl font-bold uppercase tracking-wide text-[10px] hover:shadow-xl hover:shadow-indigo-500/30 transition-all duration-500 flex items-center justify-center gap-2 active:scale-95 disabled:opacity-30 disabled:grayscale disabled:cursor-not-allowed"
                  >
                    {isSubmitting ? (
                      <><Clock className="w-4 h-4 animate-spin" /> Finalizing...</>
                    ) : (
                      <>
                        <Save className="w-4 h-4 group-hover:scale-110 transition-transform" />
                        Execute Booking
                      </>
                    )}
                  </button>
                </div>
              </motion.form>
            ) : (
              <motion.form
                key="package-form"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                onSubmit={handlePackageBookingSubmit}
                className="space-y-6"
              >
                {/* Premium Package Layout */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                  <div className="lg:col-span-6 space-y-6">
                    <div className="space-y-4">
                      <div className="flex items-center gap-2">
                        <div className="bg-violet-50 p-1.5 rounded-lg">
                          <PackageIcon className="w-4 h-4 text-violet-600" />
                        </div>
                        <h3 className="text-base font-bold text-slate-800 tracking-tight">Package Definition</h3>
                      </div>
                      <div className="relative group">
                        <div className="absolute -inset-1 bg-gradient-to-r from-violet-500 to-fuchsia-500 rounded-2xl blur opacity-25 group-hover:opacity-40 transition duration-500"></div>
                        <select
                          name="package_id"
                          value={packageBookingForm.package_id}
                          onChange={handlePackageBookingChange}
                          className="relative w-full px-4 py-3 bg-white border border-violet-100 text-slate-800 font-bold rounded-xl focus:ring-4 focus:ring-violet-500/10 focus:border-violet-500 transition-all outline-none shadow-sm text-sm"
                          required
                        >
                          <option value="">-- Explore Premium Packages --</option>
                          {packages.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.title} • {formatCurrency(p.price)}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="space-y-4 pt-4 border-t border-slate-100">
                      <div className="flex items-center gap-2">
                        <div className="bg-indigo-50 p-1.5 rounded-lg">
                          <User className="w-4 h-4 text-indigo-600" />
                        </div>
                        <h3 className="text-base font-bold text-slate-800 tracking-tight">Lead Guest Info</h3>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <input
                          name="guest_name"
                          placeholder="Lead Name"
                          value={packageBookingForm.guest_name}
                          onChange={handlePackageBookingChange}
                          className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-4 focus:ring-violet-500/10 focus:border-violet-500 transition-all outline-none font-bold shadow-sm text-sm"
                          required
                        />
                        <input
                          name="guest_mobile"
                          placeholder="Contact Number"
                          value={packageBookingForm.guest_mobile}
                          onChange={handlePackageBookingChange}
                          className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-4 focus:ring-violet-500/10 focus:border-violet-500 transition-all outline-none font-bold shadow-sm text-sm"
                          required
                        />
                        <div className="md:col-span-2">
                          <input
                            type="email"
                            name="guest_email"
                            placeholder="Email Confirmation Address"
                            value={packageBookingForm.guest_email}
                            onChange={handlePackageBookingChange}
                            className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-4 focus:ring-violet-500/10 focus:border-violet-500 transition-all outline-none font-bold shadow-sm text-sm"
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="lg:col-span-6 space-y-6">
                    <div className="space-y-4">
                      <div className="flex items-center gap-2">
                        <div className="bg-fuchsia-50 p-1.5 rounded-lg">
                          <Clock className="w-4 h-4 text-fuchsia-600" />
                        </div>
                        <h3 className="text-base font-bold text-slate-800 tracking-tight">Timeline & Group</h3>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Arrival</label>
                          <input
                            type="date"
                            name="check_in"
                            value={packageBookingForm.check_in}
                            min={today}
                            onChange={handlePackageBookingChange}
                            className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-4 focus:ring-violet-500/10 transition-all outline-none font-bold text-slate-700 text-sm"
                            required
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Departure</label>
                          <input
                            type="date"
                            name="check_out"
                            value={packageBookingForm.check_out}
                            min={packageBookingForm.check_in || today}
                            onChange={handlePackageBookingChange}
                            className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-4 focus:ring-violet-500/10 transition-all outline-none font-bold text-slate-700 text-sm"
                            required
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Adults</label>
                          <input
                            type="number"
                            name="adults"
                            min={1}
                            value={packageBookingForm.adults}
                            onChange={handlePackageBookingChange}
                            className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold transition-all outline-none shadow-sm focus:ring-4 focus:ring-violet-500/10 text-sm"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Children</label>
                          <input
                            type="number"
                            name="children"
                            min={0}
                            value={packageBookingForm.children}
                            onChange={handlePackageBookingChange}
                            className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold transition-all outline-none shadow-sm focus:ring-4 focus:ring-violet-500/10 text-sm"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Suite Selection removed for soft allocation - room is chosen at check-in */}
                  </div>
                </div>

                <div className="pt-6 flex flex-col sm:flex-row justify-end gap-3 border-t border-slate-100 sticky bottom-[-1.5rem] bg-white/90 backdrop-blur-xl -mx-6 px-6 pb-2 z-50">
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-6 py-3 bg-slate-100 text-slate-600 rounded-xl font-bold uppercase tracking-wider text-[10px] hover:bg-slate-200 transition-all duration-300"
                  >
                    Discard
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting || isLoading}
                    className="group px-8 py-3 bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white rounded-xl font-bold uppercase tracking-wide text-[10px] hover:shadow-xl hover:shadow-violet-500/30 transition-all duration-500 flex items-center justify-center gap-2 active:scale-95 disabled:opacity-30 disabled:grayscale disabled:cursor-not-allowed"
                  >
                    {isSubmitting ? (
                      <><Clock className="w-4 h-4 animate-spin" /> Finalizing...</>
                    ) : (
                      <>
                        <Save className="w-4 h-4 group-hover:scale-110 transition-transform" />
                        Execute Package Booking
                      </>
                    )}
                  </button>
                </div>
              </motion.form>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
};


const Bookings = () => {
  const navigate = useNavigate();
  const { hasPermission, isAdmin } = usePermissions();

  const mainTabs = useMemo(() => {
    const tabs = [
      { id: "dashboard", label: "Overview", permission: "bookings:view" },
      { id: "booking", label: "Bookings", permission: "bookings:view" },
      { id: "calendar", label: "Calendar", permission: "bookings:view" },
      { id: "package", label: "Packages", permission: "packages:view" },
      { id: "room", label: "Rooms", permission: "rooms:view" }
    ];
    return tabs.filter(tab => hasPermission(tab.permission));
  }, [hasPermission]);

  const [mainTab, setMainTab] = useState(() => {
    return mainTabs.length > 0 ? mainTabs[0].id : "booking";
  });
  const [formData, setFormData] = useState({
    guestName: "",
    guestMobile: "",
    guestEmail: "",
    gstNumber: "",
    room_type_id: "", // Added for Soft Allocation
    roomNumbers: [],
    checkIn: "",
    checkOut: "",
    adults: 1,
    children: 0,
    num_rooms: 1, // Added for Soft Allocation multiplier
    source: "Admin", // Added for source tracking
    custom_room_rate: "",
    selectedRoomTypes: [], // NEW: List of chosen room types
  });
  const today = getCurrentDateIST();

  const [packages, setPackages] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [roomTypeObjects, setRoomTypeObjects] = useState([]); // Added to store full RoomType objects
  const [packageRooms, setPackageRooms] = useState([]); // Separate state for package booking rooms
  const [packageBookingForm, setPackageBookingForm] = useState({
    package_id: "",
    guest_name: "",
    guest_email: "",
    guest_mobile: "",
    check_in: "",
    check_out: "",
    adults: 2,
    children: 0,
    room_ids: [],
    source: "Admin",
  });
  const [allRooms, setAllRooms] = useState([]);
  const [inventoryLocations, setInventoryLocations] = useState([]);
  const [inventoryItems, setInventoryItems] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [calendarBookings, setCalendarBookings] = useState([]); // High-limit bookings for Inventory Timeline
  const [statusFilter, setStatusFilter] = useState("All");
  const [roomNumberFilter, setRoomNumberFilter] = useState("All");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [feedback, setFeedback] = useState({ message: "", type: "" });
  const [bannerMessage, setBannerMessage] = useState({ type: null, text: "" });
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Function to show banner message safely
  const showBannerMessage = (type, text) => {
    let safeText = text;
    if (Array.isArray(text)) {
      safeText = text.map(d => (d && d.msg ? d.msg : (typeof d === 'string' ? d : JSON.stringify(d)))).join(', ');
    } else if (text && typeof text === 'object') {
      safeText = text.msg || text.message || JSON.stringify(text);
    }
    setBannerMessage({ type, text: safeText || "" });
  };

  const closeBannerMessage = () => {
    setBannerMessage({ type: null, text: "" });
  };
  const [isLoading, setIsLoading] = useState(true);
  const [kpis, setKpis] = useState({
    activeBookings: 0,
    cancelledBookings: 0,
    availableRooms: 0,
    todaysGuestsCheckin: 0,
    todaysGuestsCheckout: 0,
  });

  const [gstSettings, setGstSettings] = useState({
    gst_enabled: true,
    gst_inclusive: false,
    gst_room_type: "SLAB",
    gst_slab_rate_1: "5",
    gst_slab_rate_2: "12",
    gst_slab_rate_3: "18"
  });
  const [modalBooking, setModalBooking] = useState(null);
  const [bookingToEdit, setBookingToEdit] = useState(null);
  const [bookingToExtend, setBookingToExtend] = useState(null);
  const [bookingToCheckIn, setBookingToCheckIn] = useState(null);
  const [selectedImage, setSelectedImage] = useState(null);
  const [bookingForAllocation, setBookingForAllocation] = useState(null);
  const [totalBookings, setTotalBookings] = useState(0);
  const [hasMoreBookings, setHasMoreBookings] = useState(false);
  const [regularBookingsLoaded, setRegularBookingsLoaded] = useState(0);
  const [bookingTab, setBookingTab] = useState("room"); // "room" or "package"
  const [isBookingModalOpen, setIsBookingModalOpen] = useState(false);
  const [bookingToConfirm, setBookingToConfirm] = useState(null);

  const handleBookFromCalendar = (roomTypeName, dateStr) => {
    const rtObj = roomTypeObjects.find(rt => rt.name === roomTypeName);
    const checkInDate = new Date(dateStr);
    const checkOutDate = new Date(checkInDate);
    checkOutDate.setDate(checkInDate.getDate() + 1);

    const formattedCheckIn = dateStr;
    const formattedCheckOut = checkOutDate.toISOString().split('T')[0];

    setFormData({
      guestName: "",
      guestMobile: "",
      guestEmail: "",
      gstNumber: "",
      room_type_id: rtObj ? String(rtObj.id) : "",
      roomNumbers: [],
      checkIn: formattedCheckIn,
      checkOut: formattedCheckOut,
      adults: 1,
      children: 0,
      num_rooms: 1,
      source: "Admin",
      custom_room_rate: "",
      selectedRoomTypes: [], // Initialize selectedRoomTypes
    });

    setPackageBookingForm({
      package_id: "",
      guest_name: "",
      guest_email: "",
      guest_mobile: "",
      check_in: formattedCheckIn,
      check_out: formattedCheckOut,
      adults: 2,
      children: 0,
      room_ids: [],
      source: "Admin",
    });

    setBookingTab("room");
    setIsBookingModalOpen(true);
  };

  // Map of roomId -> room for robust display when API omits nested room payloads
  const roomIdToRoom = useMemo(() => {
    const map = {};
    (allRooms || []).forEach((r) => {
      if (r && r.id) map[r.id] = r;
    });
    return map;
  }, [allRooms]);

  const authHeader = useCallback(
    () => ({
      headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
    }),
    [],
  );

  const handleConfirmBooking = async (bookingId, payments, notes, isPackage) => {
    setIsSubmitting(true);
    try {
      const endpoint = isPackage
        ? `/packages/booking/${bookingId}/confirm`
        : `/bookings/${bookingId}/confirm`;

      const response = await API.post(endpoint, {
        payments: payments.filter(p => p.amount > 0),
        notes: notes
      }, authHeader());

      showBannerMessage("success", `Booking ${response.data.display_id || bookingId} confirmed successfully!`);
      setBookingToConfirm(null);
      if (modalBooking) {
        setModalBooking(response.data);
      }
      fetchData(); // Refresh list
    } catch (error) {
      console.error("Error confirming booking:", error);
      showBannerMessage("error", "Failed to confirm booking: " + (error.response?.data?.detail || error.message));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDownloadReceipt = async (bookingId, isPackage) => {
    try {
      const response = await API.get(`/bookings/${bookingId}/receipt?is_package=${isPackage}`, {
        ...authHeader(),
        responseType: 'blob'
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `receipt_${bookingId}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error) {
      console.error("Error downloading receipt:", error);
      showBannerMessage("error", "Failed to download receipt");
    }
  };

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const token = localStorage.getItem("token");
      if (!token) {
        navigate("/login");
        return;
      }

      const [
        roomsRes,
        bookingsRes,
        packageBookingsRes,
        packageRes,
        roomTypesRes,
        itemsRes,
        locationsRes,
        settingsRes,
      ] = await Promise.all([
        API.get("/rooms/", authHeader()),
        API.get("/bookings?skip=0&limit=20&order_by=id&order=desc", authHeader()),
        API.get("/packages/bookingsall?skip=0&limit=500", authHeader()),
        API.get("/packages/", authHeader()),
        API.get("/rooms/types", authHeader()),
        API.get("/inventory/items?limit=500", authHeader()),
        API.get("/inventory/locations?limit=10000", authHeader()),
        API.get("/settings/", authHeader()),
      ]);

      const allRooms = roomsRes.data;
      const allRoomTypes = roomTypesRes.data;
      setRoomTypeObjects(allRoomTypes);

      // Process settings
      const settingsMap = {};
      if (settingsRes.data && Array.isArray(settingsRes.data)) {
        settingsRes.data.forEach(s => { settingsMap[s.key] = s.value; });
        setGstSettings(prev => ({
          ...prev,
          gst_enabled: settingsMap.gst_enabled?.toLowerCase() === "true",
          gst_inclusive: settingsMap.gst_inclusive?.toLowerCase() === "true",
          gst_room_type: settingsMap.gst_room_type?.toUpperCase() || "SLAB",
          room_gst_rate: settingsMap.room_gst_rate || "12",
          gst_slab_rate_1: settingsMap.gst_slab_rate_1 || "5",
          gst_slab_rate_2: settingsMap.gst_slab_rate_2 || "12",
          gst_slab_rate_3: settingsMap.gst_slab_rate_3 || "18"
        }));
      }
      const { bookings: initialBookings, total } = bookingsRes.data;
      const packageBookings = packageBookingsRes.data || [];
      const rawItems = itemsRes.data || [];
      const allLocations = locationsRes.data || [];
      const todaysDate = getCurrentDateIST();

      console.log("[Bookings fetchData] Inventory items fetched:", rawItems?.length || 0);
      console.log("[Bookings fetchData] Inventory locations fetched:", allLocations?.length || 0);

      // Show all inventory items (both consumables and fixed assets)
      setInventoryItems(rawItems);
      setInventoryLocations(allLocations);

      console.log("[Bookings fetchData] State updated - items:", rawItems?.length, "locations:", allLocations?.length);

      // Reduced limit for better performance - KPI calculation uses sample data
      const allBookingsRes = await API.get(
        "/bookings?limit=500&order_by=id&order=desc",
        authHeader(),
      ); // Reduced from 10000 to 500
      const allRegularBookings = allBookingsRes.data.bookings;

      // Combine regular bookings and package bookings
      const allPackageBookings = packageBookings.map((pb) => ({
        ...pb,
        is_package: true,
        rooms: pb.rooms || [],
      }));
      const allBookings = [...allRegularBookings, ...allPackageBookings];
      setCalendarBookings(allBookings); // Use full 500-limit for Calendar accuracy

      const activeBookingsCount = allBookings.filter((b) => {
        const status = (b.status || "").toLowerCase().trim().replace(/[-_]/g, "-");
        return status === "booked" || status === "checked-in";
      }).length;
      const cancelledBookingsCount = allBookings.filter((b) => {
        const status = (b.status || "").toLowerCase().trim().replace(/[-_]/g, "-");
        return status === "cancelled";
      }).length;
      const availableRoomsCount = allRooms.filter(
        (r) => r.status === "Available",
      ).length;

      // Fix: Filter by actual dates and status for check-in/out KPIs
      const todaysGuestsCheckin = allBookings
        .filter((b) => {
          const status = (b.status || "").toLowerCase().trim().replace(/[-_]/g, "-");
          return b.check_in === todaysDate && status !== "cancelled";
        })
        .reduce((sum, b) => sum + (b.adults || 0) + (b.children || 0), 0);
      const todaysGuestsCheckout = allBookings
        .filter((b) => {
          const status = (b.status || "").toLowerCase().trim().replace(/[-_]/g, "-");
          return b.check_out === todaysDate && status !== "cancelled";
        })
        .reduce((sum, b) => sum + (b.adults || 0) + (b.children || 0), 0);

      // Store all rooms for filtering
      console.log("[Bookings fetchData] All rooms from API:", allRooms?.length, allRooms?.map(r => r.number));
      setAllRooms(allRooms);

      // Set initial package rooms to all available rooms
      setPackageRooms(allRooms.filter((r) => r.status === "Available"));

      // Filter rooms based on date availability if dates are selected
      let availableRooms = allRooms;
      if (formData.checkIn && formData.checkOut) {
        availableRooms = allRooms.filter((room) => {
          // Check if room has any conflicting bookings
          // Only consider bookings with status "booked" or "checked-in" as conflicts
          const hasConflict = allBookings.some((booking) => {
            const normalizedStatus = booking.status
              ?.toLowerCase()
              .replace(/_/g, "-");
            // Only check for "booked" or "checked-in" status - all other statuses are available
            if (
              normalizedStatus !== "booked" &&
              normalizedStatus !== "checked-in"
            )
              return false;

            const bookingCheckIn = new Date(booking.check_in);
            const bookingCheckOut = new Date(booking.check_out);
            const requestedCheckIn = new Date(formData.checkIn);
            const requestedCheckOut = new Date(formData.checkOut);

            // Check if room is part of this booking
            // Handle both regular bookings (r.id) and package bookings (r.room.id)
            const isRoomInBooking =
              booking.rooms && booking.rooms.some((r) => {
                const roomId = r.room?.id || r.id;
                return roomId === room.id;
              });
            if (!isRoomInBooking) return false;

            // Check for date overlap
            return (
              requestedCheckIn < bookingCheckOut &&
              requestedCheckOut > bookingCheckIn
            );
          });

          return !hasConflict;
        });
      } else {
        // If no dates selected, show all available rooms
        availableRooms = allRooms.filter((r) => r.status === "Available");
      }

      setRooms(availableRooms);

      // Combine initial regular bookings with package bookings, sorted by ID descending
      // Use a Map with composite keys to prevent ID collisions between regular and package bookings
      const bookingsMap = new Map();

      // Add regular bookings with type prefix
      initialBookings.forEach((b) => {
        bookingsMap.set(`regular_${b.id}`, { ...b, is_package: false });
      });

      // Add package bookings with type prefix
      packageBookings.forEach((pb) => {
        bookingsMap.set(`package_${pb.id}`, {
          ...pb,
          is_package: true,
          rooms: pb.rooms || [],
        });
      });

      // Sorting Priority: checked-in > booked/confirmed > checked-out > cancelled
      const getPriority = (status) => {
        const s = (status || "").toLowerCase().replace(/[-_]/g, "");
        if (s === "checkedin") return 1;
        if (s === "booked" || s === "confirmed") return 2;
        if (s === "checkedout") return 3;
        if (s === "cancelled") return 4;
        return 5;
      };

      // Convert Map to array and sort by Priority then ID descending
      const combinedBookings = Array.from(bookingsMap.values()).sort((a, b) => {
        const pA = getPriority(a.status);
        const pB = getPriority(b.status);
        if (pA !== pB) return pA - pB;
        return (b.id ?? 0) - (a.id ?? 0);
      });

      setBookings(combinedBookings);
      setPackages(packageRes.data || []);
      setTotalBookings(total + (packageBookings?.length || 0));
      setHasMoreBookings(initialBookings.length < total);
      setRegularBookingsLoaded(initialBookings.length);
      setKpis({
        activeBookings: activeBookingsCount,
        cancelledBookings: cancelledBookingsCount,
        availableRooms: availableRoomsCount,
        todaysGuestsCheckin,
        todaysGuestsCheckout,
      });
    } catch (err) {
      console.error("Error fetching dashboard data:", err);
      showBannerMessage(
        "error",
        "Failed to load dashboard data. Please try again.",
      );
    } finally {
      setIsLoading(false);
    }
  }, [authHeader, navigate]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Refilter rooms when check-in/check-out dates change for room booking
  useEffect(() => {
    if (formData.checkIn && formData.checkOut && allRooms.length > 0) {
      console.log("[ROOM FILTER DEBUG] Starting room filtering...");
      console.log("  Requested dates:", formData.checkIn, "to", formData.checkOut);
      console.log("  Total rooms to check:", allRooms.length);
      console.log("  Total bookings to check:", bookings.length);

      const availableRooms = allRooms.filter((room) => {
        // Check if room has any conflicting bookings
        // Only consider bookings with status "booked" or "checked-in" as conflicts
        const hasConflict = bookings.some((booking) => {
          const normalizedStatus = booking.status
            ?.toLowerCase()
            .replace(/_/g, "-");
          // Only check for "booked" or "checked-in" status - all other statuses are available
          if (
            normalizedStatus !== "booked" &&
            normalizedStatus !== "checked-in"
          )
            return false;

          const bookingCheckIn = new Date(booking.check_in);
          const bookingCheckOut = new Date(booking.check_out);
          const requestedCheckIn = new Date(formData.checkIn);
          const requestedCheckOut = new Date(formData.checkOut);

          // Check if room is part of this booking
          // Handle both regular bookings (r.id) and package bookings (r.room.id)
          const isRoomInBooking =
            booking.rooms && booking.rooms.some((r) => {
              const roomId = r.room?.id || r.id;
              return roomId === room.id;
            });
          if (!isRoomInBooking) return false;

          // Check for date overlap
          const hasDateOverlap = (
            requestedCheckIn < bookingCheckOut &&
            requestedCheckOut > bookingCheckIn
          );

          if (hasDateOverlap && (room.number === "100" || room.number === "101" || room.number === "102")) {
            console.log(`[ROOM FILTER DEBUG] Room ${room.number} BLOCKED by booking:`, {
              bookingId: booking.id,
              status: booking.status,
              normalizedStatus,
              bookingDates: `${booking.check_in} to ${booking.check_out}`,
              requestedDates: `${formData.checkIn} to ${formData.checkOut}`,
              isPackage: booking.is_package,
              rooms: booking.rooms?.map(r => r.room?.number || r.number)
            });
          }

          return hasDateOverlap;
        });

        if (!hasConflict && (room.number === "100" || room.number === "101" || room.number === "102")) {
          console.log(`[ROOM FILTER DEBUG] Room ${room.number} is AVAILABLE`);
        }

        return !hasConflict;
      });

      setRooms(availableRooms);
    } else if (!formData.checkIn || !formData.checkOut) {
      // If no dates selected, show all available rooms
      setRooms(allRooms.filter((r) => r.status === "Available"));
    }
  }, [formData.checkIn, formData.checkOut, allRooms, bookings]);

  // Refilter rooms for package booking when dates change
  useEffect(() => {
    if (
      packageBookingForm.check_in &&
      packageBookingForm.check_out &&
      allRooms.length > 0
    ) {
      const selectedPackage = packages.find(
        (p) => p.id === parseInt(packageBookingForm.package_id),
      );

      let availableRooms = allRooms.filter((room) => {
        // Check if room has any conflicting bookings
        // Only consider bookings with status "booked" or "checked-in" as conflicts
        const hasConflict = bookings.some((booking) => {
          const normalizedStatus = booking.status
            ?.toLowerCase()
            .replace(/_/g, "-");
          // Only check for "booked" or "checked-in" status - all other statuses are available
          if (
            normalizedStatus !== "booked" &&
            normalizedStatus !== "checked-in"
          )
            return false;

          const bookingCheckIn = new Date(booking.check_in);
          const bookingCheckOut = new Date(booking.check_out);
          const requestedCheckIn = new Date(packageBookingForm.check_in);
          const requestedCheckOut = new Date(packageBookingForm.check_out);

          // Check if room is part of this booking
          const isRoomInBooking =
            booking.rooms &&
            booking.rooms.some((r) => {
              // Handle both nested (r.room.id) and direct (r.id) room references
              const roomId = r.room?.id || r.id;
              return roomId === room.id;
            });
          if (!isRoomInBooking) return false;

          // Check for date overlap
          return (
            requestedCheckIn < bookingCheckOut &&
            requestedCheckOut > bookingCheckIn
          );
        });

        // If there are no conflicting bookings for the selected dates, room is available
        // Don't filter by room.status - availability is determined by booking conflicts, not status field
        return !hasConflict;
      });

      // If package is selected and has room_types, filter by room types (case-insensitive)
      if (
        selectedPackage &&
        selectedPackage.booking_type === "room_type" &&
        selectedPackage.room_types
      ) {
        const allowedRoomTypes = selectedPackage.room_types
          .split(",")
          .map((t) => t.trim().toLowerCase());
        availableRooms = availableRooms.filter((room) => {
          const roomType = room.type ? room.type.trim().toLowerCase() : "";
          return allowedRoomTypes.includes(roomType);
        });
      }
      // For whole_property, availableRooms remains all available rooms (no filtering)

      // Update package rooms separately
      setPackageRooms(availableRooms);

      // If whole_property, automatically select all available rooms
      if (
        selectedPackage &&
        selectedPackage.booking_type === "whole_property" &&
        availableRooms.length > 0
      ) {
        setPackageBookingForm((prev) => ({
          ...prev,
          room_ids: availableRooms.map((r) => r.id),
        }));
      } else if (
        selectedPackage &&
        selectedPackage.booking_type === "room_type"
      ) {
        // For room_type, clear selection if package changed or dates changed
        // User will manually select rooms
      }
    } else if (!packageBookingForm.check_in || !packageBookingForm.check_out) {
      // If no dates selected, show all available rooms
      setPackageRooms(allRooms.filter((r) => r.status === "Available"));
    }
  }, [
    packageBookingForm.check_in,
    packageBookingForm.check_out,
    packageBookingForm.package_id,
    allRooms,
    bookings,
    packages,
  ]);

  const loadMoreBookings = async () => {
    if (!hasMoreBookings) return;
    setIsSubmitting(true);
    try {
      const response = await API.get(
        `/bookings?skip=${regularBookingsLoaded}&limit=20&order_by=id&order=desc`,
        authHeader(),
      );
      const { bookings: newBookings, total } = response.data;

      if (!newBookings || newBookings.length === 0) {
        setHasMoreBookings(false);
        return;
      }

      setBookings((prev) => {
        const bookingsMap = new Map();

        prev.forEach((booking) => {
          const key = booking.is_package
            ? `package_${booking.id}`
            : `regular_${booking.id}`;
          bookingsMap.set(key, booking);
        });

        newBookings.forEach((booking) => {
          bookingsMap.set(`regular_${booking.id}`, {
            ...booking,
            is_package: false,
          });
        });

        const getPriority = (status) => {
          const s = (status || "").toLowerCase().replace(/[-_]/g, "");
          if (s === "checkedin") return 1;
          if (s === "booked" || s === "confirmed") return 2;
          if (s === "checkedout") return 3;
          if (s === "cancelled") return 4;
          return 5;
        };

        return Array.from(bookingsMap.values()).sort((a, b) => {
          const pA = getPriority(a.status);
          const pB = getPriority(b.status);
          if (pA !== pB) return pA - pB;
          return (b.id ?? 0) - (a.id ?? 0);
        });
      });

      const updatedRegularCount = regularBookingsLoaded + newBookings.length;
      setRegularBookingsLoaded(updatedRegularCount);
      setHasMoreBookings(updatedRegularCount < total);
    } catch (err) {
      console.error("Failed to load more bookings:", err);
      showBannerMessage("error", "Could not load more bookings.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const loadMoreRef = useInfiniteScroll(
    loadMoreBookings,
    hasMoreBookings,
    isSubmitting,
  );

  const extractRoomNumber = useCallback((room) => {
    if (!room) return null;
    const directNumber = room.number;
    if (
      directNumber !== undefined &&
      directNumber !== null &&
      directNumber !== ""
    ) {
      return String(directNumber).trim();
    }

    const nestedNumber = room.room?.number;
    if (
      nestedNumber !== undefined &&
      nestedNumber !== null &&
      nestedNumber !== ""
    ) {
      return String(nestedNumber).trim();
    }

    return null;
  }, []);

  const dedupeBookings = useCallback((list) => {
    const map = new Map();

    list.forEach((rawBooking) => {
      if (!rawBooking) return;

      const booking = {
        ...rawBooking,
        is_package: Boolean(rawBooking.is_package),
      };

      const prefix = booking.is_package ? "PK" : "BK";
      const displayId = (
        booking.display_id ||
        `${prefix}-${String(booking.id ?? "").padStart(6, "0")}`
      )
        .toString()
        .trim()
        .toUpperCase();

      const key = `${prefix}_${displayId}`;

      if (!map.has(key)) {
        map.set(key, booking);
      } else {
        const existing = map.get(key);
        map.set(key, { ...existing, ...booking });
      }
    });

    return Array.from(map.values()).sort((a, b) => (b.id ?? 0) - (a.id ?? 0));
  }, []);

  const roomTypes = useMemo(() => {
    return roomTypeObjects.map((rt) => rt.name);
  }, [roomTypeObjects]);

  const allRoomNumbers = useMemo(() => {
    const numbers = new Set();
    bookings.forEach((booking) => {
      booking.rooms?.forEach((room) => {
        const roomNumber = extractRoomNumber(room);
        if (roomNumber) {
          numbers.add(roomNumber);
        }
      });
    });

    const sortedNumbers = Array.from(numbers).sort((a, b) =>
      a.localeCompare(b, undefined, { numeric: true }),
    );
    return ["All", ...sortedNumbers];
  }, [bookings, extractRoomNumber]);

  const filteredRooms = useMemo(() => {
    if (!formData.room_type_id) return [];
    const selectedType = roomTypeObjects.find(rt => rt.id === Number(formData.room_type_id));
    return rooms.filter((r) =>
      (r.room_type_id === Number(formData.room_type_id)) ||
      (selectedType && r.type === selectedType.name)
    );
  }, [rooms, formData.room_type_id, roomTypeObjects]);

  const selectedRoomDetails = useMemo(() => {
    const selectedType = roomTypeObjects.find(rt => rt.id === Number(formData.room_type_id));
    return formData.roomNumbers
      .map((roomNumber) =>
        rooms.find(
          (r) => r.number === roomNumber && (
            (r.room_type_id === Number(formData.room_type_id)) ||
            (selectedType && r.type === selectedType.name)
          )
        ),
      )
      .filter(Boolean);
  }, [formData.roomNumbers, rooms, formData.room_type_id, roomTypeObjects]);

  const totalGuests = useMemo(() => {
    return parseInt(formData.adults) + parseInt(formData.children);
  }, [formData.adults, formData.children]);

  const handlePackageBookingChange = (e) => {
    const { name, value } = e.target;
    console.log("Package Input changed:", name, value);
    setPackageBookingForm((prev) => {
      const updated = { ...prev, [name]: value };

      // When package is selected, check its booking_type
      if (name === "package_id" && value) {
        const selectedPackage = packages.find((p) => p.id === parseInt(value));
        if (selectedPackage) {
          // Apply package defaults for adults and children
          if (selectedPackage.default_adults) {
            updated.adults = selectedPackage.default_adults;
          }
          if (selectedPackage.default_children !== undefined && selectedPackage.default_children !== null) {
            updated.children = selectedPackage.default_children;
          }

          // If whole_property, automatically select all available rooms (will be handled in useEffect)
          if (selectedPackage.booking_type === "whole_property") {
            updated.room_ids = [];
          } else if (selectedPackage.booking_type === "room_type") {
            // Clear room selection when switching packages
            updated.room_ids = [];
          }
        }
      }

      return updated;
    });
  };

  const handlePackageRoomSelect = (roomId) => {
    setPackageBookingForm((prev) => ({
      ...prev,
      room_ids: prev.room_ids.includes(roomId)
        ? prev.room_ids.filter((id) => id !== roomId)
        : [...prev.room_ids, roomId],
    }));
  };

  const handlePackageBookingSubmit = async (e) => {
    e.preventDefault();

    // Prevent multiple submissions
    if (isSubmitting) {
      return;
    }

    setIsSubmitting(true);
    setFeedback({ message: "", type: "" });
    try {
      // --- MINIMUM BOOKING DURATION VALIDATION ---
      if (packageBookingForm.check_in && packageBookingForm.check_out) {
        const checkInDate = new Date(packageBookingForm.check_in);
        const checkOutDate = new Date(packageBookingForm.check_out);
        const timeDiff = checkOutDate.getTime() - checkInDate.getTime();
        const daysDiff = timeDiff / (1000 * 3600 * 24);

        if (daysDiff < 1) {
          showBannerMessage(
            "error",
            "Minimum 1 day booking is mandatory. Check-out date must be at least 1 day after check-in date.",
          );
          setIsSubmitting(false);
          return;
        }
      }

      // Check if package is whole_property - skip room validation
      const selectedPackage = packages.find(
        (p) => p.id === parseInt(packageBookingForm.package_id),
      );
      if (!selectedPackage) {
        showBannerMessage(
          "error",
          "Package not found. Please select a valid package.",
        );
        setIsSubmitting(false);
        return;
      }

      // Determine if it's whole_property
      const isWholeProperty = selectedPackage.booking_type === "whole_property";

      // For whole_property, get all available rooms and use them directly
      let finalRoomIds = packageBookingForm.room_ids;

      if (isWholeProperty) {
        // Use all available rooms from packageRooms (already filtered by availability)
        const availableRoomIds = packageRooms.map((r) => r.id);

        if (availableRoomIds.length === 0) {
          showBannerMessage(
            "error",
            "No rooms are available for the selected dates.",
          );
          setIsSubmitting(false);
          return;
        }

        // Use all available rooms for whole_property
        finalRoomIds = availableRoomIds;
      } else {
        // Room selection validation removed for soft allocation
        finalRoomIds = packageBookingForm.room_ids;
      }

      // --- CAPACITY VALIDATION ---
      // Enforce package limits instead of room capacity
      if (!isWholeProperty) {
        const requestedAdults = parseInt(packageBookingForm.adults) || 0;
        const requestedChildren = parseInt(packageBookingForm.children) || 0;
        const limitAdults = parseInt(selectedPackage.default_adults) || 0;
        const limitChildren = parseInt(selectedPackage.default_children) || 0;

        if (requestedAdults > limitAdults) {
          showBannerMessage(
            "error",
            `The number of adults (${requestedAdults}) exceeds the package limit (${limitAdults} adults max).`,
          );
          setIsSubmitting(false);
          return;
        }

        if (requestedChildren > limitChildren) {
          showBannerMessage(
            "error",
            `The number of children (${requestedChildren}) exceeds the package limit (${limitChildren} children max).`,
          );
          setIsSubmitting(false);
          return;
        }
      }
      // -------------------------

      // --- CONFLICT DETECTION FOR PACKAGE BOOKING ---
      const requestedCheckIn = new Date(packageBookingForm.check_in);
      const requestedCheckOut = new Date(packageBookingForm.check_out);

      const conflicts = [];
      finalRoomIds.forEach((roomId) => {
        const room = allRooms.find((r) => r.id === roomId);
        if (!room) return;

        // Check all bookings for conflicts
        const conflictingBookings = bookings.filter((booking) => {
          // Only check active bookings (booked or checked-in)
          const normalizedStatus = booking.status?.toLowerCase().replace(/[-_]/g, "");
          if (normalizedStatus !== "booked" && normalizedStatus !== "checkedin") {
            return false;
          }

          // Check if this booking includes the current room
          const bookingHasRoom = booking.rooms?.some((r) => {
            const bookingRoomId = r.room?.id || r.id || r.room_id;
            return bookingRoomId === roomId;
          });

          if (!bookingHasRoom) return false;

          // Check for date overlap
          const bookingCheckIn = new Date(booking.check_in);
          const bookingCheckOut = new Date(booking.check_out);

          const hasOverlap = requestedCheckIn < bookingCheckOut && requestedCheckOut > bookingCheckIn;

          return hasOverlap;
        });

        if (conflictingBookings.length > 0) {
          conflicts.push({
            room: room.number,
            bookings: conflictingBookings.map((b) => ({
              id: b.display_id || `${b.is_package ? 'PK' : 'BK'}-${String(b.id).padStart(6, '0')}`,
              guest: b.guest_name,
              checkIn: b.check_in,
              checkOut: b.check_out,
              status: b.status,
            })),
          });
        }
      });

      if (conflicts.length > 0) {
        const conflictMessages = conflicts.map((c) => {
          const bookingDetails = c.bookings.map((b) =>
            `${b.id} (${b.guest}, ${b.checkIn} to ${b.checkOut})`
          ).join(", ");
          return `Room ${c.room}: ${bookingDetails}`;
        }).join("\n");

        showBannerMessage(
          "error",
          `Cannot create package booking. The following rooms have conflicting bookings:\n${conflictMessages}`
        );
        setIsSubmitting(false);
        return;
      }
      // --- END CONFLICT DETECTION ---

      const bookingData = {
        ...packageBookingForm,
        guest_email: packageBookingForm.guest_email && packageBookingForm.guest_email.trim() ? packageBookingForm.guest_email.trim() : null,
        package_id: parseInt(packageBookingForm.package_id),
        adults: parseInt(packageBookingForm.adults),
        children: parseInt(packageBookingForm.children),
        room_ids: finalRoomIds.map((id) => parseInt(id)),
      };
      const response = await API.post(
        "/packages/book",
        bookingData,
        authHeader(),
      );
      showBannerMessage("success", "Package booked successfully!");
      setPackageBookingForm({
        package_id: "",
        guest_name: "",
        guest_email: "",
        guest_mobile: "",
        check_in: "",
        check_out: "",
        adults: 2,
        children: 0,
        room_ids: [],
      });

      // Add the new package booking to the state - use response data as-is from backend
      const newPackageBooking = {
        ...response.data,
        is_package: true,
        // Backend already returns rooms in the response, so we don't need to reconstruct them
      };

      // Use functional update to prevent duplicates
      setBookings((prev) => dedupeBookings([newPackageBooking, ...prev]));
      setIsBookingModalOpen(false);
    } catch (err) {
      console.error("Package booking error:", err);
      const detail = err.response?.data?.detail;
      let errorMessage = "Failed to process package booking.";
      if (typeof detail === 'string') {
        errorMessage = detail;
      } else if (Array.isArray(detail)) {
        errorMessage = detail.map(d => (d && d.msg ? d.msg : (typeof d === 'string' ? d : JSON.stringify(d)))).join(', ');
      } else if (detail && typeof detail === 'object') {
        errorMessage = detail.msg || detail.message || JSON.stringify(detail);
      } else if (err.response?.data?.message) {
        errorMessage = err.response.data.message;
      } else if (err.message) {
        errorMessage = err.message;
      }
      showBannerMessage("error", errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  const totalCapacity = useMemo(() => {
    // Get selected room details from formData.roomNumbers
    const selectedRoomDetails = formData.roomNumbers
      .map((roomNumber) => rooms.find((r) => r.number === roomNumber))
      .filter((room) => room !== undefined && room !== null);

    return {
      adults: selectedRoomDetails.reduce((sum, room) => sum + (room?.adults || 0), 0),
      children: selectedRoomDetails.reduce(
        (sum, room) => sum + (room?.children || 0),
        0,
      ),
      total: selectedRoomDetails.reduce(
        (sum, room) => sum + ((room?.adults || 0) + (room?.children || 0)),
        0,
      ),
    };
  }, [formData.roomNumbers, rooms]);

  // Generate unique booking ID for sharing - use display_id from API if available
  const generateBookingId = (booking) => {
    // Use display_id from API response if available (backend will provide BK-000001 or PK-000001)
    if (booking.display_id) {
      return booking.display_id;
    }
    // Fallback: generate it client-side if not provided
    const prefix = booking.is_package ? "PK" : "BK";
    const paddedId = String(booking.id).padStart(6, "0");
    return `${prefix}-${paddedId}`;
  };

  // Share booking via Email
  const shareViaEmail = (booking) => {
    const bookingId = generateBookingId(booking);
    const rooms =
      booking.rooms && booking.rooms.length > 0
        ? booking.rooms
          .map((r) => {
            if (booking.is_package) {
              return r.room ? `Room ${r.room.number} (${r.room.type})` : "-";
            } else {
              return `Room ${r.number} (${r.type})`;
            }
          })
          .filter(Boolean)
          .join(", ")
        : "N/A";

    const subject = encodeURIComponent(`Booking Confirmation - ${bookingId}`);
    const body = encodeURIComponent(
      `Dear ${booking.guest_name},\n\n` +
      `Your booking has been confirmed!\n\n` +
      `Booking ID: ${bookingId}\n` +
      `Booking Type: ${booking.is_package ? "Package" : "Room"}\n` +
      `Rooms: ${rooms}\n` +
      `Check-in: ${booking.check_in}\n` +
      `Check-out: ${booking.check_out}\n` +
      `Guests: ${booking.adults} Adults, ${booking.children} Children\n` +
      `Status: ${booking.status}\n\n` +
      `Thank you for choosing our resort!\n\n` +
      `Best regards,\nResort Team`,
    );
    window.location.href = `mailto:${booking.guest_email}?subject=${subject}&body=${body}`;
  };

  // Share booking via WhatsApp
  const shareViaWhatsApp = (booking) => {
    const bookingId = generateBookingId(booking);
    const mobile = booking.guest_mobile?.replace(/[^\d]/g, "") || "";

    if (!mobile) {
      showBannerMessage(
        "error",
        "Mobile number not available for this booking.",
      );
      return;
    }

    const rooms =
      booking.rooms && booking.rooms.length > 0
        ? booking.rooms
          .map((r) => {
            if (booking.is_package) {
              return r.room ? `Room ${r.room.number} (${r.room.type})` : "-";
            } else {
              return `Room ${r.number} (${r.type})`;
            }
          })
          .filter(Boolean)
          .join(", ")
        : "N/A";

    const message = encodeURIComponent(
      `Dear ${booking.guest_name},\n\n` +
      `Your booking has been confirmed!\n\n` +
      `Booking ID: ${bookingId}\n` +
      `Booking Type: ${booking.is_package ? "Package" : "Room"}\n` +
      `Rooms: ${rooms}\n` +
      `Check-in: ${booking.check_in}\n` +
      `Check-out: ${booking.check_out}\n` +
      `Guests: ${booking.adults} Adults, ${booking.children} Children\n` +
      `Status: ${booking.status}\n\n` +
      `Thank you for choosing our resort!`,
    );
    window.open(`https://wa.me/${mobile}?text=${message}`, "_blank");
  };

  // Calculate status counts for better filter clarity
  const statusCounts = useMemo(() => {
    const counts = {
      all: bookings.length,
      booked: 0,
      cancelled: 0,
      "checked-in": 0,
      "checked-out": 0,
    };

    bookings.forEach((b) => {
      const normalizedStatus = (b.status || "")
        .toLowerCase()
        .replace(/[-_]/g, "-")
        .trim();
      if (normalizedStatus === "booked") counts.booked++;
      else if (normalizedStatus === "cancelled") counts.cancelled++;
      else if (
        normalizedStatus === "checked-in" ||
        normalizedStatus === "checked_in"
      )
        counts["checked-in"]++;
      else if (
        normalizedStatus === "checked-out" ||
        normalizedStatus === "checked_out"
      )
        counts["checked-out"]++;
    });

    return counts;
  }, [bookings]);

  const filteredBookings = useMemo(() => {
    const uniqueBookings = dedupeBookings(bookings);
    return uniqueBookings
      .filter((b) => {
        // Normalize status values - handle both hyphens and underscores
        let normalizedBookingStatus = b.status?.toLowerCase().trim();
        let normalizedFilterStatus = statusFilter?.toLowerCase().trim();

        // Normalize: replace underscores and hyphens with standard format
        normalizedBookingStatus = normalizedBookingStatus?.replace(
          /[-_]/g,
          "-",
        );
        normalizedFilterStatus = normalizedFilterStatus?.replace(/[-_]/g, "-");

        // Handle case variations and exact match - works for both regular and package bookings
        const statusMatch =
          statusFilter === "All" ||
          normalizedBookingStatus === normalizedFilterStatus ||
          (normalizedBookingStatus === "checked-out" &&
            normalizedFilterStatus === "checked-out") ||
          (normalizedBookingStatus === "checked_out" &&
            normalizedFilterStatus === "checked-out") ||
          (normalizedBookingStatus === "checked-in" &&
            normalizedFilterStatus === "checked-in") ||
          (normalizedBookingStatus === "checked_in" &&
            normalizedFilterStatus === "checked-in");
        const normalizedRoomFilterValue =
          roomNumberFilter === "All" ? null : String(roomNumberFilter).trim();
        const roomNumberMatch =
          !normalizedRoomFilterValue ||
          (b.rooms &&
            b.rooms.some(
              (room) => extractRoomNumber(room) === normalizedRoomFilterValue,
            ));

        // Fix: Apply date filter to both check-in and check-out dates
        let dateMatch = true;

        if (fromDate || toDate) {
          const checkInDate = new Date(b.check_in);
          const checkOutDate = new Date(b.check_out);
          checkInDate.setHours(0, 0, 0, 0); // Normalize times for accurate comparison
          checkOutDate.setHours(0, 0, 0, 0);

          if (fromDate && toDate) {
            // Both dates specified: booking overlaps if it intersects with the range
            const from = new Date(fromDate);
            const to = new Date(toDate);
            from.setHours(0, 0, 0, 0);
            to.setHours(0, 0, 0, 0);

            dateMatch = checkInDate <= to && checkOutDate >= from;
          } else if (fromDate) {
            // Only from date specified: booking must end on or after this date
            const from = new Date(fromDate);
            from.setHours(0, 0, 0, 0);
            dateMatch = checkOutDate >= from;
          } else if (toDate) {
            // Only to date specified: booking must start on or before this date
            const to = new Date(toDate);
            to.setHours(0, 0, 0, 0);
            dateMatch = checkInDate <= to;
          }
        }

        return statusMatch && roomNumberMatch && dateMatch;
      })
      .sort((a, b) => {
        // First, sort by status priority: checked-in (1), booked (2), checked-out (3), cancelled (4)
        const statusPriority = {
          "checked-in": 1,
          checked_in: 1,
          booked: 2,
          confirmed: 2,
          "checked-out": 3,
          checked_out: 3,
          cancelled: 4,
        };

        const aStatus = a.status?.toLowerCase().replace(/[-_]/g, "-") || "";
        const bStatus = b.status?.toLowerCase().replace(/[-_]/g, "-") || "";

        const aPriority = statusPriority[aStatus] || 99;
        const bPriority = statusPriority[bStatus] || 99;

        // If statuses are different, sort by priority
        if (aPriority !== bPriority) {
          return aPriority - bPriority;
        }

        // If same status, sort by ID descending (latest first)
        return b.id - a.id;
      });
  }, [
    bookings,
    statusFilter,
    roomNumberFilter,
    fromDate,
    toDate,
    extractRoomNumber,
    dedupeBookings,
  ]);

  const handleRoomNumberToggle = (roomNumber) => {
    const isSelected = formData.roomNumbers.includes(roomNumber);
    let newRoomNumbers;
    if (isSelected) {
      newRoomNumbers = formData.roomNumbers.filter((num) => num !== roomNumber);
    } else {
      newRoomNumbers = [...formData.roomNumbers, roomNumber];
    }
    setFormData((prev) => ({ ...prev, roomNumbers: newRoomNumbers }));
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    console.log("Input changed:", name, value);
    setFormData((prev) => ({ 
      ...prev, 
      [name]: value,
      // If they manually edit the custom_room_rate, flag it so auto-fetch doesn't overwrite it
      ...(name === 'custom_room_rate' ? { _manual_custom_rate: true } : {})
    }));
  };

  const handleRoomTypeChange = (e) => {
    const { value } = e.target;
    const selectedType = roomTypeObjects.find(rt => rt.id === Number(value));
    setFormData((prev) => ({
      ...prev,
      room_type_id: value,
      roomNumbers: [],
      custom_room_rate: selectedType ? (selectedType.base_price || 0) : "",
      // Reset manual flag when category changes
      _manual_custom_rate: false
    }));
  };

  // NEW: Add selected room type to current booking selection
  const handleAddRoomType = () => {
    if (!formData.room_type_id) {
      showBannerMessage("error", "Please select a room category first.");
      return;
    }

    const selectedType = roomTypeObjects.find(rt => rt.id === Number(formData.room_type_id));
    if (!selectedType) {
      showBannerMessage("error", "Invalid room category selected.");
      return;
    }

    const numRooms = parseInt(formData.num_rooms) || 1;
    const adults = parseInt(formData.adults) || 1;
    const children = parseInt(formData.children) || 0;

    // Determine the "default" dynamic total for this specific item (all rooms for this category)
    // We use the last dynamic value fetched by the useEffect if available
    const defaultItemTotal = formData._last_preview_dynamic_total || (selectedType.base_price || 0.0) * numRooms;

    const newItem = {
      id: Date.now(), // unique timestamp ID
      room_type_id: selectedType.id,
      room_type_name: selectedType.name,
      num_rooms: numRooms,
      default_total: defaultItemTotal, // Store the dynamic base price for this item
      adults: adults,
      children: children,
      roomNumbers: formData.roomNumbers || []
    };

    setFormData((prev) => ({
      ...prev,
      selectedRoomTypes: [...(prev.selectedRoomTypes || []), newItem],
      // Reset only category selection fields
      room_type_id: "",
      num_rooms: 1,
      adults: 1,
      children: 0,
      roomNumbers: [],
      _last_preview_dynamic_total: null
    }));
  };

  // NEW: Remove selected room type from booking selection
  const handleRemoveRoomType = (itemId) => {
    setFormData((prev) => ({
      ...prev,
      selectedRoomTypes: (prev.selectedRoomTypes || []).filter(item => item.id !== itemId)
    }));
  };

  // NEW: Automatically query dynamic price and update Global Reservation Total
  useEffect(() => {
    const fetchDynamicPrice = async () => {
      // 1. Calculate base sum of items already in cart
      const cartBaseSum = (formData.selectedRoomTypes || []).reduce((sum, item) => sum + (item.default_total || 0), 0);

      let previewTotalVal = 0.0;

      // 2. If there is a room currently being configured (preview), fetch its dynamic price
      if (formData.room_type_id && formData.checkIn && formData.checkOut) {
        try {
          const response = await API.post("/bookings/calculate-price", {
            room_type_id: Number(formData.room_type_id),
            check_in: formData.checkIn,
            check_out: formData.checkOut,
            room_count: parseInt(formData.num_rooms) || 1
          });
          previewTotalVal = response.data?.total_amount || 0.0;
        } catch (err) {
          console.error("Error fetching dynamic price:", err);
        }
      }

      const combinedDynamicTotal = cartBaseSum + previewTotalVal;

      setFormData((prev) => {
        const nextState = { ...prev, _last_preview_dynamic_total: previewTotalVal, _last_combined_dynamic_total: combinedDynamicTotal };

        // IMPROVED: Only auto-fill if the current value is empty or 0
        // This prevents the "jumping" price issue the user is seeing.
        if (prev.custom_room_rate && prev.custom_room_rate !== "0" && prev.custom_room_rate !== "0.00") {
          return nextState;
        }

        return { 
          ...nextState, 
          custom_room_rate: combinedDynamicTotal > 0 ? combinedDynamicTotal.toFixed(2) : prev.custom_room_rate 
        };
      });
    };
    
    fetchDynamicPrice();
  }, [formData.room_type_id, formData.checkIn, formData.checkOut, formData.num_rooms, formData.selectedRoomTypes, roomTypeObjects]);

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Prevent multiple submissions
    if (isSubmitting) {
      return;
    }

    setIsSubmitting(true);
    setFeedback({ message: "", type: "" });

    try {
      if (bookingToEdit) {
        const checkInDate = new Date(formData.checkIn);
        const checkOutDate = new Date(formData.checkOut);
        const nights = Math.max(1, (checkOutDate.getTime() - checkInDate.getTime()) / (1000 * 3600 * 24));
        const numRooms = parseInt(formData.num_rooms) || 1;
        const totalAmt = formData.custom_room_rate ? parseFloat(formData.custom_room_rate) : null;

        const updatePayload = {
          guest_name: formData.guestName,
          guest_mobile: formData.guestMobile,
          guest_email: formData.guestEmail,
          gst_number: formData.gstNumber,
          adults: parseInt(formData.adults),
          children: parseInt(formData.children),
          check_in: formData.checkIn,
          check_out: formData.checkOut,
          source: formData.source,
          total_amount: totalAmt,
          room_type_id: formData.room_type_id ? parseInt(formData.room_type_id) : null,
          num_rooms: numRooms,
          room_ids: (formData.roomNumbers || [])
            .map((roomNumber) => {
              const room = rooms.find((r) => r.number === roomNumber);
              return room ? room.id : null;
            })
            .filter((id) => id !== null),
        };
        await API.put(`/bookings/${bookingToEdit.id}`, updatePayload, authHeader());
        showBannerMessage("success", "Booking updated successfully!");
        setBookingToEdit(null);
        setIsBookingModalOpen(false);
        fetchData();
        return;
      }
      // --- MINIMUM BOOKING DURATION VALIDATION ---
      if (formData.checkIn && formData.checkOut) {
        const checkInDate = new Date(formData.checkIn);
        const checkOutDate = new Date(formData.checkOut);
        const timeDiff = checkOutDate.getTime() - checkInDate.getTime();
        const daysDiff = timeDiff / (1000 * 3600 * 24);

        if (daysDiff < 1) {
          showBannerMessage(
            "error",
            "Minimum 1 day booking is mandatory. Check-out date must be at least 1 day after check-in date.",
          );
          setIsSubmitting(false);
          return;
        }
      }

      // Construct list of items to book. Auto-include the active unsaved preview configuration if not already added.
      let itemsToBook = [...(formData.selectedRoomTypes || [])];
      
      if (formData.room_type_id) {
        const existingIndex = itemsToBook.findIndex(item => String(item.room_type_id) === String(formData.room_type_id));
        const previewItem = {
          room_type_id: parseInt(formData.room_type_id),
          custom_room_rate: formData.custom_room_rate ? parseFloat(formData.custom_room_rate) : null,
          num_rooms: parseInt(formData.num_rooms) || 1,
          adults: parseInt(formData.adults) || 1,
          children: parseInt(formData.children) || 0,
          roomNumbers: formData.roomNumbers || []
        };
        
        if (existingIndex >= 0) {
          // If the user modified the preview form for a room type already in the cart, update the cart item
          itemsToBook[existingIndex] = { ...itemsToBook[existingIndex], ...previewItem };
        } else {
          itemsToBook.push(previewItem);
        }
      } else if (itemsToBook.length === 1 && formData.custom_room_rate) {
        // Fallback: If they typed a custom rate but the room type was reset (e.g. after clicking Add Room),
        // apply the rate to the only item in the cart to prevent user frustration.
        itemsToBook[0].custom_room_rate = parseFloat(formData.custom_room_rate);
      }

      // Fallback fallback if both are empty
      if (itemsToBook.length === 0) {
        itemsToBook.push({
          room_type_id: null,
          custom_room_rate: null,
          num_rooms: 1,
          adults: 1,
          children: 0,
          roomNumbers: []
        });
      }

      // Validate each item has either room category or specific room numbers
      for (const item of itemsToBook) {
        if (!item.room_type_id && (!item.roomNumbers || item.roomNumbers.length === 0)) {
          showBannerMessage("error", "Please configure at least one room category or select rooms.");
          setIsSubmitting(false);
          return;
        }
      }

      const createdBookings = [];
      const globalBase = parseFloat(formData.custom_room_rate) || 0;
      
      // Recalculate total rooms for distribution in this scope
      const totalRoomsForBooking = itemsToBook.reduce((sum, item) => sum + (parseInt(item.num_rooms) || 1), 0);

      for (const item of itemsToBook) {
        const roomIds = (item.roomNumbers || [])
          .map((roomNumber) => {
            const room = rooms.find((r) => r.number === roomNumber);
            return room ? room.id : null;
          })
          .filter((id) => id !== null);

        // --- CONFLICT DETECTION (Only for specific physical room assignments) ---
        if (roomIds.length > 0) {
          const requestedCheckIn = new Date(formData.checkIn);
          const requestedCheckOut = new Date(formData.checkOut);

          const conflicts = [];
          roomIds.forEach((roomId) => {
            const room = allRooms.find((r) => r.id === roomId);
            if (!room) return;

            const conflictingBookings = bookings.filter((booking) => {
              const normalizedStatus = booking.status?.toLowerCase().replace(/[-_]/g, "");
              if (normalizedStatus !== "booked" && normalizedStatus !== "checkedin") return false;

              const bookingHasRoom = booking.rooms?.some((r) => {
                const bookingRoomId = r.room?.id || r.id || r.room_id;
                return bookingRoomId === roomId;
              });
              if (!bookingHasRoom) return false;

              const bookingCheckIn = new Date(booking.check_in);
              const bookingCheckOut = new Date(booking.check_out);
              return requestedCheckIn < bookingCheckOut && requestedCheckOut > bookingCheckIn;
            });

            if (conflictingBookings.length > 0) {
              conflicts.push({
                room: room.number,
                bookings: conflictingBookings.map((b) => ({
                  id: b.display_id || `${b.is_package ? 'PK' : 'BK'}-${String(b.id).padStart(6, '0')}`,
                  guest: b.guest_name,
                  checkIn: b.check_in,
                  checkOut: b.check_out,
                  status: b.status,
                })),
              });
            }
          });

          if (conflicts.length > 0) {
            const conflictMessages = conflicts.map((c) => {
              const bookingDetails = c.bookings.map((b) => `${b.id} (${b.guest}, ${b.checkIn} to ${b.checkOut})`).join(", ");
              return `Room ${c.room}: ${bookingDetails}`;
            }).join("\n");

            showBannerMessage("error", `Conflict detected in assigned rooms:\n${conflictMessages}`);
            setIsSubmitting(false);
            return;
          }
        }

        // Proportional distribution of the global base amount
        const postCustomRate = totalRoomsForBooking > 0 ? (globalBase / totalRoomsForBooking) * (parseInt(item.num_rooms) || 1) : 0;

        const response = await API.post(
          "/bookings",
          {
            room_ids: roomIds,
            room_type_id: item.room_type_id ? parseInt(item.room_type_id) : null,
            source: formData.source || "Admin",
            guest_name: formData.guestName,
            guest_mobile: formData.guestMobile,
            guest_email: formData.guestEmail && formData.guestEmail.trim() ? formData.guestEmail.trim() : null,
            gst_number: formData.gstNumber && formData.gstNumber.trim() ? formData.gstNumber.trim() : null,
            check_in: formData.checkIn,
            check_out: formData.checkOut,
            adults: parseInt(item.adults),
            children: parseInt(item.children),
            num_rooms: parseInt(item.num_rooms) || 1,
            custom_room_rate: postCustomRate,
          },
          authHeader(),
        );

        createdBookings.push({
          ...response.data,
          is_package: false,
        });
      }

      showBannerMessage("success", `${createdBookings.length} booking(s) executed successfully!`);
      setFormData({
        guestName: "",
        guestMobile: "",
        guestEmail: "",
        gstNumber: "",
        room_type_id: "",
        roomNumbers: [],
        checkIn: "",
        checkOut: "",
        adults: 1,
        children: 0,
        num_rooms: 1,
        source: "Admin",
        custom_room_rate: "",
        selectedRoomTypes: [],
      });

      // Use functional update to add all created bookings and deduplicate
      setBookings((prev) => dedupeBookings([...createdBookings, ...prev]));
      setIsBookingModalOpen(false);
    } catch (err) {
      console.error("Booking creation error:", err);
      const detail = err.response?.data?.detail;
      let errorMessage = "Error creating booking.";
      if (typeof detail === 'string') {
        errorMessage = detail;
      } else if (Array.isArray(detail)) {
        errorMessage = detail.map(d => (d && d.msg ? d.msg : (typeof d === 'string' ? d : JSON.stringify(d)))).join(', ');
      } else if (detail && typeof detail === 'object') {
        errorMessage = detail.msg || detail.message || JSON.stringify(detail);
      } else if (err.response?.data?.message) {
        errorMessage = err.response.data.message;
      } else if (err.message) {
        errorMessage = err.message;
      }
      showBannerMessage("error", errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleExtendBooking = async (bookingId, newCheckoutDate) => {
    setFeedback({ message: "", type: "" });
    setIsSubmitting(true);

    try {
      // Find the booking from the current bookings list to get basic info
      const booking = bookings.find((b) => b.id === bookingId);

      if (!booking || !booking.id) {
        showBannerMessage(
          "error",
          "Booking not found. Please refresh the page.",
        );
        setIsSubmitting(false);
        setBookingToExtend(null);
        return;
      }

      // Determine booking type:
      // - Room bookings: standalone room bookings from 'bookings' table (is_package = false)
      // - Package bookings: package bookings from 'package_bookings' table (is_package = true)
      //   Note: Rooms booked as part of a package are treated as package bookings
      const isPackage = booking.is_package || false;
      const displayId = generateBookingId(booking);

      if (!displayId) {
        showBannerMessage(
          "error",
          "Invalid booking ID. Please refresh the page.",
        );
        setIsSubmitting(false);
        setBookingToExtend(null);
        return;
      }

      // Fetch fresh booking details from API to get the most current status
      let freshBooking = booking;
      try {
        const detailsResponse = await API.get(
          `/bookings/details/${displayId}?is_package=${isPackage}`,
          authHeader(),
        );
        if (detailsResponse.data) {
          freshBooking = {
            ...booking,
            ...detailsResponse.data,
            is_package: isPackage,
          };
        }
      } catch (err) {
        console.warn(
          "Could not fetch fresh booking details, using cached data:",
          err,
        );
        // Continue with cached booking data
      }

      // Validate booking status - only allow "booked" or "checked-in" statuses
      if (!freshBooking.status) {
        showBannerMessage(
          "error",
          "Booking status is missing. Please refresh the page.",
        );
        setIsSubmitting(false);
        setBookingToExtend(null);
        return;
      }

      // Normalize status: handle both "checked-in", "checked_in", "checked-out", "checked_out" formats
      // Convert to lowercase and replace both hyphens and underscores with hyphens for consistent comparison
      const rawStatusLower = freshBooking.status.toLowerCase().trim();
      const normalizedStatus = rawStatusLower.replace(/[-_]/g, "-");

      // Debug: log the actual status for troubleshooting
      console.log(
        "Extend booking - Booking ID:",
        bookingId,
        "Display ID:",
        displayId,
        "Original status:",
        freshBooking.status,
        "Raw lower:",
        rawStatusLower,
        "Normalized:",
        normalizedStatus,
        "Is Package:",
        isPackage,
      );

      // Check if status is valid for extension (booked or checked-in)
      // Handle multiple formats: "booked", "checked-in", "checked_in", "checked in"
      // Note: "checked_out" is NOT allowed (that means guest has already left)
      const isValidStatus =
        normalizedStatus === "booked" ||
        normalizedStatus === "checked-in" ||
        rawStatusLower === "checked_in" ||
        rawStatusLower === "checked-in" ||
        rawStatusLower === "checked in";

      // Explicitly reject checked_out/checked-out statuses
      // Be careful: "checked-in" normalizes to "checked-in", "checked-out" normalizes to "checked-out"
      const isCheckedOut =
        (normalizedStatus.includes("out") &&
          normalizedStatus.startsWith("checked-") &&
          normalizedStatus.endsWith("-out")) ||
        ["checked_out", "checked-out", "checked out"].includes(rawStatusLower);

      if (isCheckedOut) {
        showBannerMessage(
          "error",
          `Cannot extend checkout for booking with status '${freshBooking.status}'. The guest has already checked out.`,
        );
        console.error("Booking already checked out:", {
          bookingId,
          displayId,
          originalStatus: freshBooking.status,
          normalizedStatus,
          rawStatusLower,
          isCheckedOut,
          isPackage: isPackage,
        });
        setIsSubmitting(false);
        setBookingToExtend(null);
        return;
      }

      if (!isValidStatus) {
        // Show more detailed error message
        const statusDisplay = freshBooking.status || "unknown";
        showBannerMessage(
          "error",
          `Cannot extend checkout for booking with status '${statusDisplay}'. Only 'booked' or 'checked-in' bookings can be extended.`,
        );
        console.error("Invalid status for extension:", {
          bookingId,
          displayId,
          originalStatus: freshBooking.status,
          rawStatusLower,
          normalizedStatus,
          isValidStatus,
          isPackage: isPackage,
        });
        setIsSubmitting(false);
        setBookingToExtend(null);
        return;
      }

      // Use the correct endpoint based on booking type
      // Room bookings (from bookings table) use: /bookings/{id}/extend
      // Package bookings (from package_bookings table) use: /packages/booking/{id}/extend
      const url = isPackage
        ? `/packages/booking/${displayId}/extend?new_checkout=${newCheckoutDate}`
        : `/bookings/${displayId}/extend?new_checkout=${newCheckoutDate}`;

      console.log("Extending booking:", {
        bookingId,
        displayId,
        isPackage,
        url,
        status: freshBooking.status,
        newCheckoutDate,
      });

      await API.put(url, {}, authHeader());

      showBannerMessage("success", "Booking checkout extended successfully!");
      setBookingToExtend(null);
      fetchData();
    } catch (err) {
      console.error("Booking extension error:", err);
      const errorMessage =
        err.response?.data?.detail ||
        err.response?.data?.message ||
        err.message ||
        "Failed to extend booking.";
      showBannerMessage("error", errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCheckIn = async (bookingId, images) => {
    setFeedback({ message: "", type: "" });
    setIsSubmitting(true);

    // Double-check booking status before submitting
    const booking = bookings.find(
      (b) =>
        b.id === bookingId &&
        b.is_package === (bookingToCheckIn?.is_package || false),
    );
    const normalizedStatus = booking?.status
      ?.toLowerCase()
      .replace(/[-_]/g, "");

    if (normalizedStatus !== "booked") {
      console.error("Check-in blocked: Invalid booking status", {
        bookingId,
        status: booking?.status,
        normalizedStatus,
      });
      showBannerMessage(
        "error",
        `Cannot check in. Booking status is: ${booking?.status || "unknown"}`,
      );
      setBookingToCheckIn(null);
      setIsSubmitting(false);
      return;
    }

    const formData = new FormData();
    formData.append("id_card_image", images.id_card_image);
    formData.append("guest_photo", images.guest_photo);

    // Pass room assignments if rooms are being assigned during check-in (Soft Allocation)
    if (images.room_ids) {
      formData.append("room_ids", images.room_ids);
    }

    // Explicitly append amenityAllocation if present so backend can process scheduled food orders
    if (images.amenityAllocation) {
      formData.append("amenityAllocation", JSON.stringify(images.amenityAllocation));
    }

    // Use display ID for API call
    const displayId = generateBookingId(booking || bookingToCheckIn);
    const url = booking?.is_package
      ? `/packages/booking/${displayId}/check-in`
      : `/bookings/${displayId}/check-in`;

    try {
      const response = await API.put(url, formData, {
        headers: {
          ...authHeader().headers,
          "Content-Type": "multipart/form-data",
        },
      });

      // Directly update the booking in the state with the response data
      setBookings((prevBookings) =>
        prevBookings.map((b) =>
          b.id === bookingId && b.is_package === booking.is_package
            ? // Merge old booking data with new to preserve fields like `is_package`
            { ...b, ...response.data }
            : b,
        ),
      );

      // After successful check-in, auto-create stock issues for complimentary amenities
      if (images.amenityAllocation && images.amenityAllocation.items?.length) {
        try {
          const alloc = images.amenityAllocation;
          const nights = alloc.nights || 1;

          // Find main warehouse. Prefer inventory points, but fall back to any central/warehouse type.
          let mainWarehouse = inventoryLocations.find((loc) => {
            const type = String(loc.location_type || "").toUpperCase();
            return (
              loc.is_inventory_point === true &&
              (type === "CENTRAL_WAREHOUSE" ||
                type === "WAREHOUSE" ||
                type === "BRANCH_STORE")
            );
          });
          if (!mainWarehouse) {
            mainWarehouse =
              inventoryLocations.find((loc) => {
                const type = String(loc.location_type || "").toUpperCase();
                return (
                  type === "CENTRAL_WAREHOUSE" ||
                  type === "WAREHOUSE" ||
                  type === "BRANCH_STORE"
                );
              }) || null;
          }

          if (!mainWarehouse) {
            console.warn(
              "(X) No main warehouse inventory point found; skipping amenity stock issue.",
            );
            console.log(
              "Available locations:",
              inventoryLocations.map((loc) => ({
                id: loc.id,
                name: loc.name,
                location_type: loc.location_type,
                is_inventory_point: loc.is_inventory_point,
              })),
            );
          } else {
            console.log("(V) Found main warehouse:", mainWarehouse);
            // Determine destination room location (first room of booking)
            const firstRoom = (booking.rooms && booking.rooms[0]) || null;
            const roomNumber =
              firstRoom?.number || firstRoom?.room?.number || null;

            let destinationLocation = null;
            if (roomNumber) {
              destinationLocation =
                inventoryLocations.find((loc) => {
                  const type = String(loc.location_type || "").toUpperCase();
                  if (type !== "GUEST_ROOM") return false;
                  const searchStr = String(roomNumber).toLowerCase().replace(/^0+/, "") || "0";
                  const searchStrPadded = String(roomNumber).toLowerCase();
                  const area = String(loc.room_area || "").toLowerCase();
                  const name = String(loc.name || "").toLowerCase();
                  const areaNoZeros = area.replace(/^0+/, "") || area;
                  const nameNoZeros = name.replace(/^0+/, "") || name;
                  if (area === searchStrPadded || areaNoZeros === searchStr) return true;
                  if (name === searchStrPadded || nameNoZeros === searchStr) return true;
                  const patterns = [`room ${searchStr}`, `room-${searchStr}`, `room${searchStr}`, `room ${searchStrPadded}`];
                  return patterns.some(p => area === p || name === p);
                }) || null;
            }

            if (!destinationLocation) {
              console.warn(
                "No matching room location found for amenity allocation; skipping stock issue.",
              );
              console.log("Room number searched:", roomNumber);
              console.log(
                "Available locations:",
                inventoryLocations
                  .filter((loc) => {
                    const type = String(loc.location_type || "").toUpperCase();
                    return type === "GUEST_ROOM";
                  })
                  .map((loc) => ({
                    id: loc.id,
                    name: loc.name,
                    room_area: loc.room_area,
                    location_type: loc.location_type,
                  })),
              );
            } else {
              console.log(
                "(V) Found destination location:",
                destinationLocation,
              );
              const issueDetails = alloc.items
                .map((a) => {
                  // Find inventory item by explicit ID if present, otherwise by name match
                  let invItem = null;
                  if (a.item_id) {
                    invItem = inventoryItems.find((it) => it.id === a.item_id);
                  }
                  if (!invItem && a.name) {
                    const target = String(a.name).trim().toLowerCase();
                    invItem =
                      // Exact match
                      inventoryItems.find(
                        (it) =>
                          String(it.name || "")
                            .trim()
                            .toLowerCase() === target,
                      ) ||
                      // Inventory name contains target (e.g. "Mineral Water 500ml" vs "Water")
                      inventoryItems.find((it) =>
                        String(it.name || "")
                          .toLowerCase()
                          .includes(target),
                      ) ||
                      // Target contains inventory name (e.g. "Water Bottle 500ml" vs "Water")
                      inventoryItems.find((it) =>
                        target.includes(String(it.name || "").toLowerCase()),
                      ) ||
                      null;
                  }
                  if (!invItem) return null;

                  const totalQuantity =
                    a.frequency === "PER_NIGHT"
                      ? (a.complimentaryPerNight || 0) * nights
                      : a.complimentaryPerStay || 0;

                  if (!totalQuantity || totalQuantity <= 0)
                    return null;

                  return {
                    item_id: invItem.id,
                    issued_quantity: totalQuantity,
                    unit: invItem?.unit || "pcs",
                    batch_lot_number: null,
                    cost: null,
                    is_payable: Boolean(a.is_payable),
                    notes: a.is_payable
                      ? `Payable amenity allocation on check-in (Price: ${a.extraPrice})`
                      : "Complimentary amenity allocation on check-in",
                  };
                })
                .filter(Boolean);

              if (issueDetails.length > 0) {
                console.log("=== STOCK ISSUE CREATION DEBUG ===");
                console.log("Main Warehouse:", mainWarehouse);
                console.log("Destination Location:", destinationLocation);
                console.log("Issue Details:", issueDetails);
                console.log(
                  "Inventory Items:",
                  inventoryItems.filter((it) =>
                    issueDetails.some((id) => id.item_id === it.id),
                  ),
                );

                try {
                  const issueResponse = await API.post(
                    "/inventory/issues",
                    {
                      requisition_id: null,
                      source_location_id: mainWarehouse.id,
                      destination_location_id: destinationLocation.id,
                      issue_date: getCurrentDateTimeIST(),
                      notes: `Auto amenity allocation for booking ${generateBookingId(booking || bookingToCheckIn)}`,
                      details: issueDetails,
                    },
                    authHeader(),
                  );
                  console.log(
                    "(V) Stock issue created successfully:",
                    issueResponse.data,
                  );
                  showBannerMessage(
                    "success",
                    `Stock issue created: ${issueDetails.length} item(s) allocated to room.`,
                  );
                } catch (issueError) {
                  console.error("(X) Stock issue creation failed:", issueError);
                  console.error("Error response:", issueError.response?.data);
                  showBannerMessage(
                    "error",
                    `Failed to create stock issue: ${issueError.response?.data?.detail || issueError.message}`,
                  );
                }
              } else {
                console.warn(
                  "No issue details to create - all items filtered out",
                );
              }
            }
          }
        } catch (issueErr) {
          console.error(
            "Failed to create amenity stock issue on check-in:",
            issueErr,
          );
        }
      }

      showBannerMessage("success", "Guest checked in successfully!");
      setBookingToCheckIn(null);

      // Trigger refresh of Inventory page if it's open
      window.dispatchEvent(new CustomEvent("inventory-refresh"));
    } catch (err) {
      console.error("Check-in error:", err);
      const errorMessage =
        err.response?.data?.detail || "Failed to check in guest.";
      showBannerMessage("error", errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  const viewDetails = async (id, is_package) => {
    // Set a temporary booking to open the modal instantly, then fetch full details
    const tempBooking = bookings.find(
      (b) => b.id === id && b.is_package === is_package,
    );
    setModalBooking(tempBooking || { guest_name: "Loading..." }); // Show a loading state

    try {
      // Use display ID for API call
      const displayId = tempBooking
        ? generateBookingId(tempBooking)
        : is_package
          ? `PK-${String(id).padStart(6, "0")}`
          : `BK-${String(id).padStart(6, "0")}`;
      const response = await API.get(
        `/bookings/details/${displayId}?is_package=${is_package}`,
        authHeader(),
      );
      setModalBooking({ ...response.data, display_id: displayId }); // Update the modal with full, fresh data, preserving accurate displayId
    } catch (err) {
      console.error("Failed to fetch booking details:", err);
      showBannerMessage("error", "Could not load booking details.");
      // Close modal on error
      setModalBooking(null);
    }
  };

  const cancelBooking = async (id, is_package) => {
    if (!window.confirm("Are you sure you want to cancel this booking?"))
      return;
    try {
      // Find booking and get display ID
      const booking = bookings.find(
        (b) => b.id === id && b.is_package === is_package,
      );
      const displayId = booking
        ? generateBookingId(booking)
        : is_package
          ? `PK-${String(id).padStart(6, "0")}`
          : `BK-${String(id).padStart(6, "0")}`;

      // First fetch fresh details; if already cancelled, reflect immediately
      try {
        const fresh = await API.get(
          `/bookings/details/${displayId}?is_package=${is_package}`,
          authHeader(),
        );
        if (
          fresh?.data?.status &&
          fresh.data.status.toLowerCase().includes("cancel")
        ) {
          setBookings((prev) =>
            prev.map((b) =>
              b.id === id && b.is_package === is_package
                ? { ...b, ...fresh.data }
                : b,
            ),
          );
          showBannerMessage("success", "Booking is already cancelled.");
          return;
        }
      } catch (_) { }

      const url = is_package
        ? `/packages/booking/${displayId}/cancel`
        : `/bookings/${displayId}/cancel`;
      const response = await API.put(url, {}, authHeader());
      showBannerMessage("success", "Booking cancelled successfully.");
      // Update the booking in state instead of refetching everything
      setBookings((prevBookings) =>
        prevBookings.map((b) =>
          b.id === id && b.is_package === is_package
            ? { ...b, ...response.data }
            : b,
        ),
      );
    } catch (err) {
      // If endpoint is unavailable but the booking is actually cancelled, reflect it
      if (err?.response?.status === 404) {
        try {
          const booking = bookings.find(
            (b) => b.id === id && b.is_package === is_package,
          );
          const displayId = booking
            ? generateBookingId(booking)
            : is_package
              ? `PK-${String(id).padStart(6, "0")}`
              : `BK-${String(id).padStart(6, "0")}`;
          const fresh = await API.get(
            `/bookings/details/${displayId}?is_package=${is_package}`,
            authHeader(),
          );
          if (fresh?.data) {
            setBookings((prev) =>
              prev.map((b) =>
                b.id === id && b.is_package === is_package
                  ? { ...b, ...fresh.data }
                  : b,
              ),
            );
            const normalized = fresh.data.status?.toLowerCase() || "";
            if (normalized.includes("cancel")) {
              showBannerMessage(
                "success",
                "Booking status synced to Cancelled.",
              );
              return;
            }
          }
        } catch (_) { }
      }
      console.error("Failed to cancel booking:", err);
      showBannerMessage("error", "Failed to cancel booking.");
    }
  };

  const markNoShowBooking = async (b) => {
    const displayId = generateBookingId(b);
    if (
      !window.confirm(
        `Are you sure you want to mark booking ${displayId} (${b.guest_name || "Guest"}) as NO SHOW?\n\nThis will update status to No Show, release physical room availability, and notify Channel Manager.`
      )
    )
      return;
    try {
      const response = await API.post(
        `/channel-manager/mark-no-show?booking_id=${b.id}`,
        {},
        authHeader()
      );
      showBannerMessage(
        "success",
        `Booking ${displayId} marked as No Show successfully! ${response.data?.aiosell_pushed ? "(Synced with Channel Manager)" : ""}`
      );
      setBookings((prevBookings) =>
        prevBookings.map((item) =>
          item.id === b.id && item.is_package === b.is_package
            ? { ...item, status: "No Show" }
            : item
        )
      );
    } catch (err) {
      console.error("Mark No Show error:", err);
      showBannerMessage(
        "error",
        err.response?.data?.detail || "Failed to mark booking as No Show."
      );
    }
  };

  const RoomSelection = React.memo(
    ({ rooms, selectedRoomNumbers, onRoomToggle }) => {
      return (
        <div className="flex flex-wrap gap-4 p-4 border border-gray-300 rounded-lg bg-gray-50 max-h-64 overflow-y-auto">
          {rooms.length > 0 ? (
            rooms.map((room) => (
              <motion.div
                key={room.id}
                whileHover={{ scale: 1.05 }}
                className={`
                p-4 rounded-xl shadow-md cursor-pointer transition-all duration-200
                ${selectedRoomNumbers.includes(room.number)
                    ? "bg-indigo-600 text-white transform scale-105 ring-2 ring-indigo-500"
                    : "bg-white text-gray-800 hover:bg-gray-100"
                  }
              `}
                onClick={() => onRoomToggle(room.number)}
              >
                <div className="w-full h-24 mb-2 bg-gray-200 rounded-lg flex items-center justify-center text-gray-500">
                  {/* Placeholder for Room Image */}
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-12 w-12"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 8v-10a1 1 0 011-1h2a1 1 0 011 1v10m-6 0h6"
                    />
                  </svg>
                </div>
                <div
                  className={`font-semibold text-lg ${selectedRoomNumbers.includes(room.number) ? "text-white" : "text-indigo-700"}`}
                >
                  Room {room.number}
                </div>
                <div
                  className={`text-sm ${selectedRoomNumbers.includes(room.number) ? "text-indigo-200" : "text-gray-500"}`}
                >
                  <p>
                    Capacity: {room.adults} Adults, {room.children} Children
                  </p>
                  <p className="font-medium">
                    {formatCurrency(room.price)}/night
                  </p>
                </div>
              </motion.div>
            ))
          ) : (
            <div className="w-full text-center py-8 text-gray-500">
              <div className="text-lg mb-2">(Refused)</div>
              <p className="font-medium">
                No rooms available for the selected dates
              </p>
              <p className="text-sm mt-1">
                Please try different dates or room type
              </p>
            </div>
          )}
        </div>
      );
    },
  );
  RoomSelection.displayName = "RoomSelection";

  return (
    <DashboardLayout>
      <BannerMessage
        message={bannerMessage}
        onClose={closeBannerMessage}
        autoDismiss={true}
        duration={5000}
      />
      {/* Animated Background */}
      <div className="bubbles-container">
        <li></li>
        <li></li>
        <li></li>
        <li></li>
        <li></li>
        <li></li>
        <li></li>
        <li></li>
        <li></li>
        <li></li>
      </div>

      <div className="p-4 sm:p-6 lg:p-8 space-y-8 bg-gray-100 min-h-screen font-sans">
        <h1 className="text-3xl sm:text-4xl font-extrabold text-gray-800 tracking-tight">
          Booking Management Dashboard
        </h1>

        {/* Main Tabs Navigation */}
        <div className="flex justify-center mb-8 relative z-20">
          <div className="bg-white/60 backdrop-blur-xl p-2 rounded-[2rem] border border-white/50 shadow-2xl shadow-indigo-100/50 flex flex-wrap justify-center gap-2">
            {mainTabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setMainTab(tab.id)}
                className={`px-8 py-3 rounded-[1.5rem] text-sm font-semibold transition-all duration-300 relative overflow-hidden ${mainTab === tab.id
                  ? "bg-indigo-600 text-white shadow-lg shadow-indigo-200 scale-105"
                  : "text-slate-500 hover:text-indigo-600 hover:bg-white/50"
                  }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {mainTab === "dashboard" && (
          <>
            {/* Charts and Statistics Row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
              {/* Booking Status Chart */}
              <motion.div
                className="bg-white p-6 rounded-2xl shadow-lg"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
              >
                <BookingStatusChart data={bookings} />
              </motion.div>

              {/* Package Information */}
              <motion.div
                className="bg-white p-6 rounded-2xl shadow-lg"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.1 }}
              >
                <h3 className="text-xl font-bold mb-4 text-gray-800">
                  Available Packages
                </h3>
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {packages.length > 0 ? (
                    packages.map((pkg) => (
                      <div
                        key={pkg.id}
                        className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
                      >
                        <div className="flex justify-between items-start mb-2">
                          <h4 className="font-semibold text-gray-800">
                            {pkg.title}
                          </h4>
                          <span className="text-indigo-600 font-bold">
                            {formatCurrency(pkg.price)}
                          </span>
                        </div>
                        <p className="text-sm text-gray-600 mb-2 line-clamp-2">
                          {pkg.description}
                        </p>
                        <div className="flex items-center gap-2 text-xs text-gray-500">
                          <span
                            className={`px-2 py-1 rounded ${pkg.booking_type === "whole_property" ? "bg-purple-100 text-purple-700" : "bg-blue-100 text-blue-700"}`}
                          >
                            {pkg.booking_type === "whole_property"
                              ? "Whole Property"
                              : "Selected Rooms"}
                          </span>
                          {pkg.room_types && (
                            <span className="text-gray-600">
                              Types: {pkg.room_types}
                            </span>
                          )}
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-gray-500 text-center py-8">
                      No packages available
                    </p>
                  )}
                </div>
              </motion.div>
            </div>

            {/* All Packages - Detailed View */}
            <motion.div
              className="bg-white p-6 rounded-2xl shadow-lg mb-8"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
            >
              <h3 className="text-xl font-bold mb-6 text-gray-800">
                All Packages - Complete Details
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {packages.length > 0 ? (
                  packages.map((pkg) => (
                    <div
                      key={pkg.id}
                      className="border-2 border-gray-200 rounded-xl p-5 hover:shadow-lg transition-all bg-gradient-to-br from-white to-gray-50"
                    >
                      <div className="flex justify-between items-start mb-3">
                        <h4 className="font-bold text-lg text-gray-800">
                          {pkg.title}
                        </h4>
                        <span className="text-indigo-600 font-bold text-xl">
                          {formatCurrency(pkg.price)}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 mb-4 min-h-[3rem]">
                        {pkg.description || "No description available"}
                      </p>
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <span
                            className={`px-3 py-1 rounded-full text-xs font-semibold ${pkg.booking_type === "whole_property"
                              ? "bg-purple-100 text-purple-700"
                              : "bg-blue-100 text-blue-700"
                              }`}
                          >
                            {pkg.booking_type === "whole_property"
                              ? "Whole Property"
                              : "Selected Rooms"}
                          </span>
                        </div>
                        {pkg.room_types && (
                          <div className="text-xs text-gray-600">
                            <span className="font-semibold">Room Types: </span>
                            <span>{pkg.room_types}</span>
                          </div>
                        )}
                        {pkg.images && pkg.images.length > 0 && (
                          <div className="text-xs text-gray-500">
                            <span className="font-semibold">Images: </span>
                            <span>{pkg.images.length} photo(s)</span>
                          </div>
                        )}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="col-span-full text-center py-12 text-gray-500">
                    <p className="text-lg">No packages available</p>
                  </div>
                )}
              </div>
            </motion.div>

            {/* All Rooms - Detailed View */}
            <motion.div
              className="bg-white p-6 rounded-2xl shadow-lg mb-8"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.3 }}
            >
              <h3 className="text-xl font-bold mb-6 text-gray-800">
                All Rooms - Complete Details
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {allRooms.length > 0 ? (
                  allRooms.map((room) => {

                    return (
                      <div
                        key={room.id}
                        className="border-2 border-gray-200 rounded-xl overflow-hidden hover:shadow-lg transition-all bg-white"
                      >
                        {room.image_url && (
                          <img
                            src={getImageUrl(room.image_url)}
                            alt={`Room ${room.number}`}
                            className="w-full h-48 object-cover"
                          />
                        )}
                        <div className="p-4">
                          <div className="flex justify-between items-start mb-2">
                            <div>
                              <h4 className="font-bold text-lg text-gray-800">
                                Room {room.number}
                              </h4>
                              <p className="text-sm text-gray-600">
                                {room.type}
                              </p>
                            </div>
                            <span
                              className={`px-2 py-1 rounded-full text-xs font-semibold ${room.status === "Available"
                                ? "bg-green-100 text-green-700"
                                : room.status === "Booked"
                                  ? "bg-red-100 text-red-700"
                                  : room.status === "Maintenance"
                                    ? "bg-yellow-100 text-yellow-700"
                                    : "bg-gray-100 text-gray-700"
                                }`}
                            >
                              {room.status}
                            </span>
                          </div>
                          <p className="text-indigo-600 font-bold text-lg mb-3">
                            {formatCurrency(room.price)}/night
                          </p>
                          <p className="text-sm text-gray-600 mb-3">
                            Capacity: {room.adults || 0} Adults,{" "}
                            {room.children || 0} Children
                          </p>
                          {(room.air_conditioning ||
                            room.wifi ||
                            room.bathroom ||
                            room.living_area ||
                            room.terrace ||
                            room.parking ||
                            room.kitchen ||
                            room.family_room ||
                            room.bbq ||
                            room.garden ||
                            room.dining ||
                            room.breakfast) && (
                              <div className="flex flex-wrap gap-1 mt-3">
                                {room.air_conditioning && (
                                  <span className="px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded-full">
                                    AC
                                  </span>
                                )}
                                {room.wifi && (
                                  <span className="px-2 py-1 text-xs bg-green-100 text-green-700 rounded-full">
                                    WiFi
                                  </span>
                                )}
                                {room.bathroom && (
                                  <span className="px-2 py-1 text-xs bg-purple-100 text-purple-700 rounded-full">
                                    Bathroom
                                  </span>
                                )}
                                {room.living_area && (
                                  <span className="px-2 py-1 text-xs bg-orange-100 text-orange-700 rounded-full">
                                    Living
                                  </span>
                                )}
                                {room.terrace && (
                                  <span className="px-2 py-1 text-xs bg-yellow-100 text-yellow-700 rounded-full">
                                    Terrace
                                  </span>
                                )}
                                {room.parking && (
                                  <span className="px-2 py-1 text-xs bg-indigo-100 text-indigo-700 rounded-full">
                                    Parking
                                  </span>
                                )}
                                {room.kitchen && (
                                  <span className="px-2 py-1 text-xs bg-pink-100 text-pink-700 rounded-full">
                                    Kitchen
                                  </span>
                                )}
                                {room.family_room && (
                                  <span className="px-2 py-1 text-xs bg-teal-100 text-teal-700 rounded-full">
                                    Family
                                  </span>
                                )}
                                {room.bbq && (
                                  <span className="px-2 py-1 text-xs bg-red-100 text-red-700 rounded-full">
                                    BBQ
                                  </span>
                                )}
                                {room.garden && (
                                  <span className="px-2 py-1 text-xs bg-emerald-100 text-emerald-700 rounded-full">
                                    Garden
                                  </span>
                                )}
                                {room.dining && (
                                  <span className="px-2 py-1 text-xs bg-amber-100 text-amber-700 rounded-full">
                                    Dining
                                  </span>
                                )}
                                {room.breakfast && (
                                  <span className="px-2 py-1 text-xs bg-cyan-100 text-cyan-700 rounded-full">
                                    Breakfast
                                  </span>
                                )}
                              </div>
                            )}
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="col-span-full text-center py-12 text-gray-500">
                    <p className="text-lg">No rooms available</p>
                  </div>
                )}
              </div>
            </motion.div>

            {/* Available Rooms Section */}
            <motion.div
              className="bg-white p-6 rounded-2xl shadow-lg mb-8"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.4 }}
            >
              <h3 className="text-xl font-bold mb-6 text-gray-800">
                Available Rooms (
                {allRooms.filter((r) => r.status === "Available").length})
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {allRooms.filter((r) => r.status === "Available").length > 0 ? (
                  allRooms
                    .filter((r) => r.status === "Available")
                    .map((room) => {

                      return (
                        <div
                          key={room.id}
                          className="border-2 border-green-200 rounded-xl overflow-hidden hover:shadow-lg transition-all bg-gradient-to-br from-green-50 to-white"
                        >
                          {room.image_url && (
                            <img
                              src={getImageUrl(room.image_url)}
                              alt={`Room ${room.number}`}
                              className="w-full h-48 object-cover"
                            />
                          )}
                          <div className="p-4">
                            <div className="flex justify-between items-start mb-2">
                              <div>
                                <h4 className="font-bold text-lg text-gray-800">
                                  Room {room.number}
                                </h4>
                                <p className="text-sm text-gray-600">
                                  {room.type}
                                </p>
                              </div>
                              <span className="px-2 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-700">
                                Available
                              </span>
                            </div>
                            <p className="text-indigo-600 font-bold text-lg mb-3">
                              {formatCurrency(room.price)}/night
                            </p>
                            <p className="text-sm text-gray-600 mb-3">
                              Capacity: {room.adults || 0} Adults,{" "}
                              {room.children || 0} Children
                            </p>
                            {(room.air_conditioning ||
                              room.wifi ||
                              room.bathroom ||
                              room.living_area ||
                              room.terrace ||
                              room.parking ||
                              room.kitchen ||
                              room.family_room ||
                              room.bbq ||
                              room.garden ||
                              room.dining ||
                              room.breakfast) && (
                                <div className="flex flex-wrap gap-1 mt-3">
                                  {room.air_conditioning && (
                                    <span className="px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded-full">
                                      AC
                                    </span>
                                  )}
                                  {room.wifi && (
                                    <span className="px-2 py-1 text-xs bg-green-100 text-green-700 rounded-full">
                                      WiFi
                                    </span>
                                  )}
                                  {room.bathroom && (
                                    <span className="px-2 py-1 text-xs bg-purple-100 text-purple-700 rounded-full">
                                      Bathroom
                                    </span>
                                  )}
                                  {room.living_area && (
                                    <span className="px-2 py-1 text-xs bg-orange-100 text-orange-700 rounded-full">
                                      Living
                                    </span>
                                  )}
                                  {room.terrace && (
                                    <span className="px-2 py-1 text-xs bg-yellow-100 text-yellow-700 rounded-full">
                                      Terrace
                                    </span>
                                  )}
                                  {room.parking && (
                                    <span className="px-2 py-1 text-xs bg-indigo-100 text-indigo-700 rounded-full">
                                      Parking
                                    </span>
                                  )}
                                  {room.kitchen && (
                                    <span className="px-2 py-1 text-xs bg-pink-100 text-pink-700 rounded-full">
                                      Kitchen
                                    </span>
                                  )}
                                  {room.family_room && (
                                    <span className="px-2 py-1 text-xs bg-teal-100 text-teal-700 rounded-full">
                                      Family
                                    </span>
                                  )}
                                  {room.bbq && (
                                    <span className="px-2 py-1 text-xs bg-red-100 text-red-700 rounded-full">
                                      BBQ
                                    </span>
                                  )}
                                  {room.garden && (
                                    <span className="px-2 py-1 text-xs bg-emerald-100 text-emerald-700 rounded-full">
                                      Garden
                                    </span>
                                  )}
                                  {room.dining && (
                                    <span className="px-2 py-1 text-xs bg-amber-100 text-amber-700 rounded-full">
                                      Dining
                                    </span>
                                  )}
                                  {room.breakfast && (
                                    <span className="px-2 py-1 text-xs bg-cyan-100 text-cyan-700 rounded-full">
                                      Breakfast
                                    </span>
                                  )}
                                </div>
                              )}
                          </div>
                        </div>
                      );
                    })
                ) : (
                  <div className="col-span-full text-center py-12 text-gray-500">
                    <p className="text-lg">No available rooms</p>
                  </div>
                )}
              </div>
            </motion.div>

            {/* All Bookings with Guest Details */}
            <motion.div
              className="bg-white p-6 rounded-2xl shadow-lg"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.5 }}
            >
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-bold text-gray-800">
                  All Bookings & Guest Details ({bookings.length})
                </h3>
                {hasPermission('bookings:create') && (
                  <button
                    onClick={() => setIsBookingModalOpen(true)}
                    className="px-6 py-2 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 flex items-center gap-2 active:scale-95"
                  >
                    <Plus className="w-5 h-5" />
                    Create New Booking
                  </button>
                )}
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left font-semibold text-gray-700">
                        Guest Name
                      </th>
                      <th className="px-4 py-3 text-left font-semibold text-gray-700">
                        Contact
                      </th>
                      <th className="px-4 py-3 text-left font-semibold text-gray-700">
                        Type
                      </th>
                      <th className="px-4 py-3 text-left font-semibold text-gray-700">
                        Qty
                      </th>
                      <th className="px-4 py-3 text-left font-semibold text-gray-700">
                        Assigned
                      </th>
                      <th className="px-4 py-3 text-left font-semibold text-gray-700">
                        Check-in
                      </th>
                      <th className="px-4 py-3 text-left font-semibold text-gray-700">
                        Check-out
                      </th>
                      <th className="px-4 py-3 text-left font-semibold text-gray-700">
                        Status
                      </th>
                      <th className="px-4 py-3 text-left font-semibold text-gray-700">
                        Guests
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {bookings.map((booking) => {
                      const roomBadges = booking.rooms && booking.rooms.length > 0 ? (
                        <div className="flex flex-wrap gap-1.5 max-w-[150px]">
                          {booking.rooms.map((room, idx) => {
                            let r = booking.is_package ? room?.room : room;
                            if (!r?.number && room?.room_id && roomIdToRoom && roomIdToRoom[room.room_id]) {
                              r = roomIdToRoom[room.room_id];
                            }
                            const isRoomCheckedOut = r?.status?.toLowerCase().trim() === "available";
                            const roomNumber = r?.number || "-";
                            return (
                              <span
                                key={idx}
                                className={`px-2 py-0.5 border rounded text-[9px] font-bold shadow-sm transition-all duration-300 ${
                                  isRoomCheckedOut
                                    ? "bg-slate-100 text-slate-400 border-slate-200 line-through opacity-75 hover:opacity-100"
                                    : "bg-white text-slate-600 border-slate-100 hover:border-indigo-100"
                                }`}
                                title={isRoomCheckedOut ? `Room ${roomNumber} Checked Out` : `Room ${roomNumber} Active`}
                              >
                                {roomNumber}
                              </span>
                            );
                          })}
                        </div>
                      ) : "-";

                      return (
                        <tr
                          key={`${booking.is_package ? "pkg" : "reg"}_${booking.id}`}
                          className="hover:bg-gray-50"
                        >
                          <td className="px-4 py-3">
                            <div className="font-medium text-gray-900">
                              {booking.guest_name}
                            </div>
                            {booking.guest_email && (
                              <div className="text-[10px] text-gray-400">
                                {booking.guest_email}
                              </div>
                            )}
                            {booking.source && (
                              <div className={`mt-1 inline-flex items-center px-1.5 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-wider ${
                                (booking.source === 'Guest' || booking.source === 'guest')
                                  ? "bg-sky-50 text-sky-600 border border-sky-100"
                                  : (booking.source !== 'Direct' && booking.source !== 'Admin' && booking.source !== 'direct' && booking.source !== 'admin')
                                  ? "bg-violet-50 text-violet-600 border border-violet-100"
                                  : "bg-emerald-50 text-emerald-600 border border-emerald-100"
                              }`}>
                                {(booking.source === 'Guest' || booking.source === 'guest') ? 'Guest' :
                                 (booking.source === 'Admin' || booking.source === 'admin') ? 'Admin' :
                                 booking.source}
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-3 text-gray-700">
                            {booking.guest_mobile || "-"}
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={`px-2 py-1 rounded-full text-xs font-semibold ${booking.is_package
                                ? "bg-purple-100 text-purple-700"
                                : "bg-blue-100 text-blue-700"
                                }`}
                            >
                              {booking.is_package ? "Package" : "Room"}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-gray-700 font-bold">
                            {booking.num_rooms || 1}
                          </td>
                          <td className="px-4 py-3 text-gray-700">
                            {roomBadges}
                          </td>
                          <td className="px-4 py-3 text-gray-700">
                            {formatDateShort(booking.check_in)}
                          </td>
                          <td className="px-4 py-3 text-gray-700">
                            {formatDateShort(booking.check_out)}
                          </td>
                          <td className="px-4 py-3">
                            <BookingStatusBadge
                              status={determineBookingStatus(booking)}
                              isPackage={booking.is_package}
                              packageName={booking.package?.title || (booking.is_package ? packages.find(p => p.id == booking.package_id)?.title : null)}
                              isConfirmed={booking.is_confirmed}
                              advanceDeposit={booking.advance_deposit}
                            />
                          </td>
                          <td className="px-4 py-3 text-gray-700">
                            {booking.adults || 0}A, {booking.children || 0}C
                          </td>
                        </tr>
                      );
                    })}
                    {bookings.length === 0 && (
                      <tr>
                        <td
                          colSpan="9"
                          className="px-4 py-8 text-center text-gray-500"
                        >
                          No bookings found
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </motion.div>
          </>
        )}

        {/* Booking Management Tab */}
        {mainTab === "booking" && (
          <>
            <div className="space-y-8 animate-fadeIn mb-8">
              {/* Action Header */}
              <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 flex flex-col md:flex-row justify-between items-center gap-4">
                <div className="flex items-center gap-4 text-gray-800">
                  <div className="bg-indigo-100 p-3 rounded-2xl">
                    <Clock className="w-6 h-6 text-indigo-600" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold">Booking Operations</h2>
                    <p className="text-sm text-gray-500 font-medium">Manage and create guest reservations</p>
                  </div>
                </div>
                {hasPermission('bookings:create') && (
                  <button
                    onClick={() => setIsBookingModalOpen(true)}
                    className="w-full md:w-auto px-8 py-3 bg-indigo-600 text-white rounded-2xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 flex items-center justify-center gap-2 active:scale-95"
                  >
                    <Plus className="w-5 h-5" />
                    Create New Booking
                  </button>
                )}
              </div>

              {/* KPI Row */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-8 mb-12">
                <KPI_Card title="Total Bookings" value={kpis.activeBookings} icon={ClipboardList} color="indigo" />
                <KPI_Card title="Cancelled Bookings" value={kpis.cancelledBookings} icon={XCircle} color="rose" />
                <KPI_Card title="Available Rooms" value={kpis.availableRooms} icon={Home} color="emerald" />
                <KPI_Card title="Guests Today Check-in" value={kpis.todaysGuestsCheckin} icon={Briefcase} color="amber" />
                <KPI_Card title="Guests Today Check-out" value={kpis.todaysGuestsCheckout} icon={LogOut} color="indigo" />
              </div>

              {/* Bookings Table Control Center */}
              <div className="bg-white/40 backdrop-blur-xl p-10 rounded-[3rem] shadow-2xl shadow-indigo-100/50 border-2 border-white relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-50/50 blur-3xl -mr-32 -mt-32 rounded-full"></div>

                <div className="relative z-10 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-8 mb-12">
                  <div>
                    <h2 className="text-2xl font-bold text-slate-800 tracking-tight mb-2">Live Manifest</h2>
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-indigo-500"></div>
                      <span className="text-xs font-medium text-slate-500">
                        Displaying {filteredBookings.length} of {statusCounts.all} Active Records
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-4 w-full lg:w-auto">
                    <div className="flex-1 lg:flex-none min-w-[200px] space-y-2">
                      <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest ml-1">Lifecycle State</label>
                      <div className="relative">
                        <select
                          value={statusFilter}
                          onChange={(e) => setStatusFilter(e.target.value)}
                          className="w-full px-6 py-4 bg-white border-2 border-slate-50 rounded-2xl font-bold text-slate-700 text-xs shadow-sm focus:border-indigo-500 transition-all appearance-none outline-none"
                        >
                          <option value="All">All Transactions</option>
                          <option value="booked">[Date] Reserved</option>
                          <option value="checked-in">(V) Checked In</option>
                          <option value="checked-out">[Room] Checked Out</option>
                          <option value="cancelled">❌ Cancelled</option>
                        </select>
                        <ChevronDown className="absolute right-6 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                      </div>
                    </div>

                    <div className="flex-1 lg:flex-none min-w-[200px] space-y-2">
                      <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest ml-1">Temporal Filters</label>
                      <div className="flex gap-2">
                        <input
                          type="date"
                          value={fromDate}
                          onChange={(e) => setFromDate(e.target.value)}
                          className="w-1/2 px-4 py-4 bg-white border-2 border-slate-50 rounded-2xl font-bold text-slate-700 text-[10px] shadow-sm focus:border-indigo-500 transition-all outline-none"
                        />
                        <input
                          type="date"
                          value={toDate}
                          onChange={(e) => setToDate(e.target.value)}
                          className="w-1/2 px-4 py-4 bg-white border-2 border-slate-50 rounded-2xl font-bold text-slate-700 text-[10px] shadow-sm focus:border-indigo-500 transition-all outline-none"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="overflow-x-auto -mx-2 sm:mx-0">
                  <table className="w-full text-left border-separate border-spacing-y-4">
                    <thead>
                      <tr>
                        <th className="px-8 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Subject ID</th>
                        <th className="px-8 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Identity Details</th>
                        <th className="px-8 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Assignment</th>
                        <th className="px-8 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Expected Duration</th>
                        <th className="px-8 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Actual Timeline</th>
                        <th className="px-8 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Status</th>
                        <th className="px-8 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-center">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredBookings.length > 0 ? (
                        filteredBookings.map((b, index) => (
                          <motion.tr
                            key={b.id}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.5, delay: index * 0.05 }}
                            className="group"
                          >
                            <td className="px-8 py-6 bg-slate-50/50 group-hover:bg-white rounded-l-[2rem] border-y-2 border-l-2 border-transparent group-hover:border-indigo-100 transition-all">
                              <div className="font-bold text-indigo-600 text-sm tracking-tight">{generateBookingId(b)}</div>
                              {b.source && b.source !== 'Admin' && b.source !== 'Direct' && b.source !== 'direct' && b.source !== 'admin' ? (
                                <div className="mt-1.5 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-violet-50 border border-violet-200">
                                  <span className="w-1.5 h-1.5 rounded-full bg-violet-500 animate-pulse"></span>
                                  <span className="text-[9px] font-bold text-violet-600 uppercase tracking-wide">{b.source}</span>
                                </div>
                              ) : (
                                <div className="mt-1.5 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-50 border border-slate-200">
                                  <span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span>
                                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wide">{b.source || 'Direct'}</span>
                                </div>
                              )}
                            </td>
                            <td className="px-8 py-6 bg-slate-50/50 group-hover:bg-white border-y-2 border-transparent group-hover:border-indigo-100 transition-all">
                              <div className="font-bold text-slate-800 text-base tracking-tight leading-none mb-1">{b.guest_name}</div>
                              <div className="text-[10px] font-bold text-slate-400 tracking-tight">{b.guest_mobile || 'No Contact'}</div>
                            </td>
                            <td className="px-8 py-6 bg-slate-50/50 group-hover:bg-white border-y-2 border-transparent group-hover:border-indigo-100 transition-all">
                              <div className="flex flex-wrap gap-2">
                                {b.rooms?.map((room, idx) => {
                                  const r = b.is_package ? room.room : room;
                                  const isRoomCheckedOut = r?.status?.toLowerCase().trim() === "available";
                                  const roomNumber = r?.number || "-";
                                  return (
                                    <span
                                      key={idx}
                                      className={`px-3 py-1 border rounded-lg text-[10px] font-bold shadow-sm transition-all duration-300 ${
                                        isRoomCheckedOut
                                          ? "bg-slate-100 text-slate-400 border-slate-200 line-through opacity-75 hover:opacity-100"
                                          : "bg-white text-slate-600 border-slate-100 hover:border-indigo-100"
                                      }`}
                                      title={isRoomCheckedOut ? `Room ${roomNumber} Checked Out` : `Room ${roomNumber} Active`}
                                    >
                                      {roomNumber}
                                    </span>
                                  );
                                })}
                              </div>
                            </td>
                            <td className="px-8 py-6 bg-slate-50/50 group-hover:bg-white border-y-2 border-transparent group-hover:border-indigo-100 transition-all">
                              <div className="flex items-center gap-2 text-slate-700">
                                <div className="text-center min-w-[60px]">
                                  <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">IN</p>
                                  <p className="text-[10px] font-bold">{b.check_in}</p>
                                </div>
                                <div className="w-4 h-px bg-slate-200"></div>
                                <div className="text-center min-w-[60px]">
                                  <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">OUT</p>
                                  <p className="text-[10px] font-bold">{b.check_out}</p>
                                </div>
                              </div>
                            </td>
                            <td className="px-8 py-6 bg-slate-50/50 group-hover:bg-white border-y-2 border-transparent group-hover:border-indigo-100 transition-all">
                              <div className="flex items-center gap-2 text-slate-700">
                                <div className="text-center min-w-[70px]">
                                  <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest mb-0.5 text-indigo-500">ACTUAL IN</p>
                                  <p className="text-[10px] font-bold text-slate-800">{b.checked_in_at ? formatDateTimeShort(b.checked_in_at) : "-"}</p>
                                </div>
                                <div className="w-4 h-px bg-slate-200"></div>
                                <div className="text-center min-w-[70px]">
                                  <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest mb-0.5 text-indigo-500">ACTUAL OUT</p>
                                  <p className="text-[10px] font-bold text-slate-800">{b.checkout?.checkout_date ? formatDateTimeShort(b.checkout.checkout_date) : (b.checked_out_at ? formatDateTimeShort(b.checked_out_at) : (b.checkout_date ? formatDateTimeShort(b.checkout_date) : "-"))}</p>
                                </div>
                              </div>
                            </td>
                            <td className="px-8 py-6 bg-slate-50/50 group-hover:bg-white border-y-2 border-transparent group-hover:border-indigo-100 transition-all">
                              <BookingStatusBadge
                                status={determineBookingStatus(b)}
                                isPackage={b.is_package}
                                packageName={b.package?.title || (b.is_package ? packages.find(p => p.id == b.package_id)?.title : null)}
                                isConfirmed={b.is_confirmed}
                                advanceDeposit={b.advance_deposit}
                              />
                            </td>
                            <td className="px-8 py-6 bg-slate-50/50 group-hover:bg-white rounded-r-[2rem] border-y-2 border-r-2 border-transparent group-hover:border-indigo-100 transition-all text-center">
                              <div className="flex justify-center gap-2 flex-wrap max-w-[200px] mx-auto">
                                <button
                                  onClick={() => viewDetails(b.id, b.is_package)}
                                  className="w-10 h-10 bg-white text-slate-400 hover:text-indigo-600 rounded-xl border-2 border-slate-50 hover:border-indigo-100 transition-all shadow-sm flex items-center justify-center"
                                  title="View Dossier"
                                >
                                  <Eye className="w-5 h-5" />
                                </button>
                                {hasPermission('bookings:edit') && !["checkedin", "checkedout", "cancelled", "noshow"].includes(b.status?.toLowerCase().replace(/[-_]/g, "")) && (
                                  <button
                                    onClick={() => {
                                      setBookingToEdit(b);
                                      setFormData({
                                        guestName: b.guest_name || "",
                                        guestMobile: b.guest_mobile || "",
                                        guestEmail: b.guest_email || "",
                                        gstNumber: b.gst_number || "",
                                        room_type_id: b.room_type_id || "",
                                        roomNumbers: b.rooms?.map(r => r.number || r.room?.number) || [],
                                        checkIn: b.check_in || "",
                                        checkOut: b.check_out || "",
                                        adults: b.adults || 1,
                                        children: b.children || 0,
                                        num_rooms: b.num_rooms || 1,
                                        source: b.source || "Admin",
                                        custom_room_rate: b.total_amount ? (b.total_amount).toString() : "",
                                        selectedRoomTypes: [],
                                      });
                                      setBookingTab(b.is_package ? "package" : "room");
                                      setIsBookingModalOpen(true);
                                    }}
                                    className="w-10 h-10 bg-white text-slate-400 hover:text-blue-600 rounded-xl border-2 border-slate-50 hover:border-blue-100 transition-all shadow-sm flex items-center justify-center"
                                    title="Edit Booking"
                                  >
                                    <Edit className="w-5 h-5" />
                                  </button>
                                )}
                                {hasPermission('bookings:edit') && b.status?.toLowerCase().replace(/[-_]/g, "") === "checkedin" && (
                                  <button
                                    onClick={async () => {
                                      try {
                                        const displayId = generateBookingId(b);
                                        const response = await API.get(`/bookings/details/${displayId}?is_package=${b.is_package}`, authHeader());
                                        setBookingForAllocation({ ...b, ...response.data, display_id: displayId });
                                      } catch (e) {
                                        setBookingForAllocation(b);
                                      }
                                    }}
                                    className="w-10 h-10 bg-white text-slate-400 hover:text-emerald-600 rounded-xl border-2 border-slate-50 hover:border-emerald-100 transition-all shadow-sm flex items-center justify-center"
                                    title="Add Allocations"
                                  >
                                    <Box className="w-5 h-5" />
                                  </button>
                                )}
                                {hasPermission('bookings:edit') && b.status?.toLowerCase().replace(/[-_]/g, "") === "booked" && (
                                  <button
                                    onClick={async () => {
                                      try {
                                        const displayId = generateBookingId(b);
                                        const response = await API.get(`/bookings/details/${displayId}?is_package=${b.is_package}`, authHeader());
                                        setBookingToCheckIn({ ...b, ...response.data, display_id: displayId });
                                      } catch (e) {
                                        setBookingToCheckIn(b);
                                      }
                                    }}
                                    className="w-10 h-10 bg-indigo-600 text-white rounded-xl shadow-lg shadow-indigo-100 hover:bg-slate-900 transition-all flex items-center justify-center scale-110"
                                    title="Initialize Check-in"
                                  >
                                    <Zap className="w-5 h-5" />
                                  </button>
                                )}
                                {(b.is_confirmed || b.advance_deposit > 0) && (
                                  <button
                                    onClick={() => handleDownloadReceipt(b.id, b.is_package)}
                                    className="w-10 h-10 bg-emerald-50 text-emerald-600 hover:bg-emerald-600 hover:text-white rounded-xl border-2 border-emerald-100 hover:border-emerald-600 transition-all shadow-sm flex items-center justify-center"
                                    title="Download Advance Receipt"
                                  >
                                    <FileText className="w-5 h-5" />
                                  </button>
                                )}
                                {hasPermission('bookings:edit') && (
                                  (b.status?.toLowerCase().replace(/[-_]/g, "") === "booked" || b.status?.toLowerCase().replace(/[-_]/g, "") === "checkedin" || b.status?.toLowerCase() === "pending")
                                ) && (
                                  <button
                                    onClick={() => setBookingToConfirm(b)}
                                    className={`w-10 h-10 rounded-xl border-2 transition-all shadow-sm flex items-center justify-center ${
                                      b.status?.toLowerCase() === "pending"
                                        ? "bg-orange-50 text-orange-600 hover:bg-orange-500 hover:text-white border-orange-200 hover:border-orange-500"
                                        : "bg-emerald-50 text-emerald-600 hover:bg-emerald-600 hover:text-white border-emerald-100 hover:border-emerald-600"
                                    }`}
                                    title={b.status?.toLowerCase() === "pending" ? "Accept Enquiry" : "Confirm Booking"}
                                  >
                                    {b.status?.toLowerCase() === "pending" ? <CheckCircle2 className="w-5 h-5" /> : <CheckCircle2 className="w-5 h-5" />}
                                  </button>
                                )}
                                {hasPermission('bookings:edit') && (
                                  <button
                                    onClick={() => setBookingToExtend(b)}
                                    disabled={(() => {
                                      if (!b || !b.status) return true;
                                      const rawStatusLower = b.status.toLowerCase().trim();
                                      const normalizedStatus = rawStatusLower.replace(/[-_]/g, "-");
                                      return normalizedStatus !== "booked" && normalizedStatus !== "checked-in";
                                    })()}
                                    className="w-10 h-10 bg-white text-slate-400 hover:text-amber-600 rounded-xl border-2 border-slate-50 hover:border-amber-100 transition-all shadow-sm flex items-center justify-center disabled:opacity-20"
                                    title="Extend Stay"
                                  >
                                    <Calendar className="w-5 h-5" />
                                  </button>
                                )}
                                {hasPermission('bookings:delete') && (
                                  <button
                                    onClick={() => cancelBooking(b.id, b.is_package)}
                                    disabled={b.status?.toLowerCase().replace(/[-_]/g, "") !== "booked" && b.status?.toLowerCase().replace(/[-_]/g, "") !== "checkedin"}
                                    className="w-10 h-10 bg-white text-slate-400 hover:text-rose-600 rounded-xl border-2 border-slate-50 hover:border-rose-100 transition-all shadow-sm flex items-center justify-center disabled:opacity-20"
                                    title="Cancel Record"
                                  >
                                    <Trash2 className="w-5 h-5" />
                                  </button>
                                )}
                                {!["checkedout", "cancelled", "noshow"].includes(b.status?.toLowerCase().replace(/[-_]/g, "")) && (
                                   <button
                                     onClick={() => markNoShowBooking(b)}
                                     className="w-10 h-10 bg-amber-100 text-amber-700 hover:bg-amber-600 hover:text-white rounded-xl border-2 border-amber-300 hover:border-amber-600 transition-all shadow-md flex items-center justify-center font-bold"
                                     title="Mark No-Show (Sync Channel Manager)"
                                   >
                                     <UserX className="w-5 h-5" />
                                   </button>
                                 )}
                                {b.guest_email && (
                                  <button
                                    onClick={() => shareViaEmail(b)}
                                    className="w-10 h-10 bg-white text-slate-400 hover:text-violet-600 rounded-xl border-2 border-slate-50 hover:border-violet-100 transition-all shadow-sm flex items-center justify-center"
                                    title="Share via Email"
                                  >
                                    <Mail className="w-5 h-5" />
                                  </button>
                                )}
                                {b.guest_mobile && (
                                  <button
                                    onClick={() => shareViaWhatsApp(b)}
                                    className="w-10 h-10 bg-white text-slate-400 hover:text-green-600 rounded-xl border-2 border-slate-50 hover:border-green-100 transition-all shadow-sm flex items-center justify-center"
                                    title="Share via WhatsApp"
                                  >
                                    <MessageSquare className="w-5 h-5" />
                                  </button>
                                )}
                              </div>
                            </td>
                          </motion.tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan="6" className="py-20 text-center">
                            <div className="flex flex-col items-center gap-4">
                              <div className="w-20 h-20 rounded-full bg-indigo-50 flex items-center justify-center">
                                <Box className="w-10 h-10 text-indigo-200" />
                              </div>
                              <p className="text-xs font-bold text-slate-400 uppercase tracking-wide">No Synchronized Records Found</p>
                            </div>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
                {filteredBookings.length > 0 && hasMoreBookings && (
                  <div ref={loadMoreRef} className="text-center p-8 mt-4 min-h-[50px] flex items-center justify-center">
                    {isSubmitting && (
                      <div className="flex items-center gap-3 px-8 py-4 bg-white/80 backdrop-blur-xl text-indigo-600 rounded-2xl font-bold uppercase tracking-widest text-[10px] border border-indigo-100 shadow-md animate-pulse">
                        <Clock className="w-4 h-4 animate-spin text-indigo-500" />
                        Loading More Bookings...
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </>
        )}

        {/* Calendar Tab */}
        {mainTab === "calendar" && (
          <BookingCalendar
            rooms={allRooms}
            bookings={calendarBookings}
            roomTypeObjects={roomTypeObjects}
            onBookRoom={handleBookFromCalendar}
          />
        )}

        {/* Package Management Tab */}
        {mainTab === "package" && <Packages noLayout={true} />}

        {/* Room Management Tab */}
        {mainTab === "room" && <Rooms noLayout={true} />}
      </div>
      <AnimatePresence>
        {modalBooking && (
          <BookingDetailsModal
            booking={modalBooking}
            onClose={() => setModalBooking(null)}
            onImageClick={(imageUrl) => setSelectedImage(imageUrl)}
            roomIdToRoom={roomIdToRoom}
            onAddAllocation={(booking) => {
              setModalBooking(null);
              setBookingForAllocation(booking);
            }}
            onConfirm={(booking) => {
              setBookingToConfirm(booking);
            }}
            inventoryItems={inventoryItems.filter((item) => {
              const dept = String(item.department || "").toLowerCase();
              const catName = String(item.category_name || item.category?.name || "").toLowerCase();
              return (
                !dept.includes("kitchen") &&
                !dept.includes("restaurant") &&
                !catName.includes("ingredient") &&
                !catName.includes("raw material")
              );
            })}
            inventoryLocations={inventoryLocations}
            authHeader={authHeader}
            onDownloadReceipt={handleDownloadReceipt}
          />
        )}
        {bookingForAllocation && (
          <AddExtraAllocationModal
            booking={bookingForAllocation}
            onClose={() => setBookingForAllocation(null)}
            inventoryItems={inventoryItems}
            inventoryLocations={inventoryLocations}
            authHeader={authHeader}
            showBannerMessage={showBannerMessage}
            onSuccess={() => {
              // Trigger refresh
              window.dispatchEvent(new CustomEvent("inventory-refresh"));
              // The modal will refresh items automatically after adding
            }}
          />
        )}
        {bookingToConfirm && (
          <ConfirmBookingModal
            booking={bookingToConfirm}
            onClose={() => setBookingToConfirm(null)}
            onConfirm={handleConfirmBooking}
            isSubmitting={isSubmitting}
          />
        )}
        {bookingToExtend && (
          <ExtendBookingModal
            booking={bookingToExtend}
            onClose={() => setBookingToExtend(null)}
            onSave={handleExtendBooking}
            feedback={feedback}
            isSubmitting={isSubmitting}
            showBannerMessage={showBannerMessage}
          />
        )}
        {bookingToCheckIn && (
          <CheckInModal
            booking={bookingToCheckIn}
            onClose={() => setBookingToCheckIn(null)}
            onSave={handleCheckIn}
            feedback={feedback}
            isSubmitting={isSubmitting}
            inventoryItems={inventoryItems}
            showBannerMessage={showBannerMessage}
            roomTypeObjects={roomTypeObjects}
          />
        )}
        {selectedImage && (
          <ImageModal
            imageUrl={selectedImage}
            onClose={() => setSelectedImage(null)}
          />
        )}
        <AnimatePresence>
          {isBookingModalOpen && (
            <BookingFormModal
              isOpen={isBookingModalOpen}
              onClose={() => {
                setIsBookingModalOpen(false);
                setBookingToEdit(null);
              }}
              bookingTab={bookingTab}
              setBookingTab={setBookingTab}
              formData={formData}
              handleChange={handleChange}
              handleRoomTypeChange={handleRoomTypeChange}
              handleSubmit={handleSubmit}
              handleAddRoomType={handleAddRoomType}
              handleRemoveRoomType={handleRemoveRoomType}
              isSubmitting={isSubmitting}
              isLoading={isLoading}
              roomTypes={roomTypes}
              roomTypeObjects={roomTypeObjects}
              filteredRooms={filteredRooms}
              handleRoomNumberToggle={handleRoomNumberToggle}
              packageBookingForm={packageBookingForm}
              handlePackageBookingChange={handlePackageBookingChange}
              handlePackageBookingSubmit={handlePackageBookingSubmit}
              packages={packages}
              packageRooms={packageRooms}
              handlePackageRoomSelect={handlePackageRoomSelect}
              today={today}
              formatCurrency={formatCurrency}
              RoomSelection={RoomSelection}
              feedback={feedback}
              showBannerMessage={showBannerMessage}
              gstSettings={gstSettings}
              isEditMode={!!bookingToEdit}
            />
          )}
        </AnimatePresence>
        <BannerMessage
          message={bannerMessage}
          onClose={closeBannerMessage}
          autoDismiss={true}
          duration={5000}
        />
      </AnimatePresence>
    </DashboardLayout>
  );
};


// Helper Components for Room Allocation Modal
const RoomFoodOrders = React.memo(({ booking, authHeader, API, formatCurrency, selectedRoomIndex = 0 }) => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { hasPermission } = usePermissions();
  useEffect(() => {
    fetchOrders();
  }, [booking, selectedRoomIndex]);

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const config = authHeader();
      const currentRoomData = booking.rooms && booking.rooms[selectedRoomIndex];
      const roomIds = currentRoomData ? [currentRoomData.id || currentRoomData.room_id] : (booking.rooms?.map(r => r.id || r.room_id) || []);
      const roomParam = roomIds.length === 1 ? `&room_id=${roomIds[0]}` : "";
      const bookingParam = booking.is_package ? `&package_booking_id=${booking.id}` : `&booking_id=${booking.id}`;
      const res = await API.get(`/food-orders/?limit=1000${roomParam}${bookingParam}`, config);
      const allOrders = res.data || [];

      const filtered = allOrders.filter(o => {
        // If order specifies a booking_id/package_booking_id, it MUST match the current booking context
        if (booking.is_package) {
          if (o.package_booking_id && o.package_booking_id !== booking.id) return false;
        } else {
          if (o.booking_id && o.booking_id !== booking.id) return false;
        }

        const isInRoom = roomIds.includes(o.room_id);
        if (!isInRoom) return false;

        // Date-based filtering as a double-check for older orders without booking_id
        const orderTime = new Date(o.created_at).getTime();
        const checkInTime = booking.checked_in_at
          ? new Date(booking.checked_in_at).getTime()
          : new Date(booking.check_in).getTime();

        if (orderTime < checkInTime) return false;

        if (booking.status?.toLowerCase().replace(/[-_]/g, "") === "checkedout") {
          const checkOutTime = booking.check_out
            ? new Date(booking.check_out).setHours(23, 59, 59, 999)
            : Date.now();
          if (orderTime > checkOutTime) return false;
        }

        return true;
      });
      setOrders(filtered);
    } catch (error) {
      console.error("Failed to fetch food orders", error);
    } finally {
      setLoading(false);
    }
  };

  const currentRoom = booking.rooms && booking.rooms[selectedRoomIndex];
  const roomNumber = currentRoom?.number || currentRoom?.room?.number;

  return (
    <div className="p-8 space-y-10">
      <div className="relative overflow-hidden bg-white/40 backdrop-blur-xl rounded-[3rem] p-10 border-2 border-white shadow-2xl shadow-indigo-100/50">
        <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-50/50 blur-3xl -mr-32 -mt-32 rounded-full"></div>
        <div className="relative z-10 flex flex-col md:flex-row justify-between items-center gap-8">
          <div className="flex items-center gap-6">
            <div className="w-20 h-20 rounded-[2rem] bg-indigo-600 shadow-2xl shadow-indigo-200 flex items-center justify-center">
              <Utensils className="w-8 h-8 text-white" />
            </div>
            <div>
              <h4 className="text-2xl font-bold text-slate-800 tracking-tight uppercase leading-none mb-2">Food & Dining</h4>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse"></div>
                <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-wide">Room: {roomNumber}</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={fetchOrders}
              className="group p-5 bg-white text-slate-400 hover:text-indigo-600 rounded-[2rem] transition-all border-2 border-slate-50 shadow-xl shadow-slate-100"
            >
              <RefreshCw className={`w-5 h-5 ${loading ? "animate-spin" : "group-hover:rotate-180 transition-transform duration-700"}`} />
            </button>
            {hasPermission('food_orders:view') && (
              <button
                onClick={() => navigate('/food-orders')}
                className="px-10 py-5 bg-slate-900 text-white rounded-[2rem] text-[10px] font-bold uppercase tracking-normal shadow-2xl shadow-indigo-200 hover:bg-indigo-600 transition-all flex items-center gap-4"
              >
                <ExternalLink className="w-4 h-4" />
                Go to Orders
              </button>
            )}
          </div>
        </div>
      </div>

      {loading ? (
        <div className="py-32 flex flex-col items-center gap-6">
          <div className="relative">
            <div className="w-24 h-24 border-[8px] border-slate-50 rounded-full"></div>
            <div className="absolute inset-0 w-24 h-24 border-[8px] border-indigo-500 rounded-full border-t-transparent animate-spin"></div>
            <Coffee className="absolute inset-0 m-auto w-8 h-8 text-indigo-500" />
          </div>
          <div className="text-center">
            <p className="text-xs font-bold text-slate-600 uppercase tracking-normal">Loading Kitchen Orders</p>
            <p className="text-[9px] font-bold text-slate-400 uppercase mt-2 tracking-widest">System synchronization in progress</p>
          </div>
        </div>
      ) : orders.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="relative group p-20 bg-white/40 backdrop-blur-md rounded-[4rem] border-4 border-dashed border-slate-100 flex flex-col items-center gap-6 text-center"
        >
          <div className="w-32 h-32 rounded-full bg-slate-50 flex items-center justify-center group-hover:bg-indigo-50 transition-colors duration-700">
            <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center">
              <Box className="w-8 h-8 text-slate-300 group-hover:text-indigo-200 transition-colors" />
            </div>
          </div>
          <div className="space-y-2">
            <h5 className="text-sm font-bold text-slate-400 uppercase tracking-normal">No Active Orders</h5>
            <p className="text-[10px] font-bold text-slate-300 uppercase tracking-widest leading-loose">The order list for room {roomNumber} is currently empty.</p>
          </div>
        </motion.div>
      ) : (
        <div className="space-y-6">
          <div className="flex items-center gap-3 px-2">
            <div className="w-1.5 h-1.5 rounded-full bg-indigo-500"></div>
            <h5 className="text-[10px] font-bold text-slate-800 uppercase tracking-wide">Order History</h5>
            <div className="h-px flex-1 bg-gradient-to-r from-slate-200 to-transparent"></div>
          </div>

          <div className="grid grid-cols-1 gap-6">
            {orders.map((order) => (
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                key={order.id}
                className="group bg-white rounded-[3rem] border-2 border-slate-50 p-8 flex items-center justify-between hover:border-indigo-100 hover:shadow-2xl hover:shadow-indigo-100/40 transition-all duration-500"
              >
                <div className="flex items-center gap-8">
                  <div className="text-center bg-slate-50 group-hover:bg-indigo-50 px-6 py-4 rounded-[1.5rem] border border-slate-100 group-hover:border-indigo-100 transition-all">
                    <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest mb-1">ID</p>
                    <p className="font-bold text-slate-700 text-sm">#{order.id}</p>
                  </div>

                  <div>
                    <div className="flex items-center gap-3 mb-2">
                      <span className={`px-4 py-1.5 rounded-full text-[9px] font-bold uppercase tracking-wider shadow-sm ${order.status === 'completed' ? 'bg-emerald-500 text-white' :
                        order.status === 'pending' ? 'bg-orange-500 text-white animate-pulse' :
                          order.status === 'cancelled' ? 'bg-rose-500 text-white' :
                            'bg-indigo-500 text-white'
                        }`}>
                        {order.status}
                      </span>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                        {order.created_at ? formatDateTimeShort(order.created_at) : "N/A"}
                      </span>
                    </div>
                    <p className="text-[11px] font-bold text-slate-700 uppercase tracking-tight flex items-center gap-2">
                      <Package className="w-3 h-3 text-slate-300" />
                      {order.items?.length || 0} Items Ordered
                    </p>
                  </div>
                </div>

                <div className="text-right flex items-center gap-10">
                  <div>
                    <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest mb-1">Fiscal Impact</p>
                    <p className="font-bold text-indigo-600 text-2xl tracking-tight">{formatCurrency(order.total_amount || order.amount || 0)}</p>
                  </div>
                  <div className={`p-5 rounded-[1.5rem] border-2 transition-all ${order.billing_status === 'billed' ? 'bg-slate-900 border-slate-900 text-white' :
                    order.payment_status === 'paid' ? 'bg-emerald-50 border-emerald-100 text-emerald-600' :
                      'bg-orange-50 border-orange-100 text-orange-600'
                    }`}>
                    <p className="text-[10px] font-medium uppercase tracking-wide opacity-70 mb-0.5">Payment</p>
                    <p className="text-[10px] font-bold uppercase tracking-wider">
                      {order.billing_status === 'billed' ? 'Invoiced' : (order.payment_status ? order.payment_status.charAt(0).toUpperCase() + order.payment_status.slice(1) : 'Pending')}
                    </p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
});
RoomFoodOrders.displayName = "RoomFoodOrders";

const RoomServiceAssignments = React.memo(({ booking, authHeader, API, formatCurrency, selectedRoomIndex = 0 }) => {
  const navigate = useNavigate();
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(false);
  const { hasPermission } = usePermissions();
  useEffect(() => {
    fetchData();
  }, [booking, selectedRoomIndex]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const currentRoomData = booking.rooms && booking.rooms[selectedRoomIndex];
      const roomIds = currentRoomData ? [currentRoomData.id || currentRoomData.room_id] : (booking.rooms?.map(r => r.id || r.room_id) || []);
      const config = authHeader ? authHeader() : {};
      const roomParam = roomIds.length === 1 ? `&room_id=${roomIds[0]}` : "";
      const bookingParam = booking.is_package ? `&package_booking_id=${booking.id}` : `&booking_id=${booking.id}`;
      const assignmentsRes = await API.get(`/services/assigned?limit=1000${roomParam}${bookingParam}`, config);

      const allAssignments = assignmentsRes.data || [];
      const filtered = allAssignments.filter(a => {
        // If assignment specifies a booking context, it MUST match
        if (booking.is_package) {
          if (a.package_booking_id && a.package_booking_id !== booking.id) return false;
        } else {
          if (a.booking_id && a.booking_id !== booking.id) return false;
        }

        const isInRoom = roomIds.includes(a.room_id);
        if (!isInRoom) return false;

        // Date-based filtering for the specific guest's stay
        const assignedTime = new Date(a.assigned_at).getTime();
        const checkInTime = booking.checked_in_at
          ? new Date(booking.checked_in_at).getTime()
          : new Date(booking.check_in).getTime();

        if (assignedTime < checkInTime) return false;

        if (booking.status?.toLowerCase().replace(/[-_]/g, "") === "checkedout") {
          const checkOutTime = booking.check_out
            ? new Date(booking.check_out).setHours(23, 59, 59, 999)
            : Date.now();
          if (assignedTime > checkOutTime) return false;
        }

        return true;
      });
      setAssignments(filtered);
    } catch (error) {
      console.error("Fatal error fetching service data", error);
    } finally {
      setLoading(false);
    }
  };


  return (
    <div className="p-8 space-y-12">
      {/* Assignment Control Terminal - Simplified Redirect */}
      <div className="relative overflow-hidden bg-slate-900 rounded-[3.5rem] p-12 shadow-[0_40px_80px_-20px_rgba(30,41,59,0.5)]">
        <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/10 blur-[100px] -mr-48 -mt-48 rounded-full"></div>
        <div className="relative z-10 text-center">
          <div className="flex flex-col items-center gap-6">
            <div className="w-20 h-20 rounded-[2rem] bg-indigo-500/20 flex items-center justify-center border-2 border-indigo-500/20 mb-2">
              <Zap className="w-10 h-10 text-amber-400" />
            </div>
            <div>
              <h2 className="text-3xl font-black text-white tracking-tight">Active Service Management</h2>
              <p className="text-sm font-bold text-slate-400 uppercase tracking-[0.2em] mt-3">Advanced Assignment & Resource Orchestration Terminal</p>
            </div>
            {hasPermission('services:view') && (
              <motion.button
                whileHover={{ scale: 1.05, y: -5 }}
                whileActive={{ scale: 0.95 }}
                onClick={() => navigate('/services')}
                className="mt-4 px-12 py-5 bg-gradient-to-r from-indigo-500 via-indigo-600 to-violet-700 text-white rounded-full text-sm font-black uppercase tracking-[0.2em] shadow-2xl shadow-indigo-900/50 flex items-center gap-4 group transition-all"
              >
                <span>Assign & Manage Services</span>
                <ArrowRight className="w-5 h-5 group-hover:translate-x-2 transition-transform" />
              </motion.button>
            )}
          </div>
        </div>
      </div>

      {/* History Grid */}
      <div className="space-y-8">
        <div className="flex justify-between items-center px-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-[1.5rem] bg-indigo-50 flex items-center justify-center border-2 border-indigo-100">
              <ClipboardList className="w-6 h-6 text-indigo-600" />
            </div>
            <div>
              <h4 className="text-xl font-bold text-slate-800 uppercase tracking-tight leading-none">Service History</h4>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1.5">{assignments.length} tasks recorded in system</p>
            </div>
          </div>
          <button
            onClick={fetchData}
            className="group p-5 bg-white text-slate-400 hover:text-indigo-600 rounded-[2rem] transition-all border-2 border-slate-50 shadow-xl shadow-slate-100"
          >
            <RefreshCw className={`w-5 h-5 ${loading ? "animate-spin" : "group-hover:rotate-180 transition-transform duration-700"}`} />
          </button>
        </div>

        {loading ? (
          <div className="py-24 flex flex-col items-center gap-6">
            <div className="w-16 h-16 border-[6px] border-slate-50 border-t-indigo-600 rounded-full animate-spin"></div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-normal">System Syncing...</p>
          </div>
        ) : assignments.length === 0 ? (
          <div className="text-center py-20 bg-white/40 backdrop-blur-sm border-4 border-dashed border-slate-100 rounded-[4rem] flex flex-col items-center gap-6">
            <div className="w-24 h-24 rounded-full bg-slate-50 flex items-center justify-center">
              <UserCheck className="w-10 h-10 text-slate-200" />
            </div>
            <div>
              <p className="text-sm font-bold text-slate-400 uppercase tracking-wide">System Status</p>
              <p className="text-[10px] font-bold text-slate-300 uppercase mt-2 tracking-widest">No service tasks have been assigned to this room yet.</p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {assignments.map(a => (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                key={a.id}
                className="group bg-white rounded-[3rem] border-2 border-slate-50 p-8 hover:border-indigo-100 hover:shadow-2xl hover:shadow-indigo-100/40 transition-all duration-500 relative overflow-hidden"
              >
                <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-50/30 blur-3xl -mr-16 -mt-16 group-hover:bg-indigo-100/40 transition-colors"></div>

                <div className="relative z-10 space-y-6">
                  <div className="flex justify-between items-start">
                    <div>
                      <span className={`px-4 py-1.5 rounded-full text-[9px] font-bold uppercase tracking-wider shadow-sm border ${a.status === 'completed' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' :
                        a.status === 'in_progress' ? 'bg-indigo-600 text-white border-indigo-600' :
                          'bg-orange-50 text-orange-600 border-orange-100'
                        }`}>
                        {a.status || 'pending'}
                      </span>
                      <h6 className="mt-4 text-lg font-bold text-slate-800 uppercase tracking-tight leading-none">{a.service?.name || "Unknown"}</h6>
                      <p className="text-[10px] font-medium text-slate-500 uppercase tracking-wide mb-1">Fee</p>
                      <p className="font-bold text-slate-800 text-lg tracking-tight">{formatCurrency(a.service?.charges || 0)}</p>
                    </div>
                    <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 group-hover:bg-white group-hover:border-indigo-100 transition-all">
                      <MapPin className="w-5 h-5 text-slate-400 group-hover:text-indigo-400 transition-colors" />
                      <p className="text-[10px] font-bold text-slate-700 text-center mt-1">{a.room?.number || "N/A"}</p>
                    </div>
                  </div>

                  <div className="pt-6 border-t border-slate-50 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-slate-900 flex items-center justify-center font-bold text-[10px] text-white">
                        {a.employee?.name?.substring(0, 1) || "?"}
                      </div>
                      <div>
                        <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">Staff Member</p>
                        <p className="text-xs font-bold text-slate-700">{a.employee?.name || "Unassigned"}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] font-medium text-slate-500 uppercase tracking-wide leading-none mb-1">Assigned At</p>
                      <p className="text-[10px] font-bold text-slate-500 tabular-nums">
                        {a.assigned_at ? new Date(a.assigned_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'N/A'}
                      </p>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
});
RoomServiceAssignments.displayName = "RoomServiceAssignments";

export default Bookings;
