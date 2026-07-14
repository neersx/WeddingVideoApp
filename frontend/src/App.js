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
import { PreviewPane } from "@/components/PreviewPane";
import { MusicPicker } from "@/components/MusicPicker";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || "http://localhost:8001";
const GOOGLE_CLIENT_ID = process.env.REACT_APP_GOOGLE_CLIENT_ID || "";
const ADMIN_EMAILS = (process.env.REACT_APP_ADMIN_EMAILS || "")
  .split(",")
  .map((email) => email.trim().toLowerCase())
  .filter(Boolean);
const RECAPTCHA_SITE_KEY = process.env.REACT_APP_RECAPTCHA_SITE_KEY || "";
const RECAPTCHA_ACTION = "render_video";
export const API = `${BACKEND_URL}/api`;
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
  durationInSeconds: 30,
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

  const signOut = useCallback(() => {
    setUser(null);
    setCredential("");
    localStorage.removeItem(AUTH_STORAGE_KEY);
    localStorage.removeItem(AUTH_CREDENTIAL_STORAGE_KEY);
    if (window.google?.accounts?.id) {
      window.google.accounts.id.disableAutoSelect();
    }
    toast.info("Signed out");
  }, []);

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
  const { user, credential } = useAuth();
  const [template, setTemplate] = useState("marigold");
  const [templates, setTemplates] = useState(DEFAULT_TEMPLATES);
  const [details, setDetails] = useState(initialDetails);
  const [schedule, setSchedule] = useState([
    ...weddingSchedule,
  ]);
  const [photos, setPhotos] = useState([]);
  const [musicId, setMusicId] = useState("tere-sang");
  const [jobStatus, setJobStatus] = useState("idle");
  const [jobProgress, setJobProgress] = useState(0);
  const [jobId, setJobId] = useState(null);
  const [videoUrl, setVideoUrl] = useState(null);
  const [loginPromptOpen, setLoginPromptOpen] = useState(false);
  const [resumeRenderAfterLogin, setResumeRenderAfterLogin] = useState(false);
  const pollRef = useRef(null);

  const rendering = jobStatus === "queued" || jobStatus === "rendering";
  const selectedTemplate = templates.find((item) => item.id === template);
  const category = selectedTemplate?.category || "Wedding";

  useEffect(() => {
    const defaults = categoryDefaults[category] || categoryDefaults.Wedding;
    setDetails((current) => ({ ...current, ...defaults }));
    setSchedule(category === "Wedding" ? [...weddingSchedule] : []);
  }, [category]);

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
        } else if (status === "failed") {
          clearInterval(pollRef.current);
          toast.error(error || "Render failed");
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
      const payload = {
        template,
        couple: { partnerOne: details.partnerOne, partnerTwo: details.partnerTwo },
        eventDate: details.eventDate,
        venue: { name: details.venueName, city: details.venueCity },
        message: details.message,
        displayMessage: details.displayMessage,
        photos,
        musicId: musicId || null,
        schedule: category === "Engagement" ? [{ name: "Engagement", time: details.eventDate }] : category === "Birthday" ? [] : schedule,
        durationInSeconds: Number(details.durationInSeconds) || 30,
        tags: String(details.tags || "")
          .split(",")
          .map((tag) => tag.trim())
          .filter(Boolean)
          .slice(0, 12),
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
        setLoginPromptOpen(true);
        setResumeRenderAfterLogin(true);
        toast.error("Please sign in again to render your video");
      } else if (!error?.response && error?.message?.includes("reCAPTCHA")) {
        toast.error("Security check could not be completed. Please refresh and try again.");
      } else {
        toast.error(error?.response?.data?.detail || "Failed to queue render");
      }
    }
  }, [credential, template, details, photos, musicId, schedule, category]);

  const handleRender = async () => {
    if (!details.partnerOne.trim() || !details.partnerTwo.trim()) {
      toast.error("Both partner names are required");
      return;
    }
    if (!user || !credential) {
      setResumeRenderAfterLogin(true);
      setLoginPromptOpen(true);
      return;
    }
    await submitRender();
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
                ["Photos", `${photos.length}/4`],
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
            <div className="rounded-2xl border border-[#ECD5E2] bg-white p-4 shadow-[0_14px_46px_rgba(81,25,62,0.05)]">
              <TemplatePicker value={template} onChange={setTemplate} templates={templates} />
            </div>
            <div className="rounded-2xl border border-[#ECD5E2] bg-white p-4 shadow-[0_14px_46px_rgba(81,25,62,0.05)] sm:p-5">
              <DetailsForm details={details} onChange={setDetails} category={category} />
            </div>
            <div className={`grid gap-4 ${category === "Wedding" ? "xl:grid-cols-2" : "xl:grid-cols-1"}`}>
              {category === "Wedding" && <div className="rounded-2xl border border-[#ECD5E2] bg-white p-4 shadow-[0_14px_46px_rgba(81,25,62,0.05)]">
                <ScheduleBuilder schedule={schedule} onChange={setSchedule} />
              </div>}
              <div className="rounded-2xl border border-[#ECD5E2] bg-white p-4 shadow-[0_14px_46px_rgba(81,25,62,0.05)]">
                <PhotoUploader photos={photos} onChange={setPhotos} />
              </div>
            </div>
            <div className="rounded-2xl border border-[#ECD5E2] bg-white p-4 shadow-[0_14px_46px_rgba(81,25,62,0.05)]">
              <MusicPicker value={musicId} onChange={setMusicId} />
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

function AdminTemplatesPage() {
  const { user, credential } = useAuth();
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(false);
  const [savingId, setSavingId] = useState("");

  const loadTemplates = useCallback(async () => {
    if (!credential) return;
    setLoading(true);
    try {
      const response = await axios.get(`${API}/admin/templates`, {
        headers: { Authorization: `Bearer ${credential}` },
      });
      setTemplates(response.data);
    } catch (error) {
      toast.error(error?.response?.data?.detail || "Failed to load template mappings");
    } finally {
      setLoading(false);
    }
  }, [credential]);

  useEffect(() => {
    loadTemplates();
  }, [loadTemplates]);

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

  const categories = [...new Set(templates.map((template) => template.category || "Wedding"))].sort();

  return (
    <MarketingLayout>
      <main className="px-6 py-12 lg:px-10 lg:py-16">
        <section className="mx-auto max-w-7xl">
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

              <div className="mt-6 overflow-hidden rounded-3xl border border-[#ECD5E2] bg-white shadow-[0_14px_46px_rgba(81,25,62,0.05)]">
                <div className="grid grid-cols-[1.2fr_1fr_0.55fr_0.55fr_0.55fr] gap-3 border-b border-[#F0DDE7] bg-[#FFF8FB] px-5 py-3 text-xs font-bold uppercase tracking-[0.14em] text-neutral-500">
                  <div>Template</div>
                  <div>Category</div>
                  <div>Sort</div>
                  <div>Active</div>
                  <div className="text-right">Action</div>
                </div>
                <div className="divide-y divide-[#F0DDE7]">
                  {templates.map((templateItem) => (
                    <div key={templateItem.id} className="grid grid-cols-1 gap-4 px-5 py-5 lg:grid-cols-[1.2fr_1fr_0.55fr_0.55fr_0.55fr] lg:items-center">
                      <div>
                        <div className="flex items-center gap-3">
                          <span className="flex h-11 w-11 items-center justify-center rounded-xl border border-black/10 text-lg italic" style={{ backgroundColor: templateItem.bg, color: templateItem.text, fontFamily: templateItem.font }}>
                            {templateItem.name.slice(0, 1)}
                          </span>
                          <div>
                            <div className="font-heading text-lg font-extrabold text-[#32113A]">{templateItem.name}</div>
                            <div className="text-xs text-neutral-500">{templateItem.id}</div>
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
          <Route path="/admin/templates" element={<AdminTemplatesPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </div>
    </AuthProvider>
  );
}

export default App;
