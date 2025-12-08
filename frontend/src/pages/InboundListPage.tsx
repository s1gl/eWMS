import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { changeInboundStatus, getInboundOrders } from "../api/inbound";
import { fetchWarehouses } from "../api/warehouses";
import { InboundOrder, InboundStatus } from "../types/inbound";
import { Warehouse } from "../types/warehouse";
import Card from "../components/Card";
import Notice from "../components/Notice";

const statusLabels: Record<InboundStatus, string> = {
  draft: "Черновик",
  in_progress: "В приёмке",
  completed: "Завершена",
  cancelled: "Отменена",
};

export default function InboundListPage() {
  const [orders, setOrders] = useState<InboundOrder[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    loadData();
  }, []);

  const warehouseName = (id: number) => {
    const wh = warehouses.find((w) => w.id === id);
    return wh ? `${wh.name} (${wh.code})` : id;
  };

  const loadData = async () => {
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      const [data, wh] = await Promise.all([getInboundOrders(), fetchWarehouses()]);
      setOrders(data);
      setWarehouses(wh);
    } catch (e: any) {
      setError(e.message || "Не удалось загрузить поставки");
    } finally {
      setLoading(false);
    }
  };

  const updateStatus = async (order: InboundOrder, status: InboundStatus) => {
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      const updated = await changeInboundStatus(order.id, { status });
      setOrders((prev) => prev.map((o) => (o.id === updated.id ? updated : o)));
      if (status === "in_progress") {
        setMessage("Поставка переведена в приёмку");
      } else if (status === "completed") {
        setMessage("Поставка завершена");
      } else if (status === "cancelled") {
        setMessage("Поставка отменена");
      }
    } catch (e: any) {
      setError(e.message || "Не удалось обновить статус");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page">
      <Card
        title="Поставки на склад"
        actions={
          <Link className="ghost" to="/inbound/new">
            Создать поставку
          </Link>
        }
      >
        <p className="muted">
          Здесь вы видите список всех поставок и их статус. Отсюда можно создать новую
          поставку и открыть приёмку по любой строке.
        </p>
        {message && <Notice tone="success">{message}</Notice>}
        {error && <Notice tone="error">{error}</Notice>}
        {loading && <Notice tone="info">Загрузка...</Notice>}
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th style={{ width: 140 }}>Действие</th>
                <th>Номер поставки</th>
                <th>Внешний номер</th>
                <th>Склад</th>
                <th>Статус</th>
                <th>Дата создания</th>
                <th>Дата обновления</th>
                <th style={{ width: 140, textAlign: "right" }}>Управление</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => (
                <tr
                  key={o.id}
                  onClick={() => navigate(`/inbound/${o.id}`)}
                  style={{ cursor: "pointer" }}
                >
                  <td>
                    <button
                      type="button"
                      className="ghost"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (o.status === "draft") updateStatus(o, "in_progress");
                      }}
                      disabled={o.status !== "draft" || loading}
                    >
                      {o.status === "draft" ? "Начать приёмку" : "В работе"}
                    </button>
                  </td>
                  <td>
                    <Link to={`/inbound/${o.id}`} onClick={(e) => e.stopPropagation()}>
                      № {o.id}
                    </Link>
                  </td>
                  <td>{o.external_number || "—"}</td>
                  <td>{warehouseName(o.warehouse_id)}</td>
                  <td>{statusLabels[o.status] || o.status}</td>
                  <td>{o.created_at || "—"}</td>
                  <td>{o.updated_at || "—"}</td>
                  <td style={{ textAlign: "right" }}>
                    {o.status === "draft" ? (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          updateStatus(o, "cancelled");
                        }}
                        style={{
                          background: "#e53935",
                          color: "white",
                          width: 32,
                          height: 32,
                          borderRadius: 4,
                          border: "none",
                        }}
                        title="Отменить поставку"
                        disabled={loading}
                      >
                        ✕
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="ghost"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (o.status !== "completed") {
                            updateStatus(o, "completed");
                          }
                        }}
                        disabled={o.status === "completed" || loading}
                      >
                        {o.status === "completed" ? "Приёмка завершена" : "Завершить приёмку"}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {orders.length === 0 && (
                <tr>
                  <td colSpan={8} style={{ textAlign: "center" }}>
                    Пока нет созданных поставок
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
