//
// index.js
//
import { getAssetFromKV, NotFoundError, MethodNotAllowedError } from '@cloudflare/kv-asset-handler'
import { processDocument, generateResponse, processShare, relevantImages} from './ai';
import manifestJSON from '__STATIC_CONTENT_MANIFEST';
const assetManifest = JSON.parse(manifestJSON);

// Router
export default {
	async fetch(request, env, ctx) {
		const url = new URL(request.url);
		const [, rootPath, action] = url.pathname.split('/');

		switch (rootPath) {
			case "doc":
				if (action === "add" && request.method === "POST") {
					// POST /doc/add
					/* return new Response("I have disabled adding documents.", {
					  status: 400
					})*/
					return handleAddDocument(request, env);
				 }
				break;
			case "image":
				if (action === "add" && request.method === "POST") {
					// POST /image/add
					return handleAddImage(request, env);
				}
				break;
			case "api":
				if (action === "chat" && request.method === "GET") {
					// GET /api/chat?query=What drinks can I make with vodka.
					return handleChatQuery(url, env);
				}
				if (action === "image" && request.method === "GET") {
					// GET /api/image?query=What drinks can I make with vodka.
					return handleImageQuery(url, env);
				}
				if (action === "share" && request.method === "POST") {
					// POST /api/share
					return handleShare(request, env);
				}
				if (action === "update" && request.method === "POST") {
					// POST /api/share
					return updateShare(request, env);
				}
				if (action === "share" && request.method === "GET") {
					// GET /api/share?id=123
					return handleShareQuery(url, env);
				}
				break;
			default:
				return handlePublic(request, env, ctx);
		}
	}
};

// Route handlers
async function handleAddDocument(request, env) {
	const { data } = await request.json();
	const { id, inserted } = await processDocument(data, env);
	return new Response(JSON.stringify({ id, inserted }), {
		headers: { "Content-Type": "application/json" },
		status: 200
	});
}

async function handleAddImage(request, env) {
    const { data } = await request.json();
    const { id, inserted } = await processImage(data, env);
    return new Response(JSON.stringify({ id, inserted }), {
        headers: { "Content-Type": "application/json" },
        status: 200
    });
}
async function handleChatQuery(url, env) {
	const query = url.searchParams.get("query");
	const response = await generateResponse(query, env);
	return new Response(JSON.stringify(response), {
		headers: { "Content-Type": "application/json" },
		status: 200
	});
}

async function handleImageQuery(url, env) {
	const id = url.searchParams.get("query");
	const response = await relevantImages(id, env);
	const imageElements = await relevantImages(id, env);
	return new Response(imageElements, {
		headers: { "Content-Type": "text/html" },
		status: 200
	});
}

async function handleShare(request, env) {
    try {
        const contentType = request.headers.get('Content-Type') || '';
        if (!contentType.includes('application/json')) {
            return new Response('Invalid Content-Type', { status: 400 });
        }

        const data = await request.json();

        if (!data) {
            return new Response('Invalid JSON body', { status: 400 });
        }

        const { id, inserted } = await processShare(data, env);
        return new Response(JSON.stringify({ id, inserted }), {
            headers: { "Content-Type": "application/json" },
            status: 200
        });
    } catch (error) {
        console.error('Error parsing request body:', error);
        return new Response('Internal Server Error', { status: 500 });
    }
}

async function handleShareQuery(url, env) {
	const id = url.searchParams.get("id");
	const { results } = await env.DOC_DB.prepare("SELECT * FROM share WHERE id = ?")
		.bind(id)
		.all();

	if (!results.length) {
		return new Response("Share not found", { status: 404 });
	}

	const share = results[0];
	return new Response(JSON.stringify(share), {
		headers: { "Content-Type": "application/json" },
		status: 200
	});

}

async function updateShare(request, env) {
	const data  = await request.json();
	const { results } = await env.DOC_DB.prepare("UPDATE share SET chat_history = ?, last_updated = ? WHERE id = ? RETURNING *")
		.bind(data.chatHistory, new Date().toISOString(), data.id)
		.all();

	if (!results.length) {
		return new Response("Share not found", { status: 404 });
	}

	const share = results[0];
	return new Response(JSON.stringify(share), {
		headers: { "Content-Type": "application/json" },
		status: 200
	});
}

async function handlePublic(request, env, ctx) {
	try {
		return await getAssetFromKV(
			{
				request,
				waitUntil: ctx.waitUntil.bind(ctx),
			},
			{
				ASSET_NAMESPACE: env.__STATIC_CONTENT,
				ASSET_MANIFEST: assetManifest,
			}
		);
	} catch (e) {
		if (e instanceof NotFoundError) {
			return new Response('The page was not found.', { status: 404 })
		} else if (e instanceof MethodNotAllowedError) {
			return new Response('The method was not allowed.', { status: 405 })
		} else {
			console.error(e)
			return new Response('An unexpected error occurred', { status: 500 })
		}
	}
}