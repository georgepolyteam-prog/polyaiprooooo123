import { Link } from "react-router-dom";

const links = [
  { label: "Chat", to: "/chat" },
  { label: "Markets", to: "/markets" },
  { label: "Terminal", to: "/terminal" },
  { label: "Docs", to: "/docs" },
  { label: "Privacy", to: "/privacy" },
  { label: "Terms", to: "/terms" },
];

export const MinimalFooter = () => {
  return (
    <footer className="px-6 md:px-12 lg:px-20 py-8 border-t border-border/30">
      <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
        {/* Links */}
        <nav className="flex flex-wrap items-center justify-center gap-6">
          {links.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              className="font-mono text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        {/* Copyright */}
        <p className="font-mono text-xs text-muted-foreground">
          © 2025 Poly
        </p>
      </div>
    </footer>
  );
};
