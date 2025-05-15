# Scraped Chat Demo

## Overview

This project demonstrates how to leverage OpenAI's API, particularly Vector Stores, to enable Large Language Models (LLMs) like ChatGPT to interact with custom, scraped data. It provides a foundation for building applications where users can chat with their own datasets, effectively giving LLMs access to information beyond their training data.

This demo forms a starting point. By integrating other OpenAI API features such as the Assistants API, function calling/tools (e.g., for code execution to generate and display charts), you can extend this into a more comprehensive chat application, mimicking functionalities found in ChatGPT.

## Core Concept: Interacting with Your Data via LLMs

Standard LLMs have a knowledge cut-off and are not aware of your private, domain-specific, or very recent data. To make them useful for tasks requiring such information, we employ a technique often referred to as Retrieval Augmented Generation (RAG).

The core idea is:
1.  **Prepare Your Data:** Your custom data (scraped text, documents, etc.) is processed.
2.  **Vectorize and Store:** This data is converted into numerical representations (embeddings) that capture its semantic meaning and stored in a specialized database (a vector store).
3.  **Retrieve Relevant Information:** When a user asks a question, the system first searches the vector store for data chunks most relevant to the query.
4.  **Augment and Generate:** These relevant chunks are then provided as context, along with the user's original query, to an LLM. The LLM uses this augmented context to generate an informed and relevant response.

## OpenAI Vector Stores: A Technical Deep Dive

OpenAI's Vector Stores are a managed service that simplifies the process of storing, managing, and searching through vectorized document chunks. They are a key component for implementing semantic search and RAG pipelines, powering tools like `file_search` in the Assistants API.

Here's a breakdown of how they work and their role in this project:

1.  **Vector Store Creation & Configuration:**
    *   You begin by creating a Vector Store. This acts as a container for your vectorized files.
    *   **API Endpoint:** `POST /v1/vector_stores`
    *   **Key Parameters:**
        *   `name` (string, Optional): A descriptive name for your vector store.
        *   `file_ids` (array, Optional): A list of previously uploaded File IDs to associate with the vector store upon creation.
        *   `chunking_strategy` (object, Optional): Defines how files are chunked if `file_ids` are provided. Defaults to `auto`. Can be `static` with `max_chunk_size_tokens` and `chunk_overlap_tokens`.
        *   `expires_after` (object, Optional): Sets an expiration policy for the vector store (e.g., automatically delete after a certain number of days of inactivity).
        *   `metadata` (map, Optional): Up to 16 key-value pairs (string keys up to 64 chars, string values up to 512 chars) for storing additional structured information.

2.  **File Management:**
    *   **Uploading Files:** Data is first uploaded to OpenAI using the generic File API (`POST /v1/files`). This returns a File ID.
    *   **Attaching Files to Vector Store:** Once files are uploaded, they are attached to a specific Vector Store. This initiates the processing (chunking and embedding) of the file content for that store.
        *   **Single File:** `POST /v1/vector_stores/{vector_store_id}/files`
            *   Requires `file_id`.
            *   Optional: `chunking_strategy` (can override store-level strategy for this specific file), `attributes`.
        *   **Batch Files:** `POST /v1/vector_stores/{vector_store_id}/file_batches`
            *   Requires `file_ids` (an array of File IDs).
            *   Optional: `chunking_strategy`, `attributes`. This is efficient for adding multiple files.
    *   **File Processing Status:** Each file within a vector store (represented by a `vector_store.file` object) has a `status` (e.g., `in_progress`, `completed`, `failed`). The vector store itself also has `file_counts` detailing these statuses. Operations like search should wait for `completed` status.
    *   **Listing & Retrieving Files:**
        *   `GET /v1/vector_stores/{vector_store_id}/files`: Lists files in a vector store.
        *   `GET /v1/vector_stores/{vector_store_id}/files/{file_id}`: Retrieves a specific vector store file object.
        *   `GET /v1/vector_stores/{vector_store_id}/files/{file_id}/content`: Retrieves the parsed content of a file.
    *   **File Attributes:** You can attach metadata (`attributes`) to vector store files (up to 16 key-value pairs, values can be strings, booleans, or numbers). These can be used for filtering during search. Updated via `POST /v1/vector_stores/{vector_store_id}/files/{file_id}`.
    *   **Deleting Files:** `DELETE /v1/vector_stores/{vector_store_id}/files/{file_id}` removes a file from the vector store (the original uploaded file is not deleted from your account by this action).

3.  **Chunking Strategy (Reiteration):**
    *   Files are broken down into "chunks." This is crucial for LLM context windows and efficient retrieval.
    *   Can be defined at the vector store level during creation or overridden per file/batch when adding files.
    *   `auto`: OpenAI determines the best strategy.
    *   `static`: You define `max_chunk_size_tokens` (max tokens per chunk) and `chunk_overlap_tokens` (tokens shared between adjacent chunks to maintain context).

4.  **Embedding Generation:**
    *   Each text chunk is converted into a high-dimensional numerical vector (embedding) using OpenAI's embedding models (e.g., `text-embedding-3-small`).
    *   These embeddings capture semantic meaning, allowing for similarity-based searches.

