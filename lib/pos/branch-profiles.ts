// Receipt details per branch for the v1 POS app.
// Kept in code (not the database) so the live `branches` table is untouched.
// Fill in Accra's address and phone when known; empty values are simply not printed.

export type BranchProfile = {
  receiptTitle: string;
  address: string | null;
  phone: string | null;
  footerLines: string[];
};

const BRAND_FOOTER = ["Thank you for your order!", "Call: 0592076527"];

const PROFILES: Record<string, BranchProfile> = {
  "cape-coast": {
    receiptTitle: "Bubble Bliss Cape Coast",
    address: "Abura Taxi Station, Cape Coast",
    phone: "0536440126",
    footerLines: BRAND_FOOTER,
  },
  accra: {
    receiptTitle: "Bubble Bliss Accra",
    address: null,
    phone: null,
    footerLines: BRAND_FOOTER,
  },
};

export function getBranchProfile(slug: string): BranchProfile {
  return (
    PROFILES[slug] ?? {
      receiptTitle: "Bubble Bliss",
      address: null,
      phone: null,
      footerLines: BRAND_FOOTER,
    }
  );
}
