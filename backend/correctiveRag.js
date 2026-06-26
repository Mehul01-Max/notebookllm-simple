const CHAT_MODEL = "openai/gpt-oss-20b:free";

async function improveQuery(openai, userQuery) {
  try {
    const response = await openai.chat.completions.create({
      model: CHAT_MODEL,
      messages: [
        {
          role: "system",
          content: "You are a Query Optimizer. Your job is to improve the user's search query to make it highly effective for retrieving relevant document chunks from a vector store. Output ONLY the optimized query. Do not include any explanation, conversational filler, quotes, or markdown format."
        },
        {
          role: "user",
          content: `Improve this search query for vector retrieval: "${userQuery}"`
        }
      ],
      temperature: 0.1,
    });
    const improved = response.choices[0].message.content.trim().replace(/^"|"$/g, '');
    console.log(`[CRAG] Improved query from "${userQuery}" to "${improved}"`);
    return improved;
  } catch (error) {
    console.error("[CRAG] Error in improveQuery:", error);
    return userQuery;
  }
}

async function gradeChunksRelevance(openai, query, chunks) {
  if (!chunks || chunks.length === 0) {
    return false;
  }

  const chunkText = chunks.map((c, i) => `[Chunk ${i + 1}]:\n${c.pageContent}`).join("\n\n");

  try {
    const response = await openai.chat.completions.create({
      model: CHAT_MODEL,
      messages: [
        {
          role: "system",
          content: "You are a Document Relevance Grader. Your job is to evaluate if the retrieved document chunks contain relevant and useful information to help answer the user's query.\n\nReply with exactly 'YES' if at least one chunk contains relevant information related to the user's query.\nReply with exactly 'NO' if none of the chunks are relevant to the user's query.\nDo not include any other text, reasoning, or formatting."
        },
        {
          role: "user",
          content: `User Query: ${query}\n\nRetrieved Chunks:\n${chunkText}`
        }
      ],
      temperature: 0.1,
    });

    const decision = response.choices[0].message.content.trim().toUpperCase();
    console.log(`[CRAG] Relevance grading decision: "${decision}"`);
    return decision.includes("YES");
  } catch (error) {
    console.error("[CRAG] Error in gradeChunksRelevance:", error);
    return true;
  }
}

async function reformulateQuery(openai, originalQuery, previousQuery, attempt) {
  try {
    const response = await openai.chat.completions.create({
      model: CHAT_MODEL,
      messages: [
        {
          role: "system",
          content: "You are a Query Reformulator. The previous search query failed to retrieve relevant documents. Your goal is to rewrite the query to look for the information from a different angle, utilizing synonyms, broader terms, or focusing on different keywords. Output ONLY the new reformulated query. Do not include any explanation, conversational filler, or quotes."
        },
        {
          role: "user",
          content: `Original User Query: "${originalQuery}"\nPrevious Failed Query: "${previousQuery}"\nAttempt count: ${attempt}\n\nReformulated Query:`
        }
      ],
      temperature: 0.3,
    });
    const reformulated = response.choices[0].message.content.trim().replace(/^"|"$/g, '');
    console.log(`[CRAG] Reformulated query for retry: "${reformulated}"`);
    return reformulated;
  } catch (error) {
    console.error("[CRAG] Error in reformulateQuery:", error);
    return originalQuery;
  }
}
export async function retrieveWithCorrectiveRAG(userQuery, vectorStore, openai) {
  const retriever = await vectorStore.asRetriever({
    k: 3,
  });

  const steps = [];
  let currentQuery = await improveQuery(openai, userQuery);
  steps.push(`Improved original query to: **"${currentQuery}"**`);

  let chunks = [];
  let isRelevant = false;
  const maxAttempts = 3;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    console.log(`[CRAG] Retrieval Attempt ${attempt}/${maxAttempts} with query: "${currentQuery}"`);
    chunks = await retriever.invoke(currentQuery);

    isRelevant = await gradeChunksRelevance(openai, userQuery, chunks);

    if (isRelevant) {
      steps.push(`**Attempt ${attempt}**: Retrieved ${chunks.length} chunks using query: *"${currentQuery}"*. Grade: ✅ **Relevant**.`);
      break;
    } else {
      steps.push(`**Attempt ${attempt}**: Retrieved ${chunks.length} chunks using query: *"${currentQuery}"*. Grade: ❌ **Not Relevant**.`);
      if (attempt < maxAttempts) {
        currentQuery = await reformulateQuery(openai, userQuery, currentQuery, attempt);
        steps.push(`Reformulated query to: **"${currentQuery}"** for attempt ${attempt + 1}.`);
      }
    }
  }

  const traceMarkdown = `
<details>
<summary>🔍 Corrective RAG Trace (${isRelevant ? "Success" : "Fallback"})</summary>

### RAG Steps:
${steps.map(step => `- ${step}`).join("\n")}

</details>
`;

  return { chunks, traceMarkdown };
}
