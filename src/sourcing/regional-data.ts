import { offers, placeName, suppliers } from "./catalog";

const reed = offers.find(({ productId, supplierId }) => productId === "reed-mat" && supplierId === "reed-studio")!;
const reedMaker = suppliers.find(({ id }) => id === reed.supplierId)!;

export const sampleRegionalMakers = [
  {
    id: "tanjore-art-demo", name: "Thanjavur Painting Workshop", region: "tamil-nadu",
    locality: "Thanjavur", craft: "Tanjore painting", minimum: 1, custom: true, pickup: false,
  },
  {
    id: reedMaker.id, name: reedMaker.name, region: "tamil-nadu",
    locality: placeName(reedMaker.base), craft: "Pattamadai reed mats", minimum: reed.moq,
    custom: Boolean(reed.custom), pickup: Boolean(reed.pickup),
  },
  {
    id: "mural-art-demo", name: "Kerala Mural Workshop", region: "kerala",
    locality: "Thrissur", craft: "Kerala mural art", minimum: 1, custom: true, pickup: false,
  },
  {
    id: "coir-maker-demo", name: "Alappuzha Coir Workshop", region: "kerala",
    locality: "Alappuzha", craft: "Coir baskets and mats", minimum: 10, custom: false, pickup: true,
  },
];

export const regionalOfferKeywords: Record<string, string> = {
  "Pattamadai reed mats": "reed mat",
  "Thanjavur dancing dolls": "Thanjavur dancing doll",
  "Coir baskets and mats": "coir",
  "Aranmula metal mirrors": "Aranmula",
  "Nettur wooden boxes": "Nettur",
  "Kathakali masks": "Kathakali mask",
  "Bell-metal lamps": "bell-metal lamp",
  "Coconut-shell crafts": "coconut shell",
  "Swamimalai bronze": "Swamimalai",
  "Chettinad baskets": "Chettinad basket",
  "Athangudi tiles": "Athangudi tile",
  "Nachiarkoil brass lamps": "Nachiarkoil",
};
