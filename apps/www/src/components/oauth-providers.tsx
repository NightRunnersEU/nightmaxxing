import { buttonClassName } from "./ui/button";
import { cn } from "../lib/cn";
import { resolveApiUrl } from "../lib/config";

type OAuthProviderId = "github";

const OAUTH_PROVIDERS = [{ id: "github", name: "GitHub" }] as const satisfies {
  id: OAuthProviderId;
  name: string;
}[];

const LOGIN_OAUTH_PROVIDERS = ["github"] as const satisfies readonly OAuthProviderId[];

interface OAuthProviderLink {
  href: string;
  id: OAuthProviderId;
  label: string;
}

interface OAuthProviderOptions {
  providers?: readonly OAuthProviderId[] | undefined;
  redirect?: string | undefined;
}

interface OAuthProviderButtonsProps extends OAuthProviderOptions {
  className?: string | undefined;
}

function GitHubMark({ className }: { className?: string }) {
  return (
    <svg aria-hidden className={className} fill="currentColor" viewBox="0 0 16 16">
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27s1.36.09 2 .27c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8Z" />
    </svg>
  );
}

function OAuthProviderButtons({ className, providers, redirect }: OAuthProviderButtonsProps) {
  return (
    <div className={cn("flex w-full flex-col gap-3", className)}>
      {oauthProviderLinks({ providers, redirect }).map((provider) => (
        <a
          className={buttonClassName({ variant: "primary", size: "md", fullWidth: true })}
          href={provider.href}
          key={provider.id}
        >
          {providerIcon(provider.id)}
          {provider.label}
        </a>
      ))}
    </div>
  );
}

function oauthProviderLinks({
  providers,
  redirect,
}: OAuthProviderOptions = {}): OAuthProviderLink[] {
  const enabledProviders =
    providers === undefined ? undefined : new Set<OAuthProviderId>(providers);

  return OAUTH_PROVIDERS.filter(
    (provider) => enabledProviders === undefined || enabledProviders.has(provider.id),
  ).map((provider) => {
    const url = new URL(`${resolveApiUrl()}/auth/${provider.id}/start`);
    if (redirect !== undefined) {
      url.searchParams.set("redirect", redirect);
    }

    return {
      href: url.toString(),
      id: provider.id,
      label: `Continue with ${provider.name}`,
    };
  });
}

function providerIcon(provider: OAuthProviderId) {
  return provider === "github" ? <GitHubMark className="size-4" /> : provider;
}

function oauthProviderLabel(provider: OAuthProviderId): string {
  return OAUTH_PROVIDERS.find((entry) => entry.id === provider)?.name ?? provider;
}

export { LOGIN_OAUTH_PROVIDERS, OAuthProviderButtons, oauthProviderLabel, oauthProviderLinks };

export type { OAuthProviderId };
