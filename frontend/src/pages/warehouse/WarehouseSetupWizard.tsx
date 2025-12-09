import { useEffect, useMemo, useState } from "react";
import Card from "../../components/Card";
import FormField from "../../components/FormField";
import Notice from "../../components/Notice";
import { createWarehouse, fetchWarehouses } from "../../api/warehouses";
import { createZone, fetchZones } from "../../api/zones";
import { createLocation } from "../../api/locations";
import { Warehouse } from "../../types/warehouse";
import { Zone, ZoneType } from "../../types/zone";

type Step = 1 | 2 | 3 | 4;

type ZoneForm = { name: string; code: string };

type LocationGen = {
  rows: string;
  cols: string;
  levels: string;
  template: string;
  preview: string[];
};

const zoneLabels: Record<ZoneType, string> = {
  inbound: "Приёмка",
  storage: "Хранение",
  outbound: "Отгрузка",
};

const DEFAULT_TEMPLATE = "{{zoneCode}}-{{row}}-{{col}}-{{lvl}}";

export default function WarehouseSetupWizard() {
  const [step, setStep] = useState<Step>(1);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [warehouseForm, setWarehouseForm] = useState({ name: "", code: "" });
  const [warehouse, setWarehouse] = useState<Warehouse | null>(null);

  const [zones, setZones] = useState<Zone[]>([]);
  const [zoneForms, setZoneForms] = useState<Record<ZoneType, ZoneForm>>({
    inbound: { name: "", code: "" },
    storage: { name: "", code: "" },
    outbound: { name: "", code: "" },
  });

  const [locationForms, setLocationForms] = useState<Record<number, LocationGen>>({});
  const [createdLocations, setCreatedLocations] = useState<number>(0);

  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchWarehouses()
      .then(setWarehouses)
      .catch(() => setError("Не удалось загрузить склады"));
  }, []);

  const zonesByType = useMemo(() => {
    return {
      inbound: zones.filter((z) => z.zone_type === "inbound"),
      storage: zones.filter((z) => z.zone_type === "storage"),
      outbound: zones.filter((z) => z.zone_type === "outbound"),
    };
  }, [zones]);

  const canGoStep3 =
    zonesByType.inbound.length > 0 &&
    zonesByType.storage.length > 0 &&
    zonesByType.outbound.length > 0;

  const handleCreateWarehouse = async () => {
    if (!warehouseForm.name.trim() || !warehouseForm.code.trim()) {
      setError("Заполните название и код склада");
      return;
    }
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      const wh = await createWarehouse({
        name: warehouseForm.name.trim(),
        code: warehouseForm.code.trim(),
      });
      setWarehouse(wh);
      setStep(2);
      setMessage("Склад создан. Добавьте зоны.");
      setWarehouseForm({ name: "", code: "" });
      const zs = await fetchZones({ warehouse_id: wh.id });
      setZones(zs);
    } catch (e: any) {
      setError(e.message || "Не удалось создать склад");
    } finally {
      setLoading(false);
    }
  };

  const addZone = async (zone_type: ZoneType) => {
    if (!warehouse) return;
    const form = zoneForms[zone_type];
    if (!form.name.trim() || !form.code.trim()) {
      setError("Заполните название и код зоны");
      return;
    }
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      const zone = await createZone({
        name: form.name.trim(),
        code: form.code.trim(),
        warehouse_id: warehouse.id,
        zone_type,
      });
      setZones((prev) => [...prev, zone]);
      setZoneForms((p) => ({
        ...p,
        [zone_type]: { name: "", code: "" },
      }));
    } catch (e: any) {
      setError(e.message || "Не удалось создать зону");
    } finally {
      setLoading(false);
    }
  };

  const ensureLocationForm = (zone: Zone) => {
    setLocationForms((prev) => {
      if (prev[zone.id]) return prev;
      return {
        ...prev,
        [zone.id]: {
          rows: "2",
          cols: "2",
          levels: "1",
          template: DEFAULT_TEMPLATE.replace("{{zoneCode}}", zone.code),
          preview: [],
        },
      };
    });
  };

  useEffect(() => {
    zones.forEach(ensureLocationForm);
  }, [zones]);

  const updatePreview = (zone: Zone, form: LocationGen) => {
    const rows = Number(form.rows);
    const cols = Number(form.cols);
    const levels = Number(form.levels);
    if (!rows || !cols || !levels) {
      setLocationForms((prev) => ({ ...prev, [zone.id]: { ...form, preview: [] } }));
      return;
    }
    const codes: string[] = [];
    for (let r = 1; r <= rows; r++) {
      for (let c = 1; c <= cols; c++) {
        for (let l = 1; l <= levels; l++) {
          codes.push(
            (form.template || DEFAULT_TEMPLATE)
              .replace(/{{zoneCode}}/g, zone.code)
              .replace(/{{row}}/g, String(r))
              .replace(/{{col}}/g, String(c))
              .replace(/{{lvl}}/g, String(l))
          );
          if (codes.length >= 5) break;
        }
        if (codes.length >= 5) break;
      }
      if (codes.length >= 5) break;
    }
    setLocationForms((prev) => ({ ...prev, [zone.id]: { ...form, preview: codes } }));
  };

  const handleGenChange = (zone: Zone, field: keyof LocationGen, value: string) => {
    const next = { ...(locationForms[zone.id] || {}), [field]: value } as LocationGen;
    setLocationForms((prev) => ({ ...prev, [zone.id]: next }));
    updatePreview(zone, next);
  };

  const generateLocations = async (zone: Zone) => {
    const form = locationForms[zone.id];
    if (!warehouse || !form) return;
    const rows = Number(form.rows);
    const cols = Number(form.cols);
    const levels = Number(form.levels);
    if (!rows || !cols || !levels) {
      setError("Укажите параметры генерации для зоны " + zone.name);
      return;
    }
    setLoading(true);
    setError(null);
    setMessage(null);
    let created = 0;
    const template = form.template || DEFAULT_TEMPLATE;
    for (let r = 1; r <= rows; r++) {
      for (let c = 1; c <= cols; c++) {
        for (let l = 1; l <= levels; l++) {
          const code = template
            .replace(/{{zoneCode}}/g, zone.code)
            .replace(/{{row}}/g, String(r))
            .replace(/{{col}}/g, String(c))
            .replace(/{{lvl}}/g, String(l));
          try {
            await createLocation({
              warehouse_id: warehouse.id,
              zone_id: zone.id,
              code,
              description: null,
            });
            created += 1;
          } catch {
            // ignore duplicates/errors to keep flow simple
          }
        }
      }
    }
    setCreatedLocations((prev) => prev + created);
    setMessage(`Создано ячеек для зоны ${zone.name}: ${created}`);
    setLoading(false);
  };

  const summary = useMemo(() => {
    return {
      inbound: zonesByType.inbound.length,
      storage: zonesByType.storage.length,
      outbound: zonesByType.outbound.length,
    };
  }, [zonesByType]);

  return (
    <div className="page" style={{ alignItems: "stretch" }}>
      <Card title="Мастер настройки склада">
        <StepIndicator step={step} />
        {error && <Notice tone="error">{error}</Notice>}
        {message && <Notice tone="success">{message}</Notice>}

        {step === 1 && (
          <StepWarehouse
            form={warehouseForm}
            setForm={setWarehouseForm}
            onCreate={handleCreateWarehouse}
            loading={loading}
          />
        )}

        {step === 2 && warehouse && (
          <StepZones
            warehouse={warehouse}
            zonesByType={zonesByType}
            zoneForms={zoneForms}
            setZoneForms={setZoneForms}
            addZone={addZone}
            loading={loading}
          />
        )}

        {step === 3 && warehouse && (
          <StepLocations
            zones={zones}
            locationForms={locationForms}
            onChange={handleGenChange}
            onGenerate={generateLocations}
            loading={loading}
          />
        )}

        {step === 4 && warehouse && (
          <StepSummary warehouse={warehouse} summary={summary} createdLocations={createdLocations} />
        )}

        <WizardFooter
          step={step}
          canPrev={step > 1}
          onPrev={() => setStep((s) => (s > 1 ? ((s - 1) as Step) : s))}
          onNext={() => {
            if (step === 1 && warehouse) setStep(2);
            if (step === 2 && canGoStep3) setStep(3);
            if (step === 3) setStep(4);
          }}
          canNext={
            (step === 1 && !!warehouse) ||
            (step === 2 && canGoStep3) ||
            step === 3
          }
        />
      </Card>
    </div>
  );
}

