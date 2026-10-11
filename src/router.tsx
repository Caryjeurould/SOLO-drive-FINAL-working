import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";
import { isVisitor } from "./lib/site-role";

export const getRouter = () => {
  // Visitor demo: the database is switched off, so don't retry what can't succeed.
  const queryClient = new QueryClient(isVisitor() ? { defaultOptions: { queries: { retry: false } } } : undefined);

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
  });

  return router;
};
