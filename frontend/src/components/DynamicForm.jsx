import { useRef, useState } from "react";
import axios from "axios";
import { toast } from "sonner";
import { CalendarDays, ImagePlus, Loader2, Plus, Trash2, X } from "lucide-react";
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

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || "http://localhost:8001";
const API = `${BACKEND_URL}/api`;
const DATE_FORMAT = "MMMM d, yyyy";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const CURRENT_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: 90 }, (_, i) => CURRENT_YEAR + 1 - i); // this year +1 back to ~89 years ago

const parseFieldDate = (value) => {
  if (!value) return undefined;
  const parsed = parse(value, DATE_FORMAT, new Date());
  return isValid(parsed) ? parsed : undefined;
};

const Field = ({ label, required, description, children }) => (
  <div className="space-y-2 text-left">
    {label ? (
      <Label className="text-xs font-medium uppercase tracking-[0.1em] text-neutral-500">
        {label}
        {required ? <span className="ml-1 text-[#C80A76]">*</span> : null}
      </Label>
    ) : null}
    {children}
    {description ? <p className="text-xs text-neutral-400">{description}</p> : null}
  </div>
);

// Uploads a single image to /api/upload and stores the returned URL as the
// field value. Shows a thumbnail with replace/remove once uploaded.
const ImageUploadField = ({ value, onChange, accept, heightClass = "h-40" }) => {
  const inputRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const acceptAttr = Array.isArray(accept) ? accept.join(",") : "image/jpeg,image/png,image/webp";

  const pick = () => inputRef.current?.click();

  const handleFile = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = ""; // allow re-picking the same file
    if (!file) return;
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const { data } = await axios.post(`${API}/upload`, form);
      onChange(data.url);
    } catch (error) {
      toast.error(error?.response?.data?.detail || "Image upload failed");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div>
      <input ref={inputRef} type="file" accept={acceptAttr} className="hidden" onChange={handleFile} />
      {value ? (
        <div className="relative w-full overflow-hidden rounded-xl border border-[#ECD5E2]">
          <img src={value.startsWith("http") ? value : `${BACKEND_URL}${value}`} alt="" className={`${heightClass} w-full object-cover`} />
          <div className="absolute right-2 top-2 flex gap-2">
            <button type="button" onClick={pick} className="rounded-lg bg-white/90 px-2.5 py-1 text-xs font-semibold text-[#8D1B63] shadow hover:bg-white">Replace</button>
            <button type="button" onClick={() => onChange("")} className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/90 text-neutral-600 shadow hover:bg-white" aria-label="Remove image"><X className="h-3.5 w-3.5" /></button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={pick}
          disabled={uploading}
          className={`flex ${heightClass} w-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-[#D9A9C6] bg-[#FFF8FB] text-sm font-semibold text-[#8D1B63] transition hover:bg-[#FFF0F7] disabled:opacity-60`}
        >
          {uploading ? <Loader2 className="h-6 w-6 animate-spin" /> : <ImagePlus className="h-6 w-6" />}
          {uploading ? "Uploading…" : "Upload image"}
        </button>
      )}
    </div>
  );
};