5.  **Indexing and Storage:**
    *   Embeddings are indexed within the Vector Store for fast and efficient similarity searches.

6.  **Semantic Search & Retrieval:**
    *   **API Endpoint:** `POST /v1/vector_stores/{vector_store_id}/search`
    *   The user's query is embedded, and this query embedding is compared against the stored chunk embeddings.
    *   **Key Parameters:**
        *   `query` (string or array, Required): The search query.
        *   `max_num_results` (integer, Optional, Default: 10, Range: 1-50): Maximum number of relevant chunks to return.
        *   `filters` (object, Optional): Apply filters based on file attributes (e.g., `{"author": "John Doe"}`).
        *   `rewrite_query` (boolean, Optional, Default: false): Whether to let OpenAI rewrite the natural language query for potentially better vector search performance.
        *   `ranking_options` (object, Optional): Advanced options for ranking search results.
    *   The API returns a page of search results, including the chunk content, `score`, `file_id`, `filename`, and `attributes`.

7.  **Context Augmentation for LLM:**
    *   The retrieved text chunks are compiled and injected into the prompt for a chat completion model (e.g., `gpt-4o`).
    *   This provides the LLM with specific, relevant context from your custom data.

**The Vector Store Object (`vector_store`):**
When you create, retrieve, or list vector stores, you interact with the `vector_store` object. Key properties include:
*   `id` (string): The unique identifier (e.g., `vs_abc123`).
*   `object` (string): Always `vector_store`.
*   `created_at` (integer): Unix timestamp of creation.
*   `name` (string): Name of the vector store.
*   `usage_bytes` (integer): Total bytes used by files in the store.
*   `file_counts` (object): Counts of files by status (`in_progress`, `completed`, `failed`, `cancelled`, `total`).
*   `status` (string): Status of the vector store (`expired`, `in_progress`, `completed`). It's ready for use when `completed`.
*   `expires_after` (object): The configured expiration policy.
*   `expires_at` (integer or null): Unix timestamp when it will expire, if an expiration policy is set.
*   `last_active_at` (integer or null): Unix timestamp of last activity.
*   `metadata` (map): Associated metadata.

**Key Management API Operations (Summary):**
*   **Vector Stores:**
    *   Create: `POST /v1/vector_stores`
    *   List: `GET /v1/vector_stores` (supports pagination with `after`, `before`, `limit`, `order`)
    *   Retrieve: `GET /v1/vector_stores/{vector_store_id}`
    *   Modify: `POST /v1/vector_stores/{vector_store_id}` (update `name`, `expires_after`, `metadata`)
    *   Delete: `DELETE /v1/vector_stores/{vector_store_id}`
*   **Vector Store Files:**
    *   Add File: `POST /v1/vector_stores/{vector_store_id}/files`
    *   List Files: `GET /v1/vector_stores/{vector_store_id}/files` (supports pagination and filtering by `status`)
    *   Retrieve File: `GET /v1/vector_stores/{vector_store_id}/files/{file_id}`
    *   Delete File: `DELETE /v1/vector_stores/{vector_store_id}/files/{file_id}`
    *   Retrieve File Content: `GET /v1/vector_stores/{vector_store_id}/files/{file_id}/content`
    *   Update File Attributes: `POST /v1/vector_stores/{vector_store_id}/files/{file_id}`
*   **Vector Store File Batches:**
    *   Create Batch: `POST /v1/vector_stores/{vector_store_id}/file_batches`
    *   Retrieve Batch: `GET /v1/vector_stores/{vector_store_id}/file_batches/{batch_id}`
    *   Cancel Batch: `POST /v1/vector_stores/{vector_store_id}/file_batches/{batch_id}/cancel`
    *   List Files in Batch: `GET /v1/vector_stores/{vector_store_id}/file_batches/{batch_id}/files`

## Project Structure

This project is a Next.js application built with TypeScript. Key configurations and entry points are:

*   **`package.json`**: Defines the project metadata, scripts, and dependencies.
    *   `name`: `scraped-chat`
    *   `scripts`:
        *   `dev`: Starts the Next.js development server with Turbopack (usually on `http://localhost:3000`).
        *   `build`: Builds the application for production.
        *   `start`: Starts a Next.js production server.
        *   `check`: Runs Biome for code linting and formatting checks.
        *   `check:fix`: Runs Biome to automatically fix linting and formatting issues.
        *   `clean`: Removes `node_modules`, `bun.lock` (if using Bun), and the `.next` build directory.
    *   Key `dependencies`:
        *   `next`: The React framework for building the application.
        *   `react`, `react-dom`: Libraries for building user interfaces.
        *   `openai`: The official OpenAI Node.js/TypeScript library for interacting with the API.
        *   `clsx`, `class-variance-authority`, `tailwind-merge`: Utilities for managing CSS classes, especially with Tailwind CSS.
        *   `lucide-react`: Provides a set of simply beautiful icons.
        *   `@radix-ui/*`: UI primitive libraries for building accessible components.
    *   Key `devDependencies`:
        *   `@biomejs/biome`: A fast formatter and linter for web projects.
        *   `typescript`: For static typing.
        *   `tailwindcss`, `postcss`: For utility-first CSS styling.

