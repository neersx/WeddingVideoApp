import { useEffect, useRef, useState } from "react";
import { Link, NavLink, Route, Routes, useLocation } from "react-router-dom";
import {
  ArrowRight,
  CheckCircle2,
  Clapperboard,
  Film,
  Heart,
  Mail,
  Music,
  Palette,
  PlayCircle,
  Share2,
  Sparkles,
  Users,
  Video,
} from "lucide-react";
import { Toaster, toast } from "sonner";
import axios from "axios";
import "@/App.css";
import { TemplatePicker } from "@/components/TemplatePicker";
import { DetailsForm } from "@/components/DetailsForm";
import { ScheduleBuilder } from "@/components/ScheduleBuilder";
import { PhotoUploader } from "@/components/PhotoUploader";
import { PreviewPane } from "@/components/PreviewPane";
import { MusicPicker } from "@/components/MusicPicker";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || "http://localhost:8001";
export const API = `${BACKEND_URL}/api`;

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
};

const pageMeta = {
  "/": {
    title: "InvitaWedds | Personalised Wedding Invitation Videos",
    description:
      "Create beautiful, personalised wedding invitation videos with your story, events, photos and music.",
  },
  "/create-video": {
    title: "Create Your Wedding Invitation Video | InvitaWedds",
    description:
      "Choose a design, add your wedding details, photos and music, and create a share-ready invitation video.",
  },
  "/about": {
    title: "About InvitaWedds | Wedding Stories in Motion",
    description:
      "Learn how InvitaWedds makes it simple for couples to turn wedding details and memories into beautiful invitation videos.",
  },
  "/contact": {
    title: "Contact InvitaWedds | Wedding Video Support",
    description:
      "Contact InvitaWedds for help creating, customising or sharing your wedding invitation video.",
  },
};

