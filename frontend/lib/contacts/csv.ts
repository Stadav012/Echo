import Papa from "papaparse";

export type CanonicalContact = {
  name: string;
  phone: string;
  email: string | null;
  age: string | null;
  occupation: string | null;
  metadata: Record<string, string> | null;
};

export type SkippedRow = {
  row: number;
  reason: string;
  raw: Record<string, string>;
};

export type ParseResult = {
  rows: CanonicalContact[];
  skipped: SkippedRow[];
  totalParsed: number;
};

const HEADER_ALIASES: Record<keyof Omit<CanonicalContact, "metadata">, string[]> = {
  name: ["name", "full_name", "fullname", "full name", "participant_name", "contact_name"],
  phone: [
    "phone",
    "phone_number",
    "phonenumber",
    "phone number",
    "mobile",
    "mobile_number",
    "telephone",
    "cell",
    "contact",
    "contact_number",
  ],
  email: ["email", "e-mail", "email_address", "email address"],
  age: ["age", "age_years", "years"],
  occupation: [
    "occupation",
    "role",
    "job",
    "job_title",
    "title",
    "position",
    "profession",
  ],
};

function normalizeHeader(h: string): string {
  return h.trim().toLowerCase().replace(/\s+/g, " ");
}

function buildHeaderMap(headers: string[]): {
  fieldByHeader: Map<string, keyof Omit<CanonicalContact, "metadata">>;
  extraHeaders: string[];
} {
  const fieldByHeader = new Map<string, keyof Omit<CanonicalContact, "metadata">>();
  const extraHeaders: string[] = [];

  for (const original of headers) {
    const norm = normalizeHeader(original);
    let matched: keyof Omit<CanonicalContact, "metadata"> | null = null;
    for (const field of Object.keys(HEADER_ALIASES) as Array<
      keyof typeof HEADER_ALIASES
    >) {
      if (HEADER_ALIASES[field].includes(norm)) {
        matched = field;
        break;
      }
    }
    if (matched) {
      fieldByHeader.set(original, matched);
    } else if (norm.length > 0) {
      extraHeaders.push(original);
    }
  }

  return { fieldByHeader, extraHeaders };
}

function normalizePhone(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "";
  const hasPlus = trimmed.startsWith("+");
  const digits = trimmed.replace(/\D/g, "");
  return hasPlus ? `+${digits}` : digits;
}

function blankToNull(value: string | undefined): string | null {
  if (value === undefined) return null;
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}

export function parseContactsCsv(file: File): Promise<ParseResult> {
  return new Promise((resolve, reject) => {
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: "greedy",
      transformHeader: (h) => h,
      complete: (results) => {
        const headers = (results.meta?.fields ?? []) as string[];
        const { fieldByHeader, extraHeaders } = buildHeaderMap(headers);

        const rows: CanonicalContact[] = [];
        const skipped: SkippedRow[] = [];

        results.data.forEach((raw, idx) => {
          const canonical: Partial<CanonicalContact> = {
            name: "",
            phone: "",
            email: null,
            age: null,
            occupation: null,
          };
          const metadata: Record<string, string> = {};

          for (const [header, rawValue] of Object.entries(raw)) {
            const value = (rawValue ?? "").toString();
            const field = fieldByHeader.get(header);
            if (field) {
              if (field === "phone") {
                canonical.phone = normalizePhone(value);
              } else if (field === "name") {
                canonical.name = value.trim();
              } else {
                canonical[field] = blankToNull(value);
              }
            } else if (extraHeaders.includes(header)) {
              const trimmed = value.trim();
              if (trimmed.length > 0) {
                metadata[normalizeHeader(header)] = trimmed;
              }
            }
          }

          if (!canonical.name || canonical.name.length === 0) {
            skipped.push({ row: idx + 2, reason: "missing name", raw });
            return;
          }
          if (!canonical.phone || canonical.phone.length === 0) {
            skipped.push({ row: idx + 2, reason: "missing phone", raw });
            return;
          }

          rows.push({
            name: canonical.name,
            phone: canonical.phone,
            email: canonical.email ?? null,
            age: canonical.age ?? null,
            occupation: canonical.occupation ?? null,
            metadata: Object.keys(metadata).length > 0 ? metadata : null,
          });
        });

        resolve({
          rows,
          skipped,
          totalParsed: results.data.length,
        });
      },
      error: (err: Error) => {
        reject(err);
      },
    });
  });
}
