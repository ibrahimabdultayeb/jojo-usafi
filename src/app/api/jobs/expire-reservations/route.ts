import { NextResponse, type NextRequest } from "next/server";
import { bearerAuthorised } from "@/lib/jobs/authorise";
import { getServiceRoleSupabase } from "@/lib/supabase/admin";

/**
 * Letting go of stock that an unconfirmed order has been holding too long.
 *
 * NOTHING SCHEDULES THIS, DELIBERATELY. There is no cron entry, no Vercel
 * schedule, no Supabase job and no paid scheduler anywhere in this repository.
 * The hook exists so that the day a schedule is decided, the thing it calls is
 * already written, already authorised, already audited and already proven
 * idempotent — rather than being invented under time pressure on the day the
 * shop opens.
 *
 * IT ALSO DOES NOTHING TODAY EVEN IF CALLED. `jojo_expire_reservations` reads
 * `shop_settings.reservation_expiry_minutes`, which is null because nobody has
 * decided how long "too long" is. A null there means the function returns
 * `configured: false` and touches no order. That is the correct behaviour for
 * an undecided business rule, not a half-finished feature.
 *
 * Safe to call twice: `jojo_cancel_order` releases a reservation exactly once,
 * so a retry after a timeout cannot release the same stock again.
 */

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** How many orders one call may work through. Keeps a single request bounded. */
const DEFAULT_LIMIT = 100;
const MAX_LIMIT = 500;

export async function POST(request: NextRequest) {
  if (!bearerAuthorised(request, process.env.RESERVATION_EXPIRY_JOB_SECRET)) {
    return NextResponse.json({ error: "Not authorised." }, { status: 401 });
  }

  const asked = Number(new URL(request.url).searchParams.get("limit"));
  const limit =
    Number.isFinite(asked) && asked > 0 ? Math.min(Math.floor(asked), MAX_LIMIT) : DEFAULT_LIMIT;

  const { data, error } = await getServiceRoleSupabase().rpc("jojo_expire_reservations", {
    p_limit: limit,
  });

  if (error) {
    // A failed job is a failed job. It is never allowed to become a 500 that a
    // monitoring system reads as "the shop is down".
    return NextResponse.json(
      { ok: false, headline: "The expiry run could not finish. Nothing was changed." },
      { status: 200 },
    );
  }

  const result = data as {
    configured: boolean;
    minutes?: number;
    expired: number;
    released: number;
    note?: string;
  };

  return NextResponse.json({
    ok: true,
    configured: result.configured,
    minutes: result.minutes ?? null,
    expired: result.expired,
    released: result.released,
    headline: result.configured
      ? `${result.expired} order(s) expired, ${result.released} item(s) released.`
      : "No expiry time has been set, so nothing expires.",
  });
}

/** A health answer that reveals nothing: is this route reachable at all. */
export function GET() {
  return NextResponse.json({ ok: true, method: "POST", authenticated: true, scheduled: false });
}
