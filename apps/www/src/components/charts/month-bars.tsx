import { useMemo, useState } from "react";

import { ChartGrid } from "./axis";
import {
  barLayout,
  CHART_AXIS,
  CHART_WIDTH,
  formatMonth,
  formatMonthLong,
  linearScale,
  niceMax,
} from "./scale";
import { anchorLeft, ChartTooltip } from "./tooltip";

/** A stacked per-model total for each calendar month. */

interface MonthPoint {
  /** YYYY-MM */
  month: string;
  segments: { color: string; series: string; value: number }[];
  value: number;
}

const HEIGHT = 220;

function MonthBars({
  months,
  valueFormatter,
  valueLabel,
}: {
  months: MonthPoint[];
  valueFormatter: (value: number) => string;
  valueLabel: string;
}) {
  const [hovered, setHovered] = useState<number | null>(null);

  const max = useMemo(() => niceMax(Math.max(...months.map((point) => point.value), 0)), [months]);
  const y = linearScale(max, HEIGHT - 26);
  const { barWidth, slot } = barLayout(months.length, 0.55, 44);

  const active = hovered === null ? null : months[hovered];
  const activeTooltip =
    hovered === null
      ? null
      : (() => {
          const x = CHART_AXIS + slot * hovered + (slot - barWidth) / 2;
          return {
            left: anchorLeft((x + barWidth / 2) / CHART_WIDTH, 11),
            top: HEIGHT - y(months[hovered]?.value ?? 0) - 12,
          };
        })();

  return (
    <div className="relative">
      <svg
        aria-label={`Monthly ${valueLabel.toLowerCase()} across ${months.length} months`}
        className="block w-full select-none"
        onPointerLeave={() => setHovered(null)}
        role="img"
        viewBox={`0 0 ${CHART_WIDTH} ${HEIGHT + 24}`}
      >
        <ChartGrid baseline={HEIGHT} format={valueFormatter} max={max} y={y} />
        {months.map((point, index) => {
          const hasValue = point.value > 0;
          const totalHeight = y(point.value);
          const x = CHART_AXIS + slot * index + (slot - barWidth) / 2;
          let cursor = HEIGHT;
          return (
            <g key={point.month} onPointerEnter={() => setHovered(index)}>
              {/* Invisible hover target spanning the full column height. */}
              <rect
                fill="transparent"
                height={HEIGHT}
                width={slot}
                x={CHART_AXIS + slot * index}
                y={0}
              />
              {hasValue ? (
                <>
                  {point.segments.map((segment) => {
                    const height = y(segment.value);
                    cursor -= height;
                    return (
                      <rect
                        fill={segment.color}
                        height={Math.max(height, 0)}
                        key={segment.series}
                        opacity={hovered === null || hovered === index ? 1 : 0.45}
                        width={barWidth}
                        x={x}
                        y={cursor}
                      />
                    );
                  })}
                  <text
                    className="fill-current text-muted-foreground"
                    fontSize={10}
                    fontWeight={500}
                    textAnchor="middle"
                    x={x + barWidth / 2}
                    y={HEIGHT - totalHeight - 6}
                  >
                    {valueFormatter(point.value)}
                  </text>
                </>
              ) : null}
              <text
                className="fill-current opacity-45"
                fontSize={10}
                textAnchor="middle"
                x={x + barWidth / 2}
                y={HEIGHT + 16}
              >
                {formatMonth(point.month)}
              </text>
            </g>
          );
        })}
      </svg>
      {active !== null && active !== undefined && activeTooltip !== null ? (
        <ChartTooltip
          className="w-56 -translate-y-full"
          rows={active.segments
            .filter((segment) => segment.value > 0)
            .sort((a, b) => b.value - a.value)
            .map((segment) => ({
              color: segment.color,
              label: segment.series,
              value: valueFormatter(segment.value),
            }))}
          style={{ left: activeTooltip.left, top: `${activeTooltip.top}px` }}
          subtitle={`${valueFormatter(active.value)} total`}
          title={formatMonthLong(active.month)}
        />
      ) : null}
    </div>
  );
}

export { MonthBars };
