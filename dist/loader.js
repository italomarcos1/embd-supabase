"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_path_1 = __importDefault(require("node:path"));
const directory_1 = require("langchain/document_loaders/fs/directory");
const pdf_1 = require("langchain/document_loaders/fs/pdf");
const text_splitter_1 = require("langchain/text_splitter");
const supabase_1 = require("langchain/vectorstores/supabase");
const openai_1 = require("langchain/embeddings/openai");
const document_1 = require("langchain/document");
const supabase_js_1 = require("@supabase/supabase-js");
const truncateStringByBytes = (str, bytes) => {
    const enc = new TextEncoder();
    return new TextDecoder("utf-8").decode(enc.encode(str).slice(0, bytes));
};
const loader = new directory_1.DirectoryLoader(node_path_1.default.resolve(__dirname, '../tmp'), { '.pdf': path => new pdf_1.PDFLoader(path, { splitPages: true }) });
async function load() {
    const docs = await loader.load();
    const splitter = new text_splitter_1.TokenTextSplitter({
        encodingName: 'gpt2',
        chunkSize: 600,
        chunkOverlap: 0
    });
    const documentCollection = await Promise.all(docs.map(async ({ metadata, pageContent }) => await splitter.splitDocuments([
        new document_1.Document({
            pageContent,
            metadata: {
                source: metadata.source,
                page: metadata.loc.pageNumber,
                text: truncateStringByBytes(pageContent, 36000),
            },
        }),
    ])));
    console.log('done', documentCollection);
    const supabaseAdminClient = (0, supabase_js_1.createClient)("https://pjbwbxzmjjokvqfroxnn.supabase.co", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBqYndieHptampva3ZxZnJveG5uIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTY5MjAzNzkzMSwiZXhwIjoyMDA3NjEzOTMxfQ.wJSbKo9wKLBDGfvEQepqhqybfMITGrkHrk5C9ZhIa3I", {
        auth: { persistSession: false }
    });
    const embeddings = new openai_1.OpenAIEmbeddings({ openAIApiKey: "" });
    const store = new supabase_1.SupabaseVectorStore(embeddings, {
        client: supabaseAdminClient,
        tableName: "documents",
    });
    await Promise.all(documentCollection.map(async (documents) => {
        await store.addDocuments(documents);
    }));
}
load();
