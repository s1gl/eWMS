import React from "react";
import ReactDOM from "react-dom/client";

const rootElement = document.getElementById("root") as HTMLElement;

function App() {
  return (
    <div style={{ padding: 40, fontFamily: "sans-serif" }}>
      <h1>WMS Frontend работает!</h1>
      <p>Если ты видишь этот экран — фронт успешно поднялся через Docker.</p>
    </div>
  );
}

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
