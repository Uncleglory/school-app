export async function sendTelegramMessage(message: string) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!token || !chatId) {
    console.error(
      "Telegram not configured: missing TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID"
    );
    return { ok: false, error: "Telegram not configured" };
  }

  try {
    const response = await fetch(
      `https://api.telegram.org/bot${token}/sendMessage`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          chat_id: chatId,
          text: message,
          parse_mode: "HTML",
        }),
      }
    );

    const result = await response.json();

    if (!response.ok || !result?.ok) {
      console.error("Telegram API error:", {
        status: response.status,
        description: result?.description,
      });

      return {
        ok: false,
        error:
          result?.description ||
          `Telegram API returned HTTP ${response.status}`,
      };
    }

    console.log("Telegram message sent successfully");
    return { ok: true };
  } catch (error) {
    console.error("Telegram request failed:", error);
    return { ok: false, error: "Telegram request failed" };
  }
}
