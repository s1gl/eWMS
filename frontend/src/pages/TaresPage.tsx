import { useEffect, useMemo, useState } from "react";
import Card from "../components/Card";
import Notice from "../components/Notice";
import FormField from "../components/FormField";
import { fetchWarehouses } from "../api/warehouses";
import {
  createTare,
  createTaresBulk,
  createTareType,
  deleteTareType,
  getTareTypes,
  getTares,
  updateTareType,
} from "../api/tares";
import type { Warehouse } from "../types/warehouse";
import type { Tare, TareStatus, TareType } from "../types/tare";

const statusLabels: Record<TareStatus, string> = {
  inbound: "Приёмка",
  storage: "Хранение",
  picking: "Отбор",
  outbound: "Отгрузка",
  closed: "Закрыта",
};

export default function TaresPage() {
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [selectedWarehouse, setSelectedWarehouse] = useState<string>("");
  const [tareTypes, setTareTypes] = useState<TareType[]>([]);
  const [tares, setTares] = useState<Tare[]>([]);
  const [typeFilter, setTypeFilter] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [newTareTypeId, setNewTareTypeId] = useState<string>("");
  const [newTareCount, setNewTareCount] = useState<string>("1");

  const [showTypesModal, setShowTypesModal] = useState(false);
  const [editingType, setEditingType] = useState<TareType | null>(null);
  const [typeForm, setTypeForm] = useState<Omit<TareType, "id">>({
    code: "",
    name: "",
    prefix: "",
    level: 1,
  });

  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const [wh, tt] = await Promise.all([fetchWarehouses(), getTareTypes()]);
        setWarehouses(wh);
        setTareTypes(tt);
      } catch (e: any) {
        setError(e.message || "Не удалось загрузить данные");
      }
    };
    load();
  }, []);

  useEffect(() => {
    if (!selectedWarehouse) return;
    loadTares();
  }, [selectedWarehouse, typeFilter, statusFilter]);

  const loadTares = async () => {
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      const params: any = { warehouse_id: Number(selectedWarehouse) };
      if (typeFilter) params.type_id = Number(typeFilter);
      if (statusFilter) params.status = statusFilter;
      const tr = await getTares(params);
      setTares(tr);
    } catch (e: any) {
      setError(e.message || "Не удалось загрузить тары");
    } finally {
      setLoading(false);
    }
  };

  const filteredTares = useMemo(() => tares, [tares]);

  const handleCreateTare = async () => {
    if (!selectedWarehouse) {
      setError("Выберите склад");
      return;
    }
    if (!newTareTypeId) {
      setError("Выберите тип тары");
      return;
    }
    const count = Math.max(1, Number(newTareCount) || 1);
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      if (count > 1) {
        await createTaresBulk({
          warehouse_id: Number(selectedWarehouse),
          type_id: Number(newTareTypeId),
          count,
        });
      } else {
        await createTare({
          warehouse_id: Number(selectedWarehouse),
          type_id: Number(newTareTypeId),
        });
      }
      await loadTares();
      setMessage(count > 1 ? "Тары созданы" : "Тара создана");
    } catch (e: any) {
      setError(e.message || "Не удалось создать тару");
    } finally {
      setLoading(false);
    }
  };

  const handleTypeSubmit = async () => {
    if (!typeForm.code.trim() || !typeForm.name.trim() || !typeForm.prefix.trim()) {
      setError("Заполните название, код и префикс");
      return;
    }
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      if (editingType) {
        const updated = await updateTareType(editingType.id, typeForm);
        setTareTypes((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
        setMessage("Тип тары обновлён");
      } else {
        const created = await createTareType(typeForm);
        setTareTypes((prev) => [...prev, created]);
        setMessage("Тип тары создан");
      }
      setShowTypesModal(false);
      setEditingType(null);
      setTypeForm({ code: "", name: "", prefix: "", level: 1 });
    } catch (e: any) {
      setError(e.message || "Ошибка сохранения типа тары");
    } finally {
      setLoading(false);
    }
  };

  const handleTypeDelete = async (tt: TareType) => {
    if (!confirm(`Удалить тип тары "${tt.name}"?`)) return;
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      await deleteTareType(tt.id);
      setTareTypes((prev) => prev.filter((t) => t.id !== tt.id));
      setMessage("Тип тары удалён");
    } catch (e: any) {
      setError(e.message || "Не удалось удалить тип тары");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page">
      {error && <Notice tone="error">{error}</Notice>}
      {message && <Notice tone="success">{message}</Notice>}

      <Card title="Тары: управление и генерация">
        <div className="form inline">
          <FormField label="Склад">
            <select
              value={selectedWarehouse}
              onChange={(e) => setSelectedWarehouse(e.target.value)}
            >
              <option value="">Выберите склад</option>
              {warehouses.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name} ({w.code})
                </option>
              ))}
            </select>
          </FormField>
          <button type="button" className="ghost" onClick={() => setShowTypesModal(true)}>
            Управление типами
          </button>
        </div>
      </Card>

      <div className="two-column-layout">
        <Card title="Создать тару">
          <div className="form">
            <FormField label="Тип тары">
              <select value={newTareTypeId} onChange={(e) => setNewTareTypeId(e.target.value)}>
                <option value="">Выберите тип</option>
                {tareTypes.map((tt) => (
                  <option key={tt.id} value={tt.id}>
                    {tt.name} ({tt.code})
                  </option>
                ))}
              </select>
            </FormField>
            <FormField label="Количество">
              <input
                type="number"
                min={1}
                value={newTareCount}
                onChange={(e) => setNewTareCount(e.target.value)}
              />
            </FormField>
            <button type="button" onClick={handleCreateTare} disabled={loading || !selectedWarehouse}>
              Создать
            </button>
          </div>
        </Card>

        <Card title="Список тар">
          <div className="form inline">
            <FormField label="Тип">
              <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
                <option value="">Все</option>
                {tareTypes.map((tt) => (
                  <option key={tt.id} value={tt.id}>
                    {tt.name}
                  </option>
                ))}
              </select>
            </FormField>
            <FormField label="Статус">
              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                <option value="">Все</option>
                {Object.keys(statusLabels).map((s) => (
                  <option key={s} value={s}>
                    {statusLabels[s as TareStatus]}
                  </option>
                ))}
              </select>
            </FormField>
          </div>
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Код тары</th>
                  <th>Тип</th>
                  <th>Склад</th>
                  <th>Ячейка</th>
                  <th>Статус</th>
                </tr>
              </thead>
              <tbody>
                {filteredTares.map((t) => {
                  const type = tareTypes.find((tt) => tt.id === t.type_id);
                  return (
                    <tr key={t.id}>
                      <td>{t.tare_code}</td>
                      <td>{type ? type.name : t.type_id}</td>
                      <td>{t.warehouse_id}</td>
                      <td>{t.location_id ?? "—"}</td>
                      <td>{statusLabels[t.status]}</td>
                    </tr>
                  );
                })}
                {filteredTares.length === 0 && (
                  <tr>
                    <td colSpan={5} style={{ textAlign: "center" }}>
                      Тары не найдены
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      {showTypesModal && (
        <div className="modal-backdrop">
          <div className="modal">
            <div className="modal-header">
              <h3>Типы тары</h3>
              <button className="ghost" onClick={() => setShowTypesModal(false)}>
                Закрыть
              </button>
            </div>
            <div className="table-wrapper" style={{ maxHeight: 260, overflowY: "auto" }}>
              <table>
                <thead>
                  <tr>
                    <th>Название</th>
                    <th>Код</th>
                    <th>Префикс</th>
                    <th>Уровень</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {tareTypes.map((tt) => (
                    <tr key={tt.id}>
                      <td>{tt.name}</td>
                      <td>{tt.code}</td>
                      <td>{tt.prefix}</td>
                      <td>{tt.level}</td>
                      <td className="actions-row">
                        <button type="button" className="ghost" onClick={() => setEditingType(tt)}>
                          Редактировать
                        </button>
                        <button type="button" className="ghost" onClick={() => handleTypeDelete(tt)}>
                          Удалить
                        </button>
                      </td>
                    </tr>
                  ))}
                  {tareTypes.length === 0 && (
                    <tr>
                      <td colSpan={5} style={{ textAlign: "center" }}>
                        Типы тары не заданы
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="form" style={{ marginTop: 12 }}>
              <FormField label="Название">
                <input
                  value={typeForm.name}
                  onChange={(e) => setTypeForm((prev) => ({ ...prev, name: e.target.value }))}
                  placeholder="Например, Евро паллета"
                />
              </FormField>
              <FormField label="Код">
                <input
                  value={typeForm.code}
                  onChange={(e) => setTypeForm((prev) => ({ ...prev, code: e.target.value }))}
                  placeholder="PAL_EU"
                />
              </FormField>
              <FormField label="Префикс">
                <input
                  value={typeForm.prefix}
                  onChange={(e) => setTypeForm((prev) => ({ ...prev, prefix: e.target.value }))}
                  placeholder="PAL-EU"
                />
              </FormField>
              <FormField label="Уровень">
                <input
                  type="number"
                  min={1}
                  value={typeForm.level}
                  onChange={(e) =>
                    setTypeForm((prev) => ({ ...prev, level: Number(e.target.value) || 1 }))
                  }
                />
              </FormField>
              <div className="actions-row">
                <button type="button" onClick={handleTypeSubmit} disabled={loading}>
                  {editingType ? "Сохранить" : "Добавить тип"}
                </button>
                <button
                  type="button"
                  className="ghost"
                  onClick={() => {
                    setEditingType(null);
                    setTypeForm({ code: "", name: "", prefix: "", level: 1 });
                  }}
                >
                  Очистить
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
