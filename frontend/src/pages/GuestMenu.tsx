import { Link } from "react-router-dom";
import { Brand } from "../components/Brand";
import ParentMenu from "./parent/Menu";
import { schoolName } from "../lib/site";
export default function GuestMenu() {
  return <div className="min-h-screen bg-cream px-4 py-8"><div className="mx-auto max-w-4xl">
    <header className="mb-8 flex flex-wrap items-center justify-between gap-4"><Brand /><Link to="/" className="text-sm font-bold text-leaf-700 hover:underline">Back to home</Link></header>
    <p className="mb-4 text-sm font-bold text-leaf-700">{schoolName}</p>
    <ParentMenu guest />
  </div></div>;
}
