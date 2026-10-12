import React, { useState, useEffect, useRef, useMemo, useCallback, memo } from "react";
import localLogo from "./assets/stayonelogo.png";
// Lucide React is used for elegant icons
import { BedDouble, Coffee, ConciergeBell, MapPin, Package, Clock, Users, User, Calendar, Check, ChevronRight, ChevronLeft, ChevronDown, Image as ImageIcon, Star, Quote, ChevronUp, MessageSquare, Send, X, Facebook, Instagram, Linkedin, Twitter, Moon, Sun, Droplet, Menu, Phone, Mail, Building, Sparkles, Shield, ArrowRight, ExternalLink } from 'lucide-react';
import { SiGooglemaps, SiGhost } from "react-icons/si";
// Currency formatting utility
import { formatCurrency } from './utils/currency';
// API base URL utility
import { getApiBaseUrl, getMediaBaseUrl } from './utils/env';
import GuestRoomPortal from "./GuestRoomPortal";

// Custom hook to detect if an element is in the viewport
const useOnScreen = (ref, rootMargin = "0px") => {
    const [isIntersecting, setIntersecting] = useState(false);
    useEffect(() => {
        const observer = new IntersectionObserver(
            ([entry]) => {
                setIntersecting(entry.isIntersecting);
            },
            { rootMargin }
        );
        const currentRef = ref.current;
        if (currentRef) {
            observer.observe(currentRef);
        }
        return () => {
            if (currentRef) {
                observer.unobserve(currentRef);
            }
        };
    }, [ref, rootMargin]);
    return isIntersecting;
};

// Define the themes with a consistent structure for easy switching
const themes = {
    dark: {
        id: 'dark',
        name: 'Dark',
        icon: <Moon className="w-5 h-5" />,
        bgPrimary: "bg-black",
        bgSecondary: "bg-neutral-950",
        bgCard: "bg-white",
        textPrimary: "text-white",
        textSecondary: "text-neutral-400",
        textCardPrimary: "text-neutral-900",
        textCardSecondary: "text-neutral-600",
        textAccent: "text-amber-400",
        textCardAccent: "text-amber-600",
        textTitleGradient: "from-gray-200 via-white to-gray-400",
        border: "border-neutral-700",
        cardBorder: "border-neutral-200",
        borderHover: "hover:border-amber-500/50",
        buttonBg: "bg-amber-500",
        buttonText: "text-neutral-950",
        buttonHover: "hover:bg-amber-400",
        placeholderBg: "bg-neutral-800",
        placeholderText: "text-neutral-400",
        chatBg: "bg-neutral-900",
        chatHeaderBg: "bg-neutral-800",
        chatInputBorder: "border-neutral-700",
        chatInputBg: "bg-neutral-700",
        chatInputPlaceholder: "placeholder-neutral-400",
        chatUserBg: "bg-amber-500",
        chatUserText: "text-neutral-950",
        chatModelBg: "bg-neutral-800",
        chatModelText: "text-neutral-100",
        chatLoaderBg: "bg-neutral-400",
    },
    light: {
        id: 'light',
        name: 'Light',
        icon: <Sun className="w-5 h-5" />,
        bgPrimary: "bg-neutral-50",
        bgSecondary: "bg-neutral-200",
        bgCard: "bg-white",
        textPrimary: "text-neutral-900",
        textSecondary: "text-neutral-600",
        textCardPrimary: "text-neutral-900",
        textCardSecondary: "text-neutral-600",
        textAccent: "text-amber-600",
        textCardAccent: "text-amber-600",
        cardBorder: "border-neutral-300",
        textTitleGradient: "from-amber-600 via-amber-700 to-neutral-900",
        border: "border-neutral-300",
        borderHover: "hover:border-amber-500/50",
        buttonBg: "bg-gradient-to-r from-amber-500 to-amber-600",
        buttonText: "text-white",
        buttonHover: "hover:from-amber-400 hover:to-amber-500",
        placeholderBg: "bg-neutral-100",
        placeholderText: "text-neutral-500",
        chatBg: "bg-white",
        chatHeaderBg: "bg-neutral-100",
        chatInputBorder: "border-neutral-200",
        chatInputBg: "bg-neutral-100",
        chatInputPlaceholder: "placeholder-neutral-500",
        chatUserBg: "bg-gradient-to-r from-amber-500 to-amber-600",
        chatUserText: "text-white",
        chatModelBg: "bg-neutral-100",
        chatModelText: "text-neutral-900",
        chatLoaderBg: "bg-neutral-600",
    },
    ocean: {
        id: 'ocean',
        name: 'Ocean',
        icon: <Droplet className="w-5 h-5" />,
        bgPrimary: "bg-slate-50",
        bgSecondary: "bg-slate-100",
        bgCard: "bg-neutral-50",
        textPrimary: "text-slate-900",
        textSecondary: "text-slate-600",
        textAccent: "text-teal-600",
        textTitleGradient: "from-teal-700 via-cyan-700 to-blue-800",
        border: "border-slate-300",
        borderHover: "hover:border-teal-500/50",
        buttonBg: "bg-gradient-to-r from-teal-500 to-cyan-600",
        buttonText: "text-white",
        buttonHover: "hover:from-teal-400 hover:to-cyan-500",
        placeholderBg: "bg-slate-100",
        placeholderText: "text-slate-500",
        chatBg: "bg-white",
        chatHeaderBg: "bg-slate-100",
        chatInputBorder: "border-slate-200",
        chatInputBg: "bg-slate-100",
        chatInputPlaceholder: "placeholder-slate-500",
        chatUserBg: "bg-gradient-to-r from-teal-500 to-cyan-600",
        chatUserText: "text-white",
        chatModelBg: "bg-slate-100",
        chatModelText: "text-slate-900",
        chatLoaderBg: "bg-slate-600",
    },
    forest: {
        id: 'forest',
        name: 'Forest',
        icon: <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-tree-pine"><path d="M17 19h2c.5 0 1-.5 1-1V9c0-2-3-3-3-3H8c-3 0-4 1.5-4 4.5v3.5c0 1.5 1 2 2 2h2" /><path d="M14 15v.5" /><path d="M13 14v.5" /><path d="M12 13v.5" /><path d="M11 12v.5" /><path d="M10 11v.5" /><path d="M9 10v.5" /><path d="M8 9v.5" /><path d="M17 14v.5" /><path d="M16 13v.5" /><path d="M15 12v.5" /><path d="M14 11v.5" /><path d="M13 10v.5" /><path d="M12 9v.5" /><path d="M11 8v.5" /><path d="M10 7v.5" /><path d="M9 6v.5" /><path d="M15 18v1" /><path d="M14 17v1" /><path d="M13 16v1" /><path d="M12 15v1" /><path d="M11 14v1" /><path d="M10 13v1" /><path d="M9 12v1" /><path d="M8 11v1" /><path d="M7 10v1" /><path d="M6 9v1" /><path d="M18 17v1" /><path d="M17 16v1" /><path d="M16 15v1" /><path d="M15 14v1" /><path d="M14 13v1" /><path d="M13 12v1" /><path d="M12 11v1" /><path d="M11 10v1" /><path d="M10 9v1" /><path d="M19 18v1" /><path d="M18 17v1" /><path d="M17 16v1" /><path d="M16 15v1" /><path d="M15 14v1" /><path d="M14 13v1" /><path d="M13 12v1" /><path d="M22 19v2" /><path d="M20 18v1" /><path d="M18 17v1" /><path d="M16 16v1" /><path d="M14 15v1" /><path d="M12 14v1" /><path d="M10 13v1" /><path d="M8 12v1" /><path d="M6 11v1" /><path d="M4 10v1" /><path d="M2 9v1" /><path d="M2 21h20" /><path d="m14 12-2-4-2 4" /><path d="m13 8-1-4-1 4" /><path d="M14 12c.5-1 1.5-2 2.5-3" /><path d="M10 12c-.5-1-1.5-2-2.5-3" /><path d="M12 22v-8" /><path d="m10 16-2 3" /><path d="m14 16 2 3" /></svg>,
        bgPrimary: "bg-green-50",
        bgSecondary: "bg-green-100",
        bgCard: "bg-neutral-50",
        textPrimary: "text-green-900",
        textSecondary: "text-green-600",
        textAccent: "text-emerald-600",
        textTitleGradient: "from-emerald-700 via-green-700 to-teal-800",
        border: "border-green-300",
        borderHover: "hover:border-emerald-500/50",
        buttonBg: "bg-gradient-to-r from-emerald-500 to-green-600",
        buttonText: "text-white",
        buttonHover: "hover:from-emerald-400 hover:to-green-500",
        placeholderBg: "bg-green-100",
        placeholderText: "text-green-500",
        chatBg: "bg-white",
        chatHeaderBg: "bg-green-100",
        chatInputBorder: "border-green-200",
        chatInputBg: "bg-green-100",
        chatInputPlaceholder: "placeholder-green-500",
        chatUserBg: "bg-gradient-to-r from-emerald-500 to-green-600",
        chatUserText: "text-white",
        chatModelBg: "bg-green-100",
        chatModelText: "text-green-900",
        chatLoaderBg: "bg-green-600",
    },
    rose: {
        id: 'rose',
        name: 'Rose',
        icon: <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-flower"><path d="M12 7.5a4.5 4.5 0 1 1 4.5 4.5H12a4.5 4.5 0 1 1-4.5-4.5H12z" /><path d="M12 12a4.5 4.5 0 1 1 4.5 4.5H12a4.5 4.5 0 1 1-4.5-4.5H12z" /><path d="M12 12a4.5 4.5 0 1 1-4.5-4.5H12a4.5 4.5 0 1 1 4.5 4.5H12z" /><path d="M12 12a4.5 4.5 0 1 1 4.5 4.5H12a4.5 4.5 0 1 1-4.5-4.5H12z" /><path d="M7.5 12H12a4.5 4.5 0 0 0 4.5-4.5v-3a4.5 4.5 0 1 1 0 9v3a4.5 4.5 0 1 1 0-9h-4.5a4.5 4.5 0 0 0-4.5 4.5V12z" /></svg>,
        bgPrimary: "bg-pink-50",
        bgSecondary: "bg-pink-100",
        bgCard: "bg-neutral-50",
        textPrimary: "text-pink-900",
        textSecondary: "text-pink-600",
        textAccent: "text-rose-600",
        textTitleGradient: "from-rose-700 via-pink-700 to-fuchsia-800",
        border: "border-pink-300",
        borderHover: "hover:border-rose-500/50",
        buttonBg: "bg-gradient-to-r from-rose-500 to-pink-600",
        buttonText: "text-white",
        buttonHover: "hover:from-rose-400 hover:to-pink-500",
        placeholderBg: "bg-pink-100",
        placeholderText: "text-pink-500",
        chatBg: "bg-white",
        chatHeaderBg: "bg-pink-100",
        chatInputBorder: "border-pink-200",
        chatInputBg: "bg-pink-100",
        chatInputPlaceholder: "placeholder-pink-500",
        chatUserBg: "bg-gradient-to-r from-rose-500 to-pink-600",
        chatUserText: "text-white",
        chatModelBg: "bg-pink-100",
        chatModelText: "text-pink-900",
        chatLoaderBg: "bg-pink-600",
    },
    slate: {
        id: 'slate',
        name: 'Slate',
        icon: <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-cloud"><path d="M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242" /></svg>,
        bgPrimary: "bg-gray-950",
        bgSecondary: "bg-gray-900",
        bgCard: "bg-neutral-50",
        textPrimary: "text-gray-100",
        textSecondary: "text-gray-400",
        textAccent: "text-sky-400",
        textTitleGradient: "from-gray-200 via-gray-400 to-gray-600",
        border: "border-gray-700",
        borderHover: "hover:border-sky-400/50",
        buttonBg: "bg-sky-500",
        buttonText: "text-gray-950",
        buttonHover: "hover:bg-sky-400",
        placeholderBg: "bg-gray-800",
        placeholderText: "text-gray-400",
        chatBg: "bg-gray-900",
        chatHeaderBg: "bg-gray-800",
        chatInputBorder: "border-gray-700",
        chatInputBg: "bg-gray-700",
        chatInputPlaceholder: "placeholder-gray-400",
        chatUserBg: "bg-sky-500",
        chatUserText: "text-gray-950",
        chatModelBg: "bg-gray-800",
        chatModelText: "text-gray-100",
        chatLoaderBg: "bg-gray-400",
    },
    sunrise: {
        id: 'sunrise',
        name: 'Sunrise',
        icon: <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-sunrise"><path d="M12 2v2" /><path d="m5 10 1-1" /><path d="m19 10 1-1" /><path d="M12 16a6 6 0 0 0 0 12" /><path d="m3 16 1-1" /><path d="m21 16-1-1" /><path d="m8 20 2-2" /><path d="m16 20-2-2" /></svg>,
        bgPrimary: "bg-orange-50",
        bgSecondary: "bg-yellow-100",
        bgCard: "bg-neutral-50",
        textPrimary: "text-orange-900",
        textSecondary: "text-orange-600",
        textAccent: "text-red-500",
        textTitleGradient: "from-orange-500 via-yellow-600 to-red-700",
        border: "border-yellow-200",
        borderHover: "hover:border-red-500/50",
        buttonBg: "bg-red-500",
        buttonText: "text-white",
        buttonHover: "hover:bg-red-400",
        placeholderBg: "bg-yellow-50",
        placeholderText: "text-orange-400",
        chatBg: "bg-white",
        chatHeaderBg: "bg-yellow-100",
        chatInputBorder: "border-yellow-200",
        chatInputBg: "bg-yellow-100",
        chatInputPlaceholder: "placeholder-orange-500",
        chatUserBg: "bg-red-500",
        chatUserText: "text-white",
        chatModelBg: "bg-yellow-100",
        chatModelText: "text-orange-900",
        chatLoaderBg: "bg-red-600",
    },
    lavender: {
        id: 'lavender',
        name: 'Lavender',
        icon: <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-lavender"><path d="M14.5 16.5c-2.4-1-4.2-2-5.5-2.5-1.5-.5-3.6-1-4.5-2-.8-1-1.3-2.2-1-3.5C3.3 6.7 4 6 5 6c1.1 0 2.4.8 3.5 2.5 1.2 1.9 2 4.2 2.5 5.5.5 1.5 1 3.6 2 4.5 1 .8 2.2 1.3 3.5 1C17.3 17.3 18 16.6 18 15.6c0-1.1-.8-2.4-2.5-3.5-1.9-1.2-4.2-2-5.5-2.5-1.5-.5-3.6-1-4.5-2-.8-1-1.3-2.2-1-3.5.3-1.3 1-2 2-2 1.1 0 2.4.8 3.5 2.5 1.9 1.2 4.2 2 5.5 2.5 1.5.5 3.6 1 4.5 2 .8 1 1.3 2.2 1 3.5-.3 1.3-1 2-2 2-1.1 0-2.4-.8-3.5-2.5-1.9-1.2-4.2-2-5.5-2.5-1.5-.5-3.6-1-4.5-2-.8-1-1.3-2.2-1-3.5-.3-1.3-1-2-2-2-1.1 0-2.4-.8-3.5-2.5" /><path d="M12 12c-2.4-1-4.2-2-5.5-2.5-1.5-.5-3.6-1-4.5-2-.8-1-1.3-2.2-1-3.5.3-1.3 1-2 2-2 1.1 0 2.4.8 3.5 2.5 1.9 1.2 4.2 2 5.5 2.5 1.5.5 3.6 1 4.5 2 .8 1 1.3 2.2 1 3.5-.3 1.3-1 2-2 2-1.1 0-2.4-.8-3.5-2.5-1.9-1.2-4.2-2-5.5-2.5-1.5-.5-3.6-1-4.5-2-.8-1-1.3-2.2-1-3.5-.3-1.3-1-2-2-2-1.1 0-2.4-.8-3.5-2.5" /></svg>,
        bgPrimary: "bg-indigo-950",
        bgSecondary: "bg-indigo-900",
        bgCard: "bg-neutral-50",
        textPrimary: "text-indigo-100",
        textSecondary: "text-indigo-300",
        textAccent: "text-violet-400",
        textTitleGradient: "from-indigo-200 via-violet-300 to-purple-400",
        border: "border-indigo-700",
        borderHover: "hover:border-violet-400/50",
        buttonBg: "bg-violet-500",
        buttonText: "text-indigo-950",
        buttonHover: "hover:bg-violet-400",
        placeholderBg: "bg-indigo-800",
        placeholderText: "text-indigo-400",
        chatBg: "bg-indigo-900",
        chatHeaderBg: "bg-indigo-800",
        chatInputBorder: "border-indigo-700",
        chatInputBg: "bg-indigo-700",
        chatInputPlaceholder: "placeholder-indigo-400",
        chatUserBg: "bg-violet-500",
        chatUserText: "text-indigo-950",
        chatModelBg: "bg-indigo-800",
        chatModelText: "text-indigo-100",
        chatLoaderBg: "bg-indigo-400",
    },
    desert: {
        id: 'desert',
        name: 'Desert',
        icon: <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-sunrise"><path d="M12 2v2" /><path d="m5 10 1-1" /><path d="m19 10 1-1" /><path d="M12 16a6 6 0 0 0 0 12" /><path d="m3 16 1-1" /><path d="m21 16-1-1" /><path d="m8 20 2-2" /><path d="m16 20-2-2" /></svg>,
        bgPrimary: "bg-stone-100",
        bgSecondary: "bg-stone-200",
        bgCard: "bg-neutral-50",
        textPrimary: "text-stone-900",
        textSecondary: "text-stone-600",
        textAccent: "text-orange-700",
        textTitleGradient: "from-stone-700 via-stone-900 to-amber-900",
        border: "border-stone-300",
        borderHover: "hover:border-orange-700/50",
        buttonBg: "bg-orange-700",
        buttonText: "text-white",
        buttonHover: "hover:bg-orange-600",
        placeholderBg: "bg-stone-50",
        placeholderText: "text-stone-500",
        chatBg: "bg-white",
        chatHeaderBg: "bg-stone-100",
        chatInputBorder: "border-stone-200",
        chatInputBg: "bg-stone-100",
        chatInputPlaceholder: "placeholder-stone-500",
        chatUserBg: "bg-orange-700",
        chatUserText: "text-white",
        chatModelBg: "bg-stone-100",
        chatModelText: "text-stone-900",
        chatLoaderBg: "bg-stone-600",
    },
    resort: {
        id: 'resort',
        name: 'Resort',
        icon: <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-sun"><path d="M12 2v2" /><path d="m5 10 1-1" /><path d="m19 10-1-1" /><path d="M12 16a6 6 0 0 0 0 12" /><path d="m3 16 1-1" /><path d="m21 16-1-1" /><path d="m8 20 2-2" /><path d="m16 20-2-2" /></svg>,
        bgPrimary: "bg-white",
        bgSecondary: "bg-orange-50",
        bgCard: "bg-white",
        textPrimary: "text-orange-900",
        textSecondary: "text-orange-700",
        textAccent: "text-amber-600",
        textCardPrimary: "text-orange-900",
        textCardSecondary: "text-orange-600",
        textCardAccent: "text-amber-700",
        textTitleGradient: "from-amber-600 via-orange-600 to-amber-800",
        border: "border-orange-200",
        cardBorder: "border-orange-100",
        borderHover: "hover:border-amber-500/60",
        buttonBg: "bg-gradient-to-r from-amber-500 to-orange-600",
        buttonText: "text-white",
        buttonHover: "hover:from-amber-400 hover:to-orange-500",
        placeholderBg: "bg-orange-50",
        placeholderText: "text-orange-400",
        chatBg: "bg-white",
        chatHeaderBg: "bg-orange-50",
        chatInputBorder: "border-orange-200",
        chatInputBg: "bg-orange-50",
        chatInputPlaceholder: "placeholder-orange-400",
        chatUserBg: "bg-gradient-to-r from-amber-500 to-orange-600",
        chatUserText: "text-white",
        chatModelBg: "bg-orange-50",
        chatModelText: "text-orange-900",
        chatLoaderBg: "bg-amber-500",
    },
    grape: {
        id: 'grape',
        name: 'Grape',
        icon: <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-grape"><path d="M22 6c0 4-4 8-10 8S2 10 2 6" /><path d="M12 14c-6 0-10 4-10 8s4 8 10 8" /><path d="M22 14c-6 0-10 4-10 8s4 8 10 8" /></svg>,
        bgPrimary: "bg-purple-950",
        bgSecondary: "bg-purple-900",
        bgCard: "bg-neutral-50",
        textPrimary: "text-purple-100",
        textSecondary: "text-purple-300",
        textAccent: "text-pink-400",
        textTitleGradient: "from-purple-200 via-pink-300 to-fuchsia-400",
        border: "border-purple-700",
        borderHover: "hover:border-pink-400/50",
        buttonBg: "bg-pink-500",
        buttonText: "text-purple-950",
        buttonHover: "hover:bg-pink-400",
        placeholderBg: "bg-purple-800",
        placeholderText: "text-purple-400",
        chatBg: "bg-purple-900",
        chatHeaderBg: "bg-purple-800",
        chatInputBorder: "border-purple-700",
        chatInputBg: "bg-purple-700",
        chatInputPlaceholder: "placeholder-purple-400",
        chatUserBg: "bg-pink-500",
        chatUserText: "text-purple-950",
        chatModelBg: "bg-purple-800",
        chatModelText: "text-purple-100",
        chatLoaderBg: "bg-purple-400",
    },
    sky: {
        id: 'sky',
        name: 'Sky',
        icon: <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-cloud-sun"><path d="M12 2v2" /><path d="m4.9 10 1-1" /><path d="m19.1 10-1-1" /><path d="M14 16a6 6 0 0 0 0 12" /><path d="m3 16 1-1" /><path d="m21 16-1-1" /><path d="m8 20 2-2" /><path d="m16 20-2-2" /></svg>,
        bgPrimary: "bg-sky-50",
        bgSecondary: "bg-sky-100",
        bgCard: "bg-neutral-50",
        textPrimary: "text-sky-900",
        textSecondary: "text-sky-600",
        textAccent: "text-blue-500",
        textTitleGradient: "from-sky-700 via-blue-800 to-indigo-900",
        border: "border-sky-300",
        borderHover: "hover:border-blue-500/50",
        buttonBg: "bg-blue-500",
        buttonText: "text-white",
        buttonHover: "hover:bg-blue-400",
        placeholderBg: "bg-sky-50",
        placeholderText: "text-sky-500",
        chatBg: "bg-white",
        chatHeaderBg: "bg-sky-100",
        chatInputBorder: "border-sky-200",
        chatInputBg: "bg-sky-100",
        chatInputPlaceholder: "placeholder-sky-500",
        chatUserBg: "bg-blue-500",
        chatUserText: "text-white",
        chatModelBg: "bg-sky-100",
        chatModelText: "text-sky-900",
        chatLoaderBg: "bg-blue-600",
    },
    fire: {
        id: 'fire',
        name: 'Fire',
        icon: <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-flame"><path d="M18 10c-1.2-1.2-3-2-5-2-1.2 0-2.8.8-4 2-1.2 1.2-2 3-2 5-2.2 2.2-2.5 4.5-2.5 5.5s.8 1.5 1.5 1.5c.7 0 1.5-.8 1.5-1.5s.3-3.3 2.5-5.5c1.2-1.2 3-2 5-2 1.2 0 2.8.8 4 2 1.2 1.2 2 3 2 5 2.2 2.2 2.5 4.5 2.5 5.5s-.8 1.5-1.5 1.5c-.7 0-1.5-.8-1.5-1.5s-.3-3.3-2.5-5.5z" /></svg>,
        bgPrimary: "bg-red-950",
        bgSecondary: "bg-red-900",
        bgCard: "bg-neutral-50",
        textPrimary: "text-red-100",
        textSecondary: "text-red-300",
        textAccent: "text-orange-400",
        textTitleGradient: "from-orange-200 via-orange-300 to-yellow-400",
        border: "border-red-700",
        borderHover: "hover:border-orange-400/50",
        buttonBg: "bg-orange-500",
        buttonText: "text-red-950",
        buttonHover: "hover:bg-orange-400",
        placeholderBg: "bg-red-800",
        placeholderText: "text-red-400",
        chatBg: "bg-red-900",
        chatHeaderBg: "bg-red-800",
        chatInputBorder: "border-red-700",
        chatInputBg: "bg-red-700",
        chatInputPlaceholder: "placeholder-red-400",
        chatUserBg: "bg-orange-500",
        chatUserText: "text-red-950",
        chatModelBg: "bg-red-800",
        chatModelText: "text-red-100",
        chatLoaderBg: "bg-red-400",
    },
    mint: {
        id: 'mint',
        name: 'Mint',
        icon: <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-leaf"><path d="M2 13c3.5-3.5 12-5 18 0 0 0-4 4-8 8s-8-4-10-6z" /></svg>,
        bgPrimary: "bg-teal-50",
        bgSecondary: "bg-teal-100",
        bgCard: "bg-neutral-50",
        textPrimary: "text-teal-900",
        textSecondary: "text-teal-600",
        textAccent: "text-emerald-600",
        textTitleGradient: "from-teal-700 via-emerald-900 to-green-900",
        border: "border-teal-200",
        borderHover: "hover:border-emerald-600/50",
        buttonBg: "bg-emerald-600",
        buttonText: "text-white",
        buttonHover: "hover:bg-emerald-500",
        placeholderBg: "bg-teal-50",
        placeholderText: "text-teal-500",
        chatBg: "bg-white",
        chatHeaderBg: "bg-teal-100",
        chatInputBorder: "border-teal-200",
        chatInputBg: "bg-teal-100",
        chatInputPlaceholder: "placeholder-teal-500",
        chatUserBg: "bg-emerald-600",
        chatUserText: "text-white",
        chatModelBg: "bg-teal-100",
        chatModelText: "text-teal-900",
        chatLoaderBg: "bg-teal-600",
    },

};

