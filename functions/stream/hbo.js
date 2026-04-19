const HBO_UPSTREAM_PREFIX = "http://8.243.126.131:8000/play/a0f4/";
const PROXY_PATH = "/stream/hbo";

function buildHeaders(contentType) {
    const headers = new Headers();
    headers.set("content-type", contentType || "application/octet-stream");
    headers.set("cache-control", "no-store");
    headers.set("access-control-allow-origin", "*");
    headers.set("access-control-allow-methods", "GET, OPTIONS");
    headers.set("access-control-allow-headers", "*");
    return headers;
}

function isAllowedUpstream(url) {
    return (
        url.protocol === "http:" &&
        url.hostname === "8.243.126.131" &&
        url.port === "8000" &&
        url.pathname.startsWith("/play/a0f4/")
    );
}

function rewritePlaylist(playlistText, upstreamUrl, requestOrigin) {
    const lines = playlistText.split("\n");
    const rewrittenLines = lines.map((line) => {
        const trimmed = line.trim();

        if (!trimmed || trimmed.startsWith("#")) {
            return line;
        }

        let absoluteUrl;
        try {
            absoluteUrl = new URL(trimmed, upstreamUrl).toString();
        } catch {
            return line;
        }

        if (!absoluteUrl.startsWith(HBO_UPSTREAM_PREFIX)) {
            return line;
        }

        const proxied = `${requestOrigin}${PROXY_PATH}?url=${encodeURIComponent(absoluteUrl)}`;
        return line.replace(trimmed, proxied);
    });

    return rewrittenLines.join("\n");
}

export async function onRequest(context) {
    if (context.request.method === "OPTIONS") {
        return new Response(null, {
            status: 204,
            headers: buildHeaders("text/plain; charset=utf-8")
        });
    }

    if (context.request.method !== "GET") {
        return new Response("Method Not Allowed", {
            status: 405,
            headers: buildHeaders("text/plain; charset=utf-8")
        });
    }

    const requestUrl = new URL(context.request.url);
    const targetParam = requestUrl.searchParams.get("url") || `${HBO_UPSTREAM_PREFIX}index.m3u8`;

    let upstreamUrl;
    try {
        upstreamUrl = new URL(targetParam);
    } catch {
        return new Response("Invalid upstream URL", {
            status: 400,
            headers: buildHeaders("text/plain; charset=utf-8")
        });
    }

    if (!isAllowedUpstream(upstreamUrl)) {
        return new Response("Blocked upstream URL", {
            status: 403,
            headers: buildHeaders("text/plain; charset=utf-8")
        });
    }

    const upstreamHeaders = new Headers();
    const rangeHeader = context.request.headers.get("range");
    if (rangeHeader) {
        upstreamHeaders.set("range", rangeHeader);
    }

    const upstreamResponse = await fetch(upstreamUrl.toString(), {
        headers: upstreamHeaders
    });

    if (!upstreamResponse.ok && upstreamResponse.status !== 206) {
        return new Response(`Upstream error: ${upstreamResponse.status}`, {
            status: 502,
            headers: buildHeaders("text/plain; charset=utf-8")
        });
    }

    const contentType = upstreamResponse.headers.get("content-type") || "application/octet-stream";
    const isPlaylist = upstreamUrl.pathname.endsWith(".m3u8") || contentType.toLowerCase().includes("mpegurl");

    if (isPlaylist) {
        const playlistText = await upstreamResponse.text();
        const rewrittenPlaylist = rewritePlaylist(playlistText, upstreamUrl.toString(), requestUrl.origin);

        return new Response(rewrittenPlaylist, {
            status: upstreamResponse.status,
            headers: buildHeaders("application/vnd.apple.mpegurl")
        });
    }

    const responseHeaders = buildHeaders(contentType);
    const contentLength = upstreamResponse.headers.get("content-length");
    const contentRange = upstreamResponse.headers.get("content-range");
    if (contentLength) {
        responseHeaders.set("content-length", contentLength);
    }
    if (contentRange) {
        responseHeaders.set("content-range", contentRange);
    }

    return new Response(upstreamResponse.body, {
        status: upstreamResponse.status,
        headers: responseHeaders
    });
}
