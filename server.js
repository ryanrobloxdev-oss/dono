import express from "express";
import fetch from "node-fetch";

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

/* ------------------------- HELPER FUNCTIONS ------------------------- */

async function GetAsync(url) {
    const res = await fetch(url, {
        method: "GET",
        headers: {
            "User-Agent": "Roblox-Gamepass-Fetcher"
        }
    });

    if (!res.ok) {
        throw new Error(`HTTP ${res.status} on ${url}`);
    }

    return await res.json();
}

const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/* --------------------- MAIN GAMEPASS FETCH FUNCTION --------------------- */

async function getUserCreatedGamepasses(userId) {
    const gamepasses = [];

    let cursor = null;
    let keepGoing = true;

    while (keepGoing) {
        const cursorParam = cursor ? `&cursor=${cursor}` : "";

        const url =
            `https://catalog.roproxy.com/v1/search/items?category=GamePass` +
            `&creatorType=User&creatorTargetId=${userId}` +
            `&limit=30${cursorParam}`;

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

        cursor = data.nextPageCursor;
        keepGoing = cursor != null;

        await wait(200);
    }

    console.log("Total gamepasses found:", gamepasses.length);
    return gamepasses;
}

/* ----------------------------- EXPRESS ENDPOINT ----------------------------- */

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

/* ------------------------------- START SERVER ------------------------------- */

app.listen(PORT, () => {
    console.log(`Backend running on port ${PORT}`);
});

