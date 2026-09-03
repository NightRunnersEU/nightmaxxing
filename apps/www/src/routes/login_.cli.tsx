import { useEffect } from "react";

import { useMutation, useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { CheckCircle, TerminalWindow } from "@phosphor-icons/react/ssr";
import { z } from "zod";

import { LOGIN_OAUTH_PROVIDERS, OAuthProviderButtons } from "../components/oauth-providers";
import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";
import { Code } from "../components/ui/code";
import { errorMessage, runApi } from "../lib/api";
import { meQueryOptions } from "../lib/queries";

const cliLoginSearchSchema = z.object({
  code: z.string().catch(""),
});

const Route = createFileRoute("/login_/cli")({
  validateSearch: cliLoginSearchSchema,
  component: CliLoginPage,
});

function CliLoginPage() {
  const { code } = Route.useSearch();
  const me = useQuery(meQueryOptions);
  const approve = useMutation({
    mutationFn: () => runApi((client) => client.me.approveCliLogin({ payload: { code } })),
  });
  const shouldAutoApprove =
    code !== "" && me.isSuccess && approve.isIdle && approve.submittedAt === 0;

  useEffect(() => {
    if (shouldAutoApprove) {
      approve.mutate();
    }
  }, [approve, shouldAutoApprove]);

  return (
    <div className="flex min-h-[calc(100vh-12rem)] items-center px-4 py-8">
      <Card className="mx-auto flex w-full max-w-sm flex-col items-center p-8 text-center">
        <TerminalWindow className="size-8 text-muted-foreground" />
        <h1 className="mt-4 text-xl font-semibold tracking-tight">Connect your CLI</h1>

        {code === "" ? (
          <p className="mt-2 text-sm text-muted-foreground">
            Missing login code. Run <Code>nightmaxxing login</Code> and follow the link it prints.
          </p>
        ) : me.isPending ? (
          <p className="mt-2 text-sm text-muted-foreground">Checking your session…</p>
        ) : me.isError ? (
          <>
            <p className="mt-2 text-sm text-muted-foreground">
              Log in to approve code <Code>{code}</Code>.
            </p>
            <OAuthProviderButtons
              className="mt-6"
              providers={LOGIN_OAUTH_PROVIDERS}
              redirect={cliLoginRedirectPath(code)}
            />
          </>
        ) : approve.isSuccess ? (
          <>
            <p className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
              <CheckCircle className="size-4 text-accent" />
              Approved <span className="font-medium">{approve.data.deviceName}</span>.
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              Head back to your terminal — the CLI is logging in now.
            </p>
          </>
        ) : (
          <>
            <p className="mt-2 text-sm text-muted-foreground">
              Approve the device showing code <Code>{code}</Code> as{" "}
              <span className="font-medium">{me.data.user.login}</span>? It will be able to push
              usage data to your profile until you revoke it.
            </p>
            {approve.isError ? (
              <p className="mt-3 text-sm text-red-500">
                {errorMessage(approve.error, "Approval failed; run `nightmaxxing login` again.")}
              </p>
            ) : null}
            <Button
              className="mt-6"
              disabled={approve.isPending || shouldAutoApprove}
              fullWidth
              onClick={() => approve.mutate()}
              size="md"
              variant="primary"
            >
              {approve.isPending ? "Approving…" : "Approve device"}
            </Button>
          </>
        )}
      </Card>
    </div>
  );
}

function cliLoginRedirectPath(code: string): string {
  return `/login/cli?${new URLSearchParams({ code }).toString()}`;
}

export { Route };
