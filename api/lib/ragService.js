import OpenAI from 'openai';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';

// Lazy initialization of OpenAI client
let openai = null;

function getOpenAIClient() {
  if (!openai) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY is not set in environment variables');
    }
    openai = new OpenAI({ apiKey });
  }
  return openai;
}

// In-memory vector store (can be replaced with Pinecone, Weaviate, etc.)
const vectorStore = new Map();

class RAGService {
  constructor() {
    this.chunkSize = 1000;
    this.chunkOverlap = 200;
  }

  // Process and chunk document content
  async processDocument(content, documentId) {
    try {
      console.log('Starting document processing for:', documentId);
      
      // Clean and normalize text
      const cleanText = content.replace(/\s+/g, ' ').trim();
      console.log('Text cleaned, length:', cleanText.length);
      
      // Split into chunks
      const chunks = this.splitIntoChunks(cleanText);
      console.log('Text split into chunks:', chunks.length);
      
      // Generate embeddings for each chunk
      console.log('Generating embeddings...');
      const embeddings = await this.generateEmbeddings(chunks);
      console.log('Embeddings generated successfully');
      
      // Store in vector store
      vectorStore.set(documentId, {
        chunks,
        embeddings,
        metadata: {
          documentId,
          chunkCount: chunks.length,
          processedAt: new Date()
        }
      });
      
      console.log('Document processing completed');
      return {
        chunks,
        embeddings: embeddings.flat(),
        chunkCount: chunks.length
      };
    } catch (error) {
      console.error('Error processing document:', error);
      console.error('Document processing error stack:', error.stack);
      throw error;
    }
  }

  // Split text into overlapping chunks
  splitIntoChunks(text) {
    const chunks = [];
    let start = 0;
    
    while (start < text.length) {
      const end = Math.min(start + this.chunkSize, text.length);
      let chunk = text.slice(start, end);
      
      // Try to break at sentence boundary
      if (end < text.length) {
        const lastSentence = chunk.lastIndexOf('.');
        const lastNewline = chunk.lastIndexOf('\n');
        const breakPoint = Math.max(lastSentence, lastNewline);
        
        if (breakPoint > start + this.chunkSize * 0.5) {
          chunk = text.slice(start, start + breakPoint + 1);
          start = start + breakPoint + 1 - this.chunkOverlap;
        } else {
          start = end - this.chunkOverlap;
        }
      } else {
        start = end;
      }
      
      if (chunk.trim().length > 0) {
        chunks.push(chunk.trim());
      }
    }
    
    return chunks;
  }

  // Generate embeddings using OpenAI
  async generateEmbeddings(chunks) {
    try {
      const client = getOpenAIClient();
      const response = await client.embeddings.create({
        model: "text-embedding-3-small",
        input: chunks,
      });
      
      return response.data.map(item => item.embedding);
    } catch (error) {
      console.error('Error generating embeddings:', error);
      throw error;
    }
  }

  // Find relevant chunks using cosine similarity
  findRelevantChunks(queryEmbedding, documentId, topK = 3) {
    const documentData = vectorStore.get(documentId);
    if (!documentData) {
      return [];
    }

    const { chunks, embeddings } = documentData;
    const similarities = [];

    for (let i = 0; i < embeddings.length; i++) {
      const similarity = this.cosineSimilarity(queryEmbedding, embeddings[i]);
      similarities.push({
        chunk: chunks[i],
        similarity,
        index: i
      });
    }

    // Sort by similarity and return top K
    return similarities
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, topK);
  }

  // Calculate cosine similarity
  cosineSimilarity(vecA, vecB) {
    if (vecA.length !== vecB.length) {
      throw new Error('Vectors must have the same length');
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < vecA.length; i++) {
      dotProduct += vecA[i] * vecB[i];
      normA += vecA[i] * vecA[i];
      normB += vecB[i] * vecB[i];
    }

    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  // Process query and generate response
  async processQuery(query, documentId, chatHistory = []) {
    try {
      // Generate embedding for the query
      const queryEmbedding = await this.generateEmbeddings([query]);
      
      // Find relevant chunks
      const relevantChunks = this.findRelevantChunks(queryEmbedding[0], documentId);
      
      if (relevantChunks.length === 0) {
        return {
          response: "I couldn't find relevant information in the document to answer your question. Please make sure you've uploaded a document and try rephrasing your question.",
          sources: []
        };
      }

      // Prepare context from relevant chunks
      const context = relevantChunks.map(chunk => chunk.chunk).join('\n\n');
      
      // Prepare chat history for context
      const historyContext = chatHistory
        .slice(-6) // Last 6 messages for context
        .map(msg => `${msg.role}: ${msg.content}`)
        .join('\n');

      // Generate response using OpenAI
      const systemPrompt = `You are a helpful assistant that answers questions about legal documents related to real estate and renting. 
      
Use the provided document context to answer questions accurately. If the information isn't in the document, say so clearly.

Guidelines:
- Be precise and cite specific sections when possible
- Explain legal terms in simple language
- If something is unclear, suggest consulting a legal professional
- Focus on practical implications for renters/tenants
- Be helpful but not provide legal advice

Document Context:
${context}

${historyContext ? `Previous conversation:\n${historyContext}\n` : ''}`;

      const client = getOpenAIClient();
      const completion = await client.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: query }
        ],
        max_tokens: 500,
        temperature: 0.3
      });

      return {
        response: completion.choices[0].message.content,
        sources: relevantChunks.map(chunk => ({
          text: chunk.chunk.substring(0, 200) + '...',
          similarity: chunk.similarity
        }))
      };
    } catch (error) {
      console.error('Error processing query:', error);
      throw error;
    }
  }

  // Parse PDF content using pdfjs-dist
  async parsePDF(buffer) {
    try {
      console.log('Starting PDF parsing with buffer size:', buffer.length);
      // Convert Buffer to Uint8Array for pdfjs-dist compatibility
      const uint8Array = new Uint8Array(buffer);
      const pdf = await pdfjsLib.getDocument({ data: uint8Array }).promise;
      console.log('PDF loaded successfully, pages:', pdf.numPages);
      let text = '';

      // Extract text from each page
      for (let i = 1; i <= pdf.numPages; i++) {
        console.log(`Processing page ${i}/${pdf.numPages}`);
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items.map(item => item.str).join(' ');
        text += pageText + '\n';
      }

      console.log('PDF parsing completed, total text length:', text.length);
      return text;
    } catch (error) {
      console.error('Error parsing PDF:', error);
      console.error('PDF parsing error stack:', error.stack);
      throw new Error('Failed to parse PDF file');
    }
  }

  // Remove document from vector store
  removeDocument(documentId) {
    vectorStore.delete(documentId);
  }
}

export default new RAGService();