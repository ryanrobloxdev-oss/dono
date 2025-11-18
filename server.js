import express from "express";
import fetch from "node-fetch";

const app = express();
app.use(express.json());

// Roblox-like wrapper for HttpService:GetAsync
async function GetAsync(url) {
    const res = await fetch(url, {
        method: "GET",
        headers: {
            "User-Agent": "Mozilla/5.0 RobloxGamepassBackend"
        }
    });

    if (!res.ok) {
        throw new Error(`HTTP ${res.status} on ${url}`);
    }

    return await res.json();
}

// simple throttle to avoid RoProxy ratelimits
function wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// --------------------------------------------------------
// ✔️ NEW 2025 METHOD: Fetch ALL gamepasses a user owns
// Uses catalog.roproxy.com API (does NOT 403 like /games/)
// --------------------------------------------------------

async function getUserCreatedGamepasses(userId) {
    const gamepasses = [];

    let cursor = "";
    let keepGoing = true;

    while (keepGoing) {
        const url = 
            `https://catalog.roproxy.com/v1/search/items?category=GamePass&creatorTargetId=${userId}&limit=30&cursor=${cursor}`;

        console.log("Requesting:", url);

        let data;
        try {
            data = await GetAsync(url);
        } catch (err) {
            console.error("Failed to retrieve gamepasses:", err);
            break;
        }

        if (!data || !data.data) break;

        for (const item of data.data) {
            if (item.product && item.product.price !== null) {
                gamepasses.push({
                    id: item.id,
                    price: item.product.price,
                    displayName: item.name,
                    assetType: "Gamepass"
                });
            }
        }

        // Pagination
        cursor = data.nextPageCursor;
        if (!cursor || cursor === "null") keepGoing = false;

        await wait(300); // anti-ratelimit
    }

    console.log("Total gamepasses found:", gamepasses.length);
    return gamepasses;
}

// --------------------------------------------------------
// ✔️ API endpoint for Roblox
// --------------------------------------------------------

app.get("/get-gamepasses/:userId", async (req, res) => {
    const userId = req.params.userId;

    try {
        const passes = await getUserCreatedGamepasses(userId);
        res.json({ success: true, data: passes });
    } catch (err) {
        console.error("Backend error:", err);
        res.status(500).json({
            success: false,
            error: err.toString()
        });
    }
});

// --------------------------------------------------------
// ✔️ Render.com will supply PORT as an environment variable
// --------------------------------------------------------

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Gamepass backend running on port ${PORT}`);
});

