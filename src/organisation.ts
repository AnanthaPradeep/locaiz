export type SocialPlatform = "instagram" | "facebook" | "linkedin" | "youtube";

export type SocialProfile = {
  platform: SocialPlatform;
  url: string;
  /** Enable only after confirming this is an official LOCAIZ account. */
  enabled: boolean;
};

export const platformNames: Record<SocialPlatform, string> = {
  instagram: "Instagram",
  facebook: "Facebook",
  linkedin: "LinkedIn",
  youtube: "YouTube",
};

const destinations: Record<
  SocialPlatform,
  { hosts: string[]; account: RegExp }
> = {
  instagram: {
    hosts: ["instagram.com", "www.instagram.com"],
    account:
      /^\/(?!about\/?$|accounts\/?$|explore\/?$|reels?\/?$|p\/?$|stories\/?$|direct\/?$|developer\/?$|legal\/?$)[a-z0-9_.]+\/?$/i,
  },
  facebook: {
    hosts: ["facebook.com", "www.facebook.com"],
    account:
      /^\/(?!home\/?$|login\/?$|help\/?$|watch\/?$|marketplace\/?$|groups\/?$|share\/?$|pages\/?$|events\/?$|gaming\/?$|reels\/?$|settings\/?$|profile\.php\/?$)[a-z0-9.]+\/?$/i,
  },
  linkedin: {
    hosts: ["linkedin.com", "www.linkedin.com"],
    account: /^\/(company|showcase)\/[a-z0-9-]+\/?$/i,
  },
  youtube: {
    hosts: ["youtube.com", "www.youtube.com"],
    account: /^\/(?:@[a-z0-9_.-]+|(?:channel|c|user)\/[a-z0-9_.-]+)\/?$/i,
  },
};

export function officialSocialProfiles(
  profiles: readonly SocialProfile[] = [],
) {
  return profiles.filter(({ enabled, platform, url }) => {
    if (!enabled) return false;
    const destination = destinations[platform];
    try {
      const address = new URL(url);
      return (
        address.protocol === "https:" &&
        !address.username &&
        !address.password &&
        !address.port &&
        !address.search &&
        !address.hash &&
        destination.hosts.includes(address.hostname) &&
        destination.account.test(address.pathname)
      );
    } catch {
      return false;
    }
  });
}
export type PublicOrganisation = {
  supportEmail?: string;
  sellerEmail?: string;
  partnershipEmail?: string;
  privacyEmail?: string;
  phone?: string;
  legalName?: string;
  registeredAddress?: string;
  operationalLocation?: string;
  supportHours?: string;
  socialProfiles?: SocialProfile[];
  grievanceOfficer?: { name: string; channel: string };
};

export const organisation: PublicOrganisation = {};