// Background animation component for the floating bubbles
const BackgroundAnimation = ({ theme }) => {
    // Optimize bubble count for mobile performance
    const bubbleCount = typeof window !== 'undefined' && window.innerWidth < 768 ? 8 : 15;
    const bubbles = useMemo(() => Array.from({ length: bubbleCount }, (_, i) => { // Reduced bubble count for a smoother, more elegant effect
        const size = `${2 + Math.random() * 4}rem`;
        const animationDelay = `${Math.random() * 20}s`;
        const animationDuration = `${25 + Math.random() * 25}s`; // Longer duration for a calmer float
        const opacity = 0.1 + Math.random() * 0.15; // Reduced max opacity for a more subtle look

        let bubbleColor = "";
        switch (theme.id) {
            case 'dark': bubbleColor = "bg-white/20"; break;
            case 'light': bubbleColor = "bg-neutral-400"; break;
            case 'ocean': bubbleColor = "bg-cyan-400"; break;
            case 'forest': bubbleColor = "bg-lime-400"; break;
            case 'rose': bubbleColor = "bg-fuchsia-400"; break;
            case 'slate': bubbleColor = "bg-sky-400"; break;
            case 'sunrise': bubbleColor = "bg-red-400"; break;
            case 'lavender': bubbleColor = "bg-violet-400"; break;
            case 'desert': bubbleColor = "bg-orange-400"; break;
            case 'grape': bubbleColor = "bg-pink-400"; break;
            case 'sky': bubbleColor = "bg-blue-400"; break;
            case 'fire': bubbleColor = "bg-yellow-400"; break;
            case 'mint': bubbleColor = "bg-emerald-400"; break;
            default: bubbleColor = "bg-neutral-400";
        }

        const direction = Math.floor(Math.random() * 4);
        let style = {
            width: size,
            height: size,
            animationDelay,
            animationDuration,
            opacity,
        };
        let animationClass = "";

        switch (direction) {
            case 0: // from bottom to top
                style.bottom = '-10%';
                style.left = `${Math.random() * 100}%`;
                animationClass = 'bubble-up';
                break;
            case 1: // from left to right
                style.left = '-10%';
                style.top = `${Math.random() * 100}%`;
                animationClass = 'bubble-right';
                break;
            case 2: // from top to bottom
                style.top = '-10%';
                style.left = `${Math.random() * 100}%`;
                animationClass = 'bubble-down';
                break;
            case 3: // from right to left
            default:
                style.right = '-10%';
                style.top = `${Math.random() * 100}%`;
                animationClass = 'bubble-left';
                break;
        }

        return (
            <li
                key={i}
                className={`absolute rounded-full list-none block z-0 ${bubbleColor} ${animationClass}`}
            ></li>
        );
    }), [bubbleCount, theme.id]);

    return (
        <>
            <style>{`
                /* 
                   Stayone Hospitality  Ultra-Premium Design System v4
                   Theme: Midnight Obsidian  Liquid Gold  Platinum
                   Inspired by: Aman Resorts  The Brando  Six Senses
                 */
                @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,500;0,600;0,700;1,400;1,500&family=Cormorant+Garamond:ital,wght@0,300;0,400;0,600;1,300;1,400;1,600&family=Montserrat:wght@300;400;500;600;700&display=swap');

                :root {
                    --font-display:  'Playfair Display', serif;
                    --font-serif:    'Cormorant Garamond', serif;
                    --font-body:     'Montserrat', sans-serif;

                    --obsidian:      #0a0a0f;
                    --obsidian-mid:  #12121a;
                    --obsidian-soft: #1c1c28;
                    --ink:           #0d0d16;

                    --gold-deep:     #7a5518;
                    --gold:          #c8971e;
                    --gold-warm:     #e2aa30;
                    --gold-light:    #f5d485;
                    --gold-pale:     #fdf0c8;

                    --platinum:      #e8e8f0;
                    --platinum-soft: #c8c8d8;
                    --silver:        #a8a8b8;

                    --cream:         #faf7f0;
                    --cream-warm:    #f5ede0;
                    --parchment:     #ede4d0;

                    --forest:        #1a3d2b;
                    --forest-mid:    #245c3f;

                    --glass-light:   rgba(255,255,255,0.06);
                    --glass-border:  rgba(255,255,255,0.09);
                    --gold-glow:     rgba(200,151,30,0.2);

                    /* Responsive Variables */
                    --visible-cards: 3;
                    --carousel-gap: 2.5rem;
                }

                @media (max-width: 1024px) {
                    :root {
                        --visible-cards: 2;
                        --carousel-gap: 1.5rem;
                    }
                }

                @media (max-width: 768px) {
                    :root {
                        --visible-cards: 1;
                        --carousel-gap: 1rem;
                    }
                }

                * { box-sizing: border-box; max-width: 100%; }
                html { scroll-behavior: smooth; }

                body {
                    font-family: var(--font-body);
                    font-weight: 300;
                    font-size: 0.9375rem;
                    letter-spacing: 0.025em;
                    line-height: 1.7;
                    background-color: var(--cream);
                    color: #2a2a35;
                    overflow-x: hidden;
                    -webkit-font-smoothing: antialiased;
                }

                h1, h2, h3, h4 {
                    font-family: var(--font-display);
                    font-weight: 500;
                    letter-spacing: 0.03em;
                    max-width: 100%;
                    word-wrap: break-word;
                    color: var(--obsidian);
                    line-height: 1.2;
                }
                h5, h6 {
                    font-family: var(--font-serif);
                    font-weight: 400;
                    color: var(--forest-mid);
                }
                section { width: 100%; overflow-x: hidden; }
                img { max-width: 100%; height: auto; }

                .container-custom {
                    max-width: 1440px;
                    margin: 0 auto;
                    padding-left: 1.5rem;
                    padding-right: 1.5rem;
                }
                @media (min-width: 640px) {
                    .container-custom { padding-left: 2.5rem; padding-right: 2.5rem; }
                }
                @media (min-width: 1280px) {
                    .container-custom { padding-left: 4rem; padding-right: 4rem; }
                }

                /*  Eyebrow Badge  */
                .section-badge {
                    display: inline-flex;
                    align-items: center;
                    gap: 0.7rem;
                    padding: 0.4rem 1.6rem;
                    background: transparent;
                    color: var(--gold);
                    font-family: var(--font-body);
                    font-size: 0.58rem;
                    font-weight: 600;
                    letter-spacing: 0.38em;
                    text-transform: uppercase;
                    border: 1px solid rgba(200,151,30,0.35);
                }
                .section-badge::before, .section-badge::after {
                    content: '';
                    font-size: 0.42rem;
                    color: var(--gold);
                    opacity: 0.7;
                }

                /*  Gold Divider  */
                .gold-rule {
                    display: block;
                    width: 80px;
                    height: 1px;
                    background: linear-gradient(90deg, transparent 0%, var(--gold-warm) 40%, var(--gold-light) 50%, var(--gold-warm) 60%, transparent 100%);
                    margin: 0 auto;
                    position: relative;
                }
                .gold-rule::after {
                    content: '';
                    position: absolute;
                    top: 50%; left: 50%;
                    transform: translate(-50%, -50%);
                    font-size: 0.48rem;
                    color: var(--gold-warm);
                    background: var(--cream);
                    padding: 0 5px;
                }

                /*  Luxury Card  */
                .luxury-card {
                    box-shadow: 0 2px 8px rgba(10,10,15,0.06), 0 8px 32px rgba(10,10,15,0.08), 0 0 0 1px rgba(200,151,30,0.1);
                    transition: box-shadow 0.55s cubic-bezier(0.23,1,0.32,1), transform 0.55s cubic-bezier(0.23,1,0.32,1);
                    overflow: hidden;
                    position: relative;
                }
                .luxury-card::before {
                    content: '';
                    position: absolute;
                    inset: 0;
                    background: linear-gradient(135deg, rgba(200,151,30,0.05) 0%, transparent 60%);
                    opacity: 0;
                    transition: opacity 0.4s ease;
                    z-index: 0;
                    pointer-events: none;
                }
                .luxury-card:hover {
                    box-shadow: 0 4px 16px rgba(10,10,15,0.1), 0 28px 64px rgba(10,10,15,0.16), 0 0 0 1px rgba(200,151,30,0.45);
                    transform: translateY(-7px);
                }
                .luxury-card:hover::before { opacity: 1; }
                .luxury-card:hover .card-image { filter: brightness(1.08) saturate(1.2) contrast(1.04); transform: scale(1.07); }

                .card-image {
                    width: 100%; height: 100%;
                    object-fit: cover;
                    filter: brightness(1) saturate(1.05);
                    transition: transform 0.9s cubic-bezier(0.23,1,0.32,1), filter 0.6s ease;
                }

                /*  Gradients  */
                .premium-gradient {
                    background: linear-gradient(135deg, var(--obsidian) 0%, var(--obsidian-soft) 60%, #22223a 100%);
                }
                .gold-gradient {
                    background: linear-gradient(135deg, var(--gold-deep) 0%, var(--gold) 35%, var(--gold-warm) 65%, var(--gold-light) 100%);
                }
                .gold-text-gradient {
                    background: linear-gradient(110deg, var(--gold-deep) 0%, var(--gold-warm) 40%, var(--gold-light) 60%, var(--gold) 100%);
                    -webkit-background-clip: text;
                    -webkit-text-fill-color: transparent;
                    background-clip: text;
                }
                .premium-text-gradient {
                    background: linear-gradient(135deg, var(--obsidian) 0%, var(--obsidian-soft) 100%);
                    -webkit-background-clip: text;
                    -webkit-text-fill-color: transparent;
                    background-clip: text;
                }

                /*  Hero Overlay  */
                .hero-overlay {
                    background: linear-gradient(
                        160deg,
                        rgba(10,10,15,0.78) 0%,
                        rgba(10,10,15,0.25) 38%,
                        rgba(10,10,15,0.15) 55%,
                        rgba(10,10,15,0.82) 100%
                    );
                }

                .luxury-shadow {
                    box-shadow: 0 4px 16px rgba(10,10,15,0.1), 0 32px 72px rgba(10,10,15,0.18), 0 0 0 1px rgba(200,151,30,0.15);
                }

                /*  Buttons  */
                .btn-gold {
                    display: inline-flex;
                    align-items: center;
                    gap: 0.6rem;
                    padding: 0.95rem 2.6rem;
                    background: linear-gradient(110deg, var(--gold-deep) 0%, var(--gold) 40%, var(--gold-warm) 70%, var(--gold) 100%);
                    background-size: 200% 100%;
                    color: var(--obsidian);
                    font-family: var(--font-body);
                    font-size: 0.6rem;
                    font-weight: 700;
                    letter-spacing: 0.28em;
                    text-transform: uppercase;
                    border: none;
                    border-radius: 0;
                    cursor: pointer;
                    position: relative;
                    overflow: hidden;
                    transition: all 0.45s cubic-bezier(0.23,1,0.32,1);
                    box-shadow: 0 4px 24px rgba(200,151,30,0.42), inset 0 1px 0 rgba(245,212,133,0.55);
                }
                .btn-gold::before {
                    content: '';
                    position: absolute;
                    top: 0; left: -100%;
                    width: 100%; height: 100%;
                    background: linear-gradient(90deg, transparent, rgba(255,255,255,0.24), transparent);
                    transition: left 0.55s ease;
                }
                .btn-gold:hover {
                    background-position: right center;
                    box-shadow: 0 8px 40px rgba(200,151,30,0.58), inset 0 2px 0 rgba(245,212,133,0.7);
                    transform: translateY(-2px);
                    letter-spacing: 0.33em;
                }
                .btn-gold:hover::before { left: 100%; }

                .btn-ghost {
                    display: inline-flex;
                    align-items: center;
                    gap: 0.6rem;
                    padding: 0.9rem 2.4rem;
                    background: transparent;
                    color: white;
                    font-family: var(--font-body);
                    font-size: 0.6rem;
                    font-weight: 600;
                    letter-spacing: 0.28em;
                    text-transform: uppercase;
                    border: 1px solid rgba(255,255,255,0.45);
                    border-radius: 0;
                    cursor: pointer;
                    transition: all 0.35s ease;
                    backdrop-filter: blur(4px);
                }
                .btn-ghost:hover {
                    background: rgba(255,255,255,0.1);
                    border-color: rgba(255,255,255,0.8);
                    letter-spacing: 0.33em;
                }

                .btn-dark {
                    display: inline-flex;
                    align-items: center;
                    gap: 0.6rem;
                    padding: 0.9rem 2.4rem;
                    background: var(--obsidian);
                    color: var(--gold-light);
                    font-family: var(--font-body);
                    font-size: 0.6rem;
                    font-weight: 600;
                    letter-spacing: 0.28em;
                    text-transform: uppercase;
                    border: 1px solid rgba(200,151,30,0.35);
                    border-radius: 0;
                    cursor: pointer;
                    transition: all 0.4s ease;
                    box-shadow: 0 4px 20px rgba(10,10,15,0.35);
                }
                .btn-dark:hover {
                    background: var(--obsidian-soft);
                    border-color: var(--gold-warm);
                    box-shadow: 0 8px 40px rgba(10,10,15,0.5), 0 0 0 1px rgba(200,151,30,0.25);
                    transform: translateY(-2px);
                }

                /*  Navigation  */
                .nav-link {
                    position: relative;
                    padding: 0.55rem 0.85rem;
                    font-family: var(--font-body);
                    font-size: 0.58rem;
                    font-weight: 600;
                    letter-spacing: 0.22em;
                    text-transform: uppercase;
                    color: var(--obsidian);
                    text-decoration: none;
                    transition: color 0.25s ease;
                    white-space: nowrap;
                }
                .nav-link::after {
                    content: '';
                    position: absolute;
                    bottom: -1px;
                    left: 0.85rem;
                    right: 0.85rem;
                    height: 1px;
                    background: linear-gradient(90deg, transparent, var(--gold-warm), transparent);
                    transform: scaleX(0);
                    transform-origin: center;
                    transition: transform 0.38s cubic-bezier(0.23,1,0.32,1);
                }
                .nav-link:hover { color: var(--gold); }
                .nav-link:hover::after { transform: scaleX(1); }

                /*  Section Titles  */
                .section-title {
                    font-family: var(--font-display);
                    font-size: clamp(1.7rem, 3.5vw, 3.2rem);
                    font-weight: 500;
                    letter-spacing: 0.06em;
                    color: var(--obsidian);
                    text-transform: uppercase;
                    line-height: 1.15;
                }
                .section-subtitle {
                    font-family: var(--font-serif);
                    font-size: clamp(1.05rem, 2vw, 1.3rem);
                    font-style: italic;
                    font-weight: 300;
                    color: var(--silver);
                    letter-spacing: 0.03em;
                }

                /* Taj 2-column editorial section header */
                .taj-section-header {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 3.5rem 5rem;
                    align-items: end;
                    margin-bottom: 2.5rem;
                    padding-bottom: 1.5rem;
                    border-bottom: none;
                }
                @media (max-width: 1024px) {
                    .taj-section-header {
                        grid-template-columns: 1fr;
                        gap: 1.2rem;
                        text-align: left;
                        border-bottom: 1px solid rgba(200,151,30,0.1);
                        padding-bottom: 2rem;
                    }
                    .taj-section-header__right {
                        text-align: left !important;
                        font-size: 0.85rem;
                    }
                }
                .taj-section-header__left {
                    display: flex;
                    flex-direction: column;
                    gap: 0.5rem;
                }
                .taj-section-header__eyebrow {
                    display: inline-flex;
                    align-items: center;
                    gap: 0.75rem;
                    font-family: var(--font-body);
                    font-size: 0.58rem;
                    font-weight: 600;
                    letter-spacing: 0.28em;
                    text-transform: uppercase;
                    color: var(--gold);
                    margin-bottom: 0.5rem;
                }
                .taj-section-header__eyebrow::before {
                    content: '';
                    display: inline-block;
                    width: 2.5rem;
                    height: 1px;
                    background: linear-gradient(90deg, var(--gold-warm), var(--gold-light));
                    flex-shrink: 0;
                }
                .taj-section-header__title {
                    font-family: var(--font-display);
                    font-size: clamp(1.8rem, 3.8vw, 3.5rem);
                    font-weight: 500;
                    letter-spacing: 0.04em;
                    color: var(--obsidian);
                    text-transform: uppercase;
                    line-height: 1.1;
                    margin: 0;
                }
                .taj-section-header__right {
                    font-family: var(--font-body);
                    font-size: 0.88rem;
                    font-weight: 300;
                    line-height: 1.85;
                    color: #6b6b75;
                    padding-bottom: 0.5rem;
                }

                /*  Shimmer Gold  */
                .shimmer-gold {
                    background: linear-gradient(90deg, var(--gold-deep) 0%, var(--gold-warm) 25%, var(--gold-light) 50%, var(--gold-warm) 75%, var(--gold-deep) 100%);
                    background-size: 300% auto;
                    -webkit-background-clip: text;
                    -webkit-text-fill-color: transparent;
                    background-clip: text;
                    animation: shimmer 5s linear infinite;
                }

                /*  Price Badge  */
                .price-badge {
                    display: inline-flex;
                    align-items: center;
                    padding: 0.45rem 1.1rem;
                    background: rgba(10,10,15,0.9);
                    color: var(--gold-light);
                    font-family: var(--font-body);
                    font-size: 0.72rem;
                    font-weight: 600;
                    letter-spacing: 0.1em;
                    border: 1px solid rgba(200,151,30,0.5);
                    backdrop-filter: blur(12px);
                    box-shadow: 0 2px 16px rgba(0,0,0,0.3), inset 0 1px 0 rgba(200,151,30,0.2);
                }

                /*  Availability Badges  */
                .avail-badge-available   { background: rgba(10,40,22,0.92); color: #7ecba0; border-color: rgba(40,140,80,0.4); }
                .avail-badge-unavailable { background: rgba(40,10,10,0.92); color: #e8a0a0; border-color: rgba(140,40,40,0.4); }

                /*  Reveal  */
                .reveal { opacity: 0; transform: translateY(28px); filter: blur(5px); will-change: opacity, transform, filter; }
                .reveal.in { opacity: 1; transform: none; filter: blur(0); transition: opacity 0.65s cubic-bezier(0.23,1,0.32,1), transform 0.65s cubic-bezier(0.23,1,0.32,1), filter 0.65s ease; }

                /*  Keyframes  */
                @keyframes fade-in-up { from { opacity: 0; transform: translateY(40px); } to { opacity: 1; transform: translateY(0); } }
                @keyframes fade-in    { from { opacity: 0; } to { opacity: 1; } }
                @keyframes slide-in-left   { from { opacity: 0; transform: translateX(-56px); } to { opacity: 1; transform: translateX(0); } }
                @keyframes slide-in-right  { from { opacity: 0; transform: translateX(56px);  } to { opacity: 1; transform: translateX(0); } }
                @keyframes zoom-gentle { 0% { transform: scale(1) translate(0,0); } 40% { transform: scale(1.07) translate(-1%,1%); } 100% { transform: scale(1.045) translate(1%,-1%); } }
                @keyframes float-gentle { 0%,100% { transform: translateY(0px); } 50% { transform: translateY(-10px); } }
                @keyframes bounce-gentle { 0%,100% { transform: translateY(0px) translateX(-50%); } 50% { transform: translateY(-7px) translateX(-50%); } }
                @keyframes shimmer { 0% { background-position: -300% center; } 100% { background-position: 300% center; } }
                @keyframes bounce-dot { 0%,80%,100% { transform: scale(0); } 40% { transform: scale(1.0); } }
                @keyframes pulse-line { 0%,100% { opacity: 0.5; width: 36px; } 50% { opacity: 1; width: 68px; } }
                @keyframes auto-scroll         { from { transform: translateX(0); } to { transform: translateX(-50%); } }
                @keyframes auto-scroll-reverse  { from { transform: translateX(-50%); } to { transform: translateX(0); } }
                @keyframes auto-scroll-bobbing  { 0% { transform: translate(0,0); } 25% { transform: translate(-12.5%,3px); } 50% { transform: translate(-25%,0); } 75% { transform: translate(-37.5%,-3px); } 100% { transform: translate(-50%,0); } }
                @keyframes auto-scroll-bobbing-reverse { 0% { transform: translate(-50%,0); } 25% { transform: translate(-37.5%,3px); } 50% { transform: translate(-25%,0); } 75% { transform: translate(-12.5%,-3px); } 100% { transform: translate(0,0); } }

                .animate-fade-in-up    { animation: fade-in-up   0.95s cubic-bezier(0.23,1,0.32,1) forwards; opacity: 0; }
                .animate-fade-in       { animation: fade-in       0.85s ease-out forwards; opacity: 0; }
                .animate-slide-left    { animation: slide-in-left 0.95s cubic-bezier(0.23,1,0.32,1) forwards; opacity: 0; }
                .animate-slide-right   { animation: slide-in-right 0.95s cubic-bezier(0.23,1,0.32,1) forwards; opacity: 0; }
                .animate-zoom-gentle   { animation: zoom-gentle  32s ease-in-out infinite alternate; }
                .animate-float-gentle  { animation: float-gentle 4.5s ease-in-out infinite; }
                .animate-bounce-gentle { animation: bounce-gentle 2.8s ease-in-out infinite; position: absolute; left: 50%; }
                .animate-bounce-dot > div { animation: bounce-dot 1.4s infinite ease-in-out both; }
                .horizontal-scroll-container { -ms-overflow-style: none; scrollbar-width: none; }
                .horizontal-scroll-container::-webkit-scrollbar { display: none; }

                /*  Glassmorphism  */
                .glass-panel {
                    background: rgba(255,255,255,0.07);
                    backdrop-filter: blur(20px) saturate(1.5);
                    -webkit-backdrop-filter: blur(20px) saturate(1.5);
                    border: 1px solid rgba(255,255,255,0.1);
                }
                .glass-panel-dark {
                    background: rgba(10,10,15,0.78);
                    backdrop-filter: blur(20px) saturate(1.5);
                    -webkit-backdrop-filter: blur(20px) saturate(1.5);
                    border: 1px solid rgba(200,151,30,0.2);
                }

                /*  Ornamental corner frames  */
                .corner-frame { position: relative; }
                .corner-frame::before, .corner-frame::after {
                    content: '';
                    position: absolute;
                    width: 18px; height: 18px;
                    border-color: rgba(200,151,30,0.55);
                    border-style: solid;
                    transition: all 0.42s ease;
                    z-index: 2;
                    pointer-events: none;
                }
                .corner-frame::before { top: 8px; left: 8px; border-width: 1px 0 0 1px; }
                .corner-frame::after  { bottom: 8px; right: 8px; border-width: 0 1px 1px 0; }
                .corner-frame:hover::before, .corner-frame:hover::after { width: 26px; height: 26px; border-color: var(--gold-warm); }

                /*  Scroll indicator  */
                .scroll-indicator {
                    width: 1px; height: 60px;
                    background: linear-gradient(180deg, transparent, var(--gold-warm), transparent);
                    margin: 0 auto;
                    animation: float-gentle 2.5s ease-in-out infinite;
                }
            `}</style>
            <ul className="absolute top-0 left-0 w-full h-full overflow-hidden z-0 pointer-events-none">
                {/* Fine grain texture overlay */}
                <li className="absolute inset-0" style={{
                    backgroundImage: 'repeating-linear-gradient(135deg, transparent, transparent 60px, rgba(200,151,30,0.018) 60px, rgba(200,151,30,0.018) 61px)',
                    pointerEvents: 'none'
                }}></li>
            </ul>
        </>
    );
};


/**
 * A helper function to ensure a URL is valid for an external link.
 * It prepends "https://" if the protocol is missing.
 * @param {string} url The URL to format.
 * @returns {string} A valid, absolute URL.
 */
const formatUrl = (url) => {
    if (!url || typeof url !== 'string') return '#'; // Return a safe, non-navigating link if URL is missing
    if (url.startsWith('http://') || url.startsWith('https://')) return url;
    return `https://${url}`;
};

const renderLocationLink = (branch, defaultText = "Exclusive Location") => {
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
    
    // Determine the display text
    let displayText = "";
    if (loc && !isUrl(loc)) {
        displayText = loc;
    } else if (addr && !isUrl(addr)) {
        displayText = addr;
    } else {
        displayText = "View on Map";
    }
    
    if (url) {
        return (
            <a 
                href={url} 
                target="_blank" 
                rel="noopener noreferrer" 
                className="hover:text-amber-500 underline transition-colors"
                onClick={(e) => e.stopPropagation()}
            >
                {displayText}
            </a>
        );
    }
    
    return displayText || defaultText;
};

