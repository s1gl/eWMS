import { useEffect, useMemo, useState } from "react";
import { createWarehouse, fetchWarehouses } from "../../api/warehouses";
import { createZone, fetchZones } from "../../api/zones";
import { createLocation } from "../../api/locations";
import { Warehouse } from "../../types/warehouse";
import { Zone } from "../../types/zone";
import Card from "../../components/Card";
import FormField from "../../components/FormField";
import Notice from "../../components/Notice";

type Step = 1 | 2 | 3;

const DEFAULT_TEMPLATE = "{{zoneCode}}-{{row}}-{{col}}-{{lvl}}";

type LocationGenParams = {
  zoneId: string;
  rows: string;
  cols: string;
  levels: string;
  template: string;
};

export default function WarehouseSetupWizard() {
  const [step, setStep] = useState<Step>(1);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [zones, setZones] = useState<Zone[]>([]);
  const [selectedWarehouse, setSelectedWarehouse] = useState<Warehouse | null>(null);
  const [selectedZoneId, setSelectedZoneId] = useState<string>("");

  const [whForm, setWhForm] = useState({ name: "", code: "" });
  const [zoneForm, setZoneForm] = useState({ name: "", code: "" });

  const [locParams, setLocParams] = useState<LocationGenParams>({
    zoneId: "",
    rows: "2",
    cols: "2",
    levels: "1",
    template: DEFAULT_TEMPLATE,
  });

  const [preview, setPreview] = useState<string[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchWarehouses()
      .then(setWarehouses)
      .catch(() => setError("Не удалось загрузить склады"));
  }, []);

  useEffect(() => {
    const zoneId = Number(locParams.zoneId);
    const zone = zones.find((z) => z.id === zoneId);
    const rows = Number(locParams.rows);
    const cols = Number(locParams.cols);
    const levels = Number(locParams.levels);
    if (!zone || !rows || !cols || !levels) {
      setPreview([]);
      return;
    }
    const codes: string[] = [];
    for (let r = 1; r <= rows; r++) {
      for (let c = 1; c <= cols; c++) {
        for (let l = 1; l <= levels; l++) {
          const code = renderTemplate(locParams.template || DEFAULT_TEMPLATE, {
            zoneCode: zone.code,
            row: r,
            col: c,
            lvl: l,
          });
          codes.push(code);
          if (codes.length >= 50) break;
        }
        if (codes.length >= 50) break;
      }
      if (codes.length >= 50) break;
    }
    setPreview(codes);
  }, [locParams, zones]);

  const currentStepLabel = useMemo(() => {
    switch (step) {
      case 1:
        return "Шаг 1: Склад";
      case 2:
        return "Шаг 2: Зоны";
      case 3:
        return "Шаг 3: Ячейки";
    }
  }, [step]);

  const loadZones = async (warehouseId: number) => {
    const zs = await fetchZones(warehouseId);
    setZones(zs);
    if (zs.length > 0) {
      setSelectedZoneId(String(zs[0].id));
      setLocParams((p) => ({ ...p, zoneId: String(zs[0].id) }));
    }
  };

  const handleCreateWarehouse = async () => {
    if (!whForm.name.trim() || !whForm.code.trim()) return;
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      const wh = await createWarehouse({
        name: whForm.name.trim(),
        code: whForm.code.trim(),
      });
      setSelectedWarehouse(wh);
      await loadZones(wh.id);
      setStep(2);
      setMessage("Склад создан. Перейдите к настройке зон.");
      setWhForm({ name: "", code: "" });
    } catch (e: any) {
      setError(e.message || "Не удалось создать склад (проверьте код на уникальность)");
    } finally {
      setLoading(false);
    }
  };

  const handleSelectWarehouse = async (id: number) => {
    const wh = warehouses.find((w) => w.id === id);
    if (!wh) return;
    setSelectedWarehouse(wh);
    setMessage(null);
    setError(null);
    await loadZones(wh.id);
    setStep(2);
  };

  const handleCreateZone = async () => {
    if (!selectedWarehouse) return;
    if (!zoneForm.name.trim() || !zoneForm.code.trim()) return;
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      const z = await createZone({
        name: zoneForm.name.trim(),
        code: zoneForm.code.trim(),
        warehouse_id: selectedWarehouse.id,
      });
      setZones((prev) => [...prev, z]);
      setZoneForm({ name: "", code: "" });
      setSelectedZoneId(String(z.id));
      setLocParams((p) => ({ ...p, zoneId: String(z.id) }));
      setMessage("Зона создана");
    } catch (e: any) {
      setError(e.message || "Не удалось создать зону (проверьте код)");
    } finally {
      setLoading(false);
    }
  };

  const canGoStep3 = zones.length > 0;

  const handleCreateLocations = async () => {
    if (!selectedWarehouse) {
      setError("Сначала выберите склад");
      return;
    }
    const zoneIdNum = Number(locParams.zoneId);
    const rows = Number(locParams.rows);
    const cols = Number(locParams.cols);
    const levels = Number(locParams.levels);
    if (!zoneIdNum || !rows || !cols || !levels) {
      setError("Заполните параметры генерации ячеек");
      return;
    }
    const zone = zones.find((z) => z.id === zoneIdNum);
    if (!zone) {
      setError("Зона не найдена");
      return;
    }
    setLoading(true);
    setError(null);
    setMessage(null);
    let created = 0;
    let errors: string[] = [];

    for (let r = 1; r <= rows; r++) {
      for (let c = 1; c <= cols; c++) {
        for (let l = 1; l <= levels; l++) {
          const code = renderTemplate(locParams.template || DEFAULT_TEMPLATE, {
            zoneCode: zone.code,
            row: r,
            col: c,
            lvl: l,
          });
          try {
            await createLocation({
              warehouse_id: selectedWarehouse.id,
              zone_id: zoneIdNum,
              code,
              description: null,
            });
            created += 1;
          } catch (e: any) {
            errors.push(`Код ${code}: ${e.message || "ошибка"}`);
          }
        }
      }
    }

    if (errors.length > 0) {
      setError(`Создано ${created}, ошибки: ${errors.slice(0, 5).join("; ")}${errors.length > 5 ? " ..." : ""}`);
    } else {
      setMessage(`Мастер завершён. Создано ячеек: ${created}`);
    }
    setLoading(false);
  };

  return (
    <div className="page">
      <Card title="Мастер настройки склада">
        <StepIndicator step={step} />
        {message && <Notice tone="success">{message}</Notice>}
        {error && <Notice tone="error">{error}</Notice>}

        {step === 1 && (
          <Step1WarehouseForm
            whForm={whForm}
            setWhForm={setWhForm}
            warehouses={warehouses}
            onSelectWarehouse={handleSelectWarehouse}
            onCreate={handleCreateWarehouse}
            loading={loading}
          />
        )}

        {step === 2 && selectedWarehouse && (
          <Step2ZonesForm
            warehouse={selectedWarehouse}
            zones={zones}
            zoneForm={zoneForm}
            setZoneForm={setZoneForm}
            onCreateZone={handleCreateZone}
            loading={loading}
          />
        )}

        {step === 3 && selectedWarehouse && (
          <Step3LocationGenerator
            zones={zones}
            params={locParams}
            setParams={setLocParams}
            preview={preview}
            loading={loading}
            onSubmit={handleCreateLocations}
          />
        )}

        <WizardFooter
          step={step}
          canNext={step === 1 ? !!selectedWarehouse || (!!whForm.name && !!whForm.code) : step === 2 ? canGoStep3 : true}
          canPrev={step > 1}
          onPrev={() => setStep((s) => (s > 1 ? ((s - 1) as Step) : s))}
          onNext={() => {
            if (step === 1 && selectedWarehouse) setStep(2);
            else if (step === 2 && canGoStep3) setStep(3);
          }}
          onFinish={step === 3 ? handleCreateLocations : undefined}
        />
      </Card>
    </div>
  );
}

