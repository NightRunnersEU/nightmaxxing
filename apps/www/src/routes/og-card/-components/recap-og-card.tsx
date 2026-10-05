import { cn } from "../../../lib/cn";
import { formatInteger, formatMonthLong, formatTokens, formatUsd } from "../../../lib/format";
import { recapFigures, type RecapData } from "../../../lib/recap";
import { OgCardFrame } from "./og-cards";

/**
 * The monthly recap's 1200×630 Open Graph card. Same frame and grid as the
 * profile card, so its hairlines land on the frame's fixed rules.
 */
function RecapOgCard({ data }: { data: RecapData }) {
  const figures = recapFigures(data.insights);
  const metrics = [
    { label: "Spend", value: formatUsd(figures.spendUsd) },
    { label: "Tokens", value: formatTokens(figures.totalTokens) },
    { label: "Active days", value: formatInteger(figures.activeDays) },
    {
      label: "Rank by spend",
      value: figures.spendRank === null ? "—" : `#${formatInteger(figures.spendRank)}`,
    },
    // Names run longer than figures; one step smaller keeps them whole.
    { label: "Top model", name: true, value: figures.topModel ?? "—" },
    { label: "Top agent", name: true, value: figures.topAgent ?? "—" },
  ];

  return (
    <OgCardFrame>
      <header className="flex h-35 shrink-0 items-center gap-5 px-6">
        {data.identity.avatarUrl === null ? (
          <div className="h-18 w-18 shrink-0 border border-border bg-muted" />
        ) : (
          <img
            alt=""
            className="h-18 w-18 shrink-0 border border-border object-cover"
            src={data.identity.avatarUrl}
          />
        )}
        <div className="min-w-0">
          <h1 className="truncate text-5xl font-semibold tracking-normal">{data.identity.login}</h1>
          <p className="mt-2 font-mono text-2xl uppercase text-muted-foreground">
            {formatMonthLong(data.month)} recap
          </p>
        </div>
      </header>
      <section className="grid h-92.75 shrink-0 grid-cols-3 grid-rows-[185px_185px] gap-px bg-border">
        {metrics.map((metric) => (
          <div className="flex flex-col justify-center bg-background px-9" key={metric.label}>
            <p className="font-mono text-2xl uppercase text-muted-foreground">{metric.label}</p>
            <p
              className={cn(
                "mt-5 truncate font-semibold tracking-normal",
                "name" in metric ? "text-4xl" : "text-5xl",
              )}
            >
              {metric.value}
            </p>
          </div>
        ))}
      </section>
    </OgCardFrame>
  );
}

export { RecapOgCard };
