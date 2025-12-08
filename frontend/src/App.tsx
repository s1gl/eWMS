import { NavLink, Route, Routes, Navigate } from "react-router-dom";
import WarehousesPage from "./pages/WarehousesPage";
import ItemsPage from "./pages/ItemsPage";
import ZonesPage from "./pages/ZonesPage";
import LocationsPage from "./pages/LocationsPage";
import InventoryInboundPage from "./pages/InventoryInboundPage";
import InventoryMovePage from "./pages/InventoryMovePage";
import InventoryStockPage from "./pages/InventoryStockPage";

const navLinks = [
  { to: "/warehouses", label: "Склады" },
  { to: "/items", label: "Товары" },
  { to: "/zones", label: "Зоны" },
  { to: "/locations", label: "Ячейки" },
  { to: "/inventory/inbound", label: "Приёмка" },
  { to: "/inventory/move", label: "Перемещение" },
  { to: "/inventory/stock", label: "Остатки" },
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
          <Route path="/zones" element={<ZonesPage />} />
          <Route path="/locations" element={<LocationsPage />} />
          <Route path="/inventory" element={<Navigate to="/inventory/inbound" replace />} />
          <Route path="/inventory/inbound" element={<InventoryInboundPage />} />
          <Route path="/inventory/move" element={<InventoryMovePage />} />
          <Route path="/inventory/stock" element={<InventoryStockPage />} />
        </Routes>
      </main>
    </div>
  );
}
