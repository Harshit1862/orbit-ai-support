import type { Metadata } from "next";
import HelpCenter from "@/components/support/HelpCenter";

export const metadata: Metadata = {
  title: "Help centre · Orbit",
};

export default function HelpPage() {
  return <HelpCenter />;
}
