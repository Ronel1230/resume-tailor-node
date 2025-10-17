import { useState, useEffect } from "react";

export default function Home() {
  const [resumes, setResumes] = useState([]);
  const [selected, setSelected] = useState("");
  const [company, setCompany] = useState("");
  const [role, setRole] = useState("");
  const [jd, setJd] = useState("");

  useEffect(() => {
    fetch("/api/resume-list")
      .then(res => res.json())
      .then(data => setResumes(data));
  }, []);

  const generatePDF = async () => {
    if (!selected) return alert("Select a resume");
    if (!jd) return alert("Enter Job Description");

    const res = await fetch("/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ selected, company, role, jd })
    });

    console.log('Response status:', res.status);
    if (!res.ok) {
      const errorText = await res.text();
      console.error('Error response:', errorText);
      return alert("Error generating PDF");
    } else {
      /*
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${selected}${company ? `_${company}` : ''}${role ? `_${role}` : ''}.pdf`;
      a.click();
      window.URL.revokeObjectURL(url);*/
      alert("PDF generation successful! (Download code is currently commented out.)");
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
      <h1 style={{ textAlign: "center", color: "#333" }}>Resume Tailor & PDF Generator</h1>

      <div style={{ margin: "20px 0" }}>
        <label style={{ fontWeight: "bold" }}>Select Resume:</label>
        <select
          value={selected}
          onChange={e => setSelected(e.target.value)}
          style={{
            marginLeft: 10,
            padding: "6px 10px",
            borderRadius: "6px",
            border: "1px solid #ccc",
            width: "calc(100% - 20px)",
            marginTop: "6px"
          }}
        >
          <option value="">--Select--</option>
          {resumes.map(r => <option key={r} value={r}>{r}</option>)}
        </select>
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
          style={{
            background: "#4CAF50",
            color: "#fff",
            border: "none",
            padding: "12px 28px",
            fontSize: "16px",
            fontWeight: "bold",
            borderRadius: "8px",
            cursor: "pointer",
            transition: "background 0.3s"
          }}
          onMouseOver={e => e.currentTarget.style.background = "#45a049"}
          onMouseOut={e => e.currentTarget.style.background = "#4CAF50"}
        >
          Generate PDF
        </button>
      </div>
    </div>
  );
}
