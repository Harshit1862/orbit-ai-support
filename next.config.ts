import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Hide the floating Next.js "N" badge in dev; compile/runtime errors still show.
  devIndicators: false,
  // The old full-page help centre was replaced by the assistant in the corner of every page.
  async redirects() {
    return [{ source: "/help", destination: "/", permanent: true }];
  },
  // The chat route embeds questions with onnxruntime-node, which loads its
  // native binary dynamically, so the file tracer misses it. Include only the
  // Linux x64 CPU build that Vercel runs: the package also ships macOS and
  // Windows builds and a 270 MB GPU (CUDA) provider, which would push the
  // function past Vercel's 250 MB limit.
  outputFileTracingIncludes: {
    "/api/chat": [
      "node_modules/onnxruntime-node/package.json",
      "node_modules/onnxruntime-node/dist/**/*",
      "node_modules/onnxruntime-common/**/*",
      "node_modules/onnxruntime-node/bin/napi-v*/linux/x64/{libonnxruntime.so.1,libonnxruntime_providers_shared.so,onnxruntime_binding.node}",
    ],
  },
  outputFileTracingExcludes: {
    "/api/chat": ["node_modules/onnxruntime-web/**"],
  },
};

export default nextConfig;
