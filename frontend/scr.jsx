function App() {
  const yearNow = new Date().getFullYear();
  const [year, setYear] = React.useState(yearNow);

  return (
    <div style={{ padding: "1rem" }}>
      <h1>Cowboys Playoff Prediction App</h1>
      <p>Live record and every game</p>
      <input
        type="number"
        value={year}
        onChange={(e) => setYear(Number(e.target.value))}
      />
      <RecordCard year={year} />
      <GameTable year={year} />
    </div>
  );
}

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(<App />);
