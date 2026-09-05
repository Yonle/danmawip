const {
    BiliBiliFetcher,
    BiliBili,
} = require("../modules/dankomaconv.js");

const {
    PassThrough,
} = require("node:stream");

import {
    convertStreamAndDownload,
} from "../js/converter.js";

const {
    getCookie,
} = require("./js/bilicookiefetch.js");

function trimMsg(msg) {
    if (msg.length >= 62) {
        return msg.slice(0, 62) + "..."
    }

    return msg;
}

function loadTemplate(path) {
    return fetch(path)
        .then(response => {
            if (!response.ok) {
                throw new Error(
                    `Failed to load template: ${response.status} ${response.statusText}`,
                );
            }

            return response.text();
        })
        .then(html => {
            const template =
                document.createElement("template");

            template.innerHTML =
                html.trim();

            const overlay =
                template.content.firstElementChild;

            if (!overlay) {
                throw new Error(
                    `Template is empty: ${path}`,
                );
            }

            return overlay;
        });
}

function timestamp() {
    const d = new Date();

    return [
        d.getFullYear(),
        String(d.getMonth() + 1).padStart(2, "0"),
        String(d.getDate()).padStart(2, "0"),
    ].join("") + "-" + [
        String(d.getHours()).padStart(2, "0"),
        String(d.getMinutes()).padStart(2, "0"),
        String(d.getSeconds()).padStart(2, "0"),
    ].join("");
}

async function showCookieInstructions(message) {
    const overlay =
        await loadTemplate(
            "./templ/bilicookie.html",
        );

    const instructions =
        overlay.querySelector(
            "#biliCookieInstructions",
        );

    const continueButton =
        overlay.querySelector(
            "#biliCookieContinue",
        );

    const cancelButton =
        overlay.querySelector(
            "#biliCookieCancel",
        );

    if (
        !instructions ||
        !continueButton ||
        !cancelButton
    ) {
        throw new Error(
            "Bilibili cookie template is missing required elements.",
        );
    }

    instructions.textContent =
        message;

    overlay.hidden =
        false;

    document.body.appendChild(
        overlay,
    );

    return new Promise(resolve => {
        const cleanup = () => {
            overlay.remove();
        };

        continueButton.addEventListener(
            "click",
            () => {
                cleanup();
                resolve(true);
            },
            {
                once: true,
            },
        );

        cancelButton.addEventListener(
            "click",
            () => {
                cleanup();
                resolve(false);
            },
            {
                once: true,
            },
        );
    });
}

async function prepareBeforeGetCookie() {
    let message;

    switch (process.platform) {
        case "win32":
            message =
                "Dankoma needs to obtain your Bilibili cookies " +
                "from your Chromium-based browser.\n\n" +
                "1. Completely close your Chromium-based browser.\n\n" +
                "2. Open Task Manager and make sure there are no " +
                "background browser processes left.\n\n" +
                "3. Start your browser with:\n\n" +
                "   <your-browser.exe> --remote-debugging-port=9222\n\n" +
                "4. Come back here after the browser has started.\n\n" +
                "Press Continue to proceed.";
            break;

        case "darwin":
            message =
                "Dankoma needs to obtain your Bilibili cookies " +
                "from your Chromium-based browser.\n\n" +
                "1. Completely quit your Chromium-based browser.\n\n" +
                "2. Open Activity Monitor and make sure there are no " +
                "background browser processes left.\n\n" +
                "3. Start your browser with remote debugging enabled.\n\n" +
                "   Example:\n" +
                "   open -a \"Google Chrome\" --args --remote-debugging-port=9222\n\n" +
                "4. Come back here after the browser has started.\n\n" +
                "Press Continue to proceed.";
            break;

        case "linux":
            message =
                "Dankoma needs to obtain your Bilibili cookies " +
                "from your Chromium-based browser.\n\n" +
                "1. Completely close your Chromium-based browser.\n\n" +
                "2. Make sure there are no background browser processes left.\n\n" +
                "3. Start your browser with:\n\n" +
                "   <your-browser> --remote-debugging-port=9222\n\n" +
                "4. Come back here after the browser has started.\n\n" +
                "Press Continue to proceed.";
            break;

        default:
            throw new Error(
                `Unsupported platform: ${process.platform}`,
            );
    }

    const confirmed =
        await showCookieInstructions(
            message,
        );

    if (!confirmed) {
        throw new Error(
            "Chromium cookie acquisition cancelled.",
        );
    }
}

