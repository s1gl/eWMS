import { Navigate, NavLink, Route, Routes } from "react-router-dom";
import WarehousesPage from "./pages/WarehousesPage";
import ItemsPage from "./pages/ItemsPage";
import ZonesPage from "./pages/ZonesPage";
import LocationsPage from "./pages/LocationsPage";
import InventoryInboundPage from "./pages/InventoryInboundPage";
import InventoryMovePage from "./pages/InventoryMovePage";
import InventoryStockPage from "./pages/InventoryStockPage";
import WarehouseSetupWizard from "./pages/warehouse/WarehouseSetupWizard";
import InboundListPage from "./pages/InboundListPage";
import InboundCreatePage from "./pages/InboundCreatePage";
import InboundDetailPage from "./pages/InboundDetailPage";

const navLinks = [
  { to: "/warehouses", label: "Склады" },
  { to: "/items", label: "Товары" },
  { to: "/zones", label: "Зоны" },
  { to: "/locations", label: "Ячейки" },
  { to: "/inbound", label: "Поставки" },
  { to: "/inventory/inbound", label: "Приёмка" },
  { to: "/inventory/move", label: "Перемещение" },
  { to: "/inventory/stock", label: "Остатки" },
  { to: "/setup-wizard", label: "Мастер склада" },
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
          <Route path="/inbound" element={<InboundListPage />} />
          <Route path="/inbound/new" element={<InboundCreatePage />} />
          <Route path="/inbound/:id" element={<InboundDetailPage />} />
          <Route path="/inventory" element={<Navigate to="/inventory/inbound" replace />} />
          <Route path="/inventory/inbound" element={<InventoryInboundPage />} />
          <Route path="/inventory/move" element={<InventoryMovePage />} />
          <Route path="/inventory/stock" element={<InventoryStockPage />} />
          <Route path="/setup-wizard" element={<WarehouseSetupWizard />} />
        </Routes>
      </main>
    </div>
  );
}
