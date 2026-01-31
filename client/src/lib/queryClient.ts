import { QueryClient, QueryFunction } from "@tanstack/react-query";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  const res = await fetch(url, {
    method,
    headers: data ? { "Content-Type": "application/json" } : {},
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
  });

  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    // Build URL from queryKey segments
    // Handle: ["/api/endpoint"], ["/api/endpoint", id], ["/api/endpoint", id, "sub"], 
    // or ["/api/endpoint", id, "sub", { q: "search" }] for query params
    let url = "";
    let queryParams: Record<string, string> = {};
    
    for (const segment of queryKey) {
      if (typeof segment === "object" && segment !== null) {
        // Object segments are query parameters
        queryParams = { ...queryParams, ...(segment as Record<string, string>) };
      } else {
        // String or number segments are path parts
        url += (url && !String(segment).startsWith("/") ? "/" : "") + String(segment);
      }
    }
    
    // Append query parameters if any
    if (Object.keys(queryParams).length > 0) {
      const params = new URLSearchParams();
      for (const [key, value] of Object.entries(queryParams)) {
        if (value !== undefined && value !== null && value !== "") {
          params.append(key, String(value));
        }
      }
      const paramString = params.toString();
      if (paramString) {
        url += (url.includes("?") ? "&" : "?") + paramString;
      }
    }
    
    const res = await fetch(url, {
      credentials: "include",
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
