import { Link } from "react-router-dom";
import { Brand } from "../components/Brand";
import { Button } from "../components/ui";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-cream px-4 text-center">
      <Brand size="lg" />
      <p className="mt-8 text-6xl font-extrabold text-leaf-600">404</p>
      <h1 className="mt-2 text-2xl font-extrabold text-ink">Page not found</h1>
      <p className="mt-1 max-w-sm text-ink-soft">
        The page you're looking for doesn't exist or has moved.
      </p>
      <Link to="/" className="mt-6">
        <Button size="lg">Back to sign in</Button>
      </Link>
    </div>
  );
}
