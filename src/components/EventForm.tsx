import { CATEGORIES, cx } from "@/utils/format";
import { Field, inputClass } from "@/components/ui";
import type { EventFormValues } from "@/services/eventForm";

export function EventForm({
  values,
  onChange,
  showActive = false,
  showDemo = true,
}: {
  values: EventFormValues;
  onChange: (values: EventFormValues) => void;
  showActive?: boolean;
  showDemo?: boolean;
}) {
  function set<K extends keyof EventFormValues>(key: K, value: EventFormValues[K]) {
    onChange({ ...values, [key]: value });
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Field label="Event name">
        <input className={inputClass} value={values.name} onChange={(event) => set("name", event.target.value)} />
      </Field>
      <Field label="Category">
        <select className={inputClass} value={values.category} onChange={(event) => set("category", event.target.value)}>
          {CATEGORIES.map((category) => (
            <option key={category}>{category}</option>
          ))}
        </select>
      </Field>
      <div className="sm:col-span-2">
        <Field label="Description">
          <textarea className={cx(inputClass, "min-h-28")} value={values.description} onChange={(event) => set("description", event.target.value)} />
        </Field>
      </div>
      <div className="sm:col-span-2">
        <Field label="Event image" hint="Paste a hosted image URL. The MVP does not upload files.">
          <input className={inputClass} value={values.imageURI} onChange={(event) => set("imageURI", event.target.value)} placeholder="https://" />
        </Field>
      </div>
      <Field label="Date">
        <input className={inputClass} type="date" value={values.date} onChange={(event) => set("date", event.target.value)} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Start time">
          <input className={inputClass} type="time" value={values.startTime} onChange={(event) => set("startTime", event.target.value)} />
        </Field>
        <Field label="End time">
          <input className={inputClass} type="time" value={values.endTime} onChange={(event) => set("endTime", event.target.value)} />
        </Field>
      </div>
      <Field label="Venue">
        <input className={inputClass} value={values.venue} onChange={(event) => set("venue", event.target.value)} />
      </Field>
      <Field label="Location">
        <input className={inputClass} value={values.location} onChange={(event) => set("location", event.target.value)} />
      </Field>
      <Field label="Ticket price in testnet AVAX">
        <input className={inputClass} inputMode="decimal" value={values.price} onChange={(event) => set("price", event.target.value)} />
      </Field>
      <Field label="Maximum ticket supply">
        <input className={inputClass} inputMode="numeric" value={values.maxSupply} onChange={(event) => set("maxSupply", event.target.value)} />
      </Field>
      <Field label="Organizer bonus points" hint="Issued automatically when an attendee checks in.">
        <input className={inputClass} inputMode="numeric" value={values.bonusPoints} onChange={(event) => set("bonusPoints", event.target.value)} />
      </Field>
      <div className="flex flex-col justify-end gap-3 pb-2 text-sm">
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={values.transfersAllowed} onChange={(event) => set("transfersAllowed", event.target.checked)} />
          Allow ticket transfers before check-in
        </label>
        {showDemo ? (
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={values.demo} onChange={(event) => set("demo", event.target.checked)} />
            Mark as a demo / sample event
          </label>
        ) : null}
        {showActive ? (
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={values.active} onChange={(event) => set("active", event.target.checked)} />
            Event is on sale
          </label>
        ) : null}
      </div>
    </div>
  );
}
