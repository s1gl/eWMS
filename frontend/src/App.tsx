import { NavLink, Route, Routes, Navigate } from "react-router-dom";
import WarehousesPage from "./pages/WarehousesPage";
import ItemsPage from "./pages/ItemsPage";
import InventoryPage from "./pages/InventoryPage";

const navLinks = [
  { to: "/warehouses", label: "Склады" },
  { to: "/items", label: "Товары" },
  { to: "/inventory", label: "Остатки" },
];

export default function App() {
  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand">eWMS Frontend</div>
        <nav className="nav">
          {navLinks.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              className={({ isActive }) =>
                isActive ? "nav-link active" : "nav-link"
              }
            >
              {link.label}
            </NavLink>
          ))}
        </nav>
      </header>
      <main className="content">
        <Routes>
          <Route path="/" element={<Navigate to="/warehouses" replace />} />
          <Route path="/warehouses" element={<WarehousesPage />} />
          <Route path="/items" element={<ItemsPage />} />
          <Route path="/inventory" element={<InventoryPage />} />
        </Routes>
      </main>
    </div>
  );
}
