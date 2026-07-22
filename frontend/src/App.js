import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { Link, NavLink, Route, Routes, useLocation } from "react-router-dom";
import {
  ArrowRight,
  CalendarHeart,
  CheckCircle2,
  Clapperboard,
  Clock,
  Gift,
  Heart,
  LogOut,
  Mail,
  Music,
  Palette,
  PartyPopper,
  ShieldCheck,
  Sparkles,
  Users,
  Volume2,
  VolumeX,
  Wand2,
} from "lucide-react";
import { Toaster, toast } from "sonner";
import axios from "axios";
import "@/App.css";
import { DEFAULT_TEMPLATES, TemplatePicker } from "@/components/TemplatePicker";
import { DetailsForm } from "@/components/DetailsForm";
import { ScheduleBuilder } from "@/components/ScheduleBuilder";
import { PhotoUploader } from "@/components/PhotoUploader";
import { DynamicForm } from "@/components/DynamicForm";
import { PreviewPane } from "@/components/PreviewPane";
import { MusicPicker } from "@/components/MusicPicker";
import { CreditTopUpModal } from "@/components/CreditTopUpModal";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || "http://localhost:8001";
const GOOGLE_CLIENT_ID = process.env.REACT_APP_GOOGLE_CLIENT_ID || "";
const CONFIGURED_ADMIN_EMAILS = (process.env.REACT_APP_ADMIN_EMAILS || "")
  .split(",")
  .map((email) => email.trim().toLowerCase())
  .filter(Boolean);
const ADMIN_EMAILS = CONFIGURED_ADMIN_EMAILS.length ? CONFIGURED_ADMIN_EMAILS : ["neer19ultimate@gmail.com"];
const RECAPTCHA_SITE_KEY = process.env.REACT_APP_RECAPTCHA_SITE_KEY || "";
const RECAPTCHA_ACTION = "render_video";
export const API = `${BACKEND_URL}/api`;
const musicCategoryList = (categories) => Array.isArray(categories)
  ? categories
  : String(categories || "").split(",").map((item) => item.trim()).filter(Boolean);
const AUTH_STORAGE_KEY = "invitavideos.googleUser";
const AUTH_CREDENTIAL_STORAGE_KEY = "invitavideos.googleCredential";
let recaptchaScriptPromise = null;

const defaultDisplayMessage =
  "The moment we've all been waiting for — {{brideFirstName}} & {{groomFirstName}} invite you to witness their wedding vows{{#weddingDate}} on {{weddingDate}}{{/weddingDate}}{{#location}} in {{location}}{{/location}}.";

const initialDetails = {
  partnerOne: "Aisha",
  partnerTwo: "Rohan",
  eventDate: "November 21, 2026",
  venueName: "The Leela Palace",
  venueCity: "Udaipur",
  message:
    "Together with their families, they invite you to celebrate the beginning of their forever.",
  displayMessage: defaultDisplayMessage,
  durationInSeconds: 10,
  tags: "",
};

const categoryDefaults = {
  Wedding: initialDetails,
  Engagement: {
    ...initialDetails,
    message: "With joy in their hearts, they invite you to celebrate the beginning of their forever.",
    displayMessage: "We said yes! {{brideFirstName}} & {{groomFirstName}} invite you to celebrate their engagement{{#weddingDate}} on {{weddingDate}}{{/weddingDate}}{{#location}} at {{location}}{{/location}}.",
  },
  Birthday: {
    ...initialDetails,
    partnerOne: "Aarav",
    partnerTwo: "Sharma",
    eventDate: "October 18, 2026",
    venueName: "The Garden House",
    venueCity: "Mumbai",
    message: "Come celebrate a wonderful birthday filled with cake, music and memories!",
    displayMessage: "You're invited to celebrate {{brideFirstName}}'s birthday{{#weddingDate}} on {{weddingDate}}{{/weddingDate}}{{#location}} at {{location}}{{/location}}.",
  },
};

const weddingSchedule = [
  { name: "Haldi", time: "10:00 AM" },
  { name: "Sangeet", time: "7:00 PM" },
  { name: "Wedding", time: "11:30 AM" },
];

// Wedding/Engagement/Birthday keep their bespoke, already-polished forms
// (calendar picker, tag suggestions, dedicated schedule builder). Any other
// category — including future ones created via the admin Category forms page —
// renders fully from the server's form manifest via DynamicForm.
const LEGACY_CATEGORIES = ["Wedding", "Engagement", "Birthday"];

// Client-side mirror of the server's data-driven required-field checks (the
// server re-validates and is authoritative). Returns an error string, or null
// if everything required is present. Handles repeaters (min items + required
// item subfields) as well as scalar fields.
function validateDataDrivenFields(fieldDefs, values) {
  for (const field of fieldDefs) {
    if (field.type === "repeater") {
      const rows = Array.isArray(values[field.key]) ? values[field.key] : [];
      const min = field.minItems || (field.required ? 1 : 0);
      if (rows.length < min) return `Add at least ${min} ${(field.label || "entries").toLowerCase()}`;
      for (let i = 0; i < rows.length; i++) {
        for (const sub of field.itemFields || []) {
          if (sub.required && !String(rows[i]?.[sub.key] ?? "").trim()) {
            return `${field.label} #${i + 1}: "${sub.label || sub.key}" is required`;
          }
        }
      }
      continue;
    }
    if (field.required && !String(values[field.key] ?? "").trim()) {
      return `"${field.label}" is required`;
    }
  }
  return null;
}

function loadRecaptchaScript() {
  if (!RECAPTCHA_SITE_KEY) return Promise.resolve();
  if (window.grecaptcha?.execute) return Promise.resolve();
  if (recaptchaScriptPromise) return recaptchaScriptPromise;

  recaptchaScriptPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector("script[data-recaptcha-v3]");
    if (existing) {
      existing.addEventListener("load", resolve, { once: true });
      existing.addEventListener("error", reject, { once: true });
      return;
    }

    const script = document.createElement("script");
    script.src = `https://www.google.com/recaptcha/api.js?render=${encodeURIComponent(RECAPTCHA_SITE_KEY)}`;
    script.async = true;
    script.defer = true;
    script.dataset.recaptchaV3 = "true";
    script.onload = resolve;
    script.onerror = reject;
    document.head.appendChild(script);
  });

  return recaptchaScriptPromise;
}

async function executeRecaptcha() {
  if (!RECAPTCHA_SITE_KEY) return "";
  await loadRecaptchaScript();
  if (!window.grecaptcha?.ready || !window.grecaptcha?.execute) {
    throw new Error("reCAPTCHA is not ready");
  }

  return new Promise((resolve, reject) => {
    window.grecaptcha.ready(() => {
      window.grecaptcha
        .execute(RECAPTCHA_SITE_KEY, { action: RECAPTCHA_ACTION })
        .then(resolve)
        .catch(reject);
    });
  });
}

const AuthContext = createContext(null);

function decodeJwtPayload(token) {
  try {
    const part = token.split(".")[1];
    if (!part) return null;
    const base64 = part.replace(/-/g, "+").replace(/_/g, "/");
    const json = decodeURIComponent(
      atob(base64)
        .split("")
        .map((c) => "%" + c.charCodeAt(0).toString(16).padStart(2, "0"))
        .join("")
    );
    return JSON.parse(json);
  } catch {
    return null;
  }
}

// Google ID tokens carry `exp` (seconds). Treat as expired 30s early to avoid a
// token dying mid-request. If we cannot read `exp`, defer to the server's 401.
function isTokenExpired(token) {
  if (!token) return true;
  const payload = decodeJwtPayload(token);
  if (!payload?.exp) return false;
  return Date.now() >= payload.exp * 1000 - 30000;
}

function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(AUTH_STORAGE_KEY) || "null");
    } catch {
      return null;
    }
  });
  const [credential, setCredential] = useState(() => localStorage.getItem(AUTH_CREDENTIAL_STORAGE_KEY) || "");

  const signInWithGoogle = useCallback(async (credential) => {
    const response = await axios.post(`${API}/auth/google`, { credential });
    const nextUser = response.data.user;
    setUser(nextUser);
    setCredential(credential);
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(nextUser));
    localStorage.setItem(AUTH_CREDENTIAL_STORAGE_KEY, credential);
    toast.success(`Welcome ${nextUser.name || nextUser.email}`);
    return nextUser;
  }, []);

  const signOut = useCallback((options = {}) => {
    setUser(null);
    setCredential("");
    localStorage.removeItem(AUTH_STORAGE_KEY);
    localStorage.removeItem(AUTH_CREDENTIAL_STORAGE_KEY);
    if (window.google?.accounts?.id) {
      window.google.accounts.id.disableAutoSelect();
    }
    if (!options.silent) toast.info("Signed out");
  }, []);

  // Watchdog: when an idle user's token expires, sign them out so the UI stops
  // showing them as logged in. Form state lives elsewhere and is preserved.
  useEffect(() => {
    if (!credential) return undefined;
    const check = () => {
      if (isTokenExpired(credential)) {
        signOut({ silent: true });
        toast.info("Your session expired — please sign in again.");
      }
    };
    check();
    const timer = window.setInterval(check, 30000);
    return () => window.clearInterval(timer);
  }, [credential, signOut]);

  const value = useMemo(() => ({ user, credential, signInWithGoogle, signOut }), [user, credential, signInWithGoogle, signOut]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}

function isAdminUser(user) {
  return Boolean(user?.email && ADMIN_EMAILS.includes(user.email.toLowerCase()));
}

function GoogleSignInButton({ className = "", text = "signin_with", onSuccess }) {
  const buttonRef = useRef(null);
  const { signInWithGoogle } = useAuth();
  const [scriptReady, setScriptReady] = useState(Boolean(window.google?.accounts?.id));

  useEffect(() => {
    if (!GOOGLE_CLIENT_ID) return undefined;
    if (window.google?.accounts?.id) {
      setScriptReady(true);
      return undefined;
    }

    const check = window.setInterval(() => {
      if (window.google?.accounts?.id) {
        setScriptReady(true);
        window.clearInterval(check);
      }
    }, 200);

    return () => window.clearInterval(check);
  }, []);

  useEffect(() => {
    if (!GOOGLE_CLIENT_ID || !scriptReady || !buttonRef.current || !window.google?.accounts?.id) {
      return;
    }

    buttonRef.current.innerHTML = "";
    window.google.accounts.id.initialize({
      client_id: GOOGLE_CLIENT_ID,
      callback: async (response) => {
        try {
          const nextUser = await signInWithGoogle(response.credential);
          onSuccess?.(nextUser);
        } catch (error) {
          toast.error(error?.response?.data?.detail || "Google sign-in failed");
        }
      },
      use_fedcm_for_prompt: true,
    });
    window.google.accounts.id.renderButton(buttonRef.current, {
      theme: "outline",
      size: "large",
      shape: "pill",
      text,
    });
  }, [scriptReady, signInWithGoogle, text, onSuccess]);

  if (!GOOGLE_CLIENT_ID) {
    return (
      <span className={`inline-flex rounded-full border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-700 ${className}`}>
        Google login not configured
      </span>
    );
  }

  return <div ref={buttonRef} className={className} />;
}

function UserMenu() {
  const { user, signOut } = useAuth();

  if (!user) {
    return <GoogleSignInButton className="min-h-[40px]" />;
  }

  return (
    <div className="flex items-center gap-2 rounded-full border border-[#EBD3E0] bg-white px-2 py-1 shadow-sm">
      {user.picture ? (
        <img src={user.picture} alt="" className="h-8 w-8 rounded-full object-cover" referrerPolicy="no-referrer" />
      ) : (
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#F8EAF2] text-xs font-bold text-[#A4176D]">
          {(user.name || user.email || "U").slice(0, 1).toUpperCase()}
        </span>
      )}
      <span className="hidden max-w-[120px] truncate text-xs font-semibold text-[#32113A] sm:block">
        {user.name || user.email}
      </span>
      <button
        type="button"
        onClick={signOut}
        className="flex h-8 w-8 items-center justify-center rounded-full text-neutral-500 transition hover:bg-[#FFF3F8] hover:text-[#A4176D]"
        aria-label="Sign out"
        title="Sign out"
      >
        <LogOut className="h-4 w-4" aria-hidden="true" />
      </button>
    </div>
  );
}

const pageMeta = {
  "/": {
    title: "Invita Videos | Personalised Wedding Invitation Videos",
    description:
      "Create beautiful, personalised wedding invitation videos with your story, events, photos and music.",
  },
  "/create-video": {
    title: "Create Your Wedding Invitation Video | Invita Videos",
    description:
      "Choose a design, add your wedding details, photos and music, and create a share-ready invitation video.",
  },
  "/about": {
    title: "About Invita Videos | Wedding Stories in Motion",
    description:
      "Learn how Invita Videos makes it simple for couples to turn wedding details and memories into beautiful invitation videos.",
  },
  "/contact": {
    title: "Contact Invita Videos | Wedding Video Support",
    description:
      "Contact Invita Videos for help creating, customising or sharing your wedding invitation video.",
  },
  "/privacy": {
    title: "Privacy Policy | Invita Videos",
    description:
      "How Invita Videos collects, uses and protects your information across our website and mobile apps.",
  },
  "/admin/templates": {
    title: "Template Admin | Invita Videos",
    description: "Manage invitation template categories and availability.",
  },
};

