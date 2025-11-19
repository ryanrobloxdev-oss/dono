import express from "express";
import fetch from "node-fetch";

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// Simple GET helper with error handling
async function GetAsync(url) {
  const res = await fetch(url, {
    method: "GET",
    headers: {
      "User-Agent": "Roblox-Gamepass-Backend"
    }
  });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} on ${url}`);
  }
  return await res.json();
}

// Throttle helper
const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Fetch all gamepasses for a user
async function getUserCreatedGamepasses(userId) {
  const gamepasses = [];

  // 1️⃣ Fetch all games/universes for this user
  let gamesUrl = `https://games.roproxy.com/v2/users/${userId}/games?accessFilter=2&limit=50&sortOrder=Asc`;
  let gamesData;
  try {
    gamesData = await GetAsync(gamesUrl);
  } catch (err) {
    console.error("Failed to fetch user games:", err);
    return [];
  }

  if (!gamesData || !gamesData.data) return [];

  // 2️⃣ For each universe/game, fetch gamepasses using the new API
  for (const game of gamesData.data) {
    const universeId = game.id;
    const passesUrl = `https://apis.roblox.com/game-passes/v1/universes/${universeId}/game-passes?passView=Full&pageSize=100`;

    console.log("Requesting gamepasses for universe", universeId, passesUrl);

    let passData;
    try {
      passData = await GetAsync(passesUrl);
    } catch (err) {
      console.warn(`Failed to get gamepasses for universe ${universeId}, err:`, err);
      continue; // skip universe if it fails
    }

    // 3️⃣ Process the returned gamepasses
    if (passData && passData.gamePasses) {
      for (const pass of passData.gamePasses) {
        // Include only if it has a price or is for sale
        const price = pass.price ?? 0;
        gamepasses.push({
          id: pass.id,
          price: price,
          displayName: pass.displayName || pass.name,
          assetType: "Gamepass"
        });
      }
    }

    await wait(200); // throttling to prevent spamming Roblox API
  }

  // 4️⃣ Deduplicate gamepasses
  const unique = {};
  const deduped = [];
  for (const gp of gamepasses) {
    if (!unique[gp.id]) {
      unique[gp.id] = true;
      deduped.push(gp);
    }
  }

  console.log("Total gamepasses found:", deduped.length);
  return deduped;
}

// API endpoint
app.get("/get-gamepasses/:userId", async (req, res) => {
  const userId = req.params.userId;

  try {
    const passes = await getUserCreatedGamepasses(userId);
    res.json({ success: true, data: passes });
  } catch (err) {
    console.error("Server error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

app.listen(PORT, () => console.log(`Server listening on port ${PORT}`));
