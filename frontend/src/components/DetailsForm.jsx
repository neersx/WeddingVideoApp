import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const Field = ({ label, testId, children }) => (
  <div className="space-y-2 text-left">
    <Label className="text-xs font-medium uppercase tracking-[0.1em] text-neutral-500">
      {label}
    </Label>
    {children}
  </div>
);

export const DetailsForm = ({ details, onChange }) => {
  const set = (key) => (e) => onChange({ ...details, [key]: e.target.value });

  return (
    <section>
      <h2 className="section-label mb-4 text-left">02 — Couple &amp; Event Details</h2>
      <div className="tactile-card grid grid-cols-1 gap-6 p-8 sm:grid-cols-2">
        <Field label="Partner One">
          <Input data-testid="partner1-input" value={details.partnerOne} onChange={set("partnerOne")} placeholder="Aisha" className="py-5" />
        </Field>
        <Field label="Partner Two">
          <Input data-testid="partner2-input" value={details.partnerTwo} onChange={set("partnerTwo")} placeholder="Rohan" className="py-5" />
        </Field>
        <Field label="Event Date">
          <Input data-testid="event-date-input" value={details.eventDate} onChange={set("eventDate")} placeholder="November 21, 2026" className="py-5" />
        </Field>
        <Field label="Video Length">
          <Select
            value={String(details.durationInSeconds)}
            onValueChange={(v) => onChange({ ...details, durationInSeconds: Number(v) })}
          >
            <SelectTrigger data-testid="duration-select" className="py-5">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="10">10 seconds (quick test)</SelectItem>
              <SelectItem value="20">20 seconds</SelectItem>
              <SelectItem value="30">30 seconds (full)</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <Field label="Venue Name">
          <Input data-testid="venue-name-input" value={details.venueName} onChange={set("venueName")} placeholder="The Leela Palace" className="py-5" />
        </Field>
        <Field label="City">
          <Input data-testid="venue-city-input" value={details.venueCity} onChange={set("venueCity")} placeholder="Udaipur" className="py-5" />
        </Field>
        <div className="sm:col-span-2">
          <Field label="Custom Message / Quote">
            <Textarea
              data-testid="message-input"
              value={details.message}
              onChange={set("message")}
              rows={3}
              placeholder="Together with their families..."
            />
          </Field>
        </div>
        <div className="sm:col-span-2">
          <Field label="Music URL (optional, .mp3)">
            <Input
              data-testid="music-url-input"
              value={details.musicUrl}
              onChange={set("musicUrl")}
              placeholder="https://example.com/track.mp3"
              className="py-5"
            />
          </Field>
        </div>
      </div>
    </section>
  );
};