async function getCookies(status) {
    status.textContent =
        "Preparing Chromium connection...";

    await prepareBeforeGetCookie();

    status.textContent =
        "Reading Bilibili cookies from Chromium...";

    return getCookie();
}

export async function createBiliFetcher() {
    const overlay =
        await loadTemplate(
            "./templ/bilifetcher.html",
        );

    const videoInput =
        overlay.querySelector(
            "#biliVideoId",
        );

    const pageInput =
        overlay.querySelector(
            "#biliPage",
        );

    const legacyInput =
        overlay.querySelector(
            "#biliLegacy",
        );

    const fetchButton =
        overlay.querySelector(
            "#biliFetchButton",
        );

    const cancelButton =
        overlay.querySelector(
            "#biliFetchCancelButton",
        );

    const status =
        overlay.querySelector(
            "#biliFetchStatus",
        );

    if (
        !videoInput ||
        !pageInput ||
        !legacyInput ||
        !fetchButton ||
        !cancelButton ||
        !status
    ) {
        throw new Error(
            "Bilibili fetcher template is missing required elements.",
        );
    }

    overlay.hidden =
        false;

    document.body.appendChild(
        overlay,
    );

    let closed = false;

    const close = () => {
        if (closed) {
            return;
        }

        closed = true;
        overlay.remove();
    };

    cancelButton.addEventListener(
        "click",
        close,
    );

    fetchButton.addEventListener(
        "click",
        async () => {
            event.preventDefault();
            const videoId =
                videoInput.value.trim();

            const page =
                Number(
                    pageInput.value,
                );

            const legacyMode =
                legacyInput.checked;

            if (!videoId) {
                status.textContent =
                    "Please enter a video ID.";

                return;
            }

            if (
                !Number.isInteger(page) ||
                page < 1
            ) {
                status.textContent =
                    "Page must be a positive integer.";

                return;
            }

            fetchButton.disabled =
                true;

            cancelButton.disabled =
                true;

            try {
                const cookie =
                    await getCookies(
                        status,
                    );

                if (!cookie) {
                    throw new Error(
                        "No Bilibili cookie is available.",
                    );
                }

                const fetcher =
                    new BiliBiliFetcher({
                        onLog: message => {
                            status.textContent =
                                trimMsg(String(message));
                        },
                    });

                console.log("cookie:", cookie)

                fetcher.setCookie(
                    cookie,
                );

                const output = new BiliBili()

                /*
                 * Start consuming the output before fetching.
                 *
                 * This means we don't need to buffer the
                 * entire converted result in memory.
                 */
                const download =
                    convertStreamAndDownload(
                        "dankoma",
                        output,
                        legacyMode,
                        `bilibili-${videoId}-p${page}-${timestamp()}-danma.jsonl.gz`,
                        message => {
                            status.textContent =
                                trimMsg(message);
                        },
                    );

                await fetcher.fetch(
                    videoId,
                    output,
                    page,
                );

                await download;

                status.textContent =
                    "Done.";
            } catch (error) {
                status.textContent =
                    `Fetch failed: ${
                        error instanceof Error
                            ? error.message
                            : String(error)
                    }`;

                throw error
            } finally {
                fetchButton.disabled =
                    false;

                cancelButton.disabled =
                    false;
            }
        },
    );

    videoInput.focus();

    return {
        overlay,
        close,
    };
}