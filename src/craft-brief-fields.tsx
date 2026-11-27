import { fieldsForCraft } from "./craft-brief";

export function CraftBriefFields({ craft, values }: { craft: string; values?: Record<string, string> }) {
  const fields = fieldsForCraft(craft);
  if (!fields) return null;
  return (
    <fieldset className="journey-fields">
      <legend>Custom craft brief</legend>
      <input type="hidden" name="regionalCraft" value={craft} />
      {fields.map(([name, label]) => (
        <label key={name}>
          {label}
          <input name={name} maxLength={120} defaultValue={values?.[name]} />
        </label>
      ))}
      <label>
        Sample quantity
        <input name="sampleQuantity" type="number" min={1} max={1000000} step={1} defaultValue={values?.sampleQuantity} />
      </label>
      <p>Optional. Set the planned bulk quantity separately below.</p>
    </fieldset>
  );
}
