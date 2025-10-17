import fs from "fs";
import path from "path";
import Handlebars from "handlebars";
import { executablePath, args, defaultViewport, headless } from "@sparticuz/chromium";
import puppeteer from "puppeteer-core";
import OpenAI from "openai";
import { parse } from "jsonc-parser";


console.log("Chromium path:", await executablePath());
console.log("Puppeteer version:", puppeteer.version());

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
You are a professional resume writer and career expert. Your task is to tailor the given resume to match the provided job description.

Rules:
1. Write 7-8 long, results-driven bullets for each job experience.
2. Include AI/ML, Cloud, and Automation experience.
3. Rewrite the summary as a 4-line professional summary that hooks a recruiter in under 10 seconds.
4. Include a comprehensive, relevant skills section.
5. Optimize the resume for ATS (Applicant Tracking Systems).
6. Tailor each section to match the language and keywords in the job description.
7. Rephrase experience to highlight impact, results, and transferable skills using action verbs and quantifiable outcomes.
8. Ensure technologies match the correct time periods (e.g., .NET → Azure, SQL Server, EF, Azure Functions; Go → Cloud-native, gRPC, Prometheus, Grafana; Java → Spring, JUnit, Jenkins; Python → AI/ML, Django/FastAPI, Celery, SageMaker/Vertex AI; PHP → Laravel/Symfony; JS → Node.js/React/Next.js; Ruby → Rails, Heroku, Sidekiq).
9. I want much and much skills as possible, so you can add more skills to the resume.

Important: Only output valid JSON in the same structure(except skills-group names and skills themselves) as the original resume. No extra text.

Resume: ${JSON.stringify(resumeJson)}
Job Description: ${jd}
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

    const isVercel = !!process.env.VERCEL_ENV;
    let browser;

    if (isVercel) {
      browser = await puppeteer.launch({
        args,
        defaultViewport,
        executablePath: await executablePath(),
        headless,
      });
    } else {
      const puppeteerFull = await import("puppeteer");
      browser = await puppeteerFull.launch({ headless: true });
    }

    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle0" });
    const pdfBuffer = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: {
        top: "5mm",
        bottom: "10mm",
        left: "10mm",
        right: "10mm"
      }
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