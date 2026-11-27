import type { SupabaseClient } from "@supabase/supabase-js";

type Location = { id: string; name: string; parent_id: string | null };

export async function regionalLocations(client: SupabaseClient, state: string) {
  const root = await client.from("sourcing_places").select("id,name,parent_id")
    .ilike("name", state).ilike("kind", "state").order("id");
  if (root.error) throw root.error;

  const locations = new Map<string, Location>(root.data.map((place) => [place.id, place]));
  let parents = [...locations.keys()];
  while (parents.length) {
    const next: string[] = [];
    for (let index = 0; index < parents.length; index += 50) {
      const batch = parents.slice(index, index + 50);
      for (let offset = 0; ; offset += 200) {
        const result = await client.from("sourcing_places").select("id,name,parent_id")
          .in("parent_id", batch).order("id").range(offset, offset + 199);
        if (result.error) throw result.error;
        for (const place of result.data) {
          if (locations.has(place.id)) continue;
          locations.set(place.id, place);
          next.push(place.id);
        }
        if (result.data.length < 200) break;
      }
    }
    parents = next;
  }
  return [...locations.values()].sort((a, b) => a.name.localeCompare(b.name));
}