const PropertyPortal = ({ branches, onSelect, theme }) => {
    return (
        <div className={`min-h-screen ${theme.bgPrimary} flex flex-col items-center justify-center p-6 relative overflow-hidden`}>
            {/* Ambient Background */}
            <BackgroundAnimation theme={theme} />

            <div className="z-10 max-w-6xl w-full">
                <div className="text-center mb-16 animate-fade-in-up">
                    <div className="section-badge mb-4">The Stayone Collection</div>
                    <h1 className="section-title mb-4">Select Your Sanctuary</h1>
                    <p className="section-subtitle max-w-2xl mx-auto">
                        Explore our world-class resorts, each meticulously designed to offer a unique blend of luxury, serenity, and unparalleled service.
                    </p>
                    <div className="gold-rule mt-10"></div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                    {branches.map((branch, idx) => (
                        <div
                            key={branch.id}
                            className="luxury-card group cursor-pointer animate-fade-in-up bg-white"
                            style={{ animationDelay: `${idx * 150}ms` }}
                            onClick={() => onSelect(branch)}
                        >
                            <div className="aspect-[16/10] overflow-hidden relative">
                                <img
                                    src={`https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&q=80&w=800`}
                                    alt={branch.name}
                                    className="card-image transition-transform duration-700 group-hover:scale-110"
                                />
                                <div className="absolute inset-0 bg-black/20 group-hover:bg-black/10 transition-colors"></div>
                                <div className="absolute top-4 right-4 capitalize">
                                    <div className="price-badge bg-black/60 backdrop-blur-md border-white/20 text-white">
                                        Active
                                    </div>
                                </div>
                            </div>

                            <div className="p-8 space-y-4">
                                <div className="flex justify-between items-start">
                                    <div>
                                        <h3 className="text-2xl font-display text-neutral-900 group-hover:text-amber-700 transition-colors uppercase tracking-wider">{branch.name}</h3>
                                        <p className="text-sm text-neutral-500 font-body flex items-center gap-2 mt-1">
                                            <SiGooglemaps className="w-3 h-3 text-amber-600" />
                                            {renderLocationLink(branch, "Exclusive Location")}
                                        </p>
                                    </div>
                                </div>

                                <div className="pt-4 border-t border-neutral-100 flex items-center justify-between">
                                    <span className="text-[10px] uppercase tracking-[0.2em] font-bold text-neutral-400">View Sanctuary</span>
                                    <div className="w-10 h-10 rounded-full border border-amber-200 flex items-center justify-center group-hover:bg-amber-600 group-hover:border-amber-600 transition-all duration-300">
                                        <ChevronRight className="w-5 h-5 text-amber-600 group-hover:text-white" />
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>

                <div className="mt-20 text-center animate-fade-in opacity-60">
                    <p className="text-[10px] uppercase tracking-[0.3em] font-medium text-neutral-500">
                        Luxury Management by TeqMates Stayone
                    </p>
                </div>
            </div>
        </div>
    );
};

export default function App() {
    const [rooms, setRooms] = useState([]);
    const [allRooms, setAllRooms] = useState([]); // Store all rooms for filtering
    const [bookings, setBookings] = useState([]); // Store regular bookings for availability check
    const [packageBookings, setPackageBookings] = useState([]); // Store package bookings for availability check
    const [services, setServices] = useState([]);
    const [foodItems, setFoodItems] = useState([]);
    const [foodCategories, setFoodCategories] = useState([]);
    const [branches, setBranches] = useState([]);
    const [selectedBranch, setSelectedBranch] = useState(null);
    const [allPackages, setAllPackages] = useState([]); // Store all packages for filtering
    const [allServices, setAllServices] = useState([]); // Store all services for filtering
    const [allExperiences, setAllExperiences] = useState([]); // Store all signature experiences for filtering
    const [allGallery, setAllGallery] = useState([]); // Store all gallery images for filtering
    const [allBanners, setAllBanners] = useState([]); // Store all banners for filtering
    const [windowWidth, setWindowWidth] = useState(window.innerWidth);
    const [currentPath, setCurrentPath] = useState(window.location.hash);

    useEffect(() => {
        const handleHashChange = () => {
            setCurrentPath(window.location.hash);
        };
        window.addEventListener('hashchange', handleHashChange);
        return () => window.removeEventListener('hashchange', handleHashChange);
    }, []);

    useEffect(() => {
        const handleResize = () => setWindowWidth(window.innerWidth);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const getAdminRegisterUrl = useCallback(() => {
        if (typeof window !== "undefined") {
            const { hostname, port, protocol } = window.location;
            if (port === "3002") {
                return `${protocol}//${hostname}:3000/stayoneadmin/register`;
            }
            if (port === "8080") {
                return `${protocol}//${hostname}:8080/stayoneadmin/register`;
            }
            return "/stayoneadmin/register";
        }
        return "/stayoneadmin/register";
    }, []);

    const getAdminLoginUrl = useCallback(() => {
        if (typeof window !== "undefined") {
            const { hostname, port, protocol } = window.location;
            if (port === "3002") {
                return `${protocol}//${hostname}:3000/stayoneadmin`;
            }
            if (port === "8080") {
                return `${protocol}//${hostname}:8080/stayoneadmin`;
            }
            return "/stayoneadmin";
        }
        return "/stayoneadmin";
    }, []);

    // Auto-redirect if visitor hits /register or /dashboard/register directly on userend port
    useEffect(() => {
        if (typeof window !== "undefined") {
            const pathname = window.location.pathname.toLowerCase();
            if (pathname.includes("register")) {
                window.location.replace(getAdminRegisterUrl());
            } else if (pathname === "/login" || pathname === "/dashboard/login" || pathname.startsWith("/admin")) {
                window.location.replace(getAdminLoginUrl());
            }
        }
    }, [getAdminRegisterUrl, getAdminLoginUrl]);

    const itemsPerSlide = windowWidth < 768 ? 1 : (windowWidth < 1024 ? 2 : 3);
    const logoCandidates = useMemo(() => {
        const unique = new Set();
        const candidates = [];
        const addCandidate = (src) => {
            if (!src || unique.has(src)) return;
            unique.add(src);
            candidates.push(src);
        };

        addCandidate(localLogo);

        const publicUrl = process.env.PUBLIC_URL;
        if (publicUrl && publicUrl !== ".") {
            addCandidate(`${publicUrl.replace(/\/$/, "")}/logo.jpeg`);
            addCandidate(`${publicUrl.replace(/\/$/, "")}/logo.png`);
        }

        addCandidate("/logo.jpeg");
        addCandidate("/logo.png");
        addCandidate("/stayone/logo.jpeg");
        addCandidate("/stayone/logo.png");

        if (typeof window !== "undefined") {
            const origin = window.location.origin;
            addCandidate(`${origin}/logo.jpeg`);
            addCandidate(`${origin}/logo.png`);
            addCandidate(`${origin}/stayone/logo.jpeg`);
            addCandidate(`${origin}/stayone/logo.png`);
            const { pathname } = window.location;
            if (pathname && pathname !== "/") {
                const trimmedPath = pathname.endsWith("/") ? pathname.slice(0, -1) : pathname;
                if (trimmedPath) {
                    addCandidate(`${trimmedPath}/logo.jpeg`);
                    addCandidate(`${trimmedPath}/logo.png`);
                }
                const segments = pathname.split("/").filter(Boolean);
                if (segments.length > 0) {
                    addCandidate(`/${segments[0]}/logo.jpeg`);
                    addCandidate(`/${segments[0]}/logo.png`);
                }
            }
        }

        // Logo candidates for Resort
        // addCandidate("https://resort.com/logo.jpeg");

        return candidates;
    }, []);
    const [logoIndex, setLogoIndex] = useState(0);
    const logoSrc = logoCandidates[Math.min(logoIndex, logoCandidates.length - 1)];
    const [packages, setPackages] = useState([]);
    const [resortInfo, setResortInfo] = useState(null);
    const [galleryImages, setGalleryImages] = useState([]);
    const [reviews, setReviews] = useState([]);
    const [bannerData, setBannerData] = useState([]);
    const [signatureExperiences, setSignatureExperiences] = useState([]);
    const [planWeddings, setPlanWeddings] = useState([]);
    const [nearbyAttractions, setNearbyAttractions] = useState([]);
    const [nearbyAttractionBanners, setNearbyAttractionBanners] = useState([]);
    const [currentBannerIndex, setCurrentBannerIndex] = useState(0);
    const [currentWeddingIndex, setCurrentWeddingIndex] = useState(0);
    const [currentAttractionBannerIndex, setCurrentAttractionBannerIndex] = useState(0);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [showBackToTop, setShowBackToTop] = useState(false);
    const [isChatOpen, setIsChatOpen] = useState(false);
    const [chatHistory, setChatHistory] = useState([
        { role: "model", parts: [{ text: "Hello! I am your personal AI Concierge. How can I assist you with your stay at the Stayone Hospitality today?" }] }
    ]);
    const [userMessage, setUserMessage] = useState("");
    const [isChatLoading, setIsChatLoading] = useState(false);
    const [showAllRooms, setShowAllRooms] = useState(false);
    const [roomImageIndex, setRoomImageIndex] = useState({});

    // Package image slider state
    const [packageImageIndex, setPackageImageIndex] = useState({});
    const [experienceImageIndex, setExperienceImageIndex] = useState({});
    const [attractionImageIndex, setAttractionImageIndex] = useState({});
    const [packageCarouselIndex, setPackageCarouselIndex] = useState(0);
    const [isPackageHovered, setIsPackageHovered] = useState(false);

    const nextPackage = () => {
        if (packages.length <= 3) return;
        setPackageCarouselIndex((prev) => (prev + 1) % packages.length);
    };
    const prevPackage = () => {
        if (packages.length <= 3) return;
        setPackageCarouselIndex((prev) => (prev - 1 + packages.length) % packages.length);
    };



    // Signature carousel state
    const [signatureIndex, setSignatureIndex] = useState(0);
    const [isSignatureHovered, setIsSignatureHovered] = useState(false);

    const [serviceCarouselIndex, setServiceCarouselIndex] = useState(0);
    const [attractionCarouselIndex, setAttractionCarouselIndex] = useState(0);
    const [galleryIndex, setGalleryIndex] = useState(0);
    const [isServiceHovered, setIsServiceHovered] = useState(false);
    const [isAttractionHovered, setIsAttractionHovered] = useState(false);
    const [isGalleryHovered, setIsGalleryHovered] = useState(false);

    // Initial setup for infinite loops - Start in the middle set
    useEffect(() => {
        if (services.length > 0 && serviceCarouselIndex === 0) setServiceCarouselIndex(services.length);
    }, [services.length]);

    useEffect(() => {
        const activeAttractions = nearbyAttractions.filter(a => a.is_active);
        if (activeAttractions.length > 0 && attractionCarouselIndex === 0) setAttractionCarouselIndex(activeAttractions.length);
    }, [nearbyAttractions]);

    useEffect(() => {
        if (galleryImages.length > 0 && galleryIndex === 0) setGalleryIndex(galleryImages.length);
    }, [galleryImages.length]);

    // Looping Handlers
    const nextService = () => setServiceCarouselIndex(prev => prev + 1);
    const prevService = () => setServiceCarouselIndex(prev => prev - 1);

    const nextAttraction = () => setAttractionCarouselIndex(prev => prev + 1);
    const prevAttraction = () => setAttractionCarouselIndex(prev => prev - 1);

    const nextGallery = () => setGalleryIndex(prev => prev + 1);
    const prevGallery = () => setGalleryIndex(prev => prev - 1);

    // Teleport logic for seamless looping
    useEffect(() => {
        if (services.length === 0) return;
        if (serviceCarouselIndex >= services.length * 2) setServiceCarouselIndex(services.length);
        if (serviceCarouselIndex < services.length) setServiceCarouselIndex(services.length * 2 - 1);
    }, [serviceCarouselIndex, services.length]);

    useEffect(() => {
        const count = nearbyAttractions.filter(a => a.is_active).length;
        if (count === 0) return;
        if (attractionCarouselIndex >= count * 2) setAttractionCarouselIndex(count);
        if (attractionCarouselIndex < count) setAttractionCarouselIndex(count * 2 - 1);
    }, [attractionCarouselIndex, nearbyAttractions]);

    useEffect(() => {
        if (galleryImages.length === 0) return;
        if (galleryIndex >= galleryImages.length * 2) setGalleryIndex(galleryImages.length);
        if (galleryIndex < galleryImages.length) setGalleryIndex(galleryImages.length * 2 - 1);
    }, [galleryIndex, galleryImages]);

    // Auto-rotation
    useEffect(() => {
        if (isServiceHovered || services.length === 0) return;
        const timer = setInterval(nextService, 6000);
        return () => clearInterval(timer);
    }, [isServiceHovered, services.length]);

    useEffect(() => {
        if (isAttractionHovered || nearbyAttractions.length === 0) return;
        const timer = setInterval(nextAttraction, 7000);
        return () => clearInterval(timer);
    }, [isAttractionHovered, nearbyAttractions.length]);

    // Banner Message State
    const [bannerMessage, setBannerMessage] = useState({ type: null, text: "" });

    // Function to show banner message with auto-dismiss
    const showBannerMessage = (type, text) => {
        setBannerMessage({ type, text });
        // Auto-dismiss after 5 seconds
        setTimeout(() => {
            setBannerMessage({ type: null, text: "" });
        }, 5000);
    };

    // Booking Modals State
    const [isRoomBookingFormOpen, setIsRoomBookingFormOpen] = useState(false);
    const [isPackageBookingFormOpen, setIsPackageBookingFormOpen] = useState(false);
    const [isPackageSelectionOpen, setIsPackageSelectionOpen] = useState(false);
    const [isServiceBookingFormOpen, setIsServiceBookingFormOpen] = useState(false);
    const [isFoodOrderFormOpen, setIsFoodOrderFormOpen] = useState(false);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [isGeneralBookingOpen, setIsGeneralBookingOpen] = useState(false);
    const [isUserPartnerModalOpen, setIsUserPartnerModalOpen] = useState(false);
    const [showAmenities, setShowAmenities] = useState(false);
    const [isNavScrolled, setIsNavScrolled] = useState(false);

    // Scroll-aware navbar
    React.useEffect(() => {
        const onScroll = () => setIsNavScrolled(window.scrollY > 60);
        window.addEventListener('scroll', onScroll, { passive: true });
        return () => window.removeEventListener('scroll', onScroll);
    }, []);

    const [bookingData, setBookingData] = useState({
        room_ids: [],
        guest_name: "",
        guest_mobile: "",
        guest_email: "",
        check_in: "",
        check_out: "",
        adults: 1,
        children: 0,
        num_rooms: 1
    });
    const [packageBookingData, setPackageBookingData] = useState({
        package_id: null,
        room_ids: [],
        guest_name: "",
        guest_mobile: "",
        guest_email: "",
        check_in: "",
        check_out: "",
        adults: 2,
        children: 0,
        num_rooms: 1,
        food_preferences: "",
        special_requests: ""
    });
    const [serviceBookingData, setServiceBookingData] = useState({
        service_id: null,
        guest_name: "",
        guest_mobile: "",
        guest_email: "",
        room_id: null,
    });
    const [foodOrderData, setFoodOrderData] = useState({
        room_id: null,
        items: {},
    });

    const [bookingMessage, setBookingMessage] = useState({ type: null, text: "" });
    const [isBookingLoading, setIsBookingLoading] = useState(false);

    // Fallback: if data fetch hangs for some reason, hide the loader after 8s so the page can render.
    useEffect(() => {
        if (!loading) return;
        const timer = setTimeout(() => {
            setLoading(false);
        }, 8000);
        return () => clearTimeout(timer);
    }, [loading]);

    // Use Resort golden orange white theme palette
    const currentTheme = 'resort';
    const theme = themes[currentTheme];

    const bannerRef = useRef(null);
    const chatMessagesRef = useRef(null);
    const isBannerVisible = useOnScreen(bannerRef);

    const ITEM_PLACEHOLDER = logoSrc;

    // Helper function to get correct image URL
    const getImageUrl = (imagePath) => {
        if (!imagePath) return ITEM_PLACEHOLDER;
        if (imagePath.startsWith('http')) return imagePath; // Already a full URL
        const baseUrl = getMediaBaseUrl(); // e.g. http://localhost:8011

        // Normalize backslashes to forward slashes for cross-platform compatibility
        const normalizedPath = imagePath.replace(/\\/g, '/');

        // Ensure the path starts with / but don't strip /uploads/
        // The backend serves images at /uploads/... so we must keep that prefix
        const cleanPath = normalizedPath.startsWith('/') ? normalizedPath : `/${normalizedPath}`;

        return `${baseUrl}${cleanPath}`;
    };

    const activeSignatureExperiences = useMemo(
        () => signatureExperiences.filter(exp => exp.is_active && exp.image_url),
        [signatureExperiences]
    );
    const totalSignatureExperiences = activeSignatureExperiences.length;
    const activeNearbyAttractions = useMemo(
        () => nearbyAttractions.filter(attraction => attraction.is_active),
        [nearbyAttractions]
    );
    const totalNearbyAttractions = activeNearbyAttractions.length;
    const activeNearbyAttractionBanners = useMemo(
        () => nearbyAttractionBanners.filter(banner => banner.is_active),
        [nearbyAttractions]
    );
    const totalNearbyAttractionBanners = activeNearbyAttractionBanners.length;

    const foodItemsByCategory = useMemo(() => {
        if (!foodItems || !foodItems.length) return {};
        return foodItems.reduce((acc, item) => {
            const categoryName = item.category?.name || item.category_name || "Uncategorized";
            if (!acc[categoryName]) acc[categoryName] = [];
            acc[categoryName].push(item);
            return acc;
        }, {});
    }, [foodItems]);
    const categoryNames = useMemo(() => {
        const fromCategories = foodCategories.map(cat => cat.name || "Uncategorized");
        const fromItems = Object.keys(foodItemsByCategory);
        return Array.from(new Set(['All', ...fromCategories, ...fromItems]));
    }, [foodCategories, foodItemsByCategory]);
    const [selectedFoodCategory, setSelectedFoodCategory] = useState('All');
    const [visibleFoodCount, setVisibleFoodCount] = useState(10);
    useEffect(() => {
        if (!categoryNames.length) {
            if (selectedFoodCategory !== 'All') setSelectedFoodCategory('All');
            return;
        }
        if (!categoryNames.includes(selectedFoodCategory)) {
            setSelectedFoodCategory(categoryNames[0]);
        }
    }, [categoryNames, selectedFoodCategory]);
    useEffect(() => {
        if (!categoryNames.includes(selectedFoodCategory)) {
            setSelectedFoodCategory(categoryNames[0] || 'All');
        }
    }, [categoryNames, selectedFoodCategory]);
    useEffect(() => {
        setVisibleFoodCount(10);
    }, [selectedFoodCategory]);
    const displayedFoodItems = useMemo(() => {
        if (selectedFoodCategory === 'All') return foodItems;
        return foodItemsByCategory[selectedFoodCategory] || [];
    }, [foodItems, foodItemsByCategory, selectedFoodCategory]);

    const goToSignature = useCallback((direction) => {
        setSignatureIndex((prev) => {
            if (!totalSignatureExperiences) return 0;
            return (prev + direction + totalSignatureExperiences) % totalSignatureExperiences;
        });
    }, [totalSignatureExperiences]);

    const getSignatureCardStyle = useCallback((offset) => {
        const abs = Math.abs(offset);
        const isMobile = windowWidth < 768;
        
        const horizontalDistance = isMobile
            ? (abs === 1 ? '70px' : '120px')
            : (abs === 1 ? 'clamp(160px, 24vw, 260px)' : 'clamp(260px, 34vw, 380px)');
            
        const translateX = offset === 0
            ? '0px'
            : offset > 0
                ? horizontalDistance
                : `calc(-1 * ${horizontalDistance})`;
                
        const translateY = abs === 0
            ? '0px'
            : (isMobile 
                ? (abs === 1 ? '10px' : '20px')
                : (abs === 1 ? 'clamp(16px, 4vw, 32px)' : 'clamp(28px, 6vw, 52px)'));
                
        const scale = abs === 0 ? 1 : abs === 1 ? 0.9 : 0.78;
        const opacity = abs === 0 ? 1 : abs === 1 ? (isMobile ? 0.5 : 0.92) : (isMobile ? 0.2 : 0.82);
        const zIndex = abs === 0 ? 50 : abs === 1 ? 40 : 30;
        const boxShadow = abs === 0
            ? '0 25px 45px rgba(12, 61, 38, 0.28)'
            : '0 18px 35px rgba(12, 61, 38, 0.18)';

        return {
            transform: `translate(-50%, -50%) translate(${translateX}, ${translateY}) scale(${scale})`,
            opacity,
            zIndex,
            boxShadow,
            transition: 'transform 700ms cubic-bezier(.4,0,.2,1), opacity 500ms ease, box-shadow 500ms ease, background-color 500ms ease'
        };
    }, []);

    useEffect(() => {
        if (!totalSignatureExperiences) {
            setSignatureIndex(0);
            return;
        }
        setSignatureIndex(prev => prev % totalSignatureExperiences);
    }, [totalSignatureExperiences]);

    useEffect(() => {
        if (totalSignatureExperiences <= 1) return;
        const timer = setInterval(() => {
            goToSignature(1);
        }, 6000);
        return () => clearInterval(timer);
    }, [totalSignatureExperiences, goToSignature]);

    // Determine gallery card height for a mosaic layout.
    // Specifically, for the SECOND ROW (indices 5-9), apply:
    // [tall, short, tall, tall, short]
    // For other rows, use a gentle alternating pattern for visual rhythm.
    const getGalleryCardHeight = (index) => {
        const columns = 5; // grid is 5 columns on desktop
        const rowIndex = Math.floor(index / columns);
        const colIndex = index % columns;

        // Heights in pixels
        const TALL = 440;
        const SHORT = 280;

        if (rowIndex === 1) {
            const secondRowPattern = [TALL, SHORT, TALL, TALL, SHORT];
            return `${secondRowPattern[colIndex]}px`;
        }

        // Default pattern for other rows (subtle variation)
        const defaultPattern = [320, 360, 300, 360, 320];
        return `${defaultPattern[colIndex]}px`;
    };

    // Fetch branches once
    useEffect(() => {
        const fetchBranches = async () => {
            const API_BASE_URL = getApiBaseUrl();
            try {
                const res = await fetch(`${API_BASE_URL}/public/branches`);
                if (res.ok) {
                    const data = await res.json();
                    setBranches(data);
                }
            } catch (e) {
                console.error("Failed to fetch branches:", e);
                setError("Unable to connect to our resorts collection.");
            } finally {
                setLoading(false);
            }
        };
        fetchBranches();
    }, []);

    // Fetch all resort data on component mount or when branch changes
    useEffect(() => {
        const fetchResortData = async () => {
            const API_BASE_URL = getApiBaseUrl();
            const branchId = selectedBranch?.id;

            // Helper: fetch JSON but never throw – log and return fallback on error.
            const safeFetch = async (endpoint, fallback) => {
                try {
                    // Add branch_id (except for global collections to enable "Single Page" multi-property view)
                    const separator = endpoint.includes('?') ? '&' : '?';
                    const globalEndpoints = [
                        'header-banner',
                        '/public/rooms',
                        '/public/packages',
                        '/public/services',
                        '/gallery',
                        '/signature-experiences',
                        '/nearby-attractions'
                    ];
                    const isGlobalEndpoint = globalEndpoints.some(g => endpoint.includes(g));
                    const branchParam = (branchId && !isGlobalEndpoint) ? `branch_id=${branchId}` : '';
                    const cacheBuster = `_t=${Date.now()}`;
                    const items = [branchParam, cacheBuster].filter(Boolean).join('&');
                    const res = await fetch(`${API_BASE_URL}${endpoint}${separator}${items}`);
                    if (!res.ok) {
                        console.warn(`Endpoint ${endpoint} returned ${res.status}`);
                        return { data: fallback, error: true };
                    }
                    return { data: await res.json(), error: false };
                } catch (e) {
                    console.warn(`Failed to fetch ${endpoint}:`, e);
                    return { data: fallback, error: true };
                }
            };

            try {
                // Essential data for layout
                const roomsResult = await safeFetch("/public/rooms", []);
                const bookingsResult = await safeFetch("/public/bookings?limit=500&skip=0", []);
                const packageBookingsResult = await safeFetch("/public/package-bookings?limit=500&skip=0", []);
                const resortInfoResult = await safeFetch("/resort-info/", []);

                // Non‑critical / image-heavy endpoints – errors should not break the page
                const [
                    foodItemsResult,
                    foodCategoriesResult,
                    packagesResult,
                    galleryResult,
                    reviewsResult,
                    bannerResult,
                    servicesResult,
                    signatureExperiencesResult,
                    planWeddingsResult,
                    nearbyAttractionsResult,
                    nearbyAttractionBannersResult,
                ] = await Promise.all([
                    safeFetch("/public/food-items", []),
                    safeFetch("/public/food-categories", []),
                    safeFetch("/public/packages", []),
                    safeFetch("/gallery/", []),
                    safeFetch("/reviews/", []),
                    safeFetch("/header-banner/", []),
                    safeFetch("/public/services", []),
                    safeFetch("/signature-experiences/", []),
                    safeFetch("/plan-weddings/", []),
                    safeFetch("/nearby-attractions/", []),
                    safeFetch("/nearby-attraction-banners/", []),
                ]);

                const roomsData = roomsResult.data;
                const bookingsData = bookingsResult.data;
                const packageBookingsData = packageBookingsResult.data;
                const resortInfoData = resortInfoResult.data;

                setAllRooms(roomsData);
                setBookings(Array.isArray(bookingsData) ? bookingsData : (bookingsData.bookings || []));
                setPackageBookings(packageBookingsData || []);
                setAllServices(servicesResult.data || []);
                setFoodItems(foodItemsResult.data);
                setFoodCategories(foodCategoriesResult.data || []);
                setAllPackages(packagesResult.data || []);
                setAllGallery(galleryResult.data || []);
                setAllExperiences(signatureExperiencesResult.data || []);
                setResortInfo(resortInfoData.length > 0 ? resortInfoData[0] : null);
                setReviews(reviewsResult.data || []);
                setAllBanners((bannerResult.data || []).filter(b => b.is_active));
                setPlanWeddings(planWeddingsResult.data || []);
                setNearbyAttractions(nearbyAttractionsResult.data || []);
                setNearbyAttractionBanners(nearbyAttractionBannersResult.data || []);

                // Branch filtering logic
                if (branchId) {
                    const filteredRooms = roomsData.filter(r => r.branch_id == branchId);
                    const filteredPackages = (packagesResult.data || []).filter(p => p.branch_id == branchId);
                    const filteredServices = (servicesResult.data || []).filter(s => s.branch_id == branchId);

                    console.log(`Filtering for branchId ${branchId}:`, {
                        totalRooms: roomsData.length,
                        filteredRooms: filteredRooms.length,
                        roomBranchIds: roomsData.map(r => r.branch_id)
                    });

                    setRooms(filteredRooms);
                    setPackages(filteredPackages);
                    setServices(filteredServices);
                    setGalleryImages((galleryResult.data || []).filter(g => g.branch_id == branchId));
                    setBannerData((bannerResult.data || []).filter(b => b.is_active && b.branch_id == branchId));
                    setSignatureExperiences((signatureExperiencesResult.data || []).filter(e => e.branch_id == branchId));
                } else {
                    // "All" view - show everything available
                    setRooms(roomsData);
                    setPackages(packagesResult.data || []);
                    setServices(servicesResult.data || []);
                    setGalleryImages(galleryResult.data || []);
                    setBannerData((bannerResult.data || []).filter(b => b.is_active));
                    setSignatureExperiences(signatureExperiencesResult.data || []);
                }

                if (roomsResult.error && resortInfoResult.error) {
                    setError("Unable to load resort details. Please ensure the backend server is running and accessible.");
                }
            } catch (err) {
                console.error("Unexpected error while fetching resort data:", err);
                setError(
                    "Unexpected error while loading the resort. Please try again later."
                );
            } finally {
                setLoading(false);
            }
        };

        fetchResortData();
    }, [selectedBranch]); // run when branch selected

    // Auto-rotate banner images - only if multiple banners
    useEffect(() => {
        // Reset index to 0 when banner data or branch changes 
        setCurrentBannerIndex(0);

        if (bannerData.length > 1) {
            const interval = setInterval(() => {
                setCurrentBannerIndex((prev) => (prev + 1) % bannerData.length);
            }, 9000); // Slower transition: change image every 9 seconds
            return () => clearInterval(interval);
        }
    }, [bannerData, selectedBranch]);

    // Auto-change wedding images (optimized with pause on hover)
    const [isWeddingHovered, setIsWeddingHovered] = useState(false);
    const activeWeddings = useMemo(() => planWeddings.filter(w => w.is_active), [planWeddings]);
    useEffect(() => {
        if (activeWeddings.length > 1 && !isWeddingHovered) {
            const interval = setInterval(() => {
                setCurrentWeddingIndex((prev) => (prev + 1) % activeWeddings.length);
            }, 10000); // Change image every 10 seconds
            return () => clearInterval(interval);
        } else if (activeWeddings.length === 1) {
            setCurrentWeddingIndex(0); // Ensure first wedding is shown
        }
    }, [activeWeddings.length, isWeddingHovered]);


    useEffect(() => {
        if (totalNearbyAttractionBanners > 1) {
            const interval = setInterval(() => {
                setCurrentAttractionBannerIndex((prev) => (prev + 1) % totalNearbyAttractionBanners);
            }, 9000);
            return () => clearInterval(interval);
        } else if (totalNearbyAttractionBanners === 1) {
            setCurrentAttractionBannerIndex(0);
        }
    }, [totalNearbyAttractionBanners]);

    // Auto-rotate Packages carousel - reset timer when index changes (manual or auto)
    useEffect(() => {
        if (packages.length > 3 && !isPackageHovered) {
            const interval = setInterval(() => {
                nextPackage();
            }, 6000); // Change package every 6 seconds
            return () => clearInterval(interval);
        }
    }, [packages.length, isPackageHovered, packageCarouselIndex]);

    // Auto-rotate Attractions carousel - reset timer when index changes
    useEffect(() => {
        const activeAttractions = nearbyAttractions.filter(a => a.is_active);
        if (activeAttractions.length > 3 && !isAttractionHovered) {
            const interval = setInterval(() => {
                nextAttraction();
            }, 7000); // Change attraction every 7 seconds
            return () => clearInterval(interval);
        }
    }, [nearbyAttractions, isAttractionHovered, attractionCarouselIndex]);

    // Auto-rotate Gallery carousel - reset timer when index changes
    useEffect(() => {
        if (galleryImages.length > 1 && !isGalleryHovered) {
            const interval = setInterval(() => {
                nextGallery();
            }, 8000); // Change gallery image every 8 seconds
            return () => clearInterval(interval);
        }
    }, [galleryImages.length, isGalleryHovered, galleryIndex]);

    // Auto-rotate Signature Experiences
    useEffect(() => {
        if (totalSignatureExperiences > 1 && !isSignatureHovered) {
            const interval = setInterval(() => {
                goToSignature(1);
            }, 9000); // Change experience every 9 seconds
            return () => clearInterval(interval);
        }
    }, [totalSignatureExperiences, isSignatureHovered, signatureIndex]);

    // Auto-rotate Services carousel
    useEffect(() => {
        if (services.length > 3 && !isServiceHovered) {
            const interval = setInterval(() => {
                nextService();
            }, 7500); // Change service every 7.5 seconds
            return () => clearInterval(interval);
        }
    }, [services.length, isServiceHovered, serviceCarouselIndex]);

    const toggleChat = () => setIsChatOpen(!isChatOpen);

    // Handlers for opening booking modals
    const handleOpenRoomBookingForm = (roomId) => {
        setBookingData(prev => ({ ...prev, room_ids: prev.room_ids.includes(roomId) ? prev.room_ids : [...prev.room_ids, roomId] }));
        setIsRoomBookingFormOpen(true);
        setBookingMessage({ type: null, text: "" });
    };

    // Lazy reveal on scroll for elements with .reveal - optimized for performance
    useEffect(() => {
        const observer = new IntersectionObserver((entries) => {
            // Use requestAnimationFrame for smoother updates
            requestAnimationFrame(() => {
                entries.forEach((entry) => {
                    if (entry.isIntersecting) {
                        entry.target.classList.add('in');
                        observer.unobserve(entry.target);
                    }
                });
            });
        }, {
            threshold: 0.1,
            rootMargin: '50px' // Reduced from 100px for better performance
        });

        const nodes = document.querySelectorAll('.reveal');
        nodes.forEach((n) => observer.observe(n));
        return () => observer.disconnect();
    }, [galleryImages, packages]);

    const handleOpenPackageBookingForm = (packageId) => {
        // Always prioritize dates from bookingData (selected on previous page) over packageBookingData
        setPackageBookingData(prev => {
            const checkIn = (bookingData.check_in && bookingData.check_in.trim() !== '')
                ? bookingData.check_in
                : (prev.check_in && prev.check_in.trim() !== '' ? prev.check_in : '');
            const checkOut = (bookingData.check_out && bookingData.check_out.trim() !== '')
                ? bookingData.check_out
                : (prev.check_out && prev.check_out.trim() !== '' ? prev.check_out : '');

            return {
                ...prev,
                package_id: packageId,
                check_in: checkIn,
                check_out: checkOut
            };
        });
        setIsPackageBookingFormOpen(true);
        setBookingMessage({ type: null, text: "" });
    };

    const handleOpenServiceBookingForm = (serviceId) => {
        setServiceBookingData({ ...serviceBookingData, service_id: serviceId });
        setIsServiceBookingFormOpen(true);
        setBookingMessage({ type: null, text: "" });
    };

    const handleOpenFoodOrderForm = () => {
        setIsFoodOrderFormOpen(true);
        setBookingMessage({ type: null, text: "" });
    };

    // Handlers for form changes
    const handleRoomBookingChange = (e) => {
        const { name, value } = e.target;
        setBookingData(prev => {
            const updated = { ...prev, [name]: value };
            // If check_in is changed and is after check_out, clear check_out
            if (name === 'check_in' && value && prev.check_out && value >= prev.check_out) {
                updated.check_out = '';
            }
            // If check_out is changed and is before check_in, clear check_in
            if (name === 'check_out' && value && prev.check_in && value <= prev.check_in) {
                updated.check_in = '';
            }
            return updated;
        });
    };

    const handleRoomSelection = useCallback((roomId) => {
        setBookingData(prev => {
            const newRoomIds = prev.room_ids.includes(roomId)
                ? prev.room_ids.filter(id => id !== roomId)
                : [...prev.room_ids, roomId];
            return { ...prev, room_ids: newRoomIds };
        });
    }, []);

    const handlePackageBookingChange = (e) => {
        const { name, value } = e.target;
        setPackageBookingData(prev => {
            const updated = { ...prev, [name]: value };
            // If check_in is changed and is after check_out, clear check_out
            if (name === 'check_in' && value && prev.check_out && value >= prev.check_out) {
                updated.check_out = '';
            }
            // If check_out is changed and is before check_in, clear check_in
            if (name === 'check_out' && value && prev.check_in && value <= prev.check_in) {
                updated.check_in = '';
            }
            return updated;
        });
    };

    const handleServiceBookingChange = (e) => {
        const { name, value } = e.target;
        setServiceBookingData(prev => ({ ...prev, [name]: value }));
    };

    const handlePackageRoomSelection = useCallback((roomId) => {
        setPackageBookingData(prev => {
            const newRoomIds = prev.room_ids.includes(roomId)
                ? prev.room_ids.filter(id => id !== roomId)
                : [...prev.room_ids, roomId];
            return { ...prev, room_ids: newRoomIds };
        });
    }, []);

    const handleFoodOrderChange = (e, foodItemId) => {
        const { value } = e.target;
        setFoodOrderData(prev => ({
            ...prev,
            items: {
                ...prev.items,
                [foodItemId]: parseInt(value) || 0,
            }
        }));
    };

    // Check room availability based on selected dates - only show available rooms
    const [roomAvailability, setRoomAvailability] = useState({});

    // Optimized room availability calculation with useMemo and debouncing
    const roomAvailabilityMemo = useMemo(() => {
        if (!bookingData.check_in || !bookingData.check_out || allRooms.length === 0) {
            return {};
        }

        // Calculate availability for each room (memoized for performance)
        const availability = {};
        const requestedCheckIn = new Date(bookingData.check_in);
        const requestedCheckOut = new Date(bookingData.check_out);

        allRooms.forEach(room => {
            // Check conflicts with regular bookings
            const hasRegularConflict = bookings.some(booking => {
                const normalizedStatus = booking.status?.toLowerCase().replace(/_/g, '-');
                // Only check for "booked" or "checked-in" status
                if (normalizedStatus !== "booked" && normalizedStatus !== "checked-in") return false;

                const bookingCheckIn = new Date(booking.check_in);
                const bookingCheckOut = new Date(booking.check_out);

                const isRoomInBooking = booking.rooms && booking.rooms.some(r => {
                    const roomId = r.room?.id || r.id;
                    return roomId === room.id;
                });
                if (!isRoomInBooking) return false;

                return (requestedCheckIn < bookingCheckOut && requestedCheckOut > bookingCheckIn);
            });

            // Check conflicts with package bookings
            const hasPackageConflict = packageBookings.some(packageBooking => {
                const normalizedStatus = packageBooking.status?.toLowerCase().replace(/_/g, '-');
                // Only check for "booked" or "checked-in" status
                if (normalizedStatus !== "booked" && normalizedStatus !== "checked-in") return false;

                const bookingCheckIn = new Date(packageBooking.check_in);
                const bookingCheckOut = new Date(packageBooking.check_out);

                const isRoomInBooking = packageBooking.rooms && packageBooking.rooms.some(r => {
                    // For package bookings, r.id is PackageBookingRoom.id, not room.id
                    // We need to use r.room_id (direct field) or r.room.id (nested object)
                    const roomId = r.room_id || r.room?.id;
                    return roomId === room.id;
                });
                if (!isRoomInBooking) return false;

                return (requestedCheckIn < bookingCheckOut && requestedCheckOut > bookingCheckIn);
            });

            availability[room.id] = !hasRegularConflict && !hasPackageConflict;
        });
        return availability;
    }, [bookingData.check_in, bookingData.check_out, allRooms, bookings, packageBookings]);

    // Update state with debouncing to prevent excessive re-renders
    useEffect(() => {
        const timer = setTimeout(() => {
            setRoomAvailability(roomAvailabilityMemo);
        }, 100); // 100ms debounce
        return () => clearTimeout(timer);
    }, [roomAvailabilityMemo]);

    // Derived Filtered States for Multi-Property view
    useEffect(() => {
        // Rooms filtering
        let filteredRooms = selectedBranch?.id
            ? allRooms.filter(r => r.branch_id == selectedBranch.id)
            : allRooms;

        if (bookingData.check_in && bookingData.check_out && Object.keys(roomAvailability).length > 0) {
            filteredRooms = filteredRooms.filter(room => roomAvailability[room.id] === true);
        }

        // Group by type/category: Use ONLY room type images for the card.
        // Individual room images are only used as fallback if no room type image exists.
        const groupedByType = {};
        filteredRooms.forEach(room => {
            if (!groupedByType[room.type]) {
                const typeImages = new Set();
                // Add Room Type images ONLY (type-level images)
                if (room.room_type_image_url) typeImages.add(room.room_type_image_url);
                if (room.room_type_extra_images) {
                    try {
                        const extras = JSON.parse(room.room_type_extra_images);
                        if (Array.isArray(extras)) extras.forEach(img => img && typeImages.add(img));
                    } catch (e) { }
                }

                groupedByType[room.type] = {
                    ...room,
                    type_images_set: typeImages,
                    fallback_images_set: new Set() // individual room images as fallback
                };
            }

            // Add individual room images only to the fallback set (NOT to the main display set)
            if (room.image_url) groupedByType[room.type].fallback_images_set.add(room.image_url);
            if (room.extra_images) {
                try {
                    const extras = JSON.parse(room.extra_images);
                    if (Array.isArray(extras)) extras.forEach(img => img && groupedByType[room.type].fallback_images_set.add(img));
                } catch (e) { }
            }
        });

        const onePerType = Object.values(groupedByType).map(room => {
            const typeImgs = Array.from(room.type_images_set);
            const fallbackImgs = Array.from(room.fallback_images_set);
            // Use room type images; only fall back to room images if NO type image is set
            const finalImages = typeImgs.length > 0 ? typeImgs : fallbackImgs;
            return {
                ...room,
                aggregated_images: finalImages
            };
        });

        setRooms(onePerType);

        // Packages filtering
        setPackages(selectedBranch?.id
            ? allPackages.filter(p => p.branch_id == selectedBranch.id)
            : allPackages);

        // Services filtering
        setServices(selectedBranch?.id
            ? allServices.filter(s => s.branch_id == selectedBranch.id)
            : allServices);

        // Experiences filtering
        setSignatureExperiences(selectedBranch?.id
            ? allExperiences.filter(e => e.branch_id == selectedBranch.id)
            : allExperiences);

        // Gallery filtering
        setGalleryImages(selectedBranch?.id
            ? allGallery.filter(g => g.branch_id == selectedBranch.id)
            : allGallery);

        // Banner filtering
        setBannerData(selectedBranch?.id
            ? allBanners.filter(b => b.branch_id == selectedBranch.id)
            : allBanners);

    }, [allRooms, allPackages, allServices, allExperiences, allGallery, allBanners, bookingData.check_in, bookingData.check_out, roomAvailability, selectedBranch]);

    // Package booking availability - optimized with useMemo
    const [packageRoomAvailability, setPackageRoomAvailability] = useState({});

    const packageRoomAvailabilityMemo = useMemo(() => {
        if (!packageBookingData.check_in || !packageBookingData.check_out || allRooms.length === 0 || !isPackageBookingFormOpen || !packageBookingData.package_id) {
            return {};
        }

        // Get the selected package to check booking_type and room_types
        const selectedPackage = packages.find(p => p.id === packageBookingData.package_id);
        if (!selectedPackage) return {};

        // Calculate availability for each room for package booking (memoized for performance)
        const availability = {};
        
        // CRITICAL: Only check rooms that belong to the package's branch
        let roomsToCheck = allRooms;
        if (selectedPackage.branch_id) {
            roomsToCheck = allRooms.filter(r => r.branch_id === selectedPackage.branch_id);
        }

        // Determine if it's whole_property (same logic as UI)
        const hasRoomTypes = selectedPackage.room_types && selectedPackage.room_types.trim().length > 0;
        const isWholeProperty = selectedPackage.booking_type === 'whole_property' ||
            selectedPackage.booking_type === 'whole property' ||
            (!selectedPackage.booking_type && !hasRoomTypes);

        // Filter by room_types if it's NOT whole_property (i.e., it's room_type)
        // For whole_property, check all rooms within the branch
        if (!isWholeProperty && selectedPackage.room_types) {
            const allowedRoomTypes = selectedPackage.room_types.split(',').map(t => t.trim().toLowerCase());
            roomsToCheck = roomsToCheck.filter(room => {
                const roomType = room.type ? room.type.trim().toLowerCase() : '';
                return allowedRoomTypes.includes(roomType);
            });
        }
        // For whole_property, roomsToCheck remains the branch's rooms (no type filtering)

        // Check availability for each room
        const requestedCheckIn = new Date(packageBookingData.check_in);
        const requestedCheckOut = new Date(packageBookingData.check_out);

        const checkOverlap = (bIn, bOut) => {
            return requestedCheckIn < new Date(bOut) && requestedCheckOut > new Date(bIn);
        };

        const isActiveStatus = (status) => {
            const s = status?.toLowerCase().replace(/_/g, '-');
            return s === "booked" || s === "checked-in" || s === "confirmed" || s === "occupied";
        };

        if (isWholeProperty) {
            // For whole property: ANY active booking in this branch blocks the whole property
            const hasAnyBookingConflict = bookings.some(b => {
                if (selectedPackage.branch_id && b.branch_id && b.branch_id !== selectedPackage.branch_id) return false;
                return isActiveStatus(b.status) && checkOverlap(b.check_in, b.check_out);
            });
            const hasAnyPkgConflict = packageBookings.some(pb => {
                if (selectedPackage.branch_id && pb.branch_id && pb.branch_id !== selectedPackage.branch_id) return false;
                return isActiveStatus(pb.status) && checkOverlap(pb.check_in, pb.check_out);
            });

            roomsToCheck.forEach(room => {
                availability[room.id] = !hasAnyBookingConflict && !hasAnyPkgConflict;
            });
            return availability;
        }

        roomsToCheck.forEach(room => {
            // Check conflicts with regular bookings
            const hasRegularConflict = bookings.some(booking => {
                if (!isActiveStatus(booking.status)) return false;
                if (!checkOverlap(booking.check_in, booking.check_out)) return false;

                // Check if this room is part of the booking
                const isRoomInBooking = booking.rooms && booking.rooms.some(r => {
                    const roomId = r.room?.id || r.id;
                    return roomId === room.id;
                });
                return isRoomInBooking;
            });

            // Check conflicts with package bookings
            const hasPackageConflict = packageBookings.some(packageBooking => {
                if (!isActiveStatus(packageBooking.status)) return false;
                if (!checkOverlap(packageBooking.check_in, packageBooking.check_out)) return false;

                // Check if this room is part of the package booking
                const isRoomInBooking = packageBooking.rooms && packageBooking.rooms.some(r => {
                    const roomId = r.room_id || r.room?.id;
                    return roomId === room.id;
                });
                return isRoomInBooking;
            });

            // Room is available if there are no conflicting bookings (regular or package) for the selected dates
            availability[room.id] = !hasRegularConflict && !hasPackageConflict;
        });

        return availability;
    }, [packageBookingData.check_in, packageBookingData.check_out, packageBookingData.package_id, allRooms, bookings, packageBookings, isPackageBookingFormOpen, packages]);

    // Update state with debouncing to prevent excessive re-renders
    // Also auto-select all available rooms for whole_property packages
    useEffect(() => {
        const timer = setTimeout(() => {
            setPackageRoomAvailability(packageRoomAvailabilityMemo);

            // Auto-select all available rooms for whole_property packages
            if (packageBookingData.package_id && packageBookingData.check_in && packageBookingData.check_out) {
                const selectedPackage = packages.find(p => p.id === packageBookingData.package_id);
                if (selectedPackage) {
                    // Determine if it's whole_property (same logic as UI)
                    const hasRoomTypes = selectedPackage.room_types && selectedPackage.room_types.trim().length > 0;
                    const isWholeProperty = selectedPackage.booking_type === 'whole_property' ||
                        selectedPackage.booking_type === 'whole property' ||
                        (!selectedPackage.booking_type && !hasRoomTypes);

                    if (isWholeProperty) {
                        // Get all available room IDs (rooms that are available for the selected dates)
                        const availableRoomIds = Object.keys(packageRoomAvailabilityMemo)
                            .filter(roomId => packageRoomAvailabilityMemo[roomId] === true)
                            .map(id => parseInt(id));

                        // Always update room_ids for whole_property to ensure all available rooms are selected
                        setPackageBookingData(prev => ({
                            ...prev,
                            room_ids: availableRoomIds
                        }));
                    }
                }
            }
        }, 100); // 100ms debounce
        return () => clearTimeout(timer);
    }, [packageRoomAvailabilityMemo, packageBookingData.package_id, packageBookingData.check_in, packageBookingData.check_out, packages]);

    // Handlers for form submissions
    const handleRoomBookingSubmit = async (e) => {
        e.preventDefault();

        // Prevent multiple submissions
        if (isBookingLoading) {
            return;
        }

        setIsBookingLoading(true);
        setBookingMessage({ type: null, text: "" });

        if (bookingData.room_ids.length === 0) {
            showBannerMessage("error", "Please select at least one room before booking.");
            setIsBookingLoading(false);
            return;
        }

        // --- MINIMUM BOOKING DURATION VALIDATION ---
        if (bookingData.check_in && bookingData.check_out) {
            const checkInDate = new Date(bookingData.check_in);
            const checkOutDate = new Date(bookingData.check_out);
            const timeDiff = checkOutDate.getTime() - checkInDate.getTime();
            const daysDiff = timeDiff / (1000 * 3600 * 24);

            if (daysDiff < 1) {
                showBannerMessage("error", "Minimum 1 day booking is mandatory. Check-out date must be at least 1 day after check-in date.");
                setIsBookingLoading(false);
                return;
            }
        }
        
        // --- MOBILE NUMBER VALIDATION ---
        if (bookingData.guest_mobile && !/^\d{10}$/.test(bookingData.guest_mobile)) {
            showBannerMessage("error", "Please enter a valid 10-digit mobile number.");
            setIsBookingLoading(false);
            return;
        }

        // --- CAPACITY VALIDATION ---
        const selectedRoomDetails = bookingData.room_ids.map(roomId => allRooms.find(r => r.id === roomId)).filter(Boolean);
        const numRoomsBooked = parseInt(bookingData.num_rooms) || selectedRoomDetails.length || 1;
        const roomCapacity = {
            adults: selectedRoomDetails.reduce((sum, room) => sum + (room.adults_capacity || 2), 0) * (selectedRoomDetails.length > 1 ? 1 : numRoomsBooked),
            children: selectedRoomDetails.reduce((sum, room) => sum + (room.children_capacity || 0), 0) * (selectedRoomDetails.length > 1 ? 1 : numRoomsBooked)
        };

        const adultsRequested = parseInt(bookingData.adults);
        const childrenRequested = parseInt(bookingData.children);

        // Validate adults capacity
        if (adultsRequested > roomCapacity.adults) {
            showBannerMessage("error", `The number of adults (${adultsRequested}) exceeds the total adult capacity of the selected rooms (${roomCapacity.adults} adults max). Please select additional rooms or reduce the number of adults.`);
            setIsBookingLoading(false);
            return;
        }

        // Validate children capacity (skip check if children_capacity is 0 = not configured / no restriction)
        if (roomCapacity.children > 0 && childrenRequested > roomCapacity.children) {
            showBannerMessage("error", `The number of children (${childrenRequested}) exceeds the total children capacity of the selected rooms (${roomCapacity.children} children max). Please select additional rooms or reduce the number of children.`);
            setIsBookingLoading(false);
            return;
        }
        // -------------------------

        try {
            const API_BASE_URL = getApiBaseUrl();

            // Determine branch_id from selected rooms if not explicitly set by branch selection
            // This ensures if we select a room from a different branch in an "all rooms" view, the booking goes to the right place.
            let finalBranchId = selectedBranch?.id;
            let roomTypeId = null;
            if (bookingData.room_ids.length > 0) {
                const firstRoom = allRooms.find(r => r.id === bookingData.room_ids[0]);
                if (firstRoom?.branch_id) {
                    finalBranchId = firstRoom.branch_id;
                }
                if (firstRoom?.room_type_id) {
                    roomTypeId = firstRoom.room_type_id;
                }
            }

            const payloadData = { ...bookingData, branch_id: finalBranchId, source: "Guest" };
            
            // Critical Fix: For userend guest bookings, we want to SOFT-ALLOCATE. 
            // So we send the room_type_id instead of hardcoding specific physical room_ids.
            // This forces employees to assign the specific physical room during the check-in process.
            if (roomTypeId) {
                payloadData.room_type_id = roomTypeId;
                payloadData.room_ids = []; 
            }

            const response = await fetch(`${API_BASE_URL}/bookings/guest`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payloadData)
            });

            if (response.ok) {
                showBannerMessage("success", "Enquiry sent! Our team will contact you to confirm your reservation.");
                setBookingData({ room_ids: [], guest_name: "", guest_mobile: "", guest_email: "", check_in: "", check_out: "", adults: 1, children: 0, num_rooms: 1 });
                // Close the booking form after successful booking
                setTimeout(() => {
                    setIsRoomBookingFormOpen(false);
                }, 2000);
            } else {
                const errorData = await response.json();
                // Check if it's a validation error from the backend
                if (errorData.detail && errorData.detail.includes("Check-out date must be at least 1 day")) {
                    showBannerMessage("error", "Minimum 1 day booking is mandatory. Check-out date must be at least 1 day after check-in date.");
                } else {
                    showBannerMessage("error", `Booking failed: ${errorData.detail || "An unexpected error occurred."}`);
                }
            }
        } catch (err) {
            console.error("Booking API Error:", err);
            showBannerMessage("error", "An error occurred while booking. Please try again.");
        } finally {
            setIsBookingLoading(false);
        }
    };

    const handlePackageBookingSubmit = async (e) => {
        e.preventDefault();

        // Prevent multiple submissions
        if (isBookingLoading) {
            return;
        }

        setIsBookingLoading(true);
        setBookingMessage({ type: null, text: "" });

        // Check if package is whole_property - skip room validation
        const selectedPackage = packages.find(p => p.id === packageBookingData.package_id);
        if (!selectedPackage) {
            showBannerMessage("error", "Package not found. Please select a valid package.");
            setIsBookingLoading(false);
            return;
        }

        // Determine if it's whole_property (same logic as UI)
        const hasRoomTypes = selectedPackage.room_types && selectedPackage.room_types.trim().length > 0;
        const isWholeProperty = selectedPackage.booking_type === 'whole_property' ||
            selectedPackage.booking_type === 'whole property' ||
            (!selectedPackage.booking_type && !hasRoomTypes);

        // For whole_property, get all available rooms and use them directly
        let finalRoomIds = packageBookingData.room_ids;

        if (isWholeProperty) {
            const reqIn = new Date(packageBookingData.check_in);
            const reqOut = new Date(packageBookingData.check_out);
            const checkOverlap = (bIn, bOut) => reqIn < new Date(bOut) && reqOut > new Date(bIn);
            const isActiveStatus = (status) => {
                const s = status?.toLowerCase().replace(/_/g, '-');
                return s === "booked" || s === "checked-in" || s === "confirmed" || s === "occupied";
            };

            const hasAnyBookingConflict = bookings.some(b => {
                if (selectedPackage.branch_id && b.branch_id && b.branch_id !== selectedPackage.branch_id) return false;
                return isActiveStatus(b.status) && checkOverlap(b.check_in, b.check_out);
            });
            const hasAnyPkgConflict = packageBookings.some(pb => {
                if (selectedPackage.branch_id && pb.branch_id && pb.branch_id !== selectedPackage.branch_id) return false;
                return isActiveStatus(pb.status) && checkOverlap(pb.check_in, pb.check_out);
            });

            if (hasAnyBookingConflict || hasAnyPkgConflict) {
                showBannerMessage("error", "The whole property is not available for the selected dates because existing bookings are present.");
                setIsBookingLoading(false);
                return;
            }

            const branchRooms = allRooms.filter(r => !selectedPackage.branch_id || r.branch_id === selectedPackage.branch_id);
            if (branchRooms.length === 0) {
                showBannerMessage("error", "No rooms are available for this property.");
                setIsBookingLoading(false);
                return;
            }

            finalRoomIds = branchRooms.map(room => room.id);
        } else {
            // For room_type packages, validate that at least one room is selected
            if (packageBookingData.room_ids.length === 0) {
                showBannerMessage("error", "Please select at least one room for the package.");
                setIsBookingLoading(false);
                return;
            }
            finalRoomIds = packageBookingData.room_ids;
        }

        // --- MINIMUM BOOKING DURATION VALIDATION ---
        if (packageBookingData.check_in && packageBookingData.check_out) {
            const checkInDate = new Date(packageBookingData.check_in);
            const checkOutDate = new Date(packageBookingData.check_out);
            const timeDiff = checkOutDate.getTime() - checkInDate.getTime();
            const daysDiff = timeDiff / (1000 * 3600 * 24);

            if (daysDiff < 1) {
                showBannerMessage("error", "Minimum 1 day booking is mandatory. Check-out date must be at least 1 day after check-in date.");
                setIsBookingLoading(false);
                return;
            }
        }
        
        // --- MOBILE NUMBER VALIDATION ---
        if (packageBookingData.guest_mobile && !/^\d{10}$/.test(packageBookingData.guest_mobile)) {
            showBannerMessage("error", "Please enter a valid 10-digit mobile number.");
            setIsBookingLoading(false);
            return;
        }

        // --- CAPACITY VALIDATION ---
        // Skip capacity validation for whole_property packages (they book entire property regardless of guest count)
        if (!isWholeProperty) {
            const selectedRoomDetails = finalRoomIds.map(roomId => allRooms.find(r => r.id === roomId)).filter(Boolean);
            const numRoomsBooked = parseInt(packageBookingData.num_rooms) || selectedRoomDetails.length || 1;
            const packageCapacity = {
                adults: selectedRoomDetails.reduce((sum, room) => sum + (room.adults_capacity || 2), 0) * (selectedRoomDetails.length > 1 ? 1 : numRoomsBooked),
                children: selectedRoomDetails.reduce((sum, room) => sum + (room.children_capacity || 0), 0) * (selectedRoomDetails.length > 1 ? 1 : numRoomsBooked)
            };

            const adultsRequested = parseInt(packageBookingData.adults);
            const childrenRequested = parseInt(packageBookingData.children);

            // Validate adults capacity
            if (adultsRequested > packageCapacity.adults) {
                showBannerMessage("error", `The number of adults (${adultsRequested}) exceeds the total adult capacity of the selected rooms (${packageCapacity.adults} adults max). Please select additional rooms or reduce the number of adults.`);
                setIsBookingLoading(false);
                return;
            }

            // Validate children capacity (skip check if children_capacity is 0 = not configured / no restriction)
            if (packageCapacity.children > 0 && childrenRequested > packageCapacity.children) {
                showBannerMessage("error", `The number of children (${childrenRequested}) exceeds the total children capacity of the selected rooms (${packageCapacity.children} children max). Please select additional rooms or reduce the number of children.`);
                setIsBookingLoading(false);
                return;
            }
        }
        // -------------------------

        try {
            const API_BASE_URL = getApiBaseUrl();

            // Validate required fields
            if (!packageBookingData.package_id) {
                showBannerMessage("error", "Package ID is missing. Please select a package.");
                setIsBookingLoading(false);
                return;
            }

            if (!packageBookingData.check_in || !packageBookingData.check_out) {
                showBannerMessage("error", "Please select check-in and check-out dates.");
                setIsBookingLoading(false);
                return;
            }

            if (!packageBookingData.guest_name) {
                showBannerMessage("error", "Please enter your full name.");
                setIsBookingLoading(false);
                return;
            }

            // Email and mobile are optional in the schema, but we'll recommend at least one
            if (!packageBookingData.guest_email && !packageBookingData.guest_mobile) {
                showBannerMessage("error", "Please provide at least an email address or mobile number.");
                setIsBookingLoading(false);
                return;
            }

            // Determine branch_id from the selected package itself as the source of truth
            const finalPackageBranchId = selectedPackage?.branch_id || selectedBranch?.id;

            const payload = {
                package_id: parseInt(packageBookingData.package_id),
                room_ids: finalRoomIds.map(id => parseInt(id)), // Use finalRoomIds (all available for whole_property, selected for room_type)
                check_in: packageBookingData.check_in,
                check_out: packageBookingData.check_out,
                guest_name: packageBookingData.guest_name.trim(),
                guest_email: packageBookingData.guest_email?.trim() || null,
                guest_mobile: packageBookingData.guest_mobile.trim(),
                adults: parseInt(packageBookingData.adults) || 1,
                children: parseInt(packageBookingData.children) || 0,
                food_preferences: packageBookingData.food_preferences,
                special_requests: packageBookingData.special_requests,
                branch_id: finalPackageBranchId
            };

            console.log("Package Booking Payload:", payload); // Debug log

            const response = await fetch(`${API_BASE_URL}/packages/book/guest`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (response.ok) {
                showBannerMessage("success", "Enquiry sent! Our team will contact you to confirm your package reservation.");
                setPackageBookingData({ package_id: null, room_ids: [], guest_name: "", guest_mobile: "", guest_email: "", check_in: "", check_out: "", adults: 1, children: 0, num_rooms: 1, food_preferences: "", special_requests: "" });
                // Close the booking form after successful booking
                setTimeout(() => {
                    setIsPackageBookingFormOpen(false);
                }, 2000);
            } else {
                let errorMessage = "An unexpected error occurred.";
                try {
                    const contentType = response.headers.get("content-type");
                    if (contentType && contentType.includes("application/json")) {
                        const errorData = await response.json();
                        console.error("Package Booking Error Response:", errorData);

                        // Check if it's a validation error from the backend
                        if (errorData.detail) {
                            if (typeof errorData.detail === 'string') {
                                errorMessage = errorData.detail;
                            } else if (Array.isArray(errorData.detail)) {
                                // Handle Pydantic validation errors
                                const errors = errorData.detail.map(err => `${err.loc?.join('.')}: ${err.msg}`).join(', ');
                                errorMessage = `Validation error: ${errors}`;
                            } else {
                                errorMessage = JSON.stringify(errorData.detail);
                            }
                        }
                    } else {
                        const textError = await response.text();
                        console.error("Error response text:", textError);
                        errorMessage = textError || `Server error (${response.status}): ${response.statusText}`;
                    }
                } catch (parseError) {
                    console.error("Failed to parse error response:", parseError);
                    errorMessage = `Server error (${response.status}): ${response.statusText}`;
                }
                showBannerMessage("error", `Package booking failed: ${errorMessage}`);
            }
        } catch (err) {
            console.error("Package Booking API Error:", err);
            showBannerMessage("error", `An error occurred while booking the package: ${err.message || "Please check your connection and try again."}`);
        } finally {
            setIsBookingLoading(false);
        }
    };

    const handleServiceBookingSubmit = async (e) => {
        e.preventDefault();
        setIsBookingLoading(true);
        setBookingMessage({ type: null, text: "" });

        // --- MOBILE NUMBER VALIDATION ---
        if (serviceBookingData.guest_mobile && !/^\d{10}$/.test(serviceBookingData.guest_mobile)) {
            showBannerMessage("error", "Please enter a valid 10-digit mobile number.");
            setIsBookingLoading(false);
            return;
        }

        try {
            const API_BASE_URL = getApiBaseUrl();
            const response = await fetch(`${API_BASE_URL}/services/bookings`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...serviceBookingData, branch_id: selectedBranch.id })
            });

            if (response.ok) {
                showBannerMessage("success", "Service booking successful! Our staff will be with you shortly.");
                setServiceBookingData({ service_id: null, guest_name: "", guest_mobile: "", guest_email: "", room_id: null });
                // Close the booking form after successful booking
                setTimeout(() => {
                    setIsServiceBookingFormOpen(false);
                }, 2000);
            } else {
                const errorData = await response.json();
                showBannerMessage("error", `Service booking failed: ${errorData.detail || "An unexpected error occurred."}`);
            }
        } catch (err) {
            console.error("Service Booking API Error:", err);
            showBannerMessage("error", "An error occurred while booking the service. Please try again.");
        } finally {
            setIsBookingLoading(false);
        }
    };

    const handleFoodOrderSubmit = async (e) => {
        e.preventDefault();
        setIsBookingLoading(true);
        setBookingMessage({ type: null, text: "" });

        const itemsPayload = Object.entries(foodOrderData.items)
            .filter(([, quantity]) => quantity > 0)
            .map(([food_item_id, quantity]) => ({ food_item_id: parseInt(food_item_id), quantity }));

        if (itemsPayload.length === 0) {
            showBannerMessage("error", "Please select at least one food item.");
            setIsBookingLoading(false);
            return;
        }

        const payload = {
            room_id: foodOrderData.room_id,
            items: itemsPayload,
            amount: 0, // Amount will be calculated by the backend
            assigned_employee_id: 0,
            billing_status: "unbilled"
        };

        try {
            const API_BASE_URL = getApiBaseUrl();
            const response = await fetch(`${API_BASE_URL}/food-orders/`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...payload, branch_id: selectedBranch.id })
            });

            if (response.ok) {
                showBannerMessage("success", "Food order placed successfully! Your meal will be delivered shortly.");
                setFoodOrderData({ room_id: null, items: {} });
                // Close the booking form after successful order
                setTimeout(() => {
                    setIsFoodOrderFormOpen(false);
                }, 2000);
            } else {
                const errorData = await response.json();
                showBannerMessage("error", `Food order failed: ${errorData.detail || "An unexpected error occurred."}`);
            }
        } catch (err) {
            console.error("Food Order API Error:", err);
            showBannerMessage("error", "An error occurred while placing the food order. Please try again.");
        } finally {
            setIsBookingLoading(false);
        }
    };

    const handleSendMessage = async (e) => {
        e.preventDefault();
        if (!userMessage.trim() || isChatLoading) return;

        const newUserMessage = { role: "user", parts: [{ text: userMessage }] };
        setChatHistory(prev => [...prev, newUserMessage]);
        setUserMessage("");
        setIsChatLoading(true);

        try {
            // Replace with your actual Gemini API key
            const apiKey = "YOUR_GEMINI_API_KEY";
            if (apiKey === "YOUR_GEMINI_API_KEY") {
                setChatHistory(prev => [...prev, { role: "model", parts: [{ text: "Please replace 'YOUR_GEMINI_API_KEY' with your actual API key in App.js." }] }]);
                setIsChatLoading(false);
                return;
            }

            const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${apiKey}`;
            const payload = { contents: [...chatHistory, newUserMessage] };

            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!response.ok) throw new Error(`API call failed: ${response.status}`);

            const result = await response.json();
            const botResponse = result.candidates?.[0]?.content?.parts?.[0]?.text;

            if (botResponse) {
                setChatHistory(prev => [...prev, { role: "model", parts: [{ text: botResponse }] }]);
            } else {
                setChatHistory(prev => [...prev, { role: "model", parts: [{ text: "I'm sorry, I couldn't generate a response." }] }]);
            }
        } catch (err) {
            console.error("Gemini API Error:", err);
            setChatHistory(prev => [...prev, { role: "model", parts: [{ text: "I'm having trouble connecting. Please check your API key and network." }] }]);
        } finally {
            setIsChatLoading(false);
        }
    };

    useEffect(() => {
        if (chatMessagesRef.current) {
            chatMessagesRef.current.scrollTop = chatMessagesRef.current.scrollHeight;
        }
    }, [chatHistory]);

    useEffect(() => {
        // Apply theme to document body for better visibility
        document.documentElement.className = '';
        document.body.className = `${theme.bgPrimary} ${theme.textPrimary} transition-colors duration-500`;
    }, [theme]);


    // Debounced scroll handler for better performance
    useEffect(() => {
        let ticking = false;
        const handleScroll = () => {
            if (!ticking) {
                window.requestAnimationFrame(() => {
                    setShowBackToTop(window.scrollY > 300);
                    ticking = false;
                });
                ticking = true;
            }
        };
        window.addEventListener('scroll', handleScroll, { passive: true });
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    const scrollToTop = () => window.scrollTo({ top: 0, behavior: 'smooth' });

    const sectionTitleStyle = `text-3xl md:text-5xl font-extrabold mb-8 text-center tracking-tight bg-gradient-to-r ${theme.textTitleGradient} text-transparent bg-clip-text`;
    const cardStyle = `flex-none w-80 md:w-96 ${theme.bgCard} rounded-3xl overflow-hidden shadow-2xl transition-all duration-500 ease-in-out border ${theme.border} ${theme.borderHover} transform group-hover:-translate-y-1 group-hover:shadow-lg`;
    const iconStyle = `w-6 h-6 ${theme.textAccent} transition-transform duration-300 group-hover:rotate-12`;
    const textPrimary = theme.textPrimary;
    const textSecondary = theme.textSecondary;
    const priceStyle = `font-bold text-xl ${theme.textAccent} tracking-wider`;
    const buttonStyle = `mt-4 inline-flex items-center text-sm font-semibold ${theme.textAccent} hover:text-white transition duration-300`;

    if (currentPath.startsWith('#/room/')) {
        const roomId = currentPath.replace('#/room/', '');
        return <GuestRoomPortal roomId={roomId} />;
    }

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-[#0a0a0f] relative overflow-hidden">
                {/* Background Glow */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-amber-500/10 blur-[120px] rounded-full" />

                <div className="flex flex-col items-center space-y-8 relative z-10">
                    <div className="relative">
                        {/* Elite outer ring animation */}
                        <div className="w-32 h-32 md:w-40 md:h-40 rounded-full border border-amber-500/20" />
                        <div className="absolute inset-0 w-32 h-32 md:w-40 md:h-40 rounded-full border-t-2 border-amber-500 animate-spin" />

                        {/* Centered Logo with specialized pulse */}
                        <div className="absolute inset-0 rounded-full flex items-center justify-center">
                            <img
                                src={logoSrc || localLogo}
                                alt="Stayone"
                                className="h-24 md:h-32 w-auto object-contain drop-shadow-[0_0_20px_rgba(251,191,36,0.3)] animate-[logo-pulse_2s_ease-in-out_infinite]"
                            />
                        </div>
                    </div>

                    <div className="text-center space-y-3">
                        <div className="overflow-hidden">
                            <p className="text-[10px] md:text-xs tracking-[0.4em] uppercase text-amber-500/80 font-bold animate-fade-in-up">
                                The Stayone Collection
                            </p>
                        </div>
                        <div className="flex items-center justify-center gap-1.5 h-4">
                            {[0, 1, 2].map((i) => (
                                <div
                                    key={i}
                                    className="w-1.5 h-1.5 rounded-full bg-amber-500/40 animate-bounce"
                                    style={{ animationDelay: `${i * 0.15}s` }}
                                />
                            ))}
                        </div>
                    </div>
                </div>

                <style>{`
                    @keyframes logo-pulse {
                        0%, 100% { transform: scale(0.92); opacity: 0.8; filter: drop-shadow(0 0 10px rgba(251,191,36,0.2)); }
                        50% { transform: scale(1.05); opacity: 1; filter: drop-shadow(0 0 25px rgba(251,191,36,0.5)); }
                    }
                `}</style>
            </div>
        );
    }

    if (error) {
        return (
            <div className={`flex items-center justify-center min-h-screen ${theme.bgPrimary} text-red-400`}>
                <p className={`p-4 ${theme.bgCard} rounded-lg shadow-lg`}>{error}</p>
            </div>
        );
    }


    return (
        <>
            <style>{`
              @keyframes auto-scroll-bobbing { 0% { transform: translate(0, 0); } 25% { transform: translate(-12.5%, 3px); } 50% { transform: translate(-25%, 0); } 75% { transform: translate(-37.5%, -3px); } 100% { transform: translate(-50%, 0); } }
              @keyframes auto-scroll-bobbing-reverse { 0% { transform: translate(-50%, 0); } 25% { transform: translate(-37.5%, 3px); } 50% { transform: translate(-25%, 0); } 75% { transform: translate(-12.5%, -3px); } 100% { transform: translate(0, 0); } }
              @keyframes auto-scroll-reverse { from { transform: translateX(-50%); } to { transform: translateX(0); } }
              @keyframes auto-scroll { from { transform: translateX(0); } to { transform: translateX(-50%); } }
              .horizontal-scroll-container { -ms-overflow-style: none; scrollbar-width: none; }
              .horizontal-scroll-container::-webkit-scrollbar { display: none; }
              @keyframes bounce-dot { 0%, 80%, 100% { transform: scale(0); } 40% { transform: scale(1.0); } }
              .animate-bounce-dot > div { animation: bounce-dot 1.4s infinite ease-in-out both; }
            `}</style>

            <div className={`relative ${theme.bgPrimary} ${theme.textPrimary} font-sans min-h-screen transition-colors duration-500`}>
                <BackgroundAnimation theme={theme} />

                {/* Banner Message - High z-index to appear above all modals and overlays */}
                {bannerMessage.text && (
                    <div
                        className={`fixed top-0 left-0 right-0 z-[99999] p-4 text-white text-center font-medium shadow-2xl transform transition-all duration-300 ${bannerMessage.type === 'success' ? 'bg-green-600' :
                            bannerMessage.type === 'error' ? 'bg-red-600' :
                                bannerMessage.type === 'warning' ? 'bg-yellow-600' :
                                    'bg-blue-600'
                            }`}
                        style={{
                            zIndex: 99999,
                            pointerEvents: 'auto'
                        }}
                    >
                        <div className="flex items-center justify-center relative max-w-7xl mx-auto">
                            <span className="mr-2">
                                {bannerMessage.type === 'success' ? '✅' :
                                    bannerMessage.type === 'error' ? '❌' :
                                        bannerMessage.type === 'warning' ? '⚠️' :
                                            'ℹ️'}
                            </span>
                            <span className="flex-1">{bannerMessage.text}</span>
                            <button
                                onClick={() => setBannerMessage({ type: null, text: "" })}
                                className="ml-4 p-1 rounded-full hover:bg-white/20 transition-colors"
                                aria-label="Close message"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                    </div>
                )}

                <header className={`fixed left-0 right-0 z-50 ${bannerMessage.text ? 'top-16' : 'top-0'} transition-all duration-500`} style={{ height: '90px' }}>
                    {/* Scroll-aware navbar background */}
                    <div className="absolute inset-0" style={{
                        background: isNavScrolled ? 'rgba(250,246,240,0.97)' : 'rgba(250,246,240,0.0)',
                        backdropFilter: isNavScrolled ? 'blur(20px)' : 'none',
                        borderBottom: isNavScrolled ? '1px solid rgba(201,168,76,0.2)' : '1px solid transparent',
                        boxShadow: isNavScrolled ? '0 2px 24px rgba(10,10,15,0.08)' : 'none',
                        transition: 'all 0.5s cubic-bezier(0.23,1,0.32,1)'
                    }}></div>

                    <div className="container mx-auto px-4 sm:px-6 md:px-12 h-full flex items-center justify-between relative z-10">
                        {/* Logo - Enhanced with high-end luxury presentation */}
                        <div className="flex items-center h-full">
                            <div 
                                onClick={() => { setSelectedBranch(null); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                                className="flex items-center gap-2.5 sm:gap-3 cursor-pointer group transition-all duration-300"
                            >
                                <div className="relative flex items-center justify-center">
                                    <div className="absolute -inset-1 rounded-2xl bg-amber-400/20 blur-md opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                                    <img
                                        src={logoSrc}
                                        alt="StayOne Hospitality"
                                        className="relative object-contain transition-all duration-300 drop-shadow-md group-hover:scale-105"
                                        style={{ height: isNavScrolled ? '48px' : '58px', width: 'auto', maxHeight: '64px' }}
                                        loading="eager"
                                        fetchpriority="high"
                                        onError={() => {
                                            setLogoIndex((prev) => {
                                                const next = prev + 1;
                                                return next < logoCandidates.length ? next : prev;
                                            });
                                        }}
                                    />
                                </div>
                                <div className="hidden sm:flex flex-col text-left select-none">
                                    <span 
                                        className="text-xs md:text-sm font-extrabold tracking-[0.2em] uppercase font-display" 
                                        style={{ color: isNavScrolled ? '#111118' : '#ffffff', textShadow: isNavScrolled ? 'none' : '0 2px 10px rgba(0,0,0,0.8)' }}
                                    >
                                        STAYONE
                                    </span>
                                    <span className="text-[8px] md:text-[9px] tracking-[0.28em] uppercase font-bold text-amber-500">
                                        HOTELS & RESORTS
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* Desktop Navigation Menu */}
                        <nav className="hidden lg:flex items-center" style={{ gap: '0.25rem' }}>
                            {[
                                { label: 'Exclusive Deals', target: 'packages', type: 'id' },
                                { label: 'Rooms', target: 'rooms-section', type: 'id' },
                                { label: 'Properties', action: () => setSelectedBranch(null) },
                                { label: 'Services', target: '[data-services-section]', type: 'selector' },
                                { label: 'Food', target: '[data-food-section]', type: 'selector' },
                                { label: 'Gallery', target: '[data-gallery-section]', type: 'selector' },
                                { label: 'Reviews', target: '[data-reviews-section]', type: 'selector' },
                                { label: 'Partner', target: 'partner', type: 'id' },
                                { label: 'Contact', target: '[data-contact-section]', type: 'selector' },
                            ].map(({ label, target, type, action }) => (
                                <a
                                    key={label}
                                    href={target ? `#${label.toLowerCase()}` : '#'}
                                    className="nav-link"
                                    style={{ color: isNavScrolled ? 'var(--obsidian)' : 'rgba(255,255,255,0.92)' }}
                                    onClick={(e) => {
                                        e.preventDefault();
                                        if (action) {
                                            action();
                                            setTimeout(() => {
                                                const el = document.getElementById('properties');
                                                if (el) el.scrollIntoView({ behavior: 'smooth' });
                                            }, 100);
                                        } else {
                                            if (target === '[data-contact-section]') {
                                                const el = document.querySelector(target);
                                                if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                                            } else if (target === 'partner') {
                                                const el = document.getElementById('partner') || document.querySelector('[data-partner-section]');
                                                if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                                            } else if (!selectedBranch) {
                                                const el = document.getElementById('properties');
                                                if (el) el.scrollIntoView({ behavior: 'smooth' });
                                            } else {
                                                const el = type === 'id' ? document.getElementById(target) : document.querySelector(target);
                                                if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                                            }
                                        }
                                        setIsMobileMenuOpen(false);
                                    }}
                                >
                                    {label}
                                </a>
                            ))}
                        </nav>

                        {/* User / Partner Options & Book Now & Mobile Menu Toggle */}
                        <div className="flex items-center" style={{ gap: '0.6rem' }}>
                            {/* User / Partner Options Trigger */}
                            <button
                                onClick={() => setIsUserPartnerModalOpen(true)}
                                className="hidden sm:inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full text-[11px] font-bold uppercase tracking-wider transition-all duration-300 border shadow-sm group"
                                style={{
                                    color: isNavScrolled ? '#8c5d14' : '#f5d485',
                                    borderColor: isNavScrolled ? 'rgba(200,151,30,0.5)' : 'rgba(245,212,133,0.5)',
                                    background: isNavScrolled ? 'rgba(245,212,133,0.18)' : 'rgba(0,0,0,0.4)',
                                    backdropFilter: 'blur(10px)',
                                }}
                            >
                                <Sparkles className="w-3.5 h-3.5 text-amber-400 group-hover:scale-125 transition-transform" />
                                <span>User or Partner</span>
                            </button>

                            <button
                                onClick={() => { setShowAmenities(false); setIsGeneralBookingOpen(true); }}
                                className="btn-gold hidden sm:inline-flex"
                            >
                                Reserve Now
                            </button>

                            {/* List Your Property button - desktop */}
                            <a
                                href={getAdminRegisterUrl()}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="hidden lg:inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full text-[11px] font-bold uppercase tracking-widest transition-all duration-300 border"
                                style={{
                                    color: isNavScrolled ? 'var(--gold)' : 'rgba(200,151,30,0.92)',
                                    borderColor: isNavScrolled ? 'rgba(200,151,30,0.4)' : 'rgba(200,151,30,0.4)',
                                    background: 'rgba(200,151,30,0.08)',
                                }}
                                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(200,151,30,0.18)'; e.currentTarget.style.borderColor = 'rgba(200,151,30,0.7)'; }}
                                onMouseLeave={e => { e.currentTarget.style.background = 'rgba(200,151,30,0.08)'; e.currentTarget.style.borderColor = 'rgba(200,151,30,0.4)'; }}
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>
                                List Property
                            </a>

                            {/* Mobile Menu Toggle */}
                            <button
                                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                                className="lg:hidden p-2 transition-colors rounded"
                                style={{ color: isNavScrolled ? 'var(--obsidian)' : 'rgba(255,255,255,0.9)' }}
                                aria-label="Toggle menu"
                            >
                                {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
                            </button>
                        </div>
                    </div>

                    {/* Mobile Navigation Menu */}
                    {isMobileMenuOpen && (
                        <div className="lg:hidden absolute top-full left-0 right-0 shadow-xl" style={{ background: 'rgba(250,246,240,0.97)', backdropFilter: 'blur(20px)', borderBottom: '1px solid rgba(201,168,76,0.25)' }}>
                            <nav className="container mx-auto px-4 py-6" style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                                {[
                                    { label: 'Exclusive Deals', target: 'packages', type: 'id' },
                                    { label: 'Rooms', target: 'rooms-section', type: 'id' },
                                    { label: 'Properties', action: () => setSelectedBranch(null) },
                                    { label: 'Services', target: '[data-services-section]', type: 'selector' },
                                    { label: 'Food', target: '[data-food-section]', type: 'selector' },
                                    { label: 'Gallery', target: '[data-gallery-section]', type: 'selector' },
                                    { label: 'Reviews', target: '[data-reviews-section]', type: 'selector' },
                                    { label: 'Contact', target: '[data-contact-section]', type: 'selector' },
                                ].map(({ label, target, type, action }) => (
                                    <a
                                        key={label}
                                        href={target ? `#${label.toLowerCase()}` : '#'}
                                        className="nav-link block"
                                        style={{ textAlign: 'left' }}
                                        onClick={(e) => {
                                            e.preventDefault();
                                            if (action) {
                                                action();
                                                setTimeout(() => {
                                                    const el = document.getElementById('properties');
                                                    if (el) el.scrollIntoView({ behavior: 'smooth' });
                                                }, 100);
                                            } else {
                                                if (target === '[data-contact-section]') {
                                                    const el = document.querySelector(target);
                                                    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                                                } else if (!selectedBranch) {
                                                    const el = document.getElementById('properties');
                                                    if (el) el.scrollIntoView({ behavior: 'smooth' });
                                                } else {
                                                    const el = type === 'id' ? document.getElementById(target) : document.querySelector(target);
                                                    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                                                }
                                            }
                                            setIsMobileMenuOpen(false);
                                        }}
                                    >
                                        {label}
                                    </a>
                                ))}
                                <div style={{ marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                    {/* User or Partner Modal trigger */}
                                    <button
                                        onClick={() => {
                                            setIsMobileMenuOpen(false);
                                            setIsUserPartnerModalOpen(true);
                                        }}
                                        className="w-full text-center py-2.5 px-4 rounded-full border text-[11px] font-bold uppercase tracking-widest transition-all flex items-center justify-center gap-2 shadow-sm"
                                        style={{
                                            background: 'linear-gradient(135deg, rgba(200,151,30,0.25), rgba(245,212,133,0.12))',
                                            borderColor: 'rgba(200,151,30,0.5)',
                                            color: '#c8971e'
                                        }}
                                    >
                                        <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                                        Become User or Partner
                                    </button>

                                    <button
                                        onClick={() => {
                                            setShowAmenities(false);
                                            setIsGeneralBookingOpen(true);
                                            setIsMobileMenuOpen(false);
                                        }}
                                        className="btn-gold w-full justify-center"
                                    >
                                        Reserve Now
                                    </button>
                                    <a
                                        href={getAdminRegisterUrl()}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="w-full text-center py-2.5 px-4 rounded-full border text-[11px] font-bold uppercase tracking-widest transition-all flex items-center justify-center gap-1.5"
                                        style={{ color: 'var(--gold)', borderColor: 'rgba(200,151,30,0.4)', background: 'rgba(200,151,30,0.08)' }}
                                        onClick={() => setIsMobileMenuOpen(false)}
                                    >
                                        🏨 List Your Property
                                    </a>
                                </div>
                            </nav>
                        </div>
                    )}
                </header>

                <main className="w-full max-w-full pt-0 space-y-0 relative z-10 overflow-hidden">
                    {/* ── Hero Banner Section ── Always shows all available banners */}
                    <div
                        ref={bannerRef}
                        className="relative w-full overflow-hidden"
                        style={{ height: '100vh', background: '#0a0a0f' }}
                    >
                        {/* Banner images – show all banners regardless of branch selection */}
                        {bannerData.length > 0 ? (
                            bannerData.map((banner, index) => (
                                <img
                                    key={banner.id}
                                    src={getImageUrl(banner.image_url)}
                                    onError={(e) => { e.target.src = ITEM_PLACEHOLDER; }}
                                    alt={banner.title}
                                    className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-1000 ${index === currentBannerIndex ? 'opacity-100 animate-zoom-gentle' : 'opacity-0'}`}
                                />
                            ))
                        ) : (
                            <div className="absolute inset-0 bg-[#0a0a0f] flex flex-col items-center justify-center">
                                <div className="relative">
                                    <div className="absolute inset-0 bg-amber-500/20 blur-[80px] rounded-full animate-pulse" />
                                    <img
                                        src={logoSrc}
                                        className="relative w-auto h-32 md:h-48 object-contain opacity-40 contrast-125 animate-[logo-pulse_3s_ease-in-out_infinite]"
                                        alt="Stayone Logo"
                                    />
                                </div>
                                <div className="mt-8 flex gap-2">
                                    {[0, 1, 2].map((i) => (
                                        <div
                                            key={i}
                                            className="w-1.5 h-1.5 rounded-full bg-amber-500/20 animate-pulse"
                                            style={{ animationDelay: `${i * 0.3}s` }}
                                        />
                                    ))}
                                </div>
                                <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-black/80"></div>
                            </div>
                        )}

                        {/* Overlay */}
                        <div className="absolute inset-0 hero-overlay z-[1]"></div>

                        {/* Hero Content */}
                        <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-4 sm:px-6 z-10">
                            <div className="w-full max-w-4xl mx-auto">
                                <div className="animate-fade-in-up mb-4 sm:mb-6" style={{ animationDelay: '0.1s' }}>
                                    <span className="section-badge" style={{ color: 'rgba(232,213,163,0.9)', borderColor: 'rgba(201,168,76,0.6)', letterSpacing: '0.25em', fontSize: 'clamp(0.55rem, 1.5vw, 0.72rem)' }}>
                                        {selectedBranch ? `${selectedBranch.name} — Select Below to Change` : 'The Stayone Hospitality Collection'}
                                    </span>
                                </div>

                                <h1 className="animate-fade-in-up text-white uppercase drop-shadow-2xl leading-none mb-4 sm:mb-6"
                                    style={{ fontSize: 'clamp(2.5rem, 10vw, 5.5rem)', fontFamily: 'var(--font-display)', letterSpacing: '0.06em', animationDelay: '0.3s' }}>
                                    {selectedBranch ? selectedBranch.name : 'Stayone Hospitality'}
                                </h1>

                                <p className="animate-fade-in-up text-white/85 font-light mx-auto leading-relaxed mb-8"
                                    style={{ fontSize: 'clamp(0.9rem, 2.5vw, 1.15rem)', fontFamily: 'var(--font-serif)', fontStyle: 'italic', maxWidth: '560px', animationDelay: '0.5s' }}>
                                    {selectedBranch
                                        ? selectedBranch.address
                                        : 'Discover a collection of world-class resorts, each crafted for a unique blend of luxury and serenity.'}
                                </p>

                                <div className="animate-fade-in-up flex flex-col sm:flex-row items-center justify-center gap-3" style={{ animationDelay: '0.65s' }}>
                                    <button
                                        type="button"
                                        onClick={() => { setShowAmenities(false); setIsGeneralBookingOpen(true); }}
                                        className="btn-gold"
                                        style={{ fontSize: 'clamp(0.6rem, 1.8vw, 0.72rem)' }}
                                    >
                                        Reserve Your Escape
                                        <ChevronRight className="w-3 h-3 sm:w-4 sm:h-4" />
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            const el = document.getElementById('packages');
                                            if (el) el.scrollIntoView({ behavior: 'smooth' });
                                        }}
                                        style={{ fontSize: 'clamp(0.6rem, 1.8vw, 0.7rem)', letterSpacing: '0.15em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.7)', background: 'none', border: '1px solid rgba(255,255,255,0.25)', padding: '0.7rem 1.4rem', borderRadius: '999px', cursor: 'pointer' }}
                                    >
                                        Explore Deals
                                    </button>
                                </div>

                                {/* Hero Option: Become a User or Partner */}
                                <div className="animate-fade-in-up mt-5 flex items-center justify-center" style={{ animationDelay: '0.75s' }}>
                                    <button
                                        type="button"
                                        onClick={() => setIsUserPartnerModalOpen(true)}
                                        className="inline-flex items-center gap-2 px-5 py-2 rounded-full text-[11px] font-bold uppercase tracking-widest transition-all duration-300 shadow-xl hover:scale-105 border group cursor-pointer"
                                        style={{
                                            background: 'linear-gradient(135deg, rgba(200,151,30,0.35), rgba(245,212,133,0.18))',
                                            borderColor: 'rgba(245,212,133,0.65)',
                                            color: '#f5d485',
                                            backdropFilter: 'blur(12px)',
                                        }}
                                    >
                                        <Sparkles className="w-3.5 h-3.5 text-amber-300 animate-pulse group-hover:rotate-12 transition-transform" />
                                        <span>Become a User or Partner</span>
                                        <ChevronRight className="w-3.5 h-3.5 text-amber-300 group-hover:translate-x-0.5 transition-transform" />
                                    </button>
                                </div>

                                {/* Quick Branch Select Chips - Move choosing into banner */}
                                {branches.length > 1 && (
                                    <div className="animate-fade-in-up mt-12 pt-8 border-t border-white/10" style={{ animationDelay: '0.8s' }}>
                                        <p className="text-[10px] uppercase tracking-[0.3em] text-white/50 mb-4 font-bold">Quick Select Destination</p>
                                        <div className="flex flex-wrap items-center justify-center gap-3">
                                            <button
                                                onClick={() => setSelectedBranch(null)}
                                                className={`px-5 py-2 rounded-full text-[11px] uppercase tracking-widest font-bold transition-all duration-300 ${!selectedBranch ? 'bg-amber-500 text-white shadow-lg' : 'bg-white/5 text-white/70 hover:bg-white/10 hover:text-white border border-white/10'}`}
                                            >
                                                All
                                            </button>
                                            {branches.map(branch => (
                                                <button
                                                    key={branch.id}
                                                    onClick={() => {
                                                        setSelectedBranch(branch);
                                                        setTimeout(() => {
                                                            const el = document.getElementById('packages');
                                                            if (el) el.scrollIntoView({ behavior: 'smooth' });
                                                        }, 300);
                                                    }}
                                                    className={`px-5 py-2 rounded-full text-[11px] uppercase tracking-widest font-bold transition-all duration-300 ${selectedBranch?.id === branch.id ? 'bg-amber-500 text-white shadow-lg' : 'bg-white/5 text-white/70 hover:bg-white/10 hover:text-white border border-white/10'}`}
                                                >
                                                    {branch.name}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Banner nav dots */}
                        {bannerData.length > 1 && (
                            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-2 z-20">
                                {bannerData.map((_, index) => (
                                    <button
                                        key={index}
                                        onClick={() => setCurrentBannerIndex(index)}
                                        className={`transition-all duration-300 rounded-full ${index === currentBannerIndex ? 'w-8 h-1.5 bg-white' : 'w-4 h-1.5 bg-white/40 hover:bg-white/70'}`}
                                    />
                                ))}
                            </div>
                        )}
                    </div>

                    {/* ── Active Branch Context Bar ── */}
                    <div style={{ background: selectedBranch ? 'linear-gradient(90deg,#1a1a24,#2a2a36)' : 'linear-gradient(90deg,#2a2a36,#3a3a4a)', padding: '0.6rem 1.25rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', flexWrap: 'wrap' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                            <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: selectedBranch ? '#c9a84c' : '#6adc8a', display: 'inline-block', flexShrink: 0 }}></span>
                            <span style={{ fontFamily: 'var(--font-body)', fontSize: 'clamp(0.6rem,1.8vw,0.72rem)', letterSpacing: '0.15em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.75)' }}>
                                {selectedBranch ? `Showing: ${selectedBranch.name}` : 'Showing: All Properties'}
                            </span>
                        </div>
                        {selectedBranch && (
                            <button onClick={() => setSelectedBranch(null)} style={{ fontFamily: 'var(--font-body)', fontSize: '0.6rem', letterSpacing: '0.15em', textTransform: 'uppercase', color: 'rgba(201,168,76,0.9)', background: 'none', border: '1px solid rgba(201,168,76,0.35)', padding: '0.25rem 0.75rem', borderRadius: '999px', cursor: 'pointer' }}>
                                View All
                            </button>
                        )}
                    </div>

                    {/* ── Exclusive Deals (Packages) ───────────────────────── */}
                    <section id="packages" style={{ position: 'relative', backgroundColor: '#faf9f6', paddingTop: '3.5rem', paddingBottom: '6rem', overflow: 'hidden' }}>
                        {/* Dynamic Background — Blurred focus image */}
                        <div style={{ position: 'absolute', inset: 0, zIndex: 0, opacity: 0.45, transition: 'all 1s ease-in-out', filter: 'blur(60px) saturate(1.2)', pointerEvents: 'none' }}>
                            {packages.length > 0 && (
                                <img
                                    src={packages[packageCarouselIndex + 1]?.images?.[0]?.image_url
                                        ? getImageUrl(packages[packageCarouselIndex + 1].images[0].image_url)
                                        : (packages[packageCarouselIndex]?.images?.[0]?.image_url ? getImageUrl(packages[packageCarouselIndex].images[0].image_url) : '')}
                                    alt="Background"
                                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                />
                            )}
                            {/* Overlay to ensure readability */}
                            <div style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(255,255,255,0.45)' }} />
                        </div>

                        <div className="w-full mx-auto px-4 sm:px-8 md:px-16" style={{ position: 'relative', zIndex: 1 }}>
                            {/* Taj 2-column section header */}
                            <div className="taj-section-header" style={{ marginBottom: '2.5rem', paddingBottom: '1.5rem' }}>
                                <div className="taj-section-header__left">
                                    <span className="taj-section-header__eyebrow">Exclusive Deals</span>
                                    <h2 className="taj-section-header__title">Latest<br />Offers</h2>
                                </div>
                                <div className="taj-section-header__right" style={{ textAlign: 'right', fontSize: '0.92rem', color: '#6b6b75', lineHeight: '1.8' }}>
                                    Dive into cool adventures at our picture-perfect destination. From weekend escapes to extended stays, our curated packages offer more than just a room.
                                </div>
                            </div>

                            {/* Packages Carousel — Taj "Latest Offers" Style */}
                            {packages.length > 0 ? (
                                <div
                                    style={{ position: 'relative', marginTop: '2rem', padding: '0 2rem' }}
                                    onMouseEnter={() => setIsPackageHovered(true)}
                                    onMouseLeave={() => setIsPackageHovered(false)}
                                >
                                    {/* Navigation Buttons */}
                                    {packages.length > 3 && (
                                        <>
                                            <button
                                                onClick={prevPackage}
                                                style={{ position: 'absolute', left: '-1rem', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--gold)', zIndex: 10, padding: '1rem' }}
                                                className="hover:scale-125 transition-transform hidden lg:block"
                                            >
                                                <ChevronLeft size={52} strokeWidth={1} />
                                            </button>
                                            <button
                                                onClick={nextPackage}
                                                style={{ position: 'absolute', right: '-1rem', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--gold)', zIndex: 10, padding: '1rem' }}
                                                className="hover:scale-125 transition-transform hidden lg:block"
                                            >
                                                <ChevronRight size={52} strokeWidth={1} />
                                            </button>
                                        </>
                                    )}

                                    <div style={{ overflow: 'hidden', padding: '4rem 1.5rem' }}>
                                        <div style={{
                                            display: 'flex',
                                            gap: '2.5rem',
                                            transition: 'transform 1.2s cubic-bezier(0.19, 1, 0.22, 1)',
                                            transform: `translateX(calc(-${packageCarouselIndex} * (100% / var(--visible-cards, 3) + 2.5rem / var(--visible-cards, 3))))`
                                        }}>
                                            {packages.map((pkg, index) => {
                                                const imgIndex = packageImageIndex[pkg.id] || 0;
                                                const currentImage = pkg.images && pkg.images[imgIndex];

                                                // Center card logic
                                                const visibleCardsCount = typeof window !== 'undefined' ? parseInt(getComputedStyle(document.documentElement).getPropertyValue('--visible-cards') || '3') : 3;
                                                const isCenter = visibleCardsCount >= 3 ? index === (packageCarouselIndex + 1) : index === packageCarouselIndex;

                                                return (
                                                    <div
                                                        key={pkg.id}
                                                        className="group"
                                                        style={{
                                                            position: 'relative',
                                                            cursor: 'pointer',
                                                            flex: '0 0 calc((100% - (var(--visible-cards, 3) - 1) * var(--carousel-gap, 2.5rem)) / var(--visible-cards, 3))',
                                                            maxWidth: 'calc((100% - (var(--visible-cards, 3) - 1) * var(--carousel-gap, 2.5rem)) / var(--visible-cards, 3))',
                                                            transition: 'all 1s cubic-bezier(0.19, 1, 0.22, 1)',
                                                            transform: isCenter ? 'scale(1.15)' : 'scale(1)',
                                                            zIndex: isCenter ? 5 : 1,
                                                            opacity: (index >= packageCarouselIndex && index < packageCarouselIndex + visibleCardsCount) ? 1 : 0.3,
                                                            filter: isCenter ? 'none' : 'grayscale(15%) brightness(95%)',
                                                            margin: isCenter ? '0 0.5rem' : '0'
                                                        }}
                                                        onClick={() => handleOpenPackageBookingForm(pkg.id)}
                                                    >
                                                        {/* Tall image container — sharp corners */}
                                                        <div style={{
                                                            position: 'relative',
                                                            height: windowWidth < 768 ? '320px' : '420px',
                                                            overflow: 'hidden',
                                                            background: 'var(--obsidian)',
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            justifyContent: 'center',
                                                            boxShadow: isCenter ? '0 30px 60px rgba(0,0,0,0.35)' : '0 10px 30px rgba(0,0,0,0.1)',
                                                            padding: '0'
                                                        }}>
                                                            <img
                                                                src={currentImage ? getImageUrl(currentImage.image_url) : ITEM_PLACEHOLDER}
                                                                alt={pkg.title}
                                                                loading="lazy"
                                                                decoding="async"
                                                                style={{
                                                                    position: 'absolute',
                                                                    top: 0,
                                                                    left: 0,
                                                                    width: '100%',
                                                                    height: '100%',
                                                                    objectFit: 'cover',
                                                                    transition: 'transform 1s cubic-bezier(0.19, 1, 0.22, 1)'
                                                                }}
                                                                className="group-hover:scale-[1.08]"
                                                                onError={(e) => { e.target.src = ITEM_PLACEHOLDER; }}
                                                            />
                                                            {/* Subtle bottom vignette */}
                                                            <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(10,10,15,0.45) 0%, transparent 60%)', pointerEvents: 'none' }} />

                                                            {/* Image Slider Dots — Only if multiple images */}
                                                            {pkg.images && pkg.images.length > 1 && (
                                                                <div
                                                                    className="absolute bottom-16 left-1/2 -translate-x-1/2 flex gap-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                                                                >
                                                                    {pkg.images.map((_, iIdx) => (
                                                                        <button
                                                                            key={iIdx}
                                                                            onClick={() => setPackageImageIndex(prev => ({ ...prev, [pkg.id]: iIdx }))}
                                                                            style={{ width: '6px', height: '6px', borderRadius: '50%', background: iIdx === imgIndex ? '#ffffff' : 'rgba(255,255,255,0.4)', border: 'none', padding: 0 }}
                                                                        />
                                                                    ))}
                                                                </div>
                                                            )}
                                                        </div>

                                                        {/* White caption plate — Protruding at the bottom */}
                                                        <div style={{
                                                            position: 'relative',
                                                            marginTop: '-3rem',
                                                            marginLeft: '0',
                                                            marginRight: '0',
                                                            background: '#ffffff',
                                                            padding: '1.5rem 1.8rem 1.8rem',
                                                            boxShadow: isCenter ? '0 15px 45px rgba(10,10,15,0.18)' : '0 8px 32px rgba(10,10,15,0.08)',
                                                            zIndex: 2,
                                                            transition: 'transform 0.5s ease, box-shadow 0.5s ease'
                                                        }} className="group-hover:-translate-y-2">
                                                            {/* Package Title — All Caps Tracked */}
                                                            <h3 style={{ fontFamily: 'var(--font-body)', fontSize: '0.68rem', fontWeight: '600', letterSpacing: '0.24em', textTransform: 'uppercase', color: 'var(--obsidian)', marginBottom: '0.45rem', lineHeight: '1.5' }}>
                                                                {pkg.title}
                                                            </h3>
                                                            {!selectedBranch && branches.length > 1 && pkg.branch_id && (
                                                                <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.55rem', fontWeight: '600', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--gold)', marginBottom: '0.85rem' }}>
                                                                    {branches.find(b => b.id === pkg.branch_id)?.name}
                                                                </p>
                                                            )}
                                                            {/* Gold hairline */}
                                                            <div style={{ height: '1px', width: '1.5rem', background: 'var(--gold-warm)', marginBottom: '1.2rem' }} />
                                                            {/* Call to Action */}
                                                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                                                <span style={{ fontFamily: 'var(--font-body)', fontSize: '0.6rem', fontWeight: '600', letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--gold)' }}>
                                                                    DETAILS &rsaquo;
                                                                </span>
                                                                <span style={{ fontFamily: 'var(--font-display)', fontSize: '0.95rem', color: 'var(--obsidian)' }}>
                                                                    {formatCurrency(pkg.price || 0)}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div style={{ textAlign: 'center', padding: '4rem 0' }}>
                                    <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.78rem', letterSpacing: '0.1em', color: '#9a9a9a' }}>No active offers at the moment.</p>
                                </div>
                            )}
                        </div>
                    </section >

                    {/* Luxury Villa Showcase Section */}
                    < section id="rooms-section" style={{ backgroundColor: '#faf7f0', paddingTop: '5.5rem', paddingBottom: '5.5rem' }}>
                        <div className="w-full mx-auto px-4 sm:px-8 md:px-16">
                            {/* Taj 2-column section header */}
                            <div className="taj-section-header">
                                <div className="taj-section-header__left">
                                    <span className="taj-section-header__eyebrow">Luxury Accommodation</span>
                                    <h2 className="taj-section-header__title">Our Rooms &amp;<br />Cottages</h2>
                                </div>
                                <div className="taj-section-header__right">
                                    Experience the perfect union of luxury and nature in our eco-conscious cottages. Panoramic lake and forest views frame every morning, while curated amenities ensure uncompromising comfort.
                                </div>
                            </div>

                            {/* Info Banner - no dates selected */}
                            {(!bookingData.check_in || !bookingData.check_out) && (
                                <div style={{ marginBottom: '2.5rem', padding: '1rem 1.5rem', border: '1px solid rgba(200,151,30,0.18)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
                                    <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.78rem', color: '#6b6b75', letterSpacing: '0.03em' }}>
                                        Select check-in and check-out dates above to check room availability for your stay
                                    </p>
                                    <button
                                        onClick={() => { setShowAmenities(false); setIsGeneralBookingOpen(true); }}
                                        style={{ fontFamily: 'var(--font-body)', fontSize: '0.58rem', fontWeight: '600', letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--gold)', background: 'none', border: '1px solid rgba(200,151,30,0.4)', padding: '0.45rem 1.1rem', cursor: 'pointer' }}
                                    >
                                        Select Dates
                                    </button>
                                </div>
                            )}

                            {/* Availability dates banner */}
                            {bookingData.check_in && bookingData.check_out && Object.keys(roomAvailability).length > 0 && (
                                <div style={{ marginBottom: '2rem', padding: '0.7rem 1.5rem', borderLeft: '2px solid var(--gold)', background: 'rgba(200,151,30,0.06)' }}>
                                    <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.76rem', color: 'var(--obsidian)', letterSpacing: '0.03em' }}>
                                        Showing availability for <strong>{bookingData.check_in}</strong> → <strong>{bookingData.check_out}</strong>
                                    </p>
                                </div>
                            )}

                            {/* Room Cards Grid */}
                            {rooms.length > 0 ? (
                                <>
                                    <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.6rem', letterSpacing: '0.24em', color: '#c99c4e', textTransform: 'uppercase', marginBottom: '1.75rem', fontWeight: '600' }}>
                                        Showing all {rooms.length} types
                                    </p>
                                    <div style={{
                                        display: 'grid',
                                        gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 360px), 1fr))',
                                        gap: '2rem',
                                        alignItems: 'start'
                                    }}>
                                        {rooms.map((room, idx) => {
                                            const isBooked = bookingData.check_in && bookingData.check_out && !roomAvailability[room.id];
                                            const hasDateFilter = !!(bookingData.check_in && bookingData.check_out);

                                            const roomImages = room.aggregated_images || [];

                                            const imgIndex = roomImageIndex[room.id] || 0;
                                            const currentImage = roomImages.length > 0 ? roomImages[imgIndex] : null;

                                            return (
                                                <div
                                                    key={room.id}
                                                    className="group"
                                                    style={{ position: 'relative', cursor: isBooked ? 'not-allowed' : 'pointer', opacity: isBooked ? 0.7 : 1 }}
                                                >
                                                    {/* Tall full-bleed image — sharp corners */}
                                                    <div style={{ position: 'relative', height: idx % 3 === 1 ? '420px' : '370px', overflow: 'hidden', background: 'var(--obsidian)' }}>
                                                        <img
                                                            src={getImageUrl(currentImage)}
                                                            alt={room.type}
                                                            loading="lazy"
                                                            decoding="async"
                                                            style={{ width: '100%', height: '100%', objectFit: 'cover', transition: 'transform 0.9s cubic-bezier(0.23,1,0.32,1)', filter: isBooked ? 'grayscale(40%)' : 'none' }}
                                                            className={isBooked ? '' : 'group-hover:scale-[1.05]'}
                                                            onError={(e) => { e.target.src = ITEM_PLACEHOLDER; }}
                                                        />

                                                        {/* Image Slider Controls — Only if multiple images */}
                                                        {roomImages.length > 1 && (
                                                            <>
                                                                <div
                                                                    className="absolute inset-y-0 left-0 w-1/4 flex items-center justify-start pl-2 z-20 opacity-0 group-hover:opacity-100 transition-opacity"
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        setRoomImageIndex(prev => ({ ...prev, [room.id]: (imgIndex - 1 + roomImages.length) % roomImages.length }));
                                                                    }}
                                                                >
                                                                    <div className="w-8 h-8 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center text-white hover:bg-black/60 transition-all">
                                                                        <ChevronLeft size={18} />
                                                                    </div>
                                                                </div>
                                                                <div
                                                                    className="absolute inset-y-0 right-0 w-1/4 flex items-center justify-end pr-2 z-20 opacity-0 group-hover:opacity-100 transition-opacity"
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        setRoomImageIndex(prev => ({ ...prev, [room.id]: (imgIndex + 1) % roomImages.length }));
                                                                    }}
                                                                >
                                                                    <div className="w-8 h-8 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center text-white hover:bg-black/60 transition-all">
                                                                        <ChevronRight size={18} />
                                                                    </div>
                                                                </div>

                                                                {/* Dots */}
                                                                <div className="absolute bottom-12 left-1/2 -translate-x-1/2 flex gap-1.5 z-20 opacity-0 group-hover:opacity-100 transition-opacity">
                                                                    {roomImages.map((_, iIdx) => (
                                                                        <div
                                                                            key={iIdx}
                                                                            className={`w-1.5 h-1.5 rounded-full transition-all ${iIdx === imgIndex ? 'bg-white scale-110' : 'bg-white/40'}`}
                                                                        />
                                                                    ))}
                                                                </div>
                                                            </>
                                                        )}
                                                        {/* Subtle bottom vignette */}
                                                        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(10,10,15,0.32) 0%, transparent 50%)', pointerEvents: 'none' }} />

                                                        {/* Availability dot — top-right, only when dates selected */}
                                                        {hasDateFilter && (
                                                            <div style={{ position: 'absolute', top: '1rem', right: '1rem', padding: '0.3rem 0.8rem', background: isBooked ? 'rgba(180,30,30,0.88)' : 'rgba(20,130,60,0.85)', backdropFilter: 'blur(6px)', fontFamily: 'var(--font-body)', fontSize: '0.55rem', fontWeight: '600', letterSpacing: '0.2em', textTransform: 'uppercase', color: '#ffffff' }}>
                                                                {isBooked ? 'Booked' : 'Available'}
                                                            </div>
                                                        )}
                                                    </div>

                                                    {/* White caption plate */}
                                                    <div style={{
                                                        position: 'relative',
                                                        marginTop: '-2.75rem',
                                                        marginLeft: '1rem',
                                                        marginRight: '1rem',
                                                        background: '#ffffff',
                                                        padding: '1.4rem 1.6rem 1.6rem',
                                                        boxShadow: '0 8px 32px rgba(10,10,15,0.1)',
                                                        zIndex: 2,
                                                        transition: 'box-shadow 0.4s ease'
                                                    }}>
                                                        {/* Room type */}
                                                        <h3 style={{ fontFamily: 'var(--font-body)', fontSize: '0.65rem', fontWeight: '600', letterSpacing: '0.24em', textTransform: 'uppercase', color: 'var(--obsidian)', marginBottom: '0.5rem', lineHeight: '1.5' }}>
                                                            {room.type}
                                                        </h3>
                                                        {!selectedBranch && branches.length > 1 && room.branch_id && (
                                                            <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.55rem', letterSpacing: '0.15em', color: 'var(--gold)', textTransform: 'uppercase', marginBottom: '0.45rem', fontWeight: '600' }}>
                                                                {branches.find(b => b.id === room.branch_id)?.name || "Main Resort"}
                                                            </p>
                                                        )}
                                                        {/* Gold hairline */}
                                                        <div style={{ height: '1px', width: '1.75rem', background: 'linear-gradient(90deg,var(--gold-warm),var(--gold-light))', marginBottom: '0.85rem' }} />
                                                        {/* Price */}
                                                        <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.6rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: '#9a9a9a', marginBottom: '0.2rem' }}>Starting from</p>
                                                        <p style={{ fontFamily: 'var(--font-display)', fontSize: '1.3rem', fontWeight: '500', color: 'var(--obsidian)', letterSpacing: '0.02em', marginBottom: '1rem' }}>
                                                            {formatCurrency(room.price)}<span style={{ fontSize: '0.65rem', fontFamily: 'var(--font-body)', color: '#9a9a9a', fontWeight: '400', marginLeft: '0.3rem' }}>/night</span>
                                                        </p>
                                                        {/* CTA */}
                                                        <button
                                                            onClick={() => !isBooked && handleOpenRoomBookingForm(room.id)}
                                                            disabled={isBooked}
                                                            style={{
                                                                fontFamily: 'var(--font-body)',
                                                                fontSize: '0.58rem',
                                                                fontWeight: '600',
                                                                letterSpacing: '0.2em',
                                                                textTransform: 'uppercase',
                                                                color: isBooked ? '#aaa' : 'var(--gold)',
                                                                background: 'none',
                                                                border: 'none',
                                                                cursor: isBooked ? 'not-allowed' : 'pointer',
                                                                padding: 0,
                                                                display: 'inline-flex',
                                                                alignItems: 'center',
                                                                gap: '0.3rem',
                                                                transition: 'color 0.25s ease'
                                                            }}
                                                        >
                                                            {isBooked ? 'Not Available' : 'Book Now'} &rsaquo;
                                                        </button>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </>
                            ) : (
                                <div style={{ textAlign: 'center', padding: '4rem 0' }}>
                                    <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.78rem', letterSpacing: '0.1em', color: '#9a9a9a' }}>No rooms found in the system.</p>
                                </div>
                            )}

                        </div>
                    </section >

                    {/* ── Property Hub (Destinations) Section ── */}
                    <section id="properties"
                        style={{
                            padding: '3rem 1.5rem',
                            background: 'radial-gradient(circle at 50% -20%, #ffffff 0%, #faf9f6 100%)',
                            position: 'relative',
                            borderTop: '1px solid rgba(201,168,76,0.15)',
                            borderBottom: '1px solid rgba(201,168,76,0.15)'
                        }}>
                        <div className="max-w-7xl mx-auto">
                            <div className="text-center mb-6 animate-fade-in">
                                <div className="section-badge mb-2 mx-auto" style={{ letterSpacing: '0.25em', padding: '0.2rem 0.6rem', fontSize: '10px' }}>Our Destinations</div>
                                <h2 className="section-title mb-2" style={{ fontSize: 'clamp(1.5rem, 3.5vw, 2.25rem)', fontFamily: 'var(--font-display)', letterSpacing: '0.04em' }}>
                                    {selectedBranch ? 'Switch Property' : 'Choose Your Sanctuary'}
                                </h2>
                                <p className="section-subtitle max-w-2xl mx-auto text-gray-500 font-light italic" style={{ fontSize: 'clamp(0.75rem, 1.5vw, 0.88rem)', fontFamily: 'var(--font-serif)' }}>
                                    {selectedBranch
                                        ? `You are currently viewing ${selectedBranch.name}. Select another property to explore.`
                                        : 'Discover our handpicked collection of luxury resorts, each offering a distinct atmosphere.'}
                                </p>
                                <div className="w-10 h-0.5 bg-amber-500/20 mx-auto mt-4"></div>
                            </div>

                            <div className={`grid grid-cols-1 gap-6 ${branches.length === 1 ? 'max-w-md mx-auto' : branches.length === 2 ? 'md:grid-cols-2 max-w-4xl mx-auto' : 'md:grid-cols-2 lg:grid-cols-3'}`}>
                                {branches.map((branch, idx) => (
                                    <div
                                        key={branch.id}
                                        className={`group cursor-pointer animate-fade-in-up transition-all duration-700 overflow-hidden rounded-3xl shadow-md border border-transparent ${selectedBranch?.id === branch.id
                                            ? 'ring-2 ring-amber-500 ring-offset-2 scale-[1.01] shadow-2xl z-10'
                                            : 'hover:scale-[1.02] hover:shadow-2xl hover:border-amber-500/10'
                                            }`}
                                        style={{
                                            animationDelay: `${idx * 150}ms`,
                                            background: '#ffffff'
                                        }}
                                        onClick={() => {
                                            setSelectedBranch(branch);
                                            setTimeout(() => {
                                                const el = document.getElementById('rooms-section') || document.getElementById('packages');
                                                if (el) el.scrollIntoView({ behavior: 'smooth' });
                                            }, 400);
                                        }}
                                    >
                                        <div className="aspect-[21/9] overflow-hidden relative">
                                            <img
                                                src={branch.image_url ? getImageUrl(branch.image_url) : [
                                                    "https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&q=80&w=800",
                                                    "https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&q=80&w=800",
                                                    "https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?auto=format&fit=crop&q=80&w=800",
                                                    "https://images.unsplash.com/photo-1571003123894-1f0594d2b5d9?auto=format&fit=crop&q=80&w=800",
                                                    "https://images.unsplash.com/photo-1445019980597-93fa8acb246c?auto=format&fit=crop&q=80&w=800",
                                                    "https://images.unsplash.com/photo-1530521954074-e64f6810b32d?auto=format&fit=crop&q=80&w=800",
                                                ][idx % 6]}
                                                alt={branch.name}
                                                loading="lazy"
                                                decoding="async"
                                                className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-110"
                                            />
                                            {/* Refined Overlay Gradient */}
                                            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-80 group-hover:opacity-100 transition-opacity duration-500"></div>

                                            {selectedBranch?.id === branch.id && (
                                                <div className="absolute top-5 right-5">
                                                    <div className="bg-amber-500/90 backdrop-blur-md text-white text-[9px] tracking-[0.2em] uppercase font-bold px-4 py-1.5 rounded-full shadow-xl ring-1 ring-white/30 animate-pulse">
                                                        Active
                                                    </div>
                                                </div>
                                            )}

                                            <div className="absolute bottom-6 left-6 right-6">
                                                <h3 className="text-xl md:text-2xl font-display text-white uppercase tracking-widest mb-1 shadow-sm">{branch.name}</h3>
                                                <div className="flex items-center gap-1.5 text-white/80 text-[10px] md:text-xs font-body mb-3">
                                                    <MapPin className="w-3 h-3 text-amber-400" />
                                                    <span className="tracking-wide">{renderLocationLink(branch, "Exclusive Destination")}</span>
                                                </div>
                                                <div className="flex items-center gap-2 text-amber-400 text-[9px] uppercase tracking-[0.2em] font-bold opacity-0 group-hover:opacity-100 transform translate-y-3 group-hover:translate-y-0 transition-all duration-500">
                                                    <span>Explore Sanctuary</span>
                                                    <ChevronRight className="w-3 h-3 group-hover:translate-x-1.5 transition-transform" />
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </section>

                    {/* Signature Experiences Section - Resort Style */}
                    < section style={{ position: 'relative', backgroundColor: '#faf9f6', paddingTop: '3.5rem', paddingBottom: '3.5rem', overflow: 'hidden' }}>
                        {/* Dynamic Background — Blurred focus image */}
                        < div style={{
                            position: 'absolute',
                            inset: 0,
                            zIndex: 0,
                            opacity: 0.2,
                            transition: 'all 1.5s ease-in-out',
                            filter: 'blur(100px) saturate(1.2)',
                            pointerEvents: 'none'
                        }}>
                            {totalSignatureExperiences > 0 && (
                                <img
                                    src={getImageUrl(activeSignatureExperiences[signatureIndex].image_url)}
                                    alt="Background"
                                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                />
                            )}
                            <div style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(255,255,255,0.4)' }} />
                        </div >

                        <div className="w-full mx-auto px-4 sm:px-8 md:px-16" style={{ position: 'relative', zIndex: 1 }}>
                            {/* Taj 2-column section header */}
                            <div className="taj-section-header">
                                <div className="taj-section-header__left">
                                    <span className="taj-section-header__eyebrow">Curated Activities</span>
                                    <h2 className="taj-section-header__title">In-House<br />Experiences</h2>
                                </div>
                                <div className="taj-section-header__right" style={{ textAlign: 'right', fontSize: '0.92rem', color: '#6b6b75', lineHeight: '1.8' }}>
                                    Guests can enjoy a range of curated in-house activities designed to explore the region's rich flora, fauna, and cultural heritage — each crafted for wonder and discovery.
                                </div>
                            </div>

                            {totalSignatureExperiences > 0 ? (
                                <div
                                    className="relative max-w-6xl mx-auto"
                                    onMouseEnter={() => setIsSignatureHovered(true)}
                                    onMouseLeave={() => setIsSignatureHovered(false)}
                                >
                                    {/* Carousel Container */}
                                    <div className="relative h-[400px] sm:h-[460px] lg:h-[520px]">
                                        {[-2, -1, 0, 1, 2].map((offset) => {
                                            if (totalSignatureExperiences === 1 && offset !== 0) return null;
                                            const experience = totalSignatureExperiences
                                                ? activeSignatureExperiences[(signatureIndex + offset + totalSignatureExperiences) % totalSignatureExperiences]
                                                : null;
                                            if (!experience) return null;

                                            const style = getSignatureCardStyle(offset);
                                            const highlights = (experience.description || '')
                                                .split(/[\n•\.]/)
                                                .map(item => item.trim())
                                                .filter(Boolean)
                                                .slice(0, 3);

                                            return (
                                                <div
                                                    key={`${experience.id}-${offset}`}
                                                    className="absolute top-1/2 left-1/2 w-[72%] sm:w-[60%] lg:w-[50%] max-w-xl transition-all duration-700 ease-[cubic-bezier(.4,.0,.2,1)] will-change-transform"
                                                    style={{
                                                        ...style,
                                                        pointerEvents: offset === 0 ? 'auto' : 'none'
                                                    }}
                                                >
                                                    <div
                                                        className={`relative group h-[400px] sm:h-[460px] lg:h-[520px] rounded-[32px] overflow-hidden bg-black shadow-[0_35px_80px_rgba(12,61,38,0.35)] transition-transform duration-700 ease-[cubic-bezier(.4,.0,.2,1)] will-change-transform ${offset === 0 ? '' : 'scale-[0.9] opacity-70 blur-[1.5px]'}`}
                                                    >
                                                        {(() => {
                                                            let images = [experience.image_url];
                                                            if (experience.extra_images) {
                                                                try {
                                                                    const extra = JSON.parse(experience.extra_images);
                                                                    images = [...images, ...(Array.isArray(extra) ? extra : [])];
                                                                } catch (e) {
                                                                    console.error("Error parsing extra_images for experience:", e);
                                                                }
                                                            }
                                                            const currentImgIdx = experienceImageIndex[experience.id] || 0;
                                                            const currentImg = images[currentImgIdx % images.length];

                                                            return (
                                                                <>
                                                                    <img
                                                                        src={getImageUrl(currentImg)}
                                                                        alt={experience.title}
                                                                        loading="lazy"
                                                                        decoding="async"
                                                                        className="absolute inset-0 w-full h-full object-cover transition-transform duration-[1500ms] ease-out group-hover:scale-[1.12]"
                                                                        onError={(e) => { e.target.src = ITEM_PLACEHOLDER; }}
                                                                    />
                                                                    {images.length > 1 && (
                                                                        <>
                                                                            <div className="absolute inset-0 flex items-center justify-between px-4 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                                                                                <button
                                                                                    onClick={(e) => {
                                                                                        e.stopPropagation();
                                                                                        setExperienceImageIndex(prev => ({ ...prev, [experience.id]: (currentImgIdx - 1 + images.length) % images.length }));
                                                                                    }}
                                                                                    className="p-2 rounded-full bg-black/30 text-white hover:bg-black/60 backdrop-blur-md transition-all"
                                                                                >
                                                                                    <ChevronLeft size={20} />
                                                                                </button>
                                                                                <button
                                                                                    onClick={(e) => {
                                                                                        e.stopPropagation();
                                                                                        setExperienceImageIndex(prev => ({ ...prev, [experience.id]: (currentImgIdx + 1) % images.length }));
                                                                                    }}
                                                                                    className="p-2 rounded-full bg-black/30 text-white hover:bg-black/60 backdrop-blur-md transition-all"
                                                                                >
                                                                                    <ChevronRight size={20} />
                                                                                </button>
                                                                            </div>
                                                                            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-1.5 z-20">
                                                                                {images.map((_, i) => (
                                                                                    <div
                                                                                        key={i}
                                                                                        className={`transition-all duration-300 rounded-full ${i === currentImgIdx ? 'w-4 h-1 bg-[#d8b471]' : 'w-1 h-1 bg-white/50'}`}
                                                                                    />
                                                                                ))}
                                                                            </div>
                                                                        </>
                                                                    )}
                                                                </>
                                                            );
                                                        })()}
                                                        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-black/90 via-black/60 to-transparent" />
                                                        <div className="absolute top-6 left-6 z-10">
                                                            <span className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.35em] text-white/95 bg-white/20 border border-white/30 rounded-full px-5 py-1.5 shadow-lg backdrop-blur">
                                                                Explore
                                                            </span>
                                                        </div>
                                                        <div className="absolute inset-x-0 bottom-0 z-10 px-8 pb-10 pt-16 space-y-6">
                                                            <h3 className="text-3xl sm:text-4xl font-bold text-white leading-tight drop-shadow-[0_12px_30px_rgba(0,0,0,0.6)]">
                                                                {experience.title}
                                                            </h3>
                                                            {highlights.length > 0 && (
                                                                <ul className="space-y-3 text-base text-white/90">
                                                                    {highlights.map((point, idx) => (
                                                                        <li key={idx} className="flex items-start gap-3">
                                                                            <span className="mt-1 inline-flex w-2.5 h-2.5 rounded-full bg-[#c99c4e]" />
                                                                            <span>{point}</span>
                                                                        </li>
                                                                    ))}
                                                                </ul>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>

                                    {/* Carousel Controls */}
                                    {totalSignatureExperiences > 1 && (
                                        <>
                                            <button
                                                onClick={() => goToSignature(-1)}
                                                aria-label="Previous experience"
                                                type="button"
                                                className="absolute left-0 top-1/2 -translate-y-1/2 bg-white w-12 h-12 rounded-full shadow-lg border border-[#d6c8ab] flex items-center justify-center hover:scale-105 transition-transform"
                                            >
                                                <ChevronLeft className="w-6 h-6 text-[#0f5132]" />
                                            </button>
                                            <button
                                                onClick={() => goToSignature(1)}
                                                aria-label="Next experience"
                                                type="button"
                                                className="absolute right-0 top-1/2 -translate-y-1/2 bg-white w-12 h-12 rounded-full shadow-lg border border-[#d6c8ab] flex items-center justify-center hover:scale-105 transition-transform"
                                            >
                                                <ChevronRight className="w-6 h-6 text-[#0f5132]" />
                                            </button>
                                        </>
                                    )}

                                    {/* Carousel Indicators */}
                                    {totalSignatureExperiences > 1 && (
                                        <div className="mt-10 flex justify-center gap-2">
                                            {activeSignatureExperiences.map((exp, idx) => (
                                                <button
                                                    key={exp.id}
                                                    onClick={() => setSignatureIndex(idx)}
                                                    type="button"
                                                    className={`w-3 h-3 rounded-full transition-all ${idx === signatureIndex
                                                        ? 'bg-[#0f5132]'
                                                        : 'bg-[#c99c4e]/40 hover:bg-[#c99c4e]/70'
                                                        }`}
                                                    aria-label={`Go to experience ${idx + 1}`}
                                                />
                                            ))}
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <p className={`text-center py-12 ${theme.textSecondary}`}>No signature experiences available at the moment.</p>
                            )}
                        </div>
                    </section >

                    {/* Plan Your Wedding Section - Dynamic with Slider */}
                    {
                        planWeddings.length > 0 && planWeddings.some(w => w.is_active) && (
                            <section
                                className="relative w-full h-[600px] md:h-[700px] overflow-hidden"
                                onMouseEnter={() => setIsWeddingHovered(true)}
                                onMouseLeave={() => setIsWeddingHovered(false)}
                            >
                                {planWeddings.filter(w => w.is_active).map((wedding, index) => (
                                    <div key={wedding.id}>
                                        {/* Background Images with Animation and Auto-Change */}
                                        <div className="absolute inset-0">
                                            <img
                                                src={getImageUrl(wedding.image_url)}
                                                alt={wedding.title}
                                                loading="lazy"
                                                decoding="async"
                                                className={`absolute inset-0 w-[110%] h-[110%] object-cover object-center transition-all duration-[10000ms] ease-in-out ${index === currentWeddingIndex ? 'opacity-100 scale-100' : 'opacity-0 scale-110'} animate-[slow-pan_20s_ease-in-out_infinite]`}
                                                style={{
                                                    animationDelay: `${index * 2}s`,
                                                    animationDirection: index % 2 === 0 ? 'alternate' : 'alternate-reverse'
                                                }}
                                                onError={(e) => { e.target.src = ITEM_PLACEHOLDER; }}
                                            />
                                            {/* Gradient Overlay */}
                                            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/60 to-black/30"></div>
                                        </div>

                                        {/* Content Overlay */}
                                        <div className={`relative h-full flex items-center justify-center px-4 sm:px-6 lg:px-8 transition-all duration-1000 ease-in-out ${index === currentWeddingIndex ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}>
                                            <div className="max-w-5xl mx-auto text-center text-white">
                                                {/* Badge */}
                                                <div className="mb-6 inline-block px-6 py-2 bg-white/15 backdrop-blur-sm rounded-full border border-white/40 animate-[fadeInUp_1s_ease-out]">
                                                    <span className="text-[#d8b471] text-sm font-semibold tracking-[0.35em] uppercase">
                                                        ✦ Perfect Venue ✦
                                                    </span>
                                                </div>

                                                {/* Main Title */}
                                                <h2 className="text-3xl md:text-5xl lg:text-7xl font-extrabold mb-6 animate-[fadeInUp_1.2s_ease-out] drop-shadow-2xl leading-tight">
                                                    {wedding.title.split(' ').slice(0, 3).join(' ')}<br />
                                                    <span className="bg-gradient-to-r from-white via-[#f5e6c9] to-white bg-clip-text text-transparent">
                                                        {wedding.title.split(' ').slice(3).join(' ') || 'WEDDING DESTINATION'}
                                                    </span>
                                                </h2>

                                                {/* Description */}
                                                <p className="text-base md:text-xl lg:text-2xl text-white/90 max-w-4xl mx-auto leading-relaxed mb-8 animate-[fadeInUp_1.4s_ease-out] drop-shadow-lg">
                                                    {wedding.description}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                ))}

                                {/* Navigation Dots */}
                                {planWeddings.filter(w => w.is_active).length > 1 && (
                                    <div className="absolute bottom-4 md:bottom-8 left-1/2 transform -translate-x-1/2 flex gap-2 z-20">
                                        {planWeddings.filter(w => w.is_active).map((_, index) => (
                                            <button
                                                key={index}
                                                onClick={() => setCurrentWeddingIndex(index)}
                                                className={`transition-all duration-300 ${index === currentWeddingIndex
                                                    ? "w-12 h-1 bg-[#d8b471] rounded-full shadow-[0_0_12px_rgba(216,180,113,0.6)]"
                                                    : "w-8 h-1 bg-white/40 hover:bg-white/70 rounded-full"
                                                    }`}
                                                aria-label={`Go to slide ${index + 1}`}
                                            />
                                        ))}
                                    </div>
                                )}
                            </section>
                        )
                    }

                    {/* Premium Services Showcase Section */}
                    <section data-services-section style={{ position: 'relative', backgroundColor: '#faf9f6', paddingTop: '3.5rem', paddingBottom: '7rem', overflow: 'hidden' }}>
                        {/* Dynamic Background — Blurred focus image */}
                        <div style={{
                            position: 'absolute',
                            inset: 0,
                            zIndex: 0,
                            opacity: 0.4,
                            transition: 'all 1s ease-in-out',
                            filter: 'blur(60px) saturate(1.2)',
                            pointerEvents: 'none'
                        }}>
                            {services.length > 0 && (
                                <img
                                    src={getImageUrl(services[(serviceCarouselIndex + 1) % services.length]?.images?.[0]?.image_url || services[serviceCarouselIndex % services.length]?.images?.[0]?.image_url)}
                                    alt="Background"
                                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                />
                            )}
                            <div style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(255,255,255,0.4)' }} />
                        </div>

                        <div className="w-full mx-auto px-4 sm:px-8 md:px-16" style={{ position: 'relative', zIndex: 1 }}>
                            {/* Taj 2-column section header */}
                            <div className="taj-section-header" style={{ marginBottom: '2.5rem', paddingBottom: '1.5rem' }}>
                                <div className="taj-section-header__left">
                                    <span className="taj-section-header__eyebrow">Premium Services</span>
                                    <h2 className="taj-section-header__title">World-Class<br />Amenities</h2>
                                </div>
                                <div className="taj-section-header__right">
                                    Every service is conceived as a personal gesture of care — from bespoke spa rituals to curated dining experiences. Our team anticipates your needs before you voice them.
                                </div>
                            </div>

                            {services.length > 0 ? (
                                <div
                                    style={{ position: 'relative', marginTop: '2rem', padding: '0 2rem' }}
                                    onMouseEnter={() => setIsServiceHovered(true)}
                                    onMouseLeave={() => setIsServiceHovered(false)}
                                >
                                    {/* Navigation Buttons */}
                                    {services.length > 0 ? (
                                        <>
                                            <button
                                                onClick={prevService}
                                                style={{ position: 'absolute', left: '-1rem', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--gold)', zIndex: 10, padding: '1rem' }}
                                                className="hover:scale-125 transition-transform hidden lg:block"
                                            >
                                                <ChevronLeft size={52} strokeWidth={1} />
                                            </button>
                                            <button
                                                onClick={nextService}
                                                style={{ position: 'absolute', right: '-1rem', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--gold)', zIndex: 10, padding: '1rem' }}
                                                className="hover:scale-125 transition-transform hidden lg:block"
                                            >
                                                <ChevronRight size={52} strokeWidth={1} />
                                            </button>
                                        </>
                                    ) : null}

                                    <div style={{ overflow: 'hidden', padding: '4rem 1.5rem' }}>
                                        <div style={{
                                            display: 'flex',
                                            gap: '2.5rem',
                                            transition: isServiceHovered ? 'none' : 'transform 1.2s cubic-bezier(0.19, 1, 0.22, 1)',
                                            transform: `translateX(calc(-${serviceCarouselIndex} * (100% / ${itemsPerSlide} + 2.5rem / ${itemsPerSlide})))`
                                        }}>
                                            {[...services, ...services, ...services].map((service, idx) => {
                                                const isCenter = itemsPerSlide >= 3 ? idx === (serviceCarouselIndex + 1) : idx === serviceCarouselIndex;
                                                const isActive = (idx >= serviceCarouselIndex && idx < serviceCarouselIndex + itemsPerSlide);

                                                return (
                                                    <div
                                                        key={`${service.id}-${idx}`}
                                                        className="group"
                                                        style={{
                                                            position: 'relative',
                                                            cursor: 'pointer',
                                                            flex: `0 0 calc((100% - ${(itemsPerSlide - 1) * 2.5}rem) / ${itemsPerSlide})`,
                                                            maxWidth: `calc((100% - ${(itemsPerSlide - 1) * 2.5}rem) / ${itemsPerSlide})`,
                                                            transition: 'all 1s cubic-bezier(0.19, 1, 0.22, 1)',
                                                            transform: isCenter ? 'scale(1.15)' : 'scale(1)',
                                                            zIndex: isCenter ? 5 : 1,
                                                            opacity: isActive ? 1 : 0.3,
                                                            filter: isCenter ? 'none' : 'grayscale(15%) brightness(95%)',
                                                            margin: isCenter ? '0 0.5rem' : '0'
                                                        }}
                                                        onClick={() => handleOpenServiceBookingForm(service.id)}
                                                    >
                                                        {/* Tall image — sharp edges */}
                                                        <div style={{
                                                            position: 'relative',
                                                            height: windowWidth < 768 ? '320px' : (isCenter ? '430px' : '380px'),
                                                            overflow: 'hidden',
                                                            background: 'var(--obsidian)',
                                                            boxShadow: isCenter ? '0 30px 60px rgba(0,0,0,0.35)' : '0 10px 30px rgba(0,0,0,0.1)',
                                                            transition: 'all 1s cubic-bezier(0.19, 1, 0.22, 1)'
                                                        }}>
                                                            {service.images && service.images.length > 0 ? (
                                                                <img
                                                                    src={getImageUrl(service.images[0].image_url)}
                                                                    alt={service.name}
                                                                    loading="lazy"
                                                                    decoding="async"
                                                                    style={{ width: '100%', height: '100%', objectFit: 'cover', transition: 'transform 0.9s cubic-bezier(0.23,1,0.32,1)' }}
                                                                    className="group-hover:scale-[1.06]"
                                                                    onError={(e) => { e.target.src = ITEM_PLACEHOLDER; }}
                                                                />
                                                            ) : (
                                                                <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg,rgba(28,28,40,0.95),rgba(10,10,15,1))' }}>
                                                                    <div style={{ color: 'var(--gold)', opacity: 0.35 }}>
                                                                        <ConciergeBell size={40} strokeWidth={1} />
                                                                    </div>
                                                                </div>
                                                            )}
                                                            <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(10,10,15,0.45) 0%, transparent 60%)', pointerEvents: 'none' }} />
                                                        </div>

                                                        {/* White caption plate — Flush edges */}
                                                        <div style={{
                                                            position: 'relative',
                                                            marginTop: '-3rem',
                                                            marginLeft: '0',
                                                            marginRight: '0',
                                                            background: '#ffffff',
                                                            padding: '1.8rem 2rem 2rem',
                                                            boxShadow: isCenter ? '0 15px 45px rgba(10,10,15,0.18)' : '0 8px 32px rgba(10,10,15,0.08)',
                                                            transition: 'all 0.6s cubic-bezier(0.19, 1, 0.22, 1)',
                                                            textAlign: 'left'
                                                        }} className="group-hover:-translate-y-2">
                                                            <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '0.75rem', fontWeight: '600', letterSpacing: '0.22em', textTransform: 'uppercase', color: 'var(--obsidian)', marginBottom: '0.8rem' }}>
                                                                {service.name}
                                                            </h3>
                                                            <div style={{ height: '1px', width: '1.25rem', background: 'var(--gold-warm)', marginBottom: '1rem', opacity: 0.7 }} />
                                                            <div style={{ color: 'var(--gold)', fontSize: '0.62rem', fontWeight: '600', letterSpacing: '0.2em', textTransform: 'uppercase' }}>
                                                                EXPLORE &rsaquo;
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <p className={`text-center py-12 ${theme.textSecondary}`}>No services available at the moment.</p>
                            )}
                        </div>
                    </section>

                    {/* Premium Cuisine Section - Mountain Shadows Style */}
                    <section data-food-section style={{ position: 'relative', backgroundColor: '#faf9f6', paddingTop: '3.5rem', paddingBottom: '6rem', overflow: 'hidden' }}>
                        <div className="w-full mx-auto px-4 sm:px-8 md:px-16">
                            {/* Taj 2-column section header */}
                            <div className="taj-section-header">
                                <div className="taj-section-header__left">
                                    <span className="taj-section-header__eyebrow">Savor the Art</span>
                                    <h2 className="taj-section-header__title">Our Culinary<br />Offerings</h2>
                                </div>
                                <div className="taj-section-header__right" style={{ textAlign: 'right', fontSize: '0.92rem', color: '#6b6b75', lineHeight: '1.8' }}>
                                    From the freshest farm-to-table breakfasts to candlelit multi-course dinners, our chefs craft each dish as an expression of the region's rich culinary heritage and seasonal abundance.
                                </div>
                            </div>

                            {foodItems.length > 0 ? (
                                <>
                                    <div className="flex flex-wrap justify-center gap-3 mb-10">
                                        {categoryNames.map((category) => {
                                            const count = category === 'All'
                                                ? foodItems.length
                                                : (foodItemsByCategory[category]?.length || 0);
                                            return (
                                                <button
                                                    key={category}
                                                    type="button"
                                                    onClick={() => setSelectedFoodCategory(category)}
                                                    className={`px-4 py-2 rounded-full text-sm font-semibold transition-all duration-200 flex items-center gap-2 ${selectedFoodCategory === category
                                                        ? 'bg-[#0f5132] text-white shadow'
                                                        : 'bg-white text-[#0f5132] border border-[#d8c9ac] hover:bg-[#0f5132]/10'
                                                        }`}
                                                >
                                                    <span>{category}</span>
                                                    <span className={`text-xs px-2 py-0.5 rounded-full ${selectedFoodCategory === category
                                                        ? 'bg-white/20 text-white'
                                                        : 'bg-[#0f5132]/10 text-[#0f5132]'
                                                        }`}>
                                                        {count}
                                                    </span>
                                                </button>
                                            );
                                        })}
                                    </div>

                                    {displayedFoodItems.length > 0 ? (
                                        <>
                                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
                                                {displayedFoodItems.slice(0, visibleFoodCount).map((food) => {
                                                    const categoryName = food.category?.name || food.category_name || 'Uncategorized';
                                                    return (
                                                        <div
                                                            key={food.id}
                                                            className={`group relative ${theme.bgCard} rounded-2xl overflow-hidden luxury-shadow transition-all duration-300 transform hover:-translate-y-2 border ${theme.cardBorder || theme.border}`}
                                                        >
                                                            <div className="relative h-44 sm:h-48 overflow-hidden">
                                                                <img
                                                                    src={getImageUrl(food.images?.[0]?.image_url)}
                                                                    alt={food.name}
                                                                    loading="lazy"
                                                                    decoding="async"
                                                                    className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                                                                    onError={(e) => { e.target.src = ITEM_PLACEHOLDER; }}
                                                                />
                                                                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                                                                <div className="absolute top-3 left-3 px-3 py-1 bg-black/40 text-white text-xs font-semibold rounded-full backdrop-blur-sm">
                                                                    {categoryName}
                                                                </div>
                                                                <div className="absolute top-3 right-3">
                                                                    <span className={`px-3 py-1 rounded-full text-xs font-bold shadow-lg ${food.available ? "bg-green-500 text-white" : "bg-red-500 text-white"}`}>
                                                                        {food.available ? "Available" : "Unavailable"}
                                                                    </span>
                                                                </div>
                                                            </div>
                                                            <div className="p-4 sm:p-5 space-y-2">
                                                                <span className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-[#0f5132]/70 bg-[#0f5132]/10 px-3 py-1 rounded-full">
                                                                    {categoryName}
                                                                </span>
                                                                <h4 className={`text-base sm:text-lg font-semibold ${theme.textCardPrimary || theme.textPrimary}`}>
                                                                    {food.name}
                                                                </h4>
                                                                {food.price && (
                                                                    <p className="text-sm sm:text-base text-[#1a7042] font-semibold">
                                                                        {formatCurrency(food.price)}
                                                                    </p>
                                                                )}
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>

                                            {displayedFoodItems.length > visibleFoodCount && (
                                                <div className="mt-8 sm:mt-10 text-center">
                                                    <button
                                                        onClick={() => setVisibleFoodCount(prev => prev + 10)}
                                                        className="inline-flex items-center gap-2 px-8 py-3.5 bg-[#0f5132] hover:bg-[#156d44] text-white text-sm sm:text-base font-bold rounded-full shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-0.5 active:translate-y-0 cursor-pointer"
                                                    >
                                                        <span>View More Dishes ({displayedFoodItems.length - visibleFoodCount} More)</span>
                                                        <ChevronDown className="w-5 h-5 animate-bounce" />
                                                    </button>
                                                </div>
                                            )}
                                        </>
                                    ) : (
                                        <div className="text-center py-10 bg-white/60 border border-[#d8c9ac] rounded-2xl">
                                            <p className="text-[#4f6f62] font-medium">
                                                No dishes available under <span className="font-semibold text-[#0f5132]">{selectedFoodCategory}</span> yet.
                                            </p>
                                        </div>
                                    )}
                                </>
                            ) : (
                                <p className={`text-center py-12 ${theme.textSecondary}`}>No food items available at the moment.</p>
                            )}
                        </div>
                    </section>

                    {/* Premium Gallery Section - Taj Carousel Style */}
                    <section data-gallery-section style={{ position: 'relative', backgroundColor: '#faf9f6', paddingTop: '3.5rem', paddingBottom: '6rem', overflow: 'hidden' }}>
                        {/* Dynamic Background — Blurred focus image */}
                        <div style={{
                            position: 'absolute',
                            inset: 0,
                            zIndex: 0,
                            opacity: 0.4,
                            transition: 'all 1s ease-in-out',
                            filter: 'blur(60px) saturate(1.2)',
                            pointerEvents: 'none'
                        }}>
                            {galleryImages.length > 0 && (
                                <img
                                    src={getImageUrl(galleryImages[galleryIndex % galleryImages.length].image_url)}
                                    alt="Background"
                                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                />
                            )}
                            <div style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(255,255,255,0.4)' }} />
                        </div>

                        <div className="w-full mx-auto px-4 sm:px-8 md:px-16" style={{ position: 'relative', zIndex: 1 }}>
                            {/* Taj 2-column section header */}
                            <div className="taj-section-header">
                                <div className="taj-section-header__left">
                                    <span className="taj-section-header__eyebrow">Captured Moments</span>
                                    <h2 className="taj-section-header__title">Explore the<br />Timeless Beauty</h2>
                                </div>
                                <div className="taj-section-header__right">
                                    Witness the charm of our resort's stunning views and unforgettable experiences — each frame a testament to the serene elegance that defines our forest retreat.
                                </div>
                            </div>

                            {/* Gallery Carousel */}
                            {galleryImages.length > 0 ? (
                                <div
                                    style={{ position: 'relative', marginTop: '2rem', paddingBottom: '2rem' }}
                                    onMouseEnter={() => setIsGalleryHovered(true)}
                                    onMouseLeave={() => setIsGalleryHovered(false)}
                                >
                                    <div style={{ overflow: 'hidden', padding: '4rem 1.5rem' }}>
                                        <div style={{
                                            display: 'flex',
                                            gap: '2.5rem',
                                            transition: isGalleryHovered ? 'none' : 'transform 1.2s cubic-bezier(0.19, 1, 0.22, 1)',
                                            transform: `translateX(calc(-${galleryIndex} * (100% / ${itemsPerSlide} + 2.5rem / ${itemsPerSlide})))`
                                        }}>
                                            {[...galleryImages, ...galleryImages, ...galleryImages].map((image, idx) => {
                                                const isCenter = itemsPerSlide >= 3 ? idx === (galleryIndex + 1) : idx === galleryIndex;
                                                const isActive = (idx >= galleryIndex && idx < galleryIndex + itemsPerSlide);
                                                return (
                                                    <div
                                                        key={`${image.id}-${idx}`}
                                                        className="group"
                                                        style={{
                                                            position: 'relative',
                                                            cursor: 'pointer',
                                                            flex: `0 0 calc((100% - ${(itemsPerSlide - 1) * 2.5}rem) / ${itemsPerSlide})`,
                                                            maxWidth: `calc((100% - ${(itemsPerSlide - 1) * 2.5}rem) / ${itemsPerSlide})`,
                                                            transition: 'all 1s cubic-bezier(0.19, 1, 0.22, 1)',
                                                            transform: isCenter ? 'scale(1.15)' : 'scale(1)',
                                                            zIndex: isCenter ? 5 : 1,
                                                            opacity: isActive ? 1 : 0.3,
                                                            filter: isCenter ? 'none' : 'grayscale(15%) brightness(95%)',
                                                            background: '#ffffff',
                                                            boxShadow: isCenter ? '0 15px 45px rgba(10,10,15,0.18)' : '0 8px 32px rgba(10,10,15,0.08)',
                                                            overflow: 'hidden'
                                                        }}
                                                    >
                                                        {/* Image Area */}
                                                        <div style={{ position: 'relative', height: windowWidth < 768 ? '300px' : '380px', overflow: 'hidden', background: '#f5f5f5' }}>
                                                            <img
                                                                src={getImageUrl(image.image_url)}
                                                                alt={image.caption || 'Gallery Image'}
                                                                loading="lazy"
                                                                decoding="async"
                                                                style={{ width: '100%', height: '100%', objectFit: 'cover', transition: 'transform 0.8s' }}
                                                                className="group-hover:scale-110"
                                                                onError={(e) => { e.target.src = ITEM_PLACEHOLDER; }}
                                                            />
                                                        </div>
                                                        {/* Content Area */}
                                                        <div style={{ padding: '1.8rem 1.5rem 2rem', textAlign: 'center' }}>
                                                            <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '0.7rem', fontWeight: '600', letterSpacing: '0.22em', textTransform: 'uppercase', color: 'var(--obsidian)', marginBottom: '0.8rem' }}>
                                                                {image.caption ? (image.caption.split(' ')[0] || 'Experience') : 'Experience'}
                                                            </h3>
                                                            <div style={{ height: '1px', width: '1.25rem', background: 'var(--gold-warm)', margin: '0 auto 1rem', opacity: 0.7 }} />
                                                            <div style={{ color: 'var(--gold)', fontSize: '0.62rem', fontWeight: '600', letterSpacing: '0.2em', textTransform: 'uppercase' }}>
                                                                EXPLORE &rsaquo;
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                    {/* Navigation Arrows */}
                                    <button
                                        onClick={prevGallery}
                                        style={{ position: 'absolute', left: '40px', top: '200px', width: '48px', height: '48px', borderRadius: '50%', border: '1px solid rgba(10,10,15,0.1)', background: '#ffffff', color: 'var(--obsidian)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', zIndex: 10, transition: 'all 0.3s' }}
                                        className="hover:bg-gold-warm hover:text-white"
                                    >
                                        &lsaquo;
                                    </button>
                                    <button
                                        onClick={nextGallery}
                                        style={{ position: 'absolute', right: '40px', top: '200px', width: '48px', height: '48px', borderRadius: '50%', border: '1px solid rgba(10,10,15,0.1)', background: '#ffffff', color: 'var(--obsidian)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', zIndex: 10, transition: 'all 0.3s' }}
                                        className="hover:bg-gold-warm hover:text-white"
                                    >
                                        &rsaquo;
                                    </button>
                                </div>
                            ) : (
                                <p style={{ textAlign: 'center', padding: '4rem 0', fontFamily: 'var(--font-body)', fontSize: '0.78rem', color: '#9a9a9a' }}>No gallery images available at the moment.</p>
                            )}
                        </div>
                    </section>

                    {/* Nearby Attractions Feature Banner */}
                    {
                        totalNearbyAttractionBanners > 0 ? (
                            <section className="relative w-full h-[520px] md:h-[620px] overflow-hidden rounded-3xl mt-20 mb-10 bg-[#0f5132]/5">
                                {activeNearbyAttractionBanners.map((banner, index) => (
                                    <div key={banner.id} className="absolute inset-0">
                                        <img
                                            src={getImageUrl(banner.image_url)}
                                            alt={banner.title}
                                            className={`absolute inset-0 w-full h-full object-cover transition-all duration-[9000ms] ease-in-out ${index === currentAttractionBannerIndex ? 'opacity-100 scale-100' : 'opacity-0 scale-110'}`}
                                            style={{
                                                animationDelay: `${index * 2}s`,
                                                animationDirection: index % 2 === 0 ? 'alternate' : 'alternate-reverse'
                                            }}
                                            onError={(e) => { e.target.src = ITEM_PLACEHOLDER; }}
                                        />
                                        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/60 to-black/20" />
                                    </div>
                                ))}
                                <div className="relative z-10 h-full flex items-center justify-center px-4 sm:px-6 lg:px-8 text-center text-white">
                                    <div className="max-w-4xl mx-auto space-y-6">
                                        <div className="inline-flex items-center gap-2 px-6 py-2 bg-white/15 backdrop-blur-sm rounded-full border border-white/30 uppercase tracking-[0.35em] text-xs font-semibold">
                                            ✦ Nearby Attractions ✦
                                        </div>
                                        <h2 className="text-3xl md:text-5xl font-extrabold leading-tight drop-shadow-xl">
                                            {activeNearbyAttractionBanners[currentAttractionBannerIndex]?.title || 'Explore the Destination'}
                                        </h2>
                                        <p className="text-base md:text-xl text-white/85 leading-relaxed drop-shadow-lg">
                                            {activeNearbyAttractionBanners[currentAttractionBannerIndex]?.subtitle || 'Discover the most captivating sights surrounding our resort.'}
                                        </p>
                                    </div>
                                </div>
                                {totalNearbyAttractionBanners > 1 ? (
                                    <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-2 z-20">
                                        {activeNearbyAttractionBanners.map((_, index) => (
                                            <button
                                                key={index}
                                                onClick={() => setCurrentAttractionBannerIndex(index)}
                                                className={`transition-all duration-300 ${index === currentAttractionBannerIndex
                                                    ? "w-12 h-1 bg-[#d8b471] rounded-full shadow-[0_0_12px_rgba(216,180,113,0.6)]"
                                                    : "w-8 h-1 bg-white/40 hover:bg-white/70 rounded-full"
                                                    }`}
                                                aria-label={`Show attraction ${index + 1}`}
                                            />
                                        ))}
                                    </div>
                                ) : null}
                            </section>
                        ) : null
                    }

                    {/* Nearby Attractions Section - Taj Carousel Style */}
                    {
                        nearbyAttractions.length > 0 && nearbyAttractions.some(a => a.is_active) && (
                            <section style={{ position: 'relative', backgroundColor: '#faf9f6', paddingTop: '3.5rem', paddingBottom: '7rem', overflow: 'hidden' }}>
                                {/* Dynamic Background — Blurred focus image */}
                                <div style={{
                                    position: 'absolute',
                                    inset: 0,
                                    zIndex: 0,
                                    opacity: 0.4,
                                    transition: 'all 1s ease-in-out',
                                    filter: 'blur(60px) saturate(1.2)',
                                    pointerEvents: 'none'
                                }}>
                                    {(() => {
                                        const activeAttractions = nearbyAttractions.filter(a => a.is_active);
                                        if (activeAttractions.length === 0) return null;
                                        const targetIndex = (attractionCarouselIndex + 1) % activeAttractions.length;
                                        const fallbackIndex = attractionCarouselIndex % activeAttractions.length;
                                        return (
                                            <img
                                                src={getImageUrl(activeAttractions[targetIndex]?.image_url || activeAttractions[fallbackIndex]?.image_url)}
                                                alt="Background"
                                                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                            />
                                        );
                                    })()}
                                    <div style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(255,255,255,0.4)' }} />
                                </div>

                                <div className="w-full mx-auto px-4 sm:px-8 md:px-16" style={{ position: 'relative', zIndex: 1 }}>
                                    {/* Taj 2-column section header */}
                                    <div className="taj-section-header">
                                        <div className="taj-section-header__left">
                                            <span className="taj-section-header__eyebrow">Local Discovery</span>
                                            <h2 className="taj-section-header__title">Nearby<br />Attractions</h2>
                                        </div>
                                        <div className="taj-section-header__right">
                                            Embark on a voyage of discovery through the cultural tapestry and natural wonders that envelop our retreat. From ancient temples to hidden waterfalls, the soul of the region awaits.
                                        </div>
                                    </div>

                                    <div
                                        style={{ position: 'relative', marginTop: '2.5rem', padding: '0 2rem' }}
                                        onMouseEnter={() => setIsAttractionHovered(true)}
                                        onMouseLeave={() => setIsAttractionHovered(false)}
                                    >
                                        {/* Navigation Buttons */}
                                        {nearbyAttractions.filter(a => a.is_active).length > 3 && (
                                            <>
                                                <button
                                                    onClick={prevAttraction}
                                                    style={{ position: 'absolute', left: '-1rem', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--gold)', zIndex: 10, padding: '1rem' }}
                                                    className="hover:scale-125 transition-transform hidden lg:block"
                                                >
                                                    <ChevronLeft size={52} strokeWidth={1} />
                                                </button>
                                                <button
                                                    onClick={nextAttraction}
                                                    style={{ position: 'absolute', right: '-1rem', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--gold)', zIndex: 10, padding: '1rem' }}
                                                    className="hover:scale-125 transition-transform hidden lg:block"
                                                >
                                                    <ChevronRight size={52} strokeWidth={1} />
                                                </button>
                                            </>
                                        )}

                                        <div style={{ overflow: 'hidden', padding: '4rem 1.5rem' }}>
                                            <div style={{
                                                display: 'flex',
                                                gap: '2.5rem',
                                                transition: isAttractionHovered ? 'none' : 'transform 1.2s cubic-bezier(0.19, 1, 0.22, 1)',
                                                transform: `translateX(calc(-${attractionCarouselIndex} * (100% / ${itemsPerSlide} + 2.5rem / ${itemsPerSlide})))`
                                            }}>
                                                {[...nearbyAttractions.filter(a => a.is_active), ...nearbyAttractions.filter(a => a.is_active), ...nearbyAttractions.filter(a => a.is_active)].map((attraction, index) => {
                                                    const counts = nearbyAttractions.filter(a => a.is_active).length;
                                                    const isCenter = itemsPerSlide >= 3 ? index === (attractionCarouselIndex + 1) : index === attractionCarouselIndex;
                                                    const isActive = (index >= attractionCarouselIndex && index < attractionCarouselIndex + itemsPerSlide);

                                                    return (
                                                        <div
                                                            key={`${attraction.id}-${index}`}
                                                            className="group"
                                                            style={{
                                                                position: 'relative',
                                                                cursor: 'pointer',
                                                                flex: `0 0 calc((100% - ${(itemsPerSlide - 1) * 2.5}rem) / ${itemsPerSlide})`,
                                                                maxWidth: `calc((100% - ${(itemsPerSlide - 1) * 2.5}rem) / ${itemsPerSlide})`,
                                                                transition: 'all 1s cubic-bezier(0.19, 1, 0.22, 1)',
                                                                transform: isCenter ? 'scale(1.15)' : 'scale(1)',
                                                                zIndex: isCenter ? 5 : 1,
                                                                opacity: isActive ? 1 : 0.3,
                                                                filter: isCenter ? 'none' : 'grayscale(15%) brightness(95%)',
                                                                margin: isCenter ? '0 0.5rem' : '0'
                                                            }}
                                                            onClick={() => attraction.map_link && window.open(formatUrl(attraction.map_link), '_blank')}
                                                        >
                                                            {/* Image container */}
                                                            <div style={{
                                                                position: 'relative',
                                                                height: windowWidth < 768 ? '350px' : '480px',
                                                                overflow: 'hidden',
                                                                background: '#ffffff',
                                                                boxShadow: isCenter ? '0 30px 60px rgba(10,10,15,0.35)' : '0 10px 30px rgba(0,0,0,0.1)',
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                justifyContent: 'center'
                                                            }}>
                                                                {(() => {
                                                                    let images = [attraction.image_url];
                                                                    if (attraction.extra_images) {
                                                                        try {
                                                                            const extra = JSON.parse(attraction.extra_images);
                                                                            images = [...images, ...(Array.isArray(extra) ? extra : [])];
                                                                        } catch (e) {
                                                                            console.error("Error parsing extra_images for attraction:", e);
                                                                        }
                                                                    }
                                                                    const currentImgIdx = attractionImageIndex[attraction.id] || 0;
                                                                    const currentImg = images[currentImgIdx % images.length];

                                                                    return (
                                                                        <>
                                                                            <img
                                                                                src={getImageUrl(currentImg)}
                                                                                alt={attraction.title}
                                                                                style={{ width: '100%', height: '100%', objectFit: 'cover', transition: 'transform 1s cubic-bezier(0.19, 1, 0.22, 1)' }}
                                                                                className="group-hover:scale-[1.08]"
                                                                                onError={(e) => { e.target.src = ITEM_PLACEHOLDER; }}
                                                                            />
                                                                            {images.length > 1 && (
                                                                                <>
                                                                                    <div className="absolute inset-0 flex items-center justify-between px-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                                                                                        <button
                                                                                            onClick={(e) => {
                                                                                                e.stopPropagation();
                                                                                                setAttractionImageIndex(prev => ({ ...prev, [attraction.id]: (currentImgIdx - 1 + images.length) % images.length }));
                                                                                            }}
                                                                                            className="p-1.5 rounded-full bg-black/20 text-white hover:bg-black/50 backdrop-blur-sm transition-all"
                                                                                        >
                                                                                            <ChevronLeft size={16} />
                                                                                        </button>
                                                                                        <button
                                                                                            onClick={(e) => {
                                                                                                e.stopPropagation();
                                                                                                setAttractionImageIndex(prev => ({ ...prev, [attraction.id]: (currentImgIdx + 1) % images.length }));
                                                                                            }}
                                                                                            className="p-1.5 rounded-full bg-black/20 text-white hover:bg-black/50 backdrop-blur-sm transition-all"
                                                                                        >
                                                                                            <ChevronRight size={16} />
                                                                                        </button>
                                                                                    </div>
                                                                                    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-1 z-20">
                                                                                        {images.map((_, i) => (
                                                                                            <div
                                                                                                key={i}
                                                                                                className={`transition-all duration-300 rounded-full ${i === currentImgIdx ? 'w-3 h-1 bg-[#d8b471]' : 'w-1 h-1 bg-white/40'}`}
                                                                                            />
                                                                                        ))}
                                                                                    </div>
                                                                                </>
                                                                            )}
                                                                        </>
                                                                    );
                                                                })()}
                                                                <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(10,10,15,0.4) 0%, transparent 60%)', pointerEvents: 'none' }} />
                                                            </div>

                                                            {/* Protruding Caption Plate */}
                                                            <div style={{
                                                                position: 'relative',
                                                                marginTop: '-3rem',
                                                                marginLeft: '0',
                                                                marginRight: '0',
                                                                background: '#ffffff',
                                                                padding: '1.8rem 2rem 2rem',
                                                                boxShadow: isCenter ? '0 15px 45px rgba(10,10,15,0.15)' : '0 8px 32px rgba(10,10,15,0.08)',
                                                                transition: 'all 0.6s cubic-bezier(0.19, 1, 0.22, 1)',
                                                                textAlign: 'center'
                                                            }}>
                                                                <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '0.9rem', fontWeight: '500', letterSpacing: '0.15em', textTransform: 'uppercase', color: 'var(--obsidian)', marginBottom: '0.8rem' }}>
                                                                    {attraction.title}
                                                                </h3>
                                                                {isCenter && (
                                                                    <div style={{ height: '1px', width: '40px', background: 'var(--gold)', margin: '0 auto 1.2rem', opacity: 0.6 }} />
                                                                )}
                                                                <div style={{ color: 'var(--gold)', fontSize: '0.65rem', fontWeight: '600', letterSpacing: '0.2em', textTransform: 'uppercase', marginTop: '0.8rem' }}>
                                                                    {attraction.map_link ? 'EXPLORE ON MAP >' : 'MORE >'}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </section>
                        )
                    }


                    {/* Testimonials Section - Taj Style */}
                    <section data-reviews-section style={{ backgroundColor: '#faf7f0', paddingTop: '5.5rem', paddingBottom: '7rem' }}>
                        <div className="w-full mx-auto px-4 sm:px-8 md:px-16">
                            {/* Taj 2-column section header */}
                            <div className="taj-section-header">
                                <div className="taj-section-header__left">
                                    <span className="taj-section-header__eyebrow">Guest Verbatim</span>
                                    <h2 className="taj-section-header__title">What Our<br />Guests Say</h2>
                                </div>
                                <div className="taj-section-header__right">
                                    Every séjour is a story of personal connection and refined hospitality. Discover the experiences that linger in the memories of our most discerning travelers.
                                </div>
                            </div>

                            <div className="w-full overflow-hidden mt-12">
                                <div className="flex gap-8 animate-[auto-scroll-bobbing-reverse_90s_linear_infinite] hover:[animation-play-state:paused]">
                                    {reviews.length > 0 ? [...reviews, ...reviews].map((review, index) => (
                                        <div
                                            key={`${review.id}-${index}`}
                                            style={{
                                                flex: windowWidth < 480 ? '0 0 85vw' : '0 0 400px',
                                                background: '#ffffff',
                                                padding: windowWidth < 480 ? '1.5rem' : '2.5rem',
                                                boxShadow: '0 12px 32px rgba(10,10,15,0.06)',
                                                borderTop: '3px solid var(--gold-warm)'
                                            }}
                                        >
                                            <div style={{ display: 'flex', gap: '0.2rem', marginBottom: '1.25rem' }}>
                                                {[...Array(5)].map((_, i) => (
                                                    <Star
                                                        key={i}
                                                        className={`w-3 h-3 ${i < review.rating ? 'fill-[var(--gold)] text-[var(--gold)]' : 'text-[#e5e5e5]'}`}
                                                    />
                                                ))}
                                            </div>
                                            <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.92rem', color: 'var(--obsidian)', fontStyle: 'italic', lineHeight: '1.8', marginBottom: '1.5rem' }}>
                                                {`"${review.comment}"`}
                                            </p>
                                            <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.65rem', fontWeight: '600', letterSpacing: '0.15em', textTransform: 'uppercase', color: '#9a9a9a' }}>
                                                — {review.guest_name}
                                            </p>
                                        </div>
                                    )) : (
                                        <p style={{ textAlign: 'center', width: '100%', fontFamily: 'var(--font-body)', fontSize: '0.78rem', color: '#9a9a9a' }}>
                                            No reviews available.
                                        </p>
                                    )}
                                </div>
                            </div>
                        </div>
                    </section>

                </main>

                {/* Floating UI Elements */}
                <button
                    onClick={scrollToTop}
                    className={`fixed bottom-24 right-4 sm:bottom-16 sm:right-8 p-3 rounded-full ${theme.buttonBg} ${theme.buttonText} shadow-lg transition-all duration-300 z-[100] ${showBackToTop ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'} back-to-top-btn`}
                    aria-label="Back to Top"
                >
                    <ChevronUp className="w-6 h-6" />
                </button>

                <button onClick={toggleChat} className={`fixed bottom-24 left-4 sm:bottom-16 sm:left-8 p-4 rounded-full ${theme.buttonBg} ${theme.buttonText} shadow-lg transition-all duration-300 z-50 ${theme.buttonHover} chat-fab`} aria-label="Open Chat">
                    <MessageSquare className="w-6 h-6" />
                </button>

                {/* AI Concierge Chat Modal */}
                {
                    isChatOpen && (
                        <div className="fixed inset-0 z-[100] bg-neutral-950/80 backdrop-blur-sm flex items-end justify-center">
                            <div className={`w-full max-w-lg h-3/4 md:h-4/5 ${theme.chatBg} rounded-t-3xl shadow-2xl flex flex-col`}>
                                <div className={`${theme.chatHeaderBg} p-4 rounded-t-3xl flex items-center justify-between border-b ${theme.chatInputBorder}`}>
                                    <h3 className="text-lg font-bold flex items-center"><MessageSquare className={`w-5 h-5 mr-2 ${theme.textAccent}`} /> AI Concierge</h3>
                                    <button onClick={toggleChat} className={`p-1 rounded-full ${theme.textSecondary} hover:${theme.textPrimary} transition-colors`}><X className="w-6 h-6" /></button>
                                </div>
                                <div ref={chatMessagesRef} className="flex-1 p-4 overflow-y-auto space-y-4">
                                    {chatHistory.map((msg, index) => (
                                        <div key={index} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                            <div className={`p-3 rounded-xl max-w-xs md:max-w-md shadow-lg ${msg.role === 'user' ? `${theme.chatUserBg} ${theme.chatUserText} rounded-br-none` : `${theme.chatModelBg} ${theme.chatModelText} rounded-bl-none`}`}>
                                                <p className="text-sm break-words">{msg.parts[0].text}</p>
                                            </div>
                                        </div>
                                    ))}
                                    {isChatLoading && (
                                        <div className="flex justify-start">
                                            <div className={`p-3 rounded-xl ${theme.chatModelBg} shadow-lg`}>
                                                <div className="flex items-center space-x-2 animate-bounce-dot">
                                                    <div className={`w-2 h-2 ${theme.chatLoaderBg} rounded-full`} style={{ animationDelay: '0s' }}></div>
                                                    <div className={`w-2 h-2 ${theme.chatLoaderBg} rounded-full`} style={{ animationDelay: '0.2s' }}></div>
                                                    <div className={`w-2 h-2 ${theme.chatLoaderBg} rounded-full`} style={{ animationDelay: '0.4s' }}></div>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                                <form onSubmit={handleSendMessage} className={`p-4 border-t ${theme.chatInputBorder} ${theme.chatHeaderBg} flex items-center`}>
                                    <input type="text" value={userMessage} onChange={(e) => setUserMessage(e.target.value)} placeholder="Ask me anything..."
                                        className={`flex-1 p-3 rounded-full ${theme.chatInputBg} ${theme.textPrimary} ${theme.chatInputPlaceholder} focus:outline-none focus:ring-2 focus:ring-amber-500`} />
                                    <button type="submit" className={`ml-2 p-3 rounded-full ${theme.buttonBg} ${theme.buttonText} ${theme.buttonHover} transition-colors disabled:opacity-50`} disabled={!userMessage.trim() || isChatLoading}>
                                        <Send className="w-5 h-5" />
                                    </button>
                                </form>
                            </div>
                        </div>
                    )
                }

                {/* General Booking Modal - Date Selection First */}
                {
                    isGeneralBookingOpen && (
                        <div className="fixed inset-0 z-[100] bg-neutral-950/80 backdrop-blur-sm flex items-center justify-center p-4">
                            <div className={`w-full max-w-md ${theme.bgCard} rounded-3xl shadow-2xl flex flex-col`}>
                                <div className={`p-6 flex items-center justify-between border-b ${theme.border}`}>
                                    <h3 className="text-lg font-bold flex items-center"><BedDouble className={`w-5 h-5 mr-2 ${theme.textAccent}`} /> Select Your Dates</h3>
                                    <button onClick={() => { setIsGeneralBookingOpen(false); setShowAmenities(false); }} className={`p-1 rounded-full ${theme.textSecondary} hover:${theme.textPrimary} transition-colors`}><X className="w-6 h-6" /></button>
                                </div>
                                <div className="p-6 space-y-4">
                                    <p className={`${theme.textSecondary} text-center mb-4`}>Select your check-in and check-out dates to view available rooms</p>
                                    <div className="flex space-x-4">
                                        <div className="space-y-2 w-1/2">
                                            <label className={`block text-sm font-medium ${theme.textSecondary}`}>Check-in Date</label>
                                            <input
                                                type="date"
                                                name="check_in"
                                                value={bookingData.check_in}
                                                onChange={handleRoomBookingChange}
                                                min={new Date().toISOString().split('T')[0]}
                                                required
                                                className={`w-full p-3 rounded-xl ${theme.bgSecondary} ${theme.textPrimary} border ${theme.border} focus:outline-none focus:ring-2 focus:ring-[#0f5132] transition-colors`}
                                            />
                                        </div>
                                        <div className="space-y-2 w-1/2">
                                            <label className={`block text-sm font-medium ${theme.textSecondary}`}>Check-out Date</label>
                                            <input
                                                type="date"
                                                name="check_out"
                                                value={bookingData.check_out}
                                                onChange={handleRoomBookingChange}
                                                min={bookingData.check_in || new Date().toISOString().split('T')[0]}
                                                required
                                                className={`w-full p-3 rounded-xl ${theme.bgSecondary} ${theme.textPrimary} border ${theme.border} focus:outline-none focus:ring-2 focus:ring-[#0f5132] transition-colors`}
                                            />
                                        </div>
                                    </div>
                                    {bookingData.check_in && bookingData.check_out && (
                                        <div className="pt-4 space-y-3 border-top border-gray-200 dark:border-neutral-700">
                                            <p className={`text-sm ${theme.textSecondary} text-center`}>Continue with booking:</p>
                                            <button
                                                onClick={() => { setIsGeneralBookingOpen(false); setShowAmenities(false); setIsRoomBookingFormOpen(true); }}
                                                className={`w-full py-3 rounded-full ${theme.buttonBg} ${theme.buttonText} font-bold shadow-lg ${theme.buttonHover} transition-colors flex items-center justify-center space-x-2`}
                                            >
                                                <BedDouble className="w-5 h-5" />
                                                <span>Book a Room</span>
                                            </button>
                                            <button
                                                onClick={() => {
                                                    setIsGeneralBookingOpen(false);
                                                    setShowAmenities(false);
                                                    setPackageBookingData(prev => ({
                                                        ...prev,
                                                        check_in: bookingData.check_in || prev.check_in || '',
                                                        check_out: bookingData.check_out || prev.check_out || ''
                                                    }));
                                                    setIsPackageSelectionOpen(true);
                                                }}
                                                className={`w-full py-3 rounded-full ${theme.buttonBg} ${theme.buttonText} font-bold shadow-lg ${theme.buttonHover} transition-colors flex items-center justify-center space-x-2`}
                                            >
                                                <Package className="w-5 h-5" />
                                                <span>Book a Package</span>
                                            </button>
                                            <button
                                                onClick={() => setShowAmenities(prev => !prev)}
                                                className="w-full py-3 rounded-full bg-white text-[#0f5132] font-bold shadow-lg hover:shadow-xl transition-colors flex items-center justify-center space-x-2 border border-[#d8c9ac]"
                                            >
                                                <Droplet className="w-5 h-5 text-[#0f5132]" />
                                                <span>{showAmenities ? "Hide Amenities" : "View Amenities"}</span>
                                            </button>
                                        </div>
                                    )}
                                    {showAmenities && (
                                        <div className="mt-4 space-y-3 border-t border-gray-200 dark:border-neutral-700 pt-4">
                                            <h4 className="text-sm font-semibold text-center text-[#0f5132] uppercase tracking-widest">
                                                Resort Amenities
                                            </h4>
                                            {services && services.length > 0 ? (
                                                <div className="max-h-48 overflow-y-auto grid grid-cols-1 sm:grid-cols-2 gap-3">
                                                    {services.map((service) => (
                                                        <div
                                                            key={service.id}
                                                            className="flex items-start space-x-3 rounded-2xl bg-white/80 border border-[#d8c9ac] px-4 py-3 shadow-sm"
                                                        >
                                                            <div className="flex-shrink-0 mt-1 text-[#0f5132]">
                                                                <ConciergeBell className="w-5 h-5" />
                                                            </div>
                                                            <div>
                                                                <p className="text-sm font-semibold text-[#0f5132]">{service.name}</p>
                                                                {service.description && (
                                                                    <p className="text-xs text-[#4f6f62] mt-1 line-clamp-2">
                                                                        {service.description}
                                                                    </p>
                                                                )}
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            ) : (
                                                <p className="text-center text-sm text-[#4f6f62] bg-white/70 rounded-2xl px-4 py-6 border border-dashed border-[#d8c9ac]">
                                                    Amenities information will be available soon. Please contact concierge for more details.
                                                </p>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )
                }

                {/* User or Partner Choice Modal */}
                {
                    isUserPartnerModalOpen && (
                        <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto" onClick={() => setIsUserPartnerModalOpen(false)}>
                            <div 
                                className="w-full max-w-3xl rounded-3xl p-6 sm:p-8 md:p-10 border shadow-2xl relative transition-all my-8"
                                style={{
                                    background: 'linear-gradient(145deg, #111119 0%, #1a1a2e 50%, #14141f 100%)',
                                    borderColor: 'rgba(200, 151, 30, 0.35)',
                                    boxShadow: '0 25px 60px -15px rgba(0,0,0,0.9), 0 0 40px rgba(200,151,30,0.15)'
                                }}
                                onClick={e => e.stopPropagation()}
                            >
                                {/* Close Button */}
                                <button 
                                    onClick={() => setIsUserPartnerModalOpen(false)}
                                    className="absolute top-5 right-5 p-2 rounded-full text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
                                    aria-label="Close dialog"
                                >
                                    <X className="w-6 h-6" />
                                </button>

                                {/* Header */}
                                <div className="text-center mb-8 pr-6 pl-6">
                                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-amber-400/30 bg-amber-500/10 text-amber-300 text-[10px] font-bold uppercase tracking-[0.25em] mb-3">
                                        <Sparkles className="w-3 h-3 text-amber-400" />
                                        Welcome to StayOne
                                    </div>
                                    <h3 className="text-2xl sm:text-3xl font-display text-white font-bold tracking-wide">
                                        Choose How You Experience <span className="text-transparent bg-clip-text" style={{ backgroundImage: 'linear-gradient(135deg, #f5d485, #c8971e)' }}>StayOne</span>
                                    </h3>
                                    <p className="text-gray-400 text-sm mt-2 max-w-md mx-auto font-serif italic">
                                        Select your journey below to get instant access to luxury stays or partner tools.
                                    </p>
                                </div>

                                {/* Two Choices Cards */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    {/* 1. Guest / User Option */}
                                    <div className="rounded-2xl p-6 border flex flex-col justify-between transition-all duration-300 hover:border-amber-400/50 hover:bg-white/[0.04]"
                                        style={{ background: 'rgba(255,255,255,0.03)', borderColor: 'rgba(255,255,255,0.12)' }}>
                                        <div>
                                            <div className="flex items-center justify-between mb-4">
                                                <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ background: 'rgba(200,151,30,0.15)', border: '1px solid rgba(200,151,30,0.3)' }}>
                                                    <User className="w-6 h-6 text-amber-400" />
                                                </div>
                                                <span className="text-[10px] font-bold uppercase tracking-widest px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                                                    Guest & Member
                                                </span>
                                            </div>
                                            <h4 className="text-lg font-bold text-white mb-2">I am a Guest / Traveler</h4>
                                            <p className="text-gray-400 text-xs leading-relaxed mb-4">
                                                Book luxury villas and rooms, order in-room dining, access digital concierge, and enjoy curated experiences.
                                            </p>
                                            <ul className="space-y-2 mb-6 text-xs text-gray-300">
                                                <li className="flex items-center gap-2">
                                                    <Check className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
                                                    Instant best-rate room reservations
                                                </li>
                                                <li className="flex items-center gap-2">
                                                    <Check className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
                                                    QR dining & room service orders
                                                </li>
                                                <li className="flex items-center gap-2">
                                                    <Check className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
                                                    Exclusive seasonal packages & deals
                                                </li>
                                            </ul>
                                        </div>

                                        <div className="space-y-2 pt-2 border-t border-white/10">
                                            <button
                                                onClick={() => {
                                                    setIsUserPartnerModalOpen(false);
                                                    setShowAmenities(false);
                                                    setIsGeneralBookingOpen(true);
                                                }}
                                                className="w-full py-2.5 px-4 rounded-xl text-xs font-bold uppercase tracking-wider text-black transition-all flex items-center justify-center gap-2 shadow-md hover:brightness-110 cursor-pointer"
                                                style={{ background: 'linear-gradient(135deg, #c8971e, #f5d485)' }}
                                            >
                                                <BedDouble className="w-4 h-4" />
                                                Book a Room Now
                                            </button>
                                            <button
                                                onClick={() => {
                                                    setIsUserPartnerModalOpen(false);
                                                    const el = document.getElementById('properties');
                                                    if (el) el.scrollIntoView({ behavior: 'smooth' });
                                                }}
                                                className="w-full py-2 px-4 rounded-xl text-xs font-semibold text-gray-300 hover:text-white border border-white/15 hover:border-amber-400/40 bg-white/5 transition-all text-center cursor-pointer"
                                            >
                                                Explore Destinations
                                            </button>
                                        </div>
                                    </div>

                                    {/* 2. Partner / Hotel Owner Option */}
                                    <div className="rounded-2xl p-6 border flex flex-col justify-between transition-all duration-300 hover:border-amber-400/60 hover:bg-amber-500/[0.06]"
                                        style={{ background: 'rgba(200,151,30,0.06)', borderColor: 'rgba(200,151,30,0.3)' }}>
                                        <div>
                                            <div className="flex items-center justify-between mb-4">
                                                <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ background: 'rgba(200,151,30,0.25)', border: '1px solid rgba(200,151,30,0.4)' }}>
                                                    <Building className="w-6 h-6 text-amber-300" />
                                                </div>
                                                <span className="text-[10px] font-bold uppercase tracking-widest px-2.5 py-0.5 rounded-full bg-amber-400/20 text-amber-300 border border-amber-400/30">
                                                    Resort & Hotel Partner
                                                </span>
                                            </div>
                                            <h4 className="text-lg font-bold text-white mb-2">I am a Hotel / Resort Owner</h4>
                                            <p className="text-gray-400 text-xs leading-relaxed mb-4">
                                                Run your property with StayOne's enterprise PMS, Aiosell Channel Manager, dynamic rates, and multi-branch control.
                                            </p>
                                            <ul className="space-y-2 mb-6 text-xs text-gray-300">
                                                <li className="flex items-center gap-2">
                                                    <Check className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
                                                    Aiosell OTA 2-way sync & inventory
                                                </li>
                                                <li className="flex items-center gap-2">
                                                    <Check className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
                                                    Day-1 automated monthly billing (₹2,500/mo)
                                                </li>
                                                <li className="flex items-center gap-2">
                                                    <Check className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
                                                    Staff & Owner Android/iOS mobile apps
                                                </li>
                                            </ul>
                                        </div>

                                        <div className="space-y-2 pt-2 border-t border-amber-500/20">
                                            <a
                                                href={getAdminRegisterUrl()}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="w-full py-2.5 px-4 rounded-xl text-xs font-bold uppercase tracking-wider text-white transition-all flex items-center justify-center gap-2 shadow-md hover:brightness-115 text-center"
                                                style={{ background: 'linear-gradient(135deg, #7a5518, #c8971e)' }}
                                            >
                                                <Building className="w-4 h-4" />
                                                Register Property (Partner)
                                            </a>
                                            <a
                                                href={getAdminLoginUrl()}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="w-full py-2 px-4 rounded-xl text-xs font-semibold text-amber-300 hover:text-white border border-amber-500/30 hover:border-amber-400 bg-amber-500/10 transition-all text-center block"
                                            >
                                                Owner / Staff Login &rarr;
                                            </a>
                                        </div>
                                    </div>
                                </div>

                                {/* Bottom info footer */}
                                <div className="mt-6 pt-4 border-t border-white/10 text-center text-xs text-gray-400 flex flex-wrap items-center justify-center gap-4">
                                    <span>⚡ Instant activation upon admin approval</span>
                                    <span>•</span>
                                    <span>🔒 Secure cloud hosted on StayOne</span>
                                    <span>•</span>
                                    <a 
                                        href="#partner" 
                                        onClick={() => { 
                                            setIsUserPartnerModalOpen(false); 
                                            const el = document.getElementById('partner'); 
                                            if (el) el.scrollIntoView({ behavior: 'smooth' }); 
                                        }} 
                                        className="text-amber-400 hover:underline cursor-pointer"
                                    >
                                        Learn more about partnership
                                    </a>
                                </div>
                            </div>
                        </div>
                    )
                }

                {/* Room Booking Modal */}
                {
                    isRoomBookingFormOpen && (
                        <div className="fixed inset-0 z-[100] bg-neutral-950/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
                            <div className={`w-full max-w-lg ${theme.bgCard} rounded-3xl shadow-2xl flex flex-col max-h-[90vh] my-8`}>
                                <div className={`p-6 flex items-center justify-between border-b ${theme.border}`}>
                                    <h3 className="text-lg font-bold flex items-center"><BedDouble className={`w-5 h-5 mr-2 ${theme.textAccent}`} /> Book a Room</h3>
                                    <button onClick={() => setIsRoomBookingFormOpen(false)} className={`p-1 rounded-full ${theme.textSecondary} hover:${theme.textPrimary} transition-colors`}><X className="w-6 h-6" /></button>
                                </div>
                                {/* Error message inside modal */}
                                {bannerMessage.text && bannerMessage.type === 'error' && (
                                    <div className={`mx-6 mt-4 p-3 rounded-lg bg-red-100 border border-red-300 text-red-700 text-sm flex items-center`}>
                                        <span className="mr-2">❌</span>
                                        {bannerMessage.text}
                                    </div>
                                )}
                                {/* Success message inside modal */}
                                {bannerMessage.text && bannerMessage.type === 'success' && (
                                    <div className={`mx-6 mt-4 p-3 rounded-lg bg-green-100 border border-green-300 text-green-700 text-sm flex items-center`}>
                                        <span className="mr-2">✅</span>
                                        {bannerMessage.text}
                                    </div>
                                )}
                                <form onSubmit={handleRoomBookingSubmit} className="p-4 space-y-4 overflow-y-auto">
                                    {/* Always show editable date inputs */}
                                    <div className="flex flex-col sm:grid sm:grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <label className={`block text-sm font-medium ${theme.textSecondary}`}>Check-in Date</label>
                                            <input
                                                type="date"
                                                name="check_in"
                                                value={bookingData.check_in || ''}
                                                onChange={handleRoomBookingChange}
                                                min={new Date().toISOString().split('T')[0]}
                                                required
                                                className={`w-full p-3 rounded-xl ${theme.bgSecondary} ${theme.textPrimary} border ${theme.border} focus:outline-none focus:ring-2 focus:ring-[#0f5132] transition-colors`}
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <label className={`block text-sm font-medium ${theme.textSecondary}`}>Check-out Date</label>
                                            <input
                                                type="date"
                                                name="check_out"
                                                value={bookingData.check_out || ''}
                                                onChange={handleRoomBookingChange}
                                                min={bookingData.check_in || new Date().toISOString().split('T')[0]}
                                                required
                                                className={`w-full p-3 rounded-xl ${theme.bgSecondary} ${theme.textPrimary} border ${theme.border} focus:outline-none focus:ring-2 focus:ring-[#0f5132] transition-colors`}
                                            />
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <label className={`block text-sm font-medium ${theme.textSecondary}`}>Available Rooms for Selected Dates</label>
                                        {!bookingData.check_in || !bookingData.check_out ? (
                                            <div className={`p-6 text-center rounded-xl ${theme.bgSecondary} border-2 border-dashed ${theme.border}`}>
                                                <BedDouble className={`w-10 h-10 ${theme.textSecondary} mx-auto mb-3`} />
                                                <p className={`text-sm ${theme.textSecondary}`}>Please select check-in and check-out dates above to see available rooms</p>
                                            </div>
                                        ) : (
                                            <>
                                                <p className={`text-xs ${theme.textSecondary} mb-2`}>Showing rooms available from {bookingData.check_in} to {bookingData.check_out}</p>
                                                <div className={`grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 max-h-48 overflow-y-auto p-3 rounded-xl ${theme.bgSecondary}`}>
                                                    {rooms.length > 0 ? (
                                                        rooms.map(room => (
                                                            <div key={room.id} onClick={() => handleRoomSelection(room.id)}
                                                                className={`rounded-lg border-2 cursor-pointer transition-all duration-200 overflow-hidden ${bookingData.room_ids.includes(room.id) ? `${theme.buttonBg} ${theme.buttonText} border-transparent` : `${theme.bgCard} ${theme.textPrimary} ${theme.border} hover:border-[#c99c4e]`}`}
                                                            >
                                                                <img
                                                                    src={getImageUrl(room.aggregated_images?.[0] || room.image_url)}
                                                                    alt={room.type}
                                                                    className="w-full h-20 object-cover"
                                                                    onError={(e) => { e.target.src = ITEM_PLACEHOLDER; }}
                                                                />
                                                                <div className="p-2 text-center">
                                                                    <p className="font-bold text-[10px] text-amber-600 uppercase tracking-widest mb-1">{room.type}</p>
                                                                    {!selectedBranch && branches.length > 1 && room.branch_id && (
                                                                        <p className="text-[10px] text-[var(--gold)] font-medium uppercase tracking-wider mb-1">
                                                                            {branches.find(b => b.id === room.branch_id)?.name}
                                                                        </p>
                                                                    )}
                                                                    <p className="text-xs opacity-80">{room.type}</p>
                                                                    <p className="text-xs opacity-60 mt-1">Max: {room.adults}A, {room.children}C</p>
                                                                    <p className="text-xs font-bold mt-1">{formatCurrency(room.price)}</p>
                                                                </div>
                                                            </div>
                                                        ))
                                                    ) : (
                                                        <div className="col-span-full text-center py-8 text-gray-500">
                                                            <BedDouble className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                                                            <p className="text-sm font-semibold mb-1">No rooms available</p>
                                                            <p className="text-xs">No rooms are available for the selected dates. Please try different dates.</p>
                                                        </div>
                                                    )}
                                                </div>
                                            </>
                                        )}
                                    </div>
                                    <div className="space-y-2">
                                        <label className={`block text-sm font-medium ${theme.textSecondary}`}>Full Name</label>
                                        <input type="text" name="guest_name" value={bookingData.guest_name} onChange={handleRoomBookingChange} placeholder="Enter your full name" required className={`w-full p-3 rounded-xl ${theme.bgSecondary} ${theme.textPrimary} border ${theme.border} focus:outline-none focus:ring-2 focus:ring-amber-500 transition-colors`} />
                                    </div>
                                    <div className="space-y-2">
                                        <label className={`block text-sm font-medium ${theme.textSecondary}`}>Email Address</label>
                                        <input type="email" name="guest_email" value={bookingData.guest_email} onChange={handleRoomBookingChange} placeholder="user@example.com" required className={`w-full p-3 rounded-xl ${theme.bgSecondary} ${theme.textPrimary} border ${theme.border} focus:outline-none focus:ring-2 focus:ring-amber-500 transition-colors`} />
                                    </div>
                                    <div className="space-y-2">
                                        <label className={`block text-sm font-medium ${theme.textSecondary}`}>Phone Number</label>
                                        <input type="tel" name="guest_mobile" value={bookingData.guest_mobile} onChange={handleRoomBookingChange} placeholder="Enter your mobile number" required className={`w-full p-3 rounded-xl ${theme.bgSecondary} ${theme.textPrimary} border ${theme.border} focus:outline-none focus:ring-2 focus:ring-amber-500 transition-colors`} />
                                    </div>
                                    <div className="flex flex-col sm:grid sm:grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <label className={`block text-sm font-medium ${theme.textSecondary}`}>Adults</label>
                                            <input type="number" name="adults" value={bookingData.adults} onChange={handleRoomBookingChange} min="1" required className={`w-full p-3 rounded-xl ${theme.bgSecondary} ${theme.textPrimary} border ${theme.border} focus:outline-none focus:ring-2 focus:ring-amber-500 transition-colors`} />
                                        </div>
                                        <div className="space-y-2">
                                            <label className={`block text-sm font-medium ${theme.textSecondary}`}>Children</label>
                                            <input type="number" name="children" value={bookingData.children} onChange={handleRoomBookingChange} min="0" required className={`w-full p-3 rounded-xl ${theme.bgSecondary} ${theme.textPrimary} border ${theme.border} focus:outline-none focus:ring-2 focus:ring-amber-500 transition-colors`} />
                                        </div>
                                        <div className="space-y-2">
                                            <label className={`block text-sm font-medium ${theme.textSecondary}`}>No. of Rooms</label>
                                            <input type="number" name="num_rooms" value={bookingData.num_rooms} onChange={handleRoomBookingChange} min="1" required className={`w-full p-3 rounded-xl ${theme.bgSecondary} ${theme.textPrimary} border ${theme.border} focus:outline-none focus:ring-2 focus:ring-amber-500 transition-colors`} />
                                        </div>
                                    </div>
                                    <button type="submit" className={`w-full py-3 rounded-full ${theme.buttonBg} ${theme.buttonText} font-bold shadow-lg ${theme.buttonHover} transition-colors disabled:opacity-50`} disabled={isBookingLoading}>
                                        {isBookingLoading ? 'Sending...' : 'Send Enquiry'}
                                    </button>
                                    {bookingMessage.text && (
                                        <div className={`mt-4 p-3 rounded-xl text-center ${bookingMessage.type === 'success' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'}`}>
                                            {bookingMessage.text}
                                        </div>
                                    )}
                                </form>
                            </div>
                        </div>
                    )
                }

                {/* Package Booking Modal */}
                {
                    isPackageBookingFormOpen && (
                        <div className="fixed inset-0 z-[100] bg-neutral-950/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
                            <div className={`w-full max-w-lg ${theme.bgCard} rounded-3xl shadow-2xl flex flex-col max-h-[90vh] my-8`}>
                                <div className={`p-8 flex items-center justify-between border-b ${theme.border} bg-neutral-50/50`}>
                                    <div className="flex flex-col">
                                        <h3 className="text-xl font-display text-neutral-900 flex items-center tracking-tight">
                                            <Package className={`w-6 h-6 mr-3 ${theme.textAccent}`} /> 
                                            Book Your Experience
                                        </h3>
                                        {(() => {
                                            const pkg = packages.find(p => p.id === packageBookingData.package_id);
                                            return pkg && (
                                                <p className="text-sm font-body text-neutral-500 mt-1 ml-9">
                                                    {pkg.title} {pkg.branch?.name ? `• ${pkg.branch.name}` : ''}
                                                </p>
                                            );
                                        })()}
                                    </div>
                                    <button 
                                        onClick={() => setIsPackageBookingFormOpen(false)} 
                                        className={`p-2 rounded-full text-neutral-400 hover:text-neutral-900 hover:bg-neutral-100 transition-all`}
                                    >
                                        <X className="w-6 h-6" />
                                    </button>
                                </div>
                                {/* Error message inside modal */}
                                {bannerMessage.text && bannerMessage.type === 'error' && (
                                    <div className={`mx-6 mt-4 p-3 rounded-lg bg-red-100 border border-red-300 text-red-700 text-sm flex items-center`}>
                                        <span className="mr-2">❌</span>
                                        {bannerMessage.text}
                                    </div>
                                )}
                                {/* Success message inside modal */}
                                {bannerMessage.text && bannerMessage.type === 'success' && (
                                    <div className={`mx-6 mt-4 p-3 rounded-lg bg-green-100 border border-green-300 text-green-700 text-sm flex items-center`}>
                                        <span className="mr-2">✅</span>
                                        {bannerMessage.text}
                                    </div>
                                )}
                                <form onSubmit={handlePackageBookingSubmit} className="p-4 space-y-4 overflow-y-auto">
                                    {/* Package Info Summary */}
                                    {(() => {
                                        const pkg = packages.find(p => p.id === packageBookingData.package_id);
                                        if (!pkg) return null;
                                        return (
                                            <div className={`p-5 rounded-2xl bg-neutral-900 text-white shadow-xl relative overflow-hidden group`}>
                                                <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/10 rounded-full -mr-16 -mt-16 blur-2xl group-hover:bg-amber-500/20 transition-all duration-700"></div>
                                                <div className="relative z-10 flex justify-between items-start">
                                                    <div>
                                                        <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-amber-500 mb-1 block">Selected Experience</span>
                                                        <h4 className="text-xl font-display uppercase tracking-wider mb-2">{pkg.title}</h4>
                                                        <div className="flex gap-4">
                                                            <div className="flex items-center text-xs text-neutral-400">
                                                                <Clock className="w-3.5 h-3.5 mr-1.5 text-amber-500" />
                                                                {pkg.max_stay_days || 'Flex'} Days Max
                                                            </div>
                                                            <div className="flex items-center text-xs text-neutral-400">
                                                                <Users className="w-3.5 h-3.5 mr-1.5 text-amber-500" />
                                                                {pkg.default_adults}A, {pkg.default_children}C
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <div className="text-right">
                                                        <div className="text-2xl font-display text-amber-500">{formatCurrency(pkg.price)}</div>
                                                        <div className="text-[8px] uppercase tracking-widest text-neutral-500 font-bold mt-1">Starting Price</div>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })()}

                                    <div className="flex flex-col sm:grid sm:grid-cols-2 gap-4">
                                    {/* Always show editable date inputs */}
                                        <div className="space-y-2">
                                            <label className="block text-[10px] font-bold uppercase tracking-widest text-neutral-400 ml-1">Check-in Date</label>
                                            <div className="relative group">
                                                <input
                                                    type="date"
                                                    name="check_in"
                                                    value={packageBookingData.check_in || ''}
                                                    onChange={handlePackageBookingChange}
                                                    min={new Date().toISOString().split('T')[0]}
                                                    required
                                                    className={`w-full p-4 rounded-2xl bg-neutral-50 text-neutral-900 border-2 border-neutral-100 focus:border-amber-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-amber-500/5 transition-all duration-300 font-medium`}
                                                />
                                                <Calendar className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-300 pointer-events-none group-focus-within:text-amber-500 transition-colors" />
                                            </div>
                                        </div>
                                        <div className="space-y-2">
                                            <label className="block text-[10px] font-bold uppercase tracking-widest text-neutral-400 ml-1">Check-out Date</label>
                                            <div className="relative group">
                                                <input
                                                    type="date"
                                                    name="check_out"
                                                    value={packageBookingData.check_out || ''}
                                                    onChange={handlePackageBookingChange}
                                                    min={packageBookingData.check_in || new Date().toISOString().split('T')[0]}
                                                    required
                                                    className={`w-full p-4 rounded-2xl bg-neutral-50 text-neutral-900 border-2 border-neutral-100 focus:border-amber-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-amber-500/5 transition-all duration-300 font-medium`}
                                                />
                                                <Calendar className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-300 pointer-events-none group-focus-within:text-amber-500 transition-colors" />
                                            </div>
                                        </div>
                                    </div>
                                    {/* Room Selection - Only show for room_type packages */}
                                    {(() => {
                                        const selectedPackage = packages.find(p => p.id === packageBookingData.package_id);

                                        if (!selectedPackage) {
                                            return null;
                                        }

                                        // Determine if it's whole_property:
                                        // 1. If booking_type is explicitly 'whole_property'
                                        // 2. If booking_type is not set AND room_types is not set (legacy whole_property)
                                        // 3. If booking_type is null/undefined and room_types is null/undefined/empty
                                        const hasRoomTypes = selectedPackage.room_types && selectedPackage.room_types.trim().length > 0;
                                        const isWholeProperty = selectedPackage.booking_type === 'whole_property' ||
                                            selectedPackage.booking_type === 'whole property' ||
                                            (!selectedPackage.booking_type && !hasRoomTypes);

                                        // Show room selection for both room_type and whole_property packages
                                        return (
                                            <div className="space-y-4">
                                                <label className="block text-[10px] font-bold uppercase tracking-[0.2em] text-neutral-400 ml-1">
                                                    {isWholeProperty ? 'Exclusive Property Access' : 'Select Your Sanctuaries'}
                                                </label>
                                                {!packageBookingData.check_in || !packageBookingData.check_out ? (
                                                    <div className={`p-6 text-center rounded-xl ${theme.bgSecondary} border-2 border-dashed ${theme.border}`}>
                                                        <BedDouble className={`w-10 h-10 ${theme.textSecondary} mx-auto mb-3`} />
                                                        <p className={`text-sm ${theme.textSecondary}`}>Please select check-in and check-out dates above to see available rooms</p>
                                                    </div>
                                                ) : (
                                                    <>
                                                        {isWholeProperty && (
                                                            <div className={`p-3 rounded-xl ${theme.bgSecondary} border-2 border-amber-300 mb-3`}>
                                                                <p className={`text-sm font-semibold ${theme.textPrimary}`}>Whole Property Package</p>
                                                                <p className={`text-xs ${theme.textSecondary} mt-1`}>
                                                                    All available rooms will be booked for the selected dates. You can see them below.
                                                                </p>
                                                            </div>
                                                        )}
                                                        <p className={`text-xs ${theme.textSecondary} mb-2`}>Showing rooms available from {packageBookingData.check_in} to {packageBookingData.check_out}</p>
                                                        <div className={`grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 max-h-48 overflow-y-auto p-3 rounded-xl ${theme.bgSecondary}`}>
                                                            {(() => {
                                                                    // Filter rooms based on package type AND branch
                                                                    const pkgBranchId = selectedPackage.branch_id;
                                                                    let roomsToShow = allRooms;

                                                                    // Ensure we only show rooms for the package's branch
                                                                    if (pkgBranchId) {
                                                                        roomsToShow = roomsToShow.filter(r => r.branch_id === pkgBranchId);
                                                                    }

                                                                    if (isWholeProperty) {
                                                                        // For whole_property: Show ALL available rooms (within branch)
                                                                        // Already filtered by branch above
                                                                    } else if (selectedPackage && selectedPackage.room_types) {
                                                                        // For room_type: Only show rooms matching the package's room_types
                                                                        const allowedRoomTypes = selectedPackage.room_types.split(',').map(t => t.trim().toLowerCase());
                                                                        roomsToShow = roomsToShow.filter(room => {
                                                                            const roomType = room.type ? room.type.trim().toLowerCase() : '';
                                                                            return allowedRoomTypes.includes(roomType);
                                                                        });
                                                                    } else {
                                                                    // Invalid package type - no room_types specified and not whole_property
                                                                    return (
                                                                        <div className="col-span-full text-center py-8 text-gray-500">
                                                                            <BedDouble className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                                                                            <p className="text-sm font-semibold mb-1">Invalid package type</p>
                                                                            <p className="text-xs">Please select a valid package.</p>
                                                                        </div>
                                                                    );
                                                                }

                                                                // Group by type for display
                                                                const seenTypes = new Set();
                                                                roomsToShow = roomsToShow.filter(room => {
                                                                    if (!seenTypes.has(room.type)) {
                                                                        seenTypes.add(room.type);
                                                                        return true;
                                                                    }
                                                                    return false;
                                                                });

                                                                return roomsToShow.length > 0 ? (
                                                                    roomsToShow.map(room => {
                                                                        // For whole_property, all available rooms are auto-selected, but still show them
                                                                        const isSelected = packageBookingData.room_ids.includes(room.id);
                                                                        return (
                                                                            <div
                                                                                key={room.id}
                                                                                onClick={() => !isWholeProperty ? handlePackageRoomSelection(room.id) : null}
                                                                                className={`group relative rounded-2xl border-2 transition-all duration-500 overflow-hidden ${!isWholeProperty ? 'cursor-pointer' : 'cursor-default'} ${isSelected ? 'border-amber-500 ring-4 ring-amber-500/10' : 'border-neutral-100 hover:border-amber-200 bg-white shadow-sm hover:shadow-md'}`}
                                                                            >
                                                                                <div className="aspect-video overflow-hidden relative">
                                                                                    <img
                                                                                        src={getImageUrl(room.image_url)}
                                                                                        alt={room.type}
                                                                                        className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                                                                                        onError={(e) => { e.target.src = ITEM_PLACEHOLDER; }}
                                                                                    />
                                                                                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-60"></div>
                                                                                    <div className="absolute top-2 right-2">
                                                                                        <div className={`px-2.5 py-1 rounded-lg text-[9px] font-bold uppercase tracking-widest backdrop-blur-md ${isSelected ? 'bg-amber-500 text-white' : 'bg-black/50 text-white shadow-lg'}`}>
                                                                                            {room.type}
                                                                                        </div>
                                                                                    </div>
                                                                                    {isSelected && (
                                                                                        <div className="absolute inset-0 flex items-center justify-center bg-amber-500/20 backdrop-blur-[1px]">
                                                                                            <div className="w-10 h-10 rounded-full bg-amber-500 text-white flex items-center justify-center shadow-xl transform scale-110 transition-all duration-300">
                                                                                                <Check className="w-6 h-6" />
                                                                                            </div>
                                                                                        </div>
                                                                                    )}
                                                                                </div>
                                                                                <div className="p-4">
                                                                                    <div className="flex justify-between items-center mb-1.5">
                                                                                        <h4 className="font-display text-neutral-900 group-hover:text-amber-800 transition-colors uppercase tracking-widest text-[11px] font-bold">{room.type}</h4>
                                                                                        <span className="text-amber-700 font-bold text-xs tabular-nums">{formatCurrency(room.price)}</span>
                                                                                    </div>
                                                                                    <div className="flex items-center gap-4 text-neutral-500 text-[10px] uppercase tracking-widest font-semibold opacity-70">
                                                                                        <span className="flex items-center gap-1.5">
                                                                                            <User className="w-3 h-3" /> {room.adults}
                                                                                        </span>
                                                                                        <span className="flex items-center gap-1.5">
                                                                                            <SiGhost className="w-3 h-3" /> {room.children}
                                                                                        </span>
                                                                                    </div>
                                                                                </div>
                                                                            </div>
                                                                        );
                                                                    })
                                                                ) : (
                                                                    <div className="col-span-full text-center py-8 text-gray-500">
                                                                        <BedDouble className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                                                                        <p className="text-sm font-semibold mb-1">No rooms available</p>
                                                                        <p className="text-xs">No rooms are available for the selected dates. Please try different dates.</p>
                                                                    </div>
                                                                );
                                                            })()}
                                                        </div>
                                                    </>
                                                )}
                                            </div>
                                        );
                                    })()}
                                    <div className="flex flex-col sm:grid sm:grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <label className="block text-[10px] font-bold uppercase tracking-widest text-neutral-400 ml-1">Full Name</label>
                                            <input type="text" name="guest_name" value={packageBookingData.guest_name} onChange={handlePackageBookingChange} placeholder="Enter your full name" required className="w-full p-4 rounded-2xl bg-neutral-50 text-neutral-900 border-2 border-neutral-100 focus:border-amber-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-amber-500/5 transition-all duration-300 font-medium" />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="block text-[10px] font-bold uppercase tracking-widest text-neutral-400 ml-1">Phone Number</label>
                                            <input type="tel" name="guest_mobile" value={packageBookingData.guest_mobile} onChange={handlePackageBookingChange} placeholder="Enter your mobile number" required className="w-full p-4 rounded-2xl bg-neutral-50 text-neutral-900 border-2 border-neutral-100 focus:border-amber-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-amber-500/5 transition-all duration-300 font-medium" />
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <label className="block text-[10px] font-bold uppercase tracking-widest text-neutral-400 ml-1">Email Address (Optional)</label>
                                        <input type="email" name="guest_email" value={packageBookingData.guest_email || ''} onChange={handlePackageBookingChange} placeholder="user@example.com" className="w-full p-4 rounded-2xl bg-neutral-50 text-neutral-900 border-2 border-neutral-100 focus:border-amber-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-amber-500/5 transition-all duration-300 font-medium" />
                                    </div>

                                    <div className="flex flex-col sm:grid sm:grid-cols-3 gap-4">
                                        <div className="space-y-2">
                                            <label className="block text-[10px] font-bold uppercase tracking-widest text-neutral-400 ml-1">Adults</label>
                                            <input type="number" name="adults" value={packageBookingData.adults} onChange={handlePackageBookingChange} min="1" required className="w-full p-4 rounded-2xl bg-neutral-50 text-neutral-900 border-2 border-neutral-100 focus:border-amber-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-amber-500/5 transition-all duration-300 font-medium" />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="block text-[10px] font-bold uppercase tracking-widest text-neutral-400 ml-1">Children</label>
                                            <input type="number" name="children" value={packageBookingData.children} onChange={handlePackageBookingChange} min="0" required className="w-full p-4 rounded-2xl bg-neutral-50 text-neutral-900 border-2 border-neutral-100 focus:border-amber-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-amber-500/5 transition-all duration-300 font-medium" />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="block text-[10px] font-bold uppercase tracking-widest text-neutral-400 ml-1">No. of Rooms</label>
                                            <input type="number" name="num_rooms" value={packageBookingData.num_rooms} onChange={handlePackageBookingChange} min="1" required className="w-full p-4 rounded-2xl bg-neutral-50 text-neutral-900 border-2 border-neutral-100 focus:border-amber-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-amber-500/5 transition-all duration-300 font-medium" />
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <label className="block text-[10px] font-bold uppercase tracking-widest text-neutral-400 ml-1">Preferences & Special Requests</label>
                                        <textarea 
                                            name="special_requests" 
                                            value={packageBookingData.special_requests} 
                                            onChange={handlePackageBookingChange} 
                                            placeholder="Mention any special needs or dietary preferences..." 
                                            className="w-full p-4 rounded-2xl bg-neutral-50 text-neutral-900 border-2 border-neutral-100 focus:border-amber-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-amber-500/5 transition-all duration-300 font-medium" 
                                            rows="3" 
                                        />
                                    </div>

                                    {/* Final Summary & Total */}
                                    {(() => {
                                        const pkg = packages.find(p => p.id === packageBookingData.package_id);
                                        if (!pkg) return null;
                                        
                                        const selectedRooms = packageBookingData.room_ids.map(id => allRooms.find(r => r.id === id)).filter(Boolean);
                                        const roomTotal = selectedRooms.reduce((sum, r) => sum + (r.price || 0), 0);
                                        const packageBase = pkg.price || 0;
                                        const total = packageBase + roomTotal;

                                        return (
                                            <div className="mt-8 pt-8 border-t-2 border-dashed border-neutral-100">
                                                <div className="flex justify-between items-center mb-4">
                                                    <span className="text-sm font-bold text-neutral-900 uppercase tracking-widest">Est. Total Investment</span>
                                                    <div className="text-2xl font-display text-neutral-900">{formatCurrency(total)}</div>
                                                </div>
                                                <p className="text-[10px] text-neutral-400 leading-relaxed italic text-center mb-6">
                                                    * Final pricing may adjust based on specific requests and seasonal availability. 
                                                    Our concierge team will confirm all details.
                                                </p>
                                            </div>
                                        );
                                    })()}
                                    <button type="submit" className={`w-full py-3 rounded-full ${theme.buttonBg} ${theme.buttonText} font-bold shadow-lg ${theme.buttonHover} transition-colors disabled:opacity-50`} disabled={isBookingLoading}>
                                        {isBookingLoading ? 'Sending...' : 'Send Enquiry'}
                                    </button>
                                    {bookingMessage.text && (
                                        <div className={`mt-4 p-3 rounded-xl text-center ${bookingMessage.type === 'success' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'}`}>
                                            {bookingMessage.text}
                                        </div>
                                    )}
                                </form>
                            </div>
                        </div>
                    )
                }

                {/* Package Selection Modal */}
                {
                    isPackageSelectionOpen && (
                        <div className="fixed inset-0 z-[100] bg-neutral-950/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
                            <div className={`w-full max-w-4xl ${theme.bgCard} rounded-3xl shadow-2xl flex flex-col max-h-[90vh] my-8`}>
                                <div className={`p-6 flex items-center justify-between border-b ${theme.border}`}>
                                    <h3 className="text-lg font-bold flex items-center"><Package className={`w-5 h-5 mr-2 ${theme.textAccent}`} /> Select a Package</h3>
                                    <button onClick={() => setIsPackageSelectionOpen(false)} className={`p-1 rounded-full ${theme.textSecondary} hover:${theme.textPrimary} transition-colors`}><X className="w-6 h-6" /></button>
                                </div>
                                <div className="p-6 overflow-y-auto">
                                    {packages.length > 0 ? (
                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                            {packages.map((pkg) => {
                                                const imgIndex = packageImageIndex[pkg.id] || 0;
                                                const currentImage = pkg.images && pkg.images[imgIndex];
                                                return (
                                                    <div
                                                        key={pkg.id}
                                                        onClick={() => {
                                                            handleOpenPackageBookingForm(pkg.id);
                                                            setIsPackageSelectionOpen(false);
                                                        }}
                                                        className={`${theme.bgCard} rounded-2xl overflow-hidden shadow-xl hover:shadow-2xl transition-all duration-500 border ${theme.border} cursor-pointer transform hover:-translate-y-1`}
                                                    >
                                                        {/* Image Container */}
                                                        <div className="relative h-48 overflow-hidden">
                                                            <img
                                                                src={currentImage ? getImageUrl(currentImage.image_url) : ITEM_PLACEHOLDER}
                                                                alt={pkg.title}
                                                                className="w-full h-full object-cover transition-transform duration-700 hover:scale-110"
                                                                onError={(e) => { e.target.src = ITEM_PLACEHOLDER; }}
                                                            />
                                                            {/* Image Slider Dots */}
                                                            {pkg.images && pkg.images.length > 1 && (
                                                                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2 bg-black/60 backdrop-blur-sm px-3 py-2 rounded-full z-10">
                                                                    {pkg.images.map((_, imgIdx) => (
                                                                        <button
                                                                            key={imgIdx}
                                                                            onClick={(e) => {
                                                                                e.stopPropagation();
                                                                                setPackageImageIndex(prev => ({ ...prev, [pkg.id]: imgIdx }));
                                                                            }}
                                                                            className={`w-2 h-2 rounded-full transition-all ${imgIdx === imgIndex ? 'bg-white' : 'bg-white/40'}`}
                                                                        />
                                                                    ))}
                                                                </div>
                                                            )}
                                                            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />
                                                        </div>

                                                        {/* Content */}
                                                        <div className="p-5">
                                                            <h3 className={`text-xl font-bold ${theme.textCardPrimary || theme.textPrimary} mb-2 line-clamp-2`}>
                                                                {pkg.title}
                                                            </h3>
                                                            <p className={`text-sm ${theme.textCardSecondary || theme.textSecondary} mb-3 line-clamp-2`}>
                                                                {pkg.description}
                                                            </p>
                                                            {pkg.complimentary && (
                                                                <div className="mb-3 px-3 py-2 bg-amber-50/50 rounded-lg border border-amber-100">
                                                                    <p className={`text-xs ${theme.textAccent} font-semibold uppercase tracking-wide mb-1`}>Includes:</p>
                                                                    <p className={`text-xs ${theme.textCardSecondary || theme.textSecondary} line-clamp-2`}>{pkg.complimentary}</p>
                                                                </div>
                                                            )}
                                                            <div className={`flex items-center justify-between pt-3 border-t ${theme.cardBorder || theme.border}`}>
                                                                <span className={`text-2xl font-extrabold ${theme.textCardAccent || theme.textAccent}`}>
                                                                    {formatCurrency(pkg.price || 0)}
                                                                </span>
                                                                <button
                                                                    className={`px-6 py-2 text-sm font-bold ${theme.buttonBg} ${theme.buttonText} rounded-full shadow-lg ${theme.buttonHover} transition-all duration-300 transform hover:scale-105`}
                                                                >
                                                                    Select
                                                                </button>
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    ) : (
                                        <div className="text-center py-12">
                                            <Package className={`w-16 h-16 ${theme.textSecondary} mx-auto mb-4`} />
                                            <p className={`${theme.textSecondary}`}>No packages available at the moment.</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )
                }

                {/* Service Booking Modal */}
                {
                    isServiceBookingFormOpen && (
                        <div className="fixed inset-0 z-[100] bg-neutral-950/80 backdrop-blur-sm flex items-center justify-center p-4">
                            <div className={`w-full max-w-lg ${theme.bgCard} rounded-3xl shadow-2xl flex flex-col`}>
                                <div className={`p-6 flex items-center justify-between border-b ${theme.border}`}>
                                    <h3 className="text-lg font-bold flex items-center"><ConciergeBell className={`w-5 h-5 mr-2 ${theme.textAccent}`} /> Book a Service</h3>
                                    <button onClick={() => setIsServiceBookingFormOpen(false)} className={`p-1 rounded-full ${theme.textSecondary} hover:${theme.textPrimary} transition-colors`}><X className="w-6 h-6" /></button>
                                </div>
                                <form onSubmit={handleServiceBookingSubmit} className="p-4 space-y-4">
                                    <div className="space-y-2">
                                        <label className={`block text-sm font-medium ${theme.textSecondary}`}>Service ID</label>
                                        <input type="number" name="service_id" value={serviceBookingData.service_id || ''} readOnly className={`w-full p-3 rounded-xl ${theme.placeholderBg} ${theme.placeholderText} focus:outline-none`} />
                                    </div>
                                    <div className="space-y-2">
                                        <label className={`block text-sm font-medium ${theme.textSecondary}`}>Full Name</label>
                                        <input type="text" name="guest_name" value={serviceBookingData.guest_name} onChange={handleServiceBookingChange} placeholder="Enter your full name" required className={`w-full p-3 rounded-xl ${theme.bgSecondary} ${theme.textPrimary} border ${theme.border} focus:outline-none focus:ring-2 focus:ring-amber-500 transition-colors`} />
                                    </div>
                                    <div className="space-y-2">
                                        <label className={`block text-sm font-medium ${theme.textSecondary}`}>Email Address</label>
                                        <input type="email" name="guest_email" value={serviceBookingData.guest_email} onChange={handleServiceBookingChange} placeholder="user@example.com" required className={`w-full p-3 rounded-xl ${theme.bgSecondary} ${theme.textPrimary} border ${theme.border} focus:outline-none focus:ring-2 focus:ring-amber-500 transition-colors`} />
                                    </div>
                                    <div className="space-y-2">
                                        <label className={`block text-sm font-medium ${theme.textSecondary}`}>Phone Number</label>
                                        <input type="tel" name="guest_mobile" value={serviceBookingData.guest_mobile} onChange={handleServiceBookingChange} placeholder="Enter your mobile number" required className={`w-full p-3 rounded-xl ${theme.bgSecondary} ${theme.textPrimary} border ${theme.border} focus:outline-none focus:ring-2 focus:ring-amber-500 transition-colors`} />
                                    </div>
                                    <div className="space-y-2">
                                        <label className={`block text-sm font-medium ${theme.textSecondary}`}>Room ID (Optional)</label>
                                        <input type="number" name="room_id" value={serviceBookingData.room_id || ''} onChange={handleServiceBookingChange} placeholder="Enter your room ID if assigned" className={`w-full p-3 rounded-xl ${theme.bgSecondary} ${theme.textPrimary} border ${theme.border} focus:outline-none focus:ring-2 focus:ring-amber-500 transition-colors`} />
                                    </div>
                                    <button type="submit" className={`w-full py-3 rounded-full ${theme.buttonBg} ${theme.buttonText} font-bold shadow-lg ${theme.buttonHover} transition-colors disabled:opacity-50`} disabled={isBookingLoading}>
                                        {isBookingLoading ? 'Booking...' : 'Confirm Booking'}
                                    </button>
                                    {bookingMessage.text && (
                                        <div className={`mt-4 p-3 rounded-xl text-center ${bookingMessage.type === 'success' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'}`}>
                                            {bookingMessage.text}
                                        </div>
                                    )}
                                </form>
                            </div>
                        </div>
                    )
                }

                {/* Food Order Modal */}
                {
                    isFoodOrderFormOpen && (
                        <div className="fixed inset-0 z-[100] bg-neutral-950/80 backdrop-blur-sm flex items-center justify-center p-4">
                            <div className={`w-full max-w-lg ${theme.bgCard} rounded-3xl shadow-2xl flex flex-col`}>
                                <div className={`p-6 flex items-center justify-between border-b ${theme.border}`}>
                                    <h3 className="text-lg font-bold flex items-center"><Coffee className={`w-5 h-5 mr-2 ${theme.textAccent}`} /> Place a Food Order</h3>
                                    <button onClick={() => setIsFoodOrderFormOpen(false)} className={`p-1 rounded-full ${theme.textSecondary} hover:${theme.textPrimary} transition-colors`}><X className="w-6 h-6" /></button>
                                </div>
                                <form onSubmit={handleFoodOrderSubmit} className="p-4 space-y-4">
                                    <div className="space-y-2">
                                        <label className={`block text-sm font-medium ${theme.textSecondary}`}>Room ID</label>
                                        <input type="number" name="room_id" value={foodOrderData.room_id || ''} onChange={(e) => setFoodOrderData(prev => ({ ...prev, room_id: parseInt(e.target.value) || '' }))} placeholder="Enter your room ID" required className={`w-full p-3 rounded-xl ${theme.bgSecondary} ${theme.textPrimary} border ${theme.border} focus:outline-none focus:ring-2 focus:ring-amber-500 transition-colors`} />
                                    </div>
                                    <h4 className={`text-md font-semibold ${theme.textPrimary}`}>Select Items:</h4>
                                    <div className="space-y-4 max-h-60 overflow-y-auto">
                                        {foodItems.map(item => (
                                            <div key={item.id} className="flex items-center justify-between">
                                                <div className="flex items-center space-x-4">
                                                    <img src={getImageUrl(item.images?.[0]?.image_url)} alt={item.name} className="w-12 h-12 object-cover rounded-full" />
                                                    <div>
                                                        <p className={`font-semibold ${theme.textPrimary}`}>{item.name}</p>
                                                    </div>
                                                </div>
                                                <input
                                                    type="number"
                                                    min="0"
                                                    value={foodOrderData.items[item.id] || 0}
                                                    onChange={(e) => handleFoodOrderChange(e, item.id)}
                                                    className={`w-20 p-2 text-center rounded-lg ${theme.bgSecondary} ${theme.textPrimary} border ${theme.border} focus:outline-none focus:ring-2 focus:ring-amber-500`}
                                                />
                                            </div>
                                        ))}
                                    </div>
                                    <button type="submit" className={`w-full py-3 rounded-full ${theme.buttonBg} ${theme.buttonText} font-bold shadow-lg ${theme.buttonHover} transition-colors disabled:opacity-50`} disabled={isBookingLoading}>
                                        {isBookingLoading ? 'Placing Order...' : 'Place Order'}
                                    </button>
                                    {bookingMessage.text && (
                                        <div className={`mt-4 p-3 rounded-xl text-center ${bookingMessage.type === 'success' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'}`}>
                                            {bookingMessage.text}
                                        </div>
                                    )}
                                </form>
                            </div>
                        </div>
                    )
                }

                {/* ═══════════════════════════════════════════════════ */}
                {/* PARTNER / LIST YOUR PROPERTY SECTION               */}
                {/* ═══════════════════════════════════════════════════ */}
                <section id="partner" data-partner-section className="relative py-24 px-4 md:px-12 overflow-hidden scroll-mt-24" style={{ background: 'linear-gradient(135deg, #0a0a0f 0%, #1a1a2e 50%, #0f0f1a 100%)' }}>
                    {/* Ambient glows */}
                    <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-amber-500/8 blur-[150px] rounded-full pointer-events-none" />
                    <div className="absolute bottom-0 right-1/4 w-[400px] h-[400px] bg-indigo-500/6 blur-[120px] rounded-full pointer-events-none" />

                    <div className="container mx-auto relative z-10">
                        {/* Section eyebrow */}
                        <div className="text-center mb-16">
                            <span className="text-[10px] uppercase tracking-[0.4em] text-amber-500/70 font-bold">Join the StayOne Platform</span>
                            <h2 className="text-3xl sm:text-4xl md:text-5xl font-display text-white mt-4 leading-tight">
                                Grow With <span className="text-transparent bg-clip-text" style={{ backgroundImage: 'linear-gradient(135deg, #f5d485, #c8971e)' }}>StayOne</span>
                            </h2>
                            <p className="text-gray-400 mt-4 max-w-2xl mx-auto text-base leading-relaxed font-serif italic">
                                Whether you're a discerning traveler or a hospitality operator, StayOne has a place for you.
                            </p>
                        </div>

                        {/* Two Cards */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">

                            {/* Guest Card */}
                            <div className="group relative rounded-3xl p-8 md:p-10 border transition-all duration-500 cursor-pointer hover:-translate-y-1"
                                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', backdropFilter: 'blur(16px)' }}
                                onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(200,151,30,0.4)'; e.currentTarget.style.background = 'rgba(255,255,255,0.07)'; }}
                                onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'; e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; }}
                            >
                                <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-6" style={{ background: 'rgba(200,151,30,0.15)', border: '1px solid rgba(200,151,30,0.25)' }}>
                                    <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" fill="none" viewBox="0 0 24 24" stroke="rgb(200,151,30)" strokeWidth="1.8"><path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                                </div>
                                <h3 className="text-xl font-display text-white mb-3 tracking-wide">I'm a Guest</h3>
                                <p className="text-gray-400 text-sm leading-relaxed mb-8">
                                    Discover world-class resorts, book your perfect stay, and enjoy premium hospitality experiences crafted for the modern traveler.
                                </p>
                                <ul className="space-y-2 mb-8">
                                    {['Instant room bookings', 'Exclusive member deals', 'Concierge & dining requests', 'Seamless check-in'].map(f => (
                                        <li key={f} className="flex items-center gap-2 text-sm text-gray-300">
                                            <span className="w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(200,151,30,0.2)' }}>
                                                <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" fill="none" viewBox="0 0 24 24" stroke="rgb(200,151,30)" strokeWidth="3"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                                            </span>
                                            {f}
                                        </li>
                                    ))}
                                </ul>
                                <button
                                    onClick={() => { setShowAmenities(false); setIsGeneralBookingOpen(true); }}
                                    className="w-full py-3.5 rounded-xl text-sm font-bold uppercase tracking-widest transition-all duration-300 flex items-center justify-center gap-2"
                                    style={{ background: 'linear-gradient(135deg, #c8971e, #f5d485)', color: '#0a0a0f' }}
                                    onMouseEnter={e => e.currentTarget.style.filter = 'brightness(1.1)'}
                                    onMouseLeave={e => e.currentTarget.style.filter = 'brightness(1)'}
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                                    Book a Stay
                                </button>
                            </div>

                            {/* Partner Card */}
                            <div className="group relative rounded-3xl p-8 md:p-10 border transition-all duration-500 cursor-pointer hover:-translate-y-1"
                                style={{ background: 'rgba(200,151,30,0.05)', border: '1px solid rgba(200,151,30,0.2)', backdropFilter: 'blur(16px)' }}
                                onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(200,151,30,0.6)'; e.currentTarget.style.background = 'rgba(200,151,30,0.10)'; }}
                                onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(200,151,30,0.2)'; e.currentTarget.style.background = 'rgba(200,151,30,0.05)'; }}
                            >
                                {/* Recommended badge */}
                                <div className="absolute top-5 right-5 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest" style={{ background: 'rgba(200,151,30,0.2)', color: '#f5d485', border: '1px solid rgba(200,151,30,0.3)' }}>
                                    For Owners
                                </div>
                                <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-6" style={{ background: 'rgba(200,151,30,0.2)', border: '1px solid rgba(200,151,30,0.35)' }}>
                                    <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" fill="none" viewBox="0 0 24 24" stroke="rgb(200,151,30)" strokeWidth="1.8"><path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
                                </div>
                                <h3 className="text-xl font-display text-white mb-3 tracking-wide">List Your Property</h3>
                                <p className="text-gray-400 text-sm leading-relaxed mb-8">
                                    Join the StayOne hospitality network. Reach thousands of travelers, manage bookings, sync with Aiosell OTAs, and grow your revenue — all in one platform.
                                </p>
                                <ul className="space-y-2 mb-8">
                                    {['PMS + Channel Manager (Aiosell)', 'QR In-Room Dining & Services', 'Multi-branch management', 'Financial reports & GST invoicing', 'Mobile apps for staff & owners'].map(f => (
                                        <li key={f} className="flex items-center gap-2 text-sm text-gray-300">
                                            <span className="w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(200,151,30,0.25)' }}>
                                                <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" fill="none" viewBox="0 0 24 24" stroke="rgb(200,151,30)" strokeWidth="3"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                                            </span>
                                            {f}
                                        </li>
                                    ))}
                                </ul>
                                <a
                                    href={getAdminRegisterUrl()}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="w-full py-3.5 rounded-xl text-sm font-bold uppercase tracking-widest transition-all duration-300 flex items-center justify-center gap-2"
                                    style={{ background: 'linear-gradient(135deg, #7a5518, #c8971e)', color: '#fff' }}
                                    onMouseEnter={e => e.currentTarget.style.filter = 'brightness(1.15)'}
                                    onMouseLeave={e => e.currentTarget.style.filter = 'brightness(1)'}
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
                                    Register Your Property
                                </a>

                                <div className="text-center mt-3">
                                    <a
                                        href={getAdminLoginUrl()}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-xs text-amber-400/80 hover:text-amber-300 font-semibold transition-colors inline-flex items-center gap-1"
                                    >
                                        Already a partner? Sign in to Dashboard &rarr;
                                    </a>
                                </div>

                                {/* Pricing note */}
                                <p className="text-center text-[11px] text-amber-500/50 mt-3 font-medium">Starting at ₹2,500/month · No setup fees</p>
                            </div>
                        </div>

                        {/* Stats row */}
                        <div className="mt-16 grid grid-cols-2 md:grid-cols-4 gap-6 max-w-3xl mx-auto text-center">
                            {[
                                { value: '500+', label: 'Happy Guests' },
                                { value: '10+', label: 'Partner Properties' },
                                { value: '24/7', label: 'Support Available' },
                                { value: '99%', label: 'Uptime Guarantee' },
                            ].map(({ value, label }) => (
                                <div key={label}>
                                    <p className="text-2xl md:text-3xl font-display font-bold" style={{ color: '#f5d485' }}>{value}</p>
                                    <p className="text-[11px] uppercase tracking-widest text-gray-500 mt-1">{label}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>

                <footer data-contact-section className="bg-[#0f0f15] text-white py-20 px-4 md:px-12 mt-0 relative overflow-hidden">

                    {/* Ambient glow */}
                    <div className="absolute top-0 left-1/4 w-96 h-96 bg-amber-500/5 blur-[120px] rounded-full pointer-events-none"></div>

                    <div className="container mx-auto">
                        <div className="grid grid-cols-1 lg:grid-cols-4 gap-12 mb-16">
                            {/* Brand Column */}
                            <div className="lg:col-span-1 space-y-6">
                                <div className="flex items-center gap-3">
                                    <div className="p-1 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                                        <img src={logoSrc} alt="Stayone Group" loading="lazy" decoding="async" className="h-12 w-auto object-contain" />
                                    </div>
                                    <span className="text-xl font-display tracking-wider uppercase text-white">Stayone <span className="text-amber-500">Group</span></span>
                                </div>
                                <p className="text-sm text-gray-400 leading-relaxed font-serif italic">
                                    Crafting world-class sanctuaries for the discerning traveler. Stayone Group represents the pinnacle of hospitality, serenity, and unparalleled service across our handpicked collection of resorts.
                                </p>
                                <div className="flex space-x-5 pt-4">
                                    <a href="#" className="w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center hover:bg-amber-500 hover:border-amber-500 transition-all duration-300 group">
                                        <Facebook className="w-4 h-4 text-gray-400 group-hover:text-white" />
                                    </a>
                                    <a href="#" className="w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center hover:bg-amber-500 hover:border-amber-500 transition-all duration-300 group">
                                        <Instagram className="w-4 h-4 text-gray-400 group-hover:text-white" />
                                    </a>
                                    <a href="#" className="w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center hover:bg-amber-500 hover:border-amber-500 transition-all duration-300 group">
                                        <Twitter className="w-4 h-4 text-gray-400 group-hover:text-white" />
                                    </a>
                                </div>
                            </div>

                            {/* Branches Directory */}
                            <div className="lg:col-span-3">
                                <h4 className="text-[10px] uppercase tracking-[0.3em] font-black text-amber-500/80 mb-8 pb-2 border-b border-white/5 inline-block">Our Sanctuaries Directory</h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
                                    {branches.map(branch => (
                                        <div key={branch.id} className="group cursor-pointer" onClick={() => {
                                            setSelectedBranch(branch);
                                            window.scrollTo({ top: 0, behavior: 'smooth' });
                                        }}>
                                            <h5 className="text-white font-display uppercase tracking-widest text-sm mb-2 group-hover:text-amber-500 transition-colors">
                                                {branch.name}
                                            </h5>
                                            <div className="flex items-start gap-2 text-gray-500 text-xs leading-relaxed group-hover:text-gray-300 transition-colors">
                                                <MapPin className="w-3 h-3 mt-0.5 flex-shrink-0 text-amber-500/40" />
                                                <span>{renderLocationLink(branch, "Exclusive Property Location")}</span>
                                            </div>
                                            {branch.phone && (
                                                <div className="flex items-center gap-2 text-gray-500 text-xs leading-relaxed mt-1 group-hover:text-gray-300 transition-colors">
                                                    <Phone className="w-3 h-3 flex-shrink-0 text-amber-500/40" />
                                                    <a href={`tel:${branch.phone}`} onClick={(e) => e.stopPropagation()} className="hover:text-amber-500 transition-colors">
                                                        {branch.phone}
                                                    </a>
                                                </div>
                                            )}
                                            {branch.email && (
                                                <div className="flex items-center gap-2 text-gray-500 text-xs leading-relaxed mt-1 group-hover:text-gray-300 transition-colors">
                                                    <Mail className="w-3 h-3 flex-shrink-0 text-amber-500/40" />
                                                    <a href={`mailto:${branch.email}`} onClick={(e) => e.stopPropagation()} className="hover:text-amber-500 transition-colors">
                                                        {branch.email}
                                                    </a>
                                                </div>
                                            )}
                                            <div className="mt-3 flex items-center gap-4 text-[9px] uppercase tracking-widest font-bold text-amber-500/40 opacity-0 group-hover:opacity-100 transition-all transform translate-x-[-10px] group-hover:translate-x-0">
                                                Visit Destination <ChevronRight className="w-3 h-3" />
                                            </div>
                                        </div>
                                    ))}
                                    {branches.length === 0 && (
                                        <div className="text-gray-600 text-sm italic">Expanding our horizons... more sanctuaries coming soon.</div>
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="pt-10 border-t border-white/5 flex flex-col md:flex-row items-center justify-between gap-6">
                            <p className="text-[10px] uppercase tracking-[0.2em] text-gray-500 font-medium">
                                &copy; {new Date().getFullYear()} Stayone Business Group. All Rights Reserved.
                            </p>
                            <div className="flex items-center gap-6 flex-wrap justify-center">
                                <a
                                    href={getAdminRegisterUrl()}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-[10px] uppercase tracking-[0.2em] text-amber-500/60 hover:text-amber-400 transition-colors font-bold flex items-center gap-1.5"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
                                    List Your Property
                                </a>
                                <a href="https://www.teqmates.com" className="flex items-center gap-2 group">
                                    <span className="text-[10px] uppercase tracking-[0.2em] text-gray-600 group-hover:text-gray-400 transition-colors">Powered by</span>
                                    <span className="text-[11px] font-black uppercase tracking-widest text-gray-500 group-hover:text-white transition-colors">www.teqmates.com</span>
                                </a>
                            </div>
                        </div>
                    </div>
                </footer>

                {/* ── Sticky Branch Picker Footer ── */}
                {branches.length > 0 && (
                    <div
                        className="branch-footer-strip"
                        style={{
                            position: 'fixed',
                            bottom: 0,
                            left: 0,
                            right: 0,
                            zIndex: 200,
                            background: 'linear-gradient(0deg, rgba(10,10,15,0.97) 0%, rgba(15,15,22,0.94) 100%)',
                            backdropFilter: 'blur(20px)',
                            borderTop: '1px solid rgba(201,168,76,0.2)',
                            padding: '0.55rem 1rem',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.6rem',
                            overflowX: 'auto',
                        }}
                    >
                        <span style={{ fontFamily: 'var(--font-body)', fontSize: '0.6rem', letterSpacing: '0.2em', textTransform: 'uppercase', color: 'rgba(201,168,76,0.7)', whiteSpace: 'nowrap', flexShrink: 0, paddingRight: '0.4rem' }}>
                            Property
                        </span>
                        <div style={{ width: '1px', height: '1.2rem', background: 'rgba(201,168,76,0.2)', flexShrink: 0 }} />
                        <button
                            onClick={() => setSelectedBranch(null)}
                            style={{
                                fontFamily: 'var(--font-body)',
                                fontSize: '0.62rem',
                                fontWeight: '600',
                                letterSpacing: '0.15em',
                                textTransform: 'uppercase',
                                padding: '0.3rem 0.85rem',
                                borderRadius: '999px',
                                border: selectedBranch === null ? '1px solid #c9a84c' : '1px solid rgba(255,255,255,0.15)',
                                background: selectedBranch === null ? 'rgba(201,168,76,0.18)' : 'transparent',
                                color: selectedBranch === null ? '#c9a84c' : 'rgba(255,255,255,0.55)',
                                cursor: 'pointer',
                                whiteSpace: 'nowrap',
                                transition: 'all 0.25s',
                                flexShrink: 0,
                            }}
                        >
                            All
                        </button>
                        {branches.map(branch => (
                            <button
                                key={branch.id}
                                onClick={() => {
                                    setSelectedBranch(branch);
                                    window.scrollTo({ top: 0, behavior: 'smooth' });
                                }}
                                style={{
                                    fontFamily: 'var(--font-body)',
                                    fontSize: '0.62rem',
                                    fontWeight: '600',
                                    letterSpacing: '0.15em',
                                    textTransform: 'uppercase',
                                    padding: '0.3rem 0.85rem',
                                    borderRadius: '999px',
                                    border: selectedBranch?.id === branch.id ? '1px solid #c9a84c' : '1px solid rgba(255,255,255,0.15)',
                                    background: selectedBranch?.id === branch.id ? 'rgba(201,168,76,0.18)' : 'transparent',
                                    color: selectedBranch?.id === branch.id ? '#c9a84c' : 'rgba(255,255,255,0.55)',
                                    cursor: 'pointer',
                                    whiteSpace: 'nowrap',
                                    transition: 'all 0.25s',
                                    flexShrink: 0,
                                }}
                            >
                                {branch.name}
                            </button>
                        ))}
                    </div>
                )}
            </div>

            {/* ── WhatsApp Floating Chat Button ── */}
            <WhatsAppButton />
        </>
    );
}

/* ─── WhatsApp Floating Button Component ─────────────────────────── */
const WHATSAPP_NUMBER = "919188234567"; // Change to your WhatsApp number (country code + number, no + or spaces)
const WHATSAPP_MESSAGE = "Hello! I'd like to know more about your resort.";

function WhatsAppButton() {
    const [hovered, setHovered] = React.useState(false);
    const [visible, setVisible] = React.useState(false);

    React.useEffect(() => {
        const timer = setTimeout(() => setVisible(true), 1500);
        return () => clearTimeout(timer);
    }, []);

    const handleClick = () => {
        const url = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(WHATSAPP_MESSAGE)}`;
        window.open(url, "_blank", "noopener,noreferrer");
    };

    return (
        <div
            className="whatsapp-fab"
            style={{
                position: "fixed",
                bottom: "28px",
                right: "28px",
                zIndex: 9999,
                display: "flex",
                alignItems: "center",
                gap: "10px",
                opacity: visible ? 1 : 0,
                transform: visible ? "translateY(0)" : "translateY(20px)",
                transition: "opacity 0.5s ease, transform 0.5s ease",
                pointerEvents: visible ? "auto" : "none",
            }}
        >
            {/* Tooltip label */}
            <div
                style={{
                    background: "#fff",
                    color: "#075e54",
                    fontFamily: "'Montserrat', sans-serif",
                    fontWeight: 600,
                    fontSize: "0.78rem",
                    letterSpacing: "0.03em",
                    padding: "7px 14px",
                    borderRadius: "6px",
                    boxShadow: "0 4px 18px rgba(0,0,0,0.15)",
                    whiteSpace: "nowrap",
                    opacity: hovered ? 1 : 0,
                    transform: hovered ? "translateX(0)" : "translateX(8px)",
                    transition: "opacity 0.25s ease, transform 0.25s ease",
                    pointerEvents: "none",
                    border: "1px solid rgba(7,94,84,0.15)",
                }}
            >
                Chat with us on WhatsApp
            </div>

            {/* Main button */}
            <button
                onClick={handleClick}
                onMouseEnter={() => setHovered(true)}
                onMouseLeave={() => setHovered(false)}
                title="Chat with us on WhatsApp"
                aria-label="Open WhatsApp Chat"
                style={{
                    width: "58px",
                    height: "58px",
                    borderRadius: "50%",
                    background: hovered
                        ? "linear-gradient(135deg, #25d366 0%, #128c7e 100%)"
                        : "linear-gradient(135deg, #25d366 0%, #075e54 100%)",
                    border: "none",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    boxShadow: hovered
                        ? "0 6px 28px rgba(37,211,102,0.55), 0 0 0 4px rgba(37,211,102,0.18)"
                        : "0 4px 18px rgba(37,211,102,0.40), 0 0 0 3px rgba(37,211,102,0.12)",
                    transform: hovered ? "scale(1.1)" : "scale(1)",
                    transition: "all 0.3s cubic-bezier(0.23,1,0.32,1)",
                    flexShrink: 0,
                }}
            >
                {/* WhatsApp SVG Icon */}
                <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 48 48"
                    width="30"
                    height="30"
                    fill="white"
                >
                    <path d="M4.9 43.3l2.7-9.9C5.9 30.7 5 27.4 5 24 5 13.5 13.5 5 24 5s19 8.5 19 19-8.5 19-19 19c-3.3 0-6.4-.8-9.1-2.3L4.9 43.3z" />
                    <path
                        fill="#25d366"
                        d="M4.9 43.3l2.7-9.9C5.9 30.7 5 27.4 5 24 5 13.5 13.5 5 24 5s19 8.5 19 19-8.5 19-19 19c-3.3 0-6.4-.8-9.1-2.3L4.9 43.3z"
                    />
                    <path
                        fill="white"
                        d="M24 7c-9.4 0-17 7.6-17 17 0 3.1.8 6 2.3 8.6l.4.7-1.7 6.2 6.4-1.7.7.4C17.8 39.9 20.8 41 24 41c9.4 0 17-7.6 17-17S33.4 7 24 7zm8.5 23.5c-.4 1-2.1 1.9-2.9 2-.8.1-1.5.4-5-1.1-4.2-1.7-6.8-6-7-6.3-.2-.3-1.5-2-.1-4 .4-.5 1-.8 1.6-1 .2 0 .4 0 .5.1.5.1.8.3 1.1 1.1l1.3 3.2c.1.3.1.7-.1 1l-.5.7c-.2.2-.3.4-.2.7.5.9 1.4 2 2.4 2.8 1.2 1 2.5 1.6 3.5 1.9.3.1.6 0 .8-.2l.8-.9c.2-.3.5-.4.8-.3l3.1 1.5c.3.1.5.3.6.6.1.3.1 1.4-.3 2.2z"
                    />
                </svg>
            </button>

            {/* Pulse ring animation */}
            <style>{`
                @keyframes wa-pulse {
                    0% { transform: scale(1); opacity: 0.7; }
                    70% { transform: scale(1.6); opacity: 0; }
                    100% { transform: scale(1.6); opacity: 0; }
                }
                .wa-pulse-ring {
                    position: absolute;
                    width: 58px;
                    height: 58px;
                    border-radius: 50%;
                    background: rgba(37, 211, 102, 0.4);
                    animation: wa-pulse 2.2s ease-out infinite;
                    pointer-events: none;
                }
            `}</style>
            <div
                style={{
                    position: "absolute",
                    right: "28px",
                    bottom: "28px",
                    zIndex: 9998,
                }}
            >
                <div className="wa-pulse-ring" />
            </div>
        </div>
    );
}
