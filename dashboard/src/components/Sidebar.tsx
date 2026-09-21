import { NavLink } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { Logo } from "./Logo";

const NAV_ITEMS = [
  { to: "/", label: "Dashboard", icon: "◧" },
  { to: "/cameras", label: "Live Cameras", icon: "◉" },
  { to: "/incidents", label: "Incidents", icon: "⚠" },
  { to: "/map", label: "Map", icon: "◎" },
  { to: "/responses", label: "Response Teams", icon: "▣" },
  { to: "/analytics", label: "Analytics", icon: "▤" },
  { to: "/reports", label: "Reports", icon: "▥" },
  { to: "/settings", label: "Settings", icon: "⚙" },
];

export function Sidebar() {
  const { user, logout } = useAuth();

  return (
    <aside className="w-64 shrink-0 bg-navy-950 text-white flex flex-col h-screen sticky top-0">
      <div className="px-5 py-6 border-b border-white/10">
        <div className="flex items-center gap-2">
          <Logo className="h-10 w-10 shrink-0" />
          <div>
            <div className="font-bold text-white leading-tight">SafeCity AI</div>
            <div className="text-[11px] text-blue-300 leading-tight">Turning Cameras into Care</div>
          </div>
        </div>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1">
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === "/"}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                isActive ? "bg-blue-600 text-white" : "text-slate-300 hover:bg-white/5 hover:text-white"
              }`
            }
          >
            <span className="text-base">{item.icon}</span>
            {item.label}
          </NavLink>
        ))}
      </nav>

      <div className="px-4 py-4 border-t border-white/10">
        <div className="text-xs text-slate-400 mb-2">
          Signed in as <span className="text-white font-medium">{user?.name}</span>
          <div className="uppercase tracking-wide text-[10px] text-blue-300">{user?.role}</div>
        </div>
        <button
          onClick={logout}
          className="w-full text-left text-xs font-medium text-slate-300 hover:text-white bg-white/5 hover:bg-white/10 rounded-lg px-3 py-2"
        >
          Sign out
        </button>
      </div>
    </aside>
  );
}
