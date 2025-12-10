import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { getInboundOrders } from "../api/inbound";
import { fetchWarehouses } from "../api/warehouses";
import { InboundOrder, InboundStatus } from "../types/inbound";
import { Warehouse } from "../types/warehouse";
import Card from "../components/Card";
import Notice from "../components/Notice";

const statusLabels: Record<InboundStatus, string> = {
  created: "Создана",
  ready_for_receiving: "Готова к приёмке",
  receiving: "В приёмке",
  received: "Принята",
  cancelled: "Отменена",
  problem: "Проблема",
  mis_sort: "Пересорт",
  // legacy
  draft: "Готова к приёмке",
  in_progress: "В приёмке",
  completed: "Принята",
};

export default function InboundListPage() {
  const [orders, setOrders] = useState<InboundOrder[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    loadData();
  }, []);

  const warehouseName = (id: number) => {
    const wh = warehouses.find((w) => w.id === id);
    return wh ? `${wh.name} (${wh.code})` : `Склад ${id}`;
  };

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [data, wh] = await Promise.all([getInboundOrders(), fetchWarehouses()]);
      setOrders(data);
      setWarehouses(wh);
    } catch (e: any) {
      setError(e.message || "Не удалось загрузить список поставок");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page">
      <Card
        title="Поставки"
        actions={
          <Link className="ghost" to="/inbound/new">
            Создать поставку
          </Link>
        }
      >
        <p className="muted">
          Здесь список всех поставок и их статусы. Нажмите на строку, чтобы открыть детальную страницу.
        </p>
        {error && <Notice tone="error">{error}</Notice>}
        {loading && <Notice tone="info">Загрузка...</Notice>}
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Внешний номер</th>
                <th>Склад</th>
                <th>Статус</th>
                <th>Создана</th>
                <th>Обновлена</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => (
                <tr
                  key={o.id}
                  onClick={() => navigate(`/inbound/${o.id}`)}
                  style={{ cursor: "pointer" }}
                >
                  <td>№ {o.id}</td>
                  <td>{o.external_number || "—"}</td>
                  <td>{warehouseName(o.warehouse_id)}</td>
                  <td>{statusLabels[o.status] || o.status}</td>
                  <td>{o.created_at || "—"}</td>
                  <td>{o.updated_at || "—"}</td>
                </tr>
              ))}
              {orders.length === 0 && (
                <tr>
                  <td colSpan={6} style={{ textAlign: "center" }}>
                    Поставки не найдены
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
