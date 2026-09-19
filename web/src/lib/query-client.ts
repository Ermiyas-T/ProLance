import { QueryClient } from "@tanstack/react-query";
import { ApiError } from "./api-client";
import { toast } from "@/components/ui/use-toast";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000, // background-refetch, not spinner, within 30s
      retry: (failureCount, error) =>
        error instanceof ApiError && error.status >= 500 && failureCount < 2,
      refetchOnWindowFocus: true,
    },
    mutations: {
      onError: (error) => {
        if (error instanceof ApiError && error.status !== 401) {
          toast({
            variant: "destructive",
            title: "Something went wrong",
            description: error.detail,
          });
        }
      },
    },
  },
});
