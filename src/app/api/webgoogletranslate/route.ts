import { NextRequest, NextResponse } from "next/server";
import puppeteer from "puppeteer";

//仅支持本地运行，vercel 不支持 puppeteer
export async function POST(req: NextRequest) {
  try {
    const { text, targetLanguage, sourceLanguage } = await req.json();

    if (!text || !targetLanguage || !sourceLanguage) {
      return NextResponse.json({ error: "Missing required parameters" }, { status: 400 });
    }

    const browser = await puppeteer.launch({
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });
    const page = await browser.newPage();
    const translateURL = `https://translate.google.com/?sl=${sourceLanguage}&tl=${targetLanguage}&op=translate`;
    await page.goto(translateURL);

    // Input the text to be translated
    await page.type(".er8xn", text);
    await page.waitForSelector('span[jsname="W297wb"]', { timeout: 5000 });

    // Extract the translated text
    const translatedText = await page.evaluate(() => {
      const element = document.querySelector('span[jsname="W297wb"]');
      return element ? element.textContent : "";
    });

    await browser.close();

    return NextResponse.json({ translatedText });
  } catch (error) {
    console.error("Failed to translate text:", error);
    return NextResponse.json({ error: "Failed to translate text" }, { status: 500 });
  }
}
