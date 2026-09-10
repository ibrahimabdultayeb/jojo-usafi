/**
 * Which deployment this is.
 *
 * Read from `APP_ENV`, and **anything that is not the literal string
 * "production" is treated as staging**. That default is the point of the file:
 * a deployment nobody has labelled is a deployment nobody has decided about,
 * and the safe answer for an undecided deployment is "do not let Google index
 * this shop".
 *
 * The cost of the default being wrong is asymmetric, which is why it falls this
 * way. A staging site that gets indexed puts unconfirmed prices, development
 * orders and a half-finished catalogue into search results, and the damage is
 * done before anybody notices. A production site that is accidentally marked
 * staging is invisible — which is worse in the moment but obvious within a day,
 * checkable in one request, and fixed by setting one variable.
 *
 * `APP_ENV=production` therefore appears in the launch checklist as a step, not
 * as an assumption.
 */

export type AppEnvironment = "production" | "staging";

export function appEnvironment(): AppEnvironment {
  return process.env.APP_ENV === "production" ? "production" : "staging";
}

/** True on anything that is not the real shop. Decides indexing, and nothing else. */
export function isStaging(): boolean {
  return appEnvironment() !== "production";
}
