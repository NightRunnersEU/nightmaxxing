import { CaretLeft, CaretRight, LinkSimple } from "@phosphor-icons/react/ssr";
import { useSuspenseQuery, type QueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, notFound, redirect } from "@tanstack/react-router";
import type { ReactNode } from "react";

import { StatCard } from "../../components/stat-card";
import { Avatar } from "../../components/ui/avatar";
import { Button, buttonClassName } from "../../components/ui/button";
import { Card } from "../../components/ui/card";
import { useCopyToClipboard } from "../../hooks/use-copy-to-clipboard";
import { isNotFoundApiError } from "../../lib/api";
import { cn } from "../../lib/cn";
import {
  formatDay,
  formatInteger,
  formatMonthLong,
  formatPercent,
  formatTokens,
  formatUsd,
} from "../../lib/format";
import { OG_IMAGE_HEIGHT, OG_IMAGE_WIDTH } from "../../lib/og";
import { profileInsightsQueryOptions, profileQueryOptions } from "../../lib/queries";
import {
  currentRecapMonth,
  FIRST_RECAP_MONTH,
  isRecapMonth,
  monthBounds,
  recapFigures,
  recapOgImageUrl,
  recapPath,
  recapTitle,
  recapUrl,
  shiftMonth,
} from "../../lib/recap";
import { pageHead } from "../../lib/seo";

/**
 * A profile's monthly recap (Nightmaxxing): one calendar month's figures,
 * with month-to-month navigation and a shareable link whose Open Graph image
 * is the recap card. Not nested under `/$user`, whose page has no outlet.
 */

const Route = createFileRoute("/$user_/recap/$month")({
  loader: ({ context, params }) => loadRecap(context.queryClient, params.user, params.month),
  head: ({ loaderData }) => {
    if (loaderData === undefined) {
      return {};
    }

    const { insights, month, profile } = loaderData;
    const login = profile.user.login;
    const image = recapOgImageUrl({
      identity: { avatarUrl: profile.user.avatarUrl, login },
      insights,
      month,
    });

    return pageHead({
      description: `${login} spent ${formatUsd(insights.totals.spendUsd)} on ${formatTokens(
        insights.totals.totalTokens,
      )} tokens in ${formatMonthLong(month)}.`,
      meta: [
        { content: image, property: "og:image" },
        { content: String(OG_IMAGE_WIDTH), property: "og:image:width" },
        { content: String(OG_IMAGE_HEIGHT), property: "og:image:height" },
        { content: "summary_large_image", name: "twitter:card" },
        { content: image, name: "twitter:image" },
      ],
      path: recapPath(login, month),
      title: recapTitle(login, month),
    });
  },
  component: RecapPage,
});

/** Loads the profile and the month's insights together; see loadProfile for why both settle. */
async function loadRecap(queryClient: QueryClient, login: string, month: string) {
  if (!isRecapMonth(month, new Date())) {
    throw notFound();
  }

  const [profile, insights] = await Promise.allSettled([
    queryClient.ensureQueryData(profileQueryOptions(login)),
    queryClient.ensureQueryData(profileInsightsQueryOptions(login, monthBounds(month))),
  ]);
  for (const result of [profile, insights]) {
    if (result.status === "rejected") {
      if (isNotFoundApiError(result.reason)) {
        throw notFound();
      }

      throw result.reason;
    }
  }
  if (profile.status !== "fulfilled" || insights.status !== "fulfilled") {
    throw notFound();
  }

  const canonicalLogin = profile.value.user.login;
  if (canonicalLogin !== login) {
    throw redirect({
      params: { month, user: canonicalLogin },
      statusCode: 301,
      to: "/$user/recap/$month",
    });
  }

  return { insights: insights.value, month, profile: profile.value };
}

