import { z } from "zod";
import { craftDraftFields } from "./craft-brief";

const draftSchema = z.object({
  id: z.uuid(),
  edited: z.number().int().min(0).max(8.64e15),
  fields: z.record(z.string(), z.string()),
  suppliers: z.array(z.string()),
  attachment: z.boolean(),
  product: z.string().nullable(),
  variant: z.string().nullable(),
  assignment: z.string().nullable(),
});

export type RfqDraft = z.infer<typeof draftSchema>;

const draftKey = (user: string) => "locaiz-rfq-drafts:" + user;
const fieldNames = [
  "title", "specifications", "quantity", "unit", "destination",
  "deadline", "currency", "budget", "custom",
  ...craftDraftFields,
];

export function readRfqDrafts(user: string): RfqDraft[] {
  try {
    return z.array(draftSchema).parse(JSON.parse(localStorage.getItem(draftKey(user)) ?? "[]"));
  } catch {
    return [];
  }
}

export function saveRfqDraft(user: string, draft: RfqDraft, form: FormData) {
  const attachment = form.get("attachment");
  const record = {
    ...draft,
    edited: Date.now(),
    fields: Object.fromEntries(
      fieldNames.filter((name) => form.has(name)).map((name) => [name, String(form.get(name))]),
    ),
    suppliers: form.getAll("supplier").map(String),
    attachment: draft.attachment || (attachment instanceof File && attachment.size > 0),
  };
  localStorage.setItem(draftKey(user), JSON.stringify([
    record, ...readRfqDrafts(user).filter(({ id }) => id !== draft.id),
  ]));
}

export function deleteRfqDraft(user: string, id: string) {
  const drafts = readRfqDrafts(user);
  if (!drafts.some((draft) => draft.id === id)) return;
  localStorage.setItem(draftKey(user), JSON.stringify(drafts.filter((draft) => draft.id !== id)));
}