function PageMeta() {
  const { pathname } = useLocation();

  useEffect(() => {
    const meta = pageMeta[pathname] || pageMeta["/"];
    const canonicalUrl = `https://invitavideos.com${pathname === "/" ? "/" : pathname}`;
    document.title = meta.title;

    const setMeta = (selector, value) => {
      const element = document.querySelector(selector);
      if (element) element.setAttribute("content", value);
    };

    setMeta('meta[name="description"]', meta.description);
    setMeta('meta[property="og:title"]', meta.title);
    setMeta('meta[property="og:description"]', meta.description);
    setMeta('meta[property="og:url"]', canonicalUrl);
    setMeta('meta[name="twitter:title"]', meta.title);
    setMeta('meta[name="twitter:description"]', meta.description);

    const canonical = document.querySelector('link[rel="canonical"]');
    if (canonical) canonical.setAttribute("href", canonicalUrl);
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [pathname]);

  return null;
}

const navClass = ({ isActive }) =>
  `rounded-full px-3 py-2 text-sm font-medium transition-colors ${
    isActive
      ? "bg-[#F3E8F5] text-[#6B145E]"
      : "text-neutral-600 hover:bg-black/5 hover:text-neutral-950"
  }`;

function SiteHeader() {
  const { user } = useAuth();
  const showAdminMenu = isAdminUser(user);

  return (
    <header className="sticky top-0 z-50 border-b border-black/5 bg-[#fffdf9]/90 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-5 py-3 lg:px-10">
        <Link to="/" className="flex items-center" aria-label="Invita Videos home">
          <img
            src="/images/ivlogo-white.jpg"
            alt="Invita Videos"
            className="h-16 w-auto max-w-[250px] rounded-xl object-contain sm:h-10 sm:max-w-[320px] lg:h-14 lg:max-w-[390px]"
            data-testid="app-title"
          />
        </Link>

        <nav className="order-3 flex w-full items-center justify-center gap-1 border-t border-black/5 pt-3 sm:order-2 sm:w-auto sm:border-0 sm:pt-0" aria-label="Main navigation">
          <NavLink to="/" end className={navClass}>Home</NavLink>
          <NavLink to="/about" className={navClass}>About</NavLink>
          <NavLink to="/contact" className={navClass}>Contact</NavLink>
          {user && <NavLink to="/my-downloads" className={navClass}>My Downloads</NavLink>}
          {user && <NavLink to="/my-orders" className={navClass}>My Orders</NavLink>}
          {showAdminMenu && <NavLink to="/admin/templates" className={navClass}>Admin</NavLink>}
        </nav>

        <div className="order-2 flex items-center gap-2 sm:order-3">
          <UserMenu />
          <Link
            to="/create-video"
            className="inline-flex items-center gap-2 rounded-full bg-[#32113A] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-[#52184D]"
          >
            Create Video <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>
      </div>
    </header>
  );
}

function SiteFooter() {
  return (
    <footer className="border-t border-white/10 bg-[#241027] text-white">
      <div className="mx-auto grid max-w-7xl gap-10 px-6 py-12 md:grid-cols-[1.4fr_1fr_1fr] lg:px-10">
        <div>
          <div className="font-heading text-2xl font-extrabold">Invita Videos</div>
          <p className="mt-3 max-w-sm text-sm leading-6 text-white/65">
            Personalised wedding invitation videos that help every celebration begin with a beautiful story.
          </p>
        </div>
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.2em] text-[#F2B94B]">Explore</div>
          <div className="mt-4 grid gap-2 text-sm text-white/70">
            <Link to="/" className="hover:text-white">Home</Link>
            <Link to="/create-video" className="hover:text-white">Create Video</Link>
            <Link to="/about" className="hover:text-white">About us</Link>
            <Link to="/contact" className="hover:text-white">Contact us</Link>
            <Link to="/privacy" className="hover:text-white">Privacy policy</Link>
          </div>
        </div>
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.2em] text-[#F2B94B]">Get in touch</div>
          <a className="mt-4 inline-flex items-center gap-2 text-sm text-white/70 hover:text-white" href="mailto:info@invitavideos.com">
            <Mail className="h-4 w-4" aria-hidden="true" /> info@invitavideos.com
          </a>
        </div>
      </div>
      <div className="border-t border-white/10 px-6 py-5 text-center text-xs text-white/45">
        © {new Date().getFullYear()} Invita Videos. Made for celebrations worth remembering.
      </div>
    </footer>
  );
}

function MarketingLayout({ children }) {
  return (
    <div className="min-h-screen bg-[#FFFDF9] text-[#281E28]">
      <SiteHeader />
      {children}
      <SiteFooter />
    </div>
  );
}

const serviceCards = [
  {
    icon: Palette,
    title: "Beautiful templates",
    copy: "Choose from modern, traditional, floral, royal and culturally inspired invitation video designs.",
  },
  {
    icon: Wand2,
    title: "Easy personalisation",
    copy: "Add the couple's names, wedding dates, venues, event schedules, messages and photographs.",
  },
  {
    icon: Clock,
    title: "Videos created in minutes",
    copy: "No complicated editing tools or technical skills are required to create your invitation.",
  },
  {
    icon: Music,
    title: "Music included",
    copy: "Each invitation video includes music selected to complement the design you choose.",
  },
  {
    icon: PartyPopper,
    title: "Perfect for every celebration",
    copy: "Create videos for weddings, engagements, save-the-dates, receptions and other ceremonies.",
  },
  {
    icon: Gift,
    title: "Free to create",
    copy: "Create and share beautiful invitation videos without expensive design services.",
  },
];

function LandingPage() {
  const heroVideoRef = useRef(null);
  const [heroMuted, setHeroMuted] = useState(true);

  useEffect(() => {
    const video = heroVideoRef.current;
    if (!video) return undefined;

    let soundEnabled = false;
    const options = { passive: true };

    const removeListeners = () => {
      window.removeEventListener("pointerdown", enableSound);
      window.removeEventListener("keydown", enableSound);
      window.removeEventListener("scroll", enableSound, options);
    };

    const enableSound = async () => {
      if (soundEnabled || !heroVideoRef.current) return;

      try {
        heroVideoRef.current.muted = false;
        heroVideoRef.current.volume = 0.8;
        await heroVideoRef.current.play();
        soundEnabled = true;
        setHeroMuted(false);
        removeListeners();
      } catch {
        // Most browsers require a click or tap before sound can start. If a
        // scroll attempt is rejected, the pointer and keyboard listeners stay.
        heroVideoRef.current.muted = true;
        setHeroMuted(true);
      }
    };

    window.addEventListener("pointerdown", enableSound);
    window.addEventListener("keydown", enableSound);
    window.addEventListener("scroll", enableSound, options);

    return removeListeners;
  }, []);

  const toggleHeroSound = async () => {
    const video = heroVideoRef.current;
    if (!video) return;

    const shouldUnmute = video.muted;
    video.muted = !shouldUnmute;
    setHeroMuted(!shouldUnmute);
    if (shouldUnmute) {
      video.volume = 0.8;
      try {
        await video.play();
      } catch {
        video.muted = true;
        setHeroMuted(true);
      }
    }
  };

  return (
    <MarketingLayout>
      <main>
        <section className="relative overflow-hidden bg-gradient-to-b from-[#FFF6FB] via-[#FFFBFE] to-[#FFFDF9] px-6 pb-20 pt-12 lg:px-10 lg:pb-28 lg:pt-16">
          <div className="absolute -left-28 top-16 h-80 w-80 rounded-full bg-[#F6B6D4]/30 blur-3xl" aria-hidden="true" />
          <div className="absolute -right-16 top-0 h-96 w-96 rounded-full bg-[#F7CE7A]/25 blur-3xl" aria-hidden="true" />
          <div className="absolute left-1/2 bottom-0 h-72 w-72 -translate-x-1/2 rounded-full bg-[#C7A3F0]/20 blur-3xl" aria-hidden="true" />
          <div
            className="absolute inset-0 opacity-[0.55] [background-image:radial-gradient(circle_at_1px_1px,rgba(138,20,104,0.09)_1px,transparent_0)] [background-size:26px_26px]"
            aria-hidden="true"
          />
          <div className="relative mx-auto grid max-w-7xl items-center gap-14 lg:grid-cols-[1.08fr_0.92fr] lg:gap-12">
            <div className="text-center lg:text-left">
              <div className="inline-flex items-center gap-2 rounded-full border border-[#E9C9DC] bg-white/80 px-4 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-[#85155F] shadow-[0_6px_20px_rgba(138,20,104,0.08)] backdrop-blur">
                <Sparkles className="h-4 w-4" aria-hidden="true" /> 100% free · no editing skills needed
              </div>
              <h1 className="mx-auto mt-7 max-w-3xl font-heading text-5xl font-extrabold leading-[0.98] tracking-[-0.04em] text-[#32113A] sm:text-6xl lg:mx-0 lg:text-[4.4rem]">
                Create Wedding &amp; Engagement Invitation Videos{" "}
                <span className="relative whitespace-nowrap">
                  <span className="relative z-10 bg-gradient-to-r from-[#6012A8] via-[#C80A76] to-[#E66B24] bg-clip-text text-transparent">
                    in Minutes
                  </span>
                  <svg className="absolute -bottom-2 left-0 z-0 h-3 w-full text-[#F4B93E]" viewBox="0 0 300 12" fill="none" preserveAspectRatio="none" aria-hidden="true">
                    <path d="M2 8C60 3 150 2 298 6" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
                  </svg>
                </span>
              </h1>
              <p className="mx-auto mt-6 max-w-xl text-lg leading-8 text-neutral-600 lg:mx-0">
                Choose a beautiful template, add your event details and photos, and create a personalised invitation video with music—absolutely free.
              </p>
              <div className="mt-8 flex flex-wrap justify-center gap-3 lg:justify-start">
                <Link to="/create-video" className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-[#6012A8] via-[#C80A76] to-[#E66B24] px-6 py-3.5 font-semibold text-white shadow-[0_14px_32px_rgba(138,20,104,0.22)] transition hover:-translate-y-0.5 hover:shadow-[0_20px_44px_rgba(138,20,104,0.3)]">
                  Start creating for free <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
                <a href="#how-it-works" className="inline-flex items-center gap-2 rounded-full border border-black/10 bg-white px-6 py-3.5 font-semibold text-[#32113A] transition hover:border-[#B6548F]/50 hover:bg-[#FFF8FB]">
                  See how it works
                </a>
              </div>
              <div className="mt-9 flex flex-wrap justify-center gap-x-6 gap-y-3 text-sm text-neutral-600 lg:justify-start">
                {["Beautiful templates", "Photos and music", "Ready in minutes"].map((item) => (
                  <span key={item} className="inline-flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-[#B41374]" aria-hidden="true" /> {item}
                  </span>
                ))}
              </div>
            </div>

            <div className="relative flex justify-center lg:justify-end">
              <div className="absolute left-1/2 top-1/2 -z-10 h-[92%] w-[88%] -translate-x-1/2 -translate-y-1/2 rotate-3 rounded-[3rem] bg-gradient-to-br from-[#7A1AB5]/22 via-[#EC267D]/18 to-[#F6B000]/28 blur-[2px]" aria-hidden="true" />
              <div className="relative w-full max-w-[360px] rounded-[2.35rem] border border-white/70 bg-white p-2.5 shadow-[0_28px_90px_rgba(67,26,53,0.22)] sm:max-w-[390px]">
                <div className="absolute left-1/2 top-5 z-10 h-1.5 w-14 -translate-x-1/2 rounded-full bg-black/45" aria-hidden="true" />
                <video
                  ref={heroVideoRef}
                  src="/brand/invitawedds.webm"
                  poster="/brand/og-image.webp"
                  className="aspect-[9/16] w-full rounded-[1.85rem] bg-[#32113A] object-cover"
                  autoPlay
                  loop
                  muted={heroMuted}
                  playsInline
                  preload="metadata"
                  aria-label="Invita Videos vertical wedding invitation reel preview"
                />
                <div className="pointer-events-none absolute left-5 top-6 rounded-full border border-white/25 bg-black/45 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-white backdrop-blur-md">
                  Invitation reel · 9:16
                </div>
                <button
                  type="button"
                  onClick={toggleHeroSound}
                  className="absolute bottom-6 right-6 inline-flex items-center gap-2 rounded-full border border-white/30 bg-black/55 px-4 py-2 text-xs font-semibold text-white shadow-lg backdrop-blur-md transition hover:bg-black/70 focus:outline-none focus:ring-2 focus:ring-white"
                  aria-label={heroMuted ? "Enable preview sound" : "Mute preview sound"}
                >
                  {heroMuted ? <VolumeX className="h-4 w-4" aria-hidden="true" /> : <Volume2 className="h-4 w-4" aria-hidden="true" />}
                  {heroMuted ? "Sound on" : "Mute"}
                </button>

                <div className="pointer-events-none absolute -left-6 top-24 hidden rounded-2xl border border-white/70 bg-white/90 px-4 py-3 shadow-[0_16px_40px_rgba(67,26,53,0.16)] backdrop-blur sm:flex sm:items-center sm:gap-3">
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#F8EAF2] text-[#A4176D]">
                    <Clock className="h-4 w-4" aria-hidden="true" />
                  </span>
                  <span>
                    <span className="block text-sm font-extrabold text-[#32113A]">Ready in minutes</span>
                    <span className="block text-[11px] text-neutral-500">No editing needed</span>
                  </span>
                </div>

                <div className="pointer-events-none absolute -right-5 bottom-28 hidden rounded-2xl border border-white/70 bg-white/90 px-4 py-3 shadow-[0_16px_40px_rgba(67,26,53,0.16)] backdrop-blur sm:flex sm:items-center sm:gap-3">
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#FBF0DC] text-[#C98A12]">
                    <Music className="h-4 w-4" aria-hidden="true" />
                  </span>
                  <span>
                    <span className="block text-sm font-extrabold text-[#32113A]">Music included</span>
                    <span className="block text-[11px] text-neutral-500">Matched to your design</span>
                  </span>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="border-y border-[#EFDDE7] bg-[#FFF7FB] px-6 py-16 lg:px-10 lg:py-24">
          <div className="mx-auto max-w-7xl">
            <div className="max-w-2xl">
              <div className="section-label text-[#9B256D]">What makes us special</div>
              <h2 className="mt-3 font-heading text-4xl font-extrabold tracking-tight text-[#32113A] sm:text-5xl">
                Everything you need to invite with feeling.
              </h2>
              <p className="mt-4 text-lg leading-8 text-neutral-600">
                Invita Videos turns the practical details of your celebration into an invitation people will want to watch twice.
              </p>
            </div>
            <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {serviceCards.map(({ icon: Icon, title, copy }) => (
                <article key={title} className="rounded-3xl border border-[#EDD6E2] bg-white p-6 shadow-[0_12px_40px_rgba(81,25,62,0.05)] transition hover:-translate-y-1 hover:border-[#D9A9C6] hover:shadow-[0_20px_50px_rgba(81,25,62,0.1)]">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#F8EAF2] text-[#A4176D]">
                    <Icon className="h-5 w-5" aria-hidden="true" />
                  </div>
                  <h3 className="mt-5 font-heading text-xl font-extrabold text-[#32113A]">{title}</h3>
                  <p className="mt-3 text-sm leading-6 text-neutral-600">{copy}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="how-it-works" className="scroll-mt-24 px-6 py-16 lg:px-10 lg:py-24">
          <div className="mx-auto max-w-7xl">
            <div className="text-center">
              <div className="section-label text-[#9B256D]">Simple by design</div>
              <h2 className="mt-3 font-heading text-4xl font-extrabold tracking-tight text-[#32113A] sm:text-5xl">From your details to their screens.</h2>
            </div>
            <div className="mt-14 grid gap-8 md:grid-cols-3">
              {[
                ["01", "Choose your style", "Start with a wedding video template that feels like your celebration."],
                ["02", "Make it yours", "Add your names, date, venue, schedule, message, photos and music."],
                ["03", "Create and share", "Render your invitation and share the finished video with family and friends."],
              ].map(([number, title, copy]) => (
                <article key={number} className="relative border-l border-[#DDB6CF] pl-7">
                  <div className="font-heading text-5xl font-extrabold text-[#EACBDD]">{number}</div>
                  <h3 className="mt-3 font-heading text-2xl font-extrabold text-[#32113A]">{title}</h3>
                  <p className="mt-3 leading-7 text-neutral-600">{copy}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="border-y border-[#EFDDE7] bg-[#FFF7FB] px-6 py-16 lg:px-10 lg:py-24">
          <div className="mx-auto grid max-w-7xl gap-6 lg:grid-cols-2">
            <article className="rounded-[2rem] border border-[#ECD5E2] bg-white p-8 shadow-[0_16px_50px_rgba(81,25,62,0.06)] sm:p-10">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#F8EAF2] text-[#A4176D]">
                <Heart className="h-6 w-6" aria-hidden="true" />
              </div>
              <h2 className="mt-6 font-heading text-3xl font-extrabold text-[#32113A]">Our mission</h2>
              <p className="mt-4 text-lg leading-8 text-neutral-600">
                To make beautiful digital wedding invitations accessible to every couple. We simplify the entire process so you can create elegant invitation videos quickly and share them instantly with friends and family.
              </p>
            </article>
            <article className="rounded-[2rem] border border-[#ECD5E2] bg-white p-8 shadow-[0_16px_50px_rgba(81,25,62,0.06)] sm:p-10">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#F8EAF2] text-[#A4176D]">
                <CalendarHeart className="h-6 w-6" aria-hidden="true" />
              </div>
              <h2 className="mt-6 font-heading text-3xl font-extrabold text-[#32113A]">Our vision</h2>
              <p className="mt-4 text-lg leading-8 text-neutral-600">
                To become the easiest and most loved platform for creating digital invitations. We keep adding new templates, regional styles, languages, music and personalisation options so every couple can create an invitation that feels uniquely theirs.
              </p>
            </article>
          </div>
        </section>

        <section className="px-6 pb-20 pt-16 lg:px-10 lg:pb-28 lg:pt-24">
          <div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-8 overflow-hidden rounded-[2rem] bg-[#32113A] px-7 py-10 text-white shadow-[0_24px_70px_rgba(50,17,58,0.2)] sm:px-10 lg:flex-row lg:items-center lg:px-14 lg:py-14">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.2em] text-[#F4C14E]">Your celebration · your story · your invitation</div>
              <h2 className="mt-3 max-w-2xl font-heading text-4xl font-extrabold tracking-tight">Create a beautiful invitation and share your special moment with everyone you love.</h2>
            </div>
            <Link to="/create-video" className="inline-flex shrink-0 items-center gap-2 rounded-full bg-white px-6 py-3.5 font-semibold text-[#32113A] transition hover:-translate-y-0.5 hover:bg-[#FFF4FA]">
              Start creating for free <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
        </section>
      </main>
    </MarketingLayout>
  );
}

function CreateVideoPage() {
  const { user, credential, signOut } = useAuth();
  const [template, setTemplate] = useState("marigold");
  const [templates, setTemplates] = useState(DEFAULT_TEMPLATES);
  const [details, setDetails] = useState(initialDetails);
  const [schedule, setSchedule] = useState([
    ...weddingSchedule,
  ]);
  const [photos, setPhotos] = useState([]);
  // Generic value bag + per-photo captions for data-driven (non-legacy) categories.
  // Captions are index-aligned with `photos` so the first caption box can exist
  // (and be typed into) before the first upload finishes.
  const [fields, setFields] = useState({});
  const [photoCaptions, setPhotoCaptions] = useState([]);
  const [categoryDefs, setCategoryDefs] = useState([]);
  const [formManifest, setFormManifest] = useState(null);
  const [musicId, setMusicId] = useState("tere-sang");
  const [customMusicUrl, setCustomMusicUrl] = useState("");
  const [jobStatus, setJobStatus] = useState("idle");
  const [jobProgress, setJobProgress] = useState(0);
  const [jobId, setJobId] = useState(null);
  const [videoUrl, setVideoUrl] = useState(null);
  const [loginPromptOpen, setLoginPromptOpen] = useState(false);
  const [resumeRenderAfterLogin, setResumeRenderAfterLogin] = useState(false);
  const [wizardStep, setWizardStep] = useState(0);
  const [walletBalance, setWalletBalance] = useState(null);
  const [topUpOpen, setTopUpOpen] = useState(false);
  const [resumeRenderAfterTopUp, setResumeRenderAfterTopUp] = useState(false);
  const pollRef = useRef(null);

  const rendering = jobStatus === "queued" || jobStatus === "rendering";
  const selectedTemplate = templates.find((item) => item.id === template);
  const category = selectedTemplate?.category || "Wedding";
  const isLegacyCategory = LEGACY_CATEGORIES.includes(category);
  const activeCategoryDef = categoryDefs.find((c) => c.name === category) || null;
  const categoryTypes = useMemo(() => Object.fromEntries(categoryDefs.map((c) => [c.name, c.type || "personal"])), [categoryDefs]);

  // Server-resolved form manifest for the selected template — category fields
  // already capability-gated and merged with template settings.
  const manifest = formManifest && formManifest.templateId === template ? formManifest : null;
  const isDataDriven = !isLegacyCategory && Boolean(manifest?.hasForm ?? activeCategoryDef?.form);
  const formSchema = useMemo(
    () => (manifest?.hasForm ? { fields: manifest.steps.details.fields } : activeCategoryDef?.form),
    [manifest, activeCategoryDef],
  );
  const durationOptions = manifest?.steps?.details?.durations || [10, 20, 30];
  const minImages = manifest?.steps?.photos?.minImages || 1;
  const captionPerImage = Boolean(manifest?.steps?.photos?.captionPerImage);
  const captionMaxLength = manifest?.steps?.photos?.captionMaxLength || 120;
  // Effective image cap depends on the chosen duration (shorter reels hold fewer).
  const imagesPerDuration = manifest?.steps?.photos?.imagesPerDuration || {};
  const overallMaxImages = manifest?.steps?.photos?.maxImages || 4;
  const maxImages = Number(imagesPerDuration[String(details.durationInSeconds)]) || overallMaxImages;
  // Credit pricing (billing/pricing.py on the backend) — the same map the
  // /renders endpoint charges against, so what's shown here can't drift.
  const pricingByDuration = manifest?.steps?.details?.pricing?.byDuration || {};
  const pricingDefault = Number(manifest?.steps?.details?.pricing?.default || 0);
  const templateHasPaidDurations = pricingDefault > 0 || Object.values(pricingByDuration).some((v) => Number(v) > 0);
  const selectedDurationCost = Number(pricingByDuration[String(details.durationInSeconds)] ?? pricingDefault);
  const insufficientCredits = selectedDurationCost > 0 && (walletBalance == null || walletBalance < selectedDurationCost);
  const missingCaption = captionPerImage && photos.some((_, i) => !((photoCaptions[i] || "").trim()));

  // Step-awareness: categories declare which shared steps they use. Timeline
  // has no shared photo step (images live in the form) and derives its length
  // from screen count rather than a user pick.
  const usesPhotoStep = manifest ? Boolean(manifest.steps?.photos?.enabled) : true;
  const durationMode = manifest?.steps?.details?.durationMode || "pick";
  const secondsPerScreen = Number(manifest?.steps?.details?.secondsPerScreen || 2.5);
  const timelineCfg = manifest?.steps?.details?.timeline || {};
  const timelineItems = Array.isArray(fields.timelineItems) ? fields.timelineItems : [];
  const derivedScreens = timelineItems.length + Number(timelineCfg.fixedScreens || 3);
  const derivedDuration = Math.round(Math.min(60, Math.max(5, derivedScreens * secondsPerScreen)));

  const wizardSteps = [
    { key: "category", label: "Category", title: "Choose your occasion and style", hint: "Start with a category, then choose a template." },
    { key: "details", label: "Details", title: "Add the essentials", hint: "Tell us who and what you are celebrating." },
    ...(usesPhotoStep ? [{ key: "images", label: "Images", title: "Add your memories", hint: "Upload your photos for the story." }] : []),
    { key: "music", label: "Music", title: "Set the mood", hint: "Choose a soundtrack for your video." },
  ];
  const currentStepKey = wizardSteps[wizardStep]?.key;

  const goNext = () => {
    if (currentStepKey === "details") {
      if (isDataDriven) {
        const missing = validateDataDrivenFields(formSchema?.fields || [], fields);
        if (missing) {
          toast.error(missing);
          return;
        }
      } else if (!details.partnerOne.trim() || !details.partnerTwo.trim()) {
        toast.error(category === "Birthday" ? "First and last name are required" : "Both names are required");
        return;
      }
      if (selectedDurationCost > 0) {
        if (!user || !credential) {
          toast.error(`This ${details.durationInSeconds}s video costs ${selectedDurationCost} credits — sign in to check your balance.`);
          setLoginPromptOpen(true);
          return;
        }
        if (insufficientCredits) {
          toast.error(`This ${details.durationInSeconds}s video costs ${selectedDurationCost} credits. Top up to continue.`);
          setResumeRenderAfterTopUp(false);
          setTopUpOpen(true);
          return;
        }
      }
    }
    if (currentStepKey === "images") {
      if (photos.length < minImages) {
        toast.error(`Add at least ${minImages} photo${minImages > 1 ? "s" : ""} to continue`);
        return;
      }
      if (missingCaption) {
        toast.error("Add a message for every photo before continuing");
        return;
      }
    }
    setWizardStep((step) => Math.min(wizardSteps.length - 1, step + 1));
  };

  const goBack = () => setWizardStep((step) => Math.max(0, step - 1));

  useEffect(() => {
    const defaults = categoryDefaults[category] || categoryDefaults.Wedding;
    setDetails((current) => ({ ...current, ...defaults }));
    setSchedule(category === "Wedding" ? [...weddingSchedule] : []);
    setFields({});
    setPhotoCaptions([]);
  }, [category]);

  useEffect(() => {
    axios.get(`${API}/categories`).then((r) => setCategoryDefs(r.data)).catch(() => setCategoryDefs([]));
  }, []);

  const refreshWallet = useCallback(() => {
    if (!credential) { setWalletBalance(null); return; }
    axios.get(`${API}/wallet`, { headers: { Authorization: `Bearer ${credential}` } })
      .then((r) => setWalletBalance(r.data.balance))
      .catch(() => {});
  }, [credential]);
  useEffect(() => { refreshWallet(); }, [refreshWallet]);

  useEffect(() => {
    if (!template) { setFormManifest(null); return; }
    let cancelled = false;
    axios.get(`${API}/templates/${template}/form`).then((r) => { if (!cancelled) setFormManifest(r.data); }).catch(() => { if (!cancelled) setFormManifest(null); });
    return () => { cancelled = true; };
  }, [template]);

  // Keep the selected duration valid when the template's allowed durations change.
  useEffect(() => {
    if (!durationOptions.includes(Number(details.durationInSeconds))) {
      setDetails((current) => ({ ...current, durationInSeconds: durationOptions[0] }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [template, manifest]);

  // Seed schema defaults (e.g. a repeater's default rows) once per template,
  // without clobbering anything the user already entered.
  useEffect(() => {
    if (!formSchema) return;
    const defaults = {};
    (formSchema.fields || []).forEach((f) => { if (f.default !== undefined) defaults[f.key] = f.default; });
    if (Object.keys(defaults).length) setFields((current) => ({ ...defaults, ...current }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formSchema]);

  const setFieldValue = (key, value) => setFields((current) => ({ ...current, [key]: value }));

  // If the chosen duration lowers the image cap below what's already selected,
  // trim the extras (and their captions) so the user can't submit too many.
  useEffect(() => {
    if (photos.length > maxImages) {
      setPhotos((cur) => cur.slice(0, maxImages));
      setPhotoCaptions((cur) => cur.slice(0, maxImages));
      toast.info(`A ${details.durationInSeconds}s reel fits up to ${maxImages} photos — extra photos were removed.`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [maxImages]);

  useEffect(() => {
    setMusicId(selectedTemplate?.defaultMusicId || null);
  }, [template, selectedTemplate?.defaultMusicId]);

  useEffect(() => () => clearInterval(pollRef.current), []);

  useEffect(() => {
    let cancelled = false;
    axios
      .get(`${API}/templates`)
      .then((response) => {
        if (cancelled) return;
        const nextTemplates = Array.isArray(response.data) && response.data.length ? response.data : DEFAULT_TEMPLATES;
        setTemplates(nextTemplates);
        setTemplate((current) =>
          nextTemplates.some((item) => item.id === current && item.isActive !== false)
            ? current
            : nextTemplates[0]?.id || "marigold",
        );
      })
      .catch(() => {
        if (!cancelled) setTemplates(DEFAULT_TEMPLATES);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const pollJob = (id) => {
    clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      try {
        const response = await axios.get(`${API}/renders/${id}`);
        const { status, progress, error } = response.data;
        setJobStatus(status);
        setJobProgress(Number(progress) || 0);
        if (status === "done") {
          clearInterval(pollRef.current);
          setVideoUrl(`${BACKEND_URL}${response.data.video_url}?t=${Date.now()}`);
          toast.success("Your invitation video is ready");
          refreshWallet(); // paid renders capture the hold on success — reflect the spend
        } else if (status === "failed") {
          clearInterval(pollRef.current);
          toast.error(error || "Render failed");
          refreshWallet(); // failed renders release the hold — balance is back
        }
      } catch {
        // Transient errors are ignored while the render service is working.
      }
    }, 2000);
  };

  const submitRender = useCallback(async () => {
    setVideoUrl(null);
    setJobProgress(0);
    setJobStatus("queued");
    try {
      const recaptchaToken = await executeRecaptcha();
      const tags = String(details.tags || "")
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean)
        .slice(0, 12);
      const payload = isDataDriven
        ? {
            template,
            category,
            fields,
            // Shared photo step only: Timeline carries its images inside `fields`.
            ...(usesPhotoStep ? { images: photos.map((url, index) => ({ imageUrl: url, text: photoCaptions[index] || "" })) } : {}),
            musicId: musicId || null,
            customMusicUrl: musicId === "my-music" ? customMusicUrl || undefined : undefined,
            // perScreen templates derive length from screen count (server re-computes authoritatively).
            durationInSeconds: durationMode === "perScreen" ? derivedDuration : Number(details.durationInSeconds) || 30,
            tags,
            recaptchaToken,
          }
        : {
            template,
            couple: { partnerOne: details.partnerOne, partnerTwo: details.partnerTwo },
            eventDate: details.eventDate,
            venue: { name: details.venueName, city: details.venueCity },
            message: details.message,
            displayMessage: details.displayMessage,
            photos,
            musicId: musicId || null,
            customMusicUrl: musicId === "my-music" ? customMusicUrl || undefined : undefined,
            schedule: category === "Engagement" ? [{ name: "Engagement", time: details.eventDate }] : category === "Birthday" ? [] : schedule,
            durationInSeconds: Number(details.durationInSeconds) || 30,
            tags,
            recaptchaToken,
          };
      const response = await axios.post(`${API}/renders`, payload, {
        headers: { Authorization: `Bearer ${credential}` },
      });
      setJobId(response.data.jobId);
      toast.info("Render queued — this can take a couple of minutes");
      pollJob(response.data.jobId);
    } catch (error) {
      setJobStatus("failed");
      if (error?.response?.status === 401) {
        // Session expired mid-flow: clear the stale credential so the resume
        // effect's `!credential` guard blocks the retry loop, and re-prompt.
        // Form state is preserved (it lives outside auth), so the render resumes
        // automatically once the user signs in again.
        signOut({ silent: true });
        setResumeRenderAfterLogin(true);
        setLoginPromptOpen(true);
        toast.error("Please sign in again to render your video");
      } else if (!error?.response && error?.message?.includes("reCAPTCHA")) {
        toast.error("Security check could not be completed. Please refresh and try again.");
      } else {
        // Most endpoints return a string `detail`; the credit-gate (402) on
        // /renders returns a structured {message, required, balance} instead
        // so the client can also read the numbers — render only the message.
        const detail = error?.response?.data?.detail;
        const message = typeof detail === "string" ? detail : detail?.message;
        toast.error(message || "Failed to queue render");
      }
    }
  }, [credential, template, details, photos, musicId, customMusicUrl, schedule, category, signOut, isDataDriven, fields, photoCaptions, usesPhotoStep, durationMode, derivedDuration]);

  const handleRender = async () => {
    if (!isDataDriven && (!details.partnerOne.trim() || !details.partnerTwo.trim())) {
      toast.error("Both partner names are required");
      return;
    }
    // Categories with in-form images (e.g. Timeline) have no shared photo step;
    // their required-image validation happens per-field instead.
    if (isDataDriven) {
      const missing = validateDataDrivenFields(formSchema?.fields || [], fields);
      if (missing) {
        toast.error(missing);
        return;
      }
    }
    if (usesPhotoStep && photos.length < minImages) {
      toast.error(`Add at least ${minImages} photo${minImages > 1 ? "s" : ""} before rendering`);
      return;
    }
    if (usesPhotoStep && missingCaption) {
      toast.error("Add a message for every photo before rendering");
      return;
    }
    // Proactively catch an expired/stale session before hitting the API, so we
    // redirect to login instead of firing a doomed request. Details are kept.
    if (!user || !credential || isTokenExpired(credential)) {
      if (credential && isTokenExpired(credential)) signOut({ silent: true });
      setResumeRenderAfterLogin(true);
      setLoginPromptOpen(true);
      return;
    }
    // Last-chance client-side check (the server re-checks and is the real
    // gate) — catches a balance that changed since the Details step.
    if (insufficientCredits) {
      toast.error(`This ${details.durationInSeconds}s video costs ${selectedDurationCost} credits. Top up to continue.`);
      setResumeRenderAfterTopUp(true);
      setTopUpOpen(true);
      return;
    }
    await submitRender();
  };

  // Called by CreditTopUpModal once /payments/verify confirms the top-up.
  // Uses the freshly-verified balance directly (not the stale `walletBalance`
  // closure). If the gate that opened the modal was the final "Generate"
  // click, resume straight into the render; if it was the Details step's
  // Continue click, just advance past it.
  const handleTopUpSuccess = (newBalance) => {
    setWalletBalance(newBalance);
    setTopUpOpen(false);
    const sufficientNow = selectedDurationCost <= newBalance;
    if (resumeRenderAfterTopUp) {
      setResumeRenderAfterTopUp(false);
      if (sufficientNow) submitRender();
      return;
    }
    if (sufficientNow) {
      setWizardStep((step) => Math.min(wizardSteps.length - 1, step + 1));
    }
  };

  // "Create New Reel" — clear the finished render and the form, back to step 1.
  const handleReset = () => {
    clearInterval(pollRef.current);
    setVideoUrl(null);
    setJobId(null);
    setJobStatus("idle");
    setJobProgress(0);
    setPhotos([]);
    setPhotoCaptions([]);
    setFields({});
    setWizardStep(0);
  };

  useEffect(() => {
    if (!user || !credential || !resumeRenderAfterLogin) return;
    setResumeRenderAfterLogin(false);
    setLoginPromptOpen(false);
    submitRender();
  }, [user, credential, resumeRenderAfterLogin, submitRender]);

  return (
    <MarketingLayout>
      <main>
        <Dialog open={loginPromptOpen} onOpenChange={setLoginPromptOpen}>
          <DialogContent className="max-w-md rounded-3xl border-[#EBD3E0] bg-white p-0 shadow-[0_24px_80px_rgba(50,17,58,0.22)]">
            <div className="rounded-t-3xl bg-[#FFF6FA] px-6 py-5">
              <DialogHeader>
                <DialogTitle className="font-heading text-2xl font-extrabold text-[#32113A]">
                  Sign in to render your video
                </DialogTitle>
                <DialogDescription className="pt-2 leading-6 text-neutral-600">
                  Use Google to create or access your account. After login, your video render will start automatically.
                </DialogDescription>
              </DialogHeader>
            </div>
            <div className="px-6 pb-6">
              <div className="rounded-2xl border border-[#ECD5E2] bg-white p-4">
                <div className="section-label text-left text-[#9B256D]">Login / Register</div>
                <p className="mb-4 mt-2 text-sm leading-6 text-neutral-500">
                  We will save this render against your Google account so you can track how many invitation videos you create.
                </p>
                <GoogleSignInButton className="min-h-[40px]" text="continue_with" />
              </div>
            </div>
          </DialogContent>
        </Dialog>
        <CreditTopUpModal
          open={topUpOpen}
          onClose={() => { setTopUpOpen(false); setResumeRenderAfterTopUp(false); }}
          credential={credential}
          userEmail={user?.email}
          requiredCredits={selectedDurationCost}
          onSuccess={handleTopUpSuccess}
        />
        <section className="relative overflow-hidden border-b border-[#EBDDE5] bg-[#FFF7FB] px-5 py-5 lg:px-10">
          <div className="absolute -left-24 -top-28 h-56 w-56 rounded-full bg-[#F6B6D4]/35 blur-3xl" aria-hidden="true" />
          <div className="absolute -right-20 top-0 h-60 w-60 rounded-full bg-[#F7CE7A]/25 blur-3xl" aria-hidden="true" />
          <div className="relative mx-auto flex max-w-7xl flex-col justify-between gap-5 lg:flex-row lg:items-center">
            <div className="max-w-2xl">
              <div className="section-label text-[#9B256D]">Create Video</div>
              <h1 className="mt-1 font-heading text-3xl font-extrabold tracking-tight text-[#32113A] sm:text-4xl">
                Build, preview and render your invitation.
              </h1>
              <p className="mt-2 max-w-xl text-sm leading-6 text-neutral-600">
                Fill the essentials, choose a style, add memories and render a vertical {category.toLowerCase()} invitation video ready to share.
              </p>
            </div>
            <div className="grid grid-cols-3 gap-2 rounded-2xl border border-[#EBD3E0] bg-white/80 p-2 text-center shadow-[0_12px_40px_rgba(81,25,62,0.06)] backdrop-blur sm:min-w-[390px]">
              {[
                ["Template", template],
                ["Photos", `${photos.length}/${maxImages}`],
                ["Events", category === "Engagement" ? 1 : category === "Birthday" ? 0 : schedule.length],
              ].map(([label, value]) => (
                <div key={label} className="rounded-xl bg-[#FFF8FB] px-3 py-2">
                  <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-neutral-400">{label}</div>
                  <div className="mt-1 truncate font-heading text-lg font-extrabold text-[#32113A]">{value}</div>
                </div>
              ))}
            </div>
          </div>
        </section>
        <section className="mx-auto grid max-w-7xl grid-cols-1 gap-5 px-5 py-5 lg:grid-cols-[minmax(0,1fr)_360px] lg:gap-6 lg:px-10 lg:py-7 xl:grid-cols-[minmax(0,1fr)_390px]">
          <div className="space-y-4">
            <div className="rounded-2xl border border-[#ECD5E2] bg-white p-4 shadow-[0_14px_46px_rgba(81,25,62,0.05)] sm:p-5">
              {user ? (
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-3">
                    {user.picture ? (
                      <img src={user.picture} alt="" className="h-11 w-11 rounded-full object-cover" referrerPolicy="no-referrer" />
                    ) : (
                      <span className="flex h-11 w-11 items-center justify-center rounded-full bg-[#F8EAF2] font-bold text-[#A4176D]">
                        {(user.name || user.email || "U").slice(0, 1).toUpperCase()}
                      </span>
                    )}
                    <div>
                      <div className="section-label text-left text-[#9B256D]">Signed in</div>
                      <div className="font-heading text-xl font-extrabold text-[#32113A]">{user.name || "Google account"}</div>
                      <div className="text-sm text-neutral-500">{user.email}</div>
                    </div>
                  </div>
                  <span className="inline-flex w-fit rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                    Your invitation can be linked to this account
                  </span>
                </div>
              ) : (
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="section-label text-left text-[#9B256D]">Google Login</div>
                    <h2 className="mt-1 font-heading text-2xl font-extrabold text-[#32113A]">Sign in to keep your invitation workspace ready.</h2>
                    <p className="mt-1 text-sm leading-6 text-neutral-500">
                      You can still test the creator, but signing in lets us connect future saves, downloads and account history to you.
                    </p>
                  </div>
                  <GoogleSignInButton className="min-h-[40px] shrink-0" />
                </div>
              )}
            </div>
            <div className="rounded-2xl border border-[#ECD5E2] bg-white p-4 shadow-[0_14px_46px_rgba(81,25,62,0.05)] sm:p-5">
              <div className="mb-6 rounded-2xl bg-[#FFF8FB] p-3 sm:p-4">
                <div className="flex items-start justify-between gap-2">
                  {wizardSteps.map((step, index) => {
                    const complete = index < wizardStep;
                    const current = index === wizardStep;
                    return (
                      <button
                        key={step.label}
                        type="button"
                        onClick={() => index <= wizardStep && setWizardStep(index)}
                        className="group flex min-w-0 flex-1 flex-col items-center gap-2 text-center"
                        aria-current={current ? "step" : undefined}
                      >
                        <span className={`flex h-9 w-9 items-center justify-center rounded-full border text-sm font-extrabold transition ${
                          current ? "border-[#C80A76] bg-[#C80A76] text-white shadow-md" : complete ? "border-[#A4176D] bg-[#F8EAF2] text-[#A4176D]" : "border-[#E8C9DB] bg-white text-neutral-400"
                        }`}>{complete ? "✓" : index + 1}</span>
                        <span className={`text-[10px] font-bold uppercase tracking-[0.12em] sm:text-xs ${current ? "text-[#A4176D]" : "text-neutral-400"}`}>{step.label}</span>
                      </button>
                    );
                  })}
                </div>
                <div className="mt-3 h-1 overflow-hidden rounded-full bg-[#EBD3E0]">
                  <div className="h-full rounded-full bg-gradient-to-r from-[#6012A8] via-[#C80A76] to-[#E66B24] transition-all duration-300" style={{ width: `${(wizardStep / (wizardSteps.length - 1)) * 100}%` }} />
                </div>
              </div>

              <div className="mb-5">
                <div className="section-label text-left text-[#9B256D]">Step {wizardStep + 1} of {wizardSteps.length}</div>
                <h2 className="mt-1 font-heading text-2xl font-extrabold text-[#32113A]">{wizardSteps[wizardStep].title}</h2>
                <p className="mt-1 text-sm text-neutral-500">{wizardSteps[wizardStep].hint}</p>
              </div>

              {currentStepKey === "category" && <>
                <TemplatePicker value={template} onChange={setTemplate} templates={templates} categoryTypes={categoryTypes} />
                {templateHasPaidDurations && (
                  <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                    Reels in this template are paid for some durations — longer videos may require credits.
                  </div>
                )}
              </>}
              {currentStepKey === "details" && <div className="space-y-5">
                {isDataDriven ? (
                  <>
                    <DynamicForm schema={formSchema} values={fields} onChange={setFieldValue} />
                    {durationMode === "perScreen" ? (
                      <div className="rounded-xl border border-[#ECD5E2] bg-[#FFF8FB] px-4 py-3 text-sm text-neutral-600">
                        Your timeline has <strong className="text-[#32113A]">{timelineItems.length}</strong> moment{timelineItems.length === 1 ? "" : "s"} — including the opening and closing, that's a <strong className="text-[#32113A]">~{derivedDuration}s</strong> video. Length adjusts automatically as you add or remove moments.
                      </div>
                    ) : (
                    <fieldset className="space-y-2">
                      <legend className="mb-1 block text-xs font-medium uppercase tracking-[0.1em] text-neutral-500">Video length</legend>
                      <div className="grid grid-cols-3 gap-2">
                        {durationOptions.map((seconds) => {
                          const selected = Number(details.durationInSeconds) === Number(seconds);
                          const cap = Number(imagesPerDuration[String(seconds)]) || overallMaxImages;
                          const cost = Number(pricingByDuration[String(seconds)] ?? pricingDefault);
                          return (
                            <button
                              type="button"
                              key={seconds}
                              onClick={() => setDetails((cur) => ({ ...cur, durationInSeconds: Number(seconds) }))}
                              className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 text-left text-sm transition ${selected ? "border-[#C80A76] bg-[#FFF0F7]" : "border-[#ECD5E2] bg-white hover:border-[#D9A9C6]"}`}
                            >
                              <span className={`flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full border ${selected ? "border-[#C80A76]" : "border-neutral-400"}`}>
                                {selected && <span className="h-2 w-2 rounded-full bg-[#C80A76]" />}
                              </span>
                              <span>
                                <span className="font-semibold text-[#32113A]">{seconds}s</span>
                                <span className="block text-[11px] text-neutral-500">up to {cap} photos · {cost > 0 ? `${cost} credits` : "free"}</span>
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </fieldset>
                    )}
                  </>
                ) : (
                  <>
                    <DetailsForm details={details} onChange={setDetails} category={category} isShowcase={template === "showcase" && category === "Wedding"} durationOptions={durationOptions} pricingByDuration={pricingByDuration} pricingDefault={pricingDefault} />
                    {category === "Wedding" && <div className="border-t border-[#ECD5E2] pt-5"><ScheduleBuilder schedule={schedule} onChange={setSchedule} /></div>}
                  </>
                )}
                {selectedDurationCost > 0 && (
                  <div className={`rounded-xl border px-4 py-3 text-sm ${insufficientCredits ? "border-red-200 bg-red-50 text-red-700" : "border-emerald-200 bg-emerald-50 text-emerald-700"}`}>
                    {insufficientCredits ? (
                      <>
                        This {details.durationInSeconds}s video costs {selectedDurationCost} credits.{" "}
                        {walletBalance == null ? "Sign in to check your credit balance." : `You have ${walletBalance}.`}{" "}
                        <button type="button" onClick={() => { setResumeRenderAfterTopUp(false); setTopUpOpen(true); }} className="font-bold underline">Top up credits</button>
                      </>
                    ) : (
                      <>This {details.durationInSeconds}s video costs {selectedDurationCost} credits — you have {walletBalance} available.</>
                    )}
                  </div>
                )}
              </div>}
              {currentStepKey === "images" && (
                <PhotoUploader
                  photos={photos}
                  onChange={setPhotos}
                  maxImages={maxImages}
                  minImages={minImages}
                  captionPerImage={captionPerImage}
                  captions={photoCaptions}
                  onCaptionsChange={setPhotoCaptions}
                  captionMaxLength={captionMaxLength}
                />
              )}
              {currentStepKey === "music" && <MusicPicker value={musicId} onChange={setMusicId} category={category} customMusicUrl={customMusicUrl} onCustomMusicUrlChange={setCustomMusicUrl} />}

              <div className="mt-7 flex items-center justify-between gap-3 border-t border-[#ECD5E2] pt-5">
                <button type="button" onClick={goBack} disabled={wizardStep === 0} className="rounded-full border border-[#E8C9DB] px-5 py-2.5 text-sm font-bold text-[#8D1B63] transition hover:bg-[#FFF0F7] disabled:cursor-not-allowed disabled:opacity-35">Back</button>
                {wizardStep < wizardSteps.length - 1 ? (
                  <button type="button" onClick={goNext} className="rounded-full bg-[#C80A76] px-6 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-[#A4176D]">Continue <span aria-hidden="true">→</span></button>
                ) : (
                  <button type="button" onClick={() => setWizardStep(0)} className="rounded-full border border-[#E8C9DB] px-5 py-2.5 text-sm font-bold text-[#8D1B63] transition hover:bg-[#FFF0F7]">Edit category</button>
                )}
              </div>
            </div>
          </div>
          <div>
            <PreviewPane
              rendering={rendering}
              status={jobStatus}
              progress={jobProgress}
              jobId={jobId}
              videoUrl={videoUrl}
              onRender={handleRender}
              onReset={handleReset}
              canRender={usesPhotoStep ? photos.length >= minImages : timelineItems.length >= Number(timelineCfg.minItems || 1)}
              renderHint={usesPhotoStep ? `Add at least ${minImages} photo${minImages > 1 ? "s" : ""} to render` : `Add at least ${Number(timelineCfg.minItems || 1)} timeline moments to render`}
            />
          </div>
        </section>
      </main>
    </MarketingLayout>
  );
}

function AboutPage() {
  return (
    <MarketingLayout>
      <main>
        <section className="overflow-hidden px-6 py-16 lg:px-10 lg:py-24">
          <div className="mx-auto grid max-w-7xl items-center gap-12 lg:grid-cols-2">
            <div>
              <div className="section-label text-[#9B256D]">About us</div>
              <h1 className="mt-4 font-heading text-5xl font-extrabold leading-[1.02] tracking-tight text-[#32113A] sm:text-6xl">Wedding invitations deserve more than a template and a date.</h1>
              <p className="mt-6 text-lg leading-8 text-neutral-600">
                Invita Videos helps couples turn the details of their celebration into a personal video story—one that feels warm, thoughtful and easy to share.
              </p>
              <p className="mt-4 text-lg leading-8 text-neutral-600">
                We bring together design, motion, music and your own memories in a simple creation experience, so you can focus on the celebration instead of learning complicated editing software.
              </p>
            </div>
            <div className="relative rounded-[2rem] bg-gradient-to-br from-[#4D159D] via-[#C60B75] to-[#EF8D22] p-[1px] shadow-[0_24px_70px_rgba(95,22,82,0.2)]">
              <div className="rounded-[calc(2rem-1px)] bg-[#FFF9FC] p-8 sm:p-10">
                <Heart className="h-10 w-10 text-[#C10D73]" aria-hidden="true" />
                <div className="mt-8 font-heading text-3xl font-extrabold text-[#32113A]">Our purpose</div>
                <p className="mt-4 text-lg leading-8 text-neutral-600">Make every couple feel that their invitation reflects them—not just their event details.</p>
                <div className="mt-8 border-t border-[#E9D2DF] pt-8">
                  <div className="font-heading text-3xl font-extrabold text-[#32113A]">Our approach</div>
                  <p className="mt-4 text-lg leading-8 text-neutral-600">Thoughtful design, useful choices and a clear path from idea to share-ready video.</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="bg-[#FFF4F9] px-6 py-16 lg:px-10 lg:py-24">
          <div className="mx-auto max-w-7xl">
            <div className="max-w-2xl">
              <div className="section-label text-[#9B256D]">What matters to us</div>
              <h2 className="mt-3 font-heading text-4xl font-extrabold text-[#32113A]">Built around the people celebrating.</h2>
            </div>
            <div className="mt-10 grid gap-5 md:grid-cols-3">
              {[
                [Users, "Easy for everyone", "A clear, approachable experience—no professional editing knowledge required."],
                [Sparkles, "Beautiful with purpose", "Every visual choice should make the story clearer, warmer and more memorable."],
                [Clapperboard, "Made for motion", "Invitations designed from the beginning for the way people watch and share today."],
              ].map(([Icon, title, copy]) => (
                <article key={title} className="rounded-3xl border border-[#ECD5E2] bg-white p-7">
                  <Icon className="h-6 w-6 text-[#AE1A70]" aria-hidden="true" />
                  <h3 className="mt-5 font-heading text-2xl font-extrabold text-[#32113A]">{title}</h3>
                  <p className="mt-3 leading-7 text-neutral-600">{copy}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="px-6 py-16 text-center lg:px-10 lg:py-24">
          <h2 className="font-heading text-4xl font-extrabold text-[#32113A]">Ready to tell your story?</h2>
          <Link to="/create-video" className="mt-7 inline-flex items-center gap-2 rounded-full bg-[#32113A] px-6 py-3.5 font-semibold text-white transition hover:-translate-y-0.5 hover:bg-[#52184D]">
            Create your invitation <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </section>
      </main>
    </MarketingLayout>
  );
}

const ADMIN_TABS = [
  ["/admin", "Dashboard"],
  ["/admin/templates", "Templates"],
  ["/admin/template-settings", "Template settings"],
  ["/admin/credit-packs", "Credit packs"],
  ["/admin/categories", "Category forms"],
  ["/admin/users", "Users"],
  ["/admin/renders", "Video renders"],
  ["/admin/settings", "Settings"],
];

function AdminTabs() {
  return <nav className="mb-6 flex flex-wrap gap-2 rounded-2xl border border-[#ECD5E2] bg-white p-2 shadow-[0_10px_30px_rgba(81,25,62,0.05)]" aria-label="Admin portal">
    {ADMIN_TABS.map(([path, label]) => <NavLink key={path} to={path} end={path === "/admin"} className={({ isActive }) => `rounded-xl px-4 py-2.5 text-sm font-semibold transition ${isActive ? "bg-[#32113A] text-white shadow-sm" : "text-[#8D1B63] hover:bg-[#FFF0F7]"}`}>{label}</NavLink>)}
  </nav>;
}

function AdminPageFrame({ eyebrow, title, description, children }) {
  return <MarketingLayout><main className="px-6 py-12 lg:px-10 lg:py-16"><section className="mx-auto max-w-7xl"><AdminTabs /><div className="rounded-[2rem] border border-[#ECD5E2] bg-[#FFF7FB] p-7 sm:p-9"><div className="section-label text-left text-[#9B256D]">Admin · {eyebrow}</div><h1 className="mt-2 font-heading text-4xl font-extrabold tracking-tight text-[#32113A] sm:text-5xl">{title}</h1><p className="mt-3 max-w-3xl text-sm leading-6 text-neutral-600">{description}</p></div>{children}</section></main></MarketingLayout>;
}

function AdminGate({ children }) {
  const { user } = useAuth();
  return isAdminUser(user) ? children : <NotFoundPage />;
}

function RequireUserGate({ children }) {
  const { user } = useAuth();
  if (user) return children;
  return (
    <MarketingLayout>
      <main className="px-6 py-16 lg:px-10">
        <section className="mx-auto max-w-lg rounded-3xl border border-[#ECD5E2] bg-white p-8 text-center shadow-[0_14px_46px_rgba(81,25,62,0.05)]">
          <div className="section-label text-[#9B256D]">Sign in required</div>
          <h1 className="mt-2 font-heading text-3xl font-extrabold text-[#32113A]">Sign in to continue</h1>
          <p className="mt-3 text-sm leading-6 text-neutral-600">Sign in with Google to see your videos and purchase history.</p>
          <div className="mt-6 flex justify-center"><GoogleSignInButton className="min-h-[40px]" text="continue_with" /></div>
        </section>
      </main>
    </MarketingLayout>
  );
}

function MyDownloadsPage() {
  const { credential } = useAuth();
  const [renders, setRenders] = useState(null);
  const authHeader = useMemo(() => ({ headers: { Authorization: `Bearer ${credential}` } }), [credential]);

  useEffect(() => {
    axios.get(`${API}/renders/mine`, authHeader).then((r) => setRenders(r.data)).catch(() => setRenders([]));
  }, [authHeader]);

  const daysLeft = (expiresAt) => {
    if (!expiresAt) return null;
    return Math.ceil((new Date(expiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  };

  return (
    <MarketingLayout>
      <main className="px-6 py-12 lg:px-10 lg:py-16">
        <section className="mx-auto max-w-5xl">
          <div className="section-label text-left text-[#9B256D]">My Downloads</div>
          <h1 className="mt-2 font-heading text-4xl font-extrabold tracking-tight text-[#32113A] sm:text-5xl">Your invitation videos</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-neutral-600">
            Videos stay downloadable for 10 days after they finish rendering. Once a video expires, the file is removed from our servers and can't be recovered — download it before then.
          </p>
          <div className="mt-8 space-y-4">
            {renders === null && <div className="rounded-3xl border border-[#ECD5E2] bg-white p-8 text-sm text-neutral-500">Loading your videos…</div>}
            {renders !== null && !renders.length && (
              <div className="rounded-3xl border border-[#ECD5E2] bg-white p-8 text-sm text-neutral-500">
                You haven't created any videos yet. <Link to="/create-video" className="font-semibold text-[#8D1B63] underline">Create one now</Link>.
              </div>
            )}
            {renders?.map((r) => {
              const left = daysLeft(r.expiresAt);
              const isDone = r.status === "done";
              return (
                <div key={r.id} className="flex flex-col gap-3 rounded-3xl border border-[#ECD5E2] bg-white p-5 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="font-heading text-lg font-extrabold capitalize text-[#32113A]">
                      {r.template} <span className="ml-2 rounded-full bg-[#FFF3F8] px-2.5 py-0.5 text-xs font-semibold text-[#8D1B63]">{r.durationInSeconds}s</span>
                    </div>
                    <div className="mt-1 text-xs text-neutral-500">
                      Created {r.created_at ? new Date(r.created_at).toLocaleString() : "—"} · {r.creditCost > 0 ? `${r.creditCost} credits` : "Free"}
                    </div>
                    <div className="mt-1 text-xs">
                      {r.expired ? (
                        <span className="font-semibold text-red-600">Expired — file removed</span>
                      ) : isDone && r.expiresAt ? (
                        <span className={left <= 2 ? "font-semibold text-amber-600" : "text-neutral-500"}>
                          {left > 0 ? `Expires in ${left} day${left === 1 ? "" : "s"}` : "Expires today"}
                        </span>
                      ) : (
                        <span className="capitalize text-neutral-500">{r.status}</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {isDone && !r.expired ? (
                      <>
                        <a href={`${BACKEND_URL}${r.video_url}`} target="_blank" rel="noreferrer" className="rounded-full border border-[#ECD5E2] px-4 py-2 text-xs font-bold text-[#8D1B63] hover:bg-[#FFF0F7]">Preview</a>
                        <a href={`${BACKEND_URL}${r.video_url}?download=true`} className="rounded-full bg-[#C80A76] px-4 py-2 text-xs font-bold text-white hover:bg-[#A4176D]">Download</a>
                      </>
                    ) : (
                      <span className="rounded-full border border-[#ECD5E2] px-4 py-2 text-xs font-bold text-neutral-400">{r.expired ? "Unavailable" : "Not ready"}</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </main>
    </MarketingLayout>
  );
}

function MyOrdersPage() {
  const { credential } = useAuth();
  const [payments, setPayments] = useState(null);
  const authHeader = useMemo(() => ({ headers: { Authorization: `Bearer ${credential}` } }), [credential]);

  useEffect(() => {
    axios.get(`${API}/payments/mine`, authHeader).then((r) => setPayments(r.data)).catch(() => setPayments([]));
  }, [authHeader]);

  const formatAmount = (amount, currency) => `${currency === "USD" ? "$" : "₹"}${(Number(amount || 0) / 100).toFixed(2)}`;
  const statusStyles = { paid: "bg-emerald-50 text-emerald-700", created: "bg-amber-50 text-amber-700", failed: "bg-red-50 text-red-700" };

  return (
    <MarketingLayout>
      <main className="px-6 py-12 lg:px-10 lg:py-16">
        <section className="mx-auto max-w-4xl">
          <div className="section-label text-left text-[#9B256D]">My Orders</div>
          <h1 className="mt-2 font-heading text-4xl font-extrabold tracking-tight text-[#32113A] sm:text-5xl">Your purchase history</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-neutral-600">Every credit pack you've purchased, and what it added to your wallet.</p>
          <div className="mt-8 overflow-hidden rounded-3xl border border-[#ECD5E2] bg-white">
            {payments === null && <div className="p-8 text-sm text-neutral-500">Loading your orders…</div>}
            {payments !== null && !payments.length && (
              <div className="p-8 text-sm text-neutral-500">
                No purchases yet. <Link to="/create-video" className="font-semibold text-[#8D1B63] underline">Create a video</Link> to see paid-duration options.
              </div>
            )}
            <div className="divide-y divide-[#F0DDE7]">
              {payments?.map((p) => (
                <div key={p.id} className="flex flex-col gap-2 px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="font-semibold text-[#32113A]">{p.packName} · {p.credits} credits</div>
                    <div className="text-xs text-neutral-500">{p.created_at ? new Date(p.created_at).toLocaleString() : ""}</div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-semibold text-[#32113A]">{formatAmount(p.amount, p.currency)}</span>
                    <span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusStyles[p.status] || "bg-neutral-100 text-neutral-600"}`}>{p.status}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>
    </MarketingLayout>
  );
}

const FIELD_TYPES = ["text", "textarea", "date", "select", "repeater"];

function AdminTemplateSettingsPage() {
  const { credential } = useAuth();
  const [templates, setTemplates] = useState(null);
  const [drafts, setDrafts] = useState({}); // id -> editable settings draft
  const [savingId, setSavingId] = useState(null);
  const [jsonId, setJsonId] = useState(null);
  const [jsonText, setJsonText] = useState("");
  const authHeader = useMemo(() => ({ headers: { Authorization: `Bearer ${credential}` } }), [credential]);

  const load = useCallback(() => {
    axios.get(`${API}/admin/templates`, authHeader).then((r) => {
      setTemplates(r.data);
      const next = {};
      r.data.forEach((t) => {
        const s = t.settings || {};
        next[t.id] = { maxImages: s.maxImages ?? 6, maxSlides: s.maxSlides ?? 6, durations: (s.durations || [10, 20, 30]).join(", "), captionPerImage: Boolean(s.captionPerImage), imagesPerDuration: { ...(s.imagesPerDuration || {}) }, pricingByDuration: { ...((s.pricing || {}).byDuration || {}) }, customMusicFallbackUrl: s.customMusicFallbackUrl || "", raw: s };
      });
      setDrafts(next);
    }).catch(() => setTemplates([]));
  }, [authHeader]);
  useEffect(() => { load(); }, [load]);

  const updateDraft = (id, patch) => setDrafts((d) => ({ ...d, [id]: { ...d[id], ...patch } }));

  const save = async (t) => {
    const d = drafts[t.id];
    const durations = String(d.durations).split(",").map((x) => Number(x.trim())).filter((x) => Number.isFinite(x) && x > 0);
    if (!durations.length) return toast.error("Enter at least one duration (e.g. 10, 20, 30)");
    // Merge structured edits over the raw object so advanced keys (message
    // capabilities) survive untouched.
    // Keep only per-duration caps for durations that still exist and have a value.
    const imagesPerDuration = {};
    durations.forEach((sec) => {
      const v = Number((d.imagesPerDuration || {})[String(sec)]);
      if (Number.isFinite(v) && v > 0) imagesPerDuration[String(sec)] = v;
    });
    const pricingByDuration = {};
    durations.forEach((sec) => {
      const v = Number((d.pricingByDuration || {})[String(sec)]);
      if (Number.isFinite(v) && v >= 0) pricingByDuration[String(sec)] = v;
    });
    const customMusicFallbackUrl = String(d.customMusicFallbackUrl || "").trim();
    if (customMusicFallbackUrl && !customMusicFallbackUrl.startsWith("https://")) {
      return toast.error("Fallback music URL must start with https://");
    }
    const settings = { ...d.raw, maxImages: Number(d.maxImages) || 1, maxSlides: Number(d.maxSlides) || 1, durations, captionPerImage: Boolean(d.captionPerImage), imagesPerDuration, pricing: { default: 0, byDuration: pricingByDuration }, customMusicFallbackUrl };
    setSavingId(t.id);
    try {
      await axios.patch(`${API}/admin/templates/${t.id}/settings`, { settings }, authHeader);
      toast.success(`Settings saved for ${t.name}`);
      load();
    } catch (error) {
      toast.error(error?.response?.data?.detail || "Failed to save settings");
    } finally { setSavingId(null); }
  };

  const openJson = (t) => { setJsonId(t.id); setJsonText(JSON.stringify(drafts[t.id]?.raw || {}, null, 2)); };
  const applyJson = (t) => {
    try {
      const parsed = JSON.parse(jsonText);
      updateDraft(t.id, { raw: parsed, maxImages: parsed.maxImages ?? drafts[t.id].maxImages, maxSlides: parsed.maxSlides ?? drafts[t.id].maxSlides, durations: (parsed.durations || []).join(", ") || drafts[t.id].durations, captionPerImage: Boolean(parsed.captionPerImage), pricingByDuration: (parsed.pricing || {}).byDuration ?? drafts[t.id].pricingByDuration, customMusicFallbackUrl: parsed.customMusicFallbackUrl ?? drafts[t.id].customMusicFallbackUrl });
      setJsonId(null);
      toast.info("JSON applied — press Save to persist");
    } catch { toast.error("Invalid JSON"); }
  };

  const inputClass = "w-full rounded-xl border border-[#ECD5E2] bg-white px-3 py-2 text-sm text-[#32113A] outline-none focus:border-[#B4405F]";

  return <AdminPageFrame eyebrow="Template settings" title="Template settings" description="Per-template video limits: how many images users can add, how many slides the video plays, allowed durations, whether each image carries its own caption, and the credit cost to render at each duration.">
    <div className="mt-6 space-y-4">
      {templates === null ? <div className="rounded-3xl border border-[#ECD5E2] bg-white p-8 text-sm text-neutral-500">Loading templates…</div>
        : templates.map((t) => {
          const d = drafts[t.id] || {};
          return (
            <div key={t.id} className="rounded-3xl border border-[#ECD5E2] bg-white p-6">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="font-heading text-xl font-extrabold text-[#32113A]">{t.name} <span className="ml-2 rounded-full bg-[#FFF3F8] px-2.5 py-0.5 text-xs font-semibold text-[#8D1B63]">{t.category}</span></div>
                  <div className="mt-1 text-xs text-neutral-500">{t.id} · {t.renderCount || 0} renders</div>
                </div>
                <button onClick={() => (jsonId === t.id ? setJsonId(null) : openJson(t))} className="rounded-lg border border-[#ECD5E2] px-3 py-1.5 text-xs font-semibold text-[#8D1B63] hover:bg-[#FFF0F7]">{jsonId === t.id ? "Close JSON" : "Advanced (JSON)"}</button>
              </div>
              {jsonId === t.id ? (
                <div className="mt-4">
                  <textarea className={`${inputClass} font-mono`} rows={12} value={jsonText} onChange={(e) => setJsonText(e.target.value)} spellCheck={false} />
                  <button onClick={() => applyJson(t)} className="mt-2 rounded-lg bg-[#32113A] px-4 py-2 text-xs font-semibold text-white">Apply JSON</button>
                </div>
              ) : (
                <div className="mt-4 grid gap-4 sm:grid-cols-5">
                  <label className="text-xs"><span className="mb-1 block font-semibold text-neutral-500">Max images</span><input type="number" min={1} max={12} className={inputClass} value={d.maxImages ?? ""} onChange={(e) => updateDraft(t.id, { maxImages: e.target.value })} /></label>
                  <label className="text-xs"><span className="mb-1 block font-semibold text-neutral-500">Max slides</span><input type="number" min={1} max={24} className={inputClass} value={d.maxSlides ?? ""} onChange={(e) => updateDraft(t.id, { maxSlides: e.target.value })} /></label>
                  <label className="text-xs sm:col-span-2"><span className="mb-1 block font-semibold text-neutral-500">Durations (seconds, comma-separated)</span><input className={inputClass} value={d.durations ?? ""} onChange={(e) => updateDraft(t.id, { durations: e.target.value })} placeholder="10, 20, 30" /></label>
                  <label className="flex items-center gap-2 pt-6 text-xs font-semibold text-[#32113A]"><input type="checkbox" checked={Boolean(d.captionPerImage)} onChange={(e) => updateDraft(t.id, { captionPerImage: e.target.checked })} /> Caption per image</label>
                  <div className="sm:col-span-5">
                    <span className="mb-1 block text-xs font-semibold text-neutral-500">Max images per duration <span className="font-normal text-neutral-400">(blank = use Max images)</span></span>
                    <div className="flex flex-wrap gap-3">
                      {String(d.durations || "").split(",").map((x) => Number(x.trim())).filter((x) => Number.isFinite(x) && x > 0).map((sec) => (
                        <label key={sec} className="text-xs">
                          <span className="mb-1 block text-neutral-500">{sec}s</span>
                          <input
                            type="number" min={1} max={Number(d.maxImages) || 12}
                            className={`${inputClass} w-24`}
                            value={(d.imagesPerDuration || {})[String(sec)] ?? ""}
                            onChange={(e) => updateDraft(t.id, { imagesPerDuration: { ...(d.imagesPerDuration || {}), [String(sec)]: e.target.value } })}
                          />
                        </label>
                      ))}
                    </div>
                  </div>
                  <div className="sm:col-span-5">
                    <span className="mb-1 block text-xs font-semibold text-neutral-500">Credit cost per duration <span className="font-normal text-neutral-400">(0 = free)</span></span>
                    <div className="flex flex-wrap gap-3">
                      {String(d.durations || "").split(",").map((x) => Number(x.trim())).filter((x) => Number.isFinite(x) && x > 0).map((sec) => (
                        <label key={sec} className="text-xs">
                          <span className="mb-1 block text-neutral-500">{sec}s</span>
                          <input
                            type="number" min={0}
                            className={`${inputClass} w-24`}
                            value={(d.pricingByDuration || {})[String(sec)] ?? ""}
                            onChange={(e) => updateDraft(t.id, { pricingByDuration: { ...(d.pricingByDuration || {}), [String(sec)]: e.target.value } })}
                            placeholder="0"
                          />
                        </label>
                      ))}
                    </div>
                  </div>
                  <div className="sm:col-span-5">
                    <span className="mb-1 block text-xs font-semibold text-neutral-500">Fallback music URL <span className="font-normal text-neutral-400">(used when a user picks "My Music" but their link is missing or unreachable)</span></span>
                    <input
                      className={inputClass}
                      value={d.customMusicFallbackUrl ?? ""}
                      onChange={(e) => updateDraft(t.id, { customMusicFallbackUrl: e.target.value })}
                      placeholder="https://example.com/song.mp3"
                    />
                  </div>
                </div>
              )}
              <div className="mt-4 border-t border-[#F0DDE7] pt-3">
                <button disabled={savingId === t.id} onClick={() => save(t)} className="rounded-xl bg-[#32113A] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{savingId === t.id ? "Saving…" : "Save settings"}</button>
              </div>
            </div>
          );
        })}
    </div>
  </AdminPageFrame>;
}

function AdminCreditPacksPage() {
  const { credential } = useAuth();
  const [packs, setPacks] = useState(null);
  const [drafts, setDrafts] = useState({});
  const [savingId, setSavingId] = useState(null);
  const [newId, setNewId] = useState("");
  const authHeader = useMemo(() => ({ headers: { Authorization: `Bearer ${credential}` } }), [credential]);

  const load = useCallback(() => {
    axios.get(`${API}/admin/credit-packs`, authHeader).then((r) => {
      setPacks(r.data);
      const next = {};
      r.data.forEach((p) => {
        next[p.id] = {
          name: p.name,
          credits: p.credits,
          bonusCredits: p.bonusCredits,
          priceINR: p.prices?.INR != null ? p.prices.INR / 100 : "",
          priceUSD: p.prices?.USD != null ? p.prices.USD / 100 : "",
          isActive: p.isActive,
          sortOrder: p.sortOrder,
        };
      });
      setDrafts(next);
    }).catch(() => setPacks([]));
  }, [authHeader]);
  useEffect(() => { load(); }, [load]);

  const updateDraft = (id, patch) => setDrafts((d) => ({ ...d, [id]: { ...d[id], ...patch } }));

  const save = async (id) => {
    const d = drafts[id];
    if (!String(d?.name || "").trim()) return toast.error("Name is required");
    const credits = Number(d.credits);
    if (!Number.isFinite(credits) || credits < 1) return toast.error("Credits must be at least 1");
    const prices = {};
    const inr = Number(d.priceINR);
    const usd = Number(d.priceUSD);
    if (Number.isFinite(inr) && inr > 0) prices.INR = Math.round(inr * 100);
    if (Number.isFinite(usd) && usd > 0) prices.USD = Math.round(usd * 100);
    if (!Object.keys(prices).length) return toast.error("Set at least one price (INR or USD)");
    setSavingId(id);
    try {
      await axios.post(`${API}/admin/credit-packs/${id}`, {
        name: d.name.trim(),
        credits,
        bonusCredits: Number(d.bonusCredits) || 0,
        prices,
        isActive: Boolean(d.isActive),
        sortOrder: Number(d.sortOrder) || 100,
      }, authHeader);
      toast.success(`Saved ${d.name}`);
      load();
    } catch (error) {
      toast.error(error?.response?.data?.detail || "Failed to save pack");
    } finally { setSavingId(null); }
  };

  const addPack = () => {
    const id = newId.trim().toLowerCase().replace(/[^a-z0-9-]/g, "-");
    if (!id) return toast.error("Enter a pack id, e.g. mega");
    if (drafts[id]) return toast.error("A pack with this id already exists");
    updateDraft(id, { name: "", credits: 10, bonusCredits: 0, priceINR: "", priceUSD: "", isActive: true, sortOrder: 100 });
    setNewId("");
  };

  const remove = async (id) => {
    if (!window.confirm("Delete this credit pack? Existing purchases are unaffected.")) return;
    try {
      await axios.delete(`${API}/admin/credit-packs/${id}`, authHeader);
      toast.success("Pack deleted");
      load();
    } catch {
      toast.error("Failed to delete pack");
    }
  };

  const inputClass = "w-full rounded-xl border border-[#ECD5E2] bg-white px-3 py-2 text-sm text-[#32113A] outline-none focus:border-[#B4405F]";

  return <AdminPageFrame eyebrow="Credit packs" title="Credit packs" description="What users buy with real money via RazorPay. Prices are whole currency units (₹ / $); credits are the internal unit spent on paid-duration renders — see Template settings to price each duration.">
    <div className="mt-6 flex flex-wrap items-end gap-3 rounded-3xl border border-[#ECD5E2] bg-white p-6">
      <label className="text-xs"><span className="mb-1 block font-semibold text-neutral-500">New pack id</span><input className={inputClass} value={newId} onChange={(e) => setNewId(e.target.value)} placeholder="mega" /></label>
      <button onClick={addPack} className="rounded-xl bg-[#32113A] px-4 py-2 text-sm font-semibold text-white">Add pack</button>
    </div>
    <div className="mt-4 space-y-4">
      {packs === null && <div className="rounded-3xl border border-[#ECD5E2] bg-white p-8 text-sm text-neutral-500">Loading credit packs…</div>}
      {packs !== null && !Object.keys(drafts).length && <div className="rounded-3xl border border-[#ECD5E2] bg-white p-8 text-sm text-neutral-500">No credit packs yet — add one above.</div>}
      {Object.keys(drafts).map((id) => {
        const d = drafts[id];
        return (
          <div key={id} className="rounded-3xl border border-[#ECD5E2] bg-white p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="font-heading text-xl font-extrabold text-[#32113A]">{id}</div>
              <button onClick={() => remove(id)} className="rounded-lg border border-[#ECD5E2] px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50">Delete</button>
            </div>
            <div className="mt-4 grid gap-4 sm:grid-cols-6">
              <label className="text-xs sm:col-span-2"><span className="mb-1 block font-semibold text-neutral-500">Name</span><input className={inputClass} value={d.name ?? ""} onChange={(e) => updateDraft(id, { name: e.target.value })} /></label>
              <label className="text-xs"><span className="mb-1 block font-semibold text-neutral-500">Credits</span><input type="number" min={1} className={inputClass} value={d.credits ?? ""} onChange={(e) => updateDraft(id, { credits: e.target.value })} /></label>
              <label className="text-xs"><span className="mb-1 block font-semibold text-neutral-500">Bonus credits</span><input type="number" min={0} className={inputClass} value={d.bonusCredits ?? ""} onChange={(e) => updateDraft(id, { bonusCredits: e.target.value })} /></label>
              <label className="text-xs"><span className="mb-1 block font-semibold text-neutral-500">Price (₹ INR)</span><input type="number" min={0} step="0.01" className={inputClass} value={d.priceINR ?? ""} onChange={(e) => updateDraft(id, { priceINR: e.target.value })} /></label>
              <label className="text-xs"><span className="mb-1 block font-semibold text-neutral-500">Price ($ USD)</span><input type="number" min={0} step="0.01" className={inputClass} value={d.priceUSD ?? ""} onChange={(e) => updateDraft(id, { priceUSD: e.target.value })} /></label>
              <label className="text-xs"><span className="mb-1 block font-semibold text-neutral-500">Sort order</span><input type="number" className={inputClass} value={d.sortOrder ?? ""} onChange={(e) => updateDraft(id, { sortOrder: e.target.value })} /></label>
              <label className="flex items-center gap-2 pt-6 text-xs font-semibold text-[#32113A]"><input type="checkbox" checked={Boolean(d.isActive)} onChange={(e) => updateDraft(id, { isActive: e.target.checked })} /> Active (visible to users)</label>
            </div>
            <div className="mt-4 border-t border-[#F0DDE7] pt-3">
              <button disabled={savingId === id} onClick={() => save(id)} className="rounded-xl bg-[#32113A] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{savingId === id ? "Saving…" : "Save pack"}</button>
            </div>
          </div>
        );
      })}
    </div>
  </AdminPageFrame>;
}

function AdminCategoryFormsPage() {
  const { credential } = useAuth();
  const [categories, setCategories] = useState(null);
  const [draft, setDraft] = useState(null); // null = list view; object = editing
  const [jsonMode, setJsonMode] = useState(false);
  const [jsonText, setJsonText] = useState("");
  const [saving, setSaving] = useState(false);
  const authHeader = useMemo(() => ({ headers: { Authorization: `Bearer ${credential}` } }), [credential]);

  const loadCategories = useCallback(() => {
    axios.get(`${API}/admin/categories`, authHeader).then((r) => setCategories(r.data)).catch(() => setCategories([]));
  }, [authHeader]);
  useEffect(() => { loadCategories(); }, [loadCategories]);

  const startNew = () => {
    setJsonMode(false);
    setDraft({ isNew: true, id: null, name: "", type: "personal", icon: "✨", description: "", sortOrder: 100, isActive: true, sharedSteps: ["photos", "music"], fields: [] });
  };
  const startEdit = (cat) => {
    setJsonMode(false);
    setDraft({ isNew: false, id: cat.id, name: cat.name, type: cat.type || "personal", icon: cat.icon || "✨", description: cat.description || "", sortOrder: cat.sortOrder ?? 100, isActive: cat.isActive !== false, sharedSteps: cat.sharedSteps || ["photos", "music"], fields: (cat.form?.fields || []).map((f) => ({ ...f })) });
  };
  const cancel = () => { setDraft(null); setJsonMode(false); };

  const updateField = (index, patch) => setDraft((d) => ({ ...d, fields: d.fields.map((f, i) => (i === index ? { ...f, ...patch } : f)) }));
  const removeField = (index) => setDraft((d) => ({ ...d, fields: d.fields.filter((_, i) => i !== index) }));
  const addField = () => setDraft((d) => ({ ...d, fields: [...d.fields, { key: "", type: "text", label: "", placeholder: "", required: false }] }));

  const enterJsonMode = () => { setJsonText(JSON.stringify({ fields: draft.fields }, null, 2)); setJsonMode(true); };
  const exitJsonMode = () => {
    try {
      const parsed = JSON.parse(jsonText);
      setDraft((d) => ({ ...d, fields: Array.isArray(parsed.fields) ? parsed.fields : d.fields }));
      setJsonMode(false);
    } catch { toast.error("Invalid JSON — fix it before switching back"); }
  };

  const save = async () => {
    if (!draft.name.trim()) return toast.error("Category name is required");
    let form;
    if (jsonMode) {
      try { form = JSON.parse(jsonText); } catch { return toast.error("Invalid JSON in the form editor"); }
    } else {
      form = { fields: draft.fields };
    }
    const payload = { name: draft.name.trim(), type: draft.type || "personal", description: draft.description, icon: draft.icon || "✨", sharedSteps: draft.sharedSteps, isActive: draft.isActive, sortOrder: Number(draft.sortOrder) || 100, form };
    setSaving(true);
    try {
      if (draft.isNew) await axios.post(`${API}/admin/categories`, payload, authHeader);
      else await axios.patch(`${API}/admin/categories/${draft.id}`, payload, authHeader);
      toast.success(`Category ${draft.isNew ? "created" : "updated"}`);
      cancel();
      loadCategories();
    } catch (error) {
      toast.error(error?.response?.data?.detail || "Failed to save category");
    } finally { setSaving(false); }
  };

  const remove = async (cat) => {
    if (!window.confirm(`Delete category "${cat.name}"? This cannot be undone.`)) return;
    try { await axios.delete(`${API}/admin/categories/${cat.id}`, authHeader); toast.success("Category deleted"); loadCategories(); }
    catch (error) { toast.error(error?.response?.data?.detail || "Failed to delete"); }
  };

  const inputClass = "w-full rounded-xl border border-[#ECD5E2] bg-white px-3 py-2 text-sm text-[#32113A] outline-none focus:border-[#B4405F]";

  if (draft) {
    return <AdminPageFrame eyebrow="Category forms" title={draft.isNew ? "New category form" : `Edit: ${draft.name}`} description="Define the fields shown on the Details step for this category. Fields with a capability only appear when the chosen template supports it.">
      <div className="mt-6 space-y-5 rounded-3xl border border-[#ECD5E2] bg-white p-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="text-sm"><span className="mb-1 block font-semibold text-[#32113A]">Name</span><input className={inputClass} value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="Heartfelt" /></label>
          <label className="text-sm"><span className="mb-1 block font-semibold text-[#32113A]">Icon (emoji)</span><input className={inputClass} value={draft.icon} onChange={(e) => setDraft({ ...draft, icon: e.target.value })} placeholder="❤️" /></label>
          <label className="text-sm"><span className="mb-1 block font-semibold text-[#32113A]">Type</span><select className={inputClass} value={draft.type || "personal"} onChange={(e) => setDraft({ ...draft, type: e.target.value })}><option value="invitation">Invitation</option><option value="personal">Personal</option></select></label>
          <label className="text-sm sm:col-span-2"><span className="mb-1 block font-semibold text-[#32113A]">Description</span><input className={inputClass} value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} /></label>
          <label className="text-sm"><span className="mb-1 block font-semibold text-[#32113A]">Sort order</span><input type="number" className={inputClass} value={draft.sortOrder} onChange={(e) => setDraft({ ...draft, sortOrder: e.target.value })} /></label>
          <label className="flex items-center gap-2 pt-6 text-sm font-semibold text-[#32113A]"><input type="checkbox" checked={draft.isActive} onChange={(e) => setDraft({ ...draft, isActive: e.target.checked })} /> Active</label>
        </div>

        <div className="flex items-center justify-between border-t border-[#F0DDE7] pt-4">
          <h3 className="font-heading text-xl font-extrabold text-[#32113A]">Fields</h3>
          <button onClick={jsonMode ? exitJsonMode : enterJsonMode} className="rounded-lg border border-[#ECD5E2] px-3 py-1.5 text-xs font-semibold text-[#8D1B63] hover:bg-[#FFF0F7]">{jsonMode ? "◂ Structured editor" : "Edit as JSON ▸"}</button>
        </div>

        {jsonMode ? (
          <textarea className={`${inputClass} font-mono`} rows={16} value={jsonText} onChange={(e) => setJsonText(e.target.value)} spellCheck={false} />
        ) : (
          <div className="space-y-3">
            {draft.fields.map((f, i) => (
              <div key={i} className="rounded-2xl border border-[#F0DDE7] bg-[#FFF8FB] p-4">
                <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
                  <label className="text-xs"><span className="mb-1 block font-semibold text-neutral-500">Key</span><input className={inputClass} value={f.key || ""} onChange={(e) => updateField(i, { key: e.target.value })} placeholder="celebrantName" /></label>
                  <label className="text-xs"><span className="mb-1 block font-semibold text-neutral-500">Label</span><input className={inputClass} value={f.label || ""} onChange={(e) => updateField(i, { label: e.target.value })} placeholder="Whose birthday?" /></label>
                  <button onClick={() => removeField(i)} className="self-end rounded-lg border border-[#EAB8C6] px-3 py-2 text-xs font-semibold text-[#B4405F] hover:bg-[#FFE9EF]">Remove</button>
                </div>
                <div className="mt-3 grid gap-3 sm:grid-cols-4">
                  <label className="text-xs"><span className="mb-1 block font-semibold text-neutral-500">Type</span><select className={inputClass} value={f.type || "text"} onChange={(e) => updateField(i, { type: e.target.value })}>{FIELD_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}</select></label>
                  <label className="text-xs"><span className="mb-1 block font-semibold text-neutral-500">Placeholder</span><input className={inputClass} value={f.placeholder || ""} onChange={(e) => updateField(i, { placeholder: e.target.value })} /></label>
                  <label className="text-xs"><span className="mb-1 block font-semibold text-neutral-500">Capability (optional)</span><input className={inputClass} value={f.capability || ""} onChange={(e) => updateField(i, { capability: e.target.value || undefined })} placeholder="introMessage" /></label>
                  <label className="flex items-center gap-2 pt-6 text-xs font-semibold text-[#32113A]"><input type="checkbox" checked={Boolean(f.required)} onChange={(e) => updateField(i, { required: e.target.checked })} /> Required</label>
                </div>
                {(f.optionsRef || f.itemFields || f.default || f.options) && <div className="mt-2 text-xs text-neutral-400">Advanced: {f.optionsRef ? `optionsRef=${f.optionsRef} ` : ""}{f.itemFields ? `itemFields=${f.itemFields.length} ` : ""}{f.default ? "has default " : ""}{f.options ? `options=${f.options.length}` : ""}(edit via JSON)</div>}
              </div>
            ))}
            <button onClick={addField} className="rounded-xl border border-dashed border-[#D9AEBE] px-4 py-2 text-sm font-semibold text-[#8D1B63] hover:bg-[#FFF0F7]">＋ Add field</button>
          </div>
        )}

        <div className="flex gap-3 border-t border-[#F0DDE7] pt-4">
          <button disabled={saving} onClick={save} className="rounded-xl bg-[#32113A] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{saving ? "Saving…" : draft.isNew ? "Create category" : "Save changes"}</button>
          <button onClick={cancel} className="rounded-xl border border-[#ECD5E2] px-5 py-2.5 text-sm font-semibold text-[#8D1B63] hover:bg-[#FFF0F7]">Cancel</button>
        </div>
      </div>
    </AdminPageFrame>;
  }

  return <AdminPageFrame eyebrow="Category forms" title="Category forms" description="Each category defines the Details-step form for its videos. Photos and music are shared across all categories.">
    <div className="mt-6 flex justify-end"><button onClick={startNew} className="rounded-xl bg-[#32113A] px-5 py-2.5 text-sm font-semibold text-white">＋ New category form</button></div>
    <div className="mt-4 space-y-4">
      {categories === null ? <div className="rounded-3xl border border-[#ECD5E2] bg-white p-8 text-sm text-neutral-500">Loading categories…</div>
        : !categories.length ? <div className="rounded-3xl border border-[#ECD5E2] bg-white p-8 text-sm text-neutral-500">No category forms yet.</div>
        : categories.map((cat) => (
          <div key={cat.id} className="rounded-3xl border border-[#ECD5E2] bg-white p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="font-heading text-2xl font-extrabold text-[#32113A]">{cat.icon} {cat.name} <span className="ml-2 rounded-full bg-[#FFF3F8] px-2 py-0.5 align-middle text-xs font-semibold capitalize text-[#8D1B63]">{cat.type || "personal"}</span> {cat.isActive === false && <span className="ml-2 rounded-full bg-neutral-100 px-2 py-0.5 text-xs font-semibold text-neutral-500">inactive</span>}</div>
                <div className="mt-1 text-sm text-neutral-500">{cat.description || "No description"}</div>
              </div>
              <div className="flex gap-2">
                <button onClick={() => startEdit(cat)} className="rounded-lg border border-[#ECD5E2] px-3 py-1.5 text-xs font-semibold text-[#8D1B63] hover:bg-[#FFF0F7]">Edit</button>
                <button onClick={() => remove(cat)} className="rounded-lg border border-[#EAB8C6] px-3 py-1.5 text-xs font-semibold text-[#B4405F] hover:bg-[#FFE9EF]">Delete</button>
              </div>
            </div>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[520px] text-left text-sm">
                <thead><tr className="text-xs uppercase tracking-wide text-neutral-400"><th className="py-2 pr-4">Field</th><th className="py-2 pr-4">Type</th><th className="py-2 pr-4">Label</th><th className="py-2 pr-4">Required</th><th className="py-2">Capability</th></tr></thead>
                <tbody className="divide-y divide-[#F0DDE7]">
                  {(cat.form?.fields || []).map((f) => (
                    <tr key={f.key}><td className="py-2 pr-4 font-mono text-xs text-[#32113A]">{f.key}</td><td className="py-2 pr-4">{f.type}</td><td className="py-2 pr-4 text-neutral-600">{f.label}</td><td className="py-2 pr-4">{f.required ? "Yes" : "—"}</td><td className="py-2 text-neutral-500">{f.capability || "—"}</td></tr>
                  ))}
                  {!(cat.form?.fields || []).length && <tr><td colSpan={5} className="py-3 text-neutral-400">No fields (legacy category — uses the built-in form).</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        ))}
    </div>
  </AdminPageFrame>;
}

function AdminDashboardPage() {
  const { credential } = useAuth();
  const [data, setData] = useState(null);
  useEffect(() => { axios.get(`${API}/admin/dashboard`, { headers: { Authorization: `Bearer ${credential}` } }).then((response) => setData(response.data)).catch(() => {}); }, [credential]);
  if (!data) return <AdminPageFrame eyebrow="Dashboard" title="Admin dashboard" description="Loading platform metrics…"><div className="mt-6 rounded-3xl border border-[#ECD5E2] bg-white p-8 text-sm text-neutral-500">Loading analytics…</div></AdminPageFrame>;
  const cards = [["Users", data.users, "Registered accounts"], ["Videos", data.videos, "Total render jobs"], ["Live users", data.liveUsers, "Active in the last 15 minutes"], ["Completed", data.renders.done, "Successful videos"]];
  return <AdminPageFrame eyebrow="Dashboard" title="Platform overview" description="Monitor users, video creation, and rendering activity from one place."><div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{cards.map(([label, value, hint]) => <div key={label} className="rounded-3xl border border-[#ECD5E2] bg-white p-6"><div className="text-xs font-bold uppercase tracking-[0.16em] text-neutral-400">{label}</div><div className="mt-3 font-heading text-4xl font-extrabold text-[#32113A]">{value}</div><div className="mt-2 text-xs text-neutral-500">{hint}</div></div>)}</div><div className="mt-6 grid gap-5 lg:grid-cols-[1.3fr_0.7fr]"><div className="rounded-3xl border border-[#ECD5E2] bg-white p-6"><h2 className="font-heading text-2xl font-extrabold text-[#32113A]">Recent activity</h2><div className="mt-4 divide-y divide-[#F0DDE7]">{data.recent.map((item) => <div key={item.id} className="flex items-center justify-between gap-4 py-3 text-sm"><div><div className="font-semibold text-[#32113A]">{item.userEmail || "Unknown user"}</div><div className="text-xs text-neutral-500">{item.template} · {item.created_at ? new Date(item.created_at).toLocaleString() : ""}</div></div><span className="rounded-full bg-[#FFF3F8] px-3 py-1 text-xs font-semibold text-[#8D1B63]">{item.status}</span></div>)}</div></div><div className="rounded-3xl border border-[#ECD5E2] bg-white p-6"><h2 className="font-heading text-2xl font-extrabold text-[#32113A]">Render health</h2><div className="mt-5 space-y-3">{Object.entries(data.renders).map(([status, count]) => <div key={status} className="flex justify-between rounded-xl bg-[#FFF8FB] px-4 py-3 text-sm"><span className="capitalize text-neutral-600">{status}</span><strong className="text-[#32113A]">{count}</strong></div>)}</div></div></div></AdminPageFrame>;
}

function AdminUsersPage() {
  const { credential } = useAuth();
  const [users, setUsers] = useState(null);
  useEffect(() => { axios.get(`${API}/admin/users`, { headers: { Authorization: `Bearer ${credential}` } }).then((response) => setUsers(response.data)).catch(() => setUsers([])); }, [credential]);
  return <AdminPageFrame eyebrow="Users" title="User accounts" description="See registered users and how many invitation videos each account has created."><div className="mt-6 overflow-hidden rounded-3xl border border-[#ECD5E2] bg-white">{users === null ? <div className="p-8 text-sm text-neutral-500">Loading users…</div> : <div className="divide-y divide-[#F0DDE7]">{users.map((item) => <div key={item.id} className="flex flex-col gap-3 px-6 py-5 sm:flex-row sm:items-center sm:justify-between"><div className="flex items-center gap-3">{item.picture ? <img src={item.picture} alt="" className="h-10 w-10 rounded-full object-cover" referrerPolicy="no-referrer" /> : <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#F8EAF2] font-bold text-[#A4176D]">{(item.name || item.email || "U").slice(0, 1).toUpperCase()}</div>}<div><div className="font-semibold text-[#32113A]">{item.name || "Unnamed user"}</div><div className="text-sm text-neutral-500">{item.email}</div></div></div><div className="flex items-center gap-5 text-sm"><span><strong className="text-[#32113A]">{item.renderCount}</strong> videos</span><span className="text-xs text-neutral-400">Last activity: {item.lastRender ? new Date(item.lastRender).toLocaleDateString() : "Never"}</span></div></div>)}{!users.length && <div className="p-8 text-sm text-neutral-500">No users found.</div>}</div>}</div></AdminPageFrame>;
}

const RENDER_STATUS_OPTIONS = ["queued", "rendering", "done", "failed"];
const RENDER_PAGE_SIZE = 50;

function AdminRendersPage() {
  const { credential } = useAuth();
  const [data, setData] = useState(null); // {items, total, page, pageSize}
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [editing, setEditing] = useState(null);
  const [editDraft, setEditDraft] = useState({ videoUrl: "", isPublic: false, isPremium: false });
  const [saving, setSaving] = useState(false);
  const authHeader = useMemo(() => ({ headers: { Authorization: `Bearer ${credential}` } }), [credential]);

  const load = useCallback(() => {
    const params = { page, pageSize: RENDER_PAGE_SIZE };
    if (statusFilter) params.status = statusFilter;
    if (dateFrom) params.dateFrom = dateFrom;
    if (dateTo) params.dateTo = dateTo;
    axios.get(`${API}/admin/renders`, { ...authHeader, params })
      .then((r) => setData(r.data))
      .catch(() => setData({ items: [], total: 0, page: 1, pageSize: RENDER_PAGE_SIZE }));
  }, [authHeader, page, statusFilter, dateFrom, dateTo]);
  useEffect(() => { load(); }, [load]);
  // A filter change invalidates the current page position — jump back to page 1.
  useEffect(() => { setPage(1); }, [statusFilter, dateFrom, dateTo]);

  const openEdit = (item) => {
    setEditing(item);
    setEditDraft({ videoUrl: item.video_url || "", isPublic: Boolean(item.isPublic), isPremium: Boolean(item.isPremium) });
  };

  const saveEdit = async () => {
    if (!editing) return;
    setSaving(true);
    try {
      await axios.patch(`${API}/admin/renders/${editing.id}`, {
        videoUrl: editDraft.videoUrl === editing.video_url ? undefined : editDraft.videoUrl,
        isPublic: editDraft.isPublic,
        isPremium: editDraft.isPremium,
      }, authHeader);
      toast.success("Render updated");
      setEditing(null);
      load();
    } catch (error) {
      toast.error(error?.response?.data?.detail || "Failed to update render");
    } finally {
      setSaving(false);
    }
  };

  const items = data?.items || [];
  const total = data?.total || 0;
  const pageSize = data?.pageSize || RENDER_PAGE_SIZE;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const hasFilters = Boolean(statusFilter || dateFrom || dateTo);

  const inputClass = "w-full rounded-xl border border-[#ECD5E2] bg-white px-3 py-2 text-sm text-[#32113A] outline-none focus:border-[#B4405F]";
  const videoHref = (url) => (url && url.startsWith("http") ? url : `${BACKEND_URL}${url || ""}`);

  return <AdminPageFrame eyebrow="Video renders" title="Video activity" description="Review video jobs, their templates, categories, and status — edit the video URL, and mark renders public or premium.">
    <div className="mt-6 flex flex-wrap items-end gap-3 rounded-3xl border border-[#ECD5E2] bg-white p-5">
      <label className="text-xs">
        <span className="mb-1 block font-semibold text-neutral-500">Status</span>
        <select className={inputClass} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="">All</option>
          {RENDER_STATUS_OPTIONS.map((s) => <option key={s} value={s} className="capitalize">{s}</option>)}
        </select>
      </label>
      <label className="text-xs">
        <span className="mb-1 block font-semibold text-neutral-500">From date</span>
        <input type="date" className={inputClass} value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
      </label>
      <label className="text-xs">
        <span className="mb-1 block font-semibold text-neutral-500">To date</span>
        <input type="date" className={inputClass} value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
      </label>
      {hasFilters && (
        <button onClick={() => { setStatusFilter(""); setDateFrom(""); setDateTo(""); }} className="rounded-lg border border-[#ECD5E2] px-3 py-2 text-xs font-semibold text-[#8D1B63] hover:bg-[#FFF0F7]">Clear filters</button>
      )}
    </div>

    <div className="mt-4 overflow-x-auto rounded-3xl border border-[#ECD5E2] bg-white">
      <table className="min-w-full divide-y divide-[#F0DDE7] text-sm">
        <thead className="bg-[#FFF8FB]">
          <tr className="text-left text-xs font-semibold uppercase tracking-wide text-neutral-500">
            <th className="px-4 py-3">User</th>
            <th className="px-4 py-3">Template</th>
            <th className="px-4 py-3">Category</th>
            <th className="px-4 py-3">Duration</th>
            <th className="px-4 py-3">Status</th>
            <th className="px-4 py-3">Date</th>
            <th className="px-4 py-3">Public</th>
            <th className="px-4 py-3">Premium</th>
            <th className="px-4 py-3">Video</th>
            <th className="px-4 py-3" />
          </tr>
        </thead>
        <tbody className="divide-y divide-[#F0DDE7]">
          {data === null && (
            <tr><td colSpan={10} className="px-4 py-8 text-center text-sm text-neutral-500">Loading renders…</td></tr>
          )}
          {data !== null && !items.length && (
            <tr><td colSpan={10} className="px-4 py-8 text-center text-sm text-neutral-500">No renders found{hasFilters ? " for these filters" : ""}.</td></tr>
          )}
          {items.map((item) => (
            <tr key={item.id}>
              <td className="px-4 py-3">
                <div className="font-semibold text-[#32113A]">{item.userEmail || "Unknown user"}</div>
                <div className="text-xs text-neutral-400">{item.id.slice(0, 12)}</div>
              </td>
              <td className="px-4 py-3 text-neutral-600">{item.templateName || item.template}</td>
              <td className="px-4 py-3 text-neutral-600">{item.category}</td>
              <td className="px-4 py-3 text-neutral-600">{item.durationInSeconds ? `${item.durationInSeconds}s` : "—"}</td>
              <td className="px-4 py-3"><span className="rounded-full bg-[#FFF3F8] px-3 py-1 text-xs font-semibold capitalize text-[#8D1B63]">{item.status}</span></td>
              <td className="px-4 py-3 text-xs text-neutral-500">{item.created_at ? new Date(item.created_at).toLocaleString() : ""}</td>
              <td className="px-4 py-3">{item.isPublic ? <CheckCircle2 className="h-4 w-4 text-emerald-600" aria-label="Public" /> : <span className="text-neutral-300">—</span>}</td>
              <td className="px-4 py-3">{item.isPremium ? <CheckCircle2 className="h-4 w-4 text-[#C80A76]" aria-label="Premium" /> : <span className="text-neutral-300">—</span>}</td>
              <td className="px-4 py-3">
                {item.video_url && <a href={videoHref(item.video_url)} target="_blank" rel="noreferrer" className="text-xs font-semibold text-[#8D1B63] underline">View</a>}
              </td>
              <td className="px-4 py-3">
                <button onClick={() => openEdit(item)} className="rounded-lg border border-[#ECD5E2] px-3 py-1.5 text-xs font-semibold text-[#8D1B63] hover:bg-[#FFF0F7]">Edit</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>

    <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-neutral-500">
      <div>{total} render{total === 1 ? "" : "s"} · Page {page} of {totalPages}</div>
      <div className="flex gap-2">
        <button disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))} className="rounded-lg border border-[#ECD5E2] px-3 py-1.5 text-xs font-semibold text-[#8D1B63] transition hover:bg-[#FFF0F7] disabled:cursor-not-allowed disabled:opacity-40">Previous</button>
        <button disabled={page >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))} className="rounded-lg border border-[#ECD5E2] px-3 py-1.5 text-xs font-semibold text-[#8D1B63] transition hover:bg-[#FFF0F7] disabled:cursor-not-allowed disabled:opacity-40">Next</button>
      </div>
    </div>

    <Dialog open={Boolean(editing)} onOpenChange={(open) => !open && setEditing(null)}>
      <DialogContent className="max-w-lg rounded-3xl border-[#EBD3E0] bg-white p-0 shadow-[0_24px_80px_rgba(50,17,58,0.22)]">
        <div className="rounded-t-3xl bg-[#FFF6FA] px-6 py-5">
          <DialogHeader>
            <DialogTitle className="font-heading text-2xl font-extrabold text-[#32113A]">Edit render</DialogTitle>
            <DialogDescription className="pt-2 leading-6 text-neutral-600">{editing?.templateName || editing?.template} · {editing?.userEmail}</DialogDescription>
          </DialogHeader>
        </div>
        <div className="space-y-4 px-6 pb-6 pt-4">
          <label className="text-xs">
            <span className="mb-1 block font-semibold text-neutral-500">Video URL</span>
            <input className={inputClass} value={editDraft.videoUrl} onChange={(e) => setEditDraft((d) => ({ ...d, videoUrl: e.target.value }))} placeholder="/api/renders/.../video.mp4" />
          </label>
          <div className="flex gap-6">
            <label className="flex items-center gap-2 text-sm font-semibold text-[#32113A]">
              <input type="checkbox" checked={editDraft.isPublic} onChange={(e) => setEditDraft((d) => ({ ...d, isPublic: e.target.checked }))} /> Public
            </label>
            <label className="flex items-center gap-2 text-sm font-semibold text-[#32113A]">
              <input type="checkbox" checked={editDraft.isPremium} onChange={(e) => setEditDraft((d) => ({ ...d, isPremium: e.target.checked }))} /> Premium
            </label>
          </div>
          <div className="flex justify-end gap-3 border-t border-[#F0DDE7] pt-4">
            <button onClick={() => setEditing(null)} className="rounded-xl border border-[#ECD5E2] px-4 py-2 text-sm font-semibold text-[#8D1B63] hover:bg-[#FFF0F7]">Cancel</button>
            <button disabled={saving} onClick={saveEdit} className="rounded-xl bg-[#32113A] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{saving ? "Saving…" : "Save changes"}</button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  </AdminPageFrame>;
}

function AdminSettingsPage() {
  return <AdminPageFrame eyebrow="Settings" title="Platform settings" description="Review the environment-backed settings used by the Invita Videos platform."><div className="mt-6 grid gap-4 sm:grid-cols-2"><div className="rounded-3xl border border-[#ECD5E2] bg-white p-6"><div className="section-label text-left text-[#9B256D]">Access</div><h2 className="mt-2 font-heading text-2xl font-extrabold text-[#32113A]">Admin protection</h2><p className="mt-3 text-sm leading-6 text-neutral-600">Admin access is protected by the configured administrator email list. Backend API checks remain active even when the navigation is hidden.</p></div><div className="rounded-3xl border border-[#ECD5E2] bg-white p-6"><div className="section-label text-left text-[#9B256D]">Rendering</div><h2 className="mt-2 font-heading text-2xl font-extrabold text-[#32113A]">Video pipeline</h2><p className="mt-3 text-sm leading-6 text-neutral-600">Templates, music, uploads, MongoDB storage, reCAPTCHA, and the render worker are configured through deployment environment files.</p></div></div></AdminPageFrame>;
}

function AdminTemplatesPage() {
  const { user, credential } = useAuth();
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(false);
  const [savingId, setSavingId] = useState("");
  const [musicTracks, setMusicTracks] = useState([]);
  const [musicUpload, setMusicUpload] = useState({ file: null, title: "", mood: "", credit: "", duration: 30, categories: "", templateId: "" });
  const [uploadingMusic, setUploadingMusic] = useState(false);
  const [savingMusicId, setSavingMusicId] = useState("");

  const loadTemplates = useCallback(async () => {
    if (!credential || !isAdminUser(user)) return;
    setLoading(true);
    try {
      const [templatesResponse, musicResponse] = await Promise.all([
        axios.get(`${API}/admin/templates`, { headers: { Authorization: `Bearer ${credential}` } }),
        axios.get(`${API}/music`),
      ]);
      setTemplates(templatesResponse.data);
      setMusicTracks(musicResponse.data);
    } catch (error) {
      toast.error(error?.response?.data?.detail || "Failed to load template mappings");
    } finally {
      setLoading(false);
    }
  }, [credential, user]);

  useEffect(() => {
    loadTemplates();
  }, [loadTemplates]);

  if (!isAdminUser(user)) {
    return <NotFoundPage />;
  }

  const updateLocalTemplate = (templateId, field, value) => {
    setTemplates((current) =>
      current.map((template) =>
        template.id === templateId ? { ...template, [field]: value } : template,
      ),
    );
  };

  const saveTemplate = async (template) => {
    setSavingId(template.id);
    try {
      const response = await axios.patch(
        `${API}/admin/templates/${template.id}`,
        {
          category: template.category,
          isActive: template.isActive,
          sortOrder: Number(template.sortOrder) || 100,
          defaultMusicId: template.defaultMusicId || null,
        },
        {
          headers: { Authorization: `Bearer ${credential}` },
        },
      );
      setTemplates((current) =>
        current.map((item) => (item.id === template.id ? response.data : item)),
      );
      toast.success(`${template.name} mapping saved`);
    } catch (error) {
      toast.error(error?.response?.data?.detail || "Failed to save template mapping");
    } finally {
      setSavingId("");
    }
  };

  const uploadMusic = async (event) => {
    event.preventDefault();
    if (!musicUpload.file || !musicUpload.title.trim()) {
      toast.error("Choose an MP3 file and enter a title");
      return;
    }
    setUploadingMusic(true);
    try {
      const form = new FormData();
      form.append("file", musicUpload.file);
      form.append("title", musicUpload.title);
      form.append("mood", musicUpload.mood);
      form.append("credit", musicUpload.credit);
      form.append("duration", String(musicUpload.duration || 30));
      form.append("categories", musicUpload.categories);
      form.append("templateId", musicUpload.templateId);
      await axios.post(`${API}/admin/music`, form, {
        headers: { Authorization: `Bearer ${credential}` },
      });
      toast.success(musicUpload.templateId ? "Music uploaded and assigned to the template" : "Music uploaded");
      setMusicUpload({ file: null, title: "", mood: "", credit: "", duration: 30, categories: "", templateId: "" });
      await loadTemplates();
    } catch (error) {
      toast.error(error?.response?.data?.detail || "Failed to upload music");
    } finally {
      setUploadingMusic(false);
    }
  };

  const saveMusicCategories = async (track) => {
    const categories = String(track.categories || "").split(",").map((item) => item.trim()).filter(Boolean);
    if (!categories.length) {
      toast.error("Add at least one category");
      return;
    }
    setSavingMusicId(track.id);
    try {
      const response = await axios.patch(`${API}/admin/music/${track.id}`, { categories }, { headers: { Authorization: `Bearer ${credential}` } });
      setMusicTracks((current) => current.map((item) => item.id === track.id ? response.data : item));
      toast.success(`${track.title} categories saved`);
    } catch (error) {
      toast.error(error?.response?.data?.detail || "Failed to save music categories");
    } finally {
      setSavingMusicId("");
    }
  };

  const categories = [...new Set(templates.map((template) => template.category || "Wedding"))].sort();

  return (
    <MarketingLayout>
      <main className="px-6 py-12 lg:px-10 lg:py-16">
        <section className="mx-auto max-w-7xl">
          <AdminTabs />
          <div className="flex flex-col justify-between gap-5 rounded-[2rem] border border-[#ECD5E2] bg-[#FFF7FB] p-7 sm:p-9 lg:flex-row lg:items-end">
            <div>
              <div className="section-label text-left text-[#9B256D]">Admin · Templates</div>
              <h1 className="mt-2 font-heading text-4xl font-extrabold tracking-tight text-[#32113A] sm:text-5xl">
                Manage template categories.
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-neutral-600">
                Map each render template to a category such as Wedding, Engagement, Birthday, Anniversary or any future celebration type.
              </p>
            </div>
            <button
              type="button"
              onClick={loadTemplates}
              disabled={!credential || loading}
              className="inline-flex w-fit items-center justify-center rounded-full border border-[#D8B7CB] bg-white px-5 py-3 text-sm font-semibold text-[#32113A] transition hover:bg-[#FFF0F8] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? "Loading..." : "Refresh mappings"}
            </button>
          </div>

          {!user || !credential ? (
            <div className="mt-6 rounded-3xl border border-[#ECD5E2] bg-white p-6 shadow-[0_14px_46px_rgba(81,25,62,0.05)]">
              <div className="section-label text-left text-[#9B256D]">Login required</div>
              <h2 className="mt-2 font-heading text-2xl font-extrabold text-[#32113A]">Sign in to manage template mappings.</h2>
              <p className="mb-4 mt-2 text-sm leading-6 text-neutral-500">
                Admin actions use your Google login. Set `ADMIN_EMAILS` on the backend to restrict access to specific email addresses.
              </p>
              <GoogleSignInButton className="min-h-[40px]" text="continue_with" />
            </div>
          ) : (
            <>
              <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-2xl border border-[#ECD5E2] bg-white p-5">
                  <div className="text-xs font-semibold uppercase tracking-[0.16em] text-neutral-400">Templates</div>
                  <div className="mt-2 font-heading text-3xl font-extrabold text-[#32113A]">{templates.length}</div>
                </div>
                <div className="rounded-2xl border border-[#ECD5E2] bg-white p-5 sm:col-span-1 lg:col-span-3">
                  <div className="text-xs font-semibold uppercase tracking-[0.16em] text-neutral-400">Categories</div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {(categories.length ? categories : ["Wedding"]).map((category) => (
                      <span key={category} className="rounded-full bg-[#FFF3F8] px-3 py-1 text-xs font-semibold text-[#8D1B63]">
                        {category}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              <form onSubmit={uploadMusic} className="mt-6 rounded-3xl border border-[#ECD5E2] bg-white p-6 shadow-[0_14px_46px_rgba(81,25,62,0.05)]">
                <div className="section-label text-left text-[#9B256D]">Music library</div>
                <h2 className="mt-2 font-heading text-2xl font-extrabold text-[#32113A]">Upload MP3 and assign it</h2>
                <p className="mt-1 text-sm text-neutral-500">The uploaded track will be available in the creator and can become a template’s default soundtrack.</p>
                <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  <input type="file" accept="audio/mpeg,.mp3" onChange={(event) => setMusicUpload((current) => ({ ...current, file: event.target.files?.[0] || null }))} className="rounded-xl border border-black/10 bg-[#FFFCFD] px-3 py-2 text-sm text-[#32113A] file:mr-3 file:rounded-full file:border-0 file:bg-[#F8EAF2] file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-[#8D1B63]" />
                  <input value={musicUpload.title} onChange={(event) => setMusicUpload((current) => ({ ...current, title: event.target.value }))} placeholder="Track title" className="rounded-xl border border-black/10 bg-[#FFFCFD] px-3 py-2 text-sm text-[#32113A] outline-none focus:border-[#B22176]" />
                  <input value={musicUpload.mood} onChange={(event) => setMusicUpload((current) => ({ ...current, mood: event.target.value }))} placeholder="Mood (e.g. Cinematic · Warm)" className="rounded-xl border border-black/10 bg-[#FFFCFD] px-3 py-2 text-sm text-[#32113A] outline-none focus:border-[#B22176]" />
                  <input value={musicUpload.credit} onChange={(event) => setMusicUpload((current) => ({ ...current, credit: event.target.value }))} placeholder="Credit / artist" className="rounded-xl border border-black/10 bg-[#FFFCFD] px-3 py-2 text-sm text-[#32113A] outline-none focus:border-[#B22176]" />
                  <input type="number" min="1" max="900" value={musicUpload.duration} onChange={(event) => setMusicUpload((current) => ({ ...current, duration: event.target.value }))} placeholder="Duration (seconds)" className="rounded-xl border border-black/10 bg-[#FFFCFD] px-3 py-2 text-sm text-[#32113A] outline-none focus:border-[#B22176]" />
                  <input value={musicUpload.categories} onChange={(event) => setMusicUpload((current) => ({ ...current, categories: event.target.value }))} placeholder="Categories: Wedding, Birthday" className="rounded-xl border border-black/10 bg-[#FFFCFD] px-3 py-2 text-sm text-[#32113A] outline-none focus:border-[#B22176]" />
                  <select value={musicUpload.templateId} onChange={(event) => setMusicUpload((current) => ({ ...current, templateId: event.target.value }))} className="rounded-xl border border-black/10 bg-[#FFFCFD] px-3 py-2 text-sm text-[#32113A] outline-none focus:border-[#B22176]">
                    <option value="">Do not assign yet</option>
                    {templates.map((template) => <option key={template.id} value={template.id}>Assign to {template.name}</option>)}
                  </select>
                </div>
                <button type="submit" disabled={uploadingMusic} className="mt-4 rounded-full bg-[#32113A] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#52184D] disabled:cursor-not-allowed disabled:opacity-60">{uploadingMusic ? "Uploading..." : "Upload MP3"}</button>
              </form>

              <div className="mt-6 rounded-3xl border border-[#ECD5E2] bg-white p-6 shadow-[0_14px_46px_rgba(81,25,62,0.05)]">
                <div className="section-label text-left text-[#9B256D]">Existing songs</div>
                <div className="mt-4 space-y-3">
                  {musicTracks.map((track) => (
                    <div key={track.id} className="grid gap-3 rounded-2xl border border-[#F0DDE7] bg-[#FFFDFD] p-4 lg:grid-cols-[1.2fr_1fr_auto] lg:items-center">
                      <div><div className="font-semibold text-[#32113A]">{track.title}</div><div className="text-xs text-neutral-500">{track.mood} · {track.credit}</div></div>
                      <input value={musicCategoryList(track.categories).join(", ")} onChange={(event) => setMusicTracks((current) => current.map((item) => item.id === track.id ? { ...item, categories: event.target.value } : item))} placeholder="Wedding, Engagement" className="rounded-xl border border-black/10 bg-white px-3 py-2 text-sm text-[#32113A] outline-none focus:border-[#B22176]" />
                      <button type="button" onClick={() => saveMusicCategories(track)} disabled={savingMusicId === track.id} className="rounded-full bg-[#F8EAF2] px-4 py-2 text-sm font-semibold text-[#8D1B63] transition hover:bg-[#F1D7E5] disabled:opacity-60">{savingMusicId === track.id ? "Saving..." : "Save categories"}</button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-6 overflow-hidden rounded-3xl border border-[#ECD5E2] bg-white shadow-[0_14px_46px_rgba(81,25,62,0.05)]">
                <div className="grid grid-cols-[1.2fr_1fr_1fr_0.55fr_0.55fr_0.55fr] gap-3 border-b border-[#F0DDE7] bg-[#FFF8FB] px-5 py-3 text-xs font-bold uppercase tracking-[0.14em] text-neutral-500">
                  <div>Template</div>
                  <div>Category</div>
                  <div>Default music</div>
                  <div>Sort</div>
                  <div>Active</div>
                  <div className="text-right">Action</div>
                </div>
                <div className="divide-y divide-[#F0DDE7]">
                  {templates.map((templateItem) => (
                    <div key={templateItem.id} className="grid grid-cols-1 gap-4 px-5 py-5 lg:grid-cols-[1.2fr_1fr_1fr_0.55fr_0.55fr_0.55fr] lg:items-center">
                      <div>
                        <div className="flex items-center gap-3">
                          <span className="flex h-11 w-11 items-center justify-center rounded-xl border border-black/10 text-lg italic" style={{ backgroundColor: templateItem.bg, color: templateItem.text, fontFamily: templateItem.font }}>
                            {templateItem.name.slice(0, 1)}
                          </span>
                          <div>
                            <div className="font-heading text-lg font-extrabold text-[#32113A]">{templateItem.name}</div>
                            <div className="text-xs text-neutral-500">{templateItem.id}</div>
                            <div className="mt-1 text-xs font-semibold text-[#A4176D]">{Number(templateItem.renderCount || 0)} {Number(templateItem.renderCount || 0) === 1 ? "video" : "videos"} created</div>
                          </div>
                        </div>
                        <p className="mt-2 max-w-xl text-sm leading-6 text-neutral-500">{templateItem.desc}</p>
                      </div>
                      <label className="grid gap-1 text-xs font-semibold uppercase tracking-[0.12em] text-neutral-400 lg:block">
                        <span className="lg:hidden">Category</span>
                        <input
                          value={templateItem.category || ""}
                          onChange={(event) => updateLocalTemplate(templateItem.id, "category", event.target.value)}
                          list="template-category-options"
                          className="w-full rounded-xl border border-black/10 bg-[#FFFCFD] px-3 py-2 text-sm font-normal normal-case tracking-normal text-[#32113A] outline-none transition focus:border-[#B22176] focus:ring-2 focus:ring-[#EFCBDD]"
                          placeholder="Wedding"
                        />
                      </label>
                      <label className="grid gap-1 text-xs font-semibold uppercase tracking-[0.12em] text-neutral-400 lg:block">
                        <span className="lg:hidden">Default music</span>
                        <select
                          value={templateItem.defaultMusicId || ""}
                          onChange={(event) => updateLocalTemplate(templateItem.id, "defaultMusicId", event.target.value || null)}
                          className="w-full rounded-xl border border-black/10 bg-[#FFFCFD] px-3 py-2 text-sm font-normal normal-case tracking-normal text-[#32113A] outline-none transition focus:border-[#B22176] focus:ring-2 focus:ring-[#EFCBDD]"
                        >
                          <option value="">No default music</option>
                          {musicTracks.filter((track) => { const trackCategories = musicCategoryList(track.categories); return !trackCategories.length || trackCategories.includes(templateItem.category || "Wedding"); }).map((track) => <option key={track.id} value={track.id}>{track.title} · {musicCategoryList(track.categories).join(", ")}</option>)}
                        </select>
                      </label>
                      <label className="grid gap-1 text-xs font-semibold uppercase tracking-[0.12em] text-neutral-400 lg:block">
                        <span className="lg:hidden">Sort order</span>
                        <input
                          type="number"
                          value={templateItem.sortOrder}
                          onChange={(event) => updateLocalTemplate(templateItem.id, "sortOrder", event.target.value)}
                          className="w-full rounded-xl border border-black/10 bg-[#FFFCFD] px-3 py-2 text-sm font-normal normal-case tracking-normal text-[#32113A] outline-none transition focus:border-[#B22176] focus:ring-2 focus:ring-[#EFCBDD]"
                        />
                      </label>
                      <label className="flex items-center gap-2 text-sm font-semibold text-[#32113A]">
                        <input
                          type="checkbox"
                          checked={templateItem.isActive !== false}
                          onChange={(event) => updateLocalTemplate(templateItem.id, "isActive", event.target.checked)}
                          className="h-4 w-4 accent-[#B31571]"
                        />
                        Active
                      </label>
                      <div className="flex justify-start lg:justify-end">
                        <button
                          type="button"
                          onClick={() => saveTemplate(templateItem)}
                          disabled={savingId === templateItem.id}
                          className="inline-flex items-center justify-center rounded-full bg-[#32113A] px-5 py-2.5 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:bg-[#52184D] disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {savingId === templateItem.id ? "Saving..." : "Save"}
                        </button>
                      </div>
                    </div>
                  ))}
                  {!loading && templates.length === 0 && (
                    <div className="px-5 py-10 text-center text-sm text-neutral-500">
                      No templates found. Restart the backend once to seed the default Wedding templates.
                    </div>
                  )}
                </div>
              </div>
              <datalist id="template-category-options">
                {[...new Set(["Wedding", "Engagement", "Birthday", "Anniversary", "Reception", ...categories])].map((category) => (
                  <option key={category} value={category} />
                ))}
              </datalist>
            </>
          )}
        </section>
      </main>
    </MarketingLayout>
  );
}

function ContactPage() {
  const handleSubmit = (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const subject = encodeURIComponent(`Invita Videos enquiry from ${form.get("name")}`);
    const body = encodeURIComponent(
      `Name: ${form.get("name")}\nEmail: ${form.get("email")}\n\n${form.get("message")}`,
    );
    window.location.href = `mailto:info@invitavideos.com?subject=${subject}&body=${body}`;
  };

  return (
    <MarketingLayout>
      <main className="px-6 py-16 lg:px-10 lg:py-24">
        <div className="mx-auto grid max-w-6xl gap-12 lg:grid-cols-[0.8fr_1.2fr]">
          <div>
            <div className="section-label text-[#9B256D]">Contact us</div>
            <h1 className="mt-4 font-heading text-5xl font-extrabold leading-[1.03] tracking-tight text-[#32113A]">Let’s make your invitation feel just right.</h1>
            <p className="mt-6 text-lg leading-8 text-neutral-600">
              Need help creating a video, choosing a design or solving a rendering issue? Tell us what you need and we’ll get back to you as soon as we can.
            </p>
            <div className="mt-8 rounded-3xl border border-[#EBCFDE] bg-[#FFF6FA] p-6">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-[#B31571] shadow-sm">
                <Mail className="h-5 w-5" aria-hidden="true" />
              </div>
              <div className="mt-4 text-sm font-semibold text-neutral-500">Email</div>
              <a className="mt-1 block font-heading text-xl font-extrabold text-[#32113A] hover:text-[#A3166A]" href="mailto:info@invitavideos.com">
                info@invitavideos.com
              </a>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="rounded-[2rem] border border-[#E7D4DF] bg-white p-6 shadow-[0_20px_60px_rgba(65,22,53,0.08)] sm:p-9">
            <h2 className="font-heading text-3xl font-extrabold text-[#32113A]">Send us a message</h2>
            <p className="mt-2 text-sm leading-6 text-neutral-500">Submitting this form will open your email app with the message ready to send.</p>
            <div className="mt-7 grid gap-5 sm:grid-cols-2">
              <label className="grid gap-2 text-sm font-semibold text-neutral-700">
                Your name
                <input name="name" required autoComplete="name" className="rounded-xl border border-black/10 bg-[#FFFCFD] px-4 py-3 font-normal outline-none transition focus:border-[#B22176] focus:ring-2 focus:ring-[#EFCBDD]" placeholder="Your name" />
              </label>
              <label className="grid gap-2 text-sm font-semibold text-neutral-700">
                Email address
                <input name="email" type="email" required autoComplete="email" className="rounded-xl border border-black/10 bg-[#FFFCFD] px-4 py-3 font-normal outline-none transition focus:border-[#B22176] focus:ring-2 focus:ring-[#EFCBDD]" placeholder="you@example.com" />
              </label>
            </div>
            <label className="mt-5 grid gap-2 text-sm font-semibold text-neutral-700">
              How can we help?
              <textarea name="message" required rows="7" className="resize-y rounded-xl border border-black/10 bg-[#FFFCFD] px-4 py-3 font-normal outline-none transition focus:border-[#B22176] focus:ring-2 focus:ring-[#EFCBDD]" placeholder="Tell us about your invitation or the issue you are facing." />
            </label>
            <button type="submit" className="mt-6 inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-[#6512AA] via-[#C90C76] to-[#E36A25] px-6 py-3.5 font-semibold text-white shadow-sm transition hover:-translate-y-0.5">
              Open email app <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </button>
          </form>
        </div>
      </main>
    </MarketingLayout>
  );
}

const privacySections = [
  {
    title: "Information we collect",
    body: [
      "Account details — when you sign in with Google, we receive your name, email address and profile picture from your Google account. We never see or store your Google password.",
      "Event details you provide — names, event dates, venue, city, event schedule and personal messages you enter while creating an invitation video.",
      "Photos you upload — the photos you choose to include in your invitation video are uploaded to our servers so they can be rendered into your video.",
      "Rendered videos — the finished invitation videos created from your details and photos.",
      "Basic usage information — such as render job status and timestamps, used to operate the service and diagnose problems.",
    ],
  },
  {
    title: "How we use your information",
    body: [
      "To create your invitation videos — your details, photos and music selection are used solely to render the video you requested.",
      "To operate your account — your Google email identifies your account and the videos you have created.",
      "To support you — if you contact us, we use your message and email address to respond.",
      "We do not sell your personal information, and we do not use your photos or event details for advertising.",
    ],
  },
  {
    title: "Photos and videos",
    body: [
      "Photos are uploaded only when you choose them for a video, and they are used only to render that video.",
      "Your rendered videos are stored so you can preview, download and share them.",
      "You may request deletion of your uploaded photos and rendered videos at any time by contacting us.",
    ],
  },
  {
    title: "Sharing",
    body: [
      "We do not share your personal information with third parties for their own marketing.",
      "Google Sign-In is provided by Google and is subject to Google's own privacy policy.",
      "Videos are shared only when you choose to share them — through the share options on our website or mobile apps.",
    ],
  },
  {
    title: "Data retention and deletion",
    body: [
      "We keep your account details, photos and videos while your account is active so your creations remain available to you.",
      "To delete your data — including your account, uploaded photos and rendered videos — email us at info@invitavideos.com and we will remove it within 30 days.",
    ],
  },
  {
    title: "Security",
    body: [
      "All communication between your device and our servers is encrypted using HTTPS.",
      "Access to stored data is limited to what is needed to operate the service.",
    ],
  },
  {
    title: "Children's privacy",
    body: [
      "Invita Videos is not directed at children under 13, and we do not knowingly collect personal information from children. If you believe a child has provided us information, contact us and we will delete it.",
    ],
  },
  {
    title: "Changes to this policy",
    body: [
      "If we make meaningful changes to this policy, we will update this page and revise the date shown above. Continued use of the service after changes take effect means you accept the updated policy.",
    ],
  },
];

function PrivacyPage() {
  return (
    <MarketingLayout>
      <main>
        <section className="px-6 pb-10 pt-16 lg:px-10 lg:pt-24">
          <div className="mx-auto max-w-4xl">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#FFF0F7] text-[#B31571]">
              <ShieldCheck className="h-6 w-6" aria-hidden="true" />
            </div>
            <div className="section-label mt-6 text-left text-[#9B256D]">Privacy policy</div>
            <h1 className="mt-3 font-heading text-5xl font-extrabold leading-[1.03] tracking-tight text-[#32113A] sm:text-6xl">
              Your story stays yours.
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-neutral-600">
              This policy explains what information Invita Videos collects, how we use it, and the choices you have. It applies to our website at invitavideos.com and our iOS and Android apps.
            </p>
            <p className="mt-4 text-sm font-semibold text-neutral-400">Last updated: 16 July 2026</p>
          </div>
        </section>

        <section className="px-6 pb-16 lg:px-10 lg:pb-24">
          <div className="mx-auto grid max-w-4xl gap-5">
            {privacySections.map((section) => (
              <article key={section.title} className="rounded-3xl border border-[#ECD5E2] bg-white p-7 sm:p-8">
                <h2 className="font-heading text-2xl font-extrabold text-[#32113A]">{section.title}</h2>
                <ul className="mt-4 space-y-3">
                  {section.body.map((line) => (
                    <li key={line} className="flex gap-3 leading-7 text-neutral-600">
                      <CheckCircle2 className="mt-1.5 h-4 w-4 shrink-0 text-[#B31571]" aria-hidden="true" />
                      <span>{line}</span>
                    </li>
                  ))}
                </ul>
              </article>
            ))}

            <article className="rounded-3xl border border-[#EBCFDE] bg-[#FFF6FA] p-7 sm:p-8">
              <h2 className="font-heading text-2xl font-extrabold text-[#32113A]">Questions or requests</h2>
              <p className="mt-3 leading-7 text-neutral-600">
                For privacy questions, data access or deletion requests, contact us and we&rsquo;ll respond as soon as we can.
              </p>
              <a className="mt-5 inline-flex items-center gap-2 font-heading text-xl font-extrabold text-[#32113A] hover:text-[#A3166A]" href="mailto:info@invitavideos.com">
                <Mail className="h-5 w-5 text-[#B31571]" aria-hidden="true" /> info@invitavideos.com
              </a>
            </article>
          </div>
        </section>
      </main>
    </MarketingLayout>
  );
}

function NotFoundPage() {
  return (
    <MarketingLayout>
      <main className="mx-auto flex min-h-[60vh] max-w-3xl flex-col items-center justify-center px-6 py-20 text-center">
        <div className="font-heading text-7xl font-extrabold text-[#E6C7D9]">404</div>
        <h1 className="mt-4 font-heading text-4xl font-extrabold text-[#32113A]">This page missed the celebration.</h1>
        <p className="mt-4 text-neutral-600">The page you’re looking for may have moved or no longer exists.</p>
        <Link to="/" className="mt-7 inline-flex items-center gap-2 rounded-full bg-[#32113A] px-6 py-3 font-semibold text-white">
          Return home <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      </main>
    </MarketingLayout>
  );
}

function App() {
  return (
    <AuthProvider>
      <div className="App">
        <PageMeta />
        <Toaster position="top-right" richColors />
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/create-video" element={<CreateVideoPage />} />
          <Route path="/about" element={<AboutPage />} />
          <Route path="/contact" element={<ContactPage />} />
          <Route path="/privacy" element={<PrivacyPage />} />
          <Route path="/my-downloads" element={<RequireUserGate><MyDownloadsPage /></RequireUserGate>} />
          <Route path="/my-orders" element={<RequireUserGate><MyOrdersPage /></RequireUserGate>} />
          <Route path="/admin" element={<AdminGate><AdminDashboardPage /></AdminGate>} />
          <Route path="/admin/templates" element={<AdminGate><AdminTemplatesPage /></AdminGate>} />
          <Route path="/admin/categories" element={<AdminGate><AdminCategoryFormsPage /></AdminGate>} />
          <Route path="/admin/template-settings" element={<AdminGate><AdminTemplateSettingsPage /></AdminGate>} />
          <Route path="/admin/credit-packs" element={<AdminGate><AdminCreditPacksPage /></AdminGate>} />
          <Route path="/admin/users" element={<AdminGate><AdminUsersPage /></AdminGate>} />
          <Route path="/admin/renders" element={<AdminGate><AdminRendersPage /></AdminGate>} />
          <Route path="/admin/settings" element={<AdminGate><AdminSettingsPage /></AdminGate>} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </div>
    </AuthProvider>
  );
}

export default App;
