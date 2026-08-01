import type { Metadata } from "next";
import { LegalContent } from "./LegalContent";

export const metadata: Metadata = {
  title: "Legal — PokéRetoDex",
};

export default function LegalPage() {
  return <LegalContent />;
}
