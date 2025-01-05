import { Ai } from '@cloudflare/ai';

async function getEmbeddings(text, env) {
    const ai = new Ai(env.AI);
    const { data } = await ai.run('@cf/baai/bge-base-en-v1.5', { text });

    if (!data[0]) throw new Error('Failed to generate embeddings');
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
    }
}

async function searchEmbeddings(query, env) {
    try {
        const queryEmbeddings = await getEmbeddings(query, env);
        console.log(queryEmbeddings)
        const SIMILARITY_THRESHOLD = 0.001; // Only documents greater than 0.1% similarity

        const vectorQuery = await env.VECTOR_INDEX.query(queryEmbeddings, { topK: 4});
        // Only return top 5 results.
        const vecIds = vectorQuery.matches
            .filter(vec => vec.score > SIMILARITY_THRESHOLD)
            .map(vec => vec.vectorId);

        if (vecIds.length) {
          const query = `SELECT * FROM documents WHERE id IN (${vecIds.join(", ")})`;
          const { results } = await env.DOC_DB.prepare(query).bind().all()
          return results.map(vec => vec.text)
        }

        return [];

    } catch (error) {
        console.error("An error occurred:", error);
        return [];
    }
}

export async function generateResponse(query, env) {
    const ai = new Ai(env.AI);

    console.log(query)

    // Get supporting documents
    const documents = await searchEmbeddings(query, env);

    const contextMessage = documents.length
        ? `Context:\n${documents.map(doc => `${doc}`).join("--------------------------------\n")}`
        : ""

    const systemPrompt = `You are play-acting as a professor of biology and you are helping an enthusiastic student to learn about the subject. The student needs a helpful assistant who is on point with fact-based answers to their questions at the grade 11 level. Assume they have a certain amount of familiarity with the subject - definitely enough to sniff out errors, but still need to be guided. The material provided to you is a lesson note used to teach the class which contains two modules - one on the Conservation of Natural Resources and one on the Reproductive systems of plants and animals. Each module is formatted thus: an introduction to the topic followed by a list of objectives each student is meant to complete during the course, the course content and a set of example theory and multichoice questions. IMPORTANT: IT IS EXTREMELY CRUCIAL THAT YOU DO NOT DEVIATE FROM THE MATERIAL EXCEPT WHEN ABSOLUTELY NECESSARY TO ANSWER THE STUDENT'S QUESTION. The student is asking: '${query}'. Respond with a fact based answer based on the context provided. Make sure to be cordial and friendly with them! Also make sure to keep them engaged and interested in the subject, and try to approach them as a friend! Make sure never to mention that you are a professor - remember that the student thinks you are an AI model.
    `

    console.log(systemPrompt)
    console.log(contextMessage)

    return await ai.run(
        '@cf/meta/llama-2-7b-chat-int8',
        {
            messages: [
                { role: 'system', content: systemPrompt },
                ...(documents.length ? [{ role: 'system', content: contextMessage }] : []),
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

    console.log("Record stored with ID", record.id)

    if (!record) throw new Error('Failed to store document');

    // Generate embeddings
    const embeddings = await getEmbeddings(document, env);

    // Store embeddings in Vector Index
    const { id, inserted } = await storeEmbeddings(record.id, embeddings, env);

    return { id, document, inserted };

}