function StepIndicator({ step }: { step: Step }) {
  const steps = [
    { id: 1, label: "Шаг 1: Склад" },
    { id: 2, label: "Шаг 2: Зоны" },
    { id: 3, label: "Шаг 3: Ячейки" },
  ];
  return (
    <div className="wizard-steps">
      {steps.map((s) => (
        <div key={s.id} className={`wizard-step ${step === s.id ? "active" : ""} ${step > s.id ? "done" : ""}`}>
          {s.label}
        </div>
      ))}
    </div>
  );
}

function Step1WarehouseForm({
  whForm,
  setWhForm,
  warehouses,
  onSelectWarehouse,
  onCreate,
  loading,
}: {
  whForm: { name: string; code: string };
  setWhForm: (v: { name: string; code: string }) => void;
  warehouses: Warehouse[];
  onSelectWarehouse: (id: number) => void;
  onCreate: () => void;
  loading: boolean;
}) {
  return (
    <div className="wizard-section">
      <h3>Создайте склад или выберите существующий</h3>
      <div className="grid two-cols">
        <div>
          <div className="form">
            <FormField label="Название склада">
              <input
                value={whForm.name}
                onChange={(e) => setWhForm({ ...whForm, name: e.target.value })}
                placeholder="Основной склад"
              />
            </FormField>
            <FormField label="Код склада">
              <input
                value={whForm.code}
                onChange={(e) => setWhForm({ ...whForm, code: e.target.value })}
                placeholder="WH01"
              />
            </FormField>
            <button onClick={onCreate} disabled={loading}>
              {loading ? "Сохраняю..." : "Создать склад"}
            </button>
          </div>
        </div>
        <div>
          <FormField label="Выбрать существующий склад">
            <select onChange={(e) => onSelectWarehouse(Number(e.target.value))} defaultValue="">
              <option value="">--</option>
              {warehouses.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name} ({w.code})
                </option>
              ))}
            </select>
          </FormField>
        </div>
      </div>
    </div>
  );
}

