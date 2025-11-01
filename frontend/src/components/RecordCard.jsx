function RecordCard({ year }) {
  const [record, setRecord] = React.useState({ wins: 0, losses: 0, ties: 0 });

  React.useEffect(() => {
    getCowboysRecord(year).then(setRecord);
  }, [year]);

  return (
    <div style={{ background: "white", padding: "1rem", borderRadius: "10px", marginTop: "1rem" }}>
      <h2>Dallas Cowboys Record {year}</h2>
      <p><b>{record.wins}-{record.losses}-{record.ties}</b></p>
    </div>
  );
}
