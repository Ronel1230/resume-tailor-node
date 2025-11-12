import { useState, useEffect } from "react";

export default function Home() {
  const [resumes, setResumes] = useState([]);
  const [selected, setSelected] = useState("");
  const [company, setCompany] = useState("");
  const [role, setRole] = useState("");
  const [jd, setJd] = useState("");
  const [disable, setDisable] = useState(false);

  useEffect(() => {
    fetch("/api/resume-list")
      .then(res => res.json())
      .then(data => setResumes(data));
  }, []);

  const generatePDF = async () => {
    if (disable) return; // already running
    if (!selected) return alert("Select a resume");
    if (!jd) return alert("Enter Job Description");

    setDisable(true); // disable immediately

    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ selected, company, role, jd })
      });

      if (!res.ok) {
        const errorText = await res.text();
        console.error('Error response:', errorText);
        return alert("Error generating PDF");
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${selected}${company ? `_${company}` : ''}${role ? `_${role}` : ''}.pdf`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Generate PDF failed:', err);
      alert('Error generating PDF');
    } finally {
      setDisable(false);
    }

  };

  return (
    <div style={{
      maxWidth: 700,
      margin: "40px auto",
      fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
      background: "#f9f9f9",
      padding: "30px",
      borderRadius: "12px",
      boxShadow: "0 4px 12px rgba(0,0,0,0.1)"
    }}>
      <h1 style={{ textAlign: "center", color: "#333", marginBottom: 6 }}>Resume Tailor & PDF Generator</h1>
      {selected && (
        <div style={{ textAlign: "center", color: "#4CAF50", fontWeight: 600, marginBottom: 10 }}>
          Selected: {selected}
        </div>
      )}

      <div style={{ margin: "20px 0" }}>
        <label style={{ fontWeight: "bold", display: "block", marginBottom: 8 }}>Choose a Resume:</label>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
          {resumes && resumes.length > 0 ? (
            resumes.map(r => (
              <button
                key={r}
                type="button"
                onClick={() => setSelected(r)}
                aria-pressed={selected === r}
                style={{
                  padding: "10px 14px",
                  borderRadius: 10,
                  border: selected === r ? "2px solid #4CAF50" : "1px solid #ddd",
                  background: selected === r ? "#E8F5E9" : "#fff",
                  color: "#333",
                  cursor: "pointer",
                  fontWeight: 600,
                  boxShadow: selected === r ? "0 2px 8px rgba(76,175,80,0.25)" : "0 1px 4px rgba(0,0,0,0.06)",
                  transition: "all 0.15s",
                }}
                onMouseEnter={e => (e.currentTarget.style.boxShadow = "0 3px 10px rgba(0,0,0,0.12)")}
                onMouseLeave={e => (e.currentTarget.style.boxShadow = selected === r ? "0 2px 8px rgba(76,175,80,0.25)" : "0 1px 4px rgba(0,0,0,0.06)")}
              >
                {r}
              </button>
            ))
          ) : (
            <div style={{ color: "#777" }}>No resumes found.</div>
          )}
        </div>
      </div>

      <div style={{ margin: "20px 0" }}>
        <label style={{ fontWeight: "bold" }}>Company (Optional):</label>
        <input
          value={company}
          onChange={e => setCompany(e.target.value)}
          placeholder="Enter company name"
          style={{
            marginLeft: 10,
            padding: "6px 10px",
            borderRadius: "6px",
            border: "1px solid #ccc",
            width: "calc(100% - 20px)",
            marginTop: "6px"
          }}
        />
      </div>

      <div style={{ margin: "20px 0" }}>
        <label style={{ fontWeight: "bold" }}>Role (Optional):</label>
        <input
          value={role}
          onChange={e => setRole(e.target.value)}
          placeholder="Enter role"
          style={{
            marginLeft: 10,
            padding: "6px 10px",
            borderRadius: "6px",
            border: "1px solid #ccc",
            width: "calc(100% - 20px)",
            marginTop: "6px"
          }}
        />
      </div>

      <div style={{ margin: "20px 0" }}>
        <label style={{ fontWeight: "bold" }}>Job Description:</label>
        <textarea
          value={jd}
          onChange={e => setJd(e.target.value)}
          rows={8}
          placeholder="Paste the job description here..."
          style={{
            width: "100%",
            marginTop: 6,
            padding: "10px",
            borderRadius: "8px",
            border: "1px solid #ccc",
            fontFamily: "inherit",
            fontSize: "14px",
            resize: "vertical"
          }}
        />
      </div>

      <div style={{ textAlign: "center" }}>
        <button
          onClick={generatePDF}
          disabled={disable}
          onMouseEnter={e => {
            if (!disable) e.currentTarget.style.background = "#45a049";
          }}
          onMouseLeave={e => {
            if (!disable) e.currentTarget.style.background = "#4CAF50";
          }}
          style={{
            background: disable ? "#9e9e9e" : "#4CAF50",
            color: "#fff",
            border: "none",
            padding: "12px 28px",
            fontSize: "16px",
            fontWeight: "bold",
            borderRadius: "8px",
            cursor: disable ? "not-allowed" : "pointer",
            transition: "background 0.15s",
            opacity: disable ? 0.8 : 1
          }}
        >
          {disable ? 'Generating...' : 'Generate PDF'}
        </button>
      </div>
    </div>
  );
}
