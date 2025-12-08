import { useNavigate } from "react-router-dom";
import Card from "../components/Card";
import Notice from "../components/Notice";

export default function InventoryInboundPage() {
  const navigate = useNavigate();

  return (
    <div className="page">
      <Notice tone="info">
        Приёмка теперь выполняется только через модуль «Поставки». Создайте поставку и
        принимайте товары в её деталях.
      </Notice>
      <Card title="Приёмка через поставки">
        <p className="muted">
          Прямую приёмку мы убрали, чтобы все приходы фиксировались через поставки. Откройте
          список поставок и работайте с приёмкой в деталях документа.
        </p>
        <button onClick={() => navigate("/inbound")}>Перейти к поставкам</button>
      </Card>
    </div>
  );
}
