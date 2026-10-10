import { Link } from "react-router-dom";
import { UtensilsCrossed, Users, ShieldCheck, ArrowRight } from "lucide-react";
import { Brand } from "../components/Brand";
import { isSampleSite, schoolName, showParentLogin } from "../lib/site";

export default function Landing() {
  const choices = [
    { title: "View Menu as Guest", description: "Explore the lunch menu without signing in.", href: "/guest-menu", icon: UtensilsCrossed },
    ...(showParentLogin ? [{ title: "Parent Login", description: isSampleSite ? "Try the parent experience with a sample family." : "View your children and manage their lunches.", href: "/login", icon: Users }] : []),
    { title: "Admin Login", description: isSampleSite ? "Explore menus, orders and school tools in the demo." : "Access your school’s lunch dashboard.", href: "/admin/login", icon: ShieldCheck },
  ];
  return <div className="min-h-screen bg-cream px-4 py-10 sm:py-16">
    <div className="mx-auto max-w-5xl">
      <Link to="/" className="mb-12 flex justify-center"><Brand size="lg" /></Link>
      <div className="mb-10 text-center">
        <p className="mb-3 text-sm font-bold text-leaf-700">{schoolName}</p>
        <h1 className="text-3xl font-extrabold tracking-tight text-ink sm:text-4xl">Welcome to Cliffs Lunch Club</h1>
        <p className="mx-auto mt-4 max-w-xl text-base leading-relaxed text-ink-soft">{isSampleSite ? "Take a look around our school lunch demo. Explore the menu or try the parent and administrator experience." : "View the lunch menu or sign in to your school dashboard."}</p>
        {isSampleSite && <p className="mt-4 text-sm font-semibold text-leaf-700">Sample data only. You can explore the tools, but changes cannot be saved.</p>}
      </div>
      <div className={`grid gap-5 ${choices.length === 3 ? "md:grid-cols-3" : "md:grid-cols-2"}`}>
        {choices.map(({title, description, href, icon: Icon}) => <Link key={href} to={href} className="flex flex-col rounded-2xl border border-line bg-white p-7 shadow-sm transition hover:border-leaf-600 hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-leaf-600">
          <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl bg-leaf-50 text-leaf-700"><Icon className="h-6 w-6" /></div>
          <h2 className="text-xl font-extrabold text-ink">{title}</h2>
          <p className="mt-3 mb-6 text-sm leading-relaxed text-ink-soft">{description}</p>
          <span className="mt-auto flex items-center gap-2 text-sm font-bold text-leaf-700">Continue <ArrowRight className="h-4 w-4" /></span>
        </Link>)}
      </div>
    </div>
  </div>;
}
