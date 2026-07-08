import { motion, AnimatePresence } from "framer-motion";
import { Plus, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export const ScheduleBuilder = ({ schedule, onChange }) => {
  const update = (i, key, value) => {
    const next = schedule.map((item, idx) => (idx === i ? { ...item, [key]: value } : item));
    onChange(next);
  };

  const remove = (i) => onChange(schedule.filter((_, idx) => idx !== i));
  const add = () => {
    if (schedule.length >= 6) return;
    onChange([...schedule, { name: "", time: "" }]);
  };

  return (
    <section>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="section-label text-left">03 — Event Schedule</h2>
        <Button
          data-testid="add-event-btn"
          variant="outline"
          size="sm"
          onClick={add}
          disabled={schedule.length >= 6}
          className="rounded-full"
        >
          <Plus className="mr-1 h-4 w-4" /> Add event
        </Button>
      </div>
      <div className="space-y-3">
        <AnimatePresence initial={false}>
          {schedule.map((item, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="tactile-card flex items-center gap-4 p-4"
            >
              <Input
                data-testid={`event-name-input-${i}`}
                value={item.name}
                onChange={(e) => update(i, "name", e.target.value)}
                placeholder="Haldi"
                className="flex-1"
              />
              <Input
                data-testid={`event-time-input-${i}`}
                value={item.time}
                onChange={(e) => update(i, "time", e.target.value)}
                placeholder="10:00 AM"
                className="w-40"
              />
              <button
                type="button"
                data-testid={`remove-event-btn-${i}`}
                onClick={() => remove(i)}
                className="text-neutral-400 transition-colors hover:text-red-500"
              >
                <X className="h-4 w-4" />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
        {schedule.length === 0 && (
          <p className="text-sm text-neutral-400">No events — the schedule section will show empty in the video.</p>
        )}
      </div>
    </section>
  );
};
