import { PokedexDataProvider } from "@/context/PokedexDataContext";

export default function ProtectedLayout({ children }: { children: React.ReactNode }) {
  return <PokedexDataProvider>{children}</PokedexDataProvider>;
}