function StepIndicator({ step }: { step: Step }) {
  const steps = [
    { id: 1, label: "Шаг 1: Основные данные склада" },
    { id: 2, label: "Шаг 2: Зоны склада" },
    { id: 3, label: "Шаг 3: Ячейки" },
    { id: 4, label: "Шаг 4: Готово" },
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

function StepWarehouse({
  form,
  setForm,
  onCreate,
  loading,
}: {
  form: { name: string; code: string };
  setForm: (v: { name: string; code: string }) => void;
  onCreate: () => void;
  loading: boolean;
}) {
  return (
    <div className="wizard-section">
      <h3>Основные данные склада</h3>
      <p className="muted">
        Укажите понятное название и короткий код. Код используется в индексах ячеек и зонах.
      </p>
      <div className="form two-cols">
        <FormField label="Название склада">
          <input
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="Например: Основной склад"
          />
        </FormField>
        <FormField label="Код склада">
          <input
            value={form.code}
            onChange={(e) => setForm({ ...form, code: e.target.value })}
            placeholder="WH01"
          />
        </FormField>
      </div>
      <button onClick={onCreate} disabled={loading}>
        {loading ? "Сохранение..." : "Создать склад и перейти дальше"}
      </button>
    </div>
  );
}

function StepZones({
  warehouse,
  zonesByType,
  zoneForms,
  setZoneForms,
  addZone,
  loading,
}: {
  warehouse: Warehouse;
  zonesByType: { inbound: Zone[]; storage: Zone[]; outbound: Zone[] };
  zoneForms: Record<ZoneType, ZoneForm>;
  setZoneForms: (v: Record<ZoneType, ZoneForm>) => void;
  addZone: (t: ZoneType) => void;
  loading: boolean;
}) {
  const blocks: ZoneType[] = ["inbound", "storage", "outbound"];
  const descriptions: Record<ZoneType, string> = {
    inbound: "Сюда попадает товар после разгрузки с машины",
    storage: "Основное хранение, где товар лежит на полках или стеллажах",
    outbound: "Зона отгрузки и комплектации перед отправкой клиенту",
  };
  return (
    <div className="wizard-section">
      <h3>Зоны склада: {warehouse.name}</h3>
      <p className="muted">
        Добавьте минимум одну зону каждого типа: приёмка, хранение, отгрузка. Потом можно будет расширять.
      </p>
      <div className="grid three">
        {blocks.map((type) => (
          <Card key={type} title={zoneLabels[type]}>
            <p className="muted" style={{ minHeight: 40 }}>
              {descriptions[type]}
            </p>
            <div className="form">
              <FormField label="Название">
                <input
                  value={zoneForms[type].name}
                  onChange={(e) =>
                    setZoneForms({ ...zoneForms, [type]: { ...zoneForms[type], name: e.target.value } })
                  }
                  placeholder="Например: Приёмка-1"
                />
              </FormField>
              <FormField label="Код">
                <input
                  value={zoneForms[type].code}
                  onChange={(e) =>
                    setZoneForms({ ...zoneForms, [type]: { ...zoneForms[type], code: e.target.value } })
                  }
                  placeholder="IN-1"
                />
              </FormField>
              <button type="button" onClick={() => addZone(type)} disabled={loading}>
                {loading ? "Добавление..." : "Добавить зону"}
              </button>
            </div>
            <div className="muted" style={{ marginTop: 8 }}>
              Текущие:{" "}
              {zonesByType[type].length === 0
                ? "пока нет"
                : zonesByType[type].map((z) => z.code).join(", ")}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

function StepLocations({
  zones,
  locationForms,
  onChange,
  onGenerate,
  loading,
}: {
  zones: Zone[];
  locationForms: Record<number, LocationGen>;
  onChange: (zone: Zone, field: keyof LocationGen, value: string) => void;
  onGenerate: (zone: Zone) => void;
  loading: boolean;
}) {
  return (
    <div className="wizard-section">
      <h3>Ячейки по зонам</h3>
      <p className="muted">
        Задайте параметры генерации для каждой зоны. Перед сохранением покажем несколько примерных кодов.
      </p>
      <div className="grid two">
        {zones.map((zone) => {
          const form = locationForms[zone.id];
          if (!form) return null;
          return (
            <Card key={zone.id} title={`${zone.name} (${zoneLabels[zone.zone_type]})`}>
              <div className="form two-cols">
                <FormField label="Рядов">
                  <input
                    type="number"
                    min={1}
                    value={form.rows}
                    onChange={(e) => onChange(zone, "rows", e.target.value)}
                  />
                </FormField>
                <FormField label="Секций/стеллажей">
                  <input
                    type="number"
                    min={1}
                    value={form.cols}
                    onChange={(e) => onChange(zone, "cols", e.target.value)}
                  />
                </FormField>
                <FormField label="Уровней">
                  <input
                    type="number"
                    min={1}
                    value={form.levels}
                    onChange={(e) => onChange(zone, "levels", e.target.value)}
                  />
                </FormField>
                <FormField label="Шаблон кода">
                  <input
                    value={form.template}
                    onChange={(e) => onChange(zone, "template", e.target.value)}
                    placeholder="{{zoneCode}}-{{row}}-{{col}}-{{lvl}}"
                  />
                </FormField>
              </div>
              <div className="muted" style={{ marginBottom: 8 }}>
                Пример кодов:
              </div>
              <div className="preview-grid">
                {form.preview.length === 0 && <span className="muted">—</span>}
                {form.preview.map((code) => (
                  <span key={code} className="pill">
                    {code}
                  </span>
                ))}
              </div>
              <button type="button" onClick={() => onGenerate(zone)} disabled={loading}>
                {loading ? "Создание..." : "Сгенерировать ячейки"}
              </button>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

function StepSummary({
  warehouse,
  summary,
  createdLocations,
}: {
  warehouse: Warehouse;
  summary: { inbound: number; storage: number; outbound: number };
  createdLocations: number;
}) {
  const totalZones = summary.inbound + summary.storage + summary.outbound;
  return (
    <div className="wizard-section">
      <h3>Готово</h3>
      <p className="muted">Проверьте, что всё создано корректно.</p>
      <div className="summary">
        <p>
          <strong>Склад:</strong> {warehouse.name} ({warehouse.code})
        </p>
        <p>
          <strong>Зон:</strong> всего {totalZones} — приёмка {summary.inbound}, хранение{" "}
          {summary.storage}, отгрузка {summary.outbound}
        </p>
        <p>
          <strong>Создано ячеек:</strong> {createdLocations}
        </p>
      </div>
      <button type="button" onClick={() => (window.location.href = "/warehouses")}>
        Перейти к складам
      </button>
    </div>
  );
}
