import "dotenv/config";
import express from "express";
import { OpenAI } from "openai";
import cors from "cors";
import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf";
import { OpenAIEmbeddings } from "@langchain/openai";
import { QdrantVectorStore } from "@langchain/qdrant";
import multer from "multer";

const app = express();
const upload = multer({ dest: "uploads/" });
app.use(express.json());
app.use(cors({}));


const openai = new OpenAI({
  apiKey: process.env.OPENROUTER_API_KEY,
  baseURL: "https://openrouter.ai/api/v1",
});

const embeddings = new OpenAIEmbeddings({
  apiKey: process.env.OPENROUTER_API_KEY,
  model: "nvidia/llama-nemotron-embed-vl-1b-v2:free",
  encodingFormat: "float",
  configuration: {
    baseURL: "https://openrouter.ai/api/v1",
    ...(process.env.OPENROUTER_HTTP_REFERER
      ? {
        defaultHeaders: {
          "HTTP-Referer": process.env.OPENROUTER_HTTP_REFERER,
        },
      }
      : {}),
  },
});

const messages = []
async function indexing(filePath) {
  const loader = new PDFLoader(filePath);
  const docs = await loader.load();

  const vectorStore = await QdrantVectorStore.fromDocuments(docs, embeddings, {
    collectionName: "notebook",
    url: process.env.DATABASE_URL,
    apiKey: process.env.DATABASE_API,
  });



  console.log("indexing completed");
}




async function retrival(userQuery) {


  const vectorStore = await QdrantVectorStore.fromExistingCollection(
    embeddings,
    {
      collectionName: "notebook",
      url: process.env.DATABASE_URL,
      apiKey: process.env.DATABASE_API,
    },
  );

  const retrival = await vectorStore.asRetriever({
    k: 3,
  });

  const searchedChunks = await retrival.invoke(userQuery);

  messages.push({
    role: 'user', content: `
        Use the following pieces of context to answer the question. If you don't know the answer, just say that you don't know. Don't try to make up an answer.

        Context: ${JSON.stringify(searchedChunks)}
        Question: ${userQuery}`
  });

  const response = await openai.chat.completions.create({
    model: "openai/gpt-oss-20b:free",
    messages: messages,
  });
  return response.choices[0].message.content;
}

app.post("/upload", upload.single("file"), async (req, res) => {
  const filePath = req.file.path;
  await indexing(filePath);
  res.send("uploaded");
});

app.post("/chat", async (req, res) => {
  const { userQuery } = req.body;
  const answer = await retrival(userQuery);
  res.json({ answer });
})

app.listen(3000, () => {
  console.log("listening to port 3000");
});
