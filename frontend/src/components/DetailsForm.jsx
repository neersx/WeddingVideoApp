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

export const DetailsForm = ({ details, onChange }) => {
  const set = (key) => (e) => onChange({ ...details, [key]: e.target.value });
  const selectedDate = parseEventDate(details.eventDate);

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
          <Popover>
            <PopoverTrigger asChild>
              <button
                type="button"
                data-testid="event-date-input"
                className={cn(
                  "flex h-auto w-full items-center justify-between rounded-md border border-input bg-background px-3 py-[1.375rem] text-sm ring-offset-background transition-colors hover:border-[#D9A9C6] focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
                  !selectedDate && "text-muted-foreground",
                )}
              >
                {selectedDate ? format(selectedDate, DATE_FORMAT) : "Pick a date"}
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
          <Field label="Showcase Final Screen Message">
            <Textarea
              data-testid="display-message-input"
              value={details.displayMessage}
              onChange={set("displayMessage")}
              rows={4}
              placeholder="The moment we've all been waiting for..."
            />
          </Field>
        </div>
      </div>
    </section>
  );
};
