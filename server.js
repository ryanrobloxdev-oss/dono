import express from "express";
import fetch from "node-fetch";

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

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

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function getUserCreatedGamepasses(userId) {
    const gamepasses = [];

    // 1️⃣ Fetch all games/universes for the user
    let gamesUrl = `https://games.roproxy.com/v2/users/${userId}/games?accessFilter=2&limit=50&sortOrder=Asc`;
    let gamesData;
    try {
        gamesData = await GetAsync(gamesUrl);
    } catch (err) {
        console.error("Failed to fetch user games:", err);
        return [];
    }

    if (!gamesData || !gamesData.data) return [];

    // 2️⃣ For each game, fetch its gamepasses via new API
    for (const game of gamesData.data) {
        const universeId = game.id;

        const passesUrl =
            `https://apis.roblox.com/game-passes/v1/universes/` +
            `${universeId}/game-passes?passView=Full&pageSize=100`;

        console.log("Requesting gamepasses for game/universe", universeId, passesUrl);

        let passData;
        try {
            passData = await GetAsync(passesUrl);
        } catch (err) {
            console.warn(`Failed to get gamepasses for universe ${universeId}, err:`, err);

            // Optionally fallback to catalog search for this user/game
            // (but skip fallback in this example for simplicity)
            continue;
        }

        if (passData && passData.data) {
            for (const pass of passData.data) {
                // `pass` object structure comes from Roblox API, adjust if needed
                gamepasses.push({
                    id: pass.id,
                    price: pass.price,
                    displayName: pass.name,
                    assetType: "Gamepass"
                });
            }
        }

        await wait(200); // throttle
    }

    // 3️⃣ Optionally dedupe
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