*   **`src/` directory**: Contains the core source code of the application.
    *   `app/`: Implements the Next.js App Router. Contains pages, layouts, and route handlers. This is where your main application logic for chat interfaces and API interactions would reside.
    *   `components/`: Reusable React components (e.g., chat bubbles, input fields, layout elements).
    *   `hooks/`: Custom React hooks for managing state, side effects, or encapsulating component logic.
    *   `lib/`: Utility functions, helper scripts, and potentially the OpenAI API client configuration or wrappers.
    *   `types/`: TypeScript type definitions for data structures used throughout the application.

## High-Level Flow of this Demo

1.  **Data Ingestion & Vectorization (Conceptual - to be implemented by the user):**
    *   The user provides their data (e.g., scraped web content, text documents).
    *   This data is programmatically uploaded to OpenAI and added to a Vector Store using the `openai` library.
        *   This involves creating a Vector Store if one doesn't exist.
        *   Files are uploaded and then attached to the Vector Store, triggering the chunking and embedding process by OpenAI.

2.  **User Interaction (Chat Interface):**
    *   The Next.js application provides a chat interface built with React components.
    *   When the user types a message and submits it:
        a.  The frontend sends the user's query to a backend API route (likely within `src/app/api/...`).

3.  **Backend Processing (API Route):**
    *   The API route receives the user's query.
    *   It uses the `openai` library to perform a semantic search on the pre-configured Vector Store (`POST /v1/vector_stores/{vector_store_id}/search`) using the user's query.
    *   The most relevant chunks of text are retrieved from the Vector Store.

4.  **LLM Invocation:**
    *   The retrieved text chunks are formatted and combined with the original user query to form a prompt.
    *   This augmented prompt is sent to an OpenAI chat completion model (e.g., `gpt-4o`) via the `openai` library.

5.  **Response Delivery:**
    *   The LLM generates a response based on the provided context and query.
    *   The backend API route sends this response back to the frontend.
    *   The chat interface displays the LLM's response to the user.

## Further Development: Towards a Full ChatGPT Clone

This project provides the RAG (Retrieval Augmented Generation) backbone. To evolve it into a more feature-rich chat application similar to ChatGPT, consider integrating:

*   **OpenAI Assistants API:**
    *   Allows for more stateful and persistent conversations.
    *   Natively supports tools like Code Interpreter (for running Python code, data analysis, generating charts) and File Search (which itself uses Vector Stores for retrieval over provided files).
    *   Manages conversation threads and context automatically.

*   **Function Calling / Tools with Chat Completions:**
    *   Even without the Assistants API, the Chat Completions API supports defining custom tools (functions) that the LLM can decide to call.
    *   This enables the LLM to interact with external systems or perform specific actions. For example:
        *   Define a tool that allows the LLM to request the execution of Python code (e.g., for data visualization with Matplotlib or Seaborn). The application would then execute this code and could even return an image of the chart or the data to the LLM or user.
        *   Tools for fetching live data from the web, interacting with other APIs, etc.

*   **Streaming Responses:** For a more interactive feel, stream responses from the LLM token by token.

*   **Conversation History:** Store and display previous turns of the conversation.

*   **User Authentication & Data Management:** For a production application, you'd need user accounts and a more robust way to manage user-specific vector stores or data access.

## Setup & Running the Demo

1.  **Clone the repository:**
    ```bash
    git clone <repository-url>
    cd scraped-chat
    ```

2.  **Install dependencies:**
    Using npm:
    ```bash
    npm install
    ```
    Or using Bun:
    ```bash
    bun install
    ```
    Or using Yarn:
    ```bash
    yarn install
    ```

3.  **Set up Environment Variables:**
    Create a `.env.local` file in the root of the project and add your OpenAI API key:
    ```env
    OPENAI_API_KEY=your_openai_api_key_here
    # Optionally, if you have a pre-existing Vector Store ID you want to use:
    # OPENAI_VECTOR_STORE_ID=vs_your_vector_store_id
    ```

4.  **Run the development server:**
    Using npm:
    ```bash
    npm run dev
    ```
    Or using Bun:
    ```bash
    bun run dev
    ```
    Or using Yarn:
    ```bash
    yarn dev
    ```
    The application should now be running on `http://localhost:3000` (or the port specified in your `dev` script).

5.  **(First-time / Data Setup)**
    *   You will need to implement the logic to upload your scraped data and create/populate the OpenAI Vector Store. This might involve a separate script or an initial setup step within the application that uses the OpenAI API to:
        1.  Create a new Vector Store (or use an existing one if `OPENAI_VECTOR_STORE_ID` is set).
        2.  Upload your files containing the scraped data.
        3.  Add these files to the Vector Store.
        4.  Wait for the Vector Store and its files to complete processing.

## Contributing

(Optional: Add guidelines for contributing if this is an open project.)

## License

(Optional: Specify a license, e.g., MIT License.)
