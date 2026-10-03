// Allocation requests. This validates and acknowledges with a reference; it deliberately
// stores nothing (there is no backend for this fictional launch). Wire a CRM or database
// here to persist requests.

interface Body {
  name?: string;
  email?: string;
  country?: string;
  serial?: string;
  machine?: string;
}

export async function POST(request: Request) {
  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return Response.json({ errors: { form: "Malformed request." } }, { status: 400 });
  }
  const errors: Record<string, string> = {};
  if (!body.name || !body.name.trim() || body.name.length > 120) errors.name = "Enter your full name.";
  if (!body.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email) || body.email.length > 200) errors.email = "Enter a valid email address.";
  if (!body.country || body.country.length > 80) errors.country = "Choose a country.";
  if (body.serial) {
    const n = Number(body.serial);
    if (!Number.isInteger(n) || n < 2 || n > 99) errors.serial = "Serials 002 to 099 are available.";
  }
  if (Object.keys(errors).length) return Response.json({ errors }, { status: 422 });

  const stamp = Date.now().toString(36).toUpperCase().slice(-5);
  const serial = body.serial ? String(Number(body.serial)).padStart(3, "0") : "ANY";
  return Response.json({ ok: true, ref: `VR1-${serial}-${stamp}` });
}
