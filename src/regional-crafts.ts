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
