import { useNavigate } from "react-router-dom";
import Card from "../components/Card";
import Notice from "../components/Notice";

export default function InventoryInboundPage() {
  const navigate = useNavigate();

  return (
    <div className="page">
      <Notice tone="info">
        Приёмка выполняется внутри блока «Поставки». Откройте список поставок, начните
        приёмку и работайте со строками там.
      </Notice>
      <Card title="Приёмка через поставки">
        <p className="muted">
          Все операции по приёмке ведите в разделе «Поставки»: старт приёмки, отмена,
          завершение и приёмка по строкам. Здесь прямой приёмки нет, чтобы все действия
          были в одном месте.
        </p>
        <button onClick={() => navigate("/inbound")}>Перейти к поставкам</button>
      </Card>
    </div>
  );
}