function Step2ZonesForm({
  warehouse,
  zones,
  zoneForm,
  setZoneForm,
  onCreateZone,
  loading,
}: {
  warehouse: Warehouse;
  zones: Zone[];
  zoneForm: { name: string; code: string };
  setZoneForm: (v: { name: string; code: string }) => void;
  onCreateZone: () => void;
  loading: boolean;
}) {
  return (
    <div className="wizard-section">
      <h3>Зоны склада: {warehouse.name}</h3>
      <div className="form">
        <FormField label="Название зоны">
          <input
            value={zoneForm.name}
            onChange={(e) => setZoneForm({ ...zoneForm, name: e.target.value })}
            placeholder="Зона А"
          />
        </FormField>
        <FormField label="Код зоны">
          <input
            value={zoneForm.code}
            onChange={(e) => setZoneForm({ ...zoneForm, code: e.target.value })}
            placeholder="A"
          />
        </FormField>
        <button onClick={onCreateZone} disabled={loading}>
          {loading ? "Сохраняю..." : "Добавить зону"}
        </button>
      </div>

      <div className="table-wrapper" style={{ marginTop: 12 }}>
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>Название</th>
              <th>Код</th>
            </tr>
          </thead>
          <tbody>
            {zones.map((z) => (
              <tr key={z.id}>
                <td>{z.id}</td>
                <td>{z.name}</td>
                <td>{z.code}</td>
              </tr>
            ))}
            {zones.length === 0 && (
              <tr>
                <td colSpan={3} style={{ textAlign: "center" }}>
                  Зон пока нет
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Step3LocationGenerator({
  zones,
  params,
  setParams,
  preview,
  loading,
  onSubmit,
}: {
  zones: Zone[];
  params: LocationGenParams;
  setParams: (p: LocationGenParams) => void;
  preview: string[];
  loading: boolean;
  onSubmit: () => void;
}) {
  return (
    <div className="wizard-section">
      <h3>Генерация ячеек</h3>
      <div className="form">
        <FormField label="Зона">
          <select
            value={params.zoneId}
            onChange={(e) => setParams({ ...params, zoneId: e.target.value })}
          >
            <option value="">Выберите зону</option>
            {zones.map((z) => (
              <option key={z.id} value={z.id}>
                {z.name} ({z.code})
              </option>
            ))}
          </select>
        </FormField>
        <FormField label="Количество рядов">
          <input
            type="number"
            min={1}
            value={params.rows}
            onChange={(e) => setParams({ ...params, rows: e.target.value })}
          />
        </FormField>
        <FormField label="Мест в ряду">
          <input
            type="number"
            min={1}
            value={params.cols}
            onChange={(e) => setParams({ ...params, cols: e.target.value })}
          />
        </FormField>
        <FormField label="Уровней">
          <input
            type="number"
            min={1}
            value={params.levels}
            onChange={(e) => setParams({ ...params, levels: e.target.value })}
          />
        </FormField>
        <FormField label="Шаблон кода">
          <input
            value={params.template}
            onChange={(e) => setParams({ ...params, template: e.target.value })}
            placeholder="{{zoneCode}}-{{row}}-{{col}}-{{lvl}}"
          />
        </FormField>
      </div>

      <Card title="Превью кодов (первые 50)">
        <div className="preview-grid">
          {preview.length === 0 && <div className="muted">Нет данных — задайте параметры</div>}
          {preview.map((code) => (
            <div key={code} className="pill">
              {code}
            </div>
          ))}
        </div>
      </Card>

      <button onClick={onSubmit} disabled={loading}>
        {loading ? "Создаю ячейки..." : "Создать ячейки"}
      </button>
    </div>
  );
}

function WizardFooter({
  step,
  canNext,
  canPrev,
  onPrev,
  onNext,
  onFinish,
}: {
  step: Step;
  canNext: boolean;
  canPrev: boolean;
  onPrev: () => void;
  onNext: () => void;
  onFinish?: () => void;
}) {
  return (
    <div className="wizard-footer">
      <div className="muted">Текущий шаг: {step} / 3</div>
      <div className="actions-row">
        <button type="button" className="ghost" onClick={onPrev} disabled={!canPrev}>
          Назад
        </button>
        {step < 3 && (
          <button type="button" onClick={onNext} disabled={!canNext}>
            Далее
          </button>
        )}
        {step === 3 && onFinish && (
          <button type="button" onClick={onFinish}>
            Завершить
          </button>
        )}
      </div>
    </div>
  );
}

function renderTemplate(tmpl: string, data: { zoneCode: string; row: number; col: number; lvl: number }) {
  return tmpl
    .replace(/{{zoneCode}}/g, data.zoneCode)
    .replace(/{{row}}/g, String(data.row))
    .replace(/{{col}}/g, String(data.col))
    .replace(/{{lvl}}/g, String(data.lvl));
}
