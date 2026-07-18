import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

const BookingInput = z.object({
  meeting_type_id: z.string().uuid(),
  invitee_name: z.string().trim().min(1, "Name is required").max(120),
  invitee_email: z.string().trim().email("Valid email is required"),
  invitee_phone: z.string().trim().max(40).optional().or(z.literal("")),
  notes: z.string().trim().max(2000).optional().or(z.literal("")),
  starts_at: z.string().datetime(),
  ends_at: z.string().datetime(),
});

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = BookingInput.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Validation failed",
        issues: parsed.error.flatten().fieldErrors,
      },
      { status: 400 }
    );
  }

  const { meeting_type_id, invitee_name, invitee_email, invitee_phone, notes, starts_at, ends_at } =
    parsed.data;

  if (new Date(starts_at) <= new Date()) {
    return NextResponse.json(
      { error: "Booking time must be in the future" },
      { status: 400 }
    );
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  // Look up the meeting type (anon can read active ones)
  const { data: meetingType, error: mtError } = await supabase
    .from("meeting_types")
    .select("id, org_id, active")
    .eq("id", meeting_type_id)
    .single();

  if (mtError || !meetingType) {
    return NextResponse.json({ error: "Meeting type not found" }, { status: 404 });
  }

  if (!meetingType.active) {
    return NextResponse.json(
      { error: "This meeting type is no longer accepting bookings" },
      { status: 400 }
    );
  }

  // Use SECURITY DEFINER RPC to bypass RLS for anonymous booking creation
  const { data: bookingId, error: rpcError } = await supabase.rpc("create_public_booking", {
    p_org_id: meetingType.org_id,
    p_meeting_type_id: meeting_type_id,
    p_invitee_name: invitee_name,
    p_invitee_email: invitee_email,
    p_invitee_phone: invitee_phone || null,
    p_notes: notes || null,
    p_starts_at: starts_at,
    p_ends_at: ends_at,
  });

  if (rpcError) {
    console.error("Booking RPC error:", rpcError.message, rpcError.code);
    return NextResponse.json(
      { error: rpcError.message || "Failed to create booking." },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true, booking_id: bookingId }, { status: 201 });
}
