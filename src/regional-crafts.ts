export const regionalCrafts = [
  {
    id: "tamil-nadu",
    state: "Tamil Nadu",
    alt: "Illustration of a Tanjore painting, a brass lamp and Kanchipuram silk",
    crafts: [
      "Tanjore painting", "Thanjavur dancing dolls", "Kanchipuram silk",
      "Pattamadai reed mats", "Swamimalai bronze", "Nachiarkoil brass lamps",
      "Chettinad baskets", "Athangudi tiles",
    ],
  },
  {
    id: "kerala",
    state: "Kerala",
    alt: "Illustration of Kerala mural art, a coconut-shell bowl, a coir basket and Kasavu cotton",
    crafts: [
      "Kerala mural art", "Kasavu handloom", "Coir baskets and mats",
      "Coconut-shell crafts", "Aranmula metal mirrors", "Nettur wooden boxes",
      "Kathakali masks", "Bell-metal lamps",
    ],
  },
];

export function findRegionalCraft(id: string | null, craft: string | null) {
  const region = regionalCrafts.find((item) => item.id === id);
  return region && craft && region.crafts.includes(craft) ? { state: region.state, craft } : undefined;
}

export function regionalDirectoryHref(region: string, craft?: string) {
  return "/sourcing/regional?" + new URLSearchParams(craft ? { region, craft } : { region });
}

export function regionalRequestHref(region: string, craft: string, connected: boolean, maker?: { id: string; name: string }) {
  return connected
    ? "/account/journey?" + new URLSearchParams({ new: "1", region, craft, ...(maker && { supplier: maker.id }) })
    : "/connect?" + new URLSearchParams({
      find: "1", q: craft, region,
      customNotes: [findRegionalCraft(region, craft)?.state, maker && "Preferred sample maker: " + maker.name].filter(Boolean).join(" / "),
    });
}
