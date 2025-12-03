import React, { useEffect, useState, FormEvent } from "react";
import ReactDOM from "react-dom/client";

type Warehouse = {
  id: number;
  name: string;
  code: string;
  is_active: boolean;
};

type Item = {
  id: number;
  sku: string;
  name: string;
  barcode: string | null;
  unit: string;
  is_active: boolean;
};

const API_BASE = "http://localhost:8000";

function App() {
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [items, setItems] = useState<Item[]>([]);

  const [whName, setWhName] = useState("");
  const [whCode, setWhCode] = useState("");

  const [itemSku, setItemSku] = useState("");
  const [itemName, setItemName] = useState("");
  const [itemBarcode, setItemBarcode] = useState("");
  const [itemUnit, setItemUnit] = useState("pcs");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // загрузка данных при старте
  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        setError(null);

        const [whRes, itemsRes] = await Promise.all([
          fetch(`${API_BASE}/warehouses`),
          fetch(`${API_BASE}/items`),
        ]);

        if (!whRes.ok) throw new Error("Failed to load warehouses");
        if (!itemsRes.ok) throw new Error("Failed to load items");

        const whData = await whRes.json();
        const itemsData = await itemsRes.json();

        setWarehouses(whData);
        setItems(itemsData);
      } catch (e: any) {
        setError(e.message || "Unexpected error");
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  // создать склад
  const handleCreateWarehouse = async (e: FormEvent) => {
    e.preventDefault();
    if (!whName.trim() || !whCode.trim()) return;

    try {
      setLoading(true);
      setError(null);

      const res = await fetch(`${API_BASE}/warehouses`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: whName.trim(), code: whCode.trim() }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.detail || "Failed to create warehouse");
      }

      const created: Warehouse = await res.json();
      setWarehouses((prev) => [...prev, created]);
      setWhName("");
      setWhCode("");
    } catch (e: any) {
      setError(e.message || "Unexpected error");
    } finally {
      setLoading(false);
    }
  };

  // создать товар
  const handleCreateItem = async (e: FormEvent) => {
    e.preventDefault();
    if (!itemSku.trim() || !itemName.trim()) return;

    try {
      setLoading(true);
      setError(null);

      const res = await fetch(`${API_BASE}/items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sku: itemSku.trim(),
          name: itemName.trim(),
          barcode: itemBarcode.trim() || null,
          unit: itemUnit.trim() || "pcs",
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.detail || "Failed to create item");
      }

      const created: Item = await res.json();
      setItems((prev) => [...prev, created]);
      setItemSku("");
      setItemName("");
      setItemBarcode("");
      setItemUnit("pcs");
    } catch (e: any) {
      setError(e.message || "Unexpected error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ fontFamily: "system-ui, sans-serif", padding: "16px" }}>
      <h1>WMS Frontend</h1>
      <p>Простой интерфейс для работы со складами и товарами.</p>

      {error && (
        <div
          style={{
            background: "#ffe5e5",
            border: "1px solid #ffaaaa",
            padding: "8px 12px",
            marginBottom: "12px",
          }}
        >
          Ошибка: {error}
        </div>
      )}

      {loading && <p>Загрузка...</p>}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "24px",
          alignItems: "flex-start",
          marginTop: "16px",
        }}
      >
        {/* Склады */}
        <section>
          <h2>Склады</h2>
          <form onSubmit={handleCreateWarehouse} style={{ marginBottom: "12px" }}>
            <div style={{ marginBottom: "8px" }}>
              <label>
                Название:{" "}
                <input
                  value={whName}
                  onChange={(e) => setWhName(e.target.value)}
                  style={{ width: "100%" }}
                />
              </label>
            </div>
            <div style={{ marginBottom: "8px" }}>
              <label>
                Код:{" "}
                <input
                  value={whCode}
                  onChange={(e) => setWhCode(e.target.value)}
                  style={{ width: "100%" }}
                />
              </label>
            </div>
            <button type="submit">Создать склад</button>
          </form>

          <ul style={{ listStyle: "none", padding: 0 }}>
            {warehouses.map((w) => (
              <li
                key={w.id}
                style={{
                  border: "1px solid #ddd",
                  padding: "8px",
                  marginBottom: "8px",
                }}
              >
                <strong>
                  #{w.id} — {w.name}
                </strong>
                <div>Код: {w.code}</div>
                <div>Активен: {w.is_active ? "Да" : "Нет"}</div>
              </li>
            ))}
            {warehouses.length === 0 && <li>Складов пока нет.</li>}
          </ul>
        </section>

        {/* Товары */}
        <section>
          <h2>Товары</h2>
          <form onSubmit={handleCreateItem} style={{ marginBottom: "12px" }}>
            <div style={{ marginBottom: "8px" }}>
              <label>
                SKU:{" "}
                <input
                  value={itemSku}
                  onChange={(e) => setItemSku(e.target.value)}
                  style={{ width: "100%" }}
                />
              </label>
            </div>
            <div style={{ marginBottom: "8px" }}>
              <label>
                Название:{" "}
                <input
                  value={itemName}
                  onChange={(e) => setItemName(e.target.value)}
                  style={{ width: "100%" }}
                />
              </label>
            </div>
            <div style={{ marginBottom: "8px" }}>
              <label>
                Штрихкод:{" "}
                <input
                  value={itemBarcode}
                  onChange={(e) => setItemBarcode(e.target.value)}
                  style={{ width: "100%" }}
                />
              </label>
            </div>
            <div style={{ marginBottom: "8px" }}>
              <label>
                Ед. изм.:{" "}
                <input
                  value={itemUnit}
                  onChange={(e) => setItemUnit(e.target.value)}
                  style={{ width: "100%" }}
                />
              </label>
            </div>
            <button type="submit">Создать товар</button>
          </form>

          <ul style={{ listStyle: "none", padding: 0 }}>
            {items.map((it) => (
              <li
                key={it.id}
                style={{
                  border: "1px solid #ddd",
                  padding: "8px",
                  marginBottom: "8px",
                }}
              >
                <strong>
                  #{it.id} — {it.name}
                </strong>
                <div>SKU: {it.sku}</div>
                <div>Штрихкод: {it.barcode || "—"}</div>
                <div>Ед. изм.: {it.unit}</div>
                <div>Активен: {it.is_active ? "Да" : "Нет"}</div>
              </li>
            ))}
            {items.length === 0 && <li>Товаров пока нет.</li>}
          </ul>
        </section>
      </div>
    </div>
  );
}

const container = document.getElementById("root")!;
const root = ReactDOM.createRoot(container);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
