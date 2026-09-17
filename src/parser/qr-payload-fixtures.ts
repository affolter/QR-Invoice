export interface PayloadOverrides {
  version?: string;
  iban?: string;
  addressType?: string;
  name?: string;
  street?: string;
  buildingNumber?: string;
  postalCode?: string;
  city?: string;
  country?: string;
  amount?: string;
  currency?: string;
  debtorType?: string;
  debtorName?: string;
  debtorStreet?: string;
  debtorBuilding?: string;
  debtorPostal?: string;
  debtorCity?: string;
  debtorCountry?: string;
  referenceType?: string;
  reference?: string;
  message?: string;
  billing?: string;
  eol?: "\n" | "\r\n";
}

/** Synthetic SIX-style payload. Not a real invoice. */
export function buildSwissQrPayload(overrides: PayloadOverrides = {}): string {
  const eol = overrides.eol ?? "\n";
  const fields = [
    "SPC",
    overrides.version ?? "0200",
    "1",
    overrides.iban ?? "CH4431999123000889012",
    overrides.addressType ?? "S",
    overrides.name ?? "Robert Schneider AG",
    overrides.street ?? "Rue du Lac",
    overrides.buildingNumber ?? "1268",
    overrides.postalCode ?? "2501",
    overrides.city ?? "Biel",
    overrides.country ?? "CH",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    overrides.amount ?? "1949.75",
    overrides.currency ?? "CHF",
    overrides.debtorType ?? "S",
    overrides.debtorName ?? "Pia-Maria Rutschmann-Schnyder",
    overrides.debtorStreet ?? "Grosse Marktgasse",
    overrides.debtorBuilding ?? "28",
    overrides.debtorPostal ?? "9400",
    overrides.debtorCity ?? "Rorschach",
    overrides.debtorCountry ?? "CH",
    overrides.referenceType ?? "QRR",
    overrides.reference ?? "210000000003139471430009017",
    overrides.message ?? "Invoice 313947143000901",
    "EPD",
    overrides.billing ?? "//S1/10/10201409/11/190512/20/1400.000-53/30/106017086/31/180508/32/7.7/40/2:10;0:40",
  ];
  return fields.join(eol);
}
