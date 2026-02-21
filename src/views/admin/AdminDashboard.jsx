import React from "react";
import { NavLink, Outlet } from "react-router-dom";
import "./AdminDashboard.css";

const navItems = [
  { path: "/admin/metrics", label: "System Metrics" },
  { path: "/admin/flags", label: "Feature Flags" },
  { path: "/admin/deploys", label: "Deploy/Rollback" },
  { path: "/admin/users", label: "User Management" },
  { path: "/admin/logs", label: "Logs" },
  { path: "/admin/analytics", label: "Analytics" },
];

export default function AdminDashboard() {
  return (
    <div className="admin-dashboard">
      <aside className="admin-sidebar">
        <h2 className="admin-title">Admin Console</h2>
        <nav>
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                isActive ? "admin-nav-link active" : "admin-nav-link"
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      </aside>
      <main className="admin-main">
        <Outlet />
      </main>
    </div>
  );
}
