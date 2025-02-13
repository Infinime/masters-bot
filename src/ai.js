import { Ai } from '@cloudflare/ai';
async function getEmbeddings(query, env) {
    const ai = new Ai(env.AI);
    const res = await ai.run('@cf/baai/bge-base-en-v1.5', {text: query});
    const data = res.data
    // console.log("Generated embeddings:")
    // console.log(data[0])
    if (!data) {throw new Error('Failed to generate embeddings')};
    return data[0];
}

async function storeEmbeddings(id, embeddings, env) {
    const inserted = await env.VECTOR_INDEX.upsert([
        {
            id: id.toString(),
            values: embeddings,
        }
    ]);
    return {
        id: id.toString(),
        inserted
    };
}

async function searchEmbeddings(query, env) {
    try {
        const queryEmbeddings = await getEmbeddings(query, env);
        const SIMILARITY_THRESHOLD = 0.6; // Only documents greater than x% similarity

        const vectorQuery = await env.VECTOR_INDEX.query(queryEmbeddings, { topK: 5 });
        // console.log(vectorQuery)
        // Only return top 3 results.
        const vecIds = vectorQuery.matches
            .filter(vec => vec.score > SIMILARITY_THRESHOLD)
            .map(vec => vec.id);

        if (vecIds.length) {
            const query = `SELECT * FROM documents WHERE id IN (${vecIds.join(", ")})`;
            const { results } = await env.DOC_DB.prepare(query).bind().all();
            return results;
        } else {
            console.log("No Matching Vectors Found")
            return [];
        }
    } catch (e) {
        console.error(e);
        return [];
    }
}

export async function generateResponse(query, env) {
    const ai = new Ai(env.AI);

    // Get supporting documents
    const documents = await searchEmbeddings(query, env);
    const docContextMessage = documents.length
        ? `Context:\n${documents.map(doc => `PAGE ${doc.id - 1}:\n${doc.text}`).join("--------------------------------\n")}`
        : ""

    const systemPrompt = `You are serving as a biology teaching aid and you are helping an enthusiastic student to learn about the subject. The student needs a helpful assistant who is on point with fact-based answers to their questions at the grade 9 level. Assume they have a certain amount of familiarity with the subject - definitely enough to sniff out errors, but still need to be guided. The material provided to you is a lesson note used to teach the class which contains the following modules - one on the Conservation of Natural Resources, one on the Methods of disease/pest control, and one on the Reproductive systems of plants and animals. Each module is formatted thus: an introduction to the topic followed by a list of objectives each student is meant to complete during the course, the course content and a set of example theory and multichoice questions. *IMPORTANT: IT IS EXTREMELY CRUCIAL THAT YOU DO NOT DEVIATE FROM THE MATERIAL CONTEXT AND INSTRUCTIONS TO ANSWER THE STUDENT'S QUESTION.* Respond with a fact based answer based on the context provided. Make sure to be cordial and friendly with them! Also make sure to keep them engaged and interested in the subject, and try to approach them as a friendly elder professional. Try to keep it short as possible without losing any relevant information. Make sure never to mention that you are a professor - remember that the student thinks you are a teaching aide/AI model. The student is asking: '${query}'. Respond as a teacher in accordance with the instructions in the lesson notes.
    `

    console.log(systemPrompt)
    console.log(docContextMessage)

    return await ai.run(
        '@cf/meta/llama-2-7b-chat-int8',
        {
            messages: [
                { role: 'system', content: systemPrompt },
                ...(documents.length ? [{ role: 'system', content: `The following are the pages from the original document that are most similar to the provided query. Each page is separated by this string - '--------------------------------\n': PAGES SIMILAR TO QUERY INCLUDE ${docContextMessage}` }] : []),
                { role: 'user', content: query }
            ]
        }
    )

}
export async function processDocument(document, env) {
    // Store the document in D1 database
    const { results } = await env.DOC_DB.prepare("INSERT INTO documents (text) VALUES (?) RETURNING *")
        .bind(document)
        .run()

    const record = results.length ? results[0] : null

    // console.log("Record stored with ID", record.id)xx

    if (!record) throw new Error('Failed to store document');

    // Generate embeddings
    const embeddings = await getEmbeddings(document, env);

    // Store embeddings in Vector Index
    const { id, inserted } = await storeEmbeddings(record.id, embeddings, env);

    return { id, document, inserted };

}

export async function processImage(imageData, env) {
    // Store the image metadata in the database
    const { results } = await env.DOC_DB.prepare("INSERT INTO images (url, description) VALUES (?, ?) RETURNING *")
        .bind(imageData.url, imageData.description)
        .run();

    const record = results.length ? results[0] : null;

    if (!record) throw new Error('Failed to store image metadata');

    // Generate embeddings for image description
    const imageEmbeddings = await getEmbeddings(imageData.description, env);

    // Store image embeddings in Vector Index
    await storeImageEmbeddings(record.id, imageEmbeddings, env);

    return { id: record.id, inserted: true };
}

export async function processShare(shareData, env) {
    // Store the image metadata in the database
    const { results } = await env.DOC_DB.prepare("INSERT INTO share (created_by, chat_history, last_updated, password) VALUES (?, ?, ?, ?) RETURNING *")
        .bind(shareData.email, shareData.chatHistory, new Date().toISOString(), shareData.password)
        .run();

    const record = results.length ? results[0] : null;

    if (!record) throw new Error('Failed to share chat');

    return { id: record.id, inserted: true };
}

async function storeImageEmbeddings(id, embeddings, env) {
    const inserted = await env.IMAGE_INDEX.upsert([
        {
            id: id.toString(),
            values: embeddings,
        }
    ]);
    return {
        id: id.toString(),
        inserted
    };
}

async function searchImageEmbeddings(query, env) {
    try {
        const queryEmbeddings = await getEmbeddings(query, env);
        const SIMILARITY_THRESHOLD = 0.6; // Only documents greater than x% similarity

        const vectorQuery = await env.IMAGE_INDEX.query(queryEmbeddings, { topK: 5 });
        // console.log(vectorQuery)
        // Only return top 3 results.
        const vecIds = vectorQuery.matches
            .filter(vec => vec.score > SIMILARITY_THRESHOLD)
            .map(vec => vec.id);

        if (vecIds.length) {
            const query = `SELECT * FROM images WHERE id IN (${vecIds.join(", ")})`;
            const { results } = await env.DOC_DB.prepare(query).bind().all();
            return results;
        } else {
            console.log("No Matching Vectors Found")
            return [];
        }
    } catch (e) {
        console.error(e);
        return [];
    }
}

export async function relevantImages(query, env) {
    // convert the image vector id results to a html element
    const images = await searchImageEmbeddings(query, env);
    const imageElements = images.map(image => `<img src="${image.url}" alt="${image.description}" />`);
    return imageElements.join("\n");
}