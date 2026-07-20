import { CalendarDays, Plus, X } from "lucide-react";
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

const parseFieldDate = (value) => {
  if (!value) return undefined;
  const parsed = parse(value, DATE_FORMAT, new Date());
  return isValid(parsed) ? parsed : undefined;
};

const Field = ({ label, required, children }) => (
  <div className="space-y-2 text-left">
    <Label className="text-xs font-medium uppercase tracking-[0.1em] text-neutral-500">
      {label}
      {required ? <span className="ml-1 text-[#C80A76]">*</span> : null}
    </Label>
    {children}
  </div>
);

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

          if (field.type === "select") {
            const options = field.options || [];
            return (
              <Field key={field.key} label={field.label} required={field.required}>
                <Select value={value} onValueChange={(v) => onChange(field.key, v)}>
                  <SelectTrigger className="py-4">
                    <SelectValue placeholder="Choose one" />
                  </SelectTrigger>
                  <SelectContent>
                    {options.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            );
          }

          if (field.type === "date") {
            const selectedDate = parseFieldDate(value);
            return (
              <Field key={field.key} label={field.label} required={field.required}>
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
                    <Calendar
                      mode="single"
                      selected={selectedDate}
                      defaultMonth={selectedDate}
                      onSelect={(date) => date && onChange(field.key, format(date, DATE_FORMAT))}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </Field>
            );
          }

          if (field.type === "repeater") {
            const rows = Array.isArray(value) ? value : [];
            const itemFields = field.itemFields || [{ key: "name" }, { key: "time" }];
            const max = field.max || 6;
            const updateRow = (rowIndex, itemKey, itemValue) =>
              onChange(field.key, rows.map((row, i) => (i === rowIndex ? { ...row, [itemKey]: itemValue } : row)));
            const removeRow = (rowIndex) => onChange(field.key, rows.filter((_, i) => i !== rowIndex));
            const addRow = () => { if (rows.length < max) onChange(field.key, [...rows, {}]); };
            return (
              <div key={field.key} className="sm:col-span-2 space-y-3 border-t border-[#ECD5E2] pt-4">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-medium uppercase tracking-[0.1em] text-neutral-500">{field.label}</Label>
                  <button
                    type="button"
                    onClick={addRow}
                    disabled={rows.length >= max}
                    className="flex items-center gap-1 rounded-full border border-[#E8C9DB] px-3 py-1 text-xs font-semibold text-[#8D1B63] transition hover:bg-[#FFF0F7] disabled:opacity-40"
                  >
                    <Plus className="h-3 w-3" /> Add
                  </button>
                </div>
                {rows.map((row, rowIndex) => (
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
                    <button
                      type="button"
                      onClick={() => removeRow(rowIndex)}
                      className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full border border-[#E8C9DB] text-[#8D1B63] transition hover:bg-[#FFF0F7]"
                      aria-label="Remove"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
                {!rows.length && <p className="text-xs text-neutral-400">No items yet — tap "Add".</p>}
              </div>
            );
          }

          const wide = field.type === "textarea";
          return (
            <div key={field.key} className={wide ? "sm:col-span-2" : undefined}>
              <Field label={field.label} required={field.required}>
                {field.type === "textarea" ? (
                  <Textarea
                    value={value}
                    onChange={(e) => onChange(field.key, e.target.value)}
                    rows={3}
                    maxLength={field.maxLength || undefined}
                    placeholder={field.placeholder || ""}
                  />
                ) : (
                  <Input
                    value={value}
                    onChange={(e) => onChange(field.key, e.target.value)}
                    maxLength={field.maxLength || undefined}
                    placeholder={field.placeholder || ""}
                    className="py-4"
                  />
                )}
              </Field>
            </div>
          );
        })}
      </div>
    </section>
  );
};
