import { CalendarDays } from "lucide-react";
import { format, isValid, parse } from "date-fns";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const DATE_FORMAT = "MMMM d, yyyy";

const TAG_SUGGESTIONS = {
  Wedding: ["wedding", "showcase", "premium invitation", "traditional", "family celebration"],
  Engagement: ["engagement", "save the date", "ring ceremony", "couple story", "romantic"],
  Birthday: ["birthday", "milestone", "party", "family", "celebration"],
};

const parseEventDate = (value) => {
  if (!value) return undefined;
  const parsed = parse(value, DATE_FORMAT, new Date());
  return isValid(parsed) ? parsed : undefined;
};

const Field = ({ label, testId, children }) => (
  <div className="space-y-2 text-left">
    <Label className="text-xs font-medium uppercase tracking-[0.1em] text-neutral-500">
      {label}
    </Label>
    {children}
  </div>
);

export const DetailsForm = ({ details, onChange, category = "Wedding" }) => {
  const set = (key) => (e) => onChange({ ...details, [key]: e.target.value });
  const selectedDate = parseEventDate(details.eventDate);
  const isEngagement = category === "Engagement";
  const isBirthday = category === "Birthday";
  const heading = isBirthday ? "02 — Birthday Details" : isEngagement ? "02 — Engagement Details" : "02 — Couple & Event Details";
  const tags = typeof details.tags === "string" ? details.tags : (details.tags || []).join(", ");
  const suggestions = TAG_SUGGESTIONS[category] || TAG_SUGGESTIONS.Wedding;
  const addTag = (tag) => {
    const current = tags.split(",").map((item) => item.trim()).filter(Boolean);
    if (!current.some((item) => item.toLowerCase() === tag.toLowerCase())) {
      onChange({ ...details, tags: [...current, tag].join(", ") });
    }
  };

  return (
    <section>
      <h2 className="section-label mb-3 text-left">{heading}</h2>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label={isBirthday ? "First name" : "Partner One"}>
          <Input data-testid="partner1-input" value={details.partnerOne} onChange={set("partnerOne")} placeholder={isBirthday ? "First name" : "Aisha"} className="py-4" />
        </Field>
        <Field label={isBirthday ? "Last name" : "Partner Two"}>
          <Input data-testid="partner2-input" value={details.partnerTwo} onChange={set("partnerTwo")} placeholder={isBirthday ? "Last name" : "Rohan"} className="py-4" />
        </Field>
        <Field label={isBirthday ? "Birthday Date" : isEngagement ? "Engagement Date" : "Event Date"}>
          <Popover>
            <PopoverTrigger asChild>
              <button
                type="button"
                data-testid="event-date-input"
                className={cn(
                  "flex h-auto w-full items-center justify-between rounded-md border border-input bg-background px-3 py-[1.125rem] text-sm ring-offset-background transition-colors hover:border-[#D9A9C6] focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
                  !selectedDate && "text-muted-foreground",
                )}
              >
                {selectedDate ? format(selectedDate, DATE_FORMAT) : isBirthday ? "Pick a birthday" : "Pick a date"}
                <CalendarDays className="ml-2 h-4 w-4 shrink-0 text-[#B41374]" aria-hidden="true" />
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={selectedDate}
                defaultMonth={selectedDate}
                onSelect={(date) =>
                  date && onChange({ ...details, eventDate: format(date, DATE_FORMAT) })
                }
                initialFocus
              />
            </PopoverContent>
          </Popover>
        </Field>
        <Field label="Video Length">
          <Select
            value={String(details.durationInSeconds)}
            onValueChange={(v) => onChange({ ...details, durationInSeconds: Number(v) })}
          >
            <SelectTrigger data-testid="duration-select" className="py-4">
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
          <Input data-testid="venue-name-input" value={details.venueName} onChange={set("venueName")} placeholder="The Leela Palace" className="py-4" />
        </Field>
        <Field label="City">
          <Input data-testid="venue-city-input" value={details.venueCity} onChange={set("venueCity")} placeholder="Udaipur" className="py-4" />
        </Field>
        <div className="sm:col-span-2">
          <Field label={isBirthday ? "Birthday Message / Quote" : isEngagement ? "Engagement Message / Quote" : "Custom Message / Quote"}>
            <Textarea
              data-testid="message-input"
              value={details.message}
              onChange={set("message")}
              rows={2}
              placeholder={isBirthday ? "Come celebrate a wonderful birthday..." : isEngagement ? "With joy in their hearts..." : "Together with their families..."}
            />
          </Field>
        </div>
        <div className="sm:col-span-2">
          <Field label="Tags">
            <Input
              data-testid="tags-input"
              value={tags}
              onChange={set("tags")}
              placeholder="wedding, premium invitation, family celebration"
              className="py-4"
            />
            <div className="flex flex-wrap gap-2 pt-1">
              <span className="self-center text-xs text-neutral-400">Suggestions:</span>
              {suggestions.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => addTag(tag)}
                  className="rounded-full border border-[#E8C9DB] bg-[#FFF8FB] px-2.5 py-1 text-xs font-semibold text-[#8D1B63] transition hover:border-[#C80A76] hover:bg-[#FFF0F7]"
                >
                  + {tag}
                </button>
              ))}
            </div>
            <p className="text-xs text-neutral-400">Separate tags with commas. Up to 12 tags are saved with the video.</p>
          </Field>
        </div>
        <div className="sm:col-span-2">
          <Field label="Showcase Final Screen Message">
            <Textarea
              data-testid="display-message-input"
              value={details.displayMessage}
              onChange={set("displayMessage")}
              rows={3}
              placeholder="The moment we've all been waiting for..."
            />
          </Field>
        </div>
      </div>
    </section>
  );
};
