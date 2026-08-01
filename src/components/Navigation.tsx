"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/context/LanguageContext";

function GridIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" />
      <rect x="3" y="14" width="7" height="7" /><rect x="14" y="14" width="7" height="7" />
    </svg>
  );
}

function BarChartIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" />
      <line x1="6" y1="20" x2="6" y2="14" />
    </svg>
  );
}

function SettingsIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}

export function Navigation() {
  const pathname = usePathname();
  const { t } = useLanguage();

  const navItems = [
    { href: "/pokedex", label: t("navigation.pokedex"), Icon: GridIcon },
    { href: "/dashboard", label: t("navigation.dashboard"), Icon: BarChartIcon },
    { href: "/configuracion", label: t("navigation.config"), Icon: SettingsIcon },
  ];

  return (
    <>
      {/* Desktop sidebar — fixed left */}
      <aside className="hidden lg:flex fixed inset-y-0 left-0 w-56 flex-col bg-gray-900 border-r border-gray-800 z-40">
        <div className="px-6 py-5 border-b border-gray-800 flex-shrink-0">
          <span className="text-xl font-bold select-none">
            <span className="text-red-500">Poké</span>
            <span className="text-white">RetoDex</span>
          </span>
        </div>
        <nav className="flex flex-col gap-1 p-3 flex-1" aria-label="Navegación principal">
          {navItems.map(({ href, label, Icon }) => {
            const isActive = pathname === href || pathname.startsWith(`${href}/`);
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                  isActive
                    ? "bg-red-500/15 text-red-400"
                    : "text-gray-400 hover:text-white hover:bg-gray-800"
                )}
              >
                <Icon />
                {label}
              </Link>
            );
          })}
        </nav>

        {/* Legal link — desktop sidebar only, discreto */}
        <div className="px-6 py-4 border-t border-gray-800 flex-shrink-0">
          <Link
            href="/legal"
            className="text-xs text-gray-600 hover:text-gray-400 transition-colors"
          >
            {t("common.legalLink")}
          </Link>
        </div>
      </aside>

      {/* Mobile bottom nav — fixed bottom */}
      <nav
        className="lg:hidden fixed bottom-0 inset-x-0 bg-gray-900 border-t border-gray-800 z-40 flex"
        aria-label="Navegación principal"
      >
        {navItems.map(({ href, label, Icon }) => {
          const isActive = pathname === href || pathname.startsWith(`${href}/`);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex-1 flex flex-col items-center justify-center gap-1 py-2.5 text-xs font-medium transition-colors",
                isActive ? "text-red-400" : "text-gray-500 hover:text-gray-300"
              )}
            >
              <Icon />
              {label}
            </Link>
          );
        })}
      </nav>
    </>
  );
}
