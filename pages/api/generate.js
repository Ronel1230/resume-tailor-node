import fs from "fs";
import path from "path";
import Handlebars from "handlebars";
import chromium from "@sparticuz/chromium";
import puppeteer from "puppeteer-core";
import OpenAI from "openai";
import { parse } from "jsonc-parser";


const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// --- Handlebars helpers ---
Handlebars.registerHelper("join", function (array, separator) {
  return Array.isArray(array) ? array.join(separator) : "";
});

Handlebars.registerHelper("formatKey", function (key) {
  if (!key) return "";
  const words = key.split("_").map(word => {
    if (["ai", "ml", "nlp", "ci", "cd"].includes(word.toLowerCase())) {
      return word.toUpperCase();
    }
    return word.charAt(0).toUpperCase() + word.slice(1);
  });
  return words.join(" ");
});

Handlebars.registerHelper("safe", function (text) {
  return new Handlebars.SafeString(text);
});

// --- Robust JSON parse ---
function robustJsonParse(text) {
  try {
    return parse(text);
  } catch (err) {
    console.error("Failed to parse AI response:", text);
    throw new Error("AI did not return valid JSON.");
  }
}

// --- Call OpenAI with timeout & retries ---
async function callOpenAI(prompt, retries = 2, timeoutMs = 30000) {
  while (retries > 0) {
    try {
      return await Promise.race([
        openai.chat.completions.create({
          model: process.env.OPENAI_VERSION,
          messages: [{ role: "user", content: prompt }],
          temperature: 0.7
        }),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error("OpenAI request timed out")), timeoutMs)
        )
      ]);
    } catch (err) {
      retries--;
      if (retries === 0) throw err;
    }
  }
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).send("Method not allowed");

  try {
    const { selected, company, role, jd } = req.body;
    if (!selected || !jd) return res.status(400).send("Resume and JD required");

    // Load base resume
    const resumePath = path.join(process.cwd(), "resumes", `${selected}.json`);
    const resumeJson = JSON.parse(fs.readFileSync(resumePath, "utf-8"));

    // OpenAI prompt
    const prompt = `
You are a world-class professional resume writer, career strategist, and ATS expert. I will provide:  

1. A candidate’s **existing resume in JSON format**.  
2. A **job description (JD)** for a specific role.  

Your task is to **create a completely new resume** in JSON format that is **fully tailored to the JD**, using the existing resume only as a source of factual information (experience, roles, education, dates, locations). Do NOT simply rewrite or paraphrase the old resume—reconstruct the resume from scratch so that it:  

1. **Professional Summary:** Write a new 3–4 line summary that immediately hooks recruiters. Focus on top skills, leadership, domain expertise, and alignment with the JD.  
2. **Skills Section:**  
   - Include **all JD-required skills first**.  
   - Add as many relevant, current, in-demand skills as possible to maximize ATS keyword coverage.  
   - Organize skills logically  
3. **Experience Section:**  
   - Bullets must show measurable outcomes, business impact, and technical leadership.  
   - Emphasize **JD keywords and required skills**: technologies, frameworks, cloud, AI/ML, automation, security, performance, scalability, mentoring, CI/CD, serverless, APIs, etc.  
   - Include **AI/ML, cloud, and automation achievements** wherever relevant.  
   - Ensure **technology stacks are realistic for the time period** of each role.  
4. **Education Section:** Keep factual details from the original resume unless the JD highlights certifications or degrees.  
5. **ATS Optimization:** Use exact terminology from the JD for skills, technologies, and responsibilities. Avoid listing unrelated or outdated tech unless highly relevant.  
6. **Formatting:** Output **valid JSON only**, maintaining the same structure as the original resume. Do NOT include any extra text outside JSON.  
7. **Key Difference:** This must result in a **fully new resume**, not just a rewritten version. Every section (summary, skills, experience) must be reconstructed to **maximize alignment with the JD** and **showcase measurable impact**.  
8. In the summary and experience sections, **wrap all technical skills, tools, frameworks, programming languages, and cloud platforms** in <b> and </b> HTML tags (for example: <b>Python</b>, <b>TensorFlow</b>, <b>AWS</b>). Use plain text for everything else.
   example of detailed resume bullet with HTML tag: Designed and deployed end-to-end machine learning pipelines using <b>Python</b>, <b>TensorFlow</b>, and <b>MLflow</b> to automate model training, evaluation, and deployment, improving inference speed by 40% and reducing manual intervention through <b>Docker</b>-based MLOps workflows.

**Input:**  
Resume JSON: ${JSON.stringify(resumeJson)}
Job Description: ${jd}


**Output:**  
Return the **fully new, ATS-optimized resume JSON**, including:  
- A brand-new professional summary  
- A skills section with very much skills  
- Each job rewritten with **3–4 long, very detailed bullets**  
- Full alignment with JD, measurable achievements, and optimized for ATS
`;

    const aiResponse = await callOpenAI(prompt);
    let aiText = aiResponse.choices[0].message.content;
    aiText = aiText.replace(/```json|```/g, "").trim();
    const tailoredResume = robustJsonParse(aiText);

    // Compile HTML with Handlebars - use template that matches resume name
    const templateHtml = fs.readFileSync(
      path.join(process.cwd(), "templates", `${selected}.html`),
      "utf-8"
    );
    const template = Handlebars.compile(templateHtml);
    const html = template(tailoredResume);

    // Generate PDF


    const browser = await puppeteer.launch({
      args: chromium.args,
      executablePath: await chromium.executablePath(),
      headless: chromium.headless,
    });
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle0" });
    const pdfBuffer = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "10mm", bottom: "10mm", left: "10mm", right: "10mm" },
    });
    await browser.close();

    // Send PDF
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=${selected}_${company || "Company"}_${role || "Role"}.pdf`
    );
    res.send(pdfBuffer);

  } catch (err) {
    console.error("PDF generation or AI error:", err);
    res.status(500).send("PDF generation failed: " + err.message);
  }
}