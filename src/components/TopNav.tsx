import { NavLink } from "react-router-dom";

const tabBase = "flex-1 rounded-full px-5 py-1 text-center text-sm font-semibold transition";

export default function TopNav() {
  return (
    <div className="mx-auto mb-10 w-full max-w-xs">
      <div className="pill-nav flex items-center gap-1 rounded-full p-1">
        <NavLink
          to="/"
          end
          className={({ isActive }) =>
            `${tabBase} ${
              isActive
                ? "bg-white text-ember shadow"
                : "text-gray-300 hover:text-white"
            }`
          }
        >
          Home
        </NavLink>
        <NavLink
          to="/history"
          className={({ isActive }) =>
            `${tabBase} ${
              isActive
                ? "bg-white text-ember shadow"
                : "text-gray-300 hover:text-white"
            }`
          }
        >
          History
        </NavLink>
      </div>
    </div>
  );
}
