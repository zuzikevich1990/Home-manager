import { createHmac, timingSafeEqual } from "node:crypto";

const allowedWidgets = new Set(["watch", "cactus"]);
const widgetLabels = {
  watch: "Что смотрим",
  cactus: "Кактус",
};

export default async function handler(request, response) {
  response.setHeader("Content-Type", "application/json; charset=utf-8");

  const authResult = authenticateTelegram(request);

  if (!authResult.ok) {
    response.statusCode = authResult.status;
    response.end(JSON.stringify({ error: authResult.error }));
    return;
  }

  try {
    if (request.method === "GET") {
      const notes = await supabaseRequest("/rest/v1/notes?select=*&order=created_at.desc");
      response.statusCode = 200;
      response.end(JSON.stringify(notes.map(mapRemoteNote)));
      return;
    }

    if (request.method === "POST") {
      const body = await readJson(request);
      const widgetId = String(body.widgetId || "");
      const text = String(body.text || "").trim();

      if (!allowedWidgets.has(widgetId) || !text) {
        response.statusCode = 400;
        response.end(JSON.stringify({ error: "Invalid note payload" }));
        return;
      }

      const [note] = await supabaseRequest("/rest/v1/notes?select=*", {
        method: "POST",
        body: JSON.stringify({
          widget_id: widgetId,
          widget_label: widgetLabels[widgetId],
          text,
          telegram_user_id: authResult.user.id,
          telegram_first_name: authResult.user.first_name || null,
        }),
        headers: {
          Prefer: "return=representation",
        },
      });

      response.statusCode = 201;
      response.end(JSON.stringify(mapRemoteNote(note)));
      return;
    }

    if (request.method === "DELETE") {
      const url = new URL(request.url || "/", "https://home-manager.local");
      const noteId = url.searchParams.get("id");

      if (!isUuid(noteId)) {
        response.statusCode = 400;
        response.end(JSON.stringify({ error: "Invalid note id" }));
        return;
      }

      await supabaseRequest(`/rest/v1/notes?id=eq.${noteId}`, {
        method: "DELETE",
      });

      response.statusCode = 204;
      response.end();
      return;
    }

    response.statusCode = 405;
    response.end(JSON.stringify({ error: "Method not allowed" }));
  } catch (error) {
    console.error(error);
    response.statusCode = 500;
    response.end(JSON.stringify({ error: "Server error" }));
  }
}

function authenticateTelegram(request) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const initData = request.headers["x-telegram-init-data"];

  if (!botToken) {
    return { ok: false, status: 500, error: "Telegram bot token is not configured" };
  }

  if (!initData || Array.isArray(initData)) {
    return { ok: false, status: 401, error: "Telegram init data is missing" };
  }

  const verification = verifyInitData(initData, botToken);

  if (!verification.ok) {
    return { ok: false, status: 401, error: verification.error };
  }

  const allowedIds = parseAllowedIds(process.env.ALLOWED_TELEGRAM_IDS || "");

  if (!allowedIds.has(String(verification.user.id))) {
    return {
      ok: false,
      status: 403,
      error: `Access denied for Telegram user ID ${verification.user.id}`,
    };
  }

  return {
    ok: true,
    user: verification.user,
  };
}

function verifyInitData(initData, botToken) {
  const params = new URLSearchParams(initData);
  const hash = params.get("hash");

  if (!hash) {
    return { ok: false, error: "Telegram hash is missing" };
  }

  params.delete("hash");

  const dataCheckString = [...params.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");

  const secretKey = createHmac("sha256", "WebAppData").update(botToken).digest();
  const calculatedHash = createHmac("sha256", secretKey).update(dataCheckString).digest("hex");

  if (!safeEqual(hash, calculatedHash)) {
    return { ok: false, error: "Telegram signature is invalid" };
  }

  const authDate = Number(params.get("auth_date") || 0);
  const maxAgeSeconds = 60 * 60 * 24;

  if (!authDate || Date.now() / 1000 - authDate > maxAgeSeconds) {
    return { ok: false, error: "Telegram session is expired" };
  }

  try {
    const user = JSON.parse(params.get("user") || "{}");

    if (!user.id) {
      return { ok: false, error: "Telegram user is missing" };
    }

    return { ok: true, user };
  } catch {
    return { ok: false, error: "Telegram user is invalid" };
  }
}

function safeEqual(left, right) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

function parseAllowedIds(value) {
  return new Set(
    value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean),
  );
}

async function supabaseRequest(path, options = {}) {
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Supabase server environment is not configured");
  }

  const headers = {
    apikey: serviceRoleKey,
    Authorization: `Bearer ${serviceRoleKey}`,
    "Content-Type": "application/json",
    ...(options.headers || {}),
  };

  const result = await fetch(`${supabaseUrl}${path}`, {
    ...options,
    headers,
  });

  if (!result.ok) {
    throw new Error(`Supabase request failed: ${result.status}`);
  }

  if (result.status === 204) {
    return null;
  }

  return result.json();
}

function readJson(request) {
  return new Promise((resolve, reject) => {
    let data = "";

    request.on("data", (chunk) => {
      data += chunk;
    });

    request.on("end", () => {
      try {
        resolve(data ? JSON.parse(data) : {});
      } catch (error) {
        reject(error);
      }
    });

    request.on("error", reject);
  });
}

function mapRemoteNote(note) {
  return {
    id: note.id,
    widgetId: note.widget_id,
    text: note.text,
    createdAt: note.created_at,
    author: note.telegram_first_name,
  };
}

function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value || "",
  );
}
