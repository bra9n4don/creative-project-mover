import { forwardRef, type AnchorHTMLAttributes } from "react";
import { Link as RouterLink, useNavigate, useRouterState, useParams as useRouterParams } from "@tanstack/react-router";

type LinkProps = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href"> & { href: string };

/** href-style link used by the original screens, routed through TanStack Router. */
export const Link = forwardRef<HTMLAnchorElement, LinkProps>(function Link({ href, ...rest }, ref) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return <RouterLink ref={ref} to={href as any} {...(rest as any)} />;
});

export function useLocation(): [string, (to: string) => void] {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return [pathname, (to: string) => void navigate({ to: to as any })];
}

export function useParams<T extends Record<string, string>>(): T {
  return (useRouterParams as unknown as (o: { strict: false }) => T)({ strict: false });
}