function RecapPage() {
  const { month, user } = Route.useParams();
  const { data: profile } = useSuspenseQuery(profileQueryOptions(user));
  const { data: insights } = useSuspenseQuery(
    profileInsightsQueryOptions(user, monthBounds(month)),
  );
  const owner = profile.user;
  const figures = recapFigures(insights);
  const previous = shiftMonth(month, -1);
  const next = shiftMonth(month, 1);
  const cards = [
    { label: "Spend", value: formatUsd(figures.spendUsd) },
    { label: "Tokens", value: formatTokens(figures.totalTokens) },
    { label: "Active days", value: formatInteger(figures.activeDays) },
    {
      label: "Rank by spend",
      value: figures.spendRank === null ? "—" : `#${formatInteger(figures.spendRank)}`,
    },
    { label: "Top model", value: figures.topModel ?? "—" },
    { label: "Top agent", value: figures.topAgent ?? "—" },
    {
      label: "Peak day",
      value:
        figures.peakDay === null
          ? "—"
          : `${formatUsd(figures.peakDay.spendUsd)} · ${formatDay(figures.peakDay.date)}`,
    },
    { label: "Longest streak", value: formatCount(figures.longestStreakDays) },
    {
      label: "Cache hit rate",
      value: figures.cacheHitRate === null ? "—" : formatPercent(figures.cacheHitRate),
    },
  ];

  return (
    <>
      <header className="flex flex-wrap items-center justify-between gap-4 px-4 py-8">
        <div className="flex min-w-0 items-center gap-4">
          <Avatar alt={`${owner.login} avatar`} priority size={56} src={owner.avatarUrl} />
          <div className="min-w-0">
            <h1 className="truncate text-2xl font-semibold tracking-tight">
              {formatMonthLong(month)} recap
            </h1>
            <Link
              className="text-sm text-muted-foreground hover:text-foreground hover:underline"
              params={{ user: owner.login }}
              to="/$user"
            >
              {owner.login}
            </Link>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <MonthLink
            disabled={previous < FIRST_RECAP_MONTH}
            label="Previous month"
            login={owner.login}
            month={previous}
          >
            <CaretLeft className="size-4" />
          </MonthLink>
          <MonthLink
            disabled={next > currentRecapMonth(new Date())}
            label="Next month"
            login={owner.login}
            month={next}
          >
            <CaretRight className="size-4" />
          </MonthLink>
          <RecapShareButton url={recapUrl(owner.login, month)} />
        </div>
      </header>

      {figures.activeDays === 0 ? (
        <div className="px-4">
          <Card className="p-6 text-sm text-muted-foreground">
            No usage synced for {formatMonthLong(month)}.
          </Card>
        </div>
      ) : (
        <section className="grid grid-cols-2 gap-px border-y border-border bg-border lg:grid-cols-3">
          {cards.map((card) => (
            <StatCard key={card.label} label={card.label} value={card.value} />
          ))}
        </section>
      )}
    </>
  );
}

function formatCount(days: number): string {
  return `${formatInteger(days)} ${days === 1 ? "day" : "days"}`;
}

function MonthLink({
  children,
  disabled,
  label,
  login,
  month,
}: {
  children: ReactNode;
  disabled: boolean;
  label: string;
  login: string;
  month: string;
}) {
  const className = buttonClassName({ size: "sm", variant: "outline" });
  if (disabled) {
    return (
      <span aria-disabled="true" aria-label={label} className={cn(className, "opacity-40")}>
        {children}
      </span>
    );
  }

  return (
    <Link
      aria-label={label}
      className={className}
      params={{ month, user: login }}
      to="/$user/recap/$month"
    >
      {children}
    </Link>
  );
}

function RecapShareButton({ url }: { url: string }) {
  const { copiedKey, copy } = useCopyToClipboard();
  const copied = copiedKey !== null;

  return (
    <Button
      aria-label={copied ? "Recap link copied" : "Share recap"}
      onClick={() => void copy(url, "recap")}
      size="sm"
      variant="outline"
    >
      <LinkSimple className="size-4" />
      {copied ? "Copied" : "Share"}
    </Button>
  );
}

export { Route };