function PageMeta() {
  const { pathname } = useLocation();

  useEffect(() => {
    const meta = pageMeta[pathname] || pageMeta["/"];
    const canonicalUrl = `https://invitawedds.com${pathname === "/" ? "/" : pathname}`;
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
  return (
    <header className="sticky top-0 z-50 border-b border-black/5 bg-[#fffdf9]/90 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-5 py-3 lg:px-10">
        <Link to="/" className="flex items-center gap-3" aria-label="InvitaWedds home">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[#5315A7] via-[#D70A79] to-[#F6A700] shadow-sm">
            <PlayCircle className="h-5 w-5 text-white" aria-hidden="true" />
          </span>
          <span>
            <span className="block font-heading text-xl font-extrabold tracking-tight text-[#32113A]" data-testid="app-title">
              InvitaWedds
            </span>
            <span className="block text-[9px] font-semibold uppercase tracking-[0.22em] text-[#9B5A76]">
              Wedding stories in motion
            </span>
          </span>
        </Link>

        <nav className="order-3 flex w-full items-center justify-center gap-1 border-t border-black/5 pt-3 sm:order-2 sm:w-auto sm:border-0 sm:pt-0" aria-label="Main navigation">
          <NavLink to="/" end className={navClass}>Home</NavLink>
          <NavLink to="/about" className={navClass}>About</NavLink>
          <NavLink to="/contact" className={navClass}>Contact</NavLink>
        </nav>

        <Link
          to="/create-video"
          className="order-2 inline-flex items-center gap-2 rounded-full bg-[#32113A] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-[#52184D] sm:order-3"
        >
          Create Video <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      </div>
    </header>
  );
}

function SiteFooter() {
  return (
    <footer className="border-t border-white/10 bg-[#241027] text-white">
      <div className="mx-auto grid max-w-7xl gap-10 px-6 py-12 md:grid-cols-[1.4fr_1fr_1fr] lg:px-10">
        <div>
          <div className="font-heading text-2xl font-extrabold">InvitaWedds</div>
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
          <a className="mt-4 inline-flex items-center gap-2 text-sm text-white/70 hover:text-white" href="mailto:info@dreamwedds.com">
            <Mail className="h-4 w-4" aria-hidden="true" /> info@dreamwedds.com
          </a>
        </div>
      </div>
      <div className="border-t border-white/10 px-6 py-5 text-center text-xs text-white/45">
        © {new Date().getFullYear()} InvitaWedds. Made for celebrations worth remembering.
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
    icon: Film,
    title: "Stories, not static cards",
    copy: "Transform your names, dates, venue and message into a cinematic invitation made for mobile sharing.",
  },
  {
    icon: Palette,
    title: "Designs for your celebration",
    copy: "Choose a visual style that complements your wedding, from joyful marigolds to elegant contemporary themes.",
  },
  {
    icon: Music,
    title: "Photos and music that feel personal",
    copy: "Bring your invitation to life with the memories and soundtrack that already mean something to you.",
  },
  {
    icon: Share2,
    title: "Ready to share everywhere",
    copy: "Create a polished vertical video that looks at home in WhatsApp, Instagram and every family group chat.",
  },
];

function LandingPage() {
  return (
    <MarketingLayout>
      <main>
        <section className="relative overflow-hidden px-6 pb-16 pt-14 lg:px-10 lg:pb-24 lg:pt-20">
          <div className="absolute -left-24 top-20 h-72 w-72 rounded-full bg-[#F6B6D4]/25 blur-3xl" aria-hidden="true" />
          <div className="absolute right-0 top-0 h-80 w-80 rounded-full bg-[#F7CE7A]/20 blur-3xl" aria-hidden="true" />
          <div className="relative mx-auto grid max-w-7xl items-center gap-12 lg:grid-cols-[0.86fr_1.14fr]">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-[#E9C9DC] bg-white/80 px-4 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-[#85155F]">
                <Sparkles className="h-4 w-4" aria-hidden="true" /> Your invitation, beautifully in motion
              </div>
              <h1 className="mt-7 font-heading text-5xl font-extrabold leading-[0.98] tracking-[-0.04em] text-[#32113A] sm:text-6xl lg:text-7xl">
                Let your story begin before the wedding day.
              </h1>
              <p className="mt-6 max-w-xl text-lg leading-8 text-neutral-600">
                Create a personalised wedding invitation video with your details, photos, events and music—designed to be shared with everyone you love.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link to="/create-video" className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-[#6012A8] via-[#C80A76] to-[#E66B24] px-6 py-3.5 font-semibold text-white shadow-[0_14px_32px_rgba(138,20,104,0.22)] transition hover:-translate-y-0.5">
                  Create your video <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
                <a href="#how-it-works" className="inline-flex items-center gap-2 rounded-full border border-black/10 bg-white px-6 py-3.5 font-semibold text-[#32113A] transition hover:border-[#B6548F]/50 hover:bg-[#FFF8FB]">
                  See how it works
                </a>
              </div>
              <div className="mt-9 flex flex-wrap gap-x-6 gap-y-3 text-sm text-neutral-600">
                {["Personalised details", "Photos and music", "Share-ready video"].map((item) => (
                  <span key={item} className="inline-flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-[#B41374]" aria-hidden="true" /> {item}
                  </span>
                ))}
              </div>
            </div>

            <div className="relative">
              <div className="absolute -inset-4 -z-10 rotate-2 rounded-[2rem] bg-gradient-to-br from-[#7A1AB5]/15 via-[#EC267D]/15 to-[#F6B000]/20" aria-hidden="true" />
              <img
                src="/brand/og-image.webp"
                alt="InvitaWedds personalised wedding invitation video shown beside an elegant invitation card"
                className="aspect-[1.904/1] w-full rounded-[1.6rem] object-cover shadow-[0_26px_80px_rgba(67,26,53,0.18)]"
                width="1731"
                height="909"
                fetchPriority="high"
              />
            </div>
          </div>
        </section>

        <section className="border-y border-[#EFDDE7] bg-[#FFF7FB] px-6 py-16 lg:px-10 lg:py-24">
          <div className="mx-auto max-w-7xl">
            <div className="max-w-2xl">
              <div className="section-label text-[#9B256D]">What we do</div>
              <h2 className="mt-3 font-heading text-4xl font-extrabold tracking-tight text-[#32113A] sm:text-5xl">
                Everything you need to invite with feeling.
              </h2>
              <p className="mt-4 text-lg leading-8 text-neutral-600">
                InvitaWedds turns the practical details of your celebration into an invitation people will want to watch twice.
              </p>
            </div>
            <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {serviceCards.map(({ icon: Icon, title, copy }) => (
                <article key={title} className="rounded-3xl border border-[#EDD6E2] bg-white p-6 shadow-[0_12px_40px_rgba(81,25,62,0.05)]">
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

        <section className="px-6 pb-20 lg:px-10 lg:pb-28">
          <div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-8 overflow-hidden rounded-[2rem] bg-[#32113A] px-7 py-10 text-white shadow-[0_24px_70px_rgba(50,17,58,0.2)] sm:px-10 lg:flex-row lg:items-center lg:px-14 lg:py-14">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.2em] text-[#F4C14E]">Your celebration starts here</div>
              <h2 className="mt-3 max-w-2xl font-heading text-4xl font-extrabold tracking-tight">Create an invitation as memorable as the day itself.</h2>
            </div>
            <Link to="/create-video" className="inline-flex shrink-0 items-center gap-2 rounded-full bg-white px-6 py-3.5 font-semibold text-[#32113A] transition hover:-translate-y-0.5 hover:bg-[#FFF4FA]">
              Start creating <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
        </section>
      </main>
    </MarketingLayout>
  );
}

function CreateVideoPage() {
  const [template, setTemplate] = useState("marigold");
  const [details, setDetails] = useState(initialDetails);
  const [schedule, setSchedule] = useState([
    { name: "Haldi", time: "10:00 AM" },
    { name: "Sangeet", time: "7:00 PM" },
    { name: "Wedding", time: "11:30 AM" },
  ]);
  const [photos, setPhotos] = useState([]);
  const [musicId, setMusicId] = useState("tere-sang");
  const [jobStatus, setJobStatus] = useState("idle");
  const [jobProgress, setJobProgress] = useState(0);
  const [jobId, setJobId] = useState(null);
  const [videoUrl, setVideoUrl] = useState(null);
  const pollRef = useRef(null);

  const rendering = jobStatus === "queued" || jobStatus === "rendering";

  useEffect(() => () => clearInterval(pollRef.current), []);

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

  const handleRender = async () => {
    if (!details.partnerOne.trim() || !details.partnerTwo.trim()) {
      toast.error("Both partner names are required");
      return;
    }
    setVideoUrl(null);
    setJobProgress(0);
    setJobStatus("queued");
    try {
      const payload = {
        template,
        couple: { partnerOne: details.partnerOne, partnerTwo: details.partnerTwo },
        eventDate: details.eventDate,
        venue: { name: details.venueName, city: details.venueCity },
        message: details.message,
        displayMessage: details.displayMessage,
        photos,
        musicId: musicId || null,
        schedule,
        durationInSeconds: Number(details.durationInSeconds) || 30,
      };
      const response = await axios.post(`${API}/renders`, payload);
      setJobId(response.data.jobId);
      toast.info("Render queued — this can take a couple of minutes");
      pollJob(response.data.jobId);
    } catch (error) {
      setJobStatus("failed");
      toast.error(error?.response?.data?.detail || "Failed to queue render");
    }
  };

  return (
    <MarketingLayout>
      <main>
        <section className="border-b border-[#EBDDE5] bg-gradient-to-b from-[#FFF7FB] to-[#FFFDF9] px-6 py-10 lg:px-10 lg:py-14">
          <div className="mx-auto flex max-w-7xl flex-col justify-between gap-5 md:flex-row md:items-end">
            <div>
              <div className="section-label text-[#9B256D]">Create Video</div>
              <h1 className="mt-3 font-heading text-4xl font-extrabold tracking-tight text-[#32113A] sm:text-5xl">Build your wedding invitation.</h1>
              <p className="mt-3 max-w-2xl text-neutral-600">Choose a style, add your celebration details and preview the story before you render.</p>
            </div>
            <div className="inline-flex items-center gap-2 text-sm text-neutral-500">
              <Video className="h-4 w-4 text-[#B41374]" aria-hidden="true" /> Vertical video · 1080×1920
            </div>
          </div>
        </section>
        <section className="mx-auto grid max-w-7xl grid-cols-1 gap-8 px-6 py-10 lg:grid-cols-12 lg:gap-12 lg:px-10">
          <div className="space-y-10 lg:col-span-8">
            <TemplatePicker value={template} onChange={setTemplate} />
            <DetailsForm details={details} onChange={setDetails} />
            <ScheduleBuilder schedule={schedule} onChange={setSchedule} />
            <PhotoUploader photos={photos} onChange={setPhotos} />
            <MusicPicker value={musicId} onChange={setMusicId} />
          </div>
          <div className="lg:col-span-4">
            <PreviewPane
              template={template}
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
                InvitaWedds helps couples turn the details of their celebration into a personal video story—one that feels warm, thoughtful and easy to share.
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

function ContactPage() {
  const handleSubmit = (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const subject = encodeURIComponent(`InvitaWedds enquiry from ${form.get("name")}`);
    const body = encodeURIComponent(
      `Name: ${form.get("name")}\nEmail: ${form.get("email")}\n\n${form.get("message")}`,
    );
    window.location.href = `mailto:info@dreamwedds.com?subject=${subject}&body=${body}`;
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
              <a className="mt-1 block font-heading text-xl font-extrabold text-[#32113A] hover:text-[#A3166A]" href="mailto:info@dreamwedds.com">
                info@dreamwedds.com
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
    <div className="App">
      <PageMeta />
      <Toaster position="top-right" richColors />
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/create-video" element={<CreateVideoPage />} />
        <Route path="/about" element={<AboutPage />} />
        <Route path="/contact" element={<ContactPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </div>
  );
}

export default App;
