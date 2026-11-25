import type { Listing } from "./catalog";

const words = (value: string): string[] =>
  value
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .match(/[\p{L}\p{N}]+/gu) ?? [];
const synonyms = [
  ["earbuds", "earphones"],
  ["headphones", "headset"],
  ["sofa", "couch"],
  ["tshirt", "tee"],
];
const equivalent = new Map(
  synonyms.flatMap((group) => group.map((word) => [word, group] as const)),
);

function oneTypo(term: string, candidate: string) {
  if (
    !/^[a-z]{5,}$/.test(term) ||
    !/^[a-z]{5,}$/.test(candidate) ||
    Math.abs(term.length - candidate.length) > 1
  )
    return false;
  const [shorter, longer] =
    term.length > candidate.length ? [candidate, term] : [term, candidate];
  let index = 0;
  while (index < shorter.length && shorter[index] === longer[index]) index++;
  if (shorter.length !== longer.length)
    return shorter.slice(index) === longer.slice(index + 1);
  return (
    shorter.slice(index + 1) === longer.slice(index + 1) ||
    (shorter[index] === longer[index + 1] &&
      shorter[index + 1] === longer[index] &&
      shorter.slice(index + 2) === longer.slice(index + 2))
  );
}

export function rankListings<T extends Listing>(
  catalogue: T[],
  query: string,
): T[] {
  const terms = words(query).slice(0, 20);
  if (!terms.length) return catalogue;
  return catalogue
    .flatMap((item) => {
      const title = words(item.name);
      const metadata = words(
        [
          item.category,
          item.subcategory,
          item.shopSlug,
          item.city,
          item.detail,
          ...Object.values(item.specifications ?? {}),
        ].join(" "),
      );
      let score = title.join(" ") === terms.join(" ") ? 30 : 0;
      for (const term of terms) {
        if (title.includes(term)) score += 12;
        else if (title.some((word) => word.startsWith(term))) score += 8;
        else if (metadata.includes(term)) score += 6;
        else if (metadata.some((word) => word.startsWith(term))) score += 4;
        else if (
          equivalent
            .get(term)
            ?.some((word) => title.includes(word) || metadata.includes(word))
        )
          score += 3;
        else if (title.some((word) => oneTypo(term, word))) score += 1;
        else return [];
      }
      return [{ item, score }];
    })
    .sort((left, right) => right.score - left.score)
    .map((result) => result.item);
}
