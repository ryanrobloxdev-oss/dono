import express from "express";
import fetch from "node-fetch";

const app = express();
app.use(express.json());

// wrapper like Roblox HttpService:GetAsync
async function GetAsync(url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status} on ${url}`);
    return await res.json();
}

function wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// ----------------------------
// MAIN FUNCTION
// ----------------------------

async function getUserCreatedGamepasses(userId) {
    const gamepasses = [];

    const GetGamesUrl =
        `https://games.roproxy.com/v2/users/${userId}/games?accessFilter=2&limit=50&sortOrder=Asc`;

    let gameData;
    try {
        gameData = await GetAsync(GetGamesUrl);
    } catch (err) {
        console.error("Failed to retrieve user's games:", err);
        return [];
    }

    if (gameData && gameData.data) {
        console.log("Game data:", gameData);

        for (const GameInfo of gameData.data) {
            const gameId = GameInfo.id;

            const GamepassURL =
                `https://games.roproxy.com/v1/games/${gameId}/game-passes?limit=100&sortOrder=Asc`;

            await wait(500); // anti-403 throttle

            let gamepassData;
            try {
                gamepassData = await GetAsync(GamepassURL);
            } catch (err) {
                console.error("Failed to retrieve game passes:", err);
                continue;
            }

            if (gamepassData && gamepassData.data) {
                console.log("Gamepass data:", gamepassData);

                for (const detail of gamepassData.data) {
                    if (detail.price) {
                        gamepasses.push({
                            id: detail.id,
                            price: detail.price,
                            displayName: detail.displayName,
                            assetType: "Gamepass"
                        });
                    }
                }
            }
        }
    }

    return gamepasses;
}

// ----------------------------
// API ENDPOINT FOR ROBLOX
// ----------------------------

app.get("/get-gamepasses/:userId", async (req, res) => {
    const userId = req.params.userId;

    try {
        const passes = await getUserCreatedGamepasses(userId);
        res.json({ success: true, data: passes });
    } catch (err) {
        console.error(err);
        res.status(500).json({
            success: false,
            error: err.toString()
        });
    }
});

// ----------------------------
// START SERVER (Render uses PORT)
// ----------------------------

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Backend running on port ${PORT}`);
});
