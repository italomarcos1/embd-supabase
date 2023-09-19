import path from 'node:path'

import { DirectoryLoader } from 'langchain/document_loaders/fs/directory'
import { PDFLoader } from 'langchain/document_loaders/fs/pdf'
import { TokenTextSplitter } from 'langchain/text_splitter'
import { SupabaseVectorStore } from 'langchain/vectorstores/supabase'
import { OpenAIEmbeddings } from 'langchain/embeddings/openai'
import { Document } from "langchain/document";
import { createClient } from "@supabase/supabase-js";
import { Database } from './types'

const truncateStringByBytes = (str: string, bytes: number) => {
  const enc = new TextEncoder();
  return new TextDecoder("utf-8").decode(enc.encode(str).slice(0, bytes));
};

const loader = new DirectoryLoader(
  path.resolve(__dirname, '../tmp'),
  { '.pdf': path => new PDFLoader(path, { splitPages: true }) }
)

async function load() {
  const docs = await loader.load()

  const splitter = new TokenTextSplitter({
    encodingName: 'gpt2',
    chunkSize: 600,
    chunkOverlap: 0
  })

  const documentCollection = await Promise.all(
    docs.map(async ({ metadata, pageContent }) => 
      await splitter.splitDocuments([
        new Document({
          pageContent,
          metadata: {
            source: metadata.source,
            page: metadata.loc.pageNumber,
            text: truncateStringByBytes(pageContent, 36000),
          },
        }),
      ])
    )
  );

  console.log('done', documentCollection)
  
  const supabaseAdminClient = createClient<Database>(
    "https://pjbwbxzmjjokvqfroxnn.supabase.co",
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBqYndieHptampva3ZxZnJveG5uIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTY5MjAzNzkzMSwiZXhwIjoyMDA3NjEzOTMxfQ.wJSbKo9wKLBDGfvEQepqhqybfMITGrkHrk5C9ZhIa3I",
    {
      auth: { persistSession: false }
    }
  );

  const embeddings = new OpenAIEmbeddings({ openAIApiKey: "" })
  
  const store = new SupabaseVectorStore(embeddings, {
    client: supabaseAdminClient,
    tableName: "documents",
  });

  await Promise.all(
    documentCollection.map(async (documents) => {
      await store.addDocuments(documents);
    })
  );
}

load()
