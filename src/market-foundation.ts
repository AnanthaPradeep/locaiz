import { stockClient } from "./stock/client";

export const marketClient =
  import.meta.env.VITE_MARKETPLACE_FOUNDATION === "1" ? stockClient : null;
export const businessTypes = [
  "Retailer",
  "Artisan",
  "Home-based producer",
  "Cottage industry",
  "Workshop",
  "Small manufacturer",
  "Medium manufacturer",
  "Large manufacturer",
  "Wholesaler",
  "Distributor",
  "Exporter",
  "Service provider",
];
export const methods = [
  "Local retail",
  "Online retail",
  "Wholesale",
  "Maker-direct",
  "Custom manufacturing",
  "Sample order",
  "Community purchase",
  "Quote only",
];
export const trustLabels: Record<string, string> = {
  unverified: "Unverified",
  pending: "Pending Review",
  verified: "Verified",
  restricted: "Restricted",
};

export async function marketAction(
  action: string,
  payload: Record<string, unknown>,
) {
  if (!marketClient) throw new Error("Connected Marketplace is unavailable.");
  const { data, error } = await marketClient.rpc("market_action", {
    action_name: action,
    payload,
  });
  if (error) throw error;
  return data as string;
}

export function validateUpload(file: File, evidence = false) {
  const extensions: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    ...(evidence ? { "application/pdf": "pdf" } : {}),
  };
  const extension = extensions[file.type];
  if (!extension || file.size === 0 || file.size > 5 * 1024 * 1024)
    throw new Error(
      evidence
        ? "Choose a PDF, JPEG, PNG or WebP up to 5 MB."
        : "Choose a JPEG, PNG or WebP up to 5 MB.",
    );
  return extension;
}

async function verifyFileHeader(file: File, extension: string) {
  const bytes = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  const text = new TextDecoder("ascii").decode(bytes);
  const valid = extension === "png"
    ? bytes[0] === 137 && text.slice(1, 4) === "PNG"
    : extension === "jpg"
      ? bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255
      : extension === "webp"
        ? text.startsWith("RIFF") && text.slice(8, 12) === "WEBP"
        : text.startsWith("%PDF-");
  if (!valid) throw new Error("The file content does not match its selected format.");
}

export async function uploadMarketFile(
  file: File,
  prefix: string,
  evidence = false,
  imageBucket: "market-images" | "market-storefronts" = "market-images",
) {
  const extension = validateUpload(file, evidence);
  await verifyFileHeader(file, extension);
  const path = prefix + "/" + crypto.randomUUID() + "." + extension;
  const { error } = await marketClient!.storage
    .from(evidence ? "market-evidence" : imageBucket)
    .upload(path, file, { contentType: file.type });
  if (error) throw error;
  return path;
}

export async function signMarketFile(path: string, evidence = false) {
  const { data, error } = await marketClient!.storage
    .from(evidence ? "market-evidence" : "market-images")
    .createSignedUrl(path, 60);
  if (error) throw error;
  return data.signedUrl;
}

export async function readMarketContext() {
  const { data, error } = await marketClient!.rpc("market_context");
  if (error) throw error;
  return data as {
    operator: boolean;
    businesses: {
      id: string;
      name: string;
      role: string;
      trust: string;
      description: string;
      capabilities: string[];
      type: string;
    }[];
  };
}

export function formText(form: FormData, name: string) {
  return String(form.get(name) ?? "").trim();
}

export function parsePriceTiers(input: string) {
  return input
    .split(/[\n,]+/)
    .filter((value) => value.trim())
    .map((value) => {
      const [quantity, minor, extra] = value.trim().split(":");
      if (
        extra !== undefined ||
        !/^\d+$/.test(quantity) ||
        !/^\d+$/.test(minor ?? "")
      )
        throw new Error("Enter tiers as quantity:minor units, one per line.");
      const tier = { quantity: Number(quantity), minor: Number(minor) };
      if (
        !Number.isSafeInteger(tier.quantity) ||
        !Number.isSafeInteger(tier.minor) ||
        tier.quantity < 1
      )
        throw new Error("Invalid price tier.");
      return tier;
    });
}
