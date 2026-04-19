const AR_UPSTREAM_URL = "https://iptv-epg.org/files/epg-ar.xml";

function buildCorsHeaders(contentType, contentEncoding) {
    const headers = new Headers();
    headers.set("content-type", contentType || "text/xml; charset=utf-8");
    headers.set("cache-control", "public, max-age=900");
    headers.set("access-control-allow-origin", "*");
    headers.set("access-control-allow-methods", "GET, OPTIONS");
    headers.set("access-control-allow-headers", "*");

    if (contentEncoding) {
        headers.set("content-encoding", contentEncoding);
    }

    return headers;
}

export async function onRequest(context) {
    if (context.request.method === "OPTIONS") {
        return new Response(null, {
            status: 204,
            headers: buildCorsHeaders("text/xml; charset=utf-8")
        });
    }

    if (context.request.method !== "GET") {
        return new Response("Method Not Allowed", {
            status: 405,
            headers: buildCorsHeaders("text/plain; charset=utf-8")
        });
    }

    const upstreamResponse = await fetch(AR_UPSTREAM_URL, {
        cf: {
            cacheTtl: 900,
            cacheEverything: true
        }
    });

    if (!upstreamResponse.ok) {
        return new Response(`Upstream error: ${upstreamResponse.status}`, {
            status: 502,
            headers: buildCorsHeaders("text/plain; charset=utf-8")
        });
    }

    const headers = buildCorsHeaders(
        upstreamResponse.headers.get("content-type"),
        upstreamResponse.headers.get("content-encoding")
    );

    return new Response(upstreamResponse.body, {
        status: 200,
        headers
    });
}
