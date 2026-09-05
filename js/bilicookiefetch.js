import { create } from "../../modules/cdebug/index.js";

const COOKIE_NAMES = new Set([
    "SESSDATA",
    "bili_jct",
    "DedeUserID",
]);

function cookiesToHeader(cookies) {
    return cookies
        .filter(cookie =>
            COOKIE_NAMES.has(
                cookie.name,
            ),
        )
        .map(
            cookie =>
                `${cookie.name}=${cookie.value}`,
        )
        .join("; ");
}

export async function getCookie() {
    const cdebug =
        await create();

    try {
        const { cookies } =
            await cdebug.rpc(
                "Storage.getCookies",
                {
                    urls: [
                        "https://api.bilibili.com/",
                    ],
                },
            );

        return cookiesToHeader(
            cookies,
        );
    } finally {
        cdebug.close();
    }
}