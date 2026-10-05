import { createFileRoute, notFound } from "@tanstack/react-router";

import { loadRecapData } from "../../../lib/recap-data";
import { RecapOgCard } from "../-components/recap-og-card";

/** The HTML the recap PNG (`/og/recap/:login/:month.png`) is captured from. */
const Route = createFileRoute("/og-card/recap/$login/$month")({
  loader: async ({ params }) => {
    const data = await loadRecapData(params.login, params.month);
    if (data === null) {
      throw notFound();
    }

    return { data };
  },
  head: () => ({
    meta: [{ content: "noindex", name: "robots" }],
  }),
  component: RecapOgCardPage,
});

function RecapOgCardPage() {
  const { data } = Route.useLoaderData();

  return <RecapOgCard data={data} />;
}

export { Route };
