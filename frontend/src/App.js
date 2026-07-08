import { useState } from "react";
import "@/App.css";
import { Toaster, toast } from "sonner";
import axios from "axios";
import { Clapperboard } from "lucide-react";
import { TemplatePicker } from "@/components/TemplatePicker";
import { DetailsForm } from "@/components/DetailsForm";
import { ScheduleBuilder } from "@/components/ScheduleBuilder";
import { PhotoUploader } from "@/components/PhotoUploader";
import { PreviewPane } from "@/components/PreviewPane";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
export const API = `${BACKEND_URL}/api`;

const initialDetails = {
  partnerOne: "Aisha",
  partnerTwo: "Rohan",
  eventDate: "November 21, 2026",
  venueName: "The Leela Palace",
  venueCity: "Udaipur",
  message:
    "Together with their families, they invite you to celebrate the beginning of their forever.",
  musicUrl: "",
  durationInSeconds: 30,
};

function App() {
  const [template, setTemplate] = useState("marigold");
  const [details, setDetails] = useState(initialDetails);
  const [schedule, setSchedule] = useState([
    { name: "Haldi", time: "10:00 AM" },
    { name: "Sangeet", time: "7:00 PM" },
    { name: "Wedding", time: "11:30 AM" },
  ]);
  const [photos, setPhotos] = useState([]);
  const [rendering, setRendering] = useState(false);
  const [videoUrl, setVideoUrl] = useState(null);

  const handleRender = async () => {
    if (!details.partnerOne.trim() || !details.partnerTwo.trim()) {
      toast.error("Both partner names are required");
      return;
    }
    setRendering(true);
    setVideoUrl(null);
    try {
      const payload = {
        template,
        couple: { partnerOne: details.partnerOne, partnerTwo: details.partnerTwo },
        eventDate: details.eventDate,
        venue: { name: details.venueName, city: details.venueCity },
        message: details.message,
        photos,
        musicUrl: details.musicUrl || null,
        schedule,
        durationInSeconds: Number(details.durationInSeconds) || 30,
      };
      const res = await axios.post(`${API}/renders`, payload, { timeout: 900000 });
      setVideoUrl(`${BACKEND_URL}${res.data.video_url}`);
      toast.success("Your invitation video is ready");
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Render failed. Check the render service.");
    } finally {
      setRendering(false);
    }
  };

  return (
    <div className="App min-h-screen bg-[#FDFBF7] text-[#171717]">
      <Toaster position="top-right" richColors />
      <header className="sticky top-0 z-40 border-b border-black/5 bg-white/70 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4 lg:px-10">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-md bg-[#0A0A0A]">
              <Clapperboard className="h-5 w-5 text-[#D4AF37]" />
            </div>
            <div className="text-left">
              <div className="font-heading text-lg font-extrabold tracking-tighter" data-testid="app-title">
                DreamWedds
              </div>
              <div className="text-[10px] uppercase tracking-[0.2em] text-neutral-500">
                Render Studio
              </div>
            </div>
          </div>
          <div className="hidden text-xs uppercase tracking-[0.15em] text-neutral-500 sm:block">
            Remotion render-service · 1080×1920
          </div>
        </div>
      </header>

      <main className="mx-auto grid max-w-7xl grid-cols-1 gap-8 px-6 py-10 lg:grid-cols-12 lg:gap-12 lg:px-10">
        <div className="space-y-10 lg:col-span-8">
          <TemplatePicker value={template} onChange={setTemplate} />
          <DetailsForm details={details} onChange={setDetails} />
          <ScheduleBuilder schedule={schedule} onChange={setSchedule} />
          <PhotoUploader photos={photos} onChange={setPhotos} />
        </div>
        <div className="lg:col-span-4">
          <PreviewPane
            template={template}
            rendering={rendering}
            videoUrl={videoUrl}
            onRender={handleRender}
          />
        </div>
      </main>
    </div>
  );
}

export default App;