// Month + year pickers that store a sortable "YYYY-MM" string. Keeps the two
// selections in local state so a partial pick (year OR month first) stays
// shown in its dropdown — the combined value is only emitted once both are set.
const MonthYearField = ({ value, onChange }) => {
  const [initYear, initMonth] = String(value || "").split("-");
  const [year, setYear] = useState(initYear || "");
  const [month, setMonth] = useState(initMonth || "");
  const emit = (nextYear, nextMonth) => {
    setYear(nextYear);
    setMonth(nextMonth);
    onChange(nextYear && nextMonth ? `${nextYear}-${nextMonth}` : "");
  };
  return (
    <div className="grid grid-cols-2 gap-2">
      <Select value={month} onValueChange={(m) => emit(year, m)}>
        <SelectTrigger className="py-4"><SelectValue placeholder="Month" /></SelectTrigger>
        <SelectContent>
          {MONTHS.map((name, i) => (
            <SelectItem key={name} value={String(i + 1).padStart(2, "0")}>{name}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select value={year} onValueChange={(y) => emit(y, month)}>
        <SelectTrigger className="py-4"><SelectValue placeholder="Year" /></SelectTrigger>
        <SelectContent className="max-h-64">
          {YEARS.map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
        </SelectContent>
      </Select>
    </div>
  );
};

// Renders the control for one field by type. Shared by top-level fields and
// repeater item fields so every type behaves identically in both places.
const FieldControl = ({ field, value, onChange, imageHeightClass }) => {
  if (field.type === "select") {
    return (
      <Select value={value || ""} onValueChange={onChange}>
        <SelectTrigger className="py-4"><SelectValue placeholder="Choose one" /></SelectTrigger>
        <SelectContent>
          {(field.options || []).map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }
  if (field.type === "date") {
    const selectedDate = parseFieldDate(value);
    return (
      <Popover>
        <PopoverTrigger asChild>
          <button
            type="button"
            className={cn(
              "flex h-auto w-full items-center justify-between rounded-md border border-input bg-background px-3 py-[1.125rem] text-sm ring-offset-background transition-colors hover:border-[#D9A9C6] focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
              !selectedDate && "text-muted-foreground",
            )}
          >
            {selectedDate ? format(selectedDate, DATE_FORMAT) : "Pick a date"}
            <CalendarDays className="ml-2 h-4 w-4 shrink-0 text-[#B41374]" aria-hidden="true" />
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar mode="single" selected={selectedDate} defaultMonth={selectedDate} onSelect={(date) => date && onChange(format(date, DATE_FORMAT))} initialFocus />
        </PopoverContent>
      </Popover>
    );
  }
  if (field.type === "image") {
    return <ImageUploadField value={value} onChange={onChange} accept={field.accept} heightClass={imageHeightClass} />;
  }
  if (field.type === "month") {
    return <MonthYearField value={value} onChange={onChange} />;
  }
  if (field.type === "textarea") {
    return (
      <Textarea
        value={value || ""}
        onChange={(e) => onChange(e.target.value)}
        rows={3}
        maxLength={field.maxLength || undefined}
        placeholder={field.placeholder || ""}
      />
    );
  }
  return (
    <Input
      value={value || ""}
      onChange={(e) => onChange(e.target.value)}
      maxLength={field.maxLength || undefined}
      placeholder={field.placeholder || ""}
      className="py-4"
    />
  );
};

// A repeater: a list of item cards, each holding the repeater's itemFields
// rendered by type. Supports minItems/maxItems, addButtonLabel and description.
const RepeaterField = ({ field, value, onChange }) => {
  const rows = Array.isArray(value) ? value : [];
  const itemFields = field.itemFields || [{ key: "name" }, { key: "time" }];
  const max = field.maxItems || field.max || 6;
  // A card layout when items carry rich types (images/textarea); a compact
  // inline row for simple all-text repeaters (e.g. the wedding schedule).
  const rich = itemFields.some((f) => ["image", "textarea", "month"].includes(f.type));

  const updateRow = (rowIndex, itemKey, itemValue) =>
    onChange(rows.map((row, i) => (i === rowIndex ? { ...row, [itemKey]: itemValue } : row)));
  const removeRow = (rowIndex) => onChange(rows.filter((_, i) => i !== rowIndex));
  const addRow = () => { if (rows.length < max) onChange([...rows, {}]); };

  return (
    <div className="sm:col-span-2 space-y-3 border-t border-[#ECD5E2] pt-4">
      <div className="flex items-center justify-between">
        <div>
          <Label className="text-xs font-medium uppercase tracking-[0.1em] text-neutral-500">{field.label}</Label>
          {field.description ? <p className="mt-0.5 text-xs text-neutral-400">{field.description}</p> : null}
        </div>
        <button
          type="button"
          onClick={addRow}
          disabled={rows.length >= max}
          className="flex flex-shrink-0 items-center gap-1 rounded-full border border-[#E8C9DB] px-3 py-1 text-xs font-semibold text-[#8D1B63] transition hover:bg-[#FFF0F7] disabled:opacity-40"
        >
          <Plus className="h-3 w-3" /> {field.addButtonLabel || "Add"}
        </button>
      </div>

      {rich ? (
        // Instagram-style cards, two across: the photo sits on top, then the
        // remaining fields (title, date, message) stack beneath it.
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {rows.map((row, rowIndex) => (
            <div key={rowIndex} className="overflow-hidden rounded-2xl border border-[#ECD5E2] bg-white shadow-[0_10px_30px_rgba(81,25,62,0.05)]">
              {itemFields.filter((f) => f.type === "image").map((itemField) => (
                <FieldControl
                  key={itemField.key}
                  field={itemField}
                  value={row[itemField.key] || ""}
                  onChange={(v) => updateRow(rowIndex, itemField.key, v)}
                  imageHeightClass="aspect-square"
                />
              ))}
              <div className="space-y-3 p-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-[0.14em] text-[#A4176D]">Moment {rowIndex + 1}</span>
                  <button type="button" onClick={() => removeRow(rowIndex)} className="flex items-center gap-1 text-xs font-semibold text-neutral-500 transition hover:text-red-600" aria-label="Remove">
                    <Trash2 className="h-3.5 w-3.5" /> Remove
                  </button>
                </div>
                {itemFields.filter((f) => f.type !== "image").map((itemField) => (
                  <Field key={itemField.key} label={itemField.label} required={itemField.required}>
                    <FieldControl field={itemField} value={row[itemField.key] || ""} onChange={(v) => updateRow(rowIndex, itemField.key, v)} />
                  </Field>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        rows.map((row, rowIndex) => (
          <div key={rowIndex} className="flex items-center gap-2">
            {itemFields.map((itemField) => (
              <Input
                key={itemField.key}
                value={row[itemField.key] || ""}
                onChange={(e) => updateRow(rowIndex, itemField.key, e.target.value)}
                placeholder={itemField.placeholder || ""}
                className="py-3"
              />
            ))}
            <button type="button" onClick={() => removeRow(rowIndex)} className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full border border-[#E8C9DB] text-[#8D1B63] transition hover:bg-[#FFF0F7]" aria-label="Remove">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ))
      )}
      {!rows.length && <p className="text-xs text-neutral-400">No items yet — tap "{field.addButtonLabel || "Add"}".</p>}
    </div>
  );
};

// Renders a category's form manifest (already resolved server-side by
// GET /templates/{id}/form — capability-gated fields, relationship options,
// and maxLength are all pre-merged, so this component just renders what it's given).
export const DynamicForm = ({ schema, values, onChange }) => {
  const fields = schema?.fields || [];

  return (
    <section className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {fields.map((field) => {
          const value = values[field.key] ?? "";

          if (field.type === "repeater") {
            return <RepeaterField key={field.key} field={field} value={value} onChange={(v) => onChange(field.key, v)} />;
          }

          const wide = field.type === "textarea" || field.type === "image";
          return (
            <div key={field.key} className={wide ? "sm:col-span-2" : undefined}>
              <Field label={field.label} required={field.required} description={field.description}>
                <FieldControl field={field} value={value} onChange={(v) => onChange(field.key, v)} />
              </Field>
            </div>
          );
        })}
      </div>
    </section>
  );
};
