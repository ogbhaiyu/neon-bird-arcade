"use client";

import { ConvexProvider, ConvexReactClient } from "convex/react";
import { ReactNode } from "react";

// Initialize the Convex client using the public environment variable
const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL || "https://dummy-url-please-run-convex-dev.convex.cloud";
const convex = new ConvexReactClient(convexUrl);

export function ConvexClientProvider({ children }: { children: ReactNode }) {
  return <ConvexProvider client={convex}>{children}</ConvexProvider>;
}
export default ConvexClientProvider;
