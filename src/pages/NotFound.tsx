import { Link } from "react-router-dom";
import { Home } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PolyLogo } from "@/components/PolyLogo";

const NotFound = () => {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="text-left max-w-md">
        <PolyLogo size="lg" showText={false} className="mb-6" />
        <h1 className="text-6xl font-semibold text-foreground mb-4">404</h1>
        <p className="text-xl text-muted-foreground mb-2">Page not found</p>
        <p className="text-muted-foreground mb-8">
          The page you're looking for doesn't exist.
        </p>
        <Link to="/">
          <Button className="gap-2">
            <Home className="w-4 h-4" />
            Back to Poly
          </Button>
        </Link>
      </div>
    </div>
  );
};

export default NotFound;
