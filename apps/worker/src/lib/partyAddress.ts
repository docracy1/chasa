/** Shared optional party address fields (business FROM / client TO). */
export type PartyAddress = {
  address: string | null;
  state: string | null;
  postal: string | null;
  country: string | null;
  vat: string | null;
};

export function emptyPartyAddress(): PartyAddress {
  return { address: null, state: null, postal: null, country: null, vat: null };
}

export function normalizeOptionalText(value: string | null | undefined, max: number): string | null {
  if (value == null) return null;
  const trimmed = value.trim().slice(0, max);
  return trimmed.length ? trimmed : null;
}

export function partyAddressFromInput(input: {
  address?: string | null;
  state?: string | null;
  postal?: string | null;
  country?: string | null;
  vat?: string | null;
}): PartyAddress {
  return {
    address: normalizeOptionalText(input.address, 300),
    state: normalizeOptionalText(input.state, 120),
    postal: normalizeOptionalText(input.postal, 32),
    country: normalizeOptionalText(input.country, 120),
    vat: normalizeOptionalText(input.vat, 64),
  };
}

export function formatPartyLines(party: {
  name?: string | null;
  email?: string | null;
  address?: string | null;
  state?: string | null;
  postal?: string | null;
  country?: string | null;
  vat?: string | null;
}): string[] {
  const lines: string[] = [];
  if (party.name?.trim()) lines.push(party.name.trim());
  if (party.email?.trim()) lines.push(party.email.trim());
  if (party.address?.trim()) lines.push(party.address.trim());
  const cityLine = [party.postal, party.state].filter((p) => p?.trim()).join(" ");
  if (cityLine) lines.push(cityLine);
  if (party.country?.trim()) lines.push(party.country.trim());
  if (party.vat?.trim()) lines.push(`VAT: ${party.vat.trim()}`);
  return lines;
}